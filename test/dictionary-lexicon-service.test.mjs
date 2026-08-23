// Intent: verify local English definition lookup supports aliases and simple inflections.
import assert from "node:assert/strict";

import {
  createEnglishDefinitionLexiconFromEntries,
  createEnglishDefinitionShardFromPayload,
  createShardedEnglishDefinitionLexiconFromManifest,
  getEnglishDefinitionLookupCandidates,
  loadEnglishDefinitionLexicon,
  lookupEnglishDefinition,
} from "../apps/editor/public/features/dictionary/english-definition-lexicon-service.js";

export async function runDictionaryLexiconServiceTest() {
  const lexicon = createEnglishDefinitionLexiconFromEntries([
    {
      word: "write",
      aliases: ["wrote", "written"],
      definitions: [
        {
          partOfSpeech: "verb",
          definition: "To compose text.",
          example: "She writes every morning.",
          synonyms: ["compose"],
        },
      ],
    },
    {
      word: "story",
      definitions: [
        {
          partOfSpeech: "noun",
          definition: "An account of events.",
        },
      ],
    },
  ]);

  assert.equal((await lookupEnglishDefinition(lexicon, "Wrote")).entry.word, "write");
  assert.equal((await lookupEnglishDefinition(lexicon, "stories")).entry.word, "story");
  assert.equal(await lookupEnglishDefinition(lexicon, "unknown"), null);
  assert.ok(getEnglishDefinitionLookupCandidates("writing").includes("write"));

  const shard = createEnglishDefinitionShardFromPayload({
    entries: {
      wrote: [
        "write",
        "",
        [["verb", "communicate or express by writing", "Please write to me every week", ["drop a line"]]],
      ],
    },
  });
  assert.equal(shard.entryByWord.get("wrote").word, "write");

  const sharded = createShardedEnglishDefinitionLexiconFromManifest({
    sourceLabel: "Open English WordNet 2025 (CC BY 4.0)",
    shards: {
      w: { path: "shards/w.json", entryCount: 1 },
    },
  }, {
    manifestUrl: "memory://dictionary/manifest.json",
    fetchFn: async (url) => {
      assert.equal(String(url), "memory://dictionary/shards/w.json");
      return {
        ok: true,
        async json() {
          return {
            entries: {
              wrote: [
                "write",
                "",
                [["verb", "communicate or express by writing", "", ["compose"]]],
              ],
            },
          };
        },
      };
    },
  });
  assert.equal((await lookupEnglishDefinition(sharded, "wrote")).entry.word, "write");

  const loaded = await loadEnglishDefinitionLexicon({
    fetchFn: async () => ({
      ok: true,
      async json() {
        return [
          {
            word: "chapter",
            definitions: [{ definition: "A main division of a book." }],
          },
        ];
      },
    }),
    url: "memory://dictionary",
  });
  assert.equal((await lookupEnglishDefinition(loaded, "chapters")).entry.word, "chapter");
}
