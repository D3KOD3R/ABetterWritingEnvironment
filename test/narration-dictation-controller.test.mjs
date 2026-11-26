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
      inputFactory: () => ({ refresh: async () => {}, state: {} }),
      persistence: { async saveDictationSession(record, root) { assert.equal(root, "original-package"); assert.equal(captureStopped, true); saved = true; return record; } },
      beginCapture: async () => ({ device: {}, stop: async () => { captureStopped = true; } }),
      request: async (action) => {
        if (action === "acknowledge") return {};
        if (action === "start") return new Promise(resolve => { releaseStart = () => resolve({ sessionId: "session", projectId: "project", sceneId: "scene" }); });
        assert.equal(action, "stop"); finalized++;
        return { record: { sampleCount: 0, recording: { bytes: 42 } } };
      },
    });
    Object.assign(state.dictationView, { model: { ready: true }, runtime: { ready: true, recordingReady: true }, settings: { liveModelId: "model" }, permission: "granted", devices: [{ deviceId: "default" }] });
    const recording = controller.handle("dictation-record", {});
    let navigationReleased = false;
    const transition = controller.stop().then(() => { navigationReleased = true; });
    await Promise.resolve(); assert.equal(navigationReleased, false);
    // A route change during runtime/permission startup cannot outrun capture release and publication.
    releaseStart(); await Promise.all([recording, transition]);
    assert.equal(captureStopped, true); assert.equal(saved, true); assert.equal(finalized, 1);
    assert.equal(controller.isActive(), false);
    captureStopped = false; saved = false;
    await controller.handle("dictation-test", {});
    assert.equal(state.dictationView.testing, true);
    // Closing the settings surface releases a test without creating inference or saved output.
    await controller.stopTest();
    assert.equal(captureStopped, true); assert.equal(saved, false); assert.equal(finalized, 1);
    assert.equal(controller.isActive(), false);
    // Encoder/publication failures keep an explicit retry action available after the mic is released.
    assert.match(renderDictationPanel({ finalizationPending: true }), /data-action="dictation-stop" >Retry finalization/);
    // Finalization and package retries must not replay a manuscript transaction.
    let stopAttempts = 0, insertions = 0, saveAttempts = 0, releases = 0;
    const recoveryState = { ...state, workspace: { project: { id: "project" } } };
    const recovering = createDictationController({ state: recoveryState, render() {}, isFollowActive: () => false,
      inputFactory: () => ({ refresh: async () => {}, state: {} }),
      manuscript: { begin() {}, apply() { insertions++; }, finish() {}, isActive: () => false },
      beginCapture: async () => ({ device: {}, stop: async () => { releases++; } }),
      persistence: { async saveDictationSession(record) { if (++saveAttempts === 1) throw new Error("storage unavailable"); return record; } },
      request: async action => {
        if (action === "start") return { sessionId: "retry", projectId: "project", sceneId: "scene" };
        if (action === "acknowledge") return {};
        if (++stopAttempts === 1) throw new Error("encoder unavailable");
        return { record: { id: "retry", events: [], sampleCount: 16, recording: { bytes: 42 } } };
      },
    });
    Object.assign(recoveryState.dictationView, { model: { ready: true }, runtime: { ready: true, recordingReady: true }, settings: { liveModelId: "model", setupComplete: true }, permission: "granted", devices: [{ deviceId: "default" }] });
    await recovering.handle("dictation-record", {});
    await recovering.handle("dictation-stop", {});
    assert.equal(recoveryState.dictationView.finalizationPending, true);
    assert.equal(insertions, 0);
    await recovering.handle("dictation-stop", {});
    assert.equal(insertions, 1); assert.ok(recoveryState.dictationView.pending);
    await Promise.all([recovering.handle("dictation-save", {}), recovering.handle("dictation-save", {})]);
    assert.equal(insertions, 1); assert.equal(saveAttempts, 2); assert.equal(releases, 1); assert.equal(recoveryState.dictationView.pending, null);
  } finally {
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument;
    if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
  }
}
