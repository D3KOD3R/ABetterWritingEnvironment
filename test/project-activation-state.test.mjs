// Intent: verify project activation state hydration is isolated from shell-owned effects.
import assert from "node:assert/strict";

import { normalizeDraftProofingState } from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";
import { createProjectActivationStateService } from "../apps/editor/public/state/project-activation-state.js";

export function runProjectActivationStateTest() {
  const state = {
    selectedTaskId: "stale-task",
    selectedPassageNoteId: "stale-note",
    taskContextMenu: { open: true },
    writingTargetState: { previous: true },
  };
  const service = createProjectActivationStateService({
    state,
    createStructureDrafts: () => ({ scenes: [] }),
    createTemplateDrafts: () => [],
    normalizeManuscriptTasks: (tasks) => Array.isArray(tasks) ? tasks : [],
    normalizePassageNotes: (notes) => Array.isArray(notes) ? notes : [],
    normalizeDraftProofingState,
    readRevisionState: () => ({ sessions: [{ id: "revision-1" }] }),
    createRevisionPanelStateForProject: (revisionState) => ({
      selectedSessionId: revisionState.sessions[0].id,
    }),
    normalizeProjectSettingsSnapshot: () => ({
      editorPrefs: { grammarCheckEnabled: true },
      localAiPrefs: { localOnly: true },
      binderPanelWidth: 312,
      consoleDockWidth: 296,
      userSettingPanelResizerLeftPercent: 20,
      userSettingPanelResizerRightPercent: 22,
      consoleDockCollapsed: false,
      collapsedChapterIds: ["chapter-1"],
      collapsedConsoleChapterIds: [],
      projectSourcePath: "C:/projects/project-1.abe-project.json",
      spellcheck: { dictionary: ["Serva"] },
      writingTargetViewMode: "month",
      writingTargetSelectedDateKey: "2026-05-23",
      writingTargetCalendarMonthKey: "2026-05",
      writingTargetState: { history: [{ dateKey: "2026-05-23" }] },
    }),
    buildProjectSettingsCandidate: (record) => record,
    getProjectRecordWordCountForSettings: () => 22,
    normalizeSpellcheckProjectSettings: (settings) => settings,
  });

  service.applyProjectRecordToState({
    id: "project-1",
    title: "Activated Project",
    workspace: {
      project: {
        id: "project-1",
        title: "Prior Title",
      },
    },
    sceneDrafts: { "scene-1": { editorText: "Active text." } },
    manuscriptTasks: [{ id: "task-1" }],
    passageNotes: [{ id: "note-1" }],
    draftProofing: {
      activeRunId: "draft-proof-run-0001",
      runs: [{
        id: "draft-proof-run-0001",
        status: "active",
        coverageByScene: {
          "scene-1": [{ startOffset: 0, endOffset: 10 }],
        },
      }],
    },
  });

  assert.equal(state.activeProjectId, "project-1");
  assert.equal(state.projectLibrarySelectionId, "project-1");
  assert.equal(state.workspace.project.title, "Activated Project");
  assert.equal(state.workspace.voice.provider.id, "local-voice-service");
  assert.equal(state.sceneDrafts["scene-1"].editorText, "Active text.");
  assert.equal(state.manuscriptTasks[0].id, "task-1");
  assert.equal(state.passageNotes[0].id, "note-1");
  assert.equal(state.draftProofing.activeRunId, "draft-proof-run-0001");
  assert.equal(state.draftProofing.runs[0].coverageByScene["scene-1"][0].endOffset, 10);
  assert.equal(state.revisionPanelState.selectedSessionId, "revision-1");
  assert.deepEqual(state.binderSceneMoveHistory, { undoStack: [], redoStack: [] });
  assert.equal(state.selectedTaskId, null);
  assert.equal(state.taskContextMenu, null);
  assert.equal(state.projectSourcePath, "C:/projects/project-1.abe-project.json");
  assert.equal(state.writingTargetProjectId, "project-1");
  assert.equal(state.writingTargetState.history[0].dateKey, "2026-05-23");

  assert.throws(() => service.applyProjectRecordToState(null), /Unable to load a saved project/);
}
