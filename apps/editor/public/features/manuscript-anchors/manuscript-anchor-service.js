// Intent: define editor-side anchor DTO helpers before canonical promotion into manuscript-schema.
export const MANUSCRIPT_ANCHOR_STATUS = Object.freeze({
  RESOLVED: "resolved",
  SHIFTED: "shifted",
  CONTENT_CHANGED: "contentChanged",
  APPROXIMATE: "approximate",
  STALE: "stale",
  ORPHANED: "orphaned",
  DELETED: "deleted",
});

export const MANUSCRIPT_ANCHOR_EVIDENCE_MODE = Object.freeze({
  FULL: "full",
  HASH_CONTEXT: "hash-context",
});

export const DEFAULT_ANCHOR_CONTEXT_LIMIT = 64;
export const DEFAULT_ANCHOR_PREVIEW_LIMIT = 180;
export const DEFAULT_FULL_EVIDENCE_LIMIT = 240;

const DEFAULT_RENDERABLE_STATUSES = new Set([
  MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
  MANUSCRIPT_ANCHOR_STATUS.SHIFTED,
  MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED,
  MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
]);

export function createStableTextHash(text = "") {
  const source = String(text ?? "");
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

export function createAnchorEvidence({
  text = "",
  startOffset = 0,
  endOffset = 0,
  contextLimit = DEFAULT_ANCHOR_CONTEXT_LIMIT,
  previewLimit = DEFAULT_ANCHOR_PREVIEW_LIMIT,
  fullEvidenceLimit = DEFAULT_FULL_EVIDENCE_LIMIT,
} = {}) {
  const source = String(text ?? "");
  const start = clampOffset(startOffset, source.length);
  const end = clampOffset(endOffset, source.length);
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);
  const selectedText = source.slice(safeStart, safeEnd);
  const safeContextLimit = Math.max(0, Math.floor(Number(contextLimit) || 0));
  const safePreviewLimit = Math.max(1, Math.floor(Number(previewLimit) || DEFAULT_ANCHOR_PREVIEW_LIMIT));
  const safeFullLimit = Math.max(0, Math.floor(Number(fullEvidenceLimit) || 0));
  const evidenceMode = selectedText.length <= safeFullLimit
    ? MANUSCRIPT_ANCHOR_EVIDENCE_MODE.FULL
    : MANUSCRIPT_ANCHOR_EVIDENCE_MODE.HASH_CONTEXT;

  return {
    evidenceMode,
    evidenceExcerpt: evidenceMode === MANUSCRIPT_ANCHOR_EVIDENCE_MODE.FULL ? selectedText : "",
    originalHash: createStableTextHash(selectedText),
    originalLength: selectedText.length,
    selectedTextPreview: selectedText.slice(0, safePreviewLimit),
    prefixContext: source.slice(Math.max(0, safeStart - safeContextLimit), safeStart),
    suffixContext: source.slice(safeEnd, Math.min(source.length, safeEnd + safeContextLimit)),
  };
}

export function createManuscriptAnchor({
  anchorId = "",
  projectId = "",
  chapterId = "",
  sceneId = "",
  blockId = "",
  paragraphId = "",
  startOffset = 0,
  endOffset = 0,
  text = "",
  status = MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
  dirtyReason = "",
  lastTouchedAt = "",
  lastTouchedByEditId = "",
  ...rest
} = {}, options = {}) {
  const source = String(text ?? "");
  const textLength = Number.isInteger(options.textLength) ? options.textLength : source.length;
  const start = clampOffset(startOffset, textLength);
  const end = clampOffset(endOffset, textLength);
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);
  const evidence = createAnchorEvidence({
    text: source,
    startOffset: safeStart,
    endOffset: safeEnd,
    ...options,
  });

  return normalizeManuscriptAnchor({
    ...rest,
    ...evidence,
    anchorId,
    projectId,
    chapterId,
    sceneId,
    blockId,
    paragraphId,
    startOffset: safeStart,
    endOffset: safeEnd,
    status,
    dirtyReason,
    lastTouchedAt,
    lastTouchedByEditId,
  }, {
    textLength,
    allowCollapsed: true,
  });
}

export function normalizeManuscriptAnchor(candidate = {}, {
  textLength = Number.POSITIVE_INFINITY,
  defaultSceneId = "",
  defaultStatus = MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
  allowCollapsed = false,
} = {}) {
  const startOffset = Number(candidate?.startOffset);
  const endOffset = Number(candidate?.endOffset);
  const safeTextLength = Number.isFinite(Number(textLength))
    ? Math.max(0, Math.floor(Number(textLength)))
    : Number.POSITIVE_INFINITY;
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    (!allowCollapsed && endOffset <= startOffset) ||
    endOffset > safeTextLength
  ) {
    return null;
  }

  const sceneId = typeof candidate?.sceneId === "string" && candidate.sceneId
    ? candidate.sceneId
    : defaultSceneId;
  if (!sceneId) {
    return null;
  }

  return {
    ...candidate,
    anchorId: typeof candidate?.anchorId === "string" ? candidate.anchorId : "",
    projectId: typeof candidate?.projectId === "string" ? candidate.projectId : "",
    chapterId: typeof candidate?.chapterId === "string" ? candidate.chapterId : "",
    sceneId,
    blockId: typeof candidate?.blockId === "string" ? candidate.blockId : "",
    paragraphId: typeof candidate?.paragraphId === "string" ? candidate.paragraphId : "",
    startOffset,
    endOffset,
    evidenceMode: normalizeEvidenceMode(candidate?.evidenceMode),
    evidenceExcerpt: typeof candidate?.evidenceExcerpt === "string" ? candidate.evidenceExcerpt : "",
    originalHash: typeof candidate?.originalHash === "string" ? candidate.originalHash : "",
    originalLength: Number.isInteger(candidate?.originalLength) ? candidate.originalLength : Math.max(0, endOffset - startOffset),
    selectedTextPreview: typeof candidate?.selectedTextPreview === "string" ? candidate.selectedTextPreview : "",
    prefixContext: typeof candidate?.prefixContext === "string" ? candidate.prefixContext : "",
    suffixContext: typeof candidate?.suffixContext === "string" ? candidate.suffixContext : "",
    status: normalizeAnchorStatus(candidate?.status ?? candidate?.anchorStatus, defaultStatus),
    dirtyReason: typeof candidate?.dirtyReason === "string" ? candidate.dirtyReason : "",
    lastTouchedAt: typeof candidate?.lastTouchedAt === "string" ? candidate.lastTouchedAt : "",
    lastTouchedByEditId: typeof candidate?.lastTouchedByEditId === "string" ? candidate.lastTouchedByEditId : "",
  };
}

export function normalizeAnchorStatus(status, fallback = MANUSCRIPT_ANCHOR_STATUS.RESOLVED) {
  const value = String(status ?? "");
  if (Object.values(MANUSCRIPT_ANCHOR_STATUS).includes(value)) {
    return value;
  }

  if (value === "active" || value === "recovered" || value === "partial") {
    return MANUSCRIPT_ANCHOR_STATUS.RESOLVED;
  }

  if (value === "approximate") {
    return MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE;
  }

  if (value === "orphaned") {
    return MANUSCRIPT_ANCHOR_STATUS.ORPHANED;
  }

  return Object.values(MANUSCRIPT_ANCHOR_STATUS).includes(fallback)
    ? fallback
    : MANUSCRIPT_ANCHOR_STATUS.RESOLVED;
}

export function isManuscriptAnchorRenderable(anchor, renderableStatuses = DEFAULT_RENDERABLE_STATUSES) {
  const status = normalizeAnchorStatus(anchor?.status ?? anchor?.anchorStatus);
  const statusSet = renderableStatuses instanceof Set
    ? renderableStatuses
    : new Set(Array.isArray(renderableStatuses) ? renderableStatuses : [...DEFAULT_RENDERABLE_STATUSES]);
  return statusSet.has(status);
}

function normalizeEvidenceMode(evidenceMode) {
  const value = String(evidenceMode ?? "");
  return Object.values(MANUSCRIPT_ANCHOR_EVIDENCE_MODE).includes(value)
    ? value
    : MANUSCRIPT_ANCHOR_EVIDENCE_MODE.HASH_CONTEXT;
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}
