// Intent: verify MediaRecorder event handling is owned outside app.js.
import assert from "node:assert/strict";

import { createNarrationMediaRecorderService } from "../apps/editor/public/features/narration/narration-media-recorder-service.js";

export function runNarrationMediaRecorderServiceTest() {
  const events = [];
  let runtime = {
    recordingId: "take-1",
    chunks: [],
    trackerStatus: "",
  };
  class Recorder {
    constructor(stream, options) {
      this.stream = stream;
      this.options = options;
      events.push(`recorder.constructed:${options?.mimeType ?? "default"}`);
    }
  }
  const service = createNarrationMediaRecorderService({
    mediaRecorderConstructor: Recorder,
    blobConstructor: Blob,
    getRuntime: () => runtime,
    appendChunk: (recordingId, chunk) => {
      events.push(`chunk:${recordingId}:${chunk.size}`);
      runtime.chunks.push(chunk);
    },
    applyRuntimePatch: (recordingId, patch) => {
      events.push(`patch:${recordingId}`);
      runtime = { ...runtime, ...patch };
    },
    refreshSession: () => events.push("session.refresh"),
    finalizeRecording: (recordingId) => events.push(`finalize:${recordingId}`),
  });

  const recorder = service.createRecorder("take-1", { id: "stream-1" }, {
    mediaMimeType: "audio/webm",
  });
  assert.equal(recorder.options.mimeType, "audio/webm");

  recorder.ondataavailable({ data: new Blob(["abc"], { type: "audio/webm" }) });
  recorder.ondataavailable({ data: new Blob([], { type: "audio/webm" }) });
  assert.equal(runtime.chunks.length, 1);

  recorder.onerror();
  assert.equal(runtime.trackerStatus, "Recorder error");

  recorder.onstop();
  runtime = { ...runtime, recordingId: "take-2" };
  recorder.ondataavailable({ data: new Blob(["ignored"], { type: "audio/webm" }) });
  assert.equal(runtime.chunks.length, 1);

  assert.deepEqual(events, [
    "recorder.constructed:audio/webm",
    "chunk:take-1:3",
    "patch:take-1",
    "session.refresh",
    "finalize:take-1",
  ]);

  assert.throws(
    () => createNarrationMediaRecorderService({ mediaRecorderConstructor: null }).createRecorder("take-1", {}),
    /MediaRecorder is not available/,
  );
}
