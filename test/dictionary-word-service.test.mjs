// Intent: verify dictionary word targeting stays independent from spellcheck correction state.
import assert from "node:assert/strict";

import {
  extractDictionaryWords,
  getDictionaryWordBeforeCaret,
  getDictionaryWordRange,
  getDictionaryWordRangeFromSelection,
  getDictionaryWordRangeFromPointer,
  normalizeDictionaryWord,
} from "../apps/editor/public/features/dictionary/dictionary-word-service.js";

export function runDictionaryWordServiceTest() {
  assert.equal(normalizeDictionaryWord("“Author’s”"), "author's");
  assert.equal(normalizeDictionaryWord("123"), "");

  const range = getDictionaryWordRange("The manuscript breathes.", 6);
  assert.deepEqual(range, {
    word: "manuscript",
    normalizedWord: "manuscript",
    startOffset: 4,
    endOffset: 14,
  });

  const previousWord = getDictionaryWordBeforeCaret("The chapter ends.  ", 20);
  assert.equal(previousWord.word, "ends");
  assert.equal(previousWord.startOffset, 12);
  assert.equal(previousWord.endOffset, 16);

  const contraction = getDictionaryWordBeforeCaret("Mara's voice", 6);
  assert.equal(contraction.word, "Mara's");
  assert.equal(contraction.normalizedWord, "mara's");

  const selectedText = "Steam billowed from the shroud.";
  const selectedStart = selectedText.indexOf("billowed");
  const selectedRange = getDictionaryWordRangeFromSelection(
    selectedText,
    selectedStart,
    selectedStart + "billowed".length,
  );
  assert.equal(selectedRange.word, "billowed");
  assert.equal(selectedRange.startOffset, selectedStart);

  const selectedWithPunctuation = getDictionaryWordRangeFromSelection("\"willow,\"", 0, 9);
  assert.equal(selectedWithPunctuation.word, "willow");

  assert.equal(getDictionaryWordRangeFromSelection("willow hum", 0, "willow hum".length), null);

  const pointerRange = getDictionaryWordRangeFromPointer(
    { value: "A scene opens." },
    { clientX: 10, clientY: 20 },
    {
      getTextareaOffsetFromPoint: () => 4,
    },
  );
  assert.equal(pointerRange.word, "scene");

  assert.deepEqual(
    extractDictionaryWords("Write one scene.").map((word) => word.normalizedWord),
    ["write", "one", "scene"],
  );
}
