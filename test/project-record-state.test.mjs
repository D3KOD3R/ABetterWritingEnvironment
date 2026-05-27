// Intent: verify durable project-record construction stays separate from live editor shell state.
import assert from "node:assert/strict";

import { normalizeProjectSelectionDefaults } from "../apps/editor/public/state/project-library-state.js";
import { createProjectRecordStateService } from "../apps/editor/public/state/project-record-state.js";

export function runProjectRecordStateTest() {
  const service = createProjectRecordStateService({
    createStructureDrafts: () => ({ sceneOrder: [] }),
    createTemplateDrafts: () => [],
    createDefaultEditorPrefs: () => ({ font: "serif" }),
    createDefaultLocalAiPrefs: () => ({ localOnly: true }),
    normalizeManuscriptTasks: (tasks) => Array.isArray(tasks) ? tasks : [],
    normalizePassageNotes: (notes) => Array.isArray(notes) ? notes : [],
    normalizeProjectSelectionDefaults,
    normalizeProjectSettingsSnapshot: (settings) => ({
      editorPrefs: settings.editorPrefs ?? { font: "serif" },
      localAiPrefs: settings.localAiPrefs ?? { localOnly: true },
    }),
    buildProjectSettingsCandidate: (candidate) => candidate.projectSettings ?? candidate,
    getProjectRecordWordCountForSettings: () => 12,
    getPersistableRevisionProjectState: (revisions) => revisions ?? null,
    buildProjectIndexForRecord: (record) => ({
      projectId: record.id,
      chapters: [{ id: "chapter-1" }],
      scenes: [{ id: "scene-1", lineCount: 1 }],
    }),
    buildWorkspaceStatsFromProjectIndex: (index) => ({
      chapterCount: index.chapters.length,
      sceneCount: index.scenes.length,
      lineCount: 1,
    }),
    projectSchemaVersion: 3,
  });

  const record = service.createProjectRecordFromWorkspace({
    project: {
      id: "project-1",
      title: "Project One",
      lines: [{ blockId: "block-1", sceneId: "scene-1" }],
    },
    selectionDefaults: {},
  }, {
    sceneDrafts: {
      "scene-1": {
        sceneId: "scene-1",
        editorText: "The first line.",
      },
    },
    manuscriptTasks: [{ id: "task-1" }],
    passageNotes: [{ id: "note-1" }],
    revisions: { sessions: [] },
  });
  assert.equal(record.id, "project-1");
  assert.equal(record.workspace.selectionDefaults.sceneId, "scene-1");
  assert.equal(record.projectIndex.projectId, "project-1");
  assert.equal(record.workspace.project.stats.sceneCount, 1);
  assert.equal(record.schemaVersion, 3);

  const normalized = service.normalizeProjectRecord({
    ...record,
    title: "",
  }, {
    projectTitle: "Recovered Project",
  });
  assert.equal(normalized.title, "Recovered Project");
  assert.equal(normalized.workspace.project.title, "Recovered Project");
  assert.equal(normalized.sceneDrafts["scene-1"].editorText, "The first line.");
}
