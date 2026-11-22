import assert from "node:assert/strict";
import { createDictationController } from "../apps/editor/public/features/narration/dictation-controller.js";
import { renderDictationPanel } from "../apps/editor/public/features/narration/dictation-panel.js";

export async function runNarrationDictationControllerTest() {
  const priorDocument = globalThis.document, priorWindow = globalThis.window;
  globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
  globalThis.window = { addEventListener() {} };
  try {
    let releaseStart, captureStopped = false, saved = false, finalized = 0;
    const state = { activePane: "narration", narrationSubpanel: "stt", projectFileStorageMode: "desktop-package", projectFilePath: "original-package", selectedSceneId: "scene", workspace: { project: { id: "project" } } };
    const controller = createDictationController({ state, render() {}, isFollowActive: () => false,
      persistence: { async saveDictationSession(record, root) { assert.equal(root, "original-package"); assert.equal(captureStopped, true); saved = true; return record; } },
      beginCapture: async () => ({ device: {}, stop: async () => { captureStopped = true; } }),
      request: async (action) => {
        if (action === "start") return new Promise(resolve => { releaseStart = () => resolve({ sessionId: "session", projectId: "project", sceneId: "scene" }); });
        assert.equal(action, "stop"); finalized++;
        return { record: { sampleCount: 0, recording: { bytes: 42 } } };
      },
    });
    const recording = controller.handle("dictation-record", {});
    let navigationReleased = false;
    const transition = controller.stop().then(() => { navigationReleased = true; });
    await Promise.resolve(); assert.equal(navigationReleased, false);
    // A route change during runtime/permission startup cannot outrun capture release and publication.
    releaseStart(); await Promise.all([recording, transition]);
    assert.equal(captureStopped, true); assert.equal(saved, true); assert.equal(finalized, 1);
    assert.equal(controller.isActive(), false);
    // Encoder/publication failures keep an explicit retry action available after the mic is released.
    assert.match(renderDictationPanel({ finalizationPending: true }), /data-action="dictation-stop" >Retry finalization/);
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
  }
}
