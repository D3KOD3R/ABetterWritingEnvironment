// Intent: verify project source loading preserves save-file data and provenance for project libraries.
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadProjectLibrarySeedFromPath,
  resolveProjectSourcePath,
} from "../apps/desktop/src/project-source.ts";

export function runProjectSourceTest() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const scriptPath = path.join(repoRoot, "scripts", "build-project-data.mjs");
  const referenceFixture = path.join(repoRoot, "SaveTestFile", "project-serva-vitae.abe-project.json");

  const library = loadProjectLibrarySeedFromPath(referenceFixture);
  assert.equal(library.activeProjectId, "project-serva-vitae");
  assert.equal(library.projects.length >= 1, true);

  const project =
    library.projects.find((entry) => entry.id === library.activeProjectId)
    ?? library.projects[0];
  assert.equal(project?.id, "project-serva-vitae");
  assert.equal(project.title, "Project Serva Vitae");
  assert.equal(project.source, "project-file");
  assert.equal(project.workspace.project.stats.chapterCount, 5);
  assert.equal(project.workspace.project.stats.sceneCount, 30);
  assert.equal(project.workspace.project.stats.lineCount, 855);
  assert.equal(project.workspace.world.templates.filter((template) => template.source === "source-template").length, 6);
  assert.equal(
    project.workspace.world.templates.filter((template) => template.source === "source-template").every(
      (template) => typeof template.sourcePath === "string" && template.sourcePath.includes("Template Sheets"),
    ),
    true,
  );
  assert.equal(project.workspace.world.templates.find((template) => template.name === "Flora")?.source, "manual");
  assert.equal(project.manuscriptTasks[0].source, "source-comment");
  assert.match(project.manuscriptTasks[0].sourceDocumentId, /^[A-F0-9-]+$/i);
  assert.match(project.manuscriptTasks[0].sourceCommentId, /^[A-F0-9-]+$/i);
  assert.equal(project.passageNotes[0].source, "source-research");
  assert.match(project.passageNotes[0].sourceDocumentId, /^[A-F0-9-]+$/i);
  assert.equal(
    project.workspace.world.entities.some(
      (entity) => typeof entity.id === "string" && entity.id.startsWith("source-entity-"),
    ),
    true,
  );
  assert.equal(
    project.workspace.world.spines.some((spine) =>
      spine.nodes.some((node) => typeof node.id === "string" && node.id.startsWith("source-node-")),
    ),
    true,
  );
  assert.equal(project.sourceArchive.length, 5);
  assert.equal(project.importReport.importedTasks, 52);
  assert.equal(project.projectSettings.projectSourcePath, "");
  assert.equal(Object.keys(library.sceneStore?.[project.id] ?? {}).length >= project.workspace.project.stats.sceneCount, true);
  assert.equal(countSceneStoreWords(library.sceneStore?.[project.id] ?? {}) > 70000, true);

  const tempDir = mkdtempSync(path.join(tmpdir(), "abe-project-source-"));
  const saveCopyPath = path.join(tempDir, "Project Source Demo.abe-project.json");
  const outputPath = path.join(tempDir, "project-data.json");

  try {
    copyFileSync(referenceFixture, saveCopyPath);

    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        scriptPath,
        "--project-source",
        tempDir,
        "--output",
        outputPath,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    if (result.error) {
      throw result.error;
    }

    assert.equal(
      result.status,
      0,
      `Project source script failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );

    const summary = JSON.parse(result.stdout.trim());
    const data = JSON.parse(readFileSync(outputPath, "utf8"));

    assert.equal(summary.projectCount, library.projects.length);
    assert.equal(summary.chapters, 5);
    assert.equal(summary.scenes, 30);
    assert.equal(summary.blocks, 855);
    assert.equal(summary.tasks, 52);
    assert.equal(summary.passageNotes, 19);
    assert.equal(summary.worldTemplates, 7);
    assert.equal(summary.worldEntities, 31);
    assert.equal(summary.timelineNodes, 4);
    assert.equal(summary.archivedItems, 5);

    assert.equal(data.activeProjectId, "project-serva-vitae");
    assert.equal(data.project.stats.chapterCount, 5);
    assert.equal(data.project.stats.sceneCount, 30);
    assert.equal(data.project.stats.lineCount, 855);
    assert.equal(data.world.stats.templateCount, 7);
    assert.equal(data.world.stats.entityCount, 31);
    assert.equal(data.world.stats.nodeCount, 4);
    assert.equal(data.manuscriptTasks.length, 52);
    assert.equal(data.passageNotes.length, 19);
    assert.equal(data.sourceArchive.length, 5);
    assert.equal(data.manuscriptTasks[0].source, "source-comment");
    assert.equal(data.passageNotes[0].source, "source-research");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const ambiguousDir = mkdtempSync(path.join(tmpdir(), "abe-project-source-ambiguous-"));
  try {
    copyFileSync(referenceFixture, path.join(ambiguousDir, "alpha.abe-project.json"));
    copyFileSync(referenceFixture, path.join(ambiguousDir, "beta.abe-project.json"));
    assert.throws(
      () => resolveProjectSourcePath(ambiguousDir),
      /Multiple project save files found/,
    );
    assert.throws(
      () => loadProjectLibrarySeedFromPath(ambiguousDir),
      /Multiple project save files found/,
    );
  } finally {
    rmSync(ambiguousDir, { recursive: true, force: true });
  }
}

function countSceneStoreWords(sceneStore) {
  return Object.values(sceneStore).reduce((total, sceneDraft) => {
    const text = typeof sceneDraft?.editorText === "string"
      ? sceneDraft.editorText
      : Array.isArray(sceneDraft?.blocks)
        ? sceneDraft.blocks.map((block) => block?.text ?? "").join(" ")
        : "";
    return total + String(text).trim().split(/\s+/).filter(Boolean).length;
  }, 0);
}
