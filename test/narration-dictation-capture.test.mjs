import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { startDictationCapture } from "../apps/editor/public/adapters/dictation-capture.js";

export async function runNarrationDictationCaptureTest() {
  const source = await readFile(new URL("../apps/editor/public/adapters/dictation-pcm-worklet.js", import.meta.url), "utf8");
  // Exercise the actual processor across non-integer resampling boundaries, not a mirrored converter.
  for (const sampleRate of [16000, 44100, 48000]) {
    let Processor; const messages = [];
    const sandbox = { sampleRate, AudioWorkletProcessor: class { port = { postMessage: (value) => messages.push(value) }; }, registerProcessor: (_name, type) => { Processor = type; } };
    vm.runInNewContext(source, sandbox);
    const processor = new Processor({ processorOptions: { channel: 1 } });
    for (let offset = 0; offset < sampleRate; offset += 128) {
      const length = Math.min(128, sampleRate - offset);
      processor.process([[new Float32Array(length), new Float32Array(length).fill(0.5)]]);
    }
    processor.port.onmessage({ data: "stop" });
    const frames = messages.filter((m) => m.pcm);
    assert.equal(frames.reduce((sum, frame) => sum + frame.pcm.length, 0), 16000);
    let end = 0, sourceEnd = 0;
    for (const [index, frame] of frames.entries()) {
      assert.equal(frame.sequence, index); assert.equal(frame.startSample, end); assert.equal(frame.sourceStartSample, sourceEnd);
      assert.ok([...frame.pcm].every((value) => value === 16384), "The requested channel, not channel zero, must be captured.");
      end = frame.endSample; sourceEnd = frame.sourceEndSample;
    }
    assert.equal(sourceEnd, sampleRate);
  }
  const original = globalThis.AudioWorkletNode;
  const originalContext = globalThis.AudioContext;
  globalThis.AudioWorkletNode = class {};
  try {
    await assert.rejects(startDictationCapture({ mediaDevices: { getUserMedia: async () => { throw new Error("Permission denied"); } } }), /Permission denied/);
    let ended, stopped = 0, closed = 0, failure = "", constraints;
    globalThis.AudioWorkletNode = class {
      constructor() { this.port = { postMessage: () => this.port.onmessage({ data: { stopped: true } }) }; }
      connect() {} disconnect() {}
    };
    globalThis.AudioContext = class {
      sampleRate = 48000; audioWorklet = { addModule: async () => {} }; destination = {};
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      async resume() {} async close() { closed++; }
    };
    const track = { label: "External interface", getSettings: () => ({ channelCount: 2 }), addEventListener: (_name, callback) => { ended = callback; }, stop: () => { stopped++; } };
    const capture = await startDictationCapture({ deviceId: "explicit-device", channel: 1, onFailure: (error) => { failure = error.message; }, onFrame() {}, onLevel() {}, mediaDevices: { getUserMedia: async (input) => { constraints = input; return { getTracks: () => [track], getAudioTracks: () => [track] }; } } });
    assert.deepEqual(constraints.audio.deviceId, { exact: "explicit-device" });
    assert.equal(constraints.audio.channelCount.ideal, 2);
    ended(); assert.match(failure, /disconnected/);
    await capture.stop(); await capture.stop();
    assert.equal(stopped, 1); assert.equal(closed, 1);
  } finally {
    if (original === undefined) delete globalThis.AudioWorkletNode; else globalThis.AudioWorkletNode = original;
    if (originalContext === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = originalContext;
  }
}
