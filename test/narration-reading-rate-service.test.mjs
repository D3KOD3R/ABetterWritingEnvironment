// Intent: verify narration follow scroll pace is derived from spoken manuscript word progress.
import assert from "node:assert/strict";

import {
  countNarrationWords,
  countNarrationWordsBeforeOffset,
  createNarrationReadingRateTracker,
  estimateNarrationAverageWordsPerVisualLine,
} from "../apps/editor/public/features/narration/narration-reading-rate-service.js";

export function runNarrationReadingRateServiceTest() {
  const text = "Alpha beta gamma.\nDelta epsilon zeta eta.";
  assert.equal(countNarrationWords(text), 7);
  assert.equal(countNarrationWordsBeforeOffset(text, text.indexOf("Delta")), 3);
  assert.equal(estimateNarrationAverageWordsPerVisualLine({
    text,
    visualLineCount: 2,
  }), 3.5);

  const logEntries = [];
  const tracker = createNarrationReadingRateTracker({
    defaultWordsPerMinute: 120,
    sampleWindowMs: 3000,
    smoothingRatio: 1,
    logger: {
      isEnabled: () => true,
      debug: (...args) => logEntries.push(args),
    },
  });

  const initial = tracker.update({
    sceneId: "scene-1",
    wordIndex: 3,
    averageWordsPerLine: 3,
    nowMs: 0,
  });
  assert.equal(initial.wordsPerMinute, 120);
  assert.equal(initial.linesPerMinute, 40);

  const sampled = tracker.update({
    sceneId: "scene-1",
    wordIndex: 15,
    averageWordsPerLine: 6,
    nowMs: 3000,
  });
  assert.equal(sampled.rateSource, "sampled");
  assert.equal(sampled.observedWordsPerMinute, 240);
  assert.equal(sampled.wordsPerMinute, 240);
  assert.equal(sampled.linesPerMinute, 40);
  assert.equal(logEntries.some((entry) => entry[1] === "narration-follow.reading-rate"), true);

  const rewound = tracker.update({
    sceneId: "scene-1",
    wordIndex: 5,
    averageWordsPerLine: 5,
    nowMs: 7000,
  });
  assert.equal(rewound.rateSource, "rewound");
}
