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
    const cause = error instanceof Error ? error.message : String(error);
    // Intent: ambiguous project folders must fail visibly instead of loading an unrelated fallback project.
    if (isAmbiguousProjectSourceMessage(cause)) {
      logDesktopError("project-source", "Project source folder is ambiguous.", {
        projectPath,
        cause,
      });
      throw error;
    }

    logDesktopError("project-source", "Using the bundled project library snapshot.", {
      projectPath,
      cause,
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
    if (isProjectSaveFile(resolvedPath) || isProjectManifestFile(resolvedPath)) {
      return resolvedPath;
    }

    throw new Error(`Expected a project save file or project folder, got: ${resolvedPath}`);
  }

  const projectBaseName = path.basename(resolvedPath);
  const preferredCandidates = [
    path.join(resolvedPath, "project.json"),
    path.join(resolvedPath, `${projectBaseName}.abe-project.json`),
  ];

  const preferredPath = preferredCandidates.find((candidate) => existsSync(candidate));
  if (preferredPath) {
    return preferredPath;
  }

  // Intent: never silently choose one save file from a folder that contains multiple projects.
  const directProjectFiles = readdirSync(resolvedPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (isProjectSaveFile(entry.name) || isProjectManifestFile(entry.name)))
    .map((entry) => path.join(resolvedPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
  if (directProjectFiles.length === 1) {
    return directProjectFiles[0];
  }
  if (directProjectFiles.length > 1) {
    throw new Error(
      `Multiple project save files found inside ${resolvedPath}. Choose a specific project file instead of the folder.`,
    );
  }

  const recursiveProjectPaths = findMatchingFiles(
    resolvedPath,
    (filePath) => isProjectSaveFile(filePath) || isProjectManifestFile(filePath),
    2,
  );
  if (recursiveProjectPaths.length === 1) {
    return recursiveProjectPaths[0];
  }
  if (recursiveProjectPaths.length > 1) {
    throw new Error(
      `Multiple nested project save files found inside ${resolvedPath}. Choose a specific project file instead of the folder.`,
    );
  }

  throw new Error(`Unable to find a project save file inside ${resolvedPath}.`);
}

function isAmbiguousProjectSourceMessage(message: string) {
  // Intent: keep user-directed folder ambiguity distinct from ordinary missing/invalid seed fallback.
  return message.startsWith("Multiple project save files found")
    || message.startsWith("Multiple nested project save files found");
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
      userSettingPanelResizerLeftPercent: null,
      userSettingPanelResizerRightPercent: null,
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

function findMatchingFiles(rootPath: string, predicate: (filePath: string) => boolean, limit = Number.POSITIVE_INFINITY) {
  // Intent: locate app-native project files in nested project folders while preserving ambiguity detection.
  const matches: string[] = [];
  const entries = readdirSync(rootPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isFile() && predicate(entryPath)) {
      matches.push(entryPath);
      if (matches.length >= limit) {
        return matches;
      }
    }

    if (entry.isDirectory()) {
      const found = findMatchingFiles(entryPath, predicate, limit - matches.length);
      matches.push(...found);
      if (matches.length >= limit) {
        return matches;
      }
    }
  }

  return matches;
}

function isProjectSaveFile(filePath: string) {
  return filePath.toLowerCase().endsWith(".abe-project.json");
}

function isProjectManifestFile(filePath: string) {
  return path.basename(filePath).toLowerCase() === "project.json";
}
