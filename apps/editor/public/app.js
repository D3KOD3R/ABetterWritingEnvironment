// Intent: bootstrap and orchestrate the browser editor while refactor slices move feature logic outward.
import {
  EDITOR_DRAFTS_KEY,
  EDITOR_ACTIVE_PROJECT_ID_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_PROJECT_LIBRARY_KEY,
  EDITOR_PROJECT_SOURCE_PATH_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  FONT_OPTIONS,
  buildSceneRecords,
  buildSceneLineMetrics,
  completeManuscriptTask,
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createDefaultSpellcheckProjectSettings,
  createManuscriptTask,
  createPassageNote,
  createSceneDraft,
  createStructureDrafts,
  createTemplateDrafts,
  findSceneByBlockId,
  groupScenesByChapter,
  normalizeManuscriptTasks,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizePassageNotes,
  normalizeSpellcheckProjectSettings,
  resolveManuscriptTaskRange,
  updateManuscriptTaskTitle,
  updatePassageNoteBody,
  updatePassageNoteTitle,
} from "./editor-model.js";
import {
  formatSceneEditorSelectionWordCount,
  formatSceneEditorWordCount,
  getPassageNotePlaceholder,
  renderManuscriptPanelHTML,
} from "./features/scene-editor.js";
import { escapeHtml, formatDisplayNumber } from "./shared/ui-utils.js";
import { createDeveloperLogger } from "./shared/developer-logger.js";
import {
  getProjectRecordFilePath,
  getSuggestedProjectFileName as getSuggestedProjectFileNameFromTitle,
  getSuggestedProjectFilePath as getSuggestedProjectFilePathFromProject,
  hasProjectFilePath,
  normalizeProjectFilePath,
  promptForProjectTitle,
  resolveProjectFilePath,
} from "./adapters/storage/project-file.js";
import {
  buildSpellcheckProjectLexicon,
  collectSpellcheckMisspellings,
  countSpellcheckMisspellings,
  ensureSpellcheckBaseLexicon,
  ensureSpellcheckReferenceLexicon,
  groupSpellcheckMisspellings,
  getSpellcheckWordRange,
  isSpellcheckMisspelledWord,
  normalizeSpellcheckWord,
  suggestSpellcheckAlternatives,
} from "./spellcheck.js";
import { renderEditorChrome } from "./shell/editor-chrome.js";
import { createWritingGoalsService } from "./features/writing-targets/writing-goals-service.js";
import { createWritingGoalsStateService } from "./features/writing-targets/writing-goals-state-service.js";
import {
  PROJECT_STATE_STORAGE_KEYS,
  createEditorStorage,
} from "./adapters/storage/editor-storage.js";
import { createBrowserStorageAdapter } from "./adapters/storage/browser-storage-adapter.js";
import { createProjectRepository } from "./adapters/storage/project-repository.js";
import { createPreferencesRepository } from "./adapters/storage/preferences-repository.js";
import { createProjectService } from "./adapters/storage/project-service.js";
import { PROJECT_SCHEMA_VERSION } from "./adapters/storage/project-migrations.js";
import { createProjectPersistenceService } from "./adapters/storage/project-persistence-service.js";

// Intent: keep shell-wide constants and state visible until each concern moves into its roadmap owner.
const appRoot = document.querySelector("#app");
const EDITOR_RIGHT_DOCK_COLLAPSED_KEY = "abe-right-dock-collapsed-v1";
const EDITOR_BINDER_WIDTH_KEY = "abe-binder-width-v1";
const EDITOR_CONSOLE_WIDTH_KEY = "abe-console-width-v1";
const EDITOR_WRITING_TARGETS_KEY = "abe-writing-targets-v1";
const EDITOR_PROJECT_FILE_PATH_KEY = "abe-project-file-path-v1";
const VOICE_NARRATION_STORAGE_KEY = "abe-voice-narration-v1";
const NARRATION_RECORDING_DEFAULT_MIME_TYPE = "audio/webm";
const DEFAULT_BINDER_PANEL_WIDTH = 320;
const DEFAULT_CONSOLE_PANEL_WIDTH = 320;
const DEFAULT_WRITING_TARGET_WORDS = 150000;
const DEFAULT_SESSION_TARGET_WORDS = 5000;
const DEFAULT_WRITING_TARGET_LOOKBACK_DAYS = 7;
const DEFAULT_SESSION_TARGETS_PER_DAY = 5;
const DEFAULT_SESSION_TIMEOUT_MINUTES = 20;
const PROJECT_FILE_AUTOSAVE_DELAY_MS = 5000;
// The tracker uses one idle grace period, then a longer close window, then a new-session window.
const WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES = 10;
const WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES = 25;
const WRITING_TARGET_MAX_HISTORY_DAYS = 180;
const WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY = 12;
const WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES = 5;
const WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES = 240;
const WRITING_TARGET_MAX_SESSION_SAMPLES = 20;
const WRITING_TARGET_SESSION_HISTORY_MAX = 24;
const WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES = 5;
const WRITING_TARGET_SESSION_PACE_STALE_MINUTES = 0.5;
const WRITING_TARGET_DEBUG_TYPING_LOG_MIN_INTERVAL_MS = 1000;
const WRITING_TARGET_GOAL_SYNC_SOURCES = ["releaseDate", "sessionTargetWords"];
const EDITOR_DELETE_CONFIRMATIONS_KEY = "abe-delete-confirmations-v1";
const DESKTOP_PROJECT_LIBRARY_BOOT_TIMEOUT_MS = 50;
const DEVELOPER_LOG_WINDOW_PATH = "/developer-logs.html";
const DEVELOPER_LOG_RUNTIME_BRIDGE_KEY = "__ABE_DEVELOPER_LOG_RUNTIME__";
const DESKTOP_LOG_BRIDGE_WARNING_THROTTLE_MS = 30000;
const REVISION_DRAFTING_UI_ENABLED = false;
const MIN_BINDER_PANEL_WIDTH = 220;
const MIN_CONSOLE_PANEL_WIDTH = 260;
const MIN_MANUSCRIPT_PANEL_WIDTH = 560;
const PANEL_RESIZER_WIDTH = 8;

const {
  loadCollapsedChapterIds,
  loadCollapsedConsoleChapterIds,
  loadEditorPrefs,
  loadLocalAiPrefs,
  loadManuscriptTasks,
  loadPassageNotes,
  loadProjectTitle,
  loadSceneDrafts,
  loadStoredNumber,
  loadStoredString,
  loadStructureDrafts,
  loadTemplateDrafts,
  normalizeChapterIdList,
  persistCollapsedChapterState,
  persistCollapsedConsoleChapterState,
  persistConsoleDockCollapsedState,
  readStoredJson,
  writeStoredJsonRaw,
} = createEditorStorage({
  reportBrowserLog,
  windowRef: window,
});
const browserStorageAdapter = createBrowserStorageAdapter({
  reportBrowserLog,
  windowRef: window,
});
const projectRepository = createProjectRepository({
  storageAdapter: browserStorageAdapter,
  libraryStorageKey: EDITOR_PROJECT_LIBRARY_KEY,
  activeProjectIdStorageKey: EDITOR_ACTIVE_PROJECT_ID_KEY,
});
const preferencesRepository = createPreferencesRepository({
  storageAdapter: browserStorageAdapter,
});
const projectService = createProjectService({
  projectRepository,
  preferencesRepository,
});
const CONSOLE_DOCK_COLLAPSED_WIDTH = 52;
const BINDER_PANEL_COMPACT_THRESHOLD = 280;
const WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION = 2;
const WRITING_TARGET_METRIC_KEYS = ["wordTarget", "sessionTarget", "forecast", "sessionTracker"];
const WRITING_TARGET_CADENCE_OPTIONS = [
  { value: "daily", label: "Daily target", unitLabel: "day", periodsPerWeek: 7 },
  { value: "weekly", label: "Weekly target", unitLabel: "week", periodsPerWeek: 1 },
];
const BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS = 350;

const state = {
  shellReady: false,
  workspace: null,
  activeProjectId: null,
  projectLibrary: [],
  projectLibrarySelectionId: null,
  projectTitle: "",
  projectFileHandle: null,
  projectFileHandlePermission: "",
  projectFilePath: "",
  projectFileStatus: "",
  projectFileBusy: false,
  projectFileAutosaveDirty: false,
  projectFileAutosaveTarget: null,
  projectFileAutosaveTimer: null,
  projectFileAutosaveRevision: 0,
  projectPersistenceDirtyDomains: {},
  projectEditorWorkingDirtyState: {
    dirty: false,
    lastMutationAt: "",
    domains: {},
  },
  projectFileAutosaveSuppressionDepth: 0,
  projectCacheSuppressionDepth: 0,
  projectSourcePath: "",
  projectSourceStatus: "",
  projectSourceBusy: false,
  fileMenuOpen: false,
  consoleDockCollapsed: false,
  binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
  consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
  userSettingPanelResizerLeftPercent: null,
  userSettingPanelResizerRightPercent: null,
  writingTargetWindowOpen: false,
  writingTargetProjectId: null,
  writingTargetState: null,
  writingTargetDraft: null,
  writingTargetDraftProjectId: null,
  writingTargetDraftBaseline: null,
  writingTargetViewMode: "month",
  writingTargetSelectedDateKey: "",
  writingTargetCalendarMonthKey: "",
  activePane: "manuscript",
  sceneDrafts: {},
  structureDrafts: createStructureDrafts(),
  templateDrafts: createTemplateDrafts(),
  manuscriptTasks: [],
  passageNotes: [],
  spellcheckProjectSettings: createDefaultSpellcheckProjectSettings(),
  sidePanelMode: "issues",
  selectedTaskId: null,
  selectedPassageNoteId: null,
  inlinePassageDraft: null,
  taskContextMenu: null,
  binderContextMenu: null,
  spellcheckContextMenu: null,
  grammarCheckPanel: {
    open: false,
    position: null,
    selectedWords: [],
    selectionAnchorIndex: null,
  },
  taskComposer: null,
  taskPreview: null,
  manuscriptFind: {
    open: false,
    query: "",
    replaceText: "",
    activeIndex: 0,
    position: null,
  },
  narrationTakeSelection: null,
  narrationTakeSession: null,
  editorPrefs: createDefaultEditorPrefs(),
  localAiPrefs: createDefaultLocalAiPrefs(),
  localAiTitleStatus: {},
  sceneEditorSelectionSnapshot: null,
  deleteConfirmationPreferences: loadDeleteConfirmationPreferences(),
  deleteConfirmationDialog: null,
  binderSceneMoveHistory: {
    undoStack: [],
    redoStack: [],
  },
  developerLogsWindowOpen: false,
  voiceNarration: loadVoiceNarrationState(),
  scenes: [],
  selectedSceneId: null,
  selectedBlockId: null,
  selectedIssueId: null,
  selectedNodeId: null,
  selectedEntityId: null,
  editingChapterTitleId: null,
  editingSceneTitleId: null,
  collapsedChapterIds: [],
  collapsedConsoleChapterIds: {
    issueTasks: [],
    issues: [],
    inspiration: [],
    research: [],
  },
};

let eventsWired = false;
let layoutResizeSession = null;
let writingTargetPointerDownStartedInsideWindow = false;
let writingTargetDebugLastTypingLogAt = 0;
let writingTargetDebugLastSceneTypingWordCount = null;
let binderTitleClickState = null;
let binderSceneDragState = null;
let manuscriptFindDragState = null;
let manuscriptGrammarDragState = null;
let spellcheckBaseLexicon = null;
let spellcheckReferenceLexicon = null;
let narrationRecordingRuntime = null;
let voiceRecordingPreviewAudio = null;
let voiceRecordingPreviewUrl = null;
let lastDesktopLogBridgeWarningAt = 0;

// Intent: central developer observability service for cross-module diagnostics and separate log-window streaming.
const developerLogger = createDeveloperLogger({
  windowRef: window,
  storageAdapter: browserStorageAdapter,
  mirrorConsole: false,
  persistEntriesToStorage: false,
  onEntry: (entry) => {
    void postDeveloperLogEntryToDesktopHost(entry);
  },
});
const autosaveCoordinatorLog = developerLogger.createSource("AutosaveCoordinator");
const projectPersistenceLog = developerLogger.createSource("ProjectPersistenceService");
const sceneStorageLog = developerLogger.createSource("SceneStorageService");
const manuscriptStateLog = developerLogger.createSource("ManuscriptStateManager");
const editorInteractionLog = developerLogger.createSource("EditorInteractionGate");
const fileAccessBridgeLog = developerLogger.createSource("FileAccessBridge");
const projectLoadGateLog = developerLogger.createSource("ProjectLoadGate");
const projectSaveGateLog = developerLogger.createSource("ProjectSaveGate");
const localStorageAdapterLog = developerLogger.createSource("LocalStorageAdapter");
const desktopFileSystemLog = developerLogger.createSource("DesktopFileSystemAdapter");
const uiEventDispatcherLog = developerLogger.createSource("UIEventDispatcher");
const writingGoalsServiceLog = developerLogger.createSource("WritingGoalsService");
registerDeveloperLogRuntimeBridge();

const writingGoalsStateLogHooks = {
  logWritingTargetDebugEvent: () => {},
  logWritingTargetMetricCheckpoint: () => {},
  buildWritingTargetDebugTerminalSummary: () => ({
    open: false,
    entryCount: 0,
    recentErrorCount: 0,
    lastEventLabel: "",
  }),
};

const writingGoalsStateService = createWritingGoalsStateService({
  state,
  readStoredJson,
  writeStoredJsonRaw,
  getProjectRecordById,
  getActiveProjectRecord,
  getSelectedScene,
  countRemainingTasksByChapter,
  cloneValue,
  persistCurrentProjectRecord,
  logWritingTargetDebugEvent: (...args) => writingGoalsStateLogHooks.logWritingTargetDebugEvent(...args),
  logWritingTargetMetricCheckpoint: (...args) => writingGoalsStateLogHooks.logWritingTargetMetricCheckpoint(...args),
  buildWritingTargetDebugTerminalSummary: (...args) => writingGoalsStateLogHooks.buildWritingTargetDebugTerminalSummary(...args),
  EDITOR_WRITING_TARGETS_KEY,
  DEFAULT_WRITING_TARGET_WORDS,
  DEFAULT_SESSION_TARGET_WORDS,
  DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
  DEFAULT_SESSION_TARGETS_PER_DAY,
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES,
  WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES,
  WRITING_TARGET_MAX_HISTORY_DAYS,
  WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_SAMPLES,
  WRITING_TARGET_SESSION_HISTORY_MAX,
  WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES,
  WRITING_TARGET_SESSION_PACE_STALE_MINUTES,
  WRITING_TARGET_GOAL_SYNC_SOURCES,
  WRITING_TARGET_CADENCE_OPTIONS,
  WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
  WRITING_TARGET_METRIC_KEYS,
});

const {
  syncWritingTargetState,
  syncWritingTargetPersistedState,
  getWritingTargetWorkingRecord,
  beginWritingTargetDraft,
  clearWritingTargetDraft,
  commitWritingTargetDraft,
  loadWritingTargetState,
  persistWritingTargetState,
  syncWritingTargetCanonicalState,
  buildWritingTargetSummary,
  buildWritingTargetSummaryForRecord,
  buildWritingTargetMetric,
  buildWritingTargetArchiveEntries,
  renderWritingTargetArchiveEntry,
  buildWritingTargetStreakSummary,
  getWritingTargetHistoryEntries,
  getWritingTargetHistoryEntryMap,
  getWritingTargetMonthKey,
  parseWritingTargetMonthKey,
  isWritingTargetDateKey,
  getWritingTargetStartOfWeek,
  getWritingTargetSelectedDateKey,
  primeWritingTargetDashboardSelection,
  buildWritingTargetDashboardModel,
  buildLiveWritingTargetHistoryEntry,
  getWritingTargetDayStatus,
  buildWritingTargetDashboardCards,
  getWritingTargetSelectedEntryModel,
  getCurrentManuscriptWordCount,
  resolveSceneDraftEditorText,
  countWords,
  compactWordCount,
  formatDayCount,
  formatMinuteCount,
  formatClockTimeLabel,
  formatSessionElapsedLabel,
  createPassageExcerpt,
  buildSessionPaceColor,
  mixRgbColor,
  formatRgbColor,
  formatDurationMinutes,
  formatDateLabel,
  formatGoalDateLabel,
  parseLocalDateKey,
  normalizeWritingTargetCadence,
  normalizeWritingTargetGoalSyncSource,
  normalizeWritingTargetVisibleMetrics,
  getWritingTargetCadenceMeta,
  getWritingTargetCadenceDays,
  getWritingTargetGoalSyncSource,
  getWritingTargetDaysUntilDate,
  startOfLocalDay,
  formatSessionAge,
  syncWritingTargetGoalFields,
  seedWritingTargetTestData,
  generateBelievableWritingTargetHistory,
  seededOffset,
  addHours,
  getLocalDateKey,
  normalizeDateInput,
  parseFlexibleDateInput,
  createValidatedDate,
  addDays,
  estimateWritingPace,
  trimWritingTargetHistory,
  normalizeWritingTargetRecord,
  getWritingTargetSnapshotContext,
  createWritingTargetHistoryEntry,
  createWritingTargetSessionSample,
  normalizeWritingTargetSessionSamples,
  normalizeWritingTargetSessionActivityReason,
  normalizeWritingTargetSessionHistory,
  addMinutes,
  getWritingTargetSessionThresholds,
  getWritingTargetSessionPhase,
  getWritingTargetSessionPhaseLabel,
  buildWritingTargetSessionLifecycleSummaryText,
  getWritingTargetSessionLifecycle,
  createWritingTargetSessionHistoryEntry,
  resumeWritingSession,
  touchWritingTargetSessionActivity,
  concludeWritingSession,
  refreshWritingTargetSessionLifecycle,
  estimateRecentSessionWordsPerMinute,
  getWritingTargetDailyBaselineWordCount,
  getWritingTargetTodayHistoryEntry,
  resolveWritingTargetDailyBaselineWordCount,
  getWritingTargetPreviousHistoryEntry,
  clampWritingTargetDailyBaselineWordCount,
  createDefaultWritingTargetRecord,
  readWritingTargetStore,
  clampPositiveNumber,
} = writingGoalsStateService;

const projectPersistenceService = createProjectPersistenceService({
  state,
  windowRef: window,
  projectService,
  projectRepository,
  fetchJsonFromDesktopApi,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  autosaveDelayMs: PROJECT_FILE_AUTOSAVE_DELAY_MS,
  shouldPersistProjectCache: () => shouldPersistProjectCache(),
  writeProjectFilePathCache: (filePath) => {
    writeStoredJsonRaw(EDITOR_PROJECT_FILE_PATH_KEY, filePath);
  },
  createProjectRecordFromRuntimeState: () => createProjectLibraryRecordFromState(),
  getActiveProjectRecord: () => getActiveProjectRecord(),
  normalizeProjectLibrarySnapshot,
  normalizeProjectRecord,
  resolveActiveProjectId,
  activateLoadedProjectRecord: ({
    projectRecord,
    reason,
  }) => {
    applyProjectRecord(projectRecord);
    refreshScenes();
    restoreSelectionFromWorkspaceDefaults();
    syncWritingTargetState({ forceReload: true });
    logWritingTargetLoadCheckpoint(reason ?? "load-project-file");
    render();
    recordWritingTargetSnapshot({ immediate: true, reason: reason ?? "load-project-file", skipProjectFileAutosave: true });
  },
  prepareProjectSnapshotForSave: ({ reason }) => {
    logWritingTargetDebugEvent("info", "project.save", "Saving current project snapshot.", {
      reason: reason ?? "save-project",
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      hasFileHandle: Boolean(state.projectFileHandle),
      hasFilePath: hasProjectFilePath(state.projectFilePath),
    });
    commitWritingTargetDraft();
    recordWritingTargetSnapshot({ immediate: true, reason: reason ?? "save-project", skipProjectFileAutosave: true });
  },
  reportBrowserLog,
  renderHeader,
  resolveSuggestedProjectFileName: () => getSuggestedProjectFileName(),
  onProjectRecordPersisted: ({ projectRecord, persistCache, options }) => {
    const activeLibraryRecord = state.projectLibrary.find((project) => project.id === state.activeProjectId) ?? null;
    const indexedScenes = Array.isArray(activeLibraryRecord?.projectIndex?.scenes)
      ? activeLibraryRecord.projectIndex.scenes
      : [];
    const indexedWordTotal = indexedScenes.reduce((total, scene) => {
      const wordCount = Number(scene?.wordCount);
      return total + (Number.isFinite(wordCount) && wordCount >= 0 ? Math.max(0, Math.round(wordCount)) : 0);
    }, 0);
    logWritingTargetDebugEvent("info", "persist.project-record", "Persisted active project record.", {
      projectId: projectRecord.id,
      persistCache,
      changedSceneIds: Array.isArray(options.changedSceneIds) ? options.changedSceneIds : [],
      skipProjectFileAutosave: options.skipProjectFileAutosave === true,
      libraryProjectCount: state.projectLibrary.length,
      indexedSceneCount: indexedScenes.length,
      indexedWordTotal,
      writingTargetHistoryEntries: Array.isArray(state.writingTargetState?.history) ? state.writingTargetState.history.length : 0,
    }, {
      skipUpload: Array.isArray(options.changedSceneIds) && options.changedSceneIds.length > 0,
    });
  },
  loggerSources: {
    autosaveCoordinator: autosaveCoordinatorLog,
    projectPersistence: projectPersistenceLog,
    projectLoadGate: projectLoadGateLog,
    projectSaveGate: projectSaveGateLog,
    desktopFileSystem: desktopFileSystemLog,
  },
});

const writingGoalsService = createWritingGoalsService({
  state,
  windowRef: window,
  documentRef: document,
  serializeBrowserLogContext,
  postJsonToDesktopHost,
  buildWritingTargetSummary,
  buildWritingTargetDashboardModel,
  getWritingTargetSelectedEntryModel,
  buildWritingTargetDashboardCards,
  renderWritingTargetArchiveEntry,
  refreshWritingTargetSessionLifecycle,
  beginWritingTargetDraft,
  syncWritingTargetCanonicalState,
  normalizeWritingTargetCadence,
  isWritingTargetDateKey,
  getWritingTargetWorkingRecord,
  cloneValue,
  getCurrentManuscriptWordCount,
  createWritingTargetSessionSample,
  persistWritingTargetState,
  clearWritingTargetDraft,
  persistCurrentProjectRecord,
  getWritingTargetSnapshotContext,
  createWritingTargetHistoryEntry,
  trimWritingTargetHistory,
  resolveWritingTargetDailyBaselineWordCount,
  normalizeWritingTargetSessionSamples,
  resumeWritingSession,
  normalizeWritingTargetSessionActivityReason,
  buildWritingTargetSummaryForRecord,
  primeWritingTargetDashboardSelection,
  commitWritingTargetDraft,
  createDefaultWritingTargetRecord,
  getWritingTargetMonthKey,
  parseWritingTargetMonthKey,
  parseLocalDateKey,
  getLocalDateKey,
  beginProjectFileAutosaveSuppression,
  endProjectFileAutosaveSuppression,
  hasProjectFileDestination,
  saveCurrentProject,
  renderHeader,
  writingGoalsLogger: writingGoalsServiceLog,
  writingGoalsLogSourceName: "WritingGoalsService",
  getDeveloperLogEntries: () => developerLogger.getEntries(),
  WRITING_TARGET_CADENCE_OPTIONS,
  WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
  WRITING_TARGET_METRIC_KEYS,
  WRITING_TARGET_MAX_SESSION_SAMPLES,
});

const {
  renderWritingTargetWindow,
  buildWritingTargetDebugTerminalSummary,
  normalizeLogLevel,
  logWritingTargetMetricCheckpoint,
  buildWritingTargetMetricCheckpointSignature,
  logWritingTargetDebugEvent,
  syncWritingTargetWindowLiveState,
  syncSessionTrackerLiveState,
  syncHeaderLiveState,
  patchSessionTrackerPanel,
  startWritingTargetWindowRefreshTimer,
  stopWritingTargetWindowRefreshTimer,
  startSessionTrackerRefreshTimer,
  stopSessionTrackerRefreshTimer,
  updateWritingTargetField,
  syncWritingTargetFieldControls,
  toggleWritingTargetMetric,
  toggleWritingTargetWindow,
  closeWritingTargetWindow,
  saveWritingTargetGoals,
  cancelWritingTargetGoals,
  resetWritingTargetGoals,
  setWritingTargetViewMode,
  selectWritingTargetDay,
  shiftWritingTargetCalendarMonth,
  jumpWritingTargetCalendarToToday,
  resetWritingSession,
  saveWritingTargetState,
  recordWritingTargetSnapshot,
  queueWritingTargetSnapshot,
  clearWritingTargetSnapshotTimer,
  logWritingTargetLoadCheckpoint,
} = writingGoalsService;

// Intent: keep writing-goals domain logs routed through the shared writing-goals logger once the UI service is initialized.
writingGoalsStateLogHooks.logWritingTargetDebugEvent = logWritingTargetDebugEvent;
writingGoalsStateLogHooks.logWritingTargetMetricCheckpoint = logWritingTargetMetricCheckpoint;
writingGoalsStateLogHooks.buildWritingTargetDebugTerminalSummary = buildWritingTargetDebugTerminalSummary;

registerRuntimeLogging();

boot().catch((error) => {
  reportBrowserLog("error", "boot", "Workspace boot failed.", { error });
  console.error(error);
  appRoot.innerHTML = `
    <div class="error-shell">
      <p class="loading-kicker">Desktop Host Failed</p>
      <h1>Unable to load the author workspace.</h1>
      <p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>
    </div>
  `;
});

// Intent: boot the editor from desktop APIs, bundled seed data, and local browser state in that priority order.
async function boot() {
  const [seedLibrary, desktopSettings] = await Promise.all([
    loadInitialProjectLibrary(),
    loadDesktopSettingsSnapshot(),
  ]);
  state.projectLibrary = seedLibrary.projects;
  state.activeProjectId = seedLibrary.activeProjectId ?? seedLibrary.projects[0]?.id ?? null;
  state.projectLibrarySelectionId = state.activeProjectId;
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  state.projectFilePath = desktopSettings.lastProjectFilePathExplicit
    ? normalizeProjectFilePath(desktopSettings.lastProjectFilePath)
    : "";
  state.projectFileStatus = "";
  state.projectFileBusy = false;
  state.projectFileAutosaveDirty = false;
  state.projectFileAutosaveTarget = null;
  state.projectFileAutosaveRevision = 0;
  state.projectPersistenceDirtyDomains = {};
  state.projectEditorWorkingDirtyState = {
    dirty: false,
    lastMutationAt: "",
    domains: {},
  };
  if (state.projectFileAutosaveTimer) {
    window.clearTimeout(state.projectFileAutosaveTimer);
    state.projectFileAutosaveTimer = null;
  }
  state.projectFileAutosaveSuppressionDepth = 0;
  state.projectSourcePath = loadStoredString(EDITOR_PROJECT_SOURCE_PATH_KEY) ?? "";
  state.projectSourceStatus = "";
  state.consoleDockCollapsed = readStoredJson(EDITOR_RIGHT_DOCK_COLLAPSED_KEY) === true;
  state.binderPanelWidth = loadStoredNumber(EDITOR_BINDER_WIDTH_KEY, DEFAULT_BINDER_PANEL_WIDTH);
  state.consoleDockWidth = loadStoredNumber(EDITOR_CONSOLE_WIDTH_KEY, DEFAULT_CONSOLE_PANEL_WIDTH);
  applyProjectRecord(getActiveProjectRecord() ?? state.projectLibrary[0]);
  refreshScenes();
  projectPersistenceService.syncActiveProjectFileDestinationFromRecord({
    persistDesktopProjectFilePath: true,
    source: "boot",
  });
  await reconnectProjectFileDestinationOnBoot(desktopSettings);
  spellcheckBaseLexicon = await ensureSpellcheckBaseLexicon();
  spellcheckReferenceLexicon = await ensureSpellcheckReferenceLexicon();

  restoreSelectionFromWorkspaceDefaults();
  syncWritingTargetState({ forceReload: true });
  refreshWritingTargetSessionLifecycle({ reason: "boot" });

  render();
  syncLayoutWidths();
  recordWritingTargetSnapshot({ immediate: true, reason: "boot", skipProjectFileAutosave: true });
  startSessionTrackerRefreshTimer();
  const bootedProject = getActiveProjectRecord();
  if (bootedProject?.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Booted saved project.", {
      projectId: bootedProject.id,
      title: bootedProject.title,
      chapters: bootedProject.workspace.project.stats.chapterCount,
      scenes: bootedProject.workspace.project.stats.sceneCount,
      templates: bootedProject.workspace.world?.stats?.templateCount ?? 0,
    });
  }
  wireEvents();
  syncSceneDocumentLayout();
}

// Intent: delegate browser events while the shell still coordinates feature slices during the refactor.
function wireEvents() {
  if (eventsWired) {
    return;
  }
  eventsWired = true;

  document.addEventListener("pointerdown", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    writingTargetPointerDownStartedInsideWindow = Boolean(clickTarget?.closest(".writing-target-window"));
    const resizeHandle = clickTarget?.closest("[data-resize-handle]");
    if (!(resizeHandle instanceof HTMLElement)) {
      return;
    }

    const handleId = resizeHandle.dataset.resizeHandle;
    if (handleId !== "binder" && handleId !== "console") {
      return;
    }

    if (handleId === "console" && state.consoleDockCollapsed) {
      return;
    }

    beginLayoutResize(handleId, event);
  });

  document.addEventListener("pointermove", handleLayoutResizePointerMove);
  document.addEventListener("pointerup", endLayoutResize);
  document.addEventListener("pointercancel", endLayoutResize);
  document.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      writingTargetPointerDownStartedInsideWindow = false;
    }, 0);
  });
  document.addEventListener("pointerdown", handleGrammarCheckPointerDown);
  document.addEventListener("pointermove", handleGrammarCheckPointerMove);
  document.addEventListener("pointerup", handleGrammarCheckPointerEnd);
  document.addEventListener("pointercancel", handleGrammarCheckPointerEnd);
  document.addEventListener("pointerdown", handleManuscriptFindPointerDown);
  document.addEventListener("pointermove", handleManuscriptFindPointerMove);
  document.addEventListener("pointerup", handleManuscriptFindPointerEnd);
  document.addEventListener("pointercancel", handleManuscriptFindPointerEnd);
  document.addEventListener("wheel", handleManuscriptFindWheel, { passive: false });
  document.addEventListener("selectionchange", () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")) {
      updateSceneEditorSelectionSnapshotFromTextarea(activeElement);
      syncSceneEditorWordCountReadouts(activeElement);
    }

    if (state.activePane !== "narration" || state.narrationTakeSession?.status === "recording") {
      return;
    }

    if (!(activeElement instanceof HTMLTextAreaElement) || !activeElement.classList.contains("editor-document-input")) {
      return;
    }

    updateNarrationTakeSelectionFromTextarea(activeElement);
  });
  document.addEventListener("dragstart", handleBinderSceneDragStart);
  document.addEventListener("dragover", handleBinderSceneDragOver);
  document.addEventListener("drop", handleBinderSceneDrop);
  document.addEventListener("dragend", handleBinderSceneDragEnd);
  window.addEventListener("resize", syncLayoutWidths);

  document.addEventListener("click", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (state.fileMenuOpen && !clickTarget?.closest("[data-file-menu]")) {
      hideFileMenu();
    }
    if (state.binderContextMenu && !clickTarget?.closest("[data-binder-menu]")) {
      hideBinderContextMenu();
    }
    if (
      state.writingTargetWindowOpen &&
      clickTarget &&
      !clickTarget.closest(".writing-target-window") &&
      !clickTarget.closest('[data-action="toggle-writing-target-window"]') &&
      !writingTargetPointerDownStartedInsideWindow
    ) {
      closeWritingTargetWindow();
    }
    if (clickTarget?.closest("[data-title-input], [data-passage-note-body-input]")) {
      hideTaskSurfaces();
      return;
    }

    const target = clickTarget?.closest("[data-action]");
    if (!target) {
      if (selectPassageNoteFromEditorClick(clickTarget)) {
        hideTaskContextMenu();
        return;
      }

      if (selectTaskFromEditorClick(clickTarget)) {
        hideTaskContextMenu();
        return;
      }

      if (focusEditorWhitespace(clickTarget, event)) {
        hideTaskSurfaces();
        return;
      }

      const taskTarget = clickTarget?.closest("[data-task-preview-id]");
      if (taskTarget) {
        navigateTaskAnchor(taskTarget.dataset.taskPreviewId);
        return;
      }

      hideTaskContextMenu();
      return;
    }

    const { action } = target.dataset;
    if (action) {
      const trackedUserActions = new Set([
        "load-project",
        "save-project",
        "save-project-file-as",
        "load-project-file",
        "create-project",
        "load-project-source",
        "open-developer-logs",
        "toggle-writing-target-window",
        "select-scene",
      ]);
      if (trackedUserActions.has(action)) {
        uiEventDispatcherLog.info("user-action", `ui.action.${action}`, "User triggered UI action.", {
          action,
          sceneId: target.dataset.sceneId ?? "",
          projectId: state.activeProjectId ?? "",
        });
      }
    }

    if (
      action !== "add-selection-task" &&
      action !== "add-passage-note" &&
      action !== "apply-spellcheck-suggestion" &&
      action !== "dismiss-spellcheck-menu"
    ) {
      hideTaskContextMenu();
    }

    if (action === "toggle-file-menu") {
      toggleFileMenu();
      return;
    }

    if (action === "load-project") {
      hideFileMenu();
      loadSelectedProject();
      return;
    }

    if (action === "save-project") {
      hideFileMenu();
      void saveCurrentProject();
      return;
    }

    if (action === "save-project-file-as") {
      hideFileMenu();
      void saveCurrentProjectFileAs();
      return;
    }

    if (action === "load-project-file") {
      hideFileMenu();
      void loadProjectLibraryFromFile();
      return;
    }

    if (action === "create-project") {
      hideFileMenu();
      createProject();
      return;
    }

    if (action === "open-developer-logs") {
      hideFileMenu();
      openDeveloperLogsWindow();
      return;
    }

    if (action === "load-project-source") {
      hideFileMenu();
      loadProjectSource();
      return;
    }

    if (action === "toggle-writing-target-window") {
      hideFileMenu();
      toggleWritingTargetWindow();
      return;
    }

    if (action === "toggle-revision-overlay") {
      toggleRevisionOverlay(target.dataset.sceneId);
      return;
    }

    if (action === "toggle-italic-text") {
      toggleItalicText();
      return;
    }

    if (action === "toggle-grammar-check-panel") {
      toggleGrammarCheckPanel();
      return;
    }

    if (action === "open-manuscript-find") {
      openManuscriptFind();
      return;
    }

    if (action === "close-manuscript-find") {
      closeManuscriptFind();
      return;
    }

    if (action === "find-prev") {
      moveManuscriptFindMatch(-1);
      return;
    }

    if (action === "find-next") {
      moveManuscriptFindMatch(1);
      return;
    }

    if (action === "replace-find-current") {
      replaceManuscriptFindCurrent();
      return;
    }

    if (action === "replace-find-all") {
      replaceManuscriptFindAll();
      return;
    }

    if (action === "find-match") {
      navigateManuscriptFindMatch(Number(target.dataset.findMatchIndex));
      return;
    }

    if (action === "save-writing-target-goals") {
      saveWritingTargetGoals();
      return;
    }

    if (action === "close-writing-target-window") {
      closeWritingTargetWindow();
      return;
    }

    if (action === "cancel-writing-target-goals") {
      cancelWritingTargetGoals();
      return;
    }

    if (action === "reset-writing-target-goals") {
      resetWritingTargetGoals();
      return;
    }

    if (action === "reset-writing-session") {
      resetWritingSession();
      return;
    }

    if (action === "writing-target-set-view-mode") {
      setWritingTargetViewMode(target.dataset.viewMode);
      return;
    }

    if (action === "writing-target-calendar-prev-month") {
      shiftWritingTargetCalendarMonth(-1);
      return;
    }

    if (action === "writing-target-calendar-next-month") {
      shiftWritingTargetCalendarMonth(1);
      return;
    }

    if (action === "writing-target-calendar-today") {
      jumpWritingTargetCalendarToToday();
      return;
    }

    if (action === "select-writing-target-day") {
      selectWritingTargetDay(target.dataset.dateKey);
      return;
    }

    if (action === "writing-target-daily-note") {
      return;
    }

    if (action === "toggle-console-collapse") {
      hideFileMenu();
      toggleConsoleCollapse();
      return;
    }

    if (action === "toggle-console-chapter-collapse") {
      hideFileMenu();
      toggleConsoleChapterCollapse(target.dataset.consolePanel, target.dataset.chapterKey);
      return;
    }

    if (action === "cancel-binder-context-menu") {
      hideBinderContextMenu();
      return;
    }

    if (action === "apply-spellcheck-suggestion") {
      applySpellcheckSuggestionFromMenu(target);
      return;
    }

    if (action === "add-grammar-check-dictionary") {
      addGrammarCheckWordsToProjectList("dictionaryWords");
      return;
    }

    if (action === "add-grammar-check-exceptions") {
      addGrammarCheckWordsToProjectList("exceptionWords");
      return;
    }

    if (action === "dismiss-spellcheck-menu") {
      hideSpellcheckContextMenu();
      return;
    }

    if (action === "toggle-grammar-check-word") {
      const grammarCheckTarget = target.closest("[data-grammar-check-word]");
      if (!(grammarCheckTarget instanceof HTMLElement)) {
        return;
      }

      toggleGrammarCheckPanelWordSelection(
        grammarCheckTarget.dataset.grammarCheckWord,
        Number(grammarCheckTarget.dataset.grammarCheckIndex),
        event.shiftKey === true,
      );
      return;
    }

    if (action === "focus-grammar-check-word") {
      const grammarCheckTarget = target.closest("[data-grammar-check-word]");
      if (!(grammarCheckTarget instanceof HTMLElement)) {
        return;
      }

      const firstIndex = Number(grammarCheckTarget.dataset.grammarCheckFirstIndex);
      const word = String(grammarCheckTarget.dataset.grammarCheckWord ?? "").trim();
      if (!word || !Number.isInteger(firstIndex)) {
        return;
      }

      focusGrammarCheckEntry({
        firstIndex,
        word,
      });
      return;
    }

    if (action === "grammar-check-select-all") {
      selectAllGrammarCheckPanelWords();
      return;
    }

    if (action === "grammar-check-clear-selection") {
      clearGrammarCheckPanelSelection();
      return;
    }

    if (action === "grammar-check-add-selected") {
      addSelectedGrammarCheckWordsToProjectDictionary();
      return;
    }

    if (action === "close-grammar-check-panel") {
      closeGrammarCheckPanel();
      return;
    }

    if (action === "add-selection-task") {
      openTaskComposerFromContextMenu(event);
      return;
    }

    if (action === "add-passage-note") {
      openPassageNoteComposerFromContextMenu(target.dataset.noteType);
      return;
    }

    if (action === "save-selection-task") {
      saveTaskFromComposer();
      return;
    }

    if (action === "save-passage-note") {
      savePassageNoteFromComposer();
      return;
    }

    if (action === "commit-inline-passage-note") {
      commitInlinePassageNote();
      return;
    }

    if (action === "cancel-inline-passage-note") {
      cancelInlinePassageNote();
      return;
    }

    if (action === "cancel-selection-task") {
      cancelTaskComposer();
      return;
    }

    if (action === "trim-scene-whitespace") {
      trimSceneWhitespace(target.dataset.sceneId);
      return;
    }

    if (action === "complete-task") {
      completeTask(target.dataset.taskId);
      return;
    }

    if (action === "suggest-scene-title") {
      suggestSceneTitle(target.dataset.sceneId);
      return;
    }

    if (action === "start-narration-recording") {
      hideFileMenu();
      void startNarrationRecording(target.dataset.sceneId);
      return;
    }

    if (action === "stop-narration-recording") {
      hideFileMenu();
      void stopNarrationRecording();
      return;
    }

    if (action === "clear-narration-selection") {
      hideFileMenu();
      clearNarrationTakeSelection();
      return;
    }

    if (action === "select-pane") {
      hideFileMenu();
      selectWorkspacePane(target.dataset.paneId);
      return;
    }

    if (action === "select-side-panel") {
      hideFileMenu();
      selectSidePanel(target.dataset.sidePanel);
      return;
    }

    if (action === "select-passage-note") {
      hideFileMenu();
      togglePassageNoteSelection(target.dataset.noteId);
      return;
    }

    if (action === "edit-passage-note") {
      hideFileMenu();
      openPassageNoteEditorFromPanel(target.dataset.noteId);
      return;
    }

    if (action === "delete-passage-note") {
      hideFileMenu();
      requestDeletePassageNoteFromPanel(target.dataset.noteId);
      return;
    }

    if (action === "toggle-delete-confirmation-preference") {
      toggleDeleteConfirmationPreference(target.dataset.confirmationKey, target instanceof HTMLInputElement ? target.checked : false);
      renderDeleteConfirmationDialog();
      return;
    }

    if (action === "confirm-delete-confirmation") {
      confirmDeleteConfirmationDialog();
      return;
    }

    if (action === "cancel-delete-confirmation") {
      cancelDeleteConfirmationDialog();
      return;
    }

    if (action === "toggle-task-preview") {
      hideFileMenu();
      toggleTaskPreview(target.dataset.taskPreviewTaskId);
      return;
    }

    if (action === "toggle-chapter-collapse") {
      hideFileMenu();
      toggleChapterCollapse(target.dataset.chapterId);
      return;
    }

    if (action === "delete-scene") {
      deleteSceneFromBinder(target.dataset.sceneId);
      return;
    }

    if (action === "delete-chapter") {
      deleteChapterFromBinder(target.dataset.chapterId);
      return;
    }

    if (action === "select-chapter") {
      hideFileMenu();
      const chapterTitleTarget = clickTarget?.closest("[data-chapter-title-id]");
      if (chapterTitleTarget instanceof Element) {
        const chapterId = chapterTitleTarget.dataset.chapterTitleId;
        if (chapterId && consumeBinderTitleClick("chapter", chapterId)) {
          event.preventDefault();
          beginChapterTitleEdit(chapterId);
          return;
        }
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-edit-field='chapter-title']")
      ) {
        return;
      }

      selectChapterById(target.dataset.chapterId);
      return;
    }

    if (action === "select-scene") {
      hideFileMenu();
      const binderSceneTitleTarget = clickTarget?.closest("[data-binder-scene-title-id]");
      if (binderSceneTitleTarget instanceof Element) {
        const sceneId = binderSceneTitleTarget.dataset.binderSceneTitleId;
        if (sceneId && consumeBinderTitleClick("scene", sceneId)) {
          event.preventDefault();
          beginSceneTitleEdit(sceneId);
          return;
        }
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-edit-field='scene-title']")
      ) {
        return;
      }

      selectSceneById(target.dataset.sceneId);
      return;
    }

    if (action === "select-line") {
      hideFileMenu();
      state.selectedIssueId = null;
      syncSelectionFromBlock(target.dataset.lineId);
      render();
      return;
    }

    if (action === "preview-voice-recording") {
      hideFileMenu();
      void previewVoiceRecording(target.dataset.recordingId);
      return;
    }

    if (action === "go-to-voice-recording-verse") {
      hideFileMenu();
      goToVoiceRecordingVerse(target.dataset.recordingId);
      return;
    }

    if (action === "select-issue") {
      hideFileMenu();
      const issue = getIssue(target.dataset.issueId);
      if (!issue) {
        return;
      }

      state.selectedIssueId = issue.id;
      syncSelectionFromBlock(issue.blockId);
      render();
      return;
    }

    if (action === "select-event") {
      hideFileMenu();
      const eventTag = getEvent(target.dataset.eventId);
      if (!eventTag) {
        return;
      }

      state.selectedIssueId = null;
      syncSelectionFromBlock(eventTag.blockId);
      render();
      return;
    }

    if (action === "select-node") {
      hideFileMenu();
      const node = getNode(target.dataset.nodeId);
      if (!node) {
        return;
      }

      state.selectedNodeId = node.id;
      if (node.primaryBlockId) {
        state.selectedIssueId = null;
        syncSelectionFromBlock(node.primaryBlockId);
      }
      if (node.linkedEntityIds[0]) {
        state.selectedEntityId = node.linkedEntityIds[0];
      }
      render();
      return;
    }

    if (action === "select-entity") {
      hideFileMenu();
      const entity = getEntity(target.dataset.entityId);
      if (!entity) {
        return;
      }

      state.selectedEntityId = entity.id;
      if (entity.introductionBlockId) {
        state.selectedIssueId = null;
        syncSelectionFromBlock(entity.introductionBlockId);
      }
      if (entity.introductionNodeId) {
        state.selectedNodeId = entity.introductionNodeId;
      }
      render();
      return;
    }

    if (action === "add-chapter") {
      addChapterDraft();
      return;
    }

    if (action === "add-scene") {
      addSceneDraft();
      return;
    }

    if (action === "add-template") {
      addTemplateDraft();
      return;
    }

    if (action === "load-project") {
      loadSelectedProject();
      return;
    }

    if (action === "save-project") {
      void saveCurrentProject();
      return;
    }

    if (action === "save-project-file-as") {
      void saveCurrentProjectFileAs();
      return;
    }

    if (action === "load-project-file") {
      void loadProjectLibraryFromFile();
      return;
    }

    if (action === "create-project") {
      createProject();
      return;
    }

    if (action === "load-project-source") {
      loadProjectSource();
      return;
    }

    if (action === "reset-scene-draft") {
      resetSceneDraft(target.dataset.sceneId);
      state.selectedIssueId = null;
      render();
    }
  });

  document.addEventListener("keydown", handleGlobalKeyboardShortcut, true);

  document.addEventListener("contextmenu", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    const grammarCheckTarget = clickTarget?.closest("[data-grammar-check-word]");
    if (grammarCheckTarget instanceof HTMLElement && grammarCheckTarget.closest("[data-grammar-check-panel]")) {
      const grammarCheckContext = getSpellcheckContextFromGrammarCheckTarget(grammarCheckTarget, event);
      if (grammarCheckContext) {
        event.preventDefault();
        state.taskComposer = null;
        state.binderContextMenu = null;
        state.taskContextMenu = null;
        state.spellcheckContextMenu = grammarCheckContext;
        renderTaskContextMenu();
      }
      return;
    }

    const binderSceneTarget = clickTarget?.closest("[data-binder-scene-id]");
    if (binderSceneTarget instanceof HTMLElement) {
      const sceneId = binderSceneTarget.dataset.binderSceneId;
      const scene = getScene(sceneId);
      if (scene) {
        event.preventDefault();
        openBinderContextMenu(
          "scene",
          {
            sceneId: scene.sceneId,
            sceneTitle: scene.sceneTitle,
            chapterId: scene.chapterId,
            chapterTitle: scene.chapterTitle,
          },
          event,
        );
      }
      return;
    }

    const binderChapterTarget = clickTarget?.closest("[data-chapter-id]");
    if (binderChapterTarget instanceof HTMLElement && binderChapterTarget.closest(".binder-chapter-button")) {
      const chapterId = binderChapterTarget.dataset.chapterId;
      const chapter = groupScenesByChapter(state.scenes).find((candidate) => candidate.chapterId === chapterId) ?? null;
      if (chapterId && chapter) {
        event.preventDefault();
        openBinderContextMenu(
          "chapter",
          {
            chapterId,
            chapterTitle: chapter.chapterTitle,
            sceneId: chapter.scenes[0]?.sceneId ?? "",
            sceneTitle: chapter.scenes[0]?.sceneTitle ?? "",
          },
          event,
        );
      }
      return;
    }

    const editorContext = getEditorContextFromEvent(event);
    if (!editorContext) {
      hideTaskSurfaces();
      return;
    }

    const spellcheckContext = getSpellcheckContextFromEvent(editorContext, event);
    if (spellcheckContext) {
      event.preventDefault();
      state.taskComposer = null;
      state.binderContextMenu = null;
      state.taskContextMenu = null;
      state.spellcheckContextMenu = spellcheckContext;
      renderTaskContextMenu();
      return;
    }

    const { textarea, contextRange, inlinePosition } = editorContext;
    const sceneId = textarea.dataset.sceneId;

    if (!sceneId || !contextRange) {
      hideTaskSurfaces();
      return;
    }

    event.preventDefault();
    state.taskComposer = null;
    state.binderContextMenu = null;
    state.spellcheckContextMenu = null;
    state.taskContextMenu = {
      sceneId,
      selectedText: contextRange.selectedText,
      startOffset: contextRange.startOffset,
      endOffset: contextRange.endOffset,
      insertionOffset: contextRange.hasExplicitSelection
        ? contextRange.endOffset
        : textarea.selectionStart,
      hasExplicitSelection: contextRange.hasExplicitSelection,
      inlinePosition,
      x: event.clientX,
      y: event.clientY,
    };
    renderTaskContextMenu();
  });

  document.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-trigger]")
      : null;
    if (!target) {
      return;
    }

    previewTaskAnchor(target.dataset.taskPreviewTaskId);
  });

  document.addEventListener("pointerout", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (!target) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && target.contains(related)) {
      return;
    }

    if (!state.taskPreview?.pinned) {
      clearTaskAnchorPreview();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target) {
      previewTaskAnchor(target.dataset.taskPreviewId);
    }
  });

  document.addEventListener("focusout", (event) => {
    const chapterTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-edit-field='chapter-title']")
      : null;
    if (chapterTitleTarget) {
      const chapterId = chapterTitleTarget.dataset.chapterId;
      if (chapterId && state.editingChapterTitleId === chapterId) {
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && chapterTitleTarget.contains(related)) {
          return;
        }

        finishChapterTitleEdit(chapterId);
      }
      return;
    }

    const sceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-edit-field='scene-title']")
      : null;
    if (sceneTitleTarget) {
      const sceneId = sceneTitleTarget.dataset.sceneId;
      if (sceneId && state.editingSceneTitleId === sceneId) {
        const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
        if (related && sceneTitleTarget.contains(related)) {
          return;
        }

        finishSceneTitleEdit(sceneId);
      }
      return;
    }

    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (!target) {
      return;
    }

    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (related && target.contains(related)) {
      return;
    }

    if (!state.taskPreview?.pinned) {
      clearTaskAnchorPreview();
    }
  });

  document.addEventListener("dblclick", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest("[data-inline-passage-draft]")
      : null;
    if (
      target &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)
    ) {
      commitInlinePassageNote();
      return;
    }

    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.editField === "scene-title" &&
      event.target.dataset.binderSceneTitleId
    ) {
      return;
    }

    if (event.target instanceof HTMLInputElement && event.target.dataset.editField === "chapter-title") {
      return;
    }

    const binderSceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-binder-scene-title-id]")
      : null;
    if (binderSceneTitleTarget) {
      const sceneId = binderSceneTitleTarget.dataset.binderSceneTitleId;
      if (!sceneId) {
        return;
      }

      event.preventDefault();
      beginSceneTitleEdit(sceneId);
      return;
    }

    const chapterTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-chapter-title-id]")
      : null;
    if (chapterTitleTarget) {
      const chapterId = chapterTitleTarget.dataset.chapterTitleId;
      if (!chapterId) {
        return;
      }

      event.preventDefault();
      beginChapterTitleEdit(chapterId);
      return;
    }

    const sceneTitleTarget = event.target instanceof Element
      ? event.target.closest("[data-scene-title-id]")
      : null;
    if (!sceneTitleTarget) {
      return;
    }

    const sceneId = sceneTitleTarget.dataset.sceneTitleId;
    if (!sceneId) {
      return;
    }

    selectSceneById(sceneId);
    window.requestAnimationFrame(() => {
      const titleInput = document.querySelector(
        `.editor-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
      );
      if (titleInput instanceof HTMLInputElement) {
        titleInput.focus();
        titleInput.select();
      }
    });
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
      return;
    }

    const findField = String(target.dataset.findField ?? "");
    if (findField === "manuscript-find-query" || findField === "manuscript-find-replace") {
      updateManuscriptFindField(findField, target.value);
      return;
    }

    const { editField, sceneId } = target.dataset;
    if (!editField) {
      return;
    }

    if (editField === "project-title") {
      state.projectTitle = target.value;
      state.workspace.project.title = target.value;
      writeStoredJson(EDITOR_PROJECT_TITLE_KEY, target.value);
      persistCurrentProjectRecord();
      return;
    }

    if (editField === "project-source-path") {
      state.projectSourcePath = target.value;
      state.projectSourceStatus = "";
      writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, target.value);
      persistCurrentProjectRecord({ skipProjectFileAutosave: true });
      return;
    }

    if (editField === "project-file-path") {
      setProjectFilePath(target.value, null, { skipProjectFileAutosave: true });
      state.projectFileStatus = "";
      return;
    }

    if (editField === "writing-target-field") {
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        return;
      }
      updateWritingTargetField(target);
      return;
    }

    if (editField === "inline-passage-note") {
      if (state.inlinePassageDraft) {
        state.inlinePassageDraft = {
          ...state.inlinePassageDraft,
          body: target.value,
        };
        syncInlinePassageDraftLayout();
      }
      return;
    }

    if (editField === "inline-passage-verse") {
      if (state.inlinePassageDraft) {
        state.inlinePassageDraft = {
          ...state.inlinePassageDraft,
          typedText: target.value,
        };
        updateInlinePassageDraftStatus(
          getCurrentSceneEditorText(state.inlinePassageDraft.sceneId),
        );
        syncInlinePassageDraftLayout();
      }
      return;
    }

    if (editField === "task-title") {
      state.manuscriptTasks = updateManuscriptTaskTitle(
        state.manuscriptTasks,
        target.dataset.taskId,
        target.value,
      );
      writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
      return;
    }

    if (editField === "passage-note-title") {
      state.passageNotes = updatePassageNoteTitle(
        state.passageNotes,
        target.dataset.noteId,
        target.value,
      );
      writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
      return;
    }

    if (editField === "passage-note-body") {
      state.passageNotes = updatePassageNoteBody(
        state.passageNotes,
        target.dataset.noteId,
        target.value,
      );
      writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
      return;
    }

    if (editField === "chapter-title") {
      updateChapterTitle(target.dataset.chapterId, target.value);
      return;
    }

    if (!sceneId) {
      return;
    }

    if (editField === "scene-title") {
      updateSceneDraft(sceneId, (draft) => {
        draft.sceneTitle = target.value;
      });
      updateSceneTitleLabel(sceneId, target.value);
      updateSceneEditorTitle(sceneId, target.value);
      updateFocusedLineCard();
      return;
    }

    if (editField === "editor-text") {
      updateSceneEditorSelectionSnapshotFromTextarea(target);
      clearTaskAnchorPreview({ restoreSelection: false });
      const previousText = getScene(sceneId)?.editorText ?? "";
      trackInlinePassageDraftTyping(sceneId, previousText, target);
      const activeTypingWordRange = getEditorTypingSpellcheckRange(target);
      updateSceneDraft(sceneId, (draft) => {
        draft.editorText = target.value;
        draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, previousText, target.value);
      });
      scheduleSceneEditorTypingRefresh(sceneId, target.value, {
        revisionPanel: true,
        consoleCard: true,
        inlinePassageStatus: true,
        activeTypingWordRange,
      });
      if (state.editorPrefs.grammarCheckEnabled !== false) {
        scheduleSceneEditorSpellcheckRefresh(sceneId);
      }
    }
  });

  document.addEventListener("paste", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) {
      return;
    }

    if (!["editor-text", "inline-passage-note", "inline-passage-verse", "task-description", "passage-note-body"].includes(String(target.dataset.editField ?? ""))) {
      return;
    }

    const pastedText = event.clipboardData?.getData("text/plain");
    if (typeof pastedText !== "string" || !pastedText.length) {
      return;
    }

    event.preventDefault();
    const normalizedText = pastedText.replace(/\r\n?/g, "\n");
    const { insertedWithNativeUndo, fallbackUsed } = insertPastedTextWithUndoFallback(target, normalizedText);
    editorInteractionLog.info("user-action", "editor.paste", "Inserted pasted text into an editor textarea.", {
      editField: String(target.dataset.editField ?? ""),
      sceneId: String(target.dataset.sceneId ?? ""),
      pastedCharacterCount: normalizedText.length,
      usedNativeUndoInsertion: insertedWithNativeUndo,
      fallbackUsed,
    });
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset.writingTargetField === "visibleMetric"
    ) {
      updateWritingTargetField(target);
      return;
    }

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
      target.dataset.writingTargetField &&
      target.dataset.writingTargetField !== "visibleMetric"
    ) {
      updateWritingTargetField(target);
      renderHeader();
      renderWritingTargetWindow();
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.projectLibrarySelect !== undefined) {
      state.projectLibrarySelectionId = target.value;
      renderHeader();
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.localAiSetting === "enabled") {
      state.localAiPrefs = normalizeLocalAiPrefs({
        ...state.localAiPrefs,
        enabled: target.checked,
      });
      writeStoredJson(EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs);
      persistCurrentProjectRecord();
      renderHeader();
      renderManuscriptPanel();
      syncSceneDocumentLayout();
      return;
    }

    if (target instanceof HTMLInputElement && target.dataset.editorPref) {
      state.editorPrefs = normalizeEditorPrefs({
        ...state.editorPrefs,
        [target.dataset.editorPref]: target.type === "checkbox" ? target.checked : target.value,
      });
      if (target.dataset.editorPref === "projectFileAutosaveEnabled" && target.checked !== true) {
        clearProjectFileAutosaveTimer();
      }
      if (target.dataset.editorPref === "grammarCheckEnabled" && target.checked !== true) {
        clearSceneEditorSpellcheckRefresh();
      }
      writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
      persistCurrentProjectRecord();
      if (target.dataset.editorPref === "projectFileAutosaveEnabled" && target.checked === true && state.projectFileAutosaveDirty) {
        queueProjectFileAutosave();
      }
      if (target.dataset.editorPref === "grammarCheckEnabled") {
        syncGrammarCheckPanelHeaderState();
        if (state.grammarCheckPanel?.open) {
          renderGrammarCheckPanel();
        }
      } else {
        renderHeader();
        renderManuscriptPanel();
      }
      syncSceneDocumentLayout();
      return;
    }

    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const { editorPref } = target.dataset;
    if (!editorPref) {
      return;
    }

    const rawValue =
      editorPref === "fontFamilyId" ? target.value : Number(target.value);
    state.editorPrefs = normalizeEditorPrefs({
      ...state.editorPrefs,
      [editorPref]: rawValue,
    });
    writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
    persistCurrentProjectRecord();
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  });

  window.addEventListener("resize", () => {
    hideTaskSurfaces();
    syncSceneDocumentLayout();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      toggleWritingTargetWindow();
      return;
    }

    if (
      event.target instanceof HTMLTextAreaElement &&
      ["inline-passage-note", "inline-passage-verse"].includes(event.target.dataset.editField) &&
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      commitInlinePassageNote();
      return;
    }

    if (
      event.target instanceof HTMLInputElement &&
      event.target.dataset.editField === "chapter-title" &&
      (event.key === "Enter" || event.key === "Escape")
    ) {
      event.preventDefault();
      event.target.blur();
      return;
    }

    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      navigateTaskAnchor(target.dataset.taskPreviewId);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openManuscriptFind();
      return;
    }

    if (state.manuscriptFind.open && event.key === "Enter" && event.target instanceof HTMLInputElement) {
      if (event.target.dataset.findField === "manuscript-find-query") {
        event.preventDefault();
        moveManuscriptFindMatch(event.shiftKey ? -1 : 1);
        return;
      }
    }

    if (state.manuscriptFind.open && event.key === "Escape") {
      event.preventDefault();
      closeManuscriptFind();
      return;
    }

    if (event.key === "Escape") {
      if (state.writingTargetWindowOpen) {
        closeWritingTargetWindow();
        return;
      }
      hideFileMenu();
      hideTaskSurfaces();
    }
  });
}

// Intent: orchestrate slot rendering without letting individual panels own whole-app refresh order.
function render() {
  if (!state.shellReady) {
    renderShell();
    state.shellReady = true;
  }

  syncLayoutWidths();
  renderHeader();
  renderBinderPanel();
  renderManuscriptPanel();
  renderConsolePanel();
  renderManuscriptFindPanel();
  renderWorldPanel();
  renderEntityPanel();
  renderDreamScapingPanel();
  renderTaskContextMenu();
  renderDeleteConfirmationDialog();
  renderWritingTargetWindow();
  renderPaneVisibility();
  if (state.activePane === "manuscript" || state.activePane === "narration") {
    syncSceneDocumentLayout();
  }
}

function renderShell() {
  appRoot.innerHTML = `
    <div id="hero-slot"></div>

    <main class="workspace-grid pane-section" data-pane-section="manuscript">
      <aside id="binder-slot" class="panel binder-panel"></aside>
      <div
        class="panel-resizer panel-resizer-left"
        data-resize-handle="binder"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize manuscript binder"
      ></div>
      <section id="manuscript-slot" class="panel manuscript-panel"></section>
      <div
        class="panel-resizer panel-resizer-right"
        data-resize-handle="console"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize issue console"
      ></div>
      <aside id="console-slot" class="panel console-panel"></aside>
    </main>

    <section class="world-grid pane-section" data-pane-section="world">
      <section id="world-slot" class="panel spine-panel"></section>
      <aside id="entity-slot" class="panel entity-panel"></aside>
    </section>

    <section class="ideation-grid pane-section" data-pane-section="world">
      <section id="dream-slot" class="panel dream-panel"></section>
    </section>

    <div id="task-menu-slot"></div>
    <div id="confirmation-slot"></div>
    <div id="find-slot"></div>
    <div id="grammar-check-slot"></div>
    <div id="writing-target-slot"></div>
  `;
}

function renderTaskContextMenu() {
  const slot = document.querySelector("#task-menu-slot");
  if (!slot) {
    return;
  }

  const spellcheckMenu = state.spellcheckContextMenu;
  if (spellcheckMenu) {
    const suggestions = Array.isArray(spellcheckMenu.suggestions) ? spellcheckMenu.suggestions : [];
    const menuWords = Array.isArray(spellcheckMenu.words) && spellcheckMenu.words.length
      ? spellcheckMenu.words
      : (spellcheckMenu.word ? [spellcheckMenu.word] : []);
    const menuWidth = spellcheckMenu.mode === "selection" ? 440 : 360;
    const menuHeight = spellcheckMenu.mode === "selection" ? 320 : 300;
    const left = Math.min(Math.max(8, spellcheckMenu.x), Math.max(8, window.innerWidth - menuWidth));
    const top = Math.min(Math.max(8, spellcheckMenu.y), Math.max(8, window.innerHeight - menuHeight));
    const countLabel = `${menuWords.length} flagged word${menuWords.length === 1 ? "" : "s"}`;
    slot.innerHTML = `
      <div
        class="task-context-menu grammar-check-context-menu spellcheck-context-menu"
        style="left:${left}px; top:${top}px;"
        role="menu"
        data-spellcheck-menu
      >
        <p class="spellcheck-context-menu__label">Grammar check</p>
        <strong class="spellcheck-context-menu__word">${escapeHtml(countLabel)}</strong>
        <div class="spellcheck-context-menu__selection-list">
          ${menuWords.length
            ? menuWords.map((word) => `<span class="spellcheck-context-menu__chip">${escapeHtml(word)}</span>`).join("")
            : `<p class="spellcheck-context-menu__empty">No flagged words found.</p>`}
        </div>
        ${spellcheckMenu.mode === "word" && suggestions.length
          ? `
            <div class="spellcheck-context-menu__suggestions">
              ${suggestions.map((suggestion) => `
                <button
                  class="task-menu-item spellcheck-suggestion-item"
                  data-action="apply-spellcheck-suggestion"
                  data-spellcheck-replacement="${escapeHtml(suggestion)}"
                  data-spellcheck-start-offset="${escapeHtml(String(spellcheckMenu.startOffset))}"
                  data-spellcheck-end-offset="${escapeHtml(String(spellcheckMenu.endOffset))}"
                  data-spellcheck-scene-id="${escapeHtml(spellcheckMenu.sceneId)}"
                  role="menuitem"
                >
                  <span class="task-menu-icon" aria-hidden="true">✓</span>
                  <span>${escapeHtml(suggestion)}</span>
                </button>
              `).join("")}
            </div>
          `
          : ""}
        <button class="task-menu-item spellcheck-add-item" data-action="add-grammar-check-dictionary" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">+</span>
          <span>Add to project dictionary</span>
        </button>
        <button class="task-menu-item spellcheck-add-item" data-action="add-grammar-check-exceptions" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">⟲</span>
          <span>Add to project exceptions</span>
        </button>
        <button class="task-menu-item spellcheck-dismiss" data-action="dismiss-spellcheck-menu" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">×</span>
          <span>Close grammar check</span>
        </button>
      </div>
    `;
    return;
  }

  const binderMenu = state.binderContextMenu;
  if (binderMenu) {
    const left = Math.min(Math.max(8, binderMenu.x), Math.max(8, window.innerWidth - 280));
    const top = Math.min(Math.max(8, binderMenu.y), Math.max(8, window.innerHeight - 220));
    const title =
      binderMenu.kind === "chapter"
        ? `${String(binderMenu.chapterTitle ?? "").trim() || "Untitled chapter"}`
        : `${String(binderMenu.sceneTitle ?? "").trim() || "Untitled scene"}`;
    const detail =
      binderMenu.kind === "chapter"
        ? "Delete this chapter and every scene inside it."
        : "Delete this scene and its attached tasks and notes.";
    slot.innerHTML = `
      <div
        class="task-context-menu binder-context-menu"
        style="left:${left}px; top:${top}px;"
        role="menu"
        data-binder-menu
      >
        <p>${escapeHtml(title)}</p>
        <button class="task-menu-item" data-action="${binderMenu.kind === "chapter" ? "delete-chapter" : "delete-scene"}" data-${binderMenu.kind}-id="${escapeHtml(binderMenu.kind === "chapter" ? binderMenu.chapterId : binderMenu.sceneId)}" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">−</span>
          <span>${escapeHtml(binderMenu.kind === "chapter" ? "Delete chapter" : "Delete scene")}</span>
        </button>
        <button class="task-menu-item" data-action="cancel-binder-context-menu" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">×</span>
          <span>Cancel</span>
        </button>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
    return;
  }

  const composer = state.taskComposer;
  if (composer) {
    const excerpt = composer.selectedText.trim().slice(0, 120);
    const isPassageNoteComposer = composer.composerType === "passage-note";
    const noteLabel = composer.noteType === "research" ? "Research" : "Inspiration";
    const left = Math.min(Math.max(8, composer.x), Math.max(8, window.innerWidth - 380));
    const top = Math.min(Math.max(8, composer.y), Math.max(8, window.innerHeight - 260));
    slot.innerHTML = `
      <form
        class="task-composer"
        style="left:${left}px; top:${top}px; ${escapeHtml(buildEditorStyle())}"
      >
        <label for="task-description-input">${escapeHtml(isPassageNoteComposer ? noteLabel : "Task body")}</label>
        <textarea
          id="task-description-input"
          class="task-description-input"
          placeholder="${escapeHtml(isPassageNoteComposer ? getPassageNotePlaceholder(composer.noteType) : "Describe what needs to be done for this task...")}"
          ${isPassageNoteComposer ? "data-passage-note-body" : "data-task-description"}
        ></textarea>
        <p>${escapeHtml(excerpt)}</p>
        <div class="task-composer-actions">
          <button class="tag-button" type="button" data-action="${isPassageNoteComposer ? "save-passage-note" : "save-selection-task"}">
            ${escapeHtml(isPassageNoteComposer ? `Save ${noteLabel.toLowerCase()}` : "Add task")}
          </button>
          <button class="tag-button" type="button" data-action="cancel-selection-task">Cancel</button>
        </div>
      </form>
    `;

    const input = document.querySelector(
      isPassageNoteComposer ? "[data-passage-note-body]" : "[data-task-description]",
    );
    if (input instanceof HTMLTextAreaElement) {
      input.focus();
    }
    return;
  }

  const menu = state.taskContextMenu;
  if (!menu) {
    slot.innerHTML = "";
    return;
  }

  const excerpt = menu.selectedText.trim().slice(0, 80);
  const left = Math.min(Math.max(8, menu.x), Math.max(8, window.innerWidth - 276));
  const top = Math.min(Math.max(8, menu.y), Math.max(8, window.innerHeight - 230));
  slot.innerHTML = `
    <div
      class="task-context-menu"
      style="left:${left}px; top:${top}px;"
      role="menu"
      >
      <button class="task-menu-item" data-action="add-selection-task" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">+</span>
        <span>${escapeHtml(menu.hasExplicitSelection ? "Add task" : "Add task from line")}</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="inspiration" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">i</span>
        <span>Add inspiration</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="research" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">r</span>
        <span>Add research</span>
      </button>
      <button class="task-menu-item" data-action="trim-scene-whitespace" data-scene-id="${escapeHtml(menu.sceneId)}" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">↧</span>
        <span>Trim scene whitespace</span>
      </button>
      <p>${escapeHtml(excerpt)}</p>
    </div>
  `;
}

function getPassageNoteVerb(noteType) {
  return noteType === "research" ? "research" : "inspiration";
}

function renderHeader() {
  const writingTargetSummary = buildWritingTargetSummary();
  const projectFileAutosaveConnected = hasProjectFileDestination();
  const projectFileDisplay = getProjectFileDisplayState();
  document.querySelector("#hero-slot").innerHTML = renderEditorChrome({
    state,
    workspace: state.workspace,
    writingTargetSummary,
    projectFileAutosaveConnected,
    projectFileDisplay,
    createProjectLibraryRecord: createProjectLibraryRecordFromState,
    getSuggestedProjectFilePath,
  });
}

// Intent: keep header menu interactions centralized until the chrome owns its own controller.
function toggleFileMenu() {
  state.fileMenuOpen = !state.fileMenuOpen;
  renderHeader();
}

function focusProjectLibrarySelect() {
  const select = document.querySelector("[data-project-library-select]");
  if (select instanceof HTMLSelectElement) {
    select.focus({ preventScroll: true });
  }
}

function hideFileMenu() {
  if (!state.fileMenuOpen) {
    return;
  }

  state.fileMenuOpen = false;
  renderHeader();
}

function openDeveloperLogsWindow() {
  const targetUrl = new URL(DEVELOPER_LOG_WINDOW_PATH, window.location.href).toString();
  const logWindow = window.open(targetUrl, "abe-developer-logs");
  if (!logWindow) {
    state.projectFileStatus = "Developer logs window blocked by browser popup settings.";
    renderHeader();
    uiEventDispatcherLog.warn("user-action", "developer-logs.open-blocked", "Developer logs window was blocked.", {
      url: targetUrl,
    });
    return;
  }

  state.developerLogsWindowOpen = true;
  try {
    logWindow.focus();
  } catch {
    // Best-effort focus only.
  }
  uiEventDispatcherLog.info("user-action", "developer-logs.open", "Opened developer logs window.", {
    url: targetUrl,
  });
}

function isTextEditingTarget(target) {
  if (target instanceof HTMLTextAreaElement) {
    return target.disabled !== true && target.readOnly !== true;
  }

  if (!(target instanceof HTMLInputElement) || target.disabled || target.readOnly) {
    return false;
  }

  return [
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
    "date",
    "datetime-local",
    "month",
    "time",
    "week",
  ].includes(target.type);
}

function runNativeTextEditCommand(command) {
  if (typeof command !== "string" || !command) {
    return false;
  }

  if (typeof document.execCommand !== "function") {
    return false;
  }

  try {
    return document.execCommand(command);
  } catch {
    return false;
  }
}

// Intent: keep paste insertion on the browser undo stack before falling back to scripted textarea writes.
function insertPastedTextWithUndoFallback(target, normalizedText) {
  if (!(target instanceof HTMLTextAreaElement)) {
    return {
      insertedWithNativeUndo: false,
      fallbackUsed: false,
    };
  }

  const activeElement = document.activeElement;
  if (activeElement !== target) {
    target.focus();
  }

  let insertedWithNativeUndo = false;
  try {
    if (typeof document.execCommand === "function") {
      insertedWithNativeUndo = document.execCommand("insertText", false, normalizedText) === true;
    }
  } catch {
    insertedWithNativeUndo = false;
  }

  if (insertedWithNativeUndo) {
    return {
      insertedWithNativeUndo: true,
      fallbackUsed: false,
    };
  }

  const selectionStart = Number.isInteger(target.selectionStart) ? target.selectionStart : target.value.length;
  const selectionEnd = Number.isInteger(target.selectionEnd) ? target.selectionEnd : selectionStart;
  target.setRangeText(normalizedText, selectionStart, selectionEnd, "end");
  target.dispatchEvent(new Event("input", { bubbles: true }));

  return {
    insertedWithNativeUndo: false,
    fallbackUsed: true,
  };
}

function handleGlobalKeyboardShortcut(event) {
  if (event.defaultPrevented || event.repeat || event.isComposing) {
    return;
  }

  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

  if (key === "escape") {
    if (state.writingTargetWindowOpen) {
      event.preventDefault();
      closeWritingTargetWindow();
      return;
    }

    if (state.fileMenuOpen) {
      event.preventDefault();
      hideFileMenu();
    }

    return;
  }

  const commandKey = event.ctrlKey || event.metaKey;
  if (!commandKey) {
    return;
  }

  if (!event.altKey && !isTextEditingTarget(event.target) && (key === "z" || key === "y")) {
    const handled = key === "z"
      ? (event.shiftKey ? redoBinderSceneMove() : undoBinderSceneMove())
      : redoBinderSceneMove();
    if (handled) {
      event.preventDefault();
      hideFileMenu();
      return;
    }
  }

  if (!event.altKey && isTextEditingTarget(event.target)) {
    if (key === "z") {
      event.preventDefault();
      runNativeTextEditCommand(event.shiftKey ? "redo" : "undo");
      return;
    }

    if (key === "y") {
      event.preventDefault();
      runNativeTextEditCommand("redo");
      return;
    }
  }

  if (event.altKey && key === "t") {
    event.preventDefault();
    hideFileMenu();
    toggleWritingTargetWindow();
    return;
  }

  if (event.shiftKey && key === "s") {
    event.preventDefault();
    hideFileMenu();
    void saveCurrentProjectFileAs();
    return;
  }

  if (event.shiftKey && key === "o") {
    event.preventDefault();
    hideFileMenu();
    void loadProjectLibraryFromFile();
    return;
  }

  if (event.shiftKey && key === "l") {
    event.preventDefault();
    hideFileMenu();
    openDeveloperLogsWindow();
    return;
  }

  if (!event.altKey && !event.shiftKey && key === "s") {
    event.preventDefault();
    hideFileMenu();
    void saveCurrentProject();
    return;
  }

  if (!event.altKey && !event.shiftKey && key === "n") {
    event.preventDefault();
    hideFileMenu();
    createProject();
    return;
  }

  if (!event.altKey && !event.shiftKey && key === "o") {
    event.preventDefault();
    toggleFileMenu();
    if (state.fileMenuOpen) {
      window.requestAnimationFrame(() => {
        if (state.fileMenuOpen) {
          focusProjectLibrarySelect();
        }
      });
    }
    return;
  }

  if (!event.altKey && !event.shiftKey && /^[1-4]$/.test(key)) {
    event.preventDefault();
    hideFileMenu();
    selectWorkspacePane({
      "1": "manuscript",
      "2": "world",
      "3": "narration",
      "4": "voice",
    }[key]);
  }
}
function toggleConsoleCollapse() {
  state.consoleDockCollapsed = !state.consoleDockCollapsed;
  persistConsoleDockCollapsedState(state.consoleDockCollapsed);
  syncLayoutWidths(true);
  renderConsolePanel();
}

function beginLayoutResize(handleId, event) {
  if (!(event instanceof PointerEvent)) {
    return;
  }

  layoutResizeSession = {
    handleId,
  };
  document.body.classList.add("is-resizing-layout");
  syncLayoutWidths();
  event.preventDefault();
}

function handleLayoutResizePointerMove(event) {
  if (!layoutResizeSession || !(event instanceof PointerEvent)) {
    return;
  }

  event.preventDefault();

  const workspace = document.querySelector(".workspace-grid");
  if (!(workspace instanceof HTMLElement)) {
    return;
  }

  const rect = workspace.getBoundingClientRect();
  const availableWidth = Math.max(0, rect.width - (PANEL_RESIZER_WIDTH * 2));
  const currentConsoleWidth = state.consoleDockCollapsed
    ? CONSOLE_DOCK_COLLAPSED_WIDTH
    : state.consoleDockWidth;

  if (layoutResizeSession.handleId === "binder") {
    const maxBinderWidth = Math.max(
      MIN_BINDER_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - currentConsoleWidth,
    );
    state.binderPanelWidth = clampNumber(
      Math.round(event.clientX - rect.left),
      MIN_BINDER_PANEL_WIDTH,
      maxBinderWidth,
    );
    syncLayoutWidths();
    return;
  }

  if (layoutResizeSession.handleId === "console" && !state.consoleDockCollapsed) {
    const maxConsoleWidth = Math.max(
      MIN_CONSOLE_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - state.binderPanelWidth,
    );
    state.consoleDockWidth = clampNumber(
      Math.round(rect.right - event.clientX),
      MIN_CONSOLE_PANEL_WIDTH,
      maxConsoleWidth,
    );
    syncLayoutWidths();
  }
}

function endLayoutResize() {
  if (!layoutResizeSession) {
    return;
  }

  layoutResizeSession = null;
  document.body.classList.remove("is-resizing-layout");
  syncLayoutWidths(true);
}

// Intent: render the binder as the navigable manuscript structure, not a flat document outline.
function renderBinderPanel() {
  const workspace = state.workspace;
  const chapters = groupScenesByChapter(state.scenes);
  const taskCountsByChapter = countRemainingTasksByChapter(state.manuscriptTasks);
  const activeProject = getActiveProjectRecord();
  const slot = document.querySelector("#binder-slot");
  if (!slot) {
    return;
  }

  const { scrollTop, scrollLeft } = slot;
  slot.innerHTML = `
    <div class="panel-heading manuscript-nav-heading">
      <p class="panel-kicker">Manuscript</p>
      <div class="panel-actions manuscript-nav-actions">
        <button class="tag-button panel-action-button" data-action="add-chapter">
          <span class="binder-nav-action-long">New chapter</span>
          <span class="binder-nav-action-short" aria-hidden="true">+C</span>
        </button>
        <button class="tag-button panel-action-button" data-action="add-scene">
          <span class="binder-nav-action-long">New scene</span>
          <span class="binder-nav-action-short" aria-hidden="true">+S</span>
        </button>
      </div>
    </div>
    <div class="binder-tree">
      ${chapters.map((chapter, index) => renderChapterNode(chapter, index + 1, taskCountsByChapter[chapter.chapterId] ?? 0)).join("")}
    </div>
    <div class="character-block">
      <h3>Character Index</h3>
      ${workspace.project.characters.map((character) => `
        <div class="character-card">
          <strong>${escapeHtml(character.name)}</strong>
          <span>${escapeHtml(character.aliasList.join(", ") || "No aliases")}</span>
        </div>
      `).join("")}
    </div>
    ${renderSourceArchive(activeProject)}
  `;
  slot.scrollTop = scrollTop;
  slot.scrollLeft = scrollLeft;
}

function renderSourceArchive(projectRecord) {
  const archive = Array.isArray(projectRecord?.sourceArchive) ? projectRecord.sourceArchive : [];
  if (!archive.length) {
    return "";
  }

  return `
    <div class="source-archive">
      <div class="panel-heading split-heading">
        <p class="panel-kicker">Project sources</p>
        <h2>Project archive</h2>
      </div>
      <div class="source-archive-list">
        ${archive.map((item) => renderSourceArchiveItem(item)).join("")}
      </div>
    </div>
  `;
}

function renderSourceArchiveItem(item) {
  return `
    <article class="source-archive-item">
      <span class="source-archive-kind">${escapeHtml(formatImportSourceLabel(item.kind))}</span>
      <strong>${escapeHtml(item.title || "Untitled source item")}</strong>
      <span>${escapeHtml(item.binderPath || "Unknown location")}</span>
    </article>
  `;
}

function renderChapterNode(chapter, chapterNumber, taskCount) {
  const isCurrentChapter = getSelectedScene()?.chapterId === chapter.chapterId;
  const isCollapsed = isChapterCollapsed(chapter.chapterId);
  const isEditingChapterTitle = state.editingChapterTitleId === chapter.chapterId;
  const isDropStart =
    binderSceneDragState?.dropTarget?.type === "chapter-start" &&
    binderSceneDragState.dropTarget.chapterId === chapter.chapterId;
  const childrenId = `binder-chapter-scenes-${chapter.chapterId}`;
  const chapterNumberLabel = formatChapterNumberLabel(chapterNumber);
  const chapterDisplayTitle = formatChapterDisplayTitle(chapter.chapterTitle);
  const editableChapterTitle = getEditableChapterTitle(chapter.chapterTitle);
  return `
    <div class="binder-node binder-chapter ${isCollapsed ? "is-collapsed" : ""} ${isDropStart ? "is-drop-start" : ""}" data-binder-chapter-drop-id="${escapeHtml(chapter.chapterId)}">
      <div class="binder-chapter-row">
        <button
          class="binder-collapse-button"
          type="button"
          data-action="toggle-chapter-collapse"
          data-chapter-id="${escapeHtml(chapter.chapterId)}"
          aria-label="${escapeHtml(isCollapsed ? `Expand ${chapterDisplayTitle}` : `Collapse ${chapterDisplayTitle}`)}"
          aria-expanded="${isCollapsed ? "false" : "true"}"
          aria-controls="${escapeHtml(childrenId)}"
          title="${escapeHtml(isCollapsed ? "Expand chapter" : "Collapse chapter")}"
        >
          <span aria-hidden="true">${isCollapsed ? "▸" : "▾"}</span>
        </button>
        ${
          isEditingChapterTitle
            ? `
              <div
                class="binder-button binder-chapter-button ${isCurrentChapter ? "is-active" : ""} is-editing-chapter-title"
                data-action="select-chapter"
                data-chapter-id="${escapeHtml(chapter.chapterId)}"
              >
                <span class="binder-chapter-order">${escapeHtml(chapterNumberLabel)}</span>
                <input
                  class="inline-title-input binder-chapter-title-input"
                  type="text"
                  value="${escapeHtml(editableChapterTitle)}"
                  data-edit-field="chapter-title"
                  data-chapter-id="${escapeHtml(chapter.chapterId)}"
                  data-chapter-title-id="${escapeHtml(chapter.chapterId)}"
                  aria-label="Chapter title"
                />
                ${taskCount > 0 ? renderTaskBadge(taskCount, chapterDisplayTitle) : ""}
              </div>
            `
            : `
              <button
                class="binder-button binder-chapter-button ${isCurrentChapter ? "is-active" : ""}"
                type="button"
                data-action="select-chapter"
                data-chapter-id="${escapeHtml(chapter.chapterId)}"
              >
                <span class="binder-chapter-order">${escapeHtml(chapterNumberLabel)}</span>
                <span class="binder-chapter-title" data-chapter-title-id="${escapeHtml(chapter.chapterId)}">${escapeHtml(chapterDisplayTitle)}</span>
                ${taskCount > 0 ? renderTaskBadge(taskCount, chapterDisplayTitle) : ""}
              </button>
            `
        }
      </div>
      <div class="binder-children" id="${escapeHtml(childrenId)}" ${isCollapsed ? "hidden" : ""}>
        ${renderBinderSceneDropSlot(chapter.scenes[0], "before", chapter.chapterId)}
        ${chapter.scenes.map((scene, index) => `
          ${renderSceneNode(scene)}
          ${index === chapter.scenes.length - 1 ? renderBinderSceneDropSlot(scene, "after", chapter.chapterId) : ""}
        `).join("")}
      </div>
    </div>
  `;
}

// Intent: provide explicit drag landing zones between scenes so cross-chapter moves can target a concrete insertion point.
function renderBinderSceneDropSlot(scene, position, chapterId) {
  const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId : "";
  const sceneChapterId = typeof scene?.chapterId === "string" ? scene.chapterId : chapterId;
  if (!sceneId || !sceneChapterId) {
    return "";
  }

  return `
    <div
      class="binder-scene-drop-slot binder-scene-drop-slot-${escapeHtml(position)}"
      data-binder-scene-drop-slot-id="${escapeHtml(sceneId)}"
      data-binder-scene-drop-position="${escapeHtml(position)}"
      data-binder-scene-drop-chapter-id="${escapeHtml(sceneChapterId)}"
      aria-hidden="true"
    ></div>
  `;
}

function renderTaskBadge(taskCount, chapterTitle) {
  return `
    <span class="task-badge" title="${escapeHtml(`${taskCount} open task${taskCount === 1 ? "" : "s"} in ${chapterTitle}`)}">
      <span class="task-badge-icon" aria-hidden="true">!</span>
      <span>${escapeHtml(String(taskCount))}</span>
    </span>
  `;
}

function renderSceneNode(scene) {
  const isCurrentScene = scene.sceneId === state.selectedSceneId;
  const isEditingSceneTitle = state.editingSceneTitleId === scene.sceneId;
  const canDragScene = scene.blocks.some((block) => Number.isInteger(block.lineNumber));
  const isDraggingScene = binderSceneDragState?.sourceSceneId === scene.sceneId;
  const isDropBefore =
    binderSceneDragState?.dropTarget?.type === "before" &&
    binderSceneDragState.dropTarget.sceneId === scene.sceneId;
  const isDropAfter =
    binderSceneDragState?.dropTarget?.type === "after" &&
    binderSceneDragState.dropTarget.sceneId === scene.sceneId;
  const sceneDisplayTitle = escapeHtml(scene.sceneTitle);
  return `
    <div class="binder-node binder-scene ${isDropBefore ? "is-drop-before" : ""} ${isDropAfter ? "is-drop-after" : ""}" data-binder-scene-drop-id="${escapeHtml(scene.sceneId)}">
      ${
        isEditingSceneTitle
          ? `
            <div
              class="binder-button binder-scene-button ${isCurrentScene ? "is-active" : ""} ${isDraggingScene ? "is-dragging" : ""} is-editing-scene-title"
              data-action="select-scene"
              data-scene-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-id="${escapeHtml(scene.sceneId)}"
            >
              <span class="binder-kind">scene</span>
              <input
                class="inline-title-input binder-scene-title-input"
                type="text"
                value="${sceneDisplayTitle}"
                data-edit-field="scene-title"
                data-scene-id="${escapeHtml(scene.sceneId)}"
                data-binder-scene-title-id="${escapeHtml(scene.sceneId)}"
                aria-label="Scene title"
              />
            </div>
          `
          : `
            <button
              class="binder-button binder-scene-button ${isCurrentScene ? "is-active" : ""} ${isDraggingScene ? "is-dragging" : ""}"
              type="button"
              data-action="select-scene"
              data-scene-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-id="${escapeHtml(scene.sceneId)}"
              data-scene-title-id="${escapeHtml(scene.sceneId)}"
              data-binder-scene-title-id="${escapeHtml(scene.sceneId)}"
              draggable="${canDragScene ? "true" : "false"}"
            >
              <span class="binder-kind">scene</span>
              <span data-binder-scene-title-id="${escapeHtml(scene.sceneId)}">${sceneDisplayTitle}</span>
            </button>
          `
      }
    </div>
  `;
}

// Intent: render the selected manuscript scene while scene-editing behavior is being extracted.
function renderManuscriptPanel() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  const editorMode = state.activePane === "narration" ? "narration" : "manuscript";
  const slot = document.querySelector("#manuscript-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.innerHTML = renderManuscriptPanelHTML({
    state,
    selectedScene,
    editorMode,
    grammarCheckSummary: buildGrammarCheckSummary(selectedScene),
    projectFileDisplay: getProjectFileDisplayState(),
    projectIndex: getActiveProjectRecord()?.projectIndex ?? null,
    buildEditorStyle,
    getInlinePassageDraftAnchor,
    formatChapterDisplayTitle,
  });
  renderGrammarCheckPanel();
}

// Intent: render diagnostics, passage notes, and task panels as IDE-like actionable consoles.
function renderConsolePanel() {
  const slot = document.querySelector("#console-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  slot.classList.toggle("is-collapsed", state.consoleDockCollapsed);
  appRoot.classList.toggle("is-console-dock-collapsed", state.consoleDockCollapsed);
  slot.innerHTML = `
    <div class="console-dock ${state.consoleDockCollapsed ? "is-collapsed" : ""}">
      <button
        class="console-dock-toggle"
        type="button"
        data-action="toggle-console-collapse"
        aria-expanded="${state.consoleDockCollapsed ? "false" : "true"}"
        aria-label="${state.consoleDockCollapsed ? "Open right console" : "Collapse right console"}"
        title="${state.consoleDockCollapsed ? "Open right console" : "Collapse right console"}"
      >
        <span aria-hidden="true">${state.consoleDockCollapsed ? "◀" : "▶"}</span>
        <strong>${state.consoleDockCollapsed ? "Open" : "Hide"}</strong>
      </button>
      <div class="console-dock-body">
        ${renderSidePanelTabs()}
        ${state.sidePanelMode === "issues"
          ? renderIssuePanelBody()
          : renderPassageNotePanel(state.sidePanelMode)}
      </div>
    </div>
  `;
}

// Intent: keep manuscript find/replace state isolated from the editor text model.
function renderManuscriptFindPanel() {
  const slot = document.querySelector("#find-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const findState = state.manuscriptFind ?? {};
  if (!findState.open) {
    slot.innerHTML = "";
    return;
  }

  const query = String(findState.query ?? "");
  const replaceText = String(findState.replaceText ?? "");
  const matches = query.trim() ? getManuscriptFindMatches(query) : [];
  const activeIndex = matches.length
    ? clampNumber(Number(findState.activeIndex ?? 0), 0, matches.length - 1)
    : 0;
  const focusedFindField =
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.closest("#find-slot")
      ? {
          field: document.activeElement.dataset.findField ?? "",
          selectionStart: document.activeElement.selectionStart,
          selectionEnd: document.activeElement.selectionEnd,
        }
      : null;

  if (state.manuscriptFind.activeIndex !== activeIndex) {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      activeIndex,
    };
  }

  const activeMatch = matches[activeIndex] ?? null;
  syncManuscriptFindSlotPosition(slot, findState.position);
  slot.innerHTML = renderManuscriptFindPanelHTML({
    query,
    replaceText,
    matches,
    activeIndex,
    activeMatch,
  });

  if (focusedFindField?.field) {
    const field = slot.querySelector(`[data-find-field="${CSS.escape(focusedFindField.field)}"]`);
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      if (Number.isInteger(focusedFindField.selectionStart) && Number.isInteger(focusedFindField.selectionEnd)) {
        field.setSelectionRange(focusedFindField.selectionStart, focusedFindField.selectionEnd);
      }
    }
  }
}

function syncManuscriptFindSlotPosition(slot, position) {
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const left = Number(position?.left);
  const top = Number(position?.top);
  if (Number.isFinite(left) && Number.isFinite(top)) {
    slot.style.left = `${Math.round(left)}px`;
    slot.style.top = `${Math.round(top)}px`;
    slot.style.transform = "none";
    return;
  }

  slot.style.removeProperty("left");
  slot.style.removeProperty("top");
  slot.style.removeProperty("transform");
}

function setManuscriptFindPosition(left, top) {
  state.manuscriptFind = {
    ...state.manuscriptFind,
    position: {
      left: Math.round(left),
      top: Math.round(top),
    },
  };

  const slot = document.querySelector("#find-slot");
  syncManuscriptFindSlotPosition(slot, state.manuscriptFind.position);
}

function clampManuscriptFindPosition(left, top, width, height) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, window.innerWidth - safeWidth - 12);
  const maxTop = Math.max(minTop, window.innerHeight - safeHeight - 12);

  return {
    left: Math.min(Math.max(minLeft, left), maxLeft),
    top: Math.min(Math.max(minTop, top), maxTop),
  };
}

function handleManuscriptFindPointerDown(event) {
  if (!state.manuscriptFind.open || event.button !== 0) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const dragHandle = target?.closest("[data-manuscript-find-drag-handle]");
  if (!(dragHandle instanceof HTMLElement)) {
    return;
  }

  const slot = dragHandle.closest("#find-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const rect = slot.getBoundingClientRect();
  manuscriptFindDragState = {
    pointerId: event.pointerId,
    slot,
    dragHandle,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  slot.classList.add("is-dragging");
  event.preventDefault();
  if (typeof dragHandle.setPointerCapture === "function") {
    try {
      dragHandle.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures; the document-level move/end handlers still work.
    }
  }
}

function handleManuscriptFindPointerMove(event) {
  if (!manuscriptFindDragState || event.pointerId !== manuscriptFindDragState.pointerId) {
    return;
  }

  const nextLeft = event.clientX - manuscriptFindDragState.offsetX;
  const nextTop = event.clientY - manuscriptFindDragState.offsetY;
  const clamped = clampManuscriptFindPosition(
    nextLeft,
    nextTop,
    manuscriptFindDragState.width,
    manuscriptFindDragState.height,
  );

  setManuscriptFindPosition(clamped.left, clamped.top);
  event.preventDefault();
}

function handleManuscriptFindPointerEnd(event) {
  if (!manuscriptFindDragState || event.pointerId !== manuscriptFindDragState.pointerId) {
    return;
  }

  const { slot, dragHandle, pointerId } = manuscriptFindDragState;
  slot.classList.remove("is-dragging");
  if (typeof dragHandle.releasePointerCapture === "function") {
    try {
      dragHandle.releasePointerCapture(pointerId);
    } catch {
      // Ignore release failures.
    }
  }

  manuscriptFindDragState = null;
}

function renderManuscriptFindPanelHTML({
  query,
  replaceText,
  matches,
  activeIndex,
  activeMatch,
}) {
  const hasQuery = Boolean(String(query ?? "").trim());
  const matchCount = matches.length;
  const canNavigate = hasQuery && matchCount > 0;
  const activeLabel = activeMatch
    ? `${activeMatch.chapterTitle || "Chapter"} · ${activeMatch.sceneTitle || "Scene"}`
    : "Search the manuscript";

  return `
    <section class="manuscript-find-panel ${hasQuery ? "has-query" : ""}" data-manuscript-find-panel>
      <button
        class="manuscript-find-panel__close"
        type="button"
        data-action="close-manuscript-find"
        aria-label="Close find window"
        title="Close find window"
      >×</button>
      <div class="manuscript-find-panel__dragbar">
        <div class="manuscript-find-panel__drag-handle" data-manuscript-find-drag-handle aria-label="Drag find window">
          <span>Find in manuscript</span>
          <strong>Drag to move</strong>
        </div>
      </div>
      <div class="manuscript-find-panel__header">
        <div class="manuscript-find-panel__fields">
          <label class="manuscript-find-field">
            <span>Find</span>
            <input
              type="search"
              value="${escapeHtml(query)}"
              data-find-field="manuscript-find-query"
              placeholder="Search the manuscript"
              aria-label="Find in manuscript"
            />
          </label>
          <label class="manuscript-find-field">
            <span>Replace</span>
            <input
              type="text"
              value="${escapeHtml(replaceText)}"
              data-find-field="manuscript-find-replace"
              placeholder="Replace with"
              aria-label="Replace in manuscript"
            />
          </label>
        </div>
        <div class="manuscript-find-panel__actions">
          <button class="tag-button editor-action-button" type="button" data-action="find-prev" ${canNavigate ? "" : "disabled"}>Prev</button>
          <button class="tag-button editor-action-button" type="button" data-action="find-next" ${canNavigate ? "" : "disabled"}>Next</button>
          <button class="tag-button editor-action-button" type="button" data-action="replace-find-current" ${canNavigate ? "" : "disabled"}>Replace</button>
          <button class="tag-button editor-action-button" type="button" data-action="replace-find-all" ${canNavigate ? "" : "disabled"}>Replace all</button>
        </div>
      </div>
      <div class="manuscript-find-panel__status">
        <strong>${escapeHtml(hasQuery ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "Find in manuscript")}</strong>
        <span>${escapeHtml(activeLabel)}</span>
      </div>
      <div class="manuscript-find-results" data-manuscript-find-results>
        ${hasQuery
          ? (matchCount
            ? matches.map((match, index) => renderManuscriptFindResult(match, index, index === activeIndex)).join("")
            : `<p class="manuscript-find-empty">No matches found.</p>`)
          : `<p class="manuscript-find-empty">Search the manuscript to jump between matches and replace them in place.</p>`}
      </div>
    </section>
  `;
}

function renderGrammarCheckPanel(options = {}) {
  const slot = document.querySelector("#grammar-check-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const grammarCheckState = state.grammarCheckPanel ?? {};
  if (!grammarCheckState.open) {
    slot.innerHTML = "";
    return;
  }

  const selectedScene = getSelectedScene() ?? state.scenes[0] ?? null;
  const selectedSceneTitle = selectedScene?.sceneTitle ? String(selectedScene.sceneTitle) : "Selected scene";
  const selectedSceneChapter = selectedScene?.chapterTitle
    ? formatChapterDisplayTitle(selectedScene.chapterTitle)
    : "Current chapter";
  const entries = buildGrammarCheckEntries(selectedScene, options);
  const previousList = slot.querySelector("[data-grammar-check-list]");
  const previousScrollTop = previousList instanceof HTMLElement ? previousList.scrollTop : 0;
  const previousScrollLeft = previousList instanceof HTMLElement ? previousList.scrollLeft : 0;
  const selectionAnchorIndex = Number.isInteger(grammarCheckState.selectionAnchorIndex)
    ? grammarCheckState.selectionAnchorIndex
    : null;
  const selectionSet = new Set(
    Array.isArray(grammarCheckState.selectedWords)
      ? grammarCheckState.selectedWords.map((word) => normalizeSpellcheckWord(word)).filter(Boolean)
      : [],
  );
  const selectedCount = entries.filter((entry) => selectionSet.has(entry.normalizedWord)).length;
  syncGrammarCheckSlotPosition(slot, grammarCheckState.position);
  slot.innerHTML = renderGrammarCheckPanelHTML({
    selectedSceneTitle,
    selectedSceneChapter,
    entries,
    selectedCount,
    selectionSet,
    selectionAnchorIndex,
  });

  const nextList = slot.querySelector("[data-grammar-check-list]");
  if (nextList instanceof HTMLElement) {
    nextList.scrollTop = previousScrollTop;
    nextList.scrollLeft = previousScrollLeft;
  }
}

function syncGrammarCheckSlotPosition(slot, position) {
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const left = Number(position?.left);
  const top = Number(position?.top);
  if (Number.isFinite(left) && Number.isFinite(top)) {
    slot.style.left = `${Math.round(left)}px`;
    slot.style.top = `${Math.round(top)}px`;
    slot.style.right = "auto";
    slot.style.transform = "none";
    return;
  }

  slot.style.removeProperty("left");
  slot.style.removeProperty("top");
  slot.style.removeProperty("right");
  slot.style.removeProperty("transform");
}

function setGrammarCheckPanelPosition(left, top) {
  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    position: {
      left: Math.round(left),
      top: Math.round(top),
    },
  };

  const slot = document.querySelector("#grammar-check-slot");
  syncGrammarCheckSlotPosition(slot, state.grammarCheckPanel.position);
}

function clampGrammarCheckPanelPosition(left, top, width, height) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, window.innerWidth - safeWidth - 12);
  const maxTop = Math.max(minTop, window.innerHeight - safeHeight - 12);

  return {
    left: Math.min(Math.max(minLeft, left), maxLeft),
    top: Math.min(Math.max(minTop, top), maxTop),
  };
}

function handleGrammarCheckPointerDown(event) {
  if (!state.grammarCheckPanel?.open || event.button !== 0) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  const dragHandle = target?.closest("[data-grammar-check-drag-handle]");
  if (!(dragHandle instanceof HTMLElement)) {
    return;
  }

  const slot = dragHandle.closest("#grammar-check-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const rect = slot.getBoundingClientRect();
  manuscriptGrammarDragState = {
    pointerId: event.pointerId,
    slot,
    dragHandle,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  };

  slot.classList.add("is-dragging");
  event.preventDefault();
  if (typeof dragHandle.setPointerCapture === "function") {
    try {
      dragHandle.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures; the document-level move/end handlers still work.
    }
  }
}

function handleGrammarCheckPointerMove(event) {
  if (!manuscriptGrammarDragState || event.pointerId !== manuscriptGrammarDragState.pointerId) {
    return;
  }

  const nextLeft = event.clientX - manuscriptGrammarDragState.offsetX;
  const nextTop = event.clientY - manuscriptGrammarDragState.offsetY;
  const clamped = clampGrammarCheckPanelPosition(
    nextLeft,
    nextTop,
    manuscriptGrammarDragState.width,
    manuscriptGrammarDragState.height,
  );

  setGrammarCheckPanelPosition(clamped.left, clamped.top);
  event.preventDefault();
}

function handleGrammarCheckPointerEnd(event) {
  if (!manuscriptGrammarDragState || event.pointerId !== manuscriptGrammarDragState.pointerId) {
    return;
  }

  const { slot, dragHandle, pointerId } = manuscriptGrammarDragState;
  slot.classList.remove("is-dragging");
  if (typeof dragHandle.releasePointerCapture === "function") {
    try {
      dragHandle.releasePointerCapture(pointerId);
    } catch {
      // Ignore release failures.
    }
  }

  manuscriptGrammarDragState = null;
}

function renderGrammarCheckPanelHTML({
  selectedSceneTitle,
  selectedSceneChapter,
  entries,
  selectedCount,
  selectionSet,
  selectionAnchorIndex,
}) {
  const totalCount = entries.reduce((total, entry) => total + Number(entry.count ?? 0), 0);
  const uniqueCount = entries.length;
  const addDisabled = selectedCount <= 0;
  const summaryLabel = totalCount
    ? `${totalCount} flagged word${totalCount === 1 ? "" : "s"} · ${uniqueCount} unique`
    : "No flagged words";

  return `
    <section class="manuscript-grammar-panel ${totalCount ? "has-entries" : ""}" data-grammar-check-panel>
      <button
        class="manuscript-grammar-panel__close"
        type="button"
        data-action="close-grammar-check-panel"
        aria-label="Close grammar check window"
        title="Close grammar check window"
      >×</button>
      <div class="manuscript-grammar-panel__dragbar">
        <div class="manuscript-grammar-panel__drag-handle" data-grammar-check-drag-handle aria-label="Drag grammar check window">
          <span>Grammar check</span>
          <strong>Drag to move</strong>
        </div>
      </div>
      <div class="manuscript-grammar-panel__header">
        <div class="manuscript-grammar-panel__titles">
          <p class="manuscript-grammar-panel__kicker">${escapeHtml(selectedSceneChapter)}</p>
          <h2>${escapeHtml(selectedSceneTitle)}</h2>
          <p class="manuscript-grammar-panel__summary">${escapeHtml(summaryLabel)}</p>
        </div>
        <div class="manuscript-grammar-panel__actions">
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-select-all" ${totalCount ? "" : "disabled"}>Select all</button>
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-clear-selection" ${selectedCount ? "" : "disabled"}>Clear</button>
        </div>
      </div>
      <div class="manuscript-grammar-panel__list" data-grammar-check-list>
        ${entries.length
          ? entries.map((entry, index) => {
              const isSelected = selectionSet.has(entry.normalizedWord);
              const isAnchor = selectionAnchorIndex === index;
              return `
                <div class="grammar-check-item ${isSelected ? "is-selected" : ""} ${isAnchor ? "is-anchor" : ""}" data-grammar-check-word="${escapeHtml(entry.normalizedWord)}" data-grammar-check-index="${index}" data-grammar-check-first-index="${escapeHtml(String(entry.firstIndex ?? 0))}">
                  <label class="grammar-check-item__toggle" data-action="toggle-grammar-check-word">
                    <input type="checkbox" ${isSelected ? "checked" : ""} aria-label="Select ${escapeHtml(entry.word)} for project dictionary" />
                  </label>
                  <button class="grammar-check-item__body" type="button" data-action="focus-grammar-check-word" title="Go to this word in the manuscript">
                    <strong class="grammar-check-item__word">${escapeHtml(entry.word)}</strong>
                    <span class="grammar-check-item__meta">${escapeHtml(`${entry.count} occurrence${entry.count === 1 ? "" : "s"}`)}</span>
                  </button>
                </div>
              `;
            }).join("")
          : `<p class="grammar-check-empty">No flagged words in this scene.</p>`}
      </div>
      <div class="manuscript-grammar-panel__footer">
        <span>${escapeHtml(selectedCount ? `${selectedCount} selected` : "Select words to add them to the project dictionary.")}</span>
        <div class="manuscript-grammar-panel__footer-actions">
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-add-selected" ${addDisabled ? "disabled" : ""}>Add selected to project dictionary</button>
        </div>
      </div>
    </section>
  `;
}

function buildGrammarCheckEntries(scene, options = {}) {
  if (!scene || !spellcheckBaseLexicon?.wordList?.length) {
    return [];
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const misspellings = groupSpellcheckMisspellings(scene.editorText ?? "", {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon,
    referenceLexicon: spellcheckReferenceLexicon,
  }, options);

  return misspellings
    .map((entry) => ({
      ...entry,
      word: String(entry.word ?? "").trim() || String(entry.normalizedWord ?? ""),
      normalizedWord: normalizeSpellcheckWord(entry.normalizedWord ?? entry.word),
      count: Number(entry.count ?? 0),
      firstIndex: Number(entry.firstIndex ?? 0),
      lastIndex: Number(entry.lastIndex ?? 0),
    }))
    .filter((entry) => entry.normalizedWord)
    .sort((left, right) => left.firstIndex - right.firstIndex || left.word.localeCompare(right.word));
}

function toggleGrammarCheckPanel() {
  const isOpen = state.grammarCheckPanel?.open === true;
  state.activePane = "manuscript";
  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    open: !isOpen,
    selectedWords: isOpen ? state.grammarCheckPanel.selectedWords ?? [] : state.grammarCheckPanel.selectedWords ?? [],
  };
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function closeGrammarCheckPanel() {
  if (!state.grammarCheckPanel?.open) {
    return;
  }

  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    open: false,
  };
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function updateGrammarCheckPanelSelection(nextSelectedWords, selectionAnchorIndex = null) {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null);
  const validWords = new Set(entries.map((entry) => entry.normalizedWord));
  const nextSelection = [];
  const seen = new Set();

  for (const word of Array.isArray(nextSelectedWords) ? nextSelectedWords : []) {
    const normalized = normalizeSpellcheckWord(word);
    if (!normalized || !validWords.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    nextSelection.push(normalized);
  }

  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    selectedWords: nextSelection,
    selectionAnchorIndex: Number.isInteger(selectionAnchorIndex) ? selectionAnchorIndex : null,
  };
  renderGrammarCheckPanel();
}

function toggleGrammarCheckPanelWordSelection(word, entryIndex = -1, isShiftKey = false) {
  const normalizedWord = normalizeSpellcheckWord(word);
  if (!normalizedWord) {
    return;
  }

  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null);
  const selectedIndex = Number.isInteger(entryIndex) ? entryIndex : entries.findIndex((entry) => entry.normalizedWord === normalizedWord);
  const selectedEntry = selectedIndex >= 0 ? entries[selectedIndex] : null;
  if (!selectedEntry || !entries.some((entry) => entry.normalizedWord === normalizedWord)) {
    return;
  }

  const currentSelection = new Set(
    Array.isArray(state.grammarCheckPanel?.selectedWords)
      ? state.grammarCheckPanel.selectedWords.map((entry) => normalizeSpellcheckWord(entry)).filter(Boolean)
      : [],
  );

  const anchorIndex = Number.isInteger(state.grammarCheckPanel?.selectionAnchorIndex)
    ? state.grammarCheckPanel.selectionAnchorIndex
    : null;

  if (isShiftKey && anchorIndex !== null) {
    const startIndex = Math.min(anchorIndex, selectedIndex);
    const endIndex = Math.max(anchorIndex, selectedIndex);
    for (let index = startIndex; index <= endIndex; index += 1) {
      const entry = entries[index];
      if (entry?.normalizedWord) {
        currentSelection.add(entry.normalizedWord);
      }
    }
    updateGrammarCheckPanelSelection([...currentSelection], anchorIndex);
    focusGrammarCheckEntry(selectedEntry);
    return;
  }

  if (currentSelection.has(normalizedWord)) {
    currentSelection.delete(normalizedWord);
  } else {
    currentSelection.add(normalizedWord);
  }

  updateGrammarCheckPanelSelection([...currentSelection], selectedIndex);
  focusGrammarCheckEntry(selectedEntry);
}

function selectAllGrammarCheckPanelWords() {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null);
  updateGrammarCheckPanelSelection(entries.map((entry) => entry.normalizedWord), null);
}

function clearGrammarCheckPanelSelection() {
  updateGrammarCheckPanelSelection([], null);
}

function syncGrammarCheckPanelHeaderState() {
  const heading = document.querySelector(".scene-editor-heading");
  if (!(heading instanceof HTMLElement)) {
    return;
  }

  const button = heading.querySelector(".grammar-check-status");
  const toggle = heading.querySelector(".grammar-check-toggle");
  const checkbox = heading.querySelector("[data-editor-pref='grammarCheckEnabled']");
  if (!(button instanceof HTMLButtonElement) || !(toggle instanceof HTMLElement)) {
    return;
  }

  const grammarCheckEnabled = state.editorPrefs.grammarCheckEnabled !== false;
  const grammarCheckPanelOpen = Boolean(state.grammarCheckPanel?.open);
  const selectedScene = getSelectedScene() ?? state.scenes[0] ?? null;
  const summary = grammarCheckEnabled
    ? (buildGrammarCheckSummary(selectedScene)?.label ?? "Grammar check")
    : "Live off";

  button.setAttribute("aria-pressed", grammarCheckPanelOpen ? "true" : "false");
  button.title = grammarCheckPanelOpen ? "Close grammar check list" : "Open grammar check list";
  const buttonLabel = button.querySelector("span");
  if (buttonLabel instanceof HTMLElement) {
    buttonLabel.textContent = summary;
  }

  if (checkbox instanceof HTMLInputElement) {
    checkbox.checked = grammarCheckEnabled;
  }

  const toggleLabel = toggle.querySelector("strong");
  if (toggleLabel instanceof HTMLElement) {
    toggleLabel.textContent = grammarCheckEnabled ? "On" : "Off";
  }
}

function addSelectedGrammarCheckWordsToProjectDictionary() {
  const selectedWords = Array.isArray(state.grammarCheckPanel?.selectedWords)
    ? state.grammarCheckPanel.selectedWords
    : [];
  if (!selectedWords.length) {
    return;
  }

  const editorBookmark = captureManuscriptEditorBookmark();
  const changed = addGrammarCheckWordsToProjectList("dictionaryWords", selectedWords);
  state.grammarCheckPanel = {
    ...state.grammarCheckPanel,
    selectedWords: [],
    selectionAnchorIndex: null,
  };

  if (changed) {
    renderManuscriptPanel();
    syncSceneDocumentLayout();
  } else {
    renderGrammarCheckPanel();
  }

  if (editorBookmark) {
    window.requestAnimationFrame(() => {
      restoreManuscriptEditorBookmark(editorBookmark);
    });
  }
}

function focusGrammarCheckEntry(entry) {
  if (!entry) {
    return;
  }

  const scene = getSelectedScene() ?? state.scenes[0] ?? null;
  const targetSceneId = String(scene?.sceneId ?? "");
  if (!targetSceneId) {
    return;
  }

  const startOffset = Number(entry.firstIndex);
  const endOffset = Number.isInteger(startOffset) ? startOffset + String(entry.word ?? "").length : NaN;
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    return;
  }

  takeToSceneRange(targetSceneId, startOffset, endOffset, { behavior: "smooth" });
}

function renderManuscriptFindResult(match, index, isActive) {
  return `
    <button
      class="manuscript-find-result ${isActive ? "is-active" : ""}"
      type="button"
      data-action="find-match"
      data-find-match-index="${index}"
      aria-current="${isActive ? "true" : "false"}"
    >
      <span class="manuscript-find-result__meta">${escapeHtml(match.chapterTitle || "Chapter")} · ${escapeHtml(match.sceneTitle || "Scene")}</span>
      <strong>${escapeHtml(match.matchText || "Match")}</strong>
      <p>${match.snippetHtml}</p>
    </button>
  `;
}

function getManuscriptFindMatches(query) {
  const needle = String(query ?? "").trim().toLocaleLowerCase();
  if (!needle) {
    return [];
  }

  const matches = [];

  for (const scene of state.scenes) {
    const sceneText = String(scene.editorText ?? "");
    const haystack = sceneText.toLocaleLowerCase();
    let searchFrom = 0;

    while (searchFrom <= haystack.length) {
      const startOffset = haystack.indexOf(needle, searchFrom);
      if (startOffset === -1) {
        break;
      }

      const endOffset = startOffset + needle.length;
      matches.push({
        sceneId: scene.sceneId,
        chapterTitle: scene.chapterTitle,
        sceneTitle: scene.sceneTitle,
        startOffset,
        endOffset,
        matchText: sceneText.slice(startOffset, endOffset),
        snippetHtml: buildManuscriptFindSnippetHtml(sceneText, startOffset, endOffset),
      });

      searchFrom = startOffset + Math.max(1, needle.length);
    }
  }

  return matches;
}

function buildManuscriptFindSnippetHtml(text, startOffset, endOffset) {
  const source = String(text ?? "");
  const snippetStart = Math.max(0, startOffset - 40);
  const snippetEnd = Math.min(source.length, endOffset + 40);
  const normalizeSnippet = (value) => escapeHtml(String(value ?? "")).replace(/\s+/g, " ");
  const before = normalizeSnippet(source.slice(snippetStart, startOffset));
  const match = normalizeSnippet(source.slice(startOffset, endOffset));
  const after = normalizeSnippet(source.slice(endOffset, snippetEnd));

  return `${before}<mark>${match}</mark>${after}`;
}

function openManuscriptFind() {
  const editorBookmark = captureManuscriptEditorBookmark();
  const selectionText = getCurrentManuscriptSelectionText();
  state.activePane = "manuscript";
  state.manuscriptFind = {
    ...state.manuscriptFind,
    open: true,
    query: selectionText || state.manuscriptFind.query,
    activeIndex: 0,
  };
  render();
  renderManuscriptFindPanel();
  window.requestAnimationFrame(() => {
    restoreManuscriptEditorBookmark(editorBookmark);
    const field = document.querySelector("[data-find-field='manuscript-find-query']");
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      field.select();
    }
  });
}

function closeManuscriptFind() {
  if (!state.manuscriptFind.open) {
    return;
  }

  state.manuscriptFind = {
    ...state.manuscriptFind,
    open: false,
  };
  renderManuscriptFindPanel();
  window.requestAnimationFrame(() => {
    const textarea = getEditorTextareaForScene(state.selectedSceneId);
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.focus({ preventScroll: true });
    }
  });
}

function captureManuscriptEditorBookmark() {
  const activeElement = document.activeElement;
  const textarea =
    activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
      ? activeElement
      : getEditorTextareaForScene(state.selectedSceneId);

  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const codeframe = textarea.closest(".scene-editor-codeframe");
  return {
    sceneId: String(textarea.dataset.sceneId ?? ""),
    selectionStart: Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0,
    selectionEnd: Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : Number.isInteger(textarea.selectionStart)
      ? textarea.selectionStart
      : 0,
    codeframeScrollTop: codeframe instanceof HTMLElement ? codeframe.scrollTop : 0,
    codeframeScrollLeft: codeframe instanceof HTMLElement ? codeframe.scrollLeft : 0,
  };
}

function restoreManuscriptEditorBookmark(bookmark) {
  if (!bookmark || typeof bookmark.sceneId !== "string" || !bookmark.sceneId.trim()) {
    return;
  }

  const textarea = getEditorTextareaForScene(bookmark.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const safeStart = clampEditorOffset(bookmark.selectionStart, textarea.value.length);
  const safeEnd = clampEditorOffset(bookmark.selectionEnd, textarea.value.length);
  const codeframe = textarea.closest(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.scrollTo({
      left: Math.max(0, Number(bookmark.codeframeScrollLeft) || 0),
      top: Math.max(0, Number(bookmark.codeframeScrollTop) || 0),
    });
  }

  textarea.setSelectionRange(Math.min(safeStart, safeEnd), Math.max(safeStart, safeEnd), "forward");
}

function updateManuscriptFindField(findField, value) {
  const normalizedField = String(findField ?? "").trim();
  if (!normalizedField) {
    return;
  }

  if (normalizedField === "manuscript-find-query") {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      query: String(value ?? ""),
      activeIndex: 0,
    };
  }

  if (normalizedField === "manuscript-find-replace") {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      replaceText: String(value ?? ""),
    };
  }

  renderManuscriptFindPanel();
}

function moveManuscriptFindMatch(delta) {
  const matches = getManuscriptFindMatches(state.manuscriptFind.query);
  if (!matches.length) {
    renderManuscriptFindPanel();
    return;
  }

  const currentIndex = clampNumber(Number(state.manuscriptFind.activeIndex ?? 0), 0, matches.length - 1);
  const nextIndex = (currentIndex + delta + matches.length) % matches.length;
  navigateManuscriptFindMatch(nextIndex);
}

function navigateManuscriptFindMatch(index) {
  const matches = getManuscriptFindMatches(state.manuscriptFind.query);
  if (!matches.length) {
    renderManuscriptFindPanel();
    return;
  }

  const nextIndex = clampNumber(Number(index ?? 0), 0, matches.length - 1);
  const match = matches[nextIndex];
  if (!match) {
    renderManuscriptFindPanel();
    return;
  }

  state.manuscriptFind = {
    ...state.manuscriptFind,
    open: true,
    activeIndex: nextIndex,
  };
  renderManuscriptFindPanel();
  takeToSceneRange(match.sceneId, match.startOffset, match.endOffset, {
    behavior: "smooth",
  });
}

function replaceManuscriptFindCurrent() {
  const query = String(state.manuscriptFind.query ?? "").trim();
  if (!query) {
    return;
  }

  const matches = getManuscriptFindMatches(query);
  if (!matches.length) {
    renderManuscriptFindPanel();
    return;
  }

  const activeIndex = clampNumber(Number(state.manuscriptFind.activeIndex ?? 0), 0, matches.length - 1);
  const match = matches[activeIndex];
  if (!match) {
    return;
  }

  const scene = getScene(match.sceneId);
  if (!scene) {
    return;
  }

  const sceneText = String(scene.editorText ?? "");
  const replacement = String(state.manuscriptFind.replaceText ?? "");
  const nextText = `${sceneText.slice(0, match.startOffset)}${replacement}${sceneText.slice(match.endOffset)}`;
  if (nextText === sceneText) {
    moveManuscriptFindMatch(1);
    return;
  }

  updateSceneDraft(match.sceneId, (draft) => {
    draft.editorText = nextText;
    draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, sceneText, nextText);
  }, {
    reason: "manuscript-find-replace",
    immediate: true,
  });
  const textarea = getEditorTextareaForScene(match.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = nextText;
  }
  syncRevisionPanel(match.sceneId);
  syncSceneDocumentLayout();
  renderManuscriptFindPanel();
  moveManuscriptFindMatch(1);
}

function replaceManuscriptFindAll() {
  const query = String(state.manuscriptFind.query ?? "").trim();
  if (!query) {
    return;
  }

  const matches = getManuscriptFindMatches(query);
  if (!matches.length) {
    renderManuscriptFindPanel();
    return;
  }

  const replacement = String(state.manuscriptFind.replaceText ?? "");
  const matchesByScene = new Map();
  for (const match of matches) {
    const sceneMatches = matchesByScene.get(match.sceneId) ?? [];
    sceneMatches.push(match);
    matchesByScene.set(match.sceneId, sceneMatches);
  }

  for (const scene of state.scenes) {
    const sceneMatches = matchesByScene.get(scene.sceneId);
    if (!sceneMatches?.length) {
      continue;
    }

    let nextText = String(scene.editorText ?? "");
    const sceneText = nextText;
    for (const match of [...sceneMatches].sort((left, right) => right.startOffset - left.startOffset)) {
      nextText = `${nextText.slice(0, match.startOffset)}${replacement}${nextText.slice(match.endOffset)}`;
    }

    if (nextText !== sceneText) {
      updateSceneDraft(scene.sceneId, (draft) => {
        draft.editorText = nextText;
        draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, sceneText, nextText);
      }, {
        reason: "manuscript-find-replace-all",
        immediate: true,
      });
      const textarea = getEditorTextareaForScene(scene.sceneId);
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.value = nextText;
      }
      syncRevisionPanel(scene.sceneId);
    }
  }

  syncSceneDocumentLayout();
  state.manuscriptFind = {
    ...state.manuscriptFind,
    activeIndex: 0,
  };
  renderManuscriptFindPanel();
}

function handleManuscriptFindWheel(event) {
  if (!state.manuscriptFind.open) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest("[data-manuscript-find-results]")) {
    return;
  }

  const matches = getManuscriptFindMatches(state.manuscriptFind.query);
  if (matches.length <= 1) {
    return;
  }

  event.preventDefault();
  moveManuscriptFindMatch(event.deltaY > 0 ? 1 : -1);
}

function getCurrentManuscriptSelectionText() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLTextAreaElement)) {
    return "";
  }

  if (!activeElement.classList.contains("editor-document-input")) {
    return "";
  }

  const startOffset = Number.isInteger(activeElement.selectionStart) ? activeElement.selectionStart : 0;
  const endOffset = Number.isInteger(activeElement.selectionEnd) ? activeElement.selectionEnd : startOffset;
  if (endOffset <= startOffset) {
    return "";
  }

  return activeElement.value.slice(startOffset, endOffset).trim();
}

// Intent: keep the scene-editor word-count readouts live while the user types or changes a text selection.
function syncSceneEditorWordCountReadouts(textarea = null) {
  const activeTextarea = textarea instanceof HTMLTextAreaElement
    ? textarea
    : document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null;
  if (!(activeTextarea instanceof HTMLTextAreaElement) || !activeTextarea.classList.contains("editor-document-input")) {
    return;
  }

  const sceneId = String(activeTextarea.dataset.sceneId ?? "");
  if (!sceneId) {
    return;
  }

  const activeProjectIndex = getActiveProjectRecord()?.projectIndex ?? null;
  const sceneShell = document.querySelector(`[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`);
  if (!(sceneShell instanceof HTMLElement)) {
    return;
  }

  const scene = getScene(sceneId);
  const liveSceneWordCount = countWords(String(activeTextarea.value ?? ""));
  const persistedSceneWordCount = getProjectIndexSceneWordCount(activeProjectIndex, sceneId);
  const chapterId = String(scene?.chapterId ?? "");
  const persistedChapterWordCount = getProjectIndexChapterWordCount(activeProjectIndex, chapterId);
  const sceneWordCount = liveSceneWordCount;
  const chapterWordCount = adjustChapterWordCountForLiveScene({
    activeProjectIndex,
    chapterId,
    persistedChapterWordCount,
    persistedSceneWordCount,
    liveSceneWordCount,
  });
  const selectionWordCount = getSceneEditorSelectionWordCount(activeTextarea);

  const sceneWordCountNode = sceneShell.querySelector("[data-scene-editor-scene-word-count]");
  if (sceneWordCountNode instanceof HTMLElement) {
    sceneWordCountNode.textContent = `Scene words: ${formatSceneEditorWordCount(sceneWordCount)}`;
  }

  const chapterWordCountNode = sceneShell.querySelector("[data-scene-editor-chapter-word-count]");
  if (chapterWordCountNode instanceof HTMLElement) {
    chapterWordCountNode.textContent = `Chapter words: ${formatSceneEditorWordCount(chapterWordCount)}`;
  }

  const selectionWordCountNode = sceneShell.querySelector("[data-scene-editor-selection-word-count]");
  if (selectionWordCountNode instanceof HTMLElement) {
    selectionWordCountNode.textContent = formatSceneEditorSelectionWordCount(selectionWordCount);
  }
}

function getProjectIndexSceneWordCount(projectIndex, sceneId) {
  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  const scene = scenes.find((candidate) => candidate?.id === sceneId);
  const wordCount = Number(scene?.wordCount);
  if (Number.isFinite(wordCount) && wordCount >= 0) {
    return Math.max(0, Math.round(wordCount));
  }

  return null;
}

function getProjectIndexChapterWordCount(projectIndex, chapterId) {
  const chapters = Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [];
  const chapter = chapters.find((candidate) => candidate?.id === chapterId);
  const wordCount = Number(chapter?.wordCount);
  if (Number.isFinite(wordCount) && wordCount >= 0) {
    return Math.max(0, Math.round(wordCount));
  }

  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  if (!chapterId) {
    return 0;
  }

  return scenes
    .filter((candidate) => candidate?.chapterId === chapterId)
    .reduce((total, candidate) => total + Math.max(0, Math.round(Number(candidate?.wordCount) || 0)), 0);
}

function adjustChapterWordCountForLiveScene({
  activeProjectIndex,
  chapterId,
  persistedChapterWordCount,
  persistedSceneWordCount,
  liveSceneWordCount,
}) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return Math.max(0, Math.round(Number(persistedChapterWordCount) || 0));
  }

  const baseCount = Number.isFinite(persistedChapterWordCount)
    ? Math.max(0, Math.round(persistedChapterWordCount))
    : getProjectIndexChapterWordCount(activeProjectIndex, chapterId);
  const sceneDelta = Math.max(0, Math.round(Number(liveSceneWordCount) || 0)) - Math.max(0, Math.round(Number(persistedSceneWordCount) || 0));
  return Math.max(0, baseCount + sceneDelta);
}

function getSceneEditorSelectionWordCount(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return 0;
  }

  const startOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const endOffset = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : startOffset;
  if (endOffset <= startOffset) {
    return 0;
  }

  return countWords(String(textarea.value ?? "").slice(startOffset, endOffset));
}

function renderSidePanelTabs() {
  const taskCount = getOpenManuscriptTasks().length;
  const inspirationCount = state.passageNotes.filter((note) => note.noteType === "inspiration").length;
  const researchCount = state.passageNotes.filter((note) => note.noteType === "research").length;
  return `
    <div class="side-panel-tabs" aria-label="Editor side panel modes">
      ${renderSidePanelTab("issues", "Tasks", taskCount)}
      ${renderSidePanelTab("inspiration", "Inspiration", inspirationCount)}
      ${renderSidePanelTab("research", "Research", researchCount)}
    </div>
  `;
}

function renderSidePanelTab(panelId, label, count) {
  const isActive = state.sidePanelMode === panelId;
  return `
    <button
      class="side-panel-tab ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-side-panel"
      data-side-panel="${escapeHtml(panelId)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(count))}</strong>
    </button>
  `;
}

function renderIssuePanelBody() {
  const workspace = state.workspace;
  const openTasks = getOpenManuscriptTasks();

  return `
    <div class="panel-heading">
      <p class="panel-kicker">Task Console</p>
    </div>
    ${renderTaskChapterList(openTasks)}
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Event Pinning</p>
      <h2>Major Story Beats</h2>
    </div>
    <div class="event-list">
      ${workspace.project.eventTags.map((eventTag) => renderEvent(eventTag)).join("")}
    </div>
  `;
}

function getOpenManuscriptTasks() {
  // Intent: use one task source for both the side-panel tab badge and the task console heading.
  return state.manuscriptTasks.filter((task) => task.status === "open");
}

function renderPassageNotePanel(noteType) {
  const notes = state.passageNotes.filter((note) => note.noteType === noteType);
  const label = noteType === "research" ? "Research" : "Inspiration";
  const noteGroups = groupConsoleItemsByChapter(notes);

  return `
    <div class="panel-heading">
      <p class="panel-kicker">${escapeHtml(label)}</p>
    </div>
    ${noteGroups.length ? `
      <div class="passage-note-list console-list console-chapter-list">
        ${noteGroups.map((group) => renderPassageNoteChapterGroup(noteType, group)).join("")}
      </div>
    ` : renderEmptyPassageNoteState(label)}
  `;
}

function renderEmptyPassageNoteState(label) {
  return `
    <div class="empty-note-state">
      <strong>No ${escapeHtml(label.toLowerCase())} bubbles yet.</strong>
      <span>Right-click in the editor, choose ${escapeHtml(label)}, then type into the inline bubble.</span>
    </div>
  `;
}

function renderPassageNoteItem(note) {
  const isSelected = state.selectedPassageNoteId === note.id;
  const isPreviewing = state.taskPreview?.taskId === note.id;
  const sourceLabel = formatImportSourceLabel(note.source);
  const deleteLabel = `Delete ${note.noteType === "research" ? "research" : "inspiration"} note`;
  const editLabel = `Edit ${note.noteType === "research" ? "research" : "inspiration"} note`;
  return `
    <div
      class="console-item passage-note-item ${isSelected ? "is-selected" : ""} ${isPreviewing ? "is-previewing" : ""}"
      data-action="select-passage-note"
      data-note-id="${escapeHtml(note.id)}"
      role="button"
      tabindex="0"
      aria-expanded="${isPreviewing ? "true" : "false"}"
    >
      <span class="console-meta">${escapeHtml(note.chapterTitle || "Imported source")} · ${escapeHtml(note.sceneTitle || "Scene")}${sourceLabel && note.source !== "manual" ? ` · ${escapeHtml(sourceLabel)}` : ""}</span>
      <input
        class="inline-title-input passage-note-title-input"
        type="text"
        value="${escapeHtml(note.title || "Inspiration note")}"
        data-title-input
        data-edit-field="passage-note-title"
        data-note-id="${escapeHtml(note.id)}"
        aria-label="${escapeHtml(note.noteType === "research" ? "Research title" : "Inspiration title")}"
      />
      <textarea
        class="passage-note-body-input"
        data-edit-field="passage-note-body"
        data-note-id="${escapeHtml(note.id)}"
        aria-label="${escapeHtml(note.noteType === "research" ? "Research note body" : "Inspiration note body")}"
        rows="3"
      >${escapeHtml(note.body || "")}</textarea>
      <div class="passage-note-actions">
        <button
          class="tag-button passage-note-icon-button passage-note-edit-button"
          type="button"
          data-action="edit-passage-note"
          data-note-id="${escapeHtml(note.id)}"
          aria-label="${escapeHtml(editLabel)}"
          title="Edit this note"
        >
          ${renderPassageNoteEditIcon()}
        </button>
        <button
          class="tag-button passage-note-icon-button passage-note-delete-button"
          type="button"
          data-action="delete-passage-note"
          data-note-id="${escapeHtml(note.id)}"
          aria-label="${escapeHtml(deleteLabel)}"
          title="Delete this note"
        >
          ${renderPassageNoteDeleteIcon()}
        </button>
      </div>
    </div>
  `;
}

function renderDeleteConfirmationDialog() {
  const slot = document.querySelector("#confirmation-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const dialog = state.deleteConfirmationDialog;
  if (!dialog) {
    slot.innerHTML = "";
    return;
  }

  const preferenceKey = dialog.preferenceKey === "comments" ? "comments" : "passageNotes";
  const skipConfirmation = Boolean(state.deleteConfirmationPreferences?.[preferenceKey]);
  slot.innerHTML = `
    <div class="delete-confirmation-backdrop" data-action="cancel-delete-confirmation" aria-hidden="true"></div>
    <section class="delete-confirmation-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(dialog.title)}">
      <header class="delete-confirmation-header">
        <strong>${escapeHtml(dialog.title)}</strong>
        <button
          class="delete-confirmation-close"
          type="button"
          data-action="cancel-delete-confirmation"
          aria-label="Close delete confirmation"
          title="Close"
        >×</button>
      </header>
      <p class="delete-confirmation-copy">${escapeHtml(dialog.message)}</p>
      <label class="delete-confirmation-checkbox">
        <input
          type="checkbox"
          data-action="toggle-delete-confirmation-preference"
          data-confirmation-key="${escapeHtml(preferenceKey)}"
          ${skipConfirmation ? "checked" : ""}
        />
        <span>Do not ask me again</span>
      </label>
      <div class="delete-confirmation-actions">
        <button
          class="tag-button delete-confirmation-cancel"
          type="button"
          data-action="cancel-delete-confirmation"
        >Cancel</button>
        <button
          class="tag-button delete-confirmation-confirm"
          type="button"
          data-action="confirm-delete-confirmation"
        >Delete</button>
      </div>
    </section>
  `;
}

function createDeleteConfirmationPreferences(candidate = {}) {
  return {
    passageNotes: Boolean(candidate?.passageNotes),
    comments: Boolean(candidate?.comments),
  };
}

function loadDeleteConfirmationPreferences() {
  return createDeleteConfirmationPreferences(readStoredJson(EDITOR_DELETE_CONFIRMATIONS_KEY));
}

function persistDeleteConfirmationPreferences() {
  writeStoredJsonRaw(
    EDITOR_DELETE_CONFIRMATIONS_KEY,
    createDeleteConfirmationPreferences(state.deleteConfirmationPreferences),
  );
}

function renderPassageNoteEditIcon() {
  return `
    <svg class="passage-note-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M10.8 2.4 13.6 5.2 5.7 13.1 2.2 13.8 2.9 10.3 10.8 2.4Z"></path>
      <path d="M9.4 3.8 12.2 6.6"></path>
    </svg>
  `;
}

function renderPassageNoteDeleteIcon() {
  return `
    <svg class="passage-note-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 4.5H12.5"></path>
      <path d="M6 4.5 6.3 3.4H9.7L10 4.5"></path>
      <path d="M5.5 4.5 6 12.2C6.1 12.9 6.6 13.5 7.3 13.5H8.7C9.4 13.5 9.9 12.9 10 12.2L10.5 4.5"></path>
      <path d="M7 7V11"></path>
      <path d="M9 7V11"></path>
    </svg>
  `;
}

function requestDeletePassageNoteFromPanel(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  const preferenceKey = "passageNotes";
  if (Boolean(state.deleteConfirmationPreferences?.[preferenceKey])) {
    return performPassageNoteDeletion(noteId);
  }

  state.deleteConfirmationDialog = {
    kind: "passage-note",
    noteId: note.id,
    preferenceKey,
    title: `Delete ${note.noteType === "research" ? "research" : "inspiration"} note?`,
    message: `Delete "${note.title || (note.noteType === "research" ? "Research note" : "Inspiration note")}"?\n\nThis removes the note from the side panel and clears any active preview.`,
  };
  renderDeleteConfirmationDialog();
  return true;
}

function confirmDeleteConfirmationDialog() {
  const dialog = state.deleteConfirmationDialog;
  if (!dialog) {
    return false;
  }

  if (Boolean(state.deleteConfirmationPreferences?.[dialog.preferenceKey])) {
    persistDeleteConfirmationPreferences();
  }

  state.deleteConfirmationDialog = null;
  renderDeleteConfirmationDialog();

  if (dialog.kind === "passage-note") {
    return performPassageNoteDeletion(dialog.noteId);
  }

  return false;
}

function cancelDeleteConfirmationDialog() {
  if (!state.deleteConfirmationDialog) {
    return false;
  }

  state.deleteConfirmationDialog = null;
  renderDeleteConfirmationDialog();
  return true;
}

function toggleDeleteConfirmationPreference(preferenceKey, checked) {
  const normalizedKey = preferenceKey === "comments" ? "comments" : "passageNotes";
  state.deleteConfirmationPreferences = {
    ...(state.deleteConfirmationPreferences ?? createDeleteConfirmationPreferences()),
    [normalizedKey]: Boolean(checked),
  };
  persistDeleteConfirmationPreferences();
}

function performPassageNoteDeletion(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  const wasSelected = state.selectedPassageNoteId === note.id;
  const wasPreviewing = state.taskPreview?.taskId === note.id;
  const viewport = captureSceneEditorViewport(note.sceneId);
  const sameSceneReplacementNote = state.passageNotes.find(
    (candidate) =>
      candidate.id !== note.id &&
      candidate.noteType === note.noteType &&
      candidate.sceneId === note.sceneId,
  ) ?? null;

  state.passageNotes = state.passageNotes.filter((candidate) => candidate.id !== note.id);
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);

  if (wasPreviewing) {
    clearTaskAnchorPreview({ restoreSelection: false });
  }

  if (sameSceneReplacementNote && wasSelected) {
    selectPassageNote(sameSceneReplacementNote.id);
    return true;
  }

  if (wasSelected) {
    state.selectedPassageNoteId = null;
  }

  renderConsolePanel();
  if (wasPreviewing || wasSelected) {
    window.requestAnimationFrame(() => {
      restoreSceneEditorViewport(note.sceneId, viewport);
    });
  }
  return true;
}

// Intent: reopen the inline passage-note bubble with an existing note already seeded.
function openPassageNoteEditorFromPanel(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return false;
  }

  state.inlinePassageDraft = {
    sceneId: note.sceneId,
    noteType: note.noteType,
    selectedText: String(note.selectedText ?? ""),
    startOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    endOffset: Number.isInteger(note.endOffset) ? note.endOffset : 0,
    anchorStartOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    seededSelection: true,
    typedStartOffset: Number.isInteger(note.startOffset) ? note.startOffset : 0,
    typedEndOffset: Number.isInteger(note.endOffset) ? note.endOffset : 0,
    body: String(note.body ?? ""),
    typedText: String(note.selectedText ?? ""),
    editingNoteId: note.id,
    x: 110,
    y: 40,
  };
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.taskContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
  if (state.selectedSceneId !== note.sceneId) {
    selectSceneById(note.sceneId);
  }
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const field = document.querySelector("[data-edit-field='inline-passage-note']");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });
  return true;
}

function formatImportSourceLabel(source) {
  if (typeof source !== "string" || !source.trim()) {
    return "";
  }

  if (source === "manual") {
    return "Manual";
  }

  if (source === "source-research") {
    return "Research";
  }

  if (source === "source-front-matter") {
    return "Front matter";
  }

  if (source === "source-comment") {
    return "Comment";
  }

  if (source === "source-comment-note") {
    return "Comment note";
  }

  if (source === "source-asset") {
    return "Asset";
  }

  if (source === "meta") {
    return "Project meta";
  }

  if (source === "trash") {
    return "Archive item";
  }

  if (source === "image") {
    return "Image";
  }

  if (source === "pdf") {
    return "PDF";
  }

  return source
    .replace(/^source-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderTaskChapterList(tasks) {
  if (!tasks.length) {
    return "";
  }

  const chapters = groupScenesByChapter(state.scenes)
    .map((chapter) => ({
      ...chapter,
      tasks: tasks.filter((task) => task.chapterId === chapter.chapterId),
    }))
    .filter((chapter) => chapter.tasks.length > 0);

  return `
    <div class="task-panel">
      <div class="task-panel-heading">
        <p class="selection-label">Tasks</p>
        <strong>${escapeHtml(String(tasks.length))}</strong>
      </div>
      <div class="task-chapter-list">
        ${chapters.map((chapter) => renderTaskChapterGroup(chapter)).join("")}
      </div>
    </div>
  `;
}

function renderTaskChapterGroup(chapter) {
  return renderCollapsibleChapterGroup({
    panelId: "issueTasks",
    chapterKey: chapter.chapterId,
    chapterTitle: chapter.chapterTitle,
    itemCount: chapter.tasks.length,
    groupClassName: "task-chapter-group",
    headingClassName: "task-chapter-heading",
    childrenClassName: "task-list",
    bodyHtml: chapter.tasks.map((task) => renderSceneTask(task)).join(""),
  });
}

function renderPassageNoteChapterGroup(noteType, group) {
  return renderCollapsibleChapterGroup({
    panelId: noteType,
    chapterKey: group.chapterKey,
    chapterTitle: group.chapterTitle,
    itemCount: group.items.length,
    groupClassName: "console-chapter-group passage-note-chapter-group",
    headingClassName: "console-chapter-heading",
    childrenClassName: "console-chapter-children",
    bodyHtml: group.items.map((note) => renderPassageNoteItem(note)).join(""),
  });
}

function renderCollapsibleChapterGroup({
  panelId,
  chapterKey,
  chapterTitle,
  itemCount,
  bodyHtml,
  groupClassName,
  headingClassName,
  childrenClassName,
}) {
  const normalizedPanelId = String(panelId ?? "").trim();
  const normalizedChapterKey = String(chapterKey ?? "").trim();
  if (!normalizedPanelId || !normalizedChapterKey) {
    return "";
  }

  const isCollapsed = isConsoleChapterCollapsed(normalizedPanelId, normalizedChapterKey);
  return `
    <section class="${escapeHtml(groupClassName)}${isCollapsed ? " is-collapsed" : ""}">
      <button
        class="${escapeHtml(headingClassName)}"
        type="button"
        data-action="toggle-console-chapter-collapse"
        data-console-panel="${escapeHtml(normalizedPanelId)}"
        data-chapter-key="${escapeHtml(normalizedChapterKey)}"
        aria-expanded="${isCollapsed ? "false" : "true"}"
      >
        <span class="console-chapter-disclosure" aria-hidden="true">${isCollapsed ? "▸" : "▾"}</span>
        <strong>${escapeHtml(formatChapterDisplayTitle(chapterTitle))}</strong>
        <span class="console-chapter-count">${escapeHtml(String(itemCount))}</span>
      </button>
      <div class="${escapeHtml(childrenClassName)}">
        ${bodyHtml}
      </div>
    </section>
  `;
}

function groupConsoleItemsByChapter(items) {
  const chapterOrder = groupScenesByChapter(state.scenes);
  const groupsByKey = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const chapterId = typeof item.chapterId === "string" && item.chapterId.trim()
      ? item.chapterId.trim()
      : "";
    const chapterKey = chapterId || createConsoleChapterKey(item.chapterTitle);
    if (!groupsByKey.has(chapterKey)) {
      groupsByKey.set(chapterKey, {
        chapterKey,
        chapterId: chapterId || chapterKey,
        chapterTitle: item.chapterTitle || "Unknown chapter",
        items: [],
      });
    }

    groupsByKey.get(chapterKey).items.push(item);
  }

  const orderedGroups = [];
  for (const chapter of chapterOrder) {
    const chapterKey = chapter.chapterId;
    const group = groupsByKey.get(chapterKey);
    if (group) {
      orderedGroups.push({
        ...group,
        chapterTitle: chapter.chapterTitle || group.chapterTitle,
      });
      groupsByKey.delete(chapterKey);
    }
  }

  for (const group of groupsByKey.values()) {
    orderedGroups.push(group);
  }

  return orderedGroups;
}

function createConsoleChapterKey(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return normalized ? `chapter-${normalized}` : "chapter-unknown";
}

function isConsoleChapterCollapsed(panelId, chapterKey) {
  const collapsed = state.collapsedConsoleChapterIds?.[panelId];
  return Array.isArray(collapsed) && collapsed.includes(chapterKey);
}

function renderSceneTask(task) {
  const isSelected = state.selectedTaskId === task.id;
  const isPreviewing = state.taskPreview?.taskId === task.id;
  const sourceLabel = formatImportSourceLabel(task.source);
  const taskNumberLabel = String(task.taskNumber || 1).padStart(2, "0");
  return `
    <div class="task-item ${isSelected ? "is-selected" : ""} ${isPreviewing ? "is-previewing" : ""}" data-task-preview-id="${escapeHtml(task.id)}" tabindex="0">
      <button
        class="task-thumb"
        type="button"
        tabindex="-1"
        data-action="toggle-task-preview"
        data-task-preview-trigger
        data-task-preview-task-id="${escapeHtml(task.id)}"
        aria-pressed="${isPreviewing ? "true" : "false"}"
        aria-label="${escapeHtml(`Preview ${task.title || task.sceneTitle || "task"}`)}"
        title="${escapeHtml(isPreviewing ? "Click to collapse the task text" : "Hover or click to preview the task text")}"
      >
        <span class="task-thumb-label" aria-hidden="true">${escapeHtml(taskNumberLabel)}</span>
      </button>
      <div class="task-copy">
        ${sourceLabel && task.source !== "manual" ? `<span class="console-meta task-source">${escapeHtml(sourceLabel)}</span>` : ""}
        <input
          class="inline-title-input task-title-input"
          type="text"
          value="${escapeHtml(task.title || `${task.sceneTitle || "Scene"} task ${task.taskNumber || 1}`)}"
          data-title-input
          data-edit-field="task-title"
          data-task-id="${escapeHtml(task.id)}"
          aria-label="Task title"
        />
        <span class="task-body">${escapeHtml(task.body || task.description || "No task body")}</span>
        ${isSelected ? `<em class="task-reference">Reference: ${escapeHtml(task.selectedText)}</em>` : ""}
      </div>
      <button class="tag-button task-complete-button" data-action="complete-task" data-task-id="${escapeHtml(task.id)}">Done</button>
    </div>
  `;
}

function renderEvent(eventTag) {
  const isSelectedLine = eventTag.blockId === state.selectedBlockId;
  return `
    <button class="console-item event-item ${isSelectedLine ? "is-selected" : ""}" data-action="select-event" data-event-id="${escapeHtml(eventTag.id)}">
      <span class="console-meta">${escapeHtml(eventTag.kind)} · scene line ${eventTag.sceneLineNumber}</span>
      <strong>${escapeHtml(eventTag.label)}</strong>
      <span>${escapeHtml(eventTag.evidenceExcerpt)}</span>
    </button>
  `;
}

function formatChapterNumberLabel(chapterNumber) {
  const normalizedNumber = Number.isInteger(chapterNumber) && chapterNumber > 0 ? chapterNumber : 1;
  return `Chapter ${normalizedNumber}`;
}

function formatChapterDisplayTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  if (!value) {
    return "Untitled chapter";
  }

  const stripped = value.replace(/^(?:new\s+)?chapter\s+\d+\s*[:\-–—]?\s*/i, "").trim();
  return stripped || "Untitled chapter";
}

// Intent: render structured world spine data as timelines and linked nodes, not loose notes.
function renderWorldPanel() {
  const workspace = state.workspace;
  document.querySelector("#world-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">World Spine View</p>
      <h2>${escapeHtml(workspace.world.title)}</h2>
    </div>
    <div class="spine-stack">
      ${workspace.world.spines.map((spine) => renderSpine(spine)).join("")}
    </div>
    <div class="edge-list">
      <h3>Cross-Spine Links</h3>
      ${workspace.world.edges.map((edge) => renderEdge(edge)).join("")}
    </div>
  `;
}

function renderSpine(spine) {
  return `
    <section class="spine-lane">
      <div class="spine-header">
        <div>
          <p class="selection-label">${escapeHtml(spine.kind)}</p>
          <h3>${escapeHtml(spine.label)}</h3>
        </div>
        <p>${escapeHtml(spine.description)}</p>
      </div>
      <div class="spine-track">
        ${spine.nodes.map((node) => renderNode(node)).join("")}
      </div>
    </section>
  `;
}

function renderNode(node) {
  const isSelected = node.id === state.selectedNodeId;
  return `
    <button class="node-card ${isSelected ? "is-selected" : ""}" data-action="select-node" data-node-id="${escapeHtml(node.id)}">
      <span class="node-order">0${node.order}</span>
      <strong>${escapeHtml(node.label)}</strong>
      <span>${escapeHtml(node.summary)}</span>
      <span class="node-meta">${escapeHtml(node.lineNumbers.length ? `Lines ${node.lineNumbers.join(", ")}` : "World-only")}</span>
    </button>
  `;
}

function renderEdge(edge) {
  const isRelated = edge.fromNodeId === state.selectedNodeId || edge.toNodeId === state.selectedNodeId;
  return `
    <div class="edge-card ${isRelated ? "is-related" : ""}">
      <span class="console-meta">${escapeHtml(edge.kind)}</span>
      <strong>${escapeHtml(edge.label ?? `${edge.fromNodeLabel} -> ${edge.toNodeLabel}`)}</strong>
      <span>${escapeHtml(edge.fromSpineLabel)} / ${escapeHtml(edge.fromNodeLabel)}</span>
      <span>${escapeHtml(edge.toSpineLabel)} / ${escapeHtml(edge.toNodeLabel)}</span>
    </div>
  `;
}

function renderEntityPanel() {
  const workspace = state.workspace;
  const selectedNode = getNode(state.selectedNodeId);
  const selectedEntity = getEntity(state.selectedEntityId);
  const nodeEdges = selectedNode
    ? workspace.world.edges.filter(
        (edge) => edge.fromNodeId === selectedNode.id || edge.toNodeId === selectedNode.id,
      )
    : [];
  const templateRecords = [...workspace.world.templates, ...state.templateDrafts];
  const worldSuggestions = workspace.analysis.suggestionQueue.filter(
    (suggestion) => suggestion.suggestionType !== "dream-scaping",
  );

  document.querySelector("#entity-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">World Inspector</p>
      <h2>Entities and Links</h2>
    </div>
    ${selectedNode ? renderNodeFocus(selectedNode, nodeEdges) : ""}
    ${selectedEntity ? renderEntityFocus(selectedEntity) : ""}
    <div class="panel-heading split-heading">
      <p class="panel-kicker">World Templates</p>
      <h2>Template Library</h2>
    </div>
    <div class="panel-actions">
      <button class="tag-button panel-action-button" data-action="add-template">New template</button>
    </div>
    <div class="template-list">
      ${templateRecords.map((template) => renderTemplateCard(template)).join("")}
    </div>
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Review Queue</p>
      <h2>World Suggestions</h2>
    </div>
    <div class="suggestion-list">
      ${worldSuggestions.map((suggestion) => renderSuggestion(suggestion)).join("")}
    </div>
    <div class="panel-heading split-heading">
      <p class="panel-kicker">World Entities</p>
      <h2>Tracked Records</h2>
    </div>
    <div class="entity-list">
      ${workspace.world.entities.map((entity) => renderEntity(entity)).join("")}
    </div>
  `;
}

function renderNodeFocus(node, edges) {
  return `
    <div class="focus-card">
      <p class="selection-label">Selected Timeline Node</p>
      <h3>${escapeHtml(node.label)}</h3>
      <p>${escapeHtml(node.summary)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(node.linkedEntityNames.join(", ") || "No linked entities")}</span>
        <span>${escapeHtml(node.lineNumbers.length ? `Lines ${node.lineNumbers.join(", ")}` : "World-only")}</span>
      </div>
      ${edges.length ? `<div class="focus-links">${edges.map((edge) => `<span>${escapeHtml(edge.kind)}: ${escapeHtml(edge.label ?? edge.id)}</span>`).join("")}</div>` : ""}
    </div>
  `;
}

function renderEntity(entity) {
  const isSelected = entity.id === state.selectedEntityId;
  return `
    <button class="entity-card ${isSelected ? "is-selected" : ""}" data-action="select-entity" data-entity-id="${escapeHtml(entity.id)}">
      <span class="console-meta">${escapeHtml(entity.templateName)}</span>
      <strong>${escapeHtml(entity.name)}</strong>
      <span>${escapeHtml(entity.notes)}</span>
    </button>
  `;
}

function renderEntityFocus(entity) {
  return `
    <div class="focus-card entity-focus">
      <p class="selection-label">Selected Entity</p>
      <h3>${escapeHtml(entity.name)}</h3>
      <p>${escapeHtml(entity.notes)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(entity.templateName)}</span>
        <span>${escapeHtml(entity.introductionLineNumber ? `Introduced on line ${entity.introductionLineNumber}` : "No introduction anchor")}</span>
      </div>
      <div class="field-grid">
        ${entity.fields.map((field) => `<div class="field-card"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`).join("")}
      </div>
    </div>
  `;
}

function renderTemplateCard(template) {
  return `
    <div class="template-card ${template.isDraft ? "is-draft" : ""}">
      <span class="console-meta">${escapeHtml(template.key ?? "template")}</span>
      <strong>${escapeHtml(template.name)}</strong>
      <span>${escapeHtml(template.description ?? "Describe this world template.")}</span>
      <span>${escapeHtml(`${template.fieldCount ?? 0} fields`)}</span>
    </div>
  `;
}

function renderDreamScapingPanel() {
  const workspace = state.workspace;
  const dream = workspace.analysis.dreamScaping;
  const suggestions = dream
    ? workspace.analysis.suggestionQueue.filter((suggestion) =>
        dream.suggestionIds.includes(suggestion.id),
      )
    : [];

  document.querySelector("#dream-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Dream Scaping</p>
      <h2>Story-Fit Ideation</h2>
    </div>
    ${dream ? `
      <div class="focus-card">
        <p class="selection-label">Submitted Idea</p>
        <h3>${escapeHtml(dream.ideaTitle)}</h3>
        <p>${escapeHtml(dream.ideaText)}</p>
      </div>
    ` : ""}
    <div class="suggestion-list">
      ${suggestions.map((suggestion) => renderDreamSuggestion(suggestion)).join("")}
    </div>
  `;
}

function renderDreamSuggestion(suggestion) {
  return `
    <div class="suggestion-card dream-suggestion">
      <span class="console-meta">${escapeHtml(suggestion.suggestionType)} · ${escapeHtml(suggestion.reviewState)}</span>
      <strong>${escapeHtml(suggestion.title)}</strong>
      <p>${escapeHtml(suggestion.rationale)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(suggestion.fit ?? "story fit")}</span>
        <span>${escapeHtml(suggestion.placementLabel ?? "placement pending")}</span>
      </div>
      <div class="focus-links">
        <span>${escapeHtml(suggestion.revisionPrompt ?? "")}</span>
      </div>
      <div class="suggestion-actions">
        ${suggestion.evidence.map((evidence) => `
          <button class="tag-button tag-event" data-action="select-line" data-line-id="${escapeHtml(evidence.blockId)}">
            Open scene line ${escapeHtml(String(evidence.sceneLineNumber))}
          </button>
        `).join("")}
        ${suggestion.nodeId ? `
          <button class="tag-button tag-issue" data-action="select-node" data-node-id="${escapeHtml(suggestion.nodeId)}">
            Open node
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderSuggestion(suggestion) {
  return `
    <div class="suggestion-card">
      <span class="console-meta">${escapeHtml(suggestion.suggestionType)} · ${escapeHtml(suggestion.reviewState)}</span>
      <strong>${escapeHtml(suggestion.title)}</strong>
      <p>${escapeHtml(suggestion.rationale)}</p>
      <div class="focus-links">
        ${suggestion.detailLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      </div>
      <div class="suggestion-actions">
        ${suggestion.evidence.map((evidence) => `
          <button class="tag-button tag-event" data-action="select-line" data-line-id="${escapeHtml(evidence.blockId)}">
            Open scene line ${escapeHtml(String(evidence.sceneLineNumber))}
          </button>
        `).join("")}
        ${suggestion.nodeId ? `
          <button class="tag-button tag-issue" data-action="select-node" data-node-id="${escapeHtml(suggestion.nodeId)}">
            Open node
          </button>
        ` : ""}
        ${suggestion.entityId ? `
          <button class="tag-button tag-issue" data-action="select-entity" data-entity-id="${escapeHtml(suggestion.entityId)}">
            Open entity
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

// Intent: keep narration take state tied to project and manuscript anchors for later voice-service extraction.
function getVoiceRecordingsForProject(projectId = state.activeProjectId ?? state.workspace?.project?.id ?? "") {
  const recordings = Array.isArray(state.workspace?.voice?.recordings)
    ? state.workspace.voice.recordings
    : [];
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  if (!normalizedProjectId) {
    return recordings;
  }

  return recordings.filter((recording) => recording.projectId === normalizedProjectId);
}

function getVoiceRecordingById(recordingId) {
  if (typeof recordingId !== "string" || !recordingId.trim()) {
    return null;
  }

  return getVoiceRecordingsForProject().find((recording) => recording.id === recordingId) ?? null;
}

function getNarrationTakeSelectionForScene(sceneId) {
  if (state.narrationTakeSelection?.sceneId === sceneId) {
    return state.narrationTakeSelection;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const selectedBlockId = state.selectedBlockId && scene.blocks.some((block) => block.blockId === state.selectedBlockId)
    ? state.selectedBlockId
    : scene.blocks[0]?.blockId ?? null;
  const block = selectedBlockId ? scene.blocks.find((candidate) => candidate.blockId === selectedBlockId) ?? null : null;

  if (!block) {
    return null;
  }

  const ranges = getSceneBlockRanges(scene);
  const blockRange = ranges.find((candidate) => candidate.blockId === block.blockId) ?? null;
  return buildNarrationTakeSelection(scene, block, blockRange ?? null, null, blockRange?.startOffset ?? 0, blockRange?.endOffset ?? block.text.length, block.text);
}

function updateNarrationTakeSelectionFromTextarea(textarea, inlinePosition = null) {
  if (state.narrationTakeSession?.status === "recording") {
    return state.narrationTakeSelection;
  }

  const selection = resolveNarrationTakeSelectionFromTextarea(textarea, inlinePosition);
  if (!selection) {
    return null;
  }

  const currentSelectionKey = state.narrationTakeSelection
    ? `${state.narrationTakeSelection.sceneId}:${state.narrationTakeSelection.blockId}:${state.narrationTakeSelection.startOffset}:${state.narrationTakeSelection.endOffset}:${state.narrationTakeSelection.selectedText}`
    : "";
  const nextSelectionKey = `${selection.sceneId}:${selection.blockId}:${selection.startOffset}:${selection.endOffset}:${selection.selectedText}`;

  state.narrationTakeSelection = selection;
  syncSelectionFromBlock(selection.blockId);

  if (currentSelectionKey !== nextSelectionKey) {
    renderManuscriptPanel();
  }

  return selection;
}

function clearNarrationTakeSelection() {
  state.narrationTakeSelection = null;
  renderManuscriptPanel();
}

function setNarrationTakeSession(session) {
  state.narrationTakeSession = session;
  renderManuscriptPanel();
}

function resolveNarrationTakeSelectionFromTextarea(textarea, inlinePosition = null) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const sceneId = typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId : "";
  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const contextRange = getEditorContextRange(textarea);
  const caretOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const anchorOffset = contextRange?.hasExplicitSelection
    ? contextRange.startOffset
    : caretOffset;
  const block = findSceneBlockAtOffset(scene, anchorOffset) ?? scene.blocks[0] ?? null;

  if (!block) {
    return null;
  }

  const blockRange = getSceneBlockRanges(scene).find((candidate) => candidate.blockId === block.blockId) ?? null;
  const selectedText = contextRange?.selectedText?.trim()
    || block.text.trim()
    || "";
  const startOffset = contextRange?.hasExplicitSelection
    ? contextRange.startOffset
    : blockRange?.startOffset ?? 0;
  const endOffset = contextRange?.hasExplicitSelection
    ? contextRange.endOffset
    : blockRange?.endOffset ?? selectedText.length;

  return buildNarrationTakeSelection(
    scene,
    block,
    blockRange,
    inlinePosition,
    startOffset,
    endOffset,
    selectedText,
  );
}

function buildNarrationTakeSelection(scene, block, blockRange, inlinePosition = null, startOffset = null, endOffset = null, selectedText = null) {
  if (!scene || !block) {
    return null;
  }

  const resolvedStartOffset = Number.isInteger(startOffset)
    ? startOffset
    : Number.isInteger(blockRange?.startOffset)
      ? blockRange.startOffset
      : 0;
  const resolvedEndOffset = Number.isInteger(endOffset)
    ? endOffset
    : Number.isInteger(blockRange?.endOffset)
      ? blockRange.endOffset
      : Math.max(resolvedStartOffset, block.text.length);
  const resolvedSelectedText = String(selectedText ?? block.text ?? "").trim();

  return {
    id: `${scene.sceneId}:${block.blockId}:${resolvedStartOffset}:${resolvedEndOffset}`,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    chapterId: scene.chapterId,
    chapterTitle: scene.chapterTitle,
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle,
    blockId: block.blockId,
    paragraphId: block.paragraphId,
    lineNumber: block.lineNumber ?? 0,
    kind: block.kind,
    kindLabel: block.kind === "dialogue" ? "Dialogue" : "Narration",
    selectedText: resolvedSelectedText,
    startOffset: resolvedStartOffset,
    endOffset: resolvedEndOffset,
    blockStartOffset: blockRange?.startOffset ?? resolvedStartOffset,
    blockEndOffset: blockRange?.endOffset ?? resolvedEndOffset,
    caretOffset: resolvedStartOffset,
    inlinePosition,
    verseText: resolvedSelectedText,
  };
}

function getSceneBlockRanges(scene) {
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < scene.blocks.length; index += 1) {
    const block = scene.blocks[index];
    const text = String(block.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      ...block,
      text,
      startOffset,
      endOffset,
    });
    offset = endOffset + (index < scene.blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

function findSceneBlockAtOffset(scene, offset) {
  if (!scene || !Array.isArray(scene.blocks) || !scene.blocks.length) {
    return null;
  }

  const ranges = getSceneBlockRanges(scene);
  const normalizedOffset = Math.max(0, Math.min(Number(offset) || 0, String(scene.editorText ?? "").length));
  const directMatch = ranges.find((range) => normalizedOffset >= range.startOffset && normalizedOffset <= range.endOffset);
  if (directMatch) {
    return directMatch;
  }

  let priorMatch = ranges[0];
  for (const range of ranges) {
    if (range.startOffset <= normalizedOffset) {
      priorMatch = range;
    } else {
      break;
    }
  }

  return priorMatch;
}

function createNarrationRecordingId(selection) {
  const sceneSegment = sanitizeFileNameSegment(selection?.sceneId ?? selection?.sceneTitle ?? "scene");
  const blockSegment = sanitizeFileNameSegment(selection?.blockId ?? `line-${selection?.lineNumber ?? "0"}`);
  return `take-${Date.now().toString(36)}-${sceneSegment}-${blockSegment}`;
}

function buildVoiceRecordingMediaPath(projectId, recordingId, mediaMimeType) {
  const safeProjectId = sanitizeFileNameSegment(projectId || "project");
  const mediaName = getVoiceRecordingMediaName(recordingId, mediaMimeType);
  return `project-media/${safeProjectId}/${mediaName}`;
}

function getVoiceRecordingMediaName(recordingId, mediaMimeType) {
  return `${sanitizeFileNameSegment(recordingId || "voice-take")}.${getVoiceRecordingExtension(mediaMimeType)}`;
}

function getVoiceRecordingExtension(mediaMimeType) {
  const normalizedMimeType = normalizeNarrationRecordingMimeType(mediaMimeType);
  if (normalizedMimeType.includes("ogg")) {
    return "ogg";
  }

  if (normalizedMimeType.includes("wav")) {
    return "wav";
  }

  if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("m4a")) {
    return "m4a";
  }

  return "webm";
}

function getSupportedNarrationRecordingMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return NARRATION_RECORDING_DEFAULT_MIME_TYPE;
}

function normalizeNarrationRecordingMimeType(candidate) {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "";
}

function sanitizeFileNameSegment(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .slice(0, 96) || "segment";
}

function normalizeNarrationTakeTranscript(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function normalizeNarrationTakeStatusText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function formatNarrationRecordingElapsedLabel(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const secondsLabel = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${minutes}:${secondsLabel}`;
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return window.btoa(binary);
}

function base64ToBlob(contentBase64, mediaMimeType) {
  const normalizedContent = typeof contentBase64 === "string" ? contentBase64.trim() : "";
  if (!normalizedContent) {
    return null;
  }

  const binary = window.atob(normalizedContent);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: normalizeNarrationRecordingMimeType(mediaMimeType) || NARRATION_RECORDING_DEFAULT_MIME_TYPE,
  });
}

function createNarrationTakeSession(selection, options = {}) {
  const startedAtMs = Number.isFinite(Number(options.startedAtMs))
    ? Number(options.startedAtMs)
    : Date.now();

  return {
    status: options.status === "recording" ? "recording" : "paused",
    trackerStatus: normalizeNarrationTakeStatusText(options.trackerStatus) || "Speech tracker idle",
    transcript: typeof options.transcript === "string" ? options.transcript : "",
    elapsedLabel: typeof options.elapsedLabel === "string" ? options.elapsedLabel : "0:00",
    recordingId: typeof options.recordingId === "string" ? options.recordingId : null,
    mediaPath: typeof options.mediaPath === "string" ? options.mediaPath : null,
    startedAt: new Date(startedAtMs).toISOString(),
    sceneId: selection?.sceneId ?? normalizeNarrationTakeStatusText(options.sceneId) ?? "",
    sceneTitle: selection?.sceneTitle ?? normalizeNarrationTakeStatusText(options.sceneTitle) ?? "",
    chapterId: selection?.chapterId ?? normalizeNarrationTakeStatusText(options.chapterId) ?? "",
    chapterTitle: selection?.chapterTitle ?? normalizeNarrationTakeStatusText(options.chapterTitle) ?? "",
    blockId: selection?.blockId ?? normalizeNarrationTakeStatusText(options.blockId) ?? "",
    selection: selection ? cloneValue(selection) : null,
  };
}

function updateNarrationTakeSessionFromRuntime(overrides = {}) {
  if (!narrationRecordingRuntime) {
    return;
  }

  const elapsedLabel = formatNarrationRecordingElapsedLabel(
    Date.now() - narrationRecordingRuntime.startedAtMs,
  );
  setNarrationTakeSession(createNarrationTakeSession(narrationRecordingRuntime.selection, {
    status: overrides.status ?? "recording",
    trackerStatus: overrides.trackerStatus ?? narrationRecordingRuntime.trackerStatus,
    transcript: overrides.transcript ?? narrationRecordingRuntime.transcript,
    elapsedLabel: overrides.elapsedLabel ?? elapsedLabel,
    recordingId: overrides.recordingId ?? narrationRecordingRuntime.recordingId,
    mediaPath: overrides.mediaPath ?? narrationRecordingRuntime.mediaPath,
    startedAtMs: overrides.startedAtMs ?? narrationRecordingRuntime.startedAtMs,
    sceneId: overrides.sceneId ?? narrationRecordingRuntime.selection?.sceneId,
    sceneTitle: overrides.sceneTitle ?? narrationRecordingRuntime.selection?.sceneTitle,
    chapterId: overrides.chapterId ?? narrationRecordingRuntime.selection?.chapterId,
    chapterTitle: overrides.chapterTitle ?? narrationRecordingRuntime.selection?.chapterTitle,
    blockId: overrides.blockId ?? narrationRecordingRuntime.selection?.blockId,
  }));
}

function refreshNarrationRecordingSession() {
  if (!narrationRecordingRuntime || state.narrationTakeSession?.status !== "recording") {
    return;
  }

  const elapsedLabel = formatNarrationRecordingElapsedLabel(
    Date.now() - narrationRecordingRuntime.startedAtMs,
  );
  if (state.narrationTakeSession.elapsedLabel === elapsedLabel) {
    return;
  }

  updateNarrationTakeSessionFromRuntime({ elapsedLabel });
}

async function startNarrationRecording(sceneId = state.selectedSceneId) {
  if (narrationRecordingRuntime) {
    return;
  }

  const scene = sceneId ? getScene(sceneId) : getSelectedScene() ?? state.scenes[0] ?? null;
  const selection = scene ? getNarrationTakeSelectionForScene(scene.sceneId) : null;
  if (!scene || !selection) {
    setNarrationTakeSession(createNarrationTakeSession(selection, {
      status: "paused",
      trackerStatus: "Select a verse before starting a narration take.",
    }));
    return;
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setNarrationTakeSession(createNarrationTakeSession(selection, {
      status: "paused",
      trackerStatus: "Microphone capture is not available in this browser.",
    }));
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    setNarrationTakeSession(createNarrationTakeSession(selection, {
      status: "paused",
      trackerStatus: "MediaRecorder is not available in this browser.",
    }));
    return;
  }

  const projectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
  const recordingId = createNarrationRecordingId(selection);
  const mediaMimeType = getSupportedNarrationRecordingMimeType();
  const mediaPath = buildVoiceRecordingMediaPath(projectId, recordingId, mediaMimeType);
  const startedAtMs = Date.now();
  narrationRecordingRuntime = {
    recordingId,
    projectId,
    selection: cloneValue(selection),
    startedAtMs,
    chunks: [],
    mediaMimeType,
    mediaPath,
    stream: null,
    mediaRecorder: null,
    speechRecognition: null,
    timerId: window.setInterval(refreshNarrationRecordingSession, 1000),
    transcript: "",
    trackerStatus: "Requesting microphone access...",
  };
  setNarrationTakeSession(createNarrationTakeSession(selection, {
    status: "paused",
    trackerStatus: "Requesting microphone access...",
    transcript: "",
    elapsedLabel: "0:00",
    recordingId,
    mediaPath,
    startedAtMs,
  }));

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    await abortNarrationRecordingStart(selection, error);
    return;
  }

  if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  narrationRecordingRuntime.stream = stream;

  let recorder;
  try {
    recorder = mediaMimeType
      ? new MediaRecorder(stream, { mimeType: mediaMimeType })
      : new MediaRecorder(stream);
  } catch (error) {
    await abortNarrationRecordingStart(selection, error, stream);
    return;
  }

  narrationRecordingRuntime.mediaRecorder = recorder;
  recorder.ondataavailable = (event) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }

    if (event.data instanceof Blob && event.data.size > 0) {
      narrationRecordingRuntime.chunks.push(event.data);
    }
  };
  recorder.onerror = () => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }

    narrationRecordingRuntime.trackerStatus = "Recorder error";
    updateNarrationTakeSessionFromRuntime();
  };
  recorder.onstop = () => {
    void finalizeNarrationRecording(recordingId);
  };

  const speechRecognition = createNarrationSpeechRecognition(recordingId);
  if (speechRecognition) {
    narrationRecordingRuntime.speechRecognition = speechRecognition;
    narrationRecordingRuntime.trackerStatus = "Speech tracker active";
    try {
      speechRecognition.start();
    } catch {
      narrationRecordingRuntime.speechRecognition = null;
      narrationRecordingRuntime.trackerStatus = "Speech tracker unavailable; verse anchored.";
    }
  } else {
    narrationRecordingRuntime.trackerStatus = "Speech tracker unavailable; verse anchored.";
  }

  updateNarrationTakeSessionFromRuntime({
    status: "recording",
    trackerStatus: narrationRecordingRuntime.trackerStatus,
  });

  try {
    recorder.start(1000);
  } catch (error) {
    await abortNarrationRecordingStart(selection, error, stream);
  }
}

async function stopNarrationRecording() {
  if (!narrationRecordingRuntime?.mediaRecorder || narrationRecordingRuntime.mediaRecorder.state !== "recording") {
    return;
  }

  narrationRecordingRuntime.trackerStatus = "Finalizing narration take...";
  updateNarrationTakeSessionFromRuntime();

  try {
    narrationRecordingRuntime.mediaRecorder.stop();
  } catch (error) {
    await finalizeNarrationRecording(narrationRecordingRuntime.recordingId, error);
  }
}

async function finalizeNarrationRecording(recordingId, stopError = null) {
  const runtime = narrationRecordingRuntime;
  if (!runtime || runtime.recordingId !== recordingId) {
    return;
  }

  narrationRecordingRuntime = null;
  clearInterval(runtime.timerId);

  if (runtime.speechRecognition) {
    try {
      runtime.speechRecognition.onresult = null;
      runtime.speechRecognition.onerror = null;
      runtime.speechRecognition.onend = null;
      runtime.speechRecognition.stop();
    } catch {
      // Ignore cleanup failures.
    }
  }

  if (runtime.stream) {
    runtime.stream.getTracks().forEach((track) => track.stop());
  }

  const projectId = runtime.projectId || state.activeProjectId || state.workspace?.project?.id || "";
  const createdAt = new Date(runtime.startedAtMs).toISOString();
  const updatedAt = new Date().toISOString();
  const selection = runtime.selection ?? getNarrationTakeSelectionForScene(runtime.selection?.sceneId ?? state.selectedSceneId);
  const transcript = normalizeNarrationTakeTranscript(runtime.transcript);
  const durationMs = Math.max(0, Date.now() - runtime.startedAtMs);
  const mediaMimeType = runtime.mediaMimeType || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  const mediaName = getVoiceRecordingMediaName(runtime.recordingId, mediaMimeType);
  const mediaPath = runtime.mediaPath || buildVoiceRecordingMediaPath(projectId, runtime.recordingId, mediaMimeType);
  let finalRecord = null;
  let trackerStatus = runtime.trackerStatus || "Narration take complete.";

  try {
    const recordingBlob = new Blob(runtime.chunks.length ? runtime.chunks : [], {
      type: mediaMimeType,
    });
    if (!recordingBlob.size) {
      throw new Error("The narration take did not capture any audio.");
    }

    const contentBase64 = await blobToBase64(recordingBlob);
    const saveResponse = await fetchJsonFromDesktopApi("/api/project-media/save", {
      method: "POST",
      body: {
        filePath: mediaPath,
        contentBase64,
      },
    });
    if (!saveResponse.ok) {
      throw saveResponse.error ?? new Error("Unable to save the narration media file.");
    }

    finalRecord = createNarrationRecordingRecord(selection, {
      projectId,
      recordingId: runtime.recordingId,
      transcript,
      mediaPath,
      mediaName,
      mediaMimeType,
      durationMs,
      status: "saved",
      createdAt,
      updatedAt,
    });
    trackerStatus = "Narration take saved.";
  } catch (error) {
    finalRecord = createNarrationRecordingRecord(selection, {
      projectId,
      recordingId: runtime.recordingId,
      transcript,
      mediaPath,
      mediaName,
      mediaMimeType,
      durationMs,
      status: "failed",
      createdAt,
      updatedAt,
    });
    trackerStatus = `Narration take failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "voice-recording", "Narration recording failed to save.", {
      error,
      recordingId: runtime.recordingId,
      projectId,
      mediaPath,
    });
  }

  upsertVoiceRecordingRecord(finalRecord);
  setNarrationTakeSession(createNarrationTakeSession(selection, {
    status: "paused",
    trackerStatus,
    transcript,
    elapsedLabel: formatNarrationRecordingElapsedLabel(durationMs),
    recordingId: finalRecord.id,
    mediaPath: finalRecord.mediaPath,
    startedAtMs: runtime.startedAtMs,
  }));
  persistCurrentProjectRecord({ skipProjectFileAutosave: true });
  void saveCurrentProject();

  if (stopError) {
    reportBrowserLog("error", "voice-recording", "Failed to stop a narration recording cleanly.", {
      error: stopError,
      recordingId: runtime.recordingId,
      projectId,
    });
  }
}

async function abortNarrationRecordingStart(selection, error, stream = null) {
  const runtime = narrationRecordingRuntime;
  narrationRecordingRuntime = null;
  clearInterval(runtime?.timerId);

  if (runtime?.speechRecognition) {
    try {
      runtime.speechRecognition.stop();
    } catch {
      // Ignore cleanup failures.
    }
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  const message = error instanceof Error ? error.message : String(error);
  setNarrationTakeSession(createNarrationTakeSession(selection, {
    status: "paused",
    trackerStatus: message || "Unable to start the narration take.",
  }));
  reportBrowserLog("error", "voice-recording", "Narration recording could not start.", {
    error,
    sceneId: selection?.sceneId ?? null,
    blockId: selection?.blockId ?? null,
  });
}

function upsertVoiceRecordingRecord(record) {
  if (!record || !state.workspace) {
    return;
  }

  const recordings = ensureWorkspaceVoiceRecordings();
  const existingIndex = recordings.findIndex((candidate) => candidate.id === record.id);
  if (existingIndex >= 0) {
    recordings.splice(existingIndex, 1, record);
  } else {
    recordings.unshift(record);
  }
  state.workspace.voice.recordings = recordings;
}

function ensureWorkspaceVoiceRecordings() {
  if (!state.workspace || typeof state.workspace !== "object") {
    return [];
  }

  if (!state.workspace.voice || typeof state.workspace.voice !== "object") {
    state.workspace.voice = {
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

  if (!Array.isArray(state.workspace.voice.recordings)) {
    state.workspace.voice.recordings = [];
  }

  return state.workspace.voice.recordings;
}

function createNarrationRecordingRecord(selection, options = {}) {
  const projectId = typeof options.projectId === "string" && options.projectId.trim()
    ? options.projectId.trim()
    : state.activeProjectId ?? state.workspace?.project?.id ?? "";
  const recordingId = typeof options.recordingId === "string" && options.recordingId.trim()
    ? options.recordingId.trim()
    : createNarrationRecordingId(selection);
  const createdAt = typeof options.createdAt === "string" && options.createdAt.trim()
    ? options.createdAt.trim()
    : new Date().toISOString();
  const updatedAt = typeof options.updatedAt === "string" && options.updatedAt.trim()
    ? options.updatedAt.trim()
    : createdAt;
  const mediaMimeType = normalizeNarrationRecordingMimeType(options.mediaMimeType) || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  const mediaName = typeof options.mediaName === "string" && options.mediaName.trim()
    ? options.mediaName.trim()
    : getVoiceRecordingMediaName(recordingId, mediaMimeType);
  const mediaPath = typeof options.mediaPath === "string" && options.mediaPath.trim()
    ? options.mediaPath.trim()
    : buildVoiceRecordingMediaPath(projectId, recordingId, mediaMimeType);

  return {
    id: recordingId,
    projectId,
    chapterId: selection?.chapterId ?? "",
    chapterTitle: selection?.chapterTitle ?? "",
    sceneId: selection?.sceneId ?? "",
    sceneTitle: selection?.sceneTitle ?? "",
    blockId: selection?.blockId ?? "",
    paragraphId: selection?.paragraphId ?? "",
    lineNumber: Number.isInteger(selection?.lineNumber) ? selection.lineNumber : 0,
    verseText: normalizeNarrationTakeTranscript(selection?.verseText ?? selection?.selectedText ?? ""),
    transcript: normalizeNarrationTakeTranscript(options.transcript),
    mediaPath,
    mediaName,
    mediaMimeType,
    durationMs: Number.isFinite(Number(options.durationMs)) ? Math.max(0, Math.round(Number(options.durationMs))) : 0,
    status: options.status === "recorded" || options.status === "failed" ? options.status : "saved",
    createdAt,
    updatedAt,
  };
}

function createNarrationSpeechRecognition(recordingId) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    return null;
  }

  try {
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
        return;
      }

      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      narrationRecordingRuntime.transcript = transcript;
      narrationRecordingRuntime.trackerStatus = transcript
        ? "Speech tracker active"
        : "Speech tracker listening";
      updateNarrationTakeSessionFromRuntime();
    };
    recognition.onerror = (event) => {
      if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
        return;
      }

      narrationRecordingRuntime.trackerStatus = `Speech tracker ${normalizeNarrationTakeStatusText(event.error) || "error"}`;
      updateNarrationTakeSessionFromRuntime();
    };
    recognition.onend = () => {
      if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
        return;
      }

      if (narrationRecordingRuntime.mediaRecorder?.state === "recording") {
        narrationRecordingRuntime.trackerStatus = "Speech tracker paused";
        updateNarrationTakeSessionFromRuntime();
      }
    };
    return recognition;
  } catch {
    return null;
  }
}

async function previewVoiceRecording(recordingId) {
  const recording = getVoiceRecordingById(recordingId);
  if (!recording || recording.status !== "saved" || !recording.mediaPath) {
    return;
  }

  try {
    const response = await fetchJsonFromDesktopApi("/api/project-media/load", {
      method: "POST",
      body: {
        filePath: recording.mediaPath,
      },
    });

    if (!response.ok) {
      throw response.error ?? new Error("Unable to load the voice recording.");
    }

    const blob = base64ToBlob(response.value?.contentBase64 ?? "", recording.mediaMimeType);
    if (!blob) {
      throw new Error("The voice recording was empty.");
    }

    if (voiceRecordingPreviewAudio) {
      try {
        voiceRecordingPreviewAudio.pause();
      } catch {
        // Ignore preview cleanup failures.
      }
    }
    if (voiceRecordingPreviewUrl) {
      URL.revokeObjectURL(voiceRecordingPreviewUrl);
      voiceRecordingPreviewUrl = null;
    }

    voiceRecordingPreviewUrl = URL.createObjectURL(blob);
    voiceRecordingPreviewAudio = new Audio(voiceRecordingPreviewUrl);
    voiceRecordingPreviewAudio.preload = "auto";
    voiceRecordingPreviewAudio.onended = () => {
      if (voiceRecordingPreviewUrl) {
        URL.revokeObjectURL(voiceRecordingPreviewUrl);
        voiceRecordingPreviewUrl = null;
      }
      voiceRecordingPreviewAudio = null;
    };
    voiceRecordingPreviewAudio.onerror = () => {
      if (voiceRecordingPreviewUrl) {
        URL.revokeObjectURL(voiceRecordingPreviewUrl);
        voiceRecordingPreviewUrl = null;
      }
      voiceRecordingPreviewAudio = null;
    };
    await voiceRecordingPreviewAudio.play();
  } catch (error) {
    reportBrowserLog("error", "voice-recording", "Voice recording preview failed.", {
      error,
      recordingId,
      mediaPath: recording.mediaPath,
    });
  }
}

function goToVoiceRecordingVerse(recordingId) {
  const recording = getVoiceRecordingById(recordingId);
  if (!recording) {
    return;
  }

  const scene = getScene(recording.sceneId);
  if (!scene) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId =
    scene.blocks.some((block) => block.blockId === recording.blockId)
      ? recording.blockId
      : scene.blocks[0]?.blockId ?? null;
  render();
}

function createVoiceNarrationJobRecord(input) {
  const now = new Date().toISOString();
  const manuscriptRef = createVoiceNarrationAnchor(input.projectId, input.sourceLine);
  const blockRange = input.sourceScene.blocks.length
    ? {
        startBlockId: input.sourceScene.blocks[0].blockId,
        endBlockId: input.sourceScene.blocks[input.sourceScene.blocks.length - 1].blockId,
      }
    : undefined;

  return {
    id: `voice-narration-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    manuscriptRef,
    chapterId: input.sourceLine.chapterId,
    sceneId: input.sourceLine.sceneId,
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot: input.sourceScene.editorText || input.sourceLine.text || "Placeholder narration text.",
    voiceProfileId: input.voiceProfile.id,
    status: "draft",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createVoiceNarrationAnchor(projectId, sourceLine) {
  return {
    projectId,
    chapterId: sourceLine.chapterId,
    sceneId: sourceLine.sceneId,
    blockId: sourceLine.blockId,
    paragraphId: sourceLine.paragraphId,
    startOffset: 0,
    endOffset: sourceLine.text.length,
  };
}

function queueVoiceNarrationJobRecord(job) {
  if (job.status !== "draft" && job.status !== "failed") {
    throw new Error(`Cannot queue a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "queued",
    progress: 0.15,
    error: undefined,
    outputAudioRef: undefined,
    alignmentRef: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function startVoiceNarrationJobRenderingRecord(job) {
  if (job.status !== "queued") {
    throw new Error(`Cannot start rendering a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "rendering",
    progress: 0.55,
    error: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function renderPlaceholderVoiceNarrationJobRecord(job) {
  if (job.status !== "rendering") {
    throw new Error(`Cannot complete a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "rendered",
    progress: 1,
    outputAudioRef: `voice-output://placeholder/${job.id}`,
    error: undefined,
    updatedAt: new Date().toISOString(),
  };
}

function compareVoiceNarrationJobs(left, right) {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

function loadVoiceNarrationState() {
  const snapshot = projectService.loadUserPreference(VOICE_NARRATION_STORAGE_KEY, null);
  const storedProfiles = normalizeVoiceNarrationProfiles(snapshot?.voiceProfiles);
  const narrationJobs = normalizeVoiceNarrationJobs(snapshot?.narrationJobs);
  const selectedVoiceProfileId = normalizeVoiceNarrationString(snapshot?.selectedVoiceProfileId);
  const voiceProfiles = storedProfiles.length ? storedProfiles : createVoiceNarrationDemoProfiles();
  const selectedProfile = selectedVoiceProfileId
    ? voiceProfiles.find((profile) => profile.id === selectedVoiceProfileId) ?? null
    : null;

  return {
    voiceProfiles,
    narrationJobs,
    selectedVoiceProfileId: selectedProfile?.id ?? voiceProfiles[0]?.id ?? null,
  };
}

function saveVoiceNarrationState() {
  projectService.saveUserPreference(VOICE_NARRATION_STORAGE_KEY, {
    version: 1,
    voiceProfiles: cloneValue(state.voiceNarration?.voiceProfiles ?? []),
    narrationJobs: cloneValue(state.voiceNarration?.narrationJobs ?? []),
    selectedVoiceProfileId: normalizeVoiceNarrationString(state.voiceNarration?.selectedVoiceProfileId) ?? null,
    updatedAt: new Date().toISOString(),
  });
}

function createVoiceNarrationDemoProfiles(now = new Date().toISOString()) {
  return [
    createVoiceNarrationProfileRecord({
      id: "voice-profile-lantern",
      displayName: "Lantern Narrator",
      engineType: "local-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Measured documentary warmth",
      description: "Local narration placeholder for long-form manuscript reading.",
      settings: {
        pace: 0.96,
        warmth: 0.72,
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-harbor",
      displayName: "Harbor External",
      engineType: "external-placeholder",
      language: "en",
      accent: "australian",
      voiceStyleLabel: "Bright provider placeholder",
      description: "Represents an external narration provider without real connectivity yet.",
      settings: {
        providerHint: "external-demo",
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-iron",
      displayName: "Iron System Voice",
      engineType: "system-voice-placeholder",
      language: "en",
      accent: "general",
      genderLabel: "neutral",
      voiceStyleLabel: "Plain OS fallback",
      description: "Uses the operating system voice slot as a placeholder contract.",
      settings: {
        fallback: true,
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-rift",
      displayName: "Rift Conversion",
      engineType: "rvc-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Performance conversion placeholder",
      description: "Represents a future voice-conversion pipeline without any model integration.",
      settings: {
        conversionMode: "stub",
      },
      createdAt: now,
      updatedAt: now,
    }),
  ];
}

function createVoiceNarrationProfileRecord(input) {
  return {
    id: String(input.id).trim(),
    displayName: String(input.displayName).trim(),
    engineType: normalizeVoiceNarrationEngineType(input.engineType),
    language: normalizeVoiceNarrationString(input.language) || "und",
    accent: normalizeVoiceNarrationString(input.accent) || "neutral",
    ...(normalizeVoiceNarrationString(input.genderLabel) ? { genderLabel: normalizeVoiceNarrationString(input.genderLabel) } : {}),
    ...(normalizeVoiceNarrationString(input.voiceStyleLabel) ? { voiceStyleLabel: normalizeVoiceNarrationString(input.voiceStyleLabel) } : {}),
    description: normalizeVoiceNarrationString(input.description) || "",
    ...(normalizeVoiceNarrationString(input.sampleAudioRef) ? { sampleAudioRef: normalizeVoiceNarrationString(input.sampleAudioRef) } : {}),
    settings: isPlainObject(input.settings) ? { ...input.settings } : {},
    createdAt: normalizeVoiceNarrationString(input.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeVoiceNarrationString(input.updatedAt) || normalizeVoiceNarrationString(input.createdAt) || new Date(0).toISOString(),
  };
}

function normalizeVoiceNarrationProfiles(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeVoiceNarrationProfileRecord(item))
    .filter(Boolean);
}

function normalizeVoiceNarrationProfileRecord(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const id = normalizeVoiceNarrationString(candidate.id);
  const displayName = normalizeVoiceNarrationString(candidate.displayName);
  const engineType = normalizeVoiceNarrationEngineType(candidate.engineType);

  if (!id || !displayName || !engineType) {
    return null;
  }

  const createdAt = normalizeVoiceNarrationString(candidate.createdAt) || new Date(0).toISOString();
  const updatedAt = normalizeVoiceNarrationString(candidate.updatedAt) || createdAt;

  return createVoiceNarrationProfileRecord({
    id,
    displayName,
    engineType,
    language: normalizeVoiceNarrationString(candidate.language) || "und",
    accent: normalizeVoiceNarrationString(candidate.accent) || "neutral",
    genderLabel: normalizeVoiceNarrationString(candidate.genderLabel),
    voiceStyleLabel: normalizeVoiceNarrationString(candidate.voiceStyleLabel),
    description: normalizeVoiceNarrationString(candidate.description) || "",
    sampleAudioRef: normalizeVoiceNarrationString(candidate.sampleAudioRef),
    settings: isPlainObject(candidate.settings) ? { ...candidate.settings } : {},
    createdAt,
    updatedAt,
  });
}

function normalizeVoiceNarrationJobs(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeVoiceNarrationJobRecord(item))
    .filter(Boolean)
    .sort(compareVoiceNarrationJobs);
}

function normalizeVoiceNarrationJobRecord(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const manuscriptRef = normalizeVoiceNarrationAnchor(candidate.manuscriptRef);
  const projectId = normalizeVoiceNarrationString(candidate.projectId);
  const voiceProfileId = normalizeVoiceNarrationString(candidate.voiceProfileId);
  const sourceTextSnapshot =
    typeof candidate.sourceTextSnapshot === "string" && candidate.sourceTextSnapshot.trim()
      ? candidate.sourceTextSnapshot
      : "";
  const status = normalizeVoiceNarrationJobStatus(candidate.status);
  const progress = normalizeVoiceNarrationProgress(candidate.progress);

  if (!manuscriptRef || !projectId || !voiceProfileId || !sourceTextSnapshot || !status) {
    return null;
  }

  const chapterId = normalizeVoiceNarrationString(candidate.chapterId);
  const sceneId = normalizeVoiceNarrationString(candidate.sceneId);
  const blockRange = candidate.blockRange ? normalizeVoiceNarrationBlockRange(candidate.blockRange) : undefined;

  if (candidate.blockRange && !blockRange) {
    return null;
  }

  const createdAt = normalizeVoiceNarrationString(candidate.createdAt) || new Date(0).toISOString();
  const updatedAt = normalizeVoiceNarrationString(candidate.updatedAt) || createdAt;

  return {
    id: normalizeVoiceNarrationString(candidate.id) || `voice-narration-job-${Date.now()}`,
    projectId,
    manuscriptRef,
    ...(chapterId ? { chapterId } : {}),
    ...(sceneId ? { sceneId } : {}),
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot,
    voiceProfileId,
    status,
    progress,
    ...(normalizeVoiceNarrationString(candidate.outputAudioRef) ? { outputAudioRef: normalizeVoiceNarrationString(candidate.outputAudioRef) } : {}),
    ...(normalizeVoiceNarrationString(candidate.alignmentRef) ? { alignmentRef: normalizeVoiceNarrationString(candidate.alignmentRef) } : {}),
    ...(normalizeVoiceNarrationString(candidate.error) ? { error: normalizeVoiceNarrationString(candidate.error) } : {}),
    createdAt,
    updatedAt,
  };
}

function normalizeVoiceNarrationAnchor(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const projectId = normalizeVoiceNarrationString(candidate.projectId);
  const chapterId = normalizeVoiceNarrationString(candidate.chapterId);
  const sceneId = normalizeVoiceNarrationString(candidate.sceneId);
  const blockId = normalizeVoiceNarrationString(candidate.blockId);
  const paragraphId = normalizeVoiceNarrationString(candidate.paragraphId);
  const startOffset = Number(candidate.startOffset);
  const endOffset = Number(candidate.endOffset);

  if (
    !projectId ||
    !chapterId ||
    !sceneId ||
    !blockId ||
    !paragraphId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset
  ) {
    return null;
  }

  return {
    projectId,
    chapterId,
    sceneId,
    blockId,
    paragraphId,
    startOffset,
    endOffset,
  };
}

function normalizeVoiceNarrationBlockRange(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const startBlockId = normalizeVoiceNarrationString(candidate.startBlockId);
  const endBlockId = normalizeVoiceNarrationString(candidate.endBlockId);

  if (!startBlockId || !endBlockId) {
    return null;
  }

  return {
    startBlockId,
    endBlockId,
  };
}

function normalizeVoiceNarrationEngineType(candidate) {
  const value = normalizeVoiceNarrationString(candidate);
  return value && [
    "local-placeholder",
    "external-placeholder",
    "rvc-placeholder",
    "system-voice-placeholder",
  ].includes(value)
    ? value
    : "";
}

function normalizeVoiceNarrationJobStatus(candidate) {
  const value = normalizeVoiceNarrationString(candidate);
  return value && ["draft", "queued", "rendering", "rendered", "failed", "cancelled"].includes(value)
    ? value
    : "";
}

function normalizeVoiceNarrationProgress(candidate) {
  const value = Number(candidate);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

function normalizeVoiceNarrationString(candidate) {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "";
}

function isPlainObject(candidate) {
  return Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
}

// Intent: translate editor preferences into CSS variables without mutating manuscript data.
function buildEditorStyle() {
  return [
    `--editor-content-width:${state.editorPrefs.editorWidth}px`,
    `--editor-font-size:${state.editorPrefs.fontSize}px`,
    `--editor-line-height:${state.editorPrefs.lineHeight}`,
    `--editor-font-stack:${getFontStack()}`,
  ].join("; ");
}

function getFontStack() {
  return FONT_OPTIONS.find((option) => option.id === state.editorPrefs.fontFamilyId)?.stack
    ?? FONT_OPTIONS[0].stack;
}

function syncSceneDocumentLayout(options = {}) {
  const editor = document.querySelector("[data-scene-editor]");
  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const textarea = editor.querySelector(".editor-document-input");
  const gutter = editor.querySelector("[data-editor-gutter]");
  const spellcheckLayer = editor.querySelector("[data-spellcheck-layer]");
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    !(gutter instanceof HTMLElement) ||
    !(spellcheckLayer instanceof HTMLElement)
  ) {
    return;
  }
  const selectedSceneId = editor.dataset.sceneEditor ?? "";

  textarea.style.height = "0px";
  const scrollHeight = textarea.scrollHeight;
  textarea.style.height = `${scrollHeight}px`;

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight || "0") || 1;
  const paddingTop = parseFloat(style.paddingTop || "0");
  const paddingBottom = parseFloat(style.paddingBottom || "0");
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const charactersPerLine = Math.max(
    8,
    Math.floor(textarea.clientWidth / approximateCharacterWidth),
  );
  const sceneLineMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    selectedSceneId ? { [selectedSceneId]: textarea.value } : {},
  );
  const selectedSceneMetrics = sceneLineMetrics.find((candidate) => candidate.sceneId === selectedSceneId);
  const visualLineCount = Math.max(
    1,
    selectedSceneMetrics?.lineCount ?? Math.round((scrollHeight - paddingTop - paddingBottom) / lineHeight),
  );
  const lineStartNumber = selectedSceneMetrics?.startLineNumber ?? 1;

  gutter.innerHTML = Array.from({ length: visualLineCount }, (_, index) => `
    <span class="editor-gutter-line">${lineStartNumber + index}</span>
  `).join("");
  if (state.editorPrefs.grammarCheckEnabled === false) {
    spellcheckLayer.innerHTML = "";
  } else if (options.skipSpellcheck === true) {
    syncSpellcheckLayerTypingState(spellcheckLayer, options.activeTypingWordRange);
  } else {
    syncSpellcheckLayer(spellcheckLayer, textarea, selectedSceneId, options);
  }
  syncInlinePassageDraftLayout();
}

const sceneEditorTypingRefreshState = {
  frameId: null,
  sceneId: "",
  editorText: "",
  activeTypingWordRange: null,
  layout: false,
  revisionPanel: false,
  grammarPanel: false,
  consoleCard: false,
  inlinePassageStatus: false,
};

const sceneEditorSpellcheckRefreshState = {
  timerId: null,
  sceneId: "",
};

// Intent: debounce scene editor overlays so typing remains responsive while diagnostics update.
const SCENE_EDITOR_SPELLCHECK_REFRESH_DELAY_MS = 180;

function scheduleSceneEditorTypingRefresh(sceneId, editorText, options = {}) {
  sceneEditorTypingRefreshState.sceneId = sceneId;
  sceneEditorTypingRefreshState.editorText = editorText;
  sceneEditorTypingRefreshState.activeTypingWordRange = options.activeTypingWordRange ?? null;
  sceneEditorTypingRefreshState.layout = true;
  sceneEditorTypingRefreshState.revisionPanel = options.revisionPanel !== false;
  sceneEditorTypingRefreshState.grammarPanel = options.grammarPanel !== false;
  sceneEditorTypingRefreshState.consoleCard = options.consoleCard !== false;
  sceneEditorTypingRefreshState.inlinePassageStatus = options.inlinePassageStatus !== false;

  if (sceneEditorTypingRefreshState.frameId !== null) {
    return;
  }

  sceneEditorTypingRefreshState.frameId = window.requestAnimationFrame(() => {
    sceneEditorTypingRefreshState.frameId = null;
    const {
      sceneId: pendingSceneId,
      editorText: pendingEditorText,
      activeTypingWordRange,
      layout,
      revisionPanel,
      grammarPanel,
      consoleCard,
      inlinePassageStatus,
    } = sceneEditorTypingRefreshState;

    sceneEditorTypingRefreshState.layout = false;
    sceneEditorTypingRefreshState.revisionPanel = false;
    sceneEditorTypingRefreshState.grammarPanel = false;
    sceneEditorTypingRefreshState.consoleCard = false;
    sceneEditorTypingRefreshState.inlinePassageStatus = false;
    sceneEditorTypingRefreshState.activeTypingWordRange = null;

    if (layout) {
      syncSceneDocumentLayout({ skipSpellcheck: true });
    }
    syncSceneEditorWordCountReadouts(getEditorTextareaForScene(pendingSceneId));
    if (revisionPanel) {
      syncRevisionPanel(pendingSceneId);
    }
    if (consoleCard) {
      updateFocusedLineCard();
    }
    if (inlinePassageStatus) {
      updateInlinePassageDraftStatus(pendingEditorText);
    }
  });
}

function scheduleSceneEditorSpellcheckRefresh(sceneId) {
  if (state.editorPrefs.grammarCheckEnabled === false) {
    return;
  }

  sceneEditorSpellcheckRefreshState.sceneId = sceneId;
  if (sceneEditorSpellcheckRefreshState.timerId !== null) {
    window.clearTimeout(sceneEditorSpellcheckRefreshState.timerId);
  }

  sceneEditorSpellcheckRefreshState.timerId = window.setTimeout(() => {
    sceneEditorSpellcheckRefreshState.timerId = null;
    flushSceneEditorSpellcheckRefresh(sceneEditorSpellcheckRefreshState.sceneId);
  }, SCENE_EDITOR_SPELLCHECK_REFRESH_DELAY_MS);
}

function flushSceneEditorSpellcheckRefresh(sceneId) {
  if (state.editorPrefs.grammarCheckEnabled === false) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const activeTypingWordRange = getEditorTypingSpellcheckRange(textarea);
  syncSceneDocumentLayout({
    activeTypingWordRange,
  });
  renderGrammarCheckPanel({
    activeTypingWordRange,
  });
}

function clearSceneEditorSpellcheckRefresh() {
  if (sceneEditorSpellcheckRefreshState.timerId !== null) {
    window.clearTimeout(sceneEditorSpellcheckRefreshState.timerId);
    sceneEditorSpellcheckRefreshState.timerId = null;
  }
}

function syncInlinePassageDraftLayout() {
  document
    .querySelectorAll("[data-inline-passage-draft] textarea")
    .forEach((field) => {
      if (!(field instanceof HTMLTextAreaElement)) {
        return;
      }

      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
    });
}

function refreshScenes() {
  state.scenes = buildSceneRecords(
    state.workspace,
    state.sceneDrafts,
    state.structureDrafts,
  );
}

// Intent: reconcile browser, desktop, bundled, and legacy project-library sources during startup.
async function loadInitialProjectLibrary() {
  const storedLibrary = normalizeProjectLibrarySnapshot(projectService.loadProjectLibrarySnapshot());
  const storedActiveProjectId = projectRepository.loadActiveProjectId();
  const legacyProjectId =
    storedLibrary.activeProjectId ??
    storedActiveProjectId ??
    null;
  const legacyState = loadLegacyProjectState(legacyProjectId);
  const remoteSeedLibrary = await Promise.race([
    loadDesktopProjectLibrarySeed(),
    new Promise((resolve) => {
      window.setTimeout(() => resolve(null), DESKTOP_PROJECT_LIBRARY_BOOT_TIMEOUT_MS);
    }),
  ]);
  const bundledSeedLibrary = remoteSeedLibrary ? null : loadBundledProjectLibrarySeed();
  const workspaceSeedLibrary = remoteSeedLibrary || bundledSeedLibrary || await loadWorkspaceFallbackProjectLibrarySeed();
  const seedLibrary = workspaceSeedLibrary;
  const mergedLibrary = mergeProjectLibrarySnapshots(storedLibrary, seedLibrary, legacyState);
  const activeProjectId = resolveActiveProjectId(
    storedActiveProjectId,
    mergedLibrary,
  );
  const library = {
    activeProjectId,
    projects: mergedLibrary.projects,
  };

  return projectService.saveProjectLibrarySnapshot(library);
}

function loadBundledProjectLibrarySeed() {
  const bundledSeed = window.__ABE_SERVA_VITAE_PROJECT_LIBRARY__;
  if (!bundledSeed || typeof bundledSeed !== "object") {
    return null;
  }

  return normalizeProjectLibrarySnapshot(bundledSeed);
}

async function loadDesktopProjectLibrarySeed() {
  const projectLibraryResponse = await fetchJsonFromDesktopApi("/api/project-library");
  if (projectLibraryResponse.ok) {
    return normalizeProjectLibrarySnapshot(projectLibraryResponse.value);
  }

  reportBrowserLog("warn", "project-library", "Unable to load the project library seed.", {
    error: projectLibraryResponse.error,
    attemptedUrls: projectLibraryResponse.attemptedUrls,
  });
  console.warn("Unable to load the saved project library seed.", projectLibraryResponse.error);

  return null;
}

async function loadWorkspaceFallbackProjectLibrarySeed() {
  const workspaceResponse = await fetchJsonFromDesktopApi("/api/workspace");
  if (!workspaceResponse.ok) {
    reportBrowserLog("error", "workspace", "Workspace request failed.", {
      error: workspaceResponse.error,
      attemptedUrls: workspaceResponse.attemptedUrls,
    });
    throw workspaceResponse.error ?? new Error("Workspace request failed.");
  }

  const workspace = workspaceResponse.value;
  return {
    activeProjectId: workspace?.project?.id ?? null,
    projects: [
      createProjectLibraryRecordFromWorkspace(workspace, {
        source: "workspace-fallback",
        createdAt: workspace?.generatedAt,
        updatedAt: workspace?.generatedAt,
      }),
    ],
  };
}

async function fetchJsonFromDesktopApi(pathname, requestOptions = {}) {
  const attemptedUrls = [];
  const baseUrls = ["http://127.0.0.1:4310", "http://localhost:4310"];
  if (typeof window.location.origin === "string" && /^https?:\/\//.test(window.location.origin)) {
    baseUrls.push(window.location.origin);
  }

  const method = typeof requestOptions.method === "string" ? requestOptions.method.toUpperCase() : "GET";
  const bodyValue = requestOptions.body;
  let lastError = null;
  fileAccessBridgeLog.debug("file-access", "desktop-api.request", "Dispatching desktop API request.", {
    pathname,
    method,
    hasBody: bodyValue !== undefined,
  });

  for (const baseUrl of baseUrls) {
    const url = new URL(pathname, baseUrl).toString();
    if (attemptedUrls.includes(url)) {
      continue;
    }
    attemptedUrls.push(url);

    try {
      const headers = {};
      let body;
      if (bodyValue !== undefined) {
        headers["Content-Type"] = "application/json";
        body = typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue);
        fileAccessBridgeLog.debug("validation", "json.stringify.request-body", "Serialized desktop API request body.", {
          pathname,
          method,
          bodyLength: typeof body === "string" ? body.length : 0,
        });
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
      });
      fileAccessBridgeLog.debug("file-access", "desktop-api.response", "Received desktop API response.", {
        pathname,
        method,
        url,
        status: response.status,
      });
      const responseText = await response.text();
      const parsedResponse = responseText ? parseJsonResponseBody(responseText) : null;
      if (!response.ok) {
        throw new Error(
          typeof parsedResponse === "object" && parsedResponse && typeof parsedResponse.message === "string"
            ? parsedResponse.message
            : `Request failed with status ${response.status}.`,
        );
      }

      return {
        ok: true,
        value: parsedResponse,
        attemptedUrls,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      fileAccessBridgeLog.warn("file-access", "desktop-api.retry", "Desktop API request failed at one host; trying next.", {
        pathname,
        method,
        url,
        error,
      });
      reportBrowserLog("warn", "api", `Unable to load ${pathname} from ${url}.`, {
        error,
        url,
      });
    }
  }

  return {
    ok: false,
    error: lastError ?? new Error(`Unable to load ${pathname} from the desktop API.`),
    attemptedUrls,
  };
}

function parseJsonResponseBody(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    fileAccessBridgeLog.debug("validation", "json.parse.response", "Parsed JSON response body.", {
      length: responseText.length,
    });
    return parsed;
  } catch (error) {
    fileAccessBridgeLog.warn("validation", "json.parse.failed", "Response body was not valid JSON; returning raw text.", {
      length: responseText.length,
      error,
    });
    return responseText;
  }
}

function loadLegacyProjectState(projectId = null) {
  const normalizedProjectId = typeof projectId === "string" && projectId.trim() ? projectId.trim() : "";
  return {
    sceneDrafts: loadSceneDrafts(),
    structureDrafts: loadStructureDrafts(),
    templateDrafts: loadTemplateDrafts(),
    manuscriptTasks: loadManuscriptTasks(),
    passageNotes: loadPassageNotes(),
    editorPrefs: loadEditorPrefs(),
    localAiPrefs: loadLocalAiPrefs(),
    projectTitle: loadProjectTitle(state.workspace?.project?.title ?? ""),
    projectSourcePath: loadStoredString(EDITOR_PROJECT_SOURCE_PATH_KEY) ?? "",
    binderPanelWidth: loadStoredNumber(EDITOR_BINDER_WIDTH_KEY, DEFAULT_BINDER_PANEL_WIDTH),
    consoleDockWidth: loadStoredNumber(EDITOR_CONSOLE_WIDTH_KEY, DEFAULT_CONSOLE_PANEL_WIDTH),
    consoleDockCollapsed: readStoredJson(EDITOR_RIGHT_DOCK_COLLAPSED_KEY) === true,
    collapsedChapterIds: normalizedProjectId ? loadCollapsedChapterIds(normalizedProjectId) : [],
    collapsedConsoleChapterIds: normalizedProjectId ? loadCollapsedConsoleChapterIds(normalizedProjectId) : {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    },
    projectFilePath: loadStoredString(EDITOR_PROJECT_FILE_PATH_KEY) ?? "",
    writingTargetState: null,
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: "",
    writingTargetCalendarMonthKey: "",
  };
}

function normalizeProjectLibrarySnapshot(candidate) {
  const projects = Array.isArray(candidate?.projects)
    ? candidate.projects.map((project) => normalizeProjectRecord(project)).filter(Boolean)
    : [];

  return {
    activeProjectId:
      typeof candidate?.activeProjectId === "string" && candidate.activeProjectId.trim()
        ? candidate.activeProjectId
        : null,
    projects,
    sceneStore: candidate?.sceneStore && typeof candidate.sceneStore === "object" && !Array.isArray(candidate.sceneStore)
      ? cloneValue(candidate.sceneStore)
      : {},
  };
}

function mergeProjectLibrarySnapshots(storedLibrary, seedLibrary, legacyState = null) {
  const projectsById = new Map();
  const mergedProjects = [];
  const seedProjects = seedLibrary.projects
    .map((project) => normalizeProjectRecord(project, legacyState))
    .filter(Boolean);

  for (const project of storedLibrary.projects) {
    const normalized = normalizeProjectRecord(project);
    if (!normalized || projectsById.has(normalized.id)) {
      continue;
    }
    projectsById.set(normalized.id, normalized);
    mergedProjects.push(normalized);
  }

  for (const normalized of seedProjects) {
    const existing = projectsById.get(normalized.id) ?? findStaleSeedProjectMatch(mergedProjects, normalized);
    if (!existing) {
      projectsById.set(normalized.id, normalized);
      mergedProjects.push(normalized);
      continue;
    }

    const merged = mergeProjectRecords(existing, normalized, legacyState);
    const index = mergedProjects.findIndex((candidate) => candidate.id === existing.id);
    if (index !== -1) {
      mergedProjects[index] = merged;
    } else {
      mergedProjects.push(merged);
    }

    projectsById.delete(existing.id);
    projectsById.set(merged.id, merged);
  }

  const canonicalSeedProject = seedProjects.find((project) => project.source === "project-file") ?? seedProjects[0] ?? null;
  if (canonicalSeedProject) {
    const staleDuplicate = findStaleSeedProjectMatch(
      mergedProjects.filter((project) => project.id !== canonicalSeedProject.id),
      canonicalSeedProject,
    );
    if (staleDuplicate) {
      const staleIndex = mergedProjects.findIndex((candidate) => candidate.id === staleDuplicate.id);
      if (staleIndex !== -1) {
        mergedProjects.splice(staleIndex, 1);
        projectsById.delete(staleDuplicate.id);
      }
    }
  }

  if (!mergedProjects.length && legacyState) {
    const fallbackProject = createProjectLibraryRecordFromWorkspace(seedLibrary.projects[0]?.workspace ?? state.workspace, legacyState);
    projectsById.set(fallbackProject.id, fallbackProject);
    mergedProjects.push(fallbackProject);
  }

  return {
    activeProjectId: storedLibrary.activeProjectId ?? seedLibrary.activeProjectId ?? mergedProjects[0]?.id ?? null,
    projects: mergedProjects,
  };
}

function mergeProjectRecords(storedRecord, seedRecord, legacyState = null) {
  const storedProjectSettings = storedRecord?.projectSettings && typeof storedRecord.projectSettings === "object" && !Array.isArray(storedRecord.projectSettings)
    ? storedRecord.projectSettings
    : {};
  const seedProjectSettings = seedRecord?.projectSettings && typeof seedRecord.projectSettings === "object" && !Array.isArray(seedRecord.projectSettings)
    ? seedRecord.projectSettings
    : {};
  const seedWorkspace = seedRecord?.workspace && typeof seedRecord.workspace === "object" && !Array.isArray(seedRecord.workspace)
    ? cloneValue(seedRecord.workspace)
    : {};
  const storedWorkspace = storedRecord?.workspace && typeof storedRecord.workspace === "object" && !Array.isArray(storedRecord.workspace)
    ? cloneValue(storedRecord.workspace)
    : {};
  const mergedWorkspace = {
    ...seedWorkspace,
    ...storedWorkspace,
  };
  if (seedWorkspace.project || storedWorkspace.project) {
    mergedWorkspace.project = {
      ...(seedWorkspace.project && typeof seedWorkspace.project === "object" ? seedWorkspace.project : {}),
      ...(storedWorkspace.project && typeof storedWorkspace.project === "object" ? storedWorkspace.project : {}),
      id: seedRecord.id,
      title: seedRecord.title,
    };
  }
  if (seedWorkspace.selectionDefaults || storedWorkspace.selectionDefaults) {
    mergedWorkspace.selectionDefaults = {
      ...(seedWorkspace.selectionDefaults && typeof seedWorkspace.selectionDefaults === "object" ? seedWorkspace.selectionDefaults : {}),
      ...(storedWorkspace.selectionDefaults && typeof storedWorkspace.selectionDefaults === "object" ? storedWorkspace.selectionDefaults : {}),
    };
  }
  const merged = {
    ...cloneValue(seedRecord),
    ...cloneValue(storedRecord),
    id: seedRecord.id,
    title: seedRecord.title,
    source: seedRecord.source ?? storedRecord.source,
    createdAt: seedRecord.createdAt ?? storedRecord.createdAt,
    updatedAt: storedRecord.updatedAt ?? seedRecord.updatedAt,
    workspace: mergedWorkspace,
    sceneDrafts: storedRecord.sceneDrafts ?? seedRecord.sceneDrafts ?? legacyState?.sceneDrafts ?? {},
    structureDrafts: storedRecord.structureDrafts ?? seedRecord.structureDrafts ?? legacyState?.structureDrafts ?? createStructureDrafts(),
    templateDrafts: storedRecord.templateDrafts ?? seedRecord.templateDrafts ?? legacyState?.templateDrafts ?? createTemplateDrafts(),
    manuscriptTasks: mergeItemsById(storedRecord.manuscriptTasks, seedRecord.manuscriptTasks),
    passageNotes: mergeItemsById(storedRecord.passageNotes, seedRecord.passageNotes),
    sourceArchive: cloneValue(seedRecord.sourceArchive ?? storedRecord.sourceArchive ?? []),
    importReport: cloneValue(seedRecord.importReport ?? storedRecord.importReport ?? {}),
    editorPrefs: normalizeEditorPrefs(storedRecord.editorPrefs ?? seedRecord.editorPrefs ?? legacyState?.editorPrefs),
    localAiPrefs: normalizeLocalAiPrefs(storedRecord.localAiPrefs ?? seedRecord.localAiPrefs ?? legacyState?.localAiPrefs),
  };

  merged.projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate({
      ...cloneValue(seedRecord),
      ...cloneValue(storedRecord),
      projectSettings: {
        ...cloneValue(seedProjectSettings),
        ...cloneValue(storedProjectSettings),
      },
    }),
    seedRecord.id,
    getProjectRecordWordCountForSettings({
      workspace: merged.workspace,
      sceneDrafts: merged.sceneDrafts,
      projectIndex: storedRecord?.projectIndex ?? seedRecord?.projectIndex ?? null,
    }),
    new Date(),
  );
  merged.editorPrefs = cloneValue(merged.projectSettings.editorPrefs);
  merged.localAiPrefs = cloneValue(merged.projectSettings.localAiPrefs);

  if (merged.workspace?.project && typeof merged.workspace.project === "object") {
    merged.workspace.project = {
      ...merged.workspace.project,
      id: seedRecord.id,
      title: seedRecord.title,
    };
  }
  merged.schemaVersion = Number(storedRecord?.schemaVersion ?? seedRecord?.schemaVersion) || PROJECT_SCHEMA_VERSION;
  const persistedProjectIndex = storedRecord?.projectIndex ?? seedRecord?.projectIndex ?? null;
  merged.projectIndex = buildProjectIndexForRecord(merged, persistedProjectIndex);

  return merged;
}

async function reconnectProjectFileDestinationOnBoot(desktopSettings = null) {
  await projectPersistenceService.restoreLastOpenedProject(desktopSettings);
}

function findStaleSeedProjectMatch(projects, seedProject) {
  const seedTitle = typeof seedProject.title === "string" ? seedProject.title.trim() : "";
  const seedChapterCount = Number(seedProject.workspace?.project?.stats?.chapterCount ?? 0);
  const seedSceneCount = Number(seedProject.workspace?.project?.stats?.sceneCount ?? 0);

  if (!seedTitle) {
    return null;
  }

  return (
    projects.find((project) => {
      if (!project || project.id === seedProject.id) {
        return false;
      }

      if (project.source === "project-file") {
        return false;
      }

      const projectTitle = typeof project.title === "string" ? project.title.trim() : "";
      if (projectTitle !== seedTitle) {
        return false;
      }

      const chapterCount = Number(project.workspace?.project?.stats?.chapterCount ?? 0);
      const sceneCount = Number(project.workspace?.project?.stats?.sceneCount ?? 0);
      return chapterCount < seedChapterCount || sceneCount < seedSceneCount;
    }) ?? null
  );
}

function mergeItemsById(storedItems, seedItems) {
  const merged = [];
  const storedById = new Map();

  for (const item of Array.isArray(storedItems) ? storedItems : []) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      continue;
    }
    if (storedById.has(item.id)) {
      continue;
    }
    storedById.set(item.id, cloneValue(item));
  }

  for (const item of Array.isArray(seedItems) ? seedItems : []) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      continue;
    }
    const storedItem = storedById.get(item.id);
    if (storedItem) {
      merged.push(mergeImportedRecord(storedItem, item));
      storedById.delete(item.id);
      continue;
    }
    merged.push(cloneValue(item));
  }

  for (const item of storedById.values()) {
    merged.push(item);
  }

  return merged;
}

function mergeImportedRecord(storedItem, seedItem) {
  const seedSource = typeof seedItem.source === "string" ? seedItem.source : "";
  const storedSource = typeof storedItem.source === "string" ? storedItem.source : "";
  const isImported = seedSource.startsWith("source-") || storedSource.startsWith("source-");

  if (!isImported) {
    return cloneValue(storedItem);
  }

  const merged = cloneValue(seedItem);
  const userEditableFields = [
    "title",
    "body",
    "description",
    "status",
    "completedAt",
    "updatedAt",
    "assetIds",
    "attachmentConfidence",
  ];

  for (const field of userEditableFields) {
    if (Object.prototype.hasOwnProperty.call(storedItem, field) && storedItem[field] !== undefined) {
      merged[field] = cloneValue(storedItem[field]);
    }
  }

  return merged;
}

function resolveActiveProjectId(candidate, library) {
  if (typeof candidate === "string" && library.projects.some((project) => project.id === candidate)) {
    return candidate;
  }

  if (typeof library.activeProjectId === "string" && library.projects.some((project) => project.id === library.activeProjectId)) {
    return library.activeProjectId;
  }

  return library.projects[0]?.id ?? null;
}

function getWorkspaceManuscriptWordCount(workspace) {
  const lines = Array.isArray(workspace?.project?.lines) ? workspace.project.lines : [];
  return lines.reduce((total, line) => total + countWords(line?.text ?? ""), 0);
}

function getProjectRecordWordCountForSettings(recordLike) {
  const workspaceWordCount = getWorkspaceManuscriptWordCount(recordLike?.workspace);
  if (workspaceWordCount > 0) {
    return workspaceWordCount;
  }

  const sceneDrafts = recordLike?.sceneDrafts && typeof recordLike.sceneDrafts === "object" && !Array.isArray(recordLike.sceneDrafts)
    ? recordLike.sceneDrafts
    : {};
  let draftWordCount = 0;
  for (const draft of Object.values(sceneDrafts)) {
    if (!draft || typeof draft !== "object") {
      continue;
    }
    draftWordCount += countWords(resolveSceneDraftEditorText(draft));
  }
  if (draftWordCount > 0) {
    return draftWordCount;
  }

  const indexScenes = Array.isArray(recordLike?.projectIndex?.scenes)
    ? recordLike.projectIndex.scenes
    : [];
  return indexScenes.reduce((total, scene) => {
    const wordCount = Number(scene?.wordCount);
    if (!Number.isFinite(wordCount) || wordCount < 0) {
      return total;
    }
    return total + Math.max(0, Math.round(wordCount));
  }, 0);
}

function createCollapsedConsoleChapterState(candidate = {}) {
  return {
    issueTasks: normalizeChapterIdList(candidate.issueTasks),
    issues: normalizeChapterIdList(candidate.issues),
    inspiration: normalizeChapterIdList(candidate.inspiration),
    research: normalizeChapterIdList(candidate.research),
  };
}

function createDefaultProjectSettingsSnapshot(currentWordCount = 0, now = new Date()) {
  return {
    editorPrefs: createDefaultEditorPrefs(),
    localAiPrefs: createDefaultLocalAiPrefs(),
    spellcheck: createDefaultSpellcheckProjectSettings(),
    binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
    consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
    userSettingPanelResizerLeftPercent: null,
    userSettingPanelResizerRightPercent: null,
    consoleDockCollapsed: false,
    collapsedChapterIds: [],
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(),
    projectFilePath: "",
    projectSourcePath: "",
    writingTargetState: createDefaultWritingTargetRecord(currentWordCount, now),
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: getLocalDateKey(now),
    writingTargetCalendarMonthKey: getWritingTargetMonthKey(now),
  };
}

function normalizeProjectSettingsSnapshot(candidate, projectId = "", currentWordCount = 0, now = new Date()) {
  const normalizedCandidate = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const defaults = createDefaultProjectSettingsSnapshot(currentWordCount, now);
  const writingTargetStore = projectId ? readWritingTargetStore() : {};
  const projectWritingTarget =
    typeof projectId === "string" && projectId.trim()
      ? writingTargetStore[projectId]
      : null;
  const writingTargetState = normalizeWritingTargetRecord(
    normalizedCandidate.writingTargetState ?? projectWritingTarget ?? defaults.writingTargetState,
    currentWordCount,
    now,
  );
  const writingTargetViewMode = ["month", "week", "list"].includes(normalizedCandidate.writingTargetViewMode)
    ? normalizedCandidate.writingTargetViewMode
    : defaults.writingTargetViewMode;
  const selectedDateKey = isWritingTargetDateKey(normalizedCandidate.writingTargetSelectedDateKey)
    ? normalizedCandidate.writingTargetSelectedDateKey
    : defaults.writingTargetSelectedDateKey;
  const calendarMonth = parseWritingTargetMonthKey(normalizedCandidate.writingTargetCalendarMonthKey);

  return {
    editorPrefs: normalizeEditorPrefs(normalizedCandidate.editorPrefs ?? defaults.editorPrefs),
    localAiPrefs: normalizeLocalAiPrefs(normalizedCandidate.localAiPrefs ?? defaults.localAiPrefs),
    binderPanelWidth: clampNumber(
      normalizedCandidate.binderPanelWidth ?? defaults.binderPanelWidth,
      MIN_BINDER_PANEL_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    consoleDockWidth: clampNumber(
      normalizedCandidate.consoleDockWidth ?? defaults.consoleDockWidth,
      MIN_CONSOLE_PANEL_WIDTH,
      Number.POSITIVE_INFINITY,
    ),
    userSettingPanelResizerLeftPercent: normalizePanelResizerPercent(
      normalizedCandidate.userSettingPanelResizerLeftPercent ?? defaults.userSettingPanelResizerLeftPercent,
    ),
    userSettingPanelResizerRightPercent: normalizePanelResizerPercent(
      normalizedCandidate.userSettingPanelResizerRightPercent ?? defaults.userSettingPanelResizerRightPercent,
    ),
    consoleDockCollapsed: typeof normalizedCandidate.consoleDockCollapsed === "boolean"
      ? normalizedCandidate.consoleDockCollapsed
      : defaults.consoleDockCollapsed,
    collapsedChapterIds: normalizeChapterIdList(
      normalizedCandidate.collapsedChapterIds ?? defaults.collapsedChapterIds,
    ),
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(
      normalizedCandidate.collapsedConsoleChapterIds ?? defaults.collapsedConsoleChapterIds,
    ),
    // Intent: preserve the canonical project-file destination so refreshes can recover the last saved path.
    projectFilePath: normalizeProjectFilePath(
      normalizedCandidate.projectFilePath ?? defaults.projectFilePath,
    ),
    projectSourcePath: normalizeProjectFilePath(normalizedCandidate.projectSourcePath ?? defaults.projectSourcePath),
    writingTargetState,
    writingTargetViewMode,
    writingTargetSelectedDateKey: selectedDateKey,
    writingTargetCalendarMonthKey: calendarMonth
      ? getWritingTargetMonthKey(calendarMonth)
      : defaults.writingTargetCalendarMonthKey,
    spellcheck: normalizeSpellcheckProjectSettings(normalizedCandidate.spellcheck ?? defaults.spellcheck),
  };
}

function buildProjectSettingsCandidate(candidate) {
  const projectSettings = candidate?.projectSettings && typeof candidate.projectSettings === "object" && !Array.isArray(candidate.projectSettings)
    ? candidate.projectSettings
    : {};

  return {
    editorPrefs: projectSettings.editorPrefs ?? candidate?.editorPrefs,
    localAiPrefs: projectSettings.localAiPrefs ?? candidate?.localAiPrefs,
    binderPanelWidth: projectSettings.binderPanelWidth ?? candidate?.binderPanelWidth,
    consoleDockWidth: projectSettings.consoleDockWidth ?? candidate?.consoleDockWidth,
    userSettingPanelResizerLeftPercent: projectSettings.userSettingPanelResizerLeftPercent ?? candidate?.userSettingPanelResizerLeftPercent,
    userSettingPanelResizerRightPercent: projectSettings.userSettingPanelResizerRightPercent ?? candidate?.userSettingPanelResizerRightPercent,
    consoleDockCollapsed: projectSettings.consoleDockCollapsed ?? candidate?.consoleDockCollapsed,
    collapsedChapterIds: projectSettings.collapsedChapterIds ?? candidate?.collapsedChapterIds,
    collapsedConsoleChapterIds: projectSettings.collapsedConsoleChapterIds ?? candidate?.collapsedConsoleChapterIds,
    projectFilePath: projectSettings.projectFilePath ?? candidate?.projectFilePath,
    projectSourcePath: projectSettings.projectSourcePath ?? candidate?.projectSourcePath,
    writingTargetState: projectSettings.writingTargetState ?? candidate?.writingTargetState,
    writingTargetViewMode: projectSettings.writingTargetViewMode ?? candidate?.writingTargetViewMode,
    writingTargetSelectedDateKey: projectSettings.writingTargetSelectedDateKey ?? candidate?.writingTargetSelectedDateKey,
    writingTargetCalendarMonthKey: projectSettings.writingTargetCalendarMonthKey ?? candidate?.writingTargetCalendarMonthKey,
    spellcheck: projectSettings.spellcheck ?? candidate?.spellcheck,
  };
}

function createProjectSettingsSnapshotFromState({
  currentWordCount = getCurrentManuscriptWordCount(),
  now = new Date(),
} = {}) {
  const projectId = state.workspace?.project?.id ?? state.activeProjectId ?? "";
  // Persist canonical writing-target state only; draft edits stay in UI state until explicitly committed.
  const writingTargetState = state.writingTargetState
    ? cloneValue(state.writingTargetState)
    : createDefaultWritingTargetRecord(currentWordCount, now);
  logWritingTargetMetricCheckpoint("metric.project-settings-snapshot", {
    projectId,
    currentWordCount,
    writingTargetLoaded: state.writingTargetState != null,
    writingTargetHistoryEntries: Array.isArray(writingTargetState?.history) ? writingTargetState.history.length : 0,
    writingTargetDailyBaselineWordCount: writingTargetState?.dailyBaselineWordCount ?? 0,
    writingTargetDailyBaselineDateKey: writingTargetState?.dailyBaselineDateKey ?? "",
  });

  return normalizeProjectSettingsSnapshot(
    {
      editorPrefs: cloneValue(state.editorPrefs),
      localAiPrefs: cloneValue(state.localAiPrefs),
      binderPanelWidth: state.binderPanelWidth,
      consoleDockWidth: state.consoleDockWidth,
      userSettingPanelResizerLeftPercent: state.userSettingPanelResizerLeftPercent,
      userSettingPanelResizerRightPercent: state.userSettingPanelResizerRightPercent,
      consoleDockCollapsed: state.consoleDockCollapsed,
      collapsedChapterIds: cloneValue(state.collapsedChapterIds),
      collapsedConsoleChapterIds: cloneValue(state.collapsedConsoleChapterIds),
      projectFilePath: state.projectFilePath,
      projectSourcePath: state.projectSourcePath,
      writingTargetState,
      writingTargetViewMode: state.writingTargetViewMode,
      writingTargetSelectedDateKey: state.writingTargetSelectedDateKey,
      writingTargetCalendarMonthKey: state.writingTargetCalendarMonthKey,
      spellcheck: cloneValue(state.spellcheckProjectSettings),
    },
    projectId,
    currentWordCount,
    now,
  );
}

// Intent: normalize loaded project records into the app-native save-file contract before use.
function normalizeProjectRecord(candidate, legacyState = null) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const workspace = cloneValue(candidate.workspace ?? {});
  const workspaceProject = workspace?.project && typeof workspace.project === "object" ? workspace.project : null;
  if (!workspaceProject) {
    return null;
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim()
      ? candidate.id
      : typeof workspaceProject.id === "string" && workspaceProject.id.trim()
        ? workspaceProject.id
        : `project-${Date.now()}`;
  const title =
    typeof legacyState?.projectTitle === "string" && legacyState.projectTitle.trim()
      ? legacyState.projectTitle
      : typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title
      : typeof workspaceProject.title === "string" && workspaceProject.title.trim()
        ? workspaceProject.title
        : "Untitled Project";
  const now = new Date().toISOString();

  workspace.project = {
    ...workspaceProject,
    id,
    title,
  };
  workspace.workspaceTitle =
    typeof workspace.workspaceTitle === "string" && workspace.workspaceTitle.trim()
      ? workspace.workspaceTitle
      : "ABetterNovelAuthoringEnvironment";
  workspace.selectionDefaults = normalizeSelectionDefaults(workspace.selectionDefaults, workspace.project);
  const projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate({
      ...cloneValue(candidate),
      editorPrefs: candidate.editorPrefs ?? legacyState?.editorPrefs,
      localAiPrefs: candidate.localAiPrefs ?? legacyState?.localAiPrefs,
      projectFilePath: candidate.projectSettings?.projectFilePath ?? candidate.projectFilePath ?? legacyState?.projectFilePath,
      projectSourcePath: candidate.projectSourcePath ?? legacyState?.projectSourcePath,
    }),
    id,
    getProjectRecordWordCountForSettings({
      workspace,
      sceneDrafts:
        candidate.sceneDrafts && typeof candidate.sceneDrafts === "object"
          ? candidate.sceneDrafts
          : legacyState?.sceneDrafts ?? {},
      projectIndex: candidate.projectIndex ?? null,
    }),
    new Date(now),
  );

  const normalizedRecord = {
    id,
    title,
    source: typeof candidate.source === "string" ? candidate.source : "user",
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.trim()
        ? candidate.createdAt
        : workspace.generatedAt ?? now,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt
        : candidate.createdAt ?? workspace.generatedAt ?? now,
    workspace,
    sceneDrafts:
      candidate.sceneDrafts && typeof candidate.sceneDrafts === "object"
        ? cloneValue(candidate.sceneDrafts)
        : legacyState?.sceneDrafts ?? {},
    structureDrafts:
      candidate.structureDrafts && typeof candidate.structureDrafts === "object"
        ? cloneValue(candidate.structureDrafts)
        : legacyState?.structureDrafts ?? createStructureDrafts(),
    templateDrafts: Array.isArray(candidate.templateDrafts)
      ? cloneValue(candidate.templateDrafts)
      : legacyState?.templateDrafts ?? createTemplateDrafts(),
    manuscriptTasks: normalizeManuscriptTasks(candidate.manuscriptTasks ?? legacyState?.manuscriptTasks),
    passageNotes: normalizePassageNotes(candidate.passageNotes ?? legacyState?.passageNotes),
    sourceArchive: Array.isArray(candidate.sourceArchive) ? cloneValue(candidate.sourceArchive) : [],
    importReport: candidate.importReport && typeof candidate.importReport === "object"
      ? cloneValue(candidate.importReport)
      : {},
    projectSettings,
    editorPrefs: cloneValue(projectSettings.editorPrefs),
    localAiPrefs: cloneValue(projectSettings.localAiPrefs),
  };
  normalizedRecord.schemaVersion = Number(candidate.schemaVersion) || PROJECT_SCHEMA_VERSION;
  normalizedRecord.projectIndex = buildProjectIndexForRecord(normalizedRecord, candidate.projectIndex);
  normalizedRecord.workspace.project.stats = buildWorkspaceStatsFromProjectIndex(
    normalizedRecord.projectIndex,
    normalizedRecord.workspace.project.stats,
  );
  return normalizedRecord;
}

function normalizeSelectionDefaults(candidate, project) {
  const sceneIdFromLine =
    typeof candidate?.lineId === "string" && candidate.lineId.trim()
      ? project?.lines?.find((line) => line?.blockId === candidate.lineId)?.sceneId ?? ""
      : "";
  const normalizedSceneSelectionStart = Number.isInteger(candidate?.sceneSelectionStart)
    ? candidate.sceneSelectionStart
    : null;
  const normalizedSceneSelectionEnd = Number.isInteger(candidate?.sceneSelectionEnd)
    ? candidate.sceneSelectionEnd
    : null;
  return {
    lineId:
      typeof candidate?.lineId === "string" && candidate.lineId.trim()
        ? candidate.lineId
        : project?.lines?.[0]?.blockId ?? "",
    sceneId:
      typeof candidate?.sceneId === "string" && candidate.sceneId.trim()
        ? candidate.sceneId
        : (sceneIdFromLine || project?.lines?.[0]?.sceneId) ?? "",
    issueId:
      typeof candidate?.issueId === "string" && candidate.issueId.trim()
        ? candidate.issueId
        : undefined,
    nodeId:
      typeof candidate?.nodeId === "string" && candidate.nodeId.trim()
        ? candidate.nodeId
        : undefined,
    entityId:
      typeof candidate?.entityId === "string" && candidate.entityId.trim()
        ? candidate.entityId
        : undefined,
    sceneSelectionBlockId:
      typeof candidate?.sceneSelectionBlockId === "string" && candidate.sceneSelectionBlockId.trim()
        ? candidate.sceneSelectionBlockId
        : "",
    sceneSelectionLineNumber: Number.isInteger(candidate?.sceneSelectionLineNumber)
      ? candidate.sceneSelectionLineNumber
      : null,
    sceneSelectionStart: normalizedSceneSelectionStart,
    sceneSelectionEnd: normalizedSceneSelectionEnd,
    sceneSelectionScrollTop: Number.isFinite(candidate?.sceneSelectionScrollTop)
      ? candidate.sceneSelectionScrollTop
      : null,
    sceneSelectionScrollLeft: Number.isFinite(candidate?.sceneSelectionScrollLeft)
      ? candidate.sceneSelectionScrollLeft
      : null,
    inlinePassageDraft: normalizeInlinePassageDraftSelectionDefaults(candidate?.inlinePassageDraft),
  };
}

function normalizeInlinePassageDraftSelectionDefaults(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const noteType = candidate.noteType === "research" ? "research" : candidate.noteType === "inspiration" ? "inspiration" : "";
  const sceneId = typeof candidate.sceneId === "string" && candidate.sceneId.trim()
    ? candidate.sceneId.trim()
    : "";
  if (!noteType || !sceneId) {
    return null;
  }

  return {
    sceneId,
    noteType,
    selectedText: String(candidate.selectedText ?? ""),
    startOffset: Number.isInteger(candidate.startOffset) ? candidate.startOffset : null,
    endOffset: Number.isInteger(candidate.endOffset) ? candidate.endOffset : null,
    anchorStartOffset: Number.isInteger(candidate.anchorStartOffset) ? candidate.anchorStartOffset : null,
    seededSelection: Boolean(candidate.seededSelection),
    typedStartOffset: Number.isInteger(candidate.typedStartOffset) ? candidate.typedStartOffset : null,
    typedEndOffset: Number.isInteger(candidate.typedEndOffset) ? candidate.typedEndOffset : null,
    body: String(candidate.body ?? ""),
    typedText: String(candidate.typedText ?? ""),
    editingNoteId: typeof candidate.editingNoteId === "string" ? candidate.editingNoteId : "",
    x: Number.isFinite(candidate.x) ? candidate.x : 110,
    y: Number.isFinite(candidate.y) ? candidate.y : 40,
  };
}

function createProjectLibraryRecordFromWorkspace(workspace, options = {}) {
  const normalizedWorkspace = cloneValue(workspace);
  const project = normalizedWorkspace?.project && typeof normalizedWorkspace.project === "object"
    ? normalizedWorkspace.project
    : {
        id: typeof options.id === "string" && options.id.trim() ? options.id : `project-${Date.now()}`,
        title: typeof options.title === "string" && options.title.trim() ? options.title : "Untitled Project",
        lines: [],
      };
  const id =
    typeof options.id === "string" && options.id.trim()
      ? options.id
      : typeof project.id === "string" && project.id.trim()
        ? project.id
        : `project-${Date.now()}`;
  const title =
    typeof options.title === "string" && options.title.trim()
      ? options.title
      : typeof project.title === "string" && project.title.trim()
        ? project.title
        : "Untitled Project";
  const workspaceTitle =
    typeof normalizedWorkspace?.workspaceTitle === "string" && normalizedWorkspace.workspaceTitle.trim()
      ? normalizedWorkspace.workspaceTitle
      : "ABetterNovelAuthoringEnvironment";
  const now = options.updatedAt ?? options.createdAt ?? normalizedWorkspace.generatedAt ?? new Date().toISOString();

  normalizedWorkspace.project = {
    ...project,
    id,
    title,
  };
  normalizedWorkspace.workspaceTitle = workspaceTitle;
  normalizedWorkspace.selectionDefaults = normalizeSelectionDefaults(
    normalizedWorkspace.selectionDefaults,
    normalizedWorkspace.project,
  );
  const currentWordCount = getProjectRecordWordCountForSettings({
    workspace: normalizedWorkspace,
    sceneDrafts: options.sceneDrafts ?? {},
    projectIndex: options.persistedProjectIndex ?? null,
  });
  const projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate({
      ...cloneValue(options),
      editorPrefs: options.editorPrefs ?? createDefaultEditorPrefs(),
      localAiPrefs: options.localAiPrefs ?? createDefaultLocalAiPrefs(),
      projectFilePath: options.projectFilePath ?? options.projectSettings?.projectFilePath ?? "",
    }),
    id,
    currentWordCount,
    new Date(now),
  );

  const record = {
    id,
    title,
    source: typeof options.source === "string" ? options.source : "user",
    createdAt: typeof options.createdAt === "string" ? options.createdAt : now,
    updatedAt: typeof options.updatedAt === "string" ? options.updatedAt : now,
    workspace: normalizedWorkspace,
    sceneDrafts: cloneValue(options.sceneDrafts ?? {}),
    structureDrafts: cloneValue(options.structureDrafts ?? createStructureDrafts()),
    templateDrafts: cloneValue(options.templateDrafts ?? createTemplateDrafts()),
    manuscriptTasks: normalizeManuscriptTasks(options.manuscriptTasks),
    passageNotes: normalizePassageNotes(options.passageNotes),
    sourceArchive: Array.isArray(options.sourceArchive) ? cloneValue(options.sourceArchive) : [],
    importReport: options.importReport && typeof options.importReport === "object"
      ? cloneValue(options.importReport)
      : {},
    projectSettings,
    editorPrefs: cloneValue(projectSettings.editorPrefs),
    localAiPrefs: cloneValue(projectSettings.localAiPrefs),
  };
  record.schemaVersion = Number(options.schemaVersion) || PROJECT_SCHEMA_VERSION;
  record.projectIndex = buildProjectIndexForRecord(record, options.persistedProjectIndex ?? null);
  record.workspace.project.stats = buildWorkspaceStatsFromProjectIndex(
    record.projectIndex,
    record.workspace.project.stats,
  );
  return record;
}

function createProjectLibraryRecordFromState(options = {}) {
  if (!state.workspace) {
    return null;
  }

  const activeProjectRecord =
    state.projectLibrary.find((project) => project.id === state.workspace?.project?.id)
    ?? state.projectLibrary.find((project) => project.id === state.activeProjectId)
    ?? null;
  const projectSettings = createProjectSettingsSnapshotFromState({
    currentWordCount: getCurrentManuscriptWordCount(),
    now: options.updatedAt ? new Date(options.updatedAt) : new Date(),
  });
  const sceneSelection = captureSceneSelectionDefaultsForSave();
  const workspaceSnapshot = cloneValue(state.workspace);
  workspaceSnapshot.selectionDefaults = {
    ...(workspaceSnapshot.selectionDefaults && typeof workspaceSnapshot.selectionDefaults === "object"
      ? workspaceSnapshot.selectionDefaults
      : {}),
    sceneId: state.selectedSceneId ?? "",
    sceneSelectionBlockId: sceneSelection.blockId ?? "",
    sceneSelectionLineNumber: sceneSelection.lineNumber ?? null,
    sceneSelectionStart: sceneSelection.startOffset ?? null,
    sceneSelectionEnd: sceneSelection.endOffset ?? null,
    sceneSelectionScrollTop: sceneSelection.scrollTop ?? null,
    sceneSelectionScrollLeft: sceneSelection.scrollLeft ?? null,
    inlinePassageDraft: captureInlinePassageDraftDefaultsForSave(),
  };

  return createProjectLibraryRecordFromWorkspace(workspaceSnapshot, {
    ...options,
    id: state.workspace.project.id,
    title: state.projectTitle || state.workspace.project.title,
    source: options.source ?? state.projectLibrary.find((project) => project.id === state.workspace.project.id)?.source ?? "user",
    createdAt:
      options.createdAt ??
      state.projectLibrary.find((project) => project.id === state.workspace.project.id)?.createdAt ??
      state.workspace.generatedAt,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    sceneDrafts: state.sceneDrafts,
    structureDrafts: state.structureDrafts,
    templateDrafts: state.templateDrafts,
    persistedProjectIndex: activeProjectRecord?.projectIndex ?? null,
    manuscriptTasks: state.manuscriptTasks,
    passageNotes: state.passageNotes,
    sourceArchive: state.projectLibrary.find((project) => project.id === state.workspace.project.id)?.sourceArchive ?? [],
    importReport: state.projectLibrary.find((project) => project.id === state.workspace.project.id)?.importReport ?? {},
    projectSettings,
    editorPrefs: state.editorPrefs,
    localAiPrefs: state.localAiPrefs,
  });
}

function getActiveProjectRecord() {
  const projectId = state.activeProjectId ?? state.projectLibrarySelectionId;
  if (!projectId) {
    return state.projectLibrary[0] ?? null;
  }

  return state.projectLibrary.find((project) => project.id === projectId) ?? state.projectLibrary[0] ?? null;
}

function getProjectRecordById(projectId) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return null;
  }

  return state.projectLibrary.find((project) => project.id === projectId) ?? null;
}

function applyProjectRecord(record) {
  if (!record) {
    throw new Error("Unable to load a saved project.");
  }
  projectLoadGateLog.info("lifecycle", "project.apply.begin", "Applying project record into runtime state.", {
    projectId: record.id,
    title: record.title,
  });

  saveWritingTargetState({
    skipProjectFileAutosave: true,
  });
  clearWritingTargetDraft();
  clearWritingTargetSnapshotTimer();
  clearProjectFileAutosaveState();
  if (narrationRecordingRuntime?.timerId) {
    clearInterval(narrationRecordingRuntime.timerId);
  }
  if (narrationRecordingRuntime?.speechRecognition) {
    try {
      narrationRecordingRuntime.speechRecognition.stop();
    } catch {
      // Ignore cleanup failures.
    }
  }
  if (narrationRecordingRuntime?.stream) {
    narrationRecordingRuntime.stream.getTracks().forEach((track) => track.stop());
  }
  narrationRecordingRuntime = null;
  state.narrationTakeSelection = null;
  state.narrationTakeSession = null;
  if (voiceRecordingPreviewAudio) {
    try {
      voiceRecordingPreviewAudio.pause();
    } catch {
      // Ignore cleanup failures.
    }
    voiceRecordingPreviewAudio = null;
  }
  if (voiceRecordingPreviewUrl) {
    URL.revokeObjectURL(voiceRecordingPreviewUrl);
    voiceRecordingPreviewUrl = null;
  }
  state.activeProjectId = record.id;
  state.projectLibrarySelectionId = record.id;
  projectPersistenceService.persistActiveProjectId(record.id);
  state.workspace = cloneValue(record.workspace);
  if (!state.workspace.voice || typeof state.workspace.voice !== "object") {
    state.workspace.voice = {
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
  } else if (!Array.isArray(state.workspace.voice.recordings)) {
    state.workspace.voice.recordings = [];
  }
  state.projectTitle = record.title ?? state.workspace.project.title;
  state.workspace.project.title = state.projectTitle;
  state.sceneDrafts = cloneValue(record.sceneDrafts ?? {});
  state.structureDrafts = cloneValue(record.structureDrafts ?? createStructureDrafts());
  state.templateDrafts = cloneValue(record.templateDrafts ?? createTemplateDrafts());
  state.manuscriptTasks = normalizeManuscriptTasks(record.manuscriptTasks);
  state.passageNotes = normalizePassageNotes(record.passageNotes);
  state.binderSceneMoveHistory = {
    undoStack: [],
    redoStack: [],
  };
  state.sceneEditorSelectionSnapshot = null;
  // Project file destination is owned by ProjectPersistenceService and must survive record application.
  state.selectedTaskId = null;
  state.selectedPassageNoteId = null;
  state.editingChapterTitleId = null;
  state.editingSceneTitleId = null;
  binderTitleClickState = null;
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
  state.editorPrefs = cloneValue(projectSettings.editorPrefs);
  state.localAiPrefs = cloneValue(projectSettings.localAiPrefs);
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
  state.writingTargetState = cloneValue(projectSettings.writingTargetState);
  writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, state.projectSourcePath);
  writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, state.binderPanelWidth);
  writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, state.consoleDockWidth);
  persistConsoleDockCollapsedState(state.consoleDockCollapsed);
  persistCollapsedChapterState(record.id, state.collapsedChapterIds);
  persistCollapsedConsoleChapterState(record.id, state.collapsedConsoleChapterIds);
  const writingTargetStore = readWritingTargetStore();
  writingTargetStore[record.id] = cloneValue(state.writingTargetState);
  writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, writingTargetStore);
  syncLegacyProjectStorageFromState();
  logWritingTargetDebugEvent("info", "project.apply", "Applied project record into editor state.", {
    projectId: record.id,
    title: record.title,
    sceneDraftCount: Object.keys(state.sceneDrafts ?? {}).length,
    writingTargetHistoryEntries: Array.isArray(state.writingTargetState?.history) ? state.writingTargetState.history.length : 0,
    writingTargetDailyBaselineWordCount: state.writingTargetState?.dailyBaselineWordCount ?? 0,
    writingTargetDailyBaselineDateKey: state.writingTargetState?.dailyBaselineDateKey ?? "",
  }, {
    skipUpload: true,
  });
  manuscriptStateLog.info("state-change", "state.hydration.completed", "State hydration completed from active project record.", {
    projectId: record.id,
    sceneDraftCount: Object.keys(state.sceneDrafts ?? {}).length,
    selectedSceneId: state.selectedSceneId ?? "",
  });
}

function createBinderSceneMoveHistoryState() {
  return {
    undoStack: [],
    redoStack: [],
  };
}

function cloneBinderSceneGroups(sceneGroups) {
  return Array.isArray(sceneGroups)
    ? sceneGroups.map((group) => ({
        ...group,
        lines: Array.isArray(group?.lines) ? [...group.lines] : [],
      }))
    : [];
}

function captureSceneSelectionDefaultsForSave() {
  const selectedSceneId = typeof state.selectedSceneId === "string" ? state.selectedSceneId.trim() : "";
  const textarea = selectedSceneId ? getEditorTextareaForScene(selectedSceneId) : null;
  const scene = selectedSceneId ? getScene(selectedSceneId) : null;
  const liveSelection = textarea instanceof HTMLTextAreaElement
    ? captureSceneEditorSelectionSnapshotFromTextarea(textarea)
    : null;
  const snapshot =
    state.sceneEditorSelectionSnapshot &&
    state.sceneEditorSelectionSnapshot.sceneId === selectedSceneId
      ? state.sceneEditorSelectionSnapshot
      : null;

  if (!scene) {
    return {
      blockId: state.selectedBlockId ?? "",
      startOffset: null,
      endOffset: null,
      scrollTop: null,
      scrollLeft: null,
    };
  }

  const resolvedSelection = liveSelection ?? snapshot;
  const startOffset = Number.isInteger(resolvedSelection?.startOffset)
    ? resolvedSelection.startOffset
    : Number.isInteger(textarea?.selectionStart)
      ? textarea.selectionStart
      : 0;
  const endOffset = Number.isInteger(resolvedSelection?.endOffset)
    ? resolvedSelection.endOffset
    : Number.isInteger(textarea?.selectionEnd)
      ? textarea.selectionEnd
      : startOffset;
  const block = findSceneBlockAtOffset(scene, startOffset) ?? scene.blocks.find((candidate) => candidate.blockId === state.selectedBlockId) ?? scene.blocks[0] ?? null;

  return {
    blockId: block?.blockId ?? state.selectedBlockId ?? "",
    lineNumber: Number.isInteger(resolvedSelection?.lineNumber)
      ? resolvedSelection.lineNumber
      : block?.lineNumber ?? null,
    startOffset,
    endOffset,
    scrollTop: Number.isFinite(resolvedSelection?.scrollTop) ? resolvedSelection.scrollTop : null,
    scrollLeft: Number.isFinite(resolvedSelection?.scrollLeft) ? resolvedSelection.scrollLeft : null,
  };
}

// Intent: persist the current inline passage composer so a reload can reopen the same note draft.
function captureInlinePassageDraftDefaultsForSave() {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return null;
  }

  return {
    sceneId: typeof draft.sceneId === "string" ? draft.sceneId : "",
    noteType: draft.noteType === "research" ? "research" : "inspiration",
    selectedText: String(draft.selectedText ?? ""),
    startOffset: Number.isInteger(draft.startOffset) ? draft.startOffset : null,
    endOffset: Number.isInteger(draft.endOffset) ? draft.endOffset : null,
    anchorStartOffset: Number.isInteger(draft.anchorStartOffset) ? draft.anchorStartOffset : null,
    seededSelection: Boolean(draft.seededSelection),
    typedStartOffset: Number.isInteger(draft.typedStartOffset) ? draft.typedStartOffset : null,
    typedEndOffset: Number.isInteger(draft.typedEndOffset) ? draft.typedEndOffset : null,
    body: String(draft.body ?? ""),
    typedText: String(draft.typedText ?? ""),
    editingNoteId: typeof draft.editingNoteId === "string" ? draft.editingNoteId : "",
    x: Number.isFinite(draft.x) ? draft.x : 110,
    y: Number.isFinite(draft.y) ? draft.y : 40,
  };
}

function normalizeSceneSelectionDefaults(candidate, scene) {
  const normalizedSelectionStart = Number.isInteger(candidate?.sceneSelectionStart)
    ? clampEditorOffset(candidate.sceneSelectionStart, scene?.editorText?.length ?? 0)
    : null;
  const normalizedSelectionEnd = Number.isInteger(candidate?.sceneSelectionEnd)
    ? clampEditorOffset(candidate.sceneSelectionEnd, scene?.editorText?.length ?? 0)
    : normalizedSelectionStart;
  const normalizedScrollTop = Number.isFinite(candidate?.sceneSelectionScrollTop)
    ? Math.max(0, candidate.sceneSelectionScrollTop)
    : null;
  const normalizedScrollLeft = Number.isFinite(candidate?.sceneSelectionScrollLeft)
    ? Math.max(0, candidate.sceneSelectionScrollLeft)
    : null;
  const normalizedLineNumber = Number.isInteger(candidate?.sceneSelectionLineNumber)
    ? Math.max(1, candidate.sceneSelectionLineNumber)
    : null;
  const fallbackBlockId =
    typeof candidate?.sceneSelectionBlockId === "string" && candidate.sceneSelectionBlockId.trim()
      ? candidate.sceneSelectionBlockId
      : scene?.blocks?.[0]?.blockId ?? "";

  return {
    blockId: fallbackBlockId,
    lineNumber: normalizedLineNumber,
    startOffset: normalizedSelectionStart,
    endOffset: normalizedSelectionEnd,
    scrollTop: normalizedScrollTop,
    scrollLeft: normalizedScrollLeft,
  };
}

// Intent: restore the inline passage composer only when the project explicitly saved one.
function normalizeInlinePassageDraftDefaults(candidate, scene) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const noteType = candidate.noteType === "research" ? "research" : candidate.noteType === "inspiration" ? "inspiration" : "";
  const sceneId = typeof candidate.sceneId === "string" && candidate.sceneId.trim()
    ? candidate.sceneId.trim()
    : scene?.sceneId ?? "";
  if (!noteType || !sceneId) {
    return null;
  }

  const sceneLength = scene?.editorText?.length ?? 0;
  const startOffset = Number.isInteger(candidate.startOffset)
    ? clampEditorOffset(candidate.startOffset, sceneLength)
    : 0;
  const endOffset = Number.isInteger(candidate.endOffset)
    ? clampEditorOffset(candidate.endOffset, sceneLength)
    : startOffset;
  const anchorStartOffset = Number.isInteger(candidate.anchorStartOffset)
    ? clampEditorOffset(candidate.anchorStartOffset, sceneLength)
    : startOffset;

  return {
    sceneId,
    noteType,
    selectedText: String(candidate.selectedText ?? ""),
    startOffset,
    endOffset,
    anchorStartOffset,
    seededSelection: Boolean(candidate.seededSelection),
    typedStartOffset: Number.isInteger(candidate.typedStartOffset)
      ? clampEditorOffset(candidate.typedStartOffset, sceneLength)
      : null,
    typedEndOffset: Number.isInteger(candidate.typedEndOffset)
      ? clampEditorOffset(candidate.typedEndOffset, sceneLength)
      : null,
    body: String(candidate.body ?? ""),
    typedText: String(candidate.typedText ?? ""),
    editingNoteId: typeof candidate.editingNoteId === "string" ? candidate.editingNoteId : "",
    x: Number.isFinite(candidate.x) ? candidate.x : 110,
    y: Number.isFinite(candidate.y) ? candidate.y : 40,
  };
}

function restoreSceneSelectionRange(selection) {
  const sceneId = typeof state.selectedSceneId === "string" ? state.selectedSceneId.trim() : "";
  if (!sceneId) {
    return;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const lineNumber = Number.isInteger(selection?.lineNumber)
    ? Math.max(1, selection.lineNumber)
    : null;
  const startOffset = Number.isInteger(selection?.startOffset)
    ? clampEditorOffset(selection.startOffset, textarea.value.length)
    : null;
  const endOffset = Number.isInteger(selection?.endOffset)
    ? clampEditorOffset(selection.endOffset, textarea.value.length)
    : startOffset;
  const blockId = typeof selection?.blockId === "string" && selection.blockId.trim()
    ? selection.blockId
    : "";

  if (lineNumber) {
    const style = window.getComputedStyle(textarea);
    const fontSize = parseFloat(style.fontSize || "0") || 16;
    const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
    const charactersPerLine = Math.max(
      8,
      Math.floor(textarea.clientWidth / approximateCharacterWidth),
    );
    const sceneMetrics = buildSceneLineMetrics(
      state.scenes,
      charactersPerLine,
      { [scene.sceneId]: textarea.value },
    ).find((candidate) => candidate.sceneId === scene.sceneId);
    const relativeLineNumber = Math.max(0, lineNumber - (sceneMetrics?.startLineNumber ?? lineNumber));
    const lineEndOffset = findEditorOffsetForVisualLineEnd(
      textarea.value,
      relativeLineNumber,
      charactersPerLine,
    );
    const lineBlock = scene.blocks.find((candidate) => candidate.lineNumber === lineNumber) ?? null;
    const resolvedBlock =
      lineBlock
      ?? findSceneBlockAtOffset(scene, lineEndOffset)
      ?? scene.blocks.find((candidate) => candidate.blockId === blockId)
      ?? scene.blocks[0]
      ?? null;
    if (resolvedBlock) {
      state.selectedBlockId = resolvedBlock.blockId;
    }

    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(lineEndOffset, lineEndOffset, "forward");
    takeToEditorOffset(textarea, lineEndOffset, { behavior: "auto" });
    return;
  }

  if (startOffset === null || endOffset === null) {
    const targetBlock =
      blockId
        ? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? null
        : Number.isInteger(selection?.lineNumber)
          ? scene.blocks.find((candidate) => candidate.lineNumber === selection.lineNumber) ?? null
          : null;
    if (targetBlock) {
      const blockRange = getSceneBlockRanges(scene).find((candidate) => candidate.blockId === targetBlock.blockId) ?? null;
      const targetOffset = blockRange?.endOffset ?? targetBlock.text.length;
      state.selectedBlockId = targetBlock.blockId;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(targetOffset, targetOffset, "forward");
      takeToEditorOffset(textarea, targetOffset, { behavior: "auto" });
      return;
    }

    const block = blockId
      ? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? null
      : scene.blocks[0] ?? null;
    if (block) {
      state.selectedBlockId = block.blockId;
      return;
    }
    return;
  }

  const block = findSceneBlockAtOffset(scene, startOffset) ?? scene.blocks.find((candidate) => candidate.blockId === blockId) ?? scene.blocks[0] ?? null;
  if (block) {
    state.selectedBlockId = block.blockId;
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
  takeToEditorOffset(textarea, startOffset, { behavior: "auto" });
}

// Intent: cache the current scene editor caret and viewport so autosave can persist it reliably.
function captureSceneEditorSelectionSnapshotFromTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const sceneId = typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId.trim() : "";
  if (!sceneId) {
    return null;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const codeframe = textarea.closest(".scene-editor-codeframe");
  const startOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const endOffset = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : startOffset;
  const block = findSceneBlockAtOffset(scene, startOffset) ?? scene.blocks[0] ?? null;
  const lineNumber = getSceneEditorSelectionLineNumber(textarea, scene, startOffset);

  return {
    sceneId,
    blockId: block?.blockId ?? "",
    lineNumber,
    startOffset,
    endOffset,
    scrollTop: codeframe instanceof HTMLElement ? codeframe.scrollTop : null,
    scrollLeft: codeframe instanceof HTMLElement ? codeframe.scrollLeft : null,
  };
}

function updateSceneEditorSelectionSnapshotFromTextarea(textarea) {
  const snapshot = captureSceneEditorSelectionSnapshotFromTextarea(textarea);
  if (!snapshot) {
    return;
  }

  state.sceneEditorSelectionSnapshot = snapshot;
}

// Intent: convert the current caret position into a stable manuscript line number for save/restore.
function getSceneEditorSelectionLineNumber(textarea, scene, offset = null) {
  if (!(textarea instanceof HTMLTextAreaElement) || !scene) {
    return null;
  }

  const style = window.getComputedStyle(textarea);
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const charactersPerLine = Math.max(
    8,
    Math.floor(textarea.clientWidth / approximateCharacterWidth),
  );
  const selectedSceneMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    { [scene.sceneId]: textarea.value },
  ).find((candidate) => candidate.sceneId === scene.sceneId);
  const caretOffset = Number.isInteger(offset) ? offset : Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const visualLineOffset = estimateVisualLineBeforeOffset(textarea.value, caretOffset, charactersPerLine);
  return (selectedSceneMetrics?.startLineNumber ?? 1) + visualLineOffset;
}

// Intent: resolve a persisted visual line number back to the end of that wrapped line in the editor.
function findEditorOffsetForVisualLineEnd(text, targetVisualLineIndex, charactersPerLine) {
  const safeTargetIndex = Math.max(0, Math.floor(Number(targetVisualLineIndex) || 0));
  const logicalLines = String(text ?? "").split("\n");
  let visualLineIndex = 0;
  let logicalStartOffset = 0;

  for (const logicalLine of logicalLines) {
    const lineLength = logicalLine.length;
    const wrappedLineCount = Math.max(1, Math.ceil(lineLength / charactersPerLine));
    if (safeTargetIndex < visualLineIndex + wrappedLineCount) {
      const relativeLineIndex = safeTargetIndex - visualLineIndex;
      const endOffsetWithinLine = Math.min(lineLength, (relativeLineIndex + 1) * charactersPerLine);
      return logicalStartOffset + endOffsetWithinLine;
    }

    visualLineIndex += wrappedLineCount;
    logicalStartOffset += lineLength + 1;
  }

  return String(text ?? "").length;
}

function restoreSelectionFromWorkspaceDefaults() {
  const selectionDefaults = state.workspace?.selectionDefaults ?? {};
  state.selectedIssueId = selectionDefaults.issueId ?? null;
  state.selectedNodeId = selectionDefaults.nodeId ?? null;
  state.selectedEntityId = selectionDefaults.entityId ?? null;

  const preferredDraft = normalizeInlinePassageDraftDefaults(
    selectionDefaults.inlinePassageDraft,
    null,
  );
  const preferredSceneId = typeof selectionDefaults.sceneId === "string" ? selectionDefaults.sceneId.trim() : "";
  const sceneIdForRestore = preferredDraft?.sceneId || preferredSceneId;
  if (sceneIdForRestore) {
    const preferredScene = getScene(sceneIdForRestore);
    if (preferredScene) {
      const sceneSelection = normalizeSceneSelectionDefaults(selectionDefaults, preferredScene);
      const inlinePassageDraft = normalizeInlinePassageDraftDefaults(selectionDefaults.inlinePassageDraft, preferredScene);
      selectSceneById(preferredScene.sceneId);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (inlinePassageDraft) {
            restoreInlinePassageDraftFromWorkspaceDefaults(inlinePassageDraft);
          }
          window.requestAnimationFrame(() => {
            restoreSceneSelectionRange(sceneSelection);
            state.sceneEditorSelectionSnapshot = {
              sceneId: preferredScene.sceneId,
              blockId: sceneSelection.blockId ?? "",
              lineNumber: sceneSelection.lineNumber ?? null,
              startOffset: sceneSelection.startOffset ?? null,
              endOffset: sceneSelection.endOffset ?? null,
              scrollTop: sceneSelection.scrollTop ?? null,
              scrollLeft: sceneSelection.scrollLeft ?? null,
            };
          });
        });
      });
      return;
    }
  }

  syncSelectionFromBlock(selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null);
}

// Intent: reopen a saved inline passage composer after scene selection has been restored.
function restoreInlinePassageDraftFromWorkspaceDefaults(draft) {
  if (!draft || draft.sceneId !== state.selectedSceneId) {
    return;
  }

  state.sidePanelMode = draft.noteType;
  state.inlinePassageDraft = draft;
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const noteField = document.querySelector("[data-edit-field='inline-passage-note']");
    if (noteField instanceof HTMLTextAreaElement) {
      noteField.focus({ preventScroll: true });
      noteField.setSelectionRange(noteField.value.length, noteField.value.length);
    }
  });
}

// Intent: mirror canonical project-library state into older browser keys during migration only.
function syncLegacyProjectStorageFromState() {
  if (!state.workspace) {
    return;
  }

  writeStoredJsonRaw(EDITOR_PROJECT_TITLE_KEY, state.projectTitle);
  writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, state.projectSourcePath);
  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  writeStoredJsonRaw(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  writeStoredJsonRaw(EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts);
  writeStoredJsonRaw(EDITOR_TASKS_KEY, state.manuscriptTasks);
  writeStoredJsonRaw(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  writeStoredJsonRaw(EDITOR_PREFS_KEY, state.editorPrefs);
  writeStoredJsonRaw(EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs);
}

function clearProjectFileAutosaveTimer() {
  projectPersistenceService.clearProjectAutosaveTimer();
}

function beginProjectFileAutosaveSuppression() {
  projectPersistenceService.beginProjectAutosaveSuppression();
}

function endProjectFileAutosaveSuppression() {
  projectPersistenceService.endProjectAutosaveSuppression();
}

function queueProjectFileAutosave() {
  projectPersistenceService.queueProjectAutosave();
}

function markProjectFileAutosaveDirty() {
  projectPersistenceService.markProjectAutosaveDirty();
}

// Intent: sync the autosave destination after project switches without marking a clean project dirty.
function primeProjectFileAutosave() {
  projectPersistenceService.primeProjectAutosaveTarget();
}

function clearProjectFileAutosaveState() {
  projectPersistenceService.clearProjectAutosaveState();
}

function shouldPersistProjectCache() {
  return state.projectCacheSuppressionDepth === 0;
}

// Intent: keep in-browser project records synchronized with the active app-native project snapshot.
function persistCurrentProjectRecord(options = {}) {
  projectPersistenceService.commitCanonicalProjectMutation(options);
}

function loadSelectedProject() {
  const projectId = state.projectLibrarySelectionId ?? state.activeProjectId;
  const record = state.projectLibrary.find((project) => project.id === projectId) ?? state.projectLibrary[0];
  if (!record) {
    projectLoadGateLog.warn("validation", "project.load.skipped", "No project record available to load from selection.", {
      requestedProjectId: projectId ?? "",
    });
    return;
  }

  projectLoadGateLog.info("user-action", "project.load.begin", "Loading selected project.", {
    projectId: record.id,
    title: record.title,
  });

  logWritingTargetDebugEvent("info", "project.load-selected", "Loading selected project.", {
    projectId: record.id,
    title: record.title,
  });
  applyProjectRecord(record);
  refreshScenes();
  restoreSelectionFromWorkspaceDefaults();
  syncWritingTargetState({ forceReload: true });
  refreshWritingTargetSessionLifecycle({ reason: "load-project" });
  logWritingTargetLoadCheckpoint("load-project");
  projectPersistenceService.syncActiveProjectFileDestinationFromRecord({
    persistDesktopProjectFilePath: true,
    source: "loadSelectedProject",
  });
  render();
  primeProjectFileAutosave();
  recordWritingTargetSnapshot({ immediate: true, reason: "load-project", skipProjectFileAutosave: true });
  projectLoadGateLog.info("lifecycle", "project.load.completed", "Selected project loaded into editor.", {
    projectId: record.id,
    selectedSceneId: state.selectedSceneId ?? "",
  });
  if (state.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Loaded saved project from library.", {
      projectId: record.id,
      title: record.title,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
    });
  }
}

// Intent: expose project-file labels through the shared display resolver so chrome and panels stay consistent.
function getSuggestedProjectFilePath() {
  return getSuggestedProjectFilePathFromProject({
    projectTitle: state.projectTitle || state.workspace?.project?.title || "Untitled Project",
    projectRoot: state.workspace?.settings?.projectRoot ?? "",
  });
}

function getSuggestedProjectFileName() {
  return getSuggestedProjectFileNameFromTitle(state.projectTitle || state.workspace?.project?.title || "Untitled Project");
}

function hasProjectFileDestination() {
  return projectPersistenceService.hasProjectSaveDestination();
}

function getProjectFileDisplayState() {
  return projectPersistenceService.getProjectFileDisplayState();
}

function setProjectFilePath(pathValue, handle = null, options = {}) {
  projectPersistenceService.setActiveProjectFileDestination(pathValue, handle, options);
}

// Intent: build the canonical payload written to every `.abe-project.json` destination.
function createProjectLibrarySnapshotForFile() {
  return projectPersistenceService.buildProjectSnapshotForSaveFile();
}

function collectWorkspaceSceneWordCounts(projectRecord) {
  const counts = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  for (const line of lines) {
    const sceneId = typeof line?.sceneId === "string" ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }
    const nextCount = (counts.get(sceneId) ?? 0) + countWords(line?.text);
    counts.set(sceneId, nextCount);
  }
  return counts;
}

function buildProjectIndexForRecord(projectRecord, persistedProjectIndex = null) {
  const computedIndex = projectService.getProjectIndex({
    projectRecord,
  });
  const persistedScenes = Array.isArray(persistedProjectIndex?.scenes)
    ? persistedProjectIndex.scenes
    : [];
  if (!persistedScenes.length) {
    return computedIndex;
  }

  const persistedSceneWordCounts = new Map();
  for (const scene of persistedScenes) {
    const sceneId = typeof scene?.id === "string" ? scene.id.trim() : "";
    const wordCount = Number(scene?.wordCount);
    if (!sceneId || !Number.isFinite(wordCount) || wordCount < 0) {
      continue;
    }
    persistedSceneWordCounts.set(sceneId, Math.max(0, Math.round(wordCount)));
  }
  if (!persistedSceneWordCounts.size) {
    return computedIndex;
  }

  const workspaceSceneWordCounts = collectWorkspaceSceneWordCounts(projectRecord);
  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  const mergedScenes = computedIndex.scenes.map((scene) => {
    const sceneId = typeof scene?.id === "string" ? scene.id.trim() : "";
    if (!sceneId) {
      return scene;
    }
    const hasLoadedDraft = sceneDrafts[sceneId] && typeof sceneDrafts[sceneId] === "object";
    const workspaceWordCount = workspaceSceneWordCounts.get(sceneId) ?? 0;
    if (hasLoadedDraft || workspaceWordCount > 0) {
      return scene;
    }
    if (!persistedSceneWordCounts.has(sceneId)) {
      return scene;
    }

    return {
      ...scene,
      wordCount: persistedSceneWordCounts.get(sceneId),
    };
  });

  return {
    ...computedIndex,
    scenes: mergedScenes,
  };
}

function buildWorkspaceStatsFromProjectIndex(projectIndex, currentStats = {}) {
  const chapters = Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [];
  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  return {
    ...(currentStats && typeof currentStats === "object" && !Array.isArray(currentStats) ? currentStats : {}),
    chapterCount: chapters.length,
    sceneCount: scenes.length,
    lineCount: scenes.reduce((total, scene) => total + Math.max(0, Math.round(Number(scene?.lineCount) || 0)), 0),
  };
}

async function saveProjectLibraryToBrowserHandle(handle, snapshot = createProjectLibrarySnapshotForFile()) {
  return projectPersistenceService.saveProjectSnapshotToBrowserHandle(handle, snapshot);
}

// Intent: write project saves through the desktop path bridge when the host exposes a durable filesystem path.
async function saveProjectLibraryToFile(filePath, snapshot = createProjectLibrarySnapshotForFile()) {
  return projectPersistenceService.saveProjectSnapshotToFilePath(filePath, snapshot);
}

// Intent: load project files into active state and immediately retarget autosave to the loaded destination.
async function loadProjectLibrarySnapshotIntoState(loadedSnapshot, options = {}) {
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot(loadedSnapshot, options);
}

async function loadProjectLibraryFromBrowserHandle(handle) {
  await projectPersistenceService.loadProjectSnapshotFromBrowserHandle(handle);
}

async function loadProjectLibraryFromBrowserFile(file, options = {}) {
  await projectPersistenceService.loadProjectSnapshotFromBrowserFile(file, options);
}

function downloadProjectLibrarySnapshot(snapshot, fileName = getSuggestedProjectFileName()) {
  return projectPersistenceService.exportProjectLibrarySnapshot(snapshot, fileName);
}

async function loadProjectLibraryFromFile() {
  await projectPersistenceService.loadProjectSnapshotFromFile();
}

async function saveCurrentProject() {
  await projectPersistenceService.saveProjectSnapshot({ reason: "save-project" });
}

async function saveCurrentProjectFileAs() {
  await projectPersistenceService.saveProjectSnapshotAs();
}

function createProject() {
  const now = new Date().toISOString();
  const baseWorkspace = state.workspace ?? state.projectLibrary[0]?.workspace;
  const defaultTitle = "Untitled Project";
  const requestedTitle = promptForProjectTitle({
    message: "Name your new project:",
    defaultTitle,
    windowRef: window,
  });
  if (requestedTitle === null) {
    state.projectFileStatus = "Project creation cancelled.";
    uiEventDispatcherLog.info("user-action", "project.create.cancelled", "Project creation cancelled by user.");
    renderHeader();
    return;
  }
  const title = requestedTitle.trim() || defaultTitle;
  const projectId = `project-${now.replace(/[^0-9A-Za-z]/g, "").slice(0, 14) || Date.now()}`;
  const workspace = createBlankWorkspaceSnapshot(baseWorkspace, projectId, title, now);
  const record = createProjectLibraryRecordFromWorkspace(workspace, {
    id: projectId,
    title,
    source: "user-created",
    createdAt: now,
    updatedAt: now,
    sceneDrafts: {},
    structureDrafts: createStructureDrafts(),
    templateDrafts: createTemplateDrafts(),
    manuscriptTasks: [],
    passageNotes: [],
    editorPrefs: createDefaultEditorPrefs(),
    localAiPrefs: createDefaultLocalAiPrefs(),
  });

  state.projectLibrary = [...state.projectLibrary.filter((project) => project.id !== record.id), record];
  projectPersistenceLog.info("state-change", "project.create", "Created a new project record.", {
    projectId: record.id,
    title: record.title,
  });
  applyProjectRecord(record);
  refreshScenes();
  restoreSelectionFromWorkspaceDefaults();
  syncWritingTargetState({ forceReload: true });
  setProjectFilePath(getSuggestedProjectFilePath(), null, { skipProjectFileAutosave: true });
  persistCurrentProjectRecord({ skipProjectFileAutosave: true });
  render();
  recordWritingTargetSnapshot({ immediate: true, reason: "create-project", skipProjectFileAutosave: true });
  if (state.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Created a new project.", {
      projectId: record.id,
      title: record.title,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
    });
  }
}

async function loadProjectSource() {
  const projectPath = state.projectSourcePath.trim();
  if (!projectPath) {
    state.projectSourceStatus = "Enter a local project source path.";
    projectLoadGateLog.warn("validation", "project-source.load.missing-path", "Load project source skipped because no source path was entered.");
    renderHeader();
    return;
  }

  state.projectSourceBusy = true;
  state.projectSourceStatus = "Loading project source...";
  projectLoadGateLog.info("user-action", "project-source.load.begin", "Loading project source from path.", {
    projectPath,
  });
  renderHeader();

  try {
    const response = await fetchJsonFromDesktopApi("/api/project-source", {
      method: "POST",
      body: {
        projectPath,
      },
    });

    if (!response.ok) {
      throw response.error ?? new Error("Project source load failed.");
    }

    const importedLibrary = normalizeProjectLibrarySnapshot(response.value);
    const currentLibrary = normalizeProjectLibrarySnapshot({
      activeProjectId: state.activeProjectId,
      projects: state.projectLibrary,
    });
    const mergedLibrary = mergeProjectLibrarySnapshots(currentLibrary, importedLibrary, null);
    const activeProjectId = resolveActiveProjectId(
      importedLibrary.activeProjectId ?? mergedLibrary.activeProjectId,
      mergedLibrary,
    );

    const persistedLibrary = projectService.saveProjectLibrarySnapshot({
      activeProjectId,
      projects: mergedLibrary.projects,
    });
    state.projectLibrary = persistedLibrary.projects;
    state.activeProjectId = persistedLibrary.activeProjectId;
    state.projectLibrarySelectionId = persistedLibrary.activeProjectId;

    const record = getActiveProjectRecord();
    if (!record) {
      throw new Error("Unable to activate the loaded project source.");
    }

    applyProjectRecord(record);
    refreshScenes();
    restoreSelectionFromWorkspaceDefaults();
    syncWritingTargetState({ forceReload: true });
    if (state.workspace?.project?.stats) {
      state.projectSourceStatus = `Loaded ${record.title} · ${state.workspace.project.stats.chapterCount} chapters, ${state.workspace.project.stats.sceneCount} scenes`;
    }
    render();
    recordWritingTargetSnapshot({ immediate: true, reason: "load-project-source", skipProjectFileAutosave: true });
    projectLoadGateLog.info("lifecycle", "project-source.load.completed", "Project source loaded and applied.", {
      projectPath,
      projectId: record.id,
      title: record.title,
    });

    if (state.workspace?.project?.stats) {
      reportBrowserLog("info", "project-source", "Loaded a project source into saved projects.", {
        projectPath,
        projectId: record.id,
        title: record.title,
        chapters: state.workspace.project.stats.chapterCount,
        scenes: state.workspace.project.stats.sceneCount,
        templates: state.workspace.world?.stats?.templateCount ?? 0,
      });
    }
  } catch (error) {
    state.projectSourceStatus = `Load failed: ${error instanceof Error ? error.message : String(error)}`;
    projectLoadGateLog.error("persistence", "project-source.load.failed", "Project source load failed.", {
      projectPath,
      error,
    });
    reportBrowserLog("error", "project-source", "Project source load failed.", {
      projectPath,
      error,
    });
    renderHeader();
  } finally {
    state.projectSourceBusy = false;
    projectLoadGateLog.debug("lifecycle", "project-source.load.end", "Project source load flow finished.", {
      projectPath,
      status: state.projectSourceStatus,
    });
    renderHeader();
  }
}

function createBlankWorkspaceSnapshot(baseWorkspace, projectId, title, now) {
  const templateWorkspace = cloneValue(baseWorkspace ?? state.workspace ?? {});
  const workspaceTitle =
    typeof templateWorkspace.workspaceTitle === "string" && templateWorkspace.workspaceTitle.trim()
      ? templateWorkspace.workspaceTitle
      : "ABetterNovelAuthoringEnvironment";
  const chapterId = "chapter-0001";
  const sceneId = "scene-0001";
  const blockId = "block-0001";
  const paragraphId = "paragraph-0001";
  const chapterTitle = "Chapter 1";
  const sceneTitle = "Scene 1";
  const starterLine = {
    id: blockId,
    blockId,
    paragraphId,
    lineNumber: 1,
    sceneLineNumber: 1,
    kind: "narration",
    speakerLabel: "",
    text: "",
    chapterId,
    chapterTitle,
    sceneId,
    sceneTitle,
    sceneSynopsis: "",
    startsChapter: true,
    startsScene: true,
    issueIds: [],
    eventTagIds: [],
  };
  const project = {
    id: projectId,
    title,
    binder: {
      id: projectId,
      kind: "project",
      refId: projectId,
      title,
      order: 1,
      children: [
        {
          id: `binder-${chapterId}`,
          kind: "chapter",
          refId: chapterId,
          title: chapterTitle,
          order: 1,
          children: [
            {
              id: `binder-${sceneId}`,
              kind: "scene",
              refId: sceneId,
              title: sceneTitle,
              order: 1,
              children: [],
            },
          ],
        },
      ],
    },
    stats: {
      chapterCount: 1,
      sceneCount: 1,
      lineCount: 1,
      issueCount: 0,
      eventCount: 0,
      characterCount: 0,
    },
    navigationTargets: {
      [projectId]: {
        refId: projectId,
        kind: "project",
        title,
        lineId: blockId,
        lineNumber: 1,
      },
      [chapterId]: {
        refId: chapterId,
        kind: "chapter",
        title: chapterTitle,
        lineId: blockId,
        lineNumber: 1,
      },
      [sceneId]: {
        refId: sceneId,
        kind: "scene",
        title: sceneTitle,
        lineId: blockId,
        lineNumber: 1,
      },
    },
    lines: [starterLine],
    issues: [],
    eventTags: [],
    characters: [],
  };
  const world = {
    id: `world-${projectId}`,
    title: `${title} World`,
    stats: {
      templateCount: 0,
      entityCount: 0,
      spineCount: 0,
      nodeCount: 0,
      edgeCount: 0,
    },
    templates: [],
    entities: [],
    spines: [],
    edges: [],
  };
  const providerFallbacks = templateWorkspace?.analysis ?? {};
  const audioProvider = templateWorkspace?.narration?.provider ?? {
    id: "local-audio-service",
    label: "Local Audio",
    availability: "ready",
    alignmentStrategy: "line-based",
  };
  const voiceProvider = templateWorkspace?.voice?.provider ?? {
    id: "local-voice-service",
    label: "Local Voice",
    availability: "ready",
    synthesisMode: "local",
  };
  const analysisProvider = providerFallbacks.provider ?? {
    id: "local-rule-analysis",
    label: "Local Rule Analysis",
    availability: "ready",
    executionMode: "local-only",
  };

  return {
    generatedAt: now,
    workspaceTitle,
    settings: cloneValue(templateWorkspace.settings ?? {
      executionMode: "local-only",
      modelRoot: "",
      assetRoot: "",
      projectRoot: "",
    }),
    project,
    world,
    analysis: {
      provider: analysisProvider,
      lastJob: {
        id: `analysis-${projectId}`,
        type: "analysis",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        request: {
          projectId,
          trigger: "manual",
        },
        result: {
          providerId: analysisProvider.id,
          issueCount: 0,
          eventCount: 0,
          suggestionCount: 0,
        },
      },
      suggestionQueue: [],
    },
    narration: {
      provider: audioProvider,
      session: {
        id: `narration-${projectId}`,
        projectId,
        providerId: audioProvider.id,
        sessionLabel: title,
        status: "paused",
        currentAnchor: {
          projectId,
          chapterId,
          sceneId,
          blockId,
          paragraphId,
          startOffset: 0,
          endOffset: 0,
        },
        currentLineNumber: 1,
        currentText: "",
        updatedAt: now,
      },
      alignmentJobs: [],
    },
    voice: {
      provider: voiceProvider,
      profiles: cloneValue(templateWorkspace?.voice?.profiles ?? []),
      bindings: [],
      renderJobs: [],
      recordings: [],
    },
    selectionDefaults: {
      lineId: blockId,
    },
  };
}

// Intent: resolve DOM events back to stable scene and selection context for anchored editor actions.
function getEditorContextFromEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.closest("[data-inline-passage-draft]")) {
    return null;
  }

  const codeframe = target.closest("[data-scene-editor]");
  const textarea =
    target instanceof HTMLTextAreaElement && target.classList.contains("editor-document-input")
      ? target
      : codeframe?.querySelector(".editor-document-input");

  if (!(codeframe instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (!(target instanceof HTMLTextAreaElement)) {
    const cursorOffset = textarea.value.length;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(cursorOffset, cursorOffset);
  }

  const contextRange = getEditorContextRange(textarea) ?? {
    selectedText: "",
    startOffset: textarea.selectionStart,
    endOffset: textarea.selectionStart,
    hasExplicitSelection: false,
  };

  return {
    textarea,
    contextRange,
    inlinePosition: getInlinePassagePosition(codeframe, event),
  };
}

function getSpellcheckContextFromEvent(editorContext, event) {
  if (!spellcheckBaseLexicon?.wordList?.length || !editorContext) {
    return null;
  }

  const { textarea, contextRange } = editorContext;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const sceneId = String(textarea.dataset.sceneId ?? "");
  if (!sceneId) {
    return null;
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const explicitSelection = contextRange?.hasExplicitSelection === true;
  const selectionText = explicitSelection ? String(contextRange.selectedText ?? "").trim() : "";
  const selectionLooksLikeOneWord = selectionText && !/\s/.test(selectionText);
  if (explicitSelection && selectionText) {
    const selectionMisspellings = collectSpellcheckMisspellings(selectionText, {
      baseLexicon: spellcheckBaseLexicon,
      projectLexicon,
      referenceLexicon: spellcheckReferenceLexicon,
    });
    if (!selectionMisspellings.length) {
      return null;
    }

    const words = getSpellcheckProjectWordsFromSelection(selectionMisspellings);
    const mode = words.length > 1 ? "selection" : "word";
    const firstWord = selectionMisspellings[0];
    return {
      sceneId,
      mode,
      words,
      word: firstWord?.word ?? selectionText,
      normalizedWord: firstWord?.normalizedWord ?? normalizeSpellcheckWord(selectionText),
      startOffset: contextRange.startOffset,
      endOffset: contextRange.endOffset,
      selectionText,
      suggestions: mode === "word"
        ? suggestSpellcheckAlternatives(firstWord?.word ?? selectionText, {
          baseLexicon: spellcheckBaseLexicon,
          projectLexicon,
          referenceLexicon: spellcheckReferenceLexicon,
        })
        : [],
      x: event.clientX,
      y: event.clientY,
      count: words.length,
    };
  }

  let wordRange = getSpellcheckWordRangeFromPointer(textarea, event);
  if (!wordRange) {
    const caretOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : contextRange?.startOffset ?? 0;
    wordRange = getSpellcheckWordRange(textarea.value, caretOffset);
  }

  if (!wordRange || !wordRange.word) {
    return null;
  }

  if (!isSpellcheckMisspelledWord(wordRange.word, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon,
    referenceLexicon: spellcheckReferenceLexicon,
  })) {
    return null;
  }

  return {
    sceneId,
    mode: "word",
    words: [wordRange.word],
    word: wordRange.word,
    normalizedWord: wordRange.normalizedWord,
    startOffset: wordRange.startOffset,
    endOffset: wordRange.endOffset,
    suggestions: suggestSpellcheckAlternatives(wordRange.word, {
      baseLexicon: spellcheckBaseLexicon,
      projectLexicon,
      referenceLexicon: spellcheckReferenceLexicon,
    }),
    x: event.clientX,
    y: event.clientY,
    count: 1,
  };
}

function getSpellcheckContextFromGrammarCheckTarget(target, event) {
  if (!spellcheckBaseLexicon?.wordList?.length || !(target instanceof HTMLElement)) {
    return null;
  }

  const scene = getSelectedScene() ?? state.scenes[0] ?? null;
  const sceneId = String(scene?.sceneId ?? "");
  if (!scene || !sceneId) {
    return null;
  }

  const word = String(target.dataset.grammarCheckWord ?? "").trim();
  const normalizedWord = normalizeSpellcheckWord(word);
  const firstIndex = Number(target.dataset.grammarCheckFirstIndex);
  if (!normalizedWord || !Number.isInteger(firstIndex)) {
    return null;
  }

  const sourceText = String(scene.editorText ?? "");
  const originalWord = sourceText.slice(firstIndex, firstIndex + word.length) || word;
  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const suggestions = suggestSpellcheckAlternatives(originalWord, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon,
    referenceLexicon: spellcheckReferenceLexicon,
  });

  return {
    sceneId,
    mode: "word",
    words: [originalWord],
    word: originalWord,
    normalizedWord,
    startOffset: firstIndex,
    endOffset: firstIndex + originalWord.length,
    suggestions,
    x: event.clientX,
    y: event.clientY,
    count: 1,
  };
}

function getSpellcheckWordRangeFromPointer(textarea, event) {
  if (!(textarea instanceof HTMLTextAreaElement) || !(event instanceof MouseEvent)) {
    return null;
  }

  const offset = getTextareaOffsetFromPoint(textarea, event.clientX, event.clientY);
  if (!Number.isInteger(offset)) {
    return null;
  }

  return getSpellcheckWordRange(textarea.value, offset);
}

function getTextareaOffsetFromPoint(textarea, clientX, clientY) {
  const rect = textarea.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const textNode = document.createTextNode(textarea.value ?? "");
  mirror.setAttribute("aria-hidden", "true");
  mirror.setAttribute("role", "presentation");
  mirror.style.position = "fixed";
  mirror.style.left = `${Math.round(rect.left)}px`;
  mirror.style.top = `${Math.round(rect.top)}px`;
  mirror.style.width = `${Math.round(rect.width)}px`;
  mirror.style.height = `${Math.round(rect.height)}px`;
  mirror.style.margin = "0";
  mirror.style.borderTopStyle = style.borderTopStyle;
  mirror.style.borderRightStyle = style.borderRightStyle;
  mirror.style.borderBottomStyle = style.borderBottomStyle;
  mirror.style.borderLeftStyle = style.borderLeftStyle;
  mirror.style.borderTopWidth = style.borderTopWidth;
  mirror.style.borderRightWidth = style.borderRightWidth;
  mirror.style.borderBottomWidth = style.borderBottomWidth;
  mirror.style.borderLeftWidth = style.borderLeftWidth;
  mirror.style.borderTopLeftRadius = style.borderTopLeftRadius;
  mirror.style.borderTopRightRadius = style.borderTopRightRadius;
  mirror.style.borderBottomLeftRadius = style.borderBottomLeftRadius;
  mirror.style.borderBottomRightRadius = style.borderBottomRightRadius;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.font = style.font || "";
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.tabSize = style.tabSize;
  mirror.style.textIndent = style.textIndent;
  mirror.style.textTransform = style.textTransform;
  mirror.style.overflowWrap = style.overflowWrap;
  mirror.style.wordBreak = style.wordBreak;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflow = "auto";
  mirror.style.background = "transparent";
  mirror.style.color = "transparent";
  mirror.style.caretColor = "transparent";
  mirror.style.opacity = "0";
  mirror.style.pointerEvents = "auto";
  mirror.style.zIndex = "2147483647";
  mirror.append(textNode);
  document.body.append(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;

  try {
    const caretPoint = getCaretPointFromMirror(mirror, clientX, clientY);
    if (!caretPoint) {
      return null;
    }

    return getOffsetFromCaretPoint(mirror, caretPoint);
  } finally {
    mirror.remove();
  }
}

function getCaretPointFromMirror(mirror, clientX, clientY) {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(clientX, clientY);
    if (position?.offsetNode && mirror.contains(position.offsetNode)) {
      return {
        node: position.offsetNode,
        offset: position.offset,
      };
    }
  }

  if (typeof document.caretRangeFromPoint === "function") {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range?.startContainer && mirror.contains(range.startContainer)) {
      return {
        node: range.startContainer,
        offset: range.startOffset,
      };
    }
  }

  return null;
}

async function loadDesktopSettingsSnapshot() {
  const settingsResponse = await fetchJsonFromDesktopApi("/api/settings");
  if (!settingsResponse.ok) {
    reportBrowserLog("warn", "settings", "Unable to load the desktop settings snapshot.", {
      error: settingsResponse.error,
      attemptedUrls: settingsResponse.attemptedUrls,
    });
    return {
      projectRoot: "",
      lastProjectFilePath: "",
    };
  }

  const candidate = settingsResponse.value && typeof settingsResponse.value === "object"
    ? settingsResponse.value
    : {};
  return {
    projectRoot: normalizeProjectFilePath(candidate.projectRoot ?? ""),
    lastProjectFilePath: normalizeProjectFilePath(candidate.lastProjectFilePath ?? ""),
    lastProjectFilePathExplicit: candidate.lastProjectFilePathExplicit === true,
  };
}

function getOffsetFromCaretPoint(root, caretPoint) {
  if (!(root instanceof Node) || !caretPoint?.node) {
    return null;
  }

  const targetNode = caretPoint.node;
  const targetOffset = Number(caretPoint.offset);
  if (!Number.isInteger(targetOffset) || targetOffset < 0) {
    return null;
  }

  if (targetNode.nodeType === Node.TEXT_NODE) {
    return getTextNodeOffsetWithinRoot(root, targetNode, targetOffset);
  }

  const range = document.createRange();
  try {
    range.setStart(root, 0);
    range.setEnd(targetNode, targetOffset);
    return range.toString().length;
  } catch {
    return null;
  }
}

function getTextNodeOffsetWithinRoot(root, targetNode, nodeOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let runningOffset = 0;

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const currentLength = currentNode.textContent?.length ?? 0;
    if (currentNode === targetNode) {
      return runningOffset + Math.max(0, Math.min(nodeOffset, currentLength));
    }

    runningOffset += currentLength;
  }

  return null;
}

function collectSpellcheckCorpusTexts() {
  const texts = [];

  if (typeof state.projectTitle === "string" && state.projectTitle.trim()) {
    texts.push(state.projectTitle);
  }

  if (state.workspace?.project?.binder) {
    collectSpellcheckBinderTexts(state.workspace.project.binder, texts);
  }

  for (const scene of state.scenes) {
    if (scene?.chapterTitle) {
      texts.push(scene.chapterTitle);
    }
    if (scene?.sceneTitle) {
      texts.push(scene.sceneTitle);
    }
    if (scene?.sceneSynopsis) {
      texts.push(scene.sceneSynopsis);
    }
    if (scene?.editorText) {
      texts.push(scene.editorText);
    }
  }

  for (const task of state.manuscriptTasks) {
    if (task?.title) {
      texts.push(task.title);
    }
    if (task?.body) {
      texts.push(task.body);
    }
    if (task?.description) {
      texts.push(task.description);
    }
    if (task?.selectedText) {
      texts.push(task.selectedText);
    }
  }

  for (const note of state.passageNotes) {
    if (note?.title) {
      texts.push(note.title);
    }
    if (note?.body) {
      texts.push(note.body);
    }
    if (note?.selectedText) {
      texts.push(note.selectedText);
    }
  }

  return texts;
}

function collectSpellcheckProjectCorpusTexts() {
  const texts = [];

  if (typeof state.projectTitle === "string" && state.projectTitle.trim()) {
    texts.push(state.projectTitle);
  }

  if (state.workspace?.project?.binder) {
    collectSpellcheckBinderTexts(state.workspace.project.binder, texts);
  }

  for (const scene of state.scenes) {
    if (scene?.chapterTitle) {
      texts.push(scene.chapterTitle);
    }
    if (scene?.sceneTitle) {
      texts.push(scene.sceneTitle);
    }
    if (scene?.sceneSynopsis) {
      texts.push(scene.sceneSynopsis);
    }
  }

  for (const task of state.manuscriptTasks) {
    if (task?.title) {
      texts.push(task.title);
    }
  }

  for (const note of state.passageNotes) {
    if (note?.title) {
      texts.push(note.title);
    }
  }

  return texts;
}

function buildCurrentProjectSpellcheckLexicon() {
  const spellcheckProjectSettings = normalizeSpellcheckProjectSettings(state.spellcheckProjectSettings);
  const texts = [
    ...collectSpellcheckProjectCorpusTexts(),
    ...spellcheckProjectSettings.dictionaryWords,
    ...spellcheckProjectSettings.exceptionWords,
  ];

  return buildSpellcheckProjectLexicon(texts);
}

function buildGrammarCheckSummary(scene) {
  if (!scene || !spellcheckBaseLexicon?.wordList?.length) {
    return {
      count: 0,
      label: "Grammar check",
    };
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const count = countSpellcheckMisspellings(scene.editorText ?? "", {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon,
    referenceLexicon: spellcheckReferenceLexicon,
  });

  return {
    count,
    label: count === 1 ? "1 flagged word" : `${count} flagged words`,
  };
}

function getSpellcheckProjectWordsFromSelection(words) {
  const source = Array.isArray(words) ? words : [];
  const normalizedWords = [];
  const seen = new Set();

  for (const entry of source) {
    const candidate = typeof entry === "string" ? entry : entry?.word;
    const normalized = normalizeSpellcheckWord(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const displayWord = String(candidate ?? "").trim();
    normalizedWords.push(displayWord || normalized);
  }

  return normalizedWords;
}

function collectSpellcheckBinderTexts(node, texts) {
  if (!node || typeof node !== "object" || !Array.isArray(texts)) {
    return;
  }

  if (typeof node.title === "string" && node.title.trim()) {
    texts.push(node.title);
  }

  if (!Array.isArray(node.children)) {
    return;
  }

  for (const child of node.children) {
    collectSpellcheckBinderTexts(child, texts);
  }
}

function getInlinePassagePosition(codeframe, event) {
  const bounds = codeframe.getBoundingClientRect();
  const maxLeft = Math.max(92, codeframe.clientWidth - 390);
  const left = Math.max(92, Math.min(maxLeft, event.clientX - bounds.left + codeframe.scrollLeft));
  const top = Math.max(24, event.clientY - bounds.top + codeframe.scrollTop);

  return { x: left, y: top };
}

function getEditorContextRange(textarea) {
  const value = textarea.value;
  const explicitStart = textarea.selectionStart;
  const explicitEnd = textarea.selectionEnd;

  if (explicitEnd > explicitStart && value.slice(explicitStart, explicitEnd).trim()) {
    return trimTextRange(value, explicitStart, explicitEnd, true);
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, explicitStart - 1)) + 1;
  const nextBreak = value.indexOf("\n", explicitStart);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  if (lineEnd <= lineStart || !value.slice(lineStart, lineEnd).trim()) {
    return null;
  }

  return trimTextRange(value, lineStart, lineEnd, false);
}

function trimTextRange(value, startOffset, endOffset, hasExplicitSelection) {
  let nextStart = startOffset;
  let nextEnd = endOffset;

  while (nextStart < nextEnd && /\s/.test(value[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(value[nextEnd - 1])) {
    nextEnd -= 1;
  }

  if (nextEnd <= nextStart) {
    return null;
  }

  return {
    selectedText: value.slice(nextStart, nextEnd),
    startOffset: nextStart,
    endOffset: nextEnd,
    hasExplicitSelection,
  };
}

// Intent: switch high-level workspaces while preserving editor-focused layout and selection state.
function selectWorkspacePane(paneId) {
  const normalizedPaneId = paneId === "voice" ? "narration" : paneId;

  if (!["manuscript", "world", "narration"].includes(normalizedPaneId)) {
    return;
  }

  if (normalizedPaneId !== "manuscript" && state.manuscriptFind.open) {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      open: false,
    };
  }

  if (normalizedPaneId !== "manuscript" && state.grammarCheckPanel?.open) {
    state.grammarCheckPanel = {
      ...state.grammarCheckPanel,
      open: false,
    };
  }

  state.activePane = normalizedPaneId;
  render();
}

function renderPaneVisibility() {
  const visiblePaneSections = state.activePane === "narration"
    ? new Set(["manuscript"])
    : new Set([state.activePane]);

  document.querySelectorAll("[data-pane-section]").forEach((section) => {
    const paneId = section instanceof HTMLElement ? section.dataset.paneSection : null;
    section.toggleAttribute("hidden", !paneId || !visiblePaneSections.has(paneId));
  });
}

function selectSidePanel(panelId) {
  if (!["issues", "inspiration", "research"].includes(panelId)) {
    return;
  }

  state.sidePanelMode = panelId;
  if (panelId === "issues") {
    state.selectedPassageNoteId = null;
    state.selectedIssueId = null;
  } else {
    const selectedNote = state.passageNotes.find((note) =>
      note.noteType === panelId && note.id === state.selectedPassageNoteId,
    );
    state.selectedPassageNoteId =
      selectedNote?.id ??
      state.passageNotes.find((note) => note.noteType === panelId)?.id ??
      null;
  }
  renderConsolePanel();
}

function focusEditorWhitespace(clickTarget, event) {
  const codeframe = clickTarget?.closest("[data-scene-editor]");
  if (!(codeframe instanceof HTMLElement)) {
    return false;
  }

  if (clickTarget?.closest(".editor-document-input")) {
    return false;
  }

  if (!clickTarget?.closest(".editor-document-body")) {
    return false;
  }

  const textarea = codeframe.querySelector(".editor-document-input");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  event.preventDefault();
  clearTaskAnchorPreview({ restoreSelection: false });

  const offset = getTextareaOffsetFromPoint(textarea, event.clientX, event.clientY);
  textarea.focus({ preventScroll: true });
  const trailingWhitespaceRange = getTrailingWhitespaceRange(textarea.value);
  if (trailingWhitespaceRange && (!Number.isInteger(offset) || offset >= textarea.value.length)) {
    textarea.setSelectionRange(
      trailingWhitespaceRange.start,
      trailingWhitespaceRange.end,
      "forward",
    );
    return true;
  }

  if (Number.isInteger(offset)) {
    const safeOffset = clampEditorOffset(offset, textarea.value.length);
    textarea.setSelectionRange(safeOffset, safeOffset, "forward");
  }
  return true;
}

function getTrailingWhitespaceRange(text) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  const match = source.match(/(\s+)$/u);
  if (!match) {
    return null;
  }

  const trailingWhitespace = match[1];
  const start = source.length - trailingWhitespace.length;
  return {
    start,
    end: source.length,
  };
}

function navigateTaskAnchor(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return;
  }

  state.selectedTaskId = task.id;
  clearTaskAnchorPreview({ restoreSelection: false });

  if (state.selectedSceneId !== task.sceneId) {
    selectSceneById(task.sceneId);
    window.requestAnimationFrame(() => focusTaskRange(task, { behavior: "smooth" }));
    return;
  }

  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
}

function focusTaskRange(task, options = {}) {
  const textarea = getEditorTextareaForScene(task.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const resolvedRange = resolveManuscriptTaskRange(task, textarea.value);
  syncResolvedTaskRange(task, resolvedRange);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: startOffset,
    selectionEnd: endOffset,
    wasFocused: true,
    pinned: true,
  };

  textarea.classList.add("has-task-preview");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
  takeToEditorOffset(textarea, startOffset, options);
}

function previewTaskAnchor(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return;
  }

  const textarea = getEditorTextareaForScene(task.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (state.taskPreview?.taskId === task.id) {
    return;
  }

  clearTaskAnchorPreview({ restoreSelection: true });

  const resolvedRange = resolveManuscriptTaskRange(task, textarea.value);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");
  const taskElement = document.querySelector(`[data-task-preview-id="${CSS.escape(task.id)}"]`);

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    wasFocused: document.activeElement === textarea,
    pinned: false,
  };

  textarea.classList.add("has-task-preview");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
  }
  if (taskElement instanceof HTMLElement) {
    taskElement.classList.add("is-previewing");
  }

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
}

function getEditorTextareaForScene(sceneId) {
  return document.querySelector(
    `.editor-document-input[data-scene-id="${CSS.escape(sceneId)}"]`,
  );
}

function syncResolvedTaskRange(task, resolvedRange) {
  if (!resolvedRange.matched) {
    return;
  }

  if (
    task.startOffset === resolvedRange.startOffset &&
    task.endOffset === resolvedRange.endOffset
  ) {
    return;
  }

  state.manuscriptTasks = state.manuscriptTasks.map((candidate) =>
    candidate.id === task.id
      ? {
          ...candidate,
          startOffset: resolvedRange.startOffset,
          endOffset: resolvedRange.endOffset,
        }
      : candidate,
  );
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
}

function centerEditorOnCaret(textarea) {
  takeToEditorOffset(textarea, textarea.selectionStart);
}

function takeToEditorOffset(textarea, offset, options = {}) {
  const codeframe = textarea.closest(".scene-editor-codeframe");
  if (!(codeframe instanceof HTMLElement)) {
    return;
  }

  const style = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(style.lineHeight || "0") || 1;
  const fontSize = parseFloat(style.fontSize || "0") || 16;
  const body = textarea.closest(".editor-document-body");
  const bodyStyle = body instanceof HTMLElement ? window.getComputedStyle(body) : null;
  const paddingTop = bodyStyle ? parseFloat(bodyStyle.paddingTop || "0") : 0;
  const measuredOffsetTop = measureTextareaOffsetTop(textarea, offset);
  const approximateCharacterWidth = Math.max(6, fontSize * 0.56);
  const charactersPerLine = Math.max(
    8,
    Math.floor(textarea.clientWidth / approximateCharacterWidth),
  );
  const visualLine = estimateVisualLineBeforeOffset(
    textarea.value,
    offset,
    charactersPerLine,
  );
  const offsetTop = Number.isFinite(measuredOffsetTop)
    ? measuredOffsetTop
    : visualLine * lineHeight;
  const targetTop = paddingTop + offsetTop - codeframe.clientHeight / 2 + lineHeight;
  const maxScrollTop = Math.max(0, codeframe.scrollHeight - codeframe.clientHeight);
  const top = Math.max(0, Math.min(maxScrollTop, targetTop));

  codeframe.scrollTo({
    top,
    behavior: options.behavior ?? "auto",
  });
}

function centerEditorOnOffset(textarea, offset, options = {}) {
  takeToEditorOffset(textarea, offset, options);
}

function takeToSceneRange(sceneId, startOffset, endOffset = startOffset, options = {}) {
  const scene = getScene(sceneId);
  if (!scene) {
    return false;
  }

  if (state.selectedSceneId !== scene.sceneId) {
    selectSceneById(scene.sceneId);
    window.requestAnimationFrame(() => {
      takeToSceneRange(sceneId, startOffset, endOffset, options);
    });
    return true;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const safeStart = clampEditorOffset(startOffset, textarea.value.length);
  const safeEnd = clampEditorOffset(endOffset, textarea.value.length);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(Math.min(safeStart, safeEnd), Math.max(safeStart, safeEnd), "forward");
  takeToEditorOffset(textarea, safeStart, options);
  return true;
}

function measureTextareaOffsetTop(textarea, offset) {
  const style = window.getComputedStyle(textarea);
  const marker = document.createElement("span");
  const mirror = document.createElement("div");
  const bounds = textarea.getBoundingClientRect();
  const mirroredProperties = [
    "borderBottomWidth",
    "borderLeftWidth",
    "borderRightWidth",
    "borderTopWidth",
    "boxSizing",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "overflowWrap",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "tabSize",
    "textIndent",
    "textTransform",
    "wordBreak",
    "wordSpacing",
  ];

  for (const property of mirroredProperties) {
    mirror.style[property] = style[property];
  }

  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    pointerEvents: "none",
    top: "0",
    left: "-9999px",
    width: `${bounds.width}px`,
    minHeight: "0",
    height: "auto",
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  });

  const safeOffset = Math.max(0, Math.min(offset, textarea.value.length));
  mirror.append(document.createTextNode(textarea.value.slice(0, safeOffset)));
  marker.textContent = "\u200b";
  mirror.append(marker);
  mirror.append(document.createTextNode(textarea.value.slice(safeOffset) || "\u200b"));
  document.body.append(mirror);
  const top = marker.offsetTop;
  mirror.remove();
  return top;
}

function estimateVisualLineBeforeOffset(text, offset, charactersPerLine) {
  const beforeCursor = String(text ?? "").slice(0, Math.max(0, offset));
  const logicalLines = beforeCursor.split("\n");
  let visualLine = 0;

  for (let index = 0; index < logicalLines.length; index += 1) {
    const line = logicalLines[index];
    if (index === logicalLines.length - 1) {
      visualLine += Math.floor(line.length / charactersPerLine);
      continue;
    }

    visualLine += Math.max(1, Math.ceil(line.length / charactersPerLine));
  }

  return visualLine;
}

function clearTaskAnchorPreview(options = {}) {
  const preview = state.taskPreview;
  if (!preview) {
    return;
  }

  const restoreSelection = options.restoreSelection ?? true;
  const textarea = document.querySelector(
    `.editor-document-input[data-scene-id="${CSS.escape(preview.sceneId)}"]`,
  );

  if (textarea instanceof HTMLTextAreaElement) {
    textarea.classList.remove(
      "has-task-preview",
      "has-passage-note-preview",
      "has-inspiration-preview",
      "has-research-preview",
    );
    textarea.closest(".scene-editor-codeframe")?.classList.remove(
      "is-task-previewing",
      "is-passage-note-previewing",
      "is-inspiration-previewing",
      "is-research-previewing",
    );

    if (restoreSelection) {
      if (preview.wasFocused) {
        textarea.setSelectionRange(preview.selectionStart, preview.selectionEnd);
      } else {
        textarea.setSelectionRange(textarea.selectionEnd, textarea.selectionEnd);
        textarea.blur();
      }
    }
  }

  document
    .querySelectorAll("[data-task-preview-id].is-previewing")
    .forEach((element) => element.classList.remove("is-previewing"));
  state.taskPreview = null;
}

// Intent: preserve the editor viewport when anchored notes are removed or rehydrated.
function captureSceneEditorViewport(sceneId) {
  const textarea = getEditorTextareaForScene(sceneId);
  const codeframe = textarea?.closest?.(".scene-editor-codeframe");
  if (!(textarea instanceof HTMLTextAreaElement) || !(codeframe instanceof HTMLElement)) {
    return null;
  }

  return {
    wasFocused: document.activeElement === textarea,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    selectionDirection: textarea.selectionDirection,
    scrollTop: codeframe.scrollTop,
    scrollLeft: codeframe.scrollLeft,
  };
}

// Intent: restore the manuscript editor to the same visual position after note deletion.
function restoreSceneEditorViewport(sceneId, viewport) {
  if (!viewport) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  const codeframe = textarea?.closest?.(".scene-editor-codeframe");
  if (!(textarea instanceof HTMLTextAreaElement) || !(codeframe instanceof HTMLElement)) {
    return;
  }

  if (viewport.wasFocused) {
    textarea.focus({ preventScroll: true });
  }

  const safeStart = clampEditorOffset(viewport.selectionStart ?? textarea.selectionStart, textarea.value.length);
  const safeEnd = clampEditorOffset(viewport.selectionEnd ?? textarea.selectionEnd, textarea.value.length);
  try {
    textarea.setSelectionRange(safeStart, safeEnd, viewport.selectionDirection ?? "forward");
  } catch (error) {
    textarea.setSelectionRange(Math.min(safeStart, safeEnd), Math.max(safeStart, safeEnd));
  }

  codeframe.scrollTop = Math.max(0, viewport.scrollTop ?? 0);
  codeframe.scrollLeft = Math.max(0, viewport.scrollLeft ?? 0);
}

// Intent: start anchored inspiration/research notes from the active manuscript selection.
function openPassageNoteComposerFromContextMenu(noteType) {
  const menu = state.taskContextMenu;
  if (!menu || (noteType !== "inspiration" && noteType !== "research")) {
    return;
  }

  state.sidePanelMode = noteType;
  state.taskContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  const selectedText = menu.hasExplicitSelection ? String(menu.selectedText ?? "") : "";
  const anchorStartOffset = menu.hasExplicitSelection
    ? menu.startOffset
    : menu.insertionOffset;
  const anchorEndOffset = menu.hasExplicitSelection
    ? menu.endOffset
    : menu.insertionOffset;
  state.inlinePassageDraft = {
    sceneId: menu.sceneId,
    noteType,
    selectedText,
    startOffset: anchorStartOffset,
    endOffset: anchorEndOffset,
    anchorStartOffset,
    seededSelection: Boolean(menu.hasExplicitSelection),
    typedStartOffset: null,
    typedEndOffset: null,
    body: "",
    typedText: selectedText,
    x: menu.inlinePosition?.x ?? 110,
    y: menu.inlinePosition?.y ?? 40,
  };
  renderConsolePanel();
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  renderTaskContextMenu();
  window.requestAnimationFrame(() => {
    syncInlinePassageDraftLayout();
    const field = document.querySelector("[data-edit-field='inline-passage-note']");
    if (field instanceof HTMLTextAreaElement) {
      field.focus();
    }
  });
}

function savePassageNoteFromComposer() {
  const composer = state.taskComposer;
  if (!composer || composer.composerType !== "passage-note") {
    return;
  }

  const scene = getScene(composer.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  const noteInput = document.querySelector("[data-passage-note-body]");
  const body = noteInput instanceof HTMLTextAreaElement ? noteInput.value.trim() : "";

  if (!body) {
    if (noteInput instanceof HTMLTextAreaElement) {
      noteInput.focus();
    }
    return;
  }

  const note = {
    ...createPassageNote(scene, {
      selectedText: composer.selectedText,
      startOffset: composer.startOffset,
      endOffset: composer.endOffset,
      body,
    }, composer.noteType),
  };

  state.passageNotes = [note, ...state.passageNotes];
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  maybeSuggestPassageNoteTitle(note);
  state.taskComposer = null;
  renderConsolePanel();
  renderTaskContextMenu();
  if (state.selectedSceneId === note.sceneId) {
    scrollSelectedPassageNoteIntoView(note.id);
    return;
  }

  focusPassageNoteRange(note, { behavior: "smooth" });
}

function commitInlinePassageNote() {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return;
  }

  const scene = getScene(draft.sceneId);
  if (!scene) {
    cancelInlinePassageNote();
    return;
  }

  const noteField = document.querySelector("[data-edit-field='inline-passage-note']");
  const verseField = document.querySelector("[data-edit-field='inline-passage-verse']");
  const body = noteField instanceof HTMLTextAreaElement
    ? noteField.value.trim()
    : String(draft.body ?? "").trim();
  const pendingVerseText = verseField instanceof HTMLTextAreaElement
    ? verseField.value
    : String(draft.typedText ?? "");

  if (!body) {
    if (noteField instanceof HTMLTextAreaElement) {
      noteField.focus();
    }
    return;
  }

  if (draft.editingNoteId) {
    const updatedNotes = updatePassageNoteBody(state.passageNotes, draft.editingNoteId, body);
    const updatedNote = updatedNotes.find((candidate) => candidate.id === draft.editingNoteId);
    if (!updatedNote) {
      cancelInlinePassageNote();
      return;
    }

    state.passageNotes = updatedNotes;
    state.sidePanelMode = updatedNote.noteType;
    state.selectedPassageNoteId = updatedNote.id;
    state.inlinePassageDraft = null;
    writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
    renderManuscriptPanel();
    syncSceneDocumentLayout();
    renderConsolePanel();
    if (state.selectedSceneId === updatedNote.sceneId) {
      scrollSelectedPassageNoteIntoView(updatedNote.id);
      return;
    }

    focusPassageNoteRange(updatedNote, { behavior: "smooth" });
    return;
  }

  const editorText = getCurrentSceneEditorText(draft.sceneId, scene.editorText ?? "");
  let anchor = null;

  if (pendingVerseText.trim()) {
    const insertion = insertInlinePassageVerse(draft, pendingVerseText, editorText);
    if (!insertion) {
      focusTypedVerseTarget(draft);
      return;
    }
    anchor = insertion.anchor;
  } else {
    anchor = getInlinePassageDraftAnchor(draft, editorText);
  }

  if (!anchor) {
    focusTypedVerseTarget(draft);
    updateInlinePassageDraftStatus(editorText);
    return;
  }

  const note = createPassageNote(scene, {
    selectedText: anchor.selectedText,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    body,
  }, draft.noteType);

  state.passageNotes = [note, ...state.passageNotes];
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.inlinePassageDraft = null;
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  maybeSuggestPassageNoteTitle(note);
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  renderConsolePanel();
  if (state.selectedSceneId === note.sceneId) {
    scrollSelectedPassageNoteIntoView(note.id);
    return;
  }

  focusPassageNoteRange(note, { behavior: "smooth" });
}

function cancelInlinePassageNote() {
  state.inlinePassageDraft = null;
  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function trackInlinePassageDraftTyping(sceneId, previousText, textarea) {
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== sceneId || !(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const nextText = textarea.value;
  const previous = String(previousText ?? "");
  if (previous === nextText) {
    return;
  }

  const change = getTextChangeRange(previous, nextText);
  if (!change) {
    return;
  }

  const anchorStart = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : change.startOffset;
  const previousTypedStart = Number.isInteger(draft.typedStartOffset)
    ? draft.typedStartOffset
    : null;
  const previousTypedEnd = Number.isInteger(draft.typedEndOffset)
    ? draft.typedEndOffset
    : null;
  const delta = nextText.length - previous.length;

  let typedStart = previousTypedStart;
  let typedEnd = previousTypedEnd;

  if (typedStart === null || typedEnd === null || typedEnd <= typedStart) {
    if (change.endOffset <= change.startOffset || change.startOffset < anchorStart - 1) {
      return;
    }
    typedStart = change.startOffset;
    typedEnd = change.endOffset;
  } else if (change.startOffset <= typedEnd + 1) {
    typedStart = Math.min(typedStart, change.startOffset);
    typedEnd = Math.max(typedStart, typedEnd + delta, change.endOffset);
  } else {
    return;
  }

  state.inlinePassageDraft = {
    ...draft,
    typedStartOffset: clampEditorOffset(typedStart, nextText.length),
    typedEndOffset: clampEditorOffset(typedEnd, nextText.length),
  };
}

function getTextChangeRange(previousText, nextText) {
  let prefixLength = 0;
  const shortestLength = Math.min(previousText.length, nextText.length);

  while (
    prefixLength < shortestLength &&
    previousText[prefixLength] === nextText[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const endOffset = nextText.length - suffixLength;
  return endOffset >= prefixLength
    ? {
        startOffset: prefixLength,
        endOffset,
      }
    : null;
}

function insertInlinePassageVerse(draft, verseText, editorText) {
  const content = String(editorText ?? "");
  const rawVerseText = String(verseText ?? "");
  const existingRange = getInlinePassageDraftExistingSelectionRange(draft, content);
  const replacementStartOffset = existingRange?.startOffset
    ?? clampEditorOffset(draft.anchorStartOffset, content.length);
  const replacementEndOffset = existingRange?.endOffset ?? replacementStartOffset;
  const nextEditorText = `${content.slice(0, replacementStartOffset)}${rawVerseText}${content.slice(replacementEndOffset)}`;
  const insertedEndOffset = replacementStartOffset + rawVerseText.length;
  const anchor = trimTextRange(nextEditorText, replacementStartOffset, insertedEndOffset, true);

  if (!anchor || !anchor.selectedText.trim()) {
    return null;
  }

  updateSceneDraft(draft.sceneId, (sceneDraft) => {
    sceneDraft.editorText = nextEditorText;
    sceneDraft.revisionStats = updateSceneRevisionStats(
      sceneDraft.revisionStats ?? draft.revisionStats,
      content,
      nextEditorText,
    );
  });
  syncRevisionPanel(draft.sceneId);

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = nextEditorText;
    textarea.setSelectionRange(anchor.startOffset, anchor.endOffset, "forward");
  }

  return {
    editorText: nextEditorText,
    anchor,
  };
}

function getInlinePassageDraftExistingSelectionRange(draft, editorText) {
  if (!draft?.seededSelection) {
    return null;
  }

  const content = String(editorText ?? "");
  const startOffset = clampEditorOffset(draft.startOffset, content.length);
  const endOffset = clampEditorOffset(draft.endOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  return {
    startOffset,
    endOffset,
  };
}

function getInlinePassageDraftPendingVerse(draft) {
  const rawVerseText = String(draft?.typedText ?? "");
  if (!rawVerseText.trim()) {
    return null;
  }

  const range = trimTextRange(rawVerseText, 0, rawVerseText.length, true);
  if (!range || !range.selectedText.trim()) {
    return null;
  }

  const anchorStartOffset = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : 0;

  return {
    selectedText: range.selectedText,
    startOffset: anchorStartOffset + range.startOffset,
    endOffset: anchorStartOffset + range.endOffset,
  };
}

function getInlinePassageDraftAnchor(draft, editorText, options = {}) {
  if (!draft) {
    return null;
  }

  if (options.includePendingVerse) {
    const pendingVerse = getInlinePassageDraftPendingVerse(draft);
    if (pendingVerse) {
      return pendingVerse;
    }
  }

  const content = String(editorText ?? "");
  const startOffset = clampEditorOffset(draft.typedStartOffset, content.length);
  const endOffset = clampEditorOffset(draft.typedEndOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  const range = trimTextRange(content, startOffset, endOffset, true);
  if (!range || !range.selectedText.trim()) {
    return null;
  }

  return range;
}

function updateInlinePassageDraftStatus(editorText) {
  const draft = state.inlinePassageDraft;
  if (!draft) {
    return;
  }

  const label = draft.noteType === "research" ? "Research" : "Inspiration";
  const anchor = getInlinePassageDraftAnchor(draft, editorText, {
    includePendingVerse: true,
  });
  const status = document.querySelector("[data-inline-passage-status]");
  if (status) {
    status.textContent = anchor
      ? `${label} will save against: ${anchor.selectedText.slice(0, 96)}`
      : `Save this ${getPassageNoteVerb(draft.noteType)} note against the verse typed in the manuscript field below.`;
  }
}

function getCurrentSceneEditorText(sceneId, fallbackText = "") {
  const textarea = getEditorTextareaForScene(sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    return textarea.value;
  }
  return String(fallbackText ?? "");
}

function focusTypedVerseTarget(draft) {
  const verseField = document.querySelector("[data-edit-field='inline-passage-verse']");
  if (verseField instanceof HTMLTextAreaElement) {
    verseField.focus();
    return;
  }

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const offset = clampEditorOffset(draft.anchorStartOffset, textarea.value.length);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(offset, offset);
  centerEditorOnCaret(textarea);
}

function clampEditorOffset(value, textLength) {
  const numericValue = Number(value);
  const length = Math.max(0, Number(textLength) || 0);
  if (!Number.isInteger(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.min(numericValue, length));
}

function selectPassageNote(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return;
  }

  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  renderConsolePanel();
  scrollSelectedPassageNoteIntoView(note.id);
  focusPassageNoteRange(note, { behavior: "smooth" });
}

function togglePassageNoteSelection(noteId) {
  const note = state.passageNotes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return;
  }

  if (
    state.selectedPassageNoteId === note.id &&
    state.taskPreview?.taskId === note.id &&
    state.taskPreview.pinned
  ) {
    clearTaskAnchorPreview();
    renderConsolePanel();
    return;
  }

  selectPassageNote(note.id);
}

function selectPassageNoteFromEditorClick(clickTarget) {
  if (state.sidePanelMode !== "inspiration" && state.sidePanelMode !== "research") {
    return false;
  }

  const textarea =
    clickTarget instanceof HTMLTextAreaElement &&
    clickTarget.classList.contains("editor-document-input")
      ? clickTarget
      : null;
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return false;
  }

  const sceneId = textarea.dataset.sceneId;
  if (!sceneId) {
    return false;
  }

  if (clickTarget.selectionEnd <= clickTarget.selectionStart) {
    return false;
  }

  const note = findPassageNoteAtEditorSelection(
    state.sidePanelMode,
    sceneId,
    textarea.selectionStart,
    textarea.selectionEnd,
    textarea.value,
  );
  if (!note) {
    return false;
  }

  selectPassageNote(note.id);
  return true;
}

function selectTaskFromEditorClick(clickTarget) {
  if (!(clickTarget instanceof HTMLTextAreaElement) || !clickTarget.classList.contains("editor-document-input")) {
    return false;
  }

  const sceneId = clickTarget.dataset.sceneId;
  if (!sceneId) {
    return false;
  }

  if (clickTarget.selectionEnd <= clickTarget.selectionStart) {
    return false;
  }

  const task = findTaskAtEditorSelection(
    sceneId,
    clickTarget.selectionStart,
    clickTarget.selectionEnd,
    clickTarget.value,
  );
  if (!task) {
    return false;
  }

  state.selectedTaskId = task.id;
  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
  return true;
}

function toggleTaskPreview(taskId) {
  const task = state.manuscriptTasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "open") {
    return false;
  }

  if (state.taskPreview?.taskId === task.id && state.taskPreview.pinned) {
    clearTaskAnchorPreview();
    renderConsolePanel();
    return true;
  }

  state.selectedTaskId = task.id;
  renderConsolePanel();
  focusTaskRange(task, { behavior: "smooth" });
  renderConsolePanel();
  return true;
}

function findPassageNoteAtEditorSelection(noteType, sceneId, selectionStart, selectionEnd, editorText) {
  const startOffset = Math.min(selectionStart, selectionEnd);
  const endOffset = Math.max(selectionStart, selectionEnd);
  const hasSelection = endOffset > startOffset;

  const candidates = state.passageNotes
    .filter((note) => note.noteType === noteType && note.sceneId === sceneId)
    .map((note) => ({
      note,
      range: resolveManuscriptTaskRange(note, editorText),
    }))
    .filter(({ range }) => range.endOffset > range.startOffset)
    .filter(({ range }) =>
      hasSelection
        ? range.startOffset < endOffset && range.endOffset > startOffset
        : startOffset >= range.startOffset && startOffset <= range.endOffset,
    )
    .sort((left, right) => {
      const leftLength = left.range.endOffset - left.range.startOffset;
      const rightLength = right.range.endOffset - right.range.startOffset;
      return leftLength - rightLength;
    });

  const match = candidates[0];
  if (!match) {
    return null;
  }

  syncResolvedPassageNoteRange(match.note, match.range);
  return match.note;
}

function findTaskAtEditorSelection(sceneId, selectionStart, selectionEnd, editorText) {
  const startOffset = Math.min(selectionStart, selectionEnd);
  const endOffset = Math.max(selectionStart, selectionEnd);
  const hasSelection = endOffset > startOffset;

  const candidates = state.manuscriptTasks
    .filter((task) => task.status === "open" && task.sceneId === sceneId)
    .map((task) => ({
      task,
      range: resolveManuscriptTaskRange(task, editorText),
    }))
    .filter(({ range }) => range.endOffset > range.startOffset)
    .filter(({ range }) =>
      hasSelection
        ? range.startOffset < endOffset && range.endOffset > startOffset
        : startOffset >= range.startOffset && startOffset <= range.endOffset,
    )
    .sort((left, right) => {
      const leftLength = left.range.endOffset - left.range.startOffset;
      const rightLength = right.range.endOffset - right.range.startOffset;
      return leftLength - rightLength;
    });

  const match = candidates[0];
  if (!match) {
    return null;
  }

  syncResolvedTaskRange(match.task, match.range);
  return match.task;
}

function scrollSelectedPassageNoteIntoView(noteId) {
  window.requestAnimationFrame(() => {
    const item = document.querySelector(
      `.passage-note-item[data-note-id="${CSS.escape(noteId)}"]`,
    );
    if (item instanceof HTMLElement) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function focusPassageNoteRange(note, options = {}) {
  if (state.selectedSceneId !== note.sceneId) {
    selectSceneById(note.sceneId);
    window.requestAnimationFrame(() => {
      const latestNote = state.passageNotes.find((candidate) => candidate.id === note.id) ?? note;
      focusPassageNoteRangeInCurrentScene(latestNote, options);
    });
    return;
  }

  focusPassageNoteRangeInCurrentScene(note, options);
}

function focusPassageNoteRangeInCurrentScene(note, options = {}) {
  const textarea = getEditorTextareaForScene(note.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const resolvedRange = resolveManuscriptTaskRange(note, textarea.value);
  syncResolvedPassageNoteRange(note, resolvedRange);
  const startOffset = resolvedRange.startOffset;
  const endOffset = resolvedRange.endOffset;
  const codeframe = textarea.closest(".scene-editor-codeframe");

  clearTaskAnchorPreview({ restoreSelection: false });

  state.taskPreview = {
    taskId: note.id,
    sceneId: note.sceneId,
    selectionStart: startOffset,
    selectionEnd: endOffset,
    wasFocused: true,
    pinned: true,
  };

  textarea.classList.add("has-task-preview");
  textarea.classList.add("has-passage-note-preview", `has-${note.noteType}-preview`);
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.add("is-task-previewing");
    codeframe.classList.add("is-passage-note-previewing", `is-${note.noteType}-previewing`);
  }

  takeToSceneRange(note.sceneId, startOffset, endOffset, options);
}

function syncResolvedPassageNoteRange(note, resolvedRange) {
  if (!resolvedRange.matched) {
    return;
  }

  if (
    note.startOffset === resolvedRange.startOffset &&
    note.endOffset === resolvedRange.endOffset
  ) {
    return;
  }

  state.passageNotes = state.passageNotes.map((candidate) =>
    candidate.id === note.id
      ? {
          ...candidate,
          startOffset: resolvedRange.startOffset,
          endOffset: resolvedRange.endOffset,
        }
      : candidate,
  );
  writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
}

function openTaskComposerFromContextMenu(event) {
  const menu = state.taskContextMenu;
  if (!menu) {
    return;
  }

  const scene = getScene(menu.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  state.taskContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = {
    ...menu,
    composerType: "task",
    x: event.clientX + 10,
    y: event.clientY,
  };
  renderTaskContextMenu();
}

function saveTaskFromComposer() {
  const composer = state.taskComposer;
  if (!composer) {
    return;
  }

  const scene = getScene(composer.sceneId);
  if (!scene) {
    hideTaskSurfaces();
    return;
  }

  const descriptionInput = document.querySelector("[data-task-description]");
  const body =
    descriptionInput instanceof HTMLTextAreaElement ? descriptionInput.value.trim() : "";

  if (!body) {
    if (descriptionInput instanceof HTMLTextAreaElement) {
      descriptionInput.focus();
    }
    return;
  }

  const task = createManuscriptTask(scene, {
    body,
    taskNumber: getNextTaskNumberForScene(scene.sceneId),
    selectedText: composer.selectedText,
    startOffset: composer.startOffset,
    endOffset: composer.endOffset,
  });
  state.manuscriptTasks = [...state.manuscriptTasks, task];
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
  maybeSuggestTaskTitle(task);
  state.taskComposer = null;
  renderBinderPanel();
  renderConsolePanel();
  renderTaskContextMenu();
}

// Intent: ask local AI for advisory titles without letting model output mutate structure silently.
async function suggestSceneTitle(sceneId) {
  const scene = getScene(sceneId);
  if (!scene || !state.localAiPrefs.enabled) {
    return;
  }

  state.localAiTitleStatus = {
    ...state.localAiTitleStatus,
    [scene.sceneId]: "loading",
  };
  renderManuscriptPanel();
  syncSceneDocumentLayout();

  const result = await requestLocalAiTitle({
    userInput: scene.editorText || scene.sceneSynopsis || scene.sceneTitle,
    manuscriptContext: [
      `Chapter: ${formatChapterDisplayTitle(scene.chapterTitle)}`,
      `Current scene title: ${scene.sceneTitle}`,
      `Scene text:\n${scene.editorText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 24,
  });

  if (result.ok) {
    applySceneTitle(scene.sceneId, result.title);
    state.localAiTitleStatus = {
      ...state.localAiTitleStatus,
      [scene.sceneId]: "Suggested",
    };
  } else {
    state.localAiTitleStatus = {
      ...state.localAiTitleStatus,
      [scene.sceneId]: result.message,
    };
  }

  renderBinderPanel();
  renderManuscriptPanel();
  renderConsolePanel();
  syncSceneDocumentLayout();
}

function maybeSuggestTaskTitle(task) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = task.title;
  requestLocalAiTitle({
    userInput: task.body || task.description || "",
    manuscriptContext: [
      `Chapter: ${formatChapterDisplayTitle(task.chapterTitle)}`,
      `Scene: ${task.sceneTitle}`,
      `Referenced manuscript text:\n${task.selectedText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 20,
  }).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentTask = state.manuscriptTasks.find((candidate) => candidate.id === task.id);
    if (!currentTask || currentTask.title !== fallbackTitle) {
      return;
    }

    state.manuscriptTasks = updateManuscriptTaskTitle(
      state.manuscriptTasks,
      task.id,
      result.title,
    );
    writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest task title", error));
}

function maybeSuggestPassageNoteTitle(note) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = note.title;
  requestLocalAiTitle({
    userInput: note.body || "",
    manuscriptContext: [
      `Chapter: ${formatChapterDisplayTitle(note.chapterTitle)}`,
      `Scene: ${note.sceneTitle}`,
      `Referenced manuscript text:\n${note.selectedText}`,
    ].join("\n"),
    projectContext: state.projectTitle,
    maxTokens: 20,
  }).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentNote = state.passageNotes.find((candidate) => candidate.id === note.id);
    if (!currentNote || currentNote.title !== fallbackTitle) {
      return;
    }

    state.passageNotes = updatePassageNoteTitle(
      state.passageNotes,
      note.id,
      result.title,
    );
    writeStoredJson(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest passage note title", error));
}

async function requestLocalAiTitle({ userInput, manuscriptContext, projectContext, maxTokens }) {
  try {
    const response = await fetchJsonFromDesktopApi("/api/local-ai/generate-title", {
      method: "POST",
      body: {
        userInput,
        manuscriptContext,
        projectContext,
        outputFormat: "text",
        maxTokens,
        temperature: 0.25,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "Local AI unavailable",
      };
    }

    const payload = response.value;
    if (!payload.ok) {
      return {
        ok: false,
        message: localAiUnavailableMessage(payload),
      };
    }

    const title = sanitizeSuggestedTitle(payload.text);
    if (!title) {
      return {
        ok: false,
        message: "No title returned",
      };
    }

    return {
      ok: true,
      title,
    };
  } catch (error) {
    console.warn("Local AI title request failed", error);
    return {
      ok: false,
      message: "Local AI unavailable",
    };
  }
}

function localAiUnavailableMessage(payload) {
  if (payload?.reason === "provider_unavailable") {
    return "Local AI unavailable";
  }

  if (payload?.reason === "tier_not_configured") {
    return "AI tier not configured";
  }

  return "Title not generated";
}

function sanitizeSuggestedTitle(value) {
  const cleaned = String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s"']+|["']+$/g, "").trim())
    .find(Boolean);

  if (!cleaned) {
    return "";
  }

  return cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;
}

function applySceneTitle(sceneId, title) {
  updateSceneDraft(sceneId, (draft) => {
    draft.sceneTitle = title;
  });
  updateSceneTitleLabel(sceneId, title);
  updateSceneEditorTitle(sceneId, title);
  updateFocusedLineCard();
}

function getNextTaskNumberForScene(sceneId) {
  return state.manuscriptTasks
    .filter((task) => task.sceneId === sceneId)
    .reduce((highestTaskNumber, task) => {
      const taskNumber =
        Number.isInteger(task.taskNumber) && task.taskNumber > 0
          ? task.taskNumber
          : 0;
      return Math.max(highestTaskNumber, taskNumber);
    }, 0) + 1;
}

function cancelTaskComposer() {
  state.taskComposer = null;
  renderTaskContextMenu();
}

function completeTask(taskId) {
  if (!taskId) {
    return;
  }

  if (state.selectedTaskId === taskId) {
    state.selectedTaskId = null;
  }
  clearTaskAnchorPreview();
  state.manuscriptTasks = completeManuscriptTask(state.manuscriptTasks, taskId);
  writeStoredJson(EDITOR_TASKS_KEY, state.manuscriptTasks);
  renderBinderPanel();
  renderConsolePanel();
}

function hideTaskContextMenu() {
  if (!state.taskContextMenu && !state.binderContextMenu && !state.spellcheckContextMenu) {
    return;
  }

  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  renderTaskContextMenu();
}

function hideTaskSurfaces() {
  if (!state.taskContextMenu && !state.binderContextMenu && !state.spellcheckContextMenu && !state.taskComposer) {
    return;
  }

  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
}

function hideBinderContextMenu() {
  if (!state.binderContextMenu && !state.spellcheckContextMenu) {
    return;
  }

  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  renderTaskContextMenu();
}

function openBinderContextMenu(kind, identifiers, event) {
  if ((kind !== "chapter" && kind !== "scene") || !(event instanceof MouseEvent)) {
    return;
  }

  state.taskContextMenu = null;
  state.taskComposer = null;
  state.spellcheckContextMenu = null;
  state.binderContextMenu = {
    kind,
    chapterId: kind === "chapter" ? String(identifiers?.chapterId ?? "") : String(identifiers?.chapterId ?? ""),
    chapterTitle: String(identifiers?.chapterTitle ?? ""),
    sceneId: kind === "scene" ? String(identifiers?.sceneId ?? "") : String(identifiers?.sceneId ?? ""),
    sceneTitle: String(identifiers?.sceneTitle ?? ""),
    x: event.clientX,
    y: event.clientY,
  };
  renderTaskContextMenu();
}

function hideSpellcheckContextMenu() {
  if (!state.spellcheckContextMenu) {
    return;
  }

  state.spellcheckContextMenu = null;
  renderTaskContextMenu();
}

function applyGrammarCheckWordsToProjectList(targetListKey, sourceWords) {
  const normalizedSourceWords = getSpellcheckProjectWordsFromSelection(sourceWords);
  if (!normalizedSourceWords.length) {
    return false;
  }

  const currentSettings = normalizeSpellcheckProjectSettings(state.spellcheckProjectSettings);
  const nextSettings = normalizeSpellcheckProjectSettings({
    ...currentSettings,
    [targetListKey]: [
      ...(currentSettings[targetListKey] ?? []),
      ...normalizedSourceWords,
    ],
  });

  if (
    nextSettings.dictionaryWords.length === currentSettings.dictionaryWords.length &&
    nextSettings.exceptionWords.length === currentSettings.exceptionWords.length &&
    nextSettings.dictionaryWords.every((word, index) => word === currentSettings.dictionaryWords[index]) &&
    nextSettings.exceptionWords.every((word, index) => word === currentSettings.exceptionWords[index])
  ) {
    return false;
  }

  state.spellcheckProjectSettings = nextSettings;
  persistCurrentProjectRecord();
  return true;
}

function addGrammarCheckWordsToProjectList(targetListKey, sourceWords = null) {
  const menu = state.spellcheckContextMenu;
  const words = Array.isArray(sourceWords) ? sourceWords : (menu?.words ?? (menu?.word ? [menu.word] : []));
  if (!words.length) {
    hideSpellcheckContextMenu();
    return;
  }

  const changed = applyGrammarCheckWordsToProjectList(targetListKey, words);
  hideSpellcheckContextMenu();
  if (!changed) {
    return;
  }

  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function applySpellcheckSuggestionFromMenu(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const sceneId = String(target.dataset.spellcheckSceneId ?? "");
  const replacement = String(target.dataset.spellcheckReplacement ?? "");
  const startOffset = Number(target.dataset.spellcheckStartOffset);
  const endOffset = Number(target.dataset.spellcheckEndOffset);

  if (
    !sceneId ||
    !replacement ||
    !Number.isFinite(startOffset) ||
    !Number.isFinite(endOffset)
  ) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  hideSpellcheckContextMenu();
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const safeStart = clampEditorOffset(startOffset, textarea.value.length);
  const safeEnd = clampEditorOffset(endOffset, textarea.value.length);
  textarea.focus({ preventScroll: true });
  textarea.setRangeText(replacement, Math.min(safeStart, safeEnd), Math.max(safeStart, safeEnd), "end");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

// Intent: apply scene text edits through draft state so canonical project structure stays recoverable.
function updateSceneDraft(sceneId, mutate, options = {}) {
  const scene = getScene(sceneId);
  if (!scene) {
    sceneStorageLog.warn("validation", "scene.update.skipped", "Scene update skipped because scene was not found.", {
      sceneId: sceneId ?? "",
      reason: options.reason ?? "scene-draft",
    });
    return;
  }

  const previousWordCount = getCurrentManuscriptWordCount();
  const previousWritingTargetRecord = getWritingTargetWorkingRecord();
  const hadActiveSession = previousWritingTargetRecord?.sessionIsActive === true;
  const draft = cloneValue(state.sceneDrafts[sceneId] ?? createSceneDraft(scene));
  mutate(draft);
  sceneStorageLog.debug("state-change", "scene.update.mutate", "Applying scene draft mutation.", {
    sceneId,
    reason: options.reason ?? "scene-draft",
    immediate: options.immediate === true,
  });
  state.sceneDrafts = {
    ...state.sceneDrafts,
    [sceneId]: draft,
  };
  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
  const markSessionActivity = options.markSessionActivity !== false;
  const currentWordCount = getCurrentManuscriptWordCount();
  const wordDelta = currentWordCount - previousWordCount;
  manuscriptStateLog.info("state-change", "manuscript.word-count.changed", "Scene draft mutation changed manuscript word count.", {
    sceneId,
    previousWordCount,
    currentWordCount,
    wordDelta,
    reason: options.reason ?? "scene-draft",
  });
  if (wordDelta !== 0) {
    const nowMs = Date.now();
    const shouldLogTypingMetric = options.immediate === true
      || nowMs - writingTargetDebugLastTypingLogAt >= WRITING_TARGET_DEBUG_TYPING_LOG_MIN_INTERVAL_MS
      || writingTargetDebugLastSceneTypingWordCount !== currentWordCount;
    if (shouldLogTypingMetric) {
      writingTargetDebugLastTypingLogAt = nowMs;
      writingTargetDebugLastSceneTypingWordCount = currentWordCount;
      logWritingTargetDebugEvent("info", "scene-draft.word-change", "Scene draft word count changed.", {
        reason: options.reason ?? "scene-draft",
        sceneId,
        previousWordCount,
        currentWordCount,
        wordDelta,
        selectedSceneId: state.selectedSceneId ?? "",
      });
    }
  }

  if (markSessionActivity) {
    const currentWritingTargetRecord = getWritingTargetWorkingRecord();
    const touchedSessionRecord = touchWritingTargetSessionActivity(
      currentWritingTargetRecord,
      currentWordCount,
      new Date(),
      {
        reason: options.reason ?? "scene-draft",
        previousWordCount,
      },
    );

    if (touchedSessionRecord) {
      state.writingTargetState = persistWritingTargetState(touchedSessionRecord);
      if (state.writingTargetDraft && state.writingTargetDraftProjectId === state.workspace?.project?.id) {
        state.writingTargetDraft = {
          ...cloneValue(state.writingTargetDraft),
          sessionIsActive: state.writingTargetState.sessionIsActive,
          sessionStartedAt: state.writingTargetState.sessionStartedAt,
          sessionLastActiveAt: state.writingTargetState.sessionLastActiveAt,
          sessionConcludedAt: state.writingTargetState.sessionConcludedAt,
          sessionConcludedReason: state.writingTargetState.sessionConcludedReason,
          sessionBaselineWordCount: state.writingTargetState.sessionBaselineWordCount,
          sessionLastWordCount: state.writingTargetState.sessionLastWordCount,
          sessionSamples: cloneValue(state.writingTargetState.sessionSamples),
          updatedAt: state.writingTargetState.updatedAt,
        };
      }
    }
  }

  persistCurrentProjectRecord({
    changedSceneIds: [sceneId],
    domain: "manuscript",
    dirtyReason: "user-edit",
    source: "updateSceneDraft",
  });
  sceneStorageLog.debug("persistence", "scene.update.persisted", "Persisted scene draft mutation into project record.", {
    sceneId,
    changedSceneIds: [sceneId],
  });
  const shouldCaptureImmediately = options.immediate === true || !hadActiveSession;

  syncHeaderLiveState();
  syncWritingTargetWindowLiveState();

  if (shouldCaptureImmediately) {
    queueWritingTargetSnapshot({
      immediate: true,
      markSessionActivity,
      reason: options.reason ?? "scene-draft",
    });
  }

  if (!shouldCaptureImmediately) {
    queueWritingTargetSnapshot({
      markSessionActivity,
      reason: options.reason ?? "scene-draft",
    });
  }
}

function updateSceneRevisionStats(existingStats, previousText, nextText, now = new Date().toISOString()) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return existingStats ?? null;
  }

  const summary = summarizeSceneTextChange(previous, next);
  const historyEntry = {
    id: `revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    summary,
    previousLength: previous.length,
    nextLength: next.length,
    deltaCharacters: next.length - previous.length,
  };
  const history = Array.isArray(existingStats?.history) ? [...existingStats.history] : [];
  history.unshift(historyEntry);

  return {
    editCount: Number(existingStats?.editCount ?? 0) + 1,
    lastEditedAt: now,
    lastChangeSummary: summary,
    history: history.slice(0, 8),
  };
}

function summarizeSceneTextChange(previousText, nextText) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return "No text change";
  }

  let start = 0;
  const previousLength = previous.length;
  const nextLength = next.length;
  while (start < previousLength && start < nextLength && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previousLength - 1;
  let nextEnd = nextLength - 1;
  while (previousEnd >= start && nextEnd >= start && previous[previousEnd] === next[nextEnd]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const removed = previous.slice(start, previousEnd + 1);
  const added = next.slice(start, nextEnd + 1);
  const parts = [];

  if (added.length && removed.length) {
    parts.push(`Replaced ${removed.length} chars with ${added.length} chars`);
  } else if (added.length) {
    parts.push(`Inserted ${added.length} chars`);
  } else if (removed.length) {
    parts.push(`Removed ${removed.length} chars`);
  } else {
    parts.push("Updated passage");
  }

  const lineDelta = next.split("\n").length - previous.split("\n").length;
  if (lineDelta !== 0) {
    parts.push(`${lineDelta > 0 ? "+" : ""}${lineDelta} lines`);
  }

  return parts.join(" ");
}

function syncRevisionPanel(sceneId) {
  if (!REVISION_DRAFTING_UI_ENABLED) {
    return;
  }

  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return;
  }

  const sceneShell = document.querySelector(`[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`);
  if (!(sceneShell instanceof HTMLElement)) {
    return;
  }

  const draft = state.sceneDrafts?.[sceneId];
  const revisionStats = draft?.revisionStats ?? null;
  const revisionEditCount = Number(revisionStats?.editCount ?? 0);
  const showRevisionHighlight = Boolean(REVISION_DRAFTING_UI_ENABLED && state.editorPrefs.revisionOverlayEnabled && revisionEditCount > 0);
  const summary = revisionStats?.lastChangeSummary
    ? String(revisionStats.lastChangeSummary)
    : "Track revisions while you edit this passage.";
  const history = Array.isArray(revisionStats?.history) ? revisionStats.history.slice(0, 3) : [];

  sceneShell.classList.toggle("has-revision-preview", showRevisionHighlight);
  const codeframe = sceneShell.querySelector(".scene-editor-codeframe");
  if (codeframe instanceof HTMLElement) {
    codeframe.classList.toggle("has-revision-preview", showRevisionHighlight);
  }

  const textarea = sceneShell.querySelector(".editor-document-input");
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.classList.toggle("has-revision-preview", showRevisionHighlight);
  }

  const countNode = sceneShell.querySelector(`[data-revision-count="${CSS.escape(sceneId)}"]`);
  if (countNode instanceof HTMLElement) {
    countNode.textContent = `${revisionEditCount} edit${revisionEditCount === 1 ? "" : "s"}`;
  }

  const summaryNode = sceneShell.querySelector(`[data-revision-summary="${CSS.escape(sceneId)}"]`);
  if (summaryNode instanceof HTMLElement) {
    summaryNode.textContent = summary;
  }

  const historyNode = sceneShell.querySelector(`[data-revision-history="${CSS.escape(sceneId)}"]`);
  if (historyNode instanceof HTMLElement) {
    historyNode.innerHTML = history.map((entry) => `
      <li>
        <strong>${escapeHtml(entry.summary || "Edited passage")}</strong>
        <span>${escapeHtml(formatRevisionTimestamp(entry.updatedAt || entry.createdAt || ""))}</span>
      </li>
    `).join("");
  }
}

function formatRevisionTimestamp(value) {
  const timestamp = typeof value === "string" ? value.trim() : "";
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function toggleRevisionOverlay(sceneId) {
  if (!REVISION_DRAFTING_UI_ENABLED) {
    return;
  }

  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    revisionOverlayEnabled: !state.editorPrefs.revisionOverlayEnabled,
  });
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord();
  renderManuscriptPanel();
  syncLayoutWidths();
  syncSceneDocumentLayout();
  if (typeof sceneId === "string" && sceneId.trim()) {
    syncRevisionPanel(sceneId);
  }
}

function toggleItalicText() {
  state.editorPrefs = normalizeEditorPrefs({
    ...state.editorPrefs,
    italicText: !state.editorPrefs.italicText,
  });
  writeStoredJson(EDITOR_PREFS_KEY, state.editorPrefs);
  persistCurrentProjectRecord();
  renderManuscriptPanel();
  syncLayoutWidths();
  syncSceneDocumentLayout();
}

function resetSceneDraft(sceneId) {
  if (!state.sceneDrafts[sceneId]) {
    return;
  }

  const nextDrafts = { ...state.sceneDrafts };
  delete nextDrafts[sceneId];
  state.sceneDrafts = nextDrafts;
  writeStoredJson(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
  renderHeader();
  queueWritingTargetSnapshot({
    markSessionActivity: true,
    reason: "scene-reset",
  });
}

// Intent: create manuscript structure drafts as explicit binder entities with stable IDs.
function addChapterDraft() {
  const timestamp = Date.now();
  const sceneId = `draft-scene-${timestamp}`;
  const chapterId = `draft-chapter-${timestamp}`;
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: [
      ...cloneValue(state.structureDrafts.scenes ?? []),
      {
        sceneId,
        chapterId,
        chapterTitle: "",
        sceneTitle: "New Scene",
        initialText: "",
      },
    ],
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

function addSceneDraft() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  if (!selectedScene) {
    return;
  }

  const sceneCount = getScenesForChapter(selectedScene.chapterId).length + 1;
  const sceneId = `draft-scene-${Date.now()}`;
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: [
      ...cloneValue(state.structureDrafts.scenes ?? []),
      {
        sceneId,
        chapterId: selectedScene.chapterId,
        chapterTitle: selectedScene.chapterTitle,
        sceneTitle: `New Scene ${sceneCount}`,
        initialText: "",
      },
    ],
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

function addTemplateDraft() {
  const templateNumber = state.templateDrafts.length + 1;
  state.templateDrafts = [
    ...state.templateDrafts,
    {
      id: `draft-template-${Date.now()}`,
      name: `New Template ${templateNumber}`,
      key: `draft-template-${templateNumber}`,
      description: "Describe this world template.",
      fieldCount: 0,
      isDraft: true,
    },
  ];
  writeStoredJson(EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts);
  renderEntityPanel();
}

function sceneDraftHasSubstantiveBody(draft) {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  if (typeof draft.editorText === "string" && draft.editorText.trim()) {
    return true;
  }

  const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
  return blocks.some((block) => typeof block?.text === "string" && block.text.trim().length > 0);
}

function loadSceneDraftIntoState(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    sceneStorageLog.warn("validation", "scene.load.skipped", "Scene draft load skipped because scene ID was empty.", {
      sceneId: sceneId ?? "",
    });
    return;
  }

  const resolvedSceneId = sceneId.trim();
  const existingDraft = state.sceneDrafts?.[resolvedSceneId] ?? null;
  const existingHasBody = sceneDraftHasSubstantiveBody(existingDraft);
  if (existingDraft && existingHasBody) {
    return;
  }

  const projectRecord = getActiveProjectRecord();
  if (!projectRecord) {
    sceneStorageLog.warn("validation", "scene.load.skipped", "Scene draft load skipped because no active project record exists.", {
      sceneId: resolvedSceneId,
    });
    return;
  }

  const loadedDraft = projectService.loadScene({
    projectRecord,
    sceneId: resolvedSceneId,
  });
  if (!loadedDraft) {
    sceneStorageLog.warn("validation", "scene.load.missing", "Project service did not return a draft for requested scene.", {
      projectId: projectRecord.id,
      sceneId: resolvedSceneId,
    });
    return;
  }

  const loadedHasBody = sceneDraftHasSubstantiveBody(loadedDraft);
  if (existingDraft && !existingHasBody && !loadedHasBody) {
    return;
  }
  if (existingDraft && existingHasBody) {
    return;
  }

  state.sceneDrafts = {
    ...(state.sceneDrafts && typeof state.sceneDrafts === "object" ? state.sceneDrafts : {}),
    [resolvedSceneId]: cloneValue(loadedDraft),
  };
  const storedRecord = getProjectRecordById(projectRecord.id);
  if (storedRecord) {
    storedRecord.sceneDrafts = {
      ...(storedRecord.sceneDrafts && typeof storedRecord.sceneDrafts === "object"
        ? storedRecord.sceneDrafts
        : {}),
      [resolvedSceneId]: cloneValue(loadedDraft),
    };
  }
  refreshScenes();
  sceneStorageLog.info("state-change", "scene.load.completed", "Loaded scene draft into runtime cache.", {
    projectId: projectRecord.id,
    sceneId: resolvedSceneId,
    hadExistingDraft: existingDraft != null,
    loadedHasBody,
  });
}

function selectSceneById(sceneId) {
  const scene = getScene(sceneId);
  if (!scene) {
    editorInteractionLog.warn("validation", "scene.select.missing", "Scene selection requested for missing scene ID.", {
      sceneId: sceneId ?? "",
    });
    return;
  }

  loadSceneDraftIntoState(scene.sceneId);
  const refreshedScene = getScene(scene.sceneId);
  if (!refreshedScene) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = refreshedScene.sceneId;
  state.selectedBlockId = refreshedScene.blocks[0]?.blockId ?? null;
  editorInteractionLog.info("user-action", "scene.select", "Selected scene in manuscript binder.", {
    sceneId: refreshedScene.sceneId,
    chapterId: refreshedScene.chapterId ?? "",
    blockId: state.selectedBlockId ?? "",
  });
  render();
}

function selectChapterById(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  const chapterScene = getScenesForChapter(chapterId)[0];
  if (chapterScene) {
    selectSceneById(chapterScene.sceneId);
  }
}

function toggleChapterCollapse(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  const nextCollapsed = new Set(state.collapsedChapterIds);
  if (nextCollapsed.has(chapterId)) {
    nextCollapsed.delete(chapterId);
  } else {
    nextCollapsed.add(chapterId);
  }

  state.collapsedChapterIds = [...nextCollapsed];
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  persistCurrentProjectRecord();
  renderBinderPanel();
}

function toggleConsoleChapterCollapse(panelId, chapterKey) {
  if (typeof panelId !== "string" || !panelId.trim() || typeof chapterKey !== "string" || !chapterKey.trim()) {
    return;
  }

  if (!state.activeProjectId) {
    return;
  }

  const panelState = {
    issueTasks: normalizeChapterIdList(state.collapsedConsoleChapterIds.issueTasks),
    issues: normalizeChapterIdList(state.collapsedConsoleChapterIds.issues),
    inspiration: normalizeChapterIdList(state.collapsedConsoleChapterIds.inspiration),
    research: normalizeChapterIdList(state.collapsedConsoleChapterIds.research),
  };
  if (!Object.prototype.hasOwnProperty.call(panelState, panelId)) {
    return;
  }
  const nextCollapsed = new Set(panelState[panelId] ?? []);
  if (nextCollapsed.has(chapterKey)) {
    nextCollapsed.delete(chapterKey);
  } else {
    nextCollapsed.add(chapterKey);
  }

  panelState[panelId] = [...nextCollapsed];
  state.collapsedConsoleChapterIds = panelState;
  persistCollapsedConsoleChapterState(state.activeProjectId, panelState);
  persistCurrentProjectRecord();
  renderConsolePanel();
}

function syncSelectionFromBlock(blockId) {
  const scene = blockId ? findSceneByBlockId(state.scenes, blockId) : state.scenes[0];
  if (!scene) {
    return;
  }

  loadSceneDraftIntoState(scene.sceneId);
  const resolvedScene = getScene(scene.sceneId) ?? scene;
  state.selectedSceneId = resolvedScene.sceneId;
  state.selectedBlockId =
    blockId && resolvedScene.blocks.some((block) => block.blockId === blockId)
      ? blockId
      : resolvedScene.blocks[0]?.blockId ?? null;
}

function getSelectedScene() {
  return getScene(state.selectedSceneId);
}

function getScene(sceneId) {
  return state.scenes.find((scene) => scene.sceneId === sceneId) ?? null;
}

function getScenesForChapter(chapterId) {
  return state.scenes.filter((scene) => scene.chapterId === chapterId);
}

function isChapterCollapsed(chapterId) {
  return state.collapsedChapterIds.includes(chapterId);
}

function getIssue(issueId) {
  return state.workspace.project.issues.find((issue) => issue.id === issueId) ?? null;
}

function getEvent(eventId) {
  return state.workspace.project.eventTags.find((eventTag) => eventTag.id === eventId) ?? null;
}

function getNode(nodeId) {
  for (const spine of state.workspace.world.spines) {
    const node = spine.nodes.find((candidate) => candidate.id === nodeId);
    if (node) {
      return node;
    }
  }
  return null;
}

function getEntity(entityId) {
  return state.workspace.world.entities.find((entity) => entity.id === entityId) ?? null;
}

function stripChapterTitlePrefix(chapterTitle) {
  return String(chapterTitle ?? "")
    .replace(/^(?:new\s+)?chapter\s+\d+\s*[:\-–—]?\s*/i, "")
    .trim();
}

function getEditableChapterTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  if (!value) {
    return "";
  }

  const stripped = stripChapterTitlePrefix(value);
  return stripped || value;
}

function updateBinderChapterTitle(node, chapterId, title) {
  if (!node || typeof node !== "object") {
    return false;
  }

  let updated = false;
  if (node.kind === "chapter" && node.refId === chapterId) {
    node.title = title;
    updated = true;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      updated = updateBinderChapterTitle(child, chapterId, title) || updated;
    }
  }

  return updated;
}

function updateChapterTitle(chapterId, title) {
  if (typeof chapterId !== "string" || !chapterId.trim() || !state.workspace?.project) {
    return;
  }

  const nextTitle = String(title ?? "");
  let updated = false;

  if (Array.isArray(state.workspace.project.lines)) {
    for (const line of state.workspace.project.lines) {
      if (line.chapterId === chapterId) {
        line.chapterTitle = nextTitle;
        updated = true;
      }
    }
  }

  if (state.workspace.project.navigationTargets && typeof state.workspace.project.navigationTargets === "object") {
    const navigationTarget = state.workspace.project.navigationTargets[chapterId];
    if (navigationTarget && typeof navigationTarget === "object") {
      navigationTarget.title = nextTitle;
      updated = true;
    }
  }

  if (state.workspace.project.binder) {
    updated = updateBinderChapterTitle(state.workspace.project.binder, chapterId, nextTitle) || updated;
  }

  if (Array.isArray(state.structureDrafts.scenes)) {
    for (const scene of state.structureDrafts.scenes) {
      if (scene.chapterId === chapterId) {
        scene.chapterTitle = nextTitle;
        updated = true;
      }
    }
  }

  if (!updated) {
    return;
  }

  refreshScenes();
  persistCurrentProjectRecord();
  updateSceneEditorChapterTitle(chapterId, nextTitle);
}

function beginChapterTitleEdit(chapterId) {
  if (typeof chapterId !== "string" || !chapterId.trim()) {
    return;
  }

  state.editingChapterTitleId = chapterId;
  const binderSlot = document.querySelector("#binder-slot");
  const scrollTop = binderSlot instanceof HTMLElement ? binderSlot.scrollTop : 0;
  const scrollLeft = binderSlot instanceof HTMLElement ? binderSlot.scrollLeft : 0;
  renderBinderPanel();
  window.requestAnimationFrame(() => {
    const nextBinderSlot = document.querySelector("#binder-slot");
    if (nextBinderSlot instanceof HTMLElement) {
      nextBinderSlot.scrollTop = scrollTop;
      nextBinderSlot.scrollLeft = scrollLeft;
    }

    const titleInput = document.querySelector(
      `.binder-chapter-title-input[data-chapter-id="${CSS.escape(chapterId)}"]`,
    );
    if (titleInput instanceof HTMLInputElement) {
      titleInput.focus();
      titleInput.select();
    }
  });
}

function consumeBinderTitleClick(kind, id) {
  if (typeof kind !== "string" || !kind.trim() || typeof id !== "string" || !id.trim()) {
    return false;
  }

  const now = Date.now();
  const previous = binderTitleClickState;
  const isRepeat =
    previous &&
    previous.kind === kind &&
    previous.id === id &&
    now - previous.timestamp <= BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS;

  if (previous?.timeoutId) {
    window.clearTimeout(previous.timeoutId);
  }

  if (isRepeat) {
    binderTitleClickState = null;
    return true;
  }

  const stateSnapshot = {
    kind,
    id,
    timestamp: now,
    timeoutId: window.setTimeout(() => {
      if (
        binderTitleClickState &&
        binderTitleClickState.kind === stateSnapshot.kind &&
        binderTitleClickState.id === stateSnapshot.id &&
        binderTitleClickState.timestamp === stateSnapshot.timestamp
      ) {
        binderTitleClickState = null;
      }
    }, BINDER_TITLE_DOUBLE_CLICK_WINDOW_MS),
  };
  binderTitleClickState = stateSnapshot;
  return false;
}

function finishChapterTitleEdit(chapterId) {
  if (typeof chapterId !== "string" || state.editingChapterTitleId !== chapterId) {
    return;
  }

  state.editingChapterTitleId = null;
  renderBinderPanel();
}

function beginSceneTitleEdit(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return;
  }

  state.editingSceneTitleId = sceneId;
  const binderSlot = document.querySelector("#binder-slot");
  const scrollTop = binderSlot instanceof HTMLElement ? binderSlot.scrollTop : 0;
  const scrollLeft = binderSlot instanceof HTMLElement ? binderSlot.scrollLeft : 0;
  renderBinderPanel();
  window.requestAnimationFrame(() => {
    const nextBinderSlot = document.querySelector("#binder-slot");
    if (nextBinderSlot instanceof HTMLElement) {
      nextBinderSlot.scrollTop = scrollTop;
      nextBinderSlot.scrollLeft = scrollLeft;
    }

    const titleInput = document.querySelector(
      `.binder-scene-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
    );
    if (titleInput instanceof HTMLInputElement) {
      titleInput.focus();
      titleInput.select();
    }
  });
}

function finishSceneTitleEdit(sceneId) {
  if (typeof sceneId !== "string" || state.editingSceneTitleId !== sceneId) {
    return;
  }

  state.editingSceneTitleId = null;
  renderBinderPanel();
}

function updateSceneTitleLabel(sceneId, title) {
  document
    .querySelectorAll(`[data-scene-title-id="${CSS.escape(sceneId)}"] span:last-child`)
    .forEach((node) => {
      node.textContent = title;
    });
}

function getEditorTypingSpellcheckRange(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  if (document.activeElement !== textarea) {
    return null;
  }

  if (!Number.isInteger(textarea.selectionStart) || textarea.selectionStart !== textarea.selectionEnd) {
    return null;
  }

  const caretOffset = textarea.selectionStart;
  const source = String(textarea.value ?? "");
  const previousChar = caretOffset > 0 ? source[caretOffset - 1] : "";
  const nextChar = caretOffset < source.length ? source[caretOffset] : "";
  const currentWordBoundary = /[A-Za-z'’-]/;
  if (!currentWordBoundary.test(previousChar) && !currentWordBoundary.test(nextChar)) {
    return null;
  }

  const range = getSpellcheckWordRange(source, caretOffset);
  if (!range) {
    return null;
  }

  if (caretOffset < range.startOffset || caretOffset > range.endOffset) {
    return null;
  }

  return range;
}

function syncSpellcheckLayer(layer, textarea, sceneId, options = {}) {
  if (!(layer instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (!spellcheckBaseLexicon?.wordList?.length) {
    layer.innerHTML = "";
    return;
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  layer.innerHTML = `
    <div class="editor-spellcheck-layer__content">
      ${renderSpellcheckUnderlineHTML(textarea.value, {
        baseLexicon: spellcheckBaseLexicon,
        projectLexicon,
        referenceLexicon: spellcheckReferenceLexicon,
        sceneId,
      }, options)}
    </div>
  `;

  const content = layer.querySelector(".editor-spellcheck-layer__content");
  if (content instanceof HTMLElement) {
    syncSpellcheckLayerStyle(content, textarea);
  }
}

function renderSpellcheckUnderlineHTML(text, lexicons = {}, options = {}) {
  const source = String(text ?? "");
  if (!source.length) {
    return "";
  }

  const activeTypingWordRange = options.activeTypingWordRange ?? options.excludeRange ?? null;
  const baseLexicon = lexicons.baseLexicon ?? null;
  const projectLexicon = lexicons.projectLexicon ?? null;
  const referenceLexicon = lexicons.referenceLexicon ?? null;
  const pattern = /[A-Za-z][A-Za-z'’-]*/g;
  let lastIndex = 0;
  let output = "";

  for (const match of source.matchAll(pattern)) {
    const token = String(match[0] ?? "");
    const index = Number(match.index);
    if (!Number.isInteger(index) || index < lastIndex) {
      continue;
    }

    output += escapeHtml(source.slice(lastIndex, index));

    const isMisspelled = isSpellcheckMisspelledWord(token, {
      baseLexicon,
      projectLexicon,
      referenceLexicon,
    });
    if (
      activeTypingWordRange &&
      index === Number(activeTypingWordRange.startOffset) &&
      index + token.length === Number(activeTypingWordRange.endOffset)
    ) {
      output += escapeHtml(token);
      lastIndex = index + token.length;
      continue;
    }
    const tokenHtml = escapeHtml(token);
    output += isMisspelled
      ? `<span class="editor-spellcheck-word is-misspelled" data-spellcheck-start="${index}" data-spellcheck-end="${index + token.length}">${tokenHtml}</span>`
      : `<span class="editor-spellcheck-word" data-spellcheck-start="${index}" data-spellcheck-end="${index + token.length}">${tokenHtml}</span>`;

    lastIndex = index + token.length;
  }

  output += escapeHtml(source.slice(lastIndex));
  return output;
}

function syncSpellcheckLayerTypingState(layer, activeTypingWordRange) {
  if (!(layer instanceof HTMLElement)) {
    return;
  }

  const content = layer.querySelector(".editor-spellcheck-layer__content");
  if (!(content instanceof HTMLElement)) {
    return;
  }

  content.querySelectorAll(".editor-spellcheck-word.is-typing-active").forEach((word) => {
    word.classList.remove("is-typing-active");
  });

  const startOffset = Number(activeTypingWordRange?.startOffset);
  const endOffset = Number(activeTypingWordRange?.endOffset);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    return;
  }

  const activeWord = content.querySelector(
    `.editor-spellcheck-word[data-spellcheck-start="${startOffset}"][data-spellcheck-end="${endOffset}"]`,
  );
  if (activeWord instanceof HTMLElement) {
    activeWord.classList.add("is-typing-active");
  }
}

function syncSpellcheckLayerStyle(content, textarea) {
  if (!(content instanceof HTMLElement) || !(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  const style = window.getComputedStyle(textarea);
  const mirroredProperties = [
    "boxSizing",
    "direction",
    "font",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontVariant",
    "fontVariantLigatures",
    "fontWeight",
    "fontStretch",
    "fontKerning",
    "fontFeatureSettings",
    "fontVariationSettings",
    "letterSpacing",
    "lineHeight",
    "textAlign",
    "textIndent",
    "textRendering",
    "textTransform",
    "unicodeBidi",
    "whiteSpace",
    "wordBreak",
    "wordSpacing",
    "overflowWrap",
    "hyphens",
    "tabSize",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
  ];

  for (const property of mirroredProperties) {
    try {
      content.style[property] = style[property] || "";
    } catch {
      // Ignore unsupported style properties in older browsers.
    }
  }

  content.style.width = `${Math.round(textarea.clientWidth)}px`;
  content.style.minHeight = `${Math.round(textarea.scrollHeight)}px`;
  content.style.color = "rgba(31, 36, 48, 0.02)";
  content.style.margin = "0";
}

function updateSceneEditorTitle(sceneId, title) {
  const titleInput = document.querySelector(
    `.editor-title-input[data-scene-id="${CSS.escape(sceneId)}"]`,
  );
  if (titleInput instanceof HTMLInputElement) {
    titleInput.value = String(title ?? "");
  }
}

function updateSceneEditorChapterTitle(chapterId, title) {
  const titleNode = document.querySelector(
    `[data-scene-editor-chapter-title="${CSS.escape(chapterId)}"]`,
  );
  if (titleNode instanceof HTMLElement) {
    titleNode.textContent = formatChapterDisplayTitle(title);
  }
}

function updateSceneEditorChapterForScene(sceneId, chapterId, title) {
  const sceneShell = document.querySelector(
    `[data-scene-editor-scene-id="${CSS.escape(sceneId)}"]`,
  );
  if (!(sceneShell instanceof HTMLElement)) {
    return false;
  }

  const titleNode = sceneShell.querySelector("[data-scene-editor-chapter-title]");
  if (!(titleNode instanceof HTMLElement)) {
    return false;
  }

  titleNode.textContent = formatChapterDisplayTitle(title);
  titleNode.dataset.sceneEditorChapterTitle = chapterId;
  return true;
}

function isPersistentScene(scene) {
  return Boolean(
    scene &&
    Array.isArray(scene.blocks) &&
    scene.blocks.some((block) => Number.isInteger(block.lineNumber)),
  );
}

function getPersistentSceneById(sceneId) {
  const scene = getScene(sceneId);
  return isPersistentScene(scene) ? scene : null;
}

function buildSceneGroupsFromProjectLines(lines) {
  const groups = [];
  const groupsBySceneId = new Map();

  for (const line of Array.isArray(lines) ? lines : []) {
    if (!line || typeof line !== "object") {
      continue;
    }

    const sceneId = typeof line.sceneId === "string" ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    let group = groupsBySceneId.get(sceneId);
    if (!group) {
      group = {
        sceneId,
        chapterId: typeof line.chapterId === "string" ? line.chapterId : "",
        chapterTitle: typeof line.chapterTitle === "string" ? line.chapterTitle : "",
        sceneTitle: typeof line.sceneTitle === "string" ? line.sceneTitle : "",
        sceneSynopsis: typeof line.sceneSynopsis === "string" ? line.sceneSynopsis : "",
        lines: [],
      };
      groupsBySceneId.set(sceneId, group);
      groups.push(group);
    }

    group.lines.push(line);
  }

  return groups;
}

function describeSceneGroups(sceneGroups) {
  return sceneGroups
    .map((group) => `${group.sceneId}:${group.chapterId}:${group.chapterTitle}`)
    .join("|");
}

function collectBinderNodeIds(node, nodeIds = new Map()) {
  if (!node || typeof node !== "object") {
    return nodeIds;
  }

  if (typeof node.refId === "string" && node.refId.trim() && typeof node.id === "string") {
    nodeIds.set(node.refId, node.id);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectBinderNodeIds(child, nodeIds);
    }
  }

  return nodeIds;
}

function buildBinderTreeFromSceneGroups(project, sceneGroups) {
  const existingNodeIds = collectBinderNodeIds(project?.binder);
  const rootId =
    existingNodeIds.get(project?.id) ??
    (typeof project?.id === "string" && project.id.trim() ? `binder-${project.id}` : "binder-project");
  const binderRoot = {
    id: rootId,
    kind: "project",
    refId: project?.id ?? "project",
    title: project?.title ?? "Untitled Project",
    order: 1,
    children: [],
  };
  const chapterNodes = new Map();

  for (const sceneGroup of sceneGroups) {
    if (!chapterNodes.has(sceneGroup.chapterId)) {
      const chapterNodeId =
        existingNodeIds.get(sceneGroup.chapterId) ??
        `binder-${sceneGroup.chapterId}`;
      const chapterNode = {
        id: chapterNodeId,
        kind: "chapter",
        refId: sceneGroup.chapterId,
        title: sceneGroup.chapterTitle,
        order: chapterNodes.size + 1,
        children: [],
      };
      chapterNodes.set(sceneGroup.chapterId, chapterNode);
      binderRoot.children.push(chapterNode);
    }

    const chapterNode = chapterNodes.get(sceneGroup.chapterId);
    chapterNode.children.push({
      id: existingNodeIds.get(sceneGroup.sceneId) ?? `binder-${sceneGroup.sceneId}`,
      kind: "scene",
      refId: sceneGroup.sceneId,
      title: sceneGroup.sceneTitle,
      order: chapterNode.children.length + 1,
      children: [],
    });
  }

  return binderRoot;
}

function buildNavigationTargetsFromLines(project, lines) {
  const targets = {};
  const firstLine = lines[0];

  if (firstLine) {
    targets[project.id] = {
      refId: project.id,
      kind: "project",
      title: project.title,
      lineId: firstLine.blockId,
      lineNumber: firstLine.lineNumber,
    };
  }

  const seenChapters = new Set();
  const seenScenes = new Set();
  for (const line of lines) {
    if (!seenChapters.has(line.chapterId)) {
      seenChapters.add(line.chapterId);
      targets[line.chapterId] = {
        refId: line.chapterId,
        kind: "chapter",
        title: line.chapterTitle,
        lineId: line.blockId,
        lineNumber: line.lineNumber,
      };
    }

    if (!seenScenes.has(line.sceneId)) {
      seenScenes.add(line.sceneId);
      targets[line.sceneId] = {
        refId: line.sceneId,
        kind: "scene",
        title: line.sceneTitle,
        lineId: line.blockId,
        lineNumber: line.lineNumber,
      };
    }
  }

  return targets;
}

function reorderSceneGroupsForDropTarget(sceneGroups, sourceSceneId, dropTarget) {
  const sourceIndex = sceneGroups.findIndex((group) => group.sceneId === sourceSceneId);
  if (sourceIndex === -1) {
    return null;
  }

  const nextGroups = sceneGroups.map((group) => ({
    ...group,
    lines: [...group.lines],
  }));
  const [movedGroup] = nextGroups.splice(sourceIndex, 1);

  let insertIndex = -1;
  let targetChapterId = "";
  let targetChapterTitle = "";

  if (dropTarget.type === "chapter-start") {
    const targetIndex = nextGroups.findIndex((group) => group.chapterId === dropTarget.chapterId);
    if (targetIndex === -1) {
      return null;
    }

    insertIndex = targetIndex;
    targetChapterId = nextGroups[targetIndex].chapterId;
    targetChapterTitle = nextGroups[targetIndex].chapterTitle;
  } else {
    const targetIndex = nextGroups.findIndex((group) => group.sceneId === dropTarget.sceneId);
    if (targetIndex === -1 || dropTarget.sceneId === sourceSceneId) {
      return null;
    }

    insertIndex = dropTarget.type === "before" ? targetIndex : targetIndex + 1;
    targetChapterId = nextGroups[targetIndex].chapterId;
    targetChapterTitle = nextGroups[targetIndex].chapterTitle;
  }

  movedGroup.chapterId = targetChapterId;
  movedGroup.chapterTitle = targetChapterTitle;
  nextGroups.splice(insertIndex, 0, movedGroup);

  return nextGroups;
}

function rebuildProjectSceneStateFromGroups(project, sceneGroups) {
  const lines = [];
  const lineByBlockId = new Map();
  const sceneMetaBySceneId = new Map();
  let lineNumber = 1;
  let currentChapterId = "";
  let sceneNumberInChapter = 0;

  for (const sceneGroup of sceneGroups) {
    if (sceneGroup.chapterId !== currentChapterId) {
      currentChapterId = sceneGroup.chapterId;
      sceneNumberInChapter = 0;
    }

    sceneNumberInChapter += 1;
    sceneMetaBySceneId.set(sceneGroup.sceneId, {
      chapterId: sceneGroup.chapterId,
      chapterTitle: sceneGroup.chapterTitle,
      sceneId: sceneGroup.sceneId,
      sceneTitle: sceneGroup.sceneTitle,
    });

    sceneGroup.lines.forEach((line, index) => {
      const nextLine = {
        ...line,
        lineNumber,
        sceneLineNumber: index + 1,
        chapterId: sceneGroup.chapterId,
        chapterTitle: sceneGroup.chapterTitle,
        sceneId: sceneGroup.sceneId,
        sceneTitle: sceneGroup.sceneTitle,
        sceneSynopsis: sceneGroup.sceneSynopsis ?? line.sceneSynopsis ?? "",
        startsChapter: index === 0 && sceneNumberInChapter === 1,
        startsScene: index === 0,
        issueIds: [],
        eventTagIds: [],
      };
      lines.push(nextLine);
      lineByBlockId.set(nextLine.blockId, nextLine);
      lineNumber += 1;
    });
  }

  const issues = Array.isArray(project?.issues)
    ? project.issues.map((issue) => {
        const line = typeof issue?.blockId === "string" ? lineByBlockId.get(issue.blockId) : null;
        if (line) {
          line.issueIds.push(issue.id);
        }

        if (!line) {
          return { ...issue };
        }

        return {
          ...issue,
          lineNumber: line.lineNumber,
          sceneLineNumber: line.sceneLineNumber,
          chapterTitle: line.chapterTitle,
          sceneTitle: line.sceneTitle,
        };
      })
    : [];

  const eventTags = Array.isArray(project?.eventTags)
    ? project.eventTags.map((eventTag) => {
        const line = typeof eventTag?.blockId === "string" ? lineByBlockId.get(eventTag.blockId) : null;
        if (line) {
          line.eventTagIds.push(eventTag.id);
        }

        if (!line) {
          return { ...eventTag };
        }

        return {
          ...eventTag,
          lineNumber: line.lineNumber,
          sceneLineNumber: line.sceneLineNumber,
          chapterTitle: line.chapterTitle,
          sceneTitle: line.sceneTitle,
        };
      })
    : [];

  return {
    lines,
    lineByBlockId,
    sceneMetaBySceneId,
    binder: buildBinderTreeFromSceneGroups(project, sceneGroups),
    navigationTargets: buildNavigationTargetsFromLines(project, lines),
    issues,
    eventTags,
    stats: {
      chapterCount: new Set(sceneGroups.map((group) => group.chapterId)).size,
      sceneCount: sceneGroups.length,
      lineCount: lines.length,
      issueCount: issues.length,
      eventCount: eventTags.length,
      characterCount: Array.isArray(project?.characters) ? project.characters.length : 0,
    },
  };
}

function syncSceneLinkedMetadata(items, sceneMetaBySceneId) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const sceneMeta = sceneMetaBySceneId.get(item?.sceneId);
    if (!sceneMeta) {
      return { ...item };
    }

    return {
      ...item,
      chapterId: sceneMeta.chapterId,
      chapterTitle: sceneMeta.chapterTitle,
      sceneId: sceneMeta.sceneId,
      sceneTitle: sceneMeta.sceneTitle,
    };
  });
}

function syncSuggestionQueueMetadata(queue, lineByBlockId) {
  if (!Array.isArray(queue)) {
    return [];
  }

  return queue.map((suggestion) => ({
    ...suggestion,
    evidence: Array.isArray(suggestion?.evidence)
      ? suggestion.evidence.map((evidence) => {
          const line = typeof evidence?.blockId === "string" ? lineByBlockId.get(evidence.blockId) : null;
          if (!line) {
            return { ...evidence };
          }

          return {
            ...evidence,
            lineNumber: line.lineNumber,
            sceneLineNumber: line.sceneLineNumber,
            chapterTitle: line.chapterTitle,
            sceneTitle: line.sceneTitle,
          };
        })
      : [],
  }));
}

function syncNarrationSessionMetadata(session, lineByBlockId) {
  if (!session || typeof session !== "object") {
    return session;
  }

  const anchor = session.currentAnchor && typeof session.currentAnchor === "object"
    ? session.currentAnchor
    : null;
  const line = anchor?.blockId ? lineByBlockId.get(anchor.blockId) : null;
  if (!line) {
    return session;
  }

  return {
    ...session,
    currentAnchor: {
      ...anchor,
      chapterId: line.chapterId,
      sceneId: line.sceneId,
    },
    currentLineNumber: line.lineNumber,
    currentText: line.text,
    updatedAt: new Date().toISOString(),
  };
}

function syncNarrationAlignmentJobs(jobs, lineByBlockId) {
  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs.map((job) => {
    const anchor = job?.request?.anchor;
    const line = anchor?.blockId ? lineByBlockId.get(anchor.blockId) : null;
    if (!line) {
      return { ...job };
    }

    return {
      ...job,
      request: {
        ...job.request,
        anchor: {
          ...anchor,
          chapterId: line.chapterId,
          sceneId: line.sceneId,
        },
      },
      result: job.result && typeof job.result === "object"
        ? {
            ...job.result,
            matchedLineNumber: line.lineNumber,
          }
        : job.result,
    };
  });
}

function syncVoiceRecordingsMetadata(recordings, lineByBlockId) {
  if (!Array.isArray(recordings)) {
    return [];
  }

  return recordings.map((recording) => {
    const line = typeof recording?.blockId === "string" ? lineByBlockId.get(recording.blockId) : null;
    if (!line) {
      return { ...recording };
    }

    return {
      ...recording,
      chapterId: line.chapterId,
      chapterTitle: line.chapterTitle,
      sceneId: line.sceneId,
      sceneTitle: line.sceneTitle,
      lineNumber: line.lineNumber,
    };
  });
}

function syncVoiceRenderJobsMetadata(jobs, sceneMetaBySceneId) {
  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs.map((job) => {
    const sceneId = typeof job?.request?.sceneId === "string" ? job.request.sceneId : "";
    if (!sceneId) {
      return { ...job };
    }

    const sceneMeta = sceneMetaBySceneId.get(sceneId);
    if (!sceneMeta) {
      return { ...job };
    }

    return {
      ...job,
      request: {
        ...job.request,
        chapterId: sceneMeta.chapterId,
      },
    };
  });
}

function moveBinderScene(sceneId, dropTarget) {
  if (typeof sceneId !== "string" || !sceneId.trim() || !dropTarget || !state.workspace?.project) {
    return false;
  }

  if (!getPersistentSceneById(sceneId)) {
    return false;
  }

  const sceneGroups = buildSceneGroupsFromProjectLines(state.workspace.project.lines);
  const nextSceneGroups = reorderSceneGroupsForDropTarget(sceneGroups, sceneId, dropTarget);
  if (!nextSceneGroups) {
    return false;
  }

  if (describeSceneGroups(sceneGroups) === describeSceneGroups(nextSceneGroups)) {
    return false;
  }

  const beforeSceneGroups = cloneBinderSceneGroups(sceneGroups);
  resetBinderSceneDragState();
  const applied = applyBinderSceneGroups(nextSceneGroups, {
    persist: false,
    render: false,
  });
  if (!applied) {
    return false;
  }

  pushBinderSceneMoveHistory(beforeSceneGroups, nextSceneGroups, sceneId);
  persistCurrentProjectRecord();

  if (state.selectedSceneId === sceneId) {
    const movedScene = getScene(sceneId);
    if (movedScene) {
      updateSceneEditorChapterForScene(sceneId, movedScene.chapterId, movedScene.chapterTitle);
    }
  }

  // Intent: repaint on the next frame so native drag/drop can settle before the binder rerenders.
  window.requestAnimationFrame(() => {
    render();
  });
  return true;
}

function syncStructureDraftScenesFromSceneGroups(sceneGroups) {
  if (!Array.isArray(state.structureDrafts?.scenes)) {
    return false;
  }

  const orderedDraftScenes = [];
  const draftSceneById = new Map();
  let changed = false;

  for (const draftScene of state.structureDrafts.scenes) {
    if (!draftScene || typeof draftScene !== "object") {
      continue;
    }

    const draftSceneId = typeof draftScene.sceneId === "string" ? draftScene.sceneId.trim() : "";
    if (draftSceneId) {
      draftSceneById.set(draftSceneId, draftScene);
    }
  }

  for (const sceneGroup of Array.isArray(sceneGroups) ? sceneGroups : []) {
    const draftScene = draftSceneById.get(sceneGroup.sceneId);
    if (!draftScene) {
      continue;
    }

    const nextDraftScene = { ...draftScene };
    if (nextDraftScene.chapterId !== sceneGroup.chapterId) {
      nextDraftScene.chapterId = sceneGroup.chapterId;
      changed = true;
    }
    if (nextDraftScene.chapterTitle !== sceneGroup.chapterTitle) {
      nextDraftScene.chapterTitle = sceneGroup.chapterTitle;
      changed = true;
    }

    orderedDraftScenes.push(nextDraftScene);
    draftSceneById.delete(sceneGroup.sceneId);
  }

  for (const draftScene of state.structureDrafts.scenes) {
    if (!draftScene || typeof draftScene !== "object") {
      continue;
    }

    const draftSceneId = typeof draftScene.sceneId === "string" ? draftScene.sceneId.trim() : "";
    if (!draftSceneId || !draftSceneById.has(draftSceneId)) {
      continue;
    }

    orderedDraftScenes.push(draftScene);
    draftSceneById.delete(draftSceneId);
  }

  if (!changed) {
    return false;
  }

  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: orderedDraftScenes,
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  return true;
}

function deleteSceneFromBinder(sceneId) {
  const scene = getScene(sceneId);
  if (!scene || !state.workspace?.project) {
    hideBinderContextMenu();
    return false;
  }

  const confirmed = window.confirm(
    `Delete "${scene.sceneTitle}"?\n\nThis removes the scene, its tasks, notes, and linked diagnostics.`,
  );
  if (!confirmed) {
    hideBinderContextMenu();
    return false;
  }

  return removeScenesFromProject([scene.sceneId]);
}

function deleteChapterFromBinder(chapterId) {
  if (!state.workspace?.project) {
    hideBinderContextMenu();
    return false;
  }

  const chapterScenes = getScenesForChapter(chapterId);
  if (!chapterScenes.length) {
    hideBinderContextMenu();
    return false;
  }

  const removedSceneIds = chapterScenes.map((scene) => scene.sceneId);
  const chapterTitle = chapterScenes[0]?.chapterTitle || "Untitled chapter";
  const confirmed = window.confirm(
    `Delete "${chapterTitle}" and all ${removedSceneIds.length} of its scene${removedSceneIds.length === 1 ? "" : "s"}?\n\nThis removes their tasks, notes, and linked diagnostics.`,
  );
  if (!confirmed) {
    hideBinderContextMenu();
    return false;
  }

  return removeScenesFromProject(removedSceneIds);
}

function removeScenesFromProject(removedSceneIds) {
  if (!state.workspace?.project) {
    return false;
  }

  const sceneGroups = buildSceneGroupsFromProjectLines(state.workspace.project.lines);
  const currentScenes = Array.isArray(state.scenes) ? state.scenes : [];
  const removedSet = new Set(
    Array.isArray(removedSceneIds)
      ? removedSceneIds.filter((sceneId) => typeof sceneId === "string" && sceneId.trim())
      : [],
  );
  const removedScenes = currentScenes.filter((scene) => removedSet.has(scene.sceneId));
  if (!removedScenes.length) {
    return false;
  }

  const removedChapterIds = new Set(removedScenes.map((scene) => scene.chapterId));
  const remainingSceneIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .map((scene) => scene.sceneId),
  );
  const remainingChapterIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .map((scene) => scene.chapterId),
  );
  const remainingBlockIds = new Set(
    currentScenes
      .filter((scene) => !removedSet.has(scene.sceneId))
      .flatMap((scene) => scene.blocks.map((block) => block.blockId).filter(Boolean)),
  );
  const fallbackSceneId = getFallbackSceneIdAfterRemoval(sceneGroups, removedSet);
  const nextSceneGroups = sceneGroups.filter((group) => !removedSet.has(group.sceneId));
  const rebuilt = rebuildProjectSceneStateFromGroups(state.workspace.project, nextSceneGroups);
  const remainingIssues = rebuilt.issues.filter((issue) =>
    isManuscriptAnchorStillPresent(issue, remainingSceneIds, remainingBlockIds),
  );
  const remainingEventTags = rebuilt.eventTags.filter((eventTag) =>
    isManuscriptAnchorStillPresent(eventTag, remainingSceneIds, remainingBlockIds),
  );

  state.workspace.project = {
    ...state.workspace.project,
    binder: rebuilt.binder,
    stats: {
      ...rebuilt.stats,
      issueCount: remainingIssues.length,
      eventCount: remainingEventTags.length,
    },
    navigationTargets: rebuilt.navigationTargets,
    lines: rebuilt.lines,
    issues: remainingIssues,
    eventTags: remainingEventTags,
  };

  state.sceneDrafts = Object.fromEntries(
    Object.entries(state.sceneDrafts).filter(([sceneId]) => !removedSet.has(sceneId)),
  );
  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    scenes: Array.isArray(state.structureDrafts.scenes)
      ? state.structureDrafts.scenes.filter((draftScene) => {
          const draftSceneId = String(draftScene?.sceneId ?? "");
          const draftChapterId = String(draftScene?.chapterId ?? "");
          return !removedSet.has(draftSceneId) && !removedChapterIds.has(draftChapterId);
        })
      : [],
  };
  state.localAiTitleStatus = Object.fromEntries(
    Object.entries(state.localAiTitleStatus).filter(([sceneId]) => !removedSet.has(sceneId)),
  );
  state.manuscriptTasks = syncSceneLinkedMetadata(
    state.manuscriptTasks.filter((task) => remainingSceneIds.has(task.sceneId)),
    rebuilt.sceneMetaBySceneId,
  );
  state.passageNotes = syncSceneLinkedMetadata(
    state.passageNotes.filter((note) => remainingSceneIds.has(note.sceneId)),
    rebuilt.sceneMetaBySceneId,
  );

  if (state.workspace.narration && typeof state.workspace.narration === "object") {
    state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobs(
      state.workspace.narration.alignmentJobs,
      rebuilt.lineByBlockId,
    ).filter((job) => remainingBlockIds.has(job?.request?.anchor?.blockId));

    const currentSession = state.workspace.narration.session;
    state.workspace.narration.session =
      currentSession &&
      currentSession.currentAnchor &&
      remainingBlockIds.has(currentSession.currentAnchor.blockId)
        ? syncNarrationSessionMetadata(currentSession, rebuilt.lineByBlockId)
        : null;
  }

  if (state.workspace.voice && typeof state.workspace.voice === "object") {
    state.workspace.voice.recordings = syncVoiceRecordingsMetadata(
      state.workspace.voice.recordings,
      rebuilt.lineByBlockId,
    ).filter((recording) => remainingBlockIds.has(recording.blockId));
    state.workspace.voice.renderJobs = syncVoiceRenderJobsMetadata(
      state.workspace.voice.renderJobs,
      rebuilt.sceneMetaBySceneId,
    ).filter((job) => remainingSceneIds.has(job?.request?.sceneId));
  }

  refreshScenes();

  const fallbackScene = fallbackSceneId ? getScene(fallbackSceneId) : state.scenes[0] ?? null;
  if (fallbackScene) {
    syncSelectionFromBlock(fallbackScene.blocks[0]?.blockId ?? null);
  } else {
    state.selectedSceneId = null;
    state.selectedBlockId = null;
  }

  const currentIssueId = state.selectedIssueId;
  state.selectedIssueId = currentIssueId && state.workspace.project.issues.some((issue) => issue.id === currentIssueId)
    ? currentIssueId
    : currentIssueId
      ? state.workspace.project.issues[0]?.id ?? null
      : null;
  state.selectedTaskId = state.manuscriptTasks.some((task) => task.id === state.selectedTaskId)
    ? state.selectedTaskId
    : null;
  state.selectedPassageNoteId = state.passageNotes.some((note) => note.id === state.selectedPassageNoteId)
    ? state.selectedPassageNoteId
    : null;
  state.inlinePassageDraft = state.inlinePassageDraft && !removedSet.has(state.inlinePassageDraft.sceneId)
    ? state.inlinePassageDraft
    : null;
  state.taskComposer = state.taskComposer && !removedSet.has(state.taskComposer.sceneId)
    ? state.taskComposer
    : null;
  state.taskContextMenu = null;
  state.binderContextMenu = null;
  state.spellcheckContextMenu = null;
  state.taskPreview = state.taskPreview && !removedSet.has(state.taskPreview.sceneId)
    ? state.taskPreview
    : null;
  state.narrationTakeSelection = state.narrationTakeSelection && !removedSet.has(state.narrationTakeSelection.sceneId)
    ? state.narrationTakeSelection
    : null;
  state.editingChapterTitleId = removedChapterIds.has(state.editingChapterTitleId)
    ? null
    : state.editingChapterTitleId;
  state.editingSceneTitleId = removedSet.has(state.editingSceneTitleId)
    ? null
    : state.editingSceneTitleId;
  state.collapsedChapterIds = state.collapsedChapterIds.filter((chapterId) => remainingChapterIds.has(chapterId));
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  state.workspace.selectionDefaults = {
    ...(state.workspace.selectionDefaults ?? {}),
    lineId: state.selectedBlockId ?? "",
    sceneId: state.selectedSceneId ?? "",
    issueId: state.selectedIssueId ?? undefined,
    inlinePassageDraft: captureInlinePassageDraftDefaultsForSave(),
  };
  binderTitleClickState = null;

  persistCurrentProjectRecord();
  render();
  syncSceneDocumentLayout();
  return true;
}

function isManuscriptAnchorStillPresent(item, remainingSceneIds, remainingBlockIds) {
  // Intent: drop diagnostics and event tags tied to deleted manuscript anchors while preserving project-level records.
  const blockId = typeof item?.blockId === "string" ? item.blockId : "";
  if (blockId) {
    return remainingBlockIds.has(blockId);
  }

  const sceneId = typeof item?.sceneId === "string" ? item.sceneId : "";
  return sceneId ? remainingSceneIds.has(sceneId) : true;
}

function getFallbackSceneIdAfterRemoval(sceneGroups, removedSet) {
  if (!Array.isArray(sceneGroups) || !(removedSet instanceof Set) || !removedSet.size) {
    return null;
  }

  const removedIndices = sceneGroups
    .map((group, index) => (removedSet.has(group.sceneId) ? index : -1))
    .filter((index) => index >= 0);
  if (!removedIndices.length) {
    return null;
  }

  const firstRemovedIndex = removedIndices[0];
  const remainingGroups = sceneGroups.filter((group) => !removedSet.has(group.sceneId));
  if (!remainingGroups.length) {
    return null;
  }

  const preferredGroup = remainingGroups.find(
    (group) => sceneGroups.findIndex((candidate) => candidate.sceneId === group.sceneId) >= firstRemovedIndex,
  );
  return preferredGroup?.sceneId ?? remainingGroups[remainingGroups.length - 1]?.sceneId ?? null;
}

function trimSceneWhitespace(sceneId) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return false;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return false;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  const currentText =
    textarea instanceof HTMLTextAreaElement
      ? textarea.value
      : String(scene.editorText ?? "");
  const trimmedText = currentText.replace(/\s+$/u, "");

  if (trimmedText === currentText) {
    return false;
  }

  updateSceneDraft(sceneId, (draft) => {
    draft.editorText = trimmedText;
    draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, currentText, trimmedText);
  }, {
    reason: "scene-trim",
    immediate: true,
  });
  syncRevisionPanel(sceneId);

  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = trimmedText;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(trimmedText.length, trimmedText.length);
  }

  renderHeader();
  syncSceneDocumentLayout();
  return true;
}

function pushBinderSceneMoveHistory(beforeSceneGroups, afterSceneGroups, sceneId) {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  undoStack.push({
    sceneId,
    beforeSceneGroups: cloneBinderSceneGroups(beforeSceneGroups),
    afterSceneGroups: cloneBinderSceneGroups(afterSceneGroups),
  });

  state.binderSceneMoveHistory = {
    undoStack: undoStack.slice(-20),
    redoStack: [],
  };
}

function applyBinderSceneGroups(sceneGroups, options = {}) {
  if (!state.workspace?.project) {
    return false;
  }

  const rebuilt = rebuildProjectSceneStateFromGroups(state.workspace.project, sceneGroups);
  state.workspace.project = {
    ...state.workspace.project,
    binder: rebuilt.binder,
    stats: rebuilt.stats,
    navigationTargets: rebuilt.navigationTargets,
    lines: rebuilt.lines,
    issues: rebuilt.issues,
    eventTags: rebuilt.eventTags,
  };
  state.manuscriptTasks = syncSceneLinkedMetadata(state.manuscriptTasks, rebuilt.sceneMetaBySceneId);
  state.passageNotes = syncSceneLinkedMetadata(state.passageNotes, rebuilt.sceneMetaBySceneId);
  state.workspace.analysis.suggestionQueue = syncSuggestionQueueMetadata(
    state.workspace.analysis.suggestionQueue,
    rebuilt.lineByBlockId,
  );
  state.workspace.narration.session = syncNarrationSessionMetadata(
    state.workspace.narration.session,
    rebuilt.lineByBlockId,
  );
  state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobs(
    state.workspace.narration.alignmentJobs,
    rebuilt.lineByBlockId,
  );
  state.workspace.voice.recordings = syncVoiceRecordingsMetadata(
    state.workspace.voice.recordings,
    rebuilt.lineByBlockId,
  );
  state.workspace.voice.renderJobs = syncVoiceRenderJobsMetadata(
    state.workspace.voice.renderJobs,
    rebuilt.sceneMetaBySceneId,
  );
  syncStructureDraftScenesFromSceneGroups(sceneGroups);

  const existingChapterIds = new Set(
    [...rebuilt.sceneMetaBySceneId.values()].map((sceneMeta) => sceneMeta.chapterId),
  );
  state.collapsedChapterIds = state.collapsedChapterIds.filter((chapterId) => existingChapterIds.has(chapterId));
  persistCollapsedChapterState(state.activeProjectId, state.collapsedChapterIds);
  refreshScenes();

  if (state.selectedSceneId) {
    const selectedScene = getSelectedScene();
    if (selectedScene) {
      updateSceneEditorChapterForScene(selectedScene.sceneId, selectedScene.chapterId, selectedScene.chapterTitle);
    }
  }

  if (options.persist !== false) {
    persistCurrentProjectRecord();
  }

  if (options.render !== false) {
    window.requestAnimationFrame(() => {
      render();
    });
  }

  return true;
}

function undoBinderSceneMove() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  const entry = undoStack.pop();
  if (!entry) {
    return false;
  }

  const redoStack = Array.isArray(currentHistory.redoStack) ? [...currentHistory.redoStack] : [];
  redoStack.push(entry);
  state.binderSceneMoveHistory = {
    undoStack,
    redoStack: redoStack.slice(-20),
  };

  if (!applyBinderSceneGroups(entry.beforeSceneGroups)) {
    state.binderSceneMoveHistory = currentHistory;
    return false;
  }

  return true;
}

function redoBinderSceneMove() {
  const currentHistory = state.binderSceneMoveHistory ?? createBinderSceneMoveHistoryState();
  const redoStack = Array.isArray(currentHistory.redoStack) ? [...currentHistory.redoStack] : [];
  const entry = redoStack.pop();
  if (!entry) {
    return false;
  }

  const undoStack = Array.isArray(currentHistory.undoStack) ? [...currentHistory.undoStack] : [];
  undoStack.push(entry);
  state.binderSceneMoveHistory = {
    undoStack: undoStack.slice(-20),
    redoStack,
  };

  if (!applyBinderSceneGroups(entry.afterSceneGroups)) {
    state.binderSceneMoveHistory = currentHistory;
    return false;
  }

  return true;
}

function clearBinderSceneDropIndicators() {
  document
    .querySelectorAll(
      ".binder-scene.is-drop-before, .binder-scene.is-drop-after, .binder-scene-drop-slot.is-drop-before, .binder-scene-drop-slot.is-drop-after, .binder-chapter.is-drop-start",
    )
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        node.classList.remove("is-drop-before", "is-drop-after", "is-drop-start");
      }
    });

  if (binderSceneDragState) {
    binderSceneDragState.dropTarget = null;
  }
}

function resetBinderSceneDragState() {
  clearBinderSceneDropIndicators();

  if (binderSceneDragState?.sourceElement instanceof HTMLElement) {
    binderSceneDragState.sourceElement.classList.remove("is-dragging");
    binderSceneDragState.sourceElement.removeAttribute("aria-grabbed");
  }

  if (binderSceneDragState?.dragImage instanceof HTMLElement && binderSceneDragState.dragImage.isConnected) {
    binderSceneDragState.dragImage.remove();
  }

  binderSceneDragState = null;
}

function applyBinderSceneDropIndicator(dropTarget) {
  clearBinderSceneDropIndicators();

  if (!binderSceneDragState || !dropTarget) {
    return;
  }

  binderSceneDragState.dropTarget = dropTarget;
  const selector = dropTarget.type === "chapter-start"
    ? `[data-binder-chapter-drop-id="${CSS.escape(dropTarget.chapterId)}"]`
    : `[data-binder-scene-drop-slot-id="${CSS.escape(dropTarget.sceneId)}"][data-binder-scene-drop-position="${CSS.escape(dropTarget.type)}"], [data-binder-scene-drop-id="${CSS.escape(dropTarget.sceneId)}"]`;
  const dropElement = document.querySelector(selector);
  if (!(dropElement instanceof HTMLElement)) {
    return;
  }

  if (dropTarget.type === "chapter-start") {
    dropElement.classList.add("is-drop-start");
    return;
  }

  dropElement.classList.add(dropTarget.type === "before" ? "is-drop-before" : "is-drop-after");
}

function resolveBinderSceneDropTarget(event) {
  if (!binderSceneDragState) {
    return null;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return null;
  }

  const sceneDropTarget = target.closest("[data-binder-scene-drop-id]");
  if (sceneDropTarget instanceof HTMLElement) {
    const sceneId = sceneDropTarget.dataset.binderSceneDropId;
    if (!sceneId || sceneId === binderSceneDragState.sourceSceneId) {
      return null;
    }

    const scene = getPersistentSceneById(sceneId);
    if (!scene) {
      return null;
    }

    const rect = sceneDropTarget.getBoundingClientRect();
    const placement = event.clientY < rect.top + (rect.height / 2)
      ? "before"
      : "after";

    return {
      type: placement,
      sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
    };
  }

  const sceneDropSlot = target.closest("[data-binder-scene-drop-slot-id]");
  if (sceneDropSlot instanceof HTMLElement) {
    const sceneId = sceneDropSlot.dataset.binderSceneDropSlotId;
    const position = sceneDropSlot.dataset.binderSceneDropPosition === "after" ? "after" : "before";
    if (!sceneId || sceneId === binderSceneDragState.sourceSceneId) {
      return null;
    }

    const scene = getPersistentSceneById(sceneId);
    if (!scene) {
      return null;
    }

    return {
      type: position,
      sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
    };
  }

  const chapterDropTarget = target.closest("[data-binder-chapter-drop-id]");
  if (chapterDropTarget instanceof HTMLElement) {
    const chapterId = chapterDropTarget.dataset.binderChapterDropId;
    if (!chapterId) {
      return null;
    }

    const chapterScenes = getScenesForChapter(chapterId).filter((candidate) => isPersistentScene(candidate));
    if (!chapterScenes.length) {
      return null;
    }

    // Intent: map chapter-body drops to the nearest persistent scene boundary so end-of-chapter drops land after the last scene instead of collapsing to the first placeholder.
    const pointerY = Number(event.clientY);
    const chapterSceneTargets = chapterScenes
      .map((scene) => {
        const sceneDropTarget = document.querySelector(`[data-binder-scene-drop-id="${CSS.escape(scene.sceneId)}"]`);
        if (!(sceneDropTarget instanceof HTMLElement)) {
          return null;
        }

        const rect = sceneDropTarget.getBoundingClientRect();
        return {
          scene,
          midpoint: rect.top + (rect.height / 2),
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.midpoint - right.midpoint);

    if (!chapterSceneTargets.length) {
      const firstSceneInChapter = chapterScenes[0];
      return {
        type: "before",
        sceneId: firstSceneInChapter.sceneId,
        chapterId: firstSceneInChapter.chapterId,
        chapterTitle: firstSceneInChapter.chapterTitle,
      };
    }

    let nearestTarget = chapterSceneTargets[0];
    let nearestDistance = Math.abs(pointerY - nearestTarget.midpoint);
    for (const candidate of chapterSceneTargets) {
      const candidateDistance = Math.abs(pointerY - candidate.midpoint);
      if (candidateDistance < nearestDistance) {
        nearestTarget = candidate;
        nearestDistance = candidateDistance;
      }
    }

    return {
      type: pointerY < nearestTarget.midpoint ? "before" : "after",
      sceneId: nearestTarget.scene.sceneId,
      chapterId: nearestTarget.scene.chapterId,
      chapterTitle: nearestTarget.scene.chapterTitle,
    };
  }

  return null;
}

function handleBinderSceneDragStart(event) {
  const target = event.target instanceof Element
    ? event.target.closest(".binder-scene-button[data-binder-scene-id]")
    : null;
  if (!(target instanceof HTMLElement) || target.getAttribute("draggable") !== "true") {
    return;
  }

  const sceneId = target.dataset.binderSceneId;
  const scene = getPersistentSceneById(sceneId);
  if (!scene) {
    event.preventDefault();
    return;
  }

  resetBinderSceneDragState();

  const rect = target.getBoundingClientRect();
  let dragImage = null;
  if (event.dataTransfer) {
    const clone = target.cloneNode(true);
    if (clone instanceof HTMLElement) {
      clone.classList.add("binder-scene-drag-image");
      clone.style.position = "fixed";
      clone.style.top = "-1000px";
      clone.style.left = "-1000px";
      clone.style.width = `${rect.width}px`;
      clone.style.pointerEvents = "none";
      clone.style.opacity = "0.72";
      clone.style.transform = "scale(0.98)";
      clone.style.margin = "0";
      document.body.appendChild(clone);
      dragImage = clone;
      event.dataTransfer.setDragImage(
        clone,
        Math.max(0, event.clientX - rect.left),
        Math.max(0, event.clientY - rect.top),
      );
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sceneId);
  }

  binderSceneDragState = {
    sourceSceneId: sceneId,
    sourceElement: target,
    dragImage,
    dropTarget: null,
  };
  target.classList.add("is-dragging");
  target.setAttribute("aria-grabbed", "true");
}

function handleBinderSceneDragOver(event) {
  if (!binderSceneDragState) {
    return;
  }

  event.preventDefault();
  const dropTarget = resolveBinderSceneDropTarget(event);
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = dropTarget ? "move" : "none";
  }

  if (dropTarget) {
    applyBinderSceneDropIndicator(dropTarget);
    return;
  }

  clearBinderSceneDropIndicators();
}

function handleBinderSceneDrop(event) {
  if (!binderSceneDragState) {
    return;
  }

  event.preventDefault();
  const dropTarget = binderSceneDragState.dropTarget ?? resolveBinderSceneDropTarget(event);
  if (dropTarget) {
    moveBinderScene(binderSceneDragState.sourceSceneId, dropTarget);
  }

  resetBinderSceneDragState();
}

function handleBinderSceneDragEnd() {
  if (!binderSceneDragState) {
    return;
  }

  resetBinderSceneDragState();
}

function updateFocusedLineCard() {
  renderConsolePanel();
}

// Intent: keep panel widths clamped and optionally persisted through the preference boundary.
function syncLayoutWidths(persist = false) {
  const workspace = document.querySelector(".workspace-grid");
  const workspaceWidth = workspace instanceof HTMLElement ? workspace.getBoundingClientRect().width : 0;
  const availableWidth = Math.max(0, workspaceWidth - (PANEL_RESIZER_WIDTH * 2));
  if (!persist && !layoutResizeSession && availableWidth > 0) {
    restorePanelWidthsFromUserSettings(availableWidth);
  }

  const binderWidth = clampNumber(state.binderPanelWidth, MIN_BINDER_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const consoleWidth = clampNumber(state.consoleDockWidth, MIN_CONSOLE_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const currentConsoleWidth = state.consoleDockCollapsed
    ? CONSOLE_DOCK_COLLAPSED_WIDTH
    : consoleWidth;

  let nextBinderWidth = binderWidth;
  let nextConsoleWidth = consoleWidth;

  if (availableWidth > 0) {
    const maxBinderWidth = Math.max(
      MIN_BINDER_PANEL_WIDTH,
      availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - currentConsoleWidth,
    );
    nextBinderWidth = clampNumber(binderWidth, MIN_BINDER_PANEL_WIDTH, maxBinderWidth);

    if (!state.consoleDockCollapsed) {
      const maxConsoleWidth = Math.max(
        MIN_CONSOLE_PANEL_WIDTH,
        availableWidth - MIN_MANUSCRIPT_PANEL_WIDTH - nextBinderWidth,
      );
      nextConsoleWidth = clampNumber(consoleWidth, MIN_CONSOLE_PANEL_WIDTH, maxConsoleWidth);
    }
  }

  state.binderPanelWidth = nextBinderWidth;
  state.consoleDockWidth = nextConsoleWidth;
  appRoot.classList.toggle(
    "is-binder-panel-compact",
    state.binderPanelWidth <= BINDER_PANEL_COMPACT_THRESHOLD,
  );
  appRoot.classList.toggle("is-italic-text", state.editorPrefs.italicText === true);
  appRoot.classList.toggle(
    "is-revision-overlay-enabled",
    state.editorPrefs.revisionOverlayEnabled === true,
  );

  appRoot.style.setProperty("--binder-width", `${state.binderPanelWidth}px`);
  appRoot.style.setProperty(
    "--console-dock-width",
    `${state.consoleDockCollapsed ? CONSOLE_DOCK_COLLAPSED_WIDTH : state.consoleDockWidth}px`,
  );
  appRoot.style.setProperty("--binder-resizer-width", `${PANEL_RESIZER_WIDTH}px`);
  appRoot.style.setProperty(
    "--console-resizer-width",
    state.consoleDockCollapsed ? "0px" : `${PANEL_RESIZER_WIDTH}px`,
  );

  if (persist) {
    persistPanelResizerUserSettings(availableWidth);
    writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, state.binderPanelWidth);
    writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, state.consoleDockWidth);
    persistCurrentProjectRecord();
  }
}

function restorePanelWidthsFromUserSettings(availableWidth) {
  // Intent: restore project-file user settings as proportions of the current workspace width.
  const leftWidth = panelWidthFromPercent(state.userSettingPanelResizerLeftPercent, availableWidth);
  const rightWidth = panelWidthFromPercent(state.userSettingPanelResizerRightPercent, availableWidth);
  if (leftWidth !== null) {
    state.binderPanelWidth = leftWidth;
  }
  if (rightWidth !== null) {
    state.consoleDockWidth = rightWidth;
  }
}

function persistPanelResizerUserSettings(availableWidth) {
  // Intent: save layout handles with userSetting-prefixed names so the values can later move to profiles.
  if (availableWidth <= 0) {
    return;
  }

  state.userSettingPanelResizerLeftPercent = panelWidthToPercent(state.binderPanelWidth, availableWidth);
  state.userSettingPanelResizerRightPercent = panelWidthToPercent(state.consoleDockWidth, availableWidth);
}

function panelWidthFromPercent(percent, availableWidth) {
  const normalizedPercent = normalizePanelResizerPercent(percent);
  return normalizedPercent === null || availableWidth <= 0
    ? null
    : Math.round((availableWidth * normalizedPercent) / 100);
}

function panelWidthToPercent(width, availableWidth) {
  return availableWidth > 0
    ? normalizePanelResizerPercent((Number(width) / availableWidth) * 100)
    : null;
}

function normalizePanelResizerPercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(clampNumber(numericValue, 0, 100) * 10) / 10
    : null;
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function writeStoredJson(storageKey, value) {
  localStorageAdapterLog.debug("file-access", "local-storage.write", "Persisting user preference key.", {
    storageKey,
    valueType: Array.isArray(value) ? "array" : typeof value,
  });
  projectService.saveUserPreference(storageKey, value);

  if (PROJECT_STATE_STORAGE_KEYS.has(storageKey)) {
    persistCurrentProjectRecord();
  }
}

// Intent: expose one stable runtime bridge so the separate Developer Logs window can control and observe the live logger directly.
function registerDeveloperLogRuntimeBridge() {
  window[DEVELOPER_LOG_RUNTIME_BRIDGE_KEY] = {
    getEntries: () => developerLogger.getEntries(),
    getSettings: () => developerLogger.getSettings(),
    setGlobalEnabled: (enabled) => developerLogger.setGlobalEnabled(enabled === true),
    setSourceEnabled: (sourceName, enabled) => developerLogger.setSourceEnabled(sourceName, enabled === true),
    setAllSourcesEnabled: (enabled) => developerLogger.setAllSourcesEnabled(enabled === true),
    clear: () => developerLogger.clear(),
    subscribe: (listener) => developerLogger.subscribe(listener),
    subscribeSettings: (listener) => developerLogger.subscribeSettings(listener),
  };
}

// Intent: bridge browser runtime failures back to the desktop host logger when available.
function registerRuntimeLogging() {
  window.addEventListener("error", (event) => {
    reportBrowserLog("error", "window", event.message || "Unhandled browser error.", {
      message: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
    logWritingTargetDebugEvent("error", "runtime.window", event.message || "Unhandled browser error.", {
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportBrowserLog("error", "promise", "Unhandled promise rejection.", {
      reason: event.reason,
    });
    logWritingTargetDebugEvent("error", "runtime.promise", "Unhandled promise rejection.", {
      reason: event.reason,
    });
  });
}

function reportBrowserLog(level, scope, message, context = {}) {
  const normalizedLevel = String(level ?? "info").toLowerCase();
  const source = resolveDeveloperLogSource(scope);
  const category = resolveDeveloperLogCategory(scope);
  const eventName = `${String(scope ?? "runtime")}.${normalizedLevel}`;
  const entry = developerLogger.log({
    level: normalizedLevel,
    source,
    category,
    event: eventName,
    message,
    context,
  });

  if (entry || !shouldMirrorBrowserLogWhenSourceDisabled(normalizedLevel, scope)) {
    return;
  }

  const payload = {
    level: normalizedLevel,
    scope,
    message,
    context: serializeBrowserLogContext(context),
  };

  void postJsonToDesktopHost("/api/log", payload, {
    logTransport: false,
  });
}

// Intent: keep warn/error visibility when source gates are off, but do not mirror dropped debug/info chatter.
function shouldMirrorBrowserLogWhenSourceDisabled(level, scope) {
  const normalizedLevel = String(level ?? "").toLowerCase();
  if (normalizedLevel === "warn" || normalizedLevel === "error") {
    return true;
  }

  const normalizedScope = String(scope ?? "").toLowerCase();
  return normalizedLevel === "info" && [
    "project-file",
    "project-library",
    "project-source",
    "workspace",
  ].includes(normalizedScope);
}

// Intent: mirror structured in-app developer logger entries to the desktop log file sink without re-entering the app logger.
async function postDeveloperLogEntryToDesktopHost(entry) {
  if (!entry || typeof entry !== "object") {
    return false;
  }

  const baseUrls = ["http://127.0.0.1:4310", "http://localhost:4310"];
  const payload = {
    level: entry.level,
    scope: String(entry.source ?? "browser"),
    message: String(entry.message ?? "Developer log entry"),
    context: serializeBrowserLogContext({
      category: entry.category ?? "",
      event: entry.event ?? "",
      timestamp: entry.timestamp ?? "",
      callsite: entry.callsite ?? null,
      projectId: entry.projectId ?? "",
      sceneId: entry.sceneId ?? "",
      chapterId: entry.chapterId ?? "",
      blockId: entry.blockId ?? "",
      ...(entry.context && typeof entry.context === "object" ? entry.context : {}),
    }),
  };
  const body = JSON.stringify(payload);

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL("/api/log", baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore and try the next desktop-host origin.
    }
  }

  return false;
}

function resolveDeveloperLogSource(scope) {
  const normalizedScope = String(scope ?? "").toLowerCase();
  if (normalizedScope === "storage") {
    return "LocalStorageAdapter";
  }
  if (normalizedScope === "project-file") {
    return "DesktopFileSystemAdapter";
  }
  if (normalizedScope === "settings" || normalizedScope === "api") {
    return "FileAccessBridge";
  }
  if (normalizedScope === "project-library") {
    return "ProjectPersistenceService";
  }
  if (normalizedScope === "window" || normalizedScope === "promise") {
    return "UIEventDispatcher";
  }
  return "AppRuntime";
}

function resolveDeveloperLogCategory(scope) {
  const normalizedScope = String(scope ?? "").toLowerCase();
  if (normalizedScope === "storage") {
    return "file-access";
  }
  if (normalizedScope === "project-file" || normalizedScope === "settings" || normalizedScope === "api") {
    return "persistence";
  }
  if (normalizedScope === "project-library") {
    return "state-change";
  }
  return "lifecycle";
}

async function postJsonToDesktopHost(pathname, payload, options = {}) {
  const baseUrls = ["http://127.0.0.1:4310", "http://localhost:4310"];
  const body = JSON.stringify(payload);
  const failedOrigins = [];
  const shouldLogTransport = options.logTransport !== false && pathname !== "/api/log";
  // Intent: do not log log-transport calls; that creates recursive FileAccessBridge noise.
  if (shouldLogTransport) {
    fileAccessBridgeLog.debug("file-access", "desktop-host.post", "Posting JSON payload to desktop host.", {
      pathname,
      bodyLength: body.length,
    });
  }

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL(pathname, baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      });

      if (response.ok) {
        if (shouldLogTransport) {
          fileAccessBridgeLog.debug("file-access", "desktop-host.post-success", "Desktop host accepted JSON payload.", {
            pathname,
            baseUrl,
          });
        }
        return true;
      }
    } catch {
      // Ignore and try the next desktop host origin.
      failedOrigins.push(baseUrl);
    }
  }

  const nowMs = Date.now();
  const shouldWarn = pathname !== "/api/log"
    || nowMs - lastDesktopLogBridgeWarningAt >= DESKTOP_LOG_BRIDGE_WARNING_THROTTLE_MS;
  if (shouldWarn) {
    if (pathname === "/api/log") {
      lastDesktopLogBridgeWarningAt = nowMs;
    }
    fileAccessBridgeLog.warn("file-access", "desktop-host.post-unavailable", "No desktop host origin accepted JSON payload.", {
      pathname,
      failedOrigins,
      failedOriginCount: failedOrigins.length,
    });
  }
  return false;
}

function serializeBrowserLogContext(context) {
  if (!context || typeof context !== "object") {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, serializeBrowserLogValue(value)]),
  );
}

function serializeBrowserLogValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeBrowserLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeBrowserLogValue(item)]),
    );
  }

  return value;
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}




