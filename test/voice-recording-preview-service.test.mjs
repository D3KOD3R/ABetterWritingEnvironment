// Intent: verify voice recording preview audio and object-url lifecycle stays outside app.js.
import assert from "node:assert/strict";

import { createVoiceRecordingPreviewController } from "../apps/editor/public/features/voice/voice-recording-preview-service.js";

export async function runVoiceRecordingPreviewServiceTest() {
  const events = [];
  const states = [];
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
        currentTime: 0,
        duration: 9,
        preload: "",
        pause: () => events.push(["pause", id]),
        play: async () => events.push(["play", id, url]),
        onended: null,
        onerror: null,
        onloadedmetadata: null,
        ontimeupdate: null,
      };
    },
    onPlaybackStateChange: (state, eventType) => states.push([eventType, state]),
  });

  const first = await controller.playBlob(new Blob(["one"]), {
    recordingId: "take-1",
    startTimeSeconds: 2,
  });
  assert.equal(first.url, "blob://preview-3");
  assert.equal(first.audio.preload, "auto");
  assert.equal(first.audio.currentTime, 2);
  assert.equal(first.playbackState.recordingId, "take-1");
  assert.equal(first.playbackState.status, "playing");
  assert.deepEqual(events, [
    ["create-url", 3],
    ["play", 1, "blob://preview-3"],
  ]);

  first.audio.currentTime = 4.2;
  first.audio.ontimeupdate();
  assert.equal(controller.getPlaybackState().currentTimeSeconds, 4.2);

  const seekState = controller.seekPreview(6, { recordingId: "take-1" });
  assert.equal(first.audio.currentTime, 6);
  assert.equal(seekState.currentTimeSeconds, 6);

  const pausedState = controller.pausePreview({ recordingId: "take-1" });
  assert.equal(pausedState.status, "paused");
  assert.equal(pausedState.active, false);
  assert.equal(pausedState.currentTimeSeconds, 6);
  assert.equal(controller.getPreviewAudio(), first.audio);
  assert.equal(controller.getPreviewUrl(), "blob://preview-3");

  const resumedState = await controller.resumePreview({ recordingId: "take-1" });
  assert.equal(resumedState.status, "playing");
  assert.equal(resumedState.active, true);
  assert.equal(controller.getPreviewAudio(), first.audio);
  assert.deepEqual(events.slice(2), [
    ["pause", 1],
    ["play", 1, "blob://preview-3"],
  ]);

  const delayedEvents = [];
  let delayedMetadataReady = false;
  let delayedCurrentTime = 0;
  let delayedAudio = null;
  const delayedController = createVoiceRecordingPreviewController({
    createObjectUrl: () => "blob://delayed",
    revokeObjectUrl: () => {},
    createAudio: () => {
      delayedAudio = {
        preload: "",
        get currentTime() {
          return delayedCurrentTime;
        },
        set currentTime(value) {
          if (delayedMetadataReady) {
            delayedCurrentTime = value;
          }
        },
        get duration() {
          return delayedMetadataReady ? 12 : Number.NaN;
        },
        get readyState() {
          return delayedMetadataReady ? 1 : 0;
        },
        pause: () => {},
        load: () => {
          queueMicrotask(() => {
            delayedMetadataReady = true;
            delayedAudio.onloadedmetadata();
          });
        },
        play: async () => delayedEvents.push(["play", delayedCurrentTime]),
        onended: null,
        onerror: null,
        onloadedmetadata: null,
        ontimeupdate: null,
      };
      return delayedAudio;
    },
  });
  const delayed = await delayedController.playBlob(new Blob(["delayed"]), {
    recordingId: "take-delayed",
    startTimeSeconds: 5,
  });
  assert.equal(delayed.audio.currentTime, 5);
  assert.equal(delayed.playbackState.currentTimeSeconds, 5);
  assert.deepEqual(delayedEvents, [["play", 5]]);

  const afterPlayEvents = [];
  let afterPlayAcceptsSeek = false;
  let afterPlayCurrentTime = 0;
  const afterPlayController = createVoiceRecordingPreviewController({
    createObjectUrl: () => "blob://after-play",
    revokeObjectUrl: () => {},
    createAudio: () => ({
      preload: "",
      duration: 11,
      readyState: 1,
      get currentTime() {
        return afterPlayCurrentTime;
      },
      set currentTime(value) {
        if (afterPlayAcceptsSeek) {
          afterPlayCurrentTime = value;
        }
      },
      pause: () => {},
      play: async () => {
        afterPlayEvents.push(["play", afterPlayCurrentTime]);
        afterPlayAcceptsSeek = true;
      },
      onended: null,
      onerror: null,
      onloadedmetadata: null,
      ontimeupdate: null,
    }),
  });
  const afterPlay = await afterPlayController.playBlob(new Blob(["after-play"]), {
    recordingId: "take-after-play",
    startTimeSeconds: 7,
  });
  assert.equal(afterPlay.audio.currentTime, 7);
  assert.equal(afterPlay.playbackState.currentTimeSeconds, 7);
  assert.deepEqual(afterPlayEvents, [["play", 0]]);

  const slowEvents = [];
  const slowStates = [];
  let resolveSlowPlay;
  const slowController = createVoiceRecordingPreviewController({
    createObjectUrl: () => "blob://slow",
    revokeObjectUrl: (url) => slowEvents.push(["revoke-url", url]),
    createAudio: () => ({
      currentTime: 0,
      duration: 6,
      preload: "",
      pause: () => slowEvents.push(["pause"]),
      play: () => {
        slowEvents.push(["play"]);
        return new Promise((resolve) => {
          resolveSlowPlay = resolve;
        });
      },
      onended: null,
      onerror: null,
      onloadedmetadata: null,
      ontimeupdate: null,
    }),
    onPlaybackStateChange: (state, eventType) => slowStates.push([eventType, state]),
  });
  const pendingSlowPlay = slowController.playBlob(new Blob(["slow"]), {
    recordingId: "take-slow",
  });
  assert.deepEqual(slowEvents, [["play"]]);
  const stoppedSlowState = slowController.stopPreview();
  assert.equal(stoppedSlowState.status, "stopped");
  assert.equal(stoppedSlowState.active, false);
  assert.equal(slowController.getPreviewAudio(), null);
  assert.deepEqual(slowEvents, [
    ["play"],
    ["pause"],
    ["revoke-url", "blob://slow"],
  ]);
  resolveSlowPlay();
  const staleSlowResult = await pendingSlowPlay;
  assert.equal(staleSlowResult.stale, true);
  assert.equal(slowController.getPlaybackState().status, "stopped");
  assert.equal(slowStates.some(([eventType, state]) => eventType === "playing" && state.active), false);

  const second = await controller.playBlob(new Blob(["two"]), {
    recordingId: "take-2",
  });
  assert.equal(second.audio.id, 2);
  assert.deepEqual(events.slice(4), [
    ["pause", 1],
    ["revoke-url", "blob://preview-3"],
    ["create-url", 3],
    ["play", 2, "blob://preview-3"],
  ]);

  second.audio.currentTime = 9;
  const secondEnded = second.audio.onended;
  secondEnded();
  assert.equal(controller.getPreviewAudio(), null);
  assert.equal(controller.getPreviewUrl(), null);
  assert.equal(controller.getPlaybackState().status, "ended");
  assert.equal(controller.getPlaybackState().recordingId, "take-2");
  assert.equal(controller.getPlaybackState().currentTimeSeconds, 9);
  assert.deepEqual(events.slice(8), [
    ["pause", 2],
    ["revoke-url", "blob://preview-3"],
  ]);
  assert.equal(states.some(([eventType, state]) => eventType === "seek" && state.currentTimeSeconds === 6), true);

  await controller.playBlob(new Blob(["three"]), {
    recordingId: "take-3",
  });
  const stoppedState = controller.stopPreview();
  assert.equal(stoppedState.status, "stopped");
  assert.equal(controller.getPreviewAudio(), null);
}
