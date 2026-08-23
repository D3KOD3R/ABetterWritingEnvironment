// Intent: verify desktop realtime speech bridge uses repo-local sherpa and whisper assets.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createDesktopRealtimeSpeechBridge,
  detectSherpaOnnxModelBundle,
  detectWhisperCppRuntime,
  parseWhisperCppJsonWordTimings,
} from "../apps/desktop/src/realtime-speech-bridge.ts";

function createJsonFetch(fixtures) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    const key = `${options.method ?? "GET"} ${parsed.pathname}`;
    const value = typeof fixtures[key] === "function" ? fixtures[key](options) : fixtures[key];
    return {
      ok: value?.ok !== false,
      status: value?.ok === false ? 500 : 200,
      async text() {
        return JSON.stringify(value ?? { ok: true });
      },
    };
  };
}

function createFakeWhisperSpawn(transcripts = ["cleaned whisper transcript"], jsonPayloads = [], calls = []) {
  let callIndex = 0;
  let jsonCallIndex = 0;
  return (binary, args) => {
    calls.push({ binary, args: [...args] });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      const outputBase = args[args.indexOf("-of") + 1];
      if (args.includes("-oj")) {
        const payload = jsonPayloads[Math.min(jsonCallIndex, jsonPayloads.length - 1)] ?? {
          transcription: [],
        };
        jsonCallIndex += 1;
        writeFileSync(`${outputBase}.json`, typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
      } else {
        const transcript = transcripts[Math.min(callIndex, transcripts.length - 1)] ?? "";
        callIndex += 1;
        writeFileSync(`${outputBase}.txt`, transcript, "utf8");
      }
      child.emit("exit", 0);
    });
    return child;
  };
}

export async function runRealtimeSpeechBridgeTest() {
  const originalWhisperCppModel = process.env.ABE_WHISPER_CPP_MODEL;
  delete process.env.ABE_WHISPER_CPP_MODEL;
  try {
    const repoRoot = mkdtempSync(path.join(tmpdir(), "abe-realtime-speech-"));
    const sherpaRoot = path.join(repoRoot, ".tools", "sherpa-onnx", "bundle");
    mkdirSync(sherpaRoot, { recursive: true });
    for (const filename of [
      "tokens.txt",
      "encoder-epoch-99-avg-1.int8.onnx",
      "decoder-epoch-99-avg-1.int8.onnx",
      "joiner-epoch-99-avg-1.int8.onnx",
    ]) {
      writeFileSync(path.join(sherpaRoot, filename), "stub", "utf8");
    }
    const whisperRoot = path.join(repoRoot, ".tools", "whisper");
    mkdirSync(whisperRoot, { recursive: true });
    writeFileSync(path.join(whisperRoot, "whisper-cli.exe"), "stub", "utf8");
    writeFileSync(path.join(whisperRoot, "ggml-base.en.bin"), "stub", "utf8");
    writeFileSync(path.join(whisperRoot, "ggml-small.en.bin"), "stub", "utf8");

    assert.equal(detectSherpaOnnxModelBundle([path.join(repoRoot, ".tools", "sherpa-onnx")]).root, sherpaRoot);
    const whisperRuntime = detectWhisperCppRuntime(repoRoot);
    assert.equal(whisperRuntime.available, true);
    assert.equal(path.basename(whisperRuntime.model), "ggml-small.en.bin");
    process.env.ABE_WHISPER_CPP_MODEL = "ggml-base.en.bin";
    assert.equal(path.basename(detectWhisperCppRuntime(repoRoot).model), "ggml-base.en.bin");
    delete process.env.ABE_WHISPER_CPP_MODEL;

    const bridge = createDesktopRealtimeSpeechBridge({
      repoRoot,
      fetchImpl: createJsonFetch({
        "GET /health": {
          ok: true,
          runtimeAvailable: true,
        },
        "POST /sessions/start": {
          ok: true,
          sessionId: "sidecar-session-1",
        },
        "POST /sessions/sidecar-session-1/audio": {
          ok: true,
          isEndpoint: false,
          segments: [{ index: 0, transcript: "live transcript", isFinal: false }],
        },
        "POST /sessions/sidecar-session-1/stop": {
          ok: true,
          isEndpoint: true,
          segments: [{ index: 0, transcript: "final sidecar transcript", isFinal: true }],
        },
      }),
      spawnProcess: createFakeWhisperSpawn(),
      now: () => "2026-07-18T00:00:00.000Z",
    });

    const providers = bridge.listProviders();
    assert.equal(providers.providers.find((provider) => provider.id === "local-sherpa-onnx").availability, "ready");
    assert.equal(providers.providers.find((provider) => provider.id === "whisper-cpp-window").availability, "ready");

    const started = await bridge.startSession({
      projectId: "project-1",
      recordingId: "take-1",
      sceneId: "scene-1",
      blockId: "block-1",
    });
    assert.equal(started.ok, true);

    const frame = await bridge.acceptAudioFrame({
      sessionId: started.session.id,
      pcm16Base64: Buffer.from(new Int16Array([1, -1]).buffer).toString("base64"),
      sampleRate: 16000,
      channelCount: 1,
    });
    assert.equal(frame.transcriptSnapshot.transcript, "live transcript");

    const archivedFrame = await bridge.acceptAudioFrame({
      sessionId: started.session.id,
      pcm16Base64: Buffer.from(new Int16Array([2, -2]).buffer).toString("base64"),
      sampleRate: 16000,
      channelCount: 1,
      skipLiveDecode: true,
    });
    assert.equal(archivedFrame.ok, true);
    assert.equal(archivedFrame.transcriptSnapshot, undefined);
    assert.match(archivedFrame.message, /archived/);

    const stopped = await bridge.stopSession({
      sessionId: started.session.id,
    });
    assert.equal(stopped.finalTranscript, "cleaned whisper transcript");
    assert.equal(stopped.whisper.available, true);
    assert.match(stopped.whisper.audioPath, /\.wav$/);
    assert.equal(stopped.whisper.cleanupMode, "single-window");

    const chunkedBridge = createDesktopRealtimeSpeechBridge({
      repoRoot,
      fetchImpl: createJsonFetch({
        "GET /health": {
          ok: true,
          runtimeAvailable: true,
        },
        "POST /sessions/start": {
          ok: true,
          sessionId: "sidecar-session-1",
        },
        "POST /sessions/sidecar-session-1/stop": {
          ok: true,
          isEndpoint: true,
          segments: [{ index: 0, transcript: "fallback transcript", isFinal: true }],
        },
      }),
      spawnProcess: createFakeWhisperSpawn([
        "alpha beta gamma",
        "gamma delta epsilon",
      ]),
      now: () => "2026-07-18T00:00:00.000Z",
    });
    const chunkedStarted = await chunkedBridge.startSession({
      projectId: "project-1",
      recordingId: "take-2",
      sceneId: "scene-1",
      blockId: "block-1",
    });
    await chunkedBridge.acceptAudioFrame({
      sessionId: chunkedStarted.session.id,
      pcm16Base64: Buffer.alloc(16000 * 2 * 32).toString("base64"),
      sampleRate: 16000,
      channelCount: 1,
      skipLiveDecode: true,
    });
    const chunkedPcmPath = path.join(repoRoot, ".tmp", "realtime-speech", `${chunkedStarted.session.id}.pcm`);
    assert.equal(statSync(chunkedPcmPath).size, 16000 * 2 * 32);
    const chunkedStopped = await chunkedBridge.stopSession({
      sessionId: chunkedStarted.session.id,
    });
    assert.equal(chunkedStopped.finalTranscript, "alpha beta gamma delta epsilon");
    assert.equal(chunkedStopped.whisper.cleanupMode, "sliding-window-overlap");
    assert.equal(chunkedStopped.whisper.chunkCount, 2);

    const parsedWordTimings = parseWhisperCppJsonWordTimings({
      transcription: [{
        text: " Alpha beta.",
        tokens: [
          { text: "[_BEG_]", offsets: { from: 0, to: 0 }, p: 0.9 },
          { text: " Alpha", offsets: { from: 100, to: 420 }, p: 0.92 },
          { text: " beta", offsets: { from: 420, to: 760 }, p: 0.88 },
          { text: ".", offsets: { from: 760, to: 810 }, p: 0.7 },
          { text: "[_TT_100]", offsets: { from: 2000, to: 2000 }, p: 0.99 },
        ],
      }],
    });
    assert.equal(parsedWordTimings.transcript, "Alpha beta.");
    assert.deepEqual(parsedWordTimings.words.map((word) => word.text), ["Alpha", "beta."]);
    assert.equal(parsedWordTimings.words[0].startTimeSeconds, 0.1);
    assert.equal(parsedWordTimings.words[1].endTimeSeconds, 0.81);

    const wordTimingBridge = createDesktopRealtimeSpeechBridge({
      repoRoot,
      fetchImpl: createJsonFetch({
        "GET /health": {
          ok: true,
          runtimeAvailable: true,
        },
      }),
      spawnProcess: createFakeWhisperSpawn([], [{
        transcription: [{
          text: " aligned words",
          tokens: [
            { text: " aligned", offsets: { from: 250, to: 700 }, p: 0.91 },
            { text: " words", offsets: { from: 700, to: 1040 }, p: 0.89 },
          ],
        }],
      }]),
      now: () => "2026-07-18T00:00:00.000Z",
    });
    const wordTimingResult = await wordTimingBridge.createWhisperCppWordTimings({
      recordingId: "take-words",
      transcriptHash: "hash-1",
      wavBase64: Buffer.from("RIFF stub wav").toString("base64"),
      language: "en",
    });
    assert.equal(wordTimingResult.ok, true);
    assert.equal(wordTimingResult.providerId, "whisper-cpp-word-timestamps-v1");
    assert.deepEqual(wordTimingResult.words.map((word) => word.text), ["aligned", "words"]);
    assert.equal(wordTimingResult.words[0].startTimeSeconds, 0.25);
    assert.equal(wordTimingResult.words[1].endTimeSeconds, 1.04);
  } finally {
    if (originalWhisperCppModel === undefined) {
      delete process.env.ABE_WHISPER_CPP_MODEL;
    } else {
      process.env.ABE_WHISPER_CPP_MODEL = originalWhisperCppModel;
    }
  }
}
