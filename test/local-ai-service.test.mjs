import assert from "node:assert/strict";

import {
  LlamaCppProvider,
  LocalAiRouter,
  buildLocalAiPrompt,
  normalizeLlamaCppBaseUrl,
  selectModelTier,
} from "../services/local-ai/index.ts";

export async function runLocalAiServiceTest() {
  assert.equal(
    selectModelTier({
      taskType: "generate_tags",
      userInput: "storm docking scene",
    }),
    "tiny",
  );
  assert.equal(
    selectModelTier({
      taskType: "review_scene",
      userInput: "review this",
    }),
    "standard",
  );
  assert.equal(
    selectModelTier({
      taskType: "run_continuity_check",
      userInput: "check this",
    }),
    "large",
  );
  assert.equal(
    selectModelTier({
      taskType: "run_continuity_check",
      userInput: "check this",
      devAllowTinyContinuityCheck: true,
    }),
    "tiny",
  );

  const prompt = buildLocalAiPrompt({
    taskType: "generate_scene_labels",
    userInput: "A ship docks during a storm.",
    manuscriptContext: "Scene: Docking Approach",
    outputFormat: "json",
  });
  assert.match(prompt.systemPrompt, /local-first fiction authoring assistant/);
  assert.match(prompt.systemPrompt, /valid compact JSON/);
  assert.match(prompt.userPrompt, /generate_scene_labels/);
  assert.match(prompt.userPrompt, /Docking Approach/);

  assert.equal(
    normalizeLlamaCppBaseUrl("http://127.0.0.1:9090/"),
    "http://127.0.0.1:9090",
  );
  assert.throws(
    () => normalizeLlamaCppBaseUrl("http://localhost:9090"),
    /127\.0\.0\.1/,
  );

  const provider = new LlamaCppProvider({
    baseUrl: "http://127.0.0.1:9090",
    fetchImpl: async (url) => {
      if (String(url).endsWith("/health")) {
        return new Response("ok", { status: 200 });
      }

      return new Response(
        JSON.stringify({
          model: "Qwen/Qwen3-0.6B-GGUF:Q8_0",
          choices: [
            {
              message: {
                content: "Docking Storm",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  });
  const router = new LocalAiRouter(provider);
  const result = await router.generate({
    taskType: "generate_scene_labels",
    userInput: "A ship docks during a storm.",
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.modelTierUsed, "tiny");
  assert.equal(result.ok && result.text, "Docking Storm");

  const unavailableRouter = new LocalAiRouter(new LlamaCppProvider({
    baseUrl: "http://127.0.0.1:9091",
    fetchImpl: async () => {
      throw new Error("offline");
    },
  }));
  const unavailable = await unavailableRouter.generate({
    taskType: "generate_tags",
    userInput: "storm docking scene",
  });
  assert.equal(unavailable.ok, false);
  assert.equal(!unavailable.ok && unavailable.reason, "provider_unavailable");

  const unconfigured = await router.generate({
    taskType: "run_continuity_check",
    userInput: "check timeline",
  });
  assert.equal(unconfigured.ok, false);
  assert.equal(!unconfigured.ok && unconfigured.reason, "tier_not_configured");
}
