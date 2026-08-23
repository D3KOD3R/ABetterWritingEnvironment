// Intent: own World Spine side-panel width profiles without coupling them to manuscript pane layout names.

const WORLD_SPINE_LAYOUT_PROFILE_WIDTH_STEP = 160;
export const WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY = "default";

export function resolveWorldSpineLayoutProfileKey(availableWidth, {
  widthStep = WORLD_SPINE_LAYOUT_PROFILE_WIDTH_STEP,
} = {}) {
  const safeWidth = normalizePositiveNumber(availableWidth);
  const safeStep = normalizePositiveNumber(widthStep) ?? WORLD_SPINE_LAYOUT_PROFILE_WIDTH_STEP;
  if (safeWidth == null) {
    return "";
  }

  const bucketWidth = Math.max(safeStep, Math.round(safeWidth / safeStep) * safeStep);
  return `workspace-${bucketWidth}`;
}

// Intent: normalize stored layout profiles while accepting projects saved before World Spine resizing existed.
export function normalizeWorldSpineLayoutProfiles(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const profiles = {};
  for (const [rawKey, rawProfile] of Object.entries(value)) {
    const profileKey = normalizeProfileKey(rawKey);
    if (!profileKey) {
      continue;
    }
    const profile = normalizeWorldSpineLayoutProfile(rawProfile, profileKey);
    if (profile) {
      profiles[profileKey] = profile;
    }
  }

  return profiles;
}

// Intent: capture exact rail widths plus proportional restore hints for the current browser-size bucket.
export function createWorldSpineLayoutProfile({
  profileKey = "",
  availableWidth,
  eventRailWidth,
  manuscriptPaneWidth,
} = {}) {
  const resolvedProfileKey =
    normalizeProfileKey(profileKey) ||
    resolveWorldSpineLayoutProfileKey(availableWidth);
  if (!resolvedProfileKey) {
    return null;
  }

  return normalizeWorldSpineLayoutProfile({
    profileKey: resolvedProfileKey,
    workspaceWidth: normalizeRoundedPositiveNumber(availableWidth),
    eventRailWidth: normalizeRoundedPositiveNumber(eventRailWidth),
    manuscriptPaneWidth: normalizeRoundedPositiveNumber(manuscriptPaneWidth),
    leftPercent: panelWidthToPercent(eventRailWidth, availableWidth),
    rightPercent: panelWidthToPercent(manuscriptPaneWidth, availableWidth),
  }, resolvedProfileKey);
}

// Intent: save one World Spine viewport profile without dropping other display-size profiles.
export function upsertWorldSpineLayoutProfile(profiles, profile) {
  const normalizedProfiles = normalizeWorldSpineLayoutProfiles(profiles);
  const normalizedProfile = normalizeWorldSpineLayoutProfile(profile, profile?.profileKey);
  if (!normalizedProfile) {
    return normalizedProfiles;
  }

  return {
    ...normalizedProfiles,
    [normalizedProfile.profileKey]: normalizedProfile,
  };
}

// Intent: recover the closest stored browser-size profile when the OS reports a near bucket after maximize.
export function resolveWorldSpineLayoutProfile(profiles, availableWidth, {
  maxDistance = WORLD_SPINE_LAYOUT_PROFILE_WIDTH_STEP * 1.5,
} = {}) {
  const normalizedProfiles = normalizeWorldSpineLayoutProfiles(profiles);
  const exactProfileKey = resolveWorldSpineLayoutProfileKey(availableWidth);
  if (exactProfileKey && normalizedProfiles[exactProfileKey]) {
    return normalizedProfiles[exactProfileKey];
  }

  const safeWidth = normalizePositiveNumber(availableWidth);
  const safeMaxDistance = normalizePositiveNumber(maxDistance) ?? WORLD_SPINE_LAYOUT_PROFILE_WIDTH_STEP;
  if (safeWidth == null) {
    return null;
  }

  let closestProfile = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const [profileKey, profile] of Object.entries(normalizedProfiles)) {
    if (profileKey === WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY) {
      continue;
    }

    const profileWidth = normalizePositiveNumber(profile.workspaceWidth) ?? parseWorkspaceProfileKeyWidth(profileKey);
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

// Intent: resolve profile widths for a current viewport, preferring ratios for size buckets and pixels for fallback.
export function resolveWorldSpineLayoutProfileWidths(profile, availableWidth, {
  preferStoredPixels = false,
} = {}) {
  const normalizedProfile = normalizeWorldSpineLayoutProfile(profile, profile?.profileKey);
  if (!normalizedProfile) {
    return {
      eventRailWidth: null,
      manuscriptPaneWidth: null,
    };
  }

  const percentEventRailWidth = panelWidthFromPercent(normalizedProfile.leftPercent, availableWidth);
  const percentManuscriptPaneWidth = panelWidthFromPercent(normalizedProfile.rightPercent, availableWidth);
  const pixelEventRailWidth = normalizeRoundedPositiveNumber(normalizedProfile.eventRailWidth);
  const pixelManuscriptPaneWidth = normalizeRoundedPositiveNumber(normalizedProfile.manuscriptPaneWidth);

  return {
    eventRailWidth: preferStoredPixels
      ? pixelEventRailWidth ?? percentEventRailWidth
      : percentEventRailWidth ?? pixelEventRailWidth,
    manuscriptPaneWidth: preferStoredPixels
      ? pixelManuscriptPaneWidth ?? percentManuscriptPaneWidth
      : percentManuscriptPaneWidth ?? pixelManuscriptPaneWidth,
  };
}

export function shouldReplaceWorldSpineFallbackProfile(fallbackProfile, availableWidth) {
  const safeWidth = normalizePositiveNumber(availableWidth);
  if (safeWidth == null) {
    return false;
  }

  const normalizedFallback = normalizeWorldSpineLayoutProfile(
    fallbackProfile,
    WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
  );
  const fallbackWidth = normalizePositiveNumber(normalizedFallback?.workspaceWidth);
  return fallbackWidth == null || safeWidth >= fallbackWidth;
}

function normalizePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeRoundedPositiveNumber(value) {
  const number = normalizePositiveNumber(value);
  return number == null ? null : Math.round(number);
}

function normalizeProfileKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) {
    return "";
  }

  if (key === WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY || /^workspace-\d+$/.test(key)) {
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

function normalizeWorldSpineLayoutProfile(value, fallbackProfileKey = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const profileKey = normalizeProfileKey(fallbackProfileKey) || normalizeProfileKey(value.profileKey);
  if (!profileKey) {
    return null;
  }

  return {
    profileKey,
    workspaceWidth: normalizeRoundedPositiveNumber(value.workspaceWidth),
    eventRailWidth: normalizeRoundedPositiveNumber(value.eventRailWidth),
    manuscriptPaneWidth: normalizeRoundedPositiveNumber(value.manuscriptPaneWidth),
    leftPercent: normalizePercent(value.leftPercent),
    rightPercent: normalizePercent(value.rightPercent),
  };
}

function panelWidthFromPercent(percent, availableWidth) {
  const normalizedPercent = normalizePercent(percent);
  const safeAvailableWidth = normalizePositiveNumber(availableWidth);
  return normalizedPercent === null || safeAvailableWidth == null
    ? null
    : Math.round((safeAvailableWidth * normalizedPercent) / 100);
}

function panelWidthToPercent(width, availableWidth) {
  const safeWidth = normalizePositiveNumber(width);
  const safeAvailableWidth = normalizePositiveNumber(availableWidth);
  return safeWidth != null && safeAvailableWidth != null
    ? normalizePercent((safeWidth / safeAvailableWidth) * 100)
    : null;
}

function normalizePercent(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(Math.min(Math.max(numericValue, 0), 100) * 10) / 10
    : null;
}
