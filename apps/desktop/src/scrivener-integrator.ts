import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  createProjectLibrarySeedFromImportedData,
  type ImportedProjectData,
  type ProjectLibrarySeedSnapshot,
} from "./workspace.ts";
import { logDesktopError, logDesktopInfo } from "./logger.ts";

const SCRIVENER_IMPORT_SCRIPT_PATH = fileURLToPath(
  new URL("../../../scripts/build-project-data.mjs", import.meta.url),
);

export interface ResolvedScrivenerProjectPaths {
  projectRoot: string;
  indexPath: string;
  dataRoot: string;
  projectTitle: string;
  projectId: string;
  worldId: string;
}

export interface ScrivenerProjectImportOptions {
  now?: string;
}

export function importScrivenerProjectLibrarySeed(
  projectPath: string,
  options: ScrivenerProjectImportOptions = {},
): ProjectLibrarySeedSnapshot {
  const resolved = resolveScrivenerProjectPaths(projectPath);
  const imported = runScrivenerImportBundle(resolved, options.now);
  return createProjectLibrarySeedFromImportedData(imported, {
    sourceLabel: resolved.projectTitle,
  });
}

export function resolveScrivenerProjectPaths(projectPath: string): ResolvedScrivenerProjectPaths {
  const resolvedPath = path.resolve(String(projectPath ?? ""));
  if (!existsSync(resolvedPath)) {
    throw new Error(`Scrivener project path does not exist: ${resolvedPath}`);
  }

  const projectRoot = statSync(resolvedPath).isDirectory()
    ? resolvedPath
    : path.dirname(resolvedPath);
  const indexPath = findScrivenerIndexPath(resolvedPath, projectRoot);
  const actualProjectRoot = path.dirname(indexPath);
  const dataRoot = findScrivenerDataRoot(indexPath, actualProjectRoot);
  if (!existsSync(dataRoot)) {
    throw new Error(`Unable to find Scrivener project data root: ${dataRoot}`);
  }

  const projectTitle = inferProjectTitle(actualProjectRoot, indexPath);
  const projectHash = createHash("sha1")
    .update(path.normalize(actualProjectRoot).toLowerCase())
    .digest("hex")
    .slice(0, 10);

  return {
    projectRoot: actualProjectRoot,
    indexPath,
    dataRoot,
    projectTitle,
    projectId: `project-${slugify(projectTitle)}-${projectHash}`,
    worldId: `world-${slugify(projectTitle)}-${projectHash}`,
  };
}

function runScrivenerImportBundle(
  resolved: ResolvedScrivenerProjectPaths,
  now?: string,
): ImportedProjectData {
  const outputPath = path.join(
    tmpdir(),
    `abe-scrivener-import-${process.pid}-${Date.now()}-${randomUUID()}.json`,
  );

  try {
    const result = spawnSync(
      process.execPath,
      [
        SCRIVENER_IMPORT_SCRIPT_PATH,
        "--index",
        resolved.indexPath,
        "--data-root",
        resolved.dataRoot,
        "--output",
        outputPath,
        "--now",
        now ?? new Date().toISOString(),
        "--project-title",
        resolved.projectTitle,
        "--project-id",
        resolved.projectId,
        "--world-id",
        resolved.worldId,
      ],
      {
        encoding: "utf8",
      },
    );

    if (result.error) {
      logDesktopError("import", "The Scrivener project import script failed to spawn.", {
        error: result.error,
        indexPath: resolved.indexPath,
        dataRoot: resolved.dataRoot,
      });
      throw result.error;
    }

    if (result.status !== 0) {
      logDesktopError("import", "The Scrivener project import script exited with an error.", {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
        indexPath: resolved.indexPath,
        dataRoot: resolved.dataRoot,
      });
      throw new Error(
        `Scrivener import failed with status ${result.status}: ${result.stderr || result.stdout || "unknown error"}`,
      );
    }

    try {
      const payload = JSON.parse(readFileSync(outputPath, "utf8")) as ImportedProjectData;
      logDesktopInfo("import", "Imported a Scrivener project package.", {
        projectId: payload.project.id,
        projectTitle: payload.project.title,
        chapters: payload.project.chapters.length,
        scenes: payload.project.chapters.reduce((count, chapter) => count + chapter.scenes.length, 0),
        templates: payload.world.templates.length,
        manuscriptTasks: payload.manuscriptTasks.length,
        passageNotes: payload.passageNotes.length,
        archivedItems: payload.sourceArchive?.length ?? 0,
        indexPath: resolved.indexPath,
        dataRoot: resolved.dataRoot,
      });
      return payload;
    } catch (error) {
      logDesktopError("import", "Unable to read the Scrivener import output bundle.", {
        error,
        outputPath,
        indexPath: resolved.indexPath,
        dataRoot: resolved.dataRoot,
      });
      throw error;
    }
  } finally {
    try {
      if (existsSync(outputPath)) {
        rmSync(outputPath, { force: true });
      }
    } catch {
      // Temporary import output cleanup is best-effort only.
    }
  }
}

function findScrivenerIndexPath(resolvedPath: string, projectRoot: string) {
  if (statSync(resolvedPath).isFile()) {
    if (path.extname(resolvedPath).toLowerCase() === ".scrivx") {
      return resolvedPath;
    }

    throw new Error(`Expected a Scrivener .scrivx file or project folder, got: ${resolvedPath}`);
  }

  const projectBaseName = path.basename(projectRoot);
  const candidates = [
    path.join(projectRoot, `${projectBaseName}.scrivx`),
    ...readdirSync(projectRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".scrivx"))
      .map((entry) => path.join(projectRoot, entry.name)),
  ];

  const indexPath = candidates.find((candidate) => existsSync(candidate));
  if (indexPath) {
    return indexPath;
  }

  const recursiveIndexPath = findFirstMatchingFile(projectRoot, (filePath) =>
    filePath.toLowerCase().endsWith(".scrivx"),
  );
  if (recursiveIndexPath) {
    return recursiveIndexPath;
  }

  throw new Error(`Unable to find a Scrivener .scrivx file inside ${projectRoot}.`);
}

function findScrivenerDataRoot(indexPath: string, projectRoot: string) {
  const directRoot = path.join(projectRoot, "Files", "Data");
  if (existsSync(directRoot)) {
    return directRoot;
  }

  const indexRoot = path.dirname(indexPath);
  const indexRootData = path.join(indexRoot, "Files", "Data");
  if (existsSync(indexRootData)) {
    return indexRootData;
  }

  const recursiveDataRoot = findFirstMatchingDirectory(projectRoot, (directoryPath) =>
    path.basename(path.dirname(directoryPath)).toLowerCase() === "files" &&
    path.basename(directoryPath).toLowerCase() === "data",
  );
  if (recursiveDataRoot) {
    return recursiveDataRoot;
  }

  return directRoot;
}

function findFirstMatchingFile(rootPath: string, predicate: (filePath: string) => boolean) {
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isFile() && predicate(entryPath)) {
      return entryPath;
    }

    if (entry.isDirectory()) {
      const found = findFirstMatchingFile(entryPath, predicate);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findFirstMatchingDirectory(rootPath: string, predicate: (directoryPath: string) => boolean) {
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(rootPath, entry.name);
    if (predicate(entryPath)) {
      return entryPath;
    }

    const found = findFirstMatchingDirectory(entryPath, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

function inferProjectTitle(projectRoot: string, indexPath: string) {
  const folderTitle = path.basename(projectRoot).replace(/\.scriv$/i, "").trim();
  if (folderTitle) {
    return folderTitle;
  }

  const fileTitle = path.basename(indexPath, path.extname(indexPath)).trim();
  if (fileTitle) {
    return fileTitle;
  }

  return "Imported Scrivener Project";
}

function slugify(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scrivener-project";
}
