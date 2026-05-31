// Intent: verify spellcheck context-menu records are derived outside the app shell.
import assert from "node:assert/strict";

import {
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
}
