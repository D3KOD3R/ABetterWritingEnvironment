// Intent: bridge the browser editor to repo-local sherpa-onnx and whisper.cpp assets without cloud speech services.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createSherpaOnnxRealtimeProviderDescriptor,
  createWhisperCppWindowRealtimeProviderDescriptor,
  createRealtimeSpeechTranscriptSnapshot,
} from "../../../services/audio/src/index.ts";
import type {
  RealtimeSpeechModelBundleDescriptor,
  RealtimeSpeechProviderDescriptor,
  RealtimeSpeechSessionSnapshot,
  RealtimeSpeechTranscriptSegment,
} from "../../../packages/shared-types/src/index.ts";
import type { DesktopSettingsSnapshot } from "../../../packages/shared-types/src/index.ts";

export interface DesktopRealtimeSpeechBridgeResponse {
  ok: boolean;
  statusCode: number;
  message?: string;
  providerId?: string;
  providers?: RealtimeSpeechProviderDescriptor[];
  session?: RealtimeSpeechSessionSnapshot;
  transcriptSnapshot?: ReturnType<typeof createRealtimeSpeechTranscriptSnapshot>;
  transcript?: string;
  finalTranscript?: string;
  words?: DesktopWhisperWordTiming[];
  whisper?: {
    available: boolean;
    audioPath?: string;
    binary?: string;
    model?: string;
    cleanupMode?: string;
    chunkCount?: number;
    chunkWindowMs?: number;
    chunkOverlapMs?: number;
    errorMessage?: string;
  };
  sidecar?: {
    url: string;
    started: boolean;
  };
}

export interface DesktopRealtimeSpeechStartInput {
  projectId?: string;
  recordingId?: string;
  sceneId?: string;
  blockId?: string;
  language?: string;
  sampleRate?: number;
  channelCount?: number;
  preferredProviderId?: string;
}

export interface DesktopRealtimeSpeechAudioFrameInput {
  sessionId?: string;
  pcm16Base64?: string;
  sampleRate?: number;
  channelCount?: number;
  sequence?: number;
  capturedAtMs?: number;
  flushedAtMs?: number;
  durationMs?: number;
  frameCount?: number;
  chunked?: boolean;
  skipLiveDecode?: boolean;
}

export interface DesktopRealtimeSpeechStopInput {
  sessionId?: string;
  errorMessage?: string;
}

export interface DesktopWhisperCleanupInput {
  audioPath?: string;
  language?: string;
}

export interface DesktopWhisperWordTimingInput {
  recordingId?: string;
  wavBase64?: string;
  language?: string;
  transcriptHash?: string;
}

export interface DesktopWhisperWordTiming {
  index: number;
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  confidence?: number;
}

export interface DesktopRealtimeSpeechBridgeOptions {
  getSettings?: () => DesktopSettingsSnapshot;
  fetchImpl?: typeof fetch;
  spawnProcess?: typeof spawn;
  now?: () => string;
  repoRoot?: string;
  sidecarUrl?: string;
  sidecarPort?: number;
  pythonCommand?: string;
  modelRoots?: string[];
}

interface DesktopRealtimeSpeechSessionRecord extends RealtimeSpeechSessionSnapshot {
  sidecarSessionId: string;
  pcmPath: string;
  wavPath: string;
  pcmByteLength: number;
}

const SHERPA_PROVIDER_ID = "local-sherpa-onnx";
const WHISPER_PROVIDER_ID = "whisper-cpp-window";
const WHISPER_WORD_TIMING_PROVIDER_ID = "whisper-cpp-word-timestamps-v1";
const DEFAULT_SIDECAR_HOST = "127.0.0.1";
const DEFAULT_SIDECAR_PORT = 4322;
const WHISPER_CHUNK_WINDOW_MS = 30000;
const WHISPER_CHUNK_OVERLAP_MS = 5000;
const SHERPA_MODEL_VARIANTS = [
  ["encoder-epoch-99-avg-1.int8.onnx", "decoder-epoch-99-avg-1.int8.onnx", "joiner-epoch-99-avg-1.int8.onnx"],
  ["encoder-epoch-99-avg-1.onnx", "decoder-epoch-99-avg-1.onnx", "joiner-epoch-99-avg-1.onnx"],
  ["encoder.onnx", "decoder.onnx", "joiner.onnx"],
];
// Intent: prefer higher-accuracy Whisper cleanup models while keeping base/tiny as compatibility fallbacks.
const WHISPER_CPP_MODEL_PREFERENCE = [
  "ggml-large-v3-turbo.bin",
  "ggml-large-v3.bin",
  "ggml-large-v2.bin",
  "ggml-large.bin",
  "ggml-medium.en.bin",
  "ggml-medium.bin",
  "ggml-small.en.bin",
  "ggml-small.bin",
  "ggml-base.en.bin",
  "ggml-base.bin",
  "ggml-tiny.en.bin",
  "ggml-tiny.bin",
];

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSafeFileToken(value: unknown, fallback = "recording"): string {
  const normalized = normalizeString(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numberValue = Math.round(Number(value));
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

function normalizeNullableNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function roundSeconds(value: unknown): number {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function roundAudioNumber(value: unknown): number {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeWhisperLanguage(value: unknown): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }
  return normalized.split("-")[0].toLowerCase();
}

function createWavHeader({ byteLength, sampleRate, channelCount }: {
  byteLength: number;
  sampleRate: number;
  channelCount: number;
}) {
  const safeChannelCount = normalizePositiveInteger(channelCount, 1);
  const safeSampleRate = normalizePositiveInteger(sampleRate, 16000);
  const blockAlign = safeChannelCount * 2;
  const byteRate = safeSampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(safeChannelCount, 22);
  header.writeUInt32LE(safeSampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(byteLength, 40);
  return header;
}

function writePcm16Wav({ pcmPath, wavPath, sampleRate, channelCount, byteLength }: {
  pcmPath: string;
  wavPath: string;
  sampleRate: number;
  channelCount: number;
  byteLength: number;
}) {
  const pcm = existsSync(pcmPath) ? readFileSync(pcmPath) : Buffer.alloc(0);
  const resolvedByteLength = byteLength || pcm.byteLength;
  writeFileSync(wavPath, Buffer.concat([
    createWavHeader({ byteLength: resolvedByteLength, sampleRate, channelCount }),
    pcm,
  ]));
  return wavPath;
}

function alignByteLengthToFrame(byteLength: number, frameByteLength: number): number {
  const safeFrameByteLength = Math.max(1, Math.floor(Number(frameByteLength) || 1));
  const safeByteLength = Math.max(0, Math.floor(Number(byteLength) || 0));
  if (safeByteLength <= 0) {
    return 0;
  }
  return Math.max(safeFrameByteLength, safeByteLength - (safeByteLength % safeFrameByteLength));
}

function createWhisperChunkRanges({
  byteLength,
  sampleRate,
  channelCount,
  windowMs = WHISPER_CHUNK_WINDOW_MS,
  overlapMs = WHISPER_CHUNK_OVERLAP_MS,
}: {
  byteLength: number;
  sampleRate: number;
  channelCount: number;
  windowMs?: number;
  overlapMs?: number;
}) {
  const safeSampleRate = normalizePositiveInteger(sampleRate, 16000);
  const safeChannelCount = normalizePositiveInteger(channelCount, 1);
  const frameByteLength = safeChannelCount * 2;
  const bytesPerSecond = safeSampleRate * frameByteLength;
  const safeWindowMs = Math.max(1000, Number(windowMs) || WHISPER_CHUNK_WINDOW_MS);
  const safeOverlapMs = Math.max(0, Math.min(safeWindowMs - 500, Number(overlapMs) || WHISPER_CHUNK_OVERLAP_MS));
  const chunkByteLength = alignByteLengthToFrame(Math.round(bytesPerSecond * (safeWindowMs / 1000)), frameByteLength);
  const overlapByteLength = alignByteLengthToFrame(Math.round(bytesPerSecond * (safeOverlapMs / 1000)), frameByteLength);
  const stepByteLength = Math.max(frameByteLength, chunkByteLength - overlapByteLength);
  const safeByteLength = alignByteLengthToFrame(byteLength, frameByteLength);
  const ranges: Array<{ startByte: number; endByte: number }> = [];

  if (safeByteLength <= 0) {
    return ranges;
  }

  for (let startByte = 0; startByte < safeByteLength; startByte += stepByteLength) {
    const endByte = Math.min(safeByteLength, startByte + chunkByteLength);
    if (endByte <= startByte) {
      break;
    }
    ranges.push({ startByte, endByte });
    if (endByte >= safeByteLength) {
      break;
    }
  }

  return ranges;
}

function writePcm16WavChunk({
  pcm,
  wavPath,
  startByte,
  endByte,
  sampleRate,
  channelCount,
}: {
  pcm: Buffer;
  wavPath: string;
  startByte: number;
  endByte: number;
  sampleRate: number;
  channelCount: number;
}) {
  const chunk = pcm.subarray(Math.max(0, startByte), Math.max(0, endByte));
  writeFileSync(wavPath, Buffer.concat([
    createWavHeader({ byteLength: chunk.byteLength, sampleRate, channelCount }),
    chunk,
  ]));
  return wavPath;
}

function splitTranscriptWords(value: string): string[] {
  return String(value ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
}

function normalizeTranscriptWord(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function findTranscriptWordOverlap(leftWords: string[], rightWords: string[], maxOverlapWords = 36): number {
  const maxOverlap = Math.min(leftWords.length, rightWords.length, Math.max(0, Math.floor(Number(maxOverlapWords) || 0)));
  for (let size = maxOverlap; size > 0; size -= 1) {
    let matches = true;
    for (let index = 0; index < size; index += 1) {
      if (normalizeTranscriptWord(leftWords[leftWords.length - size + index]) !== normalizeTranscriptWord(rightWords[index])) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return size;
    }
  }
  return 0;
}

function stitchWhisperChunkTranscripts(transcripts: string[]): string {
  const stitchedWords: string[] = [];
  for (const transcript of transcripts) {
    const chunkWords = splitTranscriptWords(transcript);
    if (!chunkWords.length) {
      continue;
    }
    if (!stitchedWords.length) {
      stitchedWords.push(...chunkWords);
      continue;
    }
    const overlap = findTranscriptWordOverlap(stitchedWords, chunkWords);
    stitchedWords.push(...chunkWords.slice(overlap));
  }
  return stitchedWords.join(" ").replace(/\s+/g, " ").trim();
}

function createRepoRoot(defaultRepoRoot = process.cwd()) {
  return resolvePath(defaultRepoRoot);
}

function createDefaultModelRoots(repoRoot: string, settings?: DesktopSettingsSnapshot): string[] {
  const roots = [
    resolvePath(repoRoot, ".tools", "sherpa-onnx"),
    resolvePath(repoRoot, ".tools", "sherpa"),
    process.env.ABE_SHERPA_ONNX_MODEL_DIR,
    settings?.modelRoot ? resolvePath(settings.modelRoot, "speech", "sherpa-onnx") : "",
    settings?.modelRoot ? resolvePath(settings.modelRoot, "sherpa-onnx") : "",
    resolvePath(repoRoot, "..", "VoiceToTextCommands", ".tools", "sherpa-onnx"),
    resolvePath(repoRoot, "..", "VoiceToTextCommands", ".tools", "sherpa"),
  ];
  return [...new Set(roots.map(normalizeString).filter(Boolean))];
}

function findFirstExistingFile(root: string, names: string[]): string {
  for (const name of names) {
    const candidate = join(root, name);
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return "";
}

function findFirstPattern(root: string, prefix: string): string {
  try {
    const match = readdirSync(root)
      .filter((name) => name.toLowerCase().startsWith(prefix.toLowerCase()) && name.toLowerCase().endsWith(".onnx"))
      .sort()[0];
    return match ? join(root, match) : "";
  } catch {
    return "";
  }
}

function bundleFromDirectory(directory: string): RealtimeSpeechModelBundleDescriptor | null {
  const tokens = join(directory, "tokens.txt");
  if (!existsSync(tokens)) {
    return null;
  }

  for (const [encoderName, decoderName, joinerName] of SHERPA_MODEL_VARIANTS) {
    const encoder = join(directory, encoderName);
    const decoder = join(directory, decoderName);
    const joiner = join(directory, joinerName);
    if (existsSync(encoder) && existsSync(decoder) && existsSync(joiner)) {
      return { root: directory, tokens, encoder, decoder, joiner };
    }
  }

  const encoder = findFirstExistingFile(directory, ["encoder.onnx"]) || findFirstPattern(directory, "encoder");
  const decoder = findFirstExistingFile(directory, ["decoder.onnx"]) || findFirstPattern(directory, "decoder");
  const joiner = findFirstExistingFile(directory, ["joiner.onnx"]) || findFirstPattern(directory, "joiner");
  return encoder && decoder && joiner ? { root: directory, tokens, encoder, decoder, joiner } : null;
}

export function detectSherpaOnnxModelBundle(roots: string[]): RealtimeSpeechModelBundleDescriptor | null {
  const seen = new Set<string>();
  for (const root of roots.map(normalizeString).filter(Boolean)) {
    if (!existsSync(root)) {
      continue;
    }
    const rootStat = statSync(root);
    if (rootStat.isFile()) {
      const bundle = bundleFromDirectory(resolvePath(root, ".."));
      if (bundle) {
        return bundle;
      }
      continue;
    }
    const direct = bundleFromDirectory(root);
    if (direct) {
      return direct;
    }
    const stack = [root];
    while (stack.length) {
      const current = stack.pop() ?? "";
      if (!current || seen.has(current)) {
        continue;
      }
      seen.add(current);
      let entries: string[] = [];
      try {
        entries = readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        const candidate = join(current, entry);
        try {
          if (statSync(candidate).isDirectory()) {
            const bundle = bundleFromDirectory(candidate);
            if (bundle) {
              return bundle;
            }
            stack.push(candidate);
          }
        } catch {
          // Ignore transient filesystem errors while scanning local model folders.
        }
      }
    }
  }
  return null;
}

export function detectWhisperCppRuntime(repoRoot: string) {
  const whisperRoot = resolvePath(repoRoot, ".tools", "whisper");
  const binaryCandidates = ["whisper-cli.exe", "main.exe", "whisper-cli", "main"].map((name) => join(whisperRoot, name));
  // Intent: allow a test or local operator to pin a model while the default path chooses the best installed asset.
  const overrideModel = normalizeString(process.env.ABE_WHISPER_CPP_MODEL);
  const modelCandidates = [
    ...(overrideModel ? [resolvePath(whisperRoot, overrideModel)] : []),
    ...WHISPER_CPP_MODEL_PREFERENCE.map((name) => join(whisperRoot, name)),
  ];
  const binary = binaryCandidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? "";
  const model = modelCandidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? "";
  return {
    root: whisperRoot,
    binary,
    model,
    available: Boolean(binary && model),
  };
}

async function runWhisperCppTranscription({
  binary,
  model,
  audioPath,
  language = "",
  spawnProcess,
}: {
  binary: string;
  model: string;
  audioPath: string;
  language?: string;
  spawnProcess: typeof spawn;
}) {
  const outputBase = `${audioPath}.whisper`;
  const args = [
    "-m",
    model,
    "-f",
    audioPath,
    "-otxt",
    "-of",
    outputBase,
  ];
  const whisperLanguage = normalizeWhisperLanguage(language);
  if (whisperLanguage) {
    args.push("-l", whisperLanguage);
  }

  await new Promise<void>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const child = spawnProcess(binary, args, {
      windowsHide: true,
      stdio: "pipe",
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error((stderr || stdout || `whisper.cpp exited with code ${code}`).trim()));
    });
  });

  const transcriptPath = `${outputBase}.txt`;
  return existsSync(transcriptPath)
    ? readFileSync(transcriptPath, "utf8").replace(/\s+/g, " ").trim()
    : "";
}

async function runWhisperCppWordTimingTranscription({
  binary,
  model,
  audioPath,
  language = "",
  spawnProcess,
}: {
  binary: string;
  model: string;
  audioPath: string;
  language?: string;
  spawnProcess: typeof spawn;
}) {
  const outputBase = `${audioPath}.words`;
  const args = [
    "-m",
    model,
    "-f",
    audioPath,
    "-oj",
    "-ojf",
    "-sow",
    "-of",
    outputBase,
  ];
  const whisperLanguage = normalizeWhisperLanguage(language);
  if (whisperLanguage) {
    args.push("-l", whisperLanguage);
  }

  await new Promise<void>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    const child = spawnProcess(binary, args, {
      windowsHide: true,
      stdio: "pipe",
    });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error((stderr || stdout || `whisper.cpp exited with code ${code}`).trim()));
    });
  });

  const jsonPath = `${outputBase}.json`;
  const payload = existsSync(jsonPath) ? readFileSync(jsonPath, "utf8") : "";
  return parseWhisperCppJsonWordTimings(payload);
}

export function parseWhisperCppJsonWordTimings(value: unknown): {
  transcript: string;
  words: DesktopWhisperWordTiming[];
} {
  const payload = typeof value === "string"
    ? parseWhisperJsonPayload(value)
    : value;
  const transcription = Array.isArray((payload as { transcription?: unknown })?.transcription)
    ? (payload as { transcription: unknown[] }).transcription
    : [];
  const words: DesktopWhisperWordTiming[] = [];
  const transcriptParts: string[] = [];
  for (const segment of transcription) {
    const segmentRecord = segment && typeof segment === "object" ? segment as Record<string, unknown> : {};
    const segmentText = normalizeString(segmentRecord.text);
    if (segmentText) {
      transcriptParts.push(segmentText);
    }
    const tokens = Array.isArray(segmentRecord.tokens) ? segmentRecord.tokens : [];
    if (tokens.length) {
      words.push(...createWordTimingsFromWhisperTokens(tokens));
      continue;
    }
    words.push(...createWordTimingsFromWhisperSegment(segmentRecord));
  }

  return {
    transcript: transcriptParts.join(" ").replace(/\s+/g, " ").trim(),
    words: words
      .map((word, index) => ({ ...word, index }))
      .filter((word) => normalizeTranscriptWord(word.text)),
  };
}

function parseWhisperJsonPayload(value: string): unknown {
  const normalized = normalizeString(value);
  if (!normalized) {
    return {};
  }
  try {
    return JSON.parse(normalized);
  } catch {
    return {};
  }
}

function createWordTimingsFromWhisperSegment(segment: Record<string, unknown>): DesktopWhisperWordTiming[] {
  const text = normalizeString(segment.text);
  const words = splitTranscriptWords(text);
  const offsets = segment.offsets && typeof segment.offsets === "object"
    ? segment.offsets as Record<string, unknown>
    : {};
  const startMs = normalizeMilliseconds(offsets.from);
  const endMs = normalizeMilliseconds(offsets.to);
  if (!words.length || endMs <= startMs) {
    return [];
  }
  const wordDurationMs = (endMs - startMs) / words.length;
  return words.map((word, index) => ({
    index,
    text: word,
    startTimeSeconds: roundSeconds((startMs + (wordDurationMs * index)) / 1000),
    endTimeSeconds: roundSeconds((startMs + (wordDurationMs * (index + 1))) / 1000),
  }));
}

function createWordTimingsFromWhisperTokens(tokens: unknown[]): DesktopWhisperWordTiming[] {
  const words: DesktopWhisperWordTiming[] = [];
  let activeWord: {
    text: string;
    startMs: number;
    endMs: number;
    confidenceValues: number[];
  } | null = null;

  function commitActiveWord() {
    if (!activeWord) {
      return;
    }
    const text = activeWord.text.replace(/\s+/g, " ").trim();
    if (normalizeTranscriptWord(text) && activeWord.endMs > activeWord.startMs) {
      const confidenceValues = activeWord.confidenceValues.filter((value) => Number.isFinite(value));
      words.push({
        index: words.length,
        text,
        startTimeSeconds: roundSeconds(activeWord.startMs / 1000),
        endTimeSeconds: roundSeconds(activeWord.endMs / 1000),
        ...(confidenceValues.length
          ? { confidence: roundAudioNumber(confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length) }
          : {}),
      });
    }
    activeWord = null;
  }

  for (const token of tokens) {
    const tokenRecord = token && typeof token === "object" ? token as Record<string, unknown> : {};
    const tokenText = String(tokenRecord.text ?? "");
    if (isWhisperSpecialToken(tokenText)) {
      continue;
    }
    const pieces = splitWhisperTokenIntoWordPieces(tokenText);
    if (!pieces.length) {
      continue;
    }
    const offsets = tokenRecord.offsets && typeof tokenRecord.offsets === "object"
      ? tokenRecord.offsets as Record<string, unknown>
      : {};
    const tokenStartMs = normalizeMilliseconds(offsets.from);
    const tokenEndMs = Math.max(tokenStartMs, normalizeMilliseconds(offsets.to));
    const pieceDurationMs = pieces.length > 0 ? Math.max(0, tokenEndMs - tokenStartMs) / pieces.length : 0;
    const confidence = normalizeNullableNumber(tokenRecord.p);
    for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
      const piece = pieces[pieceIndex];
      const pieceStartMs = tokenStartMs + (pieceDurationMs * pieceIndex);
      const pieceEndMs = pieceIndex === pieces.length - 1
        ? tokenEndMs
        : tokenStartMs + (pieceDurationMs * (pieceIndex + 1));
      if (piece.startsNewWord || !activeWord) {
        commitActiveWord();
        activeWord = {
          text: piece.text,
          startMs: pieceStartMs,
          endMs: pieceEndMs,
          confidenceValues: [],
        };
      } else {
        activeWord.text += piece.text;
        activeWord.endMs = pieceEndMs;
      }
      if (activeWord && confidence !== null) {
        activeWord.confidenceValues.push(confidence);
      }
    }
  }
  commitActiveWord();
  return words;
}

function splitWhisperTokenIntoWordPieces(value: string): Array<{ text: string; startsNewWord: boolean }> {
  const pieces: Array<{ text: string; startsNewWord: boolean }> = [];
  const pattern = /(\s*)([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    pieces.push({
      text: match[2],
      startsNewWord: match[1].length > 0 || match.index > 0,
    });
  }
  return pieces;
}

function isWhisperSpecialToken(value: string): boolean {
  const normalized = normalizeString(value);
  return !normalized || /^\[[^\]]+\]$/.test(normalized);
}

function normalizeMilliseconds(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

async function runWhisperCppChunkedTranscription({
  binary,
  model,
  pcmPath,
  wavPath,
  sampleRate,
  channelCount,
  byteLength,
  language = "",
  spawnProcess,
}: {
  binary: string;
  model: string;
  pcmPath: string;
  wavPath: string;
  sampleRate: number;
  channelCount: number;
  byteLength: number;
  language?: string;
  spawnProcess: typeof spawn;
}) {
  const ranges = createWhisperChunkRanges({
    byteLength,
    sampleRate,
    channelCount,
  });
  if (ranges.length <= 1) {
    const transcript = await runWhisperCppTranscription({
      binary,
      model,
      audioPath: wavPath,
      language,
      spawnProcess,
    });
    return {
      transcript,
      cleanupMode: "single-window",
      chunkCount: ranges.length || 1,
      chunkWindowMs: WHISPER_CHUNK_WINDOW_MS,
      chunkOverlapMs: WHISPER_CHUNK_OVERLAP_MS,
    };
  }

  const pcm = existsSync(pcmPath) ? readFileSync(pcmPath) : Buffer.alloc(0);
  const transcripts: string[] = [];
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const chunkPath = `${wavPath}.chunk-${String(index + 1).padStart(4, "0")}.wav`;
    writePcm16WavChunk({
      pcm,
      wavPath: chunkPath,
      startByte: range.startByte,
      endByte: range.endByte,
      sampleRate,
      channelCount,
    });
    const transcript = await runWhisperCppTranscription({
      binary,
      model,
      audioPath: chunkPath,
      language,
      spawnProcess,
    });
    transcripts.push(transcript);
  }

  return {
    transcript: stitchWhisperChunkTranscripts(transcripts),
    cleanupMode: "sliding-window-overlap",
    chunkCount: ranges.length,
    chunkWindowMs: WHISPER_CHUNK_WINDOW_MS,
    chunkOverlapMs: WHISPER_CHUNK_OVERLAP_MS,
  };
}

export function createDesktopRealtimeSpeechBridge({
  getSettings = () => ({
    executionMode: "local-only",
    modelRoot: "",
    assetRoot: "",
    projectRoot: "",
    lastProjectFilePath: "",
    lastProjectFilePathExplicit: false,
  }),
  fetchImpl = globalThis.fetch,
  spawnProcess = spawn,
  now = () => new Date().toISOString(),
  repoRoot = process.cwd(),
  sidecarUrl = normalizeString(process.env.ABE_SHERPA_ONNX_SIDECAR_URL),
  sidecarPort = Number(process.env.ABE_SHERPA_ONNX_SIDECAR_PORT ?? DEFAULT_SIDECAR_PORT),
  pythonCommand = normalizeString(process.env.ABE_PYTHON) || "python",
  modelRoots = [],
}: DesktopRealtimeSpeechBridgeOptions = {}) {
  const resolvedRepoRoot = createRepoRoot(repoRoot);
  const sidecarScript = fileURLToPath(
    new URL("../../../services/audio/sidecars/sherpa_onnx_streaming_sidecar.py", import.meta.url),
  );
  const localSidecarUrl = sidecarUrl || `http://${DEFAULT_SIDECAR_HOST}:${sidecarPort || DEFAULT_SIDECAR_PORT}`;
  const realtimeTempRoot = resolvePath(resolvedRepoRoot, ".tmp", "realtime-speech");
  const sessions = new Map<string, DesktopRealtimeSpeechSessionRecord>();
  let sessionSequence = 0;
  let snapshotSequence = 0;
  let sidecarProcess: ChildProcessWithoutNullStreams | null = null;
  let sidecarStartPromise: Promise<boolean> | null = null;

  function resolveProviders() {
    const settings = getSettings();
    const sherpaBundle = detectSherpaOnnxModelBundle([
      ...modelRoots,
      ...createDefaultModelRoots(resolvedRepoRoot, settings),
    ]);
    const whisper = detectWhisperCppRuntime(resolvedRepoRoot);
    const sherpa = createSherpaOnnxRealtimeProviderDescriptor({
      runtimeAvailable: Boolean(sherpaBundle),
      modelBundle: sherpaBundle,
      provider: "cpu",
      unavailableReason: sherpaBundle
        ? ""
        : "No repo-local sherpa-onnx transducer bundle was found under .tools/sherpa-onnx.",
    });
    const whisperProvider = createWhisperCppWindowRealtimeProviderDescriptor({
      availability: whisper.available ? "ready" : "disabled",
      unavailableReason: whisper.available
        ? ""
        : "No repo-local whisper.cpp binary/model was found under .tools/whisper.",
    });
    return {
      sherpaBundle,
      whisper,
      providers: [sherpa, whisperProvider],
    };
  }

  async function requestSidecar(pathname: string, body?: unknown) {
    const response = await fetchImpl(new URL(pathname, localSidecarUrl).toString(), {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const responseText = await response.text();
    const parsed = responseText ? JSON.parse(responseText) : null;
    if (!response.ok || parsed?.ok === false) {
      throw new Error(parsed?.message || `sherpa sidecar request failed with status ${response.status}.`);
    }
    return parsed;
  }

  async function isSidecarHealthy() {
    try {
      const health = await requestSidecar("/health");
      return health?.ok === true && health.runtimeAvailable === true;
    } catch {
      return false;
    }
  }

  async function ensureSidecarStarted() {
    if (await isSidecarHealthy()) {
      return true;
    }
    if (sidecarStartPromise) {
      return sidecarStartPromise;
    }

    sidecarStartPromise = new Promise((resolve) => {
      let settled = false;
      try {
        sidecarProcess = spawnProcess(pythonCommand, [
          sidecarScript,
          "--host",
          DEFAULT_SIDECAR_HOST,
          "--port",
          String(sidecarPort || DEFAULT_SIDECAR_PORT),
        ], {
          cwd: resolvedRepoRoot,
          windowsHide: true,
          stdio: "pipe",
        });
      } catch {
        sidecarStartPromise = null;
        resolve(false);
        return;
      }

      const finish = (value: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        if (!value) {
          sidecarStartPromise = null;
        }
        resolve(value);
      };
      sidecarProcess.once("error", () => finish(false));
      sidecarProcess.once("exit", () => {
        if (!settled) {
          finish(false);
        }
        sidecarProcess = null;
        sidecarStartPromise = null;
      });

      const deadline = Date.now() + 5000;
      const poll = async () => {
        if (await isSidecarHealthy()) {
          finish(true);
          return;
        }
        if (Date.now() >= deadline) {
          sidecarProcess?.kill();
          sidecarProcess = null;
          sidecarStartPromise = null;
          finish(false);
          return;
        }
        setTimeout(() => {
          void poll();
        }, 150);
      };
      void poll();
    });
    return sidecarStartPromise;
  }

  function listProviders(): DesktopRealtimeSpeechBridgeResponse {
    const capability = resolveProviders();
    return {
      ok: true,
      statusCode: 200,
      providers: capability.providers,
      sidecar: {
        url: localSidecarUrl,
        started: sidecarProcess !== null,
      },
    };
  }

  // Intent: start repo-local sherpa tracking before the editor begins pushing PCM frames.
  async function startSession(input: DesktopRealtimeSpeechStartInput): Promise<DesktopRealtimeSpeechBridgeResponse> {
    const capability = resolveProviders();
    const provider = capability.providers.find((candidate) => candidate.id === SHERPA_PROVIDER_ID);
    if (!capability.sherpaBundle || provider?.availability !== "ready") {
      return {
        ok: false,
        statusCode: 503,
        message: provider?.unavailableReason || "Local sherpa-onnx provider is unavailable.",
        providers: capability.providers,
      };
    }

    const sidecarReady = await ensureSidecarStarted();
    if (!sidecarReady) {
      return {
        ok: false,
        statusCode: 503,
        message: "Local sherpa-onnx sidecar could not start. Confirm Python can import sherpa_onnx and numpy.",
        providers: capability.providers,
      };
    }

    let sidecarSession;
    try {
      sidecarSession = await requestSidecar("/sessions/start", {
        modelBundle: capability.sherpaBundle,
        sampleRate: normalizePositiveInteger(input.sampleRate, 16000),
        channelCount: normalizePositiveInteger(input.channelCount, 1),
        language: normalizeString(input.language) || "en-US",
      });
    } catch (error) {
      return {
        ok: false,
        statusCode: 502,
        message: error instanceof Error ? error.message : "Local sherpa-onnx sidecar session start failed.",
        providers: capability.providers,
      };
    }
    sessionSequence += 1;
    const timestamp = now();
    const sessionId = `desktop-realtime-speech-${String(sessionSequence).padStart(4, "0")}`;
    mkdirSync(realtimeTempRoot, { recursive: true });
    const session: DesktopRealtimeSpeechSessionRecord = {
      id: sessionId,
      sidecarSessionId: normalizeString(sidecarSession.sessionId),
      pcmPath: join(realtimeTempRoot, `${sessionId}.pcm`),
      wavPath: join(realtimeTempRoot, `${sessionId}.wav`),
      pcmByteLength: 0,
      projectId: normalizeString(input.projectId),
      recordingId: normalizeString(input.recordingId),
      sceneId: normalizeString(input.sceneId),
      ...(normalizeString(input.blockId) ? { blockId: normalizeString(input.blockId) } : {}),
      providerId: SHERPA_PROVIDER_ID,
      status: "listening",
      language: normalizeString(input.language) || "en-US",
      sampleRate: normalizePositiveInteger(input.sampleRate, 16000),
      channelCount: normalizePositiveInteger(input.channelCount, 1),
      startedAt: timestamp,
      updatedAt: timestamp,
    };
    // Intent: reset reused temp paths so a restarted desktop bridge cannot append new speech onto stale PCM.
    writeFileSync(session.pcmPath, Buffer.alloc(0));
    sessions.set(session.id, cloneValue(session));
    return {
      ok: true,
      statusCode: 200,
      providers: capability.providers,
      session: cloneValue(session),
      sidecar: {
        url: localSidecarUrl,
        started: true,
      },
    };
  }

  // Intent: pass raw PCM frames to sherpa and normalize returned transcript fragments for manuscript alignment.
  async function acceptAudioFrame(input: DesktopRealtimeSpeechAudioFrameInput): Promise<DesktopRealtimeSpeechBridgeResponse> {
    const sessionId = normalizeString(input.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        ok: false,
        statusCode: 404,
        message: `Unknown realtime speech session '${sessionId}'.`,
      };
    }
    const pcmFrame = Buffer.from(normalizeString(input.pcm16Base64), "base64");
    if (pcmFrame.byteLength > 0) {
      appendFileSync(session.pcmPath, pcmFrame);
      session.pcmByteLength += pcmFrame.byteLength;
    }

    if (input.skipLiveDecode === true) {
      const timestamp = now();
      const nextSession: DesktopRealtimeSpeechSessionRecord = {
        ...session,
        updatedAt: timestamp,
      };
      sessions.set(session.id, cloneValue(nextSession));
      return {
        ok: true,
        statusCode: 200,
        session: cloneValue(nextSession),
        message: "Realtime speech audio chunk archived without live decode.",
      };
    }

    let sidecarResult;
    try {
      sidecarResult = await requestSidecar(`/sessions/${session.sidecarSessionId}/audio`, {
        pcm16Base64: normalizeString(input.pcm16Base64),
        sampleRate: normalizePositiveInteger(input.sampleRate, session.sampleRate),
        channelCount: normalizePositiveInteger(input.channelCount, session.channelCount),
        sequence: normalizePositiveInteger(input.sequence, 1),
        capturedAtMs: Number(input.capturedAtMs) || Date.now(),
      });
    } catch (error) {
      return {
        ok: false,
        statusCode: 502,
        message: error instanceof Error ? error.message : "Local sherpa-onnx sidecar audio frame failed.",
        session: cloneValue(session),
      };
    }
    const segments = Array.isArray(sidecarResult.segments)
      ? sidecarResult.segments as RealtimeSpeechTranscriptSegment[]
      : [];
    snapshotSequence += 1;
    const timestamp = now();
    const transcriptSnapshot = createRealtimeSpeechTranscriptSnapshot({
      sessionId: session.id,
      providerId: session.providerId,
      sequence: snapshotSequence,
      segments,
      resultIndex: 0,
      isEndpoint: sidecarResult.isEndpoint === true,
      receivedAt: timestamp,
    });
    const nextSession: DesktopRealtimeSpeechSessionRecord = {
      ...session,
      status: transcriptSnapshot.isEndpoint ? "paused" : "listening",
      transcriptSnapshot,
      updatedAt: timestamp,
    };
    sessions.set(session.id, cloneValue(nextSession));
    return {
      ok: true,
      statusCode: 200,
      session: cloneValue(nextSession),
      transcriptSnapshot,
    };
  }

  // Intent: stop local live tracking so whisper.cpp can own final transcript cleanup.
  async function stopSession(input: DesktopRealtimeSpeechStopInput): Promise<DesktopRealtimeSpeechBridgeResponse> {
    const sessionId = normalizeString(input.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        ok: true,
        statusCode: 200,
        message: "Realtime speech session was already stopped.",
      };
    }

    let transcriptSnapshot = session.transcriptSnapshot;
    try {
      const sidecarResult = await requestSidecar(`/sessions/${session.sidecarSessionId}/stop`, {});
      const segments = Array.isArray(sidecarResult.segments)
        ? sidecarResult.segments as RealtimeSpeechTranscriptSegment[]
        : [];
      if (segments.length) {
        snapshotSequence += 1;
        transcriptSnapshot = createRealtimeSpeechTranscriptSnapshot({
          sessionId: session.id,
          providerId: session.providerId,
          sequence: snapshotSequence,
          segments,
          resultIndex: 0,
          isEndpoint: true,
          receivedAt: now(),
        });
      }
    } catch {
      // Stop is best-effort; final cleanup belongs to whisper.cpp.
    }

    const timestamp = now();
    const whisper = detectWhisperCppRuntime(resolvedRepoRoot);
    let finalTranscript = normalizeString(transcriptSnapshot?.transcript);
    let whisperErrorMessage = "";
    let whisperCleanupMode = "unavailable";
    let whisperChunkCount = 0;
    let whisperChunkWindowMs = WHISPER_CHUNK_WINDOW_MS;
    let whisperChunkOverlapMs = WHISPER_CHUNK_OVERLAP_MS;
    let wavPath = "";
    if (session.pcmByteLength > 0) {
      wavPath = writePcm16Wav({
        pcmPath: session.pcmPath,
        wavPath: session.wavPath,
        sampleRate: session.sampleRate,
        channelCount: session.channelCount,
        byteLength: session.pcmByteLength,
      });
      if (whisper.available) {
        try {
          const cleanup = await runWhisperCppChunkedTranscription({
            binary: whisper.binary,
            model: whisper.model,
            pcmPath: session.pcmPath,
            wavPath,
            sampleRate: session.sampleRate,
            channelCount: session.channelCount,
            byteLength: session.pcmByteLength,
            language: session.language,
            spawnProcess,
          });
          whisperCleanupMode = cleanup.cleanupMode;
          whisperChunkCount = cleanup.chunkCount;
          whisperChunkWindowMs = cleanup.chunkWindowMs;
          whisperChunkOverlapMs = cleanup.chunkOverlapMs;
          finalTranscript = cleanup.transcript || finalTranscript;
        } catch (error) {
          whisperErrorMessage = error instanceof Error ? error.message : String(error ?? "");
        }
      }
    }

    const nextSession: DesktopRealtimeSpeechSessionRecord = {
      ...session,
      status: normalizeString(input.errorMessage) ? "failed" : "stopped",
      ...(transcriptSnapshot ? { transcriptSnapshot } : {}),
      ...(normalizeString(input.errorMessage) ? { errorMessage: normalizeString(input.errorMessage) } : {}),
      updatedAt: timestamp,
    };
    sessions.delete(session.id);
    return {
      ok: true,
      statusCode: 200,
      session: cloneValue(nextSession),
      ...(transcriptSnapshot ? { transcriptSnapshot } : {}),
      finalTranscript,
      whisper: {
        available: whisper.available,
        audioPath: wavPath,
        binary: whisper.binary,
        model: whisper.model,
        cleanupMode: whisperCleanupMode,
        chunkCount: whisperChunkCount,
        chunkWindowMs: whisperChunkWindowMs,
        chunkOverlapMs: whisperChunkOverlapMs,
        ...(whisperErrorMessage ? { errorMessage: whisperErrorMessage } : {}),
      },
    };
  }

  // Intent: provide saved-take review with model-produced word timings without exposing whisper.cpp to editor UI code.
  async function createWhisperCppWordTimings(input: DesktopWhisperWordTimingInput): Promise<DesktopRealtimeSpeechBridgeResponse> {
    const wavBase64 = normalizeString(input.wavBase64);
    if (!wavBase64) {
      return {
        ok: false,
        statusCode: 400,
        message: "A WAV payload is required for local word timing.",
      };
    }

    const whisper = detectWhisperCppRuntime(resolvedRepoRoot);
    if (!whisper.available) {
      return {
        ok: false,
        statusCode: 503,
        message: "No repo-local whisper.cpp binary/model was found under .tools/whisper.",
        whisper: {
          available: false,
          binary: whisper.binary,
          model: whisper.model,
        },
      };
    }

    try {
      const tempRoot = join(resolvedRepoRoot, ".tmp", "realtime-speech", "word-timings");
      mkdirSync(tempRoot, { recursive: true });
      const fileToken = `${normalizeSafeFileToken(input.recordingId)}-${normalizeSafeFileToken(input.transcriptHash, "hash")}-${Date.now()}`;
      const wavPath = join(tempRoot, `${fileToken}.wav`);
      writeFileSync(wavPath, Buffer.from(wavBase64, "base64"));
      const wordTimingResult = await runWhisperCppWordTimingTranscription({
        binary: whisper.binary,
        model: whisper.model,
        audioPath: wavPath,
        language: input.language,
        spawnProcess,
      });

      return {
        ok: true,
        statusCode: 200,
        providerId: WHISPER_WORD_TIMING_PROVIDER_ID,
        transcript: wordTimingResult.transcript,
        words: wordTimingResult.words,
        whisper: {
          available: true,
          binary: whisper.binary,
          model: whisper.model,
          cleanupMode: "word-timestamps",
          audioPath: wavPath,
        },
      };
    } catch (error) {
      return {
        ok: false,
        statusCode: 500,
        message: error instanceof Error ? error.message : "Unable to create local word timings.",
        whisper: {
          available: true,
          binary: whisper.binary,
          model: whisper.model,
          cleanupMode: "word-timestamps",
          errorMessage: error instanceof Error ? error.message : String(error ?? ""),
        },
      };
    }
  }

  return {
    listProviders,
    startSession,
    acceptAudioFrame,
    stopSession,
    createWhisperCppWordTimings,
    detectWhisperCppRuntime: () => detectWhisperCppRuntime(resolvedRepoRoot),
    getSidecarUrl: () => localSidecarUrl,
  };
}

export function createWhisperCppCapability(repoRoot = process.cwd()) {
  const whisper = detectWhisperCppRuntime(repoRoot);
  return {
    ok: true,
    providerId: WHISPER_PROVIDER_ID,
    available: whisper.available,
    binary: whisper.binary,
    model: whisper.model,
    root: whisper.root,
    requiresInternet: false,
    mode: "final-cleanup",
  };
}
