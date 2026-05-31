// Intent: own browser narration recorder runtime cleanup outside the editor shell.

function stopSpeechRecognition(speechRecognition, {
  clearHandlers = true,
} = {}) {
  if (!speechRecognition) {
    return false;
  }

  try {
    if (clearHandlers) {
      speechRecognition.onresult = null;
      speechRecognition.onerror = null;
      speechRecognition.onend = null;
    }
    speechRecognition.stop();
    return true;
  } catch {
    return false;
  }
}

function stopMediaStream(stream) {
  if (!stream || typeof stream.getTracks !== "function") {
    return 0;
  }

  const tracks = stream.getTracks();
  if (!Array.isArray(tracks)) {
    return 0;
  }

  let stoppedTracks = 0;
  for (const track of tracks) {
    if (!track || typeof track.stop !== "function") {
      continue;
    }
    try {
      track.stop();
      stoppedTracks += 1;
    } catch {
      // Ignore track cleanup failures during recorder teardown.
    }
  }
  return stoppedTracks;
}

export function cleanupNarrationRecordingRuntime(runtime, {
  additionalStream = null,
  clearIntervalFn = clearInterval,
  clearSpeechHandlers = true,
} = {}) {
  const result = {
    clearedTimer: false,
    stoppedSpeechRecognition: false,
    stoppedTracks: 0,
  };

  // Intent: release timer, speech, and media-stream resources as one recorder lifecycle boundary.
  if (runtime?.timerId !== null && runtime?.timerId !== undefined && typeof clearIntervalFn === "function") {
    clearIntervalFn(runtime.timerId);
    result.clearedTimer = true;
  }

  result.stoppedSpeechRecognition = stopSpeechRecognition(runtime?.speechRecognition, {
    clearHandlers: clearSpeechHandlers,
  });

  result.stoppedTracks += stopMediaStream(runtime?.stream);
  if (additionalStream && additionalStream !== runtime?.stream) {
    result.stoppedTracks += stopMediaStream(additionalStream);
  }

  return result;
}

export function createNarrationRecordingRuntimeService({
  clearIntervalFn = clearInterval,
} = {}) {
  return {
    cleanupRuntime(runtime, options = {}) {
      return cleanupNarrationRecordingRuntime(runtime, {
        ...options,
        clearIntervalFn,
      });
    },
  };
}
