// Intent: update anchor offsets/status from live text transactions before decoration projections render.
import {
  MANUSCRIPT_ANCHOR_STATUS,
  normalizeManuscriptAnchor,
} from "./manuscript-anchor-service.js";

export function applyEditTransactionToAnchors(anchors = [], transaction = null, options = {}) {
  const changedAnchors = [];
  const nextAnchors = (Array.isArray(anchors) ? anchors : []).map((anchor) => {
    const result = applyEditTransactionToAnchor(anchor, transaction, options);
    if (result.changed) {
      changedAnchors.push(result.anchor);
    }
    return result.anchor;
  });

  return {
    anchors: nextAnchors,
    changedAnchors,
  };
}

export function applyEditTransactionToAnchor(anchor = {}, transaction = null, {
  textLength = Number.POSITIVE_INFINITY,
  now = "",
} = {}) {
  const normalizedAnchor = normalizeManuscriptAnchor(anchor, {
    textLength,
    defaultSceneId: transaction?.sceneId,
    allowCollapsed: true,
  });
  const normalizedTransaction = normalizeTransaction(transaction);
  if (!normalizedAnchor || !normalizedTransaction || normalizedAnchor.sceneId !== normalizedTransaction.sceneId) {
    return {
      anchor: anchor ?? null,
      changed: false,
      reason: "not-applicable",
    };
  }

  const start = normalizedAnchor.startOffset;
  const end = normalizedAnchor.endOffset;
  const editStart = normalizedTransaction.startOffset;
  const editEnd = normalizedTransaction.endOffset;
  const delta = normalizedTransaction.delta;

  if (editEnd <= start) {
    if (delta === 0) {
      return unchanged(normalizedAnchor);
    }
    return changed(normalizedAnchor, {
      startOffset: Math.max(0, start + delta),
      endOffset: Math.max(0, end + delta),
      status: MANUSCRIPT_ANCHOR_STATUS.SHIFTED,
      dirtyReason: "offset-shifted",
      transaction: normalizedTransaction,
      now,
    });
  }

  if (editStart >= end) {
    return unchanged(normalizedAnchor);
  }

  if (editStart <= start && editEnd >= end) {
    const nextStart = editStart;
    const nextEnd = editStart + normalizedTransaction.insertedLength;
    if (nextEnd <= nextStart) {
      return changed(normalizedAnchor, {
        startOffset: nextStart,
        endOffset: nextStart,
        status: MANUSCRIPT_ANCHOR_STATUS.DELETED,
        dirtyReason: "anchor-deleted",
        transaction: normalizedTransaction,
        now,
      });
    }

    return changed(normalizedAnchor, {
      startOffset: nextStart,
      endOffset: nextEnd,
      status: MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED,
      dirtyReason: "content-replaced",
      transaction: normalizedTransaction,
      now,
    });
  }

  const nextStart = editStart < start
    ? editStart + normalizedTransaction.insertedLength
    : start;
  const nextEnd = editEnd > end
    ? editStart + normalizedTransaction.insertedLength
    : end + delta;
  if (nextEnd <= nextStart) {
    return changed(normalizedAnchor, {
      startOffset: Math.max(0, nextStart),
      endOffset: Math.max(0, nextStart),
      status: MANUSCRIPT_ANCHOR_STATUS.DELETED,
      dirtyReason: "anchor-deleted",
      transaction: normalizedTransaction,
      now,
    });
  }

  return changed(normalizedAnchor, {
    startOffset: Math.max(0, nextStart),
    endOffset: Math.max(0, nextEnd),
    status: MANUSCRIPT_ANCHOR_STATUS.CONTENT_CHANGED,
    dirtyReason: "content-edited",
    transaction: normalizedTransaction,
    now,
  });
}

function unchanged(anchor) {
  return {
    anchor,
    changed: false,
    reason: "unchanged",
  };
}

function changed(anchor, {
  startOffset,
  endOffset,
  status,
  dirtyReason,
  transaction,
  now,
}) {
  return {
    anchor: {
      ...anchor,
      startOffset,
      endOffset,
      status,
      dirtyReason,
      lastTouchedAt: now || transaction.createdAt || anchor.lastTouchedAt || "",
      lastTouchedByEditId: transaction.editId,
    },
    changed: true,
    reason: dirtyReason,
  };
}

function normalizeTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") {
    return null;
  }

  const sceneId = typeof transaction.sceneId === "string" ? transaction.sceneId : "";
  const startOffset = Number(transaction.startOffset);
  const endOffset = Number(transaction.endOffset);
  if (!sceneId || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset < startOffset) {
    return null;
  }

  const insertedText = String(transaction.insertedText ?? "");
  const deletedText = String(transaction.deletedText ?? "");
  return {
    ...transaction,
    sceneId,
    startOffset,
    endOffset,
    insertedText,
    deletedText,
    insertedLength: Number.isInteger(transaction.insertedLength) ? transaction.insertedLength : insertedText.length,
    deletedLength: Number.isInteger(transaction.deletedLength) ? transaction.deletedLength : deletedText.length,
    delta: Number.isInteger(transaction.delta)
      ? transaction.delta
      : insertedText.length - deletedText.length,
    editId: typeof transaction.editId === "string" && transaction.editId ? transaction.editId : "edit:unknown",
    createdAt: typeof transaction.createdAt === "string" ? transaction.createdAt : "",
  };
}
