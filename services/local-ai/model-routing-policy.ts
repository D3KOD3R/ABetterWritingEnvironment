import type { AiModelTier, AiRequest } from "./local-ai-types.ts";

export function selectModelTier(request: AiRequest): AiModelTier {
  if (request.preferredTier) {
    return request.preferredTier;
  }

  switch (request.taskType) {
    case "generate_chapter_titles":
    case "generate_scene_labels":
    case "generate_tags":
    case "generate_short_summary":
    case "generate_issue_heading":
      return "tiny";

    case "review_paragraph":
    case "review_scene":
    case "rewrite_paragraph":
      return "standard";

    case "run_continuity_check":
    case "review_character_logic":
    case "review_timeline_consistency":
    case "review_structure":
      return request.devAllowTinyContinuityCheck ? "tiny" : "large";

    default:
      return "standard";
  }
}
