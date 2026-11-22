import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSpeechModelStore } from "../services/local-ai/speech-model-store.ts";

export async function runLocalAiSpeechStoreTest() {
  const root = await mkdtemp(join(tmpdir(), "abe-speech-install-"));
  const bytes = Buffer.from("deterministic model fixture");
  const model = { id: "fixture", revision: "abc123", displayName: "Fixture", runtime: "moonshine-voice", sourceUrl: "https://example.invalid/pinned", roles: ["live"], artifacts: [{ filename: "model.ort", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), url: "https://example.invalid/model" }] };
  let response = () => Promise.resolve(new Response(bytes));
  const store = createSpeechModelStore({ modelRoot: root, models: [model], fetchImpl: (...args) => response(...args) });
  try {
    await store.install(model.id); assert.equal((await store.wait(model.id)).state, "installed");
    const installed = await store.inspect(model.id, true); assert.equal(installed.installed, true);
    assert.equal(JSON.parse(await readFile(join(installed.path, "abe-model.json"), "utf8")).source.revision, "abc123");
    const lease = await store.acquire(model.id);
    await assert.rejects(store.remove(model.id), /in use/);
    lease.release(); lease.release();
    await store.remove(model.id);
    // Same-size corruption must fail hashes, not merely pass a file-size check.
    response = async () => new Response(Buffer.alloc(bytes.length));
    await store.install(model.id); assert.equal((await store.wait(model.id)).state, "failed");
    assert.equal((await store.inspect(model.id)).installed, false);
    assert.deepEqual(await readdir(join(root, "speech")), []);
    response = async () => new Response(bytes.subarray(0, 3));
    await store.retry(model.id); assert.equal((await store.wait(model.id)).state, "failed");
    response = async () => new Response("failure", { status: 503 });
    await store.retry(model.id); assert.equal((await store.wait(model.id)).state, "failed");
    response = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true }));
    await store.retry(model.id); await store.cancel(model.id);
    assert.equal((await store.wait(model.id)).state, "cancelled");
    assert.deepEqual(await readdir(join(root, "speech")), []);
    response = async () => new Response(bytes);
    await store.retry(model.id); await store.wait(model.id);
    const retry = await store.inspect(model.id, true);
    await writeFile(join(retry.path, "model.ort"), Buffer.alloc(bytes.length));
    await assert.rejects(store.acquire(model.id), /Checksum/);
    await store.remove(model.id);
    await assert.rejects(store.install("../escape"), /Unknown/);
  } finally { await rm(root, { recursive: true, force: true }); }
}
