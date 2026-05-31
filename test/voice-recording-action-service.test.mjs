// Intent: verify saved recording preview and verse navigation actions stay outside app.js.
import assert from "node:assert/strict";

import { createVoiceRecordingActionService } from "../apps/editor/public/features/voice/voice-recording-action-service.js";

export async function runVoiceRecordingActionServiceTest() {
  const events = [];
  const recordings = new Map([
    ["take-1", {
      id: "take-1",
      status: "saved",
      mediaPath: "project-media/project-1/take-1.webm",
      mediaMimeType: "audio/webm",
      sceneId: "scene-1",
      blockId: "block-2",
    }],
    ["draft", {
      id: "draft",
      status: "failed",
      mediaPath: "project-media/project-1/draft.webm",
    }],
  ]);
  const service = createVoiceRecordingActionService({
    getRecordingById: (id) => recordings.get(id) ?? null,
    loadMediaBlob: async ({ filePath, mediaMimeType }) => {
      events.push(`load:${filePath}:${mediaMimeType}`);
      return { blob: new Blob(["audio"], { type: mediaMimeType }) };
    },
    playBlob: async (blob) => events.push(`play:${blob.type}:${blob.size}`),
    getScene: (sceneId) => sceneId === "scene-1"
      ? {
          sceneId,
          blocks: [
            { blockId: "block-1" },
            { blockId: "block-2" },
          ],
        }
      : null,
    reportLog: (...args) => events.push(`log:${args[1]}:${args[2]}`),
  });

  assert.deepEqual(await service.previewRecording("missing"), {
    ok: false,
    reason: "unavailable",
  });
  assert.deepEqual(await service.previewRecording("draft"), {
    ok: false,
    reason: "unavailable",
  });

  const preview = await service.previewRecording("take-1");
  assert.equal(preview.ok, true);
  assert.equal(preview.recording.id, "take-1");
  assert.equal(events.includes("load:project-media/project-1/take-1.webm:audio/webm"), true);
  assert.equal(events.includes("play:audio/webm:5"), true);

  const plan = service.planRecordingVerseNavigation("take-1");
  assert.deepEqual({
    ok: plan.ok,
    sceneId: plan.sceneId,
    selectedBlockId: plan.selectedBlockId,
  }, {
    ok: true,
    sceneId: "scene-1",
    selectedBlockId: "block-2",
  });
  assert.equal(service.planRecordingVerseNavigation("missing").reason, "missing-recording");

  recordings.set("take-missing-scene", {
    id: "take-missing-scene",
    status: "saved",
    sceneId: "missing-scene",
    blockId: "block-1",
  });
  assert.equal(service.planRecordingVerseNavigation("take-missing-scene").reason, "missing-scene");
}
