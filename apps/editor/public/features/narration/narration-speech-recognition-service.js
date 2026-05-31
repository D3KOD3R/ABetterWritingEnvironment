// Intent: own narration speech-recognition event handling outside the editor shell.

import {
  normalizeNarrationTakeStatusText,
  normalizeNarrationTakeTranscript,
} from "./narration-take-service.js";

function collectSpeechRecognitionTranscript(results) {
  if (!results) {
    return "";
  }

  return normalizeNarrationTakeTranscript(
    Array.from(results)
      .map((result) => result?.[0]?.transcript ?? "")
      .join(" "),
  );
}

export function createNarrationSpeechRecognition(recordingId, {
  recognitionConstructor = null,
  getRuntime = () => null,
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  language = "en-US",
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
    recognition.onresult = (event) => {
      const transcript = collectSpeechRecognitionTranscript(event?.results);
      patchActiveRuntime({
        transcript,
        trackerStatus: transcript ? "Speech tracker active" : "Speech tracker listening",
      });
    };
    recognition.onerror = (event) => {
      patchActiveRuntime({
        trackerStatus: `Speech tracker ${normalizeNarrationTakeStatusText(event?.error) || "error"}`,
      });
    };
    recognition.onend = () => {
      const runtime = getRuntime();
      if (runtime?.recordingId !== recordingId || runtime.mediaRecorder?.state !== "recording") {
        return;
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
  language = "en-US",
} = {}) {
  return {
    createRecognition(recordingId) {
      return createNarrationSpeechRecognition(recordingId, {
        recognitionConstructor,
        getRuntime,
        applyRuntimePatch,
        refreshSession,
        language,
      });
    },
  };
}
