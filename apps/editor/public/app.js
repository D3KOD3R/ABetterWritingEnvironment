import {
  EDITOR_DRAFTS_KEY,
  EDITOR_ACTIVE_PROJECT_ID_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_PROJECT_LIBRARY_KEY,
  EDITOR_SCRIVENER_IMPORT_PATH_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_WIDTH_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  buildSceneRecords,
  buildSceneLineMetrics,
  completeManuscriptTask,
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
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
  resolveManuscriptTaskRange,
  updateManuscriptTaskTitle,
  updatePassageNoteTitle,
} from "./editor-model.js";
import { escapeHtml, formatDisplayNumber } from "./shared/ui-utils.js";
import { renderWritingTargetCard, renderWritingTargetStrip } from "./features/progress-tracker.js";

const appRoot = document.querySelector("#app");
const EDITOR_COLLAPSED_CHAPTERS_KEY = "abe-collapsed-chapters-v1";
const EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY = "abe-console-collapsed-chapters-v1";
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
const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
const WRITING_TARGET_MAX_HISTORY_DAYS = 180;
const WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY = 12;
const WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES = 5;
const WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES = 240;
const WRITING_TARGET_MAX_SESSION_SAMPLES = 20;
const WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES = 5;
const WRITING_TARGET_GOAL_SYNC_SOURCES = ["releaseDate", "sessionTargetWords"];
const MIN_BINDER_PANEL_WIDTH = 220;
const MIN_CONSOLE_PANEL_WIDTH = 260;
const MIN_MANUSCRIPT_PANEL_WIDTH = 560;
const PANEL_RESIZER_WIDTH = 8;
const CONSOLE_DOCK_COLLAPSED_WIDTH = 52;
const BINDER_PANEL_COMPACT_THRESHOLD = 280;
const WRITING_TARGET_METRIC_KEYS = ["wordTarget", "sessionTarget", "forecast"];
const WRITING_TARGET_CADENCE_OPTIONS = [
  { value: "daily", label: "Daily target", unitLabel: "day", periodsPerWeek: 7 },
  { value: "weekly", label: "Weekly target", unitLabel: "week", periodsPerWeek: 1 },
];

const state = {
  shellReady: false,
  workspace: null,
  activeProjectId: null,
  projectLibrary: [],
  projectLibrarySelectionId: null,
  projectTitle: "",
  projectFileHandle: null,
  projectFilePath: "",
  projectFileStatus: "",
  projectFileBusy: false,
  projectIntegratorPath: "",
  projectIntegratorStatus: "",
  projectIntegratorBusy: false,
  fileMenuOpen: false,
  consoleDockCollapsed: false,
  binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
  consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
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
  sidePanelMode: "issues",
  selectedTaskId: null,
  selectedPassageNoteId: null,
  inlinePassageDraft: null,
  taskContextMenu: null,
  taskComposer: null,
  taskPreview: null,
  narrationTakeSelection: null,
  narrationTakeSession: null,
  editorPrefs: createDefaultEditorPrefs(),
  localAiPrefs: createDefaultLocalAiPrefs(),
  localAiTitleStatus: {},
  voiceNarration: loadVoiceNarrationState(),
  scenes: [],
  selectedSceneId: null,
  selectedBlockId: null,
  selectedIssueId: null,
  selectedNodeId: null,
  selectedEntityId: null,
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
let writingTargetSnapshotTimer = null;
let writingTargetWindowRefreshTimer = null;
let sessionTrackerRefreshTimer = null;
let writingTargetPointerDownStartedInsideWindow = false;
let narrationRecordingRuntime = null;
let voiceRecordingPreviewAudio = null;
let voiceRecordingPreviewUrl = null;

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

async function boot() {
  const seedLibrary = await loadInitialProjectLibrary();
  state.projectLibrary = seedLibrary.projects;
  state.activeProjectId = seedLibrary.activeProjectId ?? seedLibrary.projects[0]?.id ?? null;
  state.projectLibrarySelectionId = state.activeProjectId;
  state.projectFileHandle = null;
  state.projectFilePath = loadStoredString(EDITOR_PROJECT_FILE_PATH_KEY) ?? "";
  state.projectFileStatus = "";
  state.projectFileBusy = false;
  state.projectIntegratorPath = loadStoredString(EDITOR_SCRIVENER_IMPORT_PATH_KEY) ?? "";
  state.projectIntegratorStatus = "";
  state.consoleDockCollapsed = readStoredJson(EDITOR_RIGHT_DOCK_COLLAPSED_KEY) === true;
  state.binderPanelWidth = loadStoredNumber(EDITOR_BINDER_WIDTH_KEY, DEFAULT_BINDER_PANEL_WIDTH);
  state.consoleDockWidth = loadStoredNumber(EDITOR_CONSOLE_WIDTH_KEY, DEFAULT_CONSOLE_PANEL_WIDTH);
  applyProjectRecord(getActiveProjectRecord() ?? state.projectLibrary[0]);
  refreshScenes();

  state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
  state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
  state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;

  const initialBlockId =
    state.workspace.selectionDefaults.lineId ??
    state.scenes[0]?.blocks[0]?.blockId ??
    null;
  syncSelectionFromBlock(initialBlockId);
  syncWritingTargetState({ forceReload: true });

  render();
  syncLayoutWidths();
  recordWritingTargetSnapshot({ immediate: true, reason: "boot" });
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
  document.addEventListener("selectionchange", () => {
    if (state.activePane !== "narration" || state.narrationTakeSession?.status === "recording") {
      return;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLTextAreaElement) || !activeElement.classList.contains("editor-document-input")) {
      return;
    }

    updateNarrationTakeSelectionFromTextarea(activeElement);
  });
  window.addEventListener("resize", syncLayoutWidths);

  document.addEventListener("click", (event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (state.fileMenuOpen && !clickTarget?.closest("[data-file-menu]")) {
      hideFileMenu();
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
    if (clickTarget?.closest("[data-title-input]")) {
      hideTaskContextMenu();
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

    if (action !== "add-selection-task" && action !== "add-passage-note") {
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

    if (action === "import-scrivener-project") {
      hideFileMenu();
      importScrivenerProject();
      return;
    }

    if (action === "toggle-writing-target-window") {
      hideFileMenu();
      toggleWritingTargetWindow();
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

    if (action === "select-chapter") {
      hideFileMenu();
      const chapterScene = getScenesForChapter(target.dataset.chapterId)[0];
      if (chapterScene) {
        selectSceneById(chapterScene.sceneId);
      }
      return;
    }

    if (action === "select-scene") {
      hideFileMenu();
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

    if (action === "import-scrivener-project") {
      importScrivenerProject();
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
    const editorContext = getEditorContextFromEvent(event);
    if (!editorContext) {
      hideTaskSurfaces();
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

    if (editField === "project-integrator-path") {
      state.projectIntegratorPath = target.value;
      state.projectIntegratorStatus = "";
      writeStoredJsonRaw(EDITOR_SCRIVENER_IMPORT_PATH_KEY, target.value);
      persistCurrentProjectRecord();
      return;
    }

    if (editField === "project-file-path") {
      setProjectFilePath(target.value, null);
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

    if (!sceneId) {
      return;
    }

    if (editField === "scene-title") {
      updateSceneDraft(sceneId, (draft) => {
        draft.sceneTitle = target.value;
      });
      updateSceneTitleLabel(sceneId, target.value);
      updateFocusedLineCard();
      return;
    }

    if (editField === "editor-text") {
      clearTaskAnchorPreview({ restoreSelection: false });
      const previousText = getScene(sceneId)?.editorText ?? "";
      trackInlinePassageDraftTyping(sceneId, previousText, target);
      updateSceneDraft(sceneId, (draft) => {
        draft.editorText = target.value;
      });
      syncSceneDocumentLayout();
      centerEditorOnCaret(target);
      updateFocusedLineCard();
      updateInlinePassageDraftStatus(target.value);
    }
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

    const target = event.target instanceof Element
      ? event.target.closest("[data-task-preview-id]")
      : null;
    if (target && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      navigateTaskAnchor(target.dataset.taskPreviewId);
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
  renderWorldPanel();
  renderEntityPanel();
  renderDreamScapingPanel();
  renderTaskContextMenu();
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
    <div id="writing-target-slot"></div>
  `;
}

function renderTaskContextMenu() {
  const slot = document.querySelector("#task-menu-slot");
  if (!slot) {
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
      ${menu.hasExplicitSelection ? `
        <button class="task-menu-item" data-action="add-selection-task" role="menuitem">
          <span class="task-menu-icon" aria-hidden="true">+</span>
          <span>Add task</span>
        </button>
      ` : ""}
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="inspiration" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">i</span>
        <span>Add inspiration</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="research" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">r</span>
        <span>Add research</span>
      </button>
      <p>${escapeHtml(excerpt)}</p>
    </div>
  `;
}

function getPassageNotePlaceholder(noteType) {
  return noteType === "research"
    ? "Collect references, facts, and questions for this passage..."
    : "What are you trying to convey here?";
}

function getPassageNoteVerb(noteType) {
  return noteType === "research" ? "research" : "inspiration";
}

function renderHeader() {
  const workspace = state.workspace;
  const writingTargetSummary = buildWritingTargetSummary();
  document.querySelector("#hero-slot").innerHTML = `
    <header class="desktop-chrome">
      <div class="desktop-menubar">
        <div class="desktop-menu-cluster">
          <div class="file-menu ${state.fileMenuOpen ? "is-open" : ""}" data-file-menu>
            <button
              class="menu-button"
              type="button"
              data-action="toggle-file-menu"
              aria-expanded="${state.fileMenuOpen ? "true" : "false"}"
              aria-haspopup="menu"
            >File</button>
            ${state.fileMenuOpen ? renderFileMenu() : ""}
          </div>
          <div class="desktop-title-cluster">
            <span class="desktop-app-name">A Better Novel Authoring Environment</span>
            <input
              class="project-title-input desktop-project-title"
              type="text"
              value="${escapeHtml(state.projectTitle)}"
              data-edit-field="project-title"
              aria-label="Project title"
            />
          </div>
        </div>
        <div class="desktop-stat-strip" aria-label="Project statistics">
          ${renderStat("Lines", workspace.project.stats.lineCount)}
          ${renderStat("Words", getCurrentManuscriptWordCount())}
          ${renderStat("Issues", workspace.project.stats.issueCount)}
          ${renderStat("Events", workspace.project.stats.eventCount)}
          ${renderStat("Chars", workspace.project.stats.characterCount)}
          ${renderWritingTargetToggle(writingTargetSummary)}
        </div>
      </div>
      ${renderWritingTargetStrip(writingTargetSummary)}
      <div class="desktop-toolbar">
        <nav class="workspace-tabs" aria-label="Workspace panes">
          ${renderPaneTab("manuscript", "Manuscript", workspace.settings.executionMode)}
          ${renderPaneTab("world", "World", "Spines and templates")}
          ${renderPaneTab("narration", "Narration + Voice", "Whisper follow-track")}
        </nav>
        ${renderLocalAiSetting()}
      </div>
    </header>
  `;
}

function renderFileMenu() {
  const projects = state.projectLibrary.length
    ? state.projectLibrary
    : (state.workspace ? [createProjectLibraryRecordFromState()] : []);
  const selectedProjectId = state.projectLibrarySelectionId ?? state.activeProjectId ?? projects[0]?.id ?? "";
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
    ?? projects[0]
    ?? null;
  const activeProject = projects.find((project) => project.id === state.activeProjectId)
    ?? selectedProject;
  const status = activeProject
    ? `${projects.length} saved project${projects.length === 1 ? "" : "s"}`
    : "No saved projects yet";
  const manuscriptStats = activeProject?.workspace?.project?.stats ?? null;
  const worldStats = activeProject?.workspace?.world?.stats ?? null;
  const manuscriptStatus = manuscriptStats
    ? ` · ${manuscriptStats.chapterCount} chapters, ${manuscriptStats.sceneCount} scenes`
    : "";
  const templateStatus = worldStats
    ? ` · ${worldStats.templateCount} templates`
    : "";
  const importReport = activeProject?.importReport && typeof activeProject.importReport === "object"
    ? activeProject.importReport
    : null;
  const importedNoteCount = Number(importReport?.importedNotes ?? (Number(importReport?.importedResearchNotes ?? 0) + Number(importReport?.importedFrontMatterNotes ?? 0)));
  const importedAssetCount = Number(importReport?.importedAssetNotes ?? 0);
  const archivedCount = Number(importReport?.archivedItems ?? 0);
  const selectionStatus =
    selectedProject && activeProject && selectedProject.id !== activeProject.id
      ? ` · Selected: ${selectedProject.title}`
      : "";
  const importStatus = importReport
    ? ` · Import: ${importedNoteCount} notes${importedAssetCount ? `, ${importedAssetCount} assets` : ""}${archivedCount ? `, ${archivedCount} archived` : ""}`
    : "";
  const projectFileStatus = state.projectFilePath
    ? `Project file: ${state.projectFilePath}`
    : "No project file selected";
  const projectFileFeedback = state.projectFileStatus ? ` · ${state.projectFileStatus}` : "";
  const integratorStatus = state.projectIntegratorStatus
    ? ` · Integrator: ${state.projectIntegratorStatus}`
    : "";

  return `
    <div class="file-menu-panel" role="menu" aria-label="File menu">
      <div class="file-menu-section">
        <span class="file-menu-label">Project</span>
        <label class="project-library-select-shell compact">
          <span>Saved projects</span>
          <select data-project-library-select aria-label="Saved projects">
            ${projects.map((project) => `
              <option value="${escapeHtml(project.id)}" ${project.id === selectedProjectId ? "selected" : ""}>
                ${escapeHtml(formatProjectLibraryLabel(project))}
              </option>
            `).join("")}
          </select>
        </label>
        <div class="file-menu-actions">
          <button class="tag-button panel-action-button" type="button" data-action="load-project">Load project</button>
          <button class="tag-button panel-action-button" type="button" data-action="save-project">Save project</button>
          <button class="tag-button panel-action-button" type="button" data-action="create-project">Create project</button>
          <button class="tag-button panel-action-button" type="button" data-action="toggle-writing-target-window">
            Writing target
          </button>
        </div>
      </div>
      <div class="file-menu-section">
        <span class="file-menu-label">Project file</span>
        <label class="project-file-shell compact">
          <span>Save path</span>
          <input
            type="text"
            value="${escapeHtml(state.projectFilePath)}"
            data-edit-field="project-file-path"
            placeholder="${escapeHtml(getSuggestedProjectFilePath())}"
            aria-label="Project file path"
            spellcheck="false"
          />
        </label>
        <div class="file-menu-actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="save-project-file-as"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            ${state.projectFileBusy ? "Saving..." : "Save as file"}
          </button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="load-project-file"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            Load file
          </button>
        </div>
        <p class="project-file-status">
          ${escapeHtml(projectFileStatus)}${escapeHtml(projectFileFeedback)}
        </p>
      </div>
      <div class="file-menu-section">
        <span class="file-menu-label">Import</span>
        <label class="project-integrator-shell compact">
          <span>Scrivener project</span>
          <input
            type="text"
            value="${escapeHtml(state.projectIntegratorPath)}"
            data-edit-field="project-integrator-path"
            placeholder="C:\\Projects\\Novel.scriv or ...\\Project.scrivx"
            aria-label="Scrivener project path"
            spellcheck="false"
          />
        </label>
        <div class="file-menu-actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="import-scrivener-project"
            ${state.projectIntegratorBusy ? "disabled" : ""}
          >
            ${state.projectIntegratorBusy ? "Importing..." : "Import Scrivener"}
          </button>
        </div>
      </div>
      <p class="project-library-status">
        ${escapeHtml(status)}${activeProject ? ` · Active: ${activeProject.title}` : ""}${escapeHtml(manuscriptStatus)}${escapeHtml(templateStatus)}${escapeHtml(selectionStatus)}${escapeHtml(importStatus)}${escapeHtml(integratorStatus)}
      </p>
      <p class="file-menu-shortcuts" aria-label="Keyboard shortcuts">
        <span>Ctrl+S save</span>
        <span>Ctrl+Shift+S save as</span>
        <span>Ctrl+Shift+O load file</span>
        <span>Ctrl+N new</span>
        <span>Ctrl+O file</span>
        <span>Ctrl+Alt+T goals</span>
        <span>Ctrl+1-4 panes</span>
        <span>Esc close</span>
      </p>
    </div>
  `;
}

function formatProjectLibraryLabel(project) {
  return typeof project?.title === "string" && project.title.trim()
    ? project.title
    : "Untitled Project";
}

function renderLocalAiSetting() {
  const enabled = state.localAiPrefs.enabled;
  return `
    <label class="local-ai-setting">
      <input
        type="checkbox"
        data-local-ai-setting="enabled"
        ${enabled ? "checked" : ""}
      />
      <span>Local AI</span>
      <strong>${enabled ? "Titles on" : "Titles off"}</strong>
    </label>
  `;
}

function renderPaneTab(paneId, label, detail) {
  const isActive = state.activePane === paneId;
  return `
    <button
      class="workspace-tab ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-pane"
      data-pane-id="${escapeHtml(paneId)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(detail)}</strong>
    </button>
  `;
}

function renderStat(label, value) {
  return `
    <div class="chrome-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatDisplayNumber(value))}</strong>
    </div>
  `;
}

function renderWritingTargetToggle(summary) {
  const targetLabel = summary?.goalButtonLabel ?? "Writing Goals";

  return `
    <button
      class="chrome-stat chrome-target-toggle"
      type="button"
      data-action="toggle-writing-target-window"
      aria-pressed="${state.writingTargetWindowOpen ? "true" : "false"}"
      title="Open writing goals (Ctrl+Alt+T)"
      aria-label="Open writing goals"
    >
      <span class="chrome-target-icon" aria-hidden="true">◎</span>
      <span>Writing Goals</span>
      <strong>${escapeHtml(targetLabel)}</strong>
    </button>
  `;
}

function renderWritingTargetWindow() {
  const slot = document.querySelector("#writing-target-slot");
  if (!slot) {
    return;
  }

  if (!state.writingTargetWindowOpen) {
    slot.innerHTML = "";
    return;
  }

  const summary = buildWritingTargetSummary();
  if (!summary) {
    slot.innerHTML = "";
    return;
  }

  const dashboard = buildWritingTargetDashboardModel(summary);
  const selectedEntry = getWritingTargetSelectedEntryModel(summary, dashboard);
  const dashboardCards = buildWritingTargetDashboardCards(summary, dashboard);
  const calendarHeaderDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const renderCalendarDayCell = (day) => `
    <button
      class="writing-target-calendar-day ${day.status.key} ${day.isCurrentMonth ? "" : "is-outside-month"} ${day.isSelected ? "is-selected" : ""} ${day.isToday ? "is-today" : ""}"
      type="button"
      data-action="select-writing-target-day"
      data-date-key="${escapeHtml(day.dateKey)}"
      aria-pressed="${day.isSelected ? "true" : "false"}"
      aria-label="${escapeHtml(new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(day.date))}"
    >
      <span class="writing-target-calendar-day-head">
        <strong>${escapeHtml(String(day.dayNumber))}</strong>
        <span>${escapeHtml(day.status.label)}</span>
      </span>
      <span class="writing-target-calendar-day-count">${escapeHtml(day.entry ? `${formatDisplayNumber(day.wordGain)} words` : "No writing")}</span>
      <span class="writing-target-calendar-day-progress" aria-hidden="true">
        <span style="width:${Math.round(day.progressRatio * 100)}%;"></span>
      </span>
      <span class="writing-target-calendar-day-indicators" aria-hidden="true">
        <span class="is-task" title="Tasks completed">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✓</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(day.taskCount || 0))}</span>
        </span>
        <span class="is-inspiration" title="Inspirations logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✦</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.inspirationCount) || 0))))}</span>
        </span>
        <span class="is-issue" title="Issues logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">!</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.issueCount) || 0))))}</span>
        </span>
      </span>
    </button>
  `;
  const renderWeekDayCell = (day) => `
    <button
      class="writing-target-week-day ${day.status.key} ${day.isSelected ? "is-selected" : ""}"
      type="button"
      data-action="select-writing-target-day"
      data-date-key="${escapeHtml(day.dateKey)}"
      aria-pressed="${day.isSelected ? "true" : "false"}"
    >
      <span class="writing-target-week-day-name">${escapeHtml(new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.date))}</span>
      <strong>${escapeHtml(String(day.dayNumber))}</strong>
      <span>${escapeHtml(day.entry ? `${formatDisplayNumber(day.wordGain)} words` : "No writing")}</span>
      <span class="writing-target-calendar-day-progress" aria-hidden="true">
        <span style="width:${Math.round(day.progressRatio * 100)}%;"></span>
      </span>
      <span class="writing-target-calendar-day-indicators" aria-hidden="true">
        <span class="is-task" title="Tasks completed">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✓</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(day.taskCount || 0))}</span>
        </span>
        <span class="is-inspiration" title="Inspirations logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✦</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.inspirationCount) || 0))))}</span>
        </span>
        <span class="is-issue" title="Issues logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">!</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.issueCount) || 0))))}</span>
        </span>
      </span>
    </button>
  `;

  slot.innerHTML = `
    <section class="writing-target-window" role="dialog" aria-label="Writing goals">
      <header class="writing-target-window-header">
        <div class="writing-target-window-copy">
          <p class="writing-target-kicker">Writing Goals</p>
          <h2>Writing Goals</h2>
          <p class="writing-target-window-subtitle">Plan your pace. Track your progress. Finish strong.</p>
        </div>
        <div class="writing-target-dashboard-stats">
          ${dashboardCards.map((card) => renderWritingTargetCard(card, summary)).join("")}
        </div>
        <button
          class="writing-target-close"
          type="button"
          data-action="close-writing-target-window"
          aria-label="Close writing goals"
          title="Close"
        >
          ×
        </button>
      </header>
      <div class="writing-target-dashboard-body">
        <section class="writing-target-dashboard-settings" aria-label="Goal settings">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Goal settings</p>
              <h3>Goal settings</h3>
            </div>
          </div>
          <div class="writing-target-summary-grid">
            <label class="writing-target-field">
              <span>Word target</span>
              <input
                type="number"
                min="1000"
                step="1000"
                value="${escapeHtml(String(summary.targetWords))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="targetWords"
                aria-label="Manuscript target words"
              />
              <input
                class="writing-target-range"
                type="range"
                min="1000"
                max="500000"
                step="1000"
                value="${escapeHtml(String(summary.targetWords))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="targetWords"
                aria-label="Adjust manuscript target words"
              />
            </label>
            <label class="writing-target-field">
              <span>Release date</span>
              <input
                type="text"
                value="${escapeHtml(summary.record.releaseDate)}"
                placeholder="YYYY-MM-DD or DD/MM/YYYY"
                inputmode="numeric"
                data-edit-field="writing-target-field"
                data-writing-target-field="releaseDate"
                aria-label="Release date"
              />
              ${summary.releaseComparisonLabel ? `<small class="writing-target-hint">${escapeHtml(summary.releaseComparisonLabel)}</small>` : ""}
            </label>
            <div class="writing-target-row">
              <label class="writing-target-field">
                <span>Target cadence</span>
                <select
                  data-edit-field="writing-target-field"
                  data-writing-target-field="targetCadence"
                  aria-label="Target cadence"
                >
                  ${WRITING_TARGET_CADENCE_OPTIONS.map((option) => `
                    <option value="${escapeHtml(option.value)}" ${summary.record.targetCadence === option.value ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `).join("")}
                </select>
              </label>
              <label class="writing-target-field">
                <span>${escapeHtml(summary.goalTargetLabel)}</span>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value="${escapeHtml(String(summary.sessionTargetWords))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="sessionTargetWords"
                  aria-label="${escapeHtml(summary.goalTargetLabel)} words"
                />
              </label>
            </div>
            <div class="writing-target-help-card">
              <span>About daily target</span>
              <p>${escapeHtml(summary.goalSyncHint || "Adjust the daily goal to shape the pace of the release forecast.")}</p>
            </div>
            <div class="writing-target-row">
              <label class="writing-target-field">
                <span>Lookback days</span>
                <input
                  type="number"
                  min="2"
                  step="1"
                  max="180"
                  value="${escapeHtml(String(summary.lookbackDays))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="lookbackDays"
                  aria-label="Lookback days"
                />
              </label>
              <label class="writing-target-field">
                <span>Sessions per day</span>
                <input
                  type="number"
                  min="1"
                  max="${escapeHtml(String(WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY))}"
                  step="1"
                  value="${escapeHtml(String(summary.sessionsPerDay))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="sessionsPerDay"
                  aria-label="Sessions per day"
                />
              </label>
            </div>
            <label class="writing-target-field">
              <span>Idle timeout</span>
              <input
                type="number"
                min="${escapeHtml(String(WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES))}"
                max="${escapeHtml(String(WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES))}"
                step="1"
                value="${escapeHtml(String(summary.sessionTimeoutMinutes))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="sessionTimeoutMinutes"
                aria-label="Idle timeout minutes"
              />
            </label>
            <div class="writing-target-presets">
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="wordTarget"
                  ${summary.record.visibleMetrics.includes("wordTarget") ? "checked" : ""}
                />
                <span>Word Target</span>
              </label>
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="sessionTarget"
                  ${summary.record.visibleMetrics.includes("sessionTarget") ? "checked" : ""}
                />
                <span>${escapeHtml(summary.goalTargetLabel)}</span>
              </label>
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="forecast"
                  ${summary.record.visibleMetrics.includes("forecast") ? "checked" : ""}
                />
                <span>Days to release</span>
              </label>
            </div>
          </div>
        </section>
        <section class="writing-target-dashboard-calendar" aria-label="Calendar view">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Calendar view</p>
              <h3>${escapeHtml(dashboard.monthLabel)}</h3>
            </div>
            <div class="writing-target-calendar-toolbar">
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-prev-month" aria-label="Previous month">‹</button>
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-today">Today</button>
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-next-month" aria-label="Next month">›</button>
            </div>
          </div>
          <div class="writing-target-view-toggle" role="tablist" aria-label="Calendar view mode">
            ${[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "list", label: "List" },
            ].map((mode) => `
              <button
                class="writing-target-view-toggle-button ${dashboard.viewMode === mode.value ? "is-active" : ""}"
                type="button"
                data-action="writing-target-set-view-mode"
                data-view-mode="${escapeHtml(mode.value)}"
                aria-pressed="${dashboard.viewMode === mode.value ? "true" : "false"}"
              >
                ${escapeHtml(mode.label)}
              </button>
            `).join("")}
          </div>
          ${dashboard.viewMode === "week" ? `
            <div class="writing-target-week-grid">
              ${dashboard.weekDays.map((day) => renderWeekDayCell(day)).join("")}
            </div>
          ` : dashboard.viewMode === "list" ? `
            <div class="writing-target-calendar-list">
              ${dashboard.listEntries.length
                ? dashboard.listEntries.map((entry) => renderWritingTargetArchiveEntry(entry)).join("")
                : `<p class="writing-target-archive-empty">Your daily manuscript history will appear here after writing sessions are captured.</p>`}
            </div>
          ` : `
            <div class="writing-target-calendar-grid">
              ${calendarHeaderDays.map((day) => `<span class="writing-target-calendar-weekday">${escapeHtml(day)}</span>`).join("")}
              ${dashboard.days.map((day) => renderCalendarDayCell(day)).join("")}
            </div>
          `}
          <div class="writing-target-calendar-legend" aria-label="Calendar legend">
            <span class="is-on-target">On target</span>
            <span class="is-good">Good</span>
            <span class="is-below-target">Below target</span>
            <span class="is-low">Low</span>
            <span class="is-no-writing">No writing</span>
          </div>
        </section>
        <aside class="writing-target-dashboard-detail" aria-label="Selected day details">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Selected day</p>
              <h3>${escapeHtml(selectedEntry.dateLabel)}</h3>
            </div>
            <span class="writing-target-day-status is-${escapeHtml(selectedEntry.statusLabel.toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(selectedEntry.statusLabel)}</span>
          </div>
          <div class="writing-target-day-hero">
            <div class="writing-target-day-hero-value">
              ${escapeHtml(formatDisplayNumber(selectedEntry.wordCountValue ?? 0))}
              <span>words</span>
            </div>
            <div class="writing-target-day-hero-meta">
              <span class="writing-target-day-hero-delta">${escapeHtml(selectedEntry.progressLabel)} vs daily target</span>
              <span class="writing-target-day-hero-target">${escapeHtml(selectedEntry.dailyTargetLabel)}</span>
            </div>
          </div>
          <div class="writing-target-day-overview">
            <div>
              <span>Words</span>
              <strong>${escapeHtml(selectedEntry.wordCountLabel)}</strong>
            </div>
            <div>
              <span>Daily target</span>
              <strong>${escapeHtml(selectedEntry.dailyTargetLabel)}</strong>
            </div>
            <div>
              <span>Progress</span>
              <strong>${escapeHtml(selectedEntry.progressLabel)}</strong>
            </div>
          </div>
          <div class="writing-target-bar" aria-hidden="true">
            <span style="width:${escapeHtml(`${Math.round(selectedEntry.progressRatio * 100)}%`)}"></span>
          </div>
          <div class="writing-target-day-sections">
            <div>
              <span>Chapter</span>
              <strong>${escapeHtml(selectedEntry.chapterTitle)}</strong>
            </div>
            <div>
              <span>Scene</span>
              <strong>${escapeHtml(selectedEntry.sceneTitle)}</strong>
            </div>
            ${selectedEntry.passageExcerpt ? `
              <div class="writing-target-day-excerpt">
                <span>Passage</span>
                <p>${escapeHtml(selectedEntry.passageExcerpt)}</p>
              </div>
            ` : ""}
          </div>
          <div class="writing-target-day-points">
            <div class="writing-target-day-point">
              <span>Tasks</span>
              <strong>${escapeHtml(selectedEntry.tasksCountLabel)}</strong>
            </div>
            <div class="writing-target-day-point">
              <span>Inspiration</span>
              <strong>${escapeHtml(selectedEntry.inspirationCountLabel)}</strong>
            </div>
            <div class="writing-target-day-point">
              <span>Issues</span>
              <strong>${escapeHtml(selectedEntry.issueCountLabel)}</strong>
            </div>
          </div>
          <div class="writing-target-day-session-summary">
            <div>
              <span>Session pace</span>
              <strong>${escapeHtml(summary.sessionWordsPerHourLabel)}</strong>
            </div>
            <div>
              <span>Session status</span>
              <strong>${escapeHtml(summary.sessionMilestoneStatusText)}</strong>
            </div>
            <div>
              <span>Session elapsed</span>
              <strong>${escapeHtml(summary.sessionElapsedLabel)}</strong>
            </div>
          </div>
          <label class="writing-target-note-field">
            <span>Notes</span>
            <textarea
              rows="5"
              data-edit-field="writing-target-field"
              data-writing-target-field="dailyNote"
              data-date-key="${escapeHtml(dashboard.selectedDateKey)}"
              placeholder="Add a note for this day"
            >${escapeHtml(selectedEntry.noteText || "")}</textarea>
          </label>
        </aside>
      </div>
      <footer class="writing-target-footer">
        <button class="tag-button panel-action-button" type="button" data-action="reset-writing-target-goals">Reset to defaults</button>
        <div class="writing-target-footer-actions">
          <button class="tag-button panel-action-button" type="button" data-action="cancel-writing-target-goals">Cancel</button>
          <button class="tag-button panel-action-button is-primary" type="button" data-action="save-writing-target-goals">Save goals</button>
        </div>
      </footer>
    </section>
  `;
}

function syncWritingTargetWindowLiveState() {
  if (!state.writingTargetWindowOpen) {
    return;
  }

  const windowElement = document.querySelector("#writing-target-slot .writing-target-window");
  if (!(windowElement instanceof HTMLElement)) {
    return;
  }

  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    windowElement.contains(activeElement) &&
    (activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLSelectElement ||
      activeElement instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  renderWritingTargetWindow();
}

function syncSessionTrackerLiveState() {
  const strip = document.querySelector("#hero-slot .desktop-target-strip");
  if (!(strip instanceof HTMLElement)) {
    return;
  }

  const summary = buildWritingTargetSummary();
  if (!summary) {
    return;
  }

  strip.outerHTML = renderWritingTargetStrip(summary);
}

function startWritingTargetWindowRefreshTimer() {
  stopWritingTargetWindowRefreshTimer();
  if (!state.writingTargetWindowOpen) {
    return;
  }

  writingTargetWindowRefreshTimer = window.setInterval(() => {
    if (!state.writingTargetWindowOpen) {
      stopWritingTargetWindowRefreshTimer();
      return;
    }

    syncWritingTargetWindowLiveState();
  }, 15000);
  syncWritingTargetWindowLiveState();
}

function stopWritingTargetWindowRefreshTimer() {
  if (!writingTargetWindowRefreshTimer) {
    return;
  }

  window.clearInterval(writingTargetWindowRefreshTimer);
  writingTargetWindowRefreshTimer = null;
}

function startSessionTrackerRefreshTimer() {
  stopSessionTrackerRefreshTimer();

  sessionTrackerRefreshTimer = window.setInterval(() => {
    syncSessionTrackerLiveState();
  }, 15000);
  syncSessionTrackerLiveState();
}

function stopSessionTrackerRefreshTimer() {
  if (!sessionTrackerRefreshTimer) {
    return;
  }

  window.clearInterval(sessionTrackerRefreshTimer);
  sessionTrackerRefreshTimer = null;
}

function updateWritingTargetField(target) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const field = target.dataset.writingTargetField;
  if (!field) {
    return;
  }

  if (field === "visibleMetric") {
    toggleWritingTargetMetric(target.dataset.metricKey, target.checked);
    return;
  }

  const draft = beginWritingTargetDraft();
  if (!draft) {
    return;
  }

  const nextRecord = cloneValue(draft);
  if (field === "releaseDate") {
    nextRecord.releaseDate = String(target.value ?? "");
    nextRecord.goalSyncSource = "releaseDate";
  } else if (field === "targetWords") {
    nextRecord.targetWords = String(target.value ?? "");
  } else if (field === "sessionTargetWords") {
    nextRecord.sessionTargetWords = String(target.value ?? "");
    nextRecord.goalSyncSource = "sessionTargetWords";
  } else if (field === "targetCadence") {
    nextRecord.targetCadence = normalizeWritingTargetCadence(target.value);
  } else if (field === "lookbackDays") {
    nextRecord.lookbackDays = String(target.value ?? "");
  } else if (field === "sessionsPerDay") {
    nextRecord.sessionsPerDay = String(target.value ?? "");
  } else if (field === "sessionTimeoutMinutes") {
    nextRecord.sessionTimeoutMinutes = String(target.value ?? "");
  } else if (field === "dailyNote") {
    const dateKey = String(target.dataset.dateKey ?? "").trim();
    if (isWritingTargetDateKey(dateKey)) {
      const history = Array.isArray(nextRecord.history) ? [...nextRecord.history] : [];
      const entryIndex = history.findIndex((entry) => entry.date === dateKey);
      if (entryIndex >= 0) {
        history[entryIndex] = {
          ...cloneValue(history[entryIndex]),
          noteText: String(target.value ?? ""),
        };
        nextRecord.history = history;
      }
    }
  }

  state.writingTargetDraft = nextRecord;
  state.writingTargetDraftProjectId = state.workspace?.project?.id ?? null;
  syncWritingTargetCanonicalState(nextRecord);
  syncWritingTargetFieldControls(field, target);
  renderHeader();
}

function syncWritingTargetFieldControls(field, activeTarget) {
  if (typeof field !== "string" || !field) {
    return;
  }

  const slot = document.querySelector("#writing-target-slot");
  if (!(slot instanceof HTMLElement)) {
    return;
  }

  const controls = slot.querySelectorAll(`[data-writing-target-field="${field}"]`);
  for (const control of controls) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
      continue;
    }

    if (control === activeTarget) {
      continue;
    }

    if (activeTarget instanceof HTMLInputElement && activeTarget.type === "checkbox") {
      continue;
    }

    control.value = String(activeTarget.value ?? "");
  }
}

function toggleWritingTargetMetric(metricKey, enabled) {
  if (typeof metricKey !== "string" || !metricKey.trim()) {
    return;
  }

  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return;
  }

  const nextMetrics = new Set(record.visibleMetrics ?? WRITING_TARGET_METRIC_KEYS);
  if (enabled) {
    nextMetrics.add(metricKey);
  } else {
    nextMetrics.delete(metricKey);
  }

  const nextRecord = {
    ...cloneValue(record),
    visibleMetrics: [...nextMetrics].filter((key) => WRITING_TARGET_METRIC_KEYS.includes(key)),
  };

  if (!nextRecord.visibleMetrics.length) {
    nextRecord.visibleMetrics = [...WRITING_TARGET_METRIC_KEYS];
  }

  const draft = beginWritingTargetDraft();
  if (!draft) {
    return;
  }

  state.writingTargetDraft = {
    ...cloneValue(draft),
    visibleMetrics: [...nextRecord.visibleMetrics],
  };
  state.writingTargetDraftProjectId = state.workspace?.project?.id ?? null;
  syncWritingTargetCanonicalState(state.writingTargetDraft);
  renderHeader();
  renderWritingTargetWindow();
}

function syncWritingTargetState(options = {}) {
  const projectId = state.workspace?.project?.id;
  if (!projectId) {
    return null;
  }

  if (
    !options.forceReload &&
    state.writingTargetState &&
    state.writingTargetProjectId === projectId
  ) {
    return state.writingTargetState;
  }

  const currentWordCount = getCurrentManuscriptWordCount();
  state.writingTargetState = loadWritingTargetState(projectId, currentWordCount);
  state.writingTargetProjectId = projectId;
  return state.writingTargetState;
}

function syncWritingTargetPersistedState(options = {}) {
  const projectId = state.workspace?.project?.id;
  if (!projectId) {
    return null;
  }

  if (
    !options.forceReload &&
    state.writingTargetState &&
    state.writingTargetProjectId === projectId
  ) {
    return state.writingTargetState;
  }

  const currentWordCount = getCurrentManuscriptWordCount();
  state.writingTargetState = loadWritingTargetState(projectId, currentWordCount);
  state.writingTargetProjectId = projectId;
  return state.writingTargetState;
}

function getWritingTargetWorkingRecord() {
  const projectId = state.workspace?.project?.id;
  if (
    projectId &&
    state.writingTargetDraft &&
    state.writingTargetDraftProjectId === projectId
  ) {
    return state.writingTargetDraft;
  }

  return syncWritingTargetState({ forceReload: false });
}

function beginWritingTargetDraft() {
  const projectId = state.workspace?.project?.id;
  if (!projectId) {
    return null;
  }

  if (
    state.writingTargetDraft &&
    state.writingTargetDraftProjectId === projectId
  ) {
    return state.writingTargetDraft;
  }

  const record = syncWritingTargetState({ forceReload: false });
  if (!record) {
    return null;
  }

  state.writingTargetDraftBaseline = cloneValue(record);
  state.writingTargetDraftProjectId = projectId;
  state.writingTargetDraft = cloneValue(record);
  return state.writingTargetDraft;
}

function clearWritingTargetDraft() {
  state.writingTargetDraft = null;
  state.writingTargetDraftProjectId = null;
  state.writingTargetDraftBaseline = null;
}

function commitWritingTargetDraft() {
  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return null;
  }

  const persisted = persistWritingTargetState(record);
  state.writingTargetState = persisted;
  clearWritingTargetDraft();
  persistCurrentProjectRecord();
  return persisted;
}

function loadWritingTargetState(projectId, currentWordCount, now = new Date()) {
  const store = readWritingTargetStore();
  const projectRecord = getProjectRecordById(projectId);
  const candidate = projectRecord?.projectSettings?.writingTargetState ?? store[projectId];
  const normalized = normalizeWritingTargetRecord(candidate, currentWordCount, now);
  store[projectId] = normalized;
  writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, store);
  return cloneValue(normalized);
}

function persistWritingTargetState(record) {
  const projectId = state.workspace?.project?.id;
  if (!projectId) {
    return null;
  }

  const normalized = normalizeWritingTargetRecord(
    record,
    getCurrentManuscriptWordCount(),
    new Date(),
  );
  const store = readWritingTargetStore();
  store[projectId] = normalized;
  writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, store);
  return cloneValue(normalized);
}

function syncWritingTargetCanonicalState(record) {
  if (!record) {
    return null;
  }

  const persisted = persistWritingTargetState(record);
  if (!persisted) {
    return null;
  }

  state.writingTargetState = persisted;
  persistCurrentProjectRecord();
  return persisted;
}

function recordWritingTargetSnapshot(options = {}) {
  if (writingTargetSnapshotTimer) {
    window.clearTimeout(writingTargetSnapshotTimer);
    writingTargetSnapshotTimer = null;
  }

  if (!state.workspace?.project?.id) {
    return;
  }

  const capture = () => {
    const projectId = state.workspace?.project?.id;
    if (!projectId) {
      return;
    }

    const currentWordCount = getCurrentManuscriptWordCount();
    const record = getWritingTargetWorkingRecord();
    if (!record) {
      return;
    }

    const now = new Date();
    const dateKey = getLocalDateKey(now);
    const nextRecord = cloneValue(record);
    const history = Array.isArray(nextRecord.history) ? [...nextRecord.history] : [];
    const sessionSamples = normalizeWritingTargetSessionSamples(nextRecord.sessionSamples ?? []);
    const previousDailyBaselineDateKey = typeof nextRecord.dailyBaselineDateKey === "string"
      ? nextRecord.dailyBaselineDateKey.trim()
      : "";
    const currentEntry = history.find((entry) => entry.date === dateKey);
    const previousEntry = [...history]
      .filter((entry) => entry.date < dateKey)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1) ?? null;
    const context = getWritingTargetSnapshotContext();
    const nextHistoryEntry = createWritingTargetHistoryEntry(currentWordCount, now, {
      previousEntry,
      context,
    });

    if (currentEntry) {
      history[history.findIndex((entry) => entry.date === dateKey)] = nextHistoryEntry;
    } else {
      history.push(nextHistoryEntry);
    }

    nextRecord.history = trimWritingTargetHistory(history, nextRecord.lookbackDays);
    if (previousDailyBaselineDateKey !== dateKey) {
      nextRecord.dailyBaselineDateKey = dateKey;
      nextRecord.dailyBaselineWordCount = getWritingTargetDailyBaselineWordCount(nextRecord, currentWordCount, now);
    } else if (!Number.isFinite(Number(nextRecord.dailyBaselineWordCount))) {
      nextRecord.dailyBaselineWordCount = getWritingTargetDailyBaselineWordCount(nextRecord, currentWordCount, now);
    }
    nextRecord.sessionSamples = [
      ...sessionSamples,
      createWritingTargetSessionSample(currentWordCount, now),
    ].slice(-WRITING_TARGET_MAX_SESSION_SAMPLES);
    nextRecord.sessionLastActiveAt = now.toISOString();
    nextRecord.updatedAt = now.toISOString();
    state.writingTargetState = persistWritingTargetState(nextRecord);
    persistCurrentProjectRecord();
    if (
      state.writingTargetDraft &&
      state.writingTargetDraftProjectId === projectId
    ) {
      state.writingTargetDraft = {
        ...cloneValue(state.writingTargetDraft),
        history: cloneValue(nextRecord.history),
        dailyBaselineDateKey: nextRecord.dailyBaselineDateKey,
        dailyBaselineWordCount: nextRecord.dailyBaselineWordCount,
        sessionSamples: cloneValue(nextRecord.sessionSamples),
        sessionLastActiveAt: nextRecord.sessionLastActiveAt,
        updatedAt: nextRecord.updatedAt,
      };
    }

    if (state.writingTargetWindowOpen) {
      renderWritingTargetWindow();
    }
    renderHeader();
  };

  if (options.immediate) {
    capture();
    return;
  }

  writingTargetSnapshotTimer = window.setTimeout(capture, 750);
}

function queueWritingTargetSnapshot() {
  recordWritingTargetSnapshot();
}

function clearWritingTargetSnapshotTimer() {
  if (!writingTargetSnapshotTimer) {
    return;
  }

  window.clearTimeout(writingTargetSnapshotTimer);
  writingTargetSnapshotTimer = null;
}

function buildWritingTargetSummary() {
  return buildWritingTargetSummaryForRecord(getWritingTargetWorkingRecord());
}

function buildWritingTargetSummaryForRecord(record) {
  if (!record) {
    return null;
  }

  const currentWordCount = getCurrentManuscriptWordCount();
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const workingRecord = cloneValue(record);
  const syncedRecord = syncWritingTargetGoalFields(cloneValue(record), currentWordCount, now);
  const pace = estimateWritingPace(syncedRecord, now);
  const releaseDate = parseLocalDateKey(syncedRecord.releaseDate);
  const targetWords = clampPositiveNumber(syncedRecord.targetWords, DEFAULT_WRITING_TARGET_WORDS);
  const sessionTargetWords = clampPositiveNumber(syncedRecord.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  const sessionsPerDay = clampPositiveNumber(
    syncedRecord.sessionsPerDay,
    DEFAULT_SESSION_TARGETS_PER_DAY,
    1,
    WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  );
  const sessionTimeoutMinutes = clampPositiveNumber(
    syncedRecord.sessionTimeoutMinutes,
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  );
  const targetCadence = normalizeWritingTargetCadence(syncedRecord.targetCadence);
  const cadenceMeta = getWritingTargetCadenceMeta(targetCadence);
  const cadenceDays = getWritingTargetCadenceDays(targetCadence);
  const lookbackDays = clampPositiveNumber(
    syncedRecord.lookbackDays,
    DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
    2,
    WRITING_TARGET_MAX_HISTORY_DAYS,
  );
  const sessionWords = Math.max(0, currentWordCount - syncedRecord.sessionBaselineWordCount);
  const storedDailyBaselineDateKey = typeof syncedRecord.dailyBaselineDateKey === "string"
    ? syncedRecord.dailyBaselineDateKey.trim()
    : "";
  const dailyBaselineWordCount =
    storedDailyBaselineDateKey === todayKey && Number.isFinite(Number(syncedRecord.dailyBaselineWordCount))
      ? Math.max(0, Math.round(Number(syncedRecord.dailyBaselineWordCount)))
      : getWritingTargetDailyBaselineWordCount(syncedRecord, currentWordCount, now);
  const dailyWords = currentWordCount - dailyBaselineWordCount;
  const remainingWords = Math.max(0, targetWords - currentWordCount);
  const targetWordsPerDay = cadenceDays > 0 ? sessionTargetWords / cadenceDays : 0;
  const sessionTargetWordsPerSession = sessionsPerDay > 0 ? sessionTargetWords / sessionsPerDay : sessionTargetWords;
  const currentSessionIndex = sessionTargetWordsPerSession > 0
    ? Math.min(sessionsPerDay, Math.max(1, Math.floor(sessionWords / sessionTargetWordsPerSession) + 1))
    : 1;
  const currentSessionWords = sessionTargetWordsPerSession > 0
    ? Math.max(0, sessionWords - ((currentSessionIndex - 1) * sessionTargetWordsPerSession))
    : sessionWords;
  const sessionProgress = sessionTargetWordsPerSession > 0
    ? Math.max(0, Math.min(1, currentSessionWords / sessionTargetWordsPerSession))
    : 0;
  const sessionStartedAt = typeof syncedRecord.sessionStartedAt === "string" && syncedRecord.sessionStartedAt.trim()
    ? new Date(syncedRecord.sessionStartedAt)
    : null;
  const recentSessionWordsPerMinute = estimateRecentSessionWordsPerMinute(syncedRecord, now);
  const sessionElapsedMinutes = sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())
    ? Math.max(1 / 60, (now.getTime() - sessionStartedAt.getTime()) / 60000)
    : null;
  const sessionWordsPerMinute = recentSessionWordsPerMinute != null
    ? recentSessionWordsPerMinute
    : sessionElapsedMinutes != null
      ? sessionWords / sessionElapsedMinutes
      : 0;
  const sessionWordsPerHour = sessionWordsPerMinute * 60;
  const sessionRequiredWordsPerMinute = sessionTimeoutMinutes > 0
    ? sessionTargetWordsPerSession / sessionTimeoutMinutes
    : 0;
  const sessionWordsPerMinuteRatio = sessionRequiredWordsPerMinute > 0
    ? sessionWordsPerMinute / sessionRequiredWordsPerMinute
    : 0;
  const sessionWordsPerMinuteOverTarget = sessionRequiredWordsPerMinute > 0
    && sessionWordsPerMinute > sessionRequiredWordsPerMinute;
  const sessionWordsPerMinuteBarColor = buildSessionPaceColor(sessionWordsPerMinuteRatio);
  const sessionTargetWordsRemaining = Math.max(0, sessionTargetWordsPerSession - currentSessionWords);
  const sessionProjectedMilestoneMinutes = sessionWordsPerMinute > 0
    ? sessionTargetWordsRemaining / sessionWordsPerMinute
    : null;
  const sessionProjectedMilestoneLabel =
    sessionTargetWordsRemaining <= 0
      ? "Milestone reached"
      : sessionProjectedMilestoneMinutes != null
        ? `${formatDurationMinutes(sessionProjectedMilestoneMinutes)} to milestone`
        : "Need more pace";
  const sessionMilestoneStatusText =
    sessionTargetWordsRemaining <= 0
      ? "Milestone reached"
      : sessionProjectedMilestoneMinutes != null && sessionProjectedMilestoneMinutes <= sessionTimeoutMinutes
        ? "On track"
        : sessionProjectedMilestoneMinutes != null
          ? "Off track"
          : "Need more pace";
  const sessionWordsPerMinuteLabel = `${formatDisplayNumber(Math.round(sessionWordsPerMinute))}/min`;
  const sessionRequiredWordsPerMinuteLabel = `${formatDisplayNumber(Math.round(sessionRequiredWordsPerMinute))}/min`;
  const sessionWordsPerMinuteSummaryText = sessionTargetWordsRemaining <= 0
    ? "Milestone reached"
    : `${sessionWordsPerMinuteLabel} now · ${sessionRequiredWordsPerMinuteLabel} needed`;
  const sessionWordsPerMinuteStatusText = sessionWordsPerMinuteOverTarget
    ? "Ahead of pace"
    : sessionWordsPerMinuteRatio >= 0.95
      ? "On track"
      : "Off track";
  const sessionPaceSummaryText = `${formatDisplayNumber(Math.round(sessionWordsPerHour))}/h · ${sessionProjectedMilestoneLabel}`;
  const sessionPaceRatio = Math.max(0, sessionWordsPerMinuteRatio);
  const sessionPacePercentLabel = `${formatDisplayNumber(Math.round(sessionPaceRatio * 100))}%`;
  const sessionCurrentTimeLabel = formatClockTimeLabel(now);
  const sessionStartTimeLabel = formatClockTimeLabel(sessionStartedAt ?? now);
  const sessionMinutesLapsed = sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - sessionStartedAt.getTime()) / 60000))
    : 0;
  const sessionMinutesLapsedLabel = formatDisplayNumber(sessionMinutesLapsed);
  const sessionElapsedLabel = sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())
    ? formatSessionElapsedLabel((now.getTime() - sessionStartedAt.getTime()) / 60000, sessionTimeoutMinutes)
    : formatSessionElapsedLabel(0, sessionTimeoutMinutes);
  const sessionLastActiveAt = typeof syncedRecord.sessionLastActiveAt === "string" && syncedRecord.sessionLastActiveAt.trim()
    ? new Date(syncedRecord.sessionLastActiveAt)
    : null;
  const sessionLastActiveMinutes = sessionLastActiveAt && !Number.isNaN(sessionLastActiveAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - sessionLastActiveAt.getTime()) / 60000))
    : null;
  const sessionIsConcluded =
    sessionLastActiveMinutes != null && sessionLastActiveMinutes >= sessionTimeoutMinutes;
  const sessionStatusText = sessionLastActiveMinutes == null
    ? "Session baseline set"
    : sessionIsConcluded
      ? `Concluded · idle ${formatMinuteCount(sessionLastActiveMinutes)}`
      : `Active · idle ${formatMinuteCount(sessionLastActiveMinutes)}`;
  const effectiveWordsPerDay = Math.max(0, pace.wordsPerDay || 0);
  const projectedDaysToTarget = effectiveWordsPerDay > 0 ? remainingWords / effectiveWordsPerDay : null;
  const projectedCompletionDate = projectedDaysToTarget != null ? addDays(now, projectedDaysToTarget) : null;
  const daysUntilRelease = releaseDate ? getWritingTargetDaysUntilDate(releaseDate, now) : null;
  const requiredDailyWords =
    releaseDate && daysUntilRelease != null && daysUntilRelease > 0
      ? Math.max(0, Math.ceil(remainingWords / daysUntilRelease))
      : null;
  const projectedReleaseGap = releaseDate && projectedCompletionDate
    ? Math.ceil((startOfLocalDay(projectedCompletionDate).getTime() - startOfLocalDay(releaseDate).getTime()) / 86400000)
    : null;
  const releaseTrackStatus = releaseDate
    ? projectedReleaseGap == null
      ? "Need more writing history"
      : projectedReleaseGap <= 0
        ? "On track"
        : `Off track by ${formatDayCount(projectedReleaseGap)}`
    : `Track ${lookbackDays} days`;
  const visibleMetrics = (Array.isArray(syncedRecord.visibleMetrics) ? syncedRecord.visibleMetrics : WRITING_TARGET_METRIC_KEYS)
    .filter((metricKey) => WRITING_TARGET_METRIC_KEYS.includes(metricKey))
    .map((metricKey) => buildWritingTargetMetric(metricKey, {
      record: syncedRecord,
      currentWordCount,
      sessionWords,
      dailyWords,
      sessionsPerDay,
      sessionTargetWordsPerSession,
      currentSessionIndex,
      currentSessionWords,
      sessionProgress,
      sessionTimeoutMinutes,
      sessionStatusText,
      pace,
      targetCadence,
      cadenceMeta,
      targetWordsPerDay,
      effectiveWordsPerDay,
      remainingWords,
      projectedDaysToTarget,
      projectedCompletionDate,
      releaseDate,
      daysUntilRelease,
      requiredDailyWords,
      projectedReleaseGap,
      releaseTrackStatus,
      now,
    }));
  const archiveEntries = buildWritingTargetArchiveEntries(syncedRecord, now);

  const averageWordsPerDayText = pace.wordsPerDay > 0
    ? `${formatDisplayNumber(Math.round(pace.wordsPerDay))}/day`
    : `Need ${lookbackDays} days`;
  const forecastText = releaseDate
    ? projectedDaysToTarget != null
      ? `${formatDayCount(projectedDaysToTarget)} · ${releaseTrackStatus}`
      : releaseTrackStatus
    : projectedCompletionDate
      ? `ETA ${formatDateLabel(projectedCompletionDate)}`
      : `Track ${lookbackDays} days`;
  const releaseComparisonLabel = releaseDate
    ? `${formatGoalDateLabel(releaseDate)} → ${projectedCompletionDate ? formatGoalDateLabel(projectedCompletionDate) : "—"}`
    : "";
  const goalSyncSource = getWritingTargetGoalSyncSource(syncedRecord);
  const goalSyncHint = goalSyncSource === "releaseDate"
    ? "Release date recalculates the target pace."
    : "Target pace recalculates the release date.";
  const streakSummary = buildWritingTargetStreakSummary(syncedRecord.history);

  return {
    record: workingRecord,
    syncedRecord,
    currentWordCount,
    targetWords,
    sessionWords,
    dailyWords,
    sessionsPerDay,
    sessionTargetWords,
    sessionTargetWordsPerSession,
    currentSessionIndex,
    currentSessionWords,
    sessionProgress,
    sessionStatusText,
    sessionTimeoutMinutes,
    lookbackDays,
    sessionWordsPerHour,
    sessionWordsPerHourLabel: `${formatDisplayNumber(Math.round(sessionWordsPerHour))}/h`,
    sessionWordsPerMinute,
    sessionWordsPerMinuteLabel,
    sessionRequiredWordsPerMinute,
    sessionRequiredWordsPerMinuteLabel,
    sessionWordsPerMinuteRatio,
    sessionWordsPerMinuteOverTarget,
    sessionWordsPerMinuteBarColor,
    sessionPaceRatio,
    sessionPacePercentLabel,
    sessionTargetWordsRemaining,
    sessionProjectedMilestoneMinutes,
    sessionProjectedMilestoneLabel,
    sessionMilestoneStatusText,
    sessionPaceSummaryText,
    sessionWordsPerMinuteSummaryText,
    sessionWordsPerMinuteStatusText,
    targetCadence,
    targetCadenceLabel: cadenceMeta.label,
    targetWordsPerDay,
    effectiveWordsPerDay,
    releaseDate,
    daysUntilRelease,
    requiredDailyWords,
    averageWordsPerDayText,
    forecastText,
    releaseComparisonLabel,
    goalSyncSource,
    goalSyncHint,
    streakCurrentDays: streakSummary.current,
    streakBestDays: streakSummary.best,
    streakLabel: streakSummary.current > 0 ? `${formatDisplayNumber(streakSummary.current)} days` : "No streak yet",
    sessionAgeLabel: formatSessionAge(syncedRecord.sessionStartedAt, now),
    sessionCurrentTimeLabel,
    sessionStartTimeLabel,
    sessionMinutesLapsed,
    sessionMinutesLapsedLabel,
    sessionElapsedLabel,
    visibleMetrics,
    projectedDaysToTarget,
    projectedCompletionDate,
    projectedReleaseGap,
    releaseTrackStatus,
    archiveEntries,
    targetWordsLabel: compactWordCount(targetWords),
    goalButtonLabel: `${cadenceMeta.label} ${compactWordCount(sessionTargetWords)}`,
    goalTargetLabel: cadenceMeta.label,
    sessionTargetWordsLabel: compactWordCount(sessionTargetWordsPerSession),
  };
}

function buildWritingTargetMetric(metricKey, context) {
  const {
    record,
    currentWordCount,
    sessionWords,
    dailyWords,
    sessionsPerDay,
    sessionTargetWordsPerSession,
    currentSessionIndex,
    currentSessionWords,
    sessionProgress,
    sessionStatusText,
    pace,
    targetCadence,
    cadenceMeta,
    targetWordsPerDay,
    effectiveWordsPerDay,
    remainingWords,
    projectedDaysToTarget,
    projectedCompletionDate,
    releaseDate,
    daysUntilRelease,
    requiredDailyWords,
    projectedReleaseGap,
    releaseTrackStatus,
    now,
  } = context;
  const targetWords = clampPositiveNumber(record.targetWords, DEFAULT_WRITING_TARGET_WORDS);
  const sessionTargetWords = clampPositiveNumber(record.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  const lookbackDays = clampPositiveNumber(
    record.lookbackDays,
    DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
    2,
    WRITING_TARGET_MAX_HISTORY_DAYS,
  );

  if (metricKey === "wordTarget") {
    return {
      label: "Word Target",
      value: formatDisplayNumber(currentWordCount),
      leftLabel: formatDisplayNumber(currentWordCount),
      rightLabel: formatDisplayNumber(targetWords),
      progress: targetWords > 0 ? Math.min(1, currentWordCount / targetWords) : 0,
      note: remainingWords > 0
        ? `${formatDisplayNumber(remainingWords)} remaining`
        : "Target reached",
    };
  }

  if (metricKey === "sessionTarget") {
    return {
      label: cadenceMeta?.label ?? "Daily target",
      value: formatDisplayNumber(dailyWords),
      leftLabel: formatDisplayNumber(dailyWords),
      rightLabel: `${formatDisplayNumber(sessionTargetWords)} / ${cadenceMeta?.unitLabel ?? "day"}`,
      progress: sessionTargetWords > 0 ? Math.min(1, Math.max(0, dailyWords) / sessionTargetWords) : 0,
      note: `${formatDisplayNumber(Math.max(0, Math.round(targetWordsPerDay || 0)))} / day equivalent`,
    };
  }

  if (metricKey === "sessionTracker") {
    return {
      label: "Session tracker",
      value: `Session ${currentSessionIndex} of ${sessionsPerDay}`,
      leftLabel: formatDisplayNumber(currentSessionWords),
      rightLabel: formatDisplayNumber(sessionTargetWordsPerSession),
      progress: sessionProgress,
      note: sessionStatusText,
    };
  }

  if (releaseDate) {
    return {
      label: "Days to release",
      value: projectedDaysToTarget != null ? formatDayCount(projectedDaysToTarget) : "—",
      leftLabel: formatGoalDateLabel(releaseDate),
      rightLabel: projectedCompletionDate ? formatGoalDateLabel(projectedCompletionDate) : "—",
      comparison: true,
      progress: releaseDate && requiredDailyWords > 0
        ? Math.min(1, (effectiveWordsPerDay || 0) / requiredDailyWords)
        : targetWords > 0
          ? Math.min(1, currentWordCount / targetWords)
          : 0,
      note: releaseTrackStatus || (requiredDailyWords != null
        ? `${formatDisplayNumber(requiredDailyWords)}/day to hit release`
        : "Release date selected"),
    };
  }

  const averageLabel = pace.wordsPerDay > 0
    ? `${formatDisplayNumber(Math.round(pace.wordsPerDay))}/day`
    : "No pace yet";
  const completionLabel = projectedCompletionDate
    ? formatDateLabel(projectedCompletionDate)
    : `Track ${lookbackDays} days`;

  return {
    label: "Days to release",
    value: projectedDaysToTarget != null ? formatDayCount(projectedDaysToTarget) : "—",
    leftLabel: averageLabel,
    rightLabel: completionLabel,
    progress: targetWords > 0 ? Math.min(1, currentWordCount / targetWords) : 0,
    note: projectedCompletionDate
      ? releaseTrackStatus || "Projected"
      : `Based on ${lookbackDays}-day average`,
  };
}

function buildWritingTargetArchiveEntries(record, now = new Date()) {
  const history = Array.isArray(record?.history) ? [...record.history] : [];
  const sorted = history
    .filter((entry) => entry && typeof entry === "object" && typeof entry.date === "string")
    .sort((a, b) => a.date.localeCompare(b.date))
    .reverse();

  return sorted.map((entry, index) => {
    const previous = sorted[index + 1] ?? null;
    const wordDelta = Number.isFinite(Number(entry.wordDelta))
      ? Math.round(Number(entry.wordDelta))
      : previous
        ? Math.round(Number(entry.wordCount) - Number(previous.wordCount))
        : Math.round(Number(entry.wordCount) || 0);
    const date = parseLocalDateKey(entry.date) ?? now;
    const capturedDate = typeof entry.capturedAt === "string" ? new Date(entry.capturedAt) : null;
    const capturedLabel = capturedDate && !Number.isNaN(capturedDate.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(capturedDate)
      : "";
    return {
      dateLabel: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(date),
      dateKey: entry.date,
      capturedLabel,
      wordCountLabel: formatDisplayNumber(entry.wordCount),
      wordDeltaLabel: `${wordDelta >= 0 ? "+" : ""}${formatDisplayNumber(wordDelta)} words`,
      chapterTitle: entry.chapterTitle || "Unknown chapter",
      sceneTitle: entry.sceneTitle || "Unknown scene",
      passageExcerpt: entry.passageExcerpt || "",
      issueCountLabel: `${formatDisplayNumber(Math.max(0, Math.round(Number(entry.issueCount) || 0)))} issues`,
      inspirationCountLabel: `${formatDisplayNumber(Math.max(0, Math.round(Number(entry.inspirationCount) || 0)))} inspiration${Math.max(0, Math.round(Number(entry.inspirationCount) || 0)) === 1 ? "" : "s"}`,
      noteText: typeof entry.noteText === "string" ? entry.noteText : "",
    };
  });
}

function renderWritingTargetArchiveEntry(entry) {
  return `
    <article class="writing-target-archive-item">
      <div class="writing-target-archive-top">
        <div>
          <strong>${escapeHtml(entry.dateLabel)}</strong>
          ${entry.capturedLabel ? `<span>${escapeHtml(entry.capturedLabel)}</span>` : ""}
        </div>
        <strong>${escapeHtml(entry.wordDeltaLabel)}</strong>
      </div>
      <div class="writing-target-archive-body">
        <span class="writing-target-archive-chapter">${escapeHtml(entry.chapterTitle)}</span>
        <strong>${escapeHtml(entry.sceneTitle)}</strong>
        ${entry.passageExcerpt ? `<span class="writing-target-archive-excerpt">${escapeHtml(entry.passageExcerpt)}</span>` : ""}
        <span>${escapeHtml(entry.wordCountLabel)} total</span>
      </div>
      <div class="writing-target-archive-meta">
        <span>${escapeHtml(entry.issueCountLabel)}</span>
        <span>${escapeHtml(entry.inspirationCountLabel)}</span>
      </div>
    </article>
  `;
}

function buildWritingTargetStreakSummary(history) {
  const entries = getWritingTargetHistoryEntries({ history });
  if (!entries.length) {
    return { current: 0, best: 0 };
  }

  let best = 0;
  let run = 0;
  let previousDate = null;
  for (const entry of entries) {
    const entryDate = parseLocalDateKey(entry.date);
    const hasWriting = Math.max(0, Math.round(Number(entry.wordDelta) || 0)) > 0;
    const isConsecutive = !previousDate
      || (entryDate && previousDate && Math.round((entryDate.getTime() - previousDate.getTime()) / 86400000) === 1);
    if (hasWriting && isConsecutive) {
      run += 1;
    } else if (hasWriting) {
      run = 1;
    } else {
      run = 0;
    }
    best = Math.max(best, run);
    previousDate = entryDate;
  }

  let current = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const entryDate = parseLocalDateKey(entry.date);
    const hasWriting = Math.max(0, Math.round(Number(entry.wordDelta) || 0)) > 0;
    if (!entryDate || !hasWriting) {
      break;
    }

    if (index < entries.length - 1) {
      const nextEntry = entries[index + 1];
      const nextDate = parseLocalDateKey(nextEntry.date);
      if (!nextDate || Math.round((nextDate.getTime() - entryDate.getTime()) / 86400000) !== 1) {
        break;
      }
    }

    current += 1;
  }

  return { current, best };
}

function getWritingTargetHistoryEntries(record) {
  return trimWritingTargetHistory(
    Array.isArray(record?.history) ? record.history : [],
    clampPositiveNumber(record?.lookbackDays, DEFAULT_WRITING_TARGET_LOOKBACK_DAYS, 2, WRITING_TARGET_MAX_HISTORY_DAYS),
  );
}

function getWritingTargetHistoryEntryMap(record) {
  const entries = getWritingTargetHistoryEntries(record);
  return new Map(entries.map((entry) => [entry.date, entry]));
}

function getWritingTargetMonthKey(date = new Date()) {
  const value = date instanceof Date ? date : parseLocalDateKey(String(date)) ?? new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function parseWritingTargetMonthKey(monthKey) {
  const trimmed = String(monthKey ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  return createValidatedDate(year, month, 1);
}

function isWritingTargetDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getWritingTargetStartOfWeek(date) {
  const value = startOfLocalDay(date instanceof Date ? date : new Date(date));
  const day = value.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(value, offset);
}

function getWritingTargetSelectedDateKey(summary) {
  const historyEntries = getWritingTargetHistoryEntries(summary?.syncedRecord);
  const historyDateKeys = new Set(historyEntries.map((entry) => entry.date));
  const stateKey = isWritingTargetDateKey(state.writingTargetSelectedDateKey) ? state.writingTargetSelectedDateKey : "";
  if (stateKey && historyDateKeys.has(stateKey)) {
    return stateKey;
  }

  const latestHistoryDateKey = historyEntries.at(-1)?.date;
  if (latestHistoryDateKey) {
    state.writingTargetSelectedDateKey = latestHistoryDateKey;
    return latestHistoryDateKey;
  }

  const todayKey = getLocalDateKey(new Date());
  state.writingTargetSelectedDateKey = todayKey;
  return todayKey;
}

function primeWritingTargetDashboardSelection(summary) {
  const selectedDateKey = getWritingTargetSelectedDateKey(summary);
  if (!isWritingTargetDateKey(state.writingTargetCalendarMonthKey)) {
    state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(parseLocalDateKey(selectedDateKey) ?? new Date());
  }

  if (!["month", "week", "list"].includes(state.writingTargetViewMode)) {
    state.writingTargetViewMode = "month";
  }
}

function buildWritingTargetDashboardModel(summary) {
  primeWritingTargetDashboardSelection(summary);
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const historyEntries = getWritingTargetHistoryEntries(summary?.syncedRecord);
  const historyMap = getWritingTargetHistoryEntryMap(summary?.syncedRecord);
  const chapterTasks = countRemainingTasksByChapter(state.manuscriptTasks ?? []);
  const latestHistoryEntry = historyEntries.at(-1) ?? null;
  const liveTodayEntry = buildLiveWritingTargetHistoryEntry(summary, historyEntries, now);
  const liveHistoryEntries = historyEntries.some((entry) => entry.date === todayKey)
    ? historyEntries.map((entry) => (entry.date === todayKey ? liveTodayEntry : entry))
    : [...historyEntries, liveTodayEntry].sort((a, b) => a.date.localeCompare(b.date));
  const liveHistoryMap = new Map(historyMap);
  liveHistoryMap.set(todayKey, liveTodayEntry);
  const selectedDateKey = Number(summary?.currentWordCount ?? 0) > Number(latestHistoryEntry?.wordCount ?? 0)
    ? todayKey
    : getWritingTargetSelectedDateKey(summary);
  if (selectedDateKey === todayKey && state.writingTargetSelectedDateKey !== todayKey) {
    state.writingTargetSelectedDateKey = todayKey;
    state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(now);
  }

  const selectedEntry = liveHistoryMap.get(selectedDateKey) ?? liveHistoryEntries.at(-1) ?? null;
  const selectedDate = parseLocalDateKey(selectedDateKey) ?? parseLocalDateKey(selectedEntry?.date) ?? new Date();
  const monthDate = parseWritingTargetMonthKey(state.writingTargetCalendarMonthKey) ?? selectedDate;
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12, 0, 0, 0);
  const gridStart = getWritingTargetStartOfWeek(monthStart);
  const dailyGoalWords = Math.max(1, Math.round(Number(summary?.requiredDailyWords ?? summary?.targetWordsPerDay ?? summary?.record?.sessionTargetWords ?? DEFAULT_SESSION_TARGET_WORDS) || 0));
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const dateKey = getLocalDateKey(date);
    const entry = liveHistoryMap.get(dateKey) ?? null;
    const wordGain = Math.max(0, Math.round(Number(entry?.wordDelta) || 0));
    const status = getWritingTargetDayStatus(wordGain, dailyGoalWords, entry);
    return {
      dateKey,
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth(),
      isToday: dateKey === getLocalDateKey(new Date()),
      isSelected: dateKey === selectedDateKey,
      entry,
      wordGain,
      progressRatio: dailyGoalWords > 0 ? Math.max(0, Math.min(1, wordGain / dailyGoalWords)) : 0,
      wordCount: Math.max(0, Math.round(Number(entry?.wordCount) || 0)),
      taskCount: entry?.chapterId ? Math.max(0, Math.round(Number(chapterTasks[entry.chapterId]) || 0)) : 0,
      status,
    };
  });

  const visibleWeekStart = getWritingTargetStartOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(visibleWeekStart, index);
    const dateKey = getLocalDateKey(date);
    const entry = liveHistoryMap.get(dateKey) ?? null;
    const wordGain = Math.max(0, Math.round(Number(entry?.wordDelta) || 0));
    const status = getWritingTargetDayStatus(wordGain, dailyGoalWords, entry);
    return {
      dateKey,
      date,
      dayNumber: date.getDate(),
      isToday: dateKey === getLocalDateKey(new Date()),
      isSelected: dateKey === selectedDateKey,
      entry,
      wordGain,
      progressRatio: dailyGoalWords > 0 ? Math.max(0, Math.min(1, wordGain / dailyGoalWords)) : 0,
      wordCount: Math.max(0, Math.round(Number(entry?.wordCount) || 0)),
      taskCount: entry?.chapterId ? Math.max(0, Math.round(Number(chapterTasks[entry.chapterId]) || 0)) : 0,
      status,
    };
  });

  return {
    historyEntries,
    historyMap,
    selectedDateKey,
    selectedDate,
    selectedEntry,
    monthDate,
    monthLabel: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(monthStart),
    monthKey: getWritingTargetMonthKey(monthStart),
    dailyGoalWords,
    days,
    weekDays,
    listEntries: [...liveHistoryEntries].reverse(),
    streak: buildWritingTargetStreakSummary(liveHistoryEntries),
    viewMode: state.writingTargetViewMode,
  };
}

function buildLiveWritingTargetHistoryEntry(summary, historyEntries, now = new Date()) {
  const currentWordCount = Math.max(0, Math.round(Number(summary?.currentWordCount) || 0));
  const todayKey = getLocalDateKey(now);
  const previousEntry = [...historyEntries]
    .filter((entry) => entry.date < todayKey)
    .at(-1) ?? null;
  const liveEntry = createWritingTargetHistoryEntry(currentWordCount, now, {
    previousEntry,
    context: getWritingTargetSnapshotContext(now),
  });
  const existingTodayEntry = historyEntries.find((entry) => entry.date === todayKey) ?? null;

  if (existingTodayEntry?.noteText) {
    liveEntry.noteText = existingTodayEntry.noteText;
  }

  return liveEntry;
}

function getWritingTargetDayStatus(wordGain, dailyGoalWords, entry) {
  if (!entry || Math.max(0, Number(wordGain) || 0) <= 0) {
    return { key: "no-writing", label: "No writing" };
  }

  const ratio = dailyGoalWords > 0 ? Number(wordGain) / dailyGoalWords : 0;
  if (ratio >= 1) {
    return { key: "on-target", label: "On target" };
  }

  if (ratio >= 0.75) {
    return { key: "good", label: "Good" };
  }

  if (ratio >= 0.5) {
    return { key: "below-target", label: "Below target" };
  }

  return { key: "low", label: "Low" };
}

function buildWritingTargetDashboardCards(summary, dashboard) {
  return [
    {
      key: "projectedDays",
      icon: "⌛",
      label: "Days to release",
      value: summary.projectedDaysToTarget != null ? formatDayCount(summary.projectedDaysToTarget) : "—",
      leftLabel: summary.releaseDate ? formatGoalDateLabel(summary.releaseDate) : `Track ${summary.lookbackDays} days`,
      rightLabel: summary.projectedCompletionDate ? formatGoalDateLabel(summary.projectedCompletionDate) : "—",
      comparison: true,
      note: summary.releaseTrackStatus || `Based on ${summary.lookbackDays}-day average`,
      progress: Number(summary.targetWords) > 0 ? Math.min(1, summary.currentWordCount / Number(summary.targetWords)) : 0,
    },
    {
      key: "currentPace",
      icon: "↗",
      label: "Current pace",
      value: summary.averageWordsPerDayText,
      leftLabel: summary.averageWordsPerDayText,
      rightLabel: `Daily target ${formatDisplayNumber(Math.max(0, Math.round(Number(summary.targetWordsPerDay) || 0)))}`,
      comparison: true,
      note: summary.forecastText || "Live pace",
      progress: summary.targetWordsPerDay > 0 ? Math.min(1, summary.effectiveWordsPerDay / summary.targetWordsPerDay) : 0,
    },
    {
      key: "streak",
      icon: "🔥",
      label: "Streak",
      value: summary.streakCurrentDays > 0 ? formatDisplayNumber(summary.streakCurrentDays) : "—",
      leftLabel: summary.streakCurrentDays > 0 ? `${formatDisplayNumber(summary.streakCurrentDays)} days` : "No streak yet",
      rightLabel: `Best ${formatDisplayNumber(summary.streakBestDays)} days`,
      comparison: true,
      note: "Writing days",
      progress: summary.streakBestDays > 0 ? Math.min(1, summary.streakCurrentDays / summary.streakBestDays) : 0,
    },
    {
      key: "sessionTarget",
      icon: "◎",
      label: "Session target",
      value: formatDisplayNumber(summary.sessionTargetWordsPerSession),
      leftLabel: `${formatDisplayNumber(summary.currentSessionWords)} written`,
      rightLabel: `${formatDisplayNumber(summary.sessionsPerDay)} sessions/day`,
      comparison: true,
      note: `${summary.sessionWordsPerHourLabel || "0/h"} pace`,
      progress: summary.sessionTargetWordsPerSession > 0 ? Math.min(1, summary.currentSessionWords / summary.sessionTargetWordsPerSession) : 0,
      barClass: summary.sessionWordsPerMinuteOverTarget ? "is-session-pace is-over-target" : "is-session-pace",
      barStyle: `--writing-target-bar-color: ${summary.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"};`,
    },
  ];
}

function getWritingTargetSelectedEntryModel(summary, dashboard) {
  const entry = dashboard.selectedEntry;
  if (!entry) {
    return {
      dateKey: dashboard.selectedDateKey,
      dateLabel: new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
      wordCountLabel: "0 words",
      wordDeltaLabel: "0 words",
      chapterTitle: "Unknown chapter",
      sceneTitle: "No entry selected",
      passageExcerpt: "",
      issueCountLabel: "0 issues",
      inspirationCountLabel: "0 inspirations",
      noteText: "",
      statusLabel: "No writing",
      progressLabel: "0%",
      progressRatio: 0,
      wordCountValue: 0,
      dailyGoalWords: dashboard.dailyGoalWords,
      dailyTargetLabel: `${formatDisplayNumber(dashboard.dailyGoalWords)} words`,
      tasksCountLabel: `${formatDisplayNumber(0)} tasks`,
      summaryLines: [],
    };
  }

  const progressRatio = dashboard.dailyGoalWords > 0
    ? Math.max(0, Math.min(1, Math.max(0, Number(entry.wordDelta) || 0) / dashboard.dailyGoalWords))
    : 0;
  const status = getWritingTargetDayStatus(Number(entry.wordDelta) || 0, dashboard.dailyGoalWords, entry);
  const chapterTasks = countRemainingTasksByChapter(state.manuscriptTasks ?? []);
  const taskCount = entry.chapterId ? chapterTasks[entry.chapterId] ?? 0 : 0;

  return {
    dateKey: entry.date,
    dateLabel: new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(parseLocalDateKey(entry.date) ?? new Date()),
    wordCountValue: Math.max(0, Math.round(Number(entry.wordDelta) || 0)),
    wordCountLabel: `${formatDisplayNumber(entry.wordDelta)} words`,
    wordDeltaLabel: `${Number(entry.wordDelta) >= 0 ? "+" : ""}${formatDisplayNumber(entry.wordDelta)} words`,
    chapterTitle: entry.chapterTitle || "Unknown chapter",
    sceneTitle: entry.sceneTitle || "Unknown scene",
    passageExcerpt: entry.passageExcerpt || "",
    issueCountLabel: `${formatDisplayNumber(Math.max(0, Math.round(Number(entry.issueCount) || 0)))} issues`,
    inspirationCountLabel: `${formatDisplayNumber(Math.max(0, Math.round(Number(entry.inspirationCount) || 0)))} inspiration${Math.max(0, Math.round(Number(entry.inspirationCount) || 0)) === 1 ? "" : "s"}`,
    noteText: entry.noteText || "",
    statusLabel: status.label,
    progressLabel: `${formatDisplayNumber(Math.round(progressRatio * 100))}%`,
    progressRatio,
    dailyGoalWords: dashboard.dailyGoalWords,
    dailyTargetLabel: `${formatDisplayNumber(dashboard.dailyGoalWords)} words`,
    tasksCountLabel: `${formatDisplayNumber(taskCount)} tasks`,
    summaryLines: [
      `${formatDisplayNumber(Math.max(0, Number(entry.wordCount) || 0))} total`,
      entry.capturedAt ? `Captured ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(entry.capturedAt))}` : "",
    ].filter(Boolean),
  };
}

function getCurrentManuscriptWordCount() {
  return state.scenes.reduce((total, scene) => total + countWords(scene.editorText), 0);
}

function countWords(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return 0;
  }

  return value.split(/\s+/).filter(Boolean).length;
}

function compactWordCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value ?? "");
  }

  if (Math.abs(number) >= 100000) {
    return `${Math.round(number / 1000)}k`;
  }

  if (Math.abs(number) >= 1000) {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number / 1000).replace(/\.0$/, "") + "k";
  }

  return formatDisplayNumber(number);
}

function formatDayCount(value) {
  const number = Math.max(0, Math.ceil(Number(value) || 0));
  return `${formatDisplayNumber(number)} day${number === 1 ? "" : "s"}`;
}

function formatMinuteCount(value) {
  const number = Math.max(0, Math.ceil(Number(value) || 0));
  return `${formatDisplayNumber(number)} minute${number === 1 ? "" : "s"}`;
}

function formatClockTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatSessionElapsedLabel(elapsedMinutes, timeoutMinutes) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedMinutes) || 0));
  const timeout = Math.max(0, Math.floor(Number(timeoutMinutes) || 0));
  return `${formatDisplayNumber(elapsed)} min${elapsed === 1 ? "" : "s"} of ${formatDisplayNumber(timeout)}${timeout === 1 ? " min" : " mins"}`;
}

function createPassageExcerpt(scene, limit = 18) {
  const sourceText = String(scene?.editorText ?? scene?.sceneSynopsis ?? scene?.sceneTitle ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!sourceText) {
    return "";
  }

  const words = sourceText.split(/\s+/);
  if (words.length <= limit) {
    return sourceText;
  }

  return `${words.slice(0, limit).join(" ")}…`;
}

function buildSessionPaceColor(ratio) {
  const paceRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  const red = { r: 232, g: 96, b: 92 };
  const blue = { r: 90, g: 144, b: 255 };
  const green = { r: 113, g: 215, b: 177 };

  if (paceRatio <= 0.65) {
    return formatRgbColor(mixRgbColor(red, blue, paceRatio / 0.65));
  }

  return formatRgbColor(mixRgbColor(blue, green, (paceRatio - 0.65) / 0.35));
}

function mixRgbColor(start, end, ratio) {
  const mix = Math.max(0, Math.min(1, Number(ratio) || 0));
  return {
    r: Math.round(start.r + ((end.r - start.r) * mix)),
    g: Math.round(start.g + ((end.g - start.g) * mix)),
    b: Math.round(start.b + ((end.b - start.b) * mix)),
  };
}

function formatRgbColor(color) {
  return `rgb(${Math.max(0, Math.min(255, Math.round(color.r)))}, ${Math.max(0, Math.min(255, Math.round(color.g)))}, ${Math.max(0, Math.min(255, Math.round(color.b)))})`;
}

function formatDurationMinutes(value) {
  const minutes = Math.max(0, Math.ceil(Number(value) || 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) {
    return `${formatDisplayNumber(remainder)} minute${remainder === 1 ? "" : "s"}`;
  }

  if (remainder <= 0) {
    return `${formatDisplayNumber(hours)} hour${hours === 1 ? "" : "s"}`;
  }

  return `${formatDisplayNumber(hours)} hour${hours === 1 ? "" : "s"} ${formatDisplayNumber(remainder)} minute${remainder === 1 ? "" : "s"}`;
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatGoalDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return [day, month, year].filter(Boolean).join(" ");
}

function parseLocalDateKey(value) {
  const key = normalizeDateInput(value);
  if (!key) {
    return null;
  }

  const date = new Date(`${key}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeWritingTargetCadence(value) {
  const candidate = String(value ?? "").trim().toLowerCase();
  return candidate === "weekly" ? "weekly" : "daily";
}

function normalizeWritingTargetGoalSyncSource(value) {
  const candidate = String(value ?? "").trim();
  return WRITING_TARGET_GOAL_SYNC_SOURCES.includes(candidate) ? candidate : "";
}

function getWritingTargetCadenceMeta(cadence) {
  return WRITING_TARGET_CADENCE_OPTIONS.find((option) => option.value === normalizeWritingTargetCadence(cadence))
    ?? WRITING_TARGET_CADENCE_OPTIONS[0];
}

function getWritingTargetCadenceDays(cadence) {
  return getWritingTargetCadenceMeta(cadence).value === "weekly" ? 7 : 1;
}

function getWritingTargetGoalSyncSource(record) {
  const explicitSource = normalizeWritingTargetGoalSyncSource(record?.goalSyncSource);
  if (explicitSource) {
    return explicitSource;
  }

  if (parseLocalDateKey(record?.releaseDate)) {
    return "releaseDate";
  }

  const sessionTargetWords = clampPositiveNumber(record?.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  return sessionTargetWords !== DEFAULT_SESSION_TARGET_WORDS ? "sessionTargetWords" : "releaseDate";
}

function getWritingTargetDaysUntilDate(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86400000),
  );
}

function startOfLocalDay(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatSessionAge(sessionStartedAt, now) {
  if (typeof sessionStartedAt !== "string" || !sessionStartedAt) {
    return "Session baseline set";
  }

  const startDate = new Date(sessionStartedAt);
  if (Number.isNaN(startDate.getTime())) {
    return "Session baseline set";
  }

  const days = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000));
  if (days <= 0) {
    return "Session started today";
  }

  return `${formatDisplayNumber(days)} day${days === 1 ? "" : "s"} in session`;
}

function syncWritingTargetGoalFields(record, currentWordCount, now = new Date()) {
  if (!record || typeof record !== "object") {
    return record;
  }

  const nextRecord = { ...record };
  const targetWords = clampPositiveNumber(nextRecord.targetWords, DEFAULT_WRITING_TARGET_WORDS);
  const sessionTargetWords = clampPositiveNumber(nextRecord.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  const sessionsPerDay = clampPositiveNumber(
    nextRecord.sessionsPerDay,
    DEFAULT_SESSION_TARGETS_PER_DAY,
    1,
    WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  );
  const sessionTimeoutMinutes = clampPositiveNumber(
    nextRecord.sessionTimeoutMinutes,
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  );
  const targetCadence = normalizeWritingTargetCadence(nextRecord.targetCadence);
  const cadenceDays = getWritingTargetCadenceDays(targetCadence);
  const releaseDate = parseLocalDateKey(nextRecord.releaseDate);
  const goalSyncSource = getWritingTargetGoalSyncSource(nextRecord);
  const remainingWords = Math.max(0, targetWords - Math.max(0, Math.round(Number(currentWordCount) || 0)));

  nextRecord.targetWords = targetWords;
  nextRecord.sessionTargetWords = sessionTargetWords;
  nextRecord.sessionsPerDay = sessionsPerDay;
  nextRecord.sessionTimeoutMinutes = sessionTimeoutMinutes;
  nextRecord.targetCadence = targetCadence;
  nextRecord.goalSyncSource = goalSyncSource;
  nextRecord.sessionLastActiveAt =
    typeof nextRecord.sessionLastActiveAt === "string" && nextRecord.sessionLastActiveAt.trim()
      ? nextRecord.sessionLastActiveAt
      : now.toISOString();

  if (goalSyncSource === "releaseDate") {
    nextRecord.releaseDate = releaseDate ? getLocalDateKey(releaseDate) : "";
    if (releaseDate) {
      const daysUntilRelease = getWritingTargetDaysUntilDate(releaseDate, now);
      if (daysUntilRelease != null && daysUntilRelease > 0) {
        nextRecord.sessionTargetWords = Math.max(
          1,
          Math.ceil((remainingWords / daysUntilRelease) * cadenceDays),
        );
      }
    }
  } else if (goalSyncSource === "sessionTargetWords") {
    const wordsPerDay = cadenceDays > 0 ? sessionTargetWords / cadenceDays : 0;
    if (wordsPerDay > 0) {
      const projectedDays = remainingWords > 0 ? remainingWords / wordsPerDay : 0;
      nextRecord.releaseDate = getLocalDateKey(addDays(now, projectedDays));
    } else {
      nextRecord.releaseDate = releaseDate ? getLocalDateKey(releaseDate) : "";
    }
  }

  return nextRecord;
}

function seedWritingTargetTestData() {
  const record = syncWritingTargetState({ forceReload: false });
  if (!record || !state.workspace?.project?.id) {
    return;
  }

  const currentWordCount = getCurrentManuscriptWordCount();
  const now = new Date();
  const history = generateBelievableWritingTargetHistory(currentWordCount, 30, now, state.workspace.project.id);
  const lastEntry = history[history.length - 1];
  const previousEntry = history[history.length - 2] ?? history[0];
  const todaysGain = Math.max(0, Number(lastEntry?.wordCount ?? currentWordCount) - Number(previousEntry?.wordCount ?? 0));
  const todayKey = getLocalDateKey(now);
  const recentSessionStart = new Date(now.getTime() - (8 * 60000));
  const recentSessionMidpoint = new Date(now.getTime() - (4 * 60000));
  const recentSessionStartCount = Math.max(0, currentWordCount - Math.max(140, Math.round(todaysGain * 0.7)));
  const recentSessionMidCount = Math.max(0, currentWordCount - Math.max(45, Math.round(todaysGain * 0.25)));
  const nextRecord = {
    ...cloneValue(record),
    lookbackDays: 30,
    history,
    dailyBaselineDateKey: todayKey,
    dailyBaselineWordCount: Math.max(0, Math.round(Number(previousEntry?.wordCount ?? 0))),
    sessionBaselineWordCount: Math.max(0, currentWordCount - Math.max(250, todaysGain)),
    sessionStartedAt: addHours(now, -6).toISOString(),
    sessionLastActiveAt: now.toISOString(),
    sessionSamples: [
      createWritingTargetSessionSample(recentSessionStartCount, recentSessionStart),
      createWritingTargetSessionSample(recentSessionMidCount, recentSessionMidpoint),
      createWritingTargetSessionSample(currentWordCount, now),
    ],
    updatedAt: now.toISOString(),
  };

  state.writingTargetState = persistWritingTargetState(nextRecord);
  state.writingTargetProjectId = state.workspace.project.id;
  clearWritingTargetDraft();
  persistCurrentProjectRecord();
  renderHeader();
  renderWritingTargetWindow();
}

function generateBelievableWritingTargetHistory(currentWordCount, days, now, projectId) {
  const dayCount = Math.max(2, Math.min(60, Math.round(Number(days) || 30)));
  const targetGain = Math.max(
    0,
    Math.min(
      Math.max(0, currentWordCount),
      Math.max(600, Math.round(Math.max(0, currentWordCount) * 0.16)),
    ),
  );

  const rawEntries = [];
  let rawTotal = 0;
  for (let index = 0; index < dayCount; index += 1) {
    const date = addDays(now, index - (dayCount - 1));
    const weekdayBase = [240, 520, 680, 610, 720, 320, 210][date.getDay()];
    const trend = Math.round((index / Math.max(1, dayCount - 1)) * 140);
    const variance = seededOffset(projectId, getLocalDateKey(date), -95, 95);
    const weight = Math.max(40, weekdayBase + trend + variance);
    rawEntries.push({
      date,
      weight,
    });
    rawTotal += weight;
  }

  const increments = [];
  let allocated = 0;
  for (let index = 0; index < rawEntries.length; index += 1) {
    if (index === rawEntries.length - 1) {
      increments.push(Math.max(0, targetGain - allocated));
      continue;
    }

    const increment = rawTotal > 0
      ? Math.floor((rawEntries[index].weight / rawTotal) * targetGain)
      : 0;
    increments.push(increment);
    allocated += increment;
  }

  let wordCount = Math.max(0, currentWordCount - targetGain);
  const history = [];
  const scenes = Array.isArray(state.scenes) && state.scenes.length ? [...state.scenes] : [];
  const issueCount = Math.max(0, Number(state.workspace?.project?.issues?.length ?? 0));
  const inspirationCount = Math.max(
    0,
    Array.isArray(state.passageNotes)
      ? state.passageNotes.filter((note) => note.noteType === "inspiration").length
      : 0,
  );
  for (let index = 0; index < rawEntries.length; index += 1) {
    const dateKey = getLocalDateKey(rawEntries[index].date);
    if (index === rawEntries.length - 1) {
      wordCount = currentWordCount;
    } else {
      wordCount += increments[index];
    }

    const archiveScene = scenes.length
      ? scenes[Math.abs(seededOffset(projectId, dateKey, 0, scenes.length - 1))]
      : getSelectedScene() ?? state.scenes[0] ?? null;

    history.push({
      date: dateKey,
      wordCount,
      capturedAt: new Date(`${dateKey}T12:00:00`).toISOString(),
      wordDelta: index === 0
        ? increments[index] ?? wordCount
        : Math.max(0, wordCount - Number(history[index - 1]?.wordCount ?? 0)),
      chapterId: archiveScene?.chapterId ?? "",
      chapterTitle: archiveScene?.chapterTitle ?? "Unknown chapter",
      sceneId: archiveScene?.sceneId ?? "",
      sceneTitle: archiveScene?.sceneTitle ?? "Unknown scene",
      passageExcerpt: createPassageExcerpt(archiveScene),
      issueCount,
      inspirationCount,
    });
  }

  return history;
}

function seededOffset(projectId, dateKey, min, max) {
  const seedText = `${projectId}:${dateKey}`;
  let hash = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  const normalized = hash / 0xffffffff;
  return Math.round(min + normalized * (max - min));
}

function addHours(date, hours) {
  const next = new Date(date.getTime());
  next.setHours(next.getHours() + Number(hours || 0));
  return next;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const date = parseFlexibleDateInput(trimmed);
  return date ? getLocalDateKey(date) : "";
}

function parseFlexibleDateInput(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return createValidatedDate(year, month, day);
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirstMatch) {
    const first = Number(dayFirstMatch[1]);
    const second = Number(dayFirstMatch[2]);
    const year = Number(dayFirstMatch[3]);
    if (first > 12 || second > 12) {
      return first > 12
        ? createValidatedDate(year, second, first)
        : createValidatedDate(year, first, second);
    }

    return createValidatedDate(year, second, first);
  }

  const fallback = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function createValidatedDate(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + Math.round(Number(days) || 0));
  return next;
}

function estimateWritingPace(record, now = new Date()) {
  const history = Array.isArray(record?.history) ? [...record.history] : [];
  if (history.length < 2) {
    return {
      wordsPerDay: 0,
      daysSpan: 0,
      points: history.length,
    };
  }

  const lookbackDays = Math.max(2, Number(record?.lookbackDays) || DEFAULT_WRITING_TARGET_LOOKBACK_DAYS);
  const recentHistory = trimWritingTargetHistory(history, lookbackDays);
  if (recentHistory.length < 2) {
    return {
      wordsPerDay: 0,
      daysSpan: 0,
      points: recentHistory.length,
    };
  }

  const first = recentHistory[0];
  const last = recentHistory[recentHistory.length - 1];
  const firstDate = new Date(`${first.date}T12:00:00`);
  const lastDate = new Date(`${last.date}T12:00:00`);
  const daysSpan = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000));
  const wordsGained = Math.max(0, Number(last.wordCount) - Number(first.wordCount));

  return {
    wordsPerDay: wordsGained / daysSpan,
    daysSpan,
    points: recentHistory.length,
  };
}

function trimWritingTargetHistory(history, lookbackDays) {
  const maxHistory = Math.max(30, Number(lookbackDays) || DEFAULT_WRITING_TARGET_LOOKBACK_DAYS) + 30;
  const sorted = [...history]
    .filter((entry) => entry && typeof entry === "object" && typeof entry.date === "string")
    .map((entry) => ({
      date: getLocalDateKey(new Date(`${entry.date}T12:00:00`)),
      wordCount: Math.max(0, Math.round(Number(entry.wordCount) || 0)),
      wordDelta: Math.round(Number(entry.wordDelta) || 0),
      capturedAt: typeof entry.capturedAt === "string" ? entry.capturedAt : new Date().toISOString(),
      chapterId: typeof entry.chapterId === "string" ? entry.chapterId : "",
      chapterTitle: typeof entry.chapterTitle === "string" ? entry.chapterTitle : "",
      sceneId: typeof entry.sceneId === "string" ? entry.sceneId : "",
      sceneTitle: typeof entry.sceneTitle === "string" ? entry.sceneTitle : "",
      passageExcerpt: typeof entry.passageExcerpt === "string" ? entry.passageExcerpt : "",
      issueCount: Math.max(0, Math.round(Number(entry.issueCount) || 0)),
      inspirationCount: Math.max(0, Math.round(Number(entry.inspirationCount) || 0)),
      noteText: typeof entry.noteText === "string" ? entry.noteText : "",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const deduped = [];
  for (const entry of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && last.date === entry.date) {
      deduped[deduped.length - 1] = entry;
    } else {
      deduped.push(entry);
    }
  }

  return deduped.slice(Math.max(0, deduped.length - maxHistory));
}

function normalizeWritingTargetRecord(candidate, currentWordCount, now = new Date()) {
  const defaults = createDefaultWritingTargetRecord(currentWordCount, now);
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }

  const targetWords = clampPositiveNumber(candidate.targetWords, DEFAULT_WRITING_TARGET_WORDS);
  const sessionTargetWords = clampPositiveNumber(candidate.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  const sessionsPerDay = clampPositiveNumber(
    candidate.sessionsPerDay,
    DEFAULT_SESSION_TARGETS_PER_DAY,
    1,
    WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
  );
  const sessionTimeoutMinutes = clampPositiveNumber(
    candidate.sessionTimeoutMinutes,
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  );
  const targetCadence = normalizeWritingTargetCadence(candidate.targetCadence);
  const lookbackDays = clampPositiveNumber(
    candidate.lookbackDays,
    DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
    2,
    WRITING_TARGET_MAX_HISTORY_DAYS,
  );
  const visibleMetrics = Array.isArray(candidate.visibleMetrics)
    ? candidate.visibleMetrics.filter((metricKey) => WRITING_TARGET_METRIC_KEYS.includes(metricKey))
    : [...defaults.visibleMetrics];
  const sessionBaselineWordCount =
    Number.isFinite(Number(candidate.sessionBaselineWordCount)) && Number(candidate.sessionBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(candidate.sessionBaselineWordCount)))
      : currentWordCount;
  const dailyBaselineDateKey =
    typeof candidate.dailyBaselineDateKey === "string" && candidate.dailyBaselineDateKey.trim()
      ? getLocalDateKey(new Date(`${candidate.dailyBaselineDateKey}T12:00:00`))
      : defaults.dailyBaselineDateKey;
  const dailyBaselineWordCount =
    Number.isFinite(Number(candidate.dailyBaselineWordCount)) && Number(candidate.dailyBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(candidate.dailyBaselineWordCount)))
      : getWritingTargetDailyBaselineWordCount(candidate, currentWordCount, now);
  const sessionStartedAt =
    typeof candidate.sessionStartedAt === "string" && candidate.sessionStartedAt.trim()
      ? candidate.sessionStartedAt
      : defaults.sessionStartedAt;
  const releaseDate = normalizeDateInput(candidate.releaseDate);
  const goalSyncSource = normalizeWritingTargetGoalSyncSource(candidate.goalSyncSource)
    || (releaseDate ? "releaseDate" : sessionTargetWords !== DEFAULT_SESSION_TARGET_WORDS ? "sessionTargetWords" : "releaseDate");
  const history = trimWritingTargetHistory(candidate.history ?? defaults.history, lookbackDays);
  const sessionSamples = normalizeWritingTargetSessionSamples(candidate.sessionSamples ?? defaults.sessionSamples);

  return syncWritingTargetGoalFields({
    targetWords,
    releaseDate,
    sessionTargetWords,
    sessionsPerDay,
    sessionTimeoutMinutes,
    targetCadence,
    goalSyncSource,
    lookbackDays,
    visibleMetrics: visibleMetrics.length ? visibleMetrics : [...defaults.visibleMetrics],
    sessionBaselineWordCount,
    dailyBaselineDateKey,
    dailyBaselineWordCount,
    sessionStartedAt,
    sessionLastActiveAt:
      typeof candidate.sessionLastActiveAt === "string" && candidate.sessionLastActiveAt.trim()
        ? candidate.sessionLastActiveAt
        : defaults.sessionLastActiveAt,
    sessionSamples: sessionSamples.length ? sessionSamples : defaults.sessionSamples,
    history: history.length ? history : defaults.history,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt
        : defaults.updatedAt,
  }, currentWordCount, now);
}

function getWritingTargetSnapshotContext(now = new Date()) {
  const scene = getSelectedScene() ?? state.scenes[0] ?? null;
  const inspirationCount = Array.isArray(state.passageNotes)
    ? state.passageNotes.filter((note) => note.noteType === "inspiration").length
    : 0;
  return {
    capturedAt: now.toISOString(),
    chapterId: scene?.chapterId ?? "",
    chapterTitle: scene?.chapterTitle ?? "Unknown chapter",
    sceneId: scene?.sceneId ?? "",
    sceneTitle: scene?.sceneTitle ?? "Unknown scene",
    passageExcerpt: createPassageExcerpt(scene),
    issueCount: Math.max(0, Number(state.workspace?.project?.issues?.length ?? 0)),
    inspirationCount: Math.max(0, inspirationCount),
  };
}

function createWritingTargetHistoryEntry(currentWordCount, now = new Date(), options = {}) {
  const previousEntry = options.previousEntry ?? null;
  const context = options.context ?? getWritingTargetSnapshotContext(now);
  const wordCount = Math.max(0, Math.round(Number(currentWordCount) || 0));
  const previousWordCount = previousEntry ? Math.max(0, Math.round(Number(previousEntry.wordCount) || 0)) : 0;
  return {
    date: getLocalDateKey(now),
    wordCount,
    wordDelta: previousEntry ? wordCount - previousWordCount : wordCount,
    capturedAt: typeof context.capturedAt === "string" ? context.capturedAt : now.toISOString(),
    chapterId: context.chapterId ?? "",
    chapterTitle: context.chapterTitle ?? "Unknown chapter",
    sceneId: context.sceneId ?? "",
    sceneTitle: context.sceneTitle ?? "Unknown scene",
    passageExcerpt: context.passageExcerpt ?? "",
    issueCount: Math.max(0, Math.round(Number(context.issueCount) || 0)),
    inspirationCount: Math.max(0, Math.round(Number(context.inspirationCount) || 0)),
    noteText: "",
  };
}

function createWritingTargetSessionSample(currentWordCount, now = new Date()) {
  return {
    capturedAt: now.toISOString(),
    wordCount: Math.max(0, Math.round(Number(currentWordCount) || 0)),
  };
}

function normalizeWritingTargetSessionSamples(samples) {
  const normalized = Array.isArray(samples)
    ? samples
        .filter((sample) => sample && typeof sample === "object")
        .map((sample) => {
          const capturedAt = typeof sample.capturedAt === "string" && sample.capturedAt.trim()
            ? new Date(sample.capturedAt)
            : new Date();
          return {
            capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date().toISOString() : capturedAt.toISOString(),
            wordCount: Math.max(0, Math.round(Number(sample.wordCount) || 0)),
          };
        })
    : [];

  normalized.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  return normalized.slice(-WRITING_TARGET_MAX_SESSION_SAMPLES);
}

function estimateRecentSessionWordsPerMinute(record, now = new Date()) {
  const samples = normalizeWritingTargetSessionSamples(record?.sessionSamples);
  if (samples.length < 2) {
    return null;
  }

  const recentWindowStart = now.getTime() - (WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES * 60000);
  const recentSamples = samples.filter((sample) => {
    const capturedAt = new Date(sample.capturedAt);
    return !Number.isNaN(capturedAt.getTime()) && capturedAt.getTime() >= recentWindowStart;
  });
  const paceSamples = recentSamples.length >= 2 ? recentSamples : samples.slice(-2);
  if (paceSamples.length < 2) {
    return null;
  }

  const firstSample = paceSamples[0];
  const lastSample = paceSamples[paceSamples.length - 1];
  const firstCapturedAt = new Date(firstSample.capturedAt);
  const lastCapturedAt = new Date(lastSample.capturedAt);
  if (Number.isNaN(firstCapturedAt.getTime()) || Number.isNaN(lastCapturedAt.getTime())) {
    return null;
  }

  const minutesSpan = Math.max(1 / 60, (lastCapturedAt.getTime() - firstCapturedAt.getTime()) / 60000);
  const wordsGained = Math.max(0, Number(lastSample.wordCount) - Number(firstSample.wordCount));
  return wordsGained / minutesSpan;
}

function getWritingTargetDailyBaselineWordCount(record, currentWordCount, now = new Date()) {
  const history = trimWritingTargetHistory(
    Array.isArray(record?.history) ? record.history : [],
    clampPositiveNumber(record?.lookbackDays, DEFAULT_WRITING_TARGET_LOOKBACK_DAYS, 2, WRITING_TARGET_MAX_HISTORY_DAYS),
  );
  if (!history.length) {
    return 0;
  }

  const todayKey = getLocalDateKey(now);
  // Daily progress is measured from the most recent completed day, not today's live snapshot.
  const previousEntry = [...history]
    .filter((entry) => entry.date < todayKey)
    .at(-1) ?? null;
  if (previousEntry) {
    return Math.max(0, Math.round(Number(previousEntry.wordCount) || 0));
  }

  return 0;
}

function createDefaultWritingTargetRecord(currentWordCount, now = new Date()) {
  const context = getWritingTargetSnapshotContext(now);
  return {
    targetWords: DEFAULT_WRITING_TARGET_WORDS,
    releaseDate: "",
    sessionTargetWords: DEFAULT_SESSION_TARGET_WORDS,
    sessionsPerDay: DEFAULT_SESSION_TARGETS_PER_DAY,
    sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
    targetCadence: "daily",
    goalSyncSource: "releaseDate",
    lookbackDays: DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
    visibleMetrics: [...WRITING_TARGET_METRIC_KEYS],
    sessionBaselineWordCount: Math.max(0, Math.round(Number(currentWordCount) || 0)),
    dailyBaselineDateKey: getLocalDateKey(now),
    dailyBaselineWordCount: 0,
    sessionStartedAt: now.toISOString(),
    sessionLastActiveAt: now.toISOString(),
    sessionSamples: [createWritingTargetSessionSample(currentWordCount, now)],
    history: [createWritingTargetHistoryEntry(currentWordCount, now, { previousEntry: null, context })],
    updatedAt: now.toISOString(),
  };
}

function readWritingTargetStore() {
  const candidate = readStoredJson(EDITOR_WRITING_TARGETS_KEY);
  return candidate && typeof candidate === "object" ? candidate : {};
}

function clampPositiveNumber(candidate, fallback, min = 1, max = Number.POSITIVE_INFINITY) {
  const value = Math.round(Number(candidate));
  if (!Number.isFinite(value) || value < min) {
    return Math.max(min, Math.round(Number(fallback) || min));
  }

  return Math.min(max, value);
}

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

function toggleWritingTargetWindow() {
  if (state.writingTargetWindowOpen) {
    closeWritingTargetWindow();
    return;
  }

  state.writingTargetWindowOpen = true;
  beginWritingTargetDraft();
  primeWritingTargetDashboardSelection();
  renderHeader();
  renderWritingTargetWindow();
  startWritingTargetWindowRefreshTimer();
}

function closeWritingTargetWindow() {
  stopWritingTargetWindowRefreshTimer();
  if (!state.writingTargetWindowOpen) {
    return;
  }

  commitWritingTargetDraft();
  state.writingTargetWindowOpen = false;
  renderHeader();
  renderWritingTargetWindow();
}

function saveWritingTargetGoals() {
  stopWritingTargetWindowRefreshTimer();
  if (!state.writingTargetWindowOpen) {
    return;
  }

  commitWritingTargetDraft();
  state.writingTargetWindowOpen = false;
  renderHeader();
  renderWritingTargetWindow();
  if (hasProjectFileDestination()) {
    void saveCurrentProject();
  }
}

function cancelWritingTargetGoals() {
  stopWritingTargetWindowRefreshTimer();
  if (!state.writingTargetWindowOpen) {
    return;
  }

  const baseline = state.writingTargetDraftBaseline ? cloneValue(state.writingTargetDraftBaseline) : null;
  clearWritingTargetDraft();
  if (baseline) {
    state.writingTargetState = persistWritingTargetState(baseline);
    persistCurrentProjectRecord();
  }
  state.writingTargetWindowOpen = false;
  renderHeader();
  renderWritingTargetWindow();
}

function resetWritingTargetGoals() {
  const record = beginWritingTargetDraft();
  if (!record) {
    return;
  }

  const defaults = createDefaultWritingTargetRecord(getCurrentManuscriptWordCount(), new Date());
  const nextRecord = {
    ...cloneValue(record),
    targetWords: defaults.targetWords,
    releaseDate: defaults.releaseDate,
    sessionTargetWords: defaults.sessionTargetWords,
    sessionsPerDay: defaults.sessionsPerDay,
    sessionTimeoutMinutes: defaults.sessionTimeoutMinutes,
    targetCadence: defaults.targetCadence,
    goalSyncSource: defaults.goalSyncSource,
    lookbackDays: defaults.lookbackDays,
    visibleMetrics: [...defaults.visibleMetrics],
  };

  state.writingTargetDraft = nextRecord;
  state.writingTargetDraftProjectId = state.workspace?.project?.id ?? null;
  syncWritingTargetCanonicalState(nextRecord);
  renderHeader();
  renderWritingTargetWindow();
}

function setWritingTargetViewMode(viewMode) {
  if (!["month", "week", "list"].includes(viewMode)) {
    return;
  }

  state.writingTargetViewMode = viewMode;
  persistCurrentProjectRecord();
  renderWritingTargetWindow();
}

function selectWritingTargetDay(dateKey) {
  if (!isWritingTargetDateKey(dateKey)) {
    return;
  }

  state.writingTargetSelectedDateKey = dateKey;
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(parseLocalDateKey(dateKey) ?? new Date());
  persistCurrentProjectRecord();
  renderWritingTargetWindow();
}

function shiftWritingTargetCalendarMonth(monthOffset) {
  const currentMonth = parseWritingTargetMonthKey(state.writingTargetCalendarMonthKey) ?? new Date();
  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + Number(monthOffset || 0), 1, 12, 0, 0, 0);
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(nextMonth);
  persistCurrentProjectRecord();
  renderWritingTargetWindow();
}

function jumpWritingTargetCalendarToToday() {
  const today = new Date();
  state.writingTargetSelectedDateKey = getLocalDateKey(today);
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(today);
  persistCurrentProjectRecord();
  renderWritingTargetWindow();
}

function resetWritingSession() {
  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return;
  }

  const now = new Date();
  const nextRecord = {
    ...cloneValue(record),
    sessionBaselineWordCount: getCurrentManuscriptWordCount(),
    sessionStartedAt: now.toISOString(),
    sessionLastActiveAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  state.writingTargetState = persistWritingTargetState(nextRecord);
  clearWritingTargetDraft();
  persistCurrentProjectRecord();
  renderHeader();
  renderWritingTargetWindow();
}

function saveWritingTargetState() {
  commitWritingTargetDraft();
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

function renderBinderPanel() {
  const workspace = state.workspace;
  const chapters = groupScenesByChapter(state.scenes);
  const taskCountsByChapter = countRemainingTasksByChapter(state.manuscriptTasks);
  const activeProject = getActiveProjectRecord();
  document.querySelector("#binder-slot").innerHTML = `
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
}

function renderSourceArchive(projectRecord) {
  const archive = Array.isArray(projectRecord?.sourceArchive) ? projectRecord.sourceArchive : [];
  if (!archive.length) {
    return "";
  }

  return `
    <div class="source-archive">
      <div class="panel-heading split-heading">
        <p class="panel-kicker">Imported Sources</p>
        <h2>Scrivener archive</h2>
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
  const childrenId = `binder-chapter-scenes-${chapter.chapterId}`;
  const chapterNumberLabel = formatChapterNumberLabel(chapterNumber);
  const chapterDisplayTitle = formatChapterDisplayTitle(chapter.chapterTitle);
  return `
    <div class="binder-node binder-chapter ${isCollapsed ? "is-collapsed" : ""}">
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
        <button
          class="binder-button binder-chapter-button ${isCurrentChapter ? "is-active" : ""}"
          type="button"
          data-action="select-chapter"
          data-chapter-id="${escapeHtml(chapter.chapterId)}"
        >
          <span class="binder-chapter-order">${escapeHtml(chapterNumberLabel)}</span>
          <span class="binder-chapter-title">${escapeHtml(chapterDisplayTitle)}</span>
          ${taskCount > 0 ? renderTaskBadge(taskCount, chapterDisplayTitle) : ""}
        </button>
      </div>
      <div class="binder-children" id="${escapeHtml(childrenId)}" ${isCollapsed ? "hidden" : ""}>
        ${chapter.scenes.map((scene) => renderSceneNode(scene)).join("")}
      </div>
    </div>
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
  return `
    <div class="binder-node binder-scene">
      <button
        class="binder-button ${isCurrentScene ? "is-active" : ""}"
        data-action="select-scene"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        data-scene-title-id="${escapeHtml(scene.sceneId)}"
      >
        <span class="binder-kind">scene</span>
        <span>${escapeHtml(scene.sceneTitle)}</span>
      </button>
    </div>
  `;
}

function renderManuscriptPanel() {
  const selectedScene = getSelectedScene() ?? state.scenes[0];
  const editorMode = state.activePane === "narration" ? "narration" : "manuscript";
  document.querySelector("#manuscript-slot").innerHTML = `
    <div class="panel-heading">
      <p class="panel-kicker">Scene Editor</p>
      <h2>Scene Editor Viewport</h2>
    </div>
    ${selectedScene ? renderSceneEditor(selectedScene, { mode: editorMode }) : ""}
  `;
}

function renderSceneEditor(scene, options = {}) {
  const mode = options.mode === "narration" ? "narration" : "manuscript";
  const hasDraft = Boolean(state.sceneDrafts[scene.sceneId]);
  const localAiStatus = state.localAiTitleStatus[scene.sceneId];
  const narrationSelection = mode === "narration" ? getNarrationTakeSelectionForScene(scene.sceneId) : null;
  const narrationSession = mode === "narration" ? state.narrationTakeSession : null;
  return `
    <section class="scene-editor-shell ${mode === "narration" ? "narration-editor-shell" : ""}">
      <div class="scene-editor-header">
        <div class="editor-title-row">
          <input
            class="editor-title-input"
            type="text"
            value="${escapeHtml(scene.sceneTitle)}"
            data-edit-field="scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            aria-label="Scene title"
          />
          <button
            class="tag-button editor-action-button ai-title-button"
            type="button"
            data-action="suggest-scene-title"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            ${state.localAiPrefs.enabled ? "" : "disabled"}
          >${localAiStatus === "loading" ? "Thinking..." : "Suggest title"}</button>
          ${localAiStatus && localAiStatus !== "loading" ? `<span class="local-ai-status">${escapeHtml(localAiStatus)}</span>` : ""}
        </div>
        <div class="scene-editor-tools ${mode === "narration" ? "narration-recording-tools" : ""}">
          ${mode === "narration"
            ? renderNarrationRecordingTools(scene, narrationSelection, narrationSession)
            : `
              ${renderEditorSetting("Font", "fontFamilyId", FONT_OPTIONS.map((option) => ({
                value: option.id,
                label: option.label,
              })), state.editorPrefs.fontFamilyId)}
              ${renderEditorSetting("Size", "fontSize", FONT_SIZE_OPTIONS.map((value) => ({
                value: String(value),
                label: `${value}px`,
              })), String(state.editorPrefs.fontSize))}
              ${renderEditorSetting("Line Height", "lineHeight", LINE_HEIGHT_OPTIONS.map((value) => ({
                value: String(value),
                label: `${value}x`,
              })), String(state.editorPrefs.lineHeight))}
              ${renderEditorSetting("Text Width", "editorWidth", EDITOR_WIDTH_OPTIONS.map((value) => ({
                value: String(value),
                label: `${value}px`,
              })), String(state.editorPrefs.editorWidth))}
            `}
          ${hasDraft ? `<button class="tag-button editor-action-button" data-action="reset-scene-draft" data-scene-id="${escapeHtml(scene.sceneId)}">Revert local draft</button>` : ""}
        </div>
      </div>

      <div
        class="scene-editor-codeframe ${mode === "narration" ? "narration-editor-frame" : ""}"
        data-scene-editor="${escapeHtml(scene.sceneId)}"
        style="${escapeHtml(buildEditorStyle())}"
      >
        <div class="editor-document-gutter" data-editor-gutter aria-hidden="true"></div>
        <div class="editor-document-body">
          <textarea
            class="editor-document-input"
            data-edit-field="editor-text"
            data-scene-id="${escapeHtml(scene.sceneId)}"
            spellcheck="true"
          >${escapeHtml(scene.editorText ?? "")}</textarea>
        </div>
        ${renderInlinePassageDraft(scene)}
      </div>
    </section>
  `;
}

function renderInlinePassageDraft(scene) {
  const draft = state.inlinePassageDraft;
  if (!draft || draft.sceneId !== scene.sceneId) {
    return "";
  }

  const label = draft.noteType === "research" ? "Research" : "Inspiration";
  const anchor = getInlinePassageDraftAnchor(draft, scene.editorText ?? "", {
    includePendingVerse: true,
  });
  const prompt = anchor
    ? `${label} will save against: ${anchor.selectedText.slice(0, 96)}`
    : `Save this ${label.toLowerCase()} note against the verse typed in the manuscript field below.`;
  return `
    <section
      class="inline-passage-bubble inline-passage-${escapeHtml(draft.noteType)}"
      data-inline-passage-draft
      style="--inline-passage-y:${Math.round(draft.y)}px;"
    >
      <div class="inline-passage-heading">
        <span>${escapeHtml(label)} note</span>
        <strong data-inline-passage-status>${escapeHtml(prompt)}</strong>
        <button class="inline-passage-close" type="button" data-action="cancel-inline-passage-note" aria-label="Cancel ${escapeHtml(label)}">x</button>
      </div>
      <textarea
        data-edit-field="inline-passage-note"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        placeholder="${escapeHtml(getPassageNotePlaceholder(draft.noteType))}"
      >${escapeHtml(draft.body ?? "")}</textarea>
      <label class="inline-passage-verse-shell">
        <span>Typed verse</span>
        <textarea
          class="inline-passage-verse-field"
          data-edit-field="inline-passage-verse"
          data-scene-id="${escapeHtml(scene.sceneId)}"
          placeholder="Type the manuscript verse this note belongs to."
        >${escapeHtml(draft.typedText ?? "")}</textarea>
      </label>
      <div class="inline-passage-actions">
        <span aria-hidden="true"></span>
        <button class="tag-button" type="button" data-inline-passage-save data-action="commit-inline-passage-note">Save to typed verse</button>
      </div>
    </section>
  `;
}

function renderNarrationRecordingTools(scene, selection, session) {
  const statusLabel = session?.status === "recording"
    ? `Recording ${session.elapsedLabel ?? "0:00"}`
    : selection
      ? "Ready to record"
      : "Awaiting verse selection";
  const verseLabel = selection
    ? `Line ${String(selection.lineNumber ?? selection.blockLineNumber ?? "")} · ${selection.kindLabel ?? "Verse"}`
    : "Click a verse to arm recording";
  const trackerLabel = session?.trackerStatus
    ? session.trackerStatus
    : "Speech tracker idle";
  return `
    <div class="editor-inline-setting narration-recording-field">
      <span>Status</span>
      <div class="narration-recording-value ${session?.status === "recording" ? "is-recording" : ""}">${escapeHtml(statusLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Verse</span>
      <div class="narration-recording-value">${escapeHtml(verseLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Tracker</span>
      <div class="narration-recording-value">${escapeHtml(trackerLabel)}</div>
    </div>
    <div class="narration-recording-actions">
      <button
        class="tag-button editor-action-button"
        type="button"
        data-action="${session?.status === "recording" ? "stop-narration-recording" : "start-narration-recording"}"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        ${session?.status === "recording" ? "" : selection ? "" : "disabled"}
      >
        ${session?.status === "recording" ? "Stop recording" : "Start recording"}
      </button>
      <button
        class="tag-button editor-action-button"
        type="button"
        data-action="clear-narration-selection"
        data-scene-id="${escapeHtml(scene.sceneId)}"
        ${selection && session?.status !== "recording" ? "" : "disabled"}
      >
        Clear verse
      </button>
    </div>
  `;
}

function renderEditorSetting(label, prefKey, options, selectedValue) {
  return `
    <label class="editor-inline-setting">
      <span>${escapeHtml(label)}</span>
      <select data-editor-pref="${escapeHtml(prefKey)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>
            ${escapeHtml(option.label)}
          </option>
        `).join("")}
      </select>
    </label>
  `;
}

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

function renderSidePanelTabs() {
  const issueCount = state.workspace.project.issues.length;
  const inspirationCount = state.passageNotes.filter((note) => note.noteType === "inspiration").length;
  const researchCount = state.passageNotes.filter((note) => note.noteType === "research").length;
  return `
    <div class="side-panel-tabs" aria-label="Editor side panel modes">
      ${renderSidePanelTab("issues", "Issues", issueCount)}
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
  const selectedIssue = getIssue(state.selectedIssueId);
  const openTasks = state.manuscriptTasks.filter((task) => task.status === "open");
  const issueGroups = groupConsoleItemsByChapter(workspace.project.issues);

  return `
    <div class="panel-heading">
      <p class="panel-kicker">Issue Console</p>
    </div>
    ${selectedIssue ? renderIssueFocus(selectedIssue) : ""}
    ${renderTaskChapterList(openTasks)}
    ${issueGroups.length
      ? `<div class="console-chapter-list console-list">
          ${issueGroups.map((group) => renderIssueChapterGroup(group)).join("")}
        </div>`
      : ""}
    <div class="panel-heading split-heading">
      <p class="panel-kicker">Event Pinning</p>
      <h2>Major Story Beats</h2>
    </div>
    <div class="event-list">
      ${workspace.project.eventTags.map((eventTag) => renderEvent(eventTag)).join("")}
    </div>
  `;
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
      <span class="passage-note-body">${escapeHtml(note.body.trim() || "Untitled reflection")}</span>
    </div>
  `;
}

function formatImportSourceLabel(source) {
  if (typeof source !== "string" || !source.trim()) {
    return "";
  }

  if (source === "manual") {
    return "Manual";
  }

  if (source === "scrivener-research") {
    return "Scrivener research";
  }

  if (source === "scrivener-front-matter") {
    return "Front matter";
  }

  if (source === "scrivener-comment") {
    return "Scrivener comment";
  }

  if (source === "scrivener-comment-note") {
    return "Comment note";
  }

  if (source === "scrivener-asset") {
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

  return source.replace(/^scrivener-/, "Scrivener ");
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

function renderIssueChapterGroup(group) {
  return renderCollapsibleChapterGroup({
    panelId: "issues",
    chapterKey: group.chapterKey,
    chapterTitle: group.chapterTitle,
    itemCount: group.items.length,
    groupClassName: "console-chapter-group issue-chapter-group",
    headingClassName: "console-chapter-heading",
    childrenClassName: "console-chapter-children",
    bodyHtml: group.items.map((issue) => renderIssue(issue)).join(""),
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

function renderIssue(issue) {
  const isSelected = issue.id === state.selectedIssueId;
  return `
    <button class="console-item ${isSelected ? "is-selected" : ""}" data-action="select-issue" data-issue-id="${escapeHtml(issue.id)}">
      <span class="console-meta">${escapeHtml(issue.severity)} · ${escapeHtml(issue.category)} · scene line ${issue.sceneLineNumber}</span>
      <strong>${escapeHtml(issue.summary)}</strong>
      <span>${escapeHtml(issue.sceneTitle)}</span>
    </button>
  `;
}

function renderIssueFocus(issue) {
  return `
    <div class="focus-card issue-focus">
      <p class="selection-label">Selected Issue</p>
      <h3>${escapeHtml(issue.summary)}</h3>
      <p>${escapeHtml(issue.detail ?? issue.evidenceExcerpt)}</p>
      <div class="focus-meta">
        <span>${escapeHtml(formatChapterDisplayTitle(issue.chapterTitle))}</span>
        <span>${escapeHtml(issue.sceneTitle)}</span>
        <span>Confidence ${Math.round(issue.confidence * 100)}%</span>
      </div>
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
  persistCurrentProjectRecord();
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
  const snapshot = readStoredJson(VOICE_NARRATION_STORAGE_KEY);
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
  if (!("localStorage" in window)) {
    return;
  }

  writeStoredJsonRaw(VOICE_NARRATION_STORAGE_KEY, {
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

function syncSceneDocumentLayout() {
  const editor = document.querySelector("[data-scene-editor]");
  if (!(editor instanceof HTMLElement)) {
    return;
  }

  const textarea = editor.querySelector(".editor-document-input");
  const gutter = editor.querySelector("[data-editor-gutter]");
  if (!(textarea instanceof HTMLTextAreaElement) || !(gutter instanceof HTMLElement)) {
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
  syncInlinePassageDraftLayout();
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

async function loadInitialProjectLibrary() {
  const storedLibrary = normalizeProjectLibrarySnapshot(readStoredJson(EDITOR_PROJECT_LIBRARY_KEY));
  const legacyProjectId =
    storedLibrary.activeProjectId ??
    readStoredJson(EDITOR_ACTIVE_PROJECT_ID_KEY) ??
    null;
  const legacyState = loadLegacyProjectState(legacyProjectId);
  const remoteSeedLibrary = await loadDesktopProjectLibrarySeed();
  const bundledSeedLibrary = remoteSeedLibrary ? null : loadBundledProjectLibrarySeed();
  const workspaceSeedLibrary = remoteSeedLibrary || bundledSeedLibrary || await loadWorkspaceFallbackProjectLibrarySeed();
  const seedLibrary = workspaceSeedLibrary;
  const mergedLibrary = mergeProjectLibrarySnapshots(storedLibrary, seedLibrary, legacyState);
  const activeProjectId = resolveActiveProjectId(
    readStoredJson(EDITOR_ACTIVE_PROJECT_ID_KEY),
    mergedLibrary,
  );
  const library = {
    activeProjectId,
    projects: mergedLibrary.projects,
  };

  writeStoredJsonRaw(EDITOR_PROJECT_LIBRARY_KEY, library);
  writeStoredJsonRaw(EDITOR_ACTIVE_PROJECT_ID_KEY, activeProjectId ?? "");
  return library;
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
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
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
    return JSON.parse(responseText);
  } catch {
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
    projectIntegratorPath: loadStoredString(EDITOR_SCRIVENER_IMPORT_PATH_KEY) ?? "",
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

  const canonicalSeedProject = seedProjects.find((project) => project.source === "scrivener-import") ?? seedProjects[0] ?? null;
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
  const merged = {
    ...cloneValue(seedRecord),
    ...cloneValue(storedRecord),
    id: seedRecord.id,
    title: seedRecord.title,
    source: seedRecord.source ?? storedRecord.source,
    createdAt: seedRecord.createdAt ?? storedRecord.createdAt,
    updatedAt: storedRecord.updatedAt ?? seedRecord.updatedAt,
    workspace: cloneValue(seedRecord.workspace ?? storedRecord.workspace),
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

  if (merged.workspace?.project && typeof merged.workspace.project === "object") {
    merged.workspace.project = {
      ...merged.workspace.project,
      id: seedRecord.id,
      title: seedRecord.title,
    };
  }

  return merged;
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

      if (project.source === "scrivener-import") {
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
  const isImported = seedSource.startsWith("scrivener-") || storedSource.startsWith("scrivener-");

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
    binderPanelWidth: DEFAULT_BINDER_PANEL_WIDTH,
    consoleDockWidth: DEFAULT_CONSOLE_PANEL_WIDTH,
    consoleDockCollapsed: false,
    collapsedChapterIds: [],
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(),
    projectFilePath: "",
    projectIntegratorPath: "",
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
    consoleDockCollapsed: typeof normalizedCandidate.consoleDockCollapsed === "boolean"
      ? normalizedCandidate.consoleDockCollapsed
      : defaults.consoleDockCollapsed,
    collapsedChapterIds: normalizeChapterIdList(
      normalizedCandidate.collapsedChapterIds ?? defaults.collapsedChapterIds,
    ),
    collapsedConsoleChapterIds: createCollapsedConsoleChapterState(
      normalizedCandidate.collapsedConsoleChapterIds ?? defaults.collapsedConsoleChapterIds,
    ),
    projectFilePath: normalizeProjectFilePath(normalizedCandidate.projectFilePath ?? defaults.projectFilePath),
    projectIntegratorPath: normalizeProjectFilePath(normalizedCandidate.projectIntegratorPath ?? defaults.projectIntegratorPath),
    writingTargetState,
    writingTargetViewMode,
    writingTargetSelectedDateKey: selectedDateKey,
    writingTargetCalendarMonthKey: calendarMonth
      ? getWritingTargetMonthKey(calendarMonth)
      : defaults.writingTargetCalendarMonthKey,
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
    consoleDockCollapsed: projectSettings.consoleDockCollapsed ?? candidate?.consoleDockCollapsed,
    collapsedChapterIds: projectSettings.collapsedChapterIds ?? candidate?.collapsedChapterIds,
    collapsedConsoleChapterIds: projectSettings.collapsedConsoleChapterIds ?? candidate?.collapsedConsoleChapterIds,
    projectFilePath: projectSettings.projectFilePath ?? candidate?.projectFilePath,
    projectIntegratorPath: projectSettings.projectIntegratorPath ?? candidate?.projectIntegratorPath,
    writingTargetState: projectSettings.writingTargetState ?? candidate?.writingTargetState,
    writingTargetViewMode: projectSettings.writingTargetViewMode ?? candidate?.writingTargetViewMode,
    writingTargetSelectedDateKey: projectSettings.writingTargetSelectedDateKey ?? candidate?.writingTargetSelectedDateKey,
    writingTargetCalendarMonthKey: projectSettings.writingTargetCalendarMonthKey ?? candidate?.writingTargetCalendarMonthKey,
  };
}

function createProjectSettingsSnapshotFromState({
  currentWordCount = getCurrentManuscriptWordCount(),
  now = new Date(),
} = {}) {
  const projectId = state.workspace?.project?.id ?? state.activeProjectId ?? "";
  const writingTargetWorkingRecord = getWritingTargetWorkingRecord();
  const writingTargetState = writingTargetWorkingRecord
    ? cloneValue(writingTargetWorkingRecord)
    : createDefaultWritingTargetRecord(currentWordCount, now);

  return normalizeProjectSettingsSnapshot(
    {
      editorPrefs: cloneValue(state.editorPrefs),
      localAiPrefs: cloneValue(state.localAiPrefs),
      binderPanelWidth: state.binderPanelWidth,
      consoleDockWidth: state.consoleDockWidth,
      consoleDockCollapsed: state.consoleDockCollapsed,
      collapsedChapterIds: cloneValue(state.collapsedChapterIds),
      collapsedConsoleChapterIds: cloneValue(state.collapsedConsoleChapterIds),
      projectFilePath: state.projectFilePath,
      projectIntegratorPath: state.projectIntegratorPath,
      writingTargetState,
      writingTargetViewMode: state.writingTargetViewMode,
      writingTargetSelectedDateKey: state.writingTargetSelectedDateKey,
      writingTargetCalendarMonthKey: state.writingTargetCalendarMonthKey,
    },
    projectId,
    currentWordCount,
    now,
  );
}

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
    projectIntegratorPath: candidate.projectIntegratorPath ?? legacyState?.projectIntegratorPath,
  }),
    id,
    getWorkspaceManuscriptWordCount(workspace),
    new Date(now),
  );

  return {
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
}

function normalizeSelectionDefaults(candidate, project) {
  return {
    lineId:
      typeof candidate?.lineId === "string" && candidate.lineId.trim()
        ? candidate.lineId
        : project?.lines?.[0]?.blockId ?? "",
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
  const currentWordCount = getWorkspaceManuscriptWordCount(normalizedWorkspace);
  const projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate({
      ...cloneValue(options),
      editorPrefs: options.editorPrefs ?? createDefaultEditorPrefs(),
      localAiPrefs: options.localAiPrefs ?? createDefaultLocalAiPrefs(),
    }),
    id,
    currentWordCount,
    new Date(now),
  );

  return {
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
}

function createProjectLibraryRecordFromState(options = {}) {
  if (!state.workspace) {
    return null;
  }

  const projectSettings = createProjectSettingsSnapshotFromState({
    currentWordCount: getCurrentManuscriptWordCount(),
    now: options.updatedAt ? new Date(options.updatedAt) : new Date(),
  });

  return createProjectLibraryRecordFromWorkspace(state.workspace, {
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

  saveWritingTargetState();
  clearWritingTargetDraft();
  clearWritingTargetSnapshotTimer();
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
  state.selectedTaskId = null;
  state.selectedPassageNoteId = null;
  state.inlinePassageDraft = null;
  state.taskContextMenu = null;
  state.taskComposer = null;
  state.taskPreview = null;
  state.localAiTitleStatus = {};
  const projectSettings = normalizeProjectSettingsSnapshot(
    buildProjectSettingsCandidate(record),
    record.id,
    getWorkspaceManuscriptWordCount(state.workspace),
    new Date(),
  );
  state.editorPrefs = cloneValue(projectSettings.editorPrefs);
  state.localAiPrefs = cloneValue(projectSettings.localAiPrefs);
  state.binderPanelWidth = projectSettings.binderPanelWidth;
  state.consoleDockWidth = projectSettings.consoleDockWidth;
  state.consoleDockCollapsed = projectSettings.consoleDockCollapsed;
  state.collapsedChapterIds = projectSettings.collapsedChapterIds;
  state.collapsedConsoleChapterIds = projectSettings.collapsedConsoleChapterIds;
  state.projectFilePath = projectSettings.projectFilePath;
  state.projectIntegratorPath = projectSettings.projectIntegratorPath;
  state.projectFileHandle = null;
  state.writingTargetViewMode = projectSettings.writingTargetViewMode;
  state.writingTargetSelectedDateKey = projectSettings.writingTargetSelectedDateKey;
  state.writingTargetCalendarMonthKey = projectSettings.writingTargetCalendarMonthKey;
  state.writingTargetProjectId = record.id;
  state.writingTargetState = cloneValue(projectSettings.writingTargetState);
  writeStoredJsonRaw(EDITOR_PROJECT_FILE_PATH_KEY, state.projectFilePath);
  writeStoredJsonRaw(EDITOR_SCRIVENER_IMPORT_PATH_KEY, state.projectIntegratorPath);
  writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, state.binderPanelWidth);
  writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, state.consoleDockWidth);
  persistConsoleDockCollapsedState(state.consoleDockCollapsed);
  persistCollapsedChapterState(record.id, state.collapsedChapterIds);
  persistCollapsedConsoleChapterState(record.id, state.collapsedConsoleChapterIds);
  const writingTargetStore = readWritingTargetStore();
  writingTargetStore[record.id] = cloneValue(state.writingTargetState);
  writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, writingTargetStore);
  syncLegacyProjectStorageFromState();
}

function syncLegacyProjectStorageFromState() {
  if (!state.workspace) {
    return;
  }

  writeStoredJsonRaw(EDITOR_PROJECT_TITLE_KEY, state.projectTitle);
  writeStoredJsonRaw(EDITOR_PROJECT_FILE_PATH_KEY, state.projectFilePath);
  writeStoredJsonRaw(EDITOR_SCRIVENER_IMPORT_PATH_KEY, state.projectIntegratorPath);
  writeStoredJsonRaw(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  writeStoredJsonRaw(EDITOR_STRUCTURE_KEY, state.structureDrafts);
  writeStoredJsonRaw(EDITOR_TEMPLATE_DRAFTS_KEY, state.templateDrafts);
  writeStoredJsonRaw(EDITOR_TASKS_KEY, state.manuscriptTasks);
  writeStoredJsonRaw(EDITOR_PASSAGE_NOTES_KEY, state.passageNotes);
  writeStoredJsonRaw(EDITOR_PREFS_KEY, state.editorPrefs);
  writeStoredJsonRaw(EDITOR_LOCAL_AI_PREFS_KEY, state.localAiPrefs);
}

function persistCurrentProjectRecord() {
  const record = createProjectLibraryRecordFromState();
  if (!record) {
    return;
  }

  const nextProjects = state.projectLibrary.some((project) => project.id === record.id)
    ? state.projectLibrary.map((project) => (project.id === record.id ? record : project))
    : [...state.projectLibrary, record];

  state.projectLibrary = nextProjects;
  state.activeProjectId = record.id;
  state.projectLibrarySelectionId = record.id;

  const snapshot = {
    activeProjectId: record.id,
    projects: nextProjects,
  };
  writeStoredJsonRaw(EDITOR_PROJECT_LIBRARY_KEY, snapshot);
  writeStoredJsonRaw(EDITOR_ACTIVE_PROJECT_ID_KEY, record.id);
}

function loadSelectedProject() {
  const projectId = state.projectLibrarySelectionId ?? state.activeProjectId;
  const record = state.projectLibrary.find((project) => project.id === projectId) ?? state.projectLibrary[0];
  if (!record) {
    return;
  }

  applyProjectRecord(record);
  writeStoredJsonRaw(EDITOR_ACTIVE_PROJECT_ID_KEY, record.id);
  refreshScenes();
  state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
  state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
  state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;
  syncSelectionFromBlock(
    state.workspace.selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null,
  );
  syncWritingTargetState({ forceReload: true });
  render();
  recordWritingTargetSnapshot({ immediate: true, reason: "load-project" });
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

function normalizeProjectFilePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getSuggestedProjectFilePath() {
  const title = normalizeProjectFileName(state.projectTitle || state.workspace?.project?.title || "Untitled Project");
  const projectRoot = typeof state.workspace?.settings?.projectRoot === "string"
    ? state.workspace.settings.projectRoot.trim()
    : "";
  const fileName = `${title || "untitled-project"}.abe-project.json`;
  if (!projectRoot) {
    return fileName;
  }

  const normalizedRoot = projectRoot.replace(/[\\/]+$/, "");
  return `${normalizedRoot}\\${fileName}`;
}

function normalizeProjectFileName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getSuggestedProjectFileName() {
  const title = normalizeProjectFileName(state.projectTitle || state.workspace?.project?.title || "Untitled Project");
  return `${title || "untitled-project"}.abe-project.json`;
}

function canUseBrowserSavePicker() {
  return typeof window.showSaveFilePicker === "function";
}

function canUseBrowserOpenPicker() {
  return typeof window.showOpenFilePicker === "function";
}

function getProjectFilePickerTypes() {
  return [
    {
      description: "ABetterNovelAuthoringEnvironment project file",
      accept: {
        "application/json": [".json"],
      },
    },
  ];
}

function getProjectFileInputAccept() {
  return ".json,application/json";
}

function hasProjectFilePath(value) {
  const normalized = normalizeProjectFilePath(value);
  return Boolean(normalized) && /[\\/]/.test(normalized);
}

function hasProjectFileDestination() {
  return Boolean(state.projectFileHandle || hasProjectFilePath(state.projectFilePath));
}

function setProjectFilePath(pathValue, handle = null) {
  state.projectFilePath = normalizeProjectFilePath(pathValue);
  state.projectFileHandle = handle;
  writeStoredJsonRaw(EDITOR_PROJECT_FILE_PATH_KEY, state.projectFilePath);
  persistCurrentProjectRecord();
}

function createProjectLibrarySnapshotForFile() {
  persistCurrentProjectRecord();
  return {
    activeProjectId: state.activeProjectId ?? state.projectLibrarySelectionId ?? state.projectLibrary[0]?.id ?? null,
    projects: cloneValue(state.projectLibrary),
  };
}

async function saveProjectLibraryToBrowserHandle(handle, snapshot = createProjectLibrarySnapshotForFile()) {
  if (!handle) {
    throw new Error("A browser file handle is required.");
  }

  state.projectFileBusy = true;
  state.projectFileStatus = "Saving project file...";
  renderHeader();

  try {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
    const savedLabel = handle.name || getSuggestedProjectFileName();
    setProjectFilePath(savedLabel, handle);
    state.projectFileStatus = `Saved to ${savedLabel}`;
    reportBrowserLog("info", "project-file", "Saved the current project file.", {
      filePath: savedLabel,
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
      title: state.projectTitle,
      mode: "browser-handle",
    });
    renderHeader();
    return savedLabel;
  } catch (error) {
    state.projectFileStatus = `Save failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-file", "Project file save failed.", {
      filePath: handle?.name ?? null,
      error,
      mode: "browser-handle",
    });
    renderHeader();
    throw error;
  } finally {
    state.projectFileBusy = false;
    renderHeader();
  }
}

async function saveProjectLibraryToFile(filePath, snapshot = createProjectLibrarySnapshotForFile()) {
  const resolvedPath = normalizeProjectFilePath(filePath);
  if (!resolvedPath) {
    throw new Error("A project file path is required.");
  }

  state.projectFileBusy = true;
  state.projectFileStatus = "Saving project file...";
  renderHeader();

  try {
    const response = await fetchJsonFromDesktopApi("/api/project-file/save", {
      method: "POST",
      body: {
        filePath: resolvedPath,
        snapshot,
      },
    });

    if (!response.ok) {
      throw response.error ?? new Error("Project file save failed.");
    }

    const savedPath = typeof response.value?.filePath === "string" && response.value.filePath.trim()
      ? response.value.filePath.trim()
      : resolvedPath;
    setProjectFilePath(savedPath, null);
    state.projectFileStatus = `Saved to ${savedPath}`;
    reportBrowserLog("info", "project-file", "Saved the current project file.", {
      filePath: savedPath,
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
      title: state.projectTitle,
      mode: "desktop-path",
    });
    renderHeader();
    return savedPath;
  } catch (error) {
    state.projectFileStatus = `Save failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-file", "Project file save failed.", {
      filePath: resolvedPath,
      error,
      mode: "desktop-path",
    });
    renderHeader();
    throw error;
  } finally {
    state.projectFileBusy = false;
    renderHeader();
  }
}

async function loadProjectLibrarySnapshotIntoState(loadedSnapshot, options = {}) {
  const loadedLibrary = normalizeProjectLibrarySnapshot(loadedSnapshot);
  const loadedProjects = loadedLibrary.projects
    .map((project) => normalizeProjectRecord(project))
    .filter(Boolean);
  if (!loadedProjects.length) {
    throw new Error("Project file did not contain any saved projects.");
  }
  const currentProjects = state.projectLibrary
    .map((project) => normalizeProjectRecord(project))
    .filter(Boolean);
  const loadedProjectIds = new Set(loadedProjects.map((project) => project.id));
  const preservedProjects = currentProjects.filter((project) => !loadedProjectIds.has(project.id));
  const mergedProjects = [...preservedProjects, ...loadedProjects];
  const activeProjectId = resolveActiveProjectId(
    loadedLibrary.activeProjectId,
    {
      activeProjectId: loadedLibrary.activeProjectId,
      projects: mergedProjects,
    },
  );

  state.projectLibrary = mergedProjects;
  state.activeProjectId = activeProjectId;
  state.projectLibrarySelectionId = activeProjectId;
  writeStoredJsonRaw(EDITOR_PROJECT_LIBRARY_KEY, {
    activeProjectId,
    projects: mergedProjects,
  });
  writeStoredJsonRaw(EDITOR_ACTIVE_PROJECT_ID_KEY, activeProjectId ?? "");

  const record = getActiveProjectRecord();
  if (!record) {
    throw new Error("Unable to activate the loaded project file.");
  }

  applyProjectRecord(record);
  if (typeof options.filePath === "string" && options.filePath.trim()) {
    setProjectFilePath(options.filePath, options.fileHandle ?? null);
  }
  refreshScenes();
  state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
  state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
  state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;
  syncSelectionFromBlock(
    state.workspace.selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null,
  );
  syncWritingTargetState({ forceReload: true });
  state.projectFileStatus = `Loaded ${mergedProjects.length} project${mergedProjects.length === 1 ? "" : "s"} from ${options.sourceLabel ?? "file"}`;
  render();
  recordWritingTargetSnapshot({ immediate: true, reason: options.reason ?? "load-project-file" });

  if (state.workspace?.project?.stats) {
    reportBrowserLog("info", "project-file", "Loaded a project library from disk.", {
      filePath: options.filePath ?? null,
      projectId: record.id,
      title: record.title,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
      mode: options.mode ?? "unknown",
    });
  }
}

async function loadProjectLibraryFromBrowserHandle(handle) {
  if (!handle) {
    throw new Error("A browser file handle is required.");
  }

  state.projectFileBusy = true;
  state.projectFileStatus = "Loading project file...";
  renderHeader();

  try {
    const file = await handle.getFile();
    await loadProjectLibraryFromBrowserFile(file, {
      filePath: handle.name || getSuggestedProjectFileName(),
      fileHandle: handle,
      sourceLabel: "browser file",
      reason: "load-project-file",
      mode: "browser-handle",
    });
  } catch (error) {
    state.projectFileStatus = `Load failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-file", "Project file load failed.", {
      filePath: handle.name ?? null,
      error,
      mode: "browser-handle",
    });
    renderHeader();
  } finally {
    state.projectFileBusy = false;
    renderHeader();
  }
}

async function loadProjectLibraryFromBrowserFile(file, options = {}) {
  if (!file) {
    throw new Error("A browser file is required.");
  }

  state.projectFileBusy = true;
  state.projectFileStatus = "Loading project file...";
  renderHeader();

  try {
    const content = await file.text();
    const snapshot = JSON.parse(content.replace(/^\uFEFF/, ""));
    await loadProjectLibrarySnapshotIntoState(snapshot, {
      filePath: typeof options.filePath === "string" && options.filePath.trim()
        ? options.filePath
        : file.name || getSuggestedProjectFileName(),
      fileHandle: options.fileHandle ?? null,
      sourceLabel: options.sourceLabel ?? "browser file",
      reason: options.reason ?? "load-project-file",
      mode: options.mode ?? "browser-file",
    });
  } catch (error) {
    state.projectFileStatus = `Load failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-file", "Project file load failed.", {
      filePath: file.name ?? null,
      error,
      mode: options.mode ?? "browser-file",
    });
    renderHeader();
  } finally {
    state.projectFileBusy = false;
    renderHeader();
  }
}

function promptForProjectFileFromInput() {
  return new Promise((resolve, reject) => {
    if (!document.body) {
      resolve(null);
      return;
    }

    const input = document.createElement("input");
    let settled = false;

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      window.removeEventListener("focus", handleWindowFocus);
      input.remove();
    };

    const finish = (file) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(file);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const handleChange = () => {
      finish(input.files?.[0] ?? null);
    };

    const handleCancel = () => {
      finish(null);
    };

    const handleWindowFocus = () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.setTimeout(() => {
        if (!settled) {
          finish(input.files?.[0] ?? null);
        }
      }, 50);
    };

    input.type = "file";
    input.accept = getProjectFileInputAccept();
    input.multiple = false;
    input.tabIndex = -1;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "-9999px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    window.addEventListener("focus", handleWindowFocus);
    document.body.appendChild(input);

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (error) {
      fail(error);
    }
  });
}

function downloadProjectLibrarySnapshot(snapshot, fileName = getSuggestedProjectFileName()) {
  const resolvedFileName = normalizeProjectFilePath(fileName) || getSuggestedProjectFileName();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = resolvedFileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  return resolvedFileName;
}

async function loadProjectLibraryFromFile() {
  if (canUseBrowserOpenPicker()) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: getProjectFilePickerTypes(),
      });
      if (!handle) {
        state.projectFileStatus = "Load cancelled.";
        renderHeader();
        return;
      }

      await loadProjectLibraryFromBrowserHandle(handle);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        state.projectFileStatus = "Load cancelled.";
        renderHeader();
        return;
      }

      // Fall back to the path-based route below.
      state.projectFileStatus = `Load picker unavailable: ${error instanceof Error ? error.message : String(error)}`;
      renderHeader();
    }
  }

  try {
    const file = await promptForProjectFileFromInput();
    if (file) {
      await loadProjectLibraryFromBrowserFile(file, {
        filePath: file.name || getSuggestedProjectFileName(),
        fileHandle: null,
        sourceLabel: "browser file",
        reason: "load-project-file",
        mode: "browser-input",
      });
      return;
    }

    state.projectFileStatus = "Load cancelled.";
    renderHeader();
    return;
  } catch (error) {
    state.projectFileStatus = `Load picker unavailable: ${error instanceof Error ? error.message : String(error)}`;
    renderHeader();
  }

  const filePath = normalizeProjectFilePath(state.projectFilePath);
  if (!filePath) {
    state.projectFileStatus = "Enter a project file path first.";
    renderHeader();
    return;
  }

  state.projectFileBusy = true;
  state.projectFileStatus = "Loading project file...";
  renderHeader();

  try {
    const response = await fetchJsonFromDesktopApi("/api/project-file/load", {
      method: "POST",
      body: {
        filePath,
      },
    });

    if (!response.ok) {
      throw response.error ?? new Error("Project file load failed.");
    }

    await loadProjectLibrarySnapshotIntoState(response.value, {
      filePath,
      fileHandle: null,
      sourceLabel: "desktop file",
      reason: "load-project-file",
      mode: "desktop-path",
    });
  } catch (error) {
    state.projectFileStatus = `Load failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-file", "Project file load failed.", {
      filePath,
      error,
      mode: "desktop-path",
    });
    renderHeader();
  } finally {
    state.projectFileBusy = false;
    renderHeader();
  }
}

async function saveCurrentProject() {
  commitWritingTargetDraft();
  recordWritingTargetSnapshot({ immediate: true, reason: "save-project" });
  if (state.projectFileHandle) {
    try {
      await saveProjectLibraryToBrowserHandle(state.projectFileHandle);
    } catch {
      // The browser-library save still succeeded; the file status now carries the error.
    }
    renderHeader();
    if (state.workspace?.project?.stats) {
      reportBrowserLog("info", "project-library", "Saved current project to library.", {
        projectId: state.activeProjectId ?? state.workspace.project.id,
        title: state.projectTitle,
        chapters: state.workspace.project.stats.chapterCount,
        scenes: state.workspace.project.stats.sceneCount,
        templates: state.workspace.world?.stats?.templateCount ?? 0,
        target: "browser-handle",
      });
    }
    return;
  }

  const filePath = normalizeProjectFilePath(state.projectFilePath);
  if (filePath) {
    try {
      await saveProjectLibraryToFile(filePath);
    } catch {
      // The browser-library save still succeeded; the file status now carries the error.
    }
  } else {
    state.projectFileStatus = "Saved to the browser project library. Use Save as file to create a manuscript file.";
    renderHeader();
  }
  renderHeader();
  if (state.workspace?.project?.stats) {
    reportBrowserLog("info", "project-library", "Saved current project to library.", {
      projectId: state.activeProjectId ?? state.workspace.project.id,
      title: state.projectTitle,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
      target: state.projectFileHandle ? "browser-handle" : "desktop-path",
    });
  }
}

async function saveCurrentProjectFileAs() {
  if (canUseBrowserSavePicker()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: getSuggestedProjectFileName(),
        types: getProjectFilePickerTypes(),
      });
      commitWritingTargetDraft();
      setProjectFilePath(handle.name || getSuggestedProjectFileName(), handle);
      const snapshot = createProjectLibrarySnapshotForFile();
      await saveProjectLibraryToBrowserHandle(handle, snapshot);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        state.projectFileStatus = "Save As cancelled.";
        renderHeader();
        return;
      }

      state.projectFileStatus = `Save picker unavailable: ${error instanceof Error ? error.message : String(error)}`;
      renderHeader();
    }
  }

  const typedPath = normalizeProjectFilePath(state.projectFilePath);
  if (hasProjectFilePath(typedPath)) {
    commitWritingTargetDraft();
    setProjectFilePath(typedPath, null);
    const snapshot = createProjectLibrarySnapshotForFile();
    await saveProjectLibraryToFile(typedPath, snapshot);
    return;
  }

  commitWritingTargetDraft();
  const snapshot = createProjectLibrarySnapshotForFile();
  const downloadedName = downloadProjectLibrarySnapshot(snapshot, typedPath || getSuggestedProjectFileName());
  state.projectFileStatus = `Downloaded ${downloadedName}. Use Load file to reopen it later.`;
  renderHeader();
}

function createProject() {
  const now = new Date().toISOString();
  const baseWorkspace = state.workspace ?? state.projectLibrary[0]?.workspace;
  const title = "Untitled Project";
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
  applyProjectRecord(record);
  refreshScenes();
  state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
  state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
  state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;
  syncSelectionFromBlock(
    state.workspace.selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null,
  );
  syncWritingTargetState({ forceReload: true });
  setProjectFilePath(getSuggestedProjectFilePath(), null);
  persistCurrentProjectRecord();
  render();
  recordWritingTargetSnapshot({ immediate: true, reason: "create-project" });
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

async function importScrivenerProject() {
  const projectPath = state.projectIntegratorPath.trim();
  if (!projectPath) {
    state.projectIntegratorStatus = "Enter a local Scrivener project path.";
    renderHeader();
    return;
  }

  state.projectIntegratorBusy = true;
  state.projectIntegratorStatus = "Importing Scrivener project...";
  renderHeader();

  try {
    const response = await fetchJsonFromDesktopApi("/api/project-integrator", {
      method: "POST",
      body: {
        projectPath,
      },
    });

    if (!response.ok) {
      throw response.error ?? new Error("Scrivener import failed.");
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

    state.projectLibrary = mergedLibrary.projects;
    state.activeProjectId = activeProjectId;
    state.projectLibrarySelectionId = activeProjectId;
    writeStoredJsonRaw(EDITOR_PROJECT_LIBRARY_KEY, {
      activeProjectId,
      projects: mergedLibrary.projects,
    });
    writeStoredJsonRaw(EDITOR_ACTIVE_PROJECT_ID_KEY, activeProjectId ?? "");

    const record = getActiveProjectRecord();
    if (!record) {
      throw new Error("Unable to activate the imported Scrivener project.");
    }

    applyProjectRecord(record);
    refreshScenes();
    state.selectedIssueId = state.workspace.selectionDefaults.issueId ?? null;
    state.selectedNodeId = state.workspace.selectionDefaults.nodeId ?? null;
    state.selectedEntityId = state.workspace.selectionDefaults.entityId ?? null;
    syncSelectionFromBlock(
      state.workspace.selectionDefaults.lineId ?? state.scenes[0]?.blocks[0]?.blockId ?? null,
    );
    syncWritingTargetState({ forceReload: true });
    if (state.workspace?.project?.stats) {
      state.projectIntegratorStatus = `Imported ${record.title} · ${state.workspace.project.stats.chapterCount} chapters, ${state.workspace.project.stats.sceneCount} scenes`;
    }
    render();
    recordWritingTargetSnapshot({ immediate: true, reason: "import-project" });

    if (state.workspace?.project?.stats) {
      reportBrowserLog("info", "project-integrator", "Imported a Scrivener project into saved projects.", {
        projectPath,
        projectId: record.id,
        title: record.title,
        chapters: state.workspace.project.stats.chapterCount,
        scenes: state.workspace.project.stats.sceneCount,
        templates: state.workspace.world?.stats?.templateCount ?? 0,
      });
    }
  } catch (error) {
    state.projectIntegratorStatus = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    reportBrowserLog("error", "project-integrator", "Scrivener project import failed.", {
      projectPath,
      error,
    });
    renderHeader();
  } finally {
    state.projectIntegratorBusy = false;
    renderHeader();
  }
}

function createBlankWorkspaceSnapshot(baseWorkspace, projectId, title, now) {
  const templateWorkspace = cloneValue(baseWorkspace ?? state.workspace ?? {});
  const workspaceTitle =
    typeof templateWorkspace.workspaceTitle === "string" && templateWorkspace.workspaceTitle.trim()
      ? templateWorkspace.workspaceTitle
      : "ABetterNovelAuthoringEnvironment";
  const project = {
    id: projectId,
    title,
    binder: {
      id: projectId,
      kind: "project",
      refId: projectId,
      title,
      order: 1,
      children: [],
    },
    stats: {
      chapterCount: 0,
      sceneCount: 0,
      lineCount: 0,
      issueCount: 0,
      eventCount: 0,
      characterCount: 0,
    },
    navigationTargets: {},
    lines: [],
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
          chapterId: "",
          sceneId: "",
          blockId: "",
          paragraphId: "",
          startOffset: 0,
          endOffset: 0,
        },
        currentLineNumber: 0,
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
      lineId: "",
    },
  };
}

function loadSceneDrafts() {
  const candidate = readStoredJson(EDITOR_DRAFTS_KEY);
  return candidate && typeof candidate === "object" ? candidate : {};
}

function loadStructureDrafts() {
  const candidate = readStoredJson(EDITOR_STRUCTURE_KEY);
  return candidate && typeof candidate === "object"
    ? candidate
    : createStructureDrafts();
}

function loadTemplateDrafts() {
  const candidate = readStoredJson(EDITOR_TEMPLATE_DRAFTS_KEY);
  return Array.isArray(candidate) ? candidate : createTemplateDrafts();
}

function loadManuscriptTasks() {
  return normalizeManuscriptTasks(readStoredJson(EDITOR_TASKS_KEY));
}

function loadPassageNotes() {
  return normalizePassageNotes(readStoredJson(EDITOR_PASSAGE_NOTES_KEY));
}

function loadProjectTitle(defaultTitle) {
  const candidate = readStoredJson(EDITOR_PROJECT_TITLE_KEY);
  return typeof candidate === "string" && candidate.trim()
    ? candidate
    : defaultTitle;
}

function loadEditorPrefs() {
  return normalizeEditorPrefs(readStoredJson(EDITOR_PREFS_KEY));
}

function loadLocalAiPrefs() {
  return normalizeLocalAiPrefs(readStoredJson(EDITOR_LOCAL_AI_PREFS_KEY));
}

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

function selectWorkspacePane(paneId) {
  const normalizedPaneId = paneId === "voice" ? "narration" : paneId;

  if (!["manuscript", "world", "narration"].includes(normalizedPaneId)) {
    return;
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

  // Keep the current caret/viewport position when the user clicks blank editor
  // space. Jumping to the end of the scene makes the editor feel like it is
  // dragging the viewport away from the current reading position.
  textarea.focus({ preventScroll: true });
  return true;
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
  centerEditorOnOffset(textarea, startOffset, options);
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
  centerEditorOnOffset(textarea, textarea.selectionStart);
}

function centerEditorOnOffset(textarea, offset, options = {}) {
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

function openPassageNoteComposerFromContextMenu(noteType) {
  const menu = state.taskContextMenu;
  if (!menu || (noteType !== "inspiration" && noteType !== "research")) {
    return;
  }

  state.sidePanelMode = noteType;
  state.taskContextMenu = null;
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
  });

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

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(startOffset, endOffset, "forward");
  centerEditorOnOffset(textarea, startOffset, options);
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
    const response = await fetch("/api/local-ai/generate-title", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userInput,
        manuscriptContext,
        projectContext,
        outputFormat: "text",
        maxTokens,
        temperature: 0.25,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "Local AI unavailable",
      };
    }

    const payload = await response.json();
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
  if (!state.taskContextMenu) {
    return;
  }

  state.taskContextMenu = null;
  renderTaskContextMenu();
}

function hideTaskSurfaces() {
  if (!state.taskContextMenu && !state.taskComposer) {
    return;
  }

  state.taskContextMenu = null;
  state.taskComposer = null;
  renderTaskContextMenu();
}

function updateSceneDraft(sceneId, mutate) {
  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  const draft = cloneValue(state.sceneDrafts[sceneId] ?? createSceneDraft(scene));
  mutate(draft);
  state.sceneDrafts = {
    ...state.sceneDrafts,
    [sceneId]: draft,
  };
  writeStoredJson(EDITOR_DRAFTS_KEY, state.sceneDrafts);
  refreshScenes();
  renderHeader();
  syncWritingTargetWindowLiveState();
  queueWritingTargetSnapshot();
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
  queueWritingTargetSnapshot();
}

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

function selectSceneById(sceneId) {
  const scene = getScene(sceneId);
  if (!scene) {
    return;
  }

  state.selectedIssueId = null;
  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId = scene.blocks[0]?.blockId ?? null;
  render();
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

  state.selectedSceneId = scene.sceneId;
  state.selectedBlockId =
    blockId && scene.blocks.some((block) => block.blockId === blockId)
      ? blockId
      : scene.blocks[0]?.blockId ?? null;
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

function updateSceneTitleLabel(sceneId, title) {
  document
    .querySelectorAll(`[data-scene-title-id="${CSS.escape(sceneId)}"] span:last-child`)
    .forEach((node) => {
      node.textContent = title;
    });
}

function updateFocusedLineCard() {
  renderConsolePanel();
}

function readStoredJson(storageKey) {
  if (!("localStorage" in window)) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    reportBrowserLog("warn", "storage", `Unable to read ${storageKey}.`, { error, storageKey });
    console.warn(`Unable to read ${storageKey}`, error);
    return null;
  }
}

function loadCollapsedChapterIds(projectId) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return [];
  }

  const candidate = readStoredJson(EDITOR_COLLAPSED_CHAPTERS_KEY);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return [];
  }

  return normalizeChapterIdList(candidate[projectId]);
}

function persistCollapsedChapterState(projectId, chapterIds) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return;
  }

  const candidate = readStoredJson(EDITOR_COLLAPSED_CHAPTERS_KEY);
  const snapshot = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? { ...candidate }
    : {};
  const normalizedChapterIds = normalizeChapterIdList(chapterIds);

  if (normalizedChapterIds.length) {
    snapshot[projectId] = normalizedChapterIds;
  } else {
    delete snapshot[projectId];
  }

  if (Object.keys(snapshot).length) {
    writeStoredJsonRaw(EDITOR_COLLAPSED_CHAPTERS_KEY, snapshot);
    return;
  }

  if ("localStorage" in window) {
    window.localStorage.removeItem(EDITOR_COLLAPSED_CHAPTERS_KEY);
  }
}

function loadCollapsedConsoleChapterIds(projectId) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    };
  }

  const candidate = readStoredJson(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    };
  }

  const snapshot = candidate[projectId];
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {
      issueTasks: [],
      issues: [],
      inspiration: [],
      research: [],
    };
  }

  return {
    issueTasks: normalizeChapterIdList(snapshot.issueTasks),
    issues: normalizeChapterIdList(snapshot.issues),
    inspiration: normalizeChapterIdList(snapshot.inspiration),
    research: normalizeChapterIdList(snapshot.research),
  };
}

function persistCollapsedConsoleChapterState(projectId, collapsedByPanel) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    return;
  }

  const candidate = readStoredJson(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
  const snapshot = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? { ...candidate }
    : {};
  const normalized = {
    issueTasks: normalizeChapterIdList(collapsedByPanel?.issueTasks),
    issues: normalizeChapterIdList(collapsedByPanel?.issues),
    inspiration: normalizeChapterIdList(collapsedByPanel?.inspiration),
    research: normalizeChapterIdList(collapsedByPanel?.research),
  };

  if (
    normalized.issueTasks.length ||
    normalized.issues.length ||
    normalized.inspiration.length ||
    normalized.research.length
  ) {
    snapshot[projectId] = normalized;
  } else {
    delete snapshot[projectId];
  }

  if (Object.keys(snapshot).length) {
    writeStoredJsonRaw(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY, snapshot);
    return;
  }

  if ("localStorage" in window) {
    window.localStorage.removeItem(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
  }
}

function normalizeChapterIdList(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return [...new Set(candidate.filter((chapterId) => typeof chapterId === "string" && chapterId.trim()))];
}

function persistConsoleDockCollapsedState(isCollapsed) {
  if (!("localStorage" in window)) {
    return;
  }

  try {
    if (isCollapsed) {
      window.localStorage.setItem(EDITOR_RIGHT_DOCK_COLLAPSED_KEY, JSON.stringify(true));
    } else {
      window.localStorage.removeItem(EDITOR_RIGHT_DOCK_COLLAPSED_KEY);
    }
  } catch (error) {
    reportBrowserLog("warn", "storage", "Unable to persist console dock state.", {
      error,
      storageKey: EDITOR_RIGHT_DOCK_COLLAPSED_KEY,
    });
    console.warn("Unable to persist console dock state", error);
  }
}

function syncLayoutWidths(persist = false) {
  const workspace = document.querySelector(".workspace-grid");
  const binderWidth = clampNumber(state.binderPanelWidth, MIN_BINDER_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const consoleWidth = clampNumber(state.consoleDockWidth, MIN_CONSOLE_PANEL_WIDTH, Number.POSITIVE_INFINITY);
  const currentConsoleWidth = state.consoleDockCollapsed
    ? CONSOLE_DOCK_COLLAPSED_WIDTH
    : consoleWidth;

  let nextBinderWidth = binderWidth;
  let nextConsoleWidth = consoleWidth;

  if (workspace instanceof HTMLElement && workspace.getBoundingClientRect().width > 0) {
    const rect = workspace.getBoundingClientRect();
    const availableWidth = Math.max(0, rect.width - (PANEL_RESIZER_WIDTH * 2));
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
    writeStoredJsonRaw(EDITOR_BINDER_WIDTH_KEY, state.binderPanelWidth);
    writeStoredJsonRaw(EDITOR_CONSOLE_WIDTH_KEY, state.consoleDockWidth);
    persistCurrentProjectRecord();
  }
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(Math.max(numericValue, min), max);
}

function loadStoredString(storageKey) {
  const candidate = readStoredJson(storageKey);
  return typeof candidate === "string" && candidate.trim() ? candidate : "";
}

function loadStoredNumber(storageKey, fallback) {
  const candidate = readStoredJson(storageKey);
  const value = Number(candidate);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function writeStoredJson(storageKey, value) {
  writeStoredJsonRaw(storageKey, value);

  if (PROJECT_STATE_STORAGE_KEYS.has(storageKey)) {
    persistCurrentProjectRecord();
  }
}

function writeStoredJsonRaw(storageKey, value) {
  if (!("localStorage" in window)) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    reportBrowserLog("warn", "storage", `Unable to write ${storageKey}.`, { error, storageKey });
    console.warn(`Unable to write ${storageKey}`, error);
  }
}

function registerRuntimeLogging() {
  window.addEventListener("error", (event) => {
    reportBrowserLog("error", "window", event.message || "Unhandled browser error.", {
      message: event.message,
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
  });
}

function reportBrowserLog(level, scope, message, context = {}) {
  const payload = {
    level,
    scope,
    message,
    context: serializeBrowserLogContext(context),
  };

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      navigator.sendBeacon("/api/log", blob);
      return;
    }
  } catch {
    // Ignore sendBeacon problems and fall back to fetch.
  }

  void fetch("/api/log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
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

const PROJECT_STATE_STORAGE_KEYS = new Set([
  EDITOR_DRAFTS_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
]);

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
