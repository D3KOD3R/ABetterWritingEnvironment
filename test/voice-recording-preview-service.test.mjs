// Intent: verify voice recording preview audio and object-url lifecycle stays outside app.js.
import assert from "node:assert/strict";

import { createVoiceRecordingPreviewController } from "../apps/editor/public/features/voice/voice-recording-preview-service.js";

export async function runVoiceRecordingPreviewServiceTest() {
  const events = [];
  let audioId = 0;
  const controller = createVoiceRecordingPreviewController({
    createObjectUrl: (blob) => {
      events.push(["create-url", blob.size]);
      return `blob://preview-${blob.size}`;
    },
    revokeObjectUrl: (url) => events.push(["revoke-url", url]),
    createAudio: (url) => {
      const id = audioId += 1;
      return {
        id,
        url,
        preload: "",
        pause: () => events.push(["pause", id]),
        play: async () => events.push(["play", id, url]),
        onended: null,
        onerror: null,
      };
    },
  });

  const first = await controller.playBlob(new Blob(["one"]));
  assert.equal(first.url, "blob://preview-3");
  assert.equal(first.audio.preload, "auto");
  assert.deepEqual(events, [
    ["create-url", 3],
    ["play", 1, "blob://preview-3"],
  ]);

  const second = await controller.playBlob(new Blob(["two"]));
  assert.equal(second.audio.id, 2);
  assert.deepEqual(events.slice(2), [
    ["pause", 1],
    ["revoke-url", "blob://preview-3"],
    ["create-url", 3],
    ["play", 2, "blob://preview-3"],
  ]);

  second.audio.onended();
  assert.equal(controller.getPreviewAudio(), null);
  assert.equal(controller.getPreviewUrl(), null);
  assert.deepEqual(events.slice(6), [
    ["pause", 2],
    ["revoke-url", "blob://preview-3"],
  ]);
}
