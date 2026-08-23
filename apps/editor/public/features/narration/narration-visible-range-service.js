// Intent: estimate the manuscript text offsets currently visible in the narration viewport.

const DEFAULT_OVERSCAN_LINES = 2;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.max(min, Math.min(max, number));
}

function findOffsetForVisualLineEnd(text, targetVisualLineIndex, charactersPerLine) {
  const safeTargetIndex = Math.max(0, Math.floor(Number(targetVisualLineIndex) || 0));
  const safeCharactersPerLine = Math.max(1, Math.floor(Number(charactersPerLine) || 1));
  const logicalLines = String(text ?? "").split("\n");
  let visualLineIndex = 0;
  let logicalStartOffset = 0;

  for (const logicalLine of logicalLines) {
    const lineLength = logicalLine.length;
    const wrappedLineCount = Math.max(1, Math.ceil(lineLength / safeCharactersPerLine));
    if (safeTargetIndex < visualLineIndex + wrappedLineCount) {
      const relativeLineIndex = safeTargetIndex - visualLineIndex;
      const endOffsetWithinLine = Math.min(lineLength, (relativeLineIndex + 1) * safeCharactersPerLine);
      return logicalStartOffset + endOffsetWithinLine;
    }

    visualLineIndex += wrappedLineCount;
    logicalStartOffset += lineLength + 1;
  }

  return String(text ?? "").length;
}

function findOffsetForVisualLineStart(text, targetVisualLineIndex, charactersPerLine) {
  const safeTargetIndex = Math.max(0, Math.floor(Number(targetVisualLineIndex) || 0));
  if (safeTargetIndex <= 0) {
    return 0;
  }

  return findOffsetForVisualLineEnd(text, safeTargetIndex - 1, charactersPerLine);
}

export function estimateNarrationVisibleTextRange({
  text = "",
  scrollTop = 0,
  clientHeight = 0,
  lineHeight = 1,
  paddingTop = 0,
  charactersPerLine = 80,
  overscanLines = DEFAULT_OVERSCAN_LINES,
} = {}) {
  const normalizedText = String(text ?? "");
  const textLength = normalizedText.length;
  if (!textLength) {
    return null;
  }

  const safeLineHeight = Math.max(1, Number(lineHeight) || 1);
  const safeScrollTop = Math.max(0, Number(scrollTop) || 0);
  const safeClientHeight = Math.max(safeLineHeight, Number(clientHeight) || safeLineHeight);
  const safePaddingTop = Math.max(0, Number(paddingTop) || 0);
  const safeOverscanLines = Math.max(0, Math.floor(Number(overscanLines) || 0));
  const firstVisibleLine = Math.max(
    0,
    Math.floor((safeScrollTop - safePaddingTop) / safeLineHeight) - safeOverscanLines,
  );
  const lastVisibleLine = Math.max(
    firstVisibleLine,
    Math.ceil((safeScrollTop + safeClientHeight - safePaddingTop) / safeLineHeight) - 1 + safeOverscanLines,
  );
  const startOffset = clampNumber(
    findOffsetForVisualLineStart(normalizedText, firstVisibleLine, charactersPerLine),
    0,
    textLength,
  );
  const endOffset = clampNumber(
    findOffsetForVisualLineEnd(normalizedText, lastVisibleLine, charactersPerLine),
    0,
    textLength,
  );

  if (endOffset <= startOffset) {
    return null;
  }

  return {
    startOffset,
    endOffset,
    firstVisibleLine,
    lastVisibleLine,
    overscanLines: safeOverscanLines,
  };
}
