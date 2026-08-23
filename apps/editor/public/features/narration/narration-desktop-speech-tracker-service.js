// Intent: connect narration recording to the repo-local desktop sherpa-onnx and whisper.cpp bridge.

import { normalizeNarrationTakeStatusText } from "./narration-take-service.js";
import {
  applyNarrationFollowTranscriptWindowToSnapshot,
} from "./narration-follow-transcript-window-service.js";

export const DESKTOP_SHERPA_ONNX_PROVIDER_ID = "local-sherpa-onnx";

function emitDesktopSpeechTrackerDebug(logger, event, message, context = {}) {
  if (
    !logger ||
    typeof logger.debug !== "function" ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  logger.debug("desktop-speech-tracker", event, message, context);
}

function findLocalSherpaProvider(providers) {
  return Array.isArray(providers)
    ? providers.find((provider) => provider?.id === DESKTOP_SHERPA_ONNX_PROVIDER_ID && provider.availability === "ready") ?? null
    : null;
}

function createTrackerStatus(provider) {
  return provider?.label
    ? `${provider.label} listening`
    : "Local speech tracker listening";
}

export function createDesktopRealtimeSpeechTrackerProvider({
  realtimeSpeechClient,
  liveAudioFrameService,
  getRuntime = () => null,
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  resolveFollowMatch = () => null,
  logger = null,
  maxInFlightFrames = 1,
  maxQueuedFrames = 1,
  applyLiveTranscriptPatches = true,
} = {}) {
  return {
    id: DESKTOP_SHERPA_ONNX_PROVIDER_ID,
    label: "Local sherpa-onnx Streaming",
    kind: "local-sherpa-onnx",
    availability: "ready",
    async createTracker(recordingId, context = {}) {
      const providersResponse = await realtimeSpeechClient.listProviders();
      const provider = findLocalSherpaProvider(providersResponse.providers);
      if (!provider) {
        emitDesktopSpeechTrackerDebug(
          logger,
          "narration-follow.local-sherpa-unavailable",
          "Repo-local sherpa-onnx provider is unavailable.",
          {
            recordingId,
            providerCount: providersResponse.providers?.length ?? 0,
            errorMessage: providersResponse.error?.message ?? providersResponse.value?.message ?? "",
          },
        );
        return null;
      }

      const sessionResponse = await realtimeSpeechClient.startSession({
        projectId: context.projectId,
        recordingId,
        sceneId: context.selection?.sceneId,
        blockId: context.selection?.blockId,
        language: "en-US",
        sampleRate: 16000,
        channelCount: 1,
        preferredProviderId: provider.id,
      });
      if (!sessionResponse.ok || !sessionResponse.value?.ok || !sessionResponse.value?.session?.id) {
        emitDesktopSpeechTrackerDebug(
          logger,
          "narration-follow.local-sherpa-start-failed",
          "Repo-local sherpa-onnx session could not start.",
          {
            recordingId,
            errorMessage: sessionResponse.error?.message ?? sessionResponse.value?.message ?? "",
          },
        );
        return null;
      }

      const desktopSession = sessionResponse.value.session;
      let audioFrameHandle = null;
      let stopped = false;
      let finalizePromise = null;
      let inFlightFrames = 0;
      let droppedFrames = 0;
      let queuedFrame = null;
      const pendingFrameSends = new Set();
      const pendingArchiveSends = new Set();
      let lastFinalTranscript = "";

      const patchActiveRuntime = (patch) => {
        const runtime = getRuntime();
        if (!runtime || runtime.recordingId !== recordingId) {
          return;
        }
        applyRuntimePatch(recordingId, patch);
        refreshSession();
      };

      const applyTranscriptSnapshot = (rawSpeechSnapshot) => {
        const speechSnapshot = applyNarrationFollowTranscriptWindowToSnapshot(rawSpeechSnapshot);
        const transcript = normalizeNarrationTakeStatusText(speechSnapshot?.transcript);
        if (!transcript) {
          return;
        }
        if (!applyLiveTranscriptPatches) {
          return;
        }
        const runtime = getRuntime();
        const follow = typeof resolveFollowMatch === "function"
          ? resolveFollowMatch({ recordingId, transcript, runtime, speechSnapshot })
          : null;
        emitDesktopSpeechTrackerDebug(
          logger,
          "narration-follow.local-sherpa-snapshot",
          "Received repo-local sherpa-onnx transcript snapshot.",
          {
            recordingId,
            sessionId: desktopSession.id,
            transcriptLength: transcript.length,
            changedTranscriptLength: speechSnapshot?.changedTranscript?.length ?? 0,
            sourceTranscriptWordCount: speechSnapshot?.transcriptWindow?.sourceTranscriptWordCount ?? 0,
            transcriptWindowWordCount: speechSnapshot?.transcriptWindow?.transcriptWindowWordCount ?? 0,
            transcriptWindowed: speechSnapshot?.transcriptWindow?.isTranscriptWindowed === true,
            isEndpoint: speechSnapshot?.isEndpoint === true,
            followStatus: follow?.status ?? "",
            matchedBlockId: follow?.followSelection?.blockId ?? "",
            confidence: follow?.followSelection?.confidence ?? null,
          },
        );
        patchActiveRuntime({
          transcript,
          liveTranscript: transcript,
          liveChangedTranscript: normalizeNarrationTakeStatusText(speechSnapshot?.changedTranscript),
          liveTranscriptUpdatedAt: normalizeNarrationTakeStatusText(speechSnapshot?.receivedAt) || new Date().toISOString(),
          speechSnapshot,
          trackerStatus: follow?.trackerStatus || "Local speech tracker active",
          followSelection: follow?.followSelection ?? runtime?.followSelection ?? null,
          followMatch: follow?.match ?? runtime?.followMatch ?? null,
        });
      };

      async function sendFrame(frame) {
        if (stopped) {
          return;
        }
        inFlightFrames += 1;
        try {
          const response = await realtimeSpeechClient.sendAudioFrame({
            sessionId: desktopSession.id,
            ...frame,
          });
          const speechSnapshot = response.value?.transcriptSnapshot;
          if (response.ok && speechSnapshot?.transcript) {
            applyTranscriptSnapshot(speechSnapshot);
          }
        } catch (error) {
          emitDesktopSpeechTrackerDebug(
            logger,
            "narration-follow.local-audio-chunk-error",
            "A local PCM chunk could not be processed by the desktop sidecar.",
            {
              recordingId,
              sessionId: desktopSession.id,
              errorMessage: error instanceof Error ? error.message : String(error ?? ""),
            },
          );
        } finally {
          inFlightFrames -= 1;
        }
      }

      async function archiveFrame(frame, reason = "stale-live-chunk") {
        if (stopped || !frame) {
          return;
        }
        try {
          await realtimeSpeechClient.sendAudioFrame({
            sessionId: desktopSession.id,
            ...frame,
            skipLiveDecode: true,
          });
          emitDesktopSpeechTrackerDebug(
            logger,
            "narration-follow.local-audio-chunk-archived",
            "Archived a local PCM chunk for stop-time cleanup without live decoding.",
            {
              recordingId,
              sessionId: desktopSession.id,
              reason,
              durationMs: Math.round(Number(frame?.durationMs) || 0),
              byteLength: frame?.byteLength ?? 0,
            },
          );
        } catch (error) {
          emitDesktopSpeechTrackerDebug(
            logger,
            "narration-follow.local-audio-archive-error",
            "A local PCM chunk could not be archived for stop-time cleanup.",
            {
              recordingId,
              sessionId: desktopSession.id,
              reason,
              errorMessage: error instanceof Error ? error.message : String(error ?? ""),
            },
          );
        }
      }

      function archiveFrameInBackground(frame, reason = "stale-live-chunk") {
        const archivePromise = archiveFrame(frame, reason);
        pendingArchiveSends.add(archivePromise);
        archivePromise.finally(() => {
          pendingArchiveSends.delete(archivePromise);
        });
        return archivePromise;
      }

      function sendFrameInBackground(frame) {
        const sendPromise = sendFrame(frame);
        pendingFrameSends.add(sendPromise);
        sendPromise.finally(() => {
          pendingFrameSends.delete(sendPromise);
          if (stopped || !queuedFrame || inFlightFrames >= maxInFlightFrames) {
            return;
          }

          const nextFrame = queuedFrame;
          queuedFrame = null;
          sendFrameInBackground(nextFrame);
        });
        return sendPromise;
      }

      function queueFrame(frame) {
        if (stopped) {
          return;
        }
        if (inFlightFrames < maxInFlightFrames) {
          sendFrameInBackground(frame);
          return;
        }

        if (queuedFrame) {
          droppedFrames += 1;
          archiveFrameInBackground(queuedFrame, "replaced-pending-live-chunk");
        }
        if (maxQueuedFrames > 0) {
          queuedFrame = frame;
        } else {
          droppedFrames += 1;
          queuedFrame = null;
          archiveFrameInBackground(frame, "live-queue-disabled");
        }
        emitDesktopSpeechTrackerDebug(
          logger,
          "narration-follow.local-audio-chunk-queued",
          queuedFrame
            ? "Queued the latest local PCM chunk while the desktop sidecar is busy."
            : "Dropped a local PCM chunk because the desktop sidecar queue is disabled.",
          {
            recordingId,
            sessionId: desktopSession.id,
            queued: Boolean(queuedFrame),
            droppedFrames,
            maxInFlightFrames,
            durationMs: Math.round(Number(frame?.durationMs) || 0),
            byteLength: frame?.byteLength ?? 0,
          },
        );
      }

      async function drainQueuedFrames() {
        while (queuedFrame || pendingFrameSends.size > 0 || pendingArchiveSends.size > 0) {
          if (queuedFrame && inFlightFrames < maxInFlightFrames) {
            const nextFrame = queuedFrame;
            queuedFrame = null;
            sendFrameInBackground(nextFrame);
          }
          const pending = [...pendingFrameSends, ...pendingArchiveSends];
          if (!pending.length) {
            break;
          }
          await Promise.allSettled(pending);
        }
      }

      async function finalizeTranscript() {
        if (finalizePromise) {
          return finalizePromise;
        }
        finalizePromise = (async () => {
          if (stopped) {
            return lastFinalTranscript;
          }
          audioFrameHandle?.stop?.();
          await drainQueuedFrames();
          stopped = true;
          const response = await realtimeSpeechClient.stopSession({
            sessionId: desktopSession.id,
          });
          const speechSnapshot = response.value?.transcriptSnapshot
            ? applyNarrationFollowTranscriptWindowToSnapshot(response.value.transcriptSnapshot)
            : null;
          if (speechSnapshot?.transcript) {
            applyTranscriptSnapshot(speechSnapshot);
          }
          lastFinalTranscript = normalizeNarrationTakeStatusText(response.value?.finalTranscript)
            || normalizeNarrationTakeStatusText(speechSnapshot?.transcript)
            || lastFinalTranscript;
          patchActiveRuntime({
            cleanupTranscript: lastFinalTranscript,
            liveTranscript: normalizeNarrationTakeStatusText(speechSnapshot?.transcript) || getRuntime()?.liveTranscript || "",
            speechSnapshot: speechSnapshot ?? getRuntime()?.speechSnapshot ?? null,
          });
          emitDesktopSpeechTrackerDebug(
            logger,
            "narration-follow.local-sherpa-stopped",
            "Stopped repo-local sherpa-onnx tracking and collected whisper.cpp cleanup transcript.",
            {
              recordingId,
              sessionId: desktopSession.id,
              finalTranscriptLength: lastFinalTranscript.length,
              whisperAvailable: response.value?.whisper?.available === true,
              whisperError: response.value?.whisper?.errorMessage ?? "",
              droppedFrames,
            },
          );
          return lastFinalTranscript;
        })();
        return finalizePromise;
      }

      return {
        providerId: provider.id,
        providerLabel: provider.label,
        providerKind: provider.kind,
        start() {
          patchActiveRuntime({
            trackerStatus: createTrackerStatus(provider),
          });
          audioFrameHandle = liveAudioFrameService.start({
            stream: context.stream,
            onFrame: (frame) => {
              queueFrame(frame);
            },
          });
          if (!audioFrameHandle) {
            patchActiveRuntime({
              trackerStatus: "Local PCM capture unavailable; recording remains anchored.",
            });
          }
        },
        stop() {
          void finalizeTranscript();
        },
        finalizeTranscript,
      };
    },
  };
}
