import { createCompletedJob } from "../../../packages/job-contracts/src/index.ts";
import type {
  AlignNarrationInput,
  AudioServiceContract,
  NarrationSessionSnapshot,
  StartNarrationSessionInput,
} from "../../../packages/shared-types/src/index.ts";

export function createInMemoryAudioService(): AudioServiceContract {
  let sessionSequence = 0;
  let alignmentSequence = 0;

  return {
    provider: {
      id: "local-alignment-monitor",
      label: "Local Alignment Monitor",
      availability: "ready",
      alignmentStrategy: "anchor-tracked incremental alignment",
    },
    startNarrationSession(input: StartNarrationSessionInput): NarrationSessionSnapshot {
      sessionSequence += 1;
      const now = input.now ?? new Date().toISOString();

      return {
        id: `narration-session-${String(sessionSequence).padStart(4, "0")}`,
        projectId: input.project.id,
        providerId: "local-alignment-monitor",
        sessionLabel: input.sessionLabel,
        status: "tracking",
        currentAnchor: input.anchor,
        currentLineNumber: input.currentLineNumber,
        currentText: input.currentText,
        updatedAt: now,
      };
    },
    alignNarration(input: AlignNarrationInput) {
      alignmentSequence += 1;
      const now = input.now ?? new Date().toISOString();

      const session: NarrationSessionSnapshot = {
        ...input.session,
        currentAnchor: input.anchor,
        currentLineNumber: input.matchedLineNumber,
        currentText: input.resolvedText,
        updatedAt: now,
      };

      const job = createCompletedJob(
        `alignment-job-${String(alignmentSequence).padStart(4, "0")}`,
        "alignment",
        {
          sessionId: input.session.id,
          projectId: input.projectId,
          anchor: input.anchor,
          transcript: input.transcript,
        },
        {
          matchedLineNumber: input.matchedLineNumber,
          confidence: input.confidence,
          resolvedText: input.resolvedText,
        },
        now,
      );

      return { session, job };
    },
  };
}
