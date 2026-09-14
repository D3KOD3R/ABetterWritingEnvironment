// Intent: hydrate live editor state from an activated project record without owning shell effects.

import { normalizeWorkspacePaneId } from "./editor-ui-state.js";
import { normalizeProjectFilePath } from "../shared/project-file-path.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function createDefaultAnalysisWorkspace() {
  return {
    provider: {
      id: "local-rule-analysis",
      label: "Local Rule Analysis",
      availability: "ready",
      executionMode: "local-only",
    },
    lastJob: null,
    suggestionQueue: [],
    dreamScaping: null,
  };
}

export function createDefaultNarrationWorkspace() {
  return {
    provider: {
      id: "local-audio-service",
      label: "Local Audio",
      availability: "ready",
      alignmentStrategy: "line-based",
    },
    session: null,
    alignmentJobs: [],
  };
}

export function createDefaultVoiceWorkspace() {
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

function hydrateRuntimeServiceRoot(value, defaults, arrayKeys) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const hydrated = {
    ...defaults,
    ...source,
    provider: source.provider && typeof source.provider === "object" && !Array.isArray(source.provider)
      ? { ...defaults.provider, ...source.provider }
      : defaults.provider,
  };
  for (const key of arrayKeys) {
    if (!Array.isArray(hydrated[key])) hydrated[key] = [];
  }
  return hydrated;
}

// Intent: portable packages omit live service execution state, so activation owns rebuilding the safe runtime shape.
export function hydrateRuntimeWorkspace(workspace, { clone = cloneValue } = {}) {
  const hydrated = clone(workspace && typeof workspace === "object" && !Array.isArray(workspace) ? workspace : {});
  hydrated.analysis = hydrateRuntimeServiceRoot(
    hydrated.analysis,
    createDefaultAnalysisWorkspace(),
    ["suggestionQueue"],
  );
  hydrated.narration = hydrateRuntimeServiceRoot(
    hydrated.narration,
    createDefaultNarrationWorkspace(),
    ["alignmentJobs"],
  );
  hydrated.voice = hydrateRuntimeServiceRoot(
    hydrated.voice,
    createDefaultVoiceWorkspace(),
    ["profiles", "bindings", "renderJobs", "recordings"],
  );
  return hydrated;
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

  // Prepare the target before changing runtime authority. No persistence callback may observe
  // the incoming identity/content paired with the outgoing package path or browser handle.
  function applyProjectRecordToState(record, { projectFileDestination = null } = {}) {
    if (!record?.workspace?.project) {
      throw new Error("Unable to load a saved project.");
    }

    const workspace = hydrateRuntimeWorkspace(record.workspace, { clone });
    const projectSettings = normalizeProjectSettingsSnapshot(
      buildProjectSettingsCandidate(record),
      record.id,
      getProjectRecordWordCountForSettings(record),
      new Date(),
    );
    const projectFilePath = normalizeProjectFilePath(projectFileDestination
      ? projectFileDestination.filePath
      : projectSettings.projectFilePath ?? record.projectSettings?.projectFilePath ?? record.projectFilePath);
    const retainCurrentHandle = !projectFileDestination && state.activeProjectId === record.id
      && normalizeProjectFilePath(state.projectFilePath) === projectFilePath;
    const projectFileHandle = projectFileDestination
      ? projectFileDestination.fileHandle ?? null
      : retainCurrentHandle ? state.projectFileHandle ?? null : null;
    const handlePermission = projectFileHandle
      ? projectFileDestination?.handlePermission ?? (retainCurrentHandle ? state.projectFileHandlePermission : "prompt")
      : "";

    // This synchronous assignment block is the activation boundary; effects run only after it.
    state.projectFilePath = projectFilePath;
    state.projectFileHandle = projectFileHandle;
    state.projectFileHandlePermission = handlePermission;
    if (projectFileDestination) state.projectFileStorageMode = projectFileDestination.storageMode ?? "";
    else if (!projectFilePath && !projectFileHandle) state.projectFileStorageMode = "";
    state.activeProjectId = record.id;
    state.projectLibrarySelectionId = record.id;
    state.workspace = workspace;
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
