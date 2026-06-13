// Intent: verify scene text input routes formatting derivation and shell effects through one feature controller.
import assert from "node:assert/strict";

import {
  reconcileSceneBlocksWithEditorText,
  updateSceneBlocksForTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-block-text-service.js";
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
    updateAnchoredRecordsForTextEdit: () => effects.push("anchors"),
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
    "anchors",
    "commit",
    "typing:4",
    "spellcheck",
  ]);

  let highlightedCommit = null;
  let highlightedAnchorOptions = null;
  const highlightController = createManuscriptInputController({
    getSceneText: () => "abcabc",
    getSceneInlineFormatRanges: () => [],
    getInlineFormattingState: () => ({ pendingFormats: { highlight: true } }),
    updateAnchoredRecordsForTextEdit: (_sceneId, _previousText, _nextText, options) => {
      highlightedAnchorOptions = options;
    },
    commitSceneTextEdit: (mutation) => {
      highlightedCommit = mutation;
    },
    isGrammarCheckEnabled: () => false,
  });
  assert.equal(highlightController.handleEditorTextInput({
    sceneId: "scene-highlight",
    editorSurface: {
      value: "abcaabc",
      selectionStart: 4,
      selectionEnd: 4,
    },
  }).handled, true);
  assert.deepEqual(highlightedCommit.inlineFormatRanges, [{
    id: "inline-highlight-3-4",
    formatId: "highlight",
    startOffset: 3,
    endOffset: 4,
  }]);
  assert.deepEqual(highlightedAnchorOptions, {
    selectionStart: 4,
    selectionEnd: 4,
  });
  assert.equal(highlightedCommit.selectionStart, 4);
  assert.equal(highlightedCommit.selectionEnd, 4);

  const alignedBlocks = updateSceneBlocksForTextEdit({
    sceneId: "scene-highlight",
    previousText: "abcabc\n\ntail",
    nextText: "abcaabc\n\ntail",
    selectionStart: 4,
    selectionEnd: 4,
    blocks: [{
      blockId: "block-1",
      text: "abcabc",
    }, {
      blockId: "block-2",
      text: "tail",
    }],
  });
  assert.equal(alignedBlocks[0].text, "abcaabc");
  assert.equal(alignedBlocks[1].text, "tail");

  const freshSceneBlocks = updateSceneBlocksForTextEdit({
    sceneId: "draft-scene-fresh",
    previousText: "",
    nextText: "Fresh pasted scene text.",
    blocks: [],
  });
  assert.deepEqual(freshSceneBlocks.map((block) => ({
    blockId: block.blockId,
    paragraphId: block.paragraphId,
    sceneId: block.sceneId,
    text: block.text,
    isDraft: block.isDraft,
  })), [{
    blockId: "draft-block-draft-scene-fresh-1",
    paragraphId: "draft-paragraph-draft-scene-fresh-1",
    sceneId: "draft-scene-fresh",
    text: "Fresh pasted scene text.",
    isDraft: true,
  }]);

  const reconciledStaleSingleBlock = reconcileSceneBlocksWithEditorText({
    sceneId: "draft-scene-fresh",
    chapterId: "draft-chapter-fresh",
    text: "Visible text that was ahead of state.",
    blocks: [{
      blockId: "draft-block-draft-scene-fresh-1",
      paragraphId: "draft-paragraph-draft-scene-fresh-1",
      sceneId: "draft-scene-fresh",
      text: "",
      isDraft: true,
    }],
  });
  assert.equal(reconciledStaleSingleBlock.length, 1);
  assert.equal(reconciledStaleSingleBlock[0].chapterId, "draft-chapter-fresh");
  assert.equal(reconciledStaleSingleBlock[0].text, "Visible text that was ahead of state.");

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
