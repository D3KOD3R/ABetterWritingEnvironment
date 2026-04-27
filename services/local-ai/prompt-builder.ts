import type { AiRequest } from "./local-ai-types.ts";

export function buildLocalAiPrompt(request: AiRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const outputFormat = request.outputFormat ?? "text";
  const formatInstruction =
    outputFormat === "json"
      ? "Return only valid compact JSON. Do not include markdown fences."
      : "Return concise plain text. Do not include markdown fences.";

  const systemPrompt = [
    "You are a local-first fiction authoring assistant inside a manuscript IDE.",
    "Respect manuscript anchors and never claim to have changed project data.",
    "Prefer concise, practical writing support over broad commentary.",
    formatInstruction,
  ].join(" ");

  const userPrompt = [
    `Task: ${request.taskType}`,
    request.projectContext ? `Project context:\n${request.projectContext}` : "",
    request.manuscriptContext ? `Manuscript context:\n${request.manuscriptContext}` : "",
    `User input:\n${request.userInput}`,
    getTaskInstruction(request),
  ].filter(Boolean).join("\n\n");

  return { systemPrompt, userPrompt };
}

function getTaskInstruction(request: AiRequest): string {
  switch (request.taskType) {
    case "generate_chapter_titles":
      return "Generate short literary chapter title options.";
    case "generate_scene_labels":
      return "Generate compact scene labels suitable for a manuscript tree.";
    case "generate_tags":
      return "Generate short lowercase tags. Prefer 3 to 8 tags.";
    case "generate_short_summary":
      return "Generate a short summary that preserves story-specific details.";
    case "generate_issue_heading":
      return "Generate a brief issue-console heading for the problem.";
    case "review_paragraph":
      return "Review clarity, repetition, rhythm, and reader impact for this paragraph.";
    case "review_scene":
      return "Review scene clarity, pacing, dialogue, and continuity risks.";
    case "rewrite_paragraph":
      return "Suggest an alternate paragraph while preserving intent and story facts.";
    case "run_continuity_check":
      return "Check for continuity risks using only the provided structured context.";
    case "review_character_logic":
      return "Review whether character action and dialogue are internally consistent.";
    case "review_timeline_consistency":
      return "Review whether the timeline details are internally consistent.";
    case "review_structure":
      return "Review story structure and identify high-level structural risks.";
    default:
      return "Complete the requested local manuscript-assistance task.";
  }
}
