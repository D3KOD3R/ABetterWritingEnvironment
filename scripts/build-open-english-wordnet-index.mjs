// Intent: convert Open English WordNet release data into fast local lookup shards for the editor.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const SOURCE_LABEL = "Open English WordNet 2025 (CC BY 4.0)";
const SHARD_KEYS = ["0", ..."abcdefghijklmnopqrstuvwxyz"];
const PART_OF_SPEECH_LABELS = {
  a: "adjective",
  r: "adverb",
  n: "noun",
  s: "adjective",
  v: "verb",
};

const args = parseArgs(process.argv.slice(2));
if (!args.jsonDir || !args.outDir) {
  console.error([
    "Usage:",
    "  node scripts/build-open-english-wordnet-index.mjs --json-dir <expanded-json-dir> --out-dir <dictionary-output-dir> [--wndb-dir <expanded-wndb-dir>]",
    "",
    "Download sources:",
    "  https://en-word.net/downloads/english-wordnet-2025-json.zip",
    "  https://en-word.net/downloads/english-wordnet-2025.zip",
  ].join("\n"));
  process.exit(1);
}

const synsets = await readSynsets(args.jsonDir);
const entries = await readEntries(args.jsonDir, synsets);
await applyExceptionAliases(entries, args.wndbDir);
await writeShards(entries, args.outDir);

console.log(`Wrote ${entries.size.toLocaleString("en-US")} Open English WordNet lookup keys to ${args.outDir}`);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const key = rawArgs[index];
    if (!key.startsWith("--")) {
      continue;
    }

    parsed[key.slice(2)] = rawArgs[index + 1] ?? "";
    index += 1;
  }

  return {
    jsonDir: String(parsed["json-dir"] ?? "").trim(),
    wndbDir: String(parsed["wndb-dir"] ?? "").trim(),
    outDir: String(parsed["out-dir"] ?? "").trim(),
  };
}

// Intent: retain only definition data needed by manuscript lookup instead of the full relation graph.
async function readSynsets(jsonDir) {
  const synsetById = new Map();
  const fileNames = await readdir(jsonDir);
  for (const fileName of fileNames) {
    if (!fileName.endsWith(".json") || fileName.startsWith("entries-") || fileName === "frames.json") {
      continue;
    }

    const synsetRecords = await readJson(join(jsonDir, fileName));
    for (const [synsetId, record] of Object.entries(synsetRecords)) {
      const definitions = arrayOfText(record?.definition);
      if (!definitions.length) {
        continue;
      }

      synsetById.set(synsetId, {
        definitions,
        examples: arrayOfText(record?.example),
        members: arrayOfText(record?.members).map(displayWord),
        partOfSpeech: partOfSpeechLabel(record?.partOfSpeech),
      });
    }
  }

  return synsetById;
}

async function readEntries(jsonDir, synsets) {
  const entryByLookupWord = new Map();
  const fileNames = (await readdir(jsonDir))
    .filter((fileName) => fileName.startsWith("entries-") && fileName.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of fileNames) {
    const wordRecords = await readJson(join(jsonDir, fileName));
    for (const [headword, recordByPartOfSpeech] of Object.entries(wordRecords)) {
      const lookupWords = lookupWordsForHeadword(headword);
      if (!lookupWords.length || !recordByPartOfSpeech || typeof recordByPartOfSpeech !== "object") {
        continue;
      }

      const entry = createDictionaryEntry(headword);
      for (const record of Object.values(recordByPartOfSpeech)) {
        collectPronunciation(entry, record);
        collectDefinitions(entry, record, synsets);
      }

      if (!entry.definitions.length) {
        continue;
      }

      for (const lookupWord of lookupWords) {
        indexEntry(entryByLookupWord, lookupWord, entry);
      }
    }
  }

  return entryByLookupWord;
}

function createDictionaryEntry(headword) {
  return {
    word: displayWord(headword),
    pronunciation: "",
    sourceLabel: SOURCE_LABEL,
    definitions: [],
  };
}

function collectPronunciation(entry, record) {
  if (entry.pronunciation || !Array.isArray(record?.pronunciation)) {
    return;
  }

  const pronunciation = record.pronunciation
    .map((item) => String(item?.value ?? "").trim())
    .find(Boolean);
  if (pronunciation) {
    entry.pronunciation = pronunciation;
  }
}

function collectDefinitions(entry, record, synsets) {
  for (const sense of Array.isArray(record?.sense) ? record.sense : []) {
    const synset = synsets.get(String(sense?.synset ?? ""));
    if (!synset) {
      continue;
    }

    for (const definition of synset.definitions) {
      const row = {
        partOfSpeech: synset.partOfSpeech,
        definition,
        example: synset.examples[0] ?? "",
        synonyms: synset.members
          .filter((member) => normalizeDictionaryWord(member) !== normalizeDictionaryWord(entry.word))
          .slice(0, 10),
      };
      addDefinition(entry.definitions, row);
    }
  }
}

function addDefinition(definitions, row) {
  const key = [
    row.partOfSpeech,
    normalizePlainText(row.definition),
    normalizePlainText(row.example),
  ].join("\u0000");
  if (definitions.some((existing) => [
    existing.partOfSpeech,
    normalizePlainText(existing.definition),
    normalizePlainText(existing.example),
  ].join("\u0000") === key)) {
    return;
  }

  definitions.push(row);
}

async function applyExceptionAliases(entryByLookupWord, wndbDir) {
  if (!wndbDir) {
    return;
  }

  const exceptionRoot = await resolveExceptionRoot(wndbDir);
  const exceptionFiles = ["adj.exc", "adv.exc", "noun.exc", "verb.exc"];
  for (const fileName of exceptionFiles) {
    let content = "";
    try {
      content = await readFile(join(exceptionRoot, fileName), "utf8");
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/).filter(Boolean);
      const alias = normalizeDictionaryWord(parts[0]);
      const baseWords = parts.slice(1).map(normalizeDictionaryWord).filter(Boolean);
      if (!alias || !baseWords.length || entryByLookupWord.has(alias)) {
        continue;
      }

      const baseWord = baseWords.find((candidate) => entryByLookupWord.has(candidate));
      if (baseWord) {
        entryByLookupWord.set(alias, entryByLookupWord.get(baseWord));
      }
    }
  }
}

async function resolveExceptionRoot(wndbDir) {
  const names = await readdir(wndbDir, { withFileTypes: true });
  if (names.some((entry) => entry.isFile() && entry.name.endsWith(".exc"))) {
    return wndbDir;
  }

  const child = names.find((entry) => entry.isDirectory());
  return child ? join(wndbDir, child.name) : wndbDir;
}

async function writeShards(entryByLookupWord, outDir) {
  const shardEntries = Object.fromEntries(SHARD_KEYS.map((key) => [key, {}]));

  for (const [lookupWord, entry] of [...entryByLookupWord.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    shardEntries[shardKeyForWord(lookupWord)][lookupWord] = compactEntry(entry);
  }

  await mkdir(join(outDir, "shards"), { recursive: true });
  const manifest = {
    id: "open-english-wordnet-2025-core",
    label: "Open English WordNet 2025",
    version: "2025",
    releaseDate: "2025-12-31",
    sourceLabel: SOURCE_LABEL,
    sourceUrl: "https://en-word.net/downloads",
    license: "CC-BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Open English WordNet by the Open English WordNet Community, derived from Princeton WordNet.",
    generator: basename(import.meta.url),
    shards: {},
  };

  for (const key of SHARD_KEYS) {
    const entries = shardEntries[key];
    const fileName = `shards/${key}.json`;
    manifest.shards[key] = {
      path: fileName,
      entryCount: Object.keys(entries).length,
    };
    await writeFile(join(outDir, fileName), JSON.stringify({ entries }), "utf8");
  }

  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function indexEntry(entryByLookupWord, lookupWord, entry) {
  if (!lookupWord || entryByLookupWord.has(lookupWord)) {
    return;
  }

  entryByLookupWord.set(lookupWord, entry);
}

function compactEntry(entry) {
  return [
    entry.word,
    entry.pronunciation,
    entry.definitions.map((definition) => [
      definition.partOfSpeech,
      definition.definition,
      definition.example,
      definition.synonyms,
    ]),
  ];
}

function lookupWordsForHeadword(headword) {
  const display = displayWord(headword);
  const candidates = new Set([
    normalizeDictionaryWord(headword),
    normalizeDictionaryWord(display),
    normalizeDictionaryWord(String(headword ?? "").replace(/_/g, "-")),
  ]);

  return [...candidates].filter(Boolean);
}

function shardKeyForWord(word) {
  const first = String(word ?? "").trim().charAt(0).toLowerCase();
  return /^[a-z]$/.test(first) ? first : "0";
}

function partOfSpeechLabel(partOfSpeech) {
  const key = String(partOfSpeech ?? "").trim().toLowerCase();
  return PART_OF_SPEECH_LABELS[key] ?? key;
}

function displayWord(word) {
  return String(word ?? "").replace(/_/g, " ").trim();
}

function normalizeDictionaryWord(word) {
  const normalized = String(word ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  return /[a-z]/.test(normalized) ? normalized : "";
}

function normalizePlainText(text) {
  return String(text ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function arrayOfText(candidate) {
  return (Array.isArray(candidate) ? candidate : [])
    .map(textValue)
    .filter(Boolean);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function textValue(item) {
  if (typeof item === "string" || typeof item === "number") {
    return String(item).trim();
  }

  if (item && typeof item === "object") {
    return String(item.text ?? item.value ?? item.word ?? "").trim();
  }

  return "";
}
