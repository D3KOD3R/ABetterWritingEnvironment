// Intent: own browser audio/object-url lifecycle for saved voice recording previews.

export function createVoiceRecordingPreviewController({
  createObjectUrl,
  revokeObjectUrl,
  createAudio,
  onPlaybackStateChange = null,
  reportLog = null,
} = {}) {
  if (typeof createObjectUrl !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires createObjectUrl.");
  }
  if (typeof revokeObjectUrl !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires revokeObjectUrl.");
  }
  if (typeof createAudio !== "function") {
    throw new TypeError("createVoiceRecordingPreviewController requires createAudio.");
  }

  let previewAudio = null;
  let previewUrl = null;
  let playbackState = createIdlePlaybackState();
  let playbackSequence = 0;
  let pendingSeekRetryTimer = null;

  function emitPreviewLog(level, event, message, context = {}) {
    if (typeof reportLog !== "function") {
      return;
    }

    try {
      reportLog(level, "voice-recording-preview", message, {
        event,
        ...context,
      });
    } catch {
      // Logging must never break audio cleanup or playback.
    }
  }

  function notifyPlaybackState(eventType) {
    const snapshot = { ...playbackState };
    if (typeof onPlaybackStateChange === "function") {
      onPlaybackStateChange(snapshot, eventType);
    }
    return snapshot;
  }

  function setPlaybackState(patch, eventType = "state-change") {
    playbackState = normalizePlaybackState({
      ...playbackState,
      ...(patch && typeof patch === "object" ? patch : {}),
    });
    return notifyPlaybackState(eventType);
  }

  function readActiveAudioTime(fallbackState = playbackState) {
    return readAudioTime(previewAudio, fallbackState);
  }

  function readActiveAudioDuration(fallbackState = playbackState) {
    return readAudioDuration(previewAudio, fallbackState);
  }

  // Intent: cancel deferred seek retries whenever the active audio object changes.
  function clearPendingSeekRetry() {
    if (!pendingSeekRetryTimer) {
      return;
    }

    clearTimeout(pendingSeekRetryTimer);
    pendingSeekRetryTimer = null;
  }

  // Intent: detach a browser media element from its source so Stop halts buffered playback as well as UI state.
  function detachAudioSource(audio) {
    if (!audio) {
      return false;
    }

    let detached = false;
    try {
      if (typeof audio.removeAttribute === "function") {
        audio.removeAttribute("src");
        detached = true;
      } else if ("src" in audio) {
        audio.src = "";
        detached = true;
      }

      if (
        typeof HTMLMediaElement !== "undefined" &&
        audio instanceof HTMLMediaElement &&
        typeof audio.load === "function"
      ) {
        audio.load();
      }
    } catch {
      detached = false;
    }

    return detached;
  }

  // Intent: release browser media resources while retaining the last playhead for review UI.
  function releasePreviewAudio({
    eventType = "release",
    recordingId = playbackState.recordingId,
  } = {}) {
    clearPendingSeekRetry();

    const releasedAudio = previewAudio;
    const releasedUrl = previewUrl;
    const audioBefore = createAudioSnapshot(releasedAudio);
    let pauseSucceeded = false;
    let detachSucceeded = false;

    if (releasedAudio) {
      releasedAudio.onended = null;
      releasedAudio.onerror = null;
      releasedAudio.ontimeupdate = null;
      releasedAudio.onloadedmetadata = null;
      try {
        releasedAudio.pause();
        pauseSucceeded = true;
      } catch {
        pauseSucceeded = false;
      }
      detachSucceeded = detachAudioSource(releasedAudio);
      previewAudio = null;
    }

    if (releasedUrl) {
      revokeObjectUrl(releasedUrl);
      previewUrl = null;
    }

    if (releasedAudio || releasedUrl) {
      emitPreviewLog("info", "release", "Released saved take preview audio.", {
        recordingId,
        eventType,
        playbackSequence,
        pauseSucceeded,
        detachSucceeded,
        hadObjectUrl: Boolean(releasedUrl),
        audioBefore,
      });
    }
  }

  function clearPreview({
    status = "stopped",
    eventType = status,
  } = {}) {
    const previousState = playbackState;
    const currentTimeSeconds = readActiveAudioTime(previousState);
    const durationSeconds = readActiveAudioDuration(previousState);
    playbackSequence += 1;
    releasePreviewAudio({
      eventType,
      recordingId: previousState.recordingId,
    });
    const nextState = setPlaybackState({
      currentTimeSeconds,
      durationSeconds,
      status,
      active: false,
    }, eventType);
    emitPreviewLog("info", "clear", "Cleared saved take preview playback.", {
      eventType,
      status,
      playbackSequence,
      recordingId: nextState.recordingId,
      currentTimeSeconds: nextState.currentTimeSeconds,
      durationSeconds: nextState.durationSeconds,
    });
    return nextState;
  }

  async function playBlob(blob, {
    recordingId = "",
    startTimeSeconds = 0,
  } = {}) {
    clearPreview({ status: "stopped", eventType: "replace" });

    const playToken = playbackSequence + 1;
    playbackSequence = playToken;
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    const normalizedStartTimeSeconds = normalizeNonNegativeNumber(startTimeSeconds);
    const url = createObjectUrl(blob);
    const audio = createAudio(url);
    previewUrl = url;
    previewAudio = audio;
    previewAudio.preload = "auto";
    let startTimeApplied = normalizedStartTimeSeconds <= 0;
    let metadataWaitResolve = null;
    let metadataWaitTimer = null;

    function isActivePlayback() {
      return playbackSequence === playToken && previewAudio === audio;
    }

    function createStalePlaybackResult(event, message, context = {}) {
      resolveMetadataWait();
      emitPreviewLog("info", event, message, {
        recordingId: normalizedRecordingId,
        requestedStartTimeSeconds: normalizedStartTimeSeconds,
        playToken,
        activePlaybackSequence: playbackSequence,
        audioSnapshot: createAudioSnapshot(audio),
        ...context,
      });
      return {
        audio: null,
        url: null,
        playbackState: { ...playbackState },
        stale: true,
      };
    }

    // Intent: apply requested review/word seek times after metadata because blob audio can ignore early currentTime writes.
    function applyRequestedStartTime() {
      if (!isActivePlayback() || normalizedStartTimeSeconds <= 0) {
        startTimeApplied = normalizedStartTimeSeconds <= 0;
        return startTimeApplied;
      }

      const seekResult = applyAudioSeek(audio, normalizedStartTimeSeconds, {
        event: "start-time",
        recordingId: normalizedRecordingId,
        playToken,
        reportLog: emitPreviewLog,
      });
      startTimeApplied = seekResult.accepted;
      return startTimeApplied;
    }

    function resolveMetadataWait() {
      if (metadataWaitTimer) {
        clearTimeout(metadataWaitTimer);
        metadataWaitTimer = null;
      }
      if (typeof metadataWaitResolve === "function") {
        metadataWaitResolve();
        metadataWaitResolve = null;
      }
    }

    function waitForMetadataBeforePlayback() {
      if (!isActivePlayback() || normalizedStartTimeSeconds <= 0 || startTimeApplied) {
        return Promise.resolve();
      }

      const readyState = Number(audio.readyState);
      const durationSeconds = Number(audio.duration);
      if (readyState > 0 || (Number.isFinite(durationSeconds) && durationSeconds > 0)) {
        applyRequestedStartTime();
        return Promise.resolve();
      }

      emitPreviewLog("info", "metadata-wait", "Waiting briefly for saved take metadata before playback seek.", {
        recordingId: normalizedRecordingId,
        requestedStartTimeSeconds: normalizedStartTimeSeconds,
        playToken,
        audioSnapshot: createAudioSnapshot(audio),
      });
      return new Promise((resolve) => {
        metadataWaitResolve = resolve;
        metadataWaitTimer = setTimeout(resolveMetadataWait, 250);
      });
    }

    emitPreviewLog("info", "play-requested", "Saved take preview playback requested.", {
      recordingId: normalizedRecordingId,
      requestedStartTimeSeconds: normalizedStartTimeSeconds,
      playToken,
      blobSize: Number(blob?.size) || 0,
      audioSnapshot: createAudioSnapshot(audio),
    });
    setPlaybackState({
      recordingId: normalizedRecordingId,
      currentTimeSeconds: normalizedStartTimeSeconds,
      durationSeconds: 0,
      status: "loading",
      active: true,
    }, "loading");

    audio.onloadedmetadata = () => {
      if (!isActivePlayback()) {
        emitPreviewLog("debug", "metadata-stale", "Ignored stale saved take metadata event.", {
          recordingId: normalizedRecordingId,
          playToken,
          activePlaybackSequence: playbackSequence,
          audioSnapshot: createAudioSnapshot(audio),
        });
        return;
      }

      const durationSeconds = readAudioDuration(audio, playbackState);
      const appliedStartTime = applyRequestedStartTime();
      setPlaybackState({
        currentTimeSeconds: appliedStartTime
          ? readAudioTime(audio, playbackState)
          : playbackState.currentTimeSeconds,
        durationSeconds,
      }, "metadata");
      resolveMetadataWait();
    };
    audio.ontimeupdate = () => {
      if (!isActivePlayback()) {
        return;
      }
      if (playbackState.status === "paused") {
        return;
      }

      setPlaybackState({
        currentTimeSeconds: readAudioTime(audio, playbackState),
        durationSeconds: readAudioDuration(audio, playbackState),
        status: "playing",
        active: true,
      }, "timeupdate");
    };
    audio.onended = () => {
      if (!isActivePlayback()) {
        return;
      }

      const durationSeconds = readAudioDuration(audio, playbackState);
      clearPreview({
        status: "ended",
        eventType: "ended",
      });
      setPlaybackState({
        currentTimeSeconds: durationSeconds || playbackState.currentTimeSeconds,
        durationSeconds,
        status: "ended",
        active: false,
      }, "ended");
    };
    audio.onerror = () => {
      if (!isActivePlayback()) {
        return;
      }

      resolveMetadataWait();
      clearPreview({
        status: "error",
        eventType: "error",
      });
    };

    if (normalizedStartTimeSeconds > 0) {
      applyRequestedStartTime();
      if (typeof audio.load === "function") {
        try {
          audio.load();
        } catch {
          // Browsers may auto-load blob audio; the normal play path can continue.
        }
      }
      await waitForMetadataBeforePlayback();
      if (!isActivePlayback()) {
        return createStalePlaybackResult(
          "play-aborted-before-media-play",
          "Saved take preview playback was stopped before audio.play().",
        );
      }
      try {
        applyRequestedStartTime();
      } catch {
        // Some browsers reject early seeks before metadata; loadedmetadata keeps duration in sync.
      }
    }

    if (!isActivePlayback()) {
      return createStalePlaybackResult(
        "play-aborted-before-media-play",
        "Saved take preview playback was replaced before audio.play().",
      );
    }

    try {
      await audio.play();
    } catch (error) {
      if (!isActivePlayback()) {
        return createStalePlaybackResult(
          "play-rejected-after-stop",
          "Saved take preview play promise rejected after playback was stopped.",
          { error },
        );
      }

      clearPreview({
        status: "error",
        eventType: "error",
      });
      throw error;
    }

    if (!isActivePlayback()) {
      return createStalePlaybackResult(
        "play-resolved-after-stop",
        "Saved take preview play promise resolved after playback was stopped.",
      );
    }

    if (playbackState.status === "paused") {
      try {
        audio.pause();
      } catch {
        // The paused state already represents the user intent; media pause failure is logged by pausePreview.
      }
      emitPreviewLog("info", "play-resolved-after-pause", "Saved take preview play promise resolved after the user paused playback.", {
        recordingId: normalizedRecordingId,
        requestedStartTimeSeconds: normalizedStartTimeSeconds,
        playToken,
        audioSnapshot: createAudioSnapshot(audio),
      });
      return {
        audio,
        url,
        playbackState: { ...playbackState },
        paused: true,
      };
    }

    if (normalizedStartTimeSeconds > 0 && !startTimeApplied) {
      const appliedAfterPlay = applyRequestedStartTime();
      if (!appliedAfterPlay) {
        scheduleSeekRetry(audio, normalizedStartTimeSeconds, {
          recordingId: normalizedRecordingId,
          playToken,
        });
      }
    }

    setPlaybackState({
      currentTimeSeconds: readAudioTime(audio, playbackState),
      durationSeconds: readAudioDuration(audio, playbackState),
      status: "playing",
      active: true,
    }, "playing");
    emitPreviewLog("info", "playing", "Saved take preview is playing.", {
      recordingId: normalizedRecordingId,
      requestedStartTimeSeconds: normalizedStartTimeSeconds,
      playToken,
      audioSnapshot: createAudioSnapshot(audio),
    });

    return {
      audio,
      url,
      playbackState: { ...playbackState },
    };
  }

  function stopPreview() {
    emitPreviewLog("info", "stop-requested", "Saved take preview stop requested.", {
      recordingId: playbackState.recordingId,
      playbackSequence,
      playbackState: { ...playbackState },
      audioSnapshot: createAudioSnapshot(previewAudio),
    });
    return clearPreview({
      status: "stopped",
      eventType: "stopped",
    });
  }

  function pausePreview({
    recordingId = "",
  } = {}) {
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    if (normalizedRecordingId && playbackState.recordingId && normalizedRecordingId !== playbackState.recordingId) {
      emitPreviewLog("warn", "pause-recording-mismatch", "Ignored saved take pause for a different active recording.", {
        requestedRecordingId: normalizedRecordingId,
        activeRecordingId: playbackState.recordingId,
        playbackState: { ...playbackState },
      });
      return { ...playbackState };
    }

    if (!previewAudio || !["loading", "playing"].includes(playbackState.status)) {
      return { ...playbackState };
    }

    clearPendingSeekRetry();
    let pauseSucceeded = false;
    try {
      previewAudio.pause();
      pauseSucceeded = true;
    } catch {
      pauseSucceeded = false;
    }

    const nextState = setPlaybackState({
      currentTimeSeconds: readActiveAudioTime(playbackState),
      durationSeconds: readActiveAudioDuration(playbackState),
      status: "paused",
      active: false,
    }, "paused");
    emitPreviewLog("info", "paused", "Saved take preview paused.", {
      recordingId: nextState.recordingId,
      playbackSequence,
      pauseSucceeded,
      audioSnapshot: createAudioSnapshot(previewAudio),
    });
    return nextState;
  }

  async function resumePreview({
    recordingId = "",
  } = {}) {
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    if (normalizedRecordingId && playbackState.recordingId && normalizedRecordingId !== playbackState.recordingId) {
      emitPreviewLog("warn", "resume-recording-mismatch", "Ignored saved take resume for a different active recording.", {
        requestedRecordingId: normalizedRecordingId,
        activeRecordingId: playbackState.recordingId,
        playbackState: { ...playbackState },
      });
      return { ...playbackState };
    }

    if (!previewAudio || playbackState.status !== "paused") {
      return { ...playbackState };
    }

    const audio = previewAudio;
    const resumeToken = playbackSequence;
    setPlaybackState({
      currentTimeSeconds: readAudioTime(audio, playbackState),
      durationSeconds: readAudioDuration(audio, playbackState),
      status: "loading",
      active: true,
    }, "resume-loading");

    try {
      await audio.play();
    } catch (error) {
      if (previewAudio !== audio || playbackSequence !== resumeToken) {
        return {
          ...playbackState,
          stale: true,
        };
      }

      setPlaybackState({
        currentTimeSeconds: readAudioTime(audio, playbackState),
        durationSeconds: readAudioDuration(audio, playbackState),
        status: "error",
        active: false,
      }, "error");
      throw error;
    }

    if (previewAudio !== audio || playbackSequence !== resumeToken) {
      emitPreviewLog("info", "resume-stale", "Saved take preview resume resolved after playback changed.", {
        recordingId: normalizedRecordingId || playbackState.recordingId,
        resumeToken,
        activePlaybackSequence: playbackSequence,
      });
      return {
        ...playbackState,
        stale: true,
      };
    }

    const nextState = setPlaybackState({
      currentTimeSeconds: readAudioTime(audio, playbackState),
      durationSeconds: readAudioDuration(audio, playbackState),
      status: "playing",
      active: true,
    }, "resumed");
    emitPreviewLog("info", "resumed", "Saved take preview resumed.", {
      recordingId: nextState.recordingId,
      playbackSequence,
      audioSnapshot: createAudioSnapshot(audio),
    });
    return nextState;
  }

  function seekPreview(seconds, {
    recordingId = "",
  } = {}) {
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    if (normalizedRecordingId && playbackState.recordingId && normalizedRecordingId !== playbackState.recordingId) {
      emitPreviewLog("warn", "seek-recording-mismatch", "Ignored saved take seek for a different active recording.", {
        requestedRecordingId: normalizedRecordingId,
        activeRecordingId: playbackState.recordingId,
        requestedTimeSeconds: normalizeNonNegativeNumber(seconds),
        playbackState: { ...playbackState },
      });
      return { ...playbackState };
    }

    const durationSeconds = readActiveAudioDuration(playbackState);
    const nextTimeSeconds = clampPlaybackTime(seconds, durationSeconds);
    const activeAudio = previewAudio;
    const activeSequence = playbackSequence;
    let seekResult = null;
    emitPreviewLog("info", "seek-requested", "Saved take preview seek requested.", {
      recordingId: normalizedRecordingId || playbackState.recordingId,
      requestedTimeSeconds: normalizeNonNegativeNumber(seconds),
      nextTimeSeconds,
      durationSeconds,
      playbackSequence,
      audioSnapshot: createAudioSnapshot(activeAudio),
    });

    if (activeAudio) {
      seekResult = applyAudioSeek(activeAudio, nextTimeSeconds, {
        event: "seek",
        recordingId: normalizedRecordingId || playbackState.recordingId,
        playToken: activeSequence,
        reportLog: emitPreviewLog,
      });
      if (!seekResult.accepted) {
        scheduleSeekRetry(activeAudio, nextTimeSeconds, {
          recordingId: normalizedRecordingId || playbackState.recordingId,
          playToken: activeSequence,
        });
      }
    }

    return setPlaybackState({
      currentTimeSeconds: seekResult?.accepted
        ? seekResult.actualTimeSeconds
        : nextTimeSeconds,
      durationSeconds,
    }, "seek");
  }

  // Intent: retry delayed media seeks shortly after the browser accepts metadata/currentTime changes.
  function scheduleSeekRetry(audio, nextTimeSeconds, {
    recordingId = "",
    playToken = playbackSequence,
  } = {}) {
    clearPendingSeekRetry();
    pendingSeekRetryTimer = setTimeout(() => {
      pendingSeekRetryTimer = null;
      if (previewAudio !== audio || playbackSequence !== playToken) {
        emitPreviewLog("debug", "seek-retry-stale", "Ignored stale saved take seek retry.", {
          recordingId,
          requestedTimeSeconds: nextTimeSeconds,
          playToken,
          activePlaybackSequence: playbackSequence,
        });
        return;
      }

      const seekResult = applyAudioSeek(audio, nextTimeSeconds, {
        event: "seek-retry",
        recordingId,
        playToken,
        reportLog: emitPreviewLog,
      });
      setPlaybackState({
        currentTimeSeconds: seekResult.accepted
          ? seekResult.actualTimeSeconds
          : nextTimeSeconds,
        durationSeconds: readAudioDuration(audio, playbackState),
      }, "seek-retry");
    }, 75);
  }

  return {
    playBlob,
    pausePreview,
    resumePreview,
    stopPreview,
    seekPreview,
    clearPreview,
    getPreviewAudio: () => previewAudio,
    getPreviewUrl: () => previewUrl,
    getPlaybackState: () => ({ ...playbackState }),
    setPreviewAudio: (audio) => {
      playbackSequence += 1;
      clearPendingSeekRetry();
      previewAudio = audio;
      if (!audio) {
        playbackState = createIdlePlaybackState();
      }
    },
    setPreviewUrl: (url) => {
      previewUrl = url;
    },
  };
}

function createIdlePlaybackState() {
  return {
    recordingId: "",
    currentTimeSeconds: 0,
    durationSeconds: 0,
    status: "idle",
    active: false,
  };
}

function normalizePlaybackState(candidate = {}) {
  const recordingId = normalizeRecordingId(candidate.recordingId);
  const durationSeconds = normalizeNonNegativeNumber(candidate.durationSeconds);
  return {
    recordingId,
    currentTimeSeconds: clampPlaybackTime(candidate.currentTimeSeconds, durationSeconds),
    durationSeconds,
    status: normalizePlaybackStatus(candidate.status),
    active: candidate.active === true,
  };
}

function normalizeRecordingId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function clampPlaybackTime(value, durationSeconds = 0) {
  const number = normalizeNonNegativeNumber(value);
  const duration = normalizeNonNegativeNumber(durationSeconds);
  return duration > 0 ? Math.min(number, duration) : number;
}

function normalizePlaybackStatus(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return ["idle", "loading", "playing", "paused", "stopped", "ended", "error"].includes(normalized)
    ? normalized
    : "idle";
}

function readAudioTime(audio, fallbackState = createIdlePlaybackState()) {
  const currentTimeSeconds = Number(audio?.currentTime);
  if (Number.isFinite(currentTimeSeconds) && currentTimeSeconds >= 0) {
    return currentTimeSeconds;
  }
  return fallbackState.currentTimeSeconds;
}

function readAudioDuration(audio, fallbackState = createIdlePlaybackState()) {
  const durationSeconds = Number(audio?.duration);
  if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    return durationSeconds;
  }
  return fallbackState.durationSeconds;
}

function createAudioSnapshot(audio) {
  if (!audio) {
    return {
      hasAudio: false,
    };
  }

  const currentTimeSeconds = Number(audio.currentTime);
  const durationSeconds = Number(audio.duration);
  const readyState = Number(audio.readyState);
  const networkState = Number(audio.networkState);
  return {
    hasAudio: true,
    currentTimeSeconds: Number.isFinite(currentTimeSeconds) ? currentTimeSeconds : null,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    paused: typeof audio.paused === "boolean" ? audio.paused : null,
    ended: typeof audio.ended === "boolean" ? audio.ended : null,
    readyState: Number.isFinite(readyState) ? readyState : null,
    networkState: Number.isFinite(networkState) ? networkState : null,
  };
}

function applyAudioSeek(audio, nextTimeSeconds, {
  event = "seek",
  recordingId = "",
  playToken = 0,
  reportLog = null,
} = {}) {
  const targetTimeSeconds = normalizeNonNegativeNumber(nextTimeSeconds);
  let method = "currentTime";
  let error = null;
  try {
    if (typeof audio?.fastSeek === "function") {
      audio.fastSeek(targetTimeSeconds);
      method = "fastSeek";
    } else if (audio) {
      audio.currentTime = targetTimeSeconds;
    }
  } catch (seekError) {
    error = seekError;
  }

  const actualTimeSeconds = Number(audio?.currentTime);
  const accepted = Number.isFinite(actualTimeSeconds) &&
    Math.abs(actualTimeSeconds - targetTimeSeconds) < 0.05;
  if (typeof reportLog === "function") {
    reportLog(
      accepted ? "debug" : "info",
      accepted ? "seek-applied" : "seek-delayed",
      accepted
        ? "Applied saved take media seek."
        : "Saved take media seek has not reached the requested time yet.",
      {
        event,
        recordingId,
        playToken,
        requestedTimeSeconds: targetTimeSeconds,
        actualTimeSeconds: Number.isFinite(actualTimeSeconds) ? actualTimeSeconds : null,
        method,
        error,
        audioSnapshot: createAudioSnapshot(audio),
      },
    );
  }

  return {
    accepted,
    actualTimeSeconds: Number.isFinite(actualTimeSeconds) ? actualTimeSeconds : targetTimeSeconds,
    method,
    error,
  };
}
