// Intent: verify narration follow stores only the transcript tail needed for live page centering.
import assert from "node:assert/strict";

import {
  applyNarrationFollowTranscriptWindowToSnapshot,
  createNarrationFollowTranscriptWindow,
} from "../apps/editor/public/features/narration/narration-follow-transcript-window-service.js";

function createWords(prefix, count) {
  return Array.from({ length: count }, (_value, index) => `${prefix}${index + 1}`).join(" ");
}

export function runNarrationFollowTranscriptWindowServiceTest() {
  const window = createNarrationFollowTranscriptWindow({
    transcript: createWords("word", 12),
    changedTranscript: createWords("changed", 8),
    finalTranscript: createWords("final", 11),
    interimTranscript: createWords("interim", 7),
    maxTranscriptWords: 5,
    maxChangedWords: 3,
  });

  assert.equal(window.transcript, "word8 word9 word10 word11 word12");
  assert.equal(window.changedTranscript, "changed6 changed7 changed8");
  assert.equal(window.finalTranscript, "final7 final8 final9 final10 final11");
  assert.equal(window.interimTranscript, "interim5 interim6 interim7");
  assert.equal(window.sourceTranscriptWordCount, 12);
  assert.equal(window.transcriptWindowWordCount, 5);
  assert.equal(window.isTranscriptWindowed, true);
  assert.equal(window.isChangedTranscriptWindowed, true);

  const snapshot = applyNarrationFollowTranscriptWindowToSnapshot({
    transcript: createWords("live", 9),
    changedTranscript: createWords("delta", 6),
    finalTranscript: createWords("done", 7),
    interimTranscript: createWords("now", 4),
    segmentCount: 2,
    receivedAt: "2026-07-20T00:00:00.000Z",
  }, {
    maxTranscriptWords: 4,
    maxChangedWords: 2,
  });

  assert.equal(snapshot.transcript, "live6 live7 live8 live9");
  assert.equal(snapshot.changedTranscript, "delta5 delta6");
  assert.equal(snapshot.finalTranscript, "done4 done5 done6 done7");
  assert.equal(snapshot.interimTranscript, "now3 now4");
  assert.equal(snapshot.segmentCount, 2);
  assert.equal(snapshot.transcriptWindow.sourceTranscriptWordCount, 9);
  assert.equal(snapshot.transcriptWindow.isTranscriptWindowed, true);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, "fullTranscript"), false);
}
