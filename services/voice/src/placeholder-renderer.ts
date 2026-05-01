import { markNarrationJobRendered, startNarrationJobRendering, type NarrationJob } from "./narration-job.ts";

export function renderPlaceholderNarration(job: NarrationJob, now?: string): NarrationJob {
  const rendering = startNarrationJobRendering(job, now);
  return markNarrationJobRendered(rendering, `voice-output://placeholder/${job.id}`, now);
}
