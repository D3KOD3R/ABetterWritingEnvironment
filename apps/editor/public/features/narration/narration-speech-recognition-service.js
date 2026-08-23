// Intent: own narration speech-recognition event handling outside the editor shell.

import {
  normalizeNarrationTakeStatusText,
  normalizeNarrationTakeTranscript,
} from "./narration-take-service.js";
import {
  applyNarrationFollowTranscriptWindowToSnapshot,
} from "./narration-follow-transcript-window-service.js";

export function createNarrationSpeechRecognitionTranscriptSnapshot(results, {
  resultIndex = 0,
} = {}) {
  if (!results) {
    return {
      transcript: "",
      finalTranscript: "",
      interimTranscript: "",
      changedTranscript: "",
      segmentCount: 0,
      finalSegmentCount: 0,
      interimSegmentCount: 0,
      resultIndex: 0,
    };
  }

  const segments = Array.from(results)
    .map((result, index) => {
      const alternative = result?.[0] ?? {};
      const transcript = normalizeNarrationTakeTranscript(alternative.transcript ?? "");
      return transcript
        ? {
          index,
          transcript,
          isFinal: result?.isFinal === true,
          confidence: Number.isFinite(Number(alternative.confidence))
            ? Number(alternative.confidence)
            : null,
        }
        : null;
    })
    .filter(Boolean);
  const safeResultIndex = Math.max(0, Math.min(
    segments.length,
    Math.floor(Number(resultIndex) || 0),
  ));
  const finalSegments = segments.filter((segment) => segment.isFinal);
  const interimSegments = segments.filter((segment) => !segment.isFinal);

  return {
    transcript: normalizeNarrationTakeTranscript(segments.map((segment) => segment.transcript).join(" ")),
    finalTranscript: normalizeNarrationTakeTranscript(finalSegments.map((segment) => segment.transcript).join(" ")),
    interimTranscript: normalizeNarrationTakeTranscript(interimSegments.map((segment) => segment.transcript).join(" ")),
    changedTranscript: normalizeNarrationTakeTranscript(
      segments
        .filter((segment) => segment.index >= safeResultIndex)
        .map((segment) => segment.transcript)
        .join(" "),
    ),
    segmentCount: segments.length,
    finalSegmentCount: finalSegments.length,
    interimSegmentCount: interimSegments.length,
    resultIndex: safeResultIndex,
  };
}

function resolveSelectionLineNumber(selection) {
  const displayLineNumber = Number(selection?.displayLineNumber);
  if (Number.isInteger(displayLineNumber) && displayLineNumber > 0) {
    return displayLineNumber;
  }

  const lineNumber = Number(selection?.lineNumber);
  return Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null;
}

function formatListeningStatus(runtime) {
  const lineNumber = resolveSelectionLineNumber(runtime?.selection);
  return lineNumber
    ? `Speech tracker listening at line ${lineNumber}`
    : "Speech tracker listening";
}

function formatSpeechPausedStatus(runtime) {
  const followLineNumber = resolveSelectionLineNumber(runtime?.followSelection);
  if (followLineNumber) {
    return `Speech paused; last match line ${followLineNumber}`;
  }

  return "Speech paused; waiting for transcript";
}

function shouldRestartRecognition(runtime, recordingId) {
  const status = normalizeNarrationTakeStatusText(runtime?.trackerStatus);
  return runtime?.recordingId === recordingId
    && runtime.mediaRecorder?.state === "recording"
    && !status.startsWith("Finalizing narration take");
}

function emitSpeechRecognitionDebug(logger, event, message, context = {}) {
  if (
    !logger ||
    typeof logger.debug !== "function" ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  logger.debug("speech-recognition", event, message, context);
}

export function createNarrationSpeechRecognition(recordingId, {
  recognitionConstructor = null,
  getRuntime = () => null,
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  resolveFollowMatch = () => null,
  language = "en-US",
  logger = null,
} = {}) {
  const Recognition = recognitionConstructor;
  if (!Recognition) {
    return null;
  }

  const isActiveRuntime = () => getRuntime()?.recordingId === recordingId;
  const patchActiveRuntime = (patch) => {
    if (!isActiveRuntime()) {
      return false;
    }
    applyRuntimePatch(recordingId, patch);
    refreshSession();
    return true;
  };

  // Intent: keep Web Speech API setup replaceable while preserving narration tracker semantics.
  try {
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language;
    recognition.onstart = () => {
      patchActiveRuntime({
        trackerStatus: formatListeningStatus(getRuntime()),
      });
    };
    recognition.onaudiostart = () => {
      patchActiveRuntime({
        trackerStatus: "Microphone audio detected",
      });
    };
    recognition.onspeechstart = () => {
      patchActiveRuntime({
        trackerStatus: "Speech detected; matching manuscript...",
      });
    };
    recognition.onspeechend = () => {
      patchActiveRuntime({
        trackerStatus: formatSpeechPausedStatus(getRuntime()),
      });
    };
    recognition.onnomatch = () => {
      patchActiveRuntime({
        trackerStatus: "Speech heard; no manuscript match yet",
      });
    };
    recognition.onresult = (event) => {
      const rawSpeechSnapshot = createNarrationSpeechRecognitionTranscriptSnapshot(event?.results, {
        resultIndex: event?.resultIndex,
      });
      const speechSnapshot = applyNarrationFollowTranscriptWindowToSnapshot(rawSpeechSnapshot);
      const transcript = speechSnapshot.transcript;
      const runtime = getRuntime();
      const follow = typeof resolveFollowMatch === "function"
        ? resolveFollowMatch({ recordingId, transcript, runtime, speechSnapshot })
        : null;
      emitSpeechRecognitionDebug(
        logger,
        "narration-follow.speech-result",
        "Received browser speech-recognition transcript snapshot.",
        {
          recordingId,
          resultIndex: speechSnapshot.resultIndex,
          segmentCount: speechSnapshot.segmentCount,
          finalSegmentCount: speechSnapshot.finalSegmentCount,
          interimSegmentCount: speechSnapshot.interimSegmentCount,
          transcriptLength: transcript.length,
          changedTranscriptLength: speechSnapshot.changedTranscript.length,
          sourceTranscriptWordCount: speechSnapshot.transcriptWindow?.sourceTranscriptWordCount ?? 0,
          transcriptWindowWordCount: speechSnapshot.transcriptWindow?.transcriptWindowWordCount ?? 0,
          transcriptWindowed: speechSnapshot.transcriptWindow?.isTranscriptWindowed === true,
          followStatus: follow?.status ?? "",
          matchedBlockId: follow?.followSelection?.blockId ?? "",
          confidence: follow?.followSelection?.confidence ?? null,
        },
      );
      patchActiveRuntime({
        transcript,
        liveTranscript: transcript,
        liveChangedTranscript: speechSnapshot.changedTranscript,
        liveTranscriptUpdatedAt: speechSnapshot.receivedAt,
        speechSnapshot,
        trackerStatus: follow?.trackerStatus || (transcript ? "Speech tracker active" : formatListeningStatus(runtime)),
        followSelection: follow?.followSelection ?? runtime?.followSelection ?? null,
        followMatch: follow?.match ?? runtime?.followMatch ?? null,
      });
    };
    recognition.onerror = (event) => {
      emitSpeechRecognitionDebug(
        logger,
        "narration-follow.speech-error",
        "Browser speech-recognition emitted an error.",
        {
          recordingId,
          error: normalizeNarrationTakeStatusText(event?.error) || "error",
        },
      );
      patchActiveRuntime({
        trackerStatus: `Speech tracker ${normalizeNarrationTakeStatusText(event?.error) || "error"}`,
      });
    };
    recognition.onend = () => {
      const runtime = getRuntime();
      if (runtime?.recordingId !== recordingId) {
        return;
      }

      if (shouldRestartRecognition(runtime, recordingId) && typeof recognition.start === "function") {
        try {
          recognition.start();
          emitSpeechRecognitionDebug(
            logger,
            "narration-follow.speech-restart",
            "Restarted browser speech-recognition while recording continued.",
            { recordingId },
          );
          patchActiveRuntime({
            trackerStatus: formatListeningStatus(runtime),
          });
          return;
        } catch {
          // Browser speech recognition can reject immediate restarts; leave the take anchored.
        }
      }

      patchActiveRuntime({
        trackerStatus: "Speech tracker paused",
      });
    };
    return recognition;
  } catch {
    return null;
  }
}

export function createNarrationSpeechRecognitionService({
  recognitionConstructor = null,
  getRuntime = () => null,
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  resolveFollowMatch = () => null,
  language = "en-US",
  logger = null,
} = {}) {
  return {
    createRecognition(recordingId) {
      return createNarrationSpeechRecognition(recordingId, {
        recognitionConstructor,
        getRuntime,
        applyRuntimePatch,
        refreshSession,
        resolveFollowMatch,
        language,
        logger,
      });
    },
  };
}
