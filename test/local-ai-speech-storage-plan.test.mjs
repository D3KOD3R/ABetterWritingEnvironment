import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { planSpeechStorage } from "../services/local-ai/speech-storage-plan.ts";
export async function runLocalAiSpeechStoragePlanTest() {
  const root = await mkdtemp(join(tmpdir(), "abe-speech-plan-"));
  try {
    const source = join(root, "source"), target = join(root, "target"); await mkdir(source); await mkdir(target);
    await writeFile(join(source, "model"), "original");
    const plan = await planSpeechStorage(source, target);
    assert.equal(plan.bytes, 8); assert.equal(plan.canCutover, false);
    assert.deepEqual(await readdir(target), []); assert.equal(await readFile(join(source, "model"), "utf8"), "original");
    await assert.rejects(planSpeechStorage(source, source), /separate/);
    await writeFile(join(target, "existing"), "preserve");
    await assert.rejects(planSpeechStorage(source, target), /empty/);
    assert.equal(await readFile(join(target, "existing"), "utf8"), "preserve");
  } finally { await rm(root, { recursive: true, force: true }); }
}
