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
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createDefaultSpellcheckProjectSettings,
  createPassageNote,
  createSceneDraft,
  createStructureDrafts,
  createTemplateDrafts,
  findSceneByBlockId,
  groupScenesByChapter,
  insertStructureSceneDraftAfterAnchor,
  normalizeManuscriptTasks,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizePassageNotes,
  normalizeSpellcheckProjectSettings,
  resolveManuscriptTaskRange,
} from "./editor-model.js";
import {
  formatSceneEditorSelectionWordCount,
  formatSceneEditorWordCount,
  getPassageNotePlaceholder,
  renderManuscriptPanelHTML,
} from "./features/scene-editor.js";
import {
  createDefaultManuscriptInlineFormattingState,
  createManuscriptCommandController,
  INLINE_FORMATS,
  isInlineFormatActiveAtOffset,
  normalizeInlineFormatRanges,
  normalizeManuscriptInlineFormattingState,
} from "./features/manuscript-editor/manuscript-command-controller.js";
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectManuscriptProjections,
} from "./features/manuscript-editor/projection-selector.js";
import { createManuscriptFindController } from "./features/manuscript-editor/manuscript-find-controller.js";
import { createManuscriptInputController } from "./features/manuscript-editor/manuscript-input-controller.js";
import { createManuscriptSelectionController } from "./features/manuscript-editor/manuscript-selection-controller.js";
import { createAnchoredRecordNavigationController } from "./features/manuscript-editor/anchored-record-navigation-controller.js";
import { validateLiveSpellcheckMenuRange } from "./features/manuscript-editor/spellcheck-range-guard.js";
import {
  buildGrammarCheckEntries,
  buildGrammarCheckSummary,
  closeGrammarCheckPanelState,
  createGrammarCheckPanelDragController,
  renderGrammarCheckPanelHTML,
  setGrammarCheckPanelPositionState,
  toggleGrammarCheckPanelState,
  toggleGrammarCheckPanelWordSelectionState,
  updateGrammarCheckPanelSelectionState,
} from "./features/spellcheck/grammar-check-panel.js";
import {
  applySpellcheckProjectListMutation,
} from "./features/spellcheck/spellcheck-project-settings.js";
import {
  buildSpellcheckEditorContextMenu,
  buildSpellcheckGrammarCheckContextMenu,
} from "./features/spellcheck/spellcheck-context-controller.js";
import { renderSpellcheckContextMenuHTML } from "./features/spellcheck/spellcheck-context-menu.js";
import {
  DEFAULT_SPELLCHECK_REFRESH_DELAY_MS,
  createSpellcheckRefreshController,
} from "./features/spellcheck/spellcheck-refresh-controller.js";
import {
  renderAnchoredRecordContextMenuHTML,
  renderTaskComposerHTML,
} from "./features/anchored-records/task-context-menu.js";
import {
  buildInlinePassageNoteDraftFromContextMenu,
  buildPassageNoteTitleRequest,
  buildPassageNotePanelModel,
  buildPassageNoteFromComposer,
  buildTaskComposerFromContextMenu,
  buildTaskFromComposer,
  buildTaskPanelModel,
  buildTaskTitleRequest,
  canApplySuggestedRecordTitle,
  getInlinePassageDraftAnchor as getInlinePassageDraftAnchorFromController,
  planInlinePassageVerseInsertion,
  selectOpenManuscriptTasks,
  updateInlinePassageDraftTypingState,
} from "./features/anchored-records/anchored-record-controller.js";
import { renderPassageNotePanelHTML } from "./features/anchored-records/passage-note-panel.js";
import { renderTaskPanelHTML } from "./features/anchored-records/task-panel.js";
import {
  createDeleteConfirmationPreferences,
  renderDeleteConfirmationDialogHTML,
} from "./features/anchored-records/delete-confirmation-dialog.js";
import { createAnchoredRecordService } from "./features/anchored-records/anchored-record-service.js";
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
  ensureSpellcheckBaseLexicon,
  ensureSpellcheckReferenceLexicon,
  getSpellcheckWordRange,
  normalizeSpellcheckWord,
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
import { createProjectSourceService } from "./adapters/storage/project-source-service.js";
import {
  createProjectLibraryStateService,
  mergeProjectLibraryItemsById,
  normalizeProjectSelectionDefaults,
} from "./state/project-library-state.js";
import { createProjectRecordStateService } from "./state/project-record-state.js";
import { createProjectRuntimeRecordStateService } from "./state/project-runtime-record-state.js";
import { createProjectActivationStateService } from "./state/project-activation-state.js";
import { createProjectActivationController } from "./state/project-activation-controller.js";
import {
  createCollapsedConsoleChapterState,
  normalizeCollapsedChapterIds,
  pruneCollapsedChapterIds,
  toggleCollapsedChapterId,
  toggleCollapsedConsoleChapter,
} from "./state/editor-ui-state.js";
import {
  captureTextareaEditorHostBookmark,
  captureTextareaEditorHostViewport,
  clearTextareaAnchoredRecordPreview,
  clearTextareaProjectionLayer,
  clearTextareaRuntimeSelectionPreview,
  estimateTextareaVisualLineBeforeOffset,
  findTextareaOffsetForVisualLineEnd,
  focusTextareaEditorHost,
  getTextareaEditorHostWrapMetrics,
  readTextareaEditorHostSelection,
  renderTextareaDiagnosticLayer,
  renderTextareaSpellcheckLayer,
  resolveTextareaEditorHost,
  restoreTextareaEditorHostBookmark,
  restoreTextareaEditorHostViewport,
  scrollTextareaEditorHostToOffset,
  scrollTextareaEditorHostToSelection,
  selectTextareaEditorHostRange,
  showTextareaAnchoredRecordPreview,
  showTextareaRuntimeSelectionPreview,
  syncTextareaSpellcheckTypingState,
} from "./adapters/editor-host/textarea-editor-host.js";
import {
  createEmptyRevisionProjectState,
  createRevisionStorageService,
  getPersistableRevisionProjectState,
  normalizeRevisionProjectState,
} from "./adapters/storage/revision-storage-service.js";
import { createRevisionService } from "./features/revisions/revision-service.js";
import { createRevisionPanelController } from "./features/revisions/revision-panel-controller.js";
import { renderRevisionWindowHTML } from "./features/revisions/revision-window.js";
import { createLocalAiTitleService } from "./features/local-ai/local-ai-title-service.js";
import { createNarrationMediaService } from "./features/narration/narration-media-service.js";
import { createNarrationMediaRecorderService } from "./features/narration/narration-media-recorder-service.js";
import { createNarrationRecordingCommandService } from "./features/narration/narration-recording-command-service.js";
import { createNarrationRecordingFinalizationService } from "./features/narration/narration-recording-finalization-service.js";
import { createNarrationRecordingRuntimeService } from "./features/narration/narration-recording-runtime-service.js";
import {
  buildNarrationTakeSelection as buildNarrationTakeSelectionRecord,
  resolveNarrationTakeSelectionFromTextInput,
  selectNarrationTakeSelectionForScene,
} from "./features/narration/narration-selection-service.js";
import {
  syncNarrationAlignmentJobsMetadata,
  syncNarrationSessionMetadata,
  syncVoiceRecordingsMetadata,
  syncVoiceRenderJobsMetadata,
} from "./features/narration/narration-metadata-sync-service.js";
import { createNarrationSpeechRecognitionService } from "./features/narration/narration-speech-recognition-service.js";
import {
  createNarrationTakeSession as createNarrationTakeSessionRecord,
  formatNarrationRecordingElapsedLabel,
} from "./features/narration/narration-take-service.js";
import { createVoiceWorkflowService } from "./features/voice/voice-workflow-service.js";
import { createVoiceRecordingActionService } from "./features/voice/voice-recording-action-service.js";
import { createVoiceRecordingPreviewController } from "./features/voice/voice-recording-preview-service.js";
import { createVoiceRecordingService } from "./features/voice/voice-recording-service.js";

// Intent: keep shell-wide constants and state visible until each concern moves into its roadmap owner.
const appRoot = document.querySelector("#app");
const EDITOR_RIGHT_DOCK_COLLAPSED_KEY = "abe-right-dock-collapsed-v1";
const EDITOR_BINDER_WIDTH_KEY = "abe-binder-width-v1";
const EDITOR_CONSOLE_WIDTH_KEY = "abe-console-width-v1";
const EDITOR_WRITING_TARGETS_KEY = "abe-writing-targets-v1";
const EDITOR_PROJECT_FILE_PATH_KEY = "abe-project-file-path-v1";
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
  clearProjectContentStorage,
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
const voiceWorkflowService = createVoiceWorkflowService({
  projectService,
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
  revisionWindowOpen: false,
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
  manuscriptInlineFormatting: createDefaultManuscriptInlineFormattingState(),
  manuscriptFind: {
    open: false,
    query: "",
    replaceText: "",
    activeIndex: 0,
    position: null,
  },
  revisionState: createEmptyRevisionProjectState(),
  revisionPanelState: {
    query: "",
    categoryFilter: "all",
    originFilter: "all",
    selectedSessionId: "",
    showFullDiff: false,
    statusMessage: "",
  },
  narrationTakeSelection: null,
  narrationTakeSession: null,
  editorPrefs: createDefaultEditorPrefs(),
  localAiPrefs: createDefaultLocalAiPrefs(),
  localAiTitleStatus: {},
  sceneEditorSelectionSnapshot: null,
  activeEditorSceneId: null,
  deleteConfirmationPreferences: loadDeleteConfirmationPreferences(),
  deleteConfirmationDialog: null,
  binderSceneMoveHistory: {
    undoStack: [],
    redoStack: [],
  },
  developerLogsWindowOpen: false,
  voiceNarration: voiceWorkflowService.loadState(),
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
let revisionWindowPointerDownStartedInsideWindow = false;
let writingTargetDebugLastTypingLogAt = 0;
let writingTargetDebugLastSceneTypingWordCount = null;
let binderTitleClickState = null;
let binderSceneDragState = null;
let manuscriptFindDragState = null;
let spellcheckBaseLexicon = null;
let spellcheckReferenceLexicon = null;
let narrationRecordingRuntime = null;
let lastDesktopLogBridgeWarningAt = 0;

// Intent: keep pure find derivation and replacement planning outside browser shell effects.
const manuscriptFindController = createManuscriptFindController({
  getScenes: () => state.scenes,
});

// Intent: keep selection derivation separate from DOM focus, scrolling, and persistence orchestration.
const manuscriptSelectionController = createManuscriptSelectionController({
  findSceneBlockAtOffset,
});

// Intent: dispatch live manuscript typing through feature-owned mutation planning with shell effects injected.
const manuscriptInputController = createManuscriptInputController({
  markEditorAsCurrent: (editorSurface) => markSceneEditorAsCurrent(editorSurface),
  updateSelectionSnapshot: (editorSurface) => updateSceneEditorSelectionSnapshotFromTextarea(editorSurface),
  updateInlineFormatToolbar: (editorSurface) => updateInlineFormatToolbarState(editorSurface),
  clearAnchoredPreview: (options) => clearTaskAnchorPreview(options),
  getSceneText: (sceneId) => getScene(sceneId)?.editorText ?? "",
  getSceneInlineFormatRanges,
  getInlineFormattingState: () => state.manuscriptInlineFormatting,
  recordRevisionTextEdit: (sceneId, previousText, nextText) => recordRevisionSceneTextEdit(sceneId, previousText, nextText),
  trackInlinePassageTyping: (sceneId, previousText, editorSurface) => trackInlinePassageDraftTyping(sceneId, previousText, editorSurface),
  getTypingSpellcheckRange: (editorSurface) => getEditorTypingSpellcheckRange(editorSurface),
  commitSceneTextEdit: ({
    sceneId,
    previousText,
    nextText,
    inlineFormatRanges,
  }) => {
    updateSceneDraft(sceneId, (draft) => {
      draft.editorText = nextText;
      draft.inlineFormatRanges = inlineFormatRanges;
      draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, previousText, nextText);
    });
  },
  scheduleTypingRefresh: (sceneId, text, options) => scheduleSceneEditorTypingRefresh(sceneId, text, options),
  isGrammarCheckEnabled: () => state.editorPrefs.grammarCheckEnabled !== false,
  scheduleSpellcheckRefresh: (sceneId) => scheduleSceneEditorSpellcheckRefresh(sceneId),
});

// Intent: keep spellcheck debounce timer ownership outside the browser shell.
const spellcheckRefreshController = createSpellcheckRefreshController({
  delayMs: DEFAULT_SPELLCHECK_REFRESH_DELAY_MS,
  setTimeoutRef: window.setTimeout.bind(window),
  clearTimeoutRef: window.clearTimeout.bind(window),
  onFlush: (sceneId) => flushSceneEditorSpellcheckRefresh(sceneId),
});
const grammarCheckPanelDragController = createGrammarCheckPanelDragController({
  isPanelOpen: () => state.grammarCheckPanel?.open === true,
  getViewport: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }),
  setPosition: (left, top) => setGrammarCheckPanelPosition(left, top),
});

// Intent: centralize anchor-aware task/note resolution while the shell retains browser navigation effects.
const anchoredRecordNavigationController = createAnchoredRecordNavigationController({
  resolveRecordRange: (record, text) => resolveManuscriptTaskRange(record, text),
  repairResolvedRange: (recordType, record, resolvedRange) => {
    if (recordType === "task") {
      syncResolvedTaskRange(record, resolvedRange);
      return;
    }
    syncResolvedPassageNoteRange(record, resolvedRange);
  },
});

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
const revisionServiceLog = developerLogger.createSource("RevisionService");
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

// Intent: keep durable record construction and normalization outside the shell orchestration file.
const projectRecordStateService = createProjectRecordStateService({
  clone: cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  normalizeProjectSelectionDefaults,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  getPersistableRevisionProjectState,
  buildProjectIndexForRecord,
  buildWorkspaceStatsFromProjectIndex,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
});
const {
  normalizeProjectRecord,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
} = projectRecordStateService;

// Intent: keep project-library normalization and active-record selection outside the shell orchestration file.
const projectLibraryStateService = createProjectLibraryStateService({
  state,
  normalizeProjectRecord,
  mergeProjectRecords,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
  clone: cloneValue,
});
const {
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  getActiveProjectRecord,
  getProjectRecordById,
} = projectLibraryStateService;

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

// Intent: assemble save-time project records outside shell orchestration while retaining UI capture callbacks here.
const projectRuntimeRecordStateService = createProjectRuntimeRecordStateService({
  state,
  clone: cloneValue,
  getCurrentManuscriptWordCount,
  createProjectSettingsSnapshotFromState,
  captureSceneSelectionDefaultsForSave,
  captureInlinePassageDraftDefaultsForSave,
  createProjectRecordFromWorkspace: createProjectLibraryRecordFromWorkspace,
});

const projectPersistenceService = createProjectPersistenceService({
  state,
  windowRef: window,
  projectService,
  projectRepository,
  fetchJsonFromDesktopApi,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  autosaveDelayMs: PROJECT_FILE_AUTOSAVE_DELAY_MS,
  shouldPersistProjectCache: () => shouldPersistProjectCache(),
  clearBrowserProjectCache: () => clearProjectContentStorage({
    additionalStorageKeys: [
      EDITOR_WRITING_TARGETS_KEY,
    ],
  }),
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
    activateProjectRecord(projectRecord, {
      reason: reason ?? "load-project-file",
      logLoadCheckpoint: true,
      renderAfter: true,
      recordSnapshot: true,
    });
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
const projectSourceService = createProjectSourceService({
  fetchJson: fetchJsonFromDesktopApi,
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  saveProjectLibrarySnapshot: (snapshot) => projectService.saveProjectLibrarySnapshot(snapshot),
});
const localAiTitleService = createLocalAiTitleService({
  fetchJson: fetchJsonFromDesktopApi,
  logger: console,
});
const anchoredRecordService = createAnchoredRecordService({
  getTasks: () => state.manuscriptTasks,
  setTasks: (tasks) => {
    state.manuscriptTasks = tasks;
  },
  persistTasks: (options) => persistManuscriptTasksState(options),
  getNotes: () => state.passageNotes,
  setNotes: (notes) => {
    state.passageNotes = notes;
  },
  persistNotes: (options) => persistPassageNotesState(options),
});
const narrationMediaService = createNarrationMediaService({
  fetchJson: fetchJsonFromDesktopApi,
});
const narrationRecordingRuntimeService = createNarrationRecordingRuntimeService({
  clearIntervalFn: (timerId) => window.clearInterval(timerId),
});
const narrationRecordingFinalizationService = createNarrationRecordingFinalizationService({
  cleanupRuntime: (runtime) => narrationRecordingRuntimeService.cleanupRuntime(runtime),
  saveMediaBlob: (input) => narrationMediaService.saveMediaBlob(input),
  resolveSelection: (runtime) => getNarrationTakeSelectionForScene(runtime?.selection?.sceneId ?? state.selectedSceneId),
  getProjectId: () => state.activeProjectId || state.workspace?.project?.id || "",
  reportLog: reportBrowserLog,
  blobConstructor: typeof Blob === "undefined" ? null : Blob,
});
const voiceRecordingService = createVoiceRecordingService({
  getWorkspace: () => state.workspace,
  getProjectId: () => state.activeProjectId ?? state.workspace?.project?.id ?? "",
});
const voiceRecordingActionService = createVoiceRecordingActionService({
  getRecordingById: (recordingId) => voiceRecordingService.getById(recordingId),
  loadMediaBlob: (input) => narrationMediaService.loadMediaBlob(input),
  playBlob: (blob) => voiceRecordingPreviewController.playBlob(blob),
  getScene: (sceneId) => getScene(sceneId),
  reportLog: reportBrowserLog,
});
const narrationMediaRecorderService = createNarrationMediaRecorderService({
  mediaRecorderConstructor: typeof MediaRecorder === "undefined" ? null : MediaRecorder,
  blobConstructor: typeof Blob === "undefined" ? null : Blob,
  getRuntime: () => narrationRecordingRuntime,
  appendChunk: (recordingId, chunk) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }
    narrationRecordingRuntime.chunks.push(chunk);
  },
  applyRuntimePatch: (recordingId, patch) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }
    narrationRecordingRuntime = {
      ...narrationRecordingRuntime,
      ...patch,
    };
  },
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
  finalizeRecording: (recordingId) => {
    void finalizeNarrationRecording(recordingId);
  },
});
const narrationSpeechRecognitionService = createNarrationSpeechRecognitionService({
  recognitionConstructor: window.SpeechRecognition || window.webkitSpeechRecognition || null,
  getRuntime: () => narrationRecordingRuntime,
  applyRuntimePatch: (recordingId, patch) => {
    if (!narrationRecordingRuntime || narrationRecordingRuntime.recordingId !== recordingId) {
      return;
    }
    narrationRecordingRuntime = {
      ...narrationRecordingRuntime,
      ...patch,
    };
  },
  refreshSession: () => updateNarrationTakeSessionFromRuntime(),
});
const narrationRecordingCommandService = createNarrationRecordingCommandService({
  getRuntime: () => narrationRecordingRuntime,
  setRuntime: (runtime) => {
    narrationRecordingRuntime = runtime;
  },
  resolveSelection: (sceneId) => {
    const scene = sceneId ? getScene(sceneId) : getSelectedScene() ?? state.scenes[0] ?? null;
    return {
      scene,
      selection: scene ? getNarrationTakeSelectionForScene(scene.sceneId) : null,
    };
  },
  getProjectId: () => state.activeProjectId ?? state.workspace?.project?.id ?? "",
  setSession: (session) => setNarrationTakeSession(session),
  createTimer: () => window.setInterval(refreshNarrationRecordingSession, 1000),
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  hasMicrophoneCapture: () => typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia),
  hasMediaRecorder: () => typeof MediaRecorder !== "undefined",
  mediaRecorderConstructor: typeof MediaRecorder === "undefined" ? null : MediaRecorder,
  createRecorder: (recordingId, stream, options) => narrationMediaRecorderService.createRecorder(recordingId, stream, options),
  createRecognition: (recordingId) => narrationSpeechRecognitionService.createRecognition(recordingId),
  updateSessionFromRuntime: (overrides) => updateNarrationTakeSessionFromRuntime(overrides),
  abortStart: (selection, error, stream) => abortNarrationRecordingStart(selection, error, stream),
  finalizeRecording: (recordingId, error) => finalizeNarrationRecording(recordingId, error),
  clone: cloneValue,
});
const voiceRecordingPreviewController = createVoiceRecordingPreviewController({
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createAudio: (url) => new Audio(url),
});

const revisionStorageService = createRevisionStorageService({
  logger: revisionServiceLog,
});
// Intent: keep project-record hydration assignments outside activation effect orchestration.
const projectActivationStateService = createProjectActivationStateService({
  state,
  clone: cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  readRevisionState: (record) => revisionStorageService.readRevisionState(record),
  createRevisionPanelStateForProject,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  normalizeSpellcheckProjectSettings,
});
const revisionPanelController = createRevisionPanelController();
const revisionService = createRevisionService({
  getProjectRecord: () => getActiveProjectRecord(),
  getProjectSnapshot: () => createProjectLibraryRecordFromState(),
  getRevisionState: () => state.revisionState,
  setRevisionState,
  logger: revisionServiceLog,
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

// Intent: centralize activation effects while the shell continues to compose browser and feature callbacks.
const projectActivationController = createProjectActivationController({
  state,
  clone: cloneValue,
  applyProjectRecordToState: (record) => projectActivationStateService.applyProjectRecordToState(record),
  persistActiveProjectId: (projectId) => projectPersistenceService.persistActiveProjectId(projectId),
  saveWritingTargetState,
  clearWritingTargetDraft,
  clearWritingTargetSnapshotTimer,
  clearProjectAutosaveState: () => clearProjectFileAutosaveState(),
  getNarrationRecordingRuntime: () => narrationRecordingRuntime,
  setNarrationRecordingRuntime: (runtime) => {
    narrationRecordingRuntime = runtime;
  },
  cleanupNarrationRecordingRuntime: (runtime) => narrationRecordingRuntimeService.cleanupRuntime(runtime),
  getVoiceRecordingPreviewAudio: () => voiceRecordingPreviewController.getPreviewAudio(),
  setVoiceRecordingPreviewAudio: (audio) => voiceRecordingPreviewController.setPreviewAudio(audio),
  getVoiceRecordingPreviewUrl: () => voiceRecordingPreviewController.getPreviewUrl(),
  setVoiceRecordingPreviewUrl: (url) => voiceRecordingPreviewController.setPreviewUrl(url),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  clearBinderTitleClickState: () => {
    binderTitleClickState = null;
  },
  writeProjectSourcePath: (value) => writeStoredJsonRaw(EDITOR_PROJECT_SOURCE_PATH_KEY, value),
  writeBinderWidth: (value) => writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, value),
  writeConsoleWidth: (value) => writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, value),
  persistConsoleDockCollapsedState,
  persistCollapsedChapterState,
  persistCollapsedConsoleChapterState,
  readWritingTargetStore,
  writeWritingTargetStore: (value) => writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, value),
  syncLegacyProjectStorageFromState,
  logWritingTargetDebugEvent,
  projectLoadGateLog,
  manuscriptStateLog,
  refreshScenes,
  restoreSelectionFromWorkspaceDefaults,
  syncWritingTargetState,
  refreshWritingTargetSessionLifecycle,
  logWritingTargetLoadCheckpoint,
  render,
  recordWritingTargetSnapshot,
});

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
  const desktopSettings = await loadDesktopSettingsSnapshot();
  const seedLibrary = await loadInitialProjectLibrary(desktopSettings);
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
    if (clickTarget?.closest('[data-action="toggle-inline-format"]')) {
      event.preventDefault();
    }
    if (clickTarget instanceof HTMLTextAreaElement && clickTarget.classList.contains("editor-document-input")) {
      markSceneEditorAsCurrent(clickTarget);
    }
    writingTargetPointerDownStartedInsideWindow = Boolean(clickTarget?.closest(".writing-target-window"));
    revisionWindowPointerDownStartedInsideWindow = Boolean(clickTarget?.closest(".revision-window"));
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
      revisionWindowPointerDownStartedInsideWindow = false;
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
      updateInlineFormatToolbarState(activeElement);
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
    if (
      state.revisionWindowOpen &&
      clickTarget &&
      !clickTarget.closest(".revision-window") &&
      !clickTarget.closest('[data-action="toggle-revision-window"]') &&
      !revisionWindowPointerDownStartedInsideWindow
    ) {
      closeRevisionWindow();
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
        "toggle-revision-window",
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
      closeRevisionWindow();
      toggleWritingTargetWindow();
      return;
    }

    if (action === "toggle-revision-window") {
      hideFileMenu();
      toggleRevisionWindow();
      return;
    }

    if (action === "close-revision-window") {
      closeRevisionWindow();
      return;
    }

    if (action === "toggle-revision-overlay") {
      toggleRevisionOverlay(target.dataset.sceneId);
      return;
    }

    if (action === "bank-revision") {
      bankCurrentRevisionFromPanel();
      return;
    }

    if (action === "select-revision-session") {
      selectRevisionSession(target.dataset.revisionSessionId);
      return;
    }

    if (action === "revision-open-first-scene") {
      openFirstRevisionScene(target.dataset.revisionSessionId);
      return;
    }

    if (action === "revision-open-entity") {
      navigateRevisionEntity(target.dataset.revisionEntityType, target.dataset.revisionEntityId);
      return;
    }

    if (action === "revision-toggle-diff-detail") {
      toggleRevisionDiffDetail();
      return;
    }

    if (action === "revision-export-summary") {
      exportRevisionSummary(target.dataset.revisionSessionId);
      return;
    }

    if (action === "toggle-inline-format") {
      toggleManuscriptInlineFormat(target.dataset.inlineFormat);
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
    if (event.target instanceof HTMLTextAreaElement && event.target.classList.contains("editor-document-input")) {
      markSceneEditorAsCurrent(event.target);
    }

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

    if (target instanceof HTMLInputElement && target.dataset.revisionSearch !== undefined) {
      updateRevisionPanelSearch(target.value);
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
      anchoredRecordService.updateTaskTitle(target.dataset.taskId, target.value, {
        dirtyReason: "manuscript-task-title-edited",
        source: "task-title-input",
      });
      return;
    }

    if (editField === "passage-note-title") {
      anchoredRecordService.updatePassageNoteTitle(target.dataset.noteId, target.value, {
        dirtyReason: "passage-note-title-edited",
        source: "passage-note-title-input",
      });
      return;
    }

    if (editField === "passage-note-body") {
      anchoredRecordService.updatePassageNoteBody(target.dataset.noteId, target.value, {
        dirtyReason: "passage-note-body-edited",
        source: "passage-note-body-input",
      });
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
      manuscriptInputController.handleEditorTextInput({
        sceneId,
        editorSurface: target,
      });
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

    if (target instanceof HTMLSelectElement && target.dataset.revisionCategoryFilter !== undefined) {
      updateRevisionPanelFilter("categoryFilter", target.value);
      return;
    }

    if (target instanceof HTMLSelectElement && target.dataset.revisionOriginFilter !== undefined) {
      updateRevisionPanelFilter("originFilter", target.value);
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
    if (event.defaultPrevented) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      closeRevisionWindow();
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
      if (state.revisionWindowOpen) {
        closeRevisionWindow();
        return;
      }
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
  renderRevisionWindow();
  renderPaneVisibility();
  if (state.activePane === "manuscript" || state.activePane === "narration") {
    syncSceneDocumentLayout();
  }
  if (state.activePane === "narration") {
    syncNarrationTakeSelectionPreview();
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
    <div id="revision-window-slot"></div>
  `;
}

function renderTaskContextMenu() {
  const slot = document.querySelector("#task-menu-slot");
  if (!slot) {
    return;
  }

  const spellcheckMenu = state.spellcheckContextMenu;
  if (spellcheckMenu) {
    slot.innerHTML = renderSpellcheckContextMenuHTML(spellcheckMenu, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
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
    const isPassageNoteComposer = composer.composerType === "passage-note";
    slot.innerHTML = renderTaskComposerHTML(composer, {
      width: window.innerWidth,
      height: window.innerHeight,
    }, {
      editorStyle: buildEditorStyle(),
      passageNotePlaceholder: isPassageNoteComposer ? getPassageNotePlaceholder(composer.noteType) : "",
    });

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

  slot.innerHTML = renderAnchoredRecordContextMenuHTML(menu, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
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
    if (state.revisionWindowOpen) {
      event.preventDefault();
      closeRevisionWindow();
      return;
    }

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
    closeRevisionWindow();
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
  const canDragScene = isMovableScene(scene);
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
    grammarCheckSummary: buildGrammarCheckSummary(selectedScene, getCurrentSpellcheckLexicons()),
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
  if (!["issues", "inspiration", "research"].includes(state.sidePanelMode)) {
    state.sidePanelMode = "issues";
  }
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

  const panelModel = manuscriptFindController.buildPanelModel(findState);
  const focusedFindField =
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.closest("#find-slot")
      ? {
          field: document.activeElement.dataset.findField ?? "",
          selectionStart: document.activeElement.selectionStart,
          selectionEnd: document.activeElement.selectionEnd,
        }
      : null;

  if (state.manuscriptFind.activeIndex !== panelModel.activeIndex) {
    state.manuscriptFind = {
      ...state.manuscriptFind,
      activeIndex: panelModel.activeIndex,
    };
  }

  syncManuscriptFindSlotPosition(slot, findState.position);
  slot.innerHTML = manuscriptFindController.renderPanelHTML(panelModel);

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
  const entries = buildGrammarCheckEntries(selectedScene, getCurrentSpellcheckLexicons(), options);
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
  state.grammarCheckPanel = setGrammarCheckPanelPositionState(state.grammarCheckPanel, left, top);

  const slot = document.querySelector("#grammar-check-slot");
  syncGrammarCheckSlotPosition(slot, state.grammarCheckPanel.position);
}

function handleGrammarCheckPointerDown(event) {
  grammarCheckPanelDragController.begin(event);
}

function handleGrammarCheckPointerMove(event) {
  grammarCheckPanelDragController.move(event);
}

function handleGrammarCheckPointerEnd(event) {
  grammarCheckPanelDragController.end(event);
}

function toggleGrammarCheckPanel() {
  state.activePane = "manuscript";
  state.grammarCheckPanel = toggleGrammarCheckPanelState(state.grammarCheckPanel);
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function closeGrammarCheckPanel() {
  if (!state.grammarCheckPanel?.open) {
    return;
  }

  state.grammarCheckPanel = closeGrammarCheckPanelState(state.grammarCheckPanel);
  syncGrammarCheckPanelHeaderState();
  renderGrammarCheckPanel();
}

function updateGrammarCheckPanelSelection(nextSelectedWords, selectionAnchorIndex = null) {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
  state.grammarCheckPanel = updateGrammarCheckPanelSelectionState(
    state.grammarCheckPanel,
    entries,
    nextSelectedWords,
    selectionAnchorIndex,
  );
  renderGrammarCheckPanel();
}

function toggleGrammarCheckPanelWordSelection(word, entryIndex = -1, isShiftKey = false) {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
  const result = toggleGrammarCheckPanelWordSelectionState(
    state.grammarCheckPanel,
    entries,
    word,
    entryIndex,
    isShiftKey,
  );
  if (!result.changed) {
    return;
  }

  state.grammarCheckPanel = result.state;
  renderGrammarCheckPanel();
  focusGrammarCheckEntry(result.selectedEntry);
}

function selectAllGrammarCheckPanelWords() {
  const entries = buildGrammarCheckEntries(getSelectedScene() ?? state.scenes[0] ?? null, getCurrentSpellcheckLexicons());
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
    ? (buildGrammarCheckSummary(selectedScene, getCurrentSpellcheckLexicons())?.label ?? "Grammar check")
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

function openManuscriptFind() {
  const editorBookmark = captureManuscriptEditorBookmark();
  const selectionText = getCurrentManuscriptSelectionText();
  state.activePane = "manuscript";
  state.manuscriptFind = manuscriptFindController.open(state.manuscriptFind, selectionText);
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

  state.manuscriptFind = manuscriptFindController.close(state.manuscriptFind);
  clearTextareaRuntimeSelectionPreview(resolveTextareaEditorHost(getEditorTextareaForScene(state.selectedSceneId)));
  renderManuscriptFindPanel();
  window.requestAnimationFrame(() => {
    focusTextareaEditorHost(resolveTextareaEditorHost(getEditorTextareaForScene(state.selectedSceneId)));
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

  const bookmark = captureTextareaEditorHostBookmark(resolveTextareaEditorHost(textarea));
  return manuscriptSelectionController.createBookmark({
    sceneId: bookmark?.sceneId,
    startOffset: bookmark?.selectionStart,
    endOffset: bookmark?.selectionEnd,
    scrollTop: bookmark?.codeframeScrollTop,
    scrollLeft: bookmark?.codeframeScrollLeft,
  });
}

function restoreManuscriptEditorBookmark(bookmark) {
  if (!bookmark || typeof bookmark.sceneId !== "string" || !bookmark.sceneId.trim()) {
    return;
  }

  const textarea = getEditorTextareaForScene(bookmark.sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  restoreTextareaEditorHostBookmark(resolveTextareaEditorHost(textarea), bookmark);
}

function updateManuscriptFindField(findField, value) {
  const normalizedField = String(findField ?? "").trim();
  if (!normalizedField) {
    return;
  }

  state.manuscriptFind = manuscriptFindController.updateField(state.manuscriptFind, normalizedField, value);
  renderManuscriptFindPanel();
}

function moveManuscriptFindMatch(delta) {
  const result = manuscriptFindController.moveMatch(state.manuscriptFind, delta);
  if (!result.match) {
    renderManuscriptFindPanel();
    return;
  }

  state.manuscriptFind = result.state;
  renderManuscriptFindPanel();
  focusManuscriptFindMatchProjection(result.match, { behavior: "smooth" });
}

function navigateManuscriptFindMatch(index) {
  const result = manuscriptFindController.selectMatch(state.manuscriptFind, index);
  if (!result.match) {
    renderManuscriptFindPanel();
    return;
  }

  state.manuscriptFind = result.state;
  renderManuscriptFindPanel();
  focusManuscriptFindMatchProjection(result.match, {
    behavior: "smooth",
  });
}

// Intent: render the active find result as a disposable search projection without changing manuscript data.
function focusManuscriptFindMatchProjection(match, options = {}) {
  const scene = getScene(match?.sceneId);
  if (!scene) {
    return false;
  }

  if (state.selectedSceneId !== scene.sceneId) {
    selectSceneById(scene.sceneId);
    window.requestAnimationFrame(() => {
      focusManuscriptFindMatchProjection(match, options);
    });
    return true;
  }

  const textarea = getEditorTextareaForScene(scene.sceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return false;
  }

  const projection = selectManuscriptProjections({
    sceneId: scene.sceneId,
    text: textarea.value,
    searchPreviews: [{
      id: `${state.manuscriptFind.query}:${match.startOffset}:${match.endOffset}`,
      sceneId: scene.sceneId,
      startOffset: match.startOffset,
      endOffset: match.endOffset,
    }],
    includeAuthorMarks: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  }).find((candidate) => candidate.channel === MANUSCRIPT_PROJECTION_CHANNELS.SEARCH) ?? null;
  if (!showTextareaRuntimeSelectionPreview(editorHost, projection)) {
    return false;
  }

  scrollTextareaEditorHostToOffset(editorHost, match.startOffset, options);
  return true;
}

function replaceManuscriptFindCurrent() {
  const replacementPlan = manuscriptFindController.buildCurrentReplacement(state.manuscriptFind);
  if (!replacementPlan) {
    renderManuscriptFindPanel();
    return;
  }

  if (!replacementPlan.changed) {
    moveManuscriptFindMatch(1);
    return;
  }

  updateSceneDraft(replacementPlan.sceneId, (draft) => {
    draft.editorText = replacementPlan.nextText;
    draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, replacementPlan.previousText, replacementPlan.nextText);
  }, {
    reason: "manuscript-find-replace",
    immediate: true,
  });
  const textarea = getEditorTextareaForScene(replacementPlan.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = replacementPlan.nextText;
  }
  syncRevisionPanel(replacementPlan.sceneId);
  syncSceneDocumentLayout();
  renderManuscriptFindPanel();
  moveManuscriptFindMatch(1);
}

function replaceManuscriptFindAll() {
  const replacementPlans = manuscriptFindController.buildAllReplacements(state.manuscriptFind);
  if (!replacementPlans.length) {
    renderManuscriptFindPanel();
    return;
  }

  for (const replacementPlan of replacementPlans) {
    updateSceneDraft(replacementPlan.sceneId, (draft) => {
      draft.editorText = replacementPlan.nextText;
      draft.revisionStats = updateSceneRevisionStats(draft.revisionStats, replacementPlan.previousText, replacementPlan.nextText);
    }, {
      reason: "manuscript-find-replace-all",
      immediate: true,
    });
    const textarea = getEditorTextareaForScene(replacementPlan.sceneId);
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = replacementPlan.nextText;
    }
    syncRevisionPanel(replacementPlan.sceneId);
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

  const matches = manuscriptFindController.getMatches(state.manuscriptFind.query);
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

  return manuscriptSelectionController.getSelectedText({
    text: activeElement.value,
    startOffset: activeElement.selectionStart,
    endOffset: activeElement.selectionEnd,
  });
}

// Intent: reflect the shared inline command state without re-rendering the whole manuscript panel on caret moves.
function updateInlineFormatToolbarState(textarea = null) {
  const activeTextarea = textarea instanceof HTMLTextAreaElement
    ? textarea
    : document.activeElement instanceof HTMLTextAreaElement
      ? document.activeElement
      : null;
  const inlineFormattingState = normalizeManuscriptInlineFormattingState(state.manuscriptInlineFormatting);
  const text = activeTextarea instanceof HTMLTextAreaElement ? String(activeTextarea.value ?? "") : "";
  const offset = activeTextarea instanceof HTMLTextAreaElement && Number.isInteger(activeTextarea.selectionStart)
    ? activeTextarea.selectionStart
    : 0;
  const sceneId = activeTextarea instanceof HTMLTextAreaElement ? String(activeTextarea.dataset.sceneId ?? "") : "";
  const ranges = getSceneInlineFormatRanges(sceneId, text.length);

  for (const formatId of Object.keys(INLINE_FORMATS)) {
    const isPending = inlineFormattingState.pendingFormats[formatId] === true;
    const isActive = isPending || isInlineFormatActiveAtOffset(ranges, offset, formatId);
    const button = document.querySelector(`[data-action="toggle-inline-format"][data-inline-format="${CSS.escape(formatId)}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
  }
}

// Intent: keep visual manuscript styling as scene-draft metadata instead of embedding markup in the manuscript text.
function getSceneInlineFormatRanges(sceneId, textLength = Number.POSITIVE_INFINITY) {
  if (typeof sceneId !== "string" || !sceneId.trim()) {
    return [];
  }

  return normalizeInlineFormatRanges(state.sceneDrafts?.[sceneId]?.inlineFormatRanges, textLength);
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
  return selectOpenManuscriptTasks(state.manuscriptTasks);
}

function renderPassageNotePanel(noteType) {
  const panelModel = buildPassageNotePanelModel(
    state.passageNotes,
    noteType,
    groupScenesByChapter(state.scenes),
  );
  return renderPassageNotePanelHTML(panelModel, {
    selectedNoteId: state.selectedPassageNoteId,
    previewNoteId: state.taskPreview?.taskId,
    collapsedChapterIds: state.collapsedConsoleChapterIds?.[noteType],
    formatChapterTitle: formatChapterDisplayTitle,
  });
}

function buildRevisionPanelModel() {
  return revisionPanelController.buildPanelModel(state.revisionState, state.revisionPanelState);
}

function getRevisionSessionCount() {
  return Array.isArray(state.revisionState?.sessions) ? state.revisionState.sessions.length : 0;
}

// Intent: render the standalone revisions window from the revision feature model without moving domain state into the shell.
function renderRevisionWindow() {
  const slot = document.querySelector("#revision-window-slot");
  if (!slot) {
    return;
  }

  slot.innerHTML = state.revisionWindowOpen
    ? renderRevisionWindowHTML(buildRevisionPanelModel())
    : "";
}

// Intent: keep the standalone revision window refreshed while preserving the shared revision model.
function renderRevisionWindowSurface({ renderChrome = false } = {}) {
  if (state.revisionWindowOpen) {
    renderRevisionWindow();
  }
  if (renderChrome) {
    renderHeader();
  }
}

function toggleRevisionWindow() {
  if (state.revisionWindowOpen) {
    closeRevisionWindow();
    return;
  }

  closeWritingTargetWindow();
  ensureSelectedRevisionSession();
  state.revisionWindowOpen = true;
  revisionServiceLog.info("user-action", "revision.window.open", "Opened revisions window.", {
    projectId: state.activeProjectId ?? "",
    sessionCount: getRevisionSessionCount(),
  });
  renderHeader();
  renderRevisionWindow();
}

function closeRevisionWindow() {
  if (!state.revisionWindowOpen) {
    return;
  }

  state.revisionWindowOpen = false;
  revisionServiceLog.info("user-action", "revision.window.close", "Closed revisions window.", {
    projectId: state.activeProjectId ?? "",
  });
  renderHeader();
  renderRevisionWindow();
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

  slot.innerHTML = renderDeleteConfirmationDialogHTML(dialog, state.deleteConfirmationPreferences);
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
  const normalizedKey = preferenceKey === "tasks" ? "tasks" : "passageNotes";
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

  const deletion = anchoredRecordService.deletePassageNote(note.id, {
    dirtyReason: `${note.noteType}-note-deleted`,
    source: "performPassageNoteDeletion",
  });
  if (!deletion) {
    return false;
  }

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
    return "Imported task";
  }

  if (source === "source-comment-note") {
    return "Imported note";
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
  const panelModel = buildTaskPanelModel(tasks, groupScenesByChapter(state.scenes));
  return renderTaskPanelHTML(panelModel, {
    selectedTaskId: state.selectedTaskId,
    previewTaskId: state.taskPreview?.taskId,
    collapsedChapterIds: state.collapsedConsoleChapterIds?.issueTasks,
    formatChapterTitle: formatChapterDisplayTitle,
  });
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

function getNarrationTakeSelectionForScene(sceneId) {
  const scene = getScene(sceneId);
  return selectNarrationTakeSelectionForScene(scene, {
    currentSelection: state.narrationTakeSelection,
    selectedBlockId: state.selectedBlockId,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    getSceneBlockRanges,
  });
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
    syncSceneDocumentLayout();
    syncNarrationTakeSelectionPreview();
  }

  return selection;
}

function clearNarrationTakeSelection() {
  state.narrationTakeSelection = null;
  renderManuscriptPanel();
  syncSceneDocumentLayout();
}

function setNarrationTakeSession(session) {
  state.narrationTakeSession = session;
  renderManuscriptPanel();
  syncSceneDocumentLayout();
  syncNarrationTakeSelectionPreview();
}

// Intent: keep the armed narration verse visible as a runtime-only projection after scene rerenders.
function syncNarrationTakeSelectionPreview() {
  if (state.activePane !== "narration") {
    return;
  }

  const selection = state.narrationTakeSelection;
  const textarea = getEditorTextareaForScene(selection?.sceneId ?? state.selectedSceneId);
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!(textarea instanceof HTMLTextAreaElement) || !editorHost) {
    return;
  }

  if (!selection || selection.sceneId !== editorHost.sceneId) {
    clearTextareaRuntimeSelectionPreview(editorHost);
    return;
  }

  const projection = selectManuscriptProjections({
    sceneId: editorHost.sceneId,
    text: textarea.value,
    narrationSelection: selection,
    includeAuthorMarks: false,
    includeAnchoredRecords: false,
    includeSpellcheck: false,
  }).find((candidate) => candidate.channel === MANUSCRIPT_PROJECTION_CHANNELS.NARRATION_FOLLOW) ?? null;
  showTextareaRuntimeSelectionPreview(editorHost, projection, { focus: false });
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
  return resolveNarrationTakeSelectionFromTextInput({
    scene,
    contextRange,
    caretOffset,
    inlinePosition,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
    findSceneBlockAtOffset,
    getSceneBlockRanges,
  });
}

function buildNarrationTakeSelection(scene, block, blockRange, inlinePosition = null, startOffset = null, endOffset = null, selectedText = null) {
  return buildNarrationTakeSelectionRecord(scene, block, {
    blockRange,
    inlinePosition,
    startOffset,
    endOffset,
    selectedText,
    projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
  });
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

function createNarrationTakeSession(selection, options = {}) {
  return createNarrationTakeSessionRecord(selection, options, {
    clone: cloneValue,
  });
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
  await narrationRecordingCommandService.startRecording(sceneId);
}

async function stopNarrationRecording() {
  await narrationRecordingCommandService.stopRecording();
}

async function finalizeNarrationRecording(recordingId, stopError = null) {
  const runtime = narrationRecordingRuntime;
  if (!runtime || runtime.recordingId !== recordingId) {
    return;
  }

  narrationRecordingRuntime = null;
  const { finalRecord, selection, sessionOptions } = await narrationRecordingFinalizationService.finalizeRuntime(runtime, {
    stopError,
  });

  voiceRecordingService.upsert(finalRecord);
  setNarrationTakeSession(createNarrationTakeSession(selection, sessionOptions));
  persistCurrentProjectRecord({ skipProjectFileAutosave: true });
  void saveCurrentProject();
}

async function abortNarrationRecordingStart(selection, error, stream = null) {
  const runtime = narrationRecordingRuntime;
  narrationRecordingRuntime = null;
  narrationRecordingRuntimeService.cleanupRuntime(runtime, {
    additionalStream: stream,
  });

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

async function previewVoiceRecording(recordingId) {
  await voiceRecordingActionService.previewRecording(recordingId);
}

function goToVoiceRecordingVerse(recordingId) {
  const plan = voiceRecordingActionService.planRecordingVerseNavigation(recordingId);
  if (!plan.ok) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = plan.sceneId;
  state.selectedBlockId = plan.selectedBlockId;
  render();
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

  const editorHost = resolveTextareaEditorHost(editor);
  const textarea = editorHost?.textarea;
  const gutter = editor.querySelector("[data-editor-gutter]");
  if (
    !(textarea instanceof HTMLTextAreaElement) ||
    !(gutter instanceof HTMLElement) ||
    !editorHost
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
  syncInlineFormatLayer(editorHost);
  syncDiagnosticLayer(editorHost, selectedSceneId);
  if (state.editorPrefs.grammarCheckEnabled === false) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
  } else if (options.skipSpellcheck === true) {
    syncTextareaSpellcheckTypingState(editorHost, options.activeTypingWordRange);
  } else {
    syncSpellcheckLayer(editorHost, selectedSceneId, options);
  }
  syncInlinePassageDraftLayout();
}

// Intent: defer the current overlay limitation to the textarea host while richer hosts remain possible.
function syncInlineFormatLayer(editorHost) {
  // Intent: keep the editor usable while the visual inline-format overlay is reworked for exact textarea metrics.
  clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.AUTHOR_MARK);
}

// Intent: rebuild diagnostic visuals from durable issue anchors and current text without persisting overlays.
function syncDiagnosticLayer(editorHost, sceneId) {
  const scene = getScene(sceneId);
  if (!scene) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.DIAGNOSTIC);
    return;
  }

  renderTextareaDiagnosticLayer(editorHost, {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      projectId: state.workspace?.project?.id ?? "",
      sceneId,
      text: editorHost.textarea.value,
      sceneBlocks: scene.blocks,
      diagnosticIssues: state.workspace?.project?.issues,
      includeAuthorMarks: false,
      includeAnchoredRecords: false,
      includeRuntimeSelections: false,
      includeSpellcheck: false,
    }),
  });
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
  spellcheckRefreshController.schedule(sceneId, {
    enabled: state.editorPrefs.grammarCheckEnabled !== false,
  });
}

function flushSceneEditorSpellcheckRefresh(sceneId) {
  if (state.editorPrefs.grammarCheckEnabled === false) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }
  const editorHost = resolveTextareaEditorHost(textarea);
  if (!editorHost) {
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
  spellcheckRefreshController.clear();
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

// Intent: prefer the desktop project file on boot; browser cache is only a temporary compatibility fallback.
async function loadInitialProjectLibrary(desktopSettings = null) {
  const shouldDeferToDesktopProjectFile =
    desktopSettings?.lastProjectFilePathExplicit === true &&
    hasProjectFilePath(resolveProjectFilePath(desktopSettings.lastProjectFilePath));
  const storedLibrary = shouldDeferToDesktopProjectFile
    ? { activeProjectId: null, projects: [], sceneStore: {} }
    : normalizeProjectLibrarySnapshot(projectService.loadProjectLibrarySnapshot());
  const storedActiveProjectId = shouldDeferToDesktopProjectFile
    ? null
    : projectRepository.loadActiveProjectId();
  const legacyProjectId =
    storedLibrary.activeProjectId ??
    storedActiveProjectId ??
    null;
  const legacyState = shouldDeferToDesktopProjectFile ? null : loadLegacyProjectState(legacyProjectId);
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

  return shouldDeferToDesktopProjectFile ? library : projectService.saveProjectLibrarySnapshot(library);
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
    manuscriptTasks: mergeProjectLibraryItemsById(storedRecord.manuscriptTasks, seedRecord.manuscriptTasks, { clone: cloneValue }),
    passageNotes: mergeProjectLibraryItemsById(storedRecord.passageNotes, seedRecord.passageNotes, { clone: cloneValue }),
    sourceArchive: cloneValue(seedRecord.sourceArchive ?? storedRecord.sourceArchive ?? []),
    importReport: cloneValue(seedRecord.importReport ?? storedRecord.importReport ?? {}),
    editorPrefs: normalizeEditorPrefs(storedRecord.editorPrefs ?? seedRecord.editorPrefs ?? legacyState?.editorPrefs),
    localAiPrefs: normalizeLocalAiPrefs(storedRecord.localAiPrefs ?? seedRecord.localAiPrefs ?? legacyState?.localAiPrefs),
  };
  const mergedRevisionState =
    getPersistableRevisionProjectState(storedRecord.revisions) ??
    getPersistableRevisionProjectState(seedRecord.revisions);
  if (mergedRevisionState) {
    merged.revisions = mergedRevisionState;
  }

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
    collapsedChapterIds: normalizeCollapsedChapterIds(
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

function createProjectLibraryRecordFromState(options = {}) {
  return projectRuntimeRecordStateService.createProjectRecordFromRuntimeState(options);
}

function createRevisionPanelStateForProject(revisionState) {
  const normalized = normalizeRevisionProjectState(revisionState);
  return {
    query: "",
    categoryFilter: "all",
    originFilter: "all",
    selectedSessionId: normalized.activeSessionId || normalized.sessions[0]?.metadata?.id || "",
    showFullDiff: false,
    statusMessage: "",
  };
}

function applyProjectRecord(record) {
  projectActivationController.applyProjectRecord(record);
}

function activateProjectRecord(record, options = {}) {
  projectActivationController.activateProjectRecord(record, options);
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

  return manuscriptSelectionController.resolveSelectionDefaultsForSave({
    selectedBlockId: state.selectedBlockId ?? "",
    scene,
    liveSelection,
    cachedSelection: snapshot,
    fallbackStartOffset: Number.isInteger(textarea?.selectionStart) ? textarea.selectionStart : 0,
    fallbackEndOffset: Number.isInteger(textarea?.selectionEnd) ? textarea.selectionEnd : textarea?.selectionStart,
  });
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
  return manuscriptSelectionController.normalizeSavedSceneSelection(candidate, scene);
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
    const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
    const sceneMetrics = buildSceneLineMetrics(
      state.scenes,
      charactersPerLine,
      { [scene.sceneId]: textarea.value },
    ).find((candidate) => candidate.sceneId === scene.sceneId);
    const relativeLineNumber = Math.max(0, lineNumber - (sceneMetrics?.startLineNumber ?? lineNumber));
    const lineEndOffset = findTextareaOffsetForVisualLineEnd(
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

    selectTextareaEditorHostRange(editorHost, lineEndOffset, lineEndOffset, {
      behavior: "auto",
      focus: true,
      scroll: true,
    });
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
      selectTextareaEditorHostRange(editorHost, targetOffset, targetOffset, {
        behavior: "auto",
        focus: true,
        scroll: true,
      });
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

  selectTextareaEditorHostRange(editorHost, startOffset, endOffset, {
    behavior: "auto",
    focus: true,
    scroll: true,
  });
}

// Intent: cache the current scene editor caret and viewport so autosave can persist it reliably.
function captureSceneEditorSelectionSnapshotFromTextarea(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return null;
  }

  const hostSelection = readTextareaEditorHostSelection(resolveTextareaEditorHost(textarea));
  const sceneId = typeof hostSelection?.sceneId === "string" ? hostSelection.sceneId.trim() : "";
  if (!sceneId) {
    return null;
  }

  const scene = getScene(sceneId);
  if (!scene) {
    return null;
  }

  const startOffset = hostSelection.startOffset;
  const endOffset = hostSelection.endOffset;
  const lineNumber = getSceneEditorSelectionLineNumber(textarea, scene, startOffset);

  return manuscriptSelectionController.createSelectionSnapshot({
    scene,
    sceneId,
    text: hostSelection.text,
    lineNumber,
    startOffset,
    endOffset,
    scrollTop: hostSelection.scrollTop,
    scrollLeft: hostSelection.scrollLeft,
  });
}

function updateSceneEditorSelectionSnapshotFromTextarea(textarea) {
  const snapshot = captureSceneEditorSelectionSnapshotFromTextarea(textarea);
  if (!snapshot) {
    return;
  }

  state.sceneEditorSelectionSnapshot = snapshot;
}

// Intent: keep author editing context current without rerendering the manuscript editor on focus or typing.
function markSceneEditorAsCurrent(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement) || !textarea.classList.contains("editor-document-input")) {
    return false;
  }

  const sceneId = typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId.trim() : "";
  const scene = sceneId ? getScene(sceneId) : null;
  if (!scene) {
    return false;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const block = findSceneBlockAtOffset(scene, selectionStart) ?? scene.blocks[0] ?? null;
  state.activeEditorSceneId = scene.sceneId;
  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId = block?.blockId ?? state.selectedBlockId;
  updateSceneEditorSelectionSnapshotFromTextarea(textarea);
  return true;
}

// Intent: convert the current caret position into a stable manuscript line number for save/restore.
function getSceneEditorSelectionLineNumber(textarea, scene, offset = null) {
  if (!(textarea instanceof HTMLTextAreaElement) || !scene) {
    return null;
  }

  const editorHost = resolveTextareaEditorHost(textarea);
  const { charactersPerLine } = getTextareaEditorHostWrapMetrics(editorHost);
  const selectedSceneMetrics = buildSceneLineMetrics(
    state.scenes,
    charactersPerLine,
    { [scene.sceneId]: textarea.value },
  ).find((candidate) => candidate.sceneId === scene.sceneId);
  const caretOffset = Number.isInteger(offset) ? offset : Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const visualLineOffset = estimateTextareaVisualLineBeforeOffset(textarea.value, caretOffset, charactersPerLine);
  return (selectedSceneMetrics?.startLineNumber ?? 1) + visualLineOffset;
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

  // Intent: stop legacy mirror batches after quota fails so one load cannot generate a storage log storm.
  const legacySnapshots = [
    [EDITOR_PROJECT_TITLE_KEY, state.projectTitle],
    [EDITOR_PROJECT_SOURCE_PATH_KEY, state.projectSourcePath],
    [EDITOR_DRAFTS_KEY, state.sceneDrafts],
    [EDITOR_STRUCTURE_KEY, state.structureDrafts],
    [EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts],
    [EDITOR_TASKS_KEY, state.manuscriptTasks],
    [EDITOR_PASSAGE_NOTES_KEY, state.passageNotes],
    [EDITOR_PREFS_KEY, state.editorPrefs],
    [EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs],
  ];

  for (const [storageKey, snapshot] of legacySnapshots) {
    if (writeStoredJsonRaw(storageKey, snapshot) !== true) {
      break;
    }
  }
}

function setRevisionState(revisionState, context = {}) {
  state.revisionState = normalizeRevisionProjectState(revisionState);
  if (context.persist !== true) {
    return state.revisionState;
  }

  persistCurrentProjectRecord({
    domain: "revisions",
    dirtyReason: context.dirtyReason ?? "revision-history-updated",
    source: context.source ?? "RevisionService.setRevisionState",
    skipProjectFileAutosave: context.skipProjectFileAutosave === true,
    markWorkingState: context.markWorkingState,
  });
  return state.revisionState;
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

// Intent: persist task diagnostics through the canonical project-file boundary instead of legacy task cache writes.
function persistManuscriptTasksState(options = {}) {
  persistCurrentProjectRecord({
    domain: "manuscript-tasks",
    dirtyReason: options.dirtyReason ?? "manuscript-task-updated",
    source: options.source ?? "persistManuscriptTasksState",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    markWorkingState: options.markWorkingState,
  });
}

// Intent: persist inspiration and research notes through the same project-file boundary as manuscript tasks.
function persistPassageNotesState(options = {}) {
  persistCurrentProjectRecord({
    domain: "passage-notes",
    dirtyReason: options.dirtyReason ?? "passage-note-updated",
    source: options.source ?? "persistPassageNotesState",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    markWorkingState: options.markWorkingState,
  });
}

function loadSelectedProject() {
  persistCurrentProjectRecord({
    domain: "project",
    dirtyReason: "before-project-switch",
    source: "loadSelectedProject",
    markWorkingState: false,
  });

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
  activateProjectRecord(record, {
    reason: "load-project",
    refreshSessionLifecycle: true,
    logLoadCheckpoint: true,
    beforeRender: () => {
      projectPersistenceService.syncActiveProjectFileDestinationFromRecord({
        persistDesktopProjectFilePath: true,
        source: "loadSelectedProject",
      });
    },
    renderAfter: true,
    afterRender: () => primeProjectFileAutosave(),
    recordSnapshot: true,
  });
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
  activateProjectRecord(record, {
    reason: "create-project",
    beforeRender: () => {
      setProjectFilePath(getSuggestedProjectFilePath(), null, { skipProjectFileAutosave: true });
      persistCurrentProjectRecord({ skipProjectFileAutosave: true });
    },
    renderAfter: true,
    recordSnapshot: true,
  });
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
    const result = await projectSourceService.loadProjectSource({
      projectPath,
      activeProjectId: state.activeProjectId,
      projects: state.projectLibrary,
    });
    if (!result.ok) {
      throw result.error ?? new Error("Project source load failed.");
    }

    state.projectLibrary = result.persistedLibrary.projects;
    state.activeProjectId = result.persistedLibrary.activeProjectId;
    state.projectLibrarySelectionId = result.persistedLibrary.activeProjectId;

    const record = getActiveProjectRecord();
    if (!record) {
      throw new Error("Unable to activate the loaded project source.");
    }

    activateProjectRecord(record, {
      reason: "load-project-source",
      beforeRender: () => {
        if (state.workspace?.project?.stats) {
          state.projectSourceStatus = `Loaded ${record.title} · ${state.workspace.project.stats.chapterCount} chapters, ${state.workspace.project.stats.sceneCount} scenes`;
        }
      },
      renderAfter: true,
      recordSnapshot: true,
    });
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
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), cursorOffset, cursorOffset, {
      focus: true,
      scroll: false,
    });
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
  return buildSpellcheckEditorContextMenu(editorContext, event, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  }, {
    getTextareaOffsetFromPoint,
  });
}

function getSpellcheckContextFromGrammarCheckTarget(target, event) {
  return buildSpellcheckGrammarCheckContextMenu(target, event, {
    scene: getSelectedScene() ?? state.scenes[0] ?? null,
    lexicons: {
      baseLexicon: spellcheckBaseLexicon,
      projectLexicon: buildCurrentProjectSpellcheckLexicon(),
      referenceLexicon: spellcheckReferenceLexicon,
    },
  });
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

function getCurrentSpellcheckLexicons() {
  return {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  };
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
  return manuscriptSelectionController.getContextRange({
    text: textarea.value,
    startOffset: textarea.selectionStart,
    endOffset: textarea.selectionEnd,
  });
}

// Intent: switch high-level workspaces while preserving editor-focused layout and selection state.
function selectWorkspacePane(paneId) {
  const normalizedPaneId = paneId === "voice" ? "narration" : paneId;

  if (!["manuscript", "world", "narration"].includes(normalizedPaneId)) {
    return;
  }

  if (normalizedPaneId !== "manuscript" && state.manuscriptFind.open) {
    state.manuscriptFind = manuscriptFindController.close(state.manuscriptFind);
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

function ensureSelectedRevisionSession() {
  const model = buildRevisionPanelModel();
  state.revisionPanelState = {
    ...state.revisionPanelState,
    selectedSessionId: model.selectedSessionId,
  };
}

function updateRevisionPanelSearch(value) {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    query: String(value ?? ""),
    selectedSessionId: "",
  };
  renderRevisionWindowSurface();
  focusRevisionPanelControl(state.revisionWindowOpen ? ".revision-window [data-revision-search]" : "[data-revision-search]");
}

function updateRevisionPanelFilter(fieldName, value) {
  if (fieldName !== "categoryFilter" && fieldName !== "originFilter") {
    return;
  }

  state.revisionPanelState = {
    ...state.revisionPanelState,
    [fieldName]: String(value ?? "all"),
    selectedSessionId: "",
  };
  renderRevisionWindowSurface();
}

function focusRevisionPanelControl(selector) {
  window.requestAnimationFrame(() => {
    const field = document.querySelector(selector);
    if (field instanceof HTMLInputElement) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(field.value.length, field.value.length);
    }
  });
}

function selectRevisionSession(sessionId) {
  const selectedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!selectedSessionId || !revisionService.getSessionById(selectedSessionId)) {
    return;
  }

  state.revisionPanelState = {
    ...state.revisionPanelState,
    selectedSessionId,
    statusMessage: "",
  };
  renderRevisionWindowSurface();
}

function setRevisionPanelStatus(statusMessage) {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    statusMessage: String(statusMessage ?? ""),
  };
  renderRevisionWindowSurface();
}

function bankCurrentRevisionFromPanel() {
  const result = revisionService.bankCurrentRevision({
    reason: "revision-banked",
    markWorkingState: true,
  });
  const session = result?.session ?? null;
  if (result?.banked && session) {
    state.revisionPanelState = {
      ...state.revisionPanelState,
      selectedSessionId: session.metadata.id,
      statusMessage: "Revision banked into this project.",
      showFullDiff: false,
    };
    renderRevisionWindowSurface({ renderChrome: true });
    return;
  }

  const reason = result?.reason === "no-open-session"
    ? "No manuscript changes have started a revision session yet."
    : result?.reason === "no-meaningful-changes"
      ? "No meaningful project changes were found to bank."
      : "Revision could not be banked.";
  setRevisionPanelStatus(reason);
}

function toggleRevisionDiffDetail() {
  state.revisionPanelState = {
    ...state.revisionPanelState,
    showFullDiff: !state.revisionPanelState.showFullDiff,
  };
  renderRevisionWindowSurface();
}

function exportRevisionSummary(sessionId = "") {
  const session = revisionService.getSessionById(sessionId || state.revisionPanelState.selectedSessionId);
  if (!session) {
    setRevisionPanelStatus("Choose a revision session before exporting.");
    return;
  }

  const summary = buildRevisionExportMarkdown(session);
  const blob = new Blob([summary], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeDownloadFileName(session.metadata.title || "revision-summary")}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  setRevisionPanelStatus("Revision summary exported.");
}

function buildRevisionExportMarkdown(session) {
  const lines = [
    `# ${session.metadata.title || "Revision Summary"}`,
    "",
    `- Status: ${session.metadata.status || "unknown"}`,
    `- Started: ${session.metadata.startedAt || "Not recorded"}`,
    `- Banked: ${session.metadata.finalisedAt || session.metadata.stagedAt || "Not recorded"}`,
    `- Changed entities: ${Array.isArray(session.changedEntities) ? session.changedEntities.length : 0}`,
    `- Events: ${Array.isArray(session.events) ? session.events.length : 0}`,
    "",
    session.summaryMarkdown || "No generated summary is available.",
  ];
  return `${lines.join("\n")}\n`;
}

function sanitizeDownloadFileName(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "revision-summary";
}

function openFirstRevisionScene(sessionId = "") {
  const session = revisionService.getSessionById(sessionId || state.revisionPanelState.selectedSessionId);
  const target = findFirstRevisionNavigableEntity(session);
  if (!target) {
    setRevisionPanelStatus("No changed scene is available for this revision.");
    return;
  }

  navigateRevisionEntity(target.entityType, target.entityId);
}

function findFirstRevisionNavigableEntity(session) {
  const entities = Array.isArray(session?.changedEntities) ? session.changedEntities : [];
  return entities.find((entity) =>
    entity?.entityType === "scene" &&
    typeof entity.entityId === "string" &&
    getScene(entity.entityId),
  ) ?? null;
}

function navigateRevisionEntity(entityType, entityId) {
  const normalizedType = String(entityType ?? "").trim();
  const normalizedId = String(entityId ?? "").trim();
  if (!normalizedType || !normalizedId) {
    return;
  }

  if (normalizedType === "scene") {
    selectWorkspacePane("manuscript");
    selectSceneById(normalizedId);
    setRevisionPanelStatus("Opened changed scene.");
    return;
  }

  if (normalizedType === "manuscript_task") {
    selectWorkspacePane("manuscript");
    state.sidePanelMode = "issues";
    navigateTaskAnchor(normalizedId);
    return;
  }

  if (normalizedType === "passage_note") {
    const note = state.passageNotes.find((candidate) => candidate.id === normalizedId);
    if (note) {
      selectWorkspacePane("manuscript");
      state.sidePanelMode = note.noteType;
      togglePassageNoteSelection(note.id);
    }
    return;
  }

  if (normalizedType === "world_entity") {
    selectWorkspacePane("world");
    state.selectedEntityId = normalizedId;
    render();
    return;
  }

  if (normalizedType === "timeline_node") {
    selectWorkspacePane("world");
    state.selectedNodeId = normalizedId;
    render();
  }
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

  const editorHost = resolveTextareaEditorHost(textarea);
  const offset = getTextareaOffsetFromPoint(textarea, event.clientX, event.clientY);
  const trailingWhitespaceRange = getTrailingWhitespaceRange(textarea.value);
  if (trailingWhitespaceRange && (!Number.isInteger(offset) || offset >= textarea.value.length)) {
    selectTextareaEditorHostRange(
      editorHost,
      trailingWhitespaceRange.start,
      trailingWhitespaceRange.end,
      {
        focus: true,
        scroll: false,
      },
    );
    return true;
  }

  if (Number.isInteger(offset)) {
    const safeOffset = clampEditorOffset(offset, textarea.value.length);
    selectTextareaEditorHostRange(editorHost, safeOffset, safeOffset, {
      focus: true,
      scroll: false,
    });
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: task,
    recordType: "task",
    text: textarea.value,
  });
  if (!preview) {
    return;
  }

  const { startOffset, endOffset } = preview.resolvedRange;
  const editorHost = resolveTextareaEditorHost(textarea);

  state.taskPreview = {
    ...preview.previewSelection,
    wasFocused: true,
    pinned: true,
  };

  showTextareaAnchoredRecordPreview(editorHost, preview.projection);
  scrollTextareaEditorHostToOffset(editorHost, startOffset, options);
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: task,
    recordType: "task",
    text: textarea.value,
    repair: false,
  });
  if (!preview) {
    return;
  }

  const editorHost = resolveTextareaEditorHost(textarea);
  const taskElement = document.querySelector(`[data-task-preview-id="${CSS.escape(task.id)}"]`);

  state.taskPreview = {
    taskId: task.id,
    sceneId: task.sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    wasFocused: document.activeElement === textarea,
    pinned: false,
  };

  showTextareaAnchoredRecordPreview(editorHost, preview.projection);
  if (taskElement instanceof HTMLElement) {
    taskElement.classList.add("is-previewing");
  }
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

  anchoredRecordService.repairTaskAnchor(task.id, resolvedRange, {
    dirtyReason: "manuscript-task-anchor-repaired",
    source: "syncResolvedTaskRange",
  });
}

function centerEditorOnCaret(textarea) {
  scrollTextareaEditorHostToSelection(resolveTextareaEditorHost(textarea));
}

function takeToEditorOffset(textarea, offset, options = {}) {
  scrollTextareaEditorHostToOffset(resolveTextareaEditorHost(textarea), offset, options);
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

  return Boolean(selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), startOffset, endOffset, {
    behavior: options.behavior ?? "auto",
    focus: true,
    scroll: true,
  }));
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
    const editorHost = resolveTextareaEditorHost(textarea);
    clearTextareaAnchoredRecordPreview(editorHost);

    if (restoreSelection) {
      if (preview.wasFocused) {
        selectTextareaEditorHostRange(editorHost, preview.selectionStart, preview.selectionEnd, {
          focus: false,
          scroll: false,
        });
      } else {
        selectTextareaEditorHostRange(editorHost, textarea.selectionEnd, textarea.selectionEnd, {
          focus: false,
          scroll: false,
        });
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
  return captureTextareaEditorHostViewport(resolveTextareaEditorHost(textarea));
}

// Intent: restore the manuscript editor to the same visual position after note deletion.
function restoreSceneEditorViewport(sceneId, viewport) {
  if (!viewport) {
    return;
  }

  const textarea = getEditorTextareaForScene(sceneId);
  restoreTextareaEditorHostViewport(resolveTextareaEditorHost(textarea), viewport);
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
  state.inlinePassageDraft = buildInlinePassageNoteDraftFromContextMenu(menu, noteType);
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

  const note = buildPassageNoteFromComposer({
    composer,
    scene,
    body,
  });
  if (!note) {
    hideTaskSurfaces();
    return;
  }

  anchoredRecordService.addPassageNote(note, {
    dirtyReason: `${note.noteType}-note-created`,
    source: "savePassageNoteFromComposer",
  });
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
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
    const updatedNote = anchoredRecordService.updatePassageNoteBody(draft.editingNoteId, body, {
      dirtyReason: `${draft.noteType}-note-body-edited`,
      source: "commitInlinePassageNote.edit",
    });
    if (!updatedNote) {
      cancelInlinePassageNote();
      return;
    }

    state.sidePanelMode = updatedNote.noteType;
    state.selectedPassageNoteId = updatedNote.id;
    state.inlinePassageDraft = null;
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

  anchoredRecordService.addPassageNote(note, {
    dirtyReason: `${note.noteType}-note-created`,
    source: "commitInlinePassageNote.create",
  });
  state.sidePanelMode = note.noteType;
  state.selectedPassageNoteId = note.id;
  state.inlinePassageDraft = null;
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
  state.inlinePassageDraft = updateInlinePassageDraftTypingState(draft, previous, nextText, {
    clampOffset: clampEditorOffset,
  });
}

function insertInlinePassageVerse(draft, verseText, editorText) {
  const insertion = planInlinePassageVerseInsertion(draft, verseText, editorText, {
    trimTextRange: manuscriptSelectionController.trimTextRange,
    clampOffset: clampEditorOffset,
  });
  if (!insertion) {
    return null;
  }

  updateSceneDraft(draft.sceneId, (sceneDraft) => {
    sceneDraft.editorText = insertion.editorText;
    sceneDraft.revisionStats = updateSceneRevisionStats(
      sceneDraft.revisionStats ?? draft.revisionStats,
      insertion.previousText,
      insertion.editorText,
    );
  });
  syncRevisionPanel(draft.sceneId);

  const textarea = getEditorTextareaForScene(draft.sceneId);
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.value = insertion.editorText;
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), insertion.anchor.startOffset, insertion.anchor.endOffset, {
      focus: false,
      scroll: false,
    });
  }

  return insertion;
}

function getInlinePassageDraftAnchor(draft, editorText, options = {}) {
  return getInlinePassageDraftAnchorFromController(draft, editorText, {
    ...options,
    trimTextRange: manuscriptSelectionController.trimTextRange,
    clampOffset: clampEditorOffset,
  });
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
  selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), offset, offset, {
    behavior: "auto",
    focus: true,
    scroll: true,
  });
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

  const note = anchoredRecordNavigationController.findRecordAtSelection({
    records: state.passageNotes.filter((candidate) => candidate.noteType === state.sidePanelMode),
    recordType: "passageNote",
    sceneId,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    text: textarea.value,
  });
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

  const task = anchoredRecordNavigationController.findRecordAtSelection({
    records: state.manuscriptTasks.filter((candidate) => candidate.status === "open"),
    recordType: "task",
    sceneId,
    selectionStart: clickTarget.selectionStart,
    selectionEnd: clickTarget.selectionEnd,
    text: clickTarget.value,
  });
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

  const preview = anchoredRecordNavigationController.buildPreview({
    record: note,
    recordType: "passageNote",
    text: textarea.value,
  });
  if (!preview) {
    return;
  }

  const { startOffset } = preview.resolvedRange;
  const editorHost = resolveTextareaEditorHost(textarea);

  clearTaskAnchorPreview({ restoreSelection: false });

  state.taskPreview = {
    ...preview.previewSelection,
    wasFocused: true,
    pinned: true,
  };

  if (showTextareaAnchoredRecordPreview(editorHost, preview.projection)) {
    scrollTextareaEditorHostToOffset(editorHost, startOffset, options);
  }
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

  anchoredRecordService.repairPassageNoteAnchor(note.id, resolvedRange, {
    dirtyReason: "passage-note-anchor-repaired",
    source: "syncResolvedPassageNoteRange",
  });
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
  state.taskComposer = buildTaskComposerFromContextMenu(menu, {
    x: event.clientX,
    y: event.clientY,
  });
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

  const task = buildTaskFromComposer({
    composer,
    scene,
    body,
    taskNumber: getNextTaskNumberForScene(scene.sceneId),
  });
  if (!task) {
    hideTaskSurfaces();
    return;
  }
  anchoredRecordService.addTask(task, {
    dirtyReason: "manuscript-task-created",
    source: "saveTaskFromComposer",
  });
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

  const result = await localAiTitleService.requestTitle({
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
  const request = buildTaskTitleRequest(task, {
    projectContext: state.projectTitle,
    formatChapterTitle: formatChapterDisplayTitle,
  });

  if (!request) {
    return;
  }

  localAiTitleService.requestTitle(request).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentTask = state.manuscriptTasks.find((candidate) => candidate.id === task.id);
    if (!canApplySuggestedRecordTitle(currentTask, fallbackTitle)) {
      return;
    }

    anchoredRecordService.updateTaskTitle(task.id, result.title, {
      dirtyReason: "manuscript-task-title-suggested",
      source: "maybeSuggestTaskTitle",
    });
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest task title", error));
}

function maybeSuggestPassageNoteTitle(note) {
  if (!state.localAiPrefs.enabled) {
    return;
  }

  const fallbackTitle = note.title;
  const request = buildPassageNoteTitleRequest(note, {
    projectContext: state.projectTitle,
    formatChapterTitle: formatChapterDisplayTitle,
  });

  if (!request) {
    return;
  }

  localAiTitleService.requestTitle(request).then((result) => {
    if (!result.ok) {
      return;
    }

    const currentNote = state.passageNotes.find((candidate) => candidate.id === note.id);
    if (!canApplySuggestedRecordTitle(currentNote, fallbackTitle)) {
      return;
    }

    anchoredRecordService.updatePassageNoteTitle(note.id, result.title, {
      dirtyReason: `${currentNote.noteType}-note-title-suggested`,
      source: "maybeSuggestPassageNoteTitle",
    });
    renderConsolePanel();
  }).catch((error) => console.warn("Unable to suggest passage note title", error));
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
  anchoredRecordService.completeTask(taskId, {
    dirtyReason: "manuscript-task-completed",
    source: "completeTask",
  });
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
  const result = applySpellcheckProjectListMutation(
    state.spellcheckProjectSettings,
    targetListKey,
    sourceWords,
  );
  if (!result.changed) {
    return false;
  }

  state.spellcheckProjectSettings = result.settings;
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
  const menuWord = String(target.dataset.spellcheckWord ?? "");
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

  const liveRange = validateLiveSpellcheckMenuRange(textarea.value, {
    word: menuWord,
    startOffset,
    endOffset,
  }, {
    baseLexicon: spellcheckBaseLexicon,
    projectLexicon: buildCurrentProjectSpellcheckLexicon(),
    referenceLexicon: spellcheckReferenceLexicon,
  });
  if (!liveRange) {
    syncSceneDocumentLayout();
    return;
  }

  focusTextareaEditorHost(resolveTextareaEditorHost(textarea), { preventScroll: true });
  textarea.setRangeText(replacement, liveRange.startOffset, liveRange.endOffset, "end");
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

function recordRevisionSceneTextEdit(sceneId, previousText, nextText) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return;
  }

  const scene = getScene(sceneId);
  const summary = summarizeSceneTextChange(previous, next);
  revisionService.recordEvent({
    eventType: "manuscript_edit",
    origin: "manual_editor",
    sourceService: "scene-editor",
    entityType: "scene",
    entityId: sceneId,
    description: summary,
    changeCategory: "manuscript",
    mode: "typing",
    beforeSummary: {
      title: scene?.sceneTitle ?? "Untitled Scene",
      chapterId: scene?.chapterId ?? "",
      chapterTitle: scene?.chapterTitle ?? "",
      wordCount: countWords(previous),
      charCount: previous.length,
    },
    afterSummary: {
      title: scene?.sceneTitle ?? "Untitled Scene",
      chapterId: scene?.chapterId ?? "",
      chapterTitle: scene?.chapterTitle ?? "",
      wordCount: countWords(next),
      charCount: next.length,
    },
  }, {
    persist: false,
    skipProjectFileAutosave: true,
  });
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

// Intent: route manuscript styling through a shared command controller instead of scene-wide editor preferences.
function toggleManuscriptInlineFormat(formatId) {
  const activeElement = document.activeElement;
  const textarea = activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")
    ? activeElement
    : document.querySelector(".editor-document-input");
  const editorHost = resolveTextareaEditorHost(textarea);
  const controller = createManuscriptCommandController({
    getInlineFormattingState: () => state.manuscriptInlineFormatting,
    setInlineFormattingState: (nextInlineFormattingState) => {
      state.manuscriptInlineFormatting = normalizeManuscriptInlineFormattingState(nextInlineFormattingState);
    },
    resolveSelection: () => editorHost?.readSelection(
      getSceneInlineFormatRanges(String(textarea?.dataset?.sceneId ?? ""), String(textarea?.value ?? "").length),
    ),
    applyTextMutation: (mutation) => editorHost?.applyTextMutation(mutation),
    applyRangeMutation: (ranges) => {
      const sceneId = String(textarea?.dataset?.sceneId ?? "");
      if (!sceneId) {
        return;
      }

      updateSceneDraft(sceneId, (draft) => {
        draft.inlineFormatRanges = normalizeInlineFormatRanges(ranges, String(textarea?.value ?? "").length);
      }, {
        reason: "manuscript-inline-format",
        markSessionActivity: false,
      });
      syncSceneDocumentLayout({ skipSpellcheck: true });
    },
    log: editorInteractionLog,
  });
  const result = controller.execute("toggleInlineFormat", {
    format: formatId,
  });

  if (!result.applied) {
    editorInteractionLog.warn("user-action", "manuscript.inline-format.skipped", "Skipped manuscript inline formatting command.", {
      format: String(formatId ?? ""),
      reason: result.reason,
    });
    return;
  }

  updateInlineFormatToolbarState(textarea);
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
  const selectedScene = getScene(getSceneIdForNewSceneDraftAnchor()) ?? getSelectedScene() ?? state.scenes[0];
  if (!selectedScene) {
    return;
  }

  const sceneCount = getScenesForChapter(selectedScene.chapterId).length + 1;
  const sceneId = `draft-scene-${Date.now()}`;
  const newSceneDraft = {
    sceneId,
    chapterId: selectedScene.chapterId,
    chapterTitle: selectedScene.chapterTitle,
    sceneTitle: `New Scene ${sceneCount}`,
    initialText: "",
  };
  state.structureDrafts = insertStructureSceneDraftAfterAnchor(
    state.structureDrafts,
    state.scenes,
    newSceneDraft,
    selectedScene.sceneId,
  );
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  refreshScenes();
  selectSceneById(sceneId);
}

// Intent: treat the focused scene editor as the user's current insertion point, with persisted selection as fallback.
function getSceneIdForNewSceneDraftAnchor() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLTextAreaElement && activeElement.classList.contains("editor-document-input")) {
    markSceneEditorAsCurrent(activeElement);
    const focusedSceneId = typeof activeElement.dataset.sceneId === "string" ? activeElement.dataset.sceneId.trim() : "";
    if (focusedSceneId && getScene(focusedSceneId)) {
      return focusedSceneId;
    }
  }

  const activeEditorSceneId = typeof state.activeEditorSceneId === "string" ? state.activeEditorSceneId.trim() : "";
  if (activeEditorSceneId && getScene(activeEditorSceneId)) {
    return activeEditorSceneId;
  }

  const snapshotSceneId =
    state.sceneEditorSelectionSnapshot && typeof state.sceneEditorSelectionSnapshot.sceneId === "string"
      ? state.sceneEditorSelectionSnapshot.sceneId.trim()
      : "";
  if (snapshotSceneId && getScene(snapshotSceneId)) {
    return snapshotSceneId;
  }

  return typeof state.selectedSceneId === "string" ? state.selectedSceneId : "";
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
  state.activeEditorSceneId = refreshedScene.sceneId;
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

  state.collapsedChapterIds = toggleCollapsedChapterId(state.collapsedChapterIds, chapterId);
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

  const panelState = toggleCollapsedConsoleChapter(state.collapsedConsoleChapterIds, panelId, chapterKey);
  if (panelState === state.collapsedConsoleChapterIds) {
    return;
  }
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

function syncSpellcheckLayer(editorHost, sceneId, options = {}) {
  if (!editorHost || !(editorHost.textarea instanceof HTMLTextAreaElement)) {
    return;
  }

  if (!spellcheckBaseLexicon?.wordList?.length) {
    clearTextareaProjectionLayer(editorHost, MANUSCRIPT_PROJECTION_CHANNELS.SPELLCHECK);
    return;
  }

  const projectLexicon = buildCurrentProjectSpellcheckLexicon();
  const snapshot = {
    sceneId,
    text: editorHost.textarea.value,
    projections: selectManuscriptProjections({
      sceneId,
      text: editorHost.textarea.value,
      spellcheckMisspellings: collectSpellcheckMisspellings(editorHost.textarea.value, {
        baseLexicon: spellcheckBaseLexicon,
        projectLexicon,
        referenceLexicon: spellcheckReferenceLexicon,
      }, {
        excludeRange: options.activeTypingWordRange ?? options.excludeRange ?? null,
      }),
      includeAuthorMarks: false,
    }),
  };
  renderTextareaSpellcheckLayer(editorHost, snapshot);
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

function isMovableScene(scene) {
  return Boolean(
    scene &&
    typeof scene.sceneId === "string" &&
    scene.sceneId.trim() &&
    typeof scene.chapterId === "string" &&
    scene.chapterId.trim(),
  );
}

function getMovableSceneById(sceneId) {
  const scene = getScene(sceneId);
  return isMovableScene(scene) ? scene : null;
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

// Intent: reorder UI scene records, including draft-only scenes that do not yet have persisted manuscript lines.
function reorderSceneRecordsForDropTarget(scenes, sourceSceneId, dropTarget) {
  const sourceIndex = scenes.findIndex((scene) => scene.sceneId === sourceSceneId);
  if (sourceIndex === -1) {
    return null;
  }

  const nextScenes = scenes.map((scene) => ({ ...scene }));
  const [movedScene] = nextScenes.splice(sourceIndex, 1);

  let insertIndex = -1;
  let targetChapterId = "";
  let targetChapterTitle = "";

  if (dropTarget.type === "chapter-start") {
    const targetIndex = nextScenes.findIndex((scene) => scene.chapterId === dropTarget.chapterId);
    if (targetIndex === -1) {
      return null;
    }

    insertIndex = targetIndex;
    targetChapterId = nextScenes[targetIndex].chapterId;
    targetChapterTitle = nextScenes[targetIndex].chapterTitle;
  } else {
    const targetIndex = nextScenes.findIndex((scene) => scene.sceneId === dropTarget.sceneId);
    if (targetIndex === -1 || dropTarget.sceneId === sourceSceneId) {
      return null;
    }

    insertIndex = dropTarget.type === "before" ? targetIndex : targetIndex + 1;
    targetChapterId = nextScenes[targetIndex].chapterId;
    targetChapterTitle = nextScenes[targetIndex].chapterTitle;
  }

  movedScene.chapterId = targetChapterId;
  movedScene.chapterTitle = targetChapterTitle;
  nextScenes.splice(insertIndex, 0, movedScene);

  return nextScenes;
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

function moveBinderScene(sceneId, dropTarget) {
  if (typeof sceneId !== "string" || !sceneId.trim() || !dropTarget || !state.workspace?.project) {
    return false;
  }

  const sourceScene = getMovableSceneById(sceneId);
  if (!sourceScene) {
    return false;
  }

  if (!isPersistentScene(sourceScene)) {
    return moveDraftBinderScene(sceneId, dropTarget);
  }

  const orderedScenes = reorderSceneRecordsForDropTarget(
    (Array.isArray(state.scenes) ? state.scenes : []).filter((scene) => isMovableScene(scene)),
    sceneId,
    dropTarget,
  );
  if (!orderedScenes) {
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
    orderedScenes,
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

// Intent: persist an explicit binder order overlay so empty draft scenes can sit between canonical scenes.
function buildStructureDraftScenesFromOrderedScenes(orderedScenes) {
  const existingDraftsBySceneId = new Map(
    (Array.isArray(state.structureDrafts?.scenes) ? state.structureDrafts.scenes : [])
      .filter((scene) => scene && typeof scene === "object")
      .map((scene) => [String(scene.sceneId ?? ""), scene]),
  );

  return orderedScenes.map((scene, index) => {
    const existingDraft = existingDraftsBySceneId.get(scene.sceneId) ?? {};
    return {
      ...cloneValue(existingDraft),
      sceneId: scene.sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
      sceneTitle: scene.sceneTitle,
      sceneSynopsis: typeof scene.sceneSynopsis === "string" ? scene.sceneSynopsis : "",
      order: index + 1,
      initialText: typeof existingDraft.initialText === "string"
        ? existingDraft.initialText
        : isPersistentScene(scene)
          ? ""
          : String(scene.editorText ?? ""),
    };
  });
}

function syncStructureDraftsFromOrderedScenes(orderedScenes) {
  const movableScenes = Array.isArray(orderedScenes)
    ? orderedScenes.filter((scene) => isMovableScene(scene))
    : [];
  if (!movableScenes.length) {
    return false;
  }

  state.structureDrafts = {
    ...cloneValue(state.structureDrafts),
    sceneOrder: movableScenes.map((scene) => scene.sceneId),
    scenes: buildStructureDraftScenesFromOrderedScenes(movableScenes),
  };
  writeStoredJson(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  return true;
}

function moveDraftBinderScene(sceneId, dropTarget) {
  const orderedScenes = reorderSceneRecordsForDropTarget(
    (Array.isArray(state.scenes) ? state.scenes : []).filter((scene) => isMovableScene(scene)),
    sceneId,
    dropTarget,
  );
  if (!orderedScenes) {
    return false;
  }

  if (describeSceneGroups(state.scenes) === describeSceneGroups(orderedScenes)) {
    return false;
  }

  resetBinderSceneDragState();
  syncStructureDraftsFromOrderedScenes(orderedScenes);
  refreshScenes();
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
    state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobsMetadata(
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
  state.collapsedChapterIds = pruneCollapsedChapterIds(state.collapsedChapterIds, remainingChapterIds);
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
    selectTextareaEditorHostRange(resolveTextareaEditorHost(textarea), trimmedText.length, trimmedText.length, {
      focus: true,
      scroll: false,
    });
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
  state.workspace.narration.alignmentJobs = syncNarrationAlignmentJobsMetadata(
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
  if (Array.isArray(options.orderedScenes)) {
    syncStructureDraftsFromOrderedScenes(options.orderedScenes);
  } else {
    syncStructureDraftScenesFromSceneGroups(sceneGroups);
  }

  const existingChapterIds = new Set(
    [...rebuilt.sceneMetaBySceneId.values()].map((sceneMeta) => sceneMeta.chapterId),
  );
  state.collapsedChapterIds = pruneCollapsedChapterIds(state.collapsedChapterIds, existingChapterIds);
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
  const scene = getMovableSceneById(sceneId);
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




