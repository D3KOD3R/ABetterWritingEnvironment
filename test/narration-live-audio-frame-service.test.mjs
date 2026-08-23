// Intent: verify microphone PCM conversion for local sherpa-onnx transport.
import assert from "node:assert/strict";

import {
  concatenateInt16Arrays,
  createNarrationPcmChunker,
  downsampleFloat32ToInt16,
  float32ToInt16,
  int16ArrayToBase64,
} from "../apps/editor/public/features/narration/narration-live-audio-frame-service.js";

export function runNarrationLiveAudioFrameServiceTest() {
  const pcm = float32ToInt16(new Float32Array([-1, -0.5, 0, 0.5, 1]));
  assert.deepEqual(Array.from(pcm), [-32768, -16384, 0, 16384, 32767]);

  const downsampled = downsampleFloat32ToInt16(new Float32Array([1, 1, -1, -1]), 4, 2);
  assert.deepEqual(Array.from(downsampled), [32767, -32768]);

  const base64 = int16ArrayToBase64(new Int16Array([1, -1]));
  assert.equal(Buffer.from(base64, "base64").byteLength, 4);

  const merged = concatenateInt16Arrays([
    new Int16Array([1, 2]),
    new Int16Array([]),
    new Int16Array([3]),
  ]);
  assert.deepEqual(Array.from(merged), [1, 2, 3]);

  const chunks = [];
  const chunker = createNarrationPcmChunker({
    sampleRate: 4,
    chunkDurationMs: 1000,
    maxBufferedAudioMs: 1500,
    nowMs: () => 1000,
    setTimer: () => "timer-1",
    clearTimer: () => {},
    onChunk: (chunk) => chunks.push(chunk),
  });
  assert.equal(chunker.pushFrame(new Int16Array([1, 2]), { capturedAtMs: 10 }), null);
  assert.equal(chunks.length, 0);
  assert.equal(chunker.pushFrame(new Int16Array([3, 4]), { capturedAtMs: 510 })?.reason, "duration");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].durationMs, 1000);
  assert.equal(chunks[0].frameCount, 2);
  assert.deepEqual(Array.from(chunks[0].pcm16), [1, 2, 3, 4]);

  chunker.pushFrame(new Int16Array([5]), { capturedAtMs: 1510 });
  const stoppedChunk = chunker.stop();
  assert.equal(stoppedChunk.reason, "stop");
  assert.equal(stoppedChunk.durationMs, 250);
  assert.deepEqual(Array.from(stoppedChunk.pcm16), [5]);
}
