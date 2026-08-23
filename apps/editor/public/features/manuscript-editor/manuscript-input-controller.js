// Intent: coordinate manuscript text-input mutations while shell callbacks retain persistence and DOM effects.
import {
  normalizeManuscriptInlineFormattingState,
  updateInlineFormatRangesForTextEdit,
} from "./manuscript-command-controller.js";

export function createManuscriptInputController({
  markEditorAsCurrent,
  updateSelectionSnapshot,
  updateInlineFormatToolbar,
  clearAnchoredPreview,
  getSceneText,
  getSceneInlineFormatRanges,
  getInlineFormattingState,
  getPendingFormatMetadata,
  recordRevisionTextEdit,
  trackInlinePassageTyping,
  updateAnchoredRecordsForTextEdit,
  getTypingSpellcheckRange,
  commitSceneTextEdit,
  scheduleTypingRefresh,
  isGrammarCheckEnabled,
  scheduleSpellcheckRefresh,
} = {}) {
  let pendingInputSelection = null;

  // Intent: retain the native pre-input range so selected-text replacement stays exact after the caret collapses.
  function handleEditorTextBeforeInput({
    sceneId = "",
    editorSurface = null,
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId || typeof editorSurface?.value !== "string") {
      pendingInputSelection = null;
      return false;
    }

    const selectionStart = Number.isInteger(editorSurface.selectionStart)
      ? editorSurface.selectionStart
      : 0;
    const selectionEnd = Number.isInteger(editorSurface.selectionEnd)
      ? editorSurface.selectionEnd
      : selectionStart;
    pendingInputSelection = {
      sceneId: normalizedSceneId,
      editorSurface,
      previousText: String(getSceneText?.(normalizedSceneId) ?? ""),
      selectionStart: Math.min(selectionStart, selectionEnd),
      selectionEnd: Math.max(selectionStart, selectionEnd),
    };
    return true;
  }

  function handleEditorTextInput({
    sceneId = "",
    editorSurface = null,
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId || typeof editorSurface?.value !== "string") {
      return {
        handled: false,
        reason: "invalid-editor-input",
      };
    }

    // Intent: let display-only script views select/copy text without committing manuscript edits.
    if (editorSurface.readOnly === true || editorSurface.disabled === true) {
      return {
        handled: false,
        reason: "readonly-editor-input",
      };
    }

    markEditorAsCurrent?.(editorSurface);
    updateSelectionSnapshot?.(editorSurface);
    updateInlineFormatToolbar?.(editorSurface);
    clearAnchoredPreview?.({ restoreSelection: false });

    const previousText = String(getSceneText?.(normalizedSceneId) ?? "");
    const nextText = editorSurface.value;
    const inputSelection = pendingInputSelection?.sceneId === normalizedSceneId
      && pendingInputSelection.editorSurface === editorSurface
      && pendingInputSelection.previousText === previousText
      ? pendingInputSelection
      : null;
    pendingInputSelection = null;
    const selectionBeforeInput = inputSelection
      ? {
          selectionBeforeInputStart: inputSelection.selectionStart,
          selectionBeforeInputEnd: inputSelection.selectionEnd,
        }
      : {};
    const previousInlineFormatRanges = getSceneInlineFormatRanges?.(normalizedSceneId, previousText.length) ?? [];
    const pendingFormats = normalizeManuscriptInlineFormattingState(
      getInlineFormattingState?.(),
    ).pendingFormats;
    const inlineFormatRanges = updateInlineFormatRangesForTextEdit({
      ranges: previousInlineFormatRanges,
      previousText,
      nextText,
      pendingFormats,
      pendingFormatMetadata: getPendingFormatMetadata?.() ?? {},
      selectionStart: editorSurface.selectionStart,
      selectionEnd: editorSurface.selectionEnd,
    });

    recordRevisionTextEdit?.(normalizedSceneId, previousText, nextText);
    trackInlinePassageTyping?.(normalizedSceneId, previousText, editorSurface);
    updateAnchoredRecordsForTextEdit?.(normalizedSceneId, previousText, nextText, {
      selectionStart: editorSurface.selectionStart,
      selectionEnd: editorSurface.selectionEnd,
    });
    const activeTypingWordRange = getTypingSpellcheckRange?.(editorSurface) ?? null;
    commitSceneTextEdit?.({
      sceneId: normalizedSceneId,
      previousText,
      nextText,
      inlineFormatRanges,
      pendingFormats,
      selectionStart: editorSurface.selectionStart,
      selectionEnd: editorSurface.selectionEnd,
      ...selectionBeforeInput,
    });
    scheduleTypingRefresh?.(normalizedSceneId, nextText, {
      revisionPanel: true,
      consoleCard: true,
      inlinePassageStatus: true,
      activeTypingWordRange,
    });
    if (isGrammarCheckEnabled?.() !== false) {
      scheduleSpellcheckRefresh?.(normalizedSceneId);
    }

    return {
      handled: true,
      sceneId: normalizedSceneId,
      previousText,
      nextText,
      inlineFormatRanges,
      activeTypingWordRange,
    };
  }

  return {
    handleEditorTextBeforeInput,
    handleEditorTextInput,
  };
}
