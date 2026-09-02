// Intent: own narration take DTOs and media naming policy outside the editor shell.

export const NARRATION_RECORDING_DEFAULT_MIME_TYPE = "audio/webm";

function cloneSelection(value, clone = null) {
  if (!value) {
    return null;
  }
  if (typeof clone === "function") {
    return clone(value);
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeFileNameSegment(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .slice(0, 96) || "segment";
}

export function normalizeNarrationRecordingMimeType(candidate) {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "";
}

export function getVoiceRecordingExtension(mediaMimeType) {
  const normalizedMimeType = normalizeNarrationRecordingMimeType(mediaMimeType);
  if (normalizedMimeType.includes("ogg")) {
    return "ogg";
  }
  if (normalizedMimeType.includes("wav")) {
    return "wav";
  }
  if (normalizedMimeType.includes("mp4") || normalizedMimeType.includes("m4a")) {
    return "m4a";
  }
  return "webm";
}

export function createNarrationRecordingId(selection, {
  nowMs = Date.now(),
} = {}) {
  const sceneSegment = sanitizeFileNameSegment(selection?.sceneId ?? selection?.sceneTitle ?? "scene");
  const blockSegment = sanitizeFileNameSegment(selection?.blockId ?? `line-${selection?.lineNumber ?? "0"}`);
  return `take-${Number(nowMs).toString(36)}-${sceneSegment}-${blockSegment}`;
}

export function getVoiceRecordingMediaName(recordingId, mediaMimeType) {
  return `${sanitizeFileNameSegment(recordingId || "voice-take")}.${getVoiceRecordingExtension(mediaMimeType)}`;
}

// Intent: allocate a portable package-relative audio reference without embedding project or machine locations.
export function buildVoiceRecordingMediaPath(_projectId, recordingId, mediaMimeType) {
  const mediaName = getVoiceRecordingMediaName(recordingId, mediaMimeType);
  return `assets/audio/${mediaName}`;
}

export function getSupportedNarrationRecordingMimeType({
  mediaRecorder = globalThis.MediaRecorder,
} = {}) {
  if (!mediaRecorder || typeof mediaRecorder.isTypeSupported !== "function") {
    return NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  for (const candidate of candidates) {
    if (mediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return NARRATION_RECORDING_DEFAULT_MIME_TYPE;
}

export function normalizeNarrationTakeTranscript(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

export function normalizeNarrationTakeStatusText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function formatNarrationRecordingElapsedLabel(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const secondsLabel = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${minutes}:${secondsLabel}`;
}

export function createNarrationTakeSession(selection, options = {}, {
  clone = null,
  nowMs = Date.now(),
} = {}) {
  const startedAtMs = Number.isFinite(Number(options.startedAtMs))
    ? Number(options.startedAtMs)
    : nowMs;

  return {
    status: options.status === "recording" || options.status === "finalizing" ? options.status : "paused",
    trackerStatus: normalizeNarrationTakeStatusText(options.trackerStatus) || "Speech tracker idle",
    transcript: typeof options.transcript === "string" ? options.transcript : "",
    liveTranscript: typeof options.liveTranscript === "string" ? options.liveTranscript : "",
    liveChangedTranscript: typeof options.liveChangedTranscript === "string" ? options.liveChangedTranscript : "",
    liveTranscriptUpdatedAt: normalizeNarrationTakeStatusText(options.liveTranscriptUpdatedAt),
    cleanupTranscript: typeof options.cleanupTranscript === "string" ? options.cleanupTranscript : "",
    elapsedLabel: typeof options.elapsedLabel === "string" ? options.elapsedLabel : "0:00",
    recordingId: typeof options.recordingId === "string" ? options.recordingId : null,
    mediaPath: typeof options.mediaPath === "string" ? options.mediaPath : null,
    speechProviderId: normalizeNarrationTakeStatusText(options.speechProviderId),
    speechProviderLabel: normalizeNarrationTakeStatusText(options.speechProviderLabel),
    speechProviderKind: normalizeNarrationTakeStatusText(options.speechProviderKind),
    startedAt: new Date(startedAtMs).toISOString(),
    sceneId: selection?.sceneId ?? normalizeNarrationTakeStatusText(options.sceneId) ?? "",
    sceneTitle: selection?.sceneTitle ?? normalizeNarrationTakeStatusText(options.sceneTitle) ?? "",
    chapterId: selection?.chapterId ?? normalizeNarrationTakeStatusText(options.chapterId) ?? "",
    chapterTitle: selection?.chapterTitle ?? normalizeNarrationTakeStatusText(options.chapterTitle) ?? "",
    blockId: selection?.blockId ?? normalizeNarrationTakeStatusText(options.blockId) ?? "",
    selection: cloneSelection(selection, clone),
    followSelection: cloneSelection(options.followSelection, clone),
    followMatch: cloneSelection(options.followMatch, clone),
    speechSnapshot: cloneSelection(options.speechSnapshot, clone),
  };
}

export function createNarrationRecordingRuntime(selection, {
  projectId = "",
  mediaMimeType = NARRATION_RECORDING_DEFAULT_MIME_TYPE,
  mediaPath = "",
  recordingId = "",
  timerId = null,
  nowMs = Date.now(),
  clone = null,
} = {}) {
  const resolvedRecordingId = recordingId || createNarrationRecordingId(selection, {
    nowMs,
  });
  const resolvedMediaMimeType = normalizeNarrationRecordingMimeType(mediaMimeType) || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  const resolvedMediaPath = mediaPath || buildVoiceRecordingMediaPath(projectId, resolvedRecordingId, resolvedMediaMimeType);

  return {
    recordingId: resolvedRecordingId,
    projectId,
    selection: cloneSelection(selection, clone),
    startedAtMs: nowMs,
    chunks: [],
    mediaMimeType: resolvedMediaMimeType,
    mediaPath: resolvedMediaPath,
    stream: null,
    mediaRecorder: null,
    speechRecognition: null,
    speechProviderId: "",
    speechProviderLabel: "",
    speechProviderKind: "",
    timerId,
    transcript: "",
    liveTranscript: "",
    liveChangedTranscript: "",
    liveTranscriptUpdatedAt: "",
    cleanupTranscript: "",
    speechSnapshot: null,
    trackerStatus: "Requesting microphone access...",
    followSelection: null,
    followMatch: null,
  };
}

export function createNarrationRecordingInitialSessionOptions(runtime) {
  return {
    status: "paused",
    trackerStatus: "Requesting microphone access...",
    transcript: "",
    liveTranscript: runtime?.liveTranscript ?? "",
    liveChangedTranscript: runtime?.liveChangedTranscript ?? "",
    liveTranscriptUpdatedAt: runtime?.liveTranscriptUpdatedAt ?? "",
    cleanupTranscript: runtime?.cleanupTranscript ?? "",
    elapsedLabel: "0:00",
    recordingId: runtime?.recordingId ?? null,
    mediaPath: runtime?.mediaPath ?? null,
    speechProviderId: runtime?.speechProviderId ?? "",
    speechProviderLabel: runtime?.speechProviderLabel ?? "",
    speechProviderKind: runtime?.speechProviderKind ?? "",
    startedAtMs: runtime?.startedAtMs,
  };
}

export function createNarrationRecordingRecord(selection, options = {}) {
  const projectId = typeof options.projectId === "string" && options.projectId.trim()
    ? options.projectId.trim()
    : "";
  const recordingId = typeof options.recordingId === "string" && options.recordingId.trim()
    ? options.recordingId.trim()
    : createNarrationRecordingId(selection);
  const createdAt = typeof options.createdAt === "string" && options.createdAt.trim()
    ? options.createdAt.trim()
    : new Date().toISOString();
  const updatedAt = typeof options.updatedAt === "string" && options.updatedAt.trim()
    ? options.updatedAt.trim()
    : createdAt;
  const mediaMimeType = normalizeNarrationRecordingMimeType(options.mediaMimeType) || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  const mediaName = typeof options.mediaName === "string" && options.mediaName.trim()
    ? options.mediaName.trim()
    : getVoiceRecordingMediaName(recordingId, mediaMimeType);
  const mediaPath = typeof options.mediaPath === "string" && options.mediaPath.trim()
    ? options.mediaPath.trim()
    : buildVoiceRecordingMediaPath(projectId, recordingId, mediaMimeType);

  const cleanupTranscript = normalizeNarrationTakeTranscript(options.cleanupTranscript);
  const cleanupTranscriptUpdatedAt = normalizeNarrationTakeStatusText(options.cleanupTranscriptUpdatedAt);

  return {
    id: recordingId,
    projectId,
    chapterId: selection?.chapterId ?? "",
    chapterTitle: selection?.chapterTitle ?? "",
    sceneId: selection?.sceneId ?? "",
    sceneTitle: selection?.sceneTitle ?? "",
    blockId: selection?.blockId ?? "",
    paragraphId: selection?.paragraphId ?? "",
    lineNumber: Number.isInteger(selection?.lineNumber) ? selection.lineNumber : 0,
    startOffset: Number.isInteger(selection?.startOffset) ? Math.max(0, selection.startOffset) : null,
    endOffset: Number.isInteger(selection?.endOffset) ? Math.max(0, selection.endOffset) : null,
    verseText: normalizeNarrationTakeTranscript(selection?.verseText ?? selection?.selectedText ?? ""),
    transcript: normalizeNarrationTakeTranscript(options.transcript),
    ...(cleanupTranscript ? { cleanupTranscript } : {}),
    ...(cleanupTranscriptUpdatedAt ? { cleanupTranscriptUpdatedAt } : {}),
    mediaPath,
    mediaName,
    mediaMimeType,
    durationMs: Number.isFinite(Number(options.durationMs)) ? Math.max(0, Math.round(Number(options.durationMs))) : 0,
    status: options.status === "recorded" || options.status === "failed" ? options.status : "saved",
    createdAt,
    updatedAt,
  };
}

// Intent: preserve the live/browser transcript as the take transcript while retaining Whisper cleanup for review and diagnostics.
export function applyNarrationCleanupTranscriptToRecord(record, cleanupTranscript, {
  updatedAt = new Date().toISOString(),
} = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const normalizedCleanupTranscript = normalizeNarrationTakeTranscript(cleanupTranscript);
  if (!normalizedCleanupTranscript) {
    return record;
  }

  const existingTranscript = normalizeNarrationTakeTranscript(record.transcript);
  const normalizedUpdatedAt = normalizeNarrationTakeStatusText(updatedAt) || new Date().toISOString();
  return {
    ...record,
    transcript: existingTranscript || normalizedCleanupTranscript,
    cleanupTranscript: normalizedCleanupTranscript,
    cleanupTranscriptUpdatedAt: normalizedUpdatedAt,
    updatedAt: normalizedUpdatedAt,
  };
}

export function createNarrationRecordingBlob(runtime, {
  blobConstructor = globalThis.Blob,
} = {}) {
  if (typeof blobConstructor !== "function") {
    throw new Error("Blob is not available in this browser.");
  }

  const mediaMimeType = runtime?.mediaMimeType || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  return new blobConstructor(Array.isArray(runtime?.chunks) && runtime.chunks.length ? runtime.chunks : [], {
    type: mediaMimeType,
  });
}

export function buildNarrationRecordingFinalizationContext(runtime, {
  selection = null,
  projectId = "",
  nowMs = Date.now(),
} = {}) {
  const resolvedProjectId = runtime?.projectId || projectId || "";
  const mediaMimeType = runtime?.mediaMimeType || NARRATION_RECORDING_DEFAULT_MIME_TYPE;
  const recordingId = normalizeNarrationTakeStatusText(runtime?.recordingId) || createNarrationRecordingId(selection);
  const durationMs = Math.max(0, Number(nowMs) - Number(runtime?.startedAtMs ?? nowMs));
  const mediaName = getVoiceRecordingMediaName(recordingId, mediaMimeType);
  const mediaPath = normalizeNarrationTakeStatusText(runtime?.mediaPath)
    || buildVoiceRecordingMediaPath(resolvedProjectId, recordingId, mediaMimeType);

  return {
    projectId: resolvedProjectId,
    recordingId,
    selection,
    transcript: normalizeNarrationTakeTranscript(runtime?.transcript),
    cleanupTranscript: normalizeNarrationTakeTranscript(runtime?.cleanupTranscript),
    cleanupTranscriptUpdatedAt: normalizeNarrationTakeStatusText(runtime?.cleanupTranscriptUpdatedAt),
    durationMs,
    mediaMimeType,
    mediaName,
    mediaPath,
    createdAt: new Date(Number(runtime?.startedAtMs ?? nowMs)).toISOString(),
    updatedAt: new Date(Number(nowMs)).toISOString(),
    startedAtMs: Number(runtime?.startedAtMs ?? nowMs),
  };
}

export function createFinalNarrationRecordingRecord(finalization, {
  status = "saved",
} = {}) {
  return createNarrationRecordingRecord(finalization.selection, {
    projectId: finalization.projectId,
    recordingId: finalization.recordingId,
    transcript: finalization.transcript,
    cleanupTranscript: finalization.cleanupTranscript,
    cleanupTranscriptUpdatedAt: finalization.cleanupTranscriptUpdatedAt,
    mediaPath: finalization.mediaPath,
    mediaName: finalization.mediaName,
    mediaMimeType: finalization.mediaMimeType,
    durationMs: finalization.durationMs,
    status,
    createdAt: finalization.createdAt,
    updatedAt: finalization.updatedAt,
  });
}
