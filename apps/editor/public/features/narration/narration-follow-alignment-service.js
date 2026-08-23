// Intent: resolve live narration transcripts back to canonical scene spans without owning audio capture.

const MAX_TRANSCRIPT_TAIL_WORDS = 14;
const MIN_RESPONSIVE_CHANGED_WORDS = 2;
const MIN_CONFIDENT_WORDS = 2;
const MAX_WORD_LOOKAHEAD = 8;
const MIN_FUZZY_WORD_LENGTH = 4;
const MIN_FUZZY_WORD_FIT = 0.72;
const NEAR_VIEWPORT_BLOCK_RADIUS = 1;
const FULL_SCENE_VIEWPORT_PENALTY = 36;
const EXHAUSTIVE_BLOCK_TOKEN_LIMIT = 96;
const MAX_CANDIDATE_START_INDEXES = 96;
const REFERENCE_TOKEN_SEARCH_RADIUS = 28;
const ACTIVE_FOLLOW_BACKTRACK_TOKEN_LIMIT = MAX_TRANSCRIPT_TAIL_WORDS;
const ACTIVE_FOLLOW_FORWARD_TOKEN_LIMIT = REFERENCE_TOKEN_SEARCH_RADIUS;
const ACTIVE_FOLLOW_NEXT_BLOCK_TOKEN_LIMIT = REFERENCE_TOKEN_SEARCH_RADIUS;
const ACTIVE_FOLLOW_FORWARD_BLOCK_LIMIT = 1;
const MIN_STABLE_FOLLOW_CONFIDENCE = 0.7;
const ACTIVE_FOLLOW_BACKWARD_OFFSET_TOLERANCE = 2;
const MIN_NEXT_BLOCK_TRANSITION_WORDS = 4;
const MIN_NEXT_BLOCK_TRANSITION_WORD_FIT = 0.74;
const MIN_NEXT_BLOCK_TRANSITION_EXACT_WORDS = 2;
const MAX_INITIAL_FOLLOW_PREFIX_CHARACTERS = 36;
const MAX_INITIAL_FOLLOW_PREFIX_WORDS = 3;

// Intent: keep high-volume follow diagnostics behind the Developer Logs source gates.
function shouldEmitDebugLog(logger) {
  return logger
    && typeof logger.debug === "function"
    && (typeof logger.isEnabled !== "function" || logger.isEnabled());
}

function emitNarrationFollowDebug(logger, event, message, context = {}) {
  if (!shouldEmitDebugLog(logger)) {
    return;
  }

  logger.debug("narration-follow", event, message, context);
}

function readHighResolutionTimeMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function roundDurationMs(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function createTranscriptTailSummary(tokens) {
  return getTranscriptTail(tokens).map((token) => token.normalized);
}

function doTokenSequencesMatch(leftTokens, rightTokens) {
  const left = Array.isArray(leftTokens) ? leftTokens : [];
  const right = Array.isArray(rightTokens) ? rightTokens : [];
  if (left.length !== right.length) {
    return false;
  }

  return left.every((token, index) => token.normalized === right[index]?.normalized);
}

function normalizeSpeechToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function normalizeWordFitText(value) {
  return normalizeSpeechToken(value).replace(/['-]/g, "");
}

function calculateEditDistance(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

export function scoreNarrationWordFit(spokenWord, manuscriptWord) {
  const spoken = normalizeWordFitText(spokenWord);
  const manuscript = normalizeWordFitText(manuscriptWord);
  if (!spoken || !manuscript) {
    return 0;
  }

  if (spoken === manuscript) {
    return 1;
  }

  if (/^\d+$/.test(spoken) || /^\d+$/.test(manuscript)) {
    return 0;
  }

  const shorterLength = Math.min(spoken.length, manuscript.length);
  if (shorterLength < MIN_FUZZY_WORD_LENGTH) {
    return 0;
  }

  const longerLength = Math.max(spoken.length, manuscript.length);
  const distance = calculateEditDistance(spoken, manuscript);
  const similarity = 1 - (distance / longerLength);
  return similarity >= MIN_FUZZY_WORD_FIT ? similarity : 0;
}

export function tokenizeNarrationSpeechText(text) {
  const value = String(text ?? "");
  const tokenPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
  const tokens = [];
  let match = tokenPattern.exec(value);

  while (match) {
    const raw = match[0];
    const normalized = normalizeSpeechToken(raw);
    if (normalized) {
      tokens.push({
        raw,
        normalized,
        startOffset: match.index,
        endOffset: match.index + raw.length,
      });
    }
    match = tokenPattern.exec(value);
  }

  return tokens;
}

export function createNarrationSceneBlockRanges(scene) {
  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = String(block?.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      ...block,
      text,
      blockIndex: index,
      startOffset,
      endOffset,
      tokens: tokenizeNarrationSpeechText(text),
    });
    offset = endOffset + (index < blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

function getTranscriptTail(tokens) {
  if (!Array.isArray(tokens) || !tokens.length) {
    return [];
  }

  return tokens.slice(-MAX_TRANSCRIPT_TAIL_WORDS);
}

function getReferenceBlockIndex(blockRanges, selection, currentFollowSelection) {
  const referenceBlockId = currentFollowSelection?.blockId || selection?.blockId || "";
  const index = blockRanges.findIndex((block) => block.blockId === referenceBlockId);
  return index >= 0 ? index : 0;
}

function getActiveFollowAnchorBlockIndex(blockRanges, currentFollowSelection) {
  const referenceBlockId = typeof currentFollowSelection?.blockId === "string"
    ? currentFollowSelection.blockId
    : "";
  if (!referenceBlockId) {
    return null;
  }

  const index = blockRanges.findIndex((block) => block.blockId === referenceBlockId);
  return index >= 0 ? index : null;
}

// Intent: once live follow has a confirmed anchor, keep recovery local so repeated later prose cannot steal the viewport.
function createActiveFollowSearchWindow(blockRanges, currentFollowSelection) {
  const anchorBlockIndex = getActiveFollowAnchorBlockIndex(blockRanges, currentFollowSelection);
  if (!Number.isInteger(anchorBlockIndex)) {
    return null;
  }

  const endBlockIndex = Math.min(
    blockRanges.length - 1,
    anchorBlockIndex + ACTIVE_FOLLOW_FORWARD_BLOCK_LIMIT,
  );
  const blockIndexes = [];
  for (let index = anchorBlockIndex; index <= endBlockIndex; index += 1) {
    blockIndexes.push(index);
  }

  return {
    anchorBlockIndex,
    anchorBlockId: blockRanges[anchorBlockIndex]?.blockId ?? "",
    startBlockIndex: anchorBlockIndex,
    endBlockIndex,
    blockIndexes,
  };
}

function normalizeNarrationViewportRange(range, textLength = 0) {
  const startOffset = Math.floor(Number(range?.startOffset));
  const endOffset = Math.floor(Number(range?.endOffset));
  const safeTextLength = Math.max(0, Math.floor(Number(textLength) || 0));
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset
  ) {
    return null;
  }

  const safeStartOffset = Math.max(0, Math.min(startOffset, safeTextLength));
  const safeEndOffset = Math.max(0, Math.min(endOffset, safeTextLength));
  if (safeEndOffset <= safeStartOffset) {
    return null;
  }

  return {
    ...range,
    startOffset: safeStartOffset,
    endOffset: safeEndOffset,
  };
}

function rangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return Math.max(leftStart, rightStart) < Math.min(leftEnd, rightEnd);
}

function doesBlockIntersectViewport(blockRange, viewportRange) {
  return Boolean(
    blockRange &&
    viewportRange &&
    rangesOverlap(blockRange.startOffset, blockRange.endOffset, viewportRange.startOffset, viewportRange.endOffset)
  );
}

function createSortedUniqueIndexes(indexes, maxLength) {
  return [...new Set(indexes
    .map((index) => Math.floor(Number(index)))
    .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength))]
    .sort((left, right) => left - right);
}

function createNarrationSearchPasses(blockRanges, viewportRange, referenceBlockIndex, activeSearchWindow = null) {
  const allBlockIndexes = blockRanges.map((blockRange) => blockRange.blockIndex);
  const allowedBlockIndexes = Array.isArray(activeSearchWindow?.blockIndexes)
    && activeSearchWindow.blockIndexes.length
    ? activeSearchWindow.blockIndexes
    : allBlockIndexes;
  const viewportBlockIndexes = viewportRange
    ? blockRanges
      .filter((blockRange) =>
        allowedBlockIndexes.includes(blockRange.blockIndex) &&
        doesBlockIntersectViewport(blockRange, viewportRange)
      )
      .map((blockRange) => blockRange.blockIndex)
    : [];
  const passes = [];

  if (viewportBlockIndexes.length) {
    passes.push({
      name: "viewport",
      blockIndexes: createSortedUniqueIndexes(viewportBlockIndexes, blockRanges.length),
      scorePenalty: 0,
    });

    const expandedIndexes = [];
    for (const blockIndex of viewportBlockIndexes) {
      for (
        let index = blockIndex - NEAR_VIEWPORT_BLOCK_RADIUS;
        index <= blockIndex + NEAR_VIEWPORT_BLOCK_RADIUS;
        index += 1
      ) {
        expandedIndexes.push(index);
      }
    }
    expandedIndexes.push(referenceBlockIndex);
    const nearIndexes = createSortedUniqueIndexes(expandedIndexes, blockRanges.length)
      .filter((index) => allowedBlockIndexes.includes(index) && !viewportBlockIndexes.includes(index));
    if (nearIndexes.length) {
      passes.push({
        name: "near-viewport",
        blockIndexes: nearIndexes,
        scorePenalty: 12,
      });
    }

    const fullSceneIndexes = createSortedUniqueIndexes(allowedBlockIndexes, blockRanges.length)
      .filter((index) => !viewportBlockIndexes.includes(index) && !nearIndexes.includes(index));
    if (fullSceneIndexes.length) {
      passes.push({
        name: activeSearchWindow ? "local-follow-recovery" : "full-scene-recovery",
        blockIndexes: fullSceneIndexes,
        scorePenalty: FULL_SCENE_VIEWPORT_PENALTY,
      });
    }
    return passes;
  }

  return [{
    name: activeSearchWindow ? "local-follow" : "full-scene",
    blockIndexes: createSortedUniqueIndexes(allowedBlockIndexes, blockRanges.length),
    scorePenalty: 0,
  }];
}

function scoreNarrationViewportFit({ blockRange, match, viewportRange }) {
  if (!blockRange || !match || !viewportRange) {
    return 0;
  }

  const firstToken = blockRange.tokens?.[match.firstMatchIndex];
  const lastToken = blockRange.tokens?.[match.lastMatchIndex];
  if (!firstToken || !lastToken) {
    return 0;
  }

  const matchStartOffset = blockRange.startOffset + firstToken.startOffset;
  const matchEndOffset = blockRange.startOffset + lastToken.endOffset;
  if (rangesOverlap(matchStartOffset, matchEndOffset, viewportRange.startOffset, viewportRange.endOffset)) {
    return 28;
  }

  const distance = matchEndOffset < viewportRange.startOffset
    ? viewportRange.startOffset - matchEndOffset
    : matchStartOffset - viewportRange.endOffset;
  return -Math.min(48, Math.max(0, distance) / 40);
}

// Intent: prefer forward live-reading progress without letting the initially armed verse force the match to its end.
function getReferenceTokenIndex(blockRange, selection, currentFollowSelection) {
  if (!blockRange || !Array.isArray(blockRange.tokens) || !blockRange.tokens.length) {
    return null;
  }

  const referenceSelection = currentFollowSelection?.blockId === blockRange.blockId
    ? currentFollowSelection
    : selection?.blockId === blockRange.blockId
      ? selection
      : null;
  if (!referenceSelection) {
    return null;
  }

  const referenceOffset = currentFollowSelection?.blockId === blockRange.blockId
    ? Number.isInteger(referenceSelection.trackingEndOffset)
      ? referenceSelection.trackingEndOffset
      : Number.isInteger(referenceSelection.endOffset)
        ? referenceSelection.endOffset
        : Number.isInteger(referenceSelection.startOffset)
          ? referenceSelection.startOffset
          : null
    : Number.isInteger(referenceSelection.startOffset)
      ? referenceSelection.startOffset
      : null;
  if (!Number.isInteger(referenceOffset)) {
    return null;
  }

  const localOffset = Math.max(0, referenceOffset - blockRange.startOffset);
  const tokenIndex = blockRange.tokens.findIndex((token) => token.endOffset >= localOffset);
  return tokenIndex >= 0 ? tokenIndex : blockRange.tokens.length - 1;
}

function createTranscriptSuffixes(tokens) {
  const tail = getTranscriptTail(tokens);
  const suffixes = [];
  const maxLength = Math.min(MAX_TRANSCRIPT_TAIL_WORDS, tail.length);
  const minLength = Math.min(maxLength, 3);

  for (let length = maxLength; length >= minLength; length -= 1) {
    suffixes.push(tail.slice(tail.length - length));
  }

  if (maxLength === 2) {
    suffixes.push(tail);
  }

  return suffixes;
}

// Intent: try the newest ASR delta first so live follow advances with the narrator before checking heavier history.
function createTranscriptSearchPlans(transcriptTokens, changedTranscriptTokens) {
  const plans = [];
  const changedTokens = Array.isArray(changedTranscriptTokens) ? changedTranscriptTokens : [];
  if (
    changedTokens.length >= MIN_RESPONSIVE_CHANGED_WORDS &&
    !doTokenSequencesMatch(changedTokens, transcriptTokens)
  ) {
    plans.push({
      name: "changed-transcript",
      tokens: changedTokens,
      suffixes: createTranscriptSuffixes(changedTokens),
    });
  }

  plans.push({
    name: "transcript-tail",
    tokens: transcriptTokens,
    suffixes: createTranscriptSuffixes(transcriptTokens),
  });

  return plans.filter((plan) => plan.suffixes.length > 0);
}

function sortCandidateStartIndexes(indexes, referenceTokenIndex = null) {
  const uniqueIndexes = [...new Set(indexes
    .map((index) => Math.floor(Number(index)))
    .filter((index) => Number.isInteger(index) && index >= 0))];
  if (Number.isInteger(referenceTokenIndex) && referenceTokenIndex > 0) {
    uniqueIndexes.sort((left, right) =>
      Math.abs(left - referenceTokenIndex) - Math.abs(right - referenceTokenIndex)
      || left - right
    );
  } else {
    uniqueIndexes.sort((left, right) => left - right);
  }
  return uniqueIndexes.slice(0, MAX_CANDIDATE_START_INDEXES).sort((left, right) => left - right);
}

function normalizeCandidateStartRange(candidateStartRange, blockTokenCount) {
  if (!candidateStartRange || !blockTokenCount) {
    return null;
  }

  const start = Math.max(0, Math.floor(Number(candidateStartRange.startIndex) || 0));
  const end = Math.min(
    blockTokenCount - 1,
    Math.floor(Number(candidateStartRange.endIndex)),
  );
  if (!Number.isInteger(end) || end < start) {
    return null;
  }

  return { startIndex: start, endIndex: end };
}

function filterCandidateStartIndexesByRange(indexes, candidateStartRange, blockTokenCount) {
  const normalizedRange = normalizeCandidateStartRange(candidateStartRange, blockTokenCount);
  if (!normalizedRange) {
    return indexes;
  }

  return indexes.filter((index) =>
    index >= normalizedRange.startIndex &&
    index <= normalizedRange.endIndex
  );
}

function getActiveFollowCandidateStartRange(blockRange, referenceBlockIndex, referenceTokenIndex, activeSearchWindow) {
  if (!activeSearchWindow || !blockRange) {
    return null;
  }

  if (blockRange.blockIndex === referenceBlockIndex && Number.isInteger(referenceTokenIndex)) {
    return {
      startIndex: referenceTokenIndex - ACTIVE_FOLLOW_BACKTRACK_TOKEN_LIMIT,
      endIndex: referenceTokenIndex + ACTIVE_FOLLOW_FORWARD_TOKEN_LIMIT,
    };
  }

  if (blockRange.blockIndex > referenceBlockIndex) {
    return {
      startIndex: 0,
      endIndex: ACTIVE_FOLLOW_NEXT_BLOCK_TOKEN_LIMIT,
    };
  }

  return null;
}

function createCandidateStartIndexes(
  suffixTokens,
  blockTokens,
  referenceTokenIndex = null,
  candidateStartRange = null,
) {
  if (!Array.isArray(suffixTokens) || !suffixTokens.length || !Array.isArray(blockTokens) || !blockTokens.length) {
    return [];
  }

  const candidates = [];
  if (Number.isInteger(referenceTokenIndex) && referenceTokenIndex > 0) {
    const start = Math.max(0, referenceTokenIndex - REFERENCE_TOKEN_SEARCH_RADIUS);
    const end = Math.min(blockTokens.length - 1, referenceTokenIndex + REFERENCE_TOKEN_SEARCH_RADIUS);
    for (let index = start; index <= end; index += 1) {
      candidates.push(index);
    }
  }

  // Intent: avoid checking every token in long paragraphs by probing likely suffix starts first.
  const probeTokenCount = Math.min(3, suffixTokens.length);
  for (let suffixIndex = 0; suffixIndex < probeTokenCount; suffixIndex += 1) {
    const suffixToken = suffixTokens[suffixIndex];
    for (let blockIndex = 0; blockIndex < blockTokens.length; blockIndex += 1) {
      const blockToken = blockTokens[blockIndex];
      if (scoreNarrationWordFit(suffixToken.normalized, blockToken.normalized) >= MIN_FUZZY_WORD_FIT) {
        candidates.push(Math.max(0, blockIndex - suffixIndex));
      }
    }
  }

  if (!candidates.length && blockTokens.length <= EXHAUSTIVE_BLOCK_TOKEN_LIMIT) {
    for (let index = 0; index < blockTokens.length; index += 1) {
      candidates.push(index);
    }
  }

  return sortCandidateStartIndexes(
    filterCandidateStartIndexesByRange(candidates, candidateStartRange, blockTokens.length),
    referenceTokenIndex,
  );
}

function matchTranscriptSuffixAgainstBlock(suffixTokens, blockTokens, startIndex) {
  const maxWindowLength = suffixTokens.length + MAX_WORD_LOOKAHEAD;
  const endIndex = Math.min(blockTokens.length, startIndex + maxWindowLength);
  let blockCursor = startIndex;
  let firstMatchIndex = -1;
  let lastMatchIndex = -1;
  let matchedWords = 0;
  let exactMatchedWords = 0;
  let fuzzyMatchedWords = 0;
  let skippedBlockWords = 0;
  let missedTranscriptWords = 0;
  let fittedWordScore = 0;

  for (const transcriptToken of suffixTokens) {
    let bestCandidate = null;
    const lookaheadEnd = Math.min(endIndex, blockCursor + MAX_WORD_LOOKAHEAD);
    for (let blockIndex = blockCursor; blockIndex < lookaheadEnd; blockIndex += 1) {
      const blockToken = blockTokens[blockIndex];
      const fitScore = scoreNarrationWordFit(transcriptToken.normalized, blockToken.normalized);
      if (fitScore < MIN_FUZZY_WORD_FIT) {
        continue;
      }

      const skippedWords = blockIndex - blockCursor;
      const score = fitScore - skippedWords * 0.08;
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          blockIndex,
          fitScore,
          score,
          skippedWords,
        };
      }
    }

    if (!bestCandidate) {
      missedTranscriptWords += 1;
      continue;
    }

    if (firstMatchIndex < 0) {
      firstMatchIndex = bestCandidate.blockIndex;
    }
    lastMatchIndex = bestCandidate.blockIndex;
    matchedWords += 1;
    fittedWordScore += bestCandidate.fitScore;
    skippedBlockWords += bestCandidate.skippedWords;
    if (bestCandidate.fitScore >= 1) {
      exactMatchedWords += 1;
    } else {
      fuzzyMatchedWords += 1;
    }
    blockCursor = bestCandidate.blockIndex + 1;
  }

  const wordFitRatio = fittedWordScore / Math.max(1, suffixTokens.length);

  return {
    matchedWords,
    exactMatchedWords,
    fuzzyMatchedWords,
    firstMatchIndex,
    lastMatchIndex,
    skippedBlockWords,
    missedTranscriptWords,
    fittedWordScore,
    wordFitRatio,
  };
}

// Intent: ignore single-word interim ASR fragments so a stray "I" cannot lock follow mode to the wrong span.
function hasEnoughMatch(match, suffixLength) {
  if (!match || match.matchedWords <= 0) {
    return false;
  }

  const ratio = match.matchedWords / suffixLength;
  const missedRatio = match.missedTranscriptWords / Math.max(1, suffixLength);
  if (suffixLength < MIN_CONFIDENT_WORDS) {
    return false;
  }

  if (suffixLength === MIN_CONFIDENT_WORDS) {
    return match.matchedWords === suffixLength && match.wordFitRatio >= 0.9;
  }

  return match.matchedWords >= MIN_CONFIDENT_WORDS
    && ratio >= 0.5
    && match.wordFitRatio >= 0.55
    && missedRatio <= 0.45
    && (match.exactMatchedWords > 0 || match.wordFitRatio >= 0.68);
}

function scoreNarrationMatch(match, suffixLength, blockIndex, referenceBlockIndex, referenceTokenIndex = null) {
  const ratio = match.matchedWords / Math.max(1, suffixLength);
  const exactRatio = match.exactMatchedWords / Math.max(1, suffixLength);
  const blockDistance = Math.abs(blockIndex - referenceBlockIndex);
  const skipPenalty = match.skippedBlockWords * 2;
  const missedPenalty = match.missedTranscriptWords * 5;
  const distancePenalty = blockDistance * 4;
  const tokenDistancePenalty = Number.isInteger(referenceTokenIndex)
    ? match.firstMatchIndex < referenceTokenIndex
      ? (referenceTokenIndex - match.firstMatchIndex) * 3.2
      : Math.min(match.firstMatchIndex - referenceTokenIndex, 24) * 0.12
    : 0;
  const forwardProgressBonus = Number.isInteger(referenceTokenIndex)
    && blockIndex === referenceBlockIndex
    && match.firstMatchIndex >= referenceTokenIndex
    ? 4
    : 0;
  const exactBonus = match.matchedWords === suffixLength && match.skippedBlockWords === 0 ? 18 : 0;
  const fuzzyBonus = match.fuzzyMatchedWords * 1.5;
  return match.wordFitRatio * 110
    + ratio * 24
    + exactRatio * 12
    + match.matchedWords * 3
    + exactBonus
    + fuzzyBonus
    + forwardProgressBonus
    - skipPenalty
    - missedPenalty
    - distancePenalty
    - tokenDistancePenalty;
}

function createSelectionFromMatch({
  projectId,
  scene,
  selection,
  blockRange,
  match,
  suffixLength,
  score,
}) {
  const firstToken = blockRange.tokens[match.firstMatchIndex];
  const lastToken = blockRange.tokens[match.lastMatchIndex];
  if (!firstToken || !lastToken) {
    return null;
  }

  const trackingStartOffset = blockRange.startOffset + firstToken.startOffset;
  const startOffset = blockRange.startOffset + resolveInitialFollowCoverageLocalStartOffset(
    blockRange,
    firstToken.startOffset,
  );
  const endOffset = blockRange.startOffset + lastToken.endOffset;
  const matchedText = String(scene?.editorText ?? "").slice(startOffset, endOffset)
    || blockRange.text.slice(Math.max(0, startOffset - blockRange.startOffset), lastToken.endOffset);
  const coverageRatio = match.matchedWords / Math.max(1, suffixLength);
  const exactRatio = match.exactMatchedWords / Math.max(1, suffixLength);
  const confidence = Math.max(0, Math.min(1, (
    match.wordFitRatio * 0.68
    + coverageRatio * 0.2
    + exactRatio * 0.08
    + (score > 110 ? 0.04 : score > 80 ? 0.02 : 0)
  )));

  return {
    id: `narration-follow:${scene?.sceneId ?? ""}:${blockRange.blockId}:${startOffset}:${endOffset}`,
    projectId: selection?.projectId || projectId || "",
    chapterId: scene?.chapterId ?? selection?.chapterId ?? "",
    chapterTitle: scene?.chapterTitle ?? selection?.chapterTitle ?? "",
    sceneId: scene?.sceneId ?? selection?.sceneId ?? "",
    sceneTitle: scene?.sceneTitle ?? selection?.sceneTitle ?? "",
    blockId: blockRange.blockId,
    paragraphId: blockRange.paragraphId,
    lineNumber: blockRange.lineNumber ?? 0,
    kind: blockRange.kind,
    kindLabel: blockRange.kind === "dialogue" ? "Dialogue" : "Narration",
    selectedText: matchedText,
    verseText: matchedText,
    startOffset,
    endOffset,
    blockStartOffset: blockRange.startOffset,
    blockEndOffset: blockRange.endOffset,
    blockLocalStartOffset: Math.max(0, startOffset - blockRange.startOffset),
    blockLocalEndOffset: lastToken.endOffset,
    trackingStartOffset,
    trackingEndOffset: endOffset,
    confidence,
    matchedWordCount: match.matchedWords,
    exactMatchedWordCount: match.exactMatchedWords,
    fuzzyMatchedWordCount: match.fuzzyMatchedWords,
    missedTranscriptWordCount: match.missedTranscriptWords,
    wordFitRatio: match.wordFitRatio,
  };
}

// Intent: keep saved/live take coverage from dropping a short paragraph-leading word missed by ASR startup.
function resolveInitialFollowCoverageLocalStartOffset(blockRange, localStartOffset) {
  const startOffset = Number(localStartOffset);
  if (!Number.isInteger(startOffset) || startOffset <= 0) {
    return 0;
  }
  if (startOffset > MAX_INITIAL_FOLLOW_PREFIX_CHARACTERS) {
    return startOffset;
  }

  const prefix = String(blockRange?.text ?? "").slice(0, startOffset);
  if (!isExpandableInitialFollowPrefix(prefix)) {
    return startOffset;
  }

  return 0;
}

function isExpandableInitialFollowPrefix(value) {
  const prefix = String(value ?? "");
  const trimmed = prefix.trim();
  if (!trimmed || trimmed.length > MAX_INITIAL_FOLLOW_PREFIX_CHARACTERS) {
    return false;
  }
  if (/[.!?。！？]\s*$/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_INITIAL_FOLLOW_PREFIX_WORDS;
}

function formatNarrationFollowStatus(selection) {
  if (!selection) {
    return "Speech tracker listening";
  }

  const confidenceLabel = `${Math.round((selection.confidence ?? 0) * 100)}%`;
  const lineLabel = selection.lineNumber ? `line ${selection.lineNumber}` : "current verse";
  return selection.confidence >= 0.7
    ? `Tracking ${lineLabel} · ${confidenceLabel}`
    : `Recovering near ${lineLabel} · ${confidenceLabel}`;
}

function formatNarrationFollowRecoveryStatus(selection) {
  if (!selection) {
    return "Speech tracker recovering";
  }

  const lineLabel = selection.lineNumber ? `line ${selection.lineNumber}` : "current verse";
  return `Speech tracker recovering near ${lineLabel}`;
}

function resolveSelectionProgressEndOffset(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  for (const key of ["trackingEndOffset", "endOffset", "startOffset"]) {
    const offset = selection[key];
    if (Number.isInteger(offset) && offset >= 0) {
      return offset;
    }
  }

  return null;
}

function resolveFollowSelectionSpanLength(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const startOffset = Number.isInteger(selection.startOffset)
    ? selection.startOffset
    : selection.trackingStartOffset;
  const endOffset = Number.isInteger(selection.endOffset)
    ? selection.endOffset
    : selection.trackingEndOffset;
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    endOffset < startOffset
  ) {
    return null;
  }

  return endOffset - startOffset;
}

// Intent: let a real phrase recover from an earlier one-character interim match instead of searching only around it.
function isUnstableShortFollowSelection(selection) {
  const spanLength = resolveFollowSelectionSpanLength(selection);
  if (!Number.isInteger(spanLength) || spanLength > 2) {
    return false;
  }

  const matchedWordCount = Number(selection?.matchedWordCount);
  return !Number.isFinite(matchedWordCount) || matchedWordCount <= 1;
}

function isSameFollowAnchorBlock(left, right) {
  return Boolean(
    left &&
    right &&
    typeof left.sceneId === "string" &&
    left.sceneId === right.sceneId &&
    typeof left.blockId === "string" &&
    left.blockId === right.blockId
  );
}

function isNextBlockTransitionStrong(match) {
  const matchedWords = Number(match?.matchedWords) || 0;
  const exactMatchedWords = Number(match?.exactMatchedWords) || 0;
  const wordFitRatio = Number(match?.wordFitRatio) || 0;
  return matchedWords >= MIN_NEXT_BLOCK_TRANSITION_WORDS &&
    wordFitRatio >= MIN_NEXT_BLOCK_TRANSITION_WORD_FIT &&
    (exactMatchedWords >= MIN_NEXT_BLOCK_TRANSITION_EXACT_WORDS || wordFitRatio >= 0.88);
}

// Intent: treat weak or backward live matches as recovery evidence instead of letting them move the cursor.
function evaluateNarrationFollowCandidate({
  currentFollowSelection = null,
  candidateSelection = null,
  candidateMatch = null,
  blockRange = null,
  referenceBlockIndex = 0,
} = {}) {
  if (!candidateSelection) {
    return {
      accepted: false,
      reason: "missing-selection",
    };
  }

  const confidence = Number(candidateSelection.confidence);
  if (!Number.isFinite(confidence) || confidence < MIN_STABLE_FOLLOW_CONFIDENCE) {
    return {
      accepted: false,
      reason: "low-confidence",
    };
  }

  if (
    isSameFollowAnchorBlock(currentFollowSelection, candidateSelection)
  ) {
    const currentProgressEndOffset = resolveSelectionProgressEndOffset(currentFollowSelection);
    const candidateProgressEndOffset = resolveSelectionProgressEndOffset(candidateSelection);
    if (
      Number.isInteger(currentProgressEndOffset) &&
      Number.isInteger(candidateProgressEndOffset) &&
      candidateProgressEndOffset + ACTIVE_FOLLOW_BACKWARD_OFFSET_TOLERANCE < currentProgressEndOffset
    ) {
      return {
        accepted: false,
        reason: "behind-current-anchor",
      };
    }
  }

  if (
    currentFollowSelection &&
    Number.isInteger(blockRange?.blockIndex) &&
    blockRange.blockIndex > referenceBlockIndex &&
    !isNextBlockTransitionStrong(candidateMatch)
  ) {
    return {
      accepted: false,
      reason: "weak-next-block-transition",
    };
  }

  return {
    accepted: true,
    reason: "stable",
  };
}

function chooseRejectedNarrationFollowCandidate(current, candidate) {
  if (!candidate) {
    return current ?? null;
  }

  if (!current) {
    return candidate;
  }

  return candidate.score > current.score ? candidate : current;
}

function createRejectedNarrationFollowSummary(candidate) {
  if (!candidate) {
    return null;
  }

  return {
    reason: candidate.acceptance?.reason ?? "rejected",
    searchPass: candidate.searchPassName,
    blockId: candidate.blockRange?.blockId ?? "",
    lineNumber: candidate.followSelection?.lineNumber ?? candidate.blockRange?.lineNumber ?? null,
    startOffset: candidate.followSelection?.startOffset ?? null,
    endOffset: candidate.followSelection?.endOffset ?? null,
    confidence: candidate.followSelection?.confidence ?? null,
    score: candidate.score ?? null,
    matchedWordCount: candidate.match?.matchedWords ?? null,
    exactMatchedWordCount: candidate.match?.exactMatchedWords ?? null,
    fuzzyMatchedWordCount: candidate.match?.fuzzyMatchedWords ?? null,
    missedTranscriptWordCount: candidate.match?.missedTranscriptWords ?? null,
    wordFitRatio: candidate.match?.wordFitRatio ?? null,
  };
}

export function alignNarrationTranscriptToScene({
  transcript = "",
  changedTranscript = "",
  scene = null,
  selection = null,
  currentFollowSelection = null,
  viewportRange = null,
  projectId = "",
  logger = null,
  blockRanges = null,
  blockRangeCacheHit = false,
} = {}) {
  const startedAtMs = readHighResolutionTimeMs();
  const transcriptTokens = tokenizeNarrationSpeechText(transcript);
  const changedTranscriptTokens = tokenizeNarrationSpeechText(changedTranscript);
  if (!transcriptTokens.length || !scene) {
    emitNarrationFollowDebug(
      logger,
      "narration-follow.align-skipped",
      "Skipped narration follow alignment without transcript tokens or a scene.",
      {
        hasScene: Boolean(scene),
        sceneId: scene?.sceneId ?? selection?.sceneId ?? currentFollowSelection?.sceneId ?? "",
        transcriptLength: String(transcript ?? "").length,
        changedTranscriptLength: String(changedTranscript ?? "").length,
        currentBlockId: currentFollowSelection?.blockId ?? selection?.blockId ?? "",
        alignmentDurationMs: roundDurationMs(readHighResolutionTimeMs() - startedAtMs),
      },
    );
    return {
      status: "listening",
      trackerStatus: "Speech tracker listening",
      transcriptTokens,
      followSelection: currentFollowSelection ?? null,
      match: null,
    };
  }

  const effectiveCurrentFollowSelection = isUnstableShortFollowSelection(currentFollowSelection)
    ? null
    : currentFollowSelection;
  const activeBlockRanges = Array.isArray(blockRanges) && blockRanges.length
    ? blockRanges
    : createNarrationSceneBlockRanges(scene);
  const normalizedViewportRange = normalizeNarrationViewportRange(viewportRange, String(scene?.editorText ?? "").length);
  const referenceBlockIndex = getReferenceBlockIndex(activeBlockRanges, selection, effectiveCurrentFollowSelection);
  const transcriptSearchPlans = createTranscriptSearchPlans(transcriptTokens, changedTranscriptTokens);
  const activeSearchWindow = createActiveFollowSearchWindow(activeBlockRanges, effectiveCurrentFollowSelection);
  const searchPasses = createNarrationSearchPasses(
    activeBlockRanges,
    normalizedViewportRange,
    referenceBlockIndex,
    activeSearchWindow,
  );
  let best = null;
  let rejectedBest = null;
  let searchedBlockCount = 0;
  let searchedCandidateStartCount = 0;
  let evaluatedMatchCount = 0;

  for (const transcriptPlan of transcriptSearchPlans) {
    for (const searchPass of searchPasses) {
      let passBest = null;
      for (const blockIndex of searchPass.blockIndexes) {
        const blockRange = activeBlockRanges[blockIndex];
        if (!blockRange?.tokens?.length) {
          continue;
        }
        searchedBlockCount += 1;

        const referenceTokenIndex = blockRange.blockIndex === referenceBlockIndex
          ? getReferenceTokenIndex(blockRange, selection, effectiveCurrentFollowSelection)
          : null;
        const candidateStartRange = getActiveFollowCandidateStartRange(
          blockRange,
          referenceBlockIndex,
          referenceTokenIndex,
          activeSearchWindow,
        );

        for (const suffix of transcriptPlan.suffixes) {
          const candidateStartIndexes = createCandidateStartIndexes(
            suffix,
            blockRange.tokens,
            referenceTokenIndex,
            candidateStartRange,
          );
          searchedCandidateStartCount += candidateStartIndexes.length;
          for (const startIndex of candidateStartIndexes) {
            const match = matchTranscriptSuffixAgainstBlock(suffix, blockRange.tokens, startIndex);
            evaluatedMatchCount += 1;
            if (!hasEnoughMatch(match, suffix.length)) {
              continue;
            }

            const score = scoreNarrationMatch(
              match,
              suffix.length,
              blockRange.blockIndex,
              referenceBlockIndex,
              referenceTokenIndex,
            )
              + scoreNarrationViewportFit({ blockRange, match, viewportRange: normalizedViewportRange })
              - searchPass.scorePenalty;
            if (!passBest || score > passBest.score) {
              passBest = {
                blockRange,
                match,
                suffixLength: suffix.length,
                score,
                referenceTokenIndex,
                searchPassName: searchPass.name,
                searchBlockCount: searchPass.blockIndexes.length,
                transcriptSource: transcriptPlan.name,
              };
            }
          }
        }
      }

      if (passBest) {
        const candidateSelection = createSelectionFromMatch({
          projectId,
          scene,
          selection,
          blockRange: passBest.blockRange,
          match: passBest.match,
          suffixLength: passBest.suffixLength,
          score: passBest.score,
        });
        const acceptance = evaluateNarrationFollowCandidate({
          currentFollowSelection: effectiveCurrentFollowSelection,
          candidateSelection,
          candidateMatch: passBest.match,
          blockRange: passBest.blockRange,
          referenceBlockIndex,
        });
        const evaluatedPassBest = {
          ...passBest,
          followSelection: candidateSelection,
          acceptance,
        };
        if (acceptance.accepted) {
          best = evaluatedPassBest;
          break;
        }

        rejectedBest = chooseRejectedNarrationFollowCandidate(rejectedBest, evaluatedPassBest);
      }
    }

    if (best) {
      break;
    }
  }

  const followSelection = best?.followSelection ?? effectiveCurrentFollowSelection ?? null;

  const result = {
    status: best ? "tracking" : "recovering",
    trackerStatus: best ? formatNarrationFollowStatus(followSelection) : formatNarrationFollowRecoveryStatus(followSelection),
    transcriptTokens,
    followSelection,
    match: best
      ? {
        blockId: best.blockRange.blockId,
        lineNumber: best.blockRange.lineNumber ?? 0,
        confidence: followSelection?.confidence ?? 0,
        searchPass: best.searchPassName,
        transcriptSource: best.transcriptSource,
        matchedWordCount: best.match.matchedWords,
        exactMatchedWordCount: best.match.exactMatchedWords,
        fuzzyMatchedWordCount: best.match.fuzzyMatchedWords,
        missedTranscriptWordCount: best.match.missedTranscriptWords,
        wordFitRatio: best.match.wordFitRatio,
      }
      : null,
  };

  emitNarrationFollowDebug(
    logger,
    "narration-follow.align-result",
    best
      ? "Resolved narration follow transcript to a manuscript span."
      : "Narration follow transcript did not produce a fresh match.",
    {
      status: best ? "tracking" : "recovering",
      sceneId: scene?.sceneId ?? selection?.sceneId ?? "",
      transcriptTokenCount: transcriptTokens.length,
      changedTranscriptTokenCount: changedTranscriptTokens.length,
      transcriptTail: createTranscriptTailSummary(transcriptTokens),
      changedTranscriptTail: createTranscriptTailSummary(changedTranscriptTokens),
      transcriptSearchPlans: transcriptSearchPlans.map((plan) => ({
        name: plan.name,
        tokenCount: plan.tokens.length,
        suffixCount: plan.suffixes.length,
      })),
      referenceBlockIndex,
      referenceBlockId: activeBlockRanges[referenceBlockIndex]?.blockId ?? "",
      viewportRange: normalizedViewportRange
        ? {
          startOffset: normalizedViewportRange.startOffset,
          endOffset: normalizedViewportRange.endOffset,
          firstVisibleLine: normalizedViewportRange.firstVisibleLine ?? null,
          lastVisibleLine: normalizedViewportRange.lastVisibleLine ?? null,
        }
        : null,
      searchPasses: searchPasses.map((searchPass) => ({
        name: searchPass.name,
        blockCount: searchPass.blockIndexes.length,
      })),
      activeSearchWindow: activeSearchWindow
        ? {
          anchorBlockId: activeSearchWindow.anchorBlockId,
          anchorBlockIndex: activeSearchWindow.anchorBlockIndex,
          startBlockIndex: activeSearchWindow.startBlockIndex,
          endBlockIndex: activeSearchWindow.endBlockIndex,
          blockIds: activeSearchWindow.blockIndexes
            .map((index) => activeBlockRanges[index]?.blockId ?? "")
            .filter(Boolean),
        }
        : null,
      unstableShortAnchorIgnored: Boolean(currentFollowSelection && !effectiveCurrentFollowSelection),
      rejectedCandidate: createRejectedNarrationFollowSummary(rejectedBest),
      searchedBlockCount,
      searchedCandidateStartCount,
      evaluatedMatchCount,
      blockRangeCacheHit: blockRangeCacheHit === true,
      alignmentDurationMs: roundDurationMs(readHighResolutionTimeMs() - startedAtMs),
      matchedSearchPass: best?.searchPassName ?? null,
      matchedTranscriptSource: best?.transcriptSource ?? null,
      matchedSearchBlockCount: best?.searchBlockCount ?? null,
      matchedBlockId: best?.blockRange?.blockId ?? followSelection?.blockId ?? "",
      matchedLineNumber: followSelection?.lineNumber ?? null,
      startOffset: followSelection?.startOffset ?? null,
      endOffset: followSelection?.endOffset ?? null,
      trackingStartOffset: followSelection?.trackingStartOffset ?? followSelection?.startOffset ?? null,
      trackingEndOffset: followSelection?.trackingEndOffset ?? followSelection?.endOffset ?? null,
      confidence: followSelection?.confidence ?? null,
      score: best?.score ?? null,
      referenceTokenIndex: best?.referenceTokenIndex ?? null,
      matchedWordCount: best?.match?.matchedWords ?? null,
      exactMatchedWordCount: best?.match?.exactMatchedWords ?? null,
      fuzzyMatchedWordCount: best?.match?.fuzzyMatchedWords ?? null,
      missedTranscriptWordCount: best?.match?.missedTranscriptWords ?? null,
      skippedBlockWords: best?.match?.skippedBlockWords ?? null,
      wordFitRatio: best?.match?.wordFitRatio ?? null,
    },
  );

  return result;
}

export function createNarrationFollowAlignmentService({
  getScene = () => null,
  getProjectId = () => "",
  logger = null,
} = {}) {
  const blockRangeCache = new Map();

  function getCachedBlockRanges(scene) {
    const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId : "";
    if (!sceneId) {
      return {
        blockRanges: createNarrationSceneBlockRanges(scene),
        cacheHit: false,
      };
    }

    const cached = blockRangeCache.get(sceneId);
    if (
      cached &&
      cached.scene === scene &&
      cached.editorText === scene.editorText &&
      cached.blocks === scene.blocks
    ) {
      return {
        blockRanges: cached.blockRanges,
        cacheHit: true,
      };
    }

    const blockRanges = createNarrationSceneBlockRanges(scene);
    blockRangeCache.set(sceneId, {
      scene,
      editorText: scene?.editorText,
      blocks: scene?.blocks,
      blockRanges,
    });
    if (blockRangeCache.size > 8) {
      const oldestKey = blockRangeCache.keys().next().value;
      blockRangeCache.delete(oldestKey);
    }
    return {
      blockRanges,
      cacheHit: false,
    };
  }

  return {
    alignTranscript({ transcript = "", changedTranscript = "", runtime = null, selection = null, viewportRange = null } = {}) {
      const activeSelection = selection ?? runtime?.selection ?? null;
      const scene = getScene(activeSelection?.sceneId ?? "");
      const cachedBlockRanges = scene
        ? getCachedBlockRanges(scene)
        : { blockRanges: null, cacheHit: false };
      return alignNarrationTranscriptToScene({
        transcript,
        changedTranscript,
        scene,
        selection: activeSelection,
        currentFollowSelection: runtime?.followSelection ?? null,
        viewportRange,
        projectId: activeSelection?.projectId || getProjectId() || "",
        logger,
        blockRanges: cachedBlockRanges.blockRanges,
        blockRangeCacheHit: cachedBlockRanges.cacheHit,
      });
    },
  };
}
