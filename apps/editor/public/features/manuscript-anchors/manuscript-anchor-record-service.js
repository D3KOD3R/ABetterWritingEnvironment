// Intent: apply runtime anchor drift updates back onto durable task/note-style records without persisting edit text.
import {
  DEFAULT_ANCHOR_PREVIEW_LIMIT,
  MANUSCRIPT_ANCHOR_EVIDENCE_MODE,
  MANUSCRIPT_ANCHOR_STATUS,
  createAnchorEvidence,
  normalizeAnchorStatus,
} from "./manuscript-anchor-service.js";
import { applyEditTransactionToAnchor } from "./manuscript-anchor-mutation-service.js";
import { deriveManuscriptEditTransaction } from "./manuscript-edit-transaction-service.js";
import { validateAnchorAgainstText } from "./manuscript-anchor-validation-service.js";

const RENDERABLE_VALIDATION_STATUSES = new Set([
  MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
  MANUSCRIPT_ANCHOR_STATUS.SHIFTED,
  MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED,
  MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
]);

export function updateOffsetAnchoredRecordsForTextEdit({
  records = [],
  sceneId = "",
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const transaction = deriveManuscriptEditTransaction({
    sceneId,
    previousText,
    nextText,
    createdAt: now,
    selectionStart,
    selectionEnd,
  });
  if (!transaction) {
    return {
      records: Array.isArray(records) ? records : [],
      changedRecords: [],
      transaction: null,
    };
  }

  return updateOffsetAnchoredRecordsWithTransaction({
    records,
    transaction,
    previousText,
    nextText,
    ownerType,
    now,
  });
}

export function updateOffsetAnchoredRecordsWithTransaction({
  records = [],
  transaction = null,
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const updated = updateOffsetAnchoredRecordWithTransaction(record, {
      transaction,
      previousText,
      nextText,
      ownerType,
      now,
    });
    if (updated !== record) {
      changedRecords.push(updated);
    }
    return updated;
  });

  return {
    records: nextRecords,
    changedRecords,
    transaction,
  };
}

export function updateOffsetAnchoredRecordWithTransaction(record = {}, {
  transaction = null,
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
} = {}) {
  if (!record || typeof record !== "object" || record.sceneId !== transaction?.sceneId) {
    return record;
  }

  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  const startOffset = Number(record.startOffset);
  const endOffset = Number(record.endOffset);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset < startOffset) {
    return record;
  }

  const mutation = applyEditTransactionToAnchor({
    anchorId: `${ownerType}:${record.id ?? ""}`,
    sceneId: record.sceneId,
    startOffset,
    endOffset,
    status: record.anchorStatus,
    selectedTextPreview: record.selectedText,
    prefixContext: record.nearbyBefore,
    suffixContext: record.nearbyAfter,
  }, transaction, {
    textLength: previous.length,
    now,
  });
  if (!mutation.changed) {
    return record;
  }

  const nextStartOffset = Math.max(0, Math.min(mutation.anchor.startOffset, next.length));
  const nextEndOffset = Math.max(nextStartOffset, Math.min(mutation.anchor.endOffset, next.length));
  const baseRecord = {
    ...record,
    startOffset: nextStartOffset,
    endOffset: nextEndOffset,
    anchorStatus: mutation.anchor.status,
    anchorDirtyReason: mutation.anchor.dirtyReason,
    anchorLastTouchedAt: mutation.anchor.lastTouchedAt || now,
    anchorLastTouchedByEditId: mutation.anchor.lastTouchedByEditId,
  };

  if (mutation.anchor.status === MANUSCRIPT_ANCHOR_STATUS.SHIFTED) {
    return baseRecord;
  }

  const nextSelectedText = next.slice(nextStartOffset, nextEndOffset);
  const evidence = createAnchorEvidence({
    text: next,
    startOffset: nextStartOffset,
    endOffset: nextEndOffset,
  });

  return {
    ...baseRecord,
    selectedText: nextSelectedText,
    nearbyBefore: evidence.prefixContext,
    nearbyAfter: evidence.suffixContext,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    evidenceMode: evidence.evidenceMode,
  };
}

export function updateCanonicalAnchorRecordForTextEdit({
  record = {},
  sceneId = "",
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const transaction = deriveManuscriptEditTransaction({
    sceneId,
    previousText,
    nextText,
    createdAt: now,
    selectionStart,
    selectionEnd,
  });
  if (!transaction) {
    return {
      record,
      changed: false,
      transaction: null,
    };
  }

  const updated = updateCanonicalAnchorRecordWithTransaction(record, {
    transaction,
    previousText,
    nextText,
    ownerType,
    now,
    anchorPath,
  });

  return {
    record: updated,
    changed: updated !== record,
    transaction,
  };
}

export function updateCanonicalAnchorRecordsForTextEdit({
  records = [],
  sceneId = "",
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const transaction = deriveManuscriptEditTransaction({
    sceneId,
    previousText,
    nextText,
    createdAt: now,
    selectionStart,
    selectionEnd,
  });
  if (!transaction) {
    return {
      records: Array.isArray(records) ? records : [],
      changedRecords: [],
      transaction: null,
    };
  }

  return updateCanonicalAnchorRecordsWithTransaction({
    records,
    transaction,
    previousText,
    nextText,
    ownerType,
    now,
    anchorPath,
  });
}

export function updateCanonicalAnchorRecordsWithTransaction({
  records = [],
  transaction = null,
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const updated = updateCanonicalAnchorRecordWithTransaction(record, {
      transaction,
      previousText,
      nextText,
      ownerType,
      now,
      anchorPath,
    });
    if (updated !== record) {
      changedRecords.push(updated);
    }
    return updated;
  });

  return {
    records: nextRecords,
    changedRecords,
    transaction,
  };
}

export function updateCanonicalAnchorRecordWithTransaction(record = {}, {
  transaction = null,
  previousText = "",
  nextText = "",
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
} = {}) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  const anchor = createAnchorFromCanonicalRecord(record, {
    ownerType,
    textLength: previous.length,
    anchorPath,
    allowCollapsed: true,
    requireEvidence: false,
  });
  if (!anchor || anchor.sceneId !== transaction?.sceneId) {
    return record;
  }

  const mutation = applyEditTransactionToAnchor(anchor, transaction, {
    textLength: previous.length,
    now,
  });
  if (!mutation.changed) {
    return record;
  }

  const nextStartOffset = Math.max(0, Math.min(mutation.anchor.startOffset, next.length));
  const nextEndOffset = Math.max(nextStartOffset, Math.min(mutation.anchor.endOffset, next.length));
  const status = normalizeAnchorStatus(mutation.anchor.status);
  const patch = createCanonicalRecordPatchFromAnchor(record, {
    ...mutation.anchor,
    startOffset: nextStartOffset,
    endOffset: nextEndOffset,
    status,
  }, next, {
    now,
    anchorPath,
    refreshEvidence: status !== MANUSCRIPT_ANCHOR_STATUS.SHIFTED,
  });

  if (!doesRecordPatchChangeRecord(record, patch)) {
    return record;
  }

  return {
    ...record,
    ...patch,
  };
}

export function createOffsetAnchoredRecordEvidencePatch({
  text = "",
  startOffset = 0,
  endOffset = 0,
} = {}) {
  const evidence = createAnchorEvidence({
    text,
    startOffset,
    endOffset,
  });

  return {
    anchorStatus: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
    anchorDirtyReason: "",
    evidenceMode: evidence.evidenceMode,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    nearbyBefore: evidence.prefixContext,
    nearbyAfter: evidence.suffixContext,
  };
}

export function resolveOffsetAnchoredRecordRange(record = {}, text = "", {
  ownerType = "record",
  now = "",
  fallbackRange = null,
  validationOptions = {},
} = {}) {
  const source = String(text ?? "");
  const anchor = createAnchorFromOffsetRecord(record, {
    ownerType,
    textLength: source.length,
  });

  if (anchor) {
    const validation = validateAnchorAgainstText(anchor, source, validationOptions);
    if (isRenderableValidationStatus(validation.status)) {
      return createRangeResolutionFromAnchor(record, validation, source, {
        now,
        refreshEvidence: shouldRefreshEvidenceAfterValidation(record, validation),
      });
    }

    const fallback = resolveFallbackRange(record, source, fallbackRange);
    if (fallback) {
      return createRangeResolutionFromAnchor(record, {
        ...anchor,
        startOffset: fallback.startOffset,
        endOffset: fallback.endOffset,
        status: MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
        dirtyReason: fallback.dirtyReason || "legacy-range-recovered",
      }, source, {
        now,
        refreshEvidence: true,
      });
    }

    return createUnresolvedRangeResolution(record, validation, { now });
  }

  const fallback = resolveFallbackRange(record, source, fallbackRange);
  if (!fallback) {
    return null;
  }

  return createRangeResolutionFromAnchor(record, {
    sceneId: record.sceneId,
    startOffset: fallback.startOffset,
    endOffset: fallback.endOffset,
    status: MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
    dirtyReason: fallback.dirtyReason || "legacy-range-recovered",
  }, source, {
    now,
    refreshEvidence: true,
  });
}

export function validateOffsetAnchoredRecordAgainstText(record = {}, text = "", options = {}) {
  const range = resolveOffsetAnchoredRecordRange(record, text, options);
  if (!range?.recordPatch || !doesRecordPatchChangeRecord(record, range.recordPatch)) {
    return {
      record,
      range,
      changed: false,
    };
  }

  return {
    record: {
      ...record,
      ...range.recordPatch,
    },
    range,
    changed: true,
  };
}

export function validateOffsetAnchoredRecordsAgainstText({
  records = [],
  text = "",
  ownerType = "record",
  now = "",
  fallbackRange = null,
  validationOptions = {},
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const result = validateOffsetAnchoredRecordAgainstText(record, text, {
      ownerType,
      now,
      fallbackRange,
      validationOptions,
    });
    if (result.changed) {
      changedRecords.push(result.record);
    }
    return result.record;
  });

  return {
    records: nextRecords,
    changedRecords,
  };
}

export function validateOffsetAnchoredRecordsByScene({
  records = [],
  ownerType = "record",
  now = "",
  getTextForScene = null,
  fallbackRange = null,
  validationOptions = {},
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const text = typeof getTextForScene === "function"
      ? getTextForScene(record?.sceneId ?? "", record)
      : null;
    if (text === null || text === undefined) {
      return record;
    }

    const result = validateOffsetAnchoredRecordAgainstText(record, String(text), {
      ownerType,
      now,
      fallbackRange,
      validationOptions,
    });
    if (result.changed) {
      changedRecords.push(result.record);
    }
    return result.record;
  });

  return {
    records: nextRecords,
    changedRecords,
  };
}

export function createCanonicalAnchorRecordEvidencePatch({
  text = "",
  startOffset = 0,
  endOffset = 0,
} = {}) {
  const evidence = createAnchorEvidence({
    text,
    startOffset,
    endOffset,
  });

  return {
    anchorStatus: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
    anchorDirtyReason: "",
    evidenceMode: evidence.evidenceMode,
    evidenceExcerpt: evidence.evidenceExcerpt,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    prefixContext: evidence.prefixContext,
    suffixContext: evidence.suffixContext,
  };
}

export function resolveCanonicalAnchorRecordRange(record = {}, text = "", {
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
  fallbackRange = null,
  validationOptions = {},
} = {}) {
  const source = String(text ?? "");
  const anchor = createAnchorFromCanonicalRecord(record, {
    ownerType,
    textLength: source.length,
    anchorPath,
  });

  if (anchor) {
    const validation = validateAnchorAgainstText(anchor, source, validationOptions);
    if (isRenderableValidationStatus(validation.status)) {
      return createCanonicalRangeResolutionFromAnchor(record, validation, source, {
        now,
        anchorPath,
        refreshEvidence: shouldRefreshCanonicalEvidenceAfterValidation(record, validation),
      });
    }

    const fallback = resolveFallbackRange(record, source, fallbackRange);
    if (fallback) {
      return createCanonicalRangeResolutionFromAnchor(record, {
        ...anchor,
        startOffset: fallback.startOffset,
        endOffset: fallback.endOffset,
        status: MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
        dirtyReason: fallback.dirtyReason || "context-recovered",
      }, source, {
        now,
        anchorPath,
        refreshEvidence: true,
      });
    }

    return createCanonicalUnresolvedRangeResolution(record, validation, {
      now,
      anchorPath,
    });
  }

  return null;
}

export function validateCanonicalAnchorRecordAgainstText(record = {}, text = "", options = {}) {
  const range = resolveCanonicalAnchorRecordRange(record, text, options);
  if (!range?.recordPatch || !doesRecordPatchChangeRecord(record, range.recordPatch)) {
    return {
      record,
      range,
      changed: false,
    };
  }

  return {
    record: {
      ...record,
      ...range.recordPatch,
    },
    range,
    changed: true,
  };
}

export function validateCanonicalAnchorRecordsByAnchorText({
  records = [],
  ownerType = "record",
  now = "",
  anchorPath = ["anchor"],
  getTextForAnchor = null,
  fallbackRange = null,
  validationOptions = {},
} = {}) {
  const sourceRecords = Array.isArray(records) ? records : [];
  const changedRecords = [];
  const nextRecords = sourceRecords.map((record) => {
    const anchor = getValueAtPath(record, anchorPath);
    const text = typeof getTextForAnchor === "function"
      ? getTextForAnchor(anchor, record)
      : null;
    if (text === null || text === undefined) {
      return record;
    }

    const result = validateCanonicalAnchorRecordAgainstText(record, String(text), {
      ownerType,
      now,
      anchorPath,
      fallbackRange,
      validationOptions,
    });
    if (result.changed) {
      changedRecords.push(result.record);
    }
    return result.record;
  });

  return {
    records: nextRecords,
    changedRecords,
  };
}

function createAnchorFromOffsetRecord(record, {
  ownerType = "record",
  textLength = 0,
} = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const startOffset = Number(record.startOffset);
  const endOffset = Number(record.endOffset);
  const sceneId = typeof record.sceneId === "string" ? record.sceneId : "";
  if (
    !sceneId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset
  ) {
    return null;
  }

  const selectedText = String(record.selectedText ?? "");
  const selectedTextPreview = typeof record.selectedTextPreview === "string" && record.selectedTextPreview
    ? record.selectedTextPreview
    : selectedText.slice(0, DEFAULT_ANCHOR_PREVIEW_LIMIT);
  const originalHash = typeof record.originalHash === "string" ? record.originalHash : "";

  return {
    anchorId: `${ownerType}:${record.id ?? ""}`,
    chapterId: typeof record.chapterId === "string" ? record.chapterId : "",
    sceneId,
    startOffset: Math.max(0, Math.min(startOffset, textLength)),
    endOffset: Math.max(0, Math.min(endOffset, textLength)),
    status: normalizeAnchorStatus(record.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.RESOLVED),
    dirtyReason: typeof record.anchorDirtyReason === "string" ? record.anchorDirtyReason : "",
    lastTouchedAt: typeof record.anchorLastTouchedAt === "string" ? record.anchorLastTouchedAt : "",
    lastTouchedByEditId: typeof record.anchorLastTouchedByEditId === "string" ? record.anchorLastTouchedByEditId : "",
    evidenceMode: record.evidenceMode || (!originalHash && selectedText
      ? MANUSCRIPT_ANCHOR_EVIDENCE_MODE.FULL
      : undefined),
    evidenceExcerpt: originalHash ? "" : selectedText,
    originalHash,
    originalLength: Number.isInteger(record.originalLength)
      ? record.originalLength
      : selectedText.length,
    selectedTextPreview,
    prefixContext: typeof record.nearbyBefore === "string" ? record.nearbyBefore : "",
    suffixContext: typeof record.nearbyAfter === "string" ? record.nearbyAfter : "",
  };
}

function createAnchorFromCanonicalRecord(record, {
  ownerType = "record",
  textLength = 0,
  anchorPath = ["anchor"],
  allowCollapsed = false,
  requireEvidence = true,
} = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const sourceAnchor = getValueAtPath(record, anchorPath);
  if (!sourceAnchor || typeof sourceAnchor !== "object" || Array.isArray(sourceAnchor)) {
    return null;
  }

  const startOffset = Number(sourceAnchor.startOffset);
  const endOffset = Number(sourceAnchor.endOffset);
  const sceneId = typeof sourceAnchor.sceneId === "string" ? sourceAnchor.sceneId : "";
  if (
    !sceneId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    (!allowCollapsed && endOffset <= startOffset)
  ) {
    return null;
  }

  const evidenceExcerpt = typeof record.evidenceExcerpt === "string"
    ? record.evidenceExcerpt
    : typeof record.currentText === "string"
      ? record.currentText
      : typeof record.resolvedText === "string"
        ? record.resolvedText
        : typeof record.result?.resolvedText === "string"
          ? record.result.resolvedText
          : typeof record.request?.resolvedText === "string"
            ? record.request.resolvedText
            : "";
  const selectedTextPreview = typeof record.selectedTextPreview === "string" && record.selectedTextPreview
    ? record.selectedTextPreview
    : evidenceExcerpt.slice(0, DEFAULT_ANCHOR_PREVIEW_LIMIT);
  const originalHash = typeof record.originalHash === "string" ? record.originalHash : "";

  if (requireEvidence && !originalHash && !evidenceExcerpt && !selectedTextPreview) {
    return null;
  }

  return {
    ...sourceAnchor,
    anchorId: `${ownerType}:${record.id ?? ""}`,
    startOffset: Math.max(0, Math.min(startOffset, textLength)),
    endOffset: Math.max(0, Math.min(endOffset, textLength)),
    status: normalizeAnchorStatus(record.anchorStatus ?? sourceAnchor.status, MANUSCRIPT_ANCHOR_STATUS.RESOLVED),
    dirtyReason: typeof record.anchorDirtyReason === "string" ? record.anchorDirtyReason : "",
    lastTouchedAt: typeof record.anchorLastTouchedAt === "string" ? record.anchorLastTouchedAt : "",
    lastTouchedByEditId: typeof record.anchorLastTouchedByEditId === "string" ? record.anchorLastTouchedByEditId : "",
    evidenceMode: record.evidenceMode || (!originalHash && evidenceExcerpt
      ? MANUSCRIPT_ANCHOR_EVIDENCE_MODE.FULL
      : undefined),
    evidenceExcerpt: originalHash ? "" : evidenceExcerpt,
    originalHash,
    originalLength: Number.isInteger(record.originalLength)
      ? record.originalLength
      : evidenceExcerpt.length,
    selectedTextPreview,
    prefixContext: typeof record.prefixContext === "string" ? record.prefixContext : "",
    suffixContext: typeof record.suffixContext === "string" ? record.suffixContext : "",
  };
}

function isRenderableValidationStatus(status) {
  return RENDERABLE_VALIDATION_STATUSES.has(normalizeAnchorStatus(status));
}

function shouldRefreshEvidenceAfterValidation(record, validation) {
  if (validation.status === MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE) {
    return true;
  }

  return !record?.originalHash ||
    !record?.selectedTextPreview ||
    !record?.nearbyBefore ||
    !record?.nearbyAfter ||
    record.anchorStatus !== validation.status ||
    record.anchorDirtyReason !== validation.dirtyReason;
}

function shouldRefreshCanonicalEvidenceAfterValidation(record, validation) {
  if (validation.status === MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE) {
    return true;
  }

  return !record?.originalHash ||
    !record?.selectedTextPreview ||
    record.anchorStatus !== validation.status ||
    record.anchorDirtyReason !== validation.dirtyReason;
}

function resolveFallbackRange(record, source, fallbackRange) {
  if (typeof fallbackRange !== "function") {
    return null;
  }

  const range = fallbackRange(record, source);
  if (
    !range?.matched ||
    !Number.isInteger(range.startOffset) ||
    !Number.isInteger(range.endOffset) ||
    range.startOffset < 0 ||
    range.endOffset <= range.startOffset ||
    range.endOffset > source.length
  ) {
    return null;
  }

  return range;
}

function createRangeResolutionFromAnchor(record, anchor, text, {
  now = "",
  refreshEvidence = false,
} = {}) {
  const source = String(text ?? "");
  const startOffset = Math.max(0, Math.min(Number(anchor.startOffset) || 0, source.length));
  const endOffset = Math.max(startOffset, Math.min(Number(anchor.endOffset) || startOffset, source.length));
  const status = normalizeAnchorStatus(anchor.status, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  const recordPatch = createRecordPatchFromAnchor(record, {
    ...anchor,
    startOffset,
    endOffset,
    status,
  }, source, {
    now,
    refreshEvidence,
  });

  return {
    startOffset,
    endOffset,
    matched: true,
    status,
    dirtyReason: typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "",
    recordPatch,
  };
}

function createUnresolvedRangeResolution(record, anchor, {
  now = "",
} = {}) {
  const status = normalizeAnchorStatus(anchor?.status, MANUSCRIPT_ANCHOR_STATUS.STALE);
  const dirtyReason = typeof anchor?.dirtyReason === "string" && anchor.dirtyReason
    ? anchor.dirtyReason
    : "anchor-unresolved";
  const patch = {
    anchorStatus: status,
    anchorDirtyReason: dirtyReason,
  };
  if (now) {
    patch.anchorLastTouchedAt = now;
  }

  return {
    startOffset: Number.isInteger(record?.startOffset) ? record.startOffset : 0,
    endOffset: Number.isInteger(record?.endOffset) ? record.endOffset : 0,
    matched: false,
    status,
    dirtyReason,
    recordPatch: patch,
  };
}

function createCanonicalRangeResolutionFromAnchor(record, anchor, text, {
  now = "",
  anchorPath = ["anchor"],
  refreshEvidence = false,
} = {}) {
  const source = String(text ?? "");
  const startOffset = Math.max(0, Math.min(Number(anchor.startOffset) || 0, source.length));
  const endOffset = Math.max(startOffset, Math.min(Number(anchor.endOffset) || startOffset, source.length));
  const status = normalizeAnchorStatus(anchor.status, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  const recordPatch = createCanonicalRecordPatchFromAnchor(record, {
    ...anchor,
    startOffset,
    endOffset,
    status,
  }, source, {
    now,
    anchorPath,
    refreshEvidence,
  });

  return {
    startOffset,
    endOffset,
    matched: true,
    status,
    dirtyReason: typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "",
    recordPatch,
  };
}

function createCanonicalUnresolvedRangeResolution(record, anchor, {
  now = "",
  anchorPath = ["anchor"],
} = {}) {
  const status = normalizeAnchorStatus(anchor?.status, MANUSCRIPT_ANCHOR_STATUS.STALE);
  const dirtyReason = typeof anchor?.dirtyReason === "string" && anchor.dirtyReason
    ? anchor.dirtyReason
    : "anchor-unresolved";
  const patch = {
    anchorStatus: status,
    anchorDirtyReason: dirtyReason,
  };
  if (now) {
    patch.anchorLastTouchedAt = now;
  }

  const sourceAnchor = getValueAtPath(record, anchorPath);
  return {
    startOffset: Number.isInteger(sourceAnchor?.startOffset) ? sourceAnchor.startOffset : 0,
    endOffset: Number.isInteger(sourceAnchor?.endOffset) ? sourceAnchor.endOffset : 0,
    matched: false,
    status,
    dirtyReason,
    recordPatch: removeUnchangedPatchFields(record, patch),
  };
}

function createRecordPatchFromAnchor(record, anchor, text, {
  now = "",
  refreshEvidence = false,
} = {}) {
  const patch = {
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
    anchorStatus: anchor.status,
    anchorDirtyReason: typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "",
  };

  if (now) {
    patch.anchorLastTouchedAt = now;
  }

  if (typeof anchor.lastTouchedByEditId === "string" && anchor.lastTouchedByEditId) {
    patch.anchorLastTouchedByEditId = anchor.lastTouchedByEditId;
  }

  if (refreshEvidence) {
    Object.assign(patch, createOffsetAnchoredRecordEvidencePatch({
      text,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
    }));
    patch.anchorStatus = anchor.status;
    patch.anchorDirtyReason = typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "";
    if (now) {
      patch.anchorLastTouchedAt = now;
    }
  }

  return removeUnchangedPatchFields(record, patch);
}

function createCanonicalRecordPatchFromAnchor(record, anchor, text, {
  now = "",
  anchorPath = ["anchor"],
  refreshEvidence = false,
} = {}) {
  const currentAnchor = getValueAtPath(record, anchorPath) ?? {};
  const nextAnchor = {
    ...currentAnchor,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
  };
  const anchorChanged = currentAnchor.startOffset !== anchor.startOffset ||
    currentAnchor.endOffset !== anchor.endOffset;
  const patch = {
    anchorStatus: anchor.status,
    anchorDirtyReason: typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "",
  };
  if (anchorChanged) {
    Object.assign(patch, createNestedPatch(record, anchorPath, nextAnchor));
  }

  if (now) {
    patch.anchorLastTouchedAt = now;
  }

  if (typeof anchor.lastTouchedByEditId === "string" && anchor.lastTouchedByEditId) {
    patch.anchorLastTouchedByEditId = anchor.lastTouchedByEditId;
  }

  if (refreshEvidence) {
    const {
      evidenceExcerpt,
      ...boundedEvidencePatch
    } = createCanonicalAnchorRecordEvidencePatch({
      text,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
    });
    Object.assign(patch, boundedEvidencePatch);
    if (evidenceExcerpt) {
      patch.evidenceExcerpt = evidenceExcerpt;
    }
    patch.anchorStatus = anchor.status;
    patch.anchorDirtyReason = typeof anchor.dirtyReason === "string" ? anchor.dirtyReason : "";
    if (now) {
      patch.anchorLastTouchedAt = now;
    }
  }

  return removeUnchangedPatchFields(record, patch);
}

function getValueAtPath(source, path) {
  const segments = Array.isArray(path) && path.length ? path : ["anchor"];
  return segments.reduce((value, segment) => (
    value && typeof value === "object" ? value[segment] : undefined
  ), source);
}

function createNestedPatch(source, path, value) {
  const segments = Array.isArray(path) && path.length ? path : ["anchor"];
  const [head, ...rest] = segments;
  if (!rest.length) {
    return { [head]: value };
  }

  const current = source?.[head] && typeof source[head] === "object" && !Array.isArray(source[head])
    ? source[head]
    : {};
  return {
    [head]: {
      ...current,
      ...createNestedPatch(current, rest, value),
    },
  };
}

function removeUnchangedPatchFields(record, patch) {
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => record?.[key] !== value),
  );
}

function doesRecordPatchChangeRecord(record, patch) {
  return Object.entries(patch ?? {}).some(([key, value]) => record?.[key] !== value);
}
