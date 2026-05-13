// Intent: route local AI requests through provider boundaries without tying editor workflows to one model.
import type {
  AiRequest,
  AiResult,
  LocalAiProvider,
  LocalAiProviderStatus,
} from "./local-ai-types.ts";
import { selectModelTier } from "./model-routing-policy.ts";
import { buildLocalAiPrompt } from "./prompt-builder.ts";

// Intent: keep model availability, tier selection, and prompt building outside editor UI code.
export class LocalAiRouter {
  private readonly provider: LocalAiProvider;

  constructor(provider: LocalAiProvider) {
    this.provider = provider;
  }

  async status(): Promise<LocalAiProviderStatus> {
    // Intent: expose provider configuration without forcing a generation call.
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
    // Intent: fail clearly before provider calls when routing policy or local runtime is unavailable.
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
