// Intent: provide an in-memory audio service for narration sessions and anchor-aware alignment jobs.
import { createCompletedJob } from "../../../packages/job-contracts/src/index.ts";
import type {
  AcceptRealtimeSpeechSnapshotInput,
  AlignNarrationInput,
  AudioServiceContract,
  NarrationSessionSnapshot,
  RealtimeSpeechProviderDescriptor,
  StartNarrationSessionInput,
  StartRealtimeSpeechSessionInput,
  StopRealtimeSpeechSessionInput,
} from "../../../packages/shared-types/src/index.ts";
import {
  createRealtimeSpeechSessionCoordinator,
  createSherpaOnnxRealtimeProviderDescriptor,
  createWhisperCppWindowRealtimeProviderDescriptor,
  type AudioRealtimeLogger,
} from "./realtime-speech.ts";

// Intent: model narration follow behavior behind the audio contract without embedding UI state.
export function createInMemoryAudioService({
  realtimeSpeechProviders = [
    createSherpaOnnxRealtimeProviderDescriptor(),
    createWhisperCppWindowRealtimeProviderDescriptor(),
  ],
  realtimeSpeechLogger = null,
}: {
  realtimeSpeechProviders?: RealtimeSpeechProviderDescriptor[];
  realtimeSpeechLogger?: AudioRealtimeLogger | null;
} = {}): AudioServiceContract {
  let sessionSequence = 0;
  let alignmentSequence = 0;
  const realtimeSpeech = createRealtimeSpeechSessionCoordinator({
    providers: realtimeSpeechProviders,
    logger: realtimeSpeechLogger,
  });

  return {
    provider: {
      id: "local-alignment-monitor",
      label: "Local Alignment Monitor",
      availability: "ready",
      alignmentStrategy: "anchor-tracked incremental alignment",
      realtimeSpeechProviders: realtimeSpeech.listProviders(),
    },
    startNarrationSession(input: StartNarrationSessionInput): NarrationSessionSnapshot {
      // Intent: start tracking from a canonical manuscript anchor rather than screen position.
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
      // Intent: record alignment as a completed job so future ASR providers can share the same lifecycle.
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
    listRealtimeSpeechProviders() {
      return realtimeSpeech.listProviders();
    },
    startRealtimeSpeechSession(input: StartRealtimeSpeechSessionInput) {
      return realtimeSpeech.startSession(input);
    },
    acceptRealtimeSpeechSnapshot(input: AcceptRealtimeSpeechSnapshotInput) {
      return realtimeSpeech.acceptTranscriptSnapshot(input);
    },
    stopRealtimeSpeechSession(input: StopRealtimeSpeechSessionInput) {
      return realtimeSpeech.stopSession(input);
    },
  };
}

export {
  BROWSER_WEB_SPEECH_PROVIDER_ID,
  SHERPA_ONNX_REALTIME_PROVIDER_ID,
  WHISPER_CPP_WINDOW_PROVIDER_ID,
  createBrowserWebSpeechRealtimeProviderDescriptor,
  createDisabledRealtimeProviderDescriptor,
  createRealtimeSpeechSessionCoordinator,
  createRealtimeSpeechTranscriptSnapshot,
  createSherpaOnnxRealtimeProviderDescriptor,
  createWhisperCppWindowRealtimeProviderDescriptor,
  selectRealtimeSpeechProvider,
} from "./realtime-speech.ts";
