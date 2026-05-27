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
  recordRevisionTextEdit,
  trackInlinePassageTyping,
  getTypingSpellcheckRange,
  commitSceneTextEdit,
  scheduleTypingRefresh,
  isGrammarCheckEnabled,
  scheduleSpellcheckRefresh,
} = {}) {
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

    markEditorAsCurrent?.(editorSurface);
    updateSelectionSnapshot?.(editorSurface);
    updateInlineFormatToolbar?.(editorSurface);
    clearAnchoredPreview?.({ restoreSelection: false });

    const previousText = String(getSceneText?.(normalizedSceneId) ?? "");
    const nextText = editorSurface.value;
    const previousInlineFormatRanges = getSceneInlineFormatRanges?.(normalizedSceneId, previousText.length) ?? [];
    const pendingFormats = normalizeManuscriptInlineFormattingState(
      getInlineFormattingState?.(),
    ).pendingFormats;
    const inlineFormatRanges = updateInlineFormatRangesForTextEdit({
      ranges: previousInlineFormatRanges,
      previousText,
      nextText,
      pendingFormats,
    });

    recordRevisionTextEdit?.(normalizedSceneId, previousText, nextText);
    trackInlinePassageTyping?.(normalizedSceneId, previousText, editorSurface);
    const activeTypingWordRange = getTypingSpellcheckRange?.(editorSurface) ?? null;
    commitSceneTextEdit?.({
      sceneId: normalizedSceneId,
      previousText,
      nextText,
      inlineFormatRanges,
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
    handleEditorTextInput,
  };
}
