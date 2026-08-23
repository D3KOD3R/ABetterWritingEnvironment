// Intent: verify local AI model-library scanning stays deterministic and non-executing.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createLocalAiModelLibrarySnapshot,
  ensureLocalAiModelLibraryFolders,
} from "../services/local-ai/index.ts";

export async function runLocalAiModelLibraryTest() {
  const root = await mkdtemp(join(tmpdir(), "abe-local-ai-models-"));
  const ensured = await ensureLocalAiModelLibraryFolders(root);
  assert.equal(ensured.ok, true);
  assert.equal(ensured.rootExists, true);
  assert.deepEqual(
    ensured.folders.map((folder) => folder.category),
    ["llm", "embeddings", "speech", "voice"],
  );

  const qwenPath = join(root, "llm", "qwen3-tiny");
  await mkdir(qwenPath, { recursive: true });
  await writeFile(join(qwenPath, "model.gguf"), "not a real model", "utf8");
  await writeFile(join(qwenPath, "abe-model.json"), JSON.stringify({
    id: "qwen3-tiny",
    displayName: "Qwen3 Tiny",
    source: {
      type: "huggingface",
      repoId: "Qwen/Qwen3-0.6B-GGUF",
      revision: "test",
    },
    runtime: "llama.cpp",
    format: "gguf",
    tier: "tiny",
    taskTypes: ["generate_scene_labels", "generate_tags"],
    contextWindow: 32768,
    checksum: "sha256:test",
  }), "utf8");

  const loosePath = join(root, "embeddings", "loose.onnx");
  await writeFile(loosePath, "not a real model", "utf8");

  const snapshot = await createLocalAiModelLibrarySnapshot(root);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.models.length, 2);
  const qwenModel = snapshot.models.find((model) => model.id === "qwen3-tiny");
  const looseModel = snapshot.models.find((model) => model.displayName === "loose.onnx");
  assert.equal(looseModel?.status, "unregistered");
  assert.equal(looseModel?.format, "onnx");
  assert.equal(qwenModel?.displayName, "Qwen3 Tiny");
  assert.equal(qwenModel?.status, "registered");
  assert.equal(qwenModel?.runtime, "llama.cpp");
  assert.equal(qwenModel?.tier, "tiny");
  assert.deepEqual(qwenModel?.taskTypes, ["generate_scene_labels", "generate_tags"]);
  assert.equal(snapshot.folders.find((folder) => folder.category === "llm")?.registeredCount, 1);
  assert.equal(snapshot.folders.find((folder) => folder.category === "embeddings")?.unregisteredCount, 1);
  assert.equal(snapshot.browseLinks.some((link) => link.url.includes("huggingface.co/models")), true);
}
