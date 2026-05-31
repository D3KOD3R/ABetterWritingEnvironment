// Intent: own MediaRecorder construction and event handling outside the editor shell.

function isNonEmptyBlob(value, blobConstructor = globalThis.Blob) {
  if (!value || typeof value.size !== "number" || value.size <= 0) {
    return false;
  }

  return typeof blobConstructor === "function"
    ? value instanceof blobConstructor
    : typeof value.arrayBuffer === "function";
}

export function createNarrationMediaRecorder(recordingId, stream, {
  mediaMimeType = "",
  mediaRecorderConstructor = globalThis.MediaRecorder,
  blobConstructor = globalThis.Blob,
  getRuntime = () => null,
  appendChunk = () => {},
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  finalizeRecording = () => {},
} = {}) {
  if (!mediaRecorderConstructor) {
    throw new Error("MediaRecorder is not available in this browser.");
  }

  const recorder = mediaMimeType
    ? new mediaRecorderConstructor(stream, { mimeType: mediaMimeType })
    : new mediaRecorderConstructor(stream);

  const isActiveRuntime = () => getRuntime()?.recordingId === recordingId;

  // Intent: keep recorder events deterministic and independent from shell state shape.
  recorder.ondataavailable = (event) => {
    if (!isActiveRuntime()) {
      return;
    }

    if (isNonEmptyBlob(event?.data, blobConstructor)) {
      appendChunk(recordingId, event.data);
    }
  };
  recorder.onerror = () => {
    if (!isActiveRuntime()) {
      return;
    }

    applyRuntimePatch(recordingId, {
      trackerStatus: "Recorder error",
    });
    refreshSession();
  };
  recorder.onstop = () => {
    finalizeRecording(recordingId);
  };

  return recorder;
}

export function createNarrationMediaRecorderService({
  mediaRecorderConstructor = globalThis.MediaRecorder,
  blobConstructor = globalThis.Blob,
  getRuntime = () => null,
  appendChunk = () => {},
  applyRuntimePatch = () => {},
  refreshSession = () => {},
  finalizeRecording = () => {},
} = {}) {
  return {
    createRecorder(recordingId, stream, options = {}) {
      return createNarrationMediaRecorder(recordingId, stream, {
        ...options,
        mediaRecorderConstructor,
        blobConstructor,
        getRuntime,
        appendChunk,
        applyRuntimePatch,
        refreshSession,
        finalizeRecording,
      });
    },
  };
}
