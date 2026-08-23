// Intent: verify spellcheck context-menu records are derived outside the app shell.
import assert from "node:assert/strict";

import {
  buildSpellcheckEditorHoverContextMenu,
  buildSpellcheckSelectionContextMenu,
  buildSpellcheckWordContextMenu,
} from "../apps/editor/public/features/spellcheck/spellcheck-context-controller.js";
import {
  buildSpellcheckProjectLexicon,
  createSpellcheckLexiconFromWords,
  getSpellcheckWordRange,
} from "../apps/editor/public/spellcheck.js";

export function runSpellcheckContextControllerTest() {
  const lexicons = {
    baseLexicon: createSpellcheckLexiconFromWords(["when", "the", "breeze", "arrives"]),
    projectLexicon: buildSpellcheckProjectLexicon([]),
    referenceLexicon: createSpellcheckLexiconFromWords([]),
  };

  const selectionContext = buildSpellcheckSelectionContextMenu({
    sceneId: "scene-1",
    contextRange: {
      selectedText: "Wehn the breaze arrives",
      startOffset: 10,
      endOffset: 33,
      hasExplicitSelection: true,
    },
    lexicons,
    point: { x: 100, y: 120 },
  });
  assert.equal(selectionContext.mode, "selection");
  assert.equal(selectionContext.count, 2);
  assert.deepEqual(selectionContext.words, ["Wehn", "breaze"]);
  assert.deepEqual(selectionContext.suggestions, []);

  const wordRange = getSpellcheckWordRange("Wehn arrives", 2);
  const wordContext = buildSpellcheckWordContextMenu({
    sceneId: "scene-1",
    wordRange,
    lexicons,
    point: { x: 20, y: 30 },
  });
  assert.equal(wordContext.mode, "word");
  assert.equal(wordContext.word, "Wehn");
  assert.equal(wordContext.normalizedWord, "wehn");
  assert.equal(wordContext.startOffset, 0);
  assert.ok(wordContext.suggestions.includes("When"));

  const knownWordContext = buildSpellcheckWordContextMenu({
    sceneId: "scene-1",
    wordRange: getSpellcheckWordRange("When arrives", 2),
    lexicons,
    point: { x: 20, y: 30 },
  });
  assert.equal(knownWordContext, null);

  const previousHTMLTextAreaElement = globalThis.HTMLTextAreaElement;
  const previousMouseEvent = globalThis.MouseEvent;
  class FakeTextArea {}
  class FakeMouseEvent {
    constructor() {
      this.clientX = 44;
      this.clientY = 55;
    }
  }

  globalThis.HTMLTextAreaElement = FakeTextArea;
  globalThis.MouseEvent = FakeMouseEvent;
  try {
    const textarea = new FakeTextArea();
    textarea.dataset = { sceneId: "scene-1" };
    textarea.value = "Wehn arrives";
    textarea.selectionStart = 6;

    const hoverContext = buildSpellcheckEditorHoverContextMenu(
      { textarea },
      new FakeMouseEvent(),
      lexicons,
      {
        getWordRangeFromLayerPoint: () => getSpellcheckWordRange(textarea.value, 2),
      },
    );
    assert.equal(hoverContext.mode, "word");
    assert.equal(hoverContext.word, "Wehn");
    assert.equal(hoverContext.startOffset, 0);
    assert.equal(hoverContext.x, 44);
    assert.equal(hoverContext.y, 55);

    const missedHoverContext = buildSpellcheckEditorHoverContextMenu(
      { textarea },
      new FakeMouseEvent(),
      lexicons,
      {
        getWordRangeFromLayerPoint: () => null,
        getWordRangeFromPointer: () => null,
      },
    );
    assert.equal(missedHoverContext, null);
  } finally {
    globalThis.HTMLTextAreaElement = previousHTMLTextAreaElement;
    globalThis.MouseEvent = previousMouseEvent;
  }
}
