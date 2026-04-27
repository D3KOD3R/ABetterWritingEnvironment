import type {
  AiModelTier,
  AiRequest,
  AiResult,
  LocalAiProvider,
} from "../local-ai-types.ts";
import {
  createDefaultModelByTier,
  normalizeLlamaCppBaseUrl,
  type LlamaCppProviderOptions,
} from "./llama-cpp-options.ts";

type LlamaChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
};

export class LlamaCppProvider implements LocalAiProvider {
  readonly providerName = "llama.cpp";
  readonly baseUrl: string;
  readonly modelByTier: Record<AiModelTier, string>;
  readonly configuredTiers: AiModelTier[];
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LlamaCppProviderOptions = {}) {
    this.baseUrl = normalizeLlamaCppBaseUrl(options.baseUrl);
    this.modelByTier = {
      ...createDefaultModelByTier(),
      ...(options.modelByTier ?? {}),
    };
    this.configuredTiers = options.configuredTiers ?? ["tiny"];
    this.timeoutMs = options.timeoutMs ?? 1500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(args: {
    request: AiRequest;
    selectedTier: AiModelTier;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<AiResult> {
    const { request, selectedTier, systemPrompt, userPrompt } = args;
    const modelName = this.modelByTier[selectedTier];

    if (!this.configuredTiers.includes(selectedTier) || !modelName) {
      return {
        ok: false,
        reason: "tier_not_configured",
        message: `${selectedTier} local AI tier is not configured.`,
        taskType: request.taskType,
        requestedTier: selectedTier,
      };
    }

    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 192,
        }),
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: "provider_error",
          message: `llama.cpp returned HTTP ${response.status}.`,
          taskType: request.taskType,
          requestedTier: selectedTier,
        };
      }

      const payload = await response.json() as LlamaChatCompletionResponse;
      const text = payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text ?? "";

      return {
        ok: true,
        text,
        taskType: request.taskType,
        modelTierUsed: selectedTier,
        providerName: this.providerName,
        modelName: payload.model ?? modelName,
        outputFormat: request.outputFormat ?? "text",
      };
    } catch (error) {
      return {
        ok: false,
        reason: "provider_unavailable",
        message: error instanceof Error
          ? `llama.cpp is unavailable: ${error.message}`
          : "llama.cpp is unavailable.",
        taskType: request.taskType,
        requestedTier: selectedTier,
      };
    }
  }

  private async fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
