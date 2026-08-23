// Intent: verify narration viewport scrolling advances at a paced reading rate instead of recentering jumps.
import assert from "node:assert/strict";

import { createNarrationViewportTracker } from "../apps/editor/public/features/narration/narration-viewport-tracker-service.js";

export function runNarrationViewportTrackerServiceTest() {
  const logEntries = [];
  const tracker = createNarrationViewportTracker({
    defaultLinesPerMinute: 12,
    logger: {
      isEnabled: () => true,
      debug: (...args) => logEntries.push(args),
    },
  });

  const first = tracker.planScroll({
    sceneId: "scene-1",
    matchedLineIndex: 10,
    currentScrollTop: 100,
    targetScrollTop: 500,
    lineHeight: 24,
    nowMs: 0,
  });
  assert.equal(first.shouldScroll, true);
  assert.equal(first.scrollTop > 100, true);
  assert.equal(first.scrollTop < 500, true);
  assert.equal(first.scrollTop > 150, true);

  const second = tracker.planScroll({
    sceneId: "scene-1",
    matchedLineIndex: 12,
    currentScrollTop: first.scrollTop,
    targetScrollTop: 500,
    lineHeight: 24,
    nowMs: 5000,
  });
  assert.equal(second.linesPerMinute > first.linesPerMinute, true);
  assert.equal(second.scrollTop > first.scrollTop, true);
  assert.equal(second.scrollTop <= 500, true);

  const correction = tracker.planScroll({
    sceneId: "scene-1",
    matchedLineIndex: 9,
    currentScrollTop: second.scrollTop,
    targetScrollTop: 80,
    lineHeight: 24,
    allowBackwardScroll: true,
    nowMs: 5500,
  });
  assert.equal(correction.shouldScroll, true);
  assert.equal(correction.direction, "up");
  assert.equal(correction.scrollTop < second.scrollTop, true);
  assert.equal(correction.scrollTop > 80, true);
  assert.equal(logEntries.some((entry) => entry[1] === "narration-follow.viewport-plan"), true);

  const blockedBackward = tracker.planScroll({
    sceneId: "scene-1",
    matchedLineIndex: 4,
    currentScrollTop: correction.scrollTop,
    targetScrollTop: 20,
    lineHeight: 24,
    nowMs: 6000,
  });
  assert.equal(blockedBackward.shouldScroll, false);
  assert.equal(blockedBackward.direction, "backward-blocked");
  assert.equal(blockedBackward.scrollTop, correction.scrollTop);
  assert.equal(logEntries.some((entry) => entry[1] === "narration-follow.viewport-backward-blocked"), true);

  tracker.reset();
  const afterReset = tracker.planScroll({
    sceneId: "scene-2",
    matchedLineIndex: 1,
    currentScrollTop: 0,
    targetScrollTop: 30,
    lineHeight: 24,
    nowMs: 10000,
  });
  assert.equal(afterReset.shouldScroll, true);

  const externallyPacedTracker = createNarrationViewportTracker({
    defaultLinesPerMinute: 12,
  });
  const externallyPaced = externallyPacedTracker.planScroll({
    sceneId: "scene-rate",
    matchedLineIndex: 2,
    currentScrollTop: 0,
    targetScrollTop: 120,
    lineHeight: 24,
    readingRateLinesPerMinute: 36,
    readingRateContext: {
      wordsPerMinute: 180,
      averageWordsPerLine: 5,
    },
    nowMs: 0,
  });
  assert.equal(externallyPaced.linesPerMinute, 36);

  const jumpGuardTracker = createNarrationViewportTracker({
    maxScrollStepLines: 4,
  });
  const guardedJump = jumpGuardTracker.planScroll({
    sceneId: "scene-1",
    matchedLineIndex: 80,
    currentScrollTop: 0,
    targetScrollTop: 1800,
    lineHeight: 24,
    nowMs: 0,
  });
  assert.equal(guardedJump.shouldScroll, true);
  assert.equal(guardedJump.scrollDelta <= 96, true);

  const centerGateTracker = createNarrationViewportTracker({
    defaultLinesPerMinute: 12,
    logger: {
      isEnabled: () => true,
      debug: (...args) => logEntries.push(args),
    },
  });
  const beforeCenter = centerGateTracker.planScroll({
    sceneId: "scene-center",
    matchedLineIndex: 2,
    currentScrollTop: 0,
    targetScrollTop: 160,
    viewportCenterLineIndex: 13,
    lineHeight: 24,
    nowMs: 0,
  });
  assert.equal(beforeCenter.shouldScroll, false);
  assert.equal(beforeCenter.direction, "center-wait");
  assert.equal(beforeCenter.scrollTop, 0);
  assert.equal(logEntries.some((entry) => entry[1] === "narration-follow.viewport-center-wait"), true);

  const atCenter = centerGateTracker.planScroll({
    sceneId: "scene-center",
    matchedLineIndex: 13,
    currentScrollTop: 0,
    targetScrollTop: 160,
    viewportCenterLineIndex: 13,
    lineHeight: 24,
    nowMs: 1000,
  });
  assert.equal(atCenter.shouldScroll, true);
  assert.equal(atCenter.direction, "down");
  assert.equal(atCenter.scrollTop > 0, true);
}
