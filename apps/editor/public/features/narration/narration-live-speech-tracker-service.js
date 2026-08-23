// Intent: choose the active live speech tracker without coupling narration recording to one ASR provider.

export const NARRATION_LIVE_SPEECH_PROVIDER_IDS = Object.freeze({
  SHERPA_ONNX: "local-sherpa-onnx",
  WEB_SPEECH: "browser-web-speech",
});

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function emitLiveSpeechTrackerDebug(logger, event, message, context = {}) {
  if (
    !logger ||
    typeof logger.debug !== "function" ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  logger.debug("live-speech-tracker", event, message, context);
}

function normalizeTrackerProvider(provider) {
  const id = normalizeString(provider?.id);
  return {
    id,
    label: normalizeString(provider?.label) || id || "Live speech tracker",
    kind: normalizeString(provider?.kind) || id || "unknown",
    availability: provider?.availability === "disabled" ? "disabled" : "ready",
    unavailableReason: normalizeString(provider?.unavailableReason),
    createTracker: typeof provider?.createTracker === "function" ? provider.createTracker : null,
  };
}

function attachProviderMetadata(tracker, provider) {
  if (!tracker || typeof tracker !== "object") {
    return tracker;
  }

  tracker.providerId = provider.id;
  tracker.providerLabel = provider.label;
  tracker.providerKind = provider.kind;
  return tracker;
}

export function createBrowserWebSpeechTrackerProvider({
  speechRecognitionService = null,
  availability = null,
  unavailableReason = "",
} = {}) {
  const hasRecognitionService = speechRecognitionService && typeof speechRecognitionService.createRecognition === "function";
  return {
    id: NARRATION_LIVE_SPEECH_PROVIDER_IDS.WEB_SPEECH,
    label: "Browser Web Speech",
    kind: "browser-web-speech",
    availability: availability === "disabled" || !hasRecognitionService ? "disabled" : "ready",
    unavailableReason: normalizeString(unavailableReason)
      || (hasRecognitionService ? "" : "Browser speech recognition is unavailable."),
    createTracker(recordingId) {
      if (!hasRecognitionService) {
        return null;
      }
      return speechRecognitionService.createRecognition(recordingId);
    },
  };
}

export function createUnavailableSherpaOnnxTrackerProvider({
  unavailableReason = "sherpa-onnx desktop streaming bridge is not connected yet.",
} = {}) {
  return {
    id: NARRATION_LIVE_SPEECH_PROVIDER_IDS.SHERPA_ONNX,
    label: "Local sherpa-onnx Streaming",
    kind: "local-sherpa-onnx",
    availability: "disabled",
    unavailableReason: normalizeString(unavailableReason),
    createTracker: () => null,
  };
}

export function createPrimaryLiveWithCleanupTrackerProvider({
  primaryProvider = null,
  cleanupProvider = null,
  id = "",
  label = "",
  unavailableReason = "",
} = {}) {
  const primary = normalizeTrackerProvider(primaryProvider);
  const cleanup = normalizeTrackerProvider(cleanupProvider);
  return {
    id: normalizeString(id) || primary.id,
    label: normalizeString(label) || primary.label,
    kind: primary.kind,
    availability: primary.availability,
    unavailableReason: normalizeString(unavailableReason) || primary.unavailableReason,
    // Intent: combine a better live transcript source with a local cleanup recorder without exposing two active trackers to commands.
    async createTracker(recordingId, context = {}) {
      if (primary.availability === "disabled" || typeof primary.createTracker !== "function") {
        return null;
      }

      const primaryTracker = await primary.createTracker(recordingId, context);
      if (!primaryTracker || typeof primaryTracker.start !== "function") {
        return null;
      }

      let cleanupTracker = null;
      if (cleanup.availability !== "disabled" && typeof cleanup.createTracker === "function") {
        try {
          cleanupTracker = await cleanup.createTracker(recordingId, context);
        } catch {
          cleanupTracker = null;
        }
      }

      return {
        start() {
          cleanupTracker?.start?.();
          primaryTracker.start();
        },
        stop() {
          primaryTracker.stop?.();
          cleanupTracker?.stop?.();
        },
        async finalizeTranscript() {
          const cleanupTranscript = typeof cleanupTracker?.finalizeTranscript === "function"
            ? await cleanupTracker.finalizeTranscript()
            : "";
          const primaryTranscript = typeof primaryTracker.finalizeTranscript === "function"
            ? await primaryTracker.finalizeTranscript()
            : "";
          return cleanupTranscript || primaryTranscript || "";
        },
      };
    },
  };
}

export function createNarrationLiveSpeechTrackerService({
  providers = [],
  logger = null,
} = {}) {
  const normalizedProviders = providers.map(normalizeTrackerProvider);

  // Intent: prefer providers in declaration order while logging fallback decisions for test runs.
  async function createTracker(recordingId, context = {}) {
    for (const provider of normalizedProviders) {
      if (!provider.id || provider.availability === "disabled" || !provider.createTracker) {
        emitLiveSpeechTrackerDebug(
          logger,
          "narration-follow.live-speech-provider-skipped",
          "Skipped unavailable live speech tracker provider.",
          {
            recordingId,
            providerId: provider.id,
            providerKind: provider.kind,
            unavailableReason: provider.unavailableReason,
          },
        );
        continue;
      }

      try {
        const tracker = await provider.createTracker(recordingId, context);
        if (tracker && typeof tracker.start === "function") {
          emitLiveSpeechTrackerDebug(
            logger,
            "narration-follow.live-speech-provider-selected",
            "Selected live speech tracker provider.",
            {
              recordingId,
              providerId: provider.id,
              providerKind: provider.kind,
            },
          );
          return attachProviderMetadata(tracker, provider);
        }
      } catch (error) {
        emitLiveSpeechTrackerDebug(
          logger,
          "narration-follow.live-speech-provider-error",
          "Live speech tracker provider failed during creation.",
          {
            recordingId,
            providerId: provider.id,
            providerKind: provider.kind,
            errorMessage: error instanceof Error ? error.message : String(error ?? ""),
          },
        );
      }
    }

    emitLiveSpeechTrackerDebug(
      logger,
      "narration-follow.live-speech-provider-missing",
      "No live speech tracker provider could be created.",
      { recordingId },
    );
    return null;
  }

  return {
    listProviders() {
      return normalizedProviders.map(({ createTracker: _createTracker, ...provider }) => ({ ...provider }));
    },
    createTracker,
  };
}
