// Intent: bridge legacy scene inline ranges into canonical anchor-backed manuscript marks during migration.
import {
  MANUSCRIPT_ANCHOR_STATUS,
  createAnchorEvidence,
  normalizeAnchorStatus,
} from "../manuscript-anchors/manuscript-anchor-service.js";
import { applyEditTransactionToAnchor } from "../manuscript-anchors/manuscript-anchor-mutation-service.js";
import { deriveManuscriptEditTransaction } from "../manuscript-anchors/manuscript-edit-transaction-service.js";
import { normalizeInlineFormatRanges } from "./manuscript-command-controller.js";

export const MANUSCRIPT_MARK_KINDS = Object.freeze({
  BOLD: "bold",
  ITALIC: "italic",
  UNDERLINE: "underline",
  STRIKETHROUGH: "strikethrough",
  HIGHLIGHT: "highlight",
});

const SUPPORTED_MARK_KINDS = new Set(Object.values(MANUSCRIPT_MARK_KINDS));
const SUPPORTED_MARK_PURPOSES = new Set(["emphasis", "reference", "revision"]);
const DEFAULT_SCENE_BLOCK_SEPARATOR = "\n\n";

export function deriveManuscriptMarksFromInlineFormatRanges({
  projectId = "",
  chapterId = "",
  sceneId = "",
  text = "",
  sceneBlocks = [],
  inlineFormatRanges = [],
  now = "",
} = {}) {
  const normalizedText = String(text ?? "");
  const ranges = normalizeInlineFormatRanges(inlineFormatRanges, normalizedText.length);
  const blockSpans = createSceneBlockSpans(sceneBlocks, normalizedText, {
    chapterId,
    sceneId,
  });
  const marks = [];
  const unmappedRanges = [];

  for (const range of ranges) {
    const kind = normalizeManuscriptMarkKind(range.formatId);
    if (!kind) {
      unmappedRanges.push(range);
      continue;
    }

    const rangeMarks = createMarksForRange(range, kind, blockSpans, {
      projectId,
      sceneId,
      now,
    });
    if (!rangeMarks.length) {
      unmappedRanges.push(range);
      continue;
    }

    marks.push(...rangeMarks);
  }

  return {
    marks,
    unmappedRanges,
  };
}

export function normalizeManuscriptMarks(marks = [], {
  sceneId = "",
} = {}) {
  const normalized = [];
  for (const mark of Array.isArray(marks) ? marks : []) {
    const normalizedMark = normalizeManuscriptMark(mark, { sceneId });
    if (normalizedMark) {
      normalized.push(normalizedMark);
    }
  }
  return normalized;
}

export function isCompatibilityManuscriptMark(mark) {
  return (
    typeof mark?.id === "string" &&
    mark.id.startsWith("mark-inline-") &&
    mark.source === "author"
  );
}

export function syncCompatibilityManuscriptMarksForScene({
  marks = [],
  projectId = "",
  chapterId = "",
  sceneId = "",
  text = "",
  sceneBlocks = [],
  inlineFormatRanges = [],
  now = "",
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const existingMarks = Array.isArray(marks) ? marks : [];
  const derived = deriveManuscriptMarksFromInlineFormatRanges({
    projectId,
    chapterId,
    sceneId: normalizedSceneId,
    text,
    sceneBlocks,
    inlineFormatRanges,
    now,
  });
  const retainedMarks = existingMarks.filter((mark) => !(
    isCompatibilityManuscriptMark(mark) &&
    String(mark?.anchor?.sceneId ?? "") === normalizedSceneId
  ));
  const nextMarks = [
    ...retainedMarks,
    ...derived.marks,
  ];

  return {
    marks: nextMarks,
    changed: JSON.stringify(existingMarks) !== JSON.stringify(nextMarks),
    changedMarks: derived.marks,
    unmappedRanges: derived.unmappedRanges,
  };
}

// Intent: keep canonical manuscript marks stable during live textarea edits even when block text is one edit behind.
export function updateManuscriptMarksForSceneTextEdit({
  marks = [],
  projectId = "",
  chapterId = "",
  sceneId = "",
  previousText = "",
  nextText = "",
  previousSceneBlocks = [],
  nextSceneBlocks = [],
  pendingFormats = {},
  selectionStart = null,
  selectionEnd = null,
  now = "",
} = {}) {
  const sourceMarks = Array.isArray(marks) ? marks : [];
  const normalizedSceneId = String(sceneId ?? "");
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  const transaction = deriveManuscriptEditTransaction({
    sceneId: normalizedSceneId,
    previousText: previous,
    nextText: next,
    selectionStart,
    selectionEnd,
    createdAt: now,
  });
  if (!transaction) {
    return {
      marks: sourceMarks,
      changedMarks: [],
      transaction: null,
    };
  }

  const previousSpans = createSceneBlockSpans(previousSceneBlocks, previous, {
    chapterId,
    sceneId: normalizedSceneId,
  });
  const nextSpans = createSceneBlockSpans(nextSceneBlocks, next, {
    chapterId,
    sceneId: normalizedSceneId,
  });
  const changedMarks = [];
  const nextMarks = [];
  for (const mark of sourceMarks) {
    const updated = updateManuscriptMarkForSceneTransaction(mark, {
      projectId,
      sceneId: normalizedSceneId,
      previous,
      next,
      previousSpans,
      nextSpans,
      transaction,
      pendingFormats,
      now,
    });
    const updatedMarks = Array.isArray(updated) ? updated : [updated];
    nextMarks.push(...updatedMarks);
    if (updatedMarks.length !== 1 || updatedMarks[0] !== mark) {
      changedMarks.push(...updatedMarks);
    }
  }

  return {
    marks: nextMarks,
    changedMarks,
    transaction,
  };
}

// Intent: plan direct canonical mark writes that apply a mark without using toolbar toggle semantics.
export function applyManuscriptMarksForSceneSelection(options = {}) {
  return mutateManuscriptMarksForSceneSelection({
    ...options,
    mutationMode: "apply",
  });
}

// Intent: plan direct canonical mark writes so toolbar and panel commands can leave legacy ranges behind.
export function toggleManuscriptMarksForSceneSelection(options = {}) {
  return mutateManuscriptMarksForSceneSelection({
    ...options,
    mutationMode: "toggle",
  });
}

// Intent: share anchor-backed mark creation while keeping paint-style apply separate from button toggles.
function mutateManuscriptMarksForSceneSelection({
  marks = [],
  sequences = {},
  projectId = "",
  chapterId = "",
  sceneId = "",
  text = "",
  sceneBlocks = [],
  selection = null,
  kind = "",
  source = "author",
  metadata = null,
  mutationMode = "toggle",
  now = "",
} = {}) {
  const normalizedText = String(text ?? "");
  const normalizedKind = normalizeManuscriptMarkKind(kind);
  const normalizedSelection = normalizeSceneSelection(selection, normalizedText.length);
  if (!normalizedKind) {
    return createMarkMutationResult({
      marks,
      sequences,
      changed: false,
      reason: "unsupported-kind",
    });
  }

  if (!normalizedSelection) {
    return createMarkMutationResult({
      marks,
      sequences,
      changed: false,
      reason: "empty-selection",
    });
  }

  const normalizedSceneId = String(sceneId ?? "");
  const existingMarks = Array.isArray(marks) ? marks : [];
  const blockSpans = createSceneBlockSpans(sceneBlocks, normalizedText, {
    chapterId,
    sceneId: normalizedSceneId,
  });
  const selectedSegments = createSceneSelectionSegments(normalizedSelection, blockSpans);
  if (!selectedSegments.length) {
    return createMarkMutationResult({
      marks: existingMarks,
      sequences,
      changed: false,
      reason: "unmapped-selection",
      unmappedSelection: normalizedSelection,
    });
  }

  const editableRanges = existingMarks
    .map((mark) => createEditableMarkSceneRange(mark, blockSpans, {
      sceneId: normalizedSceneId,
      kind: normalizedKind,
      source,
    }))
    .filter(Boolean);
  const fullyCovered = selectedSegments.every((segment) =>
    isSceneRangeFullyCoveredByMarks(editableRanges, segment.sceneStartOffset, segment.sceneEndOffset)
  );

  let markSequence = resolveMarkSequence(sequences, existingMarks);
  const allocateMarkId = () => {
    markSequence += 1;
    return formatCanonicalMarkId(markSequence);
  };
  const retainedMarks = [];
  const addedMarks = [];
  const removedMarkIds = [];
  const normalizedMetadata = normalizeManuscriptMarkMetadata(metadata);
  const applySelectedSegments = mutationMode === "apply" || !fullyCovered;

  for (const mark of existingMarks) {
    const editableRange = createEditableMarkSceneRange(mark, blockSpans, {
      sceneId: normalizedSceneId,
      kind: normalizedKind,
      source,
    });
    if (!editableRange || !doesSceneRangeOverlapSegments(editableRange, selectedSegments)) {
      retainedMarks.push(mark);
      continue;
    }

    removedMarkIds.push(mark.id);
    for (const fragment of subtractSegmentsFromSceneRange(editableRange, selectedSegments)) {
      addedMarks.push(createManuscriptMarkFromSpan({
        markId: allocateMarkId(),
        kind: normalizedKind,
        span: editableRange.span,
        localStart: fragment.startOffset - editableRange.span.startOffset,
        localEnd: fragment.endOffset - editableRange.span.startOffset,
        projectId,
        sceneId: normalizedSceneId,
        now,
        source,
        metadata: editableRange.mark.metadata,
      }));
    }
  }

  if (applySelectedSegments) {
    for (const segment of selectedSegments) {
      addedMarks.push(createManuscriptMarkFromSpan({
        markId: allocateMarkId(),
        kind: normalizedKind,
        span: segment.span,
        localStart: segment.localStart,
        localEnd: segment.localEnd,
        projectId,
        sceneId: normalizedSceneId,
        now,
        source,
        metadata: normalizedMetadata,
      }));
    }
  }

  const nextMarks = [
    ...retainedMarks,
    ...addedMarks,
  ];
  return createMarkMutationResult({
    marks: nextMarks,
    sequences: updateMarkSequence(sequences, markSequence),
    changed: JSON.stringify(existingMarks) !== JSON.stringify(nextMarks),
    reason: mutationMode === "apply" ? "applied-mark" : fullyCovered ? "removed-mark" : "added-mark",
    addedMarks,
    removedMarkIds,
    toggledOff: mutationMode === "toggle" && fullyCovered,
  });
}

// Intent: preserve existing same-kind compatibility marks before a direct command removes legacy ranges.
export function promoteCompatibilityManuscriptMarksForSceneFormat({
  marks = [],
  sequences = {},
  sceneId = "",
  kind = "",
  source = "author",
  now = "",
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const normalizedKind = normalizeManuscriptMarkKind(kind);
  const existingMarks = Array.isArray(marks) ? marks : [];
  if (!normalizedSceneId || !normalizedKind) {
    return {
      marks: existingMarks,
      sequences,
      changed: false,
      promotedMarkIds: [],
    };
  }

  let markSequence = resolveMarkSequence(sequences, existingMarks);
  const promotedMarkIds = [];
  const nextMarks = existingMarks.map((mark) => {
    const normalizedMark = normalizeManuscriptMark(mark, { sceneId: normalizedSceneId });
    if (
      !normalizedMark ||
      !isCompatibilityManuscriptMark(normalizedMark) ||
      normalizedMark.kind !== normalizedKind ||
      normalizedMark.source !== source ||
      normalizedMark.anchor.sceneId !== normalizedSceneId
    ) {
      return mark;
    }

    markSequence += 1;
    const promotedId = formatCanonicalMarkId(markSequence);
    promotedMarkIds.push(normalizedMark.id);
    return {
      ...normalizedMark,
      id: promotedId,
      updatedAt: String(now ?? "") || normalizedMark.updatedAt,
    };
  });

  return {
    marks: nextMarks,
    sequences: updateMarkSequence(sequences, markSequence),
    changed: promotedMarkIds.length > 0,
    promotedMarkIds,
  };
}

export function createAuthorMarkProjectionFromManuscriptMark(mark, {
  sceneId = "",
  sceneBlocks = [],
  text = "",
  channel = "author-mark",
  priority = 100,
} = {}) {
  const normalizedMark = normalizeManuscriptMark(mark, { sceneId });
  if (!normalizedMark) {
    return null;
  }

  const blockSpans = createSceneBlockSpans(sceneBlocks, String(text ?? ""), {
    sceneId,
  });
  const span = blockSpans.find((candidate) => candidate.blockId === normalizedMark.anchor.blockId);
  if (!span) {
    return null;
  }

  const startOffset = span.startOffset + normalizedMark.anchor.startOffset;
  const endOffset = span.startOffset + normalizedMark.anchor.endOffset;
  if (
    startOffset < span.startOffset ||
    endOffset > span.endOffset ||
    endOffset <= startOffset ||
    String(text ?? "").slice(startOffset, endOffset) !== span.text.slice(normalizedMark.anchor.startOffset, normalizedMark.anchor.endOffset)
  ) {
    return null;
  }

  return {
    id: `${channel}:${normalizedMark.id}`,
    sceneId,
    startOffset,
    endOffset,
    channel,
    styleToken: normalizedMark.kind,
    priority,
    persistence: "derived-durable",
    ...createAuthorMarkProjectionStyle(normalizedMark),
    sourceRef: {
      recordType: "manuscriptMark",
      recordId: normalizedMark.id,
    },
  };
}

function createMarksForRange(range, kind, blockSpans, {
  projectId = "",
  sceneId = "",
  now = "",
} = {}) {
  const marks = [];
  for (const span of blockSpans) {
    if (!span.blockId) {
      continue;
    }

    const overlapStart = Math.max(range.startOffset, span.startOffset);
    const overlapEnd = Math.min(range.endOffset, span.endOffset);
    if (overlapEnd <= overlapStart) {
      continue;
    }

    const localStart = overlapStart - span.startOffset;
    const localEnd = overlapEnd - span.startOffset;
    marks.push(createManuscriptMarkFromSpan({
      range,
      kind,
      span,
      localStart,
      localEnd,
      projectId,
      sceneId,
      now,
      metadata: range.metadata,
    }));
  }
  return marks;
}

function createManuscriptMarkFromSpan({
  markId = "",
  range,
  kind,
  span,
  localStart,
  localEnd,
  projectId,
  sceneId,
  now,
  source = "author",
  metadata = null,
}) {
  const evidence = createAnchorEvidence({
    text: span.text,
    startOffset: localStart,
    endOffset: localEnd,
  });

  return {
    id: markId || createDerivedMarkId(range.id, span.blockId, localStart, localEnd),
    kind,
    source,
    anchor: {
      projectId: String(projectId ?? ""),
      chapterId: span.chapterId,
      sceneId: span.sceneId || sceneId,
      blockId: span.blockId,
      paragraphId: span.paragraphId,
      startOffset: localStart,
      endOffset: localEnd,
    },
    anchorStatus: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
    anchorDirtyReason: "",
    evidenceMode: evidence.evidenceMode,
    evidenceExcerpt: evidence.evidenceExcerpt,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    prefixContext: evidence.prefixContext,
    suffixContext: evidence.suffixContext,
    createdAt: String(now ?? ""),
    updatedAt: String(now ?? ""),
    ...(metadata && Object.keys(metadata).length ? { metadata: normalizeManuscriptMarkMetadata(metadata) } : {}),
  };
}

function normalizeManuscriptMark(mark, {
  sceneId = "",
} = {}) {
  if (!mark || typeof mark !== "object" || Array.isArray(mark)) {
    return null;
  }

  const id = typeof mark.id === "string" && mark.id.trim() ? mark.id.trim() : "";
  const kind = normalizeManuscriptMarkKind(mark.kind);
  const anchor = mark.anchor && typeof mark.anchor === "object" && !Array.isArray(mark.anchor)
    ? mark.anchor
    : null;
  const startOffset = Number(anchor?.startOffset);
  const endOffset = Number(anchor?.endOffset);
  const anchorSceneId = typeof anchor?.sceneId === "string" && anchor.sceneId
    ? anchor.sceneId
    : String(sceneId ?? "");

  if (
    !id ||
    !kind ||
    !anchor ||
    !anchorSceneId ||
    (sceneId && anchorSceneId !== sceneId) ||
    typeof anchor.blockId !== "string" ||
    !anchor.blockId ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset
  ) {
    return null;
  }

  const metadata = normalizeManuscriptMarkMetadata(mark.metadata);
  return {
    ...mark,
    id,
    kind,
    anchor: {
      ...anchor,
      sceneId: anchorSceneId,
      startOffset,
      endOffset,
    },
    anchorStatus: normalizeAnchorStatus(mark.anchorStatus, MANUSCRIPT_ANCHOR_STATUS.RESOLVED),
    anchorDirtyReason: typeof mark.anchorDirtyReason === "string" ? mark.anchorDirtyReason : "",
    ...(metadata ? { metadata } : {}),
  };
}

function createSceneBlockSpans(sceneBlocks, sceneText, {
  chapterId = "",
  sceneId = "",
} = {}) {
  const blocks = Array.isArray(sceneBlocks) ? sceneBlocks : [];
  const text = String(sceneText ?? "");
  if (!blocks.length) {
    return [];
  }

  if (blocks.length === 1) {
    const block = blocks[0];
    const blockText = text || String(block?.text ?? "");
    return [createBlockSpan(block, {
      chapterId,
      sceneId,
      text: blockText,
      startOffset: 0,
      endOffset: blockText.length,
    })];
  }

  const exactSpans = [];
  let cursor = 0;
  for (const block of blocks) {
    const blockText = String(block?.text ?? "");
    const expectedStart = cursor;
    const expectedEnd = expectedStart + blockText.length;
    if (text.slice(expectedStart, expectedEnd) !== blockText) {
      return createLocatedSceneBlockSpans(blocks, text, {
        chapterId,
        sceneId,
      });
    }

    exactSpans.push(createBlockSpan(block, {
      chapterId,
      sceneId,
      text: blockText,
      startOffset: expectedStart,
      endOffset: expectedEnd,
    }));
    cursor = expectedEnd + DEFAULT_SCENE_BLOCK_SEPARATOR.length;
  }

  return exactSpans;
}

// Intent: recover highlight anchors when loaded scene text uses a different block separator than the canonical editor composer.
function createLocatedSceneBlockSpans(blocks, sceneText, {
  chapterId = "",
  sceneId = "",
} = {}) {
  const text = String(sceneText ?? "");
  const spans = [];
  let cursor = 0;
  for (const block of blocks) {
    const blockText = String(block?.text ?? "");
    if (!blockText) {
      continue;
    }

    const startOffset = text.indexOf(blockText, cursor);
    if (startOffset === -1) {
      return createFallbackSceneTextSpan(blocks, text, {
        chapterId,
        sceneId,
      });
    }

    const endOffset = startOffset + blockText.length;
    spans.push(createBlockSpan(block, {
      chapterId,
      sceneId,
      text: blockText,
      startOffset,
      endOffset,
    }));
    cursor = endOffset;
  }

  return spans.length
    ? spans
    : createFallbackSceneTextSpan(blocks, text, {
        chapterId,
        sceneId,
      });
}

function createFallbackSceneTextSpan(blocks, sceneText, {
  chapterId = "",
  sceneId = "",
} = {}) {
  const fallbackBlock = blocks.find((block) => {
    const blockId = typeof block?.blockId === "string" ? block.blockId : "";
    const id = typeof block?.id === "string" ? block.id : "";
    return Boolean(blockId || id);
  }) ?? blocks[0] ?? {};
  const text = String(sceneText ?? "");
  return [createBlockSpan(fallbackBlock, {
    chapterId,
    sceneId,
    text,
    startOffset: 0,
    endOffset: text.length,
  })];
}

function createBlockSpan(block, {
  chapterId,
  sceneId,
  text,
  startOffset,
  endOffset,
}) {
  const blockId = typeof block?.blockId === "string" && block.blockId
    ? block.blockId
    : typeof block?.id === "string" && block.id
      ? block.id
      : "";

  return {
    blockId,
    paragraphId: typeof block?.paragraphId === "string" && block.paragraphId
      ? block.paragraphId
      : blockId,
    chapterId: typeof block?.chapterId === "string" && block.chapterId
      ? block.chapterId
      : String(chapterId ?? ""),
    sceneId: typeof block?.sceneId === "string" && block.sceneId
      ? block.sceneId
      : String(sceneId ?? ""),
    text,
    startOffset,
    endOffset,
  };
}

function normalizeSceneSelection(selection, textLength) {
  if (!selection || typeof selection !== "object" || selection.collapsed === true) {
    return null;
  }

  const startOffset = clampOffset(selection.startOffset, textLength);
  const endOffset = clampOffset(selection.endOffset, textLength);
  const start = Math.min(startOffset, endOffset);
  const end = Math.max(startOffset, endOffset);
  if (end <= start) {
    return null;
  }

  return {
    startOffset: start,
    endOffset: end,
  };
}

function createSceneSelectionSegments(selection, blockSpans) {
  const segments = [];
  for (const span of blockSpans) {
    if (!span.blockId) {
      continue;
    }

    const sceneStartOffset = Math.max(selection.startOffset, span.startOffset);
    const sceneEndOffset = Math.min(selection.endOffset, span.endOffset);
    if (sceneEndOffset <= sceneStartOffset) {
      continue;
    }

    segments.push({
      span,
      sceneStartOffset,
      sceneEndOffset,
      localStart: sceneStartOffset - span.startOffset,
      localEnd: sceneEndOffset - span.startOffset,
    });
  }
  return segments;
}

function createEditableMarkSceneRange(mark, blockSpans, {
  sceneId = "",
  kind = "",
  source = "author",
} = {}) {
  const normalizedMark = normalizeManuscriptMark(mark, { sceneId });
  if (
    !normalizedMark ||
    normalizedMark.kind !== kind ||
    normalizedMark.source !== source
  ) {
    return null;
  }

  const span = blockSpans.find((candidate) => candidate.blockId === normalizedMark.anchor.blockId) ?? null;
  if (!span) {
    return null;
  }

  const sceneStartOffset = span.startOffset + normalizedMark.anchor.startOffset;
  const sceneEndOffset = span.startOffset + normalizedMark.anchor.endOffset;
  if (
    sceneStartOffset < span.startOffset ||
    sceneEndOffset > span.endOffset ||
    sceneEndOffset <= sceneStartOffset
  ) {
    return null;
  }

  return {
    mark: normalizedMark,
    span,
    sceneStartOffset,
    sceneEndOffset,
  };
}

function updateManuscriptMarkForSceneTransaction(mark, {
  projectId = "",
  sceneId = "",
  previous = "",
  next = "",
  previousSpans = [],
  nextSpans = [],
  transaction = null,
  pendingFormats = {},
  now = "",
} = {}) {
  const normalizedMark = normalizeManuscriptMark(mark, { sceneId });
  if (!normalizedMark || normalizedMark.anchor.sceneId !== sceneId) {
    return mark;
  }

  const previousRange = resolveMarkSceneRange(normalizedMark, previousSpans, previous);
  if (!previousRange) {
    return mark;
  }

  if (shouldSplitInsertedTextOutOfMark(normalizedMark, previousRange, transaction, pendingFormats)) {
    return splitManuscriptMarkAroundInsertedText(mark, {
      projectId,
      sceneId,
      previousRange,
      next,
      nextSpans,
      transaction,
      now,
    });
  }

  const mutation = applyEditTransactionToAnchor({
    anchorId: `manuscriptMark:${normalizedMark.id}`,
    sceneId,
    startOffset: previousRange.startOffset,
    endOffset: previousRange.endOffset,
    status: normalizedMark.anchorStatus,
    dirtyReason: normalizedMark.anchorDirtyReason,
    evidenceExcerpt: normalizedMark.evidenceExcerpt,
    originalHash: normalizedMark.originalHash,
    originalLength: normalizedMark.originalLength,
    selectedTextPreview: normalizedMark.selectedTextPreview,
    prefixContext: normalizedMark.prefixContext,
    suffixContext: normalizedMark.suffixContext,
  }, transaction, {
    textLength: previous.length,
    now,
  });
  if (!mutation.changed) {
    return mark;
  }

  const nextRange = {
    startOffset: Math.max(0, Math.min(mutation.anchor.startOffset, next.length)),
    endOffset: Math.max(0, Math.min(mutation.anchor.endOffset, next.length)),
  };
  const nextSpan = nextSpans.find((span) => (
    nextRange.startOffset >= span.startOffset &&
    nextRange.endOffset <= span.endOffset
  )) ?? null;
  if (!nextSpan || nextRange.endOffset <= nextRange.startOffset) {
    return {
      ...mark,
      anchorStatus: MANUSCRIPT_ANCHOR_STATUS.STALE,
      anchorDirtyReason: "anchor-unresolved",
      anchorLastTouchedAt: mutation.anchor.lastTouchedAt || now,
      anchorLastTouchedByEditId: mutation.anchor.lastTouchedByEditId,
    };
  }

  const localStart = nextRange.startOffset - nextSpan.startOffset;
  const localEnd = nextRange.endOffset - nextSpan.startOffset;
  const nextAnchor = {
    ...normalizedMark.anchor,
    projectId: String(projectId ?? normalizedMark.anchor.projectId ?? ""),
    chapterId: nextSpan.chapterId || normalizedMark.anchor.chapterId,
    sceneId,
    blockId: nextSpan.blockId || normalizedMark.anchor.blockId,
    paragraphId: nextSpan.paragraphId || normalizedMark.anchor.paragraphId,
    startOffset: localStart,
    endOffset: localEnd,
  };
  const status = normalizeAnchorStatus(mutation.anchor.status, MANUSCRIPT_ANCHOR_STATUS.RESOLVED);
  const evidencePatch = status === MANUSCRIPT_ANCHOR_STATUS.SHIFTED
    ? {}
    : createManuscriptMarkEvidencePatch(nextSpan.text, localStart, localEnd);

  return {
    ...mark,
    ...evidencePatch,
    anchor: nextAnchor,
    anchorStatus: status,
    anchorDirtyReason: mutation.anchor.dirtyReason,
    anchorLastTouchedAt: mutation.anchor.lastTouchedAt || now,
    anchorLastTouchedByEditId: mutation.anchor.lastTouchedByEditId,
    updatedAt: now || mark.updatedAt,
  };
}

function shouldSplitInsertedTextOutOfMark(mark, previousRange, transaction, pendingFormats) {
  const markKind = normalizeManuscriptMarkKind(mark?.kind);
  if (
    !markKind ||
    pendingFormats?.[markKind] === true ||
    !transaction ||
    transaction.deletedLength !== 0 ||
    transaction.insertedLength <= 0
  ) {
    return false;
  }

  return (
    transaction.startOffset > previousRange.startOffset &&
    transaction.startOffset < previousRange.endOffset
  );
}

function splitManuscriptMarkAroundInsertedText(mark, {
  projectId = "",
  sceneId = "",
  previousRange = null,
  next = "",
  nextSpans = [],
  transaction = null,
  now = "",
} = {}) {
  if (!previousRange || !transaction) {
    return mark;
  }

  const afterShift = transaction.insertedLength;
  const fragments = [{
    id: mark.id,
    startOffset: previousRange.startOffset,
    endOffset: transaction.startOffset,
  }, {
    id: createSplitManuscriptMarkId(mark.id, transaction.startOffset + afterShift, previousRange.endOffset + afterShift),
    startOffset: transaction.startOffset + afterShift,
    endOffset: previousRange.endOffset + afterShift,
  }];

  const splitMarks = fragments
    .filter((fragment) => fragment.endOffset > fragment.startOffset)
    .map((fragment) => createManuscriptMarkFromSceneRange(mark, fragment, {
      projectId,
      sceneId,
      text: next,
      blockSpans: nextSpans,
      now,
    }))
    .filter(Boolean);

  return splitMarks.length ? splitMarks : mark;
}

function createManuscriptMarkFromSceneRange(mark, range, {
  projectId = "",
  sceneId = "",
  text = "",
  blockSpans = [],
  now = "",
} = {}) {
  const span = blockSpans.find((candidate) => (
    range.startOffset >= candidate.startOffset &&
    range.endOffset <= candidate.endOffset
  )) ?? null;
  if (!span) {
    return null;
  }

  const localStart = range.startOffset - span.startOffset;
  const localEnd = range.endOffset - span.startOffset;
  if (localEnd <= localStart) {
    return null;
  }

  return {
    ...mark,
    id: range.id,
    ...createManuscriptMarkEvidencePatch(span.text, localStart, localEnd),
    anchor: {
      ...(mark.anchor && typeof mark.anchor === "object" ? mark.anchor : {}),
      projectId: String(projectId ?? mark.anchor?.projectId ?? ""),
      chapterId: span.chapterId || mark.anchor?.chapterId || "",
      sceneId,
      blockId: span.blockId || mark.anchor?.blockId || "",
      paragraphId: span.paragraphId || mark.anchor?.paragraphId || "",
      startOffset: localStart,
      endOffset: localEnd,
    },
    anchorStatus: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
    anchorDirtyReason: "",
    anchorLastTouchedAt: now,
    anchorLastTouchedByEditId: "",
    updatedAt: now || mark.updatedAt,
  };
}

function resolveMarkSceneRange(mark, blockSpans, text) {
  const anchor = mark?.anchor;
  const span = blockSpans.find((candidate) => candidate.blockId === anchor?.blockId) ?? null;
  if (span) {
    const startOffset = span.startOffset + anchor.startOffset;
    const endOffset = span.startOffset + anchor.endOffset;
    if (
      startOffset >= span.startOffset &&
      endOffset <= span.endOffset &&
      endOffset > startOffset
    ) {
      return {
        startOffset,
        endOffset,
      };
    }
  }

  return resolveMarkSceneRangeFromEvidence(mark, text);
}

function resolveMarkSceneRangeFromEvidence(mark, text) {
  const source = String(text ?? "");
  const evidenceExcerpt = typeof mark?.evidenceExcerpt === "string" && mark.evidenceExcerpt
    ? mark.evidenceExcerpt
    : typeof mark?.selectedTextPreview === "string"
      ? mark.selectedTextPreview
      : "";
  if (!evidenceExcerpt) {
    return null;
  }

  const prefix = typeof mark?.prefixContext === "string" ? mark.prefixContext : "";
  const suffix = typeof mark?.suffixContext === "string" ? mark.suffixContext : "";
  const contextNeedle = `${prefix}${evidenceExcerpt}${suffix}`;
  const contextIndex = contextNeedle.trim() ? source.indexOf(contextNeedle) : -1;
  if (contextIndex >= 0) {
    const startOffset = contextIndex + prefix.length;
    return {
      startOffset,
      endOffset: startOffset + evidenceExcerpt.length,
    };
  }

  const excerptIndex = source.indexOf(evidenceExcerpt);
  if (excerptIndex < 0) {
    return null;
  }

  return {
    startOffset: excerptIndex,
    endOffset: excerptIndex + evidenceExcerpt.length,
  };
}

function createManuscriptMarkEvidencePatch(text, startOffset, endOffset) {
  const evidence = createAnchorEvidence({
    text,
    startOffset,
    endOffset,
  });

  return {
    evidenceMode: evidence.evidenceMode,
    evidenceExcerpt: evidence.evidenceExcerpt,
    originalHash: evidence.originalHash,
    originalLength: evidence.originalLength,
    selectedTextPreview: evidence.selectedTextPreview,
    prefixContext: evidence.prefixContext,
    suffixContext: evidence.suffixContext,
  };
}

function isSceneRangeFullyCoveredByMarks(markRanges, startOffset, endOffset) {
  let cursor = startOffset;
  const sortedRanges = markRanges
    .filter((range) => range.sceneEndOffset > startOffset && range.sceneStartOffset < endOffset)
    .sort((left, right) => left.sceneStartOffset - right.sceneStartOffset || left.sceneEndOffset - right.sceneEndOffset);
  for (const range of sortedRanges) {
    if (range.sceneStartOffset > cursor) {
      return false;
    }

    cursor = Math.max(cursor, range.sceneEndOffset);
    if (cursor >= endOffset) {
      return true;
    }
  }
  return false;
}

function doesSceneRangeOverlapSegments(range, segments) {
  return segments.some((segment) =>
    range.sceneEndOffset > segment.sceneStartOffset &&
    range.sceneStartOffset < segment.sceneEndOffset
  );
}

function subtractSegmentsFromSceneRange(range, segments) {
  let fragments = [{
    startOffset: range.sceneStartOffset,
    endOffset: range.sceneEndOffset,
  }];

  for (const segment of segments) {
    const nextFragments = [];
    for (const fragment of fragments) {
      if (
        fragment.endOffset <= segment.sceneStartOffset ||
        fragment.startOffset >= segment.sceneEndOffset
      ) {
        nextFragments.push(fragment);
        continue;
      }

      if (fragment.startOffset < segment.sceneStartOffset) {
        nextFragments.push({
          startOffset: fragment.startOffset,
          endOffset: segment.sceneStartOffset,
        });
      }

      if (fragment.endOffset > segment.sceneEndOffset) {
        nextFragments.push({
          startOffset: segment.sceneEndOffset,
          endOffset: fragment.endOffset,
        });
      }
    }
    fragments = nextFragments;
  }

  return fragments.filter((fragment) => fragment.endOffset > fragment.startOffset);
}

function createMarkMutationResult({
  marks,
  sequences,
  changed,
  reason,
  addedMarks = [],
  removedMarkIds = [],
  toggledOff = false,
  unmappedSelection = null,
}) {
  return {
    marks: Array.isArray(marks) ? marks : [],
    sequences,
    changed: changed === true,
    reason,
    addedMarks,
    removedMarkIds,
    toggledOff,
    unmappedSelection,
  };
}

function resolveMarkSequence(sequences, marks = []) {
  const explicitSequence = typeof sequences === "number"
    ? sequences
    : Number(sequences?.mark);
  const safeExplicitSequence = Number.isInteger(explicitSequence) && explicitSequence >= 0
    ? explicitSequence
    : 0;
  return Math.max(safeExplicitSequence, resolveHighestExistingMarkSequence(marks));
}

function resolveHighestExistingMarkSequence(marks = []) {
  let highest = 0;
  for (const mark of Array.isArray(marks) ? marks : []) {
    const match = /^mark-(\d+)$/.exec(String(mark?.id ?? ""));
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    if (Number.isInteger(value)) {
      highest = Math.max(highest, value);
    }
  }
  return highest;
}

function updateMarkSequence(sequences, nextMarkSequence) {
  if (typeof sequences === "number") {
    return nextMarkSequence;
  }

  return {
    ...(sequences && typeof sequences === "object" && !Array.isArray(sequences) ? sequences : {}),
    mark: nextMarkSequence,
  };
}

function formatCanonicalMarkId(sequence) {
  return `mark-${String(sequence).padStart(4, "0")}`;
}

function normalizeManuscriptMarkMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const normalized = {};
  if (typeof metadata.colorToken === "string" && metadata.colorToken.trim()) {
    normalized.colorToken = metadata.colorToken.trim();
  }

  if (SUPPORTED_MARK_PURPOSES.has(metadata.purpose)) {
    normalized.purpose = metadata.purpose;
  }

  const highlightColor = normalizeHighlightColorMetadata(metadata.highlightColor);
  if (highlightColor) {
    normalized.highlightColor = highlightColor;
  }

  return normalized;
}

function createAuthorMarkProjectionStyle(mark) {
  if (mark?.kind !== MANUSCRIPT_MARK_KINDS.HIGHLIGHT) {
    return {};
  }

  const metadata = normalizeManuscriptMarkMetadata(mark.metadata);
  const highlightColor = metadata?.highlightColor;
  if (!highlightColor) {
    return {};
  }

  return {
    visualStyle: {
      highlightColor: highlightColor.color,
      highlightOutline: highlightColor.outline,
      highlightColorId: highlightColor.id ?? "",
    },
  };
}

function normalizeHighlightColorMetadata(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const color = normalizeRgbaColor(candidate.color);
  const outline = normalizeRgbaColor(candidate.outline);
  if (!color || !outline) {
    return null;
  }

  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
  const rgb = normalizeHighlightRgb(candidate.rgb);
  return {
    ...(id ? { id } : {}),
    ...(label ? { label } : {}),
    color,
    outline,
    ...(rgb ? { rgb } : {}),
  };
}

function normalizeRgbaColor(value) {
  const source = String(value ?? "").trim();
  const match = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i.exec(source);
  if (!match) {
    return "";
  }

  const red = clampColorChannel(match[1]);
  const green = clampColorChannel(match[2]);
  const blue = clampColorChannel(match[3]);
  const alpha = Math.max(0, Math.min(1, Number(match[4])));
  return `rgba(${red}, ${green}, ${blue}, ${formatColorAlpha(alpha)})`;
}

function normalizeHighlightRgb(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  return {
    red: clampColorChannel(candidate.red),
    green: clampColorChannel(candidate.green),
    blue: clampColorChannel(candidate.blue),
  };
}

function clampColorChannel(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(255, Math.round(numericValue)));
}

function formatColorAlpha(value) {
  return Number(value.toFixed(3)).toString();
}

function normalizeManuscriptMarkKind(kind) {
  const value = String(kind ?? "");
  return SUPPORTED_MARK_KINDS.has(value) ? value : "";
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, textLength));
}

function createDerivedMarkId(rangeId, blockId, startOffset, endOffset) {
  return [
    "mark",
    sanitizeIdPart(rangeId),
    sanitizeIdPart(blockId),
    String(startOffset),
    String(endOffset),
  ].filter(Boolean).join("-");
}

function createSplitManuscriptMarkId(markId, startOffset, endOffset) {
  return [
    sanitizeIdPart(markId),
    "split",
    String(startOffset),
    String(endOffset),
  ].filter(Boolean).join("-");
}

function sanitizeIdPart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
