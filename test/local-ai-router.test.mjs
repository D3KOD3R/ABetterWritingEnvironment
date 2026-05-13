// Intent: verify local AI routing preserves provider boundaries and tier selection contracts.
import assert from "node:assert/strict";
import {
  LocalAiRouter,
} from "../services/local-ai/index.ts";

class FakeProvider {
  providerName = "fake";
  configuredTiers = ["tiny", "standard"];

  async isAvailable() {
    return true;
  }

  async generate({ request, selectedTier }) {
    return {
      ok: true,
      text: "fake response",
      taskType: request.taskType,
      modelTierUsed: selectedTier,
      providerName: this.providerName,
      modelName: "fake-model",
      outputFormat: request.outputFormat ?? "text",
    };
  }
}

export async function runLocalAiRouterContractTest() {
  const router = new LocalAiRouter(new FakeProvider());

  const result = await router.generate({
    taskType: "generate_chapter_titles",
    userInput: "A storm rolls over the city.",
  });

  assert.equal(result.ok, true);
  assert.equal(result.modelTierUsed, "tiny");

  const standardResult = await router.generate({
    taskType: "review_scene",
    userInput: "A scene.",
  });

  assert.equal(standardResult.ok, true);
  assert.equal(standardResult.modelTierUsed, "standard");

  const unconfiguredResult = await router.generate({
    taskType: "run_continuity_check",
    userInput: "Current chapter.",
    manuscriptContext: "Known facts.",
  });

  assert.equal(unconfiguredResult.ok, false);
  assert.equal(unconfiguredResult.reason, "tier_not_configured");

  const overrideResult = await router.generate({
    taskType: "run_continuity_check",
    userInput: "Current chapter.",
    manuscriptContext: "Known facts.",
    preferredTier: "tiny",
    devAllowTinyContinuityCheck: true,
    outputFormat: "json",
  });

  assert.equal(overrideResult.ok, true);
  assert.equal(overrideResult.modelTierUsed, "tiny");
}
