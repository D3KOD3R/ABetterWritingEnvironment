// Intent: hydrate live editor state from an activated project record without owning shell effects.

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
    state.revisionState = readRevisionState(record);
    state.revisionPanelState = createRevisionPanelStateForProject(state.revisionState);
    state.binderSceneMoveHistory = {
      undoStack: [],
      redoStack: [],
    };
    state.sceneEditorSelectionSnapshot = null;
    state.activeEditorSceneId = null;
    state.selectedTaskId = null;
    state.selectedPassageNoteId = null;
    state.editingChapterTitleId = null;
    state.editingSceneTitleId = null;
    state.inlinePassageDraft = null;
    state.taskContextMenu = null;
    state.binderContextMenu = null;
    state.spellcheckContextMenu = null;
    state.deleteConfirmationDialog = null;
    state.taskComposer = null;
    state.taskPreview = null;
    state.localAiTitleStatus = {};

    const projectSettings = normalizeProjectSettingsSnapshot(
      buildProjectSettingsCandidate(record),
      record.id,
      getProjectRecordWordCountForSettings(record),
      new Date(),
    );
    state.editorPrefs = clone(projectSettings.editorPrefs);
    state.localAiPrefs = clone(projectSettings.localAiPrefs);
    state.binderPanelWidth = projectSettings.binderPanelWidth;
    state.consoleDockWidth = projectSettings.consoleDockWidth;
    state.userSettingPanelResizerLeftPercent = projectSettings.userSettingPanelResizerLeftPercent;
    state.userSettingPanelResizerRightPercent = projectSettings.userSettingPanelResizerRightPercent;
    state.consoleDockCollapsed = projectSettings.consoleDockCollapsed;
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
