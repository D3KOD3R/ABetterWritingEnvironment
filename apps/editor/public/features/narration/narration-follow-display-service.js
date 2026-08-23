// Intent: derive runtime-only narration follow display spans without changing saved take anchors.

export const DEFAULT_NARRATION_FOLLOW_LEAD_MS = 6500;
export const DEFAULT_NARRATION_FOLLOW_LEAD_WPM = 155;
export const DEFAULT_NARRATION_FOLLOW_MAX_LEAD_WORDS = 22;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.max(min, Math.min(max, number));
}

function tokenizeWords(text = "") {
  return Array.from(String(text ?? "").matchAll(WORD_PATTERN))
    .map((match) => ({
      text: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    }));
}

function resolveLeadWordRange(text = "", offset = 0, leadWordCount = 0) {
  const words = tokenizeWords(text);
  if (!words.length) {
    return null;
  }

  const safeOffset = Math.max(0, Math.min(String(text ?? "").length, Math.floor(Number(offset) || 0)));
  const firstWordIndex = words.findIndex((word) => word.endOffset > safeOffset);
  if (firstWordIndex < 0) {
    return null;
  }

  const safeLeadWordCount = Math.max(1, Math.floor(Number(leadWordCount) || 1));
  const lastWordIndex = Math.min(words.length - 1, firstWordIndex + safeLeadWordCount - 1);
  return {
    startOffset: words[firstWordIndex].startOffset,
    endOffset: words[lastWordIndex].endOffset,
    wordCount: lastWordIndex - firstWordIndex + 1,
  };
}

function resolveIntegerOffset(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function resolveNarrationFollowViewportOffsets(selection) {
  if (!selection || typeof selection !== "object") {
    return {
      startOffset: 0,
      endOffset: 0,
    };
  }

  const startOffset = resolveIntegerOffset(selection.viewportStartOffset)
    ?? resolveIntegerOffset(selection.trackingStartOffset)
    ?? resolveIntegerOffset(selection.startOffset)
    ?? 0;
  const endOffset = resolveIntegerOffset(selection.viewportEndOffset)
    ?? resolveIntegerOffset(selection.trackingEndOffset)
    ?? resolveIntegerOffset(selection.endOffset)
    ?? startOffset;

  return {
    startOffset,
    endOffset: Math.max(startOffset, endOffset),
  };
}

// Intent: keep the painted current-word range tied to recognized speech rather than viewport lookahead offsets.
function resolveNarrationFollowTrackingOffsets(selection) {
  if (!selection || typeof selection !== "object") {
    return {
      startOffset: 0,
      endOffset: 0,
    };
  }

  const startOffset = resolveIntegerOffset(selection.trackingStartOffset)
    ?? resolveIntegerOffset(selection.startOffset)
    ?? 0;
  const endOffset = resolveIntegerOffset(selection.trackingEndOffset)
    ?? resolveIntegerOffset(selection.endOffset)
    ?? startOffset;

  return {
    startOffset,
    endOffset: Math.max(startOffset, endOffset),
  };
}

export function createNarrationFollowLeadSelection(selection, text = "", {
  leadMs = DEFAULT_NARRATION_FOLLOW_LEAD_MS,
  wordsPerMinute = DEFAULT_NARRATION_FOLLOW_LEAD_WPM,
  maxLeadWords = DEFAULT_NARRATION_FOLLOW_MAX_LEAD_WORDS,
} = {}) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const recognizedEndOffset = Number.isInteger(selection.trackingEndOffset)
    ? selection.trackingEndOffset
    : Number.isInteger(selection.endOffset)
      ? selection.endOffset
      : null;
  if (!Number.isInteger(recognizedEndOffset)) {
    return selection;
  }

  const leadWordCount = clampNumber(
    Math.round((clampNumber(wordsPerMinute, 40, 320) / 60000) * Math.max(0, Number(leadMs) || 0)),
    1,
    Math.max(1, Math.floor(Number(maxLeadWords) || DEFAULT_NARRATION_FOLLOW_MAX_LEAD_WORDS)),
  );
  const leadRange = resolveLeadWordRange(text, recognizedEndOffset, leadWordCount);
  if (!leadRange || leadRange.endOffset <= recognizedEndOffset) {
    return selection;
  }

  const currentOffsets = resolveNarrationFollowTrackingOffsets(selection);
  const viewportOffsets = resolveNarrationFollowViewportOffsets(selection);
  return {
    ...selection,
    id: `${selection.id ?? "narration-follow"}:lead:${leadRange.startOffset}:${leadRange.endOffset}`,
    trackingStartOffset: currentOffsets.startOffset,
    trackingEndOffset: currentOffsets.endOffset,
    viewportStartOffset: viewportOffsets.startOffset,
    viewportEndOffset: viewportOffsets.endOffset,
    coverageEndOffset: recognizedEndOffset,
    displayLeadStartOffset: leadRange.startOffset,
    displayLeadEndOffset: leadRange.endOffset,
    displayLeadMs: Math.max(0, Number(leadMs) || 0),
    displayLeadWordCount: leadRange.wordCount,
  };
}
