// Intent: validate and recover saved anchors from lightweight hash/context evidence on project load.
import {
  MANUSCRIPT_ANCHOR_EVIDENCE_MODE,
  MANUSCRIPT_ANCHOR_STATUS,
  createStableTextHash,
  normalizeManuscriptAnchor,
} from "./manuscript-anchor-service.js";

export function validateAnchorAgainstText(anchor = {}, text = "", options = {}) {
  const source = String(text ?? "");
  const normalized = normalizeManuscriptAnchor(anchor, {
    textLength: source.length,
    allowCollapsed: false,
    defaultStatus: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
  });
  if (!normalized) {
    return {
      ...anchor,
      status: MANUSCRIPT_ANCHOR_STATUS.ORPHANED,
      dirtyReason: "anchor-out-of-range",
    };
  }

  const currentText = source.slice(normalized.startOffset, normalized.endOffset);
  if (doesEvidenceMatchCurrentText(normalized, currentText)) {
    return {
      ...normalized,
      status: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
      dirtyReason: "",
    };
  }

  const recovered = recoverAnchorFromContext(normalized, source, options);
  if (recovered) {
    return {
      ...normalized,
      startOffset: recovered.startOffset,
      endOffset: recovered.endOffset,
      status: MANUSCRIPT_ANCHOR_STATUS.APPROXIMATE,
      dirtyReason: "context-recovered",
    };
  }

  return {
    ...normalized,
    status: MANUSCRIPT_ANCHOR_STATUS.STALE,
    dirtyReason: "hash-mismatch",
  };
}

export function validateAnchorsAgainstText(anchors = [], text = "", options = {}) {
  return (Array.isArray(anchors) ? anchors : []).map((anchor) =>
    validateAnchorAgainstText(anchor, text, options),
  );
}

export function recoverAnchorFromContext(anchor = {}, text = "", {
  searchRadius = 800,
  minimumScore = 3,
} = {}) {
  const source = String(text ?? "");
  const preview = String(anchor?.selectedTextPreview ?? anchor?.evidenceExcerpt ?? "");
  if (!preview) {
    return null;
  }

  const candidates = collectPreviewCandidates(source, preview, Number(anchor.startOffset) || 0, searchRadius);
  let best = null;
  for (const startOffset of candidates) {
    const endOffset = Math.min(source.length, startOffset + Math.max(preview.length, Number(anchor.originalLength) || preview.length));
    const score = scoreContextCandidate(source, startOffset, endOffset, anchor);
    if (!best || score > best.score || (score === best.score && Math.abs(startOffset - anchor.startOffset) < Math.abs(best.startOffset - anchor.startOffset))) {
      best = {
        startOffset,
        endOffset,
        score,
      };
    }
  }

  return best && best.score >= minimumScore ? best : null;
}

function doesEvidenceMatchCurrentText(anchor, currentText) {
  if (anchor.originalHash && createStableTextHash(currentText) === anchor.originalHash) {
    return true;
  }

  if (
    anchor.evidenceMode === MANUSCRIPT_ANCHOR_EVIDENCE_MODE.FULL &&
    anchor.evidenceExcerpt &&
    currentText === anchor.evidenceExcerpt
  ) {
    return true;
  }

  return false;
}

function collectPreviewCandidates(source, preview, originalStartOffset, searchRadius) {
  const candidates = new Set();
  const safeRadius = Math.max(0, Number(searchRadius) || 0);
  const nearStart = Math.max(0, originalStartOffset - safeRadius);
  const nearEnd = Math.min(source.length, originalStartOffset + safeRadius + preview.length);
  collectOccurrences(source.slice(nearStart, nearEnd), preview, nearStart, candidates);
  if (!candidates.size) {
    collectOccurrences(source, preview, 0, candidates);
  }
  return [...candidates];
}

function collectOccurrences(source, preview, offsetBase, candidates) {
  let index = source.indexOf(preview);
  while (index >= 0) {
    candidates.add(offsetBase + index);
    index = source.indexOf(preview, index + 1);
  }
}

function scoreContextCandidate(source, startOffset, endOffset, anchor) {
  let score = 1;
  const prefix = String(anchor?.prefixContext ?? "");
  const suffix = String(anchor?.suffixContext ?? "");
  const preview = String(anchor?.selectedTextPreview ?? anchor?.evidenceExcerpt ?? "");

  if (preview && source.slice(startOffset, startOffset + preview.length) === preview) {
    score += 1;
  }

  if (prefix && source.slice(Math.max(0, startOffset - prefix.length), startOffset) === prefix) {
    score += 2;
  }

  if (suffix && source.slice(endOffset, endOffset + suffix.length) === suffix) {
    score += 2;
  }

  return score;
}
