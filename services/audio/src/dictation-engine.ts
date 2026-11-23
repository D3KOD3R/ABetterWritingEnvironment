// Dictation owns this provider process and bounded PCM queue; Follow never shares its session.
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createDictationJournal } from "./dictation-journal.ts";
import type { SpeechCaptureFrame, SpeechRecognitionEvent } from "../../../packages/shared-types/src/speech-events.ts";

const adapter = fileURLToPath(new URL("../sidecars/moonshine_dictation.py", import.meta.url));
export const DICTATION_MAX_SAMPLES = 16000 * 240;

function startAdapter(python: string, args: string[]) {
  const child = spawn(python, [adapter, ...args], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let pending: { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let failure: Error | null = null;
  let stderr = "";
  child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-2000); });
  function fail(error: Error) { failure = error; if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; } }
  const reader = createInterface({ input: child.stdout });
  reader.on("line", (line) => {
    try {
      if (line.length > 1_000_000) throw new Error("Oversized speech response.");
      const result = JSON.parse(line);
      if (result.error) throw new Error(result.error);
      if (!pending) throw new Error("Unsolicited speech response.");
      const current = pending; pending = null; clearTimeout(current.timer); current.resolve(result);
    } catch (error) { fail(error as Error); child.kill(); }
  });
  child.on("error", fail);
  child.on("exit", (code) => { if (pending || code !== 0) fail(new Error(`Speech runtime exited (${code}): ${stderr}`)); });
  function next() {
    if (failure) return Promise.reject(failure);
    if (pending) return Promise.reject(new Error("Speech request already pending."));
    return new Promise<any>((resolve, reject) => {
      pending = { resolve, reject, timer: setTimeout(() => { fail(new Error("Speech runtime timed out.")); child.kill(); }, 30000) };
    });
  }
  return { ready: next(), async request(value: unknown) { const response = next(); child.stdin.write(JSON.stringify(value) + "\n", (error) => { if (error) fail(error); }); return response; }, close() { child.kill(); reader.close(); } };
}

// Load the actual pinned model without opening a microphone or persisting a session.
export async function probeDictationModel(path: string, python = "python") {
  const rpc = startAdapter(python, [path]);
  try { await rpc.ready; return { ready: true, message: "Selected model verified and loadable." }; }
  catch (error) { return { ready: false, message: (error as Error).message }; }
  finally { rpc.close(); }
}

export async function probeDictationRuntime(python = "python") {
  const rpc = startAdapter(python, ["--probe"]);
  try {
    const runtime = await rpc.ready;
    try {
      const samples = Buffer.alloc(320);
      await verifyFlac(await encodeFlac(samples), samples);
      return { ...runtime, recordingReady: true, recordingEncoding: "flac" };
    } catch (error) { return { ...runtime, recordingReady: false, recordingMessage: (error as Error).message }; }
  }
  catch (error) { return { ready: false, runtime: "moonshine-voice==0.1.6", backend: "cpu", message: (error as Error).message }; }
  finally { rpc.close(); }
}

async function encodeFlac(pcm: Buffer, ffmpeg = "ffmpeg") {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", "16000", "-ac", "1", "-i", "pipe:0", "-c:a", "flac", "-f", "flac", "pipe:1"], { windowsHide: true });
    const chunks: Buffer[] = []; let length = 0; let stderr = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("FLAC encoding timed out.")); }, 30000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.stdout.on("data", (chunk) => { length += chunk.length; if (length > pcm.length + 100000) { child.kill(); reject(new Error("Invalid FLAC output size.")); } else chunks.push(chunk); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-2000); });
    child.stdin.on("error", () => {});
    child.on("close", (code) => { clearTimeout(timer); const bytes = Buffer.concat(chunks); if (code !== 0 || bytes.subarray(0, 4).toString() !== "fLaC") reject(new Error(`FLAC encoder failed: ${stderr}`)); else resolve(bytes); });
    child.stdin.end(pcm);
  });
}

async function verifyFlac(flac: Buffer, pcm: Buffer) {
  // Publication requires decoded sample equality, not just a FLAC magic header or successful encoder exit.
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "flac", "-i", "pipe:0", "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"], { windowsHide: true });
    let offset = 0; let mismatch = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error("FLAC verification timed out.")); }, 30000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.stdout.on("data", (chunk: Buffer) => { if (!chunk.equals(pcm.subarray(offset, offset + chunk.length))) mismatch = true; offset += chunk.length; if (offset > pcm.length) child.kill(); });
    child.stderr.resume(); child.stdin.on("error", () => {});
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0 || mismatch || offset !== pcm.length) reject(new Error("FLAC decoded samples do not match capture.")); else resolve(); });
    child.stdin.end(flac);
  });
}

export function createDictationEngine({ openAdapter = startAdapter, encodeRecording = encodeFlac, verifyRecording = verifyFlac } = {}) {
  let current: any = null;
  let starting = false;
  return {
    isActive: () => starting || Boolean(current),
    async start({ projectId, sceneId, lease, python = "python", saveRecording = false }: any) {
      if (starting || current) { lease.release(); throw new Error("Dictation already owns capture."); }
      starting = true;
      const rpc = openAdapter(python, [lease.path]);
      try {
        const ready = await rpc.ready;
        const identity = { sessionId: randomUUID(), projectId, sceneId, captureEpoch: randomUUID() };
        current = { ...identity, rpc, lease, runtimeVersion: `${ready.runtime}/native-${ready.nativeVersion}`, startedAt: new Date().toISOString(), saveRecording, sequence: 0, sampleCount: 0, sourceEnd: 0, sourceSampleRate: null, busy: false, pcm: [], journal: createDictationJournal(identity), failure: null };
        return { ...identity, runtimeVersion: current.runtimeVersion, maxSamples: DICTATION_MAX_SAMPLES };
      } catch (error) { rpc.close(); lease.release(); throw error; }
      finally { starting = false; }
    },
    async audio(frame: SpeechCaptureFrame) {
      const session = current;
      if (!session || frame.sessionId !== session.sessionId || frame.captureEpoch !== session.captureEpoch) throw new Error("Stale dictation capture.");
      if (session.busy || session.failure) throw new Error("Dictation is busy or failed; stop and preserve this session.");
      const pcm = Buffer.from(frame.pcm16Base64, "base64");
      if (frame.sequence !== session.sequence || frame.startSample !== session.sampleCount || frame.sampleRate !== 16000
        || !pcm.length || pcm.length % 2 || pcm.length > 32000 || frame.endSample !== frame.startSample + pcm.length / 2
        || frame.endSample > DICTATION_MAX_SAMPLES || frame.sourceStartSample !== session.sourceEnd
        || !Number.isSafeInteger(frame.sourceEndSample) || frame.sourceEndSample <= frame.sourceStartSample
        || !Number.isSafeInteger(frame.sourceSampleRate) || frame.sourceSampleRate < 16000 || frame.sourceSampleRate > 192000
        || (session.sourceSampleRate && session.sourceSampleRate !== frame.sourceSampleRate)) throw new Error("Discontinuous or oversized dictation audio.");
      session.busy = true;
      // Keep accepted PCM even if inference fails, so Stop can still preserve the recording.
      session.pcm.push(pcm); session.sequence++; session.sampleCount = frame.endSample;
      session.sourceEnd = frame.sourceEndSample; session.sourceSampleRate = frame.sourceSampleRate;
      try {
        const response = await session.rpc.request({ type: "audio", pcm16Base64: frame.pcm16Base64 });
        for (const event of response.events ?? []) session.journal.accept({ ...event, ...identityOf(session), modelId: session.lease.model.id, modelRevision: session.lease.model.revision, runtimeVersion: session.runtimeVersion } as SpeechRecognitionEvent);
        return { sampleCount: session.sampleCount, events: session.journal.snapshot() };
      } catch (error) { session.failure = (error as Error).message; throw error; }
      finally { session.busy = false; }
    },
    async stop(sessionId: string, captureFailure = "") {
      const session = current;
      if (!session || session.sessionId !== sessionId || session.busy) throw new Error("Session is missing or still receiving audio.");
      session.busy = true;
      try {
        if (!session.finalized && !session.failure) {
          try {
            const response = await session.rpc.request({ type: "stop" });
            for (const event of response.events ?? []) session.journal.accept({ ...event, ...identityOf(session), modelId: session.lease.model.id, modelRevision: session.lease.model.revision, runtimeVersion: session.runtimeVersion });
          } catch (error) { session.failure = (error as Error).message; }
        }
        // Encoding can be retried without asking the already closed recognizer to finalize again.
        session.finalized = true;
        session.rpc.close();
        const pcm = Buffer.concat(session.pcm);
        const flac = await encodeRecording(pcm);
        await verifyRecording(flac, pcm);
        const record = { schemaVersion: 1, id: session.sessionId, projectId: session.projectId, sceneId: session.sceneId, captureEpoch: session.captureEpoch, startedAt: session.startedAt, endedAt: new Date().toISOString(), status: session.failure || captureFailure ? "failed" : "stopped", retention: session.saveRecording ? "manual-deletion" : "awaiting-durable-text", sampleRate: 16000, sampleCount: session.sampleCount, sourceSampleRate: session.sourceSampleRate, sourceSampleCount: session.sourceEnd, resampling: "capture-worklet-box-v1", modelId: session.lease.model.id, modelRevision: session.lease.model.revision, runtimeVersion: session.runtimeVersion, events: session.journal.snapshot(), recording: { projectRelativePath: `assets/audio/dictation-${session.sessionId}.flac`, encoding: "flac", bytes: flac.length, sha256: createHash("sha256").update(flac).digest("hex"), startSample: 0, endSample: session.sampleCount } };
        session.journal.close(); session.lease.release(); current = null;
        return { record, contentBase64: flac.toString("base64"), message: session.failure || captureFailure };
      } finally { session.busy = false; }
    },
  };
}
function identityOf(session: any) { return { sessionId: session.sessionId, projectId: session.projectId, sceneId: session.sceneId, captureEpoch: session.captureEpoch }; }
