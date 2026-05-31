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

    const speechRecognition = createRecognition(recordingId);
    if (speechRecognition) {
      setRuntime({
        ...getRuntime(),
        speechRecognition,
        trackerStatus: "Speech tracker active",
      });
      try {
        speechRecognition.start();
      } catch {
        setRuntime({
          ...getRuntime(),
          speechRecognition: null,
          trackerStatus: "Speech tracker unavailable; verse anchored.",
        });
      }
    } else {
      setRuntime({
        ...getRuntime(),
        trackerStatus: "Speech tracker unavailable; verse anchored.",
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
    if (!runtime?.mediaRecorder || runtime.mediaRecorder.state !== "recording") {
      return;
    }

    setRuntime({
      ...runtime,
      trackerStatus: "Finalizing narration take...",
    });
    updateSessionFromRuntime();

    try {
      getRuntime().mediaRecorder.stop();
    } catch (error) {
      await finalizeRecording(getRuntime().recordingId, error);
    }
  }

  return {
    startRecording,
    stopRecording,
  };
}
