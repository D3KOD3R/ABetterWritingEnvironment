// Intent: cover the storage adapters that keep project-file persistence out of the editor shell.
import assert from "node:assert/strict";

import { createProjectFileAutosaveController } from "../apps/editor/public/adapters/storage/autosave.js";
import { resolveProjectFileDisplayState } from "../apps/editor/public/adapters/storage/project-file-display.js";
import { buildProjectAutosaveStatusModel } from "../apps/editor/public/shared/project-autosave-status.js";
import {
  buildProjectFilePathFromRoot,
  ensureProjectFileHandleWritePermission,
  getProjectFileIdentity,
  getSuggestedProjectFileName,
  getSuggestedProjectFilePath,
  hasProjectFileDestination,
  hasProjectFilePath,
  normalizeProjectFilePath,
  pickProjectFileHandleForOpen,
  pickProjectFileHandleForSave,
  queryProjectFileHandleWritePermission,
  requestProjectFileHandleWritePermission,
  resolveLoadedProjectFileDestination,
} from "../apps/editor/public/adapters/storage/project-file.js";

export async function runProjectFileStorageAdaptersTest() {
  // Intent: lock down save destination precedence before exercising autosave state.
  assert.equal(normalizeProjectFilePath("  C:\\Projects\\Novel.abe-project.json  "), "C:\\Projects\\Novel.abe-project.json");
  assert.equal(hasProjectFilePath("Novel.abe-project.json"), false);
  assert.equal(hasProjectFilePath("C:\\Projects\\Novel"), true);
  assert.equal(hasProjectFilePath("\\\\server\\share\\Novel"), true);
  assert.equal(hasProjectFilePath("/tmp/Novel"), true);
  assert.equal(hasProjectFilePath("some/folder"), false);
  assert.equal(hasProjectFilePath("../Novel"), false);
  assert.equal(hasProjectFilePath("Novel.json"), false);
  assert.equal(hasProjectFileDestination({ filePath: "Novel.abe-project.json" }), false);
  assert.equal(hasProjectFileDestination({ fileHandle: { name: "Novel.abe-project.json" } }), true);
  assert.equal(getSuggestedProjectFileName("The Crown: Draft?"), "the-crown-draft.abe-project.json");
  assert.equal(
    getProjectFileIdentity("C:\\Projects\\OriginFileproject-serva-vitae.abe-project.json"),
    "OriginFileproject-serva-vitae",
  );
  assert.equal(
    getSuggestedProjectFilePath({
      projectTitle: "The Crown: Draft?",
      projectRoot: "C:\\Projects\\",
    }),
    "C:\\Projects\\the-crown-draft.abe-project.json",
  );
  assert.equal(
    buildProjectFilePathFromRoot("C:\\Projects\\", "novel.abe-project.json"),
    "C:\\Projects\\novel.abe-project.json",
  );
  assert.deepEqual(
    resolveLoadedProjectFileDestination({
      requestedFilePath: "C:\\Loaded\\new-project.abe-project.json",
      recordFilePath: "C:\\Old\\stale-project.abe-project.json",
    }),
    {
      filePath: "C:\\Loaded\\new-project.abe-project.json",
      fileHandle: null,
      isDurablePath: true,
    },
  );
  const browserHandle = { name: "new-project.abe-project.json" };
  assert.deepEqual(
    resolveLoadedProjectFileDestination({
      requestedFilePath: "",
      recordFilePath: "C:\\Old\\stale-project.abe-project.json",
      fileHandle: browserHandle,
    }),
    {
      filePath: "new-project.abe-project.json",
      fileHandle: browserHandle,
      isDurablePath: false,
    },
  );
  assert.deepEqual(
    resolveLoadedProjectFileDestination({
      requestedFilePath: "",
      recordFilePath: "C:\\Loaded\\new-project.abe-project.json",
      fileHandle: browserHandle,
    }),
    {
      filePath: "C:\\Loaded\\new-project.abe-project.json",
      fileHandle: browserHandle,
      isDurablePath: true,
    },
  );
  assert.deepEqual(
    resolveLoadedProjectFileDestination({
      requestedFilePath: "",
      recordFilePath: "C:\\Old\\stale-project.abe-project.json",
      fileHandle: null,
    }),
    {
      filePath: "",
      fileHandle: null,
      isDurablePath: false,
    },
  );
  const openHandle = await pickProjectFileHandleForOpen({
    windowRef: {
      showOpenFilePicker: async () => [{ name: "open-project.abe-project.json" }],
    },
  });
  assert.equal(openHandle?.name, "open-project.abe-project.json");
  const saveHandle = await pickProjectFileHandleForSave({
    suggestedName: "save-project.abe-project.json",
    windowRef: {
      showSaveFilePicker: async ({ suggestedName }) => ({ name: suggestedName }),
    },
  });
  assert.equal(saveHandle?.name, "save-project.abe-project.json");
  await assert.rejects(
    () => pickProjectFileHandleForOpen({ windowRef: {} }),
    /Open file picker API is unavailable/,
  );
  await assert.rejects(
    () => pickProjectFileHandleForSave({ windowRef: {} }),
    /Save file picker API is unavailable/,
  );
  const permissionedHandle = {
    name: "permissioned-project.abe-project.json",
    permissionStatus: "prompt",
    async queryPermission() {
      return this.permissionStatus;
    },
    async requestPermission() {
      this.permissionStatus = "granted";
      return this.permissionStatus;
    },
  };
  assert.equal(await queryProjectFileHandleWritePermission(permissionedHandle), "prompt");
  assert.equal(await ensureProjectFileHandleWritePermission(permissionedHandle), false);
  assert.equal(await requestProjectFileHandleWritePermission(permissionedHandle), "granted");
  assert.equal(await ensureProjectFileHandleWritePermission(permissionedHandle), true);
  const directRequestHandle = {
    name: "permissioned-project.abe-project.json",
    permissionStatus: "prompt",
    queryCount: 0,
    requestCount: 0,
    async queryPermission() {
      this.queryCount += 1;
      return this.permissionStatus;
    },
    async requestPermission() {
      this.requestCount += 1;
      this.permissionStatus = "granted";
      return this.permissionStatus;
    },
  };
  assert.equal(await requestProjectFileHandleWritePermission(directRequestHandle), "granted");
  assert.equal(directRequestHandle.queryCount, 0);
  assert.equal(directRequestHandle.requestCount, 1);
  assert.deepEqual(
    resolveProjectFileDisplayState({
      projectFilePath: "new-project.abe-project.json",
      projectFileHandle: browserHandle,
      projectLibrary: [
        {
          id: "project-1",
          projectSettings: {
            projectFilePath: "C:\\Loaded\\new-project.abe-project.json",
          },
        },
      ],
      activeProjectId: "project-1",
    }),
    {
      displayName: "new-project.abe-project.json",
      inputValue: "C:\\Loaded\\new-project.abe-project.json",
      pathLabel: "C:\\Loaded\\new-project.abe-project.json",
      tooltip: "C:\\Loaded\\new-project.abe-project.json",
    },
  );
  assert.deepEqual(
    resolveProjectFileDisplayState({
      projectFilePath: "new-project.abe-project.json",
      projectFileHandle: browserHandle,
      projectLibrary: [
        {
          id: "project-1",
          projectSettings: {
            projectFilePath: "C:\\Loaded\\different-project.abe-project.json",
          },
        },
      ],
      activeProjectId: "project-1",
    }),
    {
      displayName: "new-project.abe-project.json",
      inputValue: "",
      pathLabel: "",
      tooltip: "new-project.abe-project.json",
    },
  );

  // Intent: verify autosave dirty state writes only to the active file target.
  const state = createAutosaveState();
  const timer = createFakeTimer();
  let saveCount = 0;
  let status = "";
  let renderCount = 0;

  const controller = createProjectFileAutosaveController({
    state,
    delayMs: 250,
    windowRef: timer.windowRef,
    getTarget: () => ({ projectId: "project-1", filePath: "C:\\Projects\\novel.abe-project.json", fileHandle: null }),
    hasDestination: () => true,
    isBusy: () => false,
    isEnabled: () => true,
    save: async () => {
      saveCount += 1;
    },
    setStatus: (nextStatus) => {
      status = nextStatus;
    },
    renderStatus: () => {
      renderCount += 1;
    },
  });

  controller.prime();
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveRevision, 0);
  assert.equal(timer.scheduled, null);
  assert.deepEqual(state.projectFileAutosaveTarget, {
    projectId: "project-1",
    filePath: "C:\\Projects\\novel.abe-project.json",
    fileHandle: null,
  });

  controller.markDirty();
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveRevision, 1);
  assert.equal(timer.scheduled?.delayMs, 250);

  await controller.flush();
  assert.equal(saveCount, 1);
  assert.equal(status, "Autosaving project file...");
  assert.equal(renderCount, 1);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveRevision, 0);

  // Intent: explicit row-assignment flushes that arrive during an in-flight save must persist the accumulated state immediately.
  const sequentialState = createAutosaveState();
  const sequentialTimer = createFakeTimer();
  const livePlacements = {};
  let persistedPlacements = {};
  let sequentialSaveCount = 0;
  let sequentialSaveBusy = false;
  let releaseFirstSequentialSave;
  let announceFirstSequentialSave;
  const firstSequentialSaveStarted = new Promise((resolve) => {
    announceFirstSequentialSave = resolve;
  });
  const firstSequentialSaveGate = new Promise((resolve) => {
    releaseFirstSequentialSave = resolve;
  });
  const sequentialController = createProjectFileAutosaveController({
    state: sequentialState,
    delayMs: 250,
    windowRef: sequentialTimer.windowRef,
    getTarget: () => ({ projectId: "project-rows", filePath: "C:\\Projects\\rows.abe-project.json", fileHandle: null }),
    hasDestination: () => true,
    isBusy: () => sequentialSaveBusy,
    isEnabled: () => true,
    save: async () => {
      sequentialSaveCount += 1;
      const saveNumber = sequentialSaveCount;
      const snapshot = structuredClone(livePlacements);
      sequentialSaveBusy = true;
      if (saveNumber === 1) {
        announceFirstSequentialSave();
        await firstSequentialSaveGate;
      }
      persistedPlacements = snapshot;
      sequentialSaveBusy = false;
    },
    setStatus: () => {},
    renderStatus: () => {},
  });
  livePlacements["scene-a"] = "earth";
  sequentialController.markDirty({ domain: "manuscript", reason: "scene-a-row", source: "test" });
  const firstSequentialFlush = sequentialController.flush();
  await firstSequentialSaveStarted;
  livePlacements["scene-b"] = "earth";
  sequentialController.markDirty({ domain: "manuscript", reason: "scene-b-row", source: "test" });
  await sequentialController.flush();
  livePlacements["scene-c"] = "mars";
  sequentialController.markDirty({ domain: "manuscript", reason: "scene-c-row", source: "test" });
  await sequentialController.flush();
  releaseFirstSequentialSave();
  await firstSequentialFlush;
  assert.equal(sequentialSaveCount, 2);
  assert.deepEqual(persistedPlacements, {
    "scene-a": "earth",
    "scene-b": "earth",
    "scene-c": "mars",
  });
  assert.equal(sequentialState.projectFileAutosaveDirty, false);

  // Intent: project transitions must wait for both an active write and its accumulated follow-up write.
  const drainState = createAutosaveState();
  const drainTimer = createFakeTimer();
  let drainSaveCount = 0;
  let releaseFirstDrainSave;
  let releaseSecondDrainSave;
  let announceFirstDrainSave;
  let announceSecondDrainSave;
  const firstDrainSaveStarted = new Promise((resolve) => {
    announceFirstDrainSave = resolve;
  });
  const secondDrainSaveStarted = new Promise((resolve) => {
    announceSecondDrainSave = resolve;
  });
  const firstDrainSaveGate = new Promise((resolve) => {
    releaseFirstDrainSave = resolve;
  });
  const secondDrainSaveGate = new Promise((resolve) => {
    releaseSecondDrainSave = resolve;
  });
  const drainController = createProjectFileAutosaveController({
    state: drainState,
    delayMs: 250,
    windowRef: drainTimer.windowRef,
    getTarget: () => ({ projectId: "project-drain", filePath: "C:\\Projects\\drain", fileHandle: null }),
    hasDestination: () => true,
    isBusy: () => false,
    isEnabled: () => true,
    save: async () => {
      drainSaveCount += 1;
      if (drainSaveCount === 1) {
        announceFirstDrainSave();
        await firstDrainSaveGate;
      } else {
        announceSecondDrainSave();
        await secondDrainSaveGate;
      }
    },
    setStatus: () => {},
    renderStatus: () => {},
  });
  drainController.markDirty({ domain: "manuscript", reason: "first-edit", source: "test" });
  const activeDrainFlush = drainController.flush();
  await firstDrainSaveStarted;
  drainController.markDirty({ domain: "world", reason: "second-edit", source: "test" });
  let drainResolved = false;
  const transitionDrain = drainController.drain().then(() => {
    drainResolved = true;
  });
  await Promise.resolve();
  assert.equal(drainResolved, false);
  releaseFirstDrainSave();
  await secondDrainSaveStarted;
  assert.equal(drainResolved, false);
  releaseSecondDrainSave();
  await Promise.all([activeDrainFlush, transitionDrain]);
  assert.equal(drainSaveCount, 2);
  assert.equal(drainResolved, true);
  assert.equal(drainState.projectFileAutosaveDirty, false);

  // Cache-only fallback must leave the project file dirty and visibly out of sync.
  controller.markDirty({
    domain: "passage-notes",
    reason: "inspiration-note-edited",
    source: "test",
  });
  controller.block({
    reason: "write-permission-required",
  });
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked?.reason, "write-permission-required");
  assert.equal(timer.scheduled, null);
  assert.deepEqual(
    buildProjectAutosaveStatusModel({
      ...state,
      editorPrefs: {
        projectFileAutosaveEnabled: true,
      },
    }, {
      connected: true,
    }),
    {
      label: "Autosave",
      statusKey: "permission-required",
      statusLabel: "Needs permission",
      note: "Project file is out of sync. Latest changes are preserved in browser cache; press Ctrl+S to re-authorize.",
      tone: "waiting",
      toneClass: "is-waiting",
    },
  );
  assert.deepEqual(
    buildProjectAutosaveStatusModel({
      ...state,
      projectFileAutosaveDirty: true,
      projectFileAutosaveBlocked: {
        reason: "write-permission-required",
      },
      projectPersistenceDirtyDomains: {},
      editorPrefs: {
        projectFileAutosaveEnabled: true,
      },
    }, {
      connected: true,
    }),
    {
      label: "Autosave",
      statusKey: "ready",
      statusLabel: "Ready",
      note: "Project file is in sync.",
      tone: "ready",
      toneClass: "is-ready",
    },
  );
  assert.deepEqual(
    buildProjectAutosaveStatusModel({
      ...state,
      projectFileAutosaveDirty: true,
      projectFileAutosaveBlocked: {
        reason: "manual-save-required",
      },
      projectPersistenceDirtyDomains: {
        manuscript: {
          reason: "browser-background-write-blocked",
        },
      },
      editorPrefs: {
        projectFileAutosaveEnabled: true,
      },
    }, {
      connected: true,
    }),
    {
      label: "Autosave",
      statusKey: "manual-save-required",
      statusLabel: "Manual save",
      note: "Browser blocked background file writes. Latest changes are preserved in browser cache; press Ctrl+S to write the project file.",
      tone: "waiting",
      toneClass: "is-waiting",
    },
  );
  assert.deepEqual(
    buildProjectAutosaveStatusModel({
      ...state,
      projectFileAutosaveDirty: true,
      projectFileAutosaveBlocked: {
        reason: "write-failed",
        errorMessage: "Project file verification failed: browser-handle at novel.abe-project.json does not contain the latest project snapshot.",
      },
      projectPersistenceDirtyDomains: {
        world: {
          reason: "world-spine-location-renamed",
        },
      },
      editorPrefs: {
        projectFileAutosaveEnabled: true,
      },
    }, {
      connected: true,
    }),
    {
      label: "Autosave",
      statusKey: "out-of-sync",
      statusLabel: "Out of sync",
      note: "Project file is out of sync: Project file verification failed: browser-handle at novel.abe-project.json does not contain the latest project snapshot. Latest changes are preserved in browser cache; press Ctrl+S to retry.",
      tone: "waiting",
      toneClass: "is-waiting",
    },
  );
  controller.clearState();

  const staleBlockState = createAutosaveState();
  const staleBlockController = createProjectFileAutosaveController({
    state: staleBlockState,
    delayMs: 250,
    windowRef: createFakeTimer().windowRef,
    getTarget: () => ({ projectId: "project-1", filePath: "C:\\Projects\\project.abe-project.json", fileHandle: null }),
    hasDestination: () => true,
    isBusy: () => false,
    isEnabled: () => true,
    save: async () => {},
    setStatus: () => {},
    renderStatus: () => {},
  });
  staleBlockController.block({
    reason: "write-permission-required",
  });
  assert.equal(staleBlockState.projectFileAutosaveDirty, false);
  assert.equal(staleBlockState.projectFileAutosaveBlocked, null);

  const manualBlockState = createAutosaveState();
  const manualBlockTimer = createFakeTimer();
  const manualBlockController = createProjectFileAutosaveController({
    state: manualBlockState,
    delayMs: 250,
    windowRef: manualBlockTimer.windowRef,
    getTarget: () => ({ projectId: "project-1", filePath: "project.abe-project.json", fileHandle: browserHandle }),
    hasDestination: () => true,
    isBusy: () => false,
    isEnabled: () => true,
    save: async () => {},
    setStatus: () => {},
    renderStatus: () => {},
  });
  manualBlockController.markDirty({
    domain: "manuscript",
    reason: "first-edit",
    source: "test",
  });
  manualBlockController.block({
    reason: "manual-save-required",
  });
  assert.equal(manualBlockState.projectFileAutosaveBlocked?.reason, "manual-save-required");
  manualBlockController.markDirty({
    domain: "manuscript",
    reason: "second-edit",
    source: "test",
  });
  assert.equal(manualBlockState.projectFileAutosaveBlocked, null);
  assert.equal(manualBlockTimer.scheduled?.delayMs, 250);

  controller.beginSuppression();
  controller.markDirty();
  assert.equal(timer.scheduled, null);
  controller.endSuppression();
  assert.equal(timer.scheduled?.delayMs, 250);

  const redirectedState = createAutosaveState();
  let activeTarget = { projectId: "project-1", filePath: "C:\\Old\\project.abe-project.json", fileHandle: null };
  let redirectedSaveCount = 0;
  const redirectedController = createProjectFileAutosaveController({
    state: redirectedState,
    delayMs: 250,
    windowRef: createFakeTimer().windowRef,
    getTarget: () => activeTarget,
    hasDestination: () => true,
    isBusy: () => false,
    isEnabled: () => true,
    save: async () => {
      redirectedSaveCount += 1;
    },
    setStatus: () => {},
    renderStatus: () => {},
  });

  redirectedController.markDirty();
  activeTarget = { projectId: "project-2", filePath: "C:\\New\\project.abe-project.json", fileHandle: null };
  await redirectedController.flush();
  assert.equal(redirectedSaveCount, 0);
  assert.equal(redirectedState.projectFileAutosaveDirty, false);

  redirectedController.markDirty();
  assert.deepEqual(redirectedState.projectFileAutosaveTarget, activeTarget);
}

function createAutosaveState() {
  return {
    projectFileAutosaveDirty: false,
    projectFileAutosaveBlocked: null,
    projectFileAutosaveTarget: null,
    projectFileAutosaveTimer: null,
    projectFileAutosaveRevision: 0,
    projectFileAutosaveSuppressionDepth: 0,
  };
}

function createFakeTimer() {
  const timer = {
    scheduled: null,
    clearedIds: [],
  };

  timer.windowRef = {
    setTimeout(callback, delayMs) {
      timer.scheduled = {
        callback,
        delayMs,
        id: `timer-${timer.clearedIds.length + 1}`,
      };
      return timer.scheduled.id;
    },
    clearTimeout(id) {
      timer.clearedIds.push(id);
      if (timer.scheduled?.id === id) {
        timer.scheduled = null;
      }
    },
  };

  return timer;
}
