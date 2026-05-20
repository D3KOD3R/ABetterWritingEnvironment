// Intent: own all writing-goals panel interactions behind a stable service boundary.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";
import { getSessionTrackerVisualState } from "../progress-tracker.js";
import { renderSessionTrackerPenSvg as renderSessionTrackerPenGlyph } from "../../session-tracker-icons.js";
import { renderWritingTargetWindowHTML } from "./writing-target-window.js";

// Intent: browser adapter for writing-goals behavior so app workflow logic stays portable.
export function createWritingGoalsService(deps = {}) {
  const {
    state,
    windowRef,
    documentRef,
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
    writingGoalsLogger,
    writingGoalsLogSourceName = "WritingGoalsService",
    getDeveloperLogEntries,
    WRITING_TARGET_CADENCE_OPTIONS,
    WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
    WRITING_TARGET_METRIC_KEYS,
    WRITING_TARGET_MAX_SESSION_SAMPLES,
  } = deps;

  const window = windowRef ?? globalThis.window;
  const document = documentRef ?? globalThis.document;

  let writingTargetWindowRefreshTimer = null;
  let sessionTrackerRefreshTimer = null;
  let writingTargetSnapshotTimer = null;
  const writingTargetDebugMetricCheckpointSignatures = new Map();
  const WRITING_TARGET_LOG_SERVICE = "writing-goals";

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
  slot.innerHTML = renderWritingTargetWindowHTML({
    summary,
    dashboard,
    selectedEntry,
    dashboardCards,
    renderWritingTargetArchiveEntry,
    cadenceOptions: WRITING_TARGET_CADENCE_OPTIONS,
    maxSessionTargetsPerDay: WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY,
    minSessionTimeoutMinutes: WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    maxSessionTimeoutMinutes: WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  });
}

function getWritingGoalsLoggerEntries() {
  const entries = typeof getDeveloperLogEntries === "function" ? getDeveloperLogEntries() : [];
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => entry?.source === writingGoalsLogSourceName);
}

function buildWritingTargetDebugTerminalSummary() {
  const entries = getWritingGoalsLoggerEntries();
  const recentEntries = entries.slice(-120);
  const recentErrorCount = recentEntries.filter((entry) => normalizeLogLevel(entry?.level) === "error").length;
  const lastEntry = entries[entries.length - 1] ?? null;
  const lastEntryLabel = lastEntry?.timestamp
    ? new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(lastEntry.timestamp))
    : "";

  return {
    open: false,
    entryCount: entries.length,
    recentErrorCount,
    lastEventLabel: lastEntryLabel,
  };
}

function normalizeLogLevel(level) {
  if (level === "debug" || level === "info" || level === "warn" || level === "error") {
    return level;
  }

  return "info";
}

function resolveWritingTargetLogGateKey(checkpoint) {
  const normalizedCheckpoint = typeof checkpoint === "string" ? checkpoint.trim() : "";
  if (!normalizedCheckpoint) {
    return "service";
  }

  if (normalizedCheckpoint.startsWith("window.")) {
    return "ui";
  }

  if (
    normalizedCheckpoint.startsWith("persist.")
    || normalizedCheckpoint.startsWith("project.")
  ) {
    return "persistence";
  }

  if (
    normalizedCheckpoint.startsWith("session.")
    || normalizedCheckpoint.startsWith("session-tracker.")
  ) {
    return "session";
  }

  if (normalizedCheckpoint.startsWith("logger.")) {
    return "logger";
  }

  if (normalizedCheckpoint.startsWith("runtime.")) {
    return "runtime";
  }

  if (normalizedCheckpoint.startsWith("scene-draft.")) {
    return "typing";
  }

  if (
    normalizedCheckpoint.startsWith("snapshot.")
    || normalizedCheckpoint === "metric.summary"
    || normalizedCheckpoint === "metric.word-count"
    || normalizedCheckpoint === "metric.daily-baseline"
    || normalizedCheckpoint === "metric.normalize-record"
  ) {
    return "snapshot";
  }

  if (normalizedCheckpoint.startsWith("metric.")) {
    return "metrics";
  }

  return "service";
}

function resolveWritingTargetLogCategory(checkpoint) {
  const gate = resolveWritingTargetLogGateKey(checkpoint);
  if (gate === "ui") {
    return "user-action";
  }
  if (gate === "persistence") {
    return "persistence";
  }
  if (gate === "session") {
    return "state-change";
  }
  if (gate === "runtime") {
    return "lifecycle";
  }
  if (gate === "typing") {
    return "state-change";
  }
  if (gate === "metrics" || gate === "snapshot") {
    return "performance";
  }
  return "lifecycle";
}

function shouldWriteWritingTargetLog(level) {
  const normalizedLevel = normalizeLogLevel(level);
  if (normalizedLevel === "error" || normalizedLevel === "warn") {
    return true;
  }

  // Intent: avoid building and serializing high-frequency diagnostics unless this source is actively enabled.
  if (writingGoalsLogger && typeof writingGoalsLogger.isEnabled === "function") {
    return writingGoalsLogger.isEnabled();
  }

  return typeof postJsonToDesktopHost === "function";
}

// Intent: capture writing-goal metric events at stable checkpoints without flooding unchanged values.
function logWritingTargetMetricCheckpoint(checkpoint, context = {}, options = {}) {
  const normalizedCheckpoint = String(checkpoint ?? "").trim();
  if (!normalizedCheckpoint) {
    return;
  }
  if (!shouldWriteWritingTargetLog("info")) {
    return;
  }

  const serializedContext = serializeBrowserLogContext(context ?? {});
  const signature = buildWritingTargetMetricCheckpointSignature(serializedContext);
  const previousSignature = writingTargetDebugMetricCheckpointSignatures.get(normalizedCheckpoint);
  if (previousSignature === signature && options.force !== true) {
    return;
  }

  writingTargetDebugMetricCheckpointSignatures.set(normalizedCheckpoint, signature);
  logWritingTargetDebugEvent("info", normalizedCheckpoint, "Writing-goal metric checkpoint.", serializedContext, options);
}

function buildWritingTargetMetricCheckpointSignature(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

function logWritingTargetDebugEvent(level, checkpoint, message, context = {}, options = {}) {
  // Intent: writing-goals diagnostics flow through the shared Developer Logs service so there is one logger surface.
  const normalizedLevel = normalizeLogLevel(level);
  const normalizedCheckpoint = String(checkpoint ?? "").trim() || "writing-target";
  if (!shouldWriteWritingTargetLog(normalizedLevel)) {
    return;
  }

  const category = resolveWritingTargetLogCategory(normalizedCheckpoint);
  const safeContext = serializeBrowserLogContext(context ?? {});
  const baseContext = {
    ...safeContext,
    projectId: state.workspace?.project?.id ?? "",
    sceneId: state.selectedSceneId ?? "",
    gate: resolveWritingTargetLogGateKey(normalizedCheckpoint),
  };

  if (writingGoalsLogger && typeof writingGoalsLogger[normalizedLevel] === "function") {
    const entry = writingGoalsLogger[normalizedLevel](
      category,
      normalizedCheckpoint,
      typeof message === "string" && message.trim() ? message.trim() : "Writing goals event.",
      baseContext,
    );
    if (entry || (normalizedLevel !== "warn" && normalizedLevel !== "error")) {
      return;
    }
  }

  if (typeof postJsonToDesktopHost === "function") {
    void postJsonToDesktopHost("/api/log", {
      level: normalizedLevel,
      scope: WRITING_TARGET_LOG_SERVICE,
      message,
      context: baseContext,
    }, {
      logTransport: false,
    });
  }
}

// Intent: refresh live writing-goal counters without repainting the full application shell.
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
  refreshWritingTargetSessionLifecycle();
  syncHeaderLiveState();
}

function resolveProjectAutosaveIndicatorLiveModel() {
  const enabled = state?.editorPrefs?.projectFileAutosaveEnabled === true;
  if (!enabled) {
    return {
      statusKey: "off",
      statusLabel: "Off",
      note: "Project-file autosave is disabled.",
      toneClass: "is-off",
    };
  }

  const connected = typeof hasProjectFileDestination === "function"
    ? hasProjectFileDestination() === true
    : false;
  if (!connected) {
    if (state?.projectFileHandle && state?.projectFileHandlePermission !== "granted") {
      return {
        statusKey: "waiting",
        statusLabel: "Needs permission",
        note: "Press Ctrl+S to re-authorize the project file.",
        toneClass: "is-waiting",
      };
    }

    return {
      statusKey: "waiting",
      statusLabel: "Waiting",
      note: "Select a project file destination.",
      toneClass: "is-waiting",
    };
  }

  if (state?.projectFileBusy === true) {
    return {
      statusKey: "saving",
      statusLabel: "Saving",
      note: "Writing project snapshot.",
      toneClass: "is-saving",
    };
  }

  if ((Number(state?.projectFileAutosaveSuppressionDepth) || 0) > 0) {
    return {
      statusKey: "suppressed",
      statusLabel: "Suppressed",
      note: "Paused while project changes are batched.",
      toneClass: "is-suppressed",
    };
  }

  if (state?.projectFileAutosaveDirty === true) {
    return {
      statusKey: "pending",
      statusLabel: "Pending",
      note: "Queued for idle save.",
      toneClass: "is-pending",
    };
  }

  return {
    statusKey: "ready",
    statusLabel: "Ready",
    note: "Project file is in sync.",
    toneClass: "is-ready",
  };
}

function syncProjectAutosaveIndicatorLiveState(heroSlot) {
  if (!(heroSlot instanceof HTMLElement)) {
    return;
  }

  const indicator = heroSlot.querySelector("[data-project-autosave-indicator]");
  if (!(indicator instanceof HTMLElement)) {
    return;
  }

  const status = indicator.querySelector("[data-project-autosave-status]");
  const note = indicator.querySelector("[data-project-autosave-note]");
  const model = resolveProjectAutosaveIndicatorLiveModel();
  indicator.dataset.statusKey = model.statusKey;
  indicator.classList.remove("is-off", "is-waiting", "is-pending", "is-saving", "is-suppressed", "is-ready", "is-unknown");
  indicator.classList.add(model.toneClass);
  indicator.setAttribute("title", model.note);
  if (status instanceof HTMLElement) {
    status.textContent = model.statusLabel;
  }
  if (note instanceof HTMLElement) {
    note.textContent = model.note;
  }
}

function syncHeaderLiveState() {
  const heroSlot = document.querySelector("#hero-slot");
  if (!(heroSlot instanceof HTMLElement)) {
    return;
  }

  const summary = buildWritingTargetSummary();
  if (!summary) {
    return;
  }

  const wordsStat = heroSlot.querySelector('[data-stat-key="words"] [data-stat-value]');
  if (wordsStat instanceof HTMLElement) {
    wordsStat.textContent = formatDisplayNumber(getCurrentManuscriptWordCount());
  }

  const writingTargetToggle = heroSlot.querySelector("[data-writing-target-toggle-value]");
  if (writingTargetToggle instanceof HTMLElement) {
    writingTargetToggle.textContent = summary.goalButtonLabel ?? "Writing Goals";
  }

  const debugTerminalSummary = buildWritingTargetDebugTerminalSummary();
  const debugToggleButton = heroSlot.querySelector(".writing-target-debug-toggle");
  if (debugToggleButton instanceof HTMLElement) {
    debugToggleButton.classList.toggle("is-open", debugTerminalSummary.open === true);
    debugToggleButton.setAttribute("aria-pressed", debugTerminalSummary.open ? "true" : "false");
  }
  const debugMeta = heroSlot.querySelector(".desktop-target-strip__tools-meta");
  if (debugMeta instanceof HTMLElement) {
    const debugMetaLabel = [
      `${formatDisplayNumber(debugTerminalSummary.entryCount)} events`,
      debugTerminalSummary.recentErrorCount > 0 ? `${formatDisplayNumber(debugTerminalSummary.recentErrorCount)} errors` : "",
      debugTerminalSummary.lastEventLabel ? `Last ${debugTerminalSummary.lastEventLabel}` : "",
    ].filter(Boolean).join(" · ");
    debugMeta.textContent = debugMetaLabel || "No goal logs yet";
  }
  syncProjectAutosaveIndicatorLiveState(heroSlot);

  const strip = heroSlot.querySelector("[data-writing-target-strip]");
  const visibleMetrics = Array.isArray(summary.visibleMetrics) ? summary.visibleMetrics : [];
  if (strip instanceof HTMLElement) {
    for (const metric of visibleMetrics) {
      if (!metric || typeof metric !== "object") {
        continue;
      }

      const card = strip.querySelector(`[data-writing-target-card="${CSS.escape(String(metric.key ?? ""))}"]`);
      if (!(card instanceof HTMLElement)) {
        continue;
      }

      const label = card.querySelector("[data-writing-target-card-label]");
      const value = card.querySelector("[data-writing-target-card-value]");
      const bar = card.querySelector("[data-writing-target-card-bar]");
      const progress = card.querySelector("[data-writing-target-card-progress]");
      const foot = card.querySelector("[data-writing-target-card-foot]");
      const note = card.querySelector("[data-writing-target-card-note]");
      const metricProgress = Math.max(0, Math.min(1, Number(metric.progress ?? 0)));
      const footContent = metric.comparison
        ? `
            <span>${escapeHtml(metric.leftLabel ?? "")}</span>
            <span aria-hidden="true">→</span>
            <span>${escapeHtml(metric.rightLabel ?? "")}</span>
          `
        : `
            <span>${escapeHtml(metric.leftLabel ?? "")}</span>
            <span>${escapeHtml(metric.rightLabel ?? "")}</span>
          `;

      if (label instanceof HTMLElement) {
        label.lastElementChild ? label.lastElementChild.textContent = String(metric.label ?? "") : label.textContent = String(metric.label ?? "");
      }
      if (value instanceof HTMLElement) {
        value.textContent = String(metric.value ?? "—");
      }
      if (bar instanceof HTMLElement) {
        bar.className = `writing-target-bar ${String(metric.barClass ?? "").trim()}`.trim();
        if (typeof metric.barStyle === "string" && metric.barStyle.trim()) {
          bar.setAttribute("style", metric.barStyle);
        } else {
          bar.setAttribute("style", "");
        }
      }
      if (progress instanceof HTMLElement) {
        progress.style.width = `${Math.round(metricProgress * 100)}%`;
        if (typeof metric.barStyle === "string" && metric.barStyle.trim()) {
          progress.setAttribute("style", `width:${Math.round(metricProgress * 100)}%;${metric.barStyle}`);
        } else {
          progress.setAttribute("style", `width:${Math.round(metricProgress * 100)}%;`);
        }
      }
      if (foot instanceof HTMLElement) {
        foot.className = `writing-target-foot${metric.comparison ? " is-comparison" : ""}`;
        foot.innerHTML = footContent;
      }
      if (note instanceof HTMLElement) {
        note.textContent = String(metric.note ?? "");
      } else if (metric.note) {
        card.insertAdjacentHTML("beforeend", `<p class="writing-target-note" data-writing-target-card-note>${escapeHtml(metric.note ?? "")}</p>`);
      }
    }
  }

  const panel = document.querySelector("#hero-slot [data-session-tracker-panel]");
  if (!(panel instanceof HTMLElement)) {
    return;
  }

  patchSessionTrackerPanel(panel, summary);
}

function patchSessionTrackerPanel(panel, summary) {
  if (!(panel instanceof HTMLElement) || !summary) {
    return;
  }

  const tracker = {
    clockLabel: summary.sessionCurrentTimeLabel ?? "—",
    wordsWrittenLabel: formatDisplayNumber(Math.round(summary.currentSessionWords ?? 0)),
    wordsTargetLabel: formatDisplayNumber(Math.round(summary.sessionTargetWordsPerSession ?? 0)),
    sessionStartTimeLabel: summary.sessionStartTimeLabel ?? "—",
    sessionMinutesLapsedLabel: summary.sessionMinutesLapsedLabel ?? "0",
    sessionIdleLabel: summary.sessionIdleLabel ?? "Idle",
    wpmLabel: summary.sessionWordsPerMinuteLabel ?? "0/min",
  };
  const isLiveSession = summary.sessionIsActive === true;
  const isPaceActive = summary.sessionPaceActive === true;
  const visualState = getSessionTrackerVisualState(summary, null);
  const paceStatus = isPaceActive
    ? summary.sessionWordsPerMinuteOverTarget
      ? "You’re outperforming"
      : summary.sessionWordsPerMinuteStatusText === "On track"
        ? "You’re on pace"
        : summary.sessionWordsPerMinuteStatusText === "Ahead of pace"
          ? "You’re outperforming"
          : "Need more pace"
    : "Idle";
  const progressWidth = Math.max(0, Math.min(100, Math.round((Math.max(0, Number(summary.currentSessionWords ?? 0)) / Math.max(1, Number(summary.sessionTargetWordsPerSession ?? 0))) * 100)));
  const paceColor = isPaceActive
    ? summary.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"
    : "rgba(31, 36, 48, 0.26)";
  const bar = panel.querySelector("[data-session-tracker-bar]");
  const gauge = panel.querySelector("[data-session-tracker-gauge]");
  const gaugeIcon = panel.querySelector("[data-session-tracker-gauge-icon]");
  const clock = panel.querySelector("[data-session-tracker-clock]");
  const wpm = panel.querySelector("[data-session-tracker-wpm]");
  const paceNote = panel.querySelector("[data-session-tracker-pace-note]");
  const startTime = panel.querySelector("[data-session-tracker-start-time]");
  const lapsedLabel = panel.querySelector("[data-session-tracker-lapsed-label]");
  const lapsedValue = panel.querySelector("[data-session-tracker-lapsed-value]");
  const wordsWritten = panel.querySelector("[data-session-tracker-words-written]");
  const wordsTarget = panel.querySelector("[data-session-tracker-words-target]");
  const progressFill = panel.querySelector("[data-session-tracker-progress-fill]");

  if (bar instanceof HTMLElement) {
    bar.style.setProperty("--writing-target-bar-color", paceColor);
    bar.classList.toggle("is-over-target", visualState.key === "flaming");
  }

  if (gauge instanceof HTMLElement) {
    gauge.classList.toggle("is-over-target", visualState.key === "flaming");
  }

  if (gaugeIcon instanceof HTMLElement) {
    gaugeIcon.innerHTML = renderSessionTrackerPenGlyph(visualState.key);
  }

  if (clock instanceof HTMLElement) {
    clock.textContent = tracker.clockLabel;
  }

  if (wpm instanceof HTMLElement) {
    wpm.textContent = tracker.wpmLabel;
  }

  if (paceNote instanceof HTMLElement) {
    paceNote.textContent = paceStatus;
  }

  if (startTime instanceof HTMLElement) {
    startTime.textContent = tracker.sessionStartTimeLabel;
  }

  if (lapsedLabel instanceof HTMLElement) {
    lapsedLabel.textContent = isLiveSession ? "Lapsed:" : "Idle:";
  }

  if (lapsedValue instanceof HTMLElement) {
    lapsedValue.textContent = isLiveSession
      ? tracker.sessionMinutesLapsedLabel
      : tracker.sessionIdleLabel;
  }

  if (wordsWritten instanceof HTMLElement) {
    wordsWritten.textContent = tracker.wordsWrittenLabel;
  }

  if (wordsTarget instanceof HTMLElement) {
    wordsTarget.textContent = tracker.wordsTargetLabel;
  }

  if (progressFill instanceof HTMLElement) {
    progressFill.style.width = `${progressWidth}%`;
  }
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
    refreshWritingTargetSessionLifecycle();
    syncSessionTrackerLiveState();
  }, 15000);
  refreshWritingTargetSessionLifecycle();
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
    visibleMetricsVersion: WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
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
    visibleMetricsVersion: nextRecord.visibleMetricsVersion,
    visibleMetrics: [...nextRecord.visibleMetrics],
  };
  state.writingTargetDraftProjectId = state.workspace?.project?.id ?? null;
  syncWritingTargetCanonicalState(state.writingTargetDraft);
  renderHeader();
  renderWritingTargetWindow();
}


function toggleWritingTargetWindow() {
  if (state.writingTargetWindowOpen) {
    closeWritingTargetWindow();
    return;
  }

  state.writingTargetWindowOpen = true;
  logWritingTargetDebugEvent("info", "window.open", "Opened writing goals window.", {
    projectId: state.workspace?.project?.id ?? "",
  }, {
    skipUpload: true,
  });
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
  logWritingTargetDebugEvent("info", "window.close", "Closed writing goals window.", {
    projectId: state.workspace?.project?.id ?? "",
  }, {
    skipUpload: true,
  });
  renderHeader();
  renderWritingTargetWindow();
}

function saveWritingTargetGoals() {
  stopWritingTargetWindowRefreshTimer();
  if (!state.writingTargetWindowOpen) {
    return;
  }

  beginProjectFileAutosaveSuppression();
  logWritingTargetDebugEvent("info", "window.save-goals", "Saved writing-goals settings.", {
    projectId: state.workspace?.project?.id ?? "",
  });
  commitWritingTargetDraft();
  state.writingTargetWindowOpen = false;
  renderHeader();
  renderWritingTargetWindow();
  if (hasProjectFileDestination()) {
    const savePromise = saveCurrentProject();
    if (false) {
      void saveCurrentProject();
    }
    if (savePromise && typeof savePromise.finally === "function") {
      savePromise.finally(() => {
        endProjectFileAutosaveSuppression();
      });
      return;
    }
  }

  endProjectFileAutosaveSuppression();
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
    persistCurrentProjectRecord({
      domain: "writing-goals",
      skipProjectFileAutosave: true,
      dirtyReason: "writing-target-cancel",
      source: "cancelWritingTargetGoals",
      markWorkingState: false,
    });
  }
  logWritingTargetDebugEvent("info", "window.cancel-goals", "Cancelled writing-goals edits and restored baseline.", {
    projectId: state.workspace?.project?.id ?? "",
    restoredBaseline: Boolean(baseline),
  }, {
    skipUpload: true,
  });
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
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: true,
    dirtyReason: "writing-target-ui-state",
    source: "setWritingTargetViewMode",
  });
  renderWritingTargetWindow();
}

function selectWritingTargetDay(dateKey) {
  if (!isWritingTargetDateKey(dateKey)) {
    return;
  }

  state.writingTargetSelectedDateKey = dateKey;
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(parseLocalDateKey(dateKey) ?? new Date());
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: true,
    dirtyReason: "writing-target-ui-state",
    source: "selectWritingTargetDay",
  });
  renderWritingTargetWindow();
}

function shiftWritingTargetCalendarMonth(monthOffset) {
  const currentMonth = parseWritingTargetMonthKey(state.writingTargetCalendarMonthKey) ?? new Date();
  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + Number(monthOffset || 0), 1, 12, 0, 0, 0);
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(nextMonth);
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: true,
    dirtyReason: "writing-target-ui-state",
    source: "shiftWritingTargetCalendarMonth",
  });
  renderWritingTargetWindow();
}

function jumpWritingTargetCalendarToToday() {
  const today = new Date();
  state.writingTargetSelectedDateKey = getLocalDateKey(today);
  state.writingTargetCalendarMonthKey = getWritingTargetMonthKey(today);
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: true,
    dirtyReason: "writing-target-ui-state",
    source: "jumpWritingTargetCalendarToToday",
  });
  renderWritingTargetWindow();
}

function resetWritingSession() {
  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return;
  }

  const now = new Date();
  const currentWordCount = getCurrentManuscriptWordCount();
  const nextRecord = {
    ...cloneValue(record),
    sessionIsActive: true,
    sessionBaselineWordCount: currentWordCount,
    sessionStartedAt: now.toISOString(),
    sessionLastActiveAt: now.toISOString(),
    sessionConcludedAt: "",
    sessionConcludedReason: "",
    sessionLastWordCount: currentWordCount,
    sessionSamples: [createWritingTargetSessionSample(currentWordCount, now)],
    updatedAt: now.toISOString(),
  };

  state.writingTargetState = persistWritingTargetState(nextRecord);
  logWritingTargetDebugEvent("info", "session.reset", "Reset writing session baseline.", {
    projectId: state.workspace?.project?.id ?? "",
    sessionBaselineWordCount: currentWordCount,
  });
  clearWritingTargetDraft();
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: true,
    dirtyReason: "session-tracker-snapshot",
    source: "resetWritingSession",
    markWorkingState: false,
  });
  renderHeader();
  renderWritingTargetWindow();
}

function saveWritingTargetState(options = {}) {
  commitWritingTargetDraft(options);
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
    const markSessionActivity = options.markSessionActivity === true;
    const nextSessionRecord = markSessionActivity
      ? (record.sessionIsActive === true
        ? cloneValue(record)
        : resumeWritingSession(record, currentWordCount, now, {
            reason: normalizeWritingTargetSessionActivityReason(options.reason),
          }))
      : null;

    if (currentEntry) {
      history[history.findIndex((entry) => entry.date === dateKey)] = nextHistoryEntry;
    } else {
      history.push(nextHistoryEntry);
    }

    nextRecord.history = trimWritingTargetHistory(history, nextRecord.lookbackDays);
    const resolvedDailyBaselineWordCount = resolveWritingTargetDailyBaselineWordCount({
      record: nextRecord,
      currentWordCount,
      now,
    });
    const storedDailyBaselineWordCount = Number(nextRecord.dailyBaselineWordCount);
    if (previousDailyBaselineDateKey !== dateKey) {
      nextRecord.dailyBaselineDateKey = dateKey;
      nextRecord.dailyBaselineWordCount = resolvedDailyBaselineWordCount;
    } else if (!Number.isFinite(storedDailyBaselineWordCount) || storedDailyBaselineWordCount <= 0) {
      nextRecord.dailyBaselineWordCount = resolvedDailyBaselineWordCount;
    }
    if (nextSessionRecord) {
      nextRecord.sessionIsActive = true;
      nextRecord.sessionStartedAt = nextSessionRecord.sessionStartedAt;
      nextRecord.sessionBaselineWordCount = nextSessionRecord.sessionBaselineWordCount;
      nextRecord.sessionLastWordCount = currentWordCount;
      nextRecord.sessionConcludedAt = "";
      nextRecord.sessionConcludedReason = "";
      nextRecord.sessionSamples = normalizeWritingTargetSessionSamples(nextSessionRecord.sessionSamples ?? []);
      if (record.sessionIsActive === true) {
        nextRecord.sessionSamples = [
          ...nextRecord.sessionSamples,
          createWritingTargetSessionSample(currentWordCount, now),
        ].slice(-WRITING_TARGET_MAX_SESSION_SAMPLES);
      }
      nextRecord.sessionLastActiveAt = now.toISOString();
    }
    nextRecord.updatedAt = now.toISOString();
    state.writingTargetState = persistWritingTargetState(nextRecord);

    const shouldSkipProjectFileAutosave = options.skipProjectFileAutosave !== false;
    logWritingTargetDebugEvent("info", "snapshot.capture", "Captured writing-target snapshot.", {
      reason: options.reason ?? "snapshot",
      dirtyReason: options.dirtyReason ?? "writing-target-snapshot",
      source: "recordWritingTargetSnapshot",
      markSessionActivity,
      currentWordCount,
      previousDailyBaselineDateKey,
      nextDailyBaselineDateKey: nextRecord.dailyBaselineDateKey,
      nextDailyBaselineWordCount: nextRecord.dailyBaselineWordCount,
      historyEntries: Array.isArray(nextRecord.history) ? nextRecord.history.length : 0,
      sessionIsActive: nextRecord.sessionIsActive === true,
      skipProjectFileAutosave: shouldSkipProjectFileAutosave,
    });
    persistCurrentProjectRecord({
      domain: "writing-goals",
      skipProjectFileAutosave: shouldSkipProjectFileAutosave,
      dirtyReason: options.dirtyReason ?? "writing-target-snapshot",
      source: "recordWritingTargetSnapshot",
      markWorkingState: options.markWorkingState === true,
    });
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
        sessionIsActive: nextRecord.sessionIsActive,
        sessionStartedAt: nextRecord.sessionStartedAt,
        sessionBaselineWordCount: nextRecord.sessionBaselineWordCount,
        sessionConcludedAt: nextRecord.sessionConcludedAt,
        sessionConcludedReason: nextRecord.sessionConcludedReason,
        sessionLastWordCount: nextRecord.sessionLastWordCount,
        sessionHistory: cloneValue(nextRecord.sessionHistory),
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

function queueWritingTargetSnapshot(options = {}) {
  recordWritingTargetSnapshot(options);
}

function clearWritingTargetSnapshotTimer() {
  if (!writingTargetSnapshotTimer) {
    return;
  }

  window.clearTimeout(writingTargetSnapshotTimer);
  writingTargetSnapshotTimer = null;
}

function logWritingTargetLoadCheckpoint(reason = "load-project") {
  const record = getWritingTargetWorkingRecord();
  const summary = record ? buildWritingTargetSummaryForRecord(record) : null;
  logWritingTargetDebugEvent("info", "session-tracker.load-state", "Captured session tracker state after project load.", {
    reason,
    projectId: state.workspace?.project?.id ?? "",
    selectedSceneId: state.selectedSceneId ?? "",
    sessionIsActive: summary?.sessionIsActive === true,
    sessionStatusText: summary?.sessionStatusText ?? "",
    currentWordCount: summary?.currentWordCount ?? 0,
    currentSessionWords: summary?.currentSessionWords ?? 0,
    sessionTargetWordsPerSession: summary?.sessionTargetWordsPerSession ?? 0,
    sessionBaselineWordCount: summary?.syncedRecord?.sessionBaselineWordCount ?? null,
    dailyBaselineWordCount: summary?.syncedRecord?.dailyBaselineWordCount ?? null,
  });
}

  return {
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
  };
}
