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
  assert.equal(model.countLabel, "1 flagged word");
  assert.deepEqual(model.words, ["Wehn"]);

  const markup = renderSpellcheckContextMenuHTML(wordMenu, {
    width: 1000,
    height: 800,
  });
  assert.match(markup, /data-spellcheck-menu/);
  assert.match(markup, /data-action="apply-spellcheck-suggestion"/);
  assert.match(markup, /data-spellcheck-replacement="When"/);
  assert.match(markup, /data-spellcheck-word="wehn"/);
  assert.match(markup, /data-action="add-grammar-check-dictionary"/);

  const selectionMarkup = renderSpellcheckContextMenuHTML({
    mode: "selection",
    words: ["Wehn", "breaze"],
    x: 10,
    y: 10,
  }, {
    width: 320,
    height: 240,
  });
  assert.match(selectionMarkup, /2 flagged words/);
  assert.doesNotMatch(selectionMarkup, /apply-spellcheck-suggestion/);
}
