// Intent: verify narration viewport math resolves visible wrapped lines to manuscript offsets.
import assert from "node:assert/strict";

import { estimateNarrationVisibleTextRange } from "../apps/editor/public/features/narration/narration-visible-range-service.js";

export function runNarrationVisibleRangeServiceTest() {
  const text = "abcdefghij\nklmnopqrst\nuvwxyz";
  const range = estimateNarrationVisibleTextRange({
    text,
    scrollTop: 20,
    clientHeight: 20,
    lineHeight: 10,
    paddingTop: 0,
    charactersPerLine: 5,
    overscanLines: 0,
  });

  assert.deepEqual(range, {
    startOffset: 10,
    endOffset: 21,
    firstVisibleLine: 2,
    lastVisibleLine: 3,
    overscanLines: 0,
  });

  const overscanned = estimateNarrationVisibleTextRange({
    text,
    scrollTop: 20,
    clientHeight: 20,
    lineHeight: 10,
    paddingTop: 0,
    charactersPerLine: 5,
    overscanLines: 1,
  });
  assert.equal(overscanned.startOffset, 5);
  assert.equal(overscanned.endOffset, 27);
}
