// Intent: derive dictionary lookup requests from manuscript editor gestures without owning lookup rendering.
import {
  getDictionaryWordBeforeCaret,
  getDictionaryWordRangeFromPointer,
  getDictionaryWordRangeFromSelection,
} from "./dictionary-word-service.js";

export function buildDictionaryEditorContextMenu(editorContext, event, options = {}) {
  const textarea = editorContext?.textarea;
  if (!textarea || typeof textarea.value !== "string") {
    return null;
  }

  const sceneId = String(textarea.dataset?.sceneId ?? "");
  if (!sceneId) {
    return null;
  }

  const selectedWordRange = editorContext.contextRange?.hasExplicitSelection
    ? getDictionaryWordRangeFromSelection(
      textarea.value,
      editorContext.contextRange.startOffset,
      editorContext.contextRange.endOffset,
    )
    : null;
  const wordRange = selectedWordRange ?? getDictionaryWordRangeFromPointer(textarea, event, options);
  if (!wordRange) {
    return null;
  }

  return buildDictionaryLookupContext({
    ...wordRange,
    sceneId,
    x: Number(event?.clientX) || 0,
    y: Number(event?.clientY) || 0,
    source: "contextmenu",
  });
}

export function buildDictionaryShortcutContext(textarea, options = {}) {
  if (!textarea || typeof textarea.value !== "string") {
    return null;
  }

  const sceneId = String(textarea.dataset?.sceneId ?? "");
  if (!sceneId) {
    return null;
  }

  const caretOffset = Number.isInteger(textarea.selectionStart)
    ? textarea.selectionStart
    : textarea.value.length;
  const wordRange = getDictionaryWordBeforeCaret(textarea.value, caretOffset);
  if (!wordRange) {
    return null;
  }

  return buildDictionaryLookupContext({
    ...wordRange,
    sceneId,
    x: Number(options.x) || 0,
    y: Number(options.y) || 0,
    source: "shortcut",
  });
}

export function buildDictionaryLookupContext(context = {}) {
  const word = String(context.word ?? "").trim();
  const normalizedWord = String(context.normalizedWord ?? "").trim();
  const sceneId = String(context.sceneId ?? "").trim();
  const startOffset = Number(context.startOffset);
  const endOffset = Number(context.endOffset);
  if (!word || !normalizedWord || !sceneId || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  return {
    word,
    normalizedWord,
    sceneId,
    startOffset,
    endOffset,
    x: Number(context.x) || 0,
    y: Number(context.y) || 0,
    source: context.source === "shortcut" ? "shortcut" : "contextmenu",
  };
}
