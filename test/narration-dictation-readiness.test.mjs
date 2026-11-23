import { dictationHost } from "../apps/desktop/src/dictation-host.ts";
import assert from "node:assert/strict";
import { dictationReadiness } from "../apps/editor/public/shared/dictation-readiness.js";
import { renderDictationModels, renderDictationSettings } from "../apps/editor/public/features/narration/dictation-panel.js";
import { setSpeechSettingsLock, updateDesktopSettingsSnapshot } from "../apps/desktop/src/settings.ts";
export async function runNarrationDictationReadinessTest() {
  await assert.rejects(dictationHost.handle("install", { modelId: "moonshine_tiny_streaming_en", consent: false }, {}), /explicitly approve/);
  const view = { model: { ready: true }, runtime: { ready: true, recordingReady: true }, settings: { liveModelId: "live", setupComplete: true }, permission: "granted", devices: [{ deviceId: "mic" }], deviceId: "mic", channel: 0, channels: 2 };
  const context = { saved: true, scene: "scene" };
  assert.equal(dictationReadiness(view, context).ready, true);
  for (const patch of [{ model: { ready: false } }, { runtime: { ready: true, recordingReady: false } }, { permission: "denied" }, { deviceId: "missing" }, { channel: 2 }, { active: true }, { pending: {} }, { locked: true }]) assert.equal(dictationReadiness({ ...view, ...patch }, context).ready, false);
  for (const patch of [{ saved: false }, { scene: "" }, { follow: true }]) assert.equal(dictationReadiness(view, { ...context, ...patch }).ready, false);
  // Setup completion is intentionally not an authority for current readiness.
  assert.equal(dictationReadiness({ settings: { setupComplete: true } }, context).ready, false);
  const html = renderDictationModels({ models: [] }, true);
  assert.match(html, /Live Dictation Models/); assert.doesNotMatch(html, /Refinement Models/);
  assert.match(renderDictationSettings({ active: true }), /Stop and finalize capture/);
  const previous = setSpeechSettingsLock(() => true);
  try {
    assert.throws(() => updateDesktopSettingsSnapshot({ modelRoot: "must-not-write" }), /Stop and finalize/);
    assert.throws(() => updateDesktopSettingsSnapshot({ speech: { channel: 1 } }), /Stop and finalize/);
  } finally { setSpeechSettingsLock(previous); }
}
