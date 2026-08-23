// Intent: own narration recording finalization and media-save result mapping outside the editor shell.

import {
  buildNarrationRecordingFinalizationContext,
  createFinalNarrationRecordingRecord,
  createNarrationRecordingBlob,
  formatNarrationRecordingElapsedLabel,
} from "./narration-take-service.js";

const MIN_FINAL_FOLLOW_CONFIDENCE = 0.58;
const MIN_FINAL_FOLLOW_WORD_FIT = 0.55;

function hasUsableFinalFollowSelection(runtime) {
  const selection = runtime?.followSelection;
  if (!selection?.sceneId || !selection?.blockId) {
    return false;
  }

  const confidence = Number(selection.confidence ?? runtime?.followMatch?.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_FINAL_FOLLOW_CONFIDENCE) {
    return false;
  }

  const wordFitRatio = Number(selection.wordFitRatio ?? runtime?.followMatch?.wordFitRatio);
  if (Number.isFinite(wordFitRatio) && wordFitRatio < MIN_FINAL_FOLLOW_WORD_FIT) {
    return false;
  }

  const matchedWordCount = Number(selection.matchedWordCount ?? runtime?.followMatch?.matchedWordCount);
  return !Number.isFinite(matchedWordCount) || matchedWordCount >= 2;
}

function resolveFinalNarrationSelection(runtime, fallbackSelection) {
  return hasUsableFinalFollowSelection(runtime)
    ? runtime.followSelection
    : fallbackSelection;
}

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

    const fallbackSelection = runtime.selection ?? resolveSelection(runtime);
    const selection = resolveFinalNarrationSelection(runtime, fallbackSelection);
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
        cleanupTranscript: finalization.cleanupTranscript || finalization.transcript,
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
