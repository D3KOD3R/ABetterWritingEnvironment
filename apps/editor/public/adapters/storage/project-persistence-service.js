// Intent: centralize project save/load/autosave/import/export persistence behind one service boundary.
// Architecture guardrail:
// - UI modules call ProjectPersistenceService methods.
// - UI modules must not call localStorage, File System Access APIs, or desktop file APIs directly.
// Logging guidance:
// - Create source wrappers (`ProjectPersistenceService`, `AutosaveCoordinator`, `ProjectLoadGate`, `ProjectSaveGate`, `DesktopFileSystemAdapter`).
// - Keep log context focused on IDs, file paths, and operation state; avoid dumping full manuscript text.
import { createProjectFileAutosaveController } from "./autosave.js";
import { resolveProjectFileDisplayState } from "./project-file-display.js";
import {
  buildProjectFilePathFromRoot,
  canUseBrowserOpenPicker,
  canUseBrowserSavePicker,
  downloadProjectLibrarySnapshot,
  ensureProjectFileHandleWritePermission,
  getProjectFilePickerTypes,
  getProjectFileIdentity,
  getProjectRecordFilePath,
  getSuggestedProjectFileName,
  hasProjectFileDestination,
  hasProjectFilePath,
  normalizeProjectFilePath,
  pickProjectFileHandleForOpen,
  pickProjectFileHandleForSave,
  persistDesktopProjectFilePathPreference,
  promptForProjectFileFromInput,
  queryProjectFileHandleWritePermission,
  readProjectLibraryFromBrowserFile,
  readProjectLibraryFromBrowserHandle,
  readProjectLibraryFromDesktopPath,
  requestProjectFileHandleWritePermission,
  resolveLoadedProjectFileDestination,
  resolveProjectFilePath,
  writeProjectLibraryToBrowserHandle,
  writeProjectLibraryToDesktopPath,
} from "./project-file.js";
import {
  clearProjectFileHandleReference,
  loadProjectFileHandleReference,
  saveProjectFileHandleReference,
} from "./project-file-handle-store.js";

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// Intent: classify recoverable browser-handle permission failures so autosave can pause without error loops.
function isBrowserHandlePermissionError(error) {
  const errorName = typeof error?.name === "string" ? error.name : "";
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("write permission")
    || message.includes("re-authorize")
    || (errorName === "AbortError" && message.includes("security policy"));
}

function createNoopLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeDirtyDomain(value) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return candidate || "project";
}

function stableSerialize(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  const valueType = typeof value;
  if (valueType === "string") {
    return JSON.stringify(value);
  }
  if (valueType === "number" || valueType === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (valueType === "object") {
    const keys = Object.keys(value).sort();
    const serializedEntries = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${serializedEntries.join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function sanitizeWritingTargetState(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const sanitized = cloneValue(value);
  delete sanitized.updatedAt;
  delete sanitized.sessionLastActiveAt;
  delete sanitized.sessionSamples;
  return sanitized;
}

function sanitizeProjectIndexForComparison(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sanitized = cloneValue(value);
  delete sanitized.updatedAt;
  delete sanitized.createdAt;
  return sanitized;
}

function pickSceneDraftSubset(sceneDrafts, changedSceneIds = []) {
  if (!sceneDrafts || typeof sceneDrafts !== "object" || Array.isArray(sceneDrafts)) {
    return {};
  }

  const filteredSceneIds = Array.isArray(changedSceneIds)
    ? changedSceneIds.map((sceneId) => (typeof sceneId === "string" ? sceneId.trim() : "")).filter(Boolean)
    : [];

  if (!filteredSceneIds.length) {
    return sceneDrafts;
  }

  const subset = {};
  for (const sceneId of filteredSceneIds) {
    if (Object.hasOwn(sceneDrafts, sceneId)) {
      subset[sceneId] = sceneDrafts[sceneId];
    }
  }
  return subset;
}

function buildDomainComparablePayload(projectRecord, {
  domain = "project",
  changedSceneIds = [],
} = {}) {
  if (!projectRecord || typeof projectRecord !== "object") {
    return null;
  }

  const normalizedDomain = normalizeDirtyDomain(domain);
  const settings = projectRecord.projectSettings && typeof projectRecord.projectSettings === "object" && !Array.isArray(projectRecord.projectSettings)
    ? projectRecord.projectSettings
    : {};
  const sanitizedWritingTargetState = sanitizeWritingTargetState(settings.writingTargetState);

  if (normalizedDomain === "manuscript") {
    return {
      id: projectRecord.id ?? "",
      title: projectRecord.title ?? "",
      projectIndex: sanitizeProjectIndexForComparison(projectRecord.projectIndex),
      sceneDrafts: pickSceneDraftSubset(projectRecord.sceneDrafts, changedSceneIds),
      structureDrafts: projectRecord.structureDrafts ?? null,
      workspaceProject: projectRecord.workspace?.project ?? null,
    };
  }

  if (normalizedDomain === "manuscript-tasks" || normalizedDomain === "tasks") {
    return {
      id: projectRecord.id ?? "",
      manuscriptTasks: projectRecord.manuscriptTasks ?? [],
    };
  }

  if (normalizedDomain === "passage-notes" || normalizedDomain === "notes") {
    return {
      id: projectRecord.id ?? "",
      passageNotes: projectRecord.passageNotes ?? [],
    };
  }

  if (normalizedDomain === "writing-goals" || normalizedDomain === "writinggoals") {
    return {
      id: projectRecord.id ?? "",
      writingTargetState: sanitizedWritingTargetState,
      writingTargetViewMode: settings.writingTargetViewMode ?? "",
      writingTargetSelectedDateKey: settings.writingTargetSelectedDateKey ?? "",
      writingTargetCalendarMonthKey: settings.writingTargetCalendarMonthKey ?? "",
    };
  }

  if (normalizedDomain === "world") {
    return {
      id: projectRecord.id ?? "",
      workspaceWorld: projectRecord.workspace?.world ?? null,
      templateDrafts: projectRecord.templateDrafts ?? null,
    };
  }

  if (normalizedDomain === "app-settings" || normalizedDomain === "appsettings") {
    return {
      id: projectRecord.id ?? "",
      editorPrefs: settings.editorPrefs ?? null,
      localAiPrefs: settings.localAiPrefs ?? null,
      binderPanelWidth: settings.binderPanelWidth ?? null,
      consoleDockWidth: settings.consoleDockWidth ?? null,
      userSettingPanelResizerLeftPercent: settings.userSettingPanelResizerLeftPercent ?? null,
      userSettingPanelResizerRightPercent: settings.userSettingPanelResizerRightPercent ?? null,
      consoleDockCollapsed: settings.consoleDockCollapsed ?? null,
      collapsedChapterIds: settings.collapsedChapterIds ?? null,
      collapsedConsoleChapterIds: settings.collapsedConsoleChapterIds ?? null,
    };
  }

  if (normalizedDomain === "project-settings" || normalizedDomain === "projectsettings") {
    const nextSettings = cloneValue(settings);
    delete nextSettings.writingTargetState;
    delete nextSettings.writingTargetViewMode;
    delete nextSettings.writingTargetSelectedDateKey;
    delete nextSettings.writingTargetCalendarMonthKey;
    return {
      id: projectRecord.id ?? "",
      projectSettings: nextSettings,
    };
  }

  const nextRecord = cloneValue(projectRecord);
  delete nextRecord.updatedAt;
  delete nextRecord.createdAt;
  nextRecord.projectIndex = sanitizeProjectIndexForComparison(nextRecord.projectIndex);
  if (nextRecord.projectSettings && typeof nextRecord.projectSettings === "object" && !Array.isArray(nextRecord.projectSettings)) {
    nextRecord.projectSettings.writingTargetState = sanitizeWritingTargetState(nextRecord.projectSettings.writingTargetState);
  }
  return nextRecord;
}

function hasCanonicalDomainMutation(previousProjectRecord, nextProjectRecord, options = {}) {
  if (!previousProjectRecord) {
    return true;
  }

  const previousPayload = buildDomainComparablePayload(previousProjectRecord, options);
  const nextPayload = buildDomainComparablePayload(nextProjectRecord, options);
  return stableSerialize(previousPayload) !== stableSerialize(nextPayload);
}

function normalizeDirtyReason(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return "user-edit";
}

function normalizeMutationSource(value, fallback = "commitCanonicalProjectMutation") {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function getProjectSceneStore(sceneStore, projectId) {
  if (!sceneStore || typeof sceneStore !== "object" || Array.isArray(sceneStore)) {
    return null;
  }
  if (typeof projectId !== "string" || !projectId.trim()) {
    return null;
  }

  const scenes = sceneStore[projectId];
  return scenes && typeof scenes === "object" && !Array.isArray(scenes)
    ? cloneValue(scenes)
    : null;
}

function getSingleProjectSceneStore(sceneStore) {
  if (!sceneStore || typeof sceneStore !== "object" || Array.isArray(sceneStore)) {
    return null;
  }

  const sceneStores = Object.values(sceneStore)
    .filter((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate));
  return sceneStores.length === 1 ? cloneValue(sceneStores[0]) : null;
}

function sceneDraftHasSubstantiveBody(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return false;
  }

  if (typeof draft.editorText === "string" && draft.editorText.trim()) {
    return true;
  }

  return Array.isArray(draft.blocks) && draft.blocks.some((block) =>
    typeof block?.text === "string" && block.text.trim().length > 0,
  );
}

function mergeProjectSceneStores(primaryStore, fallbackStore) {
  if (!fallbackStore || typeof fallbackStore !== "object" || Array.isArray(fallbackStore)) {
    return primaryStore ? cloneValue(primaryStore) : null;
  }

  const mergedStore = cloneValue(fallbackStore);
  if (!primaryStore || typeof primaryStore !== "object" || Array.isArray(primaryStore)) {
    return mergedStore;
  }

  for (const [sceneId, sceneDraft] of Object.entries(primaryStore)) {
    const fallbackDraft = mergedStore[sceneId];
    if (sceneDraftHasSubstantiveBody(sceneDraft) || !sceneDraftHasSubstantiveBody(fallbackDraft)) {
      mergedStore[sceneId] = cloneValue(sceneDraft);
    }
  }

  return mergedStore;
}

function resolveMutationDomain(options = {}) {
  if (typeof options.domain === "string" && options.domain.trim()) {
    return normalizeDirtyDomain(options.domain);
  }

  const changedSceneIds = Array.isArray(options.changedSceneIds)
    ? options.changedSceneIds.map((sceneId) => (typeof sceneId === "string" ? sceneId.trim() : "")).filter(Boolean)
    : [];
  if (changedSceneIds.length) {
    return "manuscript";
  }

  const classifier = `${String(options.source ?? "")} ${String(options.dirtyReason ?? "")}`.toLowerCase();
  if (classifier.includes("writing-target") || classifier.includes("session-tracker") || classifier.includes("writing-goal")) {
    return "writing-goals";
  }
  if (classifier.includes("task")) {
    return "manuscript-tasks";
  }
  if (classifier.includes("passage-note") || classifier.includes("passage note") || classifier.includes("inspiration") || classifier.includes("research")) {
    return "passage-notes";
  }
  if (classifier.includes("manuscript") || classifier.includes("scene") || classifier.includes("chapter")) {
    return "manuscript";
  }
  if (classifier.includes("world") || classifier.includes("template") || classifier.includes("entity") || classifier.includes("spine")) {
    return "world";
  }
  if (classifier.includes("pref") || classifier.includes("setting") || classifier.includes("local-ai")) {
    return "app-settings";
  }

  return "project";
}

export function createProjectPersistenceService({
  state,
  windowRef = globalThis.window,
  projectService,
  projectRepository,
  fetchJsonFromDesktopApi,
  projectSchemaVersion,
  autosaveDelayMs,
  shouldPersistProjectCache = () => true,
  clearBrowserProjectCache = () => true,
  writeProjectFilePathCache = () => {},
  createProjectRecordFromRuntimeState,
  getActiveProjectRecord,
  normalizeProjectLibrarySnapshot,
  normalizeProjectRecord,
  resolveActiveProjectId,
  activateLoadedProjectRecord,
  prepareProjectSnapshotForSave = () => {},
  reportBrowserLog = () => {},
  renderHeader = () => {},
  resolveSuggestedProjectFileName = () => getSuggestedProjectFileName(),
  onProjectRecordPersisted = () => {},
  onProjectRecordPersistSkipped = () => {},
  loggerSources = {},
} = {}) {
  if (!state || typeof state !== "object") {
    throw new Error("ProjectPersistenceService requires a state object.");
  }
  if (!projectService) {
    throw new Error("ProjectPersistenceService requires a projectService.");
  }
  if (!projectRepository) {
    throw new Error("ProjectPersistenceService requires a projectRepository.");
  }
  if (typeof fetchJsonFromDesktopApi !== "function") {
    throw new Error("ProjectPersistenceService requires a desktop API fetch bridge.");
  }
  if (typeof createProjectRecordFromRuntimeState !== "function") {
    throw new Error("ProjectPersistenceService requires createProjectRecordFromRuntimeState.");
  }
  if (typeof getActiveProjectRecord !== "function") {
    throw new Error("ProjectPersistenceService requires getActiveProjectRecord.");
  }
  if (typeof normalizeProjectLibrarySnapshot !== "function") {
    throw new Error("ProjectPersistenceService requires normalizeProjectLibrarySnapshot.");
  }
  if (typeof normalizeProjectRecord !== "function") {
    throw new Error("ProjectPersistenceService requires normalizeProjectRecord.");
  }
  if (typeof resolveActiveProjectId !== "function") {
    throw new Error("ProjectPersistenceService requires resolveActiveProjectId.");
  }
  if (typeof activateLoadedProjectRecord !== "function") {
    throw new Error("ProjectPersistenceService requires activateLoadedProjectRecord callback.");
  }

  const autosaveCoordinatorLog = loggerSources.autosaveCoordinator ?? createNoopLogger();
  const projectPersistenceLog = loggerSources.projectPersistence ?? createNoopLogger();
  const projectLoadGateLog = loggerSources.projectLoadGate ?? createNoopLogger();
  const projectSaveGateLog = loggerSources.projectSaveGate ?? createNoopLogger();
  const desktopFileSystemLog = loggerSources.desktopFileSystem ?? createNoopLogger();

  function hasProjectSaveDestination() {
    // Intent: a remembered browser handle is still a save target; autosave can fall back to browser cache until reauthorized.
    return hasProjectFileDestination({
      fileHandle: state.projectFileHandle,
      filePath: state.projectFilePath,
    });
  }

  function getProjectFileDisplayState() {
    return resolveProjectFileDisplayState({
      projectFilePath: state.projectFilePath,
      projectFileHandle: state.projectFileHandle,
      projectLibrary: state.projectLibrary,
      activeProjectId: state.activeProjectId,
      projectLibrarySelectionId: state.projectLibrarySelectionId,
    });
  }

  async function persistDesktopProjectFilePath(filePath, explicit = true) {
    await persistDesktopProjectFilePathPreference(filePath, {
      explicit,
      fetchJsonFromDesktopApi,
      onError: (error, resolvedPath) => {
        reportBrowserLog("warn", "settings", "Unable to persist the desktop project file path.", {
          error,
          filePath: resolvedPath,
        });
      },
    });
  }

  // Intent: keep browser handle persistence inside the project persistence service boundary.
  async function persistBrowserProjectFileHandle(fileHandle, filePath, source = "project-file-handle") {
    if (!fileHandle) {
      return false;
    }

    const projectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
    try {
      const persisted = await saveProjectFileHandleReference({
        windowRef,
        projectId,
        filePath,
        fileName: fileHandle.name ?? "",
        fileHandle,
      });
      if (persisted) {
        desktopFileSystemLog.info("persistence", "project.file-handle.persisted", "Persisted browser project file handle reference.", {
          projectId,
          filePath,
          fileName: fileHandle.name ?? "",
          source,
        });
      }
      return persisted;
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.file-handle.persist-failed", "Unable to persist browser project file handle reference.", {
        projectId,
        filePath,
        fileName: fileHandle.name ?? "",
        source,
        error,
      });
      return false;
    }
  }

  async function clearBrowserProjectFileHandle(source = "project-file-destination-change") {
    try {
      await clearProjectFileHandleReference({
        windowRef,
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      });
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.file-handle-clear-failed", "Unable to clear browser project file handle reference.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        source,
        error,
      });
    }
  }

  // Intent: persist the active project choice from the canonical activation boundary so refresh restores the same project.
  function persistActiveProjectId(projectId) {
    const resolvedProjectId = typeof projectId === "string" ? projectId.trim() : "";
    if (!resolvedProjectId) {
      return null;
    }

    projectRepository.saveActiveProjectId(resolvedProjectId);
    return resolvedProjectId;
  }

  function ensureEditorWorkingDirtyState() {
    if (!state.projectEditorWorkingDirtyState || typeof state.projectEditorWorkingDirtyState !== "object") {
      state.projectEditorWorkingDirtyState = {
        dirty: false,
        lastMutationAt: "",
        domains: {},
      };
    }
    if (!state.projectEditorWorkingDirtyState.domains || typeof state.projectEditorWorkingDirtyState.domains !== "object") {
      state.projectEditorWorkingDirtyState.domains = {};
    }
    return state.projectEditorWorkingDirtyState;
  }

  function markEditorWorkingMutation(options = {}) {
    const workingState = ensureEditorWorkingDirtyState();
    const domain = resolveMutationDomain(options);
    const dirtyReason = normalizeDirtyReason(options.dirtyReason);
    const source = normalizeMutationSource(options.source, "markEditorWorkingMutation");
    const markedAt = new Date().toISOString();

    workingState.dirty = true;
    workingState.lastMutationAt = markedAt;
    workingState.domains[domain] = {
      markedAt,
      reason: dirtyReason,
      source,
    };

    projectPersistenceLog.debug(
      "state-change",
      "project.working-dirty.marked",
      "Marked editor working state dirty from mutation entrypoint.",
      {
        domain,
        dirtyReason,
        source,
        dirtyDomainCount: Object.keys(workingState.domains).length,
      },
    );
  }

  function clearEditorWorkingDirtyState(reason = "manual") {
    state.projectEditorWorkingDirtyState = {
      dirty: false,
      lastMutationAt: "",
      domains: {},
      clearedAt: new Date().toISOString(),
      clearReason: reason,
    };
    projectPersistenceLog.debug(
      "state-change",
      "project.working-dirty.cleared",
      "Cleared editor working dirty state.",
      {
        reason,
      },
    );
  }

  // Intent: canonical project mutation boundary; UI/workflow code calls here instead of directly touching persistence adapters.
  function commitCanonicalProjectMutation(options = {}) {
    const domain = resolveMutationDomain(options);
    const dirtyReason = normalizeDirtyReason(options.dirtyReason);
    const source = normalizeMutationSource(options.source, "commitCanonicalProjectMutation");
    const skipProjectFileAutosave = options.skipProjectFileAutosave === true;
    const changedSceneIds = Array.isArray(options.changedSceneIds) ? options.changedSceneIds : [];

    if (options.markWorkingState !== false) {
      markEditorWorkingMutation({
        domain,
        dirtyReason,
        source,
      });
    }

    const projectRecord = createProjectRecordFromRuntimeState();
    if (!projectRecord) {
      projectPersistenceLog.warn(
        "validation",
        "project.persist.skipped",
        "Skipped project persistence because no active project record could be created.",
        {
          activeProjectId: state.activeProjectId ?? "",
        },
      );
      onProjectRecordPersistSkipped(options);
      return null;
    }

    const currentActiveProjectId = state.activeProjectId ?? state.projectLibrarySelectionId ?? projectRecord.id;
    const previousProjectRecord = state.projectLibrary.find((project) => project?.id === currentActiveProjectId) ?? null;
    const hasCanonicalMutation = hasCanonicalDomainMutation(previousProjectRecord, projectRecord, {
      domain,
      changedSceneIds,
    });
    if (!hasCanonicalMutation) {
      projectPersistenceLog.debug(
        "state-change",
        "project.persist.noop",
        "Canonical project payload unchanged for mutation domain; skipping persistence write.",
        {
          projectId: projectRecord.id,
          domain,
          dirtyReason,
          source,
          changedSceneIds,
        },
      );
      onProjectRecordPersistSkipped({
        ...options,
        domain,
        dirtyReason,
        source,
        skipProjectFileAutosave,
        reason: "no-canonical-domain-change",
      });
      return previousProjectRecord ?? projectRecord;
    }

    const persistCache = shouldPersistProjectCache() === true;
    projectPersistenceLog.debug("persistence", "project.persist.begin", "Persisting active project record.", {
      projectId: projectRecord.id,
      persistCache,
      changedSceneIds,
      domain,
      skipProjectFileAutosave,
      dirtyReason,
      source,
    });

    const { librarySnapshot } = projectService.saveProject({
      projectRecord,
      librarySnapshot: {
        activeProjectId: state.activeProjectId ?? state.projectLibrarySelectionId ?? projectRecord.id,
        projects: state.projectLibrary,
      },
      persist: persistCache,
      setActive: true,
      changedSceneIds: changedSceneIds.length ? changedSceneIds : null,
    });

    state.projectLibrary = librarySnapshot.projects;
    state.activeProjectId = librarySnapshot.activeProjectId ?? projectRecord.id;
    state.projectLibrarySelectionId = state.activeProjectId;

    if (!skipProjectFileAutosave) {
      markProjectAutosaveDirty({
        domain,
        reason: dirtyReason,
        source,
      });
      autosaveCoordinatorLog.debug("autosave", "project.persist.mark-dirty", "Project persistence marked autosave dirty.", {
        projectId: projectRecord.id,
        domain,
        dirtyReason,
        source,
      });
    } else {
      autosaveCoordinatorLog.debug("autosave", "project.persist.skip-dirty", "Project persistence skipped autosave dirty mark.", {
        projectId: projectRecord.id,
        domain,
        dirtyReason,
        source,
      });
    }

    onProjectRecordPersisted({
      projectRecord,
      persistCache,
      options: {
        ...options,
        domain,
        dirtyReason,
        source,
        changedSceneIds,
      },
    });

    return projectRecord;
  }

  // Intent: compatibility alias while callers migrate to commitCanonicalProjectMutation naming.
  function persistActiveProjectRecord(options = {}) {
    return commitCanonicalProjectMutation(options);
  }

  function setActiveProjectFileDestination(pathValue, handle = null, options = {}) {
    state.projectFilePath = resolveProjectFilePath(pathValue);
    state.projectFileHandle = handle;
    state.projectFileHandlePermission = handle
      ? (options.handlePermission ?? state.projectFileHandlePermission ?? "prompt")
      : "";
    if (shouldPersistProjectCache() === true) {
      writeProjectFilePathCache(state.projectFilePath);
    }

    if (handle && options.persistBrowserFileHandle !== false) {
      void persistBrowserProjectFileHandle(
        handle,
        state.projectFilePath || handle.name || "",
        options.source ?? "setActiveProjectFileDestination",
      );
    } else if (!handle && options.clearBrowserFileHandle === true) {
      void clearBrowserProjectFileHandle(options.source ?? "setActiveProjectFileDestination");
    }

    if (options.skipProjectRecordPersistence !== true) {
      commitCanonicalProjectMutation({
        domain: options.domain ?? "project-settings",
        skipProjectFileAutosave: options.skipProjectFileAutosave === true,
        dirtyReason: options.dirtyReason ?? "project-file-destination-change",
        source: options.source ?? "setActiveProjectFileDestination",
        markWorkingState: options.markWorkingState !== false,
      });
    }

    if (options.persistDesktopProjectFilePath === true) {
      void persistDesktopProjectFilePath(state.projectFilePath, hasProjectFilePath(state.projectFilePath));
    } else if (options.clearDesktopProjectFilePath === true) {
      void persistDesktopProjectFilePath("", false);
    }
  }

  // Intent: build the canonical payload written to every `.abe-project.json` destination.
  function buildProjectSnapshotForSaveFile() {
    // Saving should snapshot current state without manufacturing a new autosave-dirty revision.
    commitCanonicalProjectMutation({
      domain: "project",
      skipProjectFileAutosave: true,
      dirtyReason: "save-snapshot-build",
      source: "buildProjectSnapshotForSaveFile",
      markWorkingState: false,
    });
    const activeProjectId = state.activeProjectId ?? state.projectLibrarySelectionId ?? state.projectLibrary[0]?.id ?? null;
    const activeProjectRecord = state.projectLibrary.find((project) => project?.id === activeProjectId) ?? state.projectLibrary[0] ?? null;
    const projects = activeProjectRecord ? [cloneValue(activeProjectRecord)] : [];
    return projectService.exportProjectLibrarySnapshot({
      librarySnapshot: {
        schemaVersion: projectSchemaVersion,
        activeProjectId: activeProjectRecord?.id ?? activeProjectId,
        projects,
      },
    }) ?? {
      activeProjectId: activeProjectRecord?.id ?? activeProjectId,
      projects,
    };
  }

  // Intent: mirror the last saved canonical project snapshot into browser storage so refresh restores the latest revision.
  function persistProjectSnapshotToBrowserCache(snapshot, context = {}) {
    try {
      const snapshotProjects = Array.isArray(snapshot?.projects) ? snapshot.projects.filter(Boolean) : [];
      const persistedLibrary = projectService.saveProjectLibrarySnapshot({
        schemaVersion: snapshot?.schemaVersion ?? projectSchemaVersion,
        activeProjectId: snapshot?.activeProjectId ?? snapshotProjects[0]?.id ?? state.activeProjectId ?? null,
        projects: snapshotProjects,
        sceneStore: snapshot?.sceneStore ?? {},
      });
      state.projectLibrary = persistedLibrary.projects;
      state.activeProjectId = persistedLibrary.activeProjectId;
      state.projectLibrarySelectionId = persistedLibrary.activeProjectId;
      if (persistedLibrary.storagePersisted === false) {
        state.projectFileStatus = "Browser cache is full: latest project is still open, but refresh may restore the previous cached version. Press Ctrl+S or Save as file.";
        desktopFileSystemLog.warn("persistence", "project.save.browser-cache-unpersisted", "Browser cache snapshot could not be fully written.", {
          projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
          target: context.target ?? "browser-cache",
          reason: context.reason ?? "save-project",
          filePath: context.filePath ?? state.projectFilePath ?? "",
        });
        reportBrowserLog("warn", "project-library", "Browser cache is full; latest project was not fully persisted for refresh.", {
          projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
          target: context.target ?? "browser-cache",
          reason: context.reason ?? "save-project",
          filePath: context.filePath ?? state.projectFilePath ?? "",
        });
        return false;
      }
      desktopFileSystemLog.info("persistence", "project.save.browser-cache", "Saved project snapshot to browser storage.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        target: context.target ?? "browser-cache",
        reason: context.reason ?? "save-project",
        filePath: context.filePath ?? state.projectFilePath ?? "",
      });
      return true;
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.save.browser-cache-failed", "Saving project snapshot to browser storage failed.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        target: context.target ?? "browser-cache",
        reason: context.reason ?? "save-project",
        filePath: context.filePath ?? state.projectFilePath ?? "",
        error,
      });
      reportBrowserLog("warn", "project-library", "Failed to persist the saved project snapshot to browser storage.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        target: context.target ?? "browser-cache",
        reason: context.reason ?? "save-project",
        filePath: context.filePath ?? state.projectFilePath ?? "",
        error,
      });
      return false;
    }
  }

  function queueProjectAutosaveIfDirty() {
    if (state.projectFileAutosaveDirty) {
      queueProjectAutosave();
    }
  }

  // Intent: preserve refresh safety even when the external file target rejects the write.
  function persistProjectSnapshotFallbackAfterFileSaveFailure(snapshot, context = {}) {
    const persisted = persistProjectSnapshotToBrowserCache(snapshot, {
      target: context.target ?? "file-save-fallback",
      reason: context.reason ?? "save-project",
      filePath: context.filePath ?? state.projectFilePath ?? "",
    });
    if (persisted) {
      state.projectFileStatus = `Save failed: ${toErrorMessage(context.error)} Latest project preserved in browser cache.`;
    } else {
      state.projectFileStatus = `Save failed: ${toErrorMessage(context.error)} Browser cache is also unavailable; press Ctrl+S or Save as file before refreshing.`;
    }
    return persisted;
  }

  // Intent: keep project save result logs consistent across file-backed and browser-cache fallback paths.
  function reportProjectLibrarySaveResult(target, message = "Saved current project to library.") {
    if (!state.workspace?.project?.stats) return;
    reportBrowserLog("info", "project-library", message, {
      projectId: state.activeProjectId ?? state.workspace.project.id,
      title: state.projectTitle,
      chapters: state.workspace.project.stats.chapterCount,
      scenes: state.workspace.project.stats.sceneCount,
      templates: state.workspace.world?.stats?.templateCount ?? 0,
      target,
    });
  }

  async function saveProjectSnapshotToBrowserHandle(handle, snapshot = buildProjectSnapshotForSaveFile(), options = {}) {
    if (!handle) {
      throw new Error("A browser file handle is required.");
    }

    const saveProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
    const saveRevision = state.projectFileAutosaveRevision;
    const browserHandleProjectFilePath = state.projectFilePath || handle.name || "";
    state.projectFileBusy = true;
    state.projectFileStatus = "Saving project file...";
    renderHeader();

    try {
      const writePermissionGranted = await ensureProjectFileHandleWritePermission(handle, {
        requestPermission: options.requestPermission === true,
      });
      state.projectFileHandlePermission = writePermissionGranted ? "granted" : "prompt";
      if (!writePermissionGranted) {
        throw new Error("Project file write permission is unavailable. Use Ctrl+S or Save as file to re-authorize this file.");
      }

      const savedLabel = await writeProjectLibraryToBrowserHandle(handle, snapshot, {
        fallbackFileName: resolveSuggestedProjectFileName(),
        requestPermission: false,
      });
      const activeProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
      if (activeProjectId !== saveProjectId) {
        desktopFileSystemLog.warn(
          "persistence",
          "project.save.context-stale",
          "Ignored stale browser-handle save result after active project changed.",
          {
            saveProjectId,
            activeProjectId,
            handleName: handle?.name ?? "",
          },
        );
        return savedLabel;
      }

      setActiveProjectFileDestination(browserHandleProjectFilePath || savedLabel, handle, {
        skipProjectFileAutosave: true,
        handlePermission: "granted",
        persistBrowserFileHandle: true,
        persistDesktopProjectFilePath: hasProjectFilePath(browserHandleProjectFilePath),
        clearDesktopProjectFilePath: !hasProjectFilePath(browserHandleProjectFilePath),
      });
      persistProjectSnapshotToBrowserCache(snapshot, {
        target: "browser-handle",
        reason: "save-project",
        filePath: savedLabel,
      });
      state.projectFileStatus = `Saved to ${savedLabel}`;
      reportBrowserLog("info", "project-file", "Saved the current project file.", {
        filePath: savedLabel,
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
        title: state.projectTitle,
        mode: "browser-handle",
      });
      if (state.projectFileAutosaveRevision === saveRevision) {
        clearProjectAutosaveState();
        clearEditorWorkingDirtyState("project-save-succeeded");
      }
      renderHeader();
      return savedLabel;
    } catch (error) {
      const activeProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
      if (activeProjectId === saveProjectId) {
        state.projectFileStatus = `Save failed: ${toErrorMessage(error)}`;
      }
      const isPermissionError = isBrowserHandlePermissionError(error);
      if (isPermissionError) {
        state.projectFileHandlePermission = "prompt";
      }
      reportBrowserLog(
        isPermissionError && options.requestPermission !== true ? "warn" : "error",
        "project-file",
        isPermissionError && options.requestPermission !== true
          ? "Project file save needs browser write permission."
          : "Project file save failed.",
        {
          filePath: handle?.name ?? null,
          error,
          mode: "browser-handle",
          saveProjectId,
          activeProjectId,
        },
      );
      renderHeader();
      throw error;
    } finally {
      state.projectFileBusy = false;
      queueProjectAutosaveIfDirty();
      renderHeader();
    }
  }

  async function saveProjectSnapshotToFilePath(filePath, snapshot = buildProjectSnapshotForSaveFile()) {
    const resolvedPath = normalizeProjectFilePath(filePath);
    if (!resolvedPath) {
      throw new Error("A project file path is required.");
    }

    const saveProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
    const saveRevision = state.projectFileAutosaveRevision;
    state.projectFileBusy = true;
    state.projectFileStatus = "Saving project file...";
    renderHeader();

    try {
      const savedPath = await writeProjectLibraryToDesktopPath(resolvedPath, snapshot, {
        fetchJsonFromDesktopApi,
      });
      const activeProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
      if (activeProjectId !== saveProjectId) {
        desktopFileSystemLog.warn(
          "persistence",
          "project.save.context-stale",
          "Ignored stale file-path save result after active project changed.",
          {
            saveProjectId,
            activeProjectId,
            filePath: resolvedPath,
          },
        );
        return savedPath;
      }

      setActiveProjectFileDestination(savedPath, null, {
        skipProjectFileAutosave: true,
        persistDesktopProjectFilePath: true,
        clearBrowserFileHandle: true,
        source: "saveProjectSnapshotToFilePath",
      });
      persistProjectSnapshotToBrowserCache(snapshot, {
        target: "desktop-path",
        reason: "save-project",
        filePath: savedPath,
      });
      state.projectFileStatus = `Saved to ${savedPath}`;
      reportBrowserLog("info", "project-file", "Saved the current project file.", {
        filePath: savedPath,
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
        title: state.projectTitle,
        mode: "desktop-path",
      });
      if (state.projectFileAutosaveRevision === saveRevision) {
        clearProjectAutosaveState();
        clearEditorWorkingDirtyState("project-save-succeeded");
      }
      renderHeader();
      return savedPath;
    } catch (error) {
      const activeProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
      if (activeProjectId === saveProjectId) {
        state.projectFileStatus = `Save failed: ${toErrorMessage(error)}`;
      }
      reportBrowserLog("error", "project-file", "Project file save failed.", {
        filePath: resolvedPath,
        error,
        mode: "desktop-path",
        saveProjectId,
        activeProjectId,
      });
      renderHeader();
      throw error;
    } finally {
      state.projectFileBusy = false;
      queueProjectAutosaveIfDirty();
      renderHeader();
    }
  }

  // Intent: close the autosave gap before replacing runtime state with a loaded project snapshot.
  async function preserveActiveProjectBeforeLoad(source = "project-load") {
    commitCanonicalProjectMutation({
      domain: "project",
      dirtyReason: "before-project-load",
      source,
      markWorkingState: false,
    });

    if (state.projectFileAutosaveDirty === true) {
      await flushProjectAutosave();
    }
  }

  // Intent: load project files into active state and immediately retarget autosave to the loaded destination.
  async function hydrateProjectLibraryFromLoadedSnapshot(loadedSnapshot, options = {}) {
    const loadedLibrary = normalizeProjectLibrarySnapshot(loadedSnapshot);
    const loadedProjects = loadedLibrary.projects
      .map((project) => normalizeProjectRecord(project))
      .filter(Boolean);
    if (!loadedProjects.length) {
      throw new Error("Project file did not contain any saved projects.");
    }

    const loadedActiveProjectId = resolveActiveProjectId(
      loadedLibrary.activeProjectId,
      {
        activeProjectId: loadedLibrary.activeProjectId,
        projects: loadedProjects,
      },
    );
    const loadedActiveProject = loadedProjects.find((project) => project.id === loadedActiveProjectId) ?? loadedProjects[0];
    const durableLoadedFilePath = hasProjectFilePath(options.filePath) ? normalizeProjectFilePath(options.filePath) : "";
    const loadedHandleFileName = normalizeProjectFilePath(options.fileName || options.fileHandle?.name || "");
    const loadedFileDisplayPath = durableLoadedFilePath || loadedHandleFileName;
    const loadedFileIdentity = getProjectFileIdentity(loadedFileDisplayPath);
    if (
      loadedFileIdentity &&
      loadedActiveProject?.id &&
      loadedFileIdentity !== loadedActiveProject.id
    ) {
      reportBrowserLog("warn", "project-file", "Loaded project file name differs from the project payload identity.", {
        filePath: loadedFileDisplayPath,
        fileProjectId: loadedFileIdentity,
        payloadProjectId: loadedActiveProject.id,
        payloadTitle: loadedActiveProject.title ?? "",
        sourceLabel: options.sourceLabel ?? "file",
        mode: options.mode ?? "unknown",
      });
    }
    const existingProjectWithSameId = loadedActiveProject
      ? state.projectLibrary.find((project) => project?.id === loadedActiveProject.id) ?? null
      : null;
    const existingProjectFilePath = getProjectRecordFilePath(existingProjectWithSameId);
    const shouldRemapLoadedProjectId =
      Boolean(loadedFileDisplayPath) &&
      Boolean(existingProjectWithSameId) &&
      normalizeProjectFilePath(existingProjectFilePath) !== loadedFileDisplayPath;
    const loadedProjectId = shouldRemapLoadedProjectId
      ? getProjectFileIdentity(loadedFileDisplayPath) || loadedActiveProject.id
      : loadedActiveProject?.id ?? "";
    const importedProject = loadedActiveProject
      ? {
        ...cloneValue(loadedActiveProject),
        id: loadedProjectId,
        workspace: {
          ...(loadedActiveProject.workspace && typeof loadedActiveProject.workspace === "object" && !Array.isArray(loadedActiveProject.workspace)
            ? loadedActiveProject.workspace
            : {}),
          project: {
            ...(loadedActiveProject.workspace?.project && typeof loadedActiveProject.workspace.project === "object" && !Array.isArray(loadedActiveProject.workspace.project)
              ? loadedActiveProject.workspace.project
              : {}),
            id: loadedProjectId,
          },
        },
        projectSettings: {
          ...(loadedActiveProject.projectSettings && typeof loadedActiveProject.projectSettings === "object" && !Array.isArray(loadedActiveProject.projectSettings)
            ? loadedActiveProject.projectSettings
            : {}),
          projectFilePath: loadedFileDisplayPath,
        },
      }
      : null;
    const loadedSceneStore = loadedActiveProject
      ? getProjectSceneStore(loadedLibrary.sceneStore, loadedActiveProject.id) ?? getSingleProjectSceneStore(loadedLibrary.sceneStore)
      : null;
    const importedSceneStore = mergeProjectSceneStores(loadedSceneStore, null);
    const importedProjects = importedProject ? [importedProject] : loadedProjects;
    const importedSceneStoreByProject = importedSceneStore
      ? { [importedProject.id]: importedSceneStore }
      : loadedLibrary.sceneStore ?? {};

    const activeProjectId = resolveActiveProjectId(
      importedProject?.id ?? loadedLibrary.activeProjectId,
      {
        activeProjectId: importedProject?.id ?? loadedLibrary.activeProjectId,
        projects: importedProjects,
      },
    );

    const projectContentCacheCleared = clearBrowserProjectCache({
      projectId: activeProjectId,
      source: "hydrateProjectLibraryFromLoadedSnapshot",
      reason: options.reason ?? "load-project-file",
    }) !== false;
    if (!projectContentCacheCleared) {
      desktopFileSystemLog.warn("persistence", "project.load.cache-clear-incomplete", "Project-specific browser cache could not be completely cleared before loading JSON project data.", {
        projectId: activeProjectId,
        reason: options.reason ?? "load-project-file",
        mode: options.mode ?? "unknown",
      });
    }
    const persistedLibrary = projectService.saveProjectLibrarySnapshot({
      activeProjectId,
      projects: importedProjects,
      sceneStore: importedSceneStoreByProject,
    }, {
      replaceExistingCache: true,
    });
    // Intent: activate from the in-memory load result so localStorage quota failures cannot resurrect stale project chunks.
    state.projectLibrary = Array.isArray(persistedLibrary.projects) ? persistedLibrary.projects : importedProjects;
    state.activeProjectId = persistedLibrary.activeProjectId ?? activeProjectId;
    state.projectLibrarySelectionId = state.activeProjectId;
    persistActiveProjectId(state.activeProjectId);

    const projectRecord = state.projectLibrary.find((project) => project?.id === state.activeProjectId) ?? state.projectLibrary[0] ?? null;
    if (!projectRecord) {
      throw new Error("Unable to activate the loaded project file.");
    }

    const loadedDestination = resolveLoadedProjectFileDestination({
      requestedFilePath: options.filePath,
      recordFilePath: getProjectRecordFilePath(projectRecord),
      fileHandle: options.fileHandle ?? null,
      useRecordFilePath: options.useRecordFilePathAsDestination === true,
    });
    const loadedHandlePermission = loadedDestination.fileHandle
      ? await requestProjectFileHandleWritePermission(loadedDestination.fileHandle)
      : "";
    clearProjectAutosaveState();
    clearEditorWorkingDirtyState("project-load");
    setActiveProjectFileDestination(loadedDestination.filePath, loadedDestination.fileHandle, {
      skipProjectFileAutosave: true,
      skipProjectRecordPersistence: true,
      handlePermission: loadedHandlePermission,
      persistBrowserFileHandle: Boolean(loadedDestination.fileHandle),
      persistDesktopProjectFilePath: loadedDestination.isDurablePath,
      clearDesktopProjectFilePath: !loadedDestination.isDurablePath,
      clearBrowserFileHandle: !loadedDestination.fileHandle && loadedDestination.isDurablePath,
      source: "hydrateProjectLibraryFromLoadedSnapshot",
    });
    activateLoadedProjectRecord({
      projectRecord,
      reason: options.reason ?? "load-project-file",
      mode: options.mode ?? "unknown",
      sourceLabel: options.sourceLabel ?? "file",
      loadedProjectCount: importedProjects.length,
      filePath: options.filePath ?? "",
    });
    primeProjectAutosaveTarget();
    state.projectFileStatus = `Loaded ${importedProjects.length} project${importedProjects.length === 1 ? "" : "s"} from ${options.sourceLabel ?? "file"}`;

    if (state.workspace?.project?.stats) {
      reportBrowserLog("info", "project-file", "Loaded a project library from disk.", {
        filePath: options.filePath ?? null,
        projectId: projectRecord.id,
        title: projectRecord.title,
        chapters: state.workspace.project.stats.chapterCount,
        scenes: state.workspace.project.stats.sceneCount,
        templates: state.workspace.world?.stats?.templateCount ?? 0,
        mode: options.mode ?? "unknown",
      });
    }
  }

  async function loadProjectSnapshotFromBrowserHandle(handle) {
    if (!handle) {
      throw new Error("A browser file handle is required.");
    }

    await preserveActiveProjectBeforeLoad("loadProjectSnapshotFromBrowserHandle");
    state.projectFileBusy = true;
    state.projectFileStatus = "Loading project file...";
    renderHeader();

    try {
      const snapshot = await readProjectLibraryFromBrowserHandle(handle);
      await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
        filePath: "",
        fileName: handle.name ?? "",
        fileHandle: handle,
        sourceLabel: "browser file",
        reason: "load-project-file",
        mode: "browser-handle",
      });
    } catch (error) {
      state.projectFileStatus = `Load failed: ${toErrorMessage(error)}`;
      reportBrowserLog("error", "project-file", "Project file load failed.", {
        filePath: handle.name ?? null,
        error,
        mode: "browser-handle",
      });
      renderHeader();
    } finally {
      state.projectFileBusy = false;
      queueProjectAutosaveIfDirty();
      renderHeader();
    }
  }

  async function loadProjectSnapshotFromBrowserFile(file, options = {}) {
    if (!file) {
      throw new Error("A browser file is required.");
    }

    await preserveActiveProjectBeforeLoad("loadProjectSnapshotFromBrowserFile");
    state.projectFileBusy = true;
    state.projectFileStatus = "Loading project file...";
    renderHeader();

    try {
      const snapshot = await readProjectLibraryFromBrowserFile(file);
      await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
        filePath: typeof options.filePath === "string" && options.filePath.trim()
          ? options.filePath
          : "",
        fileName: typeof options.fileName === "string" && options.fileName.trim()
          ? options.fileName
          : file.name ?? "",
        fileHandle: options.fileHandle ?? null,
        sourceLabel: options.sourceLabel ?? "browser file",
        reason: options.reason ?? "load-project-file",
        mode: options.mode ?? "browser-file",
      });
    } catch (error) {
      state.projectFileStatus = `Load failed: ${toErrorMessage(error)}`;
      reportBrowserLog("error", "project-file", "Project file load failed.", {
        filePath: file.name ?? null,
        error,
        mode: options.mode ?? "browser-file",
      });
      renderHeader();
    } finally {
      state.projectFileBusy = false;
      queueProjectAutosaveIfDirty();
      renderHeader();
    }
  }

  function exportProjectLibrarySnapshot(snapshot, fileName = resolveSuggestedProjectFileName()) {
    return downloadProjectLibrarySnapshot(snapshot, { fileName });
  }

  async function loadProjectSnapshotFromFile() {
    const filePath = normalizeProjectFilePath(state.projectFilePath);
    if (hasProjectFilePath(filePath)) {
      await preserveActiveProjectBeforeLoad("loadProjectSnapshotFromFile");
      state.projectFileBusy = true;
      state.projectFileStatus = "Loading project file...";
      renderHeader();

      try {
        const snapshot = await readProjectLibraryFromDesktopPath(filePath, {
          fetchJsonFromDesktopApi,
        });
        await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
          filePath,
          fileHandle: null,
          sourceLabel: "desktop file",
          reason: "load-project-file",
          mode: "desktop-path",
        });
      } catch (error) {
        state.projectFileStatus = `Load failed: ${toErrorMessage(error)}`;
        reportBrowserLog("error", "project-file", "Project file load failed.", {
          filePath,
          error,
          mode: "desktop-path",
        });
        renderHeader();
      } finally {
        state.projectFileBusy = false;
        renderHeader();
      }
      return;
    }

    if (canUseBrowserOpenPicker(windowRef)) {
      try {
        const handle = await pickProjectFileHandleForOpen({
          windowRef,
          types: getProjectFilePickerTypes(),
        });
        if (!handle) {
          state.projectFileStatus = "Load cancelled.";
          renderHeader();
          return;
        }

        await loadProjectSnapshotFromBrowserHandle(handle);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          state.projectFileStatus = "Load cancelled.";
          renderHeader();
          return;
        }

        state.projectFileStatus = `Load picker unavailable: ${toErrorMessage(error)}`;
        renderHeader();
      }
    }

    try {
      const file = await promptForProjectFileFromInput();
      if (file) {
        await loadProjectSnapshotFromBrowserFile(file, {
          filePath: "",
          fileName: file.name ?? "",
          fileHandle: null,
          sourceLabel: "browser file",
          reason: "load-project-file",
          mode: "browser-input",
        });
        return;
      }

      state.projectFileStatus = "Load cancelled.";
      renderHeader();
      return;
    } catch (error) {
      state.projectFileStatus = `Load picker unavailable: ${toErrorMessage(error)}`;
      renderHeader();
    }
  }

  function beginProjectCacheSuppression() {
    state.projectCacheSuppressionDepth = Number(state.projectCacheSuppressionDepth ?? 0) + 1;
  }

  function endProjectCacheSuppression() {
    if (Number(state.projectCacheSuppressionDepth ?? 0) > 0) {
      state.projectCacheSuppressionDepth -= 1;
    }
  }

  async function saveProjectSnapshot({ reason = "save-project" } = {}) {
    beginProjectCacheSuppression();
    beginProjectAutosaveSuppression();
    projectSaveGateLog.info("user-action", "project.save.begin", "Starting project save.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      hasFileHandle: Boolean(state.projectFileHandle),
      hasFilePath: hasProjectFilePath(state.projectFilePath),
      reason,
    });
    try {
      await prepareProjectSnapshotForSave({ reason });
      const snapshot = buildProjectSnapshotForSaveFile();
      const filePath = normalizeProjectFilePath(state.projectFilePath);
      const shouldUseDesktopPath = hasProjectFilePath(filePath) && state.projectFileHandlePermission !== "granted";
      const shouldUseBrowserHandle = Boolean(state.projectFileHandle && !shouldUseDesktopPath);
      if (shouldUseBrowserHandle) {
        // Intent: autosave cannot request browser write permission, so preserve to cache and wait for Ctrl+S.
        if (reason === "autosave" && state.projectFileHandlePermission !== "granted") {
          const fallbackPersisted = persistProjectSnapshotToBrowserCache(snapshot, {
            target: "browser-handle-permission-fallback",
            reason,
            filePath: state.projectFilePath ?? state.projectFileHandle?.name ?? "",
          });
          if (fallbackPersisted) {
            state.projectFileStatus = "Autosave paused: press Ctrl+S to re-authorize the project file. Latest project preserved in browser cache.";
            blockProjectAutosave({
              reason: "write-permission-required",
            });
            renderHeader();
            reportProjectLibrarySaveResult(
              "browser-handle-permission-fallback",
              "Preserved current project in browser cache while waiting for project file permission.",
            );
          } else {
            state.projectFileStatus = "Autosave paused: browser cache is full. Press Ctrl+S to re-authorize the project file before refreshing.";
            renderHeader();
          }
          desktopFileSystemLog.warn("persistence", "project.save.browser-handle-permission-required", "Autosave paused until browser project file write permission is restored.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath: state.projectFilePath ?? state.projectFileHandle?.name ?? "",
            fallbackPersisted,
          });
          if (!fallbackPersisted) {
            throw new Error("Autosave could not preserve the current project in browser cache.");
          }
          return {
            projectFilePersisted: false,
            fallbackPersisted: true,
          };
        }

        let browserHandleSaved = false;
        let browserHandleFallbackPersisted = false;
        let browserHandleFailure = null;
        try {
          await saveProjectSnapshotToBrowserHandle(state.projectFileHandle, snapshot, {
            requestPermission: reason !== "autosave",
          });
          browserHandleSaved = true;
          desktopFileSystemLog.info("persistence", "project.save.browser-handle", "Saved project library to browser file handle.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
          });
        } catch (error) {
          browserHandleFailure = error;
          browserHandleFallbackPersisted = persistProjectSnapshotFallbackAfterFileSaveFailure(snapshot, {
            target: "browser-handle-fallback",
            reason,
            filePath: state.projectFilePath ?? state.projectFileHandle?.name ?? "",
            error,
          });
          desktopFileSystemLog.warn("persistence", "project.save.browser-handle-failed", "Saving project library to browser file handle failed.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            fallbackPersisted: browserHandleFallbackPersisted,
            error,
          });
          if (browserHandleFallbackPersisted) {
            blockProjectAutosave({
              reason: isBrowserHandlePermissionError(error)
                ? "write-permission-required"
                : "write-failed",
            });
          }
        }
        renderHeader();
        if (browserHandleSaved || browserHandleFallbackPersisted) {
          reportProjectLibrarySaveResult(
            browserHandleSaved ? "browser-handle" : "browser-handle-fallback",
            browserHandleSaved ? undefined : "Preserved current project in browser cache after file save failure.",
          );
        }
        if (!browserHandleSaved && !browserHandleFallbackPersisted && reason === "autosave") {
          throw browserHandleFailure ?? new Error("Autosave failed and browser cache fallback was unavailable.");
        }
        return {
          projectFilePersisted: browserHandleSaved,
          fallbackPersisted: browserHandleFallbackPersisted,
        };
      }

      let projectSnapshotPersisted = false;
      let projectSnapshotReportTarget = filePath ? "desktop-path" : "browser-library";
      let projectSnapshotReportMessage;
      if (filePath) {
        try {
          await saveProjectSnapshotToFilePath(filePath, snapshot);
          projectSnapshotPersisted = true;
          desktopFileSystemLog.info("persistence", "project.save.file-path", "Saved project library to file path.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath,
          });
        } catch (error) {
          const fallbackPersisted = persistProjectSnapshotFallbackAfterFileSaveFailure(snapshot, {
            target: "desktop-path-fallback",
            reason,
            filePath,
            error,
          });
          projectSnapshotPersisted = fallbackPersisted;
          projectSnapshotReportTarget = "desktop-path-fallback";
          projectSnapshotReportMessage = "Preserved current project in browser cache after file save failure.";
          if (fallbackPersisted) {
            blockProjectAutosave({
              reason: "write-failed",
            });
          }
          desktopFileSystemLog.warn("persistence", "project.save.file-path-failed", "Saving project library to file path failed.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath,
            fallbackPersisted,
            error,
          });
          if (!fallbackPersisted && reason === "autosave") {
            throw error;
          }
        }
      } else {
        const persistedToBrowserCache = persistProjectSnapshotToBrowserCache(snapshot, {
          target: "browser-library",
          reason,
        });
        if (persistedToBrowserCache) {
          projectSnapshotPersisted = true;
          state.projectFileStatus = "Saved to the browser project library. Use Save as file to create a manuscript file.";
          clearProjectAutosaveState();
          clearEditorWorkingDirtyState("project-save-succeeded");
        } else {
          state.projectFileStatus = "Save failed: unable to persist the browser project library.";
          if (reason === "autosave") {
            throw new Error("Autosave could not persist the browser project library.");
          }
        }
        renderHeader();
      }
      renderHeader();
      if (projectSnapshotPersisted) {
        reportProjectLibrarySaveResult(projectSnapshotReportTarget, projectSnapshotReportMessage);
      }
      return {
        projectFilePersisted: filePath ? projectSnapshotReportTarget === "desktop-path" : projectSnapshotPersisted,
        fallbackPersisted: projectSnapshotReportTarget === "desktop-path-fallback" && projectSnapshotPersisted,
      };
    } finally {
      projectSaveGateLog.info("lifecycle", "project.save.end", "Project save flow completed.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      });
      endProjectAutosaveSuppression();
      endProjectCacheSuppression();
    }
  }

  async function saveProjectSnapshotAs() {
    beginProjectCacheSuppression();
    beginProjectAutosaveSuppression();
    projectSaveGateLog.info("user-action", "project.save-as.begin", "Starting Save As flow.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      typedPath: state.projectFilePath ?? "",
    });
    try {
      const typedPath = normalizeProjectFilePath(state.projectFilePath);
      if (hasProjectFilePath(typedPath)) {
        await prepareProjectSnapshotForSave({ reason: "save-project-as" });
        setActiveProjectFileDestination(typedPath, null, {
          skipProjectFileAutosave: true,
          persistDesktopProjectFilePath: true,
          clearBrowserFileHandle: true,
          source: "saveProjectSnapshotAs",
        });
        const snapshot = buildProjectSnapshotForSaveFile();
        try {
          await saveProjectSnapshotToFilePath(typedPath, snapshot);
          projectSaveGateLog.info("persistence", "project.save-as.file-path", "Saved project snapshot using typed file path.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath: typedPath,
          });
        } catch (error) {
          const fallbackPersisted = persistProjectSnapshotFallbackAfterFileSaveFailure(snapshot, {
            target: "save-as-desktop-path-fallback",
            reason: "save-project-as",
            filePath: typedPath,
            error,
          });
          projectSaveGateLog.warn("persistence", "project.save-as.file-path-failed", "Save As failed for typed file path.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath: typedPath,
            fallbackPersisted,
            error,
          });
          if (!fallbackPersisted) {
            throw error;
          }
          blockProjectAutosave({
            reason: "write-failed",
          });
        }
        return;
      }

      if (canUseBrowserSavePicker(windowRef)) {
        try {
          const handle = await pickProjectFileHandleForSave({
            suggestedName: resolveSuggestedProjectFileName(),
            types: getProjectFilePickerTypes(),
            windowRef,
          });
          const handlePermission = await requestProjectFileHandleWritePermission(handle);
          await prepareProjectSnapshotForSave({ reason: "save-project-as" });
          const browserHandleProjectFilePath = handle.name || resolveSuggestedProjectFileName();
          setActiveProjectFileDestination(browserHandleProjectFilePath, handle, {
            skipProjectFileAutosave: true,
            handlePermission,
            persistBrowserFileHandle: handlePermission === "granted",
            persistDesktopProjectFilePath: hasProjectFilePath(browserHandleProjectFilePath),
            clearDesktopProjectFilePath: !hasProjectFilePath(browserHandleProjectFilePath),
            source: "saveProjectSnapshotAs",
          });
          const snapshot = buildProjectSnapshotForSaveFile();
          await saveProjectSnapshotToBrowserHandle(handle, snapshot, {
            requestPermission: handlePermission !== "granted",
          });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            state.projectFileStatus = "Save As cancelled.";
            projectSaveGateLog.info("user-action", "project.save-as.cancelled", "Save As picker was cancelled.", {
              projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            });
            renderHeader();
            return;
          }

          state.projectFileStatus = `Save picker unavailable: ${toErrorMessage(error)}`;
          projectSaveGateLog.warn("file-access", "project.save-as.picker-failed", "Save As picker unavailable.", {
            error,
          });
          renderHeader();
        }
      }

      await prepareProjectSnapshotForSave({ reason: "save-project-as" });
      const snapshot = buildProjectSnapshotForSaveFile();
      persistProjectSnapshotToBrowserCache(snapshot, {
        target: "download",
        reason: "save-project-as",
        filePath: typedPath || resolveSuggestedProjectFileName(),
      });
      const downloadedName = exportProjectLibrarySnapshot(snapshot, typedPath || resolveSuggestedProjectFileName());
      state.projectFileStatus = `Downloaded ${downloadedName}. Use Load file to reopen it later.`;
      projectSaveGateLog.info("persistence", "project.save-as.download", "Downloaded project snapshot as fallback file.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        downloadedName,
      });
      renderHeader();
    } finally {
      projectSaveGateLog.info("lifecycle", "project.save-as.end", "Save As flow completed.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      });
      endProjectAutosaveSuppression();
      endProjectCacheSuppression();
    }
  }

  // Intent: recover browser-picked files from IndexedDB when no durable desktop path exists.
  async function restoreProjectFileHandleDestinationFromCache(source = "restoreLastOpenedProject") {
    const projectRecord = getActiveProjectRecord();
    const projectId = projectRecord?.id ?? state.activeProjectId ?? state.workspace?.project?.id ?? "";
    let cachedHandleRecord = null;
    try {
      cachedHandleRecord = await loadProjectFileHandleReference({
        windowRef,
        projectId,
      });
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.file-handle.restore-failed", "Unable to restore browser project file handle reference.", {
        projectId,
        source,
        error,
      });
      return false;
    }

    if (!cachedHandleRecord?.fileHandle) {
      return false;
    }

    const cachedIdentity = getProjectFileIdentity(cachedHandleRecord.filePath || cachedHandleRecord.fileName);
    if (
      cachedHandleRecord.projectId &&
      projectId &&
      cachedHandleRecord.projectId !== projectId &&
      cachedIdentity !== projectId
    ) {
      return false;
    }

    const handlePermission = await queryProjectFileHandleWritePermission(cachedHandleRecord.fileHandle);
    const displayPath =
      cachedHandleRecord.filePath ||
      cachedHandleRecord.fileName ||
      cachedHandleRecord.fileHandle.name ||
      projectRecord?.projectSettings?.projectFilePath ||
      "";
    if (handlePermission === "granted") {
      try {
        const snapshot = await readProjectLibraryFromBrowserHandle(cachedHandleRecord.fileHandle);
        await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
          filePath: "",
          fileName: displayPath,
          fileHandle: cachedHandleRecord.fileHandle,
          sourceLabel: "remembered browser project file",
          reason: "boot-reconnect",
          mode: "browser-handle",
        });
        state.projectFileStatus = `Writing to browser project file: ${displayPath}`;
        desktopFileSystemLog.info("persistence", "project.file-handle.loaded", "Loaded remembered browser project file from its JSON handle.", {
          projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
          filePath: displayPath,
          source,
        });
        return true;
      } catch (error) {
        desktopFileSystemLog.warn("persistence", "project.file-handle-load-failed", "Unable to load remembered browser project file; write permission must be re-authorized manually.", {
          projectId,
          filePath: displayPath,
          source,
          error,
        });
      }
    }

    setActiveProjectFileDestination(displayPath, cachedHandleRecord.fileHandle, {
      skipProjectFileAutosave: true,
      skipProjectRecordPersistence: true,
      handlePermission,
      persistBrowserFileHandle: false,
      clearDesktopProjectFilePath: true,
      source,
    });
    state.projectFileStatus = handlePermission === "granted"
      ? `Writing to browser project file: ${displayPath}`
      : `Project file remembered: ${displayPath}. Press Ctrl+S to re-authorize writing.`;
    primeProjectAutosaveTarget();
    desktopFileSystemLog.info("persistence", "project.file-handle.restored", "Restored browser project file handle reference.", {
      projectId,
      filePath: displayPath,
      permission: handlePermission,
      source,
    });
    return true;
  }

  async function restoreLastOpenedProject(desktopSettings = null) {
    const candidatePath = [
      state.projectFilePath,
      desktopSettings?.lastProjectFilePathExplicit === true ? desktopSettings?.lastProjectFilePath : "",
    ]
      .map((pathValue) => resolveProjectFilePath(pathValue))
      .find((pathValue) => hasProjectFilePath(pathValue));

    if (!candidatePath) {
      await restoreProjectFileHandleDestinationFromCache("restoreLastOpenedProject");
      return;
    }

    if (candidatePath !== state.projectFilePath) {
      setActiveProjectFileDestination(candidatePath, null, {
        skipProjectFileAutosave: true,
        persistDesktopProjectFilePath: true,
      });
    }

    try {
      const snapshot = await readProjectLibraryFromDesktopPath(candidatePath, {
        fetchJsonFromDesktopApi,
      });
      await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
        filePath: candidatePath,
        fileHandle: null,
        sourceLabel: "project file",
        reason: "boot-reconnect",
        mode: "desktop-path",
      });
      state.projectFileStatus = `Writing to JSON file: ${candidatePath}`;
      await persistDesktopProjectFilePath(candidatePath);
    } catch (error) {
      state.projectFileStatus = `Project file check failed: ${toErrorMessage(error)}`;
      reportBrowserLog("warn", "project-file", "Unable to reconnect the project file on boot.", {
        filePath: candidatePath,
        error,
        mode: "desktop-path",
      });
      await restoreProjectFileHandleDestinationFromCache("restoreLastOpenedProjectFallback");
    }
  }

  // Intent: recover the active project's file destination label from the canonical record before shell code renders it.
  function syncActiveProjectFileDestinationFromRecord(options = {}) {
    const projectRecord = getActiveProjectRecord();
    if (!projectRecord) {
      return "";
    }

    const rawRecordPath = resolveProjectFilePath(
      projectRecord?.projectSettings?.projectFilePath ?? projectRecord?.projectFilePath ?? "",
    );
    const recordFilePath = getProjectRecordFilePath(projectRecord);
    const resolvedPath = hasProjectFilePath(recordFilePath)
      ? resolveProjectFilePath(recordFilePath)
      : rawRecordPath;
    if (!resolvedPath) {
      return "";
    }

    const isDurablePath = hasProjectFilePath(resolvedPath);
    const retainedHandle = isDurablePath ? null : state.projectFileHandle;
    const retainedHandlePermission = retainedHandle ? state.projectFileHandlePermission : "";
    if (resolvedPath === state.projectFilePath && state.projectFileHandle === retainedHandle) {
      return resolvedPath;
    }

    setActiveProjectFileDestination(resolvedPath, retainedHandle, {
      skipProjectFileAutosave: true,
      skipProjectRecordPersistence: true,
      handlePermission: retainedHandlePermission,
      persistBrowserFileHandle: false,
      persistDesktopProjectFilePath: isDurablePath && options.persistDesktopProjectFilePath === true,
      clearBrowserFileHandle: isDurablePath,
      source: options.source ?? "syncActiveProjectFileDestinationFromRecord",
      dirtyReason: options.dirtyReason ?? "project-file-destination-sync",
      markWorkingState: options.markWorkingState !== false,
    });

    return resolvedPath;
  }

  const autosaveController = createProjectFileAutosaveController({
    state,
    delayMs: autosaveDelayMs,
    logger: autosaveCoordinatorLog,
    windowRef,
    getTarget: () => ({
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
      filePath: normalizeProjectFilePath(state.projectFilePath),
      fileHandle: state.projectFileHandle ?? null,
    }),
    hasDestination: () => hasProjectSaveDestination(),
    isBusy: () => state.projectFileBusy,
    isEnabled: () => state.editorPrefs.projectFileAutosaveEnabled === true,
    save: () => saveProjectSnapshot({ reason: "autosave" }),
    setStatus: (status) => {
      state.projectFileStatus = status;
    },
    renderStatus: () => renderHeader(),
  });

  function clearProjectAutosaveTimer() {
    autosaveController.clearTimer();
  }

  function beginProjectAutosaveSuppression() {
    autosaveController.beginSuppression();
  }

  function endProjectAutosaveSuppression() {
    autosaveController.endSuppression();
  }

  function queueProjectAutosave() {
    autosaveController.queue();
  }

  function markProjectAutosaveDirty(context = {}) {
    autosaveController.markDirty(context);
  }

  function blockProjectAutosave(context = {}) {
    autosaveController.block(context);
  }

  function primeProjectAutosaveTarget() {
    autosaveController.prime();
  }

  function clearProjectAutosaveState() {
    autosaveController.clearState();
  }

  async function flushProjectAutosave() {
    await autosaveController.flush();
  }

  return {
    beginProjectAutosaveSuppression,
    buildProjectSnapshotForSaveFile,
    clearProjectAutosaveState,
    clearProjectAutosaveTimer,
    clearEditorWorkingDirtyState,
    commitCanonicalProjectMutation,
    endProjectAutosaveSuppression,
    exportProjectLibrarySnapshot,
    flushProjectAutosave,
    getProjectFileDisplayState,
    hasProjectSaveDestination,
    hydrateProjectLibraryFromLoadedSnapshot,
    loadProjectSnapshotFromBrowserFile,
    loadProjectSnapshotFromBrowserHandle,
    loadProjectSnapshotFromFile,
    markProjectAutosaveDirty,
    markEditorWorkingMutation,
    persistActiveProjectRecord,
    persistActiveProjectId,
    persistDesktopProjectFilePath,
    primeProjectAutosaveTarget,
    queueProjectAutosave,
    restoreLastOpenedProject,
    saveProjectSnapshot,
    saveProjectSnapshotAs,
    saveProjectSnapshotToBrowserHandle,
    saveProjectSnapshotToFilePath,
    syncActiveProjectFileDestinationFromRecord,
    setActiveProjectFileDestination,
  };
}
