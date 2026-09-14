// Intent: verify project activation effects are coordinated outside the editor shell.
import assert from "node:assert/strict";

import { createProjectActivationController } from "../apps/editor/public/state/project-activation-controller.js";
import { createProjectActivationStateService } from "../apps/editor/public/state/project-activation-state.js";
import { createProjectPersistenceService } from "../apps/editor/public/adapters/storage/project-persistence-service.js";

export async function runProjectActivationControllerTest() {
  const events = [];
  const state = {
    narrationTakeSelection: { id: "selection-old" },
    narrationTakeSession: { id: "session-old" },
    narrationRecordingReview: { recordingId: "take-old" },
    narrationRecordingPreviewId: "take-old",
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
    cleanupNarrationRecordingRuntime: (runtime) => {
      if (runtime?.timerId) {
        events.push("interval.clear");
      }
      if (runtime?.speechRecognition) {
        runtime.speechRecognition.stop();
      }
      if (runtime?.stream) {
        runtime.stream.getTracks().forEach((track) => track.stop());
      }
    },
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
    writePanelResizerLayoutProfiles: () => events.push("panel-layout-profiles.write"),
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
  assert.equal(state.narrationRecordingReview, null);
  assert.equal(state.narrationRecordingPreviewId, null);
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
  await assertProjectActivationDestinationBoundary();
}


// Exercise the real activation/state/persistence boundaries together. A final UI-only assertion
// misses an outgoing settings callback that silently rewrites the other Recent record's path.
async function assertProjectActivationDestinationBoundary() {
  const makeRecord = (letter, text) => ({
    id: 'project-' + letter, title: 'RECENT ' + letter,
    workspace: {
      project: { id: 'project-' + letter, title: 'RECENT ' + letter, chapters: [], stats: {} },
      world: { stats: {} },
    },
    sceneDrafts: { ['scene-' + letter]: { sceneId: 'scene-' + letter, editorText: text, blocks: [] } },
    projectSettings: {
      projectFilePath: 'C:\\Regression\\RECENT ' + letter,
      editorPrefs: { projectFileAutosaveEnabled: true }, writingTargetState: { revision: 0 },
    },
  });
  const a = makeRecord('A', 'ALPHA lighthouse');
  const b = makeRecord('B', 'BRAVO observatory');
  const records = new Map([a, b].map(record => [record.id, record]));
  const state = {
    activeProjectId: a.id, projectLibrarySelectionId: a.id, projectLibrary: structuredClone([a, b]),
    workspace: structuredClone(a.workspace), sceneDrafts: structuredClone(a.sceneDrafts),
    projectTitle: a.title, projectFilePath: a.projectSettings.projectFilePath,
    projectFileStorageMode: 'desktop-package', projectFileHandle: null,
    projectFileHandlePermission: '', projectFileAutosaveSuppressionDepth: 0,
    editorPrefs: { projectFileAutosaveEnabled: true }, writingTargetState: { revision: 0 },
  };
  const observations = [];
  let service;
  let controller;
  let revision = 0;
  const observe = (phase) => {
    const expected = records.get(state.workspace.project.id);
    assert.ok(expected, phase + ': expected a known active workspace');
    assert.equal(state.activeProjectId, expected.id, phase + ': identity and content must belong to one project');
    assert.equal(state.projectFilePath, expected.projectSettings.projectFilePath, phase + ': identity and destination must switch together');
    assert.deepEqual(state.sceneDrafts, expected.sceneDrafts, phase + ': manuscript belongs to the active project');
    observations.push({ phase, id: state.activeProjectId, filePath: state.projectFilePath });
  };
  const runtimeRecord = () => {
    const current = state.projectLibrary.find(record => record.id === state.workspace.project.id);
    return {
      ...structuredClone(current), workspace: structuredClone(state.workspace),
      sceneDrafts: structuredClone(state.sceneDrafts),
      projectSettings: {
        ...current.projectSettings, projectFilePath: state.projectFilePath,
        writingTargetState: { revision: ++revision },
      },
    };
  };
  const persistSettings = (phase) => {
    observe(phase);
    // Force the same canonical mutation that an outgoing writing-goals callback can make.
    service.commitCanonicalProjectMutation({ domain: 'writing-goals', skipProjectFileAutosave: true, source: phase });
  };
  const stateService = createProjectActivationStateService({
    state, createStructureDrafts: () => ({ scenes: [] }), createTemplateDrafts: () => [],
    normalizeManuscriptTasks: value => value ?? [], normalizePassageNotes: value => value ?? [],
    readRevisionState: () => ({}), createRevisionPanelStateForProject: () => ({}),
    buildProjectSettingsCandidate: record => record.projectSettings,
    normalizeProjectSettingsSnapshot: value => ({ ...value, localAiPrefs: {}, collapsedChapterIds: [], collapsedConsoleChapterIds: {} }),
    getProjectRecordWordCountForSettings: () => 2, normalizeSpellcheckProjectSettings: value => value ?? {},
  });
  service = createProjectPersistenceService({
    state, windowRef: { setTimeout: () => 1, clearTimeout() {} }, projectSchemaVersion: 2, autosaveDelayMs: 5,
    projectRepository: { saveActiveProjectId: () => observe('persist-active-id') },
    projectService: {
      saveProject({ projectRecord, librarySnapshot }) {
        return { librarySnapshot: {
          activeProjectId: projectRecord.id,
          projects: [...librarySnapshot.projects.filter(record => record.id !== projectRecord.id), projectRecord],
        } };
      },
      upsertProjectSnapshot(snapshot) {
        // Model the explicit project-scoped API; the physical lifecycle test uses the real repository.
        return {
          ...structuredClone(snapshot),
          projects: [...state.projectLibrary.filter(record => !snapshot.projects.some(incoming => incoming.id === record.id)), ...structuredClone(snapshot.projects)],
        };
      },
    },
    fetchJsonFromDesktopApi: async pathname => {
      assert.equal(pathname, '/api/settings');
      observe('desktop-path-preference');
      return { ok: true, value: {} };
    },
    createProjectRecordFromRuntimeState: runtimeRecord,
    getActiveProjectRecord: () => state.projectLibrary.find(record => record.id === state.activeProjectId),
    normalizeProjectLibrarySnapshot: structuredClone, normalizeProjectRecord: record => record,
    resolveActiveProjectId: (id, library) => id ?? library.projects[0].id,
    activateLoadedProjectRecord: ({ projectRecord, projectFileDestination }) => controller.activateProjectRecord(projectRecord, {
      projectFileDestination, renderAfter: true, recordSnapshot: true,
    }),
  });
  const targets = {};
  controller = createProjectActivationController({
    state, clone: structuredClone,
    applyProjectRecordToState: (record, options) => stateService.applyProjectRecordToState(record, options),
    persistActiveProjectId: id => service.persistActiveProjectId(id),
    saveWritingTargetState: () => persistSettings('outgoing-writing-settings'),
    clearWritingTargetDraft() {}, clearWritingTargetSnapshotTimer() {},
    clearProjectAutosaveState: () => service.clearProjectAutosaveState(),
    getNarrationRecordingRuntime: () => null, setNarrationRecordingRuntime() {},
    cleanupNarrationRecordingRuntime: () => observe('outgoing-media-cleanup'),
    getVoiceRecordingPreviewAudio: () => null, setVoiceRecordingPreviewAudio() {},
    getVoiceRecordingPreviewUrl: () => '', setVoiceRecordingPreviewUrl() {}, revokeObjectUrl() {},
    clearBinderTitleClickState() {}, writeProjectSourcePath() {}, writeBinderWidth() {}, writeConsoleWidth() {},
    writePanelResizerLayoutProfiles() {}, persistConsoleDockCollapsedState() {},
    persistCollapsedChapterState() {}, persistCollapsedConsoleChapterState() {},
    readWritingTargetStore: () => targets, writeWritingTargetStore() {},
    syncLegacyProjectStorageFromState: () => observe('incoming-compatibility-state'),
    logWritingTargetDebugEvent() {}, refreshScenes: () => observe('incoming-scenes'),
    restoreSelectionFromWorkspaceDefaults() {}, syncWritingTargetState: () => persistSettings('incoming-writing-settings'),
    refreshWritingTargetSessionLifecycle() {}, logWritingTargetLoadCheckpoint() {},
    render: () => observe('render'), recordWritingTargetSnapshot: () => persistSettings('incoming-snapshot'),
  });
  const assertTarget = (record) => {
    observe('final');
    service.primeProjectAutosaveTarget();
    assert.deepEqual(state.projectFileAutosaveTarget, {
      projectId: record.id, filePath: record.projectSettings.projectFilePath, fileHandle: null,
    });
    for (const original of [a, b]) {
      const stored = state.projectLibrary.find(candidate => candidate.id === original.id);
      assert.equal(stored.projectSettings.projectFilePath, original.projectSettings.projectFilePath, 'activation must not retarget the other Recent record');
    }
  };
  const recent = (record) => {
    const clickedId = record.id;
    persistSettings('before-recent-switch');
    controller.activateProjectRecord(state.projectLibrary.find(candidate => candidate.id === clickedId), {
      beforeRender: () => service.syncActiveProjectFileDestinationFromRecord({ persistDesktopProjectFilePath: true }),
      renderAfter: true, afterRender: () => service.primeProjectAutosaveTarget(), recordSnapshot: true,
    });
    assertTarget(record);
  };

  // The requested round trip must be correct at callbacks and in the final autosave target.
  recent(b);
  recent(a);
  assert.ok(observations.some(entry => entry.phase === 'incoming-snapshot' && entry.id === b.id));

  // Match the captured prerequisite: Open A from B must not poison B's Recent destination.
  recent(b);
  await service.hydrateProjectLibraryFromLoadedSnapshot({ activeProjectId: a.id, projects: [structuredClone(a)] }, {
    filePath: a.projectSettings.projectFilePath, mode: 'desktop-package', preserveProjectIdentity: true,
    reason: 'open-project-package',
  });
  assertTarget(a);
  recent(b);
  recent(a);
}
