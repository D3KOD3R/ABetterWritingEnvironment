// Intent: own live narration-follow display preferences outside the editor shell.

export const NARRATION_FOLLOW_SETTINGS_DEFAULTS = Object.freeze({
  liveHighlightEnabled: true,
  followScrollEnabled: true,
  manuscriptDecorationsVisible: true,
  narrationDecorationsVisible: true,
});

export function createDefaultNarrationFollowSettings() {
  return { ...NARRATION_FOLLOW_SETTINGS_DEFAULTS };
}

export function normalizeNarrationFollowSettings(candidate = {}) {
  const value = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};

  return {
    liveHighlightEnabled: value.liveHighlightEnabled === false
      ? false
      : NARRATION_FOLLOW_SETTINGS_DEFAULTS.liveHighlightEnabled,
    followScrollEnabled: value.followScrollEnabled === false
      ? false
      : NARRATION_FOLLOW_SETTINGS_DEFAULTS.followScrollEnabled,
    manuscriptDecorationsVisible: value.manuscriptDecorationsVisible === false
      ? false
      : NARRATION_FOLLOW_SETTINGS_DEFAULTS.manuscriptDecorationsVisible,
    narrationDecorationsVisible: value.narrationDecorationsVisible === false
      ? false
      : NARRATION_FOLLOW_SETTINGS_DEFAULTS.narrationDecorationsVisible,
  };
}

export function updateNarrationFollowSettings(currentSettings = {}, patch = {}) {
  const previous = normalizeNarrationFollowSettings(currentSettings);
  const patchValue = patch && typeof patch === "object" && !Array.isArray(patch)
    ? patch
    : {};
  const next = normalizeNarrationFollowSettings({
    ...previous,
    ...patchValue,
  });

  return {
    settings: next,
    changed: previous.liveHighlightEnabled !== next.liveHighlightEnabled ||
      previous.followScrollEnabled !== next.followScrollEnabled ||
      previous.manuscriptDecorationsVisible !== next.manuscriptDecorationsVisible ||
      previous.narrationDecorationsVisible !== next.narrationDecorationsVisible,
  };
}

export function toggleNarrationFollowScroll(currentSettings = {}) {
  const previous = normalizeNarrationFollowSettings(currentSettings);
  return updateNarrationFollowSettings(previous, {
    followScrollEnabled: !previous.followScrollEnabled,
  });
}

export function toggleNarrationManuscriptDecorations(currentSettings = {}) {
  const previous = normalizeNarrationFollowSettings(currentSettings);
  return updateNarrationFollowSettings(previous, {
    manuscriptDecorationsVisible: !previous.manuscriptDecorationsVisible,
  });
}

export function toggleNarrationDecorations(currentSettings = {}) {
  const previous = normalizeNarrationFollowSettings(currentSettings);
  return updateNarrationFollowSettings(previous, {
    narrationDecorationsVisible: !previous.narrationDecorationsVisible,
  });
}
