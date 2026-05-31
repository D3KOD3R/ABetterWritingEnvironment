// Intent: verify narration speech-recognition tracker handling stays outside app.js.
import assert from "node:assert/strict";

import { createNarrationSpeechRecognitionService } from "../apps/editor/public/features/narration/narration-speech-recognition-service.js";

export function runNarrationSpeechRecognitionServiceTest() {
  const events = [];
  let runtime = {
    recordingId: "take-1",
    mediaRecorder: { state: "recording" },
    transcript: "",
    trackerStatus: "",
  };
  class Recognition {
    constructor() {
      events.push("recognition.constructed");
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
  });

  const recognition = service.createRecognition("take-1");
  assert.equal(recognition.continuous, true);
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.maxAlternatives, 1);
  assert.equal(recognition.lang, "en-US");

  recognition.onresult({
    results: [
      [{ transcript: " first " }],
      [{ transcript: " line " }],
    ],
  });
  assert.equal(runtime.transcript, "first line");
  assert.equal(runtime.trackerStatus, "Speech tracker active");

  recognition.onerror({ error: "no-speech" });
  assert.equal(runtime.trackerStatus, "Speech tracker no-speech");

  recognition.onend();
  assert.equal(runtime.trackerStatus, "Speech tracker paused");

  runtime = { ...runtime, recordingId: "take-2" };
  recognition.onresult({ results: [[{ transcript: "ignored" }]] });
  assert.equal(runtime.transcript, "first line");

  assert.deepEqual(events, [
    "recognition.constructed",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
    "patch:take-1",
    "session.refresh",
  ]);
  assert.equal(createNarrationSpeechRecognitionService().createRecognition("take-1"), null);
}
