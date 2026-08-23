// Intent: derive transient saved-take waveform peaks from browser audio blobs without persisting analysis data.

export const VOICE_RECORDING_WAVEFORM_STATUS = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  UNAVAILABLE: "unavailable",
  ERROR: "error",
});

const DEFAULT_WAVEFORM_PEAK_COUNT = 180;

export function createVoiceRecordingWaveformState({
  recordingId = "",
  status = VOICE_RECORDING_WAVEFORM_STATUS.IDLE,
  peaks = [],
  durationSeconds = 0,
  reason = "",
  errorMessage = "",
} = {}) {
  const normalizedPeaks = normalizeWaveformPeaks(peaks);
  return {
    recordingId: normalizeRecordingId(recordingId),
    status: normalizeWaveformStatus(status, normalizedPeaks),
    peaks: normalizedPeaks,
    durationSeconds: normalizeNonNegativeNumber(durationSeconds),
    reason: normalizeStatusText(reason),
    errorMessage: normalizeStatusText(errorMessage),
  };
}

export function createVoiceRecordingWaveformService({
  createAudioContext = createDefaultAudioContext,
  peakCount = DEFAULT_WAVEFORM_PEAK_COUNT,
  reportLog = null,
} = {}) {
  const resolvedPeakCount = normalizePeakCount(peakCount);

  // Intent: decode browser audio only on demand for the active/opened review surface.
  async function loadWaveform(blob, {
    recordingId = "",
  } = {}) {
    const normalizedRecordingId = normalizeRecordingId(recordingId);
    if (!blob || typeof blob.arrayBuffer !== "function") {
      return createVoiceRecordingWaveformState({
        recordingId: normalizedRecordingId,
        status: VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE,
        reason: "missing-blob",
      });
    }

    const audioContext = typeof createAudioContext === "function" ? createAudioContext() : null;
    if (!audioContext || typeof audioContext.decodeAudioData !== "function") {
      return createVoiceRecordingWaveformState({
        recordingId: normalizedRecordingId,
        status: VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE,
        reason: "audio-decoder-unavailable",
      });
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await decodeAudioBuffer(audioContext, arrayBuffer);
      const peaks = createWaveformPeaksFromAudioBuffer(audioBuffer, {
        peakCount: resolvedPeakCount,
      });
      return createVoiceRecordingWaveformState({
        recordingId: normalizedRecordingId,
        status: peaks.length
          ? VOICE_RECORDING_WAVEFORM_STATUS.READY
          : VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE,
        peaks,
        durationSeconds: audioBuffer?.duration,
        reason: peaks.length ? "" : "empty-audio-buffer",
      });
    } catch (error) {
      emitWaveformLog(reportLog, "warn", "waveform-decode-failed", "Saved take waveform decode failed.", {
        error,
        recordingId: normalizedRecordingId,
      });
      return createVoiceRecordingWaveformState({
        recordingId: normalizedRecordingId,
        status: VOICE_RECORDING_WAVEFORM_STATUS.ERROR,
        reason: "decode-failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      closeAudioContext(audioContext);
    }
  }

  return {
    loadWaveform,
  };
}

export function createWaveformPeaksFromAudioBuffer(audioBuffer, {
  peakCount = DEFAULT_WAVEFORM_PEAK_COUNT,
} = {}) {
  const length = Math.max(0, Math.floor(Number(audioBuffer?.length) || 0));
  const channelCount = Math.max(0, Math.floor(Number(audioBuffer?.numberOfChannels) || 0));
  const resolvedPeakCount = normalizePeakCount(peakCount);
  if (!length || !channelCount || typeof audioBuffer?.getChannelData !== "function") {
    return [];
  }

  const channels = [];
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    try {
      const channelData = audioBuffer.getChannelData(channelIndex);
      if (channelData?.length) {
        channels.push(channelData);
      }
    } catch {
      // Browser buffers can reject invalid channels; other valid channels remain usable.
    }
  }
  if (!channels.length) {
    return [];
  }

  const binCount = Math.min(resolvedPeakCount, length);
  const peaks = [];
  for (let binIndex = 0; binIndex < binCount; binIndex += 1) {
    const start = Math.floor((binIndex / binCount) * length);
    const end = Math.max(start + 1, Math.floor(((binIndex + 1) / binCount) * length));
    const stride = Math.max(1, Math.floor((end - start) / 96));
    let peak = 0;

    for (const channelData of channels) {
      const channelLength = Math.min(channelData.length, length);
      for (let sampleIndex = start; sampleIndex < end && sampleIndex < channelLength; sampleIndex += stride) {
        const sample = Math.abs(Number(channelData[sampleIndex]) || 0);
        if (sample > peak) {
          peak = sample;
        }
      }
    }

    peaks.push(peak);
  }

  const maxPeak = peaks.reduce((max, peak) => Math.max(max, peak), 0);
  if (maxPeak <= 0) {
    return peaks.map(() => 0);
  }

  return peaks.map((peak) => Math.round((peak / maxPeak) * 1000) / 1000);
}

function normalizeWaveformPeaks(peaks) {
  return (Array.isArray(peaks) ? peaks : [])
    .map((peak) => Math.max(0, Math.min(1, Number(peak) || 0)))
    .filter((peak) => Number.isFinite(peak));
}

function normalizeWaveformStatus(status, peaks = []) {
  const normalizedStatus = normalizeStatusText(status);
  if (Object.values(VOICE_RECORDING_WAVEFORM_STATUS).includes(normalizedStatus)) {
    return normalizedStatus;
  }
  return peaks.length ? VOICE_RECORDING_WAVEFORM_STATUS.READY : VOICE_RECORDING_WAVEFORM_STATUS.IDLE;
}

function normalizeRecordingId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeStatusText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizePeakCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.min(600, Math.round(number)))
    : DEFAULT_WAVEFORM_PEAK_COUNT;
}

function createDefaultAudioContext() {
  const audioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return typeof audioContextConstructor === "function"
    ? new audioContextConstructor()
    : null;
}

function decodeAudioBuffer(audioContext, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const complete = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    try {
      const maybePromise = audioContext.decodeAudioData(arrayBuffer.slice(0), complete, fail);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(complete, fail);
      }
    } catch (error) {
      fail(error);
    }
  });
}

function closeAudioContext(audioContext) {
  if (!audioContext || typeof audioContext.close !== "function") {
    return;
  }

  try {
    const closeResult = audioContext.close();
    if (closeResult && typeof closeResult.catch === "function") {
      closeResult.catch(() => {});
    }
  } catch {
    // AudioContext cleanup must not break the review UI.
  }
}

function emitWaveformLog(reportLog, level, event, message, context = {}) {
  if (typeof reportLog !== "function") {
    return;
  }

  try {
    reportLog(level, "voice-recording-waveform", message, {
      event,
      ...context,
    });
  } catch {
    // Logging must never break waveform display.
  }
}
