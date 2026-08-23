// Intent: verify saved-take transcript timing alignment maps words to speech-active audio instead of total duration.
import assert from "node:assert/strict";

import {
  NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
  NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
  NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
  createNarrationRecordingWordTimestampTimingMap,
  createNarrationRecordingTranscriptAudioAlignment,
  createNarrationRecordingTranscriptHash,
  resolveNarrationRecordingAlignedSeekTime,
  resolveNarrationRecordingAlignedWordTimings,
  shouldRefreshNarrationRecordingTranscriptAlignment,
} from "../apps/editor/public/features/narration/narration-recording-alignment-service.js";

function createSampleBuffer({
  sampleRate = 1000,
  durationSeconds = 6,
  speechRanges = [],
} = {}) {
  const samples = new Float32Array(Math.round(sampleRate * durationSeconds));
  for (let index = 0; index < samples.length; index += 1) {
    const timeSeconds = index / sampleRate;
    const inSpeech = speechRanges.some((range) => timeSeconds >= range[0] && timeSeconds < range[1]);
    samples[index] = inSpeech ? 0.2 : 0.001;
  }

  return {
    sampleRate,
    length: samples.length,
    duration: durationSeconds,
    numberOfChannels: 1,
    getChannelData() {
      return samples;
    },
  };
}

export async function runNarrationRecordingAlignmentServiceTest() {
  const recording = {
    id: "take-1",
    status: "saved",
    mediaPath: "project-media/project-1/take-1.webm",
    mediaMimeType: "audio/webm",
    transcript: "alpha beta gamma delta",
    durationMs: 6000,
  };
  const fakeAudioBuffer = createSampleBuffer({
    speechRanges: [
      [1, 3],
      [3.8, 5.2],
    ],
  });
  let audioContextClosed = false;
  const alignment = await createNarrationRecordingTranscriptAudioAlignment(recording, new Blob(["audio"]), {
    audioContextFactory: () => ({
      decodeAudioData: async () => fakeAudioBuffer,
      close: async () => {
        audioContextClosed = true;
      },
    }),
    now: () => "2026-07-29T00:00:00.000Z",
  });

  assert.equal(audioContextClosed, true);
  assert.equal(alignment.schemaVersion, NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION);
  assert.equal(alignment.providerId, NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID);
  assert.equal(alignment.status, "ready");
  assert.equal(alignment.wordTimings.length, 4);
  assert.equal(alignment.transcriptHash, createNarrationRecordingTranscriptHash(recording.transcript));
  assert.equal(alignment.speechSegments.length, 2);
  assert.deepEqual(alignment.segmentAssignments.map((assignment) => [
    assignment.startWordIndex,
    assignment.endWordIndex,
  ]), [
    [0, 1],
    [2, 3],
  ]);
  assert.ok(alignment.wordTimings[0].startTimeSeconds >= 0.95);
  assert.ok(alignment.wordTimings[0].startTimeSeconds < 1.1);
  assert.ok(alignment.wordTimings[3].startTimeSeconds >= 4);
  assert.ok(alignment.wordTimings.every((word) => word.startTimeSeconds < 5.3));

  const resolved = resolveNarrationRecordingAlignedWordTimings({
    transcript: recording.transcript,
    transcriptWords: ["alpha", "beta", "gamma", "delta"],
    durationSeconds: 6,
    transcriptAlignment: alignment,
  });
  assert.equal(resolved.length, 4);
  assert.equal(resolved[0].timingSource, "speech-activity-segment");
  assert.equal(resolved[0].timeSeconds, alignment.wordTimings[0].startTimeSeconds);
  assert.equal(resolved[3].speechSegmentIndex, 1);

  const wordTimestampMap = createNarrationRecordingWordTimestampTimingMap(
    ["alpha", "beta", "gamma", "delta"],
    {
      providerId: NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
      transcript: "alpha gamma delta",
      words: [
        { text: "alpha", startTimeSeconds: 1.1, endTimeSeconds: 1.4, confidence: 0.9 },
        { text: "gamma", startTimeSeconds: 2.2, endTimeSeconds: 2.55, confidence: 0.87 },
        { text: "delta", startTimeSeconds: 4.1, endTimeSeconds: 4.45, confidence: 0.86 },
      ],
    },
    {
      durationSeconds: 6,
      speechSegments: alignment.speechSegments,
    },
  );
  assert.equal(wordTimestampMap.providerId, NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID);
  assert.equal(wordTimestampMap.wordTimings[0].source, "word-timestamp-provider");
  assert.equal(wordTimestampMap.wordTimings[0].startTimeSeconds, 1.1);
  assert.equal(wordTimestampMap.wordTimings[1].source, "word-timestamp-interpolated");
  assert.ok(wordTimestampMap.wordTimings[1].startTimeSeconds >= wordTimestampMap.wordTimings[0].endTimeSeconds);
  assert.ok(wordTimestampMap.wordTimings[1].endTimeSeconds <= wordTimestampMap.wordTimings[2].startTimeSeconds);
  assert.equal(wordTimestampMap.wordTimingProvider.matchedWordCount, 3);
  assert.equal(wordTimestampMap.wordTimingProvider.status, "ready");

  const wakingRegressionTranscriptWords = "strangely and chanting waking from what fault like a decade of deep sleep John roll over with immense effort".split(/\s+/);
  const wakingRegressionMap = createNarrationRecordingWordTimestampTimingMap(
    wakingRegressionTranscriptWords,
    {
      providerId: NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
      transcript: "Icycles clung to the cabin roof doing anyone brave enough to trespass below them wincing radium beams of warm morning light pierced through them momentarily blinding the captain a sensation both agonizing yet strangely enchanting Seeing from what felt like a decade of deep sleep John rolled over with immense effort",
      words: [
        { text: "strangely", startTimeSeconds: 21.82, endTimeSeconds: 23.39, confidence: 0.99 },
        { text: "enchanting.", startTimeSeconds: 23.39, endTimeSeconds: 26.24, confidence: 0.99 },
        { text: "Seeing", startTimeSeconds: 26.24, endTimeSeconds: 26.62, confidence: 0.94 },
        { text: "from", startTimeSeconds: 26.62, endTimeSeconds: 26.87, confidence: 0.98 },
        { text: "felt", startTimeSeconds: 27.16, endTimeSeconds: 27.35, confidence: 0.99 },
        { text: "like", startTimeSeconds: 27.38, endTimeSeconds: 27.62, confidence: 0.99 },
        { text: "decade", startTimeSeconds: 27.69, endTimeSeconds: 28.05, confidence: 0.99 },
        { text: "deep", startTimeSeconds: 28.1, endTimeSeconds: 28.42, confidence: 0.99 },
        { text: "sleep", startTimeSeconds: 28.46, endTimeSeconds: 29.15, confidence: 0.99 },
        { text: "John", startTimeSeconds: 29.2, endTimeSeconds: 29.55, confidence: 0.99 },
        { text: "rolled", startTimeSeconds: 29.58, endTimeSeconds: 30.08, confidence: 0.99 },
        { text: "over", startTimeSeconds: 30.12, endTimeSeconds: 30.5, confidence: 0.99 },
        { text: "with", startTimeSeconds: 30.54, endTimeSeconds: 30.85, confidence: 0.99 },
        { text: "immense", startTimeSeconds: 30.9, endTimeSeconds: 31.42, confidence: 0.99 },
        { text: "effort", startTimeSeconds: 31.48, endTimeSeconds: 32.05, confidence: 0.99 },
      ],
    },
    {
      durationSeconds: 37,
      speechSegments: [{ startTimeSeconds: 21.5, endTimeSeconds: 32.2 }],
    },
  );
  assert.ok(wakingRegressionMap);
  const wakingTiming = wakingRegressionMap.wordTimings[wakingRegressionTranscriptWords.indexOf("waking")];
  assert.equal(wakingTiming.text, "waking");
  assert.ok(wakingTiming.startTimeSeconds >= 26.2);
  assert.ok(wakingTiming.startTimeSeconds < 26.62);
  assert.notEqual(wakingTiming.startTimeSeconds, 17.533);
  assert.equal(wakingTiming.source, "word-timestamp-interpolated");
  assert.equal(wakingRegressionMap.wordTimings[wakingRegressionTranscriptWords.indexOf("from")].source, "word-timestamp-provider");

  const providerBackedAlignment = await createNarrationRecordingTranscriptAudioAlignment(recording, new Blob(["audio"]), {
    audioContextFactory: () => ({
      decodeAudioData: async () => fakeAudioBuffer,
      close: async () => {},
    }),
    wordTimingProvider: async () => ({
      providerId: NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
      transcript: recording.transcript,
      words: [
        { text: "alpha", startTimeSeconds: 1.12, endTimeSeconds: 1.32, confidence: 0.96 },
        { text: "beta", startTimeSeconds: 1.5, endTimeSeconds: 1.78, confidence: 0.94 },
        { text: "gamma", startTimeSeconds: 3.95, endTimeSeconds: 4.22, confidence: 0.95 },
        { text: "delta", startTimeSeconds: 4.36, endTimeSeconds: 4.62, confidence: 0.93 },
      ],
    }),
    now: () => "2026-07-29T00:00:00.000Z",
  });
  assert.equal(providerBackedAlignment.providerId, NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID);
  assert.equal(providerBackedAlignment.source, "word-timestamp-provider");
  assert.equal(providerBackedAlignment.wordTimings[1].startTimeSeconds, 1.5);
  assert.equal(providerBackedAlignment.wordTimings[1].source, "word-timestamp-provider");
  assert.equal(providerBackedAlignment.wordTimingProvider.matchedWordCount, 4);
  assert.equal(providerBackedAlignment.wordTimingProvider.status, "ready");

  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcriptAlignment: providerBackedAlignment,
  }), false);
  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcriptAlignment: {
      ...alignment,
      schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
      wordTimingProvider: null,
    },
  }), true);
  const failedProviderFallbackAlignment = await createNarrationRecordingTranscriptAudioAlignment(recording, new Blob(["audio"]), {
    audioContextFactory: () => ({
      decodeAudioData: async () => fakeAudioBuffer,
      close: async () => {},
    }),
    wordTimingProvider: async () => {
      throw new Error("provider offline");
    },
    now: () => "2026-07-29T00:00:00.000Z",
  });
  assert.equal(failedProviderFallbackAlignment.providerId, NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID);
  assert.equal(failedProviderFallbackAlignment.wordTimingProvider.id, NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID);
  assert.equal(failedProviderFallbackAlignment.wordTimingProvider.status, "failed");
  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcriptAlignment: failedProviderFallbackAlignment,
  }), false);
  const legacyAlignment = {
    ...alignment,
    schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION - 1,
    providerId: "browser-audio-energy-v1",
  };
  assert.equal(resolveNarrationRecordingAlignedWordTimings({
    transcript: recording.transcript,
    transcriptWords: ["alpha", "beta", "gamma", "delta"],
    durationSeconds: 6,
    transcriptAlignment: legacyAlignment,
  }).length, 0);
  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcriptAlignment: legacyAlignment,
  }), true);
  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcript: "alpha beta gamma epsilon",
    transcriptAlignment: alignment,
  }), true);
  assert.equal(shouldRefreshNarrationRecordingTranscriptAlignment({
    ...recording,
    transcript: "",
  }), false);

  const athosRecording = {
    id: "take-ms5efwhb-scene-0002-block-scene-0002-0002",
    status: "saved",
    mediaPath: "project-media/project-1/take-ms5efwhb-scene-0002-block-scene-0002-0002.webm",
    mediaMimeType: "audio/webm",
    transcript: "a bright splintering light etched its way into John's retinas behind his closed eyelids I'll informed the others to meet you in the mess hall",
    durationMs: 30021,
  };
  const athosBuffer = createSampleBuffer({
    durationSeconds: 30.021,
    speechRanges: [
      [1.326, 5.277],
      [12.381, 14.206],
      [22.585, 24.986],
    ],
  });
  const athosAlignment = await createNarrationRecordingTranscriptAudioAlignment(athosRecording, new Blob(["audio"]), {
    audioContextFactory: () => ({
      decodeAudioData: async () => athosBuffer,
      close: async () => {},
    }),
    frameSeconds: 0.001,
    now: () => "2026-07-29T00:00:00.000Z",
  });
  assert.equal(athosAlignment.wordTimings.length, 25);
  assert.deepEqual(athosAlignment.segmentAssignments.map((assignment) => [
    assignment.startWordIndex,
    assignment.endWordIndex,
  ]), [
    [0, 11],
    [12, 17],
    [18, 24],
  ]);
  for (const wordTiming of athosAlignment.wordTimings) {
    const speechSegment = athosAlignment.speechSegments[wordTiming.speechSegmentIndex];
    assert.ok(wordTiming.startTimeSeconds >= speechSegment.startTimeSeconds);
    assert.ok(wordTiming.endTimeSeconds <= speechSegment.endTimeSeconds);
  }
  assert.equal(athosAlignment.wordTimings[12].text, "closed");
  assert.ok(athosAlignment.wordTimings[12].startTimeSeconds >= athosAlignment.speechSegments[1].startTimeSeconds);
  assert.ok(athosAlignment.wordTimings[12].endTimeSeconds <= athosAlignment.speechSegments[1].endTimeSeconds);
  assert.equal(athosAlignment.wordTimings[17].text, "others");
  assert.ok(athosAlignment.wordTimings[17].endTimeSeconds <= athosAlignment.speechSegments[1].endTimeSeconds);
  assert.equal(athosAlignment.wordTimings[18].text, "to");
  assert.ok(athosAlignment.wordTimings[18].startTimeSeconds >= athosAlignment.speechSegments[2].startTimeSeconds);
  assert.equal(athosAlignment.wordTimings[24].text, "hall");
  assert.ok(athosAlignment.wordTimings[24].startTimeSeconds >= athosAlignment.speechSegments[2].startTimeSeconds);
  assert.equal(resolveNarrationRecordingAlignedSeekTime({
    transcriptAlignment: athosAlignment,
    requestedTimeSeconds: 3,
    durationSeconds: 30.021,
  }), 3);
  const snappedGapTime = resolveNarrationRecordingAlignedSeekTime({
    transcriptAlignment: athosAlignment,
    requestedTimeSeconds: 10,
    durationSeconds: 30.021,
  });
  assert.ok(snappedGapTime >= athosAlignment.speechSegments[1].startTimeSeconds);
  assert.ok(snappedGapTime <= athosAlignment.speechSegments[1].startTimeSeconds + 0.03);
  const snappedLateGapTime = resolveNarrationRecordingAlignedSeekTime({
    transcriptAlignment: athosAlignment,
    requestedTimeSeconds: 20,
    durationSeconds: 30.021,
  });
  assert.ok(snappedLateGapTime >= athosAlignment.speechSegments[2].startTimeSeconds);
  assert.ok(snappedLateGapTime <= athosAlignment.speechSegments[2].startTimeSeconds + 0.03);
}
