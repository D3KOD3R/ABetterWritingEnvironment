// Intent: own spellcheck refresh timer state while callers provide browser/editor effects.
export const DEFAULT_SPELLCHECK_REFRESH_DELAY_MS = 180;

export function createSpellcheckRefreshController({
  delayMs = DEFAULT_SPELLCHECK_REFRESH_DELAY_MS,
  setTimeoutRef = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutRef = globalThis.clearTimeout?.bind(globalThis),
  onFlush = () => {},
} = {}) {
  let timerId = null;
  let sceneId = "";

  function schedule(nextSceneId, options = {}) {
    if (options.enabled === false) {
      return false;
    }

    sceneId = String(nextSceneId ?? "");
    if (timerId !== null && typeof clearTimeoutRef === "function") {
      clearTimeoutRef(timerId);
    }

    if (typeof setTimeoutRef !== "function") {
      timerId = null;
      onFlush(sceneId);
      return true;
    }

    timerId = setTimeoutRef(() => {
      timerId = null;
      onFlush(sceneId);
    }, Math.max(0, Number(delayMs) || 0));
    return true;
  }

  function clear() {
    if (timerId !== null && typeof clearTimeoutRef === "function") {
      clearTimeoutRef(timerId);
    }
    timerId = null;
  }

  function getSnapshot() {
    return {
      hasPendingRefresh: timerId !== null,
      sceneId,
    };
  }

  return {
    schedule,
    clear,
    getSnapshot,
  };
}
