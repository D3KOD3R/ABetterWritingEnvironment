import assert from "node:assert/strict";
import { createDictationJournal } from "../services/audio/src/dictation-journal.ts";
import { createDictationEngine, probeDictationRuntime } from "../services/audio/src/dictation-engine.ts";

export async function runNarrationDictationJournalTest() {
  const identity = { sessionId: "session", captureEpoch: "epoch", projectId: "project", sceneId: "scene" };
  const journal = createDictationJournal(identity);
  const event = { ...identity, utteranceId: "one", revision: 1, status: "partial", text: "first", startSample: 0, endSample: 16000, timestampSource: "engine", timestampGranularity: "utterance", modelId: "model", modelRevision: "revision", runtimeVersion: "runtime" };
  assert.equal(journal.accept(event), true);
  assert.equal(journal.accept(event), false);
  assert.equal(journal.accept({ ...event, revision: 2, text: "final text", status: "final" }), true);
  // Even a higher revision cannot resurrect or rewrite an accepted final.
  assert.equal(journal.accept({ ...event, revision: 99, text: "late" }), false);
  assert.equal(journal.accept({ ...event, revision: 100, status: "final", text: "duplicate" }), false);
  assert.equal(journal.accept({ ...event, utteranceId: "two", captureEpoch: "old" }), false);
  assert.equal(journal.accept({ ...event, utteranceId: "two", projectId: "another" }), false);
  assert.throws(() => journal.accept({ ...event, utteranceId: "two", endSample: -1 }), /Invalid/);
  const snapshot = journal.snapshot(); snapshot[0].text = "mutated consumer";
  assert.equal(journal.snapshot()[0].text, "final text");
  journal.close();
  assert.equal(journal.accept({ ...event, utteranceId: "two" }), false);

  let released = 0, failEncoding = true, stops = 0;
  const engine = createDictationEngine({
    openAdapter: () => ({ ready: Promise.resolve({ runtime: "fixture", nativeVersion: 1 }), request: async (message) => { if (message.type === "stop") stops++; return { events: [] }; }, close() {} }),
    encodeRecording: async () => { if (failEncoding) throw new Error("storage encoder failed"); return Buffer.from("fLaC fixture"); },
    verifyRecording: async () => {},
  });
  const session = await engine.start({ projectId: "project", sceneId: "scene", lease: { path: "fixture", model: { id: "fixture", revision: "pinned" }, release: () => released++ } });
  const frame = { ...session, sequence: 0, sampleRate: 16000, startSample: 0, endSample: 4000, sourceSampleRate: 48000, sourceStartSample: 0, sourceEndSample: 12000, pcm16Base64: Buffer.alloc(8000).toString("base64") };
  await assert.rejects(engine.audio({ ...frame, sequence: 1 }), /Discontinuous/);
  await assert.rejects(engine.audio({ ...frame, captureEpoch: "stale" }), /Stale/);
  assert.equal((await engine.audio(frame)).sampleCount, 4000);
  await assert.rejects(engine.audio(frame), /Discontinuous/);
  // Failed encoding retains the session and model lease for an explicit retry.
  await assert.rejects(engine.stop(session.sessionId), /encoder failed/);
  assert.equal(engine.isActive(), true); assert.equal(released, 0);
  failEncoding = false;
  const completed = await engine.stop(session.sessionId);
  assert.equal(stops, 1); assert.equal(completed.record.status, "stopped");
  assert.equal(completed.record.sampleCount, 4000); assert.equal(released, 1); assert.equal(engine.isActive(), false);
  const unavailable = await probeDictationRuntime("abe-definitely-missing-python-runtime");
  assert.equal(unavailable.ready, false);
}
