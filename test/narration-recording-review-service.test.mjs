// Intent: verify opened narration take review models derive transcript cursor state from saved recording data.
import assert from "node:assert/strict";

import {
  createNarrationRecordingReviewModel,
  createNarrationRecordingReviewSelection,
  createNarrationRecordingReviewState,
  renderNarrationRecordingReviewHTML,
} from "../apps/editor/public/features/narration/narration-recording-review-service.js";
import {
  NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
  NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
  createNarrationRecordingTranscriptHash,
} from "../apps/editor/public/features/narration/narration-recording-alignment-service.js";

export function runNarrationRecordingReviewServiceTest() {
  const recording = {
    id: "take-1",
    status: "saved",
    mediaPath: "project-media/project-1/take-1.webm",
    sceneId: "scene-1",
    blockId: "block-1",
    lineNumber: 42,
    verseText: "Alpha beta",
    transcript: "bright splintering light etched across the closed glass panel now",
    durationMs: 10000,
    startOffset: 0,
    endOffset: 56,
  };
  const scene = {
    sceneId: "scene-1",
    editorText: "alpha beta gamma delta epsilon zeta eta theta iota kappa.",
  };

  const reviewState = createNarrationRecordingReviewState(recording, {
    currentTimeSeconds: 5,
    waveformZoom: 2,
  });
  assert.deepEqual(reviewState, {
    recordingId: "take-1",
    currentTimeSeconds: 5,
    durationSeconds: 10,
    waveformZoom: 2,
    selection: null,
  });

  const model = createNarrationRecordingReviewModel({
    recording,
    scene,
    reviewState,
    waveformState: {
      recordingId: "take-1",
      status: "ready",
      peaks: [0, 0.25, 0.5, 1, 0.75, 0.4, 0.2, 0.1],
      durationSeconds: 10,
    },
  });
  assert.equal(model.recordingId, "take-1");
  assert.equal(model.title, "Line 42");
  assert.equal(model.progressPercent, 50);
  assert.deepEqual(model.cursor.currentWords, ["the", "closed", "glass"]);
  assert.equal(model.matchedLines.length, 1);
  assert.equal(model.matchedLines[0].lineNumber, 42);
  assert.equal(model.matchedLines[0].words.length, 10);
  assert.equal(model.matchedLines[0].words[0].text, "bright");
  assert.equal(model.matchedLines[0].words[1].text, "splintering");
  assert.equal(model.matchedLines[0].words[1].startOffset, undefined);
  assert.equal(model.matchedLines[0].words[1].endOffset, undefined);
  assert.equal(model.matchedLines[0].words[1].timingSource, "duration-estimate");
  assert.equal(model.waveform.hasPeaks, true);
  assert.equal(model.waveform.zoom, 2);
  assert.equal(model.waveform.startTimeSeconds, 2.5);
  assert.equal(model.waveform.endTimeSeconds, 7.5);
  assert.equal(model.waveform.cursorPercent, 50);

  const playingModel = createNarrationRecordingReviewModel({
    recording,
    scene,
    reviewState,
    playbackState: {
      recordingId: "take-1",
      currentTimeSeconds: 8,
      durationSeconds: 10,
      status: "playing",
      active: true,
    },
    waveformState: {
      recordingId: "take-1",
      status: "ready",
      peaks: [0, 0.25, 0.5, 1, 0.75, 0.4, 0.2, 0.1],
      durationSeconds: 10,
    },
  });
  assert.equal(playingModel.isPlaying, true);
  assert.equal(playingModel.progressPercent, 80);
  assert.deepEqual(playingModel.cursor.currentWords, ["panel", "now"]);

  const alignedRecording = {
    ...recording,
    transcriptAlignment: {
      schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
      status: "ready",
      providerId: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
      transcriptHash: createNarrationRecordingTranscriptHash(recording.transcript),
      wordTimings: recording.transcript.split(" ").map((word, index) => ({
        index,
        text: word,
        startTimeSeconds: index === 1 ? 2.25 : index,
        endTimeSeconds: index === 1 ? 2.75 : index + 0.5,
        source: "speech-activity-segment",
        confidence: 0.62,
      })),
    },
  };
  const alignedModel = createNarrationRecordingReviewModel({
    recording: alignedRecording,
    scene,
    reviewState,
  });
  assert.equal(alignedModel.transcriptWords[1].timeSeconds, 2.25);
  assert.equal(alignedModel.transcriptWords[1].endTimeSeconds, 2.75);
  assert.equal(alignedModel.transcriptWords[1].timingSource, "speech-activity-segment");

  const delayedTimedRecording = {
    ...recording,
    id: "take-delayed-timing",
    durationMs: 50000,
    transcriptAlignment: {
      schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
      status: "ready",
      providerId: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
      transcriptHash: createNarrationRecordingTranscriptHash(recording.transcript),
      durationSeconds: 50,
      wordTimings: recording.transcript.split(" ").map((word, index) => ({
        index,
        text: word,
        startTimeSeconds: 20 + index,
        endTimeSeconds: 20.5 + index,
        source: "word-timestamp-provider",
        confidence: 0.91,
      })),
    },
  };
  const delayedTimedModel = createNarrationRecordingReviewModel({
    recording: delayedTimedRecording,
    scene,
    reviewState: createNarrationRecordingReviewState(delayedTimedRecording, {
      currentTimeSeconds: 3,
    }),
  });
  assert.equal(delayedTimedModel.cursor.timingResolution.strategy, "duration-ratio");
  assert.equal(delayedTimedModel.cursor.timingResolution.reason, "before-first-timed-word");
  assert.equal(delayedTimedModel.cursor.timingResolution.firstTimedWord.timeSeconds, 20);
  assert.equal(delayedTimedModel.cursor.timingResolution.providerTimedWordCount, 10);

  const athosTranscript = "a bright splintering light etched its way into John's retinas behind his closed eyelids I'll informed the others to meet you in the mess hall";
  const athosWords = athosTranscript.split(" ");
  const athosSpeechSegments = [
    { startTimeSeconds: 1.326, endTimeSeconds: 5.277 },
    { startTimeSeconds: 12.381, endTimeSeconds: 14.206 },
    { startTimeSeconds: 22.585, endTimeSeconds: 24.986 },
  ];
  const athosWordTimings = athosWords.map((word, index) => {
    const speechSegmentIndex = index <= 11 ? 0 : index <= 17 ? 1 : 2;
    const segmentStartWordIndex = speechSegmentIndex === 0 ? 0 : speechSegmentIndex === 1 ? 12 : 18;
    const segmentWordCount = speechSegmentIndex === 0 ? 12 : speechSegmentIndex === 1 ? 6 : 7;
    const segment = athosSpeechSegments[speechSegmentIndex];
    const wordDuration = (segment.endTimeSeconds - segment.startTimeSeconds) / segmentWordCount;
    const localIndex = index - segmentStartWordIndex;
    return {
      index,
      text: word,
      startTimeSeconds: segment.startTimeSeconds + (wordDuration * localIndex),
      endTimeSeconds: segment.startTimeSeconds + (wordDuration * (localIndex + 1)),
      source: "speech-activity-segment",
      confidence: 0.68,
      speechSegmentIndex,
    };
  });
  const athosRecording = {
    ...recording,
    id: "take-ms5efwhb-scene-0002-block-scene-0002-0002",
    transcript: athosTranscript,
    durationMs: 30021,
    transcriptAlignment: {
      schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
      status: "ready",
      providerId: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
      transcriptHash: createNarrationRecordingTranscriptHash(athosTranscript),
      durationSeconds: 30.021,
      speechSegments: athosSpeechSegments,
      wordTimings: athosWordTimings,
    },
  };
  const firstSpeechIslandModel = createNarrationRecordingReviewModel({
    recording: athosRecording,
    scene,
    reviewState: createNarrationRecordingReviewState(athosRecording, {
      currentTimeSeconds: 2.5,
    }),
  });
  assert.ok(firstSpeechIslandModel.cursor.wordIndex >= 0);
  assert.ok(firstSpeechIslandModel.cursor.wordIndex <= 11);
  assert.equal(firstSpeechIslandModel.cursor.currentWords.includes("hall"), false);

  const finalSpeechIslandModel = createNarrationRecordingReviewModel({
    recording: athosRecording,
    scene,
    reviewState: createNarrationRecordingReviewState(athosRecording, {
      currentTimeSeconds: 23.5,
    }),
  });
  assert.ok(finalSpeechIslandModel.cursor.wordIndex >= 18);
  assert.ok(finalSpeechIslandModel.cursor.wordIndex <= 24);
  assert.ok(finalSpeechIslandModel.cursor.currentWords.includes("hall") || finalSpeechIslandModel.cursor.afterWords.includes("hall"));

  const reviewSelection = createNarrationRecordingReviewSelection({
    recording,
    scene,
    startOffset: 6,
    endOffset: 16,
    durationSeconds: 10,
    source: "word",
  });
  assert.deepEqual(reviewSelection, {
    source: "word",
    startOffset: 6,
    endOffset: 16,
    startTimeSeconds: 1.0714285714285714,
    endTimeSeconds: 2.8571428571428568,
    selectedText: "beta gamma",
  });

  const transcriptSelection = createNarrationRecordingReviewSelection({
    recording,
    scene,
    startTimeSeconds: 1,
    endTimeSeconds: 3,
    durationSeconds: 10,
    source: "word",
    selectedText: "splintering light etched",
    startWordIndex: 1,
    endWordIndex: 3,
  });
  assert.deepEqual(transcriptSelection, {
    source: "word",
    startOffset: 6,
    endOffset: 16,
    startTimeSeconds: 1,
    endTimeSeconds: 3,
    selectedText: "splintering light etched",
    startWordIndex: 1,
    endWordIndex: 3,
  });

  const waveformSelection = createNarrationRecordingReviewSelection({
    recording,
    scene,
    startTimeSeconds: 2,
    endTimeSeconds: 4,
    durationSeconds: 10,
    source: "waveform",
  });
  assert.deepEqual(waveformSelection, {
    source: "waveform",
    startOffset: 11,
    endOffset: 22,
    startTimeSeconds: 2,
    endTimeSeconds: 4,
    selectedText: "gamma delta",
  });

  const html = renderNarrationRecordingReviewHTML({
    recording,
    scene,
    reviewState: createNarrationRecordingReviewState(recording, {
      currentTimeSeconds: 5,
      waveformZoom: 2,
      selection: transcriptSelection,
    }),
    playbackState: {
      recordingId: "take-1",
      currentTimeSeconds: 5,
      durationSeconds: 10,
      status: "playing",
      active: true,
    },
    waveformState: {
      recordingId: "take-1",
      status: "ready",
      peaks: [0, 0.25, 0.5, 1, 0.75, 0.4, 0.2, 0.1],
      durationSeconds: 10,
    },
  });
  assert.match(html, /class="narration-recording-review"/);
  assert.match(html, /data-narration-review-seek/);
  assert.match(html, /data-narration-review-waveform-panel/);
  assert.match(html, /data-action="seek-narration-recording-waveform"/);
  assert.match(html, /data-narration-review-waveform-zoom/);
  assert.match(html, /data-action="re-record-voice-recording-selection"/);
  assert.match(html, /Re-record selection/);
  assert.match(html, /Play from cursor/);
  assert.match(html, /data-action="stop-voice-recording-preview"/);
  assert.match(html, /data-action="seek-narration-recording-word"/);
  assert.match(html, /data-review-word-index="5"/);
  assert.match(html, /data-review-word-start-offset=""/);
  assert.match(html, /narration-recording-review__word\s+is-current/);
  assert.match(html, /narration-recording-review__word\s+is-selected/);
  assert.match(html, /narration-recording-review__waveform-selection/);
  assert.match(html, /bright/);
  assert.match(html, /class="narration-recording-review__word is-current"[\s\S]*?>the<\/button>/);
  assert.match(html, /class="narration-recording-review__word is-selected"[\s\S]*?>splintering<\/button>/);
  assert.match(html, /Line 42/);
  assert.doesNotMatch(html, /<p>alpha beta gamma delta epsilon zeta eta theta iota kappa<\/p>/);
  assert.doesNotMatch(html, />alpha<\/button>/);

  const rangeHtml = renderNarrationRecordingReviewHTML({
    recording: {
      ...recording,
      displayStartLineNumber: 10,
      displayEndLineNumber: 15,
    },
    scene,
    reviewState,
  });
  assert.match(rangeHtml, /Lines 10-15/);

  const pendingHtml = renderNarrationRecordingReviewHTML({
    recording: {
      ...recording,
      transcript: "",
    },
    scene,
    reviewState,
  });
  assert.match(pendingHtml, /Transcript pending/);
  assert.doesNotMatch(pendingHtml, /data-review-word-index="0"/);
  assert.doesNotMatch(pendingHtml, />alpha<\/button>/);
}
