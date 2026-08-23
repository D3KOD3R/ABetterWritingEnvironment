// Intent: own saved voice recording preview and manuscript navigation actions outside app.js.
import {
  createVoiceRecordingSceneBlockRanges,
  resolveVoiceRecordingSceneRange,
} from "./voice-recording-service.js";

export function createVoiceRecordingActionService({
  getRecordingById,
  loadMediaBlob,
  deleteMediaFile,
  playBlob,
  getScene,
  deleteRecordingById,
  reportLog = () => {},
} = {}) {
  const requiredFunctions = {
    getRecordingById,
    loadMediaBlob,
    deleteMediaFile,
    playBlob,
    getScene,
    deleteRecordingById,
  };

  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`VoiceRecordingActionService requires ${name}.`);
    }
  }

  // Intent: delete a saved take from project media when possible, then remove its anchored project record.
  async function deleteRecording(recordingId) {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return { ok: false, reason: "missing-recording" };
    }

    const mediaPath = typeof recording.mediaPath === "string" ? recording.mediaPath.trim() : "";
    let mediaResult = { ok: true, removed: false, reason: "no-media" };
    if (mediaPath) {
      try {
        mediaResult = await deleteMediaFile({ filePath: mediaPath });
      } catch (error) {
        mediaResult = {
          ok: false,
          removed: false,
          reason: "media-delete-failed",
          error,
        };
        reportLog("warn", "voice-recording", "Voice recording media delete failed; removing project record anyway.", {
          error,
          recordingId,
          mediaPath,
        });
      }
    }

    const recordingProjectId = typeof recording.projectId === "string" && recording.projectId.trim()
      ? recording.projectId
      : undefined;
    const removedRecording = deleteRecordingById(recordingId, recordingProjectId);
    if (!removedRecording) {
      return {
        ok: false,
        reason: "record-delete-failed",
        recording,
        mediaResult,
      };
    }

    return {
      ok: true,
      recording: removedRecording,
      mediaResult,
    };
  }

  // Intent: load and play saved recording media through service boundaries, not shell endpoint calls.
  async function previewRecording(recordingId, {
    startTimeSeconds = 0,
  } = {}) {
    const recording = getRecordingById(recordingId);
    if (!recording || recording.status !== "saved" || !recording.mediaPath) {
      return { ok: false, reason: "unavailable" };
    }

    try {
      const { blob } = await loadMediaBlob({
        filePath: recording.mediaPath,
        mediaMimeType: recording.mediaMimeType,
      });

      const playback = await playBlob(blob, {
        recordingId: recording.id,
        startTimeSeconds,
      });
      return { ok: true, recording, playback };
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

    const blockRanges = createVoiceRecordingSceneBlockRanges(scene);
    const recordingBlockRange = blockRanges.find((block) => block.blockId === recording.blockId) ?? null;
    const selectedBlockRange = recordingBlockRange ?? blockRanges[0] ?? null;
    const selectedBlockId = selectedBlockRange?.blockId ?? null;
    const range = resolveVoiceRecordingSceneRange(recording, scene, { blockRanges });

    return {
      ok: true,
      recording,
      sceneId: scene.sceneId,
      selectedBlockId,
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    };
  }

  return {
    deleteRecording,
    previewRecording,
    planRecordingVerseNavigation,
  };
}
