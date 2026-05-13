// Intent: provide DOM-free spellcheck lexicon loading, tokenization, and suggestion helpers for editor UI.
// Intent: centralize spellcheck dictionary sources and lookup tuning for browser and test reuse.
const SPELLCHECK_WORDLIST_TEXT_URL = new URL("./spellcheck/neopass-default.txt", import.meta.url);
const SPELLCHECK_SUPPLEMENTAL_WORDLIST_TEXT_URL = new URL("./spellcheck/english-words-alpha.txt", import.meta.url);
const SPELLCHECK_REFERENCE_WORDLIST_URL = new URL("./spellcheck/google-10000-english-no-swears.txt", import.meta.url);
const SPELLCHECK_DEFAULT_SUGGESTION_LIMIT = 6;
const SPELLCHECK_DEFAULT_EDIT_DISTANCE = 2;
const SPELLCHECK_WORD_PATTERN = /[A-Za-z][A-Za-z'’-]*/g;
const SPELLCHECK_CONTRACTION_SUFFIXES = ["'re", "'ve", "'ll", "'d", "'m", "n't"];

let baseSpellcheckLexiconPromise = null;
let baseSpellcheckLexiconCache = null;
let referenceSpellcheckLexiconPromise = null;
let referenceSpellcheckLexiconCache = null;

// Intent: load shared dictionaries once so editor diagnostics do not refetch wordlists per scene.
export async function ensureSpellcheckBaseLexicon() {
  if (baseSpellcheckLexiconCache) {
    return baseSpellcheckLexiconCache;
  }

  if (!baseSpellcheckLexiconPromise) {
    baseSpellcheckLexiconPromise = loadSpellcheckBaseLexicon();
  }

  baseSpellcheckLexiconCache = await baseSpellcheckLexiconPromise;
  return baseSpellcheckLexiconCache;
}

export async function ensureSpellcheckReferenceLexicon() {
  if (referenceSpellcheckLexiconCache) {
    return referenceSpellcheckLexiconCache;
  }

  if (!referenceSpellcheckLexiconPromise) {
    referenceSpellcheckLexiconPromise = loadSpellcheckReferenceLexicon();
  }

  referenceSpellcheckLexiconCache = await referenceSpellcheckLexiconPromise;
  return referenceSpellcheckLexiconCache;
}

async function loadSpellcheckBaseLexicon() {
  const words = await loadSpellcheckWordsFromUrls([
    {
      url: SPELLCHECK_WORDLIST_TEXT_URL,
      label: "spellcheck base word list",
    },
    {
      url: SPELLCHECK_SUPPLEMENTAL_WORDLIST_TEXT_URL,
      label: "spellcheck supplemental word list",
    },
  ]);

  return createSpellcheckLexiconFromWords(words);
}

async function loadSpellcheckReferenceLexicon() {
  const words = await loadSpellcheckWordsFromUrls([
    {
      url: SPELLCHECK_REFERENCE_WORDLIST_URL,
      label: "spellcheck reference word list",
    },
  ]);

  return createSpellcheckLexiconFromWords(words);
}

async function loadSpellcheckWordsFromUrl(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${label} (${response.status})`);
  }

  const text = await response.text();
  return text.split(/\r?\n/).filter(Boolean);
}

export async function loadSpellcheckWordsFromUrls(sources = []) {
  const sourceEntries = Array.isArray(sources) ? sources : [];
  const settledSources = await Promise.allSettled(
    sourceEntries.map((source) => loadSpellcheckWordsFromUrl(
      source?.url,
      String(source?.label ?? "spellcheck word list"),
    )),
  );

  const words = [];
  for (const [index, sourceResult] of settledSources.entries()) {
    if (sourceResult.status === "fulfilled") {
      for (const word of sourceResult.value) {
        words.push(word);
      }
      continue;
    }

    const label = String(sourceEntries[index]?.label ?? "spellcheck word list");
    console.warn(`Unable to load ${label}`, sourceResult.reason);
  }

  return words;
}

// Intent: build indexed lexicons that support quick known-word checks and bounded suggestions.
export function createSpellcheckLexiconFromWords(words = []) {
  const knownWords = new Set();
  const rankByWord = new Map();
  const wordList = [];

  for (const entry of Array.isArray(words) ? words : []) {
    const normalized = normalizeSpellcheckWord(entry);
    if (!normalized || knownWords.has(normalized)) {
      continue;
    }

    knownWords.add(normalized);
    rankByWord.set(normalized, wordList.length + 1);
    wordList.push(normalized);
  }

  return {
    knownWords,
    rankByWord,
    wordList,
    wordsByKey: indexSpellcheckWordsByKey(wordList),
  };
}

export function buildSpellcheckProjectLexicon(texts = []) {
  const frequencyByWord = new Map();
  const sourceTexts = Array.isArray(texts) ? texts : [texts];

  for (const text of sourceTexts) {
    for (const token of extractSpellcheckTokens(text)) {
      frequencyByWord.set(token, Number(frequencyByWord.get(token) ?? 0) + 1);
    }
  }

  const wordList = [...frequencyByWord.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([word]) => word);

  return {
    knownWords: new Set(wordList),
    frequencyByWord,
    wordList,
    wordsByKey: indexSpellcheckWordsByKey(wordList),
  };
}

// Intent: resolve a cursor or pointer location back to a spellcheckable text range.
export function getSpellcheckWordRange(text, offset) {
  const source = String(text ?? "");
  if (!source.length) {
    return null;
  }

  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, source.length));
  let startOffset = safeOffset;
  let endOffset = safeOffset;

  while (startOffset > 0 && isSpellcheckWordCharacter(source[startOffset - 1])) {
    startOffset -= 1;
  }

  while (endOffset < source.length && isSpellcheckWordCharacter(source[endOffset])) {
    endOffset += 1;
  }

  if (startOffset === endOffset) {
    return null;
  }

  const word = source.slice(startOffset, endOffset);
  const normalizedWord = normalizeSpellcheckWord(word);
  if (!normalizedWord) {
    return null;
  }

  return {
    word,
    normalizedWord,
    startOffset,
    endOffset,
  };
}

export function isSpellcheckKnownWord(word, lexicons = {}) {
  const variants = getSpellcheckWordVariants(word);
  if (!variants.length) {
    return false;
  }

  const baseWords = lexicons.baseLexicon?.knownWords ?? lexicons.baseWords ?? new Set();
  const projectWords = lexicons.projectLexicon?.knownWords ?? lexicons.projectWords ?? new Set();
  const referenceWords = lexicons.referenceLexicon?.knownWords ?? lexicons.referenceWords ?? new Set();

  for (const variant of variants) {
    if (baseWords.has(variant) || projectWords.has(variant) || referenceWords.has(variant)) {
      return true;
    }
  }

  if (isSpellcheckKnownContraction(variants, {
    baseWords,
    projectWords,
    referenceWords,
  })) {
    return true;
  }

  return false;
}

export function isSpellcheckMisspelledWord(word, lexicons = {}) {
  const normalizedWord = normalizeSpellcheckWord(word);
  if (!normalizedWord) {
    return false;
  }

  const variants = getSpellcheckWordVariants(normalizedWord);
  const baseWords = lexicons.baseLexicon?.knownWords ?? lexicons.baseWords ?? new Set();
  const projectWords = lexicons.projectLexicon?.knownWords ?? lexicons.projectWords ?? new Set();
  const referenceWords = lexicons.referenceLexicon?.knownWords ?? lexicons.referenceWords ?? new Set();
  const exactKnown = baseWords.has(normalizedWord) || projectWords.has(normalizedWord) || referenceWords.has(normalizedWord);
  const variantKnown = variants.some((variant) => variant !== normalizedWord && (
    baseWords.has(variant) ||
    projectWords.has(variant) ||
    referenceWords.has(variant)
  ));

  if (exactKnown || variantKnown || isSpellcheckKnownContraction(variants, {
    baseWords,
    projectWords,
    referenceWords,
  })) {
    return false;
  }

  return true;
}

// Intent: rank suggestions by edit distance, project vocabulary, and reference frequency.
export function suggestSpellcheckAlternatives(word, lexicons = {}, options = {}) {
  const originalWord = String(word ?? "");
  const normalizedWord = normalizeSpellcheckWord(originalWord);
  if (!normalizedWord) {
    return [];
  }

  if (isSpellcheckKnownWord(normalizedWord, lexicons)) {
    return [];
  }

  const limit = Number.isInteger(options.limit) && options.limit > 0
    ? options.limit
    : SPELLCHECK_DEFAULT_SUGGESTION_LIMIT;
  const maxDistance = Number.isInteger(options.maxDistance) && options.maxDistance >= 0
    ? options.maxDistance
    : SPELLCHECK_DEFAULT_EDIT_DISTANCE;

  const candidates = collectSpellcheckCandidates(normalizedWord, {
    baseLexicon: lexicons.baseLexicon,
    referenceLexicon: lexicons.referenceLexicon,
    projectLexicon: lexicons.projectLexicon,
  });
  const rankedCandidates = [];
  const seen = new Set();

  for (const candidate of candidates) {
    if (!candidate || candidate === normalizedWord || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    const distance = computeSpellcheckEditDistanceWithinLimit(normalizedWord, candidate, maxDistance);
    if (distance > maxDistance) {
      continue;
    }

    rankedCandidates.push({
      word: candidate,
      distance,
      sourceRank: Number(
        lexicons.referenceLexicon?.rankByWord?.get(candidate) ??
        lexicons.baseLexicon?.rankByWord?.get(candidate) ??
        Number.POSITIVE_INFINITY
      ),
      projectFrequency: Number(lexicons.projectLexicon?.frequencyByWord?.get(candidate) ?? 0),
    });
  }

  rankedCandidates.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }

    if (left.projectFrequency !== right.projectFrequency) {
      return right.projectFrequency - left.projectFrequency;
    }

    if (left.sourceRank !== right.sourceRank) {
      return left.sourceRank - right.sourceRank;
    }

    const lengthDeltaLeft = Math.abs(left.word.length - normalizedWord.length);
    const lengthDeltaRight = Math.abs(right.word.length - normalizedWord.length);
    if (lengthDeltaLeft !== lengthDeltaRight) {
      return lengthDeltaLeft - lengthDeltaRight;
    }

    return left.word.localeCompare(right.word);
  });

  return rankedCandidates
    .slice(0, limit)
    .map((entry) => preserveSpellcheckWordCase(entry.word, originalWord));
}

export function normalizeSpellcheckWord(word) {
  const normalized = String(word ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  return /[a-z]/.test(normalized) ? normalized : "";
}

export function preserveSpellcheckWordCase(candidate, originalWord) {
  const original = String(originalWord ?? "");
  const normalizedCandidate = String(candidate ?? "");
  if (!normalizedCandidate) {
    return "";
  }

  if (!original) {
    return normalizedCandidate;
  }

  const cleanedOriginal = original
    .normalize("NFKC")
    .replace(/[’‘]/g, "'");

  if (cleanedOriginal === cleanedOriginal.toUpperCase()) {
    return normalizedCandidate.toUpperCase();
  }

  const firstCharacter = cleanedOriginal[0];
  const normalizedOriginalTail = cleanedOriginal.slice(1);
  if (
    firstCharacter &&
    firstCharacter === firstCharacter.toUpperCase() &&
    normalizedOriginalTail === normalizedOriginalTail.toLowerCase()
  ) {
    return normalizedCandidate.charAt(0).toUpperCase() + normalizedCandidate.slice(1);
  }

  return normalizedCandidate;
}

// Intent: narrow suggestion candidates before edit-distance scoring to keep live checks responsive.
function collectSpellcheckCandidates(normalizedWord, lexicons = {}) {
  const words = new Set();
  const keys = getSpellcheckLookupKeys(normalizedWord);
  const baseLexicon = lexicons.baseLexicon;
  const referenceLexicon = lexicons.referenceLexicon;
  const projectLexicon = lexicons.projectLexicon;

  for (const key of keys) {
    addSpellcheckWordsForKey(words, baseLexicon?.wordsByKey, key);
    addSpellcheckWordsForKey(words, referenceLexicon?.wordsByKey, key);
    addSpellcheckWordsForKey(words, projectLexicon?.wordsByKey, key);
  }

  if (!words.size) {
    addSpellcheckWords(words, baseLexicon?.wordList);
    addSpellcheckWords(words, referenceLexicon?.wordList);
    addSpellcheckWords(words, projectLexicon?.wordList);
  }

  return [...words].filter((candidate) => {
    if (!candidate || candidate === normalizedWord) {
      return false;
    }

    const lengthDelta = Math.abs(candidate.length - normalizedWord.length);
    return lengthDelta <= Math.max(3, Math.ceil(normalizedWord.length / 3));
  });
}

function addSpellcheckWordsForKey(target, wordsByKey, key) {
  if (!(wordsByKey instanceof Map) || !key) {
    return;
  }

  addSpellcheckWords(target, wordsByKey.get(key));
}

function addSpellcheckWords(target, words) {
  if (!(target instanceof Set) || !Array.isArray(words)) {
    return;
  }

  for (const word of words) {
    if (typeof word === "string" && word) {
      target.add(word);
    }
  }
}

function getSpellcheckLookupKeys(normalizedWord) {
  const letters = String(normalizedWord ?? "").replace(/[^a-z]/g, "");
  if (!letters) {
    return [];
  }

  const keyTwo = letters.slice(0, 2);
  const keyOne = letters.slice(0, 1);
  const keys = [keyTwo, keyOne].filter(Boolean);
  return [...new Set(keys)];
}

function indexSpellcheckWordsByKey(words) {
  const wordsByKey = new Map();
  for (const word of Array.isArray(words) ? words : []) {
    const keys = getSpellcheckLookupKeys(word);
    if (!keys.length) {
      continue;
    }

    for (const key of keys) {
      const bucket = wordsByKey.get(key) ?? [];
      bucket.push(word);
      wordsByKey.set(key, bucket);
    }
  }

  return wordsByKey;
}

function extractSpellcheckTokens(text) {
  const source = String(text ?? "");
  const matches = source.match(SPELLCHECK_WORD_PATTERN);
  if (!matches) {
    return [];
  }

  const tokens = [];
  for (const match of matches) {
    const normalized = normalizeSpellcheckWord(match);
    if (normalized) {
      tokens.push(normalized);
    }
  }

  return tokens;
}

export function collectSpellcheckMisspellings(text, lexicons = {}, options = {}) {
  const source = String(text ?? "");
  if (!source.length) {
    return [];
  }

  const excludeRange = normalizeSpellcheckRange(options.excludeRange);
  const matches = source.matchAll(SPELLCHECK_WORD_PATTERN);
  const misspellings = [];

  for (const match of matches) {
    const word = String(match[0] ?? "");
    const index = Number(match.index);
    if (!word || !Number.isInteger(index)) {
      continue;
    }

    const endIndex = index + word.length;
    if (excludeRange && index === excludeRange.startOffset && endIndex === excludeRange.endOffset) {
      continue;
    }

    if (!isSpellcheckMisspelledWord(word, lexicons)) {
      continue;
    }

    misspellings.push({
      word,
      normalizedWord: normalizeSpellcheckWord(word),
      index,
      endIndex,
    });
  }

  return misspellings;
}

// Intent: group repeated misspellings so the grammar panel can present actionable word-level fixes.
export function groupSpellcheckMisspellings(text, lexicons = {}, options = {}) {
  const misspellings = collectSpellcheckMisspellings(text, lexicons, options);
  const grouped = new Map();

  for (const misspelling of misspellings) {
    const normalizedWord = normalizeSpellcheckWord(misspelling.normalizedWord ?? misspelling.word);
    if (!normalizedWord) {
      continue;
    }

    const existing = grouped.get(normalizedWord);
    if (!existing) {
      grouped.set(normalizedWord, {
        word: misspelling.word,
        normalizedWord,
        count: 1,
        firstIndex: misspelling.index,
        lastIndex: misspelling.endIndex,
      });
      continue;
    }

    existing.count += 1;
    if (misspelling.index < existing.firstIndex) {
      existing.word = misspelling.word;
      existing.firstIndex = misspelling.index;
      existing.lastIndex = misspelling.endIndex;
      continue;
    }

    existing.lastIndex = Math.max(existing.lastIndex, misspelling.endIndex);
  }

  return [...grouped.values()]
    .sort((left, right) => left.firstIndex - right.firstIndex || left.word.localeCompare(right.word));
}

export function countSpellcheckMisspellings(text, lexicons = {}, options = {}) {
  return collectSpellcheckMisspellings(text, lexicons, options).length;
}

function getSpellcheckWordVariants(word) {
  const normalized = normalizeSpellcheckWord(word);
  if (!normalized) {
    return [];
  }

  const variants = new Set([normalized]);
  variants.add(normalized.replace(/['-]/g, ""));
  if (normalized.endsWith("'s")) {
    variants.add(normalized.slice(0, -2));
  }
  addSpellcheckInflectionVariants(variants, normalized);

  return [...variants].filter(Boolean);
}

function isSpellcheckKnownContraction(variants, lexicons = {}) {
  if (!Array.isArray(variants) || !variants.length) {
    return false;
  }

  const baseWords = lexicons.baseWords ?? new Set();
  const projectWords = lexicons.projectWords ?? new Set();
  const referenceWords = lexicons.referenceWords ?? new Set();
  const hasKnownWord = (candidate) => (
    baseWords.has(candidate) ||
    projectWords.has(candidate) ||
    referenceWords.has(candidate)
  );

  for (const variant of variants) {
    if (!variant || !variant.includes("'")) {
      continue;
    }

    for (const suffix of SPELLCHECK_CONTRACTION_SUFFIXES) {
      if (!variant.endsWith(suffix)) {
        continue;
      }

      const stem = variant.slice(0, -suffix.length);
      if (stem && hasKnownWord(stem)) {
        return true;
      }
    }
  }

  return false;
}

function normalizeSpellcheckRange(range) {
  if (!range || typeof range !== "object") {
    return null;
  }

  const startOffset = Number(range.startOffset);
  const endOffset = Number(range.endOffset);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset < startOffset) {
    return null;
  }

  return {
    startOffset,
    endOffset,
  };
}

function addSpellcheckInflectionVariants(variants, normalizedWord) {
  if (!(variants instanceof Set)) {
    return;
  }

  const word = String(normalizedWord ?? "");
  if (word.length < 4) {
    return;
  }

  const add = (candidate) => {
    const normalizedCandidate = normalizeSpellcheckWord(candidate);
    if (normalizedCandidate) {
      variants.add(normalizedCandidate);
    }
  };

  if (word.endsWith("ies") && word.length > 4) {
    add(`${word.slice(0, -3)}y`);
  }

  if (word.endsWith("es") && word.length > 3) {
    add(word.slice(0, -2));
  }

  if (word.endsWith("s") && word.length > 3) {
    add(word.slice(0, -1));
  }

  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    add(stem);

    if (hasSpellcheckDoubleEnding(stem)) {
      add(stem.slice(0, -1));
    }

    add(`${stem}e`);

    if (stem.endsWith("y")) {
      add(`${stem.slice(0, -1)}ie`);
    }
  }

  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    add(stem);

    if (hasSpellcheckDoubleEnding(stem)) {
      add(stem.slice(0, -1));
    }

    add(`${stem}e`);

    if (stem.endsWith("i")) {
      add(`${stem.slice(0, -1)}y`);
    }
  }

  if (word.endsWith("ly") && word.length > 4) {
    const stem = word.slice(0, -2);
    add(stem);

    if (stem.endsWith("i")) {
      add(`${stem.slice(0, -1)}y`);
    }

    add(`${stem}e`);
  }
}

function hasSpellcheckDoubleEnding(word) {
  const source = String(word ?? "");
  if (source.length < 2) {
    return false;
  }

  const lastCharacter = source[source.length - 1];
  return source[source.length - 2] === lastCharacter;
}

function isSpellcheckWordCharacter(character) {
  return typeof character === "string" && /[A-Za-z'’-]/.test(character);
}

function computeSpellcheckEditDistanceWithinLimit(source, target, limit) {
  if (source === target) {
    return 0;
  }

  const sourceLength = source.length;
  const targetLength = target.length;
  if (Math.abs(sourceLength - targetLength) > limit) {
    return limit + 1;
  }

  let previousRow = Array.from({ length: targetLength + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex += 1) {
    const currentRow = [sourceIndex];
    let rowMinimum = sourceIndex;
    const sourceCharacter = source[sourceIndex - 1];

    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const targetCharacter = target[targetIndex - 1];
      const substitutionCost = sourceCharacter === targetCharacter ? 0 : 1;
      const deletion = previousRow[targetIndex] + 1;
      const insertion = currentRow[targetIndex - 1] + 1;
      const substitution = previousRow[targetIndex - 1] + substitutionCost;
      const cellValue = Math.min(deletion, insertion, substitution);
      currentRow[targetIndex] = cellValue;
      if (cellValue < rowMinimum) {
        rowMinimum = cellValue;
      }
    }

    if (rowMinimum > limit) {
      return limit + 1;
    }

    previousRow = currentRow;
  }

  return previousRow[targetLength];
}
