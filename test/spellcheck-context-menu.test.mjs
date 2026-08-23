// Intent: verify spellcheck context-menu markup stays outside the app shell.
import assert from "node:assert/strict";

import {
  buildSpellcheckContextMenuModel,
  renderSpellcheckContextMenuHTML,
} from "../apps/editor/public/features/spellcheck/spellcheck-context-menu.js";

export function runSpellcheckContextMenuTest() {
  const wordMenu = {
    mode: "word",
    word: "Wehn",
    normalizedWord: "wehn",
    suggestions: ["When", "Wren"],
    sceneId: "scene-1",
    startOffset: 4,
    endOffset: 8,
    x: 900,
    y: 700,
  };

  const model = buildSpellcheckContextMenuModel(wordMenu, {
    width: 1000,
    height: 800,
  });
  assert.equal(model.left, 640);
  assert.equal(model.top, 500);
  assert.deepEqual(model.words, ["Wehn"]);

  const markup = renderSpellcheckContextMenuHTML(wordMenu, {
    width: 1000,
    height: 800,
  });
  assert.match(markup, /data-spellcheck-menu/);
  assert.doesNotMatch(markup, /Grammar check/);
  assert.doesNotMatch(markup, /1 flagged word/);
  assert.match(markup, /spellcheck-context-menu__chip">Wehn/);
  assert.match(markup, /data-action="apply-spellcheck-suggestion"/);
  assert.match(markup, /data-spellcheck-replacement="When"/);
  assert.match(markup, /data-spellcheck-word="wehn"/);
  assert.match(markup, /data-action="add-grammar-check-dictionary"/);
  assert.match(markup, /data-action="lookup-dictionary-word"/);
  assert.match(markup, /data-dictionary-word="Wehn"/);
  assert.doesNotMatch(markup, /data-action="add-grammar-check-exceptions"/);
  assert.doesNotMatch(markup, /Close grammar check/);
  assert.ok(markup.indexOf("add-grammar-check-dictionary") < markup.indexOf("apply-spellcheck-suggestion"));

  const selectionMarkup = renderSpellcheckContextMenuHTML({
    mode: "selection",
    words: ["Wehn", "breaze"],
    x: 10,
    y: 10,
  }, {
    width: 320,
    height: 240,
  });
  assert.doesNotMatch(selectionMarkup, /2 flagged words/);
  assert.match(selectionMarkup, /Wehn/);
  assert.match(selectionMarkup, /breaze/);
  assert.doesNotMatch(selectionMarkup, /apply-spellcheck-suggestion/);
}
