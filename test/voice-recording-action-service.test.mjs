// Intent: verify saved recording preview and verse navigation actions stay outside app.js.
import assert from "node:assert/strict";

import { createVoiceRecordingActionService } from "../apps/editor/public/features/voice/voice-recording-action-service.js";

export async function runVoiceRecordingActionServiceTest() {
  const events = [];
  const recordings = new Map([
    ["take-1", {
      id: "take-1",
      projectId: "project-1",
      status: "saved",
      mediaPath: "project-media/project-1/take-1.webm",
      mediaMimeType: "audio/webm",
      sceneId: "scene-1",
      blockId: "block-2",
      startOffset: 17,
      endOffset: 28,
    }],
    ["legacy-take", {
      id: "legacy-take",
      projectId: "project-1",
      status: "saved",
      mediaPath: "project-media/project-1/legacy.webm",
      mediaMimeType: "audio/webm",
      sceneId: "scene-1",
      blockId: "block-1",
    }],
    ["shifted-take", {
      id: "shifted-take",
      projectId: "project-1",
      status: "saved",
      mediaPath: "project-media/project-1/shifted.webm",
      mediaMimeType: "audio/webm",
      sceneId: "scene-1",
      blockId: "block-2",
      startOffset: 19,
      endOffset: 32,
      verseText: "delta passage",
      transcript: "gamma delta passage",
    }],
    ["draft", {
      id: "draft",
      projectId: "project-1",
      status: "failed",
      mediaPath: "project-media/project-1/draft.webm",
    }],
    ["locked-take", {
      id: "locked-take",
      projectId: "project-1",
      status: "saved",
      mediaPath: "project-media/project-1/fail-delete.webm",
      sceneId: "scene-1",
      blockId: "block-1",
    }],
  ]);
  const service = createVoiceRecordingActionService({
    getRecordingById: (id) => recordings.get(id) ?? null,
    loadMediaBlob: async ({ filePath, mediaMimeType }) => {
      events.push(`load:${filePath}:${mediaMimeType}`);
      return { blob: new Blob(["audio"], { type: mediaMimeType }) };
    },
    deleteMediaFile: async ({ filePath }) => {
      events.push(`delete:${filePath}`);
      if (filePath.includes("fail-delete")) {
        throw new Error("Media locked");
      }
      return { ok: true, filePath, removed: true };
    },
    playBlob: async (blob, options = {}) => {
      events.push(`play:${blob.type}:${blob.size}:${options.recordingId}:${options.startTimeSeconds}`);
      return {
        playbackState: {
          recordingId: options.recordingId,
          currentTimeSeconds: options.startTimeSeconds,
          status: "playing",
        },
      };
    },
    getScene: (sceneId) => sceneId === "scene-1"
      ? {
          sceneId,
          blocks: [
            { blockId: "block-1", text: "Alpha beta." },
            { blockId: "block-2", text: "Gamma delta passage." },
          ],
          editorText: "Alpha beta.\n\nGamma delta passage.",
        }
      : null,
    deleteRecordingById: (id, projectId = "") => {
      const recording = recordings.get(id) ?? null;
      if (!recording || (projectId && recording.projectId !== projectId)) {
        return null;
      }
      recordings.delete(id);
      events.push(`record-delete:${id}:${projectId}`);
      return recording;
    },
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

  const preview = await service.previewRecording("take-1", {
    startTimeSeconds: 3.5,
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.recording.id, "take-1");
  assert.equal(preview.playback.playbackState.currentTimeSeconds, 3.5);
  assert.equal(events.includes("load:project-media/project-1/take-1.webm:audio/webm"), true);
  assert.equal(events.includes("play:audio/webm:5:take-1:3.5"), true);

  const plan = service.planRecordingVerseNavigation("take-1");
  assert.deepEqual({
    ok: plan.ok,
    sceneId: plan.sceneId,
    selectedBlockId: plan.selectedBlockId,
    startOffset: plan.startOffset,
    endOffset: plan.endOffset,
  }, {
    ok: true,
    sceneId: "scene-1",
    selectedBlockId: "block-2",
    startOffset: 17,
    endOffset: 28,
  });

  const legacyPlan = service.planRecordingVerseNavigation("legacy-take");
  assert.equal(legacyPlan.ok, true);
  assert.equal(legacyPlan.selectedBlockId, "block-1");
  assert.equal(legacyPlan.startOffset, 0);
  assert.equal(legacyPlan.endOffset, "Alpha beta.".length);

  const shiftedPlan = service.planRecordingVerseNavigation("shifted-take");
  assert.equal(shiftedPlan.ok, true);
  assert.equal(shiftedPlan.selectedBlockId, "block-2");
  assert.equal(shiftedPlan.startOffset, "Alpha beta.\n\n".length);
  assert.equal(shiftedPlan.endOffset, "Alpha beta.\n\nGamma delta passage".length);
  assert.equal(service.planRecordingVerseNavigation("missing").reason, "missing-recording");

  recordings.set("take-missing-scene", {
    id: "take-missing-scene",
    status: "saved",
    sceneId: "missing-scene",
    blockId: "block-1",
  });
  assert.equal(service.planRecordingVerseNavigation("take-missing-scene").reason, "missing-scene");

  assert.deepEqual(await service.deleteRecording("missing"), {
    ok: false,
    reason: "missing-recording",
  });
  const deleteResult = await service.deleteRecording("take-1");
  assert.equal(deleteResult.ok, true);
  assert.equal(deleteResult.recording.id, "take-1");
  assert.equal(deleteResult.mediaResult.removed, true);
  assert.equal(recordings.has("take-1"), false);
  assert.equal(events.includes("delete:project-media/project-1/take-1.webm"), true);
  assert.equal(events.includes("record-delete:take-1:project-1"), true);

  const lockedDeleteResult = await service.deleteRecording("locked-take");
  assert.equal(lockedDeleteResult.ok, true);
  assert.equal(lockedDeleteResult.mediaResult.reason, "media-delete-failed");
  assert.equal(recordings.has("locked-take"), false);
  assert.equal(events.includes("log:voice-recording:Voice recording media delete failed; removing project record anyway."), true);
}
