// Intent: verify durable project-record construction stays separate from live editor shell state.
import assert from "node:assert/strict";

import {
  buildWorkspaceStatsFromProjectIndex,
  getChapterWordCount,
  getProjectRecordWordCountForSettings,
  getProjectWordCount,
} from "../apps/editor/public/adapters/storage/project-metrics.js";
import { normalizeDraftProofingState } from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";
import { normalizeProjectSelectionDefaults } from "../apps/editor/public/state/project-library-state.js";
import { createProjectRecordStateService } from "../apps/editor/public/state/project-record-state.js";

export function runProjectRecordStateTest() {
  const hydrationSafeIndex = {
    scenes: [
      { id: "scene-1", chapterId: "chapter-1", lineCount: 2, wordCount: 100 },
      { id: "scene-2", chapterId: "chapter-1", lineCount: 3, wordCount: 200 },
    ],
    chapters: [
      { id: "chapter-1", sceneIds: ["scene-1", "scene-2"], lineCount: 5, wordCount: 300 },
    ],
  };
  assert.equal(getProjectWordCount(hydrationSafeIndex), 300);
  assert.equal(getProjectWordCount(hydrationSafeIndex, { "scene-1": 100 }), 300);
  assert.equal(getProjectWordCount(hydrationSafeIndex, { "scene-1": 105 }), 305);
  assert.equal(getProjectWordCount(hydrationSafeIndex, { "scene-1": 95 }), 295);
  assert.equal(getChapterWordCount(hydrationSafeIndex, "chapter-1", { "scene-1": 105 }), 305);
  assert.equal(getProjectRecordWordCountForSettings({
    projectIndex: hydrationSafeIndex,
    sceneDrafts: {
      "scene-2": { sceneId: "scene-2", location: "Mars", locationRowKey: "mars" },
    },
  }), 300);
  assert.equal(getProjectRecordWordCountForSettings({
    projectIndex: hydrationSafeIndex,
    sceneDrafts: {
      "scene-1": { sceneId: "scene-1", editorText: Array.from({ length: 100 }, () => "word").join(" ") },
    },
  }), 300);
  assert.deepEqual(buildWorkspaceStatsFromProjectIndex(hydrationSafeIndex), {
    chapterCount: 1,
    sceneCount: 2,
    lineCount: 5,
    wordCount: 300,
  });

  const service = createProjectRecordStateService({
    createStructureDrafts: () => ({ sceneOrder: [] }),
    createTemplateDrafts: () => [],
    createDefaultEditorPrefs: () => ({ font: "serif" }),
    createDefaultLocalAiPrefs: () => ({ localOnly: true }),
    normalizeManuscriptTasks: (tasks) => Array.isArray(tasks) ? tasks : [],
    normalizePassageNotes: (notes) => Array.isArray(notes) ? notes : [],
    normalizeDraftProofingState,
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
    draftProofing: {
      activeRunId: "draft-proof-run-0001",
      runs: [{
        id: "draft-proof-run-0001",
        status: "active",
        iterationNumber: 1,
        coverageByScene: {
          "scene-1": [{ startOffset: 0, endOffset: 6 }],
        },
      }],
    },
    revisions: { sessions: [] },
  });
  assert.equal(record.id, "project-1");
  assert.equal(record.workspace.selectionDefaults.sceneId, "scene-1");
  assert.equal(record.projectIndex.projectId, "project-1");
  assert.equal(record.workspace.project.stats.sceneCount, 1);
  assert.equal(record.schemaVersion, 3);
  assert.equal(record.draftProofing.activeRunId, "draft-proof-run-0001");
  assert.deepEqual(record.draftProofing.runs[0].coverageByScene["scene-1"].map((span) => [
    span.startOffset,
    span.endOffset,
  ]), [[0, 6]]);

  const normalized = service.normalizeProjectRecord({
    ...record,
    title: "",
  }, {
    projectTitle: "Recovered Project",
  });
  assert.equal(normalized.title, "Recovered Project");
  assert.equal(normalized.workspace.project.title, "Recovered Project");
  assert.equal(normalized.sceneDrafts["scene-1"].editorText, "The first line.");
  assert.equal(normalized.draftProofing.activeRunId, "draft-proof-run-0001");
}
