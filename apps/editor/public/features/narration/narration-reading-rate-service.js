// Intent: derive narration-follow scroll pace from manuscript word progress and visible line density.

const DEFAULT_SAMPLE_WINDOW_MS = 3000;
const DEFAULT_WORDS_PER_MINUTE = 155;
const MIN_WORDS_PER_MINUTE = 40;
const MAX_WORDS_PER_MINUTE = 320;
const MIN_LINES_PER_MINUTE = 4;
const MAX_LINES_PER_MINUTE = 72;
const DEFAULT_AVERAGE_WORDS_PER_LINE = 11;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.max(min, Math.min(max, number));
}

function normalizePositiveInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function emitNarrationRateDebug(logger, event, message, context = {}) {
  if (
    !logger ||
    typeof logger.debug !== "function" ||
    (typeof logger.isEnabled === "function" && !logger.isEnabled())
  ) {
    return;
  }

  logger.debug("reading-rate", event, message, context);
}

export function countNarrationWordsBeforeOffset(text = "", offset = 0) {
  const value = String(text ?? "");
  const safeOffset = Math.max(0, Math.min(value.length, Math.floor(Number(offset) || 0)));
  const beforeCursor = value.slice(0, safeOffset);
  return Array.from(beforeCursor.matchAll(WORD_PATTERN)).length;
}

export function countNarrationWords(text = "") {
  return Array.from(String(text ?? "").matchAll(WORD_PATTERN)).length;
}

export function estimateNarrationAverageWordsPerVisualLine({
  text = "",
  visualLineCount = 0,
  fallbackWordsPerLine = DEFAULT_AVERAGE_WORDS_PER_LINE,
} = {}) {
  const words = countNarrationWords(text);
  const lines = normalizePositiveInteger(visualLineCount, 0);
  if (!words || !lines) {
    return clampNumber(fallbackWordsPerLine, 1, 40);
  }

  return clampNumber(words / lines, 1, 40);
}

export function createNarrationReadingRateTracker({
  sampleWindowMs = DEFAULT_SAMPLE_WINDOW_MS,
  defaultWordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
  minWordsPerMinute = MIN_WORDS_PER_MINUTE,
  maxWordsPerMinute = MAX_WORDS_PER_MINUTE,
  minLinesPerMinute = MIN_LINES_PER_MINUTE,
  maxLinesPerMinute = MAX_LINES_PER_MINUTE,
  smoothingRatio = 0.35,
  logger = null,
} = {}) {
  let state = null;

  function reset() {
    state = null;
  }

  // Intent: sample committed manuscript word progress on a stable window so scroll pace follows the narrator.
  function update({
    sceneId = "",
    wordIndex = 0,
    averageWordsPerLine = DEFAULT_AVERAGE_WORDS_PER_LINE,
    nowMs = Date.now(),
  } = {}) {
    const safeSceneId = typeof sceneId === "string" ? sceneId : "";
    const safeWordIndex = Math.max(0, Math.floor(Number(wordIndex) || 0));
    const safeAverageWordsPerLine = clampNumber(averageWordsPerLine, 1, 40);
    const safeNowMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const safeSampleWindowMs = Math.max(500, Number(sampleWindowMs) || DEFAULT_SAMPLE_WINDOW_MS);
    const safeSmoothingRatio = clampNumber(smoothingRatio, 0, 1);
    const configuredDefaultWpm = clampNumber(defaultWordsPerMinute, minWordsPerMinute, maxWordsPerMinute);

    if (!state || state.sceneId !== safeSceneId) {
      state = {
        sceneId: safeSceneId,
        lastSampleAtMs: safeNowMs,
        lastWordIndex: safeWordIndex,
        wordsPerMinute: configuredDefaultWpm,
        observedWordsPerMinute: null,
      };
    }

    const elapsedMs = Math.max(0, safeNowMs - state.lastSampleAtMs);
    const wordDelta = safeWordIndex - state.lastWordIndex;
    let rateSource = "default";

    if (elapsedMs >= safeSampleWindowMs && wordDelta > 0) {
      const observedWordsPerMinute = clampNumber(
        wordDelta / (elapsedMs / 60000),
        minWordsPerMinute,
        maxWordsPerMinute,
      );
      state.wordsPerMinute = clampNumber(
        state.wordsPerMinute * (1 - safeSmoothingRatio) + observedWordsPerMinute * safeSmoothingRatio,
        minWordsPerMinute,
        maxWordsPerMinute,
      );
      state.observedWordsPerMinute = observedWordsPerMinute;
      state.lastSampleAtMs = safeNowMs;
      state.lastWordIndex = safeWordIndex;
      rateSource = "sampled";
    } else if (wordDelta < 0 || elapsedMs >= safeSampleWindowMs * 2) {
      state.lastSampleAtMs = safeNowMs;
      state.lastWordIndex = safeWordIndex;
      state.observedWordsPerMinute = null;
      rateSource = wordDelta < 0 ? "rewound" : "stale";
    }

    const linesPerMinute = clampNumber(
      state.wordsPerMinute / safeAverageWordsPerLine,
      minLinesPerMinute,
      maxLinesPerMinute,
    );
    const result = {
      sceneId: safeSceneId,
      wordIndex: safeWordIndex,
      wordsPerMinute: state.wordsPerMinute,
      observedWordsPerMinute: state.observedWordsPerMinute,
      averageWordsPerLine: safeAverageWordsPerLine,
      linesPerMinute,
      elapsedMs,
      wordDelta,
      rateSource,
    };

    emitNarrationRateDebug(
      logger,
      "narration-follow.reading-rate",
      "Updated narration follow reading-rate estimate.",
      result,
    );
    return result;
  }

  return {
    reset,
    update,
  };
}
