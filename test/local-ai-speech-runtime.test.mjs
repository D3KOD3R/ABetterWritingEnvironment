import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSpeechRuntimeStore, speechRuntimeCatalog } from "../services/local-ai/speech-runtime-store.ts";
import { verifiedZipEntries } from "../services/local-ai/verified-zip.ts";
import { renderRuntimeSetup, renderStorageCopy } from "../apps/editor/public/features/narration/dictation-panel.js";

// A tiny stored ZIP exercises real extraction/publication without shipping or executing binaries.
function zip(entries) {
  const locals = [], central = []; let offset = 0;
  for (const [name, value] of entries) {
    const filename = Buffer.from(name), bytes = Buffer.from(value);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, bytes);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(filename.length, 28); record.writeUInt32LE(offset, 42);
    central.push(record, filename); offset += local.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
export async function runLocalAiSpeechRuntimeTest() {
  const root = await mkdtemp(join(tmpdir(), "abe-private-runtime-"));
  const bytes = zip([["python.exe", "fixture executable must never run"], ["python314._pth", "isolated"], ["LICENSE.txt", "fixture"]]);
  const catalog = { ...speechRuntimeCatalog, artifacts: [{ ...speechRuntimeCatalog.artifacts[0], filename: "fixture.zip", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }] };
  let response = async () => new Response(bytes), probes = 0, compatible = true;
  const options = { root, catalog, platform: "win32", arch: "x64", fetchImpl: (...args) => response(...args), probe: async () => { probes++; return { ready: compatible, recordingReady: compatible }; } };
  const store = createSpeechRuntimeStore(options);
  try {
    assert.equal(await store.selected(), null);
    await assert.rejects(store.install(false), /explicitly approve/);
    await assert.rejects(createSpeechRuntimeStore({ ...options, platform: "linux" }).install(true), /Windows x64/);
    assert.equal(probes, 0); assert.deepEqual(await readdir(root), []);
    // Hash failure must happen before extraction or any compatibility execution.
    response = async () => new Response(Buffer.alloc(bytes.length));
    await store.install(true); assert.equal((await store.wait()).state, "failed"); assert.equal(probes, 0);
    assert.deepEqual(await readdir(root), []);
    // Active lock denies a second host. Cancel releases it so a new consented retry works.
    response = async (_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason); else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    await store.install(true);
    await assert.rejects(createSpeechRuntimeStore(options).install(true), /install.lock/);
    assert.equal((await store.cancel()).state, "cancelled");
    response = async () => new Response(bytes);
    await store.install(true); assert.equal((await store.wait()).state, "installed");
    let selected = await store.selected(), active = await readFile(join(root, "active.json"));
    assert.match(selected, /payload[\\/]python.exe$/);
    assert.equal(await readFile(selected, "utf8"), "fixture executable must never run");
    const previous = selected;
    await store.install(true); assert.equal((await store.wait()).state, "installed");
    selected = await store.selected(); assert.notEqual(selected, previous);
    assert.equal(await readFile(previous, "utf8"), "fixture executable must never run");
    active = await readFile(join(root, "active.json"));
    // A failed upgrade leaves the last activation receipt and all original bytes intact.
    compatible = false;
    await store.install(true); assert.equal((await store.wait()).state, "failed");
    assert.deepEqual(await readFile(join(root, "active.json")), active);
    assert.equal(await createSpeechRuntimeStore(options).selected(), selected);
    await writeFile(selected, "tampered");
    await assert.rejects(store.selected(), /integrity/);
    for (const name of ["../escape", "C:/escape", "safe/../escape", "NUL.txt", "safe\\escape", "evil.pth", "pkg.data/script", "safe. /x"]) assert.throws(() => verifiedZipEntries(zip([[name, "bad"]])));
    assert.throws(() => verifiedZipEntries(zip([["duplicate", "a"], ["DUPLICATE", "b"]])), /Duplicate/);
    const html = renderRuntimeSetup({ dependencyPlan: store.plan(), runtimeInstall: store.snapshot() }, true);
    assert.match(html, /data-action="dictation-runtime-install" disabled/);
    assert.match(html, /python.org/); assert.match(html, /LGPL/);
    assert.match(renderStorageCopy({ storageCopy: { state: "verified", message: "Originals remain active", stage: "<unsafe>" } }, false), /&lt;unsafe&gt;/);
  } finally { await rm(root, { recursive: true, force: true }); }
}
