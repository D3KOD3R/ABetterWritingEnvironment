// Intent: verify the editor Local AI panel owns model-library request payloads and markup.
import assert from "node:assert/strict";

import {
  buildLocalAiModelSettingsPayload,
  buildLocalAiPanelModel,
  createLocalAiModelLibraryClient,
  renderLocalAiPanelHTML,
} from "../apps/editor/public/features/local-ai/local-ai-panel.js";

export async function runLocalAiPanelTest() {
  assert.deepEqual(buildLocalAiModelSettingsPayload({
    modelRoot: " C:\\Models\\AuthorSuite ",
    executionMode: "hybrid",
  }), {
    modelRoot: "C:\\Models\\AuthorSuite",
    executionMode: "hybrid",
  });

  const modelLibrary = {
    ok: true,
    modelRoot: "C:\\Models\\AuthorSuite",
    rootExists: true,
    manifestFileName: "abe-model.json",
    folders: [{
      category: "llm",
      label: "Language models",
      path: "C:\\Models\\AuthorSuite\\llm",
      exists: true,
      modelCount: 1,
      registeredCount: 1,
      unregisteredCount: 0,
      invalidCount: 0,
    }],
    models: [{
      id: "qwen3-tiny",
      displayName: "Qwen3 Tiny",
      category: "llm",
      runtime: "llama.cpp",
      format: "gguf",
      tier: "tiny",
      taskTypes: ["generate_tags"],
      artifactPaths: ["model.gguf"],
      status: "registered",
      validationMessages: [],
    }],
    browseLinks: [{
      id: "hugging-face-models",
      label: "Hugging Face Models",
      url: "https://huggingface.co/models",
      description: "Browse models.",
      categories: ["llm"],
    }],
  };

  const model = buildLocalAiPanelModel({
    localAiPrefs: { enabled: true },
    modelLibrary,
  });
  assert.equal(model.enabled, true);
  assert.equal(model.registeredCount, 1);
  assert.equal(model.unregisteredCount, 0);

  const html = renderLocalAiPanelHTML({
    localAiPrefs: { enabled: true },
    modelLibrary,
  });
  assert.match(html, /local-ai-panel/);
  assert.match(html, /data-action="close-local-ai-panel"/);
  assert.match(html, /data-local-ai-model-setting="modelRoot"/);
  assert.match(html, /data-action="ensure-local-ai-model-folders"/);
  assert.match(html, /data-action="refresh-local-ai-models"/);
  assert.match(html, /Qwen3 Tiny/);
  assert.match(html, /https:\/\/huggingface\.co\/models/);

  const calls = [];
  const client = createLocalAiModelLibraryClient({
    fetchJson: async (pathname, options = {}) => {
      calls.push({ pathname, options });
      return {
        ok: true,
        value: {
          ok: true,
          settings: { modelRoot: "C:\\Models\\AuthorSuite" },
          modelLibrary,
        },
      };
    },
  });
  const saveResult = await client.saveModelSettings({
    modelRoot: "C:\\Models\\AuthorSuite",
  });
  assert.equal(saveResult.ok, true);
  assert.equal(calls[0].pathname, "/api/local-ai/model-settings");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.modelRoot, "C:\\Models\\AuthorSuite");

  const ensureResult = await client.ensureModelFolders({
    modelRoot: "C:\\Models\\AuthorSuite",
  });
  assert.equal(ensureResult.ok, true);
  assert.equal(calls[1].pathname, "/api/local-ai/models/ensure-folders");
}
