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
export {
  LOCAL_AI_MODEL_BROWSE_LINKS,
  LOCAL_AI_MODEL_CATEGORY_FOLDERS,
  LOCAL_AI_MODEL_MANIFEST_FILE_NAME,
  createLocalAiModelLibrarySnapshot,
  ensureLocalAiModelLibraryFolders,
  normalizeModelRoot,
  type LocalAiModelBrowseLink,
  type LocalAiModelCategory,
  type LocalAiModelDescriptor,
  type LocalAiModelFolderRecord,
  type LocalAiModelFormat,
  type LocalAiModelLibrarySnapshot,
  type LocalAiModelRuntime,
  type LocalAiModelSource,
  type LocalAiModelStatus,
} from "./model-library.ts";
export { LlamaCppProvider } from "./providers/llama-cpp-provider.ts";
export {
  createDefaultModelByTier,
  normalizeLlamaCppBaseUrl,
  type LlamaCppProviderOptions,
} from "./providers/llama-cpp-options.ts";
