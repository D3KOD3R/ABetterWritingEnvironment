// Intent: isolate writing-goals domain state/metrics/persistence logic behind a dedicated service boundary.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";

export function createWritingGoalsStateService(deps = {}) {
  const {
    state,
    readStoredJson,
    writeStoredJsonRaw,
    getProjectRecordById,
    getActiveProjectRecord,
    getSelectedScene,
    countRemainingTasksByChapter,
    cloneValue,
    persistCurrentProjectRecord,
    logWritingTargetDebugEvent,
    logWritingTargetMetricCheckpoint,
    buildWritingTargetDebugTerminalSummary,
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
  } = deps;

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

function commitWritingTargetDraft(options = {}) {
  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return null;
  }

  const persisted = persistWritingTargetState(record);
  state.writingTargetState = persisted;
  clearWritingTargetDraft();
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: options.skipProjectFileAutosave === true,
    dirtyReason: options.dirtyReason ?? "writing-target-settings",
    source: options.source ?? "commitWritingTargetDraft",
  });
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

  // Intent: count the manuscript once per persistence pass so logging and normalization do not re-scan scenes.
  const currentWordCount = getCurrentManuscriptWordCount();
  const normalized = normalizeWritingTargetRecord(
    record,
    currentWordCount,
    new Date(),
  );
  const store = readWritingTargetStore();
  store[projectId] = normalized;
  writeStoredJsonRaw(EDITOR_WRITING_TARGETS_KEY, store);
  logWritingTargetDebugEvent("info", "persist.writing-target-state", "Persisted writing-target state.", {
    projectId,
    currentWordCount,
    targetWords: normalized.targetWords,
    sessionTargetWords: normalized.sessionTargetWords,
    sessionIsActive: normalized.sessionIsActive === true,
    dailyBaselineDateKey: normalized.dailyBaselineDateKey,
    dailyBaselineWordCount: normalized.dailyBaselineWordCount,
    historyEntries: Array.isArray(normalized.history) ? normalized.history.length : 0,
  });
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
  persistCurrentProjectRecord({
    domain: "writing-goals",
    dirtyReason: "writing-target-settings",
    source: "syncWritingTargetCanonicalState",
  });
  return persisted;
}

function buildWritingTargetSummary() {
  const summary = buildWritingTargetSummaryForRecord(getWritingTargetWorkingRecord());
  if (!summary || typeof summary !== "object") {
    return summary;
  }

  return {
    ...summary,
    debugTerminal: buildWritingTargetDebugTerminalSummary(),
  };
}

function buildWritingTargetSummaryForRecord(record) {
  if (!record) {
    return null;
  }

  const currentWordCount = getCurrentManuscriptWordCount();
  const now = new Date();
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
  // Intent: keep session progress math non-negative while still surfacing deletion deltas in the display model.
  const sessionWordsDelta = currentWordCount - syncedRecord.sessionBaselineWordCount;
  const sessionWords = Math.max(0, sessionWordsDelta);
  const dailyBaselineWordCount = resolveWritingTargetDailyBaselineWordCount({
    record: syncedRecord,
    currentWordCount,
    now,
  });
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
  const sessionLifecycle = getWritingTargetSessionLifecycle(syncedRecord, now);
  const sessionIsLive = sessionLifecycle.sessionDisplayActive === true;
  const sessionLifecycleSummaryText = buildWritingTargetSessionLifecycleSummaryText(sessionLifecycle);
  const sessionInactiveMinutes = sessionLifecycle.sessionLastActiveAt && !Number.isNaN(sessionLifecycle.sessionLastActiveAt.getTime())
    ? Math.max(0, (now.getTime() - sessionLifecycle.sessionLastActiveAt.getTime()) / 60000)
    : Number.POSITIVE_INFINITY;
  const sessionPaceActive = sessionIsLive && sessionInactiveMinutes < WRITING_TARGET_SESSION_PACE_STALE_MINUTES;
  const recentSessionWordsPerMinute = sessionPaceActive
    ? estimateRecentSessionWordsPerMinute(syncedRecord, now)
    : null;
  const sessionElapsedMinutes = sessionPaceActive
    ? Math.max(1 / 60, sessionLifecycle.activeMinutes)
    : 0;
  const sessionWordsPerMinute = sessionPaceActive
    ? (recentSessionWordsPerMinute != null
      ? recentSessionWordsPerMinute
      : sessionElapsedMinutes > 0
        ? sessionWords / sessionElapsedMinutes
        : 0)
    : 0;
  const sessionWordsPerHour = sessionWordsPerMinute * 60;
  const sessionRequiredWordsPerMinute = sessionTimeoutMinutes > 0
    ? sessionTargetWordsPerSession / sessionTimeoutMinutes
    : 0;
  const sessionWordsPerMinuteRatio = sessionRequiredWordsPerMinute > 0
    ? sessionWordsPerMinute / sessionRequiredWordsPerMinute
    : 0;
  const sessionWordsPerMinuteOverTarget = sessionPaceActive && sessionRequiredWordsPerMinute > 0
    && sessionWordsPerMinute > sessionRequiredWordsPerMinute;
  const sessionWordsPerMinuteBarColor = sessionPaceActive
    ? buildSessionPaceColor(sessionWordsPerMinuteRatio)
    : "rgba(31, 36, 48, 0.26)";
  const sessionTargetWordsRemaining = Math.max(0, sessionTargetWordsPerSession - currentSessionWords);
  const sessionProjectedMilestoneMinutes = sessionWordsPerMinute > 0
    ? sessionTargetWordsRemaining / sessionWordsPerMinute
    : null;
  const sessionProjectedMilestoneLabel =
    sessionTargetWordsRemaining <= 0
      ? "Milestone reached"
      : sessionPaceActive && sessionProjectedMilestoneMinutes != null
        ? `${formatDurationMinutes(sessionProjectedMilestoneMinutes)} to milestone`
        : "Idle";
  const sessionMilestoneStatusText =
    sessionTargetWordsRemaining <= 0
      ? "Milestone reached"
      : sessionPaceActive && sessionProjectedMilestoneMinutes != null && sessionProjectedMilestoneMinutes <= sessionTimeoutMinutes
        ? "On track"
      : sessionPaceActive && sessionProjectedMilestoneMinutes != null
          ? "Off track"
          : "Idle";
  const sessionWordsPerMinuteLabel = `${formatDisplayNumber(Math.round(sessionWordsPerMinute))}/min`;
  const sessionRequiredWordsPerMinuteLabel = `${formatDisplayNumber(Math.round(sessionRequiredWordsPerMinute))}/min`;
  const sessionWordsPerMinuteSummaryText = sessionTargetWordsRemaining <= 0
    ? "Milestone reached"
    : sessionPaceActive
      ? `${sessionWordsPerMinuteLabel} now · ${sessionRequiredWordsPerMinuteLabel} needed`
      : "Idle";
  const sessionWordsPerMinuteStatusText = sessionPaceActive
    ? sessionWordsPerMinuteOverTarget
      ? "Ahead of pace"
      : sessionWordsPerMinuteRatio >= 0.95
        ? "On track"
        : "Off track"
    : "Idle";
  const sessionPaceSummaryText = sessionPaceActive
    ? `${formatDisplayNumber(Math.round(sessionWordsPerHour))}/h · ${sessionProjectedMilestoneLabel}`
    : "Idle";
  const sessionPaceRatio = sessionPaceActive ? Math.max(0, sessionWordsPerMinuteRatio) : 0;
  const sessionPacePercentLabel = `${formatDisplayNumber(Math.round(sessionPaceRatio * 100))}%`;
  const sessionCurrentTimeLabel = formatClockTimeLabel(now);
  const sessionStartTimeLabel = formatClockTimeLabel(sessionLifecycle.sessionStartedAt ?? now);
  const sessionMinutesLapsed = sessionIsLive
    ? Math.max(0, Math.floor(sessionLifecycle.activeMinutes))
    : 0;
  const sessionMinutesLapsedLabel = formatDisplayNumber(sessionMinutesLapsed);
  const sessionElapsedLabel = sessionIsLive
    ? formatSessionElapsedLabel(sessionLifecycle.activeMinutes, sessionTimeoutMinutes)
    : "Idle";
  const sessionLastActiveMinutes = sessionLifecycle.idleMinutes;
  const sessionStatusText = sessionIsLive
    ? sessionLastActiveMinutes == null
      ? "Session baseline set"
      : `Active · idle ${formatMinuteCount(sessionLastActiveMinutes)}`
    : "Idle";
  const sessionIdleLabel = sessionIsLive
    ? sessionLastActiveMinutes != null
      ? `${formatMinuteCount(sessionLastActiveMinutes)} idle`
      : "Active"
    : `${formatMinuteCount(sessionLastActiveMinutes ?? 0)} idle`;
  const goalSyncSource = getWritingTargetGoalSyncSource(syncedRecord);
  const effectiveWordsPerDay = Math.max(0, pace.wordsPerDay || 0);
  const targetPaceWordsPerDay = Math.max(0, Number(targetWordsPerDay) || 0);
  const projectionWordsPerDay = goalSyncSource === "sessionTargetWords"
    ? targetPaceWordsPerDay
    : effectiveWordsPerDay;
  // Intent: daily-target mode is a plan projection; release-date mode remains an actual-pace forecast.
  const projectedDaysToTarget = projectionWordsPerDay > 0 ? remainingWords / projectionWordsPerDay : null;
  const projectedCompletionDate = projectedDaysToTarget != null ? addDays(now, projectedDaysToTarget) : null;
  const daysUntilRelease = releaseDate ? getWritingTargetDaysUntilDate(releaseDate, now) : null;
  const requiredDailyWords =
    goalSyncSource === "releaseDate" && releaseDate && daysUntilRelease != null && daysUntilRelease > 0
      ? Math.max(0, Math.ceil(remainingWords / daysUntilRelease))
      : null;
  const projectedReleaseGap = goalSyncSource === "releaseDate" && releaseDate && projectedCompletionDate
    ? Math.ceil((startOfLocalDay(projectedCompletionDate).getTime() - startOfLocalDay(releaseDate).getTime()) / 86400000)
    : null;
  const releaseTrackStatus = goalSyncSource === "sessionTargetWords"
    ? projectedCompletionDate
      ? "Projected from daily target"
      : "Set a daily target"
    : releaseDate
    ? projectedReleaseGap == null
      ? "Need more writing history"
      : projectedReleaseGap <= 0
        ? "On track"
        : `Off track by ${formatDayCount(projectedReleaseGap)}`
    : `Track ${lookbackDays} days`;
  const visibleMetrics = normalizeWritingTargetVisibleMetrics(
    syncedRecord.visibleMetrics,
    syncedRecord.visibleMetricsVersion,
  )
    .map((metricKey) => buildWritingTargetMetric(metricKey, {
      record: syncedRecord,
      currentWordCount,
      sessionWords,
      dailyWords,
      sessionsPerDay,
      sessionTargetWordsPerSession,
      currentSessionIndex,
      currentSessionWords: sessionWordsDelta,
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
      goalSyncSource,
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
  const projectionStartDate = goalSyncSource === "sessionTargetWords" ? now : releaseDate;
  const releaseComparisonLabel = projectionStartDate
    ? `${formatGoalDateLabel(projectionStartDate)} → ${projectedCompletionDate ? formatGoalDateLabel(projectedCompletionDate) : "—"}`
    : "";
  const goalSyncHint = goalSyncSource === "releaseDate"
    ? "Release date recalculates the target pace."
    : "Daily target projects the completion date.";
  const streakSummary = buildWritingTargetStreakSummary(syncedRecord.history);
  logWritingTargetMetricCheckpoint("metric.summary", {
    currentWordCount,
    dailyBaselineWordCount,
    dailyWords,
    sessionTargetWords,
    targetWordsPerDay: Math.max(0, Math.round(Number(targetWordsPerDay) || 0)),
    sessionsPerDay,
    sessionIsLive,
    sessionPaceActive,
    goalSyncSource,
    targetCadence,
  });

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
    currentSessionWords: sessionWordsDelta,
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
    projectionStartDate,
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
    sessionAgeLabel: sessionIsLive
      ? formatSessionAge(syncedRecord.sessionStartedAt, now)
      : "Idle",
    sessionPaceActive,
    sessionCurrentTimeLabel,
    sessionStartTimeLabel,
    sessionMinutesLapsed,
    sessionMinutesLapsedLabel,
    sessionElapsedLabel,
    sessionIsActive: sessionIsLive,
    sessionLifecyclePhase: sessionLifecycle.sessionLifecyclePhase,
    sessionLifecycleSummaryText,
    sessionIdleGraceMinutes: sessionLifecycle.sessionIdleGraceMinutes,
    sessionSegmentCloseMinutes: sessionLifecycle.sessionSegmentCloseMinutes,
    sessionNewSessionMinutes: sessionLifecycle.sessionNewSessionMinutes,
    sessionIdleLabel,
    sessionConcludedAt: sessionLifecycle.sessionConcludedAt?.toISOString?.() ?? "",
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
    dailyWords: rawDailyWords,
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
    goalSyncSource,
    now,
  } = context;
  const targetWords = clampPositiveNumber(record.targetWords, DEFAULT_WRITING_TARGET_WORDS);
  const sessionTargetWords = clampPositiveNumber(record.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS);
  const dailyWords = normalizeWritingTargetDailyWordsForDisplay({
    record,
    dailyWords: rawDailyWords,
    currentWordCount,
    now,
  });
  const lookbackDays = clampPositiveNumber(
    record.lookbackDays,
    DEFAULT_WRITING_TARGET_LOOKBACK_DAYS,
    2,
    WRITING_TARGET_MAX_HISTORY_DAYS,
  );

  // Stable keys are required so the live header patcher updates the right card.
  if (metricKey === "wordTarget") {
    return {
      key: metricKey,
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
      key: metricKey,
      label: cadenceMeta?.label ?? "Daily target",
      value: formatDisplayNumber(dailyWords),
      leftLabel: formatDisplayNumber(dailyWords),
      rightLabel: `${formatDisplayNumber(sessionTargetWords)} / ${cadenceMeta?.unitLabel ?? "day"}`,
      progress: sessionTargetWords > 0 ? Math.min(1, Math.max(0, dailyWords) / sessionTargetWords) : 0,
      note: `${formatDisplayNumber(Math.max(0, Math.round(targetWordsPerDay || 0)))} / day equivalent`,
    };
  }

  if (metricKey === "sessionTracker") {
    const signedSessionWords = Number(currentSessionWords) || 0;
    const sessionProgressWords = Math.max(0, signedSessionWords);
    return {
      key: metricKey,
      label: "Session tracker",
      value: `Session ${currentSessionIndex} of ${sessionsPerDay}`,
      leftLabel: formatDisplayNumber(signedSessionWords),
      rightLabel: formatDisplayNumber(sessionTargetWordsPerSession),
      progress: sessionTargetWordsPerSession > 0
        ? Math.max(0, Math.min(1, sessionProgressWords / sessionTargetWordsPerSession))
        : 0,
      note: sessionStatusText,
    };
  }

  if (releaseDate || goalSyncSource === "sessionTargetWords") {
    const forecastStartDate = goalSyncSource === "sessionTargetWords" ? now : releaseDate;
    return {
      key: metricKey,
      label: "Days to release",
      value: projectedDaysToTarget != null ? formatDayCount(projectedDaysToTarget) : "—",
      leftLabel: forecastStartDate ? formatGoalDateLabel(forecastStartDate) : "—",
      rightLabel: projectedCompletionDate ? formatGoalDateLabel(projectedCompletionDate) : "—",
      comparison: true,
      progress: goalSyncSource === "releaseDate" && releaseDate && requiredDailyWords > 0
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
    key: metricKey,
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

function normalizeWritingTargetDailyWordsForDisplay({
  record,
  dailyWords,
  currentWordCount,
  now = new Date(),
} = {}) {
  const normalizedDailyWords = Math.round(Number(dailyWords) || 0);
  const normalizedCurrentWordCount = Math.max(0, Math.round(Number(currentWordCount) || 0));
  if (normalizedCurrentWordCount <= 0) {
    return normalizedDailyWords;
  }

  const baselineDateKey = typeof record?.dailyBaselineDateKey === "string"
    ? record.dailyBaselineDateKey.trim()
    : "";
  const baselineWordCount =
    Number.isFinite(Number(record?.dailyBaselineWordCount)) && Number(record.dailyBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(record.dailyBaselineWordCount)))
      : null;
  const todayKey = getLocalDateKey(now);
  const hasTrustedTodayBaseline = baselineDateKey === todayKey && baselineWordCount != null && baselineWordCount > 0;

  if (
    !hasTrustedTodayBaseline &&
    normalizedCurrentWordCount >= 5000 &&
    normalizedDailyWords >= (normalizedCurrentWordCount * 0.95)
  ) {
    logWritingTargetMetricCheckpoint("metric.daily-words.display-coerced", {
      currentWordCount: normalizedCurrentWordCount,
      dailyWords: normalizedDailyWords,
      baselineDateKey,
      baselineWordCount,
      todayKey,
    });
    return 0;
  }

  return normalizedDailyWords;
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
      leftLabel: summary.projectionStartDate ? formatGoalDateLabel(summary.projectionStartDate) : `Track ${summary.lookbackDays} days`,
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
    wordCountValue: Math.round(Number(entry.wordDelta) || 0),
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
  const activeProjectRecord = getActiveProjectRecord();
  const indexedScenes = Array.isArray(activeProjectRecord?.projectIndex?.scenes)
    ? activeProjectRecord.projectIndex.scenes
    : [];
  if (!indexedScenes.length) {
    const totalWords = state.scenes.reduce((total, scene) => total + countWords(scene.editorText), 0);
    logWritingTargetMetricCheckpoint("metric.word-count", {
      source: "scenes",
      totalWords,
      sceneCount: state.scenes.length,
      selectedSceneId: state.selectedSceneId ?? "",
    });
    return totalWords;
  }

  const scenesById = new Map(state.scenes.map((scene) => [scene.sceneId, scene]));
  const sceneDrafts = state.sceneDrafts && typeof state.sceneDrafts === "object" && !Array.isArray(state.sceneDrafts)
    ? state.sceneDrafts
    : {};
  let totalWords = 0;
  const indexedSceneIds = new Set();
  for (const indexedScene of indexedScenes) {
    const sceneId = typeof indexedScene?.id === "string" ? indexedScene.id.trim() : "";
    if (!sceneId) {
      continue;
    }
    indexedSceneIds.add(sceneId);
    const indexedWordCountValue = Number(indexedScene.wordCount);
    const indexedWordCount = Number.isFinite(indexedWordCountValue) && indexedWordCountValue >= 0
      ? Math.round(indexedWordCountValue)
      : 0;
    // Intent: avoid counting placeholder empty drafts as zero when manifest index already has a known scene total.
    const draft = sceneDrafts[sceneId];
    if (draft && typeof draft === "object") {
      const draftWordCount = countWords(resolveSceneDraftEditorText(draft));
      const shouldTrustDraftWordCount = draftWordCount > 0 || sceneId === state.selectedSceneId || indexedWordCount <= 0;
      totalWords += shouldTrustDraftWordCount ? draftWordCount : indexedWordCount;
      continue;
    }

    const inMemoryScene = scenesById.get(sceneId) ?? null;
    const inMemoryWordCount = inMemoryScene ? countWords(inMemoryScene.editorText) : 0;
    const shouldTrustInMemoryWordCount = inMemoryWordCount > 0 || sceneId === state.selectedSceneId || indexedWordCount <= 0;
    totalWords += shouldTrustInMemoryWordCount ? inMemoryWordCount : indexedWordCount;
  }

  for (const scene of state.scenes) {
    if (!indexedSceneIds.has(scene.sceneId)) {
      totalWords += countWords(scene.editorText);
    }
  }

  logWritingTargetMetricCheckpoint("metric.word-count", {
    source: "indexed-scenes",
    totalWords,
    indexedSceneCount: indexedScenes.length,
    inMemorySceneCount: state.scenes.length,
    selectedSceneId: state.selectedSceneId ?? "",
  });
  return totalWords;
}

function resolveSceneDraftEditorText(draft) {
  if (typeof draft?.editorText === "string") {
    return draft.editorText;
  }

  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  return blocks
    .map((block) => String(block?.text ?? ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
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

function normalizeWritingTargetVisibleMetrics(candidateVisibleMetrics, visibleMetricsVersion = 0) {
  const selectedMetrics = new Set(
    Array.isArray(candidateVisibleMetrics)
      ? candidateVisibleMetrics.filter((metricKey) => WRITING_TARGET_METRIC_KEYS.includes(metricKey))
      : WRITING_TARGET_METRIC_KEYS,
  );

  // Older records predate the session tracker toggle, so keep that card visible during migration.
  if (Number(visibleMetricsVersion) < WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION) {
    selectedMetrics.add("sessionTracker");
  }

  const orderedMetrics = WRITING_TARGET_METRIC_KEYS.filter((metricKey) => selectedMetrics.has(metricKey));
  return orderedMetrics.length ? orderedMetrics : [...WRITING_TARGET_METRIC_KEYS];
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
  nextRecord.sessionIsActive = nextRecord.sessionIsActive === true;
  nextRecord.sessionStartedAt =
    typeof nextRecord.sessionStartedAt === "string" && nextRecord.sessionStartedAt.trim()
      ? nextRecord.sessionStartedAt
      : now.toISOString();
  nextRecord.sessionLastActiveAt =
    typeof nextRecord.sessionLastActiveAt === "string" && nextRecord.sessionLastActiveAt.trim()
      ? nextRecord.sessionLastActiveAt
      : now.toISOString();
  nextRecord.sessionConcludedAt = nextRecord.sessionIsActive
    ? ""
    : typeof nextRecord.sessionConcludedAt === "string" && nextRecord.sessionConcludedAt.trim()
      ? nextRecord.sessionConcludedAt
      : "";
  nextRecord.sessionConcludedReason = nextRecord.sessionIsActive
    ? ""
    : typeof nextRecord.sessionConcludedReason === "string" && nextRecord.sessionConcludedReason.trim()
      ? nextRecord.sessionConcludedReason
      : "idle";
  nextRecord.sessionLastWordCount =
    Number.isFinite(Number(nextRecord.sessionLastWordCount)) && Number(nextRecord.sessionLastWordCount) >= 0
      ? Math.max(0, Math.round(Number(nextRecord.sessionLastWordCount)))
      : Math.max(0, Math.round(Number(currentWordCount) || 0));

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
    // Intent: keep the authored release-date field stable; daily target drives only the visible projection.
    nextRecord.releaseDate = releaseDate ? getLocalDateKey(releaseDate) : "";
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
    sessionIsActive: true,
    sessionStartedAt: addHours(now, -6).toISOString(),
    sessionLastActiveAt: now.toISOString(),
    sessionConcludedAt: "",
    sessionConcludedReason: "",
    sessionLastWordCount: currentWordCount,
    sessionSamples: [
      createWritingTargetSessionSample(recentSessionStartCount, recentSessionStart),
      createWritingTargetSessionSample(recentSessionMidCount, recentSessionMidpoint),
      createWritingTargetSessionSample(currentWordCount, now),
    ],
    sessionHistory: Array.isArray(record.sessionHistory) ? cloneValue(record.sessionHistory) : [],
    updatedAt: now.toISOString(),
  };

  state.writingTargetState = persistWritingTargetState(nextRecord);
  state.writingTargetProjectId = state.workspace.project.id;
  clearWritingTargetDraft();
  persistCurrentProjectRecord({
    domain: "writing-goals",
    dirtyReason: "writing-target-seed-data",
    source: "seedWritingTargetTestData",
  });
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
  const visibleMetricsVersion = Math.max(0, Math.round(Number(candidate.visibleMetricsVersion) || 0));
  const visibleMetrics = normalizeWritingTargetVisibleMetrics(candidate.visibleMetrics, visibleMetricsVersion);
  const sessionBaselineWordCount =
    Number.isFinite(Number(candidate.sessionBaselineWordCount)) && Number(candidate.sessionBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(candidate.sessionBaselineWordCount)))
      : currentWordCount;
  const sessionIsActive = candidate.sessionIsActive === true;
  const dailyBaselineDateKey =
    typeof candidate.dailyBaselineDateKey === "string" && candidate.dailyBaselineDateKey.trim()
      ? getLocalDateKey(new Date(`${candidate.dailyBaselineDateKey}T12:00:00`))
      : defaults.dailyBaselineDateKey;
  const history = trimWritingTargetHistory(candidate.history ?? defaults.history, lookbackDays);
  const sessionSamples = normalizeWritingTargetSessionSamples(candidate.sessionSamples ?? defaults.sessionSamples);
  const sessionHistory = normalizeWritingTargetSessionHistory(candidate.sessionHistory ?? defaults.sessionHistory);
  const dailyBaselineWordCount = resolveWritingTargetDailyBaselineWordCount({
    record: {
      ...candidate,
      history,
      lookbackDays,
      dailyBaselineDateKey,
      sessionBaselineWordCount,
      sessionLastWordCount: candidate.sessionLastWordCount,
      sessionTargetWords,
    },
    currentWordCount,
    now,
  });
  const sessionStartedAt =
    typeof candidate.sessionStartedAt === "string" && candidate.sessionStartedAt.trim()
      ? candidate.sessionStartedAt
      : defaults.sessionStartedAt;
  const sessionLastActiveAt =
    typeof candidate.sessionLastActiveAt === "string" && candidate.sessionLastActiveAt.trim()
      ? candidate.sessionLastActiveAt
      : defaults.sessionLastActiveAt;
  const sessionConcludedAt =
    typeof candidate.sessionConcludedAt === "string" && candidate.sessionConcludedAt.trim()
      ? candidate.sessionConcludedAt
      : defaults.sessionConcludedAt;
  const releaseDate = normalizeDateInput(candidate.releaseDate);
  const goalSyncSource = normalizeWritingTargetGoalSyncSource(candidate.goalSyncSource)
    || (releaseDate ? "releaseDate" : sessionTargetWords !== DEFAULT_SESSION_TARGET_WORDS ? "sessionTargetWords" : "releaseDate");
  const sessionLastWordCount =
    Number.isFinite(Number(candidate.sessionLastWordCount)) && Number(candidate.sessionLastWordCount) >= 0
      ? Math.max(0, Math.round(Number(candidate.sessionLastWordCount)))
      : sessionBaselineWordCount;
  logWritingTargetMetricCheckpoint("metric.normalize-record", {
    targetWords,
    sessionTargetWords,
    sessionsPerDay,
    sessionTimeoutMinutes,
    dailyBaselineDateKey,
    dailyBaselineWordCount,
    currentWordCount,
    historyEntries: history.length,
    sessionIsActive,
    goalSyncSource,
  });

  return syncWritingTargetGoalFields({
    targetWords,
    releaseDate,
    sessionTargetWords,
    sessionsPerDay,
    sessionTimeoutMinutes,
    targetCadence,
    goalSyncSource,
    lookbackDays,
    visibleMetricsVersion: Math.max(WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION, visibleMetricsVersion),
    visibleMetrics: visibleMetrics.length ? visibleMetrics : [...defaults.visibleMetrics],
    sessionBaselineWordCount,
    sessionLastWordCount,
    dailyBaselineDateKey,
    dailyBaselineWordCount,
    sessionIsActive,
    sessionStartedAt,
    sessionLastActiveAt,
    sessionConcludedAt,
    sessionConcludedReason:
      typeof candidate.sessionConcludedReason === "string" && candidate.sessionConcludedReason.trim()
        ? candidate.sessionConcludedReason
        : sessionIsActive
          ? ""
          : "idle",
    sessionSamples: sessionSamples.length ? sessionSamples : defaults.sessionSamples,
    sessionHistory: sessionHistory.length ? sessionHistory : defaults.sessionHistory,
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

function normalizeWritingTargetSessionActivityReason(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || "activity";
}

function normalizeWritingTargetSessionHistory(entries) {
  const normalized = Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => {
          const startedAt = typeof entry.startedAt === "string" && entry.startedAt.trim()
            ? new Date(entry.startedAt)
            : null;
          const endedAt = typeof entry.endedAt === "string" && entry.endedAt.trim()
            ? new Date(entry.endedAt)
            : null;
          return {
            startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt.toISOString() : new Date().toISOString(),
            endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt.toISOString() : new Date().toISOString(),
            endedReason: normalizeWritingTargetSessionActivityReason(entry.endedReason),
            wordCountStart: Math.max(0, Math.round(Number(entry.wordCountStart) || 0)),
            wordCountEnd: Math.max(0, Math.round(Number(entry.wordCountEnd) || 0)),
            wordGain: Math.max(0, Math.round(Number(entry.wordGain) || 0)),
            activeMinutes: Math.max(0, Math.round(Number(entry.activeMinutes) || 0)),
            idleMinutes: Math.max(0, Math.round(Number(entry.idleMinutes) || 0)),
            sessionTargetWordsPerSession: Math.max(0, Math.round(Number(entry.sessionTargetWordsPerSession) || 0)),
            goalReached: entry.goalReached === true,
          };
        })
    : [];

  normalized.sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  return normalized.slice(-WRITING_TARGET_SESSION_HISTORY_MAX);
}

function addMinutes(date, minutes) {
  const next = new Date(date.getTime());
  next.setMinutes(next.getMinutes() + Math.round(Number(minutes) || 0));
  return next;
}

function getWritingTargetSessionThresholds(sessionTimeoutMinutes) {
  const idleGraceMinutes = clampPositiveNumber(
    sessionTimeoutMinutes,
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  );

  return {
    idleGraceMinutes,
    segmentCloseMinutes: idleGraceMinutes + WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES,
    newSessionMinutes: idleGraceMinutes + WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES,
  };
}

function getWritingTargetSessionPhase(idleMinutes, thresholds, sessionIsActive) {
  if (sessionIsActive && idleMinutes < thresholds.idleGraceMinutes) {
    return "writing";
  }

  if (idleMinutes < thresholds.segmentCloseMinutes) {
    return "idle";
  }

  if (idleMinutes < thresholds.newSessionMinutes) {
    return "segment-closed";
  }

  return "new-session";
}

function getWritingTargetSessionPhaseLabel(phase) {
  if (phase === "writing") {
    return "Writing";
  }

  if (phase === "segment-closed") {
    return "Segment closed";
  }

  if (phase === "new-session") {
    return "New session";
  }

  return "Idle";
}

function buildWritingTargetSessionLifecycleSummaryText(sessionLifecycle) {
  if (!sessionLifecycle) {
    return "Idle";
  }

  const phaseLabel = getWritingTargetSessionPhaseLabel(sessionLifecycle.sessionLifecyclePhase);
  return phaseLabel;
}

function getWritingTargetSessionLifecycle(record, now = new Date()) {
  const sessionStartedAt = typeof record?.sessionStartedAt === "string" && record.sessionStartedAt.trim()
    ? new Date(record.sessionStartedAt)
    : null;
  const sessionLastActiveAt = typeof record?.sessionLastActiveAt === "string" && record.sessionLastActiveAt.trim()
    ? new Date(record.sessionLastActiveAt)
    : null;
  const sessionConcludedAt = typeof record?.sessionConcludedAt === "string" && record.sessionConcludedAt.trim()
    ? new Date(record.sessionConcludedAt)
    : null;
  const sessionIsActive = record?.sessionIsActive === true;
  const sessionTimeoutMinutes = clampPositiveNumber(
    record?.sessionTimeoutMinutes,
    DEFAULT_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES,
  );
  const thresholds = getWritingTargetSessionThresholds(sessionTimeoutMinutes);
  const idleMinutes = sessionLastActiveAt && !Number.isNaN(sessionLastActiveAt.getTime())
    ? Math.max(0, Math.floor((now.getTime() - sessionLastActiveAt.getTime()) / 60000))
    : 0;
  const timedOut = sessionIsActive && idleMinutes >= sessionTimeoutMinutes;
  const effectiveConcludedAt = sessionConcludedAt && !Number.isNaN(sessionConcludedAt.getTime())
    ? sessionConcludedAt
    : timedOut && sessionLastActiveAt && !Number.isNaN(sessionLastActiveAt.getTime())
      ? addMinutes(sessionLastActiveAt, sessionTimeoutMinutes)
      : null;
  const activeAnchor = effectiveConcludedAt && !Number.isNaN(effectiveConcludedAt.getTime())
    ? effectiveConcludedAt
    : now;
  const activeMinutes = sessionStartedAt && !Number.isNaN(sessionStartedAt.getTime())
    ? Math.max(0, Math.floor((activeAnchor.getTime() - sessionStartedAt.getTime()) / 60000))
    : 0;
  const sessionBaselineWordCount =
    Number.isFinite(Number(record?.sessionBaselineWordCount)) && Number(record.sessionBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(record.sessionBaselineWordCount)))
      : 0;
  const sessionLifecyclePhase = getWritingTargetSessionPhase(idleMinutes, thresholds, sessionIsActive && !timedOut);

  return {
    sessionStartedAt,
    sessionLastActiveAt,
    sessionConcludedAt: effectiveConcludedAt,
    sessionTimeoutMinutes,
    sessionIdleGraceMinutes: thresholds.idleGraceMinutes,
    sessionSegmentCloseMinutes: thresholds.segmentCloseMinutes,
    sessionNewSessionMinutes: thresholds.newSessionMinutes,
    sessionLifecyclePhase,
    sessionIsActive: sessionIsActive && !timedOut,
    sessionDisplayActive: sessionIsActive && !timedOut && idleMinutes < thresholds.idleGraceMinutes,
    isConcluded: !sessionIsActive || timedOut || Boolean(effectiveConcludedAt),
    activeMinutes,
    idleMinutes,
    sessionBaselineWordCount,
    sessionLastWordCount: Number.isFinite(Number(record?.sessionLastWordCount))
      ? Math.max(0, Math.round(Number(record.sessionLastWordCount)))
      : sessionBaselineWordCount,
  };
}

function createWritingTargetSessionHistoryEntry(record, currentWordCount, now = new Date(), reason = "idle") {
  const lifecycle = getWritingTargetSessionLifecycle(record, now);
  const endedAt = lifecycle.sessionConcludedAt ?? now;
  const sessionTargetWordsPerSession = Math.max(
    0,
    Math.round(
      clampPositiveNumber(record?.sessionTargetWords, DEFAULT_SESSION_TARGET_WORDS) /
        Math.max(1, clampPositiveNumber(record?.sessionsPerDay, DEFAULT_SESSION_TARGETS_PER_DAY, 1, WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY)),
    ),
  );
  const wordCountStart = lifecycle.sessionBaselineWordCount;
  const wordCountEnd = Math.max(0, Math.round(Number(currentWordCount) || 0));
  const wordGain = Math.max(0, wordCountEnd - wordCountStart);

  return {
    startedAt: lifecycle.sessionStartedAt?.toISOString?.() ?? now.toISOString(),
    endedAt: endedAt.toISOString(),
    endedReason: normalizeWritingTargetSessionActivityReason(reason),
    wordCountStart,
    wordCountEnd,
    wordGain,
    activeMinutes: Math.max(0, Math.round(lifecycle.activeMinutes)),
    idleMinutes: Math.max(0, Math.round(lifecycle.idleMinutes)),
    sessionTargetWordsPerSession,
    goalReached: wordGain >= sessionTargetWordsPerSession,
  };
}

function resumeWritingSession(record, currentWordCount = getCurrentManuscriptWordCount(), now = new Date(), options = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const currentCount = Math.max(0, Math.round(Number(currentWordCount) || 0));
  const startedAt = now.toISOString();
  const nextRecord = cloneValue(record);
  nextRecord.sessionIsActive = true;
  nextRecord.sessionStartedAt = startedAt;
  nextRecord.sessionLastActiveAt = startedAt;
  nextRecord.sessionConcludedAt = "";
  nextRecord.sessionConcludedReason = "";
  nextRecord.sessionBaselineWordCount = currentCount;
  nextRecord.sessionLastWordCount = currentCount;
  nextRecord.sessionSamples = [createWritingTargetSessionSample(currentCount, now)];
  nextRecord.updatedAt = now.toISOString();
  if (options.reason) {
    nextRecord.sessionResumeReason = normalizeWritingTargetSessionActivityReason(options.reason);
  }
  return nextRecord;
}

function touchWritingTargetSessionActivity(record, currentWordCount = getCurrentManuscriptWordCount(), now = new Date(), options = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const currentCount = Math.max(0, Math.round(Number(currentWordCount) || 0));
  const previousCount = Number.isFinite(Number(options.previousWordCount))
    ? Math.max(0, Math.round(Number(options.previousWordCount)))
    : currentCount;
  const lifecycle = getWritingTargetSessionLifecycle(record, now);
  const wasActive = record.sessionIsActive === true
    && !(typeof record.sessionConcludedAt === "string" && record.sessionConcludedAt.trim());
  const resumeReason = normalizeWritingTargetSessionActivityReason(
    options.reason ?? (
      lifecycle.idleMinutes >= lifecycle.sessionNewSessionMinutes
        ? "new-session"
        : lifecycle.idleMinutes >= lifecycle.sessionSegmentCloseMinutes
          ? "segment-reopen"
          : "resume"
    ),
  );

  const nextRecord = wasActive
    ? cloneValue(record)
    : resumeWritingSession(record, previousCount, now, {
        reason: resumeReason,
      });

  if (!nextRecord) {
    return null;
  }

  nextRecord.sessionIsActive = true;
  nextRecord.sessionLastActiveAt = now.toISOString();
  nextRecord.sessionConcludedAt = "";
  nextRecord.sessionConcludedReason = "";
  nextRecord.sessionBaselineWordCount = wasActive ? nextRecord.sessionBaselineWordCount : previousCount;
  nextRecord.sessionLastWordCount = currentCount;
  nextRecord.updatedAt = now.toISOString();

  if (!wasActive) {
    nextRecord.sessionSamples = [createWritingTargetSessionSample(previousCount, now)];
  }

  return nextRecord;
}

function concludeWritingSession(record, currentWordCount = getCurrentManuscriptWordCount(), now = new Date(), reason = "idle") {
  if (!record || typeof record !== "object") {
    return null;
  }

  const lifecycle = getWritingTargetSessionLifecycle(record, now);
  if (!lifecycle.sessionIsActive && !record.sessionIsActive) {
    return cloneValue(record);
  }

  const concludedAt = lifecycle.sessionConcludedAt ?? addMinutes(lifecycle.sessionLastActiveAt ?? now, lifecycle.sessionTimeoutMinutes);
  const currentCount = Math.max(0, Math.round(Number(currentWordCount) || 0));
  const nextRecord = cloneValue(record);
  const history = normalizeWritingTargetSessionHistory(nextRecord.sessionHistory ?? []);
  const nextHistoryEntry = createWritingTargetSessionHistoryEntry(nextRecord, currentCount, concludedAt, reason);

  nextRecord.sessionIsActive = false;
  nextRecord.sessionConcludedAt = concludedAt.toISOString();
  nextRecord.sessionConcludedReason = normalizeWritingTargetSessionActivityReason(reason);
  nextRecord.sessionLastActiveAt = lifecycle.sessionLastActiveAt?.toISOString?.() ?? concludedAt.toISOString();
  nextRecord.sessionLastWordCount = currentCount;
  nextRecord.sessionHistory = [...history, nextHistoryEntry].slice(-WRITING_TARGET_SESSION_HISTORY_MAX);
  nextRecord.updatedAt = concludedAt.toISOString();
  return nextRecord;
}

function refreshWritingTargetSessionLifecycle(options = {}) {
  const record = getWritingTargetWorkingRecord();
  if (!record) {
    return null;
  }

  const lifecycle = getWritingTargetSessionLifecycle(record);
  if (!record.sessionIsActive || !lifecycle.isConcluded) {
    return record;
  }

  const concludedRecord = concludeWritingSession(record, getCurrentManuscriptWordCount(), new Date(), options.reason ?? "idle");
  if (!concludedRecord) {
    return record;
  }

  state.writingTargetState = persistWritingTargetState(concludedRecord);
  if (state.writingTargetDraft && state.writingTargetDraftProjectId === state.workspace?.project?.id) {
    state.writingTargetDraft = {
      ...cloneValue(state.writingTargetDraft),
      sessionIsActive: state.writingTargetState.sessionIsActive,
      sessionConcludedAt: state.writingTargetState.sessionConcludedAt,
      sessionConcludedReason: state.writingTargetState.sessionConcludedReason,
      sessionLastActiveAt: state.writingTargetState.sessionLastActiveAt,
      sessionLastWordCount: state.writingTargetState.sessionLastWordCount,
      sessionHistory: cloneValue(state.writingTargetState.sessionHistory),
      updatedAt: state.writingTargetState.updatedAt,
    };
  }
  const shouldSkipProjectFileAutosave = options.skipProjectFileAutosave !== false;
  persistCurrentProjectRecord({
    domain: "writing-goals",
    skipProjectFileAutosave: shouldSkipProjectFileAutosave,
    dirtyReason: options.dirtyReason ?? "session-tracker-snapshot",
    source: "refreshWritingTargetSessionLifecycle",
    markWorkingState: options.markWorkingState === true,
  });
  return concludedRecord;
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
  const previousEntry = getWritingTargetPreviousHistoryEntry(record, now, currentWordCount);
  if (previousEntry) {
    return Math.max(0, Math.round(Number(previousEntry.wordCount) || 0));
  }

  return Math.max(0, Math.round(Number(currentWordCount) || 0));
}

function getWritingTargetTodayHistoryEntry(record, now = new Date()) {
  const history = trimWritingTargetHistory(
    Array.isArray(record?.history) ? record.history : [],
    clampPositiveNumber(record?.lookbackDays, DEFAULT_WRITING_TARGET_LOOKBACK_DAYS, 2, WRITING_TARGET_MAX_HISTORY_DAYS),
  );
  if (!history.length) {
    return null;
  }

  const todayKey = getLocalDateKey(now);
  return history.find((entry) => entry.date === todayKey) ?? null;
}

function resolveWritingTargetDailyBaselineWordCount({
  record,
  currentWordCount,
  now = new Date(),
} = {}) {
  const todayKey = getLocalDateKey(now);
  const storedDailyBaselineDateKey = typeof record?.dailyBaselineDateKey === "string"
    ? record.dailyBaselineDateKey.trim()
    : "";
  const storedDailyBaselineWordCount =
    Number.isFinite(Number(record?.dailyBaselineWordCount)) && Number(record.dailyBaselineWordCount) >= 0
      ? Math.max(0, Math.round(Number(record.dailyBaselineWordCount)))
      : null;
  const previousHistoryEntry = getWritingTargetPreviousHistoryEntry(record, now, currentWordCount);
  const computedDailyBaselineWordCount = getWritingTargetDailyBaselineWordCount(record, currentWordCount, now);
  const todayHistoryEntry = getWritingTargetTodayHistoryEntry(record, now);
  const normalizedTodayHistoryWordCount =
    Number.isFinite(Number(todayHistoryEntry?.wordCount)) && Number(todayHistoryEntry.wordCount) >= 0
      ? Math.max(0, Math.round(Number(todayHistoryEntry.wordCount)))
      : null;
  const hasStoredBaselineForToday =
    storedDailyBaselineDateKey === todayKey && Number.isFinite(storedDailyBaselineWordCount);
  const previousHistoryWordCount = previousHistoryEntry
    ? Math.max(0, Math.round(Number(previousHistoryEntry.wordCount) || 0))
    : null;

  let baselineWordCount = hasStoredBaselineForToday
    ? storedDailyBaselineWordCount
    : computedDailyBaselineWordCount;
  if (
    hasStoredBaselineForToday &&
    (
      storedDailyBaselineWordCount <= 0 ||
      isImplausibleHistoryBaselineCandidate({
        candidateWordCount: storedDailyBaselineWordCount,
        currentWordCount,
        previousEntry: previousHistoryEntry,
      })
    ) &&
    currentWordCount > 0
  ) {
    // A zero baseline persisted for "today" can happen after legacy/session bugs.
    // Or a tiny positive baseline can be persisted from partial scene-only snapshots.
    // Ignore those in favor of a deterministic daily baseline so the Daily Target card
    // reflects today's progress instead of total manuscript words.
    baselineWordCount = previousHistoryWordCount == null
      ? computedDailyBaselineWordCount
      : (normalizedTodayHistoryWordCount ?? previousHistoryWordCount);
  }

  const resolvedBaselineWordCount = clampWritingTargetDailyBaselineWordCount(baselineWordCount, currentWordCount);
  logWritingTargetMetricCheckpoint("metric.daily-baseline", {
    todayKey,
    storedDailyBaselineDateKey,
    storedDailyBaselineWordCount,
    previousHistoryWordCount: previousHistoryEntry ? Math.max(0, Math.round(Number(previousHistoryEntry.wordCount) || 0)) : null,
    todayHistoryWordCount: normalizedTodayHistoryWordCount,
    computedDailyBaselineWordCount,
    resolvedBaselineWordCount,
    currentWordCount,
  });
  return resolvedBaselineWordCount;
}

function getWritingTargetPreviousHistoryEntry(record, now = new Date()) {
  const currentWordCount = arguments.length > 2 ? arguments[2] : null;
  const history = trimWritingTargetHistory(
    Array.isArray(record?.history) ? record.history : [],
    clampPositiveNumber(record?.lookbackDays, DEFAULT_WRITING_TARGET_LOOKBACK_DAYS, 2, WRITING_TARGET_MAX_HISTORY_DAYS),
  );
  if (!history.length) {
    return null;
  }

  const todayKey = getLocalDateKey(now);
  const completedEntries = [...history]
    .filter((entry) => entry.date < todayKey);
  if (!completedEntries.length) {
    return null;
  }

  // Intent: avoid using known-bad partial snapshots (for example, active-scene-only counts)
  // as the prior-day baseline when they are wildly out of scale with the current manuscript.
  for (let index = completedEntries.length - 1; index >= 0; index -= 1) {
    const candidate = completedEntries[index];
    const candidateWordCount = Math.max(0, Math.round(Number(candidate?.wordCount) || 0));
    if (!isImplausibleHistoryBaselineCandidate({
      candidateWordCount,
      currentWordCount,
      previousEntry: index > 0 ? completedEntries[index - 1] : null,
    })) {
      return candidate;
    }
  }

  // If every completed-day entry is implausible, prefer null so callers fall back
  // to current-word-count baseline instead of showing total manuscript words as
  // "today's" progress.
  return null;
}

function isImplausibleHistoryBaselineCandidate({
  candidateWordCount,
  currentWordCount,
  previousEntry,
} = {}) {
  if (!Number.isFinite(Number(candidateWordCount)) || Number(candidateWordCount) < 0) {
    return true;
  }
  const normalizedCandidate = Math.max(0, Math.round(Number(candidateWordCount)));
  const normalizedCurrent = Number.isFinite(Number(currentWordCount)) && Number(currentWordCount) >= 0
    ? Math.max(0, Math.round(Number(currentWordCount)))
    : null;
  if (normalizedCurrent == null || normalizedCurrent <= 0) {
    return false;
  }
  if (normalizedCandidate === 0 && normalizedCurrent > 0) {
    return true;
  }
  const candidateRatio = normalizedCandidate / normalizedCurrent;
  if (normalizedCurrent >= 5000 && candidateRatio < 0.2) {
    return true;
  }

  const previousWordCount = Number.isFinite(Number(previousEntry?.wordCount)) && Number(previousEntry.wordCount) >= 0
    ? Math.max(0, Math.round(Number(previousEntry.wordCount)))
    : null;
  if (previousWordCount == null || previousWordCount <= 0) {
    return false;
  }
  return normalizedCandidate < (previousWordCount * 0.2);
}

function clampWritingTargetDailyBaselineWordCount(candidate, currentWordCount) {
  // Intent: keep persisted daily baselines as non-negative whole-word values; daily progress clamps separately.
  const baseline = Number.isFinite(Number(candidate)) && Number(candidate) >= 0
    ? Math.max(0, Math.round(Number(candidate)))
    : 0;
  return baseline;
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
    visibleMetricsVersion: WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION,
    visibleMetrics: [...WRITING_TARGET_METRIC_KEYS],
    sessionBaselineWordCount: Math.max(0, Math.round(Number(currentWordCount) || 0)),
    dailyBaselineDateKey: getLocalDateKey(now),
    dailyBaselineWordCount: Math.max(0, Math.round(Number(currentWordCount) || 0)),
    sessionIsActive: false,
    sessionStartedAt: now.toISOString(),
    sessionLastActiveAt: now.toISOString(),
    sessionConcludedAt: "",
    sessionConcludedReason: "",
    sessionLastWordCount: Math.max(0, Math.round(Number(currentWordCount) || 0)),
    sessionSamples: [createWritingTargetSessionSample(currentWordCount, now)],
    sessionHistory: [],
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


  return {
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
  };
}
