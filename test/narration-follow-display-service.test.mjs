// Intent: verify display-only narration follow lead offsets do not move the spoken-word highlight.
import assert from "node:assert/strict";

import {
  createNarrationFollowLeadSelection,
  resolveNarrationFollowViewportOffsets,
} from "../apps/editor/public/features/narration/narration-follow-display-service.js";

export function runNarrationFollowDisplayServiceTest() {
  const text = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron.";
  const recognizedEndOffset = text.indexOf("delta");
  const selection = {
    id: "narration-follow:scene:block:0:16",
    sceneId: "scene-1",
    blockId: "block-1",
    startOffset: 0,
    endOffset: recognizedEndOffset,
    trackingStartOffset: text.indexOf("beta"),
    trackingEndOffset: recognizedEndOffset,
  };

  const leadSelection = createNarrationFollowLeadSelection(selection, text, {
    leadMs: 4000,
    wordsPerMinute: 150,
    maxLeadWords: 12,
  });

  assert.equal(leadSelection.startOffset, selection.startOffset);
  assert.equal(leadSelection.endOffset, selection.endOffset);
  assert.equal(leadSelection.coverageEndOffset, recognizedEndOffset);
  assert.equal(leadSelection.trackingStartOffset, selection.trackingStartOffset);
  assert.equal(leadSelection.trackingEndOffset, selection.trackingEndOffset);
  assert.equal(leadSelection.viewportStartOffset, selection.trackingStartOffset);
  assert.equal(leadSelection.viewportEndOffset, selection.trackingEndOffset);
  assert.equal(leadSelection.displayLeadStartOffset, text.indexOf("delta"));
  assert.equal(leadSelection.displayLeadEndOffset, text.indexOf("nu") + "nu".length);
  assert.equal(leadSelection.displayLeadWordCount, 10);

  const viewportOffsets = resolveNarrationFollowViewportOffsets(leadSelection);
  assert.deepEqual(viewportOffsets, {
    startOffset: selection.trackingStartOffset,
    endOffset: selection.trackingEndOffset,
  });

  const repeatedLeadSelection = createNarrationFollowLeadSelection(leadSelection, text, {
    leadMs: 4000,
    wordsPerMinute: 150,
    maxLeadWords: 12,
  });
  assert.equal(repeatedLeadSelection.trackingStartOffset, selection.trackingStartOffset);
  assert.equal(repeatedLeadSelection.trackingEndOffset, selection.trackingEndOffset);
  assert.equal(repeatedLeadSelection.viewportStartOffset, selection.trackingStartOffset);
  assert.equal(repeatedLeadSelection.displayLeadStartOffset, text.indexOf("delta"));

  const unchangedAtEnd = createNarrationFollowLeadSelection({
    ...selection,
    trackingEndOffset: text.length,
    endOffset: text.length,
  }, text);
  assert.equal(unchangedAtEnd.trackingEndOffset, text.length);
}
