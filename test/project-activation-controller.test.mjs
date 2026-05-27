// Intent: verify project activation effects are coordinated outside the editor shell.
import assert from "node:assert/strict";

import { createProjectActivationController } from "../apps/editor/public/state/project-activation-controller.js";

export function runProjectActivationControllerTest() {
  const events = [];
  const state = {
    narrationTakeSelection: { id: "selection-old" },
    narrationTakeSession: { id: "session-old" },
    sceneDrafts: {},
    writingTargetState: null,
    selectedSceneId: "scene-old",
  };
  let narrationRuntime = {
    timerId: 14,
    speechRecognition: {
      stop() {
        events.push("speech.stop");
      },
    },
    stream: {
      getTracks() {
        return [{
          stop() {
            events.push("track.stop");
          },
        }];
      },
    },
  };
  let previewAudio = {
    pause() {
      events.push("preview.pause");
    },
  };
  let previewUrl = "blob:preview";
  const store = {};
  const controller = createProjectActivationController({
    state,
    clone: structuredClone,
    applyProjectRecordToState: (record) => {
      events.push("state.hydrate");
      state.sceneDrafts = record.sceneDrafts;
      state.writingTargetState = { history: [] };
      state.selectedSceneId = "scene-1";
    },
    persistActiveProjectId: () => events.push("active.persist"),
    saveWritingTargetState: () => events.push("writing.save"),
    clearWritingTargetDraft: () => events.push("writing.draft.clear"),
    clearWritingTargetSnapshotTimer: () => events.push("writing.timer.clear"),
    clearProjectAutosaveState: () => events.push("autosave.clear"),
    getNarrationRecordingRuntime: () => narrationRuntime,
    setNarrationRecordingRuntime: (value) => {
      narrationRuntime = value;
      events.push("narration.runtime.clear");
    },
    clearIntervalFn: () => events.push("interval.clear"),
    getVoiceRecordingPreviewAudio: () => previewAudio,
    setVoiceRecordingPreviewAudio: (value) => {
      previewAudio = value;
    },
    getVoiceRecordingPreviewUrl: () => previewUrl,
    setVoiceRecordingPreviewUrl: (value) => {
      previewUrl = value;
    },
    revokeObjectUrl: () => events.push("preview.url.revoke"),
    clearBinderTitleClickState: () => events.push("binder.click.clear"),
    writeProjectSourcePath: () => events.push("source-path.write"),
    writeBinderWidth: () => events.push("binder-width.write"),
    writeConsoleWidth: () => events.push("console-width.write"),
    persistConsoleDockCollapsedState: () => events.push("dock.write"),
    persistCollapsedChapterState: () => events.push("chapters.write"),
    persistCollapsedConsoleChapterState: () => events.push("console-chapters.write"),
    readWritingTargetStore: () => store,
    writeWritingTargetStore: () => events.push("targets.write"),
    syncLegacyProjectStorageFromState: () => events.push("legacy.sync"),
    logWritingTargetDebugEvent: () => events.push("writing.log"),
    projectLoadGateLog: { info: () => events.push("load.log") },
    manuscriptStateLog: { info: () => events.push("state.log") },
    refreshScenes: () => events.push("scenes.refresh"),
    restoreSelectionFromWorkspaceDefaults: () => events.push("selection.restore"),
    syncWritingTargetState: () => events.push("targets.sync"),
    refreshWritingTargetSessionLifecycle: () => events.push("lifecycle.refresh"),
    logWritingTargetLoadCheckpoint: () => events.push("load.checkpoint"),
    render: () => events.push("render"),
    recordWritingTargetSnapshot: () => events.push("snapshot"),
  });

  controller.activateProjectRecord({
    id: "project-1",
    title: "Project One",
    sceneDrafts: { "scene-1": { editorText: "Text." } },
  }, {
    reason: "load-project",
    refreshSessionLifecycle: true,
    logLoadCheckpoint: true,
    beforeRender: () => events.push("before.render"),
    renderAfter: true,
    afterRender: () => events.push("after.render"),
    recordSnapshot: true,
  });

  assert.equal(narrationRuntime, null);
  assert.equal(previewAudio, null);
  assert.equal(previewUrl, null);
  assert.deepEqual(store["project-1"], { history: [] });
  assert.equal(events.indexOf("writing.save") < events.indexOf("state.hydrate"), true);
  assert.equal(events.indexOf("state.hydrate") < events.indexOf("legacy.sync"), true);
  assert.equal(events.indexOf("scenes.refresh") < events.indexOf("selection.restore"), true);
  assert.equal(events.indexOf("selection.restore") < events.indexOf("targets.sync"), true);
  assert.equal(events.indexOf("before.render") < events.indexOf("render"), true);
  assert.equal(events.indexOf("render") < events.indexOf("after.render"), true);
  assert.equal(events.indexOf("after.render") < events.indexOf("snapshot"), true);
  assert.equal(events.includes("speech.stop"), true);
  assert.equal(events.includes("track.stop"), true);
  assert.equal(events.includes("preview.pause"), true);
  assert.equal(events.includes("preview.url.revoke"), true);

  assert.throws(() => controller.applyProjectRecord(null), /Unable to load a saved project/);
}
