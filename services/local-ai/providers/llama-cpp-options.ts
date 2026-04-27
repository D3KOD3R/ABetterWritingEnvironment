import type { AiModelTier } from "../local-ai-types.ts";

export type LlamaCppProviderOptions = {
  baseUrl?: string;
  modelByTier?: Partial<Record<AiModelTier, string>>;
  configuredTiers?: AiModelTier[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export function normalizeLlamaCppBaseUrl(candidate?: string): string {
  const rawValue = candidate ?? process.env.LOCAL_AI_LLAMA_CPP_BASE_URL ?? "http://127.0.0.1:8080";
  const url = new URL(rawValue);

  if (url.hostname !== "127.0.0.1") {
    throw new Error("llama.cpp provider must use 127.0.0.1.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function createDefaultModelByTier(): Record<AiModelTier, string> {
  return {
    tiny: "Qwen/Qwen3-0.6B-GGUF:Q8_0",
    standard: "",
    large: "",
  };
}
