// Intent: verify editor Local AI title generation policy stays out of app.js.
import assert from "node:assert/strict";

import {
  buildLocalAiTitlePayload,
  createLocalAiTitleService,
  localAiUnavailableMessage,
  sanitizeSuggestedTitle,
} from "../apps/editor/public/features/local-ai/local-ai-title-service.js";

export async function runLocalAiTitleServiceTest() {
  assert.deepEqual(buildLocalAiTitlePayload({
    userInput: "draft text",
    manuscriptContext: "scene context",
    projectContext: "project title",
    maxTokens: 24,
  }), {
    userInput: "draft text",
    manuscriptContext: "scene context",
    projectContext: "project title",
    outputFormat: "text",
    maxTokens: 24,
    temperature: 0.25,
  });

  assert.equal(sanitizeSuggestedTitle("```text\nignored\n```\n- \"The Lantern Wakes\""), "The Lantern Wakes");
  assert.equal(sanitizeSuggestedTitle("\n  1. \"The Lantern Wakes\"\nMore text"), "The Lantern Wakes");
  assert.equal(
    sanitizeSuggestedTitle("A".repeat(80)),
    `${"A".repeat(69)}...`,
  );
  assert.equal(localAiUnavailableMessage({ reason: "provider_unavailable" }), "Local AI unavailable");
  assert.equal(localAiUnavailableMessage({ reason: "tier_not_configured" }), "AI tier not configured");
  assert.equal(localAiUnavailableMessage({ reason: "unknown" }), "Title not generated");

  const calls = [];
  const service = createLocalAiTitleService({
    fetchJson: async (pathname, options) => {
      calls.push({ pathname, options });
      return {
        ok: true,
        value: {
          ok: true,
          text: "- Generated Scene Title",
        },
      };
    },
  });

  assert.deepEqual(await service.requestTitle({
    userInput: "draft text",
    manuscriptContext: "scene context",
    projectContext: "project title",
    maxTokens: 20,
  }), {
    ok: true,
    title: "Generated Scene Title",
  });
  assert.equal(calls[0].pathname, "/api/local-ai/generate-title");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.body.temperature, 0.25);

  const unavailableService = createLocalAiTitleService({
    fetchJson: async () => ({
      ok: true,
      value: {
        ok: false,
        reason: "tier_not_configured",
      },
    }),
  });
  assert.deepEqual(await unavailableService.requestTitle({}), {
    ok: false,
    message: "AI tier not configured",
  });

  const failingService = createLocalAiTitleService({
    fetchJson: async () => {
      throw new Error("offline");
    },
    logger: { warn: () => {} },
  });
  assert.deepEqual(await failingService.requestTitle({}), {
    ok: false,
    message: "Local AI unavailable",
  });
}
