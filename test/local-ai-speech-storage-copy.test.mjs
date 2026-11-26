import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSpeechStorageCopy } from "../services/local-ai/speech-storage-copy.ts";

export async function runLocalAiSpeechStorageCopyTest() {
  const root = await mkdtemp(join(tmpdir(), "abe-library-copy-"));
  try {
    const source = join(root, "source"), target = join(root, "target"), second = join(root, "second");
    await mkdir(join(source, "speech"), { recursive: true }); await mkdir(target); await mkdir(second);
    await writeFile(join(source, "speech", "model"), "owned model bytes");
    await writeFile(join(source, "shared-local-ai"), "preserved opaque bytes");
    const service = createSpeechStorageCopy(), plan = await service.plan(source, target);
    await assert.rejects(service.start(plan.id, false), /explicitly approve/);
    await assert.rejects(service.start("stale-plan", true), /preview/);
    assert.deepEqual(await readdir(target), []);
    await service.start(plan.id, true);
    await assert.rejects(service.plan(source, second), /active/);
    const result = await service.wait(); assert.equal(result.state, "verified"); assert.equal(result.canCutover, false);
    const receipt = JSON.parse(await readFile(join(result.stage, "verified.json"), "utf8"));
    assert.equal(receipt.files.filter(file => file.sha256 !== "directory").length, 2);
    assert.equal(await readFile(join(result.stage, "library", "speech", "model"), "utf8"), "owned model bytes");
    assert.equal(await readFile(join(source, "shared-local-ai"), "utf8"), "preserved opaque bytes");
    // A destination changed after consent is never overwritten; cancellation retains originals.
    const conflict = await service.plan(source, second);
    await writeFile(join(second, "external-file"), "keep");
    await service.start(conflict.id, true); assert.equal((await service.wait()).state, "failed");
    assert.equal(await readFile(join(second, "external-file"), "utf8"), "keep");
    const third = join(root, "third"); await mkdir(third);
    const cancelled = await service.plan(source, third);
    await service.start(cancelled.id, true); assert.equal((await service.cancel()).state, "cancelled");
    assert.equal(await readFile(join(source, "speech", "model"), "utf8"), "owned model bytes");
    // A source changed after preview needs fresh consent, not a silently larger copy.
    const changed = join(root, "changed"); await mkdir(changed);
    const changedPlan = await service.plan(source, changed);
    await writeFile(join(source, "new-model"), "new bytes");
    await service.start(changedPlan.id, true);
    assert.equal((await service.wait()).state, "failed"); assert.deepEqual(await readdir(changed), []);
    await mkdir(join(source, "nested"));
    await assert.rejects(service.plan(source, join(source, "nested")), /separate/);
    // Junctions work without symlink privilege on Windows and must never be traversed.
    await symlink(target, join(source, "external-link"), process.platform === "win32" ? "junction" : "dir");
    const fourth = join(root, "fourth"); await mkdir(fourth);
    await assert.rejects(service.plan(source, fourth), /Linked/);
  } finally { await rm(root, { recursive: true, force: true }); }
}
