#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadProjectLibrarySeedFromPath, resolveProjectSourcePath } from "../apps/desktop/src/project-source.ts";

const args = parseArgs(process.argv.slice(2));
const projectSource = requireArg(
  args.projectSource ?? args.projectFile ?? args.input ?? args.source,
  "--project-source",
);
const outputPath = requireArg(args.output, "--output");
const now = args.now ?? new Date().toISOString();

const resolvedProjectSource = resolveProjectSourcePath(projectSource);
if (!existsSync(resolvedProjectSource)) {
  throw new Error(`Project source does not exist: ${resolvedProjectSource}`);
}

const library = loadProjectLibrarySeedFromPath(resolvedProjectSource, { now });
const activeProject =
  library.projects.find((project) => project.id === library.activeProjectId) ??
  library.projects[0];

if (!activeProject) {
  throw new Error("The project source does not contain any projects.");
}

const projectData = {
  schemaVersion: 1,
  generatedAt: now,
  activeProjectId: library.activeProjectId,
  project: cloneValue(activeProject.workspace.project),
  world: cloneValue(activeProject.workspace.world),
  manuscriptTasks: cloneValue(activeProject.manuscriptTasks ?? []),
  passageNotes: cloneValue(activeProject.passageNotes ?? []),
  sourceArchive: cloneValue(activeProject.sourceArchive ?? []),
  importReport: cloneValue(activeProject.importReport ?? {}),
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(projectData, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      projectCount: library.projects.length,
      chapters: Number(projectData.project?.stats?.chapterCount ?? 0),
      scenes: Number(projectData.project?.stats?.sceneCount ?? 0),
      blocks: Number(projectData.project?.stats?.lineCount ?? 0),
      tasks: projectData.manuscriptTasks.length,
      passageNotes: projectData.passageNotes.length,
      worldEntities: Number(projectData.world?.stats?.entityCount ?? 0),
      worldTemplates: Number(projectData.world?.stats?.templateCount ?? 0),
      timelineNodes: Number(projectData.world?.stats?.nodeCount ?? 0),
      archivedItems: projectData.sourceArchive.length,
    },
    null,
    2,
  ),
);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    parsed[key] = argv[index + 1];
    index += 1;
  }

  return parsed;
}

function requireArg(value, label) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return path.resolve(value);
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
