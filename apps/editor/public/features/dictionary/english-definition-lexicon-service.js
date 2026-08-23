// Intent: load and query local English definition data without adding a cloud dependency to writing workflows.
import { normalizeDictionaryWord } from "./dictionary-word-service.js";

const OPEN_ENGLISH_WORDNET_MANIFEST_URL = new URL("./open-english-wordnet-2025/manifest.json", import.meta.url);
const OPEN_ENGLISH_WORDNET_SOURCE_LABEL = "Open English WordNet 2025 (CC BY 4.0)";

let englishDefinitionLexiconPromise = null;
let englishDefinitionLexiconCache = null;

export async function ensureEnglishDefinitionLexicon(options = {}) {
  if (englishDefinitionLexiconCache) {
    return englishDefinitionLexiconCache;
  }

  if (!englishDefinitionLexiconPromise) {
    englishDefinitionLexiconPromise = loadEnglishDefinitionLexicon(options);
  }

  englishDefinitionLexiconCache = await englishDefinitionLexiconPromise;
  return englishDefinitionLexiconCache;
}

export async function loadEnglishDefinitionLexicon(options = {}) {
  const fetchFn = typeof options.fetchFn === "function" ? options.fetchFn : globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("English dictionary definitions cannot load because fetch is unavailable.");
  }

  const url = options.url ?? OPEN_ENGLISH_WORDNET_MANIFEST_URL;
  const payload = await fetchDictionaryJson(fetchFn, url);
  if (Array.isArray(payload)) {
    return createEnglishDefinitionLexiconFromEntries(payload, {
      sourceLabel: options.sourceLabel,
    });
  }

  return createShardedEnglishDefinitionLexiconFromManifest(payload, {
    fetchFn,
    manifestUrl: url,
    sourceLabel: options.sourceLabel,
  });
}

// Intent: build a normalized lookup index that supports aliases and simple English inflection fallbacks.
export function createEnglishDefinitionLexiconFromEntries(entries = [], options = {}) {
  const entryByWord = new Map();
  const indexedWords = [];
  const sourceLabel = normalizeSourceLabel(options.sourceLabel);

  for (const candidate of Array.isArray(entries) ? entries : []) {
    const entry = normalizeEnglishDefinitionEntry(candidate, sourceLabel);
    if (!entry) {
      continue;
    }

    indexEnglishDefinitionEntry(entryByWord, indexedWords, entry.normalizedWord, entry);
    for (const alias of entry.aliases) {
      indexEnglishDefinitionEntry(entryByWord, indexedWords, alias, entry);
    }
  }

  return {
    kind: "memory",
    entryByWord,
    indexedWords,
    sourceLabel,
  };
}

export function createShardedEnglishDefinitionLexiconFromManifest(manifest = {}, options = {}) {
  const sourceLabel = normalizeSourceLabel(options.sourceLabel ?? manifest?.sourceLabel);
  return {
    kind: "sharded",
    fetchFn: typeof options.fetchFn === "function" ? options.fetchFn : globalThis.fetch,
    manifest: normalizeOpenEnglishWordNetManifest(manifest),
    manifestUrl: options.manifestUrl ?? OPEN_ENGLISH_WORDNET_MANIFEST_URL,
    shardCache: new Map(),
    sourceLabel,
  };
}

export async function lookupEnglishDefinition(lexicon, word) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord || !lexicon) {
    return null;
  }

  for (const candidate of getEnglishDefinitionLookupCandidates(normalizedWord)) {
    const entry = await getEnglishDefinitionEntry(lexicon, candidate);
    if (entry) {
      return {
        lookupWord: normalizedWord,
        matchedWord: candidate,
        entry,
      };
    }
  }

  return null;
}

export function getEnglishDefinitionLookupCandidates(word) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord) {
    return [];
  }

  const candidates = new Set([normalizedWord]);
  addInflectionCandidates(candidates, normalizedWord);
  return [...candidates].filter(Boolean);
}

async function getEnglishDefinitionEntry(lexicon, normalizedWord) {
  if (lexicon?.entryByWord instanceof Map) {
    return lexicon.entryByWord.get(normalizedWord) ?? null;
  }

  if (lexicon?.kind !== "sharded") {
    return null;
  }

  const shard = await ensureOpenEnglishWordNetShard(lexicon, getEnglishDefinitionShardKey(normalizedWord));
  return shard.entryByWord.get(normalizedWord) ?? null;
}

async function ensureOpenEnglishWordNetShard(lexicon, shardKey) {
  if (lexicon.shardCache.has(shardKey)) {
    return lexicon.shardCache.get(shardKey);
  }

  const shardRecord = lexicon.manifest.shards[shardKey];
  if (!shardRecord?.path) {
    const emptyShard = { entryByWord: new Map(), indexedWords: [] };
    lexicon.shardCache.set(shardKey, emptyShard);
    return emptyShard;
  }

  const shardUrl = resolveDictionaryAssetUrl(shardRecord.path, lexicon.manifestUrl);
  const payload = await fetchDictionaryJson(lexicon.fetchFn, shardUrl);
  const shard = createEnglishDefinitionShardFromPayload(payload, {
    sourceLabel: lexicon.sourceLabel,
  });
  lexicon.shardCache.set(shardKey, shard);
  return shard;
}

export function createEnglishDefinitionShardFromPayload(payload = {}, options = {}) {
  const entryByWord = new Map();
  const indexedWords = [];
  const sourceLabel = normalizeSourceLabel(options.sourceLabel ?? payload?.sourceLabel);
  const entries = payload?.entries && typeof payload.entries === "object" && !Array.isArray(payload.entries)
    ? payload.entries
    : {};

  for (const [lookupWord, candidate] of Object.entries(entries)) {
    const normalizedLookupWord = normalizeDictionaryWord(lookupWord);
    const entry = normalizeEnglishDefinitionEntry(candidate, sourceLabel);
    if (!normalizedLookupWord || !entry || entryByWord.has(normalizedLookupWord)) {
      continue;
    }

    entryByWord.set(normalizedLookupWord, entry);
    indexedWords.push(normalizedLookupWord);
  }

  return {
    entryByWord,
    indexedWords,
    sourceLabel,
  };
}

function normalizeOpenEnglishWordNetManifest(manifest) {
  const shards = {};
  const sourceShards = manifest?.shards && typeof manifest.shards === "object" && !Array.isArray(manifest.shards)
    ? manifest.shards
    : {};
  for (const [key, record] of Object.entries(sourceShards)) {
    const shardKey = getEnglishDefinitionShardKey(key);
    const path = String(record?.path ?? record?.url ?? "").trim();
    if (!path) {
      continue;
    }

    shards[shardKey] = {
      path,
      entryCount: Math.max(0, Math.floor(Number(record?.entryCount) || 0)),
    };
  }

  return {
    id: String(manifest?.id ?? "open-english-wordnet-2025-core").trim(),
    label: String(manifest?.label ?? "Open English WordNet 2025").trim(),
    version: String(manifest?.version ?? "2025").trim(),
    sourceLabel: normalizeSourceLabel(manifest?.sourceLabel),
    sourceUrl: String(manifest?.sourceUrl ?? "https://en-word.net/downloads").trim(),
    license: String(manifest?.license ?? "CC-BY 4.0").trim(),
    licenseUrl: String(manifest?.licenseUrl ?? "https://creativecommons.org/licenses/by/4.0/").trim(),
    attribution: String(manifest?.attribution ?? "").trim(),
    shards,
  };
}

function normalizeEnglishDefinitionEntry(candidate, fallbackSourceLabel = OPEN_ENGLISH_WORDNET_SOURCE_LABEL) {
  if (Array.isArray(candidate)) {
    return normalizeCompactEnglishDefinitionEntry(candidate, fallbackSourceLabel);
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const word = String(candidate.word ?? "").trim();
  const normalizedWord = normalizeDictionaryWord(word);
  if (!word || !normalizedWord) {
    return null;
  }

  const definitions = normalizeDefinitionList(candidate.definitions);
  if (!definitions.length) {
    return null;
  }

  const aliases = Array.isArray(candidate.aliases)
    ? candidate.aliases.map(normalizeDictionaryWord).filter(Boolean)
    : [];

  return {
    word,
    normalizedWord,
    aliases: [...new Set(aliases.filter((alias) => alias !== normalizedWord))],
    pronunciation: String(candidate.pronunciation ?? "").trim(),
    definitions,
    sourceLabel: normalizeSourceLabel(candidate.sourceLabel ?? fallbackSourceLabel),
  };
}

function normalizeCompactEnglishDefinitionEntry(candidate, fallbackSourceLabel) {
  const word = String(candidate[0] ?? "").trim();
  const normalizedWord = normalizeDictionaryWord(word);
  if (!word || !normalizedWord) {
    return null;
  }

  const definitions = normalizeDefinitionList(
    (Array.isArray(candidate[2]) ? candidate[2] : []).map((definition) => ({
      partOfSpeech: definition?.[0],
      definition: definition?.[1],
      example: definition?.[2],
      synonyms: definition?.[3],
    })),
  );
  if (!definitions.length) {
    return null;
  }

  return {
    word,
    normalizedWord,
    aliases: [],
    pronunciation: String(candidate[1] ?? "").trim(),
    definitions,
    sourceLabel: normalizeSourceLabel(fallbackSourceLabel),
  };
}

function normalizeDefinitionList(definitions) {
  return (Array.isArray(definitions) ? definitions : [])
    .map((definition) => {
      const definitionText = String(definition?.definition ?? "").trim();
      if (!definitionText) {
        return null;
      }

      const synonyms = Array.isArray(definition?.synonyms)
        ? definition.synonyms.map((synonym) => String(synonym ?? "").trim()).filter(Boolean)
        : [];
      return {
        partOfSpeech: String(definition?.partOfSpeech ?? "").trim(),
        definition: definitionText,
        example: String(definition?.example ?? "").trim(),
        synonyms: [...new Set(synonyms)],
      };
    })
    .filter(Boolean);
}

function indexEnglishDefinitionEntry(entryByWord, indexedWords, word, entry) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!normalizedWord || entryByWord.has(normalizedWord)) {
    return;
  }

  entryByWord.set(normalizedWord, entry);
  indexedWords.push(normalizedWord);
}

async function fetchDictionaryJson(fetchFn, url) {
  if (typeof fetchFn !== "function") {
    throw new Error("English dictionary definitions cannot load because fetch is unavailable.");
  }

  const response = await fetchFn(url);
  if (!response?.ok) {
    throw new Error(`Unable to load English dictionary definitions (${response?.status ?? "unknown"}).`);
  }

  return response.json();
}

function resolveDictionaryAssetUrl(path, baseUrl) {
  try {
    return new URL(path, baseUrl);
  } catch {
    const base = String(baseUrl ?? "");
    return `${base.replace(/[^/]*$/, "")}${path}`;
  }
}

function getEnglishDefinitionShardKey(word) {
  const firstCharacter = normalizeDictionaryWord(word).charAt(0);
  return /^[a-z]$/.test(firstCharacter) ? firstCharacter : "0";
}

function normalizeSourceLabel(sourceLabel) {
  return String(sourceLabel ?? OPEN_ENGLISH_WORDNET_SOURCE_LABEL).trim() || OPEN_ENGLISH_WORDNET_SOURCE_LABEL;
}

function addInflectionCandidates(candidates, normalizedWord) {
  const word = String(normalizedWord ?? "");
  if (word.length < 4) {
    return;
  }

  const add = (candidate) => {
    const normalizedCandidate = normalizeDictionaryWord(candidate);
    if (normalizedCandidate) {
      candidates.add(normalizedCandidate);
    }
  };

  if (word.endsWith("'s") && word.length > 3) {
    add(word.slice(0, -2));
  }

  if (word.endsWith("ies") && word.length > 4) {
    add(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith("es") && word.length > 4) {
    add(word.slice(0, -2));
  }

  if (word.endsWith("s") && word.length > 4) {
    add(word.slice(0, -1));
  }

  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    add(stem);
    add(`${stem}e`);
    if (hasDoubleEnding(stem)) {
      add(stem.slice(0, -1));
    }
  }

  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    add(stem);
    add(`${stem}e`);
    if (hasDoubleEnding(stem)) {
      add(stem.slice(0, -1));
    }
  }

  if (word.endsWith("ly") && word.length > 4) {
    add(word.slice(0, -2));
  }
}

function hasDoubleEnding(word) {
  const source = String(word ?? "");
  return source.length > 1 && source[source.length - 1] === source[source.length - 2];
}
