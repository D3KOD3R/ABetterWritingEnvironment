// Intent: pace narration-follow scrolling from spoken-line progress instead of recentering every transcript event.

const DEFAULT_LINES_PER_MINUTE = 14;
const MIN_LINES_PER_MINUTE = 4;
const MAX_LINES_PER_MINUTE = 72;
const FAR_DISTANCE_LINE_THRESHOLD = 3;
const FAR_DISTANCE_CATCH_UP_RATIO = 0.36;
const MAX_SCROLL_STEP_LINES = 4;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.max(min, Math.min(max, number));
}

// Intent: keep viewport trace volume opt-in through the shared Developer Logs source gates.
function shouldEmitDebugLog(logger) {
  return logger
    && typeof logger.debug === "function"
    && (typeof logger.isEnabled !== "function" || logger.isEnabled());
}

function emitNarrationViewportDebug(logger, event, message, context = {}) {
  if (!shouldEmitDebugLog(logger)) {
    return;
  }

  logger.debug("viewport", event, message, context);
}

export function createNarrationViewportTracker({
  defaultLinesPerMinute = DEFAULT_LINES_PER_MINUTE,
  minLinesPerMinute = MIN_LINES_PER_MINUTE,
  maxLinesPerMinute = MAX_LINES_PER_MINUTE,
  catchUpMultiplier = 2.2,
  farDistanceLineThreshold = FAR_DISTANCE_LINE_THRESHOLD,
  farDistanceCatchUpRatio = FAR_DISTANCE_CATCH_UP_RATIO,
  maxScrollStepLines = MAX_SCROLL_STEP_LINES,
  allowBackwardScroll = false,
  logger = null,
} = {}) {
  let state = null;

  function reset() {
    state = null;
  }

  function planScroll({
    sceneId = "",
    matchedLineIndex = 0,
    currentScrollTop = 0,
    targetScrollTop = 0,
    viewportCenterLineIndex = null,
    lineHeight = 1,
    readingRateLinesPerMinute = null,
    readingRateContext = null,
    allowBackwardScroll: allowBackwardScrollForPlan = allowBackwardScroll,
    nowMs = Date.now(),
  } = {}) {
    const safeSceneId = typeof sceneId === "string" ? sceneId : "";
    const safeLineIndex = Math.max(0, Math.round(Number(matchedLineIndex) || 0));
    const safeLineHeight = Math.max(1, Number(lineHeight) || 1);
    const safeCurrentTop = Math.max(0, Number(currentScrollTop) || 0);
    const safeTargetTop = Math.max(0, Number(targetScrollTop) || 0);
    const safeViewportCenterLineIndex = Number.isFinite(Number(viewportCenterLineIndex))
      ? Math.max(0, Number(viewportCenterLineIndex))
      : null;
    const safeNowMs = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const configuredDefaultPace = clampNumber(defaultLinesPerMinute, minLinesPerMinute, maxLinesPerMinute);

    if (!state || state.sceneId !== safeSceneId) {
      state = {
        sceneId: safeSceneId,
        lastLineIndex: safeLineIndex,
        lastLineAtMs: safeNowMs,
        lastScrollAtMs: safeNowMs,
        linesPerMinute: configuredDefaultPace,
      };
    }

    const externalLinesPerMinute = Number(readingRateLinesPerMinute);
    const hasExternalReadingRate = Number.isFinite(externalLinesPerMinute) && externalLinesPerMinute > 0;
    if (hasExternalReadingRate) {
      state.linesPerMinute = clampNumber(externalLinesPerMinute, minLinesPerMinute, maxLinesPerMinute);
    }

    const lineDelta = safeLineIndex - state.lastLineIndex;
    const elapsedLineMs = Math.max(1, safeNowMs - state.lastLineAtMs);
    if (lineDelta < 0 && allowBackwardScrollForPlan !== true) {
      const blockedPlan = {
        shouldScroll: false,
        scrollTop: safeCurrentTop,
        targetScrollTop: safeTargetTop,
        currentScrollTop: safeCurrentTop,
        scrollDelta: 0,
        distance: safeTargetTop - safeCurrentTop,
        direction: "backward-blocked",
        linesPerMinute: state.linesPerMinute,
        lastLineIndex: state.lastLineIndex,
        matchedLineIndex: safeLineIndex,
      };
      emitNarrationViewportDebug(
        logger,
        "narration-follow.viewport-backward-blocked",
        "Skipped narration follow viewport movement because the live match moved backward.",
        {
          sceneId: safeSceneId,
          matchedLineIndex: safeLineIndex,
          lastLineIndex: state.lastLineIndex,
          currentScrollTop: safeCurrentTop,
          targetScrollTop: safeTargetTop,
          lineHeight: safeLineHeight,
          readingRateContext,
        },
      );
      return blockedPlan;
    }

    if (!hasExternalReadingRate && lineDelta > 0 && elapsedLineMs >= 250) {
      const observedLinesPerMinute = clampNumber(
        lineDelta / (elapsedLineMs / 60000),
        minLinesPerMinute,
        maxLinesPerMinute,
      );
      state.linesPerMinute = clampNumber(
        state.linesPerMinute * 0.7 + observedLinesPerMinute * 0.3,
        minLinesPerMinute,
        maxLinesPerMinute,
      );
      state.lastLineIndex = safeLineIndex;
      state.lastLineAtMs = safeNowMs;
    } else if (lineDelta >= 0) {
      state.lastLineIndex = Math.max(state.lastLineIndex, safeLineIndex);
    } else {
      state.lastLineIndex = safeLineIndex;
      state.lastLineAtMs = safeNowMs;
    }

    // Intent: hold early-page narration scrolling until the reader reaches the viewport center line.
    if (
      safeViewportCenterLineIndex !== null &&
      safeTargetTop > safeCurrentTop &&
      safeLineIndex < safeViewportCenterLineIndex
    ) {
      const centerWaitPlan = {
        shouldScroll: false,
        scrollTop: safeCurrentTop,
        targetScrollTop: safeTargetTop,
        currentScrollTop: safeCurrentTop,
        scrollDelta: 0,
        distance: safeTargetTop - safeCurrentTop,
        direction: "center-wait",
        linesPerMinute: state.linesPerMinute,
        viewportCenterLineIndex: safeViewportCenterLineIndex,
        matchedLineIndex: safeLineIndex,
      };
      emitNarrationViewportDebug(
        logger,
        "narration-follow.viewport-center-wait",
        "Skipped narration follow viewport movement because the live match has not reached the viewport center line.",
        {
          sceneId: safeSceneId,
          matchedLineIndex: safeLineIndex,
          viewportCenterLineIndex: safeViewportCenterLineIndex,
          currentScrollTop: safeCurrentTop,
          targetScrollTop: safeTargetTop,
          lineHeight: safeLineHeight,
          linesPerMinute: state.linesPerMinute,
          readingRateContext,
        },
      );
      return centerWaitPlan;
    }

    const remainingDistance = safeTargetTop - safeCurrentTop;
    const distanceMagnitude = Math.abs(remainingDistance);
    if (distanceMagnitude <= safeLineHeight * 0.35) {
      state.lastScrollAtMs = safeNowMs;
      const settledPlan = {
        shouldScroll: false,
        scrollTop: safeCurrentTop,
        targetScrollTop: safeTargetTop,
        currentScrollTop: safeCurrentTop,
        scrollDelta: 0,
        distance: remainingDistance,
        direction: "settled",
        linesPerMinute: state.linesPerMinute,
      };
      emitNarrationViewportDebug(
        logger,
        "narration-follow.viewport-settled",
        "Narration viewport target is already within the center tolerance.",
        {
          sceneId: safeSceneId,
          matchedLineIndex: safeLineIndex,
          currentScrollTop: safeCurrentTop,
          targetScrollTop: safeTargetTop,
          distance: remainingDistance,
          lineHeight: safeLineHeight,
          linesPerMinute: state.linesPerMinute,
          readingRateContext,
        },
      );
      return settledPlan;
    }

    const elapsedScrollMs = Math.max(100, safeNowMs - state.lastScrollAtMs);
    const pacedLines = (state.linesPerMinute / 60000) * elapsedScrollMs;
    const farDistanceStep = distanceMagnitude > safeLineHeight * farDistanceLineThreshold
      ? distanceMagnitude * clampNumber(farDistanceCatchUpRatio, 0.05, 1)
      : 0;
    const maxStep = Math.max(
      safeLineHeight * 0.75,
      pacedLines * safeLineHeight * catchUpMultiplier,
      farDistanceStep,
    );
    const cappedMaxStep = Math.min(
      maxStep,
      safeLineHeight * clampNumber(maxScrollStepLines, 1, 12),
    );
    const scrollDirection = remainingDistance > 0 ? 1 : -1;
    const scrollDelta = scrollDirection * Math.min(distanceMagnitude, cappedMaxStep);
    const scrollTop = Math.max(0, safeCurrentTop + scrollDelta);
    state.lastScrollAtMs = safeNowMs;

    const plan = {
      shouldScroll: Math.abs(scrollTop - safeCurrentTop) > 0.5,
      scrollTop,
      targetScrollTop: safeTargetTop,
      currentScrollTop: safeCurrentTop,
      scrollDelta,
      distance: remainingDistance,
      direction: scrollDirection > 0 ? "down" : "up",
      linesPerMinute: state.linesPerMinute,
    };
    emitNarrationViewportDebug(
      logger,
      "narration-follow.viewport-plan",
      "Planned narration follow viewport movement.",
      {
        sceneId: safeSceneId,
        matchedLineIndex: safeLineIndex,
        currentScrollTop: safeCurrentTop,
        targetScrollTop: safeTargetTop,
        nextScrollTop: scrollTop,
        scrollDelta,
        distance: remainingDistance,
        direction: plan.direction,
        lineHeight: safeLineHeight,
        elapsedScrollMs,
        linesPerMinute: state.linesPerMinute,
        readingRateContext,
        farDistanceStep,
        maxStep,
        cappedMaxStep,
      },
    );
    return plan;
  }

  return {
    planScroll,
    reset,
  };
}
