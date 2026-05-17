// Intent: verify ProjectPersistenceService owns save/load/autosave/restore flows behind a single boundary.
import assert from "node:assert/strict";

import { createProjectPersistenceService } from "../apps/editor/public/adapters/storage/project-persistence-service.js";

export async function runProjectPersistenceServiceTest() {
  const windowRef = createFakeWindowRef();
  const operationLog = [];
  const activationLog = [];
  const activeProjectWrites = [];
  const browserCacheWrites = [];
  const browserLogs = [];
  let runtimeWritingTargetState = null;

  const projectRecord = createProjectRecord();
  const loadedRecord = createLoadedProjectRecord();

  const state = {
    activeProjectId: "project-1",
    projectLibrarySelectionId: "project-1",
    projectLibrary: [projectRecord],
    projectTitle: "Project 1",
    projectFileHandle: createFakeWritableHandle("project-1.abe-project.json", operationLog),
    projectFileHandlePermission: "granted",
    projectFilePath: "project-1.abe-project.json",
    projectFileStatus: "",
    projectFileBusy: false,
    projectFileAutosaveDirty: false,
    projectFileAutosaveTarget: null,
    projectFileAutosaveTimer: null,
    projectFileAutosaveRevision: 0,
    projectFileAutosaveSuppressionDepth: 0,
    projectCacheSuppressionDepth: 0,
    editorPrefs: {
      projectFileAutosaveEnabled: true,
    },
    workspace: {
      project: {
        id: "project-1",
        title: "Project 1",
        stats: {
          chapterCount: 1,
          sceneCount: 1,
        },
      },
      world: {
        stats: {
          templateCount: 0,
        },
      },
      selectionDefaults: {},
    },
  };

  const fetchCalls = [];
  const projectService = createFakeProjectService(projectRecord, loadedRecord, browserCacheWrites);
  const projectRepository = {
    loadActiveProjectId: () => state.activeProjectId,
    saveActiveProjectId: (projectId) => {
      activeProjectWrites.push(projectId);
    },
  };
  const fetchJsonFromDesktopApi = async (pathname, requestOptions = {}) => {
    fetchCalls.push({
      pathname,
      requestOptions,
    });
    if (pathname === "/api/project-file/load") {
      return {
        ok: true,
        value: {
          activeProjectId: "project-loaded",
          projects: [loadedRecord],
        },
      };
    }
    if (pathname === "/api/project-file/save") {
      return {
        ok: true,
        value: {
          filePath: requestOptions.body?.filePath ?? "",
        },
      };
    }
    if (pathname === "/api/settings") {
      return {
        ok: true,
        value: {},
      };
    }

    return {
      ok: false,
      error: new Error(`Unhandled desktop API pathname: ${pathname}`),
    };
  };

  const projectPersistenceService = createProjectPersistenceService({
    state,
    windowRef,
    projectService,
    projectRepository,
    fetchJsonFromDesktopApi,
    projectSchemaVersion: 2,
    autosaveDelayMs: 5000,
    shouldPersistProjectCache: () => state.projectCacheSuppressionDepth === 0,
    writeProjectFilePathCache: () => {},
    createProjectRecordFromRuntimeState: () => ({
      ...projectRecord,
      projectSettings: {
        ...(projectRecord.projectSettings ?? {}),
        projectFilePath: state.projectFilePath,
        writingTargetState: runtimeWritingTargetState,
      },
    }),
    getActiveProjectRecord: () =>
      state.projectLibrary.find((project) => project.id === (state.activeProjectId ?? state.projectLibrarySelectionId)) ?? null,
    normalizeProjectLibrarySnapshot: (candidate) => ({
      activeProjectId: candidate?.activeProjectId ?? null,
      projects: Array.isArray(candidate?.projects) ? candidate.projects : [],
      sceneStore: candidate?.sceneStore ?? {},
    }),
    normalizeProjectRecord: (candidate) => candidate ?? null,
    resolveActiveProjectId: (candidate, library) =>
      candidate ?? library?.projects?.[0]?.id ?? null,
    activateLoadedProjectRecord: ({ projectRecord: record, reason }) => {
      activationLog.push({
        projectId: record.id,
        reason,
        projectFilePath: state.projectFilePath,
        hasProjectFileHandle: Boolean(state.projectFileHandle),
      });
      state.workspace = record.workspace;
      state.projectTitle = record.title;
    },
    prepareProjectSnapshotForSave: () => {
      operationLog.push("prepare-save");
    },
    reportBrowserLog: (level, source, message, context) => {
      browserLogs.push({
        level,
        source,
        message,
        context,
      });
    },
    renderHeader: () => {},
    resolveSuggestedProjectFileName: () => "project-1.abe-project.json",
    loggerSources: {},
  });

  // Manual save should route through the service and write to the active browser handle.
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  projectPersistenceService.clearProjectAutosaveState();

  // Failed external writes must still preserve the latest project in browser-backed project storage.
  operationLog.length = 0;
  browserCacheWrites.length = 0;
  browserLogs.length = 0;
  const failingHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    failWrite: true,
  });
  state.projectFileHandle = failingHandle;
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(browserCacheWrites.length >= 1, true);
  assert.match(state.projectFileStatus, /Latest project preserved in browser cache/);
  assert.equal(
    browserLogs.some(
      (entry) =>
        entry.message === "Preserved current project in browser cache after file save failure."
        && entry.context?.target === "browser-handle-fallback",
    ),
    true,
  );
  assert.equal(
    browserLogs.some(
      (entry) =>
        entry.message === "Saved current project to library."
        && entry.context?.target === "browser-handle",
    ),
    false,
  );
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();

  // Autosave should run through the same persistence service boundary.
  operationLog.length = 0;
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "project",
    reason: "test-explicit-dirty",
    source: "test",
  });
  await projectPersistenceService.flushProjectAutosave();
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveRevision, 0);

  // Loading a snapshot should hydrate state and activate the loaded record through the callback.
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-loaded",
    projects: [loadedRecord],
  }, {
    filePath: "C:\\Projects\\loaded.abe-project.json",
    reason: "load-project-file",
    sourceLabel: "desktop file",
    mode: "desktop-path",
  });
  assert.equal(state.activeProjectId, "loaded");
  assert.equal(state.projectFilePath, "C:\\Projects\\loaded.abe-project.json");
  assert.equal(activationLog.at(-1)?.projectId, "loaded");
  assert.equal(state.projectLibrary.find((project) => project.id === "loaded")?.title, "loaded");
  assert.equal(activeProjectWrites.includes("loaded"), true);

  // The service should be able to recover the durable destination from the canonical record alone.
  state.projectFilePath = "";
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  projectPersistenceService.syncActiveProjectFileDestinationFromRecord();
  assert.equal(state.projectFilePath, "C:\\Projects\\loaded.abe-project.json");

  // Browser-handle loads should expose the filename before activation renders and keep a re-openable handle.
  const browserHandle = createFakeWritableHandle("OriginFileproject-serva-vitae.abe-project.json", operationLog);
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-loaded",
    projects: [loadedRecord],
  }, {
    filePath: "",
    fileName: browserHandle.name,
    fileHandle: browserHandle,
    reason: "load-project-file",
    sourceLabel: "browser file",
    mode: "browser-handle",
  });
  assert.equal(state.activeProjectId, "OriginFileproject-serva-vitae");
  assert.equal(state.projectFilePath, "OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(state.projectFileHandle, browserHandle);
  assert.equal(state.projectFileHandlePermission, "granted");
  assert.equal(activationLog.at(-1)?.projectFilePath, "OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(activationLog.at(-1)?.hasProjectFileHandle, true);
  assert.equal(
    state.projectLibrary.find((project) => project.id === "OriginFileproject-serva-vitae")?.projectSettings?.projectFilePath,
    "OriginFileproject-serva-vitae.abe-project.json",
  );

  // Filename-only records should still hydrate display identity without pretending to have a durable path.
  state.projectFilePath = "";
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  projectPersistenceService.syncActiveProjectFileDestinationFromRecord();
  assert.equal(state.projectFilePath, "OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(projectPersistenceService.hasProjectSaveDestination(), false);

  // Restore-last-opened flow should hit desktop load/settings routes and keep persistence state coherent.
  await projectPersistenceService.restoreLastOpenedProject({
    lastProjectFilePathExplicit: true,
    lastProjectFilePath: "C:\\Projects\\loaded.abe-project.json",
    projectRoot: "C:\\Projects",
  });
  assert.equal(
    fetchCalls.some((call) => call.pathname === "/api/project-file/load"),
    true,
  );
  assert.equal(
    fetchCalls.some((call) => call.pathname === "/api/settings"),
    true,
  );
}

function createFakeProjectService(projectRecord, loadedRecord, browserCacheWrites = []) {
  return {
    saveProject({ projectRecord: incomingRecord, librarySnapshot }) {
      const nextRecord = incomingRecord ?? projectRecord;
      return {
        librarySnapshot: {
          activeProjectId: nextRecord.id,
          projects: [nextRecord],
        },
      };
    },
    saveProjectLibrarySnapshot(snapshot) {
      browserCacheWrites.push(snapshot);
      return snapshot;
    },
    exportProjectLibrarySnapshot() {
      return {
        schemaVersion: 2,
        activeProjectId: loadedRecord.id,
        projects: [loadedRecord],
        sceneStore: {},
      };
    },
  };
}

function createProjectRecord() {
  return {
    id: "project-1",
    title: "Project 1",
    source: "test",
    workspace: {
      project: {
        id: "project-1",
        title: "Project 1",
        stats: {
          chapterCount: 1,
          sceneCount: 1,
        },
      },
      world: {
        stats: {
          templateCount: 0,
        },
      },
      selectionDefaults: {},
    },
    projectSettings: {
      projectFilePath: "project-1.abe-project.json",
    },
  };
}

function createLoadedProjectRecord() {
  return {
    id: "project-loaded",
    title: "Loaded Project",
    source: "test",
    workspace: {
      project: {
        id: "project-loaded",
        title: "Loaded Project",
        stats: {
          chapterCount: 2,
          sceneCount: 3,
        },
      },
      world: {
        stats: {
          templateCount: 1,
        },
      },
      selectionDefaults: {},
    },
    projectSettings: {
      projectFilePath: "C:\\Projects\\loaded.abe-project.json",
    },
  };
}

function createFakeWritableHandle(name, operationLog, options = {}) {
  return {
    name,
    permissionStatus: "granted",
    async queryPermission() {
      return this.permissionStatus;
    },
    async requestPermission() {
      this.permissionStatus = "granted";
      return this.permissionStatus;
    },
    async createWritable() {
      if (options.failWrite === true) {
        throw new Error("Simulated project file write failure.");
      }

      return {
        async write(value) {
          operationLog.push(`write:${String(value).length}`);
        },
        async close() {
          operationLog.push("close");
        },
      };
    },
    async getFile() {
      return {
        name,
        async text() {
          return JSON.stringify({
            activeProjectId: "project-loaded",
            projects: [createLoadedProjectRecord()],
          });
        },
      };
    },
  };
}

function createFakeWindowRef() {
  let timerId = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delayMs) {
      timerId += 1;
      timers.set(timerId, {
        callback,
        delayMs,
      });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
}
