// Intent: verify save-time runtime state assembly is owned outside the editor shell.
import assert from "node:assert/strict";

import { createProjectRuntimeRecordStateService } from "../apps/editor/public/state/project-runtime-record-state.js";

export function runProjectRuntimeRecordStateTest() {
  const state = {
    activeProjectId: "project-active",
    selectedSceneId: "scene-1",
    projectTitle: "Runtime Project Title",
    workspace: {
      generatedAt: "2026-05-23T01:00:00.000Z",
      project: {
        id: "project-1",
        title: "Stored Workspace Title",
      },
      selectionDefaults: {
        issueId: "issue-1",
      },
    },
    projectLibrary: [{
      id: "project-1",
      source: "project-file",
      createdAt: "2026-05-22T01:00:00.000Z",
      projectIndex: { scenes: [{ id: "scene-1" }] },
      sourceArchive: [{ id: "source-1" }],
      importReport: { importedSceneCount: 1 },
    }],
    sceneDrafts: { "scene-1": { editorText: "Runtime manuscript text." } },
    structureDrafts: { scenes: [] },
    templateDrafts: [{ id: "template-1" }],
    manuscriptTasks: [{ id: "task-1" }],
    passageNotes: [{ id: "note-1" }],
    draftProofing: {
      activeRunId: "draft-proof-run-0001",
      runs: [{
        id: "draft-proof-run-0001",
        status: "active",
        coverageByScene: {
          "scene-1": [{ startOffset: 0, endOffset: 12 }],
        },
      }],
    },
    revisionState: { sessions: [] },
    editorPrefs: { grammarCheckEnabled: true },
    localAiPrefs: { localOnly: true },
  };
  const received = [];
  const service = createProjectRuntimeRecordStateService({
    state,
    getCurrentManuscriptWordCount: () => 18,
    createProjectSettingsSnapshotFromState: (options) => ({
      currentWordCount: options.currentWordCount,
      capturedAt: options.now.toISOString(),
    }),
    captureSceneSelectionDefaultsForSave: () => ({
      blockId: "block-1",
      lineNumber: 3,
      startOffset: 7,
      endOffset: 9,
      scrollTop: 24,
      scrollLeft: 2,
    }),
    captureInlinePassageDraftDefaultsForSave: () => ({
      sceneId: "scene-1",
      noteType: "research",
    }),
    createProjectRecordFromWorkspace: (workspace, options) => {
      received.push({ workspace, options });
      return { workspace, ...options };
    },
    createTimestamp: () => "2026-05-23T02:00:00.000Z",
  });

  const record = service.createProjectRecordFromRuntimeState();
  assert.equal(received.length, 1);
  assert.equal(record.id, "project-1");
  assert.equal(record.title, "Runtime Project Title");
  assert.equal(record.source, "project-file");
  assert.equal(record.createdAt, "2026-05-22T01:00:00.000Z");
  assert.equal(record.updatedAt, "2026-05-23T02:00:00.000Z");
  assert.deepEqual(record.persistedProjectIndex, { scenes: [{ id: "scene-1" }] });
  assert.equal(record.projectSettings.currentWordCount, 18);
  assert.equal(record.projectSettings.capturedAt, "2026-05-23T02:00:00.000Z");
  assert.equal(record.workspace.selectionDefaults.issueId, "issue-1");
  assert.equal(record.workspace.selectionDefaults.sceneId, "scene-1");
  assert.equal(record.workspace.selectionDefaults.sceneSelectionStart, 7);
  assert.equal(record.workspace.selectionDefaults.inlinePassageDraft.noteType, "research");
  assert.equal(record.draftProofing.activeRunId, "draft-proof-run-0001");
  assert.equal(record.draftProofing.runs[0].coverageByScene["scene-1"][0].endOffset, 12);

  const withoutWorkspace = createProjectRuntimeRecordStateService({
    state: { projectLibrary: [] },
    getCurrentManuscriptWordCount: () => 0,
    createProjectSettingsSnapshotFromState: () => ({}),
    captureSceneSelectionDefaultsForSave: () => ({}),
    captureInlinePassageDraftDefaultsForSave: () => null,
    createProjectRecordFromWorkspace: () => {
      throw new Error("Should not build a record without an active workspace project.");
    },
  });
  assert.equal(withoutWorkspace.createProjectRecordFromRuntimeState(), null);
}
