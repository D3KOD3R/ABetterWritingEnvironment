export type AiModelTier = "tiny" | "standard" | "large";

export type AiTaskType =
  | "generate_chapter_titles"
  | "generate_scene_labels"
  | "generate_tags"
  | "generate_short_summary"
  | "generate_issue_heading"
  | "review_paragraph"
  | "review_scene"
  | "rewrite_paragraph"
  | "run_continuity_check"
  | "review_character_logic"
  | "review_timeline_consistency"
  | "review_structure";

export type AiOutputFormat = "text" | "json";

export type AiRequest = {
  taskType: AiTaskType;
  userInput: string;
  manuscriptContext?: string;
  projectContext?: string;
  preferredTier?: AiModelTier;
  maxTokens?: number;
  temperature?: number;
  outputFormat?: AiOutputFormat;
  devAllowTinyContinuityCheck?: boolean;
};

export type AiResponse = {
  ok: true;
  text: string;
  taskType: AiTaskType;
  modelTierUsed: AiModelTier;
  providerName: string;
  modelName: string;
  outputFormat: AiOutputFormat;
};

export type AiUnavailableResponse = {
  ok: false;
  reason: "provider_unavailable" | "tier_not_configured" | "provider_error";
  message: string;
  taskType?: AiTaskType;
  requestedTier?: AiModelTier;
};

export type AiResult = AiResponse | AiUnavailableResponse;

export type LocalAiProviderStatus = {
  providerName: string;
  baseUrl: string;
  configuredTiers: AiModelTier[];
  available: boolean;
};

export type LocalAiProvider = {
  providerName: string;
  configuredTiers: AiModelTier[];
  isAvailable(): Promise<boolean>;
  generate(args: {
    request: AiRequest;
    selectedTier: AiModelTier;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<AiResult>;
};
