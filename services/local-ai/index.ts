// Intent: re-export local AI service contracts and provider adapters from one service entrypoint.
export type {
  AiModelTier,
  AiTaskType,
  AiOutputFormat,
  AiRequest,
  AiResponse,
  AiUnavailableResponse,
  AiResult,
  LocalAiProvider,
  LocalAiProviderStatus,
} from "./local-ai-types.ts";
export { LocalAiRouter } from "./local-ai-router.ts";
export { selectModelTier } from "./model-routing-policy.ts";
export { buildLocalAiPrompt } from "./prompt-builder.ts";
export { LlamaCppProvider } from "./providers/llama-cpp-provider.ts";
export {
  createDefaultModelByTier,
  normalizeLlamaCppBaseUrl,
  type LlamaCppProviderOptions,
} from "./providers/llama-cpp-options.ts";
