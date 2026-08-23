// Intent: own measured manuscript-editor layout rules that keep visual chrome aligned with rendered text.

const MIN_GUTTER_LINE_COUNT = 1;
const PANEL_RESIZER_PROFILE_WIDTH_STEP = 160;
export const PANEL_RESIZER_FALLBACK_PROFILE_KEY = "default";

// Intent: prefer browser-measured textarea height over estimated wrapping so the gutter never creates phantom rows.
export function resolveMeasuredEditorGutterLineCount({
  scrollHeight,
  lineHeight,
  paddingTop = 0,
  paddingBottom = 0,
  fallbackLineCount = MIN_GUTTER_LINE_COUNT,
} = {}) {
  const fallbackCount = normalizePositiveInteger(fallbackLineCount, MIN_GUTTER_LINE_COUNT);
  const safeScrollHeight = normalizeNonNegativeNumber(scrollHeight);
  const safeLineHeight = normalizePositiveNumber(lineHeight);

  if (safeScrollHeight == null || safeLineHeight == null) {
    return fallbackCount;
  }

  const contentHeight = Math.max(
    0,
    safeScrollHeight -
      normalizeNonNegativeNumber(paddingTop, 0) -
      normalizeNonNegativeNumber(paddingBottom, 0),
  );
  if (contentHeight <= 0) {
    return MIN_GUTTER_LINE_COUNT;
  }

  return Math.max(MIN_GUTTER_LINE_COUNT, Math.round(contentHeight / safeLineHeight));
}

// Intent: bucket workspace widths so moving a browser between displays does not overwrite another display's panel layout.
export function resolvePanelResizerLayoutProfileKey(availableWidth, {
  widthStep = PANEL_RESIZER_PROFILE_WIDTH_STEP,
} = {}) {
  const safeWidth = normalizePositiveNumber(availableWidth);
  const safeStep = normalizePositiveNumber(widthStep) ?? PANEL_RESIZER_PROFILE_WIDTH_STEP;
  if (safeWidth == null) {
    return "";
  }

  const bucketWidth = Math.max(safeStep, Math.round(safeWidth / safeStep) * safeStep);
  return `workspace-${bucketWidth}`;
}

// Intent: normalize stored panel layout profiles while accepting older projects that do not have them yet.
export function normalizePanelResizerLayoutProfiles(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const profiles = {};
  for (const [rawKey, rawProfile] of Object.entries(value)) {
    const profileKey = normalizePanelResizerProfileKey(rawKey);
    if (!profileKey) {
      continue;
    }
    const profile = normalizePanelResizerLayoutProfile(rawProfile, profileKey);
    if (profile) {
      profiles[profileKey] = profile;
    }
  }

  return profiles;
}

// Intent: capture the current side-panel layout as both exact pixels and a proportional restore hint.
export function createPanelResizerLayoutProfile({
  profileKey = "",
  availableWidth,
  binderPanelWidth,
  consoleDockWidth,
} = {}) {
  const resolvedProfileKey =
    normalizePanelResizerProfileKey(profileKey) ||
    resolvePanelResizerLayoutProfileKey(availableWidth);
  if (!resolvedProfileKey) {
    return null;
  }

  return normalizePanelResizerLayoutProfile({
    profileKey: resolvedProfileKey,
    workspaceWidth: normalizeRoundedPositiveNumber(availableWidth),
    binderPanelWidth: normalizeRoundedPositiveNumber(binderPanelWidth),
    consoleDockWidth: normalizeRoundedPositiveNumber(consoleDockWidth),
    leftPercent: panelWidthToPercent(binderPanelWidth, availableWidth),
    rightPercent: panelWidthToPercent(consoleDockWidth, availableWidth),
  }, resolvedProfileKey);
}

// Intent: save one viewport profile without mutating unrelated display-size profiles.
export function upsertPanelResizerLayoutProfile(profiles, profile) {
  const normalizedProfiles = normalizePanelResizerLayoutProfiles(profiles);
  const normalizedProfile = normalizePanelResizerLayoutProfile(profile, profile?.profileKey);
  if (!normalizedProfile) {
    return normalizedProfiles;
  }

  return {
    ...normalizedProfiles,
    [normalizedProfile.profileKey]: normalizedProfile,
  };
}

// Intent: recover the closest stored browser-size profile when maximize lands just outside the saved width bucket.
export function resolvePanelResizerLayoutProfile(profiles, availableWidth, {
  maxDistance = PANEL_RESIZER_PROFILE_WIDTH_STEP * 1.5,
} = {}) {
  const normalizedProfiles = normalizePanelResizerLayoutProfiles(profiles);
  const exactProfileKey = resolvePanelResizerLayoutProfileKey(availableWidth);
  if (exactProfileKey && normalizedProfiles[exactProfileKey]) {
    return normalizedProfiles[exactProfileKey];
  }

  const safeWidth = normalizePositiveNumber(availableWidth);
  const safeMaxDistance = normalizePositiveNumber(maxDistance) ?? PANEL_RESIZER_PROFILE_WIDTH_STEP;
  if (safeWidth == null) {
    return null;
  }

  let closestProfile = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const [profileKey, profile] of Object.entries(normalizedProfiles)) {
    if (profileKey === PANEL_RESIZER_FALLBACK_PROFILE_KEY) {
      continue;
    }

    const profileWidth = normalizePositiveNumber(profile.workspaceWidth) ??
      parseWorkspaceProfileKeyWidth(profileKey);
    if (profileWidth == null) {
      continue;
    }

    const distance = Math.abs(profileWidth - safeWidth);
    if (distance <= safeMaxDistance && distance < closestDistance) {
      closestProfile = profile;
      closestDistance = distance;
    }
  }

  return closestProfile;
}

// Intent: resolve restore widths from a size profile, preferring ratios for viewport buckets and pixels for legacy fallback.
export function resolvePanelResizerLayoutProfileWidths(profile, availableWidth, {
  preferStoredPixels = false,
} = {}) {
  const normalizedProfile = normalizePanelResizerLayoutProfile(profile, profile?.profileKey);
  if (!normalizedProfile) {
    return {
      binderPanelWidth: null,
      consoleDockWidth: null,
    };
  }

  const percentBinderWidth = panelWidthFromPercent(normalizedProfile.leftPercent, availableWidth);
  const percentConsoleWidth = panelWidthFromPercent(normalizedProfile.rightPercent, availableWidth);
  const pixelBinderWidth = normalizeRoundedPositiveNumber(normalizedProfile.binderPanelWidth);
  const pixelConsoleWidth = normalizeRoundedPositiveNumber(normalizedProfile.consoleDockWidth);

  return {
    binderPanelWidth: preferStoredPixels
      ? pixelBinderWidth ?? percentBinderWidth
      : percentBinderWidth ?? pixelBinderWidth,
    consoleDockWidth: preferStoredPixels
      ? pixelConsoleWidth ?? percentConsoleWidth
      : percentConsoleWidth ?? pixelConsoleWidth,
  };
}

// Intent: identify wide profiles that were polluted by an automatic compact-window clamp.
export function isPanelResizerLayoutProfileLikelyClamped(profile, profiles, {
  minWideWorkspaceWidth = 1600,
  minWideBinderWidth = 320,
  widthMatchTolerance = 2,
} = {}) {
  const normalizedProfile = normalizePanelResizerLayoutProfile(profile, profile?.profileKey);
  if (!normalizedProfile) {
    return false;
  }

  const profileWorkspaceWidth = normalizePositiveNumber(normalizedProfile.workspaceWidth) ??
    parseWorkspaceProfileKeyWidth(normalizedProfile.profileKey);
  const safeMinWideWorkspaceWidth = normalizePositiveNumber(minWideWorkspaceWidth) ?? 1600;
  if (profileWorkspaceWidth == null || profileWorkspaceWidth < safeMinWideWorkspaceWidth) {
    return false;
  }

  const binderPanelWidth = normalizeRoundedPositiveNumber(normalizedProfile.binderPanelWidth);
  const safeMinWideBinderWidth = normalizePositiveNumber(minWideBinderWidth) ?? 320;
  if (binderPanelWidth == null || binderPanelWidth >= safeMinWideBinderWidth) {
    return false;
  }

  const consoleDockWidth = normalizeRoundedPositiveNumber(normalizedProfile.consoleDockWidth);
  const safeWidthMatchTolerance = normalizeNonNegativeNumber(widthMatchTolerance, 2);
  const normalizedProfiles = normalizePanelResizerLayoutProfiles(profiles);
  for (const [profileKey, candidate] of Object.entries(normalizedProfiles)) {
    if (
      profileKey === normalizedProfile.profileKey ||
      profileKey === PANEL_RESIZER_FALLBACK_PROFILE_KEY
    ) {
      continue;
    }

    const candidateWorkspaceWidth = normalizePositiveNumber(candidate.workspaceWidth) ??
      parseWorkspaceProfileKeyWidth(profileKey);
    if (candidateWorkspaceWidth == null || candidateWorkspaceWidth >= profileWorkspaceWidth) {
      continue;
    }

    const candidateBinderPanelWidth = normalizeRoundedPositiveNumber(candidate.binderPanelWidth);
    const candidateConsoleDockWidth = normalizeRoundedPositiveNumber(candidate.consoleDockWidth);
    const binderWidthsMatch = widthsAreWithinTolerance(
      candidateBinderPanelWidth,
      binderPanelWidth,
      safeWidthMatchTolerance,
    );
    const consoleWidthsMatch =
      consoleDockWidth == null ||
      candidateConsoleDockWidth == null ||
      widthsAreWithinTolerance(candidateConsoleDockWidth, consoleDockWidth, safeWidthMatchTolerance);
    if (binderWidthsMatch && consoleWidthsMatch) {
      return true;
    }
  }

  return false;
}

// Intent: recover from a compact-contaminated wide profile without losing a valid right-console width.
export function recoverPanelResizerLayoutProfileWidths(profile, availableWidth, {
  minBinderPanelWidth = 320,
  fallbackConsoleDockWidth = 320,
} = {}) {
  const clampedWidths = resolvePanelResizerLayoutProfileWidths(profile, availableWidth, {
    preferStoredPixels: true,
  });
  const safeMinBinderPanelWidth = normalizePositiveNumber(minBinderPanelWidth) ?? 320;
  const safeFallbackConsoleDockWidth = normalizePositiveNumber(fallbackConsoleDockWidth) ?? 320;

  return {
    binderPanelWidth: Math.max(
      safeMinBinderPanelWidth,
      clampedWidths.binderPanelWidth ?? safeMinBinderPanelWidth,
    ),
    consoleDockWidth: clampedWidths.consoleDockWidth ?? safeFallbackConsoleDockWidth,
  };
}

// Intent: keep the legacy default profile anchored to the widest known workspace rather than a temporary compact window.
export function shouldReplacePanelResizerFallbackProfile(fallbackProfile, availableWidth) {
  const safeWidth = normalizePositiveNumber(availableWidth);
  if (safeWidth == null) {
    return false;
  }

  const normalizedFallback = normalizePanelResizerLayoutProfile(
    fallbackProfile,
    PANEL_RESIZER_FALLBACK_PROFILE_KEY,
  );
  const fallbackWidth = normalizePositiveNumber(normalizedFallback?.workspaceWidth);
  return fallbackWidth == null || safeWidth >= fallbackWidth;
}

// Intent: translate legacy percent settings into restore widths without creating a durable viewport profile.
export function resolvePanelResizerPercentWidths({
  leftPercent,
  rightPercent,
  availableWidth,
} = {}) {
  return {
    binderPanelWidth: panelWidthFromPercent(leftPercent, availableWidth),
    consoleDockWidth: panelWidthFromPercent(rightPercent, availableWidth),
  };
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.max(MIN_GUTTER_LINE_COUNT, Math.round(number));
}

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeRoundedPositiveNumber(value) {
  const number = normalizePositiveNumber(value);
  return number == null ? null : Math.round(number);
}

function normalizeNonNegativeNumber(value, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return number;
}

function normalizePanelResizerProfileKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) {
    return "";
  }

  if (key === PANEL_RESIZER_FALLBACK_PROFILE_KEY || /^workspace-\d+$/.test(key)) {
    return key;
  }

  return "";
}

function parseWorkspaceProfileKeyWidth(profileKey) {
  const match = /^workspace-(\d+)$/.exec(profileKey);
  if (!match) {
    return null;
  }

  return normalizePositiveNumber(match[1]);
}

function normalizePanelResizerLayoutProfile(value, fallbackProfileKey = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const profileKey = normalizePanelResizerProfileKey(fallbackProfileKey) ||
    normalizePanelResizerProfileKey(value.profileKey);
  if (!profileKey) {
    return null;
  }

  return {
    profileKey,
    workspaceWidth: normalizeRoundedPositiveNumber(value.workspaceWidth),
    binderPanelWidth: normalizeRoundedPositiveNumber(value.binderPanelWidth),
    consoleDockWidth: normalizeRoundedPositiveNumber(value.consoleDockWidth),
    leftPercent: normalizePanelResizerPercent(value.leftPercent),
    rightPercent: normalizePanelResizerPercent(value.rightPercent),
  };
}

function panelWidthFromPercent(percent, availableWidth) {
  const normalizedPercent = normalizePanelResizerPercent(percent);
  const safeAvailableWidth = normalizePositiveNumber(availableWidth);
  return normalizedPercent === null || safeAvailableWidth == null
    ? null
    : Math.round((safeAvailableWidth * normalizedPercent) / 100);
}

function panelWidthToPercent(width, availableWidth) {
  const safeWidth = normalizePositiveNumber(width);
  const safeAvailableWidth = normalizePositiveNumber(availableWidth);
  return safeWidth != null && safeAvailableWidth != null
    ? normalizePanelResizerPercent((safeWidth / safeAvailableWidth) * 100)
    : null;
}

function normalizePanelResizerPercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(Math.min(Math.max(numericValue, 0), 100) * 10) / 10
    : null;
}

function widthsAreWithinTolerance(leftWidth, rightWidth, tolerance) {
  if (leftWidth == null || rightWidth == null) {
    return false;
  }

  return Math.abs(leftWidth - rightWidth) <= tolerance;
}
