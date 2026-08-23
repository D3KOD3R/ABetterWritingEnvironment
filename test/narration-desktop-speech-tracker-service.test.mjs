// Intent: verify local desktop sherpa tracker orchestration and whisper cleanup handoff.
import assert from "node:assert/strict";

import { createDesktopRealtimeSpeechTrackerProvider } from "../apps/editor/public/features/narration/narration-desktop-speech-tracker-service.js";

export async function runNarrationDesktopSpeechTrackerServiceTest() {
  const logs = [];
  const frames = [];
  let runtime = {
    recordingId: "take-1",
    followSelection: null,
    followMatch: null,
  };
  const patches = [];
  const provider = createDesktopRealtimeSpeechTrackerProvider({
    realtimeSpeechClient: {
      async listProviders() {
        return {
          ok: true,
          providers: [{
            id: "local-sherpa-onnx",
            label: "Local sherpa-onnx Streaming",
            kind: "local-sherpa-onnx",
            availability: "ready",
          }],
        };
      },
      async startSession() {
        return {
          ok: true,
          value: {
            ok: true,
            session: {
              id: "desktop-session-1",
            },
          },
        };
      },
      async sendAudioFrame(frame) {
        frames.push(frame);
        return {
          ok: true,
          value: {
            transcriptSnapshot: {
              transcript: "the local words",
              changedTranscript: "local words",
              isEndpoint: false,
            },
          },
        };
      },
      async stopSession() {
        return {
          ok: true,
          value: {
            finalTranscript: "the cleaned local words",
            transcriptSnapshot: {
              transcript: "the local words",
              changedTranscript: "",
              isEndpoint: true,
            },
            whisper: {
              available: true,
            },
          },
        };
      },
    },
    liveAudioFrameService: {
      start({ onFrame }) {
        onFrame({
          sequence: 1,
          pcm16Base64: "AQD//w==",
          sampleRate: 16000,
          channelCount: 1,
        });
        return {
          stop() {
            logs.push(["audio.stop"]);
          },
        };
      },
    },
    getRuntime: () => runtime,
    applyRuntimePatch: (_recordingId, patch) => {
      runtime = { ...runtime, ...patch };
      patches.push(patch);
    },
    refreshSession: () => logs.push(["refresh"]),
    resolveFollowMatch: ({ transcript }) => ({
      trackerStatus: `matched ${transcript}`,
      followSelection: { blockId: "block-1" },
      match: { confidence: 0.91 },
    }),
    logger: {
      isEnabled: () => true,
      debug: (...entry) => logs.push(entry),
    },
  });

  const tracker = await provider.createTracker("take-1", {
    projectId: "project-1",
    selection: {
      sceneId: "scene-1",
      blockId: "block-1",
    },
    stream: {},
  });
  assert.equal(tracker.providerId, "local-sherpa-onnx");

  tracker.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(frames[0].sessionId, "desktop-session-1");
  assert.equal(patches.some((patch) => patch.transcript === "the local words"), true);
  assert.equal(runtime.followSelection.blockId, "block-1");

  const finalTranscript = await tracker.finalizeTranscript();
  assert.equal(finalTranscript, "the cleaned local words");
  assert.equal(logs.some((entry) => entry[1] === "narration-follow.local-sherpa-stopped"), true);

  const chunkFrames = [];
  let releaseFirstChunk = null;
  let queueRuntime = {
    recordingId: "take-queue",
  };
  const queueProvider = createDesktopRealtimeSpeechTrackerProvider({
    realtimeSpeechClient: {
      async listProviders() {
        return {
          ok: true,
          providers: [{
            id: "local-sherpa-onnx",
            label: "Local sherpa-onnx Streaming",
            kind: "local-sherpa-onnx",
            availability: "ready",
          }],
        };
      },
      async startSession() {
        return {
          ok: true,
          value: {
            ok: true,
            session: {
              id: "desktop-session-queue",
            },
          },
        };
      },
      sendAudioFrame(frame) {
        chunkFrames.push(frame);
        if (frame.skipLiveDecode) {
          return Promise.resolve({
            ok: true,
            value: {
              message: "archived",
            },
          });
        }
        if (frame.sequence === 1) {
          return new Promise((resolve) => {
            releaseFirstChunk = () => resolve({
              ok: true,
              value: {
                transcriptSnapshot: {
                  transcript: "first live chunk",
                  changedTranscript: "first live chunk",
                  isEndpoint: false,
                },
              },
            });
          });
        }
        return Promise.resolve({
          ok: true,
          value: {
            transcriptSnapshot: {
              transcript: `live chunk ${frame.sequence}`,
              changedTranscript: `chunk ${frame.sequence}`,
              isEndpoint: false,
            },
          },
        });
      },
      async stopSession() {
        return {
          ok: true,
          value: {
            finalTranscript: "queue cleanup",
            transcriptSnapshot: {
              transcript: "queue cleanup",
              changedTranscript: "",
              isEndpoint: true,
            },
            whisper: {
              available: true,
            },
          },
        };
      },
    },
    liveAudioFrameService: {
      start({ onFrame }) {
        onFrame({ sequence: 1, pcm16Base64: "AQ==", sampleRate: 16000, channelCount: 1, durationMs: 5000 });
        onFrame({ sequence: 2, pcm16Base64: "Ag==", sampleRate: 16000, channelCount: 1, durationMs: 5000 });
        onFrame({ sequence: 3, pcm16Base64: "Aw==", sampleRate: 16000, channelCount: 1, durationMs: 5000 });
        return {
          stop() {},
        };
      },
    },
    getRuntime: () => queueRuntime,
    applyRuntimePatch: (_recordingId, patch) => {
      queueRuntime = { ...queueRuntime, ...patch };
    },
    refreshSession: () => {},
    resolveFollowMatch: () => null,
    logger: {
      isEnabled: () => true,
      debug: (...entry) => logs.push(entry),
    },
  });
  const queueTracker = await queueProvider.createTracker("take-queue", {
    projectId: "project-1",
    selection: { sceneId: "scene-1", blockId: "block-1" },
    stream: {},
  });
  queueTracker.start();
  await Promise.resolve();
  assert.equal(chunkFrames.some((frame) => frame.sequence === 2 && frame.skipLiveDecode === true), true);
  releaseFirstChunk();
  assert.equal(await queueTracker.finalizeTranscript(), "queue cleanup");
  assert.equal(chunkFrames.some((frame) => frame.sequence === 3 && !frame.skipLiveDecode), true);
  assert.equal(logs.some((entry) => entry[1] === "narration-follow.local-audio-chunk-archived"), true);
}
