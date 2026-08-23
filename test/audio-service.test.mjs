// Intent: verify audio service narration sessions and alignment jobs remain anchor-aware.
import assert from "node:assert/strict";

import {
  addBlock,
  addChapter,
  addScene,
  createManuscriptAnchor,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import {
  createInMemoryAudioService,
  createSherpaOnnxRealtimeProviderDescriptor,
} from "../services/audio/src/index.ts";

export function runAudioServiceTest() {
  let project = createProject({
    title: "Narration Fixture",
    now: "2026-04-21T07:20:00.000Z",
  });

  const chapter = addChapter(project, { title: "One" }, "2026-04-21T07:21:00.000Z");
  project = chapter.project;
  const scene = addScene(project, chapter.chapter.id, { title: "Readthrough" }, "2026-04-21T07:22:00.000Z");
  project = scene.project;
  const block = addBlock(
    project,
    scene.scene.id,
    {
      kind: "narration",
      text: "The narrator tracked the sentence without losing the line.",
    },
    "2026-04-21T07:23:00.000Z",
  );
  project = block.project;

  const anchor = createManuscriptAnchor(project, {
    blockId: block.block.id,
    startOffset: 0,
    endOffset: 12,
  });

  const audio = createInMemoryAudioService({
    realtimeSpeechProviders: [
      createSherpaOnnxRealtimeProviderDescriptor({
        runtimeAvailable: true,
        modelBundle: {
          root: "C:/models/sherpa/live",
          tokens: "C:/models/sherpa/live/tokens.txt",
          encoder: "C:/models/sherpa/live/encoder.onnx",
          decoder: "C:/models/sherpa/live/decoder.onnx",
          joiner: "C:/models/sherpa/live/joiner.onnx",
        },
      }),
    ],
  });
  const session = audio.startNarrationSession({
    project,
    sessionLabel: "Test Session",
    anchor,
    currentLineNumber: 1,
    currentText: block.block.text,
    now: "2026-04-21T07:24:00.000Z",
  });

  const alignment = audio.alignNarration({
    session,
    projectId: project.id,
    anchor,
    transcript: "The narrator tracked",
    resolvedText: block.block.text,
    matchedLineNumber: 1,
    confidence: 0.95,
    now: "2026-04-21T07:25:00.000Z",
  });

  assert.equal(session.status, "tracking");
  assert.equal(alignment.job.status, "completed");
  assert.equal(alignment.job.result?.matchedLineNumber, 1);
  assert.equal(alignment.session.currentText, block.block.text);

  const realtimeProviders = audio.listRealtimeSpeechProviders();
  assert.equal(realtimeProviders[0].kind, "local-sherpa-onnx");
  assert.equal(realtimeProviders[0].requiresInternet, false);
  assert.equal(audio.provider.realtimeSpeechProviders?.[0].streamingMode, "true-streaming");

  const realtimeSession = audio.startRealtimeSpeechSession({
    projectId: project.id,
    recordingId: "take-1",
    sceneId: scene.scene.id,
    blockId: block.block.id,
    preferredProviderId: "local-sherpa-onnx",
    now: "2026-04-21T07:26:00.000Z",
  });
  assert.equal(realtimeSession.status, "listening");
  assert.equal(realtimeSession.providerId, "local-sherpa-onnx");

  const updatedRealtimeSession = audio.acceptRealtimeSpeechSnapshot({
    sessionId: realtimeSession.id,
    resultIndex: 1,
    segments: [
      { index: 0, transcript: "The narrator", isFinal: true, confidence: 0.91 },
      { index: 1, transcript: "tracked", isFinal: false, confidence: 0.82 },
    ],
    now: "2026-04-21T07:26:01.000Z",
  });
  assert.equal(updatedRealtimeSession.transcriptSnapshot?.transcript, "The narrator tracked");
  assert.equal(updatedRealtimeSession.transcriptSnapshot?.finalTranscript, "The narrator");
  assert.equal(updatedRealtimeSession.transcriptSnapshot?.changedTranscript, "tracked");

  const stoppedRealtimeSession = audio.stopRealtimeSpeechSession({
    sessionId: realtimeSession.id,
    now: "2026-04-21T07:26:02.000Z",
  });
  assert.equal(stoppedRealtimeSession?.status, "stopped");
}
