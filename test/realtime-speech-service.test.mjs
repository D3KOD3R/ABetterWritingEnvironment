// Intent: verify realtime speech provider selection and transcript snapshots stay behind services/audio.
import assert from "node:assert/strict";

import {
  createRealtimeSpeechSessionCoordinator,
  createRealtimeSpeechTranscriptSnapshot,
  createSherpaOnnxRealtimeProviderDescriptor,
  createWhisperCppWindowRealtimeProviderDescriptor,
  selectRealtimeSpeechProvider,
} from "../services/audio/src/index.ts";

export function runRealtimeSpeechServiceTest() {
  const unavailableSherpa = createSherpaOnnxRealtimeProviderDescriptor({
    runtimeAvailable: false,
  });
  const whisperRecovery = createWhisperCppWindowRealtimeProviderDescriptor({
    availability: "ready",
  });
  assert.equal(selectRealtimeSpeechProvider([unavailableSherpa, whisperRecovery]).id, "whisper-cpp-window");

  const readySherpa = createSherpaOnnxRealtimeProviderDescriptor({
    runtimeAvailable: true,
    provider: "cpu",
    modelBundle: {
      root: "C:/models/sherpa/live",
      tokens: "C:/models/sherpa/live/tokens.txt",
      encoder: "C:/models/sherpa/live/encoder.onnx",
      decoder: "C:/models/sherpa/live/decoder.onnx",
      joiner: "C:/models/sherpa/live/joiner.onnx",
    },
  });
  assert.equal(readySherpa.availability, "ready");
  assert.equal(readySherpa.requiresInternet, false);
  assert.equal(selectRealtimeSpeechProvider([whisperRecovery, readySherpa]).id, "local-sherpa-onnx");

  const snapshot = createRealtimeSpeechTranscriptSnapshot({
    sessionId: "session-1",
    providerId: "local-sherpa-onnx",
    sequence: 2,
    resultIndex: 1,
    segments: [
      { index: 0, transcript: "  first   phrase ", isFinal: true, confidence: 0.9 },
      { index: 1, transcript: "second phrase", isFinal: false, confidence: 0.7 },
    ],
    receivedAt: "2026-07-18T01:00:00.000Z",
  });
  assert.equal(snapshot.transcript, "first phrase second phrase");
  assert.equal(snapshot.finalTranscript, "first phrase");
  assert.equal(snapshot.interimTranscript, "second phrase");
  assert.equal(snapshot.changedTranscript, "second phrase");

  const logs = [];
  const coordinator = createRealtimeSpeechSessionCoordinator({
    providers: [readySherpa, whisperRecovery],
    logger: {
      isEnabled: () => true,
      info: (...entry) => logs.push(entry),
      debug: (...entry) => logs.push(entry),
      warn: (...entry) => logs.push(entry),
    },
    now: () => "2026-07-18T01:00:00.000Z",
  });
  const session = coordinator.startSession({
    projectId: "project-1",
    recordingId: "take-1",
    sceneId: "scene-1",
    blockId: "block-1",
    preferredProviderId: "missing-provider",
  });
  assert.equal(session.providerId, "local-sherpa-onnx");
  assert.equal(session.status, "listening");

  const withTranscript = coordinator.acceptTranscriptSnapshot({
    sessionId: session.id,
    resultIndex: 0,
    segments: [{ index: 0, transcript: "live words", isFinal: false }],
    isEndpoint: true,
  });
  assert.equal(withTranscript.status, "paused");
  assert.equal(withTranscript.transcriptSnapshot?.isEndpoint, true);

  const stopped = coordinator.stopSession({ sessionId: session.id });
  assert.equal(stopped?.status, "stopped");
  assert.equal(logs.some((entry) => entry[1] === "realtime-speech.session-started"), true);
  assert.equal(logs.some((entry) => entry[1] === "realtime-speech.snapshot"), true);
  assert.equal(logs.some((entry) => entry[1] === "realtime-speech.session-stopped"), true);
}
