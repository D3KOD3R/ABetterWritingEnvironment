// Intent: own dictionary word normalization and range resolution outside spellcheck correction logic.

const DICTIONARY_WORD_PATTERN = /[A-Za-z][A-Za-z'’-]*/g;
const DICTIONARY_WORD_CHARACTER_PATTERN = /[A-Za-z'’-]/;

export function normalizeDictionaryWord(word) {
  const normalized = String(word ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  return /[a-z]/.test(normalized) ? normalized : "";
}

// Intent: resolve a word at a caret-like offset while preserving the original manuscript span.
export function getDictionaryWordRange(text, offset) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  const safeOffset = clampTextOffset(offset, source.length);
  let startOffset = safeOffset;
  let endOffset = safeOffset;

  while (startOffset > 0 && isDictionaryWordCharacter(source[startOffset - 1])) {
    startOffset -= 1;
  }

  while (endOffset < source.length && isDictionaryWordCharacter(source[endOffset])) {
    endOffset += 1;
  }

  if (startOffset === endOffset) {
    return null;
  }

  return createDictionaryWordRange(source, startOffset, endOffset);
}

// Intent: implement Ctrl+T semantics by walking back from the manuscript cursor to the last typed word.
export function getDictionaryWordBeforeCaret(text, caretOffset) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  let endOffset = clampTextOffset(caretOffset, source.length);
  while (endOffset > 0 && !isDictionaryWordCharacter(source[endOffset - 1])) {
    endOffset -= 1;
  }

  if (endOffset <= 0) {
    return null;
  }

  let startOffset = endOffset;
  while (startOffset > 0 && isDictionaryWordCharacter(source[startOffset - 1])) {
    startOffset -= 1;
  }

  return createDictionaryWordRange(source, startOffset, endOffset);
}

// Intent: honor an explicit one-word manuscript selection before falling back to pointer hit-testing.
export function getDictionaryWordRangeFromSelection(text, startOffset, endOffset) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  const selectionStart = clampTextOffset(Math.min(Number(startOffset), Number(endOffset)), source.length);
  const selectionEnd = clampTextOffset(Math.max(Number(startOffset), Number(endOffset)), source.length);
  if (selectionEnd <= selectionStart) {
    return null;
  }

  const selectedText = source.slice(selectionStart, selectionEnd);
  const matches = [...selectedText.matchAll(DICTIONARY_WORD_PATTERN)];
  if (matches.length !== 1) {
    return null;
  }

  const match = matches[0];
  const matchText = String(match[0] ?? "");
  const localStartOffset = Number(match.index);
  const localEndOffset = localStartOffset + matchText.length;
  if (
    !Number.isInteger(localStartOffset) ||
    hasAlphanumericCharacter(selectedText.slice(0, localStartOffset)) ||
    hasAlphanumericCharacter(selectedText.slice(localEndOffset))
  ) {
    return null;
  }

  return createDictionaryWordRange(source, selectionStart + localStartOffset, selectionStart + localEndOffset);
}

// Intent: derive right-click dictionary targets from the editor host without depending on spellcheck state.
export function getDictionaryWordRangeFromPointer(textarea, event, options = {}) {
  if (!textarea || typeof textarea.value !== "string" || !event) {
    return null;
  }

  const offset = typeof options.getTextareaOffsetFromPoint === "function"
    ? options.getTextareaOffsetFromPoint(textarea, Number(event.clientX), Number(event.clientY))
    : null;
  if (!Number.isInteger(offset)) {
    return null;
  }

  return getDictionaryWordRange(textarea.value, offset);
}

export function extractDictionaryWords(text) {
  const source = String(text ?? "");
  return [...source.matchAll(DICTIONARY_WORD_PATTERN)]
    .map((match) => createDictionaryWordRange(source, Number(match.index), Number(match.index) + String(match[0] ?? "").length))
    .filter(Boolean);
}

function createDictionaryWordRange(source, startOffset, endOffset) {
  const word = source.slice(startOffset, endOffset);
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord) {
    return null;
  }

  return {
    word,
    normalizedWord,
    startOffset,
    endOffset,
  };
}

function isDictionaryWordCharacter(character) {
  return typeof character === "string" && DICTIONARY_WORD_CHARACTER_PATTERN.test(character);
}

function hasAlphanumericCharacter(text) {
  return /[A-Za-z0-9]/.test(String(text ?? ""));
}

function clampTextOffset(offset, textLength) {
  const number = Number(offset);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}
