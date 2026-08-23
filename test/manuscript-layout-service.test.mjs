// Intent: verify side-panel layout profile math stays independent of browser DOM effects.
import assert from "node:assert/strict";

import {
  PANEL_RESIZER_FALLBACK_PROFILE_KEY,
  createPanelResizerLayoutProfile,
  isPanelResizerLayoutProfileLikelyClamped,
  normalizePanelResizerLayoutProfiles,
  recoverPanelResizerLayoutProfileWidths,
  resolvePanelResizerLayoutProfile,
  resolvePanelResizerLayoutProfileKey,
  resolvePanelResizerLayoutProfileWidths,
  resolvePanelResizerPercentWidths,
  shouldReplacePanelResizerFallbackProfile,
  upsertPanelResizerLayoutProfile,
} from "../apps/editor/public/features/manuscript-editor/manuscript-layout-service.js";

export function runManuscriptLayoutServiceTest() {
  assert.equal(resolvePanelResizerLayoutProfileKey(1540), "workspace-1600");
  assert.equal(resolvePanelResizerLayoutProfileKey(0), "");

  const fallbackProfile = createPanelResizerLayoutProfile({
    profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
    availableWidth: 2048,
    binderPanelWidth: 664,
    consoleDockWidth: 465,
  });
  assert.equal(fallbackProfile.leftPercent, 32.4);
  assert.equal(fallbackProfile.rightPercent, 22.7);

  const compactProfile = createPanelResizerLayoutProfile({
    profileKey: resolvePanelResizerLayoutProfileKey(1408),
    availableWidth: 1408,
    binderPanelWidth: 240,
    consoleDockWidth: 300,
  });
  const profiles = upsertPanelResizerLayoutProfile(
    upsertPanelResizerLayoutProfile({}, fallbackProfile),
    compactProfile,
  );
  const maximizedProfile = createPanelResizerLayoutProfile({
    profileKey: resolvePanelResizerLayoutProfileKey(2048),
    availableWidth: 2048,
    binderPanelWidth: 664,
    consoleDockWidth: 465,
  });
  const profilesWithMaximized = upsertPanelResizerLayoutProfile(profiles, maximizedProfile);
  const contaminatedProfiles = normalizePanelResizerLayoutProfiles({
    default: {
      profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
      workspaceWidth: 2299,
      binderPanelWidth: 286,
      consoleDockWidth: 433,
      leftPercent: 12.5,
      rightPercent: 18.8,
    },
    "workspace-2240": {
      profileKey: "workspace-2240",
      workspaceWidth: 2299,
      binderPanelWidth: 286,
      consoleDockWidth: 433,
      leftPercent: 12.5,
      rightPercent: 18.8,
    },
    "workspace-1280": {
      profileKey: "workspace-1280",
      workspaceWidth: 1279,
      binderPanelWidth: 286,
      consoleDockWidth: 433,
      leftPercent: 22.4,
      rightPercent: 33.8,
    },
  });

  assert.deepEqual(
    resolvePanelResizerLayoutProfileWidths(profiles["workspace-1440"], 1408),
    {
      binderPanelWidth: 239,
      consoleDockWidth: 300,
    },
  );
  assert.deepEqual(
    resolvePanelResizerLayoutProfileWidths(
      profiles[PANEL_RESIZER_FALLBACK_PROFILE_KEY],
      1408,
      { preferStoredPixels: true },
    ),
    {
      binderPanelWidth: 664,
      consoleDockWidth: 465,
    },
  );
  assert.equal(shouldReplacePanelResizerFallbackProfile(fallbackProfile, 1408), false);
  assert.equal(shouldReplacePanelResizerFallbackProfile(fallbackProfile, 2200), true);
  assert.equal(resolvePanelResizerLayoutProfile(profilesWithMaximized, 1988).profileKey, "workspace-2080");
  assert.equal(
    isPanelResizerLayoutProfileLikelyClamped(
      contaminatedProfiles["workspace-2240"],
      contaminatedProfiles,
    ),
    true,
  );
  assert.equal(
    isPanelResizerLayoutProfileLikelyClamped(
      contaminatedProfiles[PANEL_RESIZER_FALLBACK_PROFILE_KEY],
      contaminatedProfiles,
    ),
    true,
  );
  assert.equal(
    isPanelResizerLayoutProfileLikelyClamped(
      contaminatedProfiles["workspace-1280"],
      contaminatedProfiles,
    ),
    false,
  );
  assert.equal(
    isPanelResizerLayoutProfileLikelyClamped(maximizedProfile, profilesWithMaximized),
    false,
  );
  assert.deepEqual(
    recoverPanelResizerLayoutProfileWidths(contaminatedProfiles["workspace-2240"], 2299),
    {
      binderPanelWidth: 320,
      consoleDockWidth: 433,
    },
  );
  assert.deepEqual(
    resolvePanelResizerLayoutProfileWidths(
      resolvePanelResizerLayoutProfile(profilesWithMaximized, 1988),
      1988,
      { preferStoredPixels: true },
    ),
    {
      binderPanelWidth: 664,
      consoleDockWidth: 465,
    },
  );
  assert.deepEqual(resolvePanelResizerPercentWidths({
    leftPercent: 20,
    rightPercent: 25,
    availableWidth: 1000,
  }), {
    binderPanelWidth: 200,
    consoleDockWidth: 250,
  });
  assert.deepEqual(
    resolvePanelResizerLayoutProfileWidths({
      profileKey: PANEL_RESIZER_FALLBACK_PROFILE_KEY,
      workspaceWidth: 1000,
      leftPercent: 20,
      rightPercent: 25,
    }, 1000, { preferStoredPixels: true }),
    {
      binderPanelWidth: 200,
      consoleDockWidth: 250,
    },
  );
  assert.deepEqual(normalizePanelResizerLayoutProfiles({
    "workspace-1600": compactProfile,
    "bad key": compactProfile,
  }), {
    "workspace-1600": {
      ...compactProfile,
      profileKey: "workspace-1600",
    },
  });
}
