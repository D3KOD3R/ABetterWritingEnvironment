// Intent: provide deterministic placeholder rendering for voice jobs before real TTS providers are connected.
import { markNarrationJobRendered, startNarrationJobRendering, type NarrationJob } from "./narration-job.ts";

// Intent: exercise the render lifecycle without invoking a real voice model.
export function renderPlaceholderNarration(job: NarrationJob, now?: string): NarrationJob {
  const rendering = startNarrationJobRendering(job, now);
  return markNarrationJobRendered(rendering, `voice-output://placeholder/${job.id}`, now);
}
