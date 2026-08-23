// Intent: derive live edit transactions for anchor mutation without making them persisted records.
import { createStableTextHash } from "./manuscript-anchor-service.js";

export function deriveManuscriptEditTransaction({
  sceneId = "",
  previousText = "",
  nextText = "",
  editId = "",
  createdAt = "",
  selectionStart = null,
  selectionEnd = null,
  selectionBeforeInputStart = null,
  selectionBeforeInputEnd = null,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "");
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (!normalizedSceneId || previous === next) {
    return null;
  }

  const selectedTextReplacement = resolveSelectedTextReplacement({
    sceneId: normalizedSceneId,
    previousText: previous,
    nextText: next,
    editId,
    createdAt,
    selectionBeforeInputStart,
    selectionBeforeInputEnd,
  });
  if (selectedTextReplacement) {
    return selectedTextReplacement;
  }

  const caretResolvedInsertion = resolveCaretAnchoredInsertion({
    sceneId: normalizedSceneId,
    previousText: previous,
    nextText: next,
    editId,
    createdAt,
    selectionStart,
    selectionEnd,
  });
  if (caretResolvedInsertion) {
    return caretResolvedInsertion;
  }

  let startOffset = 0;
  while (
    startOffset < previous.length &&
    startOffset < next.length &&
    previous[startOffset] === next[startOffset]
  ) {
    startOffset += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - startOffset &&
    suffixLength < next.length - startOffset &&
    previous[previous.length - 1 - suffixLength] === next[next.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const previousEndOffset = previous.length - suffixLength;
  const nextEndOffset = next.length - suffixLength;
  const deletedText = previous.slice(startOffset, previousEndOffset);
  const insertedText = next.slice(startOffset, nextEndOffset);
  const insertedLength = insertedText.length;
  const deletedLength = deletedText.length;
  const stableEditId = editId || [
    "edit",
    normalizedSceneId,
    startOffset,
    previousEndOffset,
    insertedLength,
    deletedLength,
    createStableTextHash(`${deletedText}\u001f${insertedText}`),
  ].join(":");

  return {
    editId: stableEditId,
    sceneId: normalizedSceneId,
    startOffset,
    endOffset: previousEndOffset,
    insertedText,
    deletedText,
    insertedLength,
    deletedLength,
    delta: insertedLength - deletedLength,
    createdAt: typeof createdAt === "string" ? createdAt : "",
    persistence: "runtime-only",
  };
}

// Intent: use the browser's pre-input selection when replacement text could otherwise resemble a repeated-character insertion.
function resolveSelectedTextReplacement({
  sceneId = "",
  previousText = "",
  nextText = "",
  editId = "",
  createdAt = "",
  selectionBeforeInputStart = null,
  selectionBeforeInputEnd = null,
} = {}) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  const rawStart = Number(selectionBeforeInputStart);
  const rawEnd = Number(selectionBeforeInputEnd);
  if (!sceneId || !Number.isInteger(rawStart) || !Number.isInteger(rawEnd)) {
    return null;
  }

  const startOffset = Math.max(0, Math.min(rawStart, rawEnd, previous.length));
  const endOffset = Math.max(startOffset, Math.min(Math.max(rawStart, rawEnd), previous.length));
  if (endOffset <= startOffset) {
    return null;
  }

  const insertedEndOffset = next.length - (previous.length - endOffset);
  if (insertedEndOffset < startOffset || insertedEndOffset > next.length) {
    return null;
  }

  const insertedText = next.slice(startOffset, insertedEndOffset);
  const deletedText = previous.slice(startOffset, endOffset);
  if (`${previous.slice(0, startOffset)}${insertedText}${previous.slice(endOffset)}` !== next) {
    return null;
  }

  return createEditTransaction({
    sceneId,
    startOffset,
    endOffset,
    insertedText,
    deletedText,
    editId,
    createdAt,
  });
}

function createEditTransaction({
  sceneId,
  startOffset,
  endOffset,
  insertedText,
  deletedText,
  editId,
  createdAt,
}) {
  const insertedLength = insertedText.length;
  const deletedLength = deletedText.length;
  const stableEditId = editId || [
    "edit",
    sceneId,
    startOffset,
    endOffset,
    insertedLength,
    deletedLength,
    createStableTextHash(`${deletedText}\u001f${insertedText}`),
  ].join(":");

  return {
    editId: stableEditId,
    sceneId,
    startOffset,
    endOffset,
    insertedText,
    deletedText,
    insertedLength,
    deletedLength,
    delta: insertedLength - deletedLength,
    createdAt: typeof createdAt === "string" ? createdAt : "",
    persistence: "runtime-only",
  };
}

// Intent: prefer the browser caret for pure insertions so repeated nearby text cannot pull anchors backward.
function resolveCaretAnchoredInsertion({
  sceneId = "",
  previousText = "",
  nextText = "",
  editId = "",
  createdAt = "",
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  const insertedLength = next.length - previous.length;
  if (!sceneId || insertedLength <= 0) {
    return null;
  }

  const caretStart = Number(selectionStart);
  const caretEnd = Number(selectionEnd);
  if (!Number.isInteger(caretStart) || !Number.isInteger(caretEnd) || caretStart !== caretEnd) {
    return null;
  }

  const nextCaretOffset = Math.max(0, Math.min(caretStart, next.length));
  const startOffset = nextCaretOffset - insertedLength;
  if (startOffset < 0 || startOffset > previous.length) {
    return null;
  }

  const insertedText = next.slice(startOffset, nextCaretOffset);
  const reconstructedText = `${previous.slice(0, startOffset)}${insertedText}${previous.slice(startOffset)}`;
  if (reconstructedText !== next) {
    return null;
  }

  const stableEditId = editId || [
    "edit",
    sceneId,
    startOffset,
    startOffset,
    insertedLength,
    0,
    createStableTextHash(`\u001f${insertedText}`),
  ].join(":");

  return {
    editId: stableEditId,
    sceneId,
    startOffset,
    endOffset: startOffset,
    insertedText,
    deletedText: "",
    insertedLength,
    deletedLength: 0,
    delta: insertedLength,
    createdAt: typeof createdAt === "string" ? createdAt : "",
    persistence: "runtime-only",
  };
}
