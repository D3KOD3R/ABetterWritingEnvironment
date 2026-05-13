// Intent: cover the storage adapters that keep project-file persistence out of the editor shell.
import assert from "node:assert/strict";

import { createProjectFileAutosaveController } from "../apps/editor/public/adapters/storage/autosave.js";
import { resolveProjectFileDisplayState } from "../apps/editor/public/adapters/storage/project-file-display.js";
import {
  buildProjectFilePathFromRoot,
  getSuggestedProjectFileName,
  getSuggestedProjectFilePath,
  hasProjectFileDestination,
  hasProjectFilePath,
  normalizeProjectFilePath,
  resolveLoadedProjectFileDestination,
} from "../apps/editor/public/adapters/storage/project-file.js";

export async function runProjectFileStorageAdaptersTest() {
  // Intent: lock down save destination precedence before exercising autosave state.
  assert.equal(normalizeProjectFilePath("  C:\\Projects\\Novel.abe-project.json  "), "C:\\Projects\\Novel.abe-project.json");
  assert.equal(hasProjectFilePath("Novel.abe-project.json"), false);
  assert.equal(hasProjectFilePath("C:\\Projects\\Novel.abe-project.json"), true);
  assert.equal(hasProjectFileDestination({ filePath: "Novel.abe-project.json" }), false);
  assert.equal(hasProjectFileDestination({ fileHandle: { name: "Novel.abe-project.json" } }), true);
  assert.equal(getSuggestedProjectFileName("The Crown: Draft?"), "the-crown-draft.abe-project.json");
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
      tooltip: "Project file path unavailable. Use Save as file with a full path to set one.",
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
