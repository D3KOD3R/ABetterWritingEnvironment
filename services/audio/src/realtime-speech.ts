// Intent: model realtime speech provider selection and transcript snapshots behind the audio service boundary.
import type {
  AcceptRealtimeSpeechSnapshotInput,
  ProviderAvailability,
  RealtimeSpeechModelBundleDescriptor,
  RealtimeSpeechProviderDescriptor,
  RealtimeSpeechSessionSnapshot,
  RealtimeSpeechTranscriptSegment,
  RealtimeSpeechTranscriptSnapshot,
  StartRealtimeSpeechSessionInput,
  StopRealtimeSpeechSessionInput,
} from "../../../packages/shared-types/src/index.ts";

export interface AudioRealtimeLogger {
  isEnabled?: () => boolean;
  debug?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

export interface RealtimeSpeechSessionCoordinator {
  listProviders(): RealtimeSpeechProviderDescriptor[];
  getSession(sessionId: string): RealtimeSpeechSessionSnapshot | null;
  startSession(input: StartRealtimeSpeechSessionInput): RealtimeSpeechSessionSnapshot;
  acceptTranscriptSnapshot(input: AcceptRealtimeSpeechSnapshotInput): RealtimeSpeechSessionSnapshot;
  stopSession(input: StopRealtimeSpeechSessionInput): RealtimeSpeechSessionSnapshot | null;
}

export const SHERPA_ONNX_REALTIME_PROVIDER_ID = "local-sherpa-onnx";
export const BROWSER_WEB_SPEECH_PROVIDER_ID = "browser-web-speech";
export const WHISPER_CPP_WINDOW_PROVIDER_ID = "whisper-cpp-window";

function normalizeString(candidate: unknown): string {
  return typeof candidate === "string" ? candidate.trim() : "";
}

function normalizeTranscript(candidate: unknown): string {
  return normalizeString(candidate).replace(/\s+/g, " ").trim();
}

function normalizePositiveInteger(candidate: unknown, fallback: number): number {
  const value = Math.round(Number(candidate));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeAvailability(candidate: unknown, fallback: ProviderAvailability = "disabled"): ProviderAvailability {
  return candidate === "ready" || candidate === "disabled" ? candidate : fallback;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emitRealtimeSpeechLog(
  logger: AudioRealtimeLogger | null | undefined,
  level: "debug" | "info" | "warn",
  event: string,
  message: string,
  context: Record<string, unknown> = {},
) {
  if (
    !logger ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  const sink = logger[level];
  if (typeof sink !== "function") {
    return;
  }

  sink.call(logger, "realtime-speech", event, message, context);
}

function normalizeModelBundle(candidate: Partial<RealtimeSpeechModelBundleDescriptor> | null | undefined) {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const root = normalizeString(candidate.root);
  if (!root) {
    return undefined;
  }

  const bundle: RealtimeSpeechModelBundleDescriptor = { root };
  const tokens = normalizeString(candidate.tokens);
  const encoder = normalizeString(candidate.encoder);
  const decoder = normalizeString(candidate.decoder);
  const joiner = normalizeString(candidate.joiner);
  if (tokens) {
    bundle.tokens = tokens;
  }
  if (encoder) {
    bundle.encoder = encoder;
  }
  if (decoder) {
    bundle.decoder = decoder;
  }
  if (joiner) {
    bundle.joiner = joiner;
  }
  return bundle;
}

export function createBrowserWebSpeechRealtimeProviderDescriptor({
  availability = "ready",
  unavailableReason = "",
} = {}): RealtimeSpeechProviderDescriptor {
  return {
    id: BROWSER_WEB_SPEECH_PROVIDER_ID,
    label: "Browser Web Speech",
    kind: "browser-web-speech",
    availability: normalizeAvailability(availability, "ready"),
    executionMode: "hybrid",
    streamingMode: "browser-managed",
    requiresInternet: true,
    engine: "web-speech-api",
    fallbackProviderId: "",
    ...(normalizeString(unavailableReason) ? { unavailableReason: normalizeString(unavailableReason) } : {}),
  };
}

export function createWhisperCppWindowRealtimeProviderDescriptor({
  availability = "disabled",
  unavailableReason = "Whisper windowed streaming is reserved for recovery and should not be the primary live cursor.",
} = {}): RealtimeSpeechProviderDescriptor {
  return {
    id: WHISPER_CPP_WINDOW_PROVIDER_ID,
    label: "Whisper.cpp Windowed Recovery",
    kind: "whisper-cpp-window",
    availability: normalizeAvailability(availability, "disabled"),
    executionMode: "local-only",
    streamingMode: "chunked-window",
    requiresInternet: false,
    engine: "whisper.cpp",
    fallbackProviderId: BROWSER_WEB_SPEECH_PROVIDER_ID,
    unavailableReason: normalizeString(unavailableReason),
  };
}

export function createSherpaOnnxRealtimeProviderDescriptor({
  runtimeAvailable = false,
  modelBundle = undefined,
  provider = "cpu",
  unavailableReason = "",
}: {
  runtimeAvailable?: boolean;
  modelBundle?: Partial<RealtimeSpeechModelBundleDescriptor> | null;
  provider?: string;
  unavailableReason?: string;
} = {}): RealtimeSpeechProviderDescriptor {
  const bundle = normalizeModelBundle(modelBundle);
  const hasTransducerBundle = Boolean(bundle?.root && bundle.tokens && bundle.encoder && bundle.decoder && bundle.joiner);
  const availability = runtimeAvailable && hasTransducerBundle ? "ready" : "disabled";
  const reason = availability === "ready"
    ? ""
    : normalizeString(unavailableReason)
      || (!runtimeAvailable
        ? "sherpa-onnx runtime is not available in the desktop audio sidecar."
        : "sherpa-onnx transducer model bundle is incomplete.");

  return {
    id: SHERPA_ONNX_REALTIME_PROVIDER_ID,
    label: "Local sherpa-onnx Streaming",
    kind: "local-sherpa-onnx",
    availability,
    executionMode: "local-only",
    streamingMode: "true-streaming",
    requiresInternet: false,
    engine: `sherpa-onnx:${normalizeString(provider) || "cpu"}`,
    fallbackProviderId: BROWSER_WEB_SPEECH_PROVIDER_ID,
    ...(bundle ? { modelBundle: bundle } : {}),
    ...(reason ? { unavailableReason: reason } : {}),
  };
}

export function createDisabledRealtimeProviderDescriptor(reason = "Realtime speech tracking is disabled."): RealtimeSpeechProviderDescriptor {
  return {
    id: "disabled-realtime-speech",
    label: "Realtime Speech Disabled",
    kind: "disabled",
    availability: "disabled",
    executionMode: "local-only",
    streamingMode: "none",
    requiresInternet: false,
    engine: "none",
    unavailableReason: normalizeString(reason) || "Realtime speech tracking is disabled.",
  };
}

export function selectRealtimeSpeechProvider(
  providers: RealtimeSpeechProviderDescriptor[],
  preferredProviderId = "",
): RealtimeSpeechProviderDescriptor {
  const normalizedPreferredProviderId = normalizeString(preferredProviderId);
  const safeProviders = providers.length ? providers : [createDisabledRealtimeProviderDescriptor()];
  const preferred = normalizedPreferredProviderId
    ? safeProviders.find((provider) => provider.id === normalizedPreferredProviderId)
    : null;
  if (preferred?.availability === "ready") {
    return cloneValue(preferred);
  }

  const localStreaming = safeProviders.find(
    (provider) => provider.kind === "local-sherpa-onnx" && provider.availability === "ready",
  );
  if (localStreaming) {
    return cloneValue(localStreaming);
  }

  const browserFallback = safeProviders.find(
    (provider) => provider.kind === "browser-web-speech" && provider.availability === "ready",
  );
  if (browserFallback) {
    return cloneValue(browserFallback);
  }

  const readyProvider = safeProviders.find((provider) => provider.availability === "ready");
  return cloneValue(readyProvider ?? preferred ?? safeProviders[0]);
}

export function createRealtimeSpeechTranscriptSnapshot({
  sessionId = "",
  providerId = "",
  sequence = 0,
  segments = [],
  resultIndex = 0,
  isEndpoint = false,
  receivedAt = new Date().toISOString(),
}: {
  sessionId?: string;
  providerId?: string;
  sequence?: number;
  segments?: RealtimeSpeechTranscriptSegment[];
  resultIndex?: number;
  isEndpoint?: boolean;
  receivedAt?: string;
} = {}): RealtimeSpeechTranscriptSnapshot {
  const normalizedSegments = Array.isArray(segments)
    ? segments
      .map((segment, index) => ({
        index: Number.isInteger(segment?.index) ? Math.max(0, segment.index) : index,
        transcript: normalizeTranscript(segment?.transcript),
        isFinal: segment?.isFinal === true,
        confidence: Number.isFinite(Number(segment?.confidence)) ? Number(segment.confidence) : null,
      }))
      .filter((segment) => segment.transcript)
      .sort((left, right) => left.index - right.index)
    : [];
  const safeResultIndex = Math.max(0, Math.min(
    normalizedSegments.length,
    Math.floor(Number(resultIndex) || 0),
  ));
  const finalSegments = normalizedSegments.filter((segment) => segment.isFinal);
  const interimSegments = normalizedSegments.filter((segment) => !segment.isFinal);

  return {
    sessionId: normalizeString(sessionId),
    providerId: normalizeString(providerId),
    sequence: normalizePositiveInteger(sequence, 1),
    transcript: normalizeTranscript(normalizedSegments.map((segment) => segment.transcript).join(" ")),
    finalTranscript: normalizeTranscript(finalSegments.map((segment) => segment.transcript).join(" ")),
    interimTranscript: normalizeTranscript(interimSegments.map((segment) => segment.transcript).join(" ")),
    changedTranscript: normalizeTranscript(
      normalizedSegments
        .filter((segment) => segment.index >= safeResultIndex)
        .map((segment) => segment.transcript)
        .join(" "),
    ),
    segmentCount: normalizedSegments.length,
    finalSegmentCount: finalSegments.length,
    interimSegmentCount: interimSegments.length,
    resultIndex: safeResultIndex,
    isEndpoint: isEndpoint === true,
    receivedAt: normalizeString(receivedAt) || new Date(0).toISOString(),
  };
}

export function createRealtimeSpeechSessionCoordinator({
  providers = [
    createSherpaOnnxRealtimeProviderDescriptor(),
    createWhisperCppWindowRealtimeProviderDescriptor(),
  ],
  logger = null,
  now = () => new Date().toISOString(),
}: {
  providers?: RealtimeSpeechProviderDescriptor[];
  logger?: AudioRealtimeLogger | null;
  now?: () => string;
} = {}): RealtimeSpeechSessionCoordinator {
  const sessions = new Map<string, RealtimeSpeechSessionSnapshot>();
  let sessionSequence = 0;
  let snapshotSequence = 0;

  function listProviders() {
    return providers.map((provider) => cloneValue(provider));
  }

  function getSession(sessionId: string) {
    const session = sessions.get(normalizeString(sessionId));
    return session ? cloneValue(session) : null;
  }

  // Intent: start a realtime speech session against the best available provider without exposing engine internals.
  function startSession(input: StartRealtimeSpeechSessionInput): RealtimeSpeechSessionSnapshot {
    sessionSequence += 1;
    const timestamp = normalizeString(input.now) || now();
    const provider = selectRealtimeSpeechProvider(providers, input.preferredProviderId);
    const status = provider.availability === "ready" ? "listening" : "failed";
    const session: RealtimeSpeechSessionSnapshot = {
      id: `realtime-speech-session-${String(sessionSequence).padStart(4, "0")}`,
      projectId: normalizeString(input.projectId),
      recordingId: normalizeString(input.recordingId),
      sceneId: normalizeString(input.sceneId),
      ...(normalizeString(input.blockId) ? { blockId: normalizeString(input.blockId) } : {}),
      providerId: provider.id,
      status,
      language: normalizeString(input.language) || "en-US",
      sampleRate: normalizePositiveInteger(input.sampleRate, 16000),
      channelCount: normalizePositiveInteger(input.channelCount, 1),
      startedAt: timestamp,
      updatedAt: timestamp,
      ...(status === "failed" ? { errorMessage: provider.unavailableReason ?? "Realtime speech provider is unavailable." } : {}),
    };
    sessions.set(session.id, cloneValue(session));
    emitRealtimeSpeechLog(
      logger,
      status === "failed" ? "warn" : "info",
      "realtime-speech.session-started",
      status === "failed"
        ? "Realtime speech session could not start because the selected provider is unavailable."
        : "Realtime speech session started.",
      {
        sessionId: session.id,
        recordingId: session.recordingId,
        providerId: provider.id,
        providerKind: provider.kind,
        status,
        requiresInternet: provider.requiresInternet,
      },
    );
    return cloneValue(session);
  }

  // Intent: fold provider transcript fragments into a stable snapshot shape the aligner can consume.
  function acceptTranscriptSnapshot(input: AcceptRealtimeSpeechSnapshotInput): RealtimeSpeechSessionSnapshot {
    const sessionId = normalizeString(input.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown realtime speech session '${sessionId}'.`);
    }

    snapshotSequence += 1;
    const timestamp = normalizeString(input.now) || now();
    const snapshot = createRealtimeSpeechTranscriptSnapshot({
      sessionId,
      providerId: session.providerId,
      sequence: snapshotSequence,
      segments: input.segments,
      resultIndex: input.resultIndex,
      isEndpoint: input.isEndpoint,
      receivedAt: timestamp,
    });
    const nextSession: RealtimeSpeechSessionSnapshot = {
      ...session,
      status: input.isEndpoint === true ? "paused" : "listening",
      transcriptSnapshot: snapshot,
      updatedAt: timestamp,
    };
    sessions.set(sessionId, cloneValue(nextSession));
    emitRealtimeSpeechLog(
      logger,
      "debug",
      "realtime-speech.snapshot",
      "Realtime speech transcript snapshot accepted.",
      {
        sessionId,
        providerId: session.providerId,
        sequence: snapshot.sequence,
        segmentCount: snapshot.segmentCount,
        finalSegmentCount: snapshot.finalSegmentCount,
        interimSegmentCount: snapshot.interimSegmentCount,
        transcriptLength: snapshot.transcript.length,
        changedTranscriptLength: snapshot.changedTranscript.length,
        isEndpoint: snapshot.isEndpoint,
      },
    );
    return cloneValue(nextSession);
  }

  // Intent: stop provider tracking explicitly so final Whisper cleanup can take over at recording finalization.
  function stopSession(input: StopRealtimeSpeechSessionInput): RealtimeSpeechSessionSnapshot | null {
    const sessionId = normalizeString(input.sessionId);
    const session = sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const timestamp = normalizeString(input.now) || now();
    const failed = Boolean(normalizeString(input.errorMessage));
    const nextSession: RealtimeSpeechSessionSnapshot = {
      ...session,
      status: failed ? "failed" : "stopped",
      updatedAt: timestamp,
      ...(failed ? { errorMessage: normalizeString(input.errorMessage) } : {}),
    };
    sessions.set(sessionId, cloneValue(nextSession));
    emitRealtimeSpeechLog(
      logger,
      failed ? "warn" : "info",
      "realtime-speech.session-stopped",
      failed ? "Realtime speech session stopped with an error." : "Realtime speech session stopped.",
      {
        sessionId,
        providerId: session.providerId,
        status: nextSession.status,
        transcriptLength: nextSession.transcriptSnapshot?.transcript.length ?? 0,
      },
    );
    return cloneValue(nextSession);
  }

  return {
    listProviders,
    getSession,
    startSession,
    acceptTranscriptSnapshot,
    stopSession,
  };
}
