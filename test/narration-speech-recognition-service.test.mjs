// Intent: verify narration speech-recognition tracker handling stays outside app.js.
import assert from "node:assert/strict";

import {
  createNarrationSpeechRecognitionService,
  createNarrationSpeechRecognitionTranscriptSnapshot,
} from "../apps/editor/public/features/narration/narration-speech-recognition-service.js";

export function runNarrationSpeechRecognitionServiceTest() {
  const events = [];
  let runtime = {
    recordingId: "take-1",
    mediaRecorder: { state: "recording" },
    selection: {
      lineNumber: 7,
      displayLineNumber: 315,
    },
    transcript: "",
    trackerStatus: "",
    followSelection: null,
    followMatch: null,
  };
  class Recognition {
    constructor() {
      events.push("recognition.constructed");
    }

    start() {
      events.push("recognition.start");
    }
  }
  const service = createNarrationSpeechRecognitionService({
    recognitionConstructor: Recognition,
    getRuntime: () => runtime,
    applyRuntimePatch: (recordingId, patch) => {
      events.push(`patch:${recordingId}`);
      runtime = { ...runtime, ...patch };
    },
    refreshSession: () => events.push("session.refresh"),
    resolveFollowMatch: ({ transcript }) => transcript === "first line"
      ? {
        trackerStatus: "Tracking line 315 · 92%",
        followSelection: {
          id: "narration-follow:scene-1:block-1:0:10",
          sceneId: "scene-1",
          blockId: "block-1",
          lineNumber: 7,
          displayLineNumber: 315,
          startOffset: 0,
          endOffset: 10,
        },
        match: {
          blockId: "block-1",
          lineNumber: 7,
          confidence: 0.92,
        },
      }
      : null,
  });

  const recognition = service.createRecognition("take-1");
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.maxAlternatives, 1);
  assert.equal(recognition.lang, "en-US");

  recognition.onstart();
  assert.equal(runtime.trackerStatus, "Speech tracker listening at line 315");

  recognition.onaudiostart();
  assert.equal(runtime.trackerStatus, "Microphone audio detected");

  recognition.onspeechstart();
  assert.equal(runtime.trackerStatus, "Speech detected; matching manuscript...");

  recognition.onresult({
    resultIndex: 1,
    results: [
      Object.assign([{ transcript: " first ", confidence: 0.91 }], { isFinal: true }),
      Object.assign([{ transcript: " line " }], { isFinal: false }),
    ],
  });
  assert.equal(runtime.transcript, "first line");
  assert.equal(runtime.speechSnapshot.finalTranscript, "first");
  assert.equal(runtime.speechSnapshot.interimTranscript, "line");
  assert.equal(runtime.speechSnapshot.changedTranscript, "line");
  assert.equal(runtime.trackerStatus, "Tracking line 315 · 92%");
  assert.equal(runtime.followSelection.blockId, "block-1");
  assert.equal(runtime.followMatch.lineNumber, 7);

  recognition.onspeechend();
  assert.equal(runtime.trackerStatus, "Speech paused; last match line 315");

  recognition.onend();
  assert.equal(runtime.trackerStatus, "Speech tracker listening at line 315");

  recognition.onerror({ error: "no-speech" });
  assert.equal(runtime.trackerStatus, "Speech tracker no-speech");

  runtime = { ...runtime, recordingId: "take-2" };
  recognition.onresult({ results: [[{ transcript: "ignored" }]] });
  assert.equal(runtime.transcript, "first line");

  assert.deepEqual(
    createNarrationSpeechRecognitionTranscriptSnapshot([
      Object.assign([{ transcript: " alpha " }], { isFinal: true }),
      Object.assign([{ transcript: " beta " }], { isFinal: false }),
    ], {
      resultIndex: 1,
    }),
    {
      transcript: "alpha beta",
      finalTranscript: "alpha",
      interimTranscript: "beta",
      changedTranscript: "beta",
      segmentCount: 2,
      finalSegmentCount: 1,
      interimSegmentCount: 1,
      resultIndex: 1,
    },
  );

  assert.deepEqual(events, [
    "recognition.constructed",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
    "recognition.start",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
  ]);
  assert.equal(createNarrationSpeechRecognitionService().createRecognition("take-1"), null);
}
