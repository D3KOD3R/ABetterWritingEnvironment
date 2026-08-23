// Intent: verify dictionary lookup window renders pure view state outside the app shell.
import assert from "node:assert/strict";

import {
  buildDictionaryWindowModel,
  renderDictionaryWindowHTML,
} from "../apps/editor/public/features/dictionary/dictionary-window.js";

export function runDictionaryWindowTest() {
  const lookup = {
    status: "found",
    word: "Writing",
    normalizedWord: "writing",
    matchedWord: "write",
    x: 900,
    y: 700,
    entry: {
      word: "write",
      pronunciation: "rite",
      sourceLabel: "Test lexicon",
      definitions: [
        {
          partOfSpeech: "verb",
          definition: "To compose text.",
          example: "She writes daily.",
          synonyms: ["compose", "draft"],
        },
      ],
    },
  };

  const model = buildDictionaryWindowModel(lookup, {
    width: 1000,
    height: 800,
  });
  assert.equal(model.left, 572);
  assert.equal(model.top, 432);
  assert.equal(model.entry.definitions[0].partOfSpeech, "verb");

  const markup = renderDictionaryWindowHTML(lookup, {
    width: 1000,
    height: 800,
  });
  assert.match(markup, /data-dictionary-window/);
  assert.match(markup, /data-action="close-dictionary-window"/);
  assert.match(markup, /To compose text\./);
  assert.match(markup, /Synonyms: compose, draft/);
  assert.match(markup, /Test lexicon/);

  const missingMarkup = renderDictionaryWindowHTML({
    status: "not-found",
    word: "Khepri",
    x: 20,
    y: 30,
  });
  assert.match(missingMarkup, /No definition found for Khepri/);
  assert.match(missingMarkup, /local English definition data/);
}
