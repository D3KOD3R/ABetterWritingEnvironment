// Intent: prevent regressions where stale baselines hide deletion deltas from the writing-goals displays.
import assert from "node:assert/strict";

import { createWritingGoalsStateService } from "../apps/editor/public/features/writing-targets/writing-goals-state-service.js";

export function runWritingGoalsStateServiceTest() {
  const now = new Date("2026-05-15T10:30:00.000Z");
  const activeProjectRecord = {
    id: "project-1",
    projectIndex: {
      scenes: [
        { id: "scene-1", wordCount: 70097 },
      ],
    },
    sceneDrafts: {},
    workspace: {
      project: {
        lines: [],
      },
    },
    projectSettings: {},
  };

  const state = {
    workspace: {
      project: {
        id: "project-1",
      },
    },
    writingTargetState: null,
    writingTargetProjectId: null,
    writingTargetDraft: null,
    writingTargetDraftProjectId: null,
    writingTargetDraftBaseline: null,
    writingTargetViewMode: "month",
    writingTargetSelectedDateKey: "",
    writingTargetCalendarMonthKey: "",
    selectedSceneId: null,
    sceneDrafts: {},
    scenes: [],
    manuscriptTasks: [],
    passageNotes: [],
  };

  const service = createWritingGoalsStateService({
    state,
    readStoredJson: () => ({}),
    writeStoredJsonRaw: () => {},
    getProjectRecordById: (projectId) => (projectId === "project-1" ? activeProjectRecord : null),
    getActiveProjectRecord: () => activeProjectRecord,
    getSelectedScene: () => null,
    countRemainingTasksByChapter: () => ({}),
    cloneValue: (value) => JSON.parse(JSON.stringify(value)),
    persistCurrentProjectRecord: () => {},
    logWritingTargetDebugEvent: () => {},
    logWritingTargetMetricCheckpoint: () => {},
    buildWritingTargetDebugTerminalSummary: () => ({
      open: false,
      entryCount: 0,
      recentErrorCount: 0,
      lastEventLabel: "",
    }),
    EDITOR_WRITING_TARGETS_KEY: "abe-writing-targets-v1",
    DEFAULT_WRITING_TARGET_WORDS: 150000,
    DEFAULT_SESSION_TARGET_WORDS: 5000,
    DEFAULT_WRITING_TARGET_LOOKBACK_DAYS: 7,
    DEFAULT_SESSION_TARGETS_PER_DAY: 5,
    DEFAULT_SESSION_TIMEOUT_MINUTES: 20,
    WRITING_TARGET_SESSION_SEGMENT_CLOSE_BUFFER_MINUTES: 10,
    WRITING_TARGET_SESSION_NEW_SESSION_BUFFER_MINUTES: 25,
    WRITING_TARGET_MAX_HISTORY_DAYS: 180,
    WRITING_TARGET_MAX_SESSION_TARGETS_PER_DAY: 12,
    WRITING_TARGET_MIN_SESSION_TIMEOUT_MINUTES: 5,
    WRITING_TARGET_MAX_SESSION_TIMEOUT_MINUTES: 240,
    WRITING_TARGET_MAX_SESSION_SAMPLES: 20,
    WRITING_TARGET_SESSION_HISTORY_MAX: 24,
    WRITING_TARGET_SESSION_PACE_LOOKBACK_MINUTES: 5,
    WRITING_TARGET_SESSION_PACE_STALE_MINUTES: 0.5,
    WRITING_TARGET_GOAL_SYNC_SOURCES: ["releaseDate", "sessionTargetWords"],
    WRITING_TARGET_CADENCE_OPTIONS: [
      { value: "daily", label: "Daily target", unitLabel: "day", periodsPerWeek: 7 },
      { value: "weekly", label: "Weekly target", unitLabel: "week", periodsPerWeek: 1 },
    ],
    WRITING_TARGET_VISIBLE_METRICS_SCHEMA_VERSION: 2,
    WRITING_TARGET_METRIC_KEYS: ["wordTarget", "sessionTarget", "forecast", "sessionTracker"],
  });

  const todayKey = service.getLocalDateKey(now);
  const seededRecord = {
    ...service.createDefaultWritingTargetRecord(70097, now),
    targetWords: 150000,
    sessionTargetWords: 2184,
    goalSyncSource: "sessionTargetWords",
    dailyBaselineDateKey: todayKey,
    dailyBaselineWordCount: 0,
    history: [],
  };

  const resolvedBaseline = service.resolveWritingTargetDailyBaselineWordCount({
    record: seededRecord,
    currentWordCount: 70097,
    now,
  });
  assert.equal(resolvedBaseline, 70097);

  const summary = service.buildWritingTargetSummaryForRecord(seededRecord);
  assert.equal(summary.currentWordCount, 70097);
  assert.equal(summary.dailyWords, 0);
  assert.equal(Math.round(summary.targetWordsPerDay), 2184);

  const runtimeTodayKey = service.getLocalDateKey(new Date());
  activeProjectRecord.projectIndex.scenes[0].wordCount = 69920;
  try {
    const signedDeltaRecord = {
      ...seededRecord,
      dailyBaselineDateKey: runtimeTodayKey,
      dailyBaselineWordCount: 70097,
    };
  const deletedTextSummary = service.buildWritingTargetSummaryForRecord(signedDeltaRecord);
  assert.equal(deletedTextSummary.currentWordCount, 69920);
  assert.equal(deletedTextSummary.dailyWords, -177);
  assert.equal(deletedTextSummary.currentSessionWords, -177);
  const deletedDailyMetric = service.buildWritingTargetMetric("sessionTarget", {
    record: signedDeltaRecord,
    currentWordCount: 69920,
    sessionWords: 0,
    dailyWords: -177,
    sessionsPerDay: 5,
    sessionTargetWordsPerSession: 437,
    currentSessionIndex: 1,
    currentSessionWords: -177,
    sessionProgress: 0,
    sessionStatusText: "Idle",
    pace: null,
    targetCadence: "daily",
    cadenceMeta: { label: "Daily target", unitLabel: "day" },
    targetWordsPerDay: 2184,
    effectiveWordsPerDay: 0,
    remainingWords: 80080,
    projectedDaysToTarget: null,
    projectedCompletionDate: null,
    releaseDate: null,
    daysUntilRelease: null,
    requiredDailyWords: 2184,
    projectedReleaseGap: null,
    releaseTrackStatus: "unknown",
    now,
  });
  assert.equal(deletedDailyMetric.leftLabel, "-177");
  const deletedTextMetric = service.buildWritingTargetMetric("sessionTracker", {
    record: signedDeltaRecord,
    currentWordCount: 69920,
      sessionWords: 0,
      dailyWords: -177,
      sessionsPerDay: 5,
      sessionTargetWordsPerSession: 437,
      currentSessionIndex: 1,
      currentSessionWords: -177,
      sessionProgress: 0,
      sessionStatusText: "Idle",
      pace: null,
      targetCadence: "daily",
      cadenceMeta: { label: "Daily target", unitLabel: "day" },
      targetWordsPerDay: 2184,
      effectiveWordsPerDay: 0,
      remainingWords: 80080,
      projectedDaysToTarget: null,
      projectedCompletionDate: null,
      releaseDate: null,
      daysUntilRelease: null,
      requiredDailyWords: 2184,
      projectedReleaseGap: null,
    releaseTrackStatus: "unknown",
    now,
  });
  assert.equal(deletedTextMetric.leftLabel, "-177");
  } finally {
    activeProjectRecord.projectIndex.scenes[0].wordCount = 70097;
  }

  const outlierHistoryRecord = {
    ...seededRecord,
    dailyBaselineDateKey: service.getLocalDateKey(new Date(now.getTime() - 86400000)),
    dailyBaselineWordCount: 1283,
    history: [
      { date: service.getLocalDateKey(new Date(now.getTime() - (4 * 86400000))), wordCount: 71434, wordDelta: 12 },
      { date: service.getLocalDateKey(new Date(now.getTime() - 86400000)), wordCount: 1283, wordDelta: -70151 },
    ],
  };
  const resolvedFromOutlier = service.resolveWritingTargetDailyBaselineWordCount({
    record: outlierHistoryRecord,
    currentWordCount: 70097,
    now,
  });
  assert.equal(resolvedFromOutlier, 71434);
  const outlierSummary = service.buildWritingTargetSummaryForRecord(outlierHistoryRecord);
  assert.equal(outlierSummary.dailyWords, -1337);

  const onlyImplausibleHistoryRecord = {
    ...seededRecord,
    dailyBaselineDateKey: service.getLocalDateKey(new Date(now.getTime() - 86400000)),
    dailyBaselineWordCount: 0,
    history: [
      {
        date: service.getLocalDateKey(new Date(now.getTime() - 86400000)),
        wordCount: 0,
        wordDelta: -70097,
      },
    ],
  };
  const resolvedFromOnlyImplausible = service.resolveWritingTargetDailyBaselineWordCount({
    record: onlyImplausibleHistoryRecord,
    currentWordCount: 70097,
    now,
  });
  assert.equal(resolvedFromOnlyImplausible, 70097);
  const onlyImplausibleSummary = service.buildWritingTargetSummaryForRecord(onlyImplausibleHistoryRecord);
  assert.equal(onlyImplausibleSummary.dailyWords, 0);

  const tinyTodayBaselineRecord = {
    ...seededRecord,
    dailyBaselineDateKey: todayKey,
    dailyBaselineWordCount: 1,
    history: [],
  };
  const resolvedFromTinyTodayBaseline = service.resolveWritingTargetDailyBaselineWordCount({
    record: tinyTodayBaselineRecord,
    currentWordCount: 70097,
    now,
  });
  assert.equal(resolvedFromTinyTodayBaseline, 70097);
  const tinyTodayBaselineSummary = service.buildWritingTargetSummaryForRecord(tinyTodayBaselineRecord);
  assert.equal(tinyTodayBaselineSummary.dailyWords, 0);

  const metricFromImplausibleSummary = service.buildWritingTargetMetric("sessionTarget", {
    record: onlyImplausibleHistoryRecord,
    currentWordCount: 70097,
    sessionWords: 0,
    dailyWords: 70097,
    sessionsPerDay: 5,
    sessionTargetWordsPerSession: 437,
    currentSessionIndex: 1,
    currentSessionWords: 0,
    sessionProgress: 0,
    sessionStatusText: "Idle",
    pace: null,
    targetCadence: "daily",
    cadenceMeta: { label: "Daily target", unitLabel: "day" },
    targetWordsPerDay: 2184,
    effectiveWordsPerDay: 0,
    remainingWords: 79903,
    projectedDaysToTarget: null,
    projectedCompletionDate: null,
    releaseDate: null,
    daysUntilRelease: null,
    requiredDailyWords: 2184,
    projectedReleaseGap: null,
    releaseTrackStatus: "unknown",
    now,
  });
  assert.equal(metricFromImplausibleSummary.value, "0");
}
