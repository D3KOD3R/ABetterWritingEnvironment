// Intent: load app-native project files into normalized saved-project library snapshots.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  createServaVitaeProjectLibrarySeed,
  type ProjectLibrarySeedRecord,
  type ProjectLibrarySeedSnapshot,
} from "./workspace.ts";
import { logDesktopError, logDesktopInfo } from "./logger.ts";

export interface ProjectSourceOptions {
  now?: string;
}

// Intent: load user-selected project files but fall back to the bundled seed when the source is invalid.
export function loadProjectLibrarySeedFromPath(
  projectPath: string,
  options: ProjectSourceOptions = {},
): ProjectLibrarySeedSnapshot {
  try {
    const resolved = resolveProjectSourcePath(projectPath);
    const payload = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
    const snapshot = normalizeProjectLibrarySnapshot(payload, options.now);
    logDesktopInfo("project-source", "Loaded a project library snapshot from disk.", {
      projectPath: resolved,
      projectCount: snapshot.projects.length,
      activeProjectId: snapshot.activeProjectId,
    });
    return snapshot;
  } catch (error) {
    logDesktopError("project-source", "Using the bundled project library snapshot.", {
      projectPath,
      cause: error instanceof Error ? error.message : String(error),
    });
    return createServaVitaeProjectLibrarySeed();
  }
}

export function resolveProjectSourcePath(projectPath: string): string {
  // Intent: accept either an explicit `.abe-project.json` file or a folder containing one.
  const resolvedPath = path.resolve(String(projectPath ?? ""));
  if (!existsSync(resolvedPath)) {
    throw new Error(`Project source path does not exist: ${resolvedPath}`);
  }

  if (statSync(resolvedPath).isFile()) {
    if (isProjectSaveFile(resolvedPath)) {
      return resolvedPath;
    }

    throw new Error(`Expected a project save file or project folder, got: ${resolvedPath}`);
  }

  const projectBaseName = path.basename(resolvedPath);
  const candidates = [
    path.join(resolvedPath, `${projectBaseName}.abe-project.json`),
    ...readdirSync(resolvedPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isProjectSaveFile(entry.name))
      .map((entry) => path.join(resolvedPath, entry.name)),
  ];

  const indexPath = candidates.find((candidate) => existsSync(candidate));
  if (indexPath) {
    return indexPath;
  }

  const recursiveProjectPath = findFirstMatchingFile(
    resolvedPath,
    (filePath) => isProjectSaveFile(filePath),
  );
  if (recursiveProjectPath) {
    return recursiveProjectPath;
  }

  throw new Error(`Unable to find a project save file inside ${resolvedPath}.`);
}

function normalizeProjectLibrarySnapshot(
  candidate: unknown,
  now?: string,
): ProjectLibrarySeedSnapshot {
  // Intent: enforce the saved-project library contract before the browser consumes imported state.
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Project library snapshot must be an object.");
  }

  const snapshot = candidate as Partial<ProjectLibrarySeedSnapshot> & {
    activeProjectId?: unknown;
    projects?: unknown;
  };

  if (!Array.isArray(snapshot.projects)) {
    throw new Error("Project library snapshot does not contain a project list.");
  }

  const projects = snapshot.projects.map((project, index) =>
    normalizeProjectLibraryRecord(project, now, index),
  );

  return {
    activeProjectId:
      typeof snapshot.activeProjectId === "string" && snapshot.activeProjectId.trim()
        ? snapshot.activeProjectId
        : projects[0]?.id ?? "",
    projects,
  };
}

function normalizeProjectLibraryRecord(
  candidate: unknown,
  now?: string,
  index = 0,
): ProjectLibrarySeedRecord {
  // Intent: backfill optional save fields so older project files remain loadable.
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Project record must be an object.");
  }

  const project = candidate as Partial<ProjectLibrarySeedRecord> & {
    id?: unknown;
    title?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };

  const generatedAt =
    typeof project.updatedAt === "string" && project.updatedAt.trim()
      ? project.updatedAt
      : typeof project.createdAt === "string" && project.createdAt.trim()
        ? project.createdAt
        : now ?? new Date().toISOString();

  return {
    id: typeof project.id === "string" && project.id.trim() ? project.id : `project-${index + 1}`,
    title: typeof project.title === "string" && project.title.trim() ? project.title : "Untitled Project",
    source: typeof project.source === "string" && project.source.trim() ? project.source : "project-file",
    createdAt:
      typeof project.createdAt === "string" && project.createdAt.trim() ? project.createdAt : generatedAt,
    updatedAt:
      typeof project.updatedAt === "string" && project.updatedAt.trim() ? project.updatedAt : generatedAt,
    workspace: normalizeObject(project.workspace, "workspace"),
    sceneDrafts: normalizeObject(project.sceneDrafts, "sceneDrafts"),
    structureDrafts: normalizeStructureDrafts(project.structureDrafts),
    templateDrafts: Array.isArray(project.templateDrafts) ? project.templateDrafts : [],
    manuscriptTasks: Array.isArray(project.manuscriptTasks) ? project.manuscriptTasks : [],
    passageNotes: Array.isArray(project.passageNotes) ? project.passageNotes : [],
    sourceArchive: Array.isArray(project.sourceArchive) ? project.sourceArchive : [],
    importReport: normalizeObject(project.importReport, "importReport"),
    projectSettings: normalizeObject(project.projectSettings, "projectSettings", {
      projectFilePath: "",
      projectSourcePath: "",
      spellcheck: {
        dictionaryWords: [],
        exceptionWords: [],
      },
    }),
    editorPrefs: normalizeObject(project.editorPrefs, "editorPrefs"),
    localAiPrefs: normalizeObject(project.localAiPrefs, "localAiPrefs", { enabled: true }),
  };
}

function normalizeStructureDrafts(candidate: unknown): { scenes: unknown[] } {
  if (!candidate || typeof candidate !== "object") {
    return { scenes: [] };
  }

  const structureDrafts = candidate as { scenes?: unknown };
  return {
    scenes: Array.isArray(structureDrafts.scenes) ? structureDrafts.scenes : [],
  };
}

function normalizeObject<T extends Record<string, unknown>>(
  candidate: unknown,
  label: string,
  fallback: T = {} as T,
): T {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    if (label === "projectSettings") {
      return {
        ...fallback,
      } as T;
    }

    return { ...fallback } as T;
  }

  return {
    ...fallback,
    ...(candidate as Record<string, unknown>),
  } as T;
}

function findFirstMatchingFile(rootPath: string, predicate: (filePath: string) => boolean) {
  // Intent: locate app-native project files in nested project folders without reviving legacy import formats.
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

function isProjectSaveFile(filePath: string) {
  return filePath.toLowerCase().endsWith(".abe-project.json");
}
