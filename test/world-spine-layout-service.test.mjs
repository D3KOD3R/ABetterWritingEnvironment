// Intent: verify World Spine side-panel profiles remain independent from manuscript layout profiles.
import assert from "node:assert/strict";

import {
  WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
  createWorldSpineLayoutProfile,
  normalizeWorldSpineLayoutProfiles,
  resolveWorldSpineLayoutProfile,
  resolveWorldSpineLayoutProfileKey,
  resolveWorldSpineLayoutProfileWidths,
  shouldReplaceWorldSpineFallbackProfile,
  upsertWorldSpineLayoutProfile,
} from "../apps/editor/public/features/world-spine/world-spine-layout-service.js";

export function runWorldSpineLayoutServiceTest() {
  assert.equal(resolveWorldSpineLayoutProfileKey(1540), "workspace-1600");
  assert.equal(resolveWorldSpineLayoutProfileKey(0), "");

  const profile = createWorldSpineLayoutProfile({
    availableWidth: 1200,
    eventRailWidth: 240,
    manuscriptPaneWidth: 360,
  });
  assert.equal(profile.profileKey, "workspace-1280");
  assert.equal(profile.workspaceWidth, 1200);
  assert.equal(profile.eventRailWidth, 240);
  assert.equal(profile.manuscriptPaneWidth, 360);
  assert.equal(profile.leftPercent, 20);
  assert.equal(profile.rightPercent, 30);

  const profiles = upsertWorldSpineLayoutProfile({}, profile);
  assert.equal(resolveWorldSpineLayoutProfile(profiles, 1210)?.profileKey, "workspace-1280");
  assert.equal(resolveWorldSpineLayoutProfile(profiles, 1460), null);

  assert.deepEqual(resolveWorldSpineLayoutProfileWidths(profile, 1600), {
    eventRailWidth: 320,
    manuscriptPaneWidth: 480,
  });
  assert.deepEqual(resolveWorldSpineLayoutProfileWidths(profile, 1600, { preferStoredPixels: true }), {
    eventRailWidth: 240,
    manuscriptPaneWidth: 360,
  });

  const fallbackProfile = createWorldSpineLayoutProfile({
    profileKey: WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
    availableWidth: 1600,
    eventRailWidth: 260,
    manuscriptPaneWidth: 340,
  });
  assert.equal(shouldReplaceWorldSpineFallbackProfile(fallbackProfile, 1200), false);
  assert.equal(shouldReplaceWorldSpineFallbackProfile(fallbackProfile, 1800), true);

  const normalized = normalizeWorldSpineLayoutProfiles({
    "workspace-1280": profile,
    "bad-key": profile,
    [WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY]: fallbackProfile,
  });
  assert.deepEqual(Object.keys(normalized).sort(), [
    WORLD_SPINE_LAYOUT_FALLBACK_PROFILE_KEY,
    "workspace-1280",
  ]);
}
