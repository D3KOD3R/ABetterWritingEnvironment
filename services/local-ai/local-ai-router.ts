import type {
  AiRequest,
  AiResult,
  LocalAiProvider,
  LocalAiProviderStatus,
} from "./local-ai-types.ts";
import { selectModelTier } from "./model-routing-policy.ts";
import { buildLocalAiPrompt } from "./prompt-builder.ts";

export class LocalAiRouter {
  private readonly provider: LocalAiProvider;

  constructor(provider: LocalAiProvider) {
    this.provider = provider;
  }

  async status(): Promise<LocalAiProviderStatus> {
    const baseUrl = "baseUrl" in this.provider && typeof this.provider.baseUrl === "string"
      ? this.provider.baseUrl
      : "";
    return {
      providerName: this.provider.providerName,
      baseUrl,
      configuredTiers: [...this.provider.configuredTiers],
      available: await this.provider.isAvailable(),
    };
  }

  async generate(request: AiRequest): Promise<AiResult> {
    const selectedTier = selectModelTier(request);

    if (!this.provider.configuredTiers.includes(selectedTier)) {
      return {
        ok: false,
        reason: "tier_not_configured",
        message: `${selectedTier} local AI tier is not configured.`,
        taskType: request.taskType,
        requestedTier: selectedTier,
      };
    }

    const isAvailable = await this.provider.isAvailable();
    if (!isAvailable) {
      return {
        ok: false,
        reason: "provider_unavailable",
        message: `${this.provider.providerName} is not available on 127.0.0.1.`,
        taskType: request.taskType,
        requestedTier: selectedTier,
      };
    }

    const { systemPrompt, userPrompt } = buildLocalAiPrompt(request);
    return this.provider.generate({
      request,
      selectedTier,
      systemPrompt,
      userPrompt,
    });
  }
}
