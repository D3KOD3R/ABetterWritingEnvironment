// Intent: verify narration realtime speech client keeps desktop route handling outside recording commands.
import assert from "node:assert/strict";

import { createNarrationRealtimeSpeechClient } from "../apps/editor/public/features/narration/narration-realtime-speech-client.js";

export async function runNarrationRealtimeSpeechClientTest() {
  const calls = [];
  const client = createNarrationRealtimeSpeechClient({
    fetchJson: async (pathname, options = {}) => {
      calls.push({ pathname, options });
      if (pathname === "/api/realtime-speech/providers") {
        return {
          ok: true,
          value: {
            ok: true,
            providers: [{ id: "local-sherpa-onnx", availability: "ready" }],
          },
        };
      }
      if (pathname === "/api/realtime-speech/session/start") {
        return {
          ok: true,
          value: {
            ok: true,
            session: { id: "session-1" },
          },
        };
      }
      if (pathname === "/api/whisper-cpp/word-timings") {
        return {
          ok: true,
          value: {
            ok: true,
            providerId: "whisper-cpp-word-timestamps-v1",
            words: [{ text: "alpha", startTimeSeconds: 0.1, endTimeSeconds: 0.3 }],
          },
        };
      }
      return {
        ok: false,
        error: new Error("route failed"),
      };
    },
  });

  const providers = await client.listProviders();
  assert.equal(providers.ok, true);
  assert.equal(providers.providers[0].id, "local-sherpa-onnx");

  const started = await client.startSession({ recordingId: "take-1" });
  assert.equal(started.value.session.id, "session-1");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.body.recordingId, "take-1");

  const wordTimings = await client.getWhisperWordTimings({
    recordingId: "take-1",
    wavBase64: "UklGRg==",
  });
  assert.equal(wordTimings.value.providerId, "whisper-cpp-word-timestamps-v1");
  assert.equal(calls[2].pathname, "/api/whisper-cpp/word-timings");
  assert.equal(calls[2].options.method, "POST");

  const failed = await client.sendAudioFrame({ sessionId: "missing" });
  assert.equal(failed.ok, false);
  assert.match(failed.error.message, /route failed/);
}
