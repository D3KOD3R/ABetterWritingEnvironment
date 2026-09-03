// Intent: verify project activation state hydration is isolated from shell-owned effects.
import assert from "node:assert/strict";

import { normalizeDraftProofingState } from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";
import { createProjectActivationStateService } from "../apps/editor/public/state/project-activation-state.js";

export function runProjectActivationStateTest() {
  const state = {
    selectedTaskId: "stale-task",
    selectedPassageNoteId: "stale-note",
    taskContextMenu: { open: true },
    sidePanelCustomizationOpen: true,
    sidePanelCustomizationPosition: { x: 100, y: 120 },
    topPanelCustomizationOpen: true,
    topPanelCustomizationPosition: { x: 20, y: 30 },
    topPanelCustomizationGroupId: "target-strip",
    grammarCheckPanel: {
      open: true,
      position: { left: 200, top: 120 },
      bounds: { left: 200, top: 120, width: 480, height: 520 },
      selectedWords: ["serva"],
      selectionAnchorIndex: 0,
    },
    writingTargetState: { previous: true },
    draftProofMarksVisible: false,
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
      activePane: "world",
      binderPanelWidth: 312,
      consoleDockWidth: 296,
      userSettingPanelResizerLeftPercent: 20,
      userSettingPanelResizerRightPercent: 22,
      panelResizerLayoutProfiles: {
        "workspace-1600": {
          profileKey: "workspace-1600",
          workspaceWidth: 1600,
          binderPanelWidth: 312,
          consoleDockWidth: 296,
          leftPercent: 19.5,
          rightPercent: 18.5,
        },
      },
      worldSpineEventRailWidth: 248,
      worldSpineManuscriptPaneWidth: 372,
      worldSpinePanelLayoutProfiles: {
        "workspace-1600": {
          profileKey: "workspace-1600",
          workspaceWidth: 1600,
          eventRailWidth: 248,
          manuscriptPaneWidth: 372,
          leftPercent: 15.5,
          rightPercent: 23.3,
        },
      },
      worldSpineRightPaneMode: "related-cards",
      consoleDockCollapsed: false,
      sidePanelsHidden: true,
      sidePanelVisibility: { issues: false, inspiration: true, research: true },
      topPanelVisibility: {
        manuscript: { wordTarget: false, developerLogs: true },
        world: { wordTarget: true, developerLogs: true },
        narration: { wordTarget: true, developerLogs: true },
      },
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
      voice: {
        profiles: [{ id: "voice-profile-1", displayName: "Narrator" }],
        bindings: [{ id: "voice-binding-1", profileId: "voice-profile-1" }],
        recordings: [{ id: "recording-1", profileId: "voice-profile-1" }],
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
  assert.equal(state.workspace.analysis.provider.id, "local-rule-analysis");
  assert.equal(state.workspace.analysis.dreamScaping, null);
  assert.deepEqual(state.workspace.analysis.suggestionQueue, []);
  assert.equal(state.workspace.narration.provider.id, "local-audio-service");
  assert.equal(state.workspace.narration.session, null);
  assert.deepEqual(state.workspace.narration.alignmentJobs, []);
  assert.equal(state.workspace.voice.provider.id, "local-voice-service");
  assert.equal(state.workspace.voice.profiles[0].id, "voice-profile-1");
  assert.equal(state.workspace.voice.bindings[0].id, "voice-binding-1");
  assert.equal(state.workspace.voice.recordings[0].id, "recording-1");
  assert.deepEqual(state.workspace.voice.renderJobs, []);
  assert.equal(state.sceneDrafts["scene-1"].editorText, "Active text.");
  assert.equal(state.manuscriptTasks[0].id, "task-1");
  assert.equal(state.passageNotes[0].id, "note-1");
  assert.equal(state.draftProofing.activeRunId, "draft-proof-run-0001");
  assert.equal(state.draftProofing.runs[0].coverageByScene["scene-1"][0].endOffset, 10);
  assert.equal(state.draftProofMarksVisible, true);
  assert.equal(state.revisionPanelState.selectedSessionId, "revision-1");
  assert.deepEqual(state.binderSceneMoveHistory, { undoStack: [], redoStack: [] });
  assert.deepEqual(state.manuscriptMarkHistory, { undoStack: [], redoStack: [] });
  assert.deepEqual(state.worldSpineHistory, { undoStack: [], redoStack: [] });
  assert.equal(state.selectedTaskId, null);
  assert.equal(state.taskContextMenu, null);
  assert.equal(state.sidePanelCustomizationOpen, false);
  assert.equal(state.sidePanelCustomizationPosition, null);
  assert.equal(state.topPanelCustomizationOpen, false);
  assert.equal(state.topPanelCustomizationPosition, null);
  assert.equal(state.topPanelCustomizationGroupId, "");
  assert.deepEqual(state.grammarCheckPanel, {
    open: false,
    position: null,
    bounds: null,
    selectedWords: [],
    selectionAnchorIndex: null,
  });
  assert.equal(state.projectSourcePath, "C:/projects/project-1.abe-project.json");
  assert.equal(state.activePane, "world");
  assert.equal(state.sidePanelsHidden, true);
  assert.deepEqual(state.sidePanelVisibility, { issues: false, inspiration: true, research: true });
  assert.deepEqual(state.topPanelVisibility, {
    manuscript: { wordTarget: false, developerLogs: true },
    world: { wordTarget: true, developerLogs: true },
    narration: { wordTarget: true, developerLogs: true },
  });
  assert.equal(state.writingTargetProjectId, "project-1");
  assert.equal(state.writingTargetState.history[0].dateKey, "2026-05-23");
  assert.equal(state.panelResizerLayoutProfiles["workspace-1600"].binderPanelWidth, 312);
  assert.equal(state.worldSpineEventRailWidth, 248);
  assert.equal(state.worldSpineManuscriptPaneWidth, 372);
  assert.equal(state.worldSpinePanelLayoutProfiles["workspace-1600"].eventRailWidth, 248);
  assert.equal(state.worldSpineRightPaneMode, "related-cards");

  state.draftProofMarksVisible = true;
  service.applyProjectRecordToState({
    id: "project-2",
    title: "Completed Project",
    workspace: {
      project: {
        id: "project-2",
        title: "Prior Completed Title",
      },
    },
    draftProofing: {
      activeRunId: "",
      runs: [{
        id: "draft-proof-run-0001",
        status: "completed",
        coverageByScene: {
          "scene-1": [{ startOffset: 0, endOffset: 10 }],
        },
      }],
    },
  });
  assert.equal(state.draftProofMarksVisible, false);

  assert.throws(() => service.applyProjectRecordToState(null), /Unable to load a saved project/);
}
