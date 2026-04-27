import { createCompletedJob } from "../../../packages/job-contracts/src/index.ts";
import type {
  CreateSpeakerBindingsInput,
  SpeakerVoiceBinding,
  VoiceProfile,
  VoiceServiceContract,
  VoiceChapterRenderInput,
  VoicePreviewInput,
} from "../../../packages/shared-types/src/index.ts";

const VOICE_PROFILES: VoiceProfile[] = [
  {
    id: "voice-narrator-lantern",
    label: "Lantern Narrator",
    providerId: "local-voice-suite",
    role: "narrator",
    style: "measured documentary warmth",
  },
  {
    id: "voice-auren-cinder",
    label: "Auren Cinder",
    providerId: "local-voice-suite",
    role: "character",
    style: "steady command with restrained pressure",
  },
  {
    id: "voice-voss-iron",
    label: "Voss Iron",
    providerId: "local-voice-suite",
    role: "character",
    style: "hard official diction",
  },
  {
    id: "voice-mara-glass",
    label: "Mara Glass",
    providerId: "local-voice-suite",
    role: "character",
    style: "precise curiosity with clipped urgency",
  },
];

export function createInMemoryVoiceService(): VoiceServiceContract {
  let bindingSequence = 0;
  let renderSequence = 0;

  return {
    provider: {
      id: "local-voice-suite",
      label: "Local Voice Suite",
      availability: "ready",
      synthesisMode: "local",
    },
    listProfiles(): VoiceProfile[] {
      return VOICE_PROFILES.map((profile) => ({ ...profile }));
    },
    createSpeakerBindings(input: CreateSpeakerBindingsInput): SpeakerVoiceBinding[] {
      return input.assignments.map((assignment) => {
        bindingSequence += 1;
        const voiceProfileId = resolveVoiceProfileId(assignment.speakerLabel, assignment.role);

        return {
          id: `voice-binding-${String(bindingSequence).padStart(4, "0")}`,
          speakerAssignmentId: assignment.id,
          speakerLabel: assignment.speakerLabel,
          voiceProfileId,
          previewText: resolvePreviewText(input.project, assignment.blockId),
        };
      });
    },
    queueVoicePreview(input: VoicePreviewInput) {
      renderSequence += 1;
      const now = input.now ?? new Date().toISOString();

      return createCompletedJob(
        `voice-job-${String(renderSequence).padStart(4, "0")}`,
        "voice-preview",
        {
          projectId: input.projectId,
          sceneId: input.sceneId,
          mode: "preview",
          bindingIds: [...input.bindingIds],
        },
        {
          providerId: "local-voice-suite",
          outputLabel: `preview-${String(renderSequence).padStart(2, "0")}.wav`,
          clipCount: input.bindingIds.length,
        },
        now,
      );
    },
    queueChapterRender(input: VoiceChapterRenderInput) {
      renderSequence += 1;
      const now = input.now ?? new Date().toISOString();

      return createCompletedJob(
        `voice-job-${String(renderSequence).padStart(4, "0")}`,
        "voice-render",
        {
          projectId: input.projectId,
          chapterId: input.chapterId,
          mode: "chapter",
          bindingIds: [...input.bindingIds],
        },
        {
          providerId: "local-voice-suite",
          outputLabel: `chapter-${input.chapterId}.wav`,
          clipCount: input.bindingIds.length,
        },
        now,
      );
    },
  };
}

function resolveVoiceProfileId(speakerLabel: string, role: "narrator" | "character"): string {
  const lower = speakerLabel.toLowerCase();

  if (role === "narrator") {
    return "voice-narrator-lantern";
  }

  if (lower.includes("auren")) {
    return "voice-auren-cinder";
  }

  if (lower.includes("voss")) {
    return "voice-voss-iron";
  }

  if (lower.includes("mara")) {
    return "voice-mara-glass";
  }

  return "voice-narrator-lantern";
}

function resolvePreviewText(
  input: CreateSpeakerBindingsInput["project"],
  blockId: string,
): string {
  for (const chapter of input.chapters) {
    for (const scene of chapter.scenes) {
      const block = scene.blocks.find((candidate) => candidate.id === blockId);

      if (block) {
        return block.text;
      }
    }
  }

  return "";
}
