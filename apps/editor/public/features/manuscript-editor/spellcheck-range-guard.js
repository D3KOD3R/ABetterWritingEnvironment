// Intent: keep spellcheck actions anchored to the live manuscript word, not stale overlay offsets.
import {
  getSpellcheckWordRange,
  isSpellcheckMisspelledWord,
  normalizeSpellcheckWord,
} from "../../spellcheck.js";

// Intent: re-expand stored underline offsets so partial stale spans cannot target only a word prefix.
export function resolveLiveSpellcheckWordRange(sourceText, startOffset, endOffset, options = {}) {
  const source = String(sourceText ?? "");
  const normalizedStartOffset = Number(startOffset);
  const normalizedEndOffset = Number(endOffset);
  if (
    !Number.isInteger(normalizedStartOffset) ||
    !Number.isInteger(normalizedEndOffset) ||
    normalizedStartOffset < 0 ||
    normalizedEndOffset <= normalizedStartOffset ||
    normalizedEndOffset > source.length
  ) {
    return null;
  }

  const storedWord = source.slice(normalizedStartOffset, normalizedEndOffset);
  if (!/^[A-Za-z][A-Za-z'’-]*$/u.test(storedWord)) {
    return null;
  }

  const liveRange = getSpellcheckWordRange(source, normalizedStartOffset);
  if (
    !liveRange ||
    normalizedStartOffset < liveRange.startOffset ||
    normalizedEndOffset > liveRange.endOffset
  ) {
    return null;
  }

  const expectedNormalizedWord = normalizeSpellcheckWord(options.expectedWord ?? "");
  if (expectedNormalizedWord && liveRange.normalizedWord !== expectedNormalizedWord) {
    return null;
  }

  return liveRange;
}

// Intent: require a menu action to still point at the same misspelled live word before mutating text.
export function validateLiveSpellcheckMenuRange(sourceText, menuRange, lexicons = {}) {
  const liveRange = resolveLiveSpellcheckWordRange(
    sourceText,
    menuRange?.startOffset,
    menuRange?.endOffset,
    { expectedWord: menuRange?.word ?? menuRange?.normalizedWord },
  );
  if (!liveRange) {
    return null;
  }

  if (!isSpellcheckMisspelledWord(liveRange.word, lexicons)) {
    return null;
  }

  return liveRange;
}
