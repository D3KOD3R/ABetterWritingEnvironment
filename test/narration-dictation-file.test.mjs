import assert from "node:assert/strict";
import { transcribeAudioFile } from "../apps/editor/public/adapters/dictation-file.js";
import { createDictationEngine } from "../services/audio/src/dictation-engine.ts";
export async function runNarrationDictationFileTest() {
  let released = 0, encodes = 0;
  const engine = createDictationEngine({ openAdapter: () => ({ ready: Promise.resolve({ runtime: "fixture", nativeVersion: 1 }), request: async () => ({ events: [] }), close() {} }), encodeRecording: async () => { encodes++; throw Error("Must not encode previews"); } });
  const session = await engine.start({ previewOnly: true, projectId: "preview", sceneId: "preview", lease: { path: "fixture", model: { id: "model", revision: "pin" }, release() { released++; } } });
  const preview = await engine.stop(session.sessionId);
  assert.equal(encodes, 0); assert.equal(released, 1); assert.equal(preview.record, undefined); assert.equal(engine.isActive(), false);
  const file = { size: 4, arrayBuffer: async () => new ArrayBuffer(4) };
  const samples = new Float32Array(16001), calls = [];
  let duration = 1.0000625;
  const context = () => ({ decodeAudioData: async () => ({ length: samples.length, duration }), createBufferSource: () => ({ connect() {}, start() {} }), startRendering: async () => ({ getChannelData: () => samples }) });
  const abort = new AbortController();
  const request = async (action, body) => { calls.push({ action, body }); if (action === "file-start") return { sessionId: "file", captureEpoch: "epoch" }; return { events: [], sampleCount: 16001 }; };
  await transcribeAudioFile(file, { request, signal: abort.signal, progress() {}, offlineContext: context });
  assert.deepEqual(calls.map(c => c.action), ["file-start", "audio", "audio", "file-finish"]);
  assert.equal(calls[2].body.startSample, 16000); assert.equal(calls[2].body.endSample, 16001);
  calls.length = 0; duration = 241;
  await assert.rejects(transcribeAudioFile(file, { request, signal: abort.signal, progress() {}, offlineContext: context }), /four minutes/);
  assert.equal(calls.length, 0); duration = 1;
  await assert.rejects(transcribeAudioFile(file, { request, signal: abort.signal, offlineContext: context, progress(result) { if (result.events) abort.abort(); } }));
  assert.equal(calls.at(-1).action, "file-finish"); assert.equal(calls.at(-1).body.cancelled, true);
}
