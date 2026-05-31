// Intent: own narration recording finalization and media-save result mapping outside the editor shell.

import {
  buildNarrationRecordingFinalizationContext,
  createFinalNarrationRecordingRecord,
  createNarrationRecordingBlob,
  formatNarrationRecordingElapsedLabel,
} from "./narration-take-service.js";

export function createNarrationRecordingFinalizationService({
  cleanupRuntime,
  saveMediaBlob,
  resolveSelection,
  getProjectId,
  reportLog = () => {},
  blobConstructor = globalThis.Blob,
} = {}) {
  const requiredFunctions = {
    cleanupRuntime,
    saveMediaBlob,
    resolveSelection,
    getProjectId,
  };

  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`NarrationRecordingFinalizationService requires ${name}.`);
    }
  }

  // Intent: convert a stopped runtime into a saved/failed take record and paused session state.
  async function finalizeRuntime(runtime, {
    stopError = null,
  } = {}) {
    cleanupRuntime(runtime);

    const selection = runtime.selection ?? resolveSelection(runtime);
    const finalization = buildNarrationRecordingFinalizationContext(runtime, {
      selection,
      projectId: getProjectId(),
    });
    let finalRecord = null;
    let trackerStatus = runtime.trackerStatus || "Narration take complete.";

    try {
      const recordingBlob = createNarrationRecordingBlob(runtime, {
        blobConstructor,
      });
      if (!recordingBlob.size) {
        throw new Error("The narration take did not capture any audio.");
      }

      await saveMediaBlob({
        filePath: finalization.mediaPath,
        blob: recordingBlob,
      });

      finalRecord = createFinalNarrationRecordingRecord(finalization, {
        status: "saved",
      });
      trackerStatus = "Narration take saved.";
    } catch (error) {
      finalRecord = createFinalNarrationRecordingRecord(finalization, {
        status: "failed",
      });
      trackerStatus = `Narration take failed: ${error instanceof Error ? error.message : String(error)}`;
      reportLog("error", "voice-recording", "Narration recording failed to save.", {
        error,
        recordingId: finalization.recordingId,
        projectId: finalization.projectId,
        mediaPath: finalization.mediaPath,
      });
    }

    if (stopError) {
      reportLog("error", "voice-recording", "Failed to stop a narration recording cleanly.", {
        error: stopError,
        recordingId: finalization.recordingId,
        projectId: finalization.projectId,
      });
    }

    return {
      finalRecord,
      selection,
      sessionOptions: {
        status: "paused",
        trackerStatus,
        transcript: finalization.transcript,
        elapsedLabel: formatNarrationRecordingElapsedLabel(finalization.durationMs),
        recordingId: finalRecord.id,
        mediaPath: finalRecord.mediaPath,
        startedAtMs: finalization.startedAtMs,
      },
    };
  }

  return {
    finalizeRuntime,
  };
}
