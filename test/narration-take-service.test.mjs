// Intent: verify narration take DTO and media naming rules stay outside app.js.
import assert from "node:assert/strict";

import {
  buildVoiceRecordingMediaPath,
  buildNarrationRecordingFinalizationContext,
  createFinalNarrationRecordingRecord,
  createNarrationRecordingBlob,
  createNarrationRecordingId,
  createNarrationRecordingInitialSessionOptions,
  createNarrationRecordingRecord,
  createNarrationRecordingRuntime,
  createNarrationTakeSession,
  formatNarrationRecordingElapsedLabel,
  getSupportedNarrationRecordingMimeType,
  getVoiceRecordingMediaName,
  normalizeNarrationTakeTranscript,
  sanitizeFileNameSegment,
} from "../apps/editor/public/features/narration/narration-take-service.js";

export function runNarrationTakeServiceTest() {
  const selection = {
    chapterId: "chapter-1",
    chapterTitle: "Opening",
    sceneId: "scene:1",
    sceneTitle: "First Scene",
    blockId: "block/2",
    paragraphId: "paragraph-3",
    lineNumber: 7,
    verseText: "  First   line. ",
  };

  assert.equal(sanitizeFileNameSegment(" scene: one / two "), "scene-one-two");
  assert.equal(createNarrationRecordingId(selection, { nowMs: 36 }), "take-10-scene-1-block-2");
  assert.equal(getVoiceRecordingMediaName("take:one", "audio/ogg;codecs=opus"), "take-one.ogg");
  assert.equal(buildVoiceRecordingMediaPath("project:one", "take:one", "audio/webm"), "project-media/project-one/take-one.webm");
  assert.equal(formatNarrationRecordingElapsedLabel(3661000), "1:01:01");
  assert.equal(normalizeNarrationTakeTranscript(" one\n two   three "), "one two three");

  const mediaRecorder = {
    isTypeSupported(candidate) {
      return candidate === "audio/ogg";
    },
  };
  assert.equal(getSupportedNarrationRecordingMimeType({ mediaRecorder }), "audio/ogg");

  const session = createNarrationTakeSession(selection, {
    status: "recording",
    trackerStatus: " Listening ",
    transcript: "spoken line",
    startedAtMs: 0,
    recordingId: "take-1",
    mediaPath: "project-media/project/take-1.webm",
  });
  assert.equal(session.status, "recording");
  assert.equal(session.trackerStatus, "Listening");
  assert.equal(session.startedAt, "1970-01-01T00:00:00.000Z");
  assert.notEqual(session.selection, selection);

  const record = createNarrationRecordingRecord(selection, {
    projectId: "project-1",
    recordingId: "take-1",
    transcript: " captured   transcript ",
    mediaMimeType: "audio/mp4",
    durationMs: 1099.8,
    createdAt: "2026-05-31T00:00:00.000Z",
  });
  assert.equal(record.id, "take-1");
  assert.equal(record.projectId, "project-1");
  assert.equal(record.mediaName, "take-1.m4a");
  assert.equal(record.mediaPath, "project-media/project-1/take-1.m4a");
  assert.equal(record.verseText, "First line.");
  assert.equal(record.transcript, "captured transcript");
  assert.equal(record.durationMs, 1100);
  assert.equal(record.status, "saved");

  const blob = createNarrationRecordingBlob({
    mediaMimeType: "audio/webm",
    chunks: [new Blob(["audio"])],
  });
  assert.equal(blob.type, "audio/webm");

  const finalization = buildNarrationRecordingFinalizationContext({
    projectId: "project-1",
    recordingId: "take-2",
    transcript: " final   transcript ",
    startedAtMs: 1000,
    mediaMimeType: "audio/webm",
    chunks: [],
  }, {
    selection,
    nowMs: 2500,
  });
  assert.equal(finalization.transcript, "final transcript");
  assert.equal(finalization.durationMs, 1500);
  assert.equal(finalization.mediaPath, "project-media/project-1/take-2.webm");

  const failedRecord = createFinalNarrationRecordingRecord(finalization, {
    status: "failed",
  });
  assert.equal(failedRecord.id, "take-2");
  assert.equal(failedRecord.status, "failed");

  const runtime = createNarrationRecordingRuntime(selection, {
    projectId: "project-1",
    nowMs: 36,
    timerId: 99,
  });
  assert.equal(runtime.recordingId, "take-10-scene-1-block-2");
  assert.equal(runtime.mediaPath, "project-media/project-1/take-10-scene-1-block-2.webm");
  assert.equal(runtime.trackerStatus, "Requesting microphone access...");
  assert.notEqual(runtime.selection, selection);

  assert.deepEqual(createNarrationRecordingInitialSessionOptions(runtime), {
    status: "paused",
    trackerStatus: "Requesting microphone access...",
    transcript: "",
    elapsedLabel: "0:00",
    recordingId: "take-10-scene-1-block-2",
    mediaPath: "project-media/project-1/take-10-scene-1-block-2.webm",
    startedAtMs: 36,
  });
}
