// Intent: debounce anchor validation so expensive recovery work runs only after editing has gone quiet.

export const DEFAULT_ANCHOR_IDLE_VALIDATION_DELAY_MS = 5000;

export function createManuscriptAnchorIdleValidationScheduler({
  delayMs = DEFAULT_ANCHOR_IDLE_VALIDATION_DELAY_MS,
  setTimeoutRef = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutRef = globalThis.clearTimeout?.bind(globalThis),
  onValidate = () => {},
} = {}) {
  if (typeof setTimeoutRef !== "function" || typeof clearTimeoutRef !== "function") {
    throw new Error("AnchorIdleValidationScheduler requires timer functions.");
  }
  if (typeof onValidate !== "function") {
    throw new Error("AnchorIdleValidationScheduler requires an onValidate callback.");
  }

  const timers = new Map();
  const normalizedDelayMs = Math.max(0, Math.round(Number(delayMs) || 0));

  function schedule(sceneId, {
    reason = "idle",
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId) {
      return false;
    }

    cancel(normalizedSceneId);
    const timerId = setTimeoutRef(() => {
      timers.delete(normalizedSceneId);
      onValidate(normalizedSceneId, { reason });
    }, normalizedDelayMs);
    timers.set(normalizedSceneId, timerId);
    return true;
  }

  function cancel(sceneId) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId || !timers.has(normalizedSceneId)) {
      return false;
    }

    clearTimeoutRef(timers.get(normalizedSceneId));
    timers.delete(normalizedSceneId);
    return true;
  }

  function clearAll() {
    for (const timerId of timers.values()) {
      clearTimeoutRef(timerId);
    }
    timers.clear();
  }

  function flush(sceneId, {
    reason = "flush",
  } = {}) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId || !timers.has(normalizedSceneId)) {
      return false;
    }

    clearTimeoutRef(timers.get(normalizedSceneId));
    timers.delete(normalizedSceneId);
    onValidate(normalizedSceneId, { reason });
    return true;
  }

  function getPendingSceneIds() {
    return [...timers.keys()];
  }

  return {
    cancel,
    clearAll,
    flush,
    getPendingSceneIds,
    schedule,
  };
}
