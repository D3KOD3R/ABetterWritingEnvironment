// Intent: verify scene text input routes formatting derivation and shell effects through one feature controller.
import assert from "node:assert/strict";

import { createManuscriptInputController } from "../apps/editor/public/features/manuscript-editor/manuscript-input-controller.js";

export function runManuscriptInputControllerTest() {
  const effects = [];
  let committed = null;
  const controller = createManuscriptInputController({
    markEditorAsCurrent: () => effects.push("current"),
    updateSelectionSnapshot: () => effects.push("selection"),
    updateInlineFormatToolbar: () => effects.push("toolbar"),
    clearAnchoredPreview: (options) => effects.push(`preview:${options.restoreSelection}`),
    getSceneText: () => "Door.",
    getSceneInlineFormatRanges: () => [],
    getInlineFormattingState: () => ({ pendingFormats: { italic: true } }),
    recordRevisionTextEdit: () => effects.push("revision"),
    trackInlinePassageTyping: () => effects.push("passage"),
    getTypingSpellcheckRange: () => ({ startOffset: 4, endOffset: 9 }),
    commitSceneTextEdit: (mutation) => {
      effects.push("commit");
      committed = mutation;
    },
    scheduleTypingRefresh: (_sceneId, _text, options) => effects.push(`typing:${options.activeTypingWordRange.startOffset}`),
    isGrammarCheckEnabled: () => true,
    scheduleSpellcheckRefresh: () => effects.push("spellcheck"),
  });

  const result = controller.handleEditorTextInput({
    sceneId: " scene-1 ",
    editorSurface: { value: "QuietDoor." },
  });
  assert.equal(result.handled, true);
  assert.equal(result.sceneId, "scene-1");
  assert.deepEqual(committed.inlineFormatRanges, [{
    id: "inline-italic-0-5",
    formatId: "italic",
    startOffset: 0,
    endOffset: 5,
  }]);
  assert.deepEqual(effects, [
    "current",
    "selection",
    "toolbar",
    "preview:false",
    "revision",
    "passage",
    "commit",
    "typing:4",
    "spellcheck",
  ]);

  const disabledController = createManuscriptInputController({
    getSceneText: () => "",
    commitSceneTextEdit: () => effects.push("disabled-commit"),
    isGrammarCheckEnabled: () => false,
    scheduleSpellcheckRefresh: () => effects.push("disabled-spellcheck"),
  });
  assert.equal(disabledController.handleEditorTextInput({
    sceneId: "scene-2",
    editorSurface: { value: "Text." },
  }).handled, true);
  assert.equal(effects.includes("disabled-commit"), true);
  assert.equal(effects.includes("disabled-spellcheck"), false);
  assert.equal(controller.handleEditorTextInput({ sceneId: "", editorSurface: null }).handled, false);
}
