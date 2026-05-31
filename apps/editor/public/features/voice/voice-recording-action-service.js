// Intent: own saved voice recording preview and manuscript navigation actions outside app.js.

export function createVoiceRecordingActionService({
  getRecordingById,
  loadMediaBlob,
  playBlob,
  getScene,
  reportLog = () => {},
} = {}) {
  const requiredFunctions = {
    getRecordingById,
    loadMediaBlob,
    playBlob,
    getScene,
  };

  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`VoiceRecordingActionService requires ${name}.`);
    }
  }

  // Intent: load and play saved recording media through service boundaries, not shell endpoint calls.
  async function previewRecording(recordingId) {
    const recording = getRecordingById(recordingId);
    if (!recording || recording.status !== "saved" || !recording.mediaPath) {
      return { ok: false, reason: "unavailable" };
    }

    try {
      const { blob } = await loadMediaBlob({
        filePath: recording.mediaPath,
        mediaMimeType: recording.mediaMimeType,
      });

      await playBlob(blob);
      return { ok: true, recording };
    } catch (error) {
      reportLog("error", "voice-recording", "Voice recording preview failed.", {
        error,
        recordingId,
        mediaPath: recording.mediaPath,
      });
      return {
        ok: false,
        reason: "failed",
        error,
        recording,
      };
    }
  }

  // Intent: plan manuscript navigation from persisted recording anchors without mutating UI state.
  function planRecordingVerseNavigation(recordingId) {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return { ok: false, reason: "missing-recording" };
    }

    const scene = getScene(recording.sceneId);
    if (!scene) {
      return { ok: false, reason: "missing-scene", recording };
    }

    const selectedBlockId = scene.blocks?.some((block) => block.blockId === recording.blockId)
      ? recording.blockId
      : scene.blocks?.[0]?.blockId ?? null;

    return {
      ok: true,
      recording,
      sceneId: scene.sceneId,
      selectedBlockId,
    };
  }

  return {
    previewRecording,
    planRecordingVerseNavigation,
  };
}
