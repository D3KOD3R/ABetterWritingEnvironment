// Intent: own editor voice profile/job state and placeholder render transitions outside app.js.

export const VOICE_NARRATION_STORAGE_KEY = "abe-voice-narration-v1";

export function createVoiceWorkflowService({
  projectService,
  storageKey = VOICE_NARRATION_STORAGE_KEY,
} = {}) {
  if (!projectService || typeof projectService.loadUserPreference !== "function" || typeof projectService.saveUserPreference !== "function") {
    throw new TypeError("createVoiceWorkflowService requires a projectService with preference storage methods.");
  }

  return {
    loadState: () => loadVoiceNarrationState({
      loadSnapshot: () => projectService.loadUserPreference(storageKey, null),
    }),
    saveState: (state) => saveVoiceNarrationState(state, {
      saveSnapshot: (snapshot) => projectService.saveUserPreference(storageKey, snapshot),
    }),
  };
}

export function createVoiceNarrationJobRecord(input, {
  now = new Date().toISOString(),
  createId = defaultCreateVoiceNarrationJobId,
} = {}) {
  const manuscriptRef = createVoiceNarrationAnchor(input.projectId, input.sourceLine);
  const blockRange = input.sourceScene.blocks.length
    ? {
        startBlockId: input.sourceScene.blocks[0].blockId,
        endBlockId: input.sourceScene.blocks[input.sourceScene.blocks.length - 1].blockId,
      }
    : undefined;

  return {
    id: createId(),
    projectId: input.projectId,
    manuscriptRef,
    chapterId: input.sourceLine.chapterId,
    sceneId: input.sourceLine.sceneId,
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot: input.sourceScene.editorText || input.sourceLine.text || "Placeholder narration text.",
    voiceProfileId: input.voiceProfile.id,
    status: "draft",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createVoiceNarrationAnchor(projectId, sourceLine) {
  return {
    projectId,
    chapterId: sourceLine.chapterId,
    sceneId: sourceLine.sceneId,
    blockId: sourceLine.blockId,
    paragraphId: sourceLine.paragraphId,
    startOffset: 0,
    endOffset: sourceLine.text.length,
  };
}

export function queueVoiceNarrationJobRecord(job, now = new Date().toISOString()) {
  if (job.status !== "draft" && job.status !== "failed") {
    throw new Error(`Cannot queue a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "queued",
    progress: 0.15,
    error: undefined,
    outputAudioRef: undefined,
    alignmentRef: undefined,
    updatedAt: now,
  };
}

export function startVoiceNarrationJobRenderingRecord(job, now = new Date().toISOString()) {
  if (job.status !== "queued") {
    throw new Error(`Cannot start rendering a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "rendering",
    progress: 0.55,
    error: undefined,
    updatedAt: now,
  };
}

export function renderPlaceholderVoiceNarrationJobRecord(job, now = new Date().toISOString()) {
  if (job.status !== "rendering") {
    throw new Error(`Cannot complete a narration job with status '${job.status}'.`);
  }

  return {
    ...job,
    status: "rendered",
    progress: 1,
    outputAudioRef: `voice-output://placeholder/${job.id}`,
    error: undefined,
    updatedAt: now,
  };
}

export function compareVoiceNarrationJobs(left, right) {
  const leftTime = Date.parse(left.createdAt);
  const rightTime = Date.parse(right.createdAt);

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

export function loadVoiceNarrationState({
  loadSnapshot = () => null,
} = {}) {
  const snapshot = loadSnapshot();
  const storedProfiles = normalizeVoiceNarrationProfiles(snapshot?.voiceProfiles);
  const narrationJobs = normalizeVoiceNarrationJobs(snapshot?.narrationJobs);
  const selectedVoiceProfileId = normalizeVoiceNarrationString(snapshot?.selectedVoiceProfileId);
  const voiceProfiles = storedProfiles.length ? storedProfiles : createVoiceNarrationDemoProfiles();
  const selectedProfile = selectedVoiceProfileId
    ? voiceProfiles.find((profile) => profile.id === selectedVoiceProfileId) ?? null
    : null;

  return {
    voiceProfiles,
    narrationJobs,
    selectedVoiceProfileId: selectedProfile?.id ?? voiceProfiles[0]?.id ?? null,
  };
}

export function saveVoiceNarrationState(state, {
  saveSnapshot = () => {},
  now = new Date().toISOString(),
} = {}) {
  saveSnapshot({
    version: 1,
    voiceProfiles: cloneValue(state?.voiceProfiles ?? []),
    narrationJobs: cloneValue(state?.narrationJobs ?? []),
    selectedVoiceProfileId: normalizeVoiceNarrationString(state?.selectedVoiceProfileId) ?? null,
    updatedAt: now,
  });
}

export function createVoiceNarrationDemoProfiles(now = new Date().toISOString()) {
  return [
    createVoiceNarrationProfileRecord({
      id: "voice-profile-lantern",
      displayName: "Lantern Narrator",
      engineType: "local-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Measured documentary warmth",
      description: "Local narration placeholder for long-form manuscript reading.",
      settings: {
        pace: 0.96,
        warmth: 0.72,
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-harbor",
      displayName: "Harbor External",
      engineType: "external-placeholder",
      language: "en",
      accent: "australian",
      voiceStyleLabel: "Bright provider placeholder",
      description: "Represents an external narration provider without real connectivity yet.",
      settings: {
        providerHint: "external-demo",
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-iron",
      displayName: "Iron System Voice",
      engineType: "system-voice-placeholder",
      language: "en",
      accent: "general",
      genderLabel: "neutral",
      voiceStyleLabel: "Plain OS fallback",
      description: "Uses the operating system voice slot as a placeholder contract.",
      settings: {
        fallback: true,
      },
      createdAt: now,
      updatedAt: now,
    }),
    createVoiceNarrationProfileRecord({
      id: "voice-profile-rift",
      displayName: "Rift Conversion",
      engineType: "rvc-placeholder",
      language: "en",
      accent: "neutral",
      voiceStyleLabel: "Performance conversion placeholder",
      description: "Represents a future voice-conversion pipeline without any model integration.",
      settings: {
        conversionMode: "stub",
      },
      createdAt: now,
      updatedAt: now,
    }),
  ];
}

export function createVoiceNarrationProfileRecord(input) {
  return {
    id: String(input.id).trim(),
    displayName: String(input.displayName).trim(),
    engineType: normalizeVoiceNarrationEngineType(input.engineType),
    language: normalizeVoiceNarrationString(input.language) || "und",
    accent: normalizeVoiceNarrationString(input.accent) || "neutral",
    ...(normalizeVoiceNarrationString(input.genderLabel) ? { genderLabel: normalizeVoiceNarrationString(input.genderLabel) } : {}),
    ...(normalizeVoiceNarrationString(input.voiceStyleLabel) ? { voiceStyleLabel: normalizeVoiceNarrationString(input.voiceStyleLabel) } : {}),
    description: normalizeVoiceNarrationString(input.description) || "",
    ...(normalizeVoiceNarrationString(input.sampleAudioRef) ? { sampleAudioRef: normalizeVoiceNarrationString(input.sampleAudioRef) } : {}),
    settings: isPlainObject(input.settings) ? { ...input.settings } : {},
    createdAt: normalizeVoiceNarrationString(input.createdAt) || new Date(0).toISOString(),
    updatedAt: normalizeVoiceNarrationString(input.updatedAt) || normalizeVoiceNarrationString(input.createdAt) || new Date(0).toISOString(),
  };
}

export function normalizeVoiceNarrationProfiles(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeVoiceNarrationProfileRecord(item))
    .filter(Boolean);
}

export function normalizeVoiceNarrationProfileRecord(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const id = normalizeVoiceNarrationString(candidate.id);
  const displayName = normalizeVoiceNarrationString(candidate.displayName);
  const engineType = normalizeVoiceNarrationEngineType(candidate.engineType);

  if (!id || !displayName || !engineType) {
    return null;
  }

  const createdAt = normalizeVoiceNarrationString(candidate.createdAt) || new Date(0).toISOString();
  const updatedAt = normalizeVoiceNarrationString(candidate.updatedAt) || createdAt;

  return createVoiceNarrationProfileRecord({
    id,
    displayName,
    engineType,
    language: normalizeVoiceNarrationString(candidate.language) || "und",
    accent: normalizeVoiceNarrationString(candidate.accent) || "neutral",
    genderLabel: normalizeVoiceNarrationString(candidate.genderLabel),
    voiceStyleLabel: normalizeVoiceNarrationString(candidate.voiceStyleLabel),
    description: normalizeVoiceNarrationString(candidate.description) || "",
    sampleAudioRef: normalizeVoiceNarrationString(candidate.sampleAudioRef),
    settings: isPlainObject(candidate.settings) ? { ...candidate.settings } : {},
    createdAt,
    updatedAt,
  });
}

export function normalizeVoiceNarrationJobs(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map((item) => normalizeVoiceNarrationJobRecord(item))
    .filter(Boolean)
    .sort(compareVoiceNarrationJobs);
}

export function normalizeVoiceNarrationJobRecord(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const manuscriptRef = normalizeVoiceNarrationAnchor(candidate.manuscriptRef);
  const projectId = normalizeVoiceNarrationString(candidate.projectId);
  const voiceProfileId = normalizeVoiceNarrationString(candidate.voiceProfileId);
  const sourceTextSnapshot =
    typeof candidate.sourceTextSnapshot === "string" && candidate.sourceTextSnapshot.trim()
      ? candidate.sourceTextSnapshot
      : "";
  const status = normalizeVoiceNarrationJobStatus(candidate.status);
  const progress = normalizeVoiceNarrationProgress(candidate.progress);

  if (!manuscriptRef || !projectId || !voiceProfileId || !sourceTextSnapshot || !status) {
    return null;
  }

  const chapterId = normalizeVoiceNarrationString(candidate.chapterId);
  const sceneId = normalizeVoiceNarrationString(candidate.sceneId);
  const blockRange = candidate.blockRange ? normalizeVoiceNarrationBlockRange(candidate.blockRange) : undefined;

  if (candidate.blockRange && !blockRange) {
    return null;
  }

  const createdAt = normalizeVoiceNarrationString(candidate.createdAt) || new Date(0).toISOString();
  const updatedAt = normalizeVoiceNarrationString(candidate.updatedAt) || createdAt;

  return {
    id: normalizeVoiceNarrationString(candidate.id) || `voice-narration-job-${Date.now()}`,
    projectId,
    manuscriptRef,
    ...(chapterId ? { chapterId } : {}),
    ...(sceneId ? { sceneId } : {}),
    ...(blockRange ? { blockRange } : {}),
    sourceTextSnapshot,
    voiceProfileId,
    status,
    progress,
    ...(normalizeVoiceNarrationString(candidate.outputAudioRef) ? { outputAudioRef: normalizeVoiceNarrationString(candidate.outputAudioRef) } : {}),
    ...(normalizeVoiceNarrationString(candidate.alignmentRef) ? { alignmentRef: normalizeVoiceNarrationString(candidate.alignmentRef) } : {}),
    ...(normalizeVoiceNarrationString(candidate.error) ? { error: normalizeVoiceNarrationString(candidate.error) } : {}),
    createdAt,
    updatedAt,
  };
}

export function normalizeVoiceNarrationAnchor(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const projectId = normalizeVoiceNarrationString(candidate.projectId);
  const chapterId = normalizeVoiceNarrationString(candidate.chapterId);
  const sceneId = normalizeVoiceNarrationString(candidate.sceneId);
  const blockId = normalizeVoiceNarrationString(candidate.blockId);
  const paragraphId = normalizeVoiceNarrationString(candidate.paragraphId);
  const startOffset = Number(candidate.startOffset);
  const endOffset = Number(candidate.endOffset);

  if (
    !projectId ||
    !chapterId ||
    !sceneId ||
    !blockId ||
    !paragraphId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset
  ) {
    return null;
  }

  return {
    projectId,
    chapterId,
    sceneId,
    blockId,
    paragraphId,
    startOffset,
    endOffset,
  };
}

export function normalizeVoiceNarrationBlockRange(candidate) {
  if (!isPlainObject(candidate)) {
    return null;
  }

  const startBlockId = normalizeVoiceNarrationString(candidate.startBlockId);
  const endBlockId = normalizeVoiceNarrationString(candidate.endBlockId);

  if (!startBlockId || !endBlockId) {
    return null;
  }

  return {
    startBlockId,
    endBlockId,
  };
}

export function normalizeVoiceNarrationEngineType(candidate) {
  const value = normalizeVoiceNarrationString(candidate);
  return value && [
    "local-placeholder",
    "external-placeholder",
    "rvc-placeholder",
    "system-voice-placeholder",
  ].includes(value)
    ? value
    : "";
}

export function normalizeVoiceNarrationJobStatus(candidate) {
  const value = normalizeVoiceNarrationString(candidate);
  return value && ["draft", "queued", "rendering", "rendered", "failed", "cancelled"].includes(value)
    ? value
    : "";
}

export function normalizeVoiceNarrationProgress(candidate) {
  const value = Number(candidate);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Number(value.toFixed(4)), 0), 1);
}

export function normalizeVoiceNarrationString(candidate) {
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "";
}

function defaultCreateVoiceNarrationJobId() {
  return `voice-narration-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPlainObject(candidate) {
  return Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate);
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
