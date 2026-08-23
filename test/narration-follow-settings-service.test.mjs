// Intent: verify narration-follow preferences stay small, deterministic, and UI-owned.
import assert from "node:assert/strict";

import {
  createDefaultNarrationFollowSettings,
  normalizeNarrationFollowSettings,
  toggleNarrationDecorations,
  toggleNarrationManuscriptDecorations,
  toggleNarrationFollowScroll,
  updateNarrationFollowSettings,
} from "../apps/editor/public/features/narration/narration-follow-settings-service.js";

export function runNarrationFollowSettingsServiceTest() {
  assert.deepEqual(createDefaultNarrationFollowSettings(), {
    liveHighlightEnabled: true,
    followScrollEnabled: true,
    manuscriptDecorationsVisible: true,
    narrationDecorationsVisible: true,
  });
  assert.deepEqual(normalizeNarrationFollowSettings({
    followScrollEnabled: false,
    manuscriptDecorationsVisible: false,
    narrationDecorationsVisible: false,
  }), {
    liveHighlightEnabled: true,
    followScrollEnabled: false,
    manuscriptDecorationsVisible: false,
    narrationDecorationsVisible: false,
  });

  const unchanged = updateNarrationFollowSettings({ followScrollEnabled: false }, {
    followScrollEnabled: false,
  });
  assert.equal(unchanged.changed, false);
  assert.deepEqual(unchanged.settings, {
    liveHighlightEnabled: true,
    followScrollEnabled: false,
    manuscriptDecorationsVisible: true,
    narrationDecorationsVisible: true,
  });

  const toggled = toggleNarrationFollowScroll(unchanged.settings);
  assert.equal(toggled.changed, true);
  assert.equal(toggled.settings.followScrollEnabled, true);

  const decorationsToggled = toggleNarrationManuscriptDecorations(toggled.settings);
  assert.equal(decorationsToggled.changed, true);
  assert.equal(decorationsToggled.settings.manuscriptDecorationsVisible, false);
  assert.equal(decorationsToggled.settings.narrationDecorationsVisible, true);

  const narrationDecorationsToggled = toggleNarrationDecorations(decorationsToggled.settings);
  assert.equal(narrationDecorationsToggled.changed, true);
  assert.equal(narrationDecorationsToggled.settings.manuscriptDecorationsVisible, false);
  assert.equal(narrationDecorationsToggled.settings.narrationDecorationsVisible, false);
}
