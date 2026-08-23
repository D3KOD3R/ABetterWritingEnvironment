import assert from "node:assert/strict";
import {
  estimateTextareaVisualLineBeforeOffset,
} from "../apps/editor/public/adapters/editor-host/textarea-editor-host.js";
import {
  createNarrationFollowViewportMetrics,
  createNarrationFollowViewportMetricsCache,
} from "../apps/editor/public/features/narration/narration-follow-viewport-metrics-service.js";
import {
  countNarrationWordsBeforeOffset,
} from "../apps/editor/public/features/narration/narration-reading-rate-service.js";

export function runNarrationFollowViewportMetricsServiceTest() {
  const text = "Alpha beta gamma\nDelta epsilon zeta eta\nTheta";
  const metrics = createNarrationFollowViewportMetrics(text, 12);

  for (const offset of [0, 5, 16, 17, 24, 39, text.length]) {
    assert.equal(
      metrics.estimateVisualLineBeforeOffset(offset),
      estimateTextareaVisualLineBeforeOffset(text, offset, 12),
      `visual line should match textarea estimator at ${offset}`,
    );
    assert.equal(
      metrics.countWordsBeforeOffset(offset),
      countNarrationWordsBeforeOffset(text, offset),
      `word count should match legacy scanner at ${offset}`,
    );
  }

  assert.equal(metrics.totalWordCount, 8);
  assert.ok(metrics.visualLineCount >= 4);
  assert.ok(metrics.averageWordsPerLine > 0);

  const cache = createNarrationFollowViewportMetricsCache({ maxEntries: 2 });
  const first = cache.resolveMetrics({ text, charactersPerLine: 12 });
  const second = cache.resolveMetrics({ text, charactersPerLine: 12 });
  assert.equal(first, second, "matching text and wrap width should reuse cached metrics");

  const resized = cache.resolveMetrics({ text, charactersPerLine: 8 });
  assert.notEqual(first, resized, "wrap-width changes need distinct metrics");

  cache.clear();
  const afterClear = cache.resolveMetrics({ text, charactersPerLine: 12 });
  assert.notEqual(first, afterClear, "clearing cache should force a fresh metric object");
}
