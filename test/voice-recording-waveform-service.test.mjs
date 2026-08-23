// Intent: verify saved recording oscillogram peak derivation remains transient and deterministic.
import assert from "node:assert/strict";

import {
  VOICE_RECORDING_WAVEFORM_STATUS,
  createVoiceRecordingWaveformService,
  createVoiceRecordingWaveformState,
  createWaveformPeaksFromAudioBuffer,
} from "../apps/editor/public/features/voice/voice-recording-waveform-service.js";

export async function runVoiceRecordingWaveformServiceTest() {
  const audioBuffer = {
    length: 8,
    numberOfChannels: 2,
    duration: 2,
    getChannelData(channelIndex) {
      return channelIndex === 0
        ? new Float32Array([0, 0.2, 0.5, 0.4, -1, -0.6, 0.2, 0])
        : new Float32Array([0, -0.1, 0.25, 0.75, 0.3, 0.1, 0.05, 0]);
    },
  };

  const peaks = createWaveformPeaksFromAudioBuffer(audioBuffer, {
    peakCount: 4,
  });
  assert.equal(peaks.length, 4);
  assert.equal(Math.max(...peaks), 1);
  assert.deepEqual(peaks, [0.2, 0.75, 1, 0.2]);

  const events = [];
  const service = createVoiceRecordingWaveformService({
    peakCount: 4,
    createAudioContext: () => ({
      decodeAudioData: async (arrayBuffer) => {
        events.push(`decode:${arrayBuffer.byteLength > 0}`);
        return audioBuffer;
      },
      close: () => events.push("close"),
    }),
  });
  const loadedState = await service.loadWaveform(new Blob(["audio"]), {
    recordingId: "take-1",
  });
  assert.equal(loadedState.recordingId, "take-1");
  assert.equal(loadedState.status, VOICE_RECORDING_WAVEFORM_STATUS.READY);
  assert.equal(loadedState.durationSeconds, 2);
  assert.deepEqual(loadedState.peaks, peaks);
  assert.deepEqual(events, ["decode:true", "close"]);

  const unavailableService = createVoiceRecordingWaveformService({
    createAudioContext: () => null,
  });
  const unavailableState = await unavailableService.loadWaveform(new Blob(["audio"]), {
    recordingId: "take-2",
  });
  assert.equal(unavailableState.status, VOICE_RECORDING_WAVEFORM_STATUS.UNAVAILABLE);
  assert.equal(unavailableState.reason, "audio-decoder-unavailable");

  assert.deepEqual(createVoiceRecordingWaveformState({
    recordingId: " take-3 ",
    status: "ready",
    peaks: [-1, 0.5, 2, Number.NaN],
    durationSeconds: -1,
  }), {
    recordingId: "take-3",
    status: "ready",
    peaks: [0, 0.5, 1, 0],
    durationSeconds: 0,
    reason: "",
    errorMessage: "",
  });
}
