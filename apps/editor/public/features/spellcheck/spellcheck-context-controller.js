// Intent: derive spellcheck context-menu records without owning shell rendering or persistence effects.
import {
  collectSpellcheckMisspellings,
  getSpellcheckWordRange,
  isSpellcheckMisspelledWord,
  normalizeSpellcheckWord,
  suggestSpellcheckAlternatives,
} from "../../spellcheck.js";
import { normalizeSpellcheckProjectWords } from "./spellcheck-project-settings.js";
import { resolveLiveSpellcheckWordRange } from "../manuscript-editor/spellcheck-range-guard.js";

export function buildSpellcheckSelectionContextMenu({
  sceneId,
  contextRange,
  lexicons,
  point,
} = {}) {
  if (!hasSpellcheckLexicon(lexicons) || contextRange?.hasExplicitSelection !== true) {
    return null;
  }

  const selectionText = String(contextRange.selectedText ?? "").trim();
  if (!selectionText) {
    return null;
  }

  const selectionMisspellings = collectSpellcheckMisspellings(selectionText, lexicons);
  if (!selectionMisspellings.length) {
    return null;
  }

  const words = normalizeSpellcheckProjectWords(selectionMisspellings);
  const mode = words.length > 1 ? "selection" : "word";
  const firstWord = selectionMisspellings[0];
  return {
    sceneId: String(sceneId ?? ""),
    mode,
    words,
    word: firstWord?.word ?? selectionText,
    normalizedWord: firstWord?.normalizedWord ?? normalizeSpellcheckWord(selectionText),
    startOffset: contextRange.startOffset,
    endOffset: contextRange.endOffset,
    selectionText,
    suggestions: mode === "word"
      ? suggestSpellcheckAlternatives(firstWord?.word ?? selectionText, lexicons)
      : [],
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    count: words.length,
  };
}

export function buildSpellcheckWordContextMenu({
  sceneId,
  wordRange,
  lexicons,
  point,
} = {}) {
  if (!hasSpellcheckLexicon(lexicons) || !wordRange?.word) {
    return null;
  }

  if (!isSpellcheckMisspelledWord(wordRange.word, lexicons)) {
    return null;
  }

  return {
    sceneId: String(sceneId ?? ""),
    mode: "word",
    words: [wordRange.word],
    word: wordRange.word,
    normalizedWord: wordRange.normalizedWord,
    startOffset: wordRange.startOffset,
    endOffset: wordRange.endOffset,
    suggestions: suggestSpellcheckAlternatives(wordRange.word, lexicons),
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    count: 1,
  };
}

export function buildSpellcheckEditorContextMenu(editorContext, event, lexicons, options = {}) {
  if (!hasSpellcheckLexicon(lexicons) || !editorContext) {
    return null;
  }

  const { textarea, contextRange } = editorContext;
  if (!isTextareaElement(textarea)) {
    return null;
  }

  const sceneId = String(textarea.dataset.sceneId ?? "");
  if (!sceneId) {
    return null;
  }

  const point = getEventPoint(event);
  const selectionContext = buildSpellcheckSelectionContextMenu({
    sceneId,
    contextRange,
    lexicons,
    point,
  });
  if (selectionContext) {
    return selectionContext;
  }

  let wordRange = typeof options.getWordRangeFromLayerPoint === "function"
    ? options.getWordRangeFromLayerPoint(textarea, event)
    : getSpellcheckWordRangeFromLayerPoint(textarea, event);
  if (!wordRange) {
    wordRange = typeof options.getWordRangeFromPointer === "function"
      ? options.getWordRangeFromPointer(textarea, event)
      : getSpellcheckWordRangeFromPointer(textarea, event, options);
  }
  if (!wordRange) {
    const caretOffset = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : contextRange?.startOffset ?? 0;
    wordRange = getSpellcheckWordRange(textarea.value, caretOffset);
  }

  return buildSpellcheckWordContextMenu({
    sceneId,
    wordRange,
    lexicons,
    point,
  });
}

export function buildSpellcheckGrammarCheckContextMenu(target, event, {
  scene,
  lexicons,
} = {}) {
  if (!hasSpellcheckLexicon(lexicons) || !isHtmlElement(target)) {
    return null;
  }

  const sceneId = String(scene?.sceneId ?? "");
  if (!scene || !sceneId) {
    return null;
  }

  const word = String(target.dataset.grammarCheckWord ?? "").trim();
  const normalizedWord = normalizeSpellcheckWord(word);
  const firstIndex = Number(target.dataset.grammarCheckFirstIndex);
  if (!normalizedWord || !Number.isInteger(firstIndex)) {
    return null;
  }

  const sourceText = String(scene.editorText ?? "");
  const originalWord = sourceText.slice(firstIndex, firstIndex + word.length) || word;
  const point = getEventPoint(event);
  return {
    sceneId,
    mode: "word",
    words: [originalWord],
    word: originalWord,
    normalizedWord,
    startOffset: firstIndex,
    endOffset: firstIndex + originalWord.length,
    suggestions: suggestSpellcheckAlternatives(originalWord, lexicons),
    x: point.x,
    y: point.y,
    count: 1,
  };
}

export function getSpellcheckWordRangeFromPointer(textarea, event, options = {}) {
  if (!isTextareaElement(textarea) || !isMouseEvent(event)) {
    return null;
  }

  const offset = typeof options.getTextareaOffsetFromPoint === "function"
    ? options.getTextareaOffsetFromPoint(textarea, event.clientX, event.clientY)
    : null;
  if (!Number.isInteger(offset)) {
    return null;
  }

  return getSpellcheckWordRange(textarea.value, offset);
}

// Intent: use rendered underline spans as the source of truth when browser textarea hit-testing misses.
export function getSpellcheckWordRangeFromLayerPoint(textarea, event) {
  if (!isTextareaElement(textarea) || !isMouseEvent(event)) {
    return null;
  }

  const codeframe = textarea.closest("[data-scene-editor]");
  const layer = codeframe?.querySelector("[data-spellcheck-layer]");
  if (!isHtmlElement(layer)) {
    return null;
  }

  const flaggedWords = layer.querySelectorAll(".editor-spellcheck-word.is-misspelled");
  for (const flaggedWord of flaggedWords) {
    if (!isHtmlElement(flaggedWord)) {
      continue;
    }

    if (!isPointInsideElementRects(flaggedWord, event.clientX, event.clientY, 2)) {
      continue;
    }

    const startOffset = Number(flaggedWord.dataset.spellcheckStart);
    const endOffset = Number(flaggedWord.dataset.spellcheckEnd);
    const wordRange = resolveLiveSpellcheckWordRange(textarea.value, startOffset, endOffset);
    if (wordRange) {
      return wordRange;
    }
  }

  return null;
}

export function isPointInsideElementRects(element, clientX, clientY, tolerance = 0) {
  if (!isHtmlElement(element)) {
    return false;
  }

  const safeTolerance = Number.isFinite(Number(tolerance)) ? Math.max(0, Number(tolerance)) : 0;
  for (const rect of Array.from(element.getClientRects())) {
    if (
      clientX >= rect.left - safeTolerance &&
      clientX <= rect.right + safeTolerance &&
      clientY >= rect.top - safeTolerance &&
      clientY <= rect.bottom + safeTolerance
    ) {
      return true;
    }
  }

  return false;
}

function hasSpellcheckLexicon(lexicons) {
  return Boolean(lexicons?.baseLexicon?.wordList?.length);
}

function isTextareaElement(value) {
  return typeof HTMLTextAreaElement !== "undefined" && value instanceof HTMLTextAreaElement;
}

function isHtmlElement(value) {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function isMouseEvent(value) {
  return typeof MouseEvent !== "undefined" && value instanceof MouseEvent;
}

function getEventPoint(event) {
  return {
    x: Number(event?.clientX) || 0,
    y: Number(event?.clientY) || 0,
  };
}
