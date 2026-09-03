// Intent: verify ProjectPersistenceService owns save/load/autosave/restore flows behind a single boundary.
import assert from "node:assert/strict";

import { createProjectPersistenceService } from "../apps/editor/public/adapters/storage/project-persistence-service.js";
import {
  getProjectFileIdentity,
  getSuggestedProjectFileName,
} from "../apps/editor/public/adapters/storage/project-file.js";

export async function runProjectPersistenceServiceTest() {
  const windowRef = createFakeWindowRef();
  const operationLog = [];
  const activationLog = [];
  const activeProjectWrites = [];
  const browserCacheWrites = [];
  const browserCacheClears = [];
  const browserLogs = [];
  const browserHandleWrites = [];
  let runtimeWritingTargetState = null;
  let runtimePassageNotes = [];
  let runtimeManuscriptTasks = [];

  const projectRecord = createProjectRecord();
  const loadedRecord = createLoadedProjectRecord();

  const state = {
    activeProjectId: "project-1",
    projectLibrarySelectionId: "project-1",
    projectLibrary: [projectRecord],
    projectTitle: "Project 1",
    projectFileHandle: createFakeWritableHandle("project-1.abe-project.json", operationLog, {
      writtenValues: browserHandleWrites,
    }),
    projectFileHandlePermission: "granted",
    projectFilePath: "project-1.abe-project.json",
    projectFileStatus: "",
    projectFileBusy: false,
    projectFileAutosaveDirty: false,
    projectFileAutosaveBlocked: null,
    projectFileAutosaveTarget: null,
    projectFileAutosaveTimer: null,
    projectFileAutosaveRevision: 0,
    projectFileAutosaveSuppressionDepth: 0,
    projectCacheSuppressionDepth: 0,
    editorPrefs: {
      projectFileAutosaveEnabled: true,
    },
    worldSpineUnplacedDockCollapsed: false,
    activePane: "manuscript",
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
      selectionDefaults: {
        sceneId: "scene-1",
        sceneSelectionBlockId: "block-1",
        sceneSelectionLineNumber: 7,
        sceneSelectionStart: 7,
        sceneSelectionEnd: 14,
        sceneSelectionScrollTop: 240,
        sceneSelectionScrollLeft: 8,
      },
      sceneId: "scene-1",
    },
  };

  const fetchCalls = [];
  const desktopFileSnapshots = new Map();
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
      const filePath = requestOptions.body?.filePath ?? "";
      if (desktopFileSnapshots.has(filePath)) {
        return {
          ok: true,
          value: structuredClone(desktopFileSnapshots.get(filePath)),
        };
      }
      return {
        ok: true,
        value: {
          activeProjectId: "project-loaded",
          projects: [loadedRecord],
        },
      };
    }
    if (pathname === "/api/project-file/save") {
      const { filePath, snapshot } = requestOptions.body ?? {};
      if (filePath && snapshot) {
        desktopFileSnapshots.set(filePath, structuredClone(snapshot));
      }
      return {
        ok: true,
        value: {
          filePath: filePath ?? "",
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
    clearBrowserProjectCache: (context) => {
      browserCacheClears.push(context);
      return true;
    },
    writeProjectFilePathCache: () => {},
    createProjectRecordFromRuntimeState: () => {
      const activeProjectId = state.activeProjectId ?? state.projectLibrarySelectionId ?? projectRecord.id;
      const activeRecord = state.projectLibrary.find((project) => project?.id === activeProjectId) ?? projectRecord;
      return {
        ...activeRecord,
        manuscriptTasks: runtimeManuscriptTasks,
        passageNotes: runtimePassageNotes,
        projectSettings: {
          ...(activeRecord.projectSettings ?? {}),
          activePane: state.activePane,
          worldSpineUnplacedDockCollapsed: state.worldSpineUnplacedDockCollapsed,
          projectFilePath: state.projectFilePath,
          writingTargetState: runtimeWritingTargetState,
        },
      };
    },
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
        activeSceneText: Object.values(record.sceneDrafts ?? {})[0]?.editorText ?? "",
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
    resolveSuggestedProjectFileName: (projectTitle) =>
      getSuggestedProjectFileName(projectTitle || state.projectTitle || state.workspace?.project?.title || "Project 1"),
    loggerSources: {},
  });

  // Manual save should route through the service and write to the active browser handle.
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(operationLog.includes("get-file"), true);
  const jsonBoundaryWrite = JSON.parse(browserHandleWrites.at(-1));
  const jsonBoundarySelection = jsonBoundaryWrite.projects[0].workspace.selectionDefaults;
  assert.equal(Object.hasOwn(jsonBoundarySelection, "entityId"), false);
  assert.equal(Object.hasOwn(jsonBoundarySelection, "nodeId"), false);
  assert.equal(Object.hasOwn(jsonBoundarySelection, "issueId"), false);
  assert.equal(jsonBoundarySelection.explicitNull, null);
  assert.equal(jsonBoundarySelection.emptyText, "");
  assert.equal(jsonBoundarySelection.zero, 0);
  assert.equal(jsonBoundarySelection.disabled, false);
  projectPersistenceService.clearProjectAutosaveState();

  // A real selection ID remains semantic through legacy JSON and cannot disappear or change during readback.
  projectRecord.workspace.selectionDefaults.entityId = "world-entity-123";
  state.projectLibrary = [projectRecord];
  const missingEntityHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    transformReadback(text) {
      const parsed = JSON.parse(text);
      delete parsed.projects[0].workspace.selectionDefaults.entityId;
      return JSON.stringify(parsed);
    },
  });
  await assert.rejects(
    () => projectPersistenceService.saveProjectSnapshotToBrowserHandle(missingEntityHandle),
    /does not contain the latest project snapshot/,
  );
  const changedEntityHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    transformReadback(text) {
      const parsed = JSON.parse(text);
      parsed.projects[0].workspace.selectionDefaults.entityId = "world-entity-456";
      return JSON.stringify(parsed);
    },
  });
  await assert.rejects(
    () => projectPersistenceService.saveProjectSnapshotToBrowserHandle(changedEntityHandle),
    /does not contain the latest project snapshot/,
  );
  projectRecord.workspace.selectionDefaults.entityId = undefined;
  state.projectLibrary = [projectRecord];

  // Failed external writes must still preserve the latest project in browser-backed project storage.
  operationLog.length = 0;
  browserCacheWrites.length = 0;
  browserLogs.length = 0;
  const failingHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    failWrite: true,
  });
  state.projectLibrary = [projectRecord, loadedRecord];
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
  assert.equal(
    browserCacheWrites.at(-1)?.projects?.[0]?.workspace?.selectionDefaults?.sceneId,
    "scene-1",
  );
  assert.deepEqual(
    browserCacheWrites.at(-1)?.projects?.map((project) => project.id),
    ["project-1"],
  );
  assert.equal(
    browserCacheWrites.at(-1)?.projects?.[0]?.workspace?.selectionDefaults?.sceneSelectionLineNumber,
    7,
  );
  assert.equal(
    browserCacheWrites.at(-1)?.projects?.[0]?.workspace?.selectionDefaults?.sceneSelectionScrollTop,
    240,
  );
  assert.equal(
    browserCacheWrites.at(-1)?.projects?.[0]?.workspace?.selectionDefaults?.sceneSelectionScrollLeft,
    8,
  );
  state.projectLibrary = [projectRecord];

  // A write that reports success but reads back stale JSON must not clear dirty project-file state.
  operationLog.length = 0;
  browserCacheWrites.length = 0;
  browserLogs.length = 0;
  const staleReadbackHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    returnStaleTextOnGetFile: true,
  });
  state.projectFileHandle = staleReadbackHandle;
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "manuscript",
    reason: "test-stale-readback-verification",
    source: "test",
  });
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(operationLog.includes("get-file"), true);
  assert.equal(browserCacheWrites.length >= 1, true);
  assert.match(state.projectFileStatus, /Latest project preserved in browser cache/);
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked?.reason, "write-failed");
  assert.match(
    state.projectFileAutosaveBlocked?.errorMessage ?? "",
    /does not contain the latest project snapshot/,
  );
  assert.equal(
    browserLogs.some((entry) => entry.message === "Project file save failed."),
    true,
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

  // Task mutations should persist through the project record and mark the project file autosave dirty.
  runtimeManuscriptTasks = [
    {
      id: "task-runtime-1",
      title: "Tighten opening task",
      body: "Clarify the opening image.",
      description: "Clarify the opening image.",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "Scene one",
      startOffset: 0,
      endOffset: 9,
      status: "open",
      source: "manual",
    },
  ];
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  browserCacheWrites.length = 0;
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "manuscript-tasks",
    dirtyReason: "manuscript-task-created",
    source: "test-task-create",
  });
  assert.equal(state.projectLibrary[0].manuscriptTasks.length, 1);
  assert.equal(state.projectLibrary[0].manuscriptTasks[0].id, "task-runtime-1");
  assert.equal(browserCacheWrites.at(-1)?.projects?.[0]?.manuscriptTasks?.[0]?.id, "task-runtime-1");
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectPersistenceDirtyDomains?.["manuscript-tasks"]?.reason, "manuscript-task-created");
  projectPersistenceService.clearProjectAutosaveState();

  // Workspace pane changes are canonical project UI settings and must survive refresh/load.
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.activePane = "world";
  browserCacheWrites.length = 0;
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "app-settings",
    dirtyReason: "workspace-pane-selected",
    source: "test-workspace-pane-select",
  });
  assert.equal(state.projectLibrary[0].projectSettings.activePane, "world");
  assert.equal(browserCacheWrites.at(-1)?.projects?.[0]?.projectSettings?.activePane, "world");
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectPersistenceDirtyDomains?.["app-settings"]?.reason, "workspace-pane-selected");
  projectPersistenceService.clearProjectAutosaveState();
  state.activePane = "manuscript";

  // The unplaced-events dock collapse state is canonical project UI state.
  state.worldSpineUnplacedDockCollapsed = true;
  browserCacheWrites.length = 0;
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "app-settings",
    dirtyReason: "world-spine-unplaced-dock-collapsed",
    source: "test-world-spine-unplaced-dock-collapse",
  });
  assert.equal(state.projectLibrary[0].projectSettings.worldSpineUnplacedDockCollapsed, true);
  assert.equal(browserCacheWrites.at(-1)?.projects?.[0]?.projectSettings?.worldSpineUnplacedDockCollapsed, true);
  assert.equal(state.projectPersistenceDirtyDomains?.["app-settings"]?.reason, "world-spine-unplaced-dock-collapsed");
  projectPersistenceService.clearProjectAutosaveState();

  // Location-row style mutations can force the already canonical project mutation to hit the project file immediately.
  operationLog.length = 0;
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.activePane = "world";
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "app-settings",
    dirtyReason: "world-spine-location-row-named",
    source: "test-immediate-world-spine-dto-flush",
    flushProjectFileAutosave: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveRevision, 0);
  state.activePane = "manuscript";

  // Scene-store DTO repairs are explicit scene mutations even when the project-record comparator sees no field delta.
  operationLog.length = 0;
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.activePane = "manuscript";
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "manuscript",
    changedSceneIds: ["scene-1"],
    dirtyReason: "world-spine-location-row-named",
    source: "test-world-spine-scene-store-only-flush",
    flushProjectFileAutosave: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(operationLog.includes("prepare-save"), true);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveRevision, 0);

  // Boot reconnect should not let an older project file without activePane erase the cached last workspace page.
  const cachedPaneProject = {
    ...createProjectRecord(),
    projectSettings: {
      projectFilePath: "C:\\Projects\\project-1.abe-project.json",
      activePane: "world",
    },
  };
  state.projectLibrary = [cachedPaneProject];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectFilePath = "C:\\Projects\\project-1.abe-project.json";
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-1",
    projects: [{
      ...createProjectRecord(),
      projectSettings: {
        projectFilePath: "C:\\Projects\\project-1.abe-project.json",
      },
    }],
  }, {
    filePath: "C:\\Projects\\project-1.abe-project.json",
    sourceLabel: "project file",
    reason: "boot-reconnect",
    mode: "desktop-path",
  });
  assert.equal(state.projectLibrary[0].projectSettings.activePane, "world");

  // A file that explicitly stores activePane remains authoritative during the same boot reconnect.
  state.projectLibrary = [cachedPaneProject];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-1",
    projects: [{
      ...createProjectRecord(),
      projectSettings: {
        projectFilePath: "C:\\Projects\\project-1.abe-project.json",
        activePane: "manuscript",
      },
    }],
  }, {
    filePath: "C:\\Projects\\project-1.abe-project.json",
    sourceLabel: "project file",
    reason: "boot-reconnect",
    mode: "desktop-path",
  });
  assert.equal(state.projectLibrary[0].projectSettings.activePane, "manuscript");

  // Autosave should not repeatedly attempt browser-handle writes that require a user permission prompt.
  operationLog.length = 0;
  browserCacheWrites.length = 0;
  browserLogs.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    permissionStatus: "prompt",
  });
  state.projectFileHandlePermission = "prompt";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "project",
    reason: "test-browser-permission-prompt",
    source: "test",
  });
  await projectPersistenceService.flushProjectAutosave();
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), false);
  assert.equal(browserCacheWrites.length >= 1, true);
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked?.reason, "write-permission-required");
  assert.match(state.projectFileStatus, /re-authorize the project file/);
  assert.equal(
    browserLogs.some((entry) => entry.level === "error" && entry.message === "Project file save failed."),
    false,
  );
  operationLog.length = 0;
  browserCacheWrites.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    abortWriteWithSecurityPolicy: true,
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "manuscript",
    reason: "test-browser-background-write-policy",
    source: "test",
  });
  await projectPersistenceService.flushProjectAutosave();
  assert.equal(browserCacheWrites.length >= 1, true);
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked?.reason, "manual-save-required");
  assert.equal(state.projectFileHandlePermission, "granted");

  operationLog.length = 0;
  browserCacheWrites.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    abortCloseWithSecurityPolicy: true,
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "manuscript",
    reason: "test-browser-write-verified-after-policy-error",
    source: "test",
  });
  await projectPersistenceService.flushProjectAutosave();
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(operationLog.includes("get-file"), true);
  assert.equal(browserCacheWrites.length >= 1, true);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveBlocked, null);
  assert.equal(state.projectFileHandlePermission, "granted");

  operationLog.length = 0;
  browserLogs.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    abortCloseWithSecurityPolicy: true,
    returnStaleTextOnGetFile: true,
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.clearProjectAutosaveState();
  projectPersistenceService.markProjectAutosaveDirty({
    domain: "manuscript",
    reason: "test-browser-write-accepted-after-policy-error",
    source: "test",
  });
  await projectPersistenceService.flushProjectAutosave();
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveBlocked, null);
  assert.equal(
    browserLogs.some((entry) => entry.message === "Accepted project file write after browser reported a post-write background block."),
    true,
  );

  operationLog.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    permissionStatus: "prompt",
    logPermissionEvents: true,
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  const requestPermissionIndex = operationLog.indexOf("request-permission");
  const prepareSaveIndex = operationLog.indexOf("prepare-save");
  const createWritableIndex = operationLog.indexOf("create-writable");
  const writeIndex = operationLog.findIndex((entry) => String(entry).startsWith("write:"));
  assert.notEqual(requestPermissionIndex, -1);
  assert.notEqual(prepareSaveIndex, -1);
  assert.notEqual(createWritableIndex, -1);
  assert.notEqual(writeIndex, -1);
  assert.equal(prepareSaveIndex < requestPermissionIndex, true);
  assert.equal(requestPermissionIndex < createWritableIndex, true);
  assert.equal(createWritableIndex < writeIndex, true);
  assert.equal(operationLog.slice(requestPermissionIndex, createWritableIndex).includes("query-permission"), false);
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileHandlePermission, "granted");
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveBlocked, null);

  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveBlocked, null);

  operationLog.length = 0;
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    onWrite: () => {
      state.projectFileAutosaveRevision += 1;
    },
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  state.projectFileAutosaveDirty = true;
  state.projectFileAutosaveBlocked = {
    reason: "write-permission-required",
  };
  state.projectPersistenceDirtyDomains = {
    manuscript: {
      reason: "stale-blocked-save",
    },
  };
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  assert.equal(operationLog.some((entry) => String(entry).startsWith("write:")), true);
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked, null);
  assert.equal(state.projectPersistenceDirtyDomains.manuscript.reason, "stale-blocked-save");
  projectPersistenceService.clearProjectAutosaveState();

  // Project-file loads must flush pending passage-note mutations before reading a possibly stale file.
  operationLog.length = 0;
  fetchCalls.length = 0;
  runtimePassageNotes = [
    {
      id: "inspiration-1",
      noteType: "inspiration",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "Scene one",
      startOffset: 0,
      endOffset: 9,
      body: "Keep the opening sense of wonder.",
      title: "Opening wonder",
      createdAt: "2026-05-20T00:00:00.000Z",
      source: "manual",
    },
  ];
  runtimeManuscriptTasks = [
    {
      id: "task-preload-1",
      title: "Preserve task before load",
      body: "Do not lose this task before reading the file.",
      description: "Do not lose this task before reading the file.",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "Scene one",
      startOffset: 0,
      endOffset: 9,
      status: "open",
      source: "manual",
    },
  ];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectLibrary = [projectRecord];
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  state.projectFilePath = "C:\\Projects\\project-1.abe-project.json";
  state.projectFileAutosaveDirty = false;
  state.projectFileAutosaveRevision = 0;
  await projectPersistenceService.loadProjectSnapshotFromFile();
  const preLoadSaveIndex = fetchCalls.findIndex((call) => call.pathname === "/api/project-file/save");
  const loadIndex = fetchCalls.findIndex((call) => call.pathname === "/api/project-file/load");
  assert.equal(preLoadSaveIndex >= 0, true);
  assert.equal(loadIndex >= 0, true);
  assert.equal(preLoadSaveIndex < loadIndex, true);
  assert.equal(fetchCalls[preLoadSaveIndex].requestOptions.body.snapshot.projects[0].passageNotes.length, 1);
  assert.equal(fetchCalls[preLoadSaveIndex].requestOptions.body.snapshot.projects[0].passageNotes[0].id, "inspiration-1");
  assert.equal(fetchCalls[preLoadSaveIndex].requestOptions.body.snapshot.projects[0].manuscriptTasks.length, 1);
  assert.equal(fetchCalls[preLoadSaveIndex].requestOptions.body.snapshot.projects[0].manuscriptTasks[0].id, "task-preload-1");
  runtimePassageNotes = [];
  runtimeManuscriptTasks = [];

  // The author-facing Load project action should open a chooser even when a current path exists.
  const pickedProjectHandle = createFakeWritableHandle("picked-project.abe-project.json", operationLog);
  const openPickerCalls = [];
  windowRef.showOpenFilePicker = async (options = {}) => {
    openPickerCalls.push(options);
    return [pickedProjectHandle];
  };
  fetchCalls.length = 0;
  operationLog.length = 0;
  activationLog.length = 0;
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectLibrary = [projectRecord];
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  state.projectFilePath = "C:\\Projects\\project-1.abe-project.json";
  await projectPersistenceService.chooseProjectSnapshotFileForLoad();
  assert.equal(openPickerCalls.length, 1);
  assert.equal(
    fetchCalls.some((call) =>
      call.pathname === "/api/project-file/load" &&
      call.requestOptions?.body?.filePath === "picked-project.abe-project.json"
    ),
    false,
  );
  assert.equal(operationLog.includes("get-file"), true);
  assert.equal(state.projectFileHandle, pickedProjectHandle);
  assert.equal(state.projectFilePath, "picked-project.abe-project.json");
  assert.equal(state.activeProjectId, "project-loaded");
  delete windowRef.showOpenFilePicker;

  // Research-note mutations use the same passage-note project-file domain and should mark autosave dirty.
  runtimePassageNotes = [
    {
      id: "research-runtime-1",
      noteType: "research",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "Scene one",
      startOffset: 0,
      endOffset: 9,
      body: "Check the technical implication.",
      title: "Technical check",
      createdAt: "2026-05-20T01:00:00.000Z",
      source: "manual",
    },
  ];
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  browserCacheWrites.length = 0;
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "passage-notes",
    dirtyReason: "research-note-created",
    source: "test-research-create",
  });
  assert.equal(state.projectLibrary[0].passageNotes.length, 1);
  assert.equal(state.projectLibrary[0].passageNotes[0].id, "research-runtime-1");
  assert.equal(state.projectLibrary[0].passageNotes[0].noteType, "research");
  assert.equal(browserCacheWrites.at(-1)?.projects?.[0]?.passageNotes?.[0]?.id, "research-runtime-1");
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectPersistenceDirtyDomains?.["passage-notes"]?.reason, "research-note-created");
  projectPersistenceService.clearProjectAutosaveState();

  // Edited inspiration bodies must reach the external JSON write before autosave can report clean.
  const inspirationWrites = [];
  runtimePassageNotes = [
    {
      id: "inspiration-runtime-1",
      noteType: "inspiration",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "Scene one",
      startOffset: 0,
      endOffset: 9,
      body: "Bank this revised inspiration note.",
      title: "Revised inspiration",
      createdAt: "2026-05-20T02:00:00.000Z",
      updatedAt: "2026-05-20T02:05:00.000Z",
      source: "manual",
    },
  ];
  state.projectLibrary = [projectRecord];
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog, {
    writtenValues: inspirationWrites,
  });
  state.projectFileHandlePermission = "granted";
  state.projectFilePath = "project-1.abe-project.json";
  projectPersistenceService.commitCanonicalProjectMutation({
    domain: "passage-notes",
    dirtyReason: "inspiration-note-body-edited",
    source: "test-inspiration-edit",
  });
  await projectPersistenceService.flushProjectAutosave();
  const inspirationSnapshot = JSON.parse(inspirationWrites.at(-1));
  assert.equal(inspirationSnapshot.projects[0].passageNotes.length, 1);
  assert.equal(inspirationSnapshot.projects[0].passageNotes[0].id, "inspiration-runtime-1");
  assert.equal(inspirationSnapshot.projects[0].passageNotes[0].body, "Bank this revised inspiration note.");
  assert.equal(state.projectFileAutosaveDirty, false);
  assert.equal(state.projectFileAutosaveBlocked, null);

  runtimePassageNotes = [];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectLibrary = [projectRecord];
  state.projectFilePath = "project-1.abe-project.json";
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";

  // Loading a snapshot should hydrate state and activate the loaded record through the callback.
  browserCacheClears.length = 0;
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-loaded",
    projects: [loadedRecord],
  }, {
    filePath: "C:\\Projects\\loaded.abe-project.json",
    reason: "load-project-file",
    sourceLabel: "desktop file",
    mode: "desktop-path",
  });
  assert.equal(state.activeProjectId, "project-loaded");
  assert.equal(state.projectFilePath, "C:\\Projects\\loaded.abe-project.json");
  assert.equal(activationLog.at(-1)?.projectId, "project-loaded");
  assert.equal(browserCacheClears.at(-1)?.projectId, "project-loaded");
  assert.equal(state.projectLibrary.find((project) => project.id === "project-loaded")?.title, "Loaded Project");
  assert.equal(activeProjectWrites.includes("project-loaded"), true);

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
  const browserHandleProjectId = getProjectFileIdentity("OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(state.activeProjectId, browserHandleProjectId);
  assert.equal(state.projectFilePath, "OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(state.projectFileHandle, browserHandle);
  assert.equal(state.projectFileHandlePermission, "granted");
  const browserHandleSettingsCall = fetchCalls.filter((call) => call.pathname === "/api/settings").at(-1);
  assert.equal(browserHandleSettingsCall?.requestOptions?.body?.lastProjectFilePath, "");
  assert.equal(browserHandleSettingsCall?.requestOptions?.body?.lastProjectFilePathExplicit, false);
  assert.equal(activationLog.at(-1)?.projectFilePath, "OriginFileproject-serva-vitae.abe-project.json");
  assert.equal(activationLog.at(-1)?.hasProjectFileHandle, true);
  assert.equal(activationLog.at(-1)?.activeSceneText, "Loaded project scene text.");
  assert.equal(
    state.projectLibrary.find((project) => project.id === browserHandleProjectId)?.projectSettings?.projectFilePath,
    "OriginFileproject-serva-vitae.abe-project.json",
  );
  assert.equal(
    state.projectLibrary.find((project) => project.id === browserHandleProjectId)?.sceneDrafts?.["scene-loaded"]?.editorText,
    "Loaded project scene text.",
  );

  // Loading a different file with the same project id should remap the runtime identity instead of leaking drafts across files.
  state.projectLibrary = [projectRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectFilePath = "project-1.abe-project.json";
  state.projectFileHandle = createFakeWritableHandle("project-1.abe-project.json", operationLog);
  state.projectFileHandlePermission = "granted";
  const loadedSceneStore = {
    "scene-loaded": createLoadedProjectRecord().sceneDrafts["scene-loaded"],
    "scene-unopened": {
      sceneId: "scene-unopened",
      chapterId: "chapter-loaded",
      chapterTitle: "Loaded Chapter",
      sceneTitle: "Unopened Loaded Scene",
      sceneSynopsis: "",
      editorText: "Unopened loaded scene text.",
      blocks: [
        {
          blockId: "block-unopened-1",
          lineNumber: 2,
          kind: "narration",
          speakerLabel: "",
          text: "Unopened loaded scene text.",
          issueIds: [],
          eventTagIds: [],
          isDraft: false,
        },
      ],
    },
  };
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-1",
    projects: [
      {
        ...createLoadedProjectRecord(),
        id: "project-1",
        sceneDrafts: {},
        workspace: {
          ...createLoadedProjectRecord().workspace,
          project: {
            ...createLoadedProjectRecord().workspace.project,
            id: "project-1",
          },
        },
        projectSettings: {
          ...createLoadedProjectRecord().projectSettings,
          projectFilePath: "C:\\Projects\\project-1-copy.abe-project.json",
        },
      },
    ],
    sceneStore: {
      "legacy-project-id": loadedSceneStore,
    },
  }, {
    filePath: "C:\\Projects\\project-1-copy.abe-project.json",
    fileName: "project-1-copy.abe-project.json",
    fileHandle: createFakeWritableHandle("project-1-copy.abe-project.json", operationLog),
    reason: "load-project-file",
    sourceLabel: "browser file",
    mode: "browser-handle",
  });
  const remappedProjectId = getProjectFileIdentity("C:\\Projects\\project-1-copy.abe-project.json");
  assert.equal(state.activeProjectId, remappedProjectId);
  assert.equal(state.projectLibrary.some((project) => project.id === "project-1"), false);
  assert.equal(state.projectLibrary.some((project) => project.id === remappedProjectId), true);
  assert.equal(
    state.projectLibrary.find((project) => project.id === remappedProjectId)?.sceneDrafts?.["scene-loaded"]?.editorText,
    "Loaded project scene text.",
  );
  assert.equal(
    state.projectLibrary.find((project) => project.id === remappedProjectId)?.sceneDrafts?.["scene-unopened"]?.editorText,
    undefined,
  );
  const retainedLoadedFileSnapshot = projectPersistenceService.buildProjectSnapshotForSaveFile();
  assert.equal(
    retainedLoadedFileSnapshot.sceneStore?.[remappedProjectId]?.["scene-unopened"]?.editorText,
    "Unopened loaded scene text.",
  );

  // Renamed split-storage project files without their sceneStore must not recover bodies from an older browser cache.
  const cachedOriginalRecord = {
    ...createLoadedProjectRecord(),
    id: "project-1",
    workspace: {
      ...createLoadedProjectRecord().workspace,
      project: {
        ...createLoadedProjectRecord().workspace.project,
        id: "project-1",
      },
    },
    projectIndex: {
      sceneOrder: ["scene-loaded"],
      scenes: [
        {
          id: "scene-loaded",
          title: "Loaded Scene",
          chapterId: "chapter-loaded",
          chapterTitle: "Loaded Chapter",
          wordCount: 4,
        },
      ],
    },
    projectSettings: {
      projectFilePath: "C:\\Projects\\project-1.abe-project.json",
    },
  };
  state.projectLibrary = [cachedOriginalRecord];
  state.activeProjectId = "project-1";
  state.projectLibrarySelectionId = "project-1";
  state.projectFilePath = "C:\\Projects\\project-1.abe-project.json";
  await projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
    activeProjectId: "project-1",
    projects: [
      {
        ...cachedOriginalRecord,
        sceneDrafts: {},
        projectSettings: {
          projectFilePath: "C:\\Projects\\project-1-renamed.abe-project.json",
        },
      },
    ],
  }, {
    filePath: "C:\\Projects\\project-1-renamed.abe-project.json",
    fileName: "project-1-renamed.abe-project.json",
    fileHandle: createFakeWritableHandle("project-1-renamed.abe-project.json", operationLog),
    reason: "load-project-file",
    sourceLabel: "browser file",
    mode: "browser-handle",
  });
  const renamedProjectId = getProjectFileIdentity("C:\\Projects\\project-1-renamed.abe-project.json");
  assert.equal(state.activeProjectId, renamedProjectId);
  assert.equal(
    state.projectLibrary.find((project) => project.id === renamedProjectId)?.sceneDrafts?.["scene-loaded"]?.editorText,
    undefined,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      state.projectLibrary.find((project) => project.id === renamedProjectId) ?? {},
      "revisions",
    ),
    false,
  );

  // Filename-only records should still hydrate display identity without pretending to have a durable path.
  state.projectFilePath = "";
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  projectPersistenceService.syncActiveProjectFileDestinationFromRecord();
  assert.equal(state.projectFilePath, "C:\\Projects\\project-1-renamed.abe-project.json");
  assert.equal(projectPersistenceService.hasProjectSaveDestination(), true);

  // Scrivener ports should activate an imported project and immediately ask for an ABE project file destination.
  state.projectFilePath = "C:\\Projects\\project-1-renamed.abe-project.json";
  state.projectFileHandle = null;
  state.projectFileHandlePermission = "";
  projectPersistenceService.clearProjectAutosaveState();
  activationLog.length = 0;
  operationLog.length = 0;
  const scrivenerSaveWrites = [];
  const scrivenerSavePickerCalls = [];
  const scrivenerProjectHandle = createFakeWritableHandle("imported-novel.abe-project.json", operationLog, {
    writtenValues: scrivenerSaveWrites,
  });
  windowRef.showDirectoryPicker = async () => createFakeScrivenerDirectoryHandle();
  windowRef.showSaveFilePicker = async (options = {}) => {
    scrivenerSavePickerCalls.push(options);
    return scrivenerProjectHandle;
  };
  await projectPersistenceService.chooseScrivenerProjectForImport();
  assert.equal(state.activeProjectId, "scrivener-imported-novel");
  assert.equal(scrivenerSavePickerCalls.length, 1);
  assert.equal(scrivenerSavePickerCalls[0].suggestedName, "imported-novel.abe-project.json");
  assert.equal(state.projectFilePath, "imported-novel.abe-project.json");
  assert.equal(state.projectFileHandle, scrivenerProjectHandle);
  assert.equal(activationLog.at(-1)?.reason, "scrivener-import");
  assert.equal(activationLog.at(-1)?.activeSceneText, "Imported Scrivener text.");
  assert.equal(scrivenerSaveWrites.length, 1);
  const savedScrivenerSnapshot = JSON.parse(scrivenerSaveWrites[0]);
  assert.equal(savedScrivenerSnapshot.activeProjectId, "scrivener-imported-novel");
  assert.equal(savedScrivenerSnapshot.projects[0].id, "scrivener-imported-novel");
  assert.equal(savedScrivenerSnapshot.projects[0].projectSettings.projectFilePath, "imported-novel.abe-project.json");
  assert.equal(
    state.projectLibrary.find((project) => project.id === "scrivener-imported-novel")?.projectSettings?.projectFilePath,
    "imported-novel.abe-project.json",
  );
  assert.match(state.projectFileStatus, /Ported Scrivener project: 1 scene/);
  assert.match(state.projectFileStatus, /Saved ABE project file to imported-novel\.abe-project\.json/);
  delete windowRef.showDirectoryPicker;
  delete windowRef.showSaveFilePicker;

  // Restore-last-opened flow should prefer the explicit desktop path over stale cached record paths.
  fetchCalls.length = 0;
  state.projectFilePath = "C:\\Projects\\stale-cache.abe-project.json";
  await projectPersistenceService.restoreLastOpenedProject({
    lastProjectFilePathExplicit: true,
    lastProjectFilePath: "C:\\Projects\\loaded.abe-project.json",
    projectRoot: "C:\\Projects",
  });
  const restoreLoadCall = fetchCalls.find((call) => call.pathname === "/api/project-file/load");
  const restoreSettingsCall = fetchCalls.find((call) => call.pathname === "/api/settings");
  assert.equal(
    restoreLoadCall?.requestOptions?.body?.filePath,
    "C:\\Projects\\loaded.abe-project.json",
  );
  assert.equal(
    restoreSettingsCall?.requestOptions?.body?.lastProjectFilePath,
    "C:\\Projects\\loaded.abe-project.json",
  );
  assert.equal(
    state.projectFilePath,
    "C:\\Projects\\loaded.abe-project.json",
  );

  // Metadata-only retained scene stores should recover body text from line-backed project records before save.
  const recoverableProjectRecord = createRecoverableProjectRecord();
  state.activeProjectId = recoverableProjectRecord.id;
  state.projectLibrarySelectionId = recoverableProjectRecord.id;
  state.projectLibrary = [recoverableProjectRecord];
  state.loadedProjectSceneStore = {
    [recoverableProjectRecord.id]: Object.fromEntries(
      recoverableProjectRecord.projectIndex.scenes.map((scene) => [scene.id, {
        sceneId: scene.id,
        chapterId: scene.chapterId,
        chapterTitle: scene.chapterTitle,
        sceneTitle: scene.title,
        editorText: "",
        blocks: [],
        location: "Earth",
        locationRowLabel: "Earth",
        locationRowKey: "earth",
        locationScope: "planetary",
        worldSpineMetadata: {
          location: "Earth",
          locationRowLabel: "Earth",
          locationRowKey: "earth",
          locationScope: "planetary",
        },
      }]),
    ),
  };
  const recoveredSceneStoreSnapshot = projectPersistenceService.buildProjectSnapshotForSaveFile();
  assert.equal(
    recoveredSceneStoreSnapshot.sceneStore?.[recoverableProjectRecord.id]?.["recoverable-scene-3"]?.editorText,
    "Recoverable scene 3 body.",
  );
  assert.equal(
    recoveredSceneStoreSnapshot.sceneStore?.[recoverableProjectRecord.id]?.["recoverable-scene-3"]?.blocks?.[0]?.text,
    "Recoverable scene 3 body.",
  );
  assert.equal(
    recoveredSceneStoreSnapshot.sceneStore?.[recoverableProjectRecord.id]?.["recoverable-scene-3"]?.locationRowKey,
    "earth",
  );

  // Already-collapsed runtime stores can recover from the current project file before writing.
  const fileRecoverableProjectRecord = createCollapsedProjectRecord();
  const fileRecoverableSceneStore = createRecoveredFileSceneStore(fileRecoverableProjectRecord);
  const fileRecoveryWrites = [];
  operationLog.length = 0;
  state.activeProjectId = fileRecoverableProjectRecord.id;
  state.projectLibrarySelectionId = fileRecoverableProjectRecord.id;
  state.projectLibrary = [fileRecoverableProjectRecord];
  state.loadedProjectSceneStore = {
    [fileRecoverableProjectRecord.id]: createMetadataOnlySceneStore(fileRecoverableProjectRecord),
  };
  state.projectFilePath = "collapsed.abe-project.json";
  state.projectFileHandle = createFakeWritableHandle("collapsed.abe-project.json", operationLog, {
    fileText: JSON.stringify({
      activeProjectId: fileRecoverableProjectRecord.id,
      projects: [fileRecoverableProjectRecord],
      sceneStore: {
        [fileRecoverableProjectRecord.id]: fileRecoverableSceneStore,
      },
    }),
    writtenValues: fileRecoveryWrites,
  });
  state.projectFileHandlePermission = "granted";
  projectPersistenceService.clearProjectAutosaveState();
  await projectPersistenceService.saveProjectSnapshot({ reason: "manual-save" });
  const recoveredFileSaveSnapshot = JSON.parse(fileRecoveryWrites.at(-1));
  assert.equal(
    recoveredFileSaveSnapshot.sceneStore?.[fileRecoverableProjectRecord.id]?.["collapsed-scene-4"]?.editorText,
    "Recovered file body for collapsed scene 4.",
  );
  assert.equal(
    recoveredFileSaveSnapshot.sceneStore?.[fileRecoverableProjectRecord.id]?.["collapsed-scene-4"]?.locationRowKey,
    "earth",
  );
  assert.equal(operationLog.filter((entry) => entry === "get-file").length >= 2, true);

  // Direct browser-handle saves without a prebuilt snapshot must use the same scene-body recovery path.
  const directRecoveryWrites = [];
  operationLog.length = 0;
  state.activeProjectId = fileRecoverableProjectRecord.id;
  state.projectLibrarySelectionId = fileRecoverableProjectRecord.id;
  state.projectLibrary = [fileRecoverableProjectRecord];
  state.loadedProjectSceneStore = {
    [fileRecoverableProjectRecord.id]: createMetadataOnlySceneStore(fileRecoverableProjectRecord),
  };
  state.projectFilePath = "collapsed-direct.abe-project.json";
  state.projectFileHandle = createFakeWritableHandle("collapsed-direct.abe-project.json", operationLog, {
    fileText: JSON.stringify({
      activeProjectId: fileRecoverableProjectRecord.id,
      projects: [fileRecoverableProjectRecord],
      sceneStore: {
        [fileRecoverableProjectRecord.id]: fileRecoverableSceneStore,
      },
    }),
    writtenValues: directRecoveryWrites,
  });
  state.projectFileHandlePermission = "granted";
  await projectPersistenceService.saveProjectSnapshotToBrowserHandle(state.projectFileHandle, null, {
    reason: "direct-save",
  });
  const directRecoveredFileSaveSnapshot = JSON.parse(directRecoveryWrites.at(-1));
  assert.equal(
    directRecoveredFileSaveSnapshot.sceneStore?.[fileRecoverableProjectRecord.id]?.["collapsed-scene-4"]?.editorText,
    "Recovered file body for collapsed scene 4.",
  );
  assert.equal(operationLog.filter((entry) => entry === "get-file").length >= 2, true);

  // Collapsed split-storage files should fail before they become the active editable manuscript.
  const collapsedProjectRecord = createCollapsedProjectRecord();
  const collapsedSceneStore = createCollapsedSceneStore();
  await assert.rejects(
    () => projectPersistenceService.hydrateProjectLibraryFromLoadedSnapshot({
      activeProjectId: collapsedProjectRecord.id,
      projects: [collapsedProjectRecord],
      sceneStore: {
        [collapsedProjectRecord.id]: collapsedSceneStore,
      },
    }, {
      filePath: "C:\\Projects\\collapsed.abe-project.json",
      fileName: "collapsed.abe-project.json",
      fileHandle: null,
      reason: "load-project-file",
      sourceLabel: "browser file",
      mode: "browser-input",
    }),
    /manuscript body store looks collapsed/,
  );

  // Existing collapsed runtime state should also be blocked at save time.
  state.activeProjectId = collapsedProjectRecord.id;
  state.projectLibrarySelectionId = collapsedProjectRecord.id;
  state.projectLibrary = [collapsedProjectRecord];
  state.loadedProjectSceneStore = {
    [collapsedProjectRecord.id]: collapsedSceneStore,
  };
  assert.throws(
    () => projectPersistenceService.buildProjectSnapshotForSaveFile(),
    /Refusing to save/,
  );

  await runDesktopPackageTransactionAssertions();
}

// Intent: prove package destinations remain unchanged until host staging, readback, verification, and commit all succeed.
async function runDesktopPackageTransactionAssertions() {
  const record = createLoadedProjectRecord();
  const sourceRoot = "C:\\Projects\\Project A";
  const destinationRoot = "C:\\Projects\\Project B";
  record.projectSettings.projectFilePath = sourceRoot;
  const state = {
    activeProjectId: record.id,
    projectLibrarySelectionId: record.id,
    projectLibrary: [record],
    projectTitle: record.title,
    projectFilePath: sourceRoot,
    projectFileStorageMode: "desktop-package",
    projectFileHandle: null,
    projectFileHandlePermission: "",
    projectFileStatus: "",
    projectFileBusy: false,
    projectFileAutosaveDirty: false,
    projectFileAutosaveBlocked: null,
    projectFileAutosaveTarget: null,
    projectFileAutosaveTimer: null,
    projectFileAutosaveRevision: 0,
    projectFileAutosaveSuppressionDepth: 0,
    projectCacheSuppressionDepth: 0,
    projectPersistenceDirtyDomains: {},
    editorPrefs: { projectFileAutosaveEnabled: true },
    workspace: record.workspace,
  };
  const operationLog = [];
  const stagedPackages = new Map();
  const stagedSaves = new Map();
  const publishedPackages = new Map();
  const desktopSnapshots = new Map();
  const authorityAtCommits = [];
  let stagedPackageSequence = 0;
  let transportFailure = "";
  let corruptReadBack = false;
  let pauseSaveAsStage = null;
  let pauseNormalSaveStage = null;
  const stagePackage = (finalRootPath, snapshot) => {
    stagedPackageSequence += 1;
    const operationToken = `stage-${stagedPackageSequence}`;
    const stagingRootPath = `C:\\Projects\\.abe-stage-${stagedPackageSequence}`;
    stagedPackages.set(operationToken, {
      finalRootPath,
      stagingRootPath,
      snapshot: structuredClone(snapshot),
    });
    return { ok: true, operationToken, stagingRootPath, finalRootPath };
  };
  const fetchJsonFromDesktopApi = async (pathname, options = {}) => {
    const body = options.body ?? {};
    operationLog.push(`${pathname}:${body.rootPath ?? body.filePath ?? body.operationToken ?? body.folderName ?? ""}`);
    if (transportFailure === pathname) {
      return { ok: false, error: new Error("Simulated package transport failure.") };
    }
    if (pathname === "/api/project-package/create") {
      const rootPath = `C:\\Projects\\${body.folderName}`;
      return { ok: true, value: stagePackage(rootPath, body.snapshot) };
    }
    if (pathname === "/api/project-package/save-as") {
      if (pauseSaveAsStage) await pauseSaveAsStage;
      return { ok: true, value: stagePackage(destinationRoot, body.snapshot) };
    }
    if (pathname === "/api/project-package/save-stage") {
      stagedPackageSequence += 1;
      const operationToken = `save-${stagedPackageSequence}`;
      stagedSaves.set(operationToken, {
        rootPath: body.rootPath,
        snapshot: structuredClone(body.snapshot),
      });
      if (pauseNormalSaveStage) await pauseNormalSaveStage;
      return { ok: true, value: { ok: true, operationToken, rootPath: body.rootPath } };
    }
    if (pathname === "/api/project-package/save-load") {
      const stagedSave = stagedSaves.get(body.operationToken);
      if (!stagedSave) return { ok: false, error: new Error("Unknown staged save.") };
      const snapshot = structuredClone(stagedSave.snapshot);
      if (corruptReadBack) snapshot.projects[0].title = "Corrupted read-back";
      return { ok: true, value: { ok: true, rootPath: stagedSave.rootPath, snapshot } };
    }
    if (pathname === "/api/project-package/save-commit") {
      const stagedSave = stagedSaves.get(body.operationToken);
      if (!stagedSave) return { ok: false, error: new Error("Unknown staged save.") };
      stagedSaves.delete(body.operationToken);
      desktopSnapshots.set(stagedSave.rootPath, structuredClone(stagedSave.snapshot));
      return { ok: true, value: { ok: true, rootPath: stagedSave.rootPath } };
    }
    if (pathname === "/api/project-package/save-discard") {
      stagedSaves.delete(body.operationToken);
      return { ok: true, value: { ok: true, discarded: true } };
    }
    if (pathname === "/api/project-package/load") {
      const stagedPackage = [...stagedPackages.values()].find((entry) => entry.stagingRootPath === body.rootPath);
      const snapshotCandidate = stagedPackage?.snapshot ?? publishedPackages.get(body.rootPath);
      if (!snapshotCandidate) {
        return { ok: false, error: new Error("Invalid package.") };
      }
      const snapshot = structuredClone(snapshotCandidate);
      if (corruptReadBack) snapshot.projects[0].title = "Corrupted read-back";
      return { ok: true, value: { ok: true, rootPath: body.rootPath, snapshot } };
    }
    if (pathname === "/api/project-package/commit") {
      const stagedPackage = stagedPackages.get(body.operationToken);
      if (!stagedPackage) return { ok: false, error: new Error("Unknown staged package.") };
      authorityAtCommits.push(state.projectFilePath);
      stagedPackages.delete(body.operationToken);
      publishedPackages.set(stagedPackage.finalRootPath, structuredClone(stagedPackage.snapshot));
      return { ok: true, value: { ok: true, rootPath: stagedPackage.finalRootPath } };
    }
    if (pathname === "/api/project-package/discard") {
      stagedPackages.delete(body.operationToken);
      return { ok: true, value: { ok: true, discarded: true } };
    }
    if (pathname === "/api/project-file/save") {
      desktopSnapshots.set(body.filePath, structuredClone(body.snapshot));
      return { ok: true, value: { ok: true, filePath: body.filePath } };
    }
    if (pathname === "/api/project-file/load") {
      return { ok: true, value: structuredClone(desktopSnapshots.get(body.filePath)) };
    }
    if (pathname === "/api/settings") {
      return { ok: true, value: {} };
    }
    return { ok: false, error: new Error(`Unhandled path ${pathname}`) };
  };
  const projectService = createFakeProjectService(record, record, []);
  const service = createProjectPersistenceService({
    state,
    windowRef: createFakeWindowRef(),
    projectService,
    projectRepository: {
      saveActiveProjectId(projectId) {
        operationLog.push(`activate-id:${projectId}`);
      },
    },
    fetchJsonFromDesktopApi,
    projectSchemaVersion: 2,
    autosaveDelayMs: 5000,
    createProjectRecordFromRuntimeState: () => ({
      ...state.projectLibrary[0],
      projectSettings: {
        ...(state.projectLibrary[0]?.projectSettings ?? {}),
        projectFilePath: state.projectFilePath,
      },
    }),
    getActiveProjectRecord: () => state.projectLibrary[0] ?? null,
    normalizeProjectLibrarySnapshot: (snapshot) => structuredClone(snapshot),
    normalizeProjectRecord: (candidate) => candidate,
    resolveActiveProjectId: (candidate, library) => candidate ?? library.projects[0]?.id ?? null,
    activateLoadedProjectRecord: ({ projectRecord }) => {
      operationLog.push(`activate-record:${projectRecord.id}`);
      state.workspace = projectRecord.workspace;
      state.projectTitle = projectRecord.title;
    },
    prepareProjectSnapshotForSave: () => {
      operationLog.push("prepare");
    },
    renderHeader: () => {},
    loggerSources: {
      projectPersistence: {
        debug() {},
        info(scope, event) {
          operationLog.push(event);
        },
        warn() {},
        error() {},
      },
    },
  });
  const candidateSnapshot = {
    schemaVersion: 2,
    activeProjectId: record.id,
    projects: [structuredClone(record)],
    sceneStore: { [record.id]: structuredClone(record.sceneDrafts) },
  };

  transportFailure = "/api/project-package/create";
  await assert.rejects(
    () => service.createDesktopProjectPackage({
      parentPath: "C:\\Projects",
      folderName: "Project B",
      buildCandidateSnapshot: () => candidateSnapshot,
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "/api/project-package/load";
  await assert.rejects(
    () => service.createDesktopProjectPackage({
      parentPath: "C:\\Projects",
      folderName: "Project B",
      buildCandidateSnapshot: () => candidateSnapshot,
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "";
  corruptReadBack = true;
  await assert.rejects(
    () => service.createDesktopProjectPackage({
      parentPath: "C:\\Projects",
      folderName: "Project B",
      buildCandidateSnapshot: () => candidateSnapshot,
    }),
    /not semantically equivalent/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  corruptReadBack = false;
  transportFailure = "/api/project-package/commit";
  await assert.rejects(
    () => service.createDesktopProjectPackage({
      parentPath: "C:\\Projects",
      folderName: "Project B",
      buildCandidateSnapshot: () => candidateSnapshot,
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "/api/project-package/save-as";
  await assert.rejects(
    () => service.saveProjectSnapshotAsPackage({
      destinationParentPath: "C:\\Projects",
      folderName: "Project B",
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "/api/project-package/load";
  await assert.rejects(
    () => service.saveProjectSnapshotAsPackage({
      destinationParentPath: "C:\\Projects",
      folderName: "Project B",
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "";
  corruptReadBack = true;
  await assert.rejects(
    () => service.saveProjectSnapshotAsPackage({
      destinationParentPath: "C:\\Projects",
      folderName: "Project B",
    }),
    /not semantically equivalent/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  corruptReadBack = false;
  transportFailure = "/api/project-package/commit";
  await assert.rejects(
    () => service.saveProjectSnapshotAsPackage({
      destinationParentPath: "C:\\Projects",
      folderName: "Project B",
    }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, sourceRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.has(destinationRoot), false);
  assert.equal(stagedPackages.size, 0);

  transportFailure = "";
  operationLog.length = 0;
  await service.saveProjectSnapshot({ reason: "post-failure-normal-save" });
  assert.equal(
    operationLog.some((entry) => entry === `/api/project-package/save-stage:${sourceRoot}`),
    true,
    "A normal Save after failed Save As must still target A.",
  );

  operationLog.length = 0;
  await service.saveProjectSnapshotAsPackage({
    destinationParentPath: "C:\\Projects",
    folderName: "Project B",
  });
  const saveIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/save-as:"));
  const loadIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/load:C:\\Projects\\.abe-stage-"));
  const verificationIndex = operationLog.findIndex((entry) => entry === "project.package.verified");
  const commitIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/commit:stage-"));
  const settingsIndex = operationLog.findIndex((entry) => entry === "/api/settings:");
  assert.equal(
    saveIndex >= 0
      && loadIndex > saveIndex
      && verificationIndex > loadIndex
      && commitIndex > verificationIndex
      && settingsIndex > commitIndex,
    true,
  );
  assert.equal(state.projectFilePath, destinationRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(publishedPackages.get(destinationRoot).projects[0].projectSettings.projectFilePath, undefined);
  assert.equal(stagedPackages.size, 0);
  assert.equal(state.projectFileStorageMode, "desktop-package");
  assert.equal(authorityAtCommits.at(-1), sourceRoot);

  operationLog.length = 0;
  await service.saveProjectSnapshot({ reason: "package-normal-save" });
  assert.equal(desktopSnapshots.get(destinationRoot).projects[0].projectSettings.projectFilePath, undefined);
  assert.equal(state.projectLibrary[0].projectSettings.projectFilePath, destinationRoot);
  const normalStageIndex = operationLog.findIndex((entry) => entry === `/api/project-package/save-stage:${destinationRoot}`);
  const normalLoadIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/save-load:save-"));
  const normalCommitIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/save-commit:save-"));
  assert.equal(normalStageIndex >= 0 && normalLoadIndex > normalStageIndex && normalCommitIndex > normalLoadIndex, true);

  // Normal package Save must discard an unpublished generation for every editor-side failure boundary.
  for (const failurePath of [
    "/api/project-package/save-stage",
    "/api/project-package/save-load",
    "/api/project-package/save-commit",
  ]) {
    transportFailure = failurePath;
    await assert.rejects(
      () => service.saveProjectSnapshotToFilePath(destinationRoot, null, {
        semanticVerification: true,
        storageMode: "desktop-package",
      }),
      /transport failure/,
    );
    assert.equal(state.projectFilePath, destinationRoot);
    assert.equal(stagedSaves.size, 0);
  }
  transportFailure = "";
  corruptReadBack = true;
  await assert.rejects(
    () => service.saveProjectSnapshotToFilePath(destinationRoot, null, {
      semanticVerification: true,
      storageMode: "desktop-package",
    }),
    /not semantically equivalent/,
  );
  assert.equal(state.projectFilePath, destinationRoot);
  assert.equal(stagedSaves.size, 0);
  corruptReadBack = false;

  // A normal Save completion may publish its captured revision, but it must not clear a newer canonical mutation.
  let releaseNormalSave;
  let normalSaveStageReached;
  const normalSaveStageReachedPromise = new Promise((resolve) => { normalSaveStageReached = resolve; });
  pauseNormalSaveStage = new Promise((resolve) => { releaseNormalSave = resolve; });
  const staleNormalSave = service.saveProjectSnapshot({ reason: "concurrent-normal-save" });
  while (!operationLog.at(-1)?.startsWith("/api/project-package/save-stage:")) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  normalSaveStageReached();
  state.projectLibrary[0] = { ...state.projectLibrary[0], title: "Mutation during normal Save" };
  service.markProjectAutosaveDirty({ domain: "project", reason: "concurrent-normal-mutation", source: "test" });
  releaseNormalSave();
  await normalSaveStageReachedPromise;
  await staleNormalSave;
  pauseNormalSaveStage = null;
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectPersistenceDirtyDomains.project.reason, "concurrent-normal-mutation");
  await service.flushProjectAutosave();
  assert.equal(desktopSnapshots.get(destinationRoot).projects[0].title, "Mutation during normal Save");
  assert.equal(state.projectFileAutosaveDirty, false);

  // Save As retargets a mutation made during staging to B and flushes it before reporting synchronization.
  state.projectFilePath = sourceRoot;
  state.projectFileStorageMode = "desktop-package";
  state.projectLibrary[0] = { ...state.projectLibrary[0], title: record.title };
  service.clearProjectAutosaveState();
  let releaseSaveAs;
  pauseSaveAsStage = new Promise((resolve) => { releaseSaveAs = resolve; });
  operationLog.length = 0;
  const concurrentSaveAs = service.saveProjectSnapshotAsPackage({
    destinationParentPath: "C:\\Projects",
    folderName: "Project B",
  });
  while (!operationLog.some((entry) => entry.startsWith("/api/project-package/save-as:"))) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  state.projectLibrary[0] = { ...state.projectLibrary[0], title: "Mutation during Save As" };
  service.markProjectAutosaveDirty({ domain: "project", reason: "concurrent-save-as-mutation", source: "test" });
  releaseSaveAs();
  await concurrentSaveAs;
  pauseSaveAsStage = null;
  assert.equal(state.projectFilePath, destinationRoot);
  assert.equal(desktopSnapshots.get(destinationRoot).projects[0].title, "Mutation during Save As");
  assert.equal(state.projectFileAutosaveDirty, false);

  const createRoot = "C:\\Projects\\Project C";
  operationLog.length = 0;
  await service.createDesktopProjectPackage({
    parentPath: "C:\\Projects",
    folderName: "Project C",
    buildCandidateSnapshot: () => candidateSnapshot,
  });
  const createIndex = operationLog.findIndex((entry) => entry === "/api/project-package/create:Project C");
  const createLoadIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/load:C:\\Projects\\.abe-stage-"));
  const createVerificationIndex = operationLog.findIndex((entry) => entry === "project.package.verified");
  const createCommitIndex = operationLog.findIndex((entry) => entry.startsWith("/api/project-package/commit:stage-"));
  const activationIndex = operationLog.findIndex((entry) => entry === `activate-record:${record.id}`);
  assert.equal(
    createIndex >= 0
      && createLoadIndex > createIndex
      && createVerificationIndex > createLoadIndex
      && createCommitIndex > createVerificationIndex
      && activationIndex > createCommitIndex,
    true,
  );
  assert.equal(state.projectFilePath, createRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(stagedPackages.size, 0);
  assert.equal(authorityAtCommits.at(-1), destinationRoot);

  transportFailure = "/api/project-package/load";
  await assert.rejects(
    () => service.openDesktopProjectPackage({ rootPath: destinationRoot }),
    /transport failure/,
  );
  assert.equal(state.projectFilePath, createRoot);
  assert.equal(state.activeProjectId, record.id);

  // Cache-only fallback and an existing autosave block cannot authorize replacement of dirty A.
  transportFailure = "/api/project-package/save-stage";
  service.clearProjectAutosaveState();
  service.markProjectAutosaveDirty({ domain: "manuscript", reason: "transition-write-failure", source: "test" });
  await assert.rejects(
    () => service.openDesktopProjectPackage({ rootPath: destinationRoot }),
    /could not be durably saved/,
  );
  assert.equal(state.projectFilePath, createRoot);
  assert.equal(state.activeProjectId, record.id);
  assert.equal(state.projectFileAutosaveDirty, true);
  assert.equal(state.projectFileAutosaveBlocked?.reason, "write-failed");

  transportFailure = "";
  await assert.rejects(
    () => service.openDesktopProjectPackage({ rootPath: destinationRoot }),
    /durable save is blocked/,
  );
  assert.equal(state.projectFilePath, createRoot);
  assert.equal(state.activeProjectId, record.id);

  // With no durable target, New/Open are blocked; Save As itself remains the explicit durability path.
  service.clearProjectAutosaveState();
  state.projectFilePath = "";
  state.projectFileStorageMode = "";
  service.markProjectAutosaveDirty({ domain: "project", reason: "transition-no-destination", source: "test" });
  const stagedCountBeforeBlockedNew = stagedPackages.size;
  await assert.rejects(
    () => service.createDesktopProjectPackage({
      parentPath: "C:\\Projects",
      folderName: "Blocked New",
      buildCandidateSnapshot: () => candidateSnapshot,
    }),
    /no durable destination/,
  );
  assert.equal(stagedPackages.size, stagedCountBeforeBlockedNew);
  await service.saveProjectSnapshotAsPackage({
    destinationParentPath: "C:\\Projects",
    folderName: "Project B",
  });
  assert.equal(state.projectFilePath, destinationRoot);
  assert.equal(state.projectFileAutosaveDirty, false);

  // A successful drain writes A before Open adopts B.
  state.projectFilePath = createRoot;
  state.projectFileStorageMode = "desktop-package";
  service.clearProjectAutosaveState();
  service.markProjectAutosaveDirty({ domain: "manuscript", reason: "transition-success", source: "test" });
  operationLog.length = 0;
  await service.openDesktopProjectPackage({ rootPath: destinationRoot });
  const transitionLoadIndex = operationLog.findIndex((entry) => entry === `/api/project-package/load:${destinationRoot}`);
  const transitionSaveIndex = operationLog.findIndex((entry) => entry === `/api/project-package/save-stage:${createRoot}`);
  const transitionActivationIndex = operationLog.findIndex((entry) => entry === `activate-record:${record.id}`);
  assert.equal(transitionLoadIndex >= 0 && transitionSaveIndex > transitionLoadIndex && transitionActivationIndex > transitionSaveIndex, true);
  assert.equal(state.projectFilePath, destinationRoot);
  assert.equal(state.projectFileAutosaveDirty, false);
}

function createFakeProjectService(projectRecord, loadedRecord, browserCacheWrites = []) {
  let lastHydratedSnapshot = {
    activeProjectId: loadedRecord.id,
    projects: [loadedRecord],
  };

  return {
    saveProject({ projectRecord: incomingRecord, librarySnapshot, persist = true }) {
      const nextRecord = incomingRecord ?? projectRecord;
      const currentProjects = Array.isArray(librarySnapshot?.projects) && librarySnapshot.projects.length
        ? librarySnapshot.projects
        : [projectRecord];
      const nextProjects = currentProjects.some((project) => project.id === nextRecord.id)
        ? currentProjects.map((project) => (project.id === nextRecord.id ? nextRecord : project))
        : [...currentProjects, nextRecord];
      const nextSnapshot = {
        activeProjectId: nextRecord.id,
        projects: nextProjects,
      };
      if (persist) {
        browserCacheWrites.push(nextSnapshot);
      }
      return { librarySnapshot: nextSnapshot };
    },
    saveProjectLibrarySnapshot(snapshot) {
      browserCacheWrites.push(snapshot);
      lastHydratedSnapshot = snapshot;
      return {
        ...snapshot,
        projects: snapshot.projects.map((project) => ({
          ...project,
          sceneDrafts: hydrateActiveSceneDraftForTest(project, snapshot.sceneStore?.[project.id] ?? project.sceneDrafts ?? {}),
        })),
      };
    },
    openProject({ projectId = null, librarySnapshot = null } = {}) {
      const snapshot = librarySnapshot ?? lastHydratedSnapshot ?? {
        activeProjectId: loadedRecord.id,
        projects: [loadedRecord],
      };
      const activeProjectId = typeof projectId === "string" && projectId.trim()
        ? projectId
        : snapshot.activeProjectId;
      const projectRecord = snapshot.projects.find((project) => project.id === activeProjectId)
        ?? snapshot.projects[0]
        ?? null;
      const sceneStore = projectRecord?.id && snapshot.sceneStore?.[projectRecord.id]
        ? snapshot.sceneStore[projectRecord.id]
        : null;
      const hydratedProjectRecord = projectRecord
        ? {
          ...projectRecord,
          sceneDrafts: sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)
            ? sceneStore
            : projectRecord.sceneDrafts,
        }
        : null;
      return {
        activeProjectId: hydratedProjectRecord?.id ?? null,
        librarySnapshot: {
          ...snapshot,
          projects: snapshot.projects.map((project) => (
            project.id === hydratedProjectRecord?.id ? hydratedProjectRecord : project
          )),
        },
        projectRecord: hydratedProjectRecord,
      };
    },
    exportProjectLibrarySnapshot({ librarySnapshot = null } = {}) {
      const snapshot = librarySnapshot ?? lastHydratedSnapshot;
      const sceneStore = {
        ...(snapshot.sceneStore && typeof snapshot.sceneStore === "object" ? snapshot.sceneStore : {}),
      };
      for (const project of snapshot.projects ?? []) {
        if (
          project?.id &&
          project.sceneDrafts &&
          typeof project.sceneDrafts === "object" &&
          !Array.isArray(project.sceneDrafts) &&
          Object.keys(project.sceneDrafts).length
        ) {
          sceneStore[project.id] = {
            ...(sceneStore[project.id] && typeof sceneStore[project.id] === "object" && !Array.isArray(sceneStore[project.id])
              ? sceneStore[project.id]
              : {}),
            ...project.sceneDrafts,
          };
        }
      }
      return {
        schemaVersion: 2,
        activeProjectId: snapshot.activeProjectId ?? loadedRecord.id,
        projects: snapshot.projects ?? [loadedRecord],
        sceneStore,
      };
    },
  };
}

function hydrateActiveSceneDraftForTest(project, sceneDrafts) {
  if (!sceneDrafts || typeof sceneDrafts !== "object" || Array.isArray(sceneDrafts)) {
    return {};
  }

  const activeSceneId = typeof project?.projectSettings?.activeSceneId === "string" && project.projectSettings.activeSceneId.trim()
    ? project.projectSettings.activeSceneId
    : Object.keys(sceneDrafts)[0] ?? "";
  return activeSceneId && sceneDrafts[activeSceneId]
    ? { [activeSceneId]: sceneDrafts[activeSceneId] }
    : {};
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
      selectionDefaults: {
        lineId: "block-1",
        issueId: undefined,
        nodeId: undefined,
        entityId: undefined,
        explicitNull: null,
        emptyText: "",
        zero: 0,
        disabled: false,
        sceneId: "scene-1",
        sceneSelectionLineNumber: 7,
        sceneSelectionBlockId: "block-1",
        sceneSelectionStart: 7,
        sceneSelectionEnd: 14,
        sceneSelectionScrollTop: 240,
        sceneSelectionScrollLeft: 8,
      },
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
      selectionDefaults: {
        sceneId: "scene-loaded",
      },
    },
    sceneDrafts: {
      "scene-loaded": {
        sceneId: "scene-loaded",
        chapterId: "chapter-loaded",
        chapterTitle: "Loaded Chapter",
        sceneTitle: "Loaded Scene",
        sceneSynopsis: "",
        editorText: "Loaded project scene text.",
        blocks: [
          {
            blockId: "block-loaded-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: "Loaded project scene text.",
            issueIds: [],
            eventTagIds: [],
            isDraft: false,
          },
        ],
      },
    },
    projectSettings: {
      projectFilePath: "C:\\Projects\\loaded.abe-project.json",
    },
  };
}

function createRecoverableProjectRecord() {
  const scenes = Array.from({ length: 6 }, (_, index) => {
    const sceneNumber = index + 1;
    return {
      id: `recoverable-scene-${sceneNumber}`,
      title: `Recoverable Scene ${sceneNumber}`,
      chapterId: "recoverable-chapter",
      chapterTitle: "Recoverable Chapter",
      order: sceneNumber,
      lineCount: 1,
      wordCount: 4,
    };
  });
  const lines = scenes.map((scene, index) => ({
    blockId: `${scene.id}-block-1`,
    lineNumber: index + 1,
    kind: "narration",
    speakerLabel: "",
    text: `Recoverable scene ${index + 1} body.`,
    chapterId: scene.chapterId,
    chapterTitle: scene.chapterTitle,
    sceneId: scene.id,
    sceneTitle: scene.title,
    sceneSynopsis: "",
    issueIds: [],
    eventTagIds: [],
  }));

  return {
    id: "recoverable-project",
    title: "Recoverable Project",
    source: "test",
    workspace: {
      project: {
        id: "recoverable-project",
        title: "Recoverable Project",
        lines,
        stats: {
          chapterCount: 1,
          sceneCount: scenes.length,
          lineCount: lines.length,
        },
      },
      selectionDefaults: {
        sceneId: "recoverable-scene-1",
      },
    },
    projectIndex: {
      sceneOrder: scenes.map((scene) => scene.id),
      scenes,
      chapters: [
        {
          id: "recoverable-chapter",
          title: "Recoverable Chapter",
          order: 1,
          sceneIds: scenes.map((scene) => scene.id),
          lineCount: lines.length,
          wordCount: 24,
        },
      ],
    },
    sceneDrafts: {},
    projectSettings: {
      activeSceneId: "recoverable-scene-1",
      projectFilePath: "C:\\Projects\\recoverable.abe-project.json",
    },
  };
}

function createCollapsedProjectRecord() {
  const scenes = Array.from({ length: 6 }, (_, index) => {
    const sceneNumber = index + 1;
    return {
      id: `collapsed-scene-${sceneNumber}`,
      title: `Collapsed Scene ${sceneNumber}`,
      chapterId: "collapsed-chapter",
      chapterTitle: "Collapsed Chapter",
      order: sceneNumber,
      lineCount: 5,
      wordCount: sceneNumber === 1 ? 4 : 0,
    };
  });
  const lines = scenes.flatMap((scene, sceneIndex) =>
    Array.from({ length: scene.lineCount }, (_, lineIndex) => ({
      blockId: `${scene.id}-block-${lineIndex + 1}`,
      lineNumber: sceneIndex * 5 + lineIndex + 1,
      kind: "narration",
      speakerLabel: "",
      text: "",
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
      sceneId: scene.id,
      sceneTitle: scene.title,
      sceneSynopsis: "",
      issueIds: [],
      eventTagIds: [],
    })),
  );

  return {
    id: "collapsed-project",
    title: "Collapsed Project",
    source: "test",
    workspace: {
      project: {
        id: "collapsed-project",
        title: "Collapsed Project",
        lines,
        stats: {
          chapterCount: 1,
          sceneCount: scenes.length,
          lineCount: lines.length,
        },
      },
      selectionDefaults: {
        sceneId: "collapsed-scene-1",
      },
    },
    projectIndex: {
      sceneOrder: scenes.map((scene) => scene.id),
      scenes,
      chapters: [
        {
          id: "collapsed-chapter",
          title: "Collapsed Chapter",
          order: 1,
          sceneIds: scenes.map((scene) => scene.id),
          lineCount: lines.length,
          wordCount: 4,
        },
      ],
    },
    sceneDrafts: {},
    projectSettings: {
      activeSceneId: "collapsed-scene-1",
      projectFilePath: "C:\\Projects\\collapsed.abe-project.json",
    },
  };
}

function createCollapsedSceneStore() {
  return Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => {
      const sceneNumber = index + 1;
      const sceneId = `collapsed-scene-${sceneNumber}`;
      const editorText = sceneNumber === 1 ? "Only surviving scene body." : "";
      return [sceneId, {
        sceneId,
        chapterId: "collapsed-chapter",
        chapterTitle: "Collapsed Chapter",
        sceneTitle: `Collapsed Scene ${sceneNumber}`,
        sceneSynopsis: "",
        editorText,
        blocks: editorText
          ? [{
            blockId: `${sceneId}-block-1`,
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text: editorText,
            issueIds: [],
            eventTagIds: [],
            isDraft: false,
          }]
          : [],
      }];
    }),
  );
}

function createMetadataOnlySceneStore(projectRecord) {
  return Object.fromEntries(
    (projectRecord.projectIndex?.scenes ?? []).map((scene) => [scene.id, {
      sceneId: scene.id,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
      sceneTitle: scene.title,
      sceneSynopsis: "",
      editorText: "",
      blocks: [],
      location: "Earth",
      locationRowLabel: "Earth",
      locationRowKey: "earth",
      locationScope: "planetary",
      worldSpineMetadata: {
        location: "Earth",
        locationRowLabel: "Earth",
        locationRowKey: "earth",
        locationScope: "planetary",
      },
    }]),
  );
}

function createRecoveredFileSceneStore(projectRecord) {
  return Object.fromEntries(
    (projectRecord.projectIndex?.scenes ?? []).map((scene, index) => {
      const text = `Recovered file body for collapsed scene ${index + 1}.`;
      return [scene.id, {
        sceneId: scene.id,
        chapterId: scene.chapterId,
        chapterTitle: scene.chapterTitle,
        sceneTitle: scene.title,
        sceneSynopsis: "",
        editorText: text,
        blocks: [{
          blockId: `${scene.id}-file-block-1`,
          lineNumber: 1,
          kind: "narration",
          speakerLabel: "",
          text,
          issueIds: [],
          eventTagIds: [],
          isDraft: false,
        }],
      }];
    }),
  );
}

function createFakeWritableHandle(name, operationLog, options = {}) {
  let writtenText = typeof options.fileText === "string" ? options.fileText : "";
  return {
    name,
    permissionStatus: options.permissionStatus ?? "granted",
    async queryPermission() {
      if (options.logPermissionEvents === true) {
        operationLog.push("query-permission");
      }
      return this.permissionStatus;
    },
    async requestPermission() {
      if (options.logPermissionEvents === true) {
        operationLog.push("request-permission");
      }
      this.permissionStatus = options.requestPermissionStatus ?? "granted";
      return this.permissionStatus;
    },
    async createWritable() {
      operationLog.push("create-writable");
      if (options.abortWriteWithSecurityPolicy === true) {
        throw new DOMException("Aborted due to security policy.", "AbortError");
      }
      if (options.failWrite === true) {
        throw new Error("Simulated project file write failure.");
      }

      return {
        async write(value) {
          if (typeof options.onWrite === "function") {
            options.onWrite(value);
          }
          writtenText = String(value);
          operationLog.push(`write:${String(value).length}`);
          if (Array.isArray(options.writtenValues)) {
            options.writtenValues.push(String(value));
          }
        },
        async close() {
          operationLog.push("close");
          if (options.abortCloseWithSecurityPolicy === true) {
            throw new DOMException("Aborted due to security policy.", "AbortError");
          }
        },
      };
    },
    async getFile() {
      operationLog.push("get-file");
      return {
        name,
        async text() {
          if (options.returnStaleTextOnGetFile === true) {
            return JSON.stringify({
              activeProjectId: "stale-project",
              projects: [],
            });
          }
          if (writtenText) {
            return typeof options.transformReadback === "function"
              ? options.transformReadback(writtenText)
              : writtenText;
          }
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

function createFakeScrivenerDirectoryHandle() {
  return createFakeDirectoryHandle("Imported Novel.scriv", {
    "Imported Novel.scrivx": createFakeTextFile("Imported Novel.scrivx", `
      <ScrivenerProject>
        <Binder>
          <BinderItem UUID="draft-root">
            <Title>Draft</Title>
            <Type>DraftFolder</Type>
            <Children>
              <BinderItem UUID="scene-one">
                <Title>Imported Scene</Title>
                <Type>Text</Type>
              </BinderItem>
            </Children>
          </BinderItem>
        </Binder>
      </ScrivenerProject>
    `),
    Files: createFakeDirectoryHandle("Files", {
      Data: createFakeDirectoryHandle("Data", {
        "scene-one": createFakeDirectoryHandle("scene-one", {
          "content.rtf": createFakeTextFile("content.rtf", "{\\rtf1\\ansi Imported Scrivener text.}"),
        }),
      }),
    }),
  });
}

function createFakeDirectoryHandle(name, children = {}) {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const [childName, childHandle] of Object.entries(children)) {
        yield [childName, childHandle];
      }
    },
  };
}

function createFakeTextFile(name, content) {
  return {
    kind: "file",
    name,
    async getFile() {
      return {
        name,
        size: content.length,
        type: "text/plain",
        lastModified: 0,
        async text() {
          return content;
        },
      };
    },
  };
}
