// Intent: cover header progress tracker presentation rules that should not mutate writing-goals state.
import assert from "node:assert/strict";

import { buildSessionTrackerMetric, renderSessionTrackerPanel } from "../apps/editor/public/features/progress-tracker.js";

export function runProgressTrackerTest() {
  const inactiveSummary = {
    currentSessionWords: 73052,
    sessionTargetWordsPerSession: 600,
    sessionWordsPerMinute: 0,
    sessionRequiredWordsPerMinute: 0,
    sessionWordsPerMinuteLabel: "0/min",
    sessionRequiredWordsPerMinuteLabel: "0/min",
    sessionWordsPerMinuteRatio: 0,
    sessionWordsPerMinuteStatusText: "Idle",
    sessionCurrentTimeLabel: "16:37",
    sessionStartTimeLabel: "16:36",
    sessionMinutesLapsed: 0,
    sessionIsActive: false,
    sessionPaceActive: false,
    sessionIdleLabel: "0 minutes idle",
  };

  const inactiveMetric = buildSessionTrackerMetric(inactiveSummary);
  assert.equal(inactiveMetric.wordsWrittenLabel, "0");
  assert.match(renderSessionTrackerPanel(inactiveSummary), /data-session-tracker-words-written>0<\/strong>/);
  assert.match(renderSessionTrackerPanel(inactiveSummary), /width: 0%/);

  const activeMetric = buildSessionTrackerMetric({
    ...inactiveSummary,
    currentSessionWords: 42,
    sessionIsActive: true,
  });
  assert.equal(activeMetric.wordsWrittenLabel, "42");
}
