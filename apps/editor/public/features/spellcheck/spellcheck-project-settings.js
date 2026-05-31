// Intent: own project spellcheck dictionary/exception mutations without browser shell state.
import { normalizeSpellcheckProjectSettings } from "../../editor-model.js";
import { normalizeSpellcheckWord } from "../../spellcheck.js";

export const SPELLCHECK_PROJECT_LIST_KEYS = new Set([
  "dictionaryWords",
  "exceptionWords",
]);

export function normalizeSpellcheckProjectWords(words) {
  const source = Array.isArray(words) ? words : [];
  const normalizedWords = [];
  const seen = new Set();

  for (const entry of source) {
    const candidate = typeof entry === "string" ? entry : entry?.word;
    const normalized = normalizeSpellcheckWord(candidate);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    const displayWord = String(candidate ?? "").trim();
    normalizedWords.push(displayWord || normalized);
  }

  return normalizedWords;
}

export function applySpellcheckProjectListMutation(currentSettings, targetListKey, sourceWords) {
  if (!SPELLCHECK_PROJECT_LIST_KEYS.has(targetListKey)) {
    return {
      changed: false,
      settings: normalizeSpellcheckProjectSettings(currentSettings),
      words: [],
    };
  }

  const words = normalizeSpellcheckProjectWords(sourceWords);
  const previousSettings = normalizeSpellcheckProjectSettings(currentSettings);
  if (!words.length) {
    return {
      changed: false,
      settings: previousSettings,
      words,
    };
  }

  const nextSettings = normalizeSpellcheckProjectSettings({
    ...previousSettings,
    [targetListKey]: [
      ...(previousSettings[targetListKey] ?? []),
      ...words,
    ],
  });

  const changed = !areSpellcheckProjectSettingsEqual(previousSettings, nextSettings);
  return {
    changed,
    settings: changed ? nextSettings : previousSettings,
    words,
  };
}

function areSpellcheckProjectSettingsEqual(left, right) {
  const normalizedLeft = normalizeSpellcheckProjectSettings(left);
  const normalizedRight = normalizeSpellcheckProjectSettings(right);
  return (
    areWordListsEqual(normalizedLeft.dictionaryWords, normalizedRight.dictionaryWords) &&
    areWordListsEqual(normalizedLeft.exceptionWords, normalizedRight.exceptionWords)
  );
}

function areWordListsEqual(left, right) {
  const leftWords = Array.isArray(left) ? left : [];
  const rightWords = Array.isArray(right) ? right : [];
  return leftWords.length === rightWords.length && leftWords.every((word, index) => word === rightWords[index]);
}
