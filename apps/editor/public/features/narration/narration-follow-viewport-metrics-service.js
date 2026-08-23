// Intent: cache narration-follow viewport metrics so live scroll planning does not rescan long scenes on every ASR event.

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
const DEFAULT_AVERAGE_WORDS_PER_LINE = 11;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.max(min, Math.min(max, number));
}

function normalizeCharactersPerLine(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function normalizeOffset(value, textLength) {
  const number = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(number, Math.max(0, textLength)));
}

function countValuesBelow(values, offset) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function findLineForOffset(lines, offset) {
  let low = 0;
  let high = lines.length - 1;
  let match = lines.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (offset <= lines[middle].nextOffset) {
      match = middle;
      high = middle - 1;
    } else {
      low = middle + 1;
    }
  }
  return lines[match] ?? null;
}

function createLogicalLineMetrics(text, charactersPerLine) {
  const value = String(text ?? "");
  const safeCharactersPerLine = normalizeCharactersPerLine(charactersPerLine);
  const rawLines = value.split("\n");
  const lines = [];
  let startOffset = 0;
  let visualStart = 0;

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = rawLines[index];
    const endOffset = startOffset + line.length;
    const hasTrailingNewline = index < rawLines.length - 1;
    const visualLineCount = Math.max(1, Math.ceil(line.length / safeCharactersPerLine));
    lines.push({
      startOffset,
      endOffset,
      nextOffset: endOffset + (hasTrailingNewline ? 1 : 0),
      visualStart,
      visualLineCount,
    });
    startOffset = endOffset + (hasTrailingNewline ? 1 : 0);
    visualStart += visualLineCount;
  }

  return lines.length
    ? lines
    : [{
      startOffset: 0,
      endOffset: 0,
      nextOffset: 0,
      visualStart: 0,
      visualLineCount: 1,
    }];
}

function createWordStartOffsets(text) {
  const starts = [];
  for (const match of String(text ?? "").matchAll(WORD_PATTERN)) {
    const index = Number(match.index);
    if (Number.isInteger(index)) {
      starts.push(index);
    }
  }
  return starts;
}

export function createNarrationFollowViewportMetrics(text = "", charactersPerLine = 1) {
  const value = String(text ?? "");
  const safeCharactersPerLine = normalizeCharactersPerLine(charactersPerLine);
  const lineMetrics = createLogicalLineMetrics(value, safeCharactersPerLine);
  const wordStartOffsets = createWordStartOffsets(value);

  function estimateVisualLineBeforeOffset(offset = 0) {
    const safeOffset = normalizeOffset(offset, value.length);
    const line = findLineForOffset(lineMetrics, safeOffset);
    if (!line) {
      return 0;
    }
    if (safeOffset <= line.endOffset) {
      return line.visualStart + Math.floor(Math.max(0, safeOffset - line.startOffset) / safeCharactersPerLine);
    }
    return line.visualStart + line.visualLineCount;
  }

  function countWordsBeforeOffset(offset = 0) {
    return countValuesBelow(wordStartOffsets, normalizeOffset(offset, value.length));
  }

  const visualLineCount = Math.max(1, estimateVisualLineBeforeOffset(value.length) + 1);
  const averageWordsPerLine = wordStartOffsets.length && visualLineCount
    ? clampNumber(wordStartOffsets.length / visualLineCount, 1, 40)
    : DEFAULT_AVERAGE_WORDS_PER_LINE;

  return {
    text: value,
    charactersPerLine: safeCharactersPerLine,
    visualLineCount,
    totalWordCount: wordStartOffsets.length,
    averageWordsPerLine,
    estimateVisualLineBeforeOffset,
    countWordsBeforeOffset,
  };
}

export function createNarrationFollowViewportMetricsCache({
  maxEntries = 4,
} = {}) {
  const entries = [];
  const safeMaxEntries = Math.max(1, Math.floor(Number(maxEntries) || 1));

  function resolveMetrics({
    text = "",
    charactersPerLine = 1,
  } = {}) {
    const value = String(text ?? "");
    const safeCharactersPerLine = normalizeCharactersPerLine(charactersPerLine);
    const existingIndex = entries.findIndex((entry) =>
      entry.text === value &&
      entry.charactersPerLine === safeCharactersPerLine
    );
    if (existingIndex >= 0) {
      const [entry] = entries.splice(existingIndex, 1);
      entries.unshift(entry);
      return entry.metrics;
    }

    const metrics = createNarrationFollowViewportMetrics(value, safeCharactersPerLine);
    entries.unshift({
      text: value,
      charactersPerLine: safeCharactersPerLine,
      metrics,
    });
    while (entries.length > safeMaxEntries) {
      entries.pop();
    }
    return metrics;
  }

  function clear() {
    entries.length = 0;
  }

  return {
    resolveMetrics,
    clear,
  };
}
