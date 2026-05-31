// Intent: verify project spellcheck dictionary mutations stay outside the app shell.
import assert from "node:assert/strict";

import {
  applySpellcheckProjectListMutation,
  normalizeSpellcheckProjectWords,
} from "../apps/editor/public/features/spellcheck/spellcheck-project-settings.js";

export function runSpellcheckProjectSettingsTest() {
  assert.deepEqual(
    normalizeSpellcheckProjectWords([
      "Icaru",
      "icaru",
      { word: "Miren's" },
      { word: "   " },
      { word: "Miren's" },
    ]),
    ["Icaru", "Miren's"],
  );

  const addDictionaryResult = applySpellcheckProjectListMutation(
    {
      dictionaryWords: ["icaru"],
      exceptionWords: ["draftmark"],
    },
    "dictionaryWords",
    ["Icaru", "Veyra"],
  );
  assert.equal(addDictionaryResult.changed, true);
  assert.deepEqual(addDictionaryResult.settings, {
    dictionaryWords: ["icaru", "veyra"],
    exceptionWords: ["draftmark"],
  });
  assert.deepEqual(addDictionaryResult.words, ["Icaru", "Veyra"]);

  const duplicateResult = applySpellcheckProjectListMutation(
    addDictionaryResult.settings,
    "dictionaryWords",
    ["veyra"],
  );
  assert.equal(duplicateResult.changed, false);
  assert.deepEqual(duplicateResult.settings, addDictionaryResult.settings);

  const exceptionResult = applySpellcheckProjectListMutation(
    addDictionaryResult.settings,
    "exceptionWords",
    [{ word: "StetName" }],
  );
  assert.equal(exceptionResult.changed, true);
  assert.deepEqual(exceptionResult.settings, {
    dictionaryWords: ["icaru", "veyra"],
    exceptionWords: ["draftmark", "stetname"],
  });

  const invalidTargetResult = applySpellcheckProjectListMutation(
    exceptionResult.settings,
    "runtimeWords",
    ["Ignored"],
  );
  assert.equal(invalidTargetResult.changed, false);
  assert.deepEqual(invalidTargetResult.settings, exceptionResult.settings);
  assert.deepEqual(invalidTargetResult.words, []);
}
