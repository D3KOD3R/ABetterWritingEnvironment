// Intent: own narration recording start/stop command sequencing outside the editor shell.

import {
  createNarrationRecordingId,
  createNarrationRecordingInitialSessionOptions,
  createNarrationRecordingRuntime,
  createNarrationTakeSession,
  getSupportedNarrationRecordingMimeType,
} from "./narration-take-service.js";

function createPausedNarrationSession(selection, trackerStatus, {
  clone = null,
} = {}) {
  return createNarrationTakeSession(selection, {
    status: "paused",
    trackerStatus,
  }, {
    clone,
  });
}

function getNarrationDisplayLineNumber(selection) {
  const displayLineNumber = Number(selection?.displayLineNumber);
  if (Number.isInteger(displayLineNumber) && displayLineNumber > 0) {
    return displayLineNumber;
  }

  const lineNumber = Number(selection?.lineNumber);
  return Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null;
}

function formatNarrationTrackerListeningStatus(selection) {
  const lineNumber = getNarrationDisplayLineNumber(selection);
  return lineNumber
    ? `Speech tracker listening at line ${lineNumber}`
    : "Speech tracker listening";
}

function formatNarrationTrackerUnavailableStatus(selection) {
  const lineNumber = getNarrationDisplayLineNumber(selection);
  return lineNumber
    ? `Speech tracker unavailable; verse anchored at line ${lineNumber}.`
    : "Speech tracker unavailable; verse anchored.";
}

function normalizeSpeechProviderText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function createSpeechProviderRuntimePatch(speechRecognition) {
  return {
    speechProviderId: normalizeSpeechProviderText(speechRecognition?.providerId),
    speechProviderLabel: normalizeSpeechProviderText(speechRecognition?.providerLabel),
    speechProviderKind: normalizeSpeechProviderText(speechRecognition?.providerKind),
  };
}

export function createNarrationRecordingCommandService({
  getRuntime,
  setRuntime,
  resolveSelection,
  getProjectId,
  setSession,
  createTimer,
  getUserMedia,
  hasMicrophoneCapture,
  hasMediaRecorder,
  mediaRecorderConstructor,
  createRecorder,
  createRecognition,
  updateSessionFromRuntime,
  abortStart,
  finalizeRecording,
  clone = null,
  nowMs = () => Date.now(),
} = {}) {
  const requiredFunctions = {
    getRuntime,
    setRuntime,
    resolveSelection,
    getProjectId,
    setSession,
    createTimer,
    getUserMedia,
    hasMicrophoneCapture,
    hasMediaRecorder,
    createRecorder,
    createRecognition,
    updateSessionFromRuntime,
    abortStart,
    finalizeRecording,
    nowMs,
  };

  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`NarrationRecordingCommandService requires ${name}.`);
    }
  }

  // Intent: sequence browser recording setup while keeping UI/session rendering callback-driven.
  async function startRecording(sceneId = null) {
    if (getRuntime()) {
      return;
    }

    const { scene = null, selection = null } = resolveSelection(sceneId) ?? {};
    if (!scene || !selection) {
      setSession(createPausedNarrationSession(selection, "Select a verse before starting a narration take.", {
        clone,
      }));
      return;
    }

    if (!hasMicrophoneCapture()) {
      setSession(createPausedNarrationSession(selection, "Microphone capture is not available in this browser.", {
        clone,
      }));
      return;
    }

    if (!hasMediaRecorder()) {
      setSession(createPausedNarrationSession(selection, "MediaRecorder is not available in this browser.", {
        clone,
      }));
      return;
    }

    const projectId = getProjectId();
    const startedAtMs = nowMs();
    const recordingId = createNarrationRecordingId(selection, {
      nowMs: startedAtMs,
    });
    const mediaMimeType = getSupportedNarrationRecordingMimeType({
      mediaRecorder: mediaRecorderConstructor,
    });
    const runtime = createNarrationRecordingRuntime(selection, {
      recordingId,
      projectId,
      mediaMimeType,
      timerId: createTimer(),
      nowMs: startedAtMs,
      clone,
    });
    setRuntime(runtime);
    setSession(createNarrationTakeSession(
      selection,
      createNarrationRecordingInitialSessionOptions(runtime),
      { clone },
    ));

    let stream;
    try {
      stream = await getUserMedia({ audio: true });
    } catch (error) {
      await abortStart(selection, error);
      return;
    }

    if (!getRuntime() || getRuntime().recordingId !== recordingId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    setRuntime({
      ...getRuntime(),
      stream,
    });

    let recorder;
    try {
      recorder = createRecorder(recordingId, stream, {
        mediaMimeType,
      });
    } catch (error) {
      await abortStart(selection, error, stream);
      return;
    }

    setRuntime({
      ...getRuntime(),
      mediaRecorder: recorder,
    });

    const speechRecognition = await createRecognition(recordingId, {
      projectId,
      selection,
      stream,
      mediaMimeType,
    });
    if (speechRecognition) {
      setRuntime({
        ...getRuntime(),
        speechRecognition,
        ...createSpeechProviderRuntimePatch(speechRecognition),
        trackerStatus: formatNarrationTrackerListeningStatus(selection),
      });
      try {
        speechRecognition.start();
      } catch {
        setRuntime({
          ...getRuntime(),
          speechRecognition: null,
          speechProviderId: "",
          speechProviderLabel: "",
          speechProviderKind: "",
          trackerStatus: formatNarrationTrackerUnavailableStatus(selection),
        });
      }
    } else {
      setRuntime({
        ...getRuntime(),
        trackerStatus: formatNarrationTrackerUnavailableStatus(selection),
      });
    }

    updateSessionFromRuntime({
      status: "recording",
      trackerStatus: getRuntime()?.trackerStatus,
    });

    try {
      recorder.start(1000);
    } catch (error) {
      await abortStart(selection, error, stream);
    }
  }

  // Intent: centralize stop eligibility and fallback finalization for active recordings.
  async function stopRecording() {
    const runtime = getRuntime();
    if (runtime?.isStopping) {
      return;
    }

    if (!runtime?.mediaRecorder || runtime.mediaRecorder.state !== "recording") {
      return;
    }

    const stoppingRuntime = {
      ...runtime,
      trackerStatus: "Saving narration take...",
      isStopping: true,
    };
    setRuntime(stoppingRuntime);
    updateSessionFromRuntime({
      status: "finalizing",
      trackerStatus: stoppingRuntime.trackerStatus,
    });

    try {
      stoppingRuntime.mediaRecorder.stop();
    } catch (error) {
      await finalizeRecording(stoppingRuntime.recordingId, error);
    }
  }

  return {
    startRecording,
    stopRecording,
  };
}
