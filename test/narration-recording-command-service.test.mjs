// Intent: verify narration recording start/stop command sequencing stays outside app.js.
import assert from "node:assert/strict";

import { createNarrationRecordingCommandService } from "../apps/editor/public/features/narration/narration-recording-command-service.js";

export async function runNarrationRecordingCommandServiceTest() {
  const events = [];
  const selection = {
    sceneId: "scene-1",
    sceneTitle: "Scene One",
    blockId: "block-1",
    lineNumber: 1,
    verseText: "Line one.",
  };
  let runtime = null;
  let session = null;
  const stream = {
    getTracks() {
      return [{ stop: () => events.push("track.stop") }];
    },
  };
  const recorder = {
    state: "recording",
    start(timeslice) {
      events.push(`recorder.start:${timeslice}`);
    },
    stop() {
      events.push("recorder.stop");
    },
  };
  const recognition = {
    start() {
      events.push("speech.start");
    },
  };
  const service = createNarrationRecordingCommandService({
    getRuntime: () => runtime,
    setRuntime: (value) => {
      runtime = value;
      events.push(`runtime.set:${value?.trackerStatus ?? "null"}`);
    },
    resolveSelection: () => ({ scene: { sceneId: "scene-1" }, selection }),
    getProjectId: () => "project-1",
    setSession: (value) => {
      session = value;
      events.push(`session.set:${value.trackerStatus}`);
    },
    createTimer: () => 99,
    getUserMedia: async () => {
      events.push("microphone.request");
      return stream;
    },
    hasMicrophoneCapture: () => true,
    hasMediaRecorder: () => true,
    mediaRecorderConstructor: { isTypeSupported: (candidate) => candidate === "audio/webm" },
    createRecorder: () => {
      events.push("recorder.create");
      return recorder;
    },
    createRecognition: () => {
      events.push("speech.create");
      return recognition;
    },
    updateSessionFromRuntime: (overrides = {}) => events.push(`session.refresh:${overrides.status ?? ""}:${overrides.trackerStatus ?? ""}`),
    abortStart: async () => events.push("abort"),
    finalizeRecording: async () => events.push("finalize"),
    nowMs: () => 36,
  });

  await service.startRecording("scene-1");
  assert.equal(runtime.recordingId, "take-10-scene-1-block-1");
  assert.equal(runtime.stream, stream);
  assert.equal(runtime.mediaRecorder, recorder);
  assert.equal(runtime.speechRecognition, recognition);
  assert.equal(session.recordingId, "take-10-scene-1-block-1");

  await service.stopRecording();

  assert.deepEqual(events, [
    "runtime.set:Requesting microphone access...",
    "session.set:Requesting microphone access...",
    "microphone.request",
    "runtime.set:Requesting microphone access...",
    "recorder.create",
    "runtime.set:Requesting microphone access...",
    "speech.create",
    "runtime.set:Speech tracker active",
    "speech.start",
    "session.refresh:recording:Speech tracker active",
    "recorder.start:1000",
    "runtime.set:Finalizing narration take...",
    "session.refresh::",
    "recorder.stop",
  ]);

  runtime = null;
  session = null;
  const missingSelectionService = createNarrationRecordingCommandService({
    getRuntime: () => runtime,
    setRuntime: (value) => {
      runtime = value;
    },
    resolveSelection: () => ({ scene: null, selection: null }),
    getProjectId: () => "project-1",
    setSession: (value) => {
      session = value;
    },
    createTimer: () => 1,
    getUserMedia: async () => stream,
    hasMicrophoneCapture: () => true,
    hasMediaRecorder: () => true,
    mediaRecorderConstructor: null,
    createRecorder: () => recorder,
    createRecognition: () => null,
    updateSessionFromRuntime: () => {},
    abortStart: async () => {},
    finalizeRecording: async () => {},
    nowMs: () => 36,
  });
  await missingSelectionService.startRecording("missing");
  assert.equal(session.trackerStatus, "Select a verse before starting a narration take.");
}
