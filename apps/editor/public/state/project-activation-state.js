// Intent: hydrate live editor state from an activated project record without owning shell effects.

import { normalizeWorkspacePaneId } from "./editor-ui-state.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createDefaultVoiceWorkspace() {
  return {
    provider: {
      id: "local-voice-service",
      label: "Local Voice",
      availability: "ready",
      synthesisMode: "local",
    },
    profiles: [],
    bindings: [],
    renderJobs: [],
    recordings: [],
  };
}

export function createProjectActivationStateService({
  state,
  clone = cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  normalizeMetadataSubgroups = (value) => Array.isArray(value) ? clone(value) : [],
  normalizeDraftProofingState = () => ({ schemaVersion: 1, activeRunId: "", runs: [] }),
  readRevisionState,
  createRevisionPanelStateForProject,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  normalizeSpellcheckProjectSettings,
} = {}) {
  const requiredFunctions = {
    createStructureDrafts,
    createTemplateDrafts,
    normalizeManuscriptTasks,
    normalizePassageNotes,
    readRevisionState,
    createRevisionPanelStateForProject,
    normalizeProjectSettingsSnapshot,
    buildProjectSettingsCandidate,
    getProjectRecordWordCountForSettings,
    normalizeSpellcheckProjectSettings,
  };

  if (!state || typeof state !== "object") {
    throw new Error("ProjectActivationStateService requires state.");
  }
  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`ProjectActivationStateService requires ${name}.`);
    }
  }

  // Intent: project activation should replace runtime-owned durable state in one explicit assignment path.
  function applyProjectRecordToState(record) {
    if (!record?.workspace?.project) {
      throw new Error("Unable to load a saved project.");
    }

    state.activeProjectId = record.id;
    state.projectLibrarySelectionId = record.id;
    state.workspace = clone(record.workspace);
    if (!state.workspace.voice || typeof state.workspace.voice !== "object") {
      state.workspace.voice = createDefaultVoiceWorkspace();
    } else if (!Array.isArray(state.workspace.voice.recordings)) {
      state.workspace.voice.recordings = [];
    }
    state.projectTitle = record.title ?? state.workspace.project.title;
    state.workspace.project.title = state.projectTitle;
    state.sceneDrafts = clone(record.sceneDrafts ?? {});
    state.structureDrafts = clone(record.structureDrafts ?? createStructureDrafts());
    state.templateDrafts = clone(record.templateDrafts ?? createTemplateDrafts());
    state.manuscriptTasks = normalizeManuscriptTasks(record.manuscriptTasks);
    state.passageNotes = normalizePassageNotes(record.passageNotes);
    state.customMetadataDefinitions = clone(record.projectSettings?.customMetadataDefinitions ?? []);
    state.metadataSubgroups = normalizeMetadataSubgroups(record.metadataSubgroups, getMetadataSubgroupGroupIds(record.projectSettings));
    state.draftProofing = normalizeDraftProofingState(record.draftProofing);
    state.draftProofMarksVisible = shouldRestoreDraftProofMarksVisible(state.draftProofing);
    state.revisionState = readRevisionState(record);
    state.revisionPanelState = createRevisionPanelStateForProject(state.revisionState);
    state.binderSceneMoveHistory = {
      undoStack: [],
      redoStack: [],
    };
    state.manuscriptMarkHistory = {
      undoStack: [],
      redoStack: [],
    };
    state.worldSpineHistory = {
      undoStack: [],
      redoStack: [],
    };
    state.sceneEditorSelectionSnapshot = null;
    state.activeEditorSceneId = null;
    state.selectedTaskId = null;
    state.selectedPassageNoteId = null;
    state.selectedMetadataSubgroupNoteId = null;
    state.editingChapterTitleId = null;
    state.editingSceneTitleId = null;
    state.inlinePassageDraft = null;
    state.taskContextMenu = null;
    state.binderContextMenu = null;
    state.spellcheckContextMenu = null;
    state.dictionaryLookup = null;
    state.dictionaryLookupRequestId = Number(state.dictionaryLookupRequestId ?? 0) + 1;
    state.sidePanelCustomizationOpen = false;
    state.sidePanelCustomizationPosition = null;
    state.topPanelCustomizationOpen = false;
    state.topPanelCustomizationPosition = null;
    state.topPanelCustomizationGroupId = "";
    state.keyboardShortcutSettingsWindowOpen = false;
    state.keyboardShortcutCaptureBehaviorId = "";
    state.keyboardShortcutSettingsStatus = "";
    state.customMetadataFormOpen = false;
    state.customMetadataFormError = "";
    state.deleteConfirmationDialog = null;
    state.taskComposer = null;
    state.taskPreview = null;
    state.grammarCheckPanel = {
      ...(state.grammarCheckPanel && typeof state.grammarCheckPanel === "object" ? state.grammarCheckPanel : {}),
      open: false,
      position: null,
      bounds: null,
      selectedWords: [],
      selectionAnchorIndex: null,
    };
    state.localAiTitleStatus = {};

    const projectSettings = normalizeProjectSettingsSnapshot(
      buildProjectSettingsCandidate(record),
      record.id,
      getProjectRecordWordCountForSettings(record),
      new Date(),
    );
    state.activePane = normalizeWorkspacePaneId(projectSettings.activePane);
    state.editorPrefs = clone(projectSettings.editorPrefs);
    state.localAiPrefs = clone(projectSettings.localAiPrefs);
    state.binderPanelWidth = projectSettings.binderPanelWidth;
    state.consoleDockWidth = projectSettings.consoleDockWidth;
    state.userSettingPanelResizerLeftPercent = projectSettings.userSettingPanelResizerLeftPercent;
    state.userSettingPanelResizerRightPercent = projectSettings.userSettingPanelResizerRightPercent;
    state.panelResizerLayoutProfiles = clone(projectSettings.panelResizerLayoutProfiles ?? {});
    state.worldSpineEventRailWidth = projectSettings.worldSpineEventRailWidth;
    state.worldSpineManuscriptPaneWidth = projectSettings.worldSpineManuscriptPaneWidth;
    state.worldSpinePanelLayoutProfiles = clone(projectSettings.worldSpinePanelLayoutProfiles ?? {});
    if (typeof projectSettings.worldSpineRightPaneMode === "string") {
      state.worldSpineRightPaneMode = projectSettings.worldSpineRightPaneMode;
    }
    state.worldSpineUnplacedDockCollapsed = projectSettings.worldSpineUnplacedDockCollapsed === true;
    state.worldSpineLocationFilter = clone(projectSettings.worldSpineLocationFilter ?? {});
    state.consoleDockCollapsed = projectSettings.consoleDockCollapsed;
    state.sidePanelsHidden = projectSettings.sidePanelsHidden === true;
    state.customMetadataDefinitions = clone(projectSettings.customMetadataDefinitions ?? []);
    state.metadataSubgroups = normalizeMetadataSubgroups(record.metadataSubgroups, getMetadataSubgroupGroupIds(projectSettings));
    state.sidePanelVisibility = clone(projectSettings.sidePanelVisibility ?? {});
    state.topPanelVisibility = clone(projectSettings.topPanelVisibility ?? {});
    state.collapsedChapterIds = projectSettings.collapsedChapterIds;
    state.collapsedConsoleChapterIds = projectSettings.collapsedConsoleChapterIds;
    state.projectSourcePath = projectSettings.projectSourcePath;
    state.spellcheckProjectSettings = normalizeSpellcheckProjectSettings(projectSettings.spellcheck);
    state.writingTargetViewMode = projectSettings.writingTargetViewMode;
    state.writingTargetSelectedDateKey = projectSettings.writingTargetSelectedDateKey;
    state.writingTargetCalendarMonthKey = projectSettings.writingTargetCalendarMonthKey;
    state.writingTargetProjectId = record.id;
    state.writingTargetState = clone(projectSettings.writingTargetState);

    return projectSettings;
  }

  return {
    applyProjectRecordToState,
  };
}

// Intent: active proof-read sessions should reopen with their saved coverage visible after refresh.
function shouldRestoreDraftProofMarksVisible(draftProofing = {}) {
  const activeRunId = typeof draftProofing?.activeRunId === "string" ? draftProofing.activeRunId.trim() : "";
  if (!activeRunId || !Array.isArray(draftProofing?.runs)) {
    return false;
  }

  return draftProofing.runs.some((run) =>
    run?.id === activeRunId &&
    run?.status === "active"
  );
}

function getMetadataSubgroupGroupIds(projectSettings = {}) {
  const customDefinitions = Array.isArray(projectSettings?.customMetadataDefinitions)
    ? projectSettings.customMetadataDefinitions
    : [];
  return [
    "inspiration",
    "research",
    ...customDefinitions
      .map((definition) => (typeof definition?.id === "string" ? definition.id.trim() : ""))
      .filter(Boolean),
  ];
}
