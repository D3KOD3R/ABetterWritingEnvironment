// Intent: verify spellcheck tokenization, lexicon loading, and suggestion behavior.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildSpellcheckProjectLexicon,
  createSpellcheckLexiconFromWords,
  countSpellcheckMisspellings,
  collectSpellcheckMisspellings,
  groupSpellcheckMisspellings,
  getSpellcheckWordRange,
  isSpellcheckKnownWord,
  isSpellcheckMisspelledWord,
  normalizeSpellcheckWord,
  loadSpellcheckWordsFromUrls,
  preserveSpellcheckWordCase,
  suggestSpellcheckAlternatives,
} from "../apps/editor/public/spellcheck.js";
import {
  resolveLiveSpellcheckWordRange,
  validateLiveSpellcheckMenuRange,
} from "../apps/editor/public/features/manuscript-editor/spellcheck-range-guard.js";

export async function runSpellcheckTest() {
  const baseLexicon = createSpellcheckLexiconFromWords([
    "when",
    "parallel",
    "the",
    "crew",
    "station",
    "intermittent",
    "helpless",
    "spelling",
    "drum",
    "calm",
    "desperate",
    "did",
  ]);
  const referenceLexicon = createSpellcheckLexiconFromWords([
    "when",
    "parallel",
    "the",
    "crew",
    "station",
    "intermittent",
    "drum",
    "calm",
    "desperate",
    "helpless",
    "spelling",
    "did",
  ]);
  const projectLexicon = buildSpellcheckProjectLexicon([
    "The crew on Serva Vitae waited in silence.",
    "John watched the station lights.",
    "When the breeze turned, they moved quickly.",
  ]);
  const auditWordList = readFileSync(new URL("../apps/editor/public/spellcheck/neopass-default.txt", import.meta.url), "utf8").split(/\r?\n/);
  const auditLexicon = createSpellcheckLexiconFromWords(auditWordList);
  const testSceneVerse = "The crew watched the station lights. Wehn the breaze turned, they moved quikly.";
  const typingSentence = "Wehn breaze quikly drifted onward.";

  assert.equal(normalizeSpellcheckWord("Wehn"), "wehn");
  assert.equal(normalizeSpellcheckWord("John’s"), "john's");
  assert.equal(preserveSpellcheckWordCase("when", "Wehn"), "When");
  assert.equal(preserveSpellcheckWordCase("parallel", "PARALLEL"), "PARALLEL");

  const wordRange = getSpellcheckWordRange("The crew saw parrallel lights.", "The crew saw ".length + 2);
  assert.ok(wordRange);
  assert.equal(wordRange.word, "parrallel");
  assert.equal(wordRange.startOffset, "The crew saw ".length);
  assert.equal(wordRange.endOffset, "The crew saw parrallel".length);
  const stalePrefixRange = resolveLiveSpellcheckWordRange("Icarus", 0, 5);
  assert.ok(stalePrefixRange);
  assert.equal(stalePrefixRange.word, "Icarus");
  assert.equal(stalePrefixRange.startOffset, 0);
  assert.equal(stalePrefixRange.endOffset, "Icarus".length);
  assert.equal(
    resolveLiveSpellcheckWordRange("Icarus", 0, 5, { expectedWord: "Icaru" }),
    null,
  );

  assert.equal(isSpellcheckKnownWord("Serva", { baseLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("when", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("wehn", { baseLexicon, referenceLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckKnownWord("drumming", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("calming", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("desperately", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("helplessly", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("intermittently", { baseLexicon, referenceLexicon, projectLexicon }), true);
  assert.equal(isSpellcheckKnownWord("speeling", { baseLexicon, referenceLexicon, projectLexicon }), false);
  assert.equal(
    isSpellcheckMisspelledWord("qwertyx", {
      baseLexicon,
      referenceLexicon,
      projectLexicon: buildSpellcheckProjectLexicon(["qwertyx"]),
    }),
    false,
  );
  assert.equal(isSpellcheckMisspelledWord("speeling", { baseLexicon, referenceLexicon }), true);
  assert.equal(isSpellcheckMisspelledWord("didn't", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("intermittently", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("helplessly", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("icicles", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("trespass", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("radiant", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("momentarily", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("cheerful", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("chimed", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("cavern", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("crushed", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("silhouette", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(isSpellcheckMisspelledWord("rifle", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }), false);
  assert.equal(
    validateLiveSpellcheckMenuRange("Icarus", { word: "Icaru", startOffset: 0, endOffset: 5 }, {
      baseLexicon: auditLexicon,
      referenceLexicon: auditLexicon,
      projectLexicon,
    }),
    null,
  );
  const liveMisspelledRange = validateLiveSpellcheckMenuRange("Icaru", { word: "Icaru", startOffset: 0, endOffset: 5 }, {
    baseLexicon: auditLexicon,
    referenceLexicon: auditLexicon,
    projectLexicon,
  });
  assert.ok(liveMisspelledRange);
  assert.equal(liveMisspelledRange.word, "Icaru");

  assert.ok(
    suggestSpellcheckAlternatives("Wehn", { baseLexicon: auditLexicon, projectLexicon }).includes("When"),
  );
  assert.ok(
    suggestSpellcheckAlternatives("parrallel", { baseLexicon: auditLexicon, projectLexicon }).includes("parallel"),
  );
  assert.deepEqual(
    suggestSpellcheckAlternatives("crew", { baseLexicon: auditLexicon, projectLexicon }),
    [],
  );
  assert.ok(
    suggestSpellcheckAlternatives("speeling", { baseLexicon: auditLexicon, projectLexicon, referenceLexicon: auditLexicon }).includes("spelling"),
  );
  assert.deepEqual(
    suggestSpellcheckAlternatives("drumming", { baseLexicon: auditLexicon, projectLexicon }),
    [],
  );

  assert.equal(
    countSpellcheckMisspellings(testSceneVerse, { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }),
    3,
  );
  assert.deepEqual(
    collectSpellcheckMisspellings(testSceneVerse, { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon })
      .map((entry) => entry.word),
    ["Wehn", "breaze", "quikly"],
  );
  assert.deepEqual(
    groupSpellcheckMisspellings("Wehn wehn breaze quikly quikly", { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon })
      .map((entry) => ({ word: entry.word, count: entry.count })),
    [
      { word: "Wehn", count: 2 },
      { word: "breaze", count: 1 },
      { word: "quikly", count: 2 },
    ],
  );
  const typingRange = getSpellcheckWordRange(typingSentence, typingSentence.indexOf("quikly") + 3);
  assert.ok(typingRange);
  assert.equal(
    countSpellcheckMisspellings(typingSentence, { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }, { excludeRange: typingRange }),
    2,
  );
  assert.deepEqual(
    groupSpellcheckMisspellings(typingSentence, { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }, { excludeRange: typingRange })
      .map((entry) => entry.word),
    ["Wehn", "breaze"],
  );

  const cleanVerse = "Icicles clung to the cavern roof, daring anyone brave enough to trespass below them. Radiant beams of warm morning light pierced through them, momentarily blinding the captain. The cheerful sweet voice chimed in.";
  assert.equal(
    countSpellcheckMisspellings(cleanVerse, { baseLexicon: auditLexicon, referenceLexicon: auditLexicon, projectLexicon }),
    0,
  );

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/good.txt")) {
        return {
          ok: true,
          text: async () => "alpha\nbeta\n",
        };
      }

      return {
        ok: false,
        status: 404,
        text: async () => "",
      };
    };

    const resilientWords = await loadSpellcheckWordsFromUrls([
      { url: new URL("https://example.test/good.txt"), label: "good word list" },
      { url: new URL("https://example.test/missing.txt"), label: "missing word list" },
    ], {
      onSourceLoadError: () => {},
    });

    assert.deepEqual(resilientWords, ["alpha", "beta"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
}
