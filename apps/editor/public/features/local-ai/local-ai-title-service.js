// Intent: own editor-side Local AI title endpoint policy without coupling feature workflows to app.js.

export function createLocalAiTitleService({
  fetchJson,
  logger = console,
  endpoint = "/api/local-ai/generate-title",
  temperature = 0.25,
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createLocalAiTitleService requires a fetchJson function.");
  }

  return {
    requestTitle: (request) => requestLocalAiTitle(request, {
      fetchJson,
      logger,
      endpoint,
      temperature,
    }),
  };
}

export async function requestLocalAiTitle(request, {
  fetchJson,
  logger = console,
  endpoint = "/api/local-ai/generate-title",
  temperature = 0.25,
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("requestLocalAiTitle requires a fetchJson function.");
  }

  try {
    const response = await fetchJson(endpoint, {
      method: "POST",
      body: buildLocalAiTitlePayload(request, { temperature }),
    });

    if (!response?.ok) {
      return {
        ok: false,
        message: "Local AI unavailable",
      };
    }

    const payload = response.value;
    if (!payload?.ok) {
      return {
        ok: false,
        message: localAiUnavailableMessage(payload),
      };
    }

    const title = sanitizeSuggestedTitle(payload.text);
    if (!title) {
      return {
        ok: false,
        message: "No title returned",
      };
    }

    return {
      ok: true,
      title,
    };
  } catch (error) {
    logger?.warn?.("Local AI title request failed", error);
    return {
      ok: false,
      message: "Local AI unavailable",
    };
  }
}

export function buildLocalAiTitlePayload({
  userInput = "",
  manuscriptContext = "",
  projectContext = "",
  maxTokens = 20,
} = {}, {
  temperature = 0.25,
} = {}) {
  return {
    userInput,
    manuscriptContext,
    projectContext,
    outputFormat: "text",
    maxTokens,
    temperature,
  };
}

export function localAiUnavailableMessage(payload) {
  if (payload?.reason === "provider_unavailable") {
    return "Local AI unavailable";
  }

  if (payload?.reason === "tier_not_configured") {
    return "AI tier not configured";
  }

  return "Title not generated";
}

export function sanitizeSuggestedTitle(value) {
  const cleaned = String(value ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s"']+|["']+$/g, "").trim())
    .find(Boolean);

  if (!cleaned) {
    return "";
  }

  return cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;
}
