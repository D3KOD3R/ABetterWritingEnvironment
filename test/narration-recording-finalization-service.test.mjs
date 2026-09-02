// Intent: verify narration recording finalization and media-save mapping stay outside app.js.
import assert from "node:assert/strict";

import { createNarrationRecordingFinalizationService } from "../apps/editor/public/features/narration/narration-recording-finalization-service.js";

export async function runNarrationRecordingFinalizationServiceTest() {
  const events = [];
  const selection = {
    sceneId: "scene-1",
    sceneTitle: "Scene One",
    blockId: "block-1",
    lineNumber: 1,
    verseText: " Line one. ",
  };
  const service = createNarrationRecordingFinalizationService({
    cleanupRuntime: () => events.push("cleanup"),
    saveMediaBlob: async ({ filePath, blob }) => {
      events.push(`save:${filePath}:${blob.size}`);
    },
    resolveSelection: () => selection,
    getProjectId: () => "project-1",
    reportLog: (...args) => events.push(`log:${args[1]}:${args[2]}`),
    blobConstructor: Blob,
  });

  const result = await service.finalizeRuntime({
    projectId: "project-1",
    recordingId: "take-1",
    selection,
    startedAtMs: 1000,
    transcript: " read   line ",
    mediaMimeType: "audio/webm",
    mediaPath: "assets/audio/take-1.webm",
    chunks: [new Blob(["audio"])],
    trackerStatus: "Finalizing narration take...",
  }, {
    stopError: new Error("stop failed"),
  });

  assert.equal(result.finalRecord.id, "take-1");
  assert.equal(result.finalRecord.status, "saved");
  assert.equal(result.finalRecord.transcript, "read line");
  assert.equal(result.sessionOptions.trackerStatus, "Narration take saved.");
  assert.equal(result.sessionOptions.recordingId, "take-1");
  assert.equal(result.selection, selection);
  assert.equal(events.includes("cleanup"), true);
  assert.equal(events.includes("save:assets/audio/take-1.webm:5"), true);
  assert.equal(events.includes("log:voice-recording:Failed to stop a narration recording cleanly."), true);

  const followed = await service.finalizeRuntime({
    projectId: "project-1",
    recordingId: "take-1b",
    selection,
    followSelection: {
      ...selection,
      blockId: "block-2",
      paragraphId: "paragraph-2",
      lineNumber: 8,
      verseText: "Line two.",
      selectedText: "Line two.",
      confidence: 0.82,
      wordFitRatio: 0.78,
      matchedWordCount: 4,
    },
    startedAtMs: 1000,
    transcript: "line two",
    mediaMimeType: "audio/webm",
    mediaPath: "assets/audio/take-1b.webm",
    chunks: [new Blob(["audio"])],
  });
  assert.equal(followed.selection.blockId, "block-2");
  assert.equal(followed.finalRecord.blockId, "block-2");
  assert.equal(followed.finalRecord.verseText, "Line two.");

  const lowConfidenceFollow = await service.finalizeRuntime({
    projectId: "project-1",
    recordingId: "take-1c",
    selection,
    followSelection: {
      ...selection,
      blockId: "block-3",
      confidence: 0.4,
      wordFitRatio: 0.5,
      matchedWordCount: 2,
    },
    startedAtMs: 1000,
    transcript: "line",
    mediaMimeType: "audio/webm",
    mediaPath: "assets/audio/take-1c.webm",
    chunks: [new Blob(["audio"])],
  });
  assert.equal(lowConfidenceFollow.selection.blockId, "block-1");
  assert.equal(lowConfidenceFollow.finalRecord.blockId, "block-1");

  const failedService = createNarrationRecordingFinalizationService({
    cleanupRuntime: () => {},
    saveMediaBlob: async () => {
      throw new Error("disk full");
    },
    resolveSelection: () => selection,
    getProjectId: () => "project-1",
    reportLog: (...args) => events.push(`log:${args[1]}:${args[2]}`),
    blobConstructor: Blob,
  });
  const failed = await failedService.finalizeRuntime({
    projectId: "project-1",
    recordingId: "take-2",
    selection,
    startedAtMs: 1000,
    transcript: "",
    mediaMimeType: "audio/webm",
    mediaPath: "assets/audio/take-2.webm",
    chunks: [new Blob(["audio"])],
  });
  assert.equal(failed.finalRecord.status, "failed");
  assert.match(failed.sessionOptions.trackerStatus, /disk full/);
}
