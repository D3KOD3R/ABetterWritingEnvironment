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
  browseProjectPackageDirectories,
  commitStagedProjectPackage as commitStagedProjectPackageOnDesktop,
  discardStagedProjectPackage as discardStagedProjectPackageOnDesktop,
  loadProjectPackage as loadProjectPackageFromDesktop,
  stageNewProjectPackage as stageNewProjectPackageOnDesktop,
  stageSaveAsProjectPackage as stageSaveAsProjectPackageOnDesktop,
} from "./project-package.js";
import { assertProjectSnapshotsSemanticallyEquivalent } from "./project-snapshot-verification.js";
import {
  buildProjectFilePathFromRoot,
  canUseBrowserOpenPicker,
  canUseBrowserSavePicker,
  downloadProjectLibrarySnapshot,
  getProjectFilePickerTypes,
  getProjectFileIdentity,
  getProjectRecordFilePath,
  getProjectFileWriteProgress,
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
import {
  buildScrivenerProjectSnapshotFromFiles,
  canUseBrowserDirectoryPicker,
  pickScrivenerProjectPackageFromDirectory,
  promptForScrivenerProjectPackageFromInput,
} from "./scrivener-import-service.js";

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// Intent: detect cancelled browser picker flows without depending on a specific DOMException constructor.
function isAbortError(error) {
  return typeof error?.name === "string" && error.name === "AbortError";
}

// Intent: classify recoverable browser-handle permission failures so autosave can pause without error loops.
function isBrowserHandlePermissionError(error) {
  const errorName = typeof error?.name === "string" ? error.name : "";
  const message = toErrorMessage(error).toLowerCase();
  return message.includes("write permission")
    || message.includes("re-authorize")
    || (message.includes("permission") && message.includes("denied"))
    || errorName === "NotAllowedError"
    || errorName === "SecurityError";
}

function isBrowserHandleBackgroundWritePolicyError(error) {
  const errorName = typeof error?.name === "string" ? error.name : "";
  const message = toErrorMessage(error).toLowerCase();
  return errorName === "AbortError" && message.includes("security policy");
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

// Intent: external folder packages must not retain the machine-specific active package authority.
export function buildPortableExternalProjectSnapshot(snapshot = {}) {
  const portableSnapshot = cloneValue(snapshot);
  portableSnapshot.projects = (Array.isArray(portableSnapshot.projects) ? portableSnapshot.projects : [])
    .map((project) => {
      const portableProject = cloneValue(project);
      delete portableProject.projectFilePath;
      if (portableProject.projectSettings && typeof portableProject.projectSettings === "object" && !Array.isArray(portableProject.projectSettings)) {
        delete portableProject.projectSettings.projectFilePath;
      }
      return portableProject;
    });
  return portableSnapshot;
}

const WORKSPACE_PANE_IDS = Object.freeze(["manuscript", "world", "narration"]);

function normalizeWorkspacePaneSetting(value) {
  const normalizedValue = String(value ?? "").trim();
  if (normalizedValue === "voice") {
    return "narration";
  }

  return WORKSPACE_PANE_IDS.includes(normalizedValue) ? normalizedValue : "";
}

function hasExplicitProjectSetting(projectRecord, settingKey) {
  const settings = projectRecord?.projectSettings && typeof projectRecord.projectSettings === "object" && !Array.isArray(projectRecord.projectSettings)
    ? projectRecord.projectSettings
    : {};
  return Object.prototype.hasOwnProperty.call(settings, settingKey);
}

function getProjectActivePaneSetting(projectRecord) {
  return normalizeWorkspacePaneSetting(projectRecord?.projectSettings?.activePane);
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

  if (
    normalizedDomain === "metadata-folders" ||
    normalizedDomain === "metadatafolders" ||
    normalizedDomain === "metadata-subgroups" ||
    normalizedDomain === "metadatasubgroups"
  ) {
    return {
      id: projectRecord.id ?? "",
      metadataSubgroups: projectRecord.metadataSubgroups ?? [],
    };
  }

  if (normalizedDomain === "draft-proofing" || normalizedDomain === "draftproofing") {
    return {
      id: projectRecord.id ?? "",
      draftProofing: projectRecord.draftProofing ?? null,
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
      activePane: settings.activePane ?? null,
      editorPrefs: settings.editorPrefs ?? null,
      localAiPrefs: settings.localAiPrefs ?? null,
      binderPanelWidth: settings.binderPanelWidth ?? null,
      consoleDockWidth: settings.consoleDockWidth ?? null,
      userSettingPanelResizerLeftPercent: settings.userSettingPanelResizerLeftPercent ?? null,
      userSettingPanelResizerRightPercent: settings.userSettingPanelResizerRightPercent ?? null,
      panelResizerLayoutProfiles: settings.panelResizerLayoutProfiles ?? null,
      worldSpineEventRailWidth: settings.worldSpineEventRailWidth ?? null,
      worldSpineManuscriptPaneWidth: settings.worldSpineManuscriptPaneWidth ?? null,
      worldSpinePanelLayoutProfiles: settings.worldSpinePanelLayoutProfiles ?? null,
      worldSpineRightPaneMode: settings.worldSpineRightPaneMode ?? null,
      worldSpineUnplacedDockCollapsed: settings.worldSpineUnplacedDockCollapsed ?? null,
      worldSpineLocationFilter: settings.worldSpineLocationFilter ?? null,
      consoleDockCollapsed: settings.consoleDockCollapsed ?? null,
      sidePanelsHidden: settings.sidePanelsHidden ?? null,
      sidePanelVisibility: settings.sidePanelVisibility ?? null,
      topPanelVisibility: settings.topPanelVisibility ?? null,
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

function normalizeProjectLibrarySceneStore(sceneStore) {
  if (!sceneStore || typeof sceneStore !== "object" || Array.isArray(sceneStore)) {
    return {};
  }

  const normalized = {};
  for (const [projectId, projectSceneStore] of Object.entries(sceneStore)) {
    if (typeof projectId !== "string" || !projectId.trim()) {
      continue;
    }
    if (!projectSceneStore || typeof projectSceneStore !== "object" || Array.isArray(projectSceneStore)) {
      continue;
    }

    normalized[projectId] = cloneValue(projectSceneStore);
  }

  return normalized;
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

// Intent: keep legacy full-line project files saveable even when browser scene chunks cannot be written.
function collectProjectSceneStoreFromRecord(projectRecord) {
  const sceneStore = {};
  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  for (const [sceneId, sceneDraft] of Object.entries(sceneDrafts)) {
    if (typeof sceneId === "string" && sceneId.trim() && sceneDraft && typeof sceneDraft === "object" && !Array.isArray(sceneDraft)) {
      sceneStore[sceneId] = cloneValue(sceneDraft);
    }
  }

  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  const linesBySceneId = new Map();
  for (const line of lines) {
    const sceneId = typeof line?.sceneId === "string" && line.sceneId.trim() ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    if (!linesBySceneId.has(sceneId)) {
      linesBySceneId.set(sceneId, {
        sceneId,
        chapterId: typeof line.chapterId === "string" ? line.chapterId : "",
        chapterTitle: typeof line.chapterTitle === "string" ? line.chapterTitle : "",
        sceneTitle: typeof line.sceneTitle === "string" ? line.sceneTitle : "",
        sceneSynopsis: typeof line.sceneSynopsis === "string" ? line.sceneSynopsis : "",
        lines: [],
      });
    }
    linesBySceneId.get(sceneId).lines.push(line);
  }

  for (const [sceneId, group] of linesBySceneId.entries()) {
    const editorText = group.lines.map((line) => String(line?.text ?? "")).join("\n\n");
    if (!editorText.trim() || sceneDraftHasSubstantiveBody(sceneStore[sceneId])) {
      continue;
    }

    const existingSceneRecord = sceneStore[sceneId] && typeof sceneStore[sceneId] === "object" && !Array.isArray(sceneStore[sceneId])
      ? cloneValue(sceneStore[sceneId])
      : {};
    sceneStore[sceneId] = {
      ...existingSceneRecord,
      sceneId,
      chapterId: group.chapterId,
      chapterTitle: group.chapterTitle,
      sceneTitle: group.sceneTitle,
      sceneSynopsis: group.sceneSynopsis,
      editorText,
      blocks: group.lines.map((line, index) => ({
        blockId: typeof line?.blockId === "string" && line.blockId.trim() ? line.blockId : `${sceneId}-block-${index + 1}`,
        lineNumber: Number.isInteger(line?.lineNumber) ? line.lineNumber : index + 1,
        kind: typeof line?.kind === "string" && line.kind.trim() ? line.kind : "narration",
        speakerLabel: typeof line?.speakerLabel === "string" ? line.speakerLabel : "",
        text: String(line?.text ?? ""),
        issueIds: Array.isArray(line?.issueIds) ? cloneValue(line.issueIds) : [],
        eventTagIds: Array.isArray(line?.eventTagIds) ? cloneValue(line.eventTagIds) : [],
        isDraft: line?.isDraft === true,
      })),
    };
  }

  return sceneStore;
}

function countManuscriptWords(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

function getSceneDraftBodyText(sceneDraft) {
  if (!sceneDraft || typeof sceneDraft !== "object" || Array.isArray(sceneDraft)) {
    return "";
  }

  if (typeof sceneDraft.editorText === "string") {
    return sceneDraft.editorText;
  }

  return Array.isArray(sceneDraft.blocks)
    ? sceneDraft.blocks.map((block) => String(block?.text ?? "")).join("\n\n")
    : "";
}

function buildSceneLineCountsById(projectRecord) {
  const lineCounts = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  for (const line of lines) {
    const sceneId = typeof line?.sceneId === "string" && line.sceneId.trim() ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    lineCounts.set(sceneId, (lineCounts.get(sceneId) ?? 0) + 1);
  }

  return lineCounts;
}

// Intent: reject split-storage manuscript payloads whose scene-body store has collapsed while scene anchors remain.
function assertProjectSceneBodyCoverage(projectRecord, projectSceneStore, {
  operation = "save",
} = {}) {
  const indexedScenes = Array.isArray(projectRecord?.projectIndex?.scenes)
    ? projectRecord.projectIndex.scenes
    : [];
  const workspaceLineCounts = buildSceneLineCountsById(projectRecord);
  const sceneIds = new Set([
    ...indexedScenes.map((scene) => (typeof scene?.id === "string" ? scene.id.trim() : "")).filter(Boolean),
    ...workspaceLineCounts.keys(),
  ]);

  if (sceneIds.size < 5) {
    return;
  }

  const sceneStore = projectSceneStore && typeof projectSceneStore === "object" && !Array.isArray(projectSceneStore)
    ? projectSceneStore
    : {};
  const indexedSceneById = new Map(indexedScenes
    .map((scene) => [typeof scene?.id === "string" ? scene.id.trim() : "", scene])
    .filter(([sceneId]) => Boolean(sceneId)));
  const lineBackedScenes = [];
  const emptyLineBackedScenes = [];
  for (const sceneId of sceneIds) {
    const indexedScene = indexedSceneById.get(sceneId) ?? {};
    const lineCount = Math.max(
      0,
      Number.isFinite(Number(indexedScene.lineCount)) ? Math.round(Number(indexedScene.lineCount)) : 0,
      workspaceLineCounts.get(sceneId) ?? 0,
    );
    if (lineCount <= 0) {
      continue;
    }

    const bodyWordCount = countManuscriptWords(getSceneDraftBodyText(sceneStore[sceneId]));
    lineBackedScenes.push({
      sceneId,
      title: typeof indexedScene.title === "string" ? indexedScene.title : "",
      lineCount,
      bodyWordCount,
    });
    if (bodyWordCount === 0) {
      emptyLineBackedScenes.push(sceneId);
    }
  }

  const minimumCollapsedSceneCount = Math.max(3, Math.ceil(lineBackedScenes.length * 0.25));
  if (lineBackedScenes.length < 5 || emptyLineBackedScenes.length < minimumCollapsedSceneCount) {
    return;
  }

  const projectTitle = typeof projectRecord?.title === "string" && projectRecord.title.trim()
    ? projectRecord.title.trim()
    : typeof projectRecord?.id === "string" && projectRecord.id.trim()
      ? projectRecord.id.trim()
      : "Untitled Project";
  throw new Error(
    `Project manuscript body store looks collapsed for "${projectTitle}": ${emptyLineBackedScenes.length} of ${lineBackedScenes.length} line-backed scenes have no scene body text. Refusing to ${operation} so the manuscript is not overwritten with empty scene bodies.`,
  );
}

function assertProjectLibrarySceneBodyCoverage(librarySnapshot, options = {}) {
  const sceneStore = librarySnapshot?.sceneStore && typeof librarySnapshot.sceneStore === "object" && !Array.isArray(librarySnapshot.sceneStore)
    ? librarySnapshot.sceneStore
    : {};
  for (const projectRecord of Array.isArray(librarySnapshot?.projects) ? librarySnapshot.projects : []) {
    if (!projectRecord?.id) {
      continue;
    }

    assertProjectSceneBodyCoverage(projectRecord, sceneStore[projectRecord.id], options);
  }
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
      continue;
    }

    // Intent: keep metadata-only scene DTO patches while retaining the manuscript body from the fallback store.
    mergedStore[sceneId] = {
      ...cloneValue(fallbackDraft),
      ...cloneValue(sceneDraft),
      editorText: typeof fallbackDraft?.editorText === "string" ? fallbackDraft.editorText : "",
      blocks: Array.isArray(fallbackDraft?.blocks) ? cloneValue(fallbackDraft.blocks) : [],
    };
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
  if (
    classifier.includes("metadata-folder") ||
    classifier.includes("metadata folder") ||
    classifier.includes("metadata-subgroup") ||
    classifier.includes("metadata subgroup")
  ) {
    return "metadata-folders";
  }
  if (classifier.includes("draft-proof") || classifier.includes("draft proof") || classifier.includes("proof-read") || classifier.includes("proofread")) {
    return "draft-proofing";
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

  // Intent: retain file-loaded scene bodies in memory so save files do not depend on browser chunk availability.
  function rememberLoadedProjectSceneStore(sceneStore) {
    state.loadedProjectSceneStore = normalizeProjectLibrarySceneStore(sceneStore);
    return state.loadedProjectSceneStore;
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
    const flushProjectFileAutosave = options.flushProjectFileAutosave === true;
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
    // Intent: scene DTO repairs can be scene-store-only, so trusted scene mutation IDs must still dirty autosave.
    const hasExplicitSceneMutation = changedSceneIds.length > 0;
    const hasCanonicalMutation = hasCanonicalDomainMutation(previousProjectRecord, projectRecord, {
      domain,
      changedSceneIds,
    });
    if (!hasCanonicalMutation && !hasExplicitSceneMutation) {
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

    if (!skipProjectFileAutosave && flushProjectFileAutosave) {
      autosaveCoordinatorLog.info("autosave", "project.persist.flush-requested", "Project persistence requested an immediate autosave flush.", {
        projectId: projectRecord.id,
        domain,
        dirtyReason,
        source,
      });
      void flushProjectAutosave();
    }

    return projectRecord;
  }

  // Intent: compatibility alias while callers migrate to commitCanonicalProjectMutation naming.
  function persistActiveProjectRecord(options = {}) {
    return commitCanonicalProjectMutation(options);
  }

  function setActiveProjectFileDestination(pathValue, handle = null, options = {}) {
    const sideEffects = [];
    state.projectFilePath = resolveProjectFilePath(pathValue);
    state.projectFileHandle = handle;
    state.projectFileHandlePermission = handle
      ? (options.handlePermission ?? state.projectFileHandlePermission ?? "prompt")
      : "";
    if (typeof options.storageMode === "string") {
      state.projectFileStorageMode = options.storageMode;
    }
    if (shouldPersistProjectCache() === true) {
      writeProjectFilePathCache(state.projectFilePath);
    }

    if (handle && options.persistBrowserFileHandle !== false) {
      sideEffects.push(
        persistBrowserProjectFileHandle(
          handle,
          state.projectFilePath || handle.name || "",
          options.source ?? "setActiveProjectFileDestination",
        ),
      );
    } else if (!handle && options.clearBrowserFileHandle === true) {
      sideEffects.push(clearBrowserProjectFileHandle(options.source ?? "setActiveProjectFileDestination"));
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
      sideEffects.push(persistDesktopProjectFilePath(state.projectFilePath, hasProjectFilePath(state.projectFilePath)));
    } else if (options.clearDesktopProjectFilePath === true) {
      sideEffects.push(persistDesktopProjectFilePath("", false));
    }

    return Promise.all(sideEffects);
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
    const retainedProjectSceneStore = activeProjectRecord?.id
      ? getProjectSceneStore(state.loadedProjectSceneStore, activeProjectRecord.id)
      : null;
    const fallbackProjectSceneStore = activeProjectRecord?.id
      ? collectProjectSceneStoreFromRecord(activeProjectRecord)
      : null;
    const projectSceneStore = mergeProjectSceneStores(retainedProjectSceneStore, fallbackProjectSceneStore);
    const retainedSceneStore = activeProjectRecord?.id && projectSceneStore && Object.keys(projectSceneStore).length
      ? { [activeProjectRecord.id]: projectSceneStore }
      : {};
    const snapshot = projectService.exportProjectLibrarySnapshot({
      librarySnapshot: {
        schemaVersion: projectSchemaVersion,
        activeProjectId: activeProjectRecord?.id ?? activeProjectId,
        projects,
        sceneStore: retainedSceneStore,
      },
    }) ?? {
      activeProjectId: activeProjectRecord?.id ?? activeProjectId,
      projects,
    };
    assertProjectLibrarySceneBodyCoverage(snapshot, {
      operation: "save",
    });
    if (snapshot?.sceneStore) {
      rememberLoadedProjectSceneStore(snapshot.sceneStore);
    }
    return snapshot;
  }

  function isCollapsedSceneBodyStoreError(error) {
    return /manuscript body store looks collapsed/i.test(toErrorMessage(error));
  }

  function getRecoverableProjectSceneStoreFromSnapshot(snapshot = {}) {
    const activeProjectId = state.activeProjectId ?? state.projectLibrarySelectionId ?? state.workspace?.project?.id ?? "";
    const projects = Array.isArray(snapshot?.projects) ? snapshot.projects.filter(Boolean) : [];
    const snapshotActiveProjectId = typeof snapshot?.activeProjectId === "string" && snapshot.activeProjectId.trim()
      ? snapshot.activeProjectId.trim()
      : "";
    const fileProjectRecord = projects.find((project) => project?.id === activeProjectId)
      ?? projects.find((project) => project?.id === snapshotActiveProjectId)
      ?? projects[0]
      ?? null;
    const fileProjectId = typeof fileProjectRecord?.id === "string" && fileProjectRecord.id.trim()
      ? fileProjectRecord.id.trim()
      : snapshotActiveProjectId;
    const fileSceneStore = getProjectSceneStore(snapshot?.sceneStore, fileProjectId)
      ?? getProjectSceneStore(snapshot?.sceneStore, activeProjectId)
      ?? getSingleProjectSceneStore(snapshot?.sceneStore)
      ?? null;
    const recordSceneStore = collectProjectSceneStoreFromRecord(fileProjectRecord);
    return mergeProjectSceneStores(recordSceneStore, fileSceneStore);
  }

  async function recoverCollapsedSceneBodiesFromCurrentProjectFile({
    reason = "save-project",
    originalError = null,
  } = {}) {
    const activeProjectId = state.activeProjectId ?? state.projectLibrarySelectionId ?? state.workspace?.project?.id ?? "";
    if (!activeProjectId) {
      return false;
    }

    let snapshot = null;
    let source = "";
    let filePath = "";
    try {
      if (state.projectFileHandle) {
        snapshot = await readProjectLibraryFromBrowserHandle(state.projectFileHandle);
        source = "browser-handle";
        filePath = state.projectFilePath ?? state.projectFileHandle?.name ?? "";
      } else {
        const resolvedPath = normalizeProjectFilePath(state.projectFilePath);
        if (!hasProjectFilePath(resolvedPath)) {
          return false;
        }
        snapshot = await readProjectLibraryFromDesktopPath(resolvedPath, {
          fetchJsonFromDesktopApi,
        });
        source = "desktop-path";
        filePath = resolvedPath;
      }
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.save.scene-body-recovery-read-failed", "Unable to read current project file for scene-body recovery.", {
        projectId: activeProjectId,
        reason,
        filePath: filePath || state.projectFilePath || state.projectFileHandle?.name || "",
        originalError,
        error,
      });
      return false;
    }

    const recoveredProjectSceneStore = getRecoverableProjectSceneStoreFromSnapshot(snapshot);
    if (!recoveredProjectSceneStore || !Object.keys(recoveredProjectSceneStore).length) {
      desktopFileSystemLog.warn("persistence", "project.save.scene-body-recovery-empty", "Current project file did not contain recoverable scene bodies.", {
        projectId: activeProjectId,
        reason,
        filePath,
        source,
        originalError,
      });
      return false;
    }

    const existingProjectSceneStore = getProjectSceneStore(state.loadedProjectSceneStore, activeProjectId) ?? {};
    const mergedProjectSceneStore = mergeProjectSceneStores(existingProjectSceneStore, recoveredProjectSceneStore);
    if (!mergedProjectSceneStore || !Object.keys(mergedProjectSceneStore).length) {
      return false;
    }

    state.loadedProjectSceneStore = {
      ...normalizeProjectLibrarySceneStore(state.loadedProjectSceneStore),
      [activeProjectId]: mergedProjectSceneStore,
    };
    desktopFileSystemLog.info("persistence", "project.save.scene-body-recovered", "Recovered retained scene bodies from the current project file before save.", {
      projectId: activeProjectId,
      reason,
      filePath,
      source,
      recoveredSceneCount: Object.keys(mergedProjectSceneStore).length,
    });
    return true;
  }

  async function buildProjectSnapshotForSaveFileWithRecovery(options = {}) {
    try {
      return buildProjectSnapshotForSaveFile();
    } catch (error) {
      if (!isCollapsedSceneBodyStoreError(error)) {
        throw error;
      }

      const recovered = await recoverCollapsedSceneBodiesFromCurrentProjectFile({
        reason: options.reason ?? "save-project",
        originalError: error,
      });
      if (!recovered) {
        throw error;
      }
      return buildProjectSnapshotForSaveFile();
    }
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
      rememberLoadedProjectSceneStore(snapshot?.sceneStore ?? {});
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

  function hasProjectAutosaveDirtyDomains() {
    return Boolean(
      state.projectPersistenceDirtyDomains &&
      typeof state.projectPersistenceDirtyDomains === "object" &&
      Object.keys(state.projectPersistenceDirtyDomains).length > 0,
    );
  }

  // Intent: clear stale permission blocks after a successful file write without dropping fresh edits made during that write.
  function shouldClearProjectAutosaveAfterSuccessfulSave(saveRevision) {
    return state.projectFileAutosaveRevision === saveRevision || !hasProjectAutosaveDirtyDomains();
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

  // Intent: verify browser-handle writes because Chromium can report a background-write block after the file was updated.
  async function isBrowserHandleSnapshotSynced(handle, snapshot) {
    if (!handle) {
      return false;
    }

    try {
      const writtenSnapshot = await readProjectLibraryFromBrowserHandle(handle);
      return stableSerialize(writtenSnapshot) === stableSerialize(snapshot);
    } catch (error) {
      desktopFileSystemLog.warn("persistence", "project.save.browser-handle-verify-failed", "Unable to verify project file contents after browser-handle write failure.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        filePath: handle?.name ?? state.projectFilePath ?? "",
        error,
      });
      return false;
    }
  }

  // Intent: require the stored project JSON to match the just-built save snapshot before a file save is considered durable.
  function assertSavedProjectSnapshotMatches(writtenSnapshot, expectedSnapshot, {
    mode = "project-file",
    filePath = "",
  } = {}) {
    if (stableSerialize(writtenSnapshot) === stableSerialize(expectedSnapshot)) {
      return;
    }

    throw new Error(`Project file verification failed: ${mode} at ${filePath || "unknown target"} does not contain the latest project snapshot.`);
  }

  async function verifyBrowserHandleSnapshotSynced(handle, snapshot) {
    const filePath = handle?.name ?? state.projectFilePath ?? "";
    try {
      const writtenSnapshot = await readProjectLibraryFromBrowserHandle(handle);
      assertSavedProjectSnapshotMatches(writtenSnapshot, snapshot, {
        mode: "browser-handle",
        filePath,
      });
      desktopFileSystemLog.info("persistence", "project.save.browser-handle-verified", "Verified project file JSON after browser-handle write.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        filePath,
      });
      return true;
    } catch (error) {
      desktopFileSystemLog.error("persistence", "project.save.browser-handle-verification-failed", "Project file JSON verification failed after browser-handle write.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        filePath,
        error,
      });
      throw error;
    }
  }

  async function verifyDesktopPathSnapshotSynced(filePath, snapshot, { semantic = false } = {}) {
    const resolvedPath = normalizeProjectFilePath(filePath);
    try {
      const writtenSnapshot = await readProjectLibraryFromDesktopPath(resolvedPath, {
        fetchJsonFromDesktopApi,
      });
      if (semantic) {
        assertProjectSnapshotsSemanticallyEquivalent(snapshot, writtenSnapshot, {
          operation: "Project package save",
        });
      } else {
        assertSavedProjectSnapshotMatches(writtenSnapshot, snapshot, {
          mode: "desktop-path",
          filePath: resolvedPath,
        });
      }
      desktopFileSystemLog.info("persistence", "project.save.file-path-verified", "Verified project file JSON after desktop-path write.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        filePath: resolvedPath,
      });
      return true;
    } catch (error) {
      desktopFileSystemLog.error("persistence", "project.save.file-path-verification-failed", "Project file JSON verification failed after desktop-path write.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        filePath: resolvedPath,
        error,
      });
      throw error;
    }
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

  // Intent: derive Save As filenames from the currently active project, including newly imported projects.
  function resolveSaveAsSuggestedFileName(projectTitle = "") {
    const fallbackTitle = projectTitle ||
      state.projectTitle ||
      state.workspace?.project?.title ||
      getActiveProjectRecord()?.title ||
      "Untitled Project";
    const suggestedName = resolveSuggestedProjectFileName(fallbackTitle);
    return normalizeProjectFilePath(suggestedName) || getSuggestedProjectFileName(fallbackTitle);
  }

  async function saveProjectSnapshotToBrowserHandle(handle, snapshot = null, options = {}) {
    if (!handle) {
      throw new Error("A browser file handle is required.");
    }

    const sourceSnapshot = snapshot ?? await buildProjectSnapshotForSaveFileWithRecovery({
      reason: options.reason ?? "save-project",
    });
    const saveProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
    const saveRevision = state.projectFileAutosaveRevision;
    const browserHandleProjectFilePath = normalizeProjectFilePath(options.destinationPath)
      || state.projectFilePath
      || handle.name
      || "";
    // Intent: preserve the legacy single-file contract without changing the active destination before verification succeeds.
    const resolvedSnapshot = options.destinationPath
      ? {
        ...cloneValue(sourceSnapshot),
        projects: (sourceSnapshot?.projects ?? []).map((project) => ({
          ...cloneValue(project),
          projectSettings: {
            ...cloneValue(project?.projectSettings ?? {}),
            projectFilePath: browserHandleProjectFilePath,
          },
        })),
      }
      : sourceSnapshot;
    state.projectFileBusy = true;
    state.projectFileStatus = "Saving project file...";
    renderHeader();

    try {
      const writePermissionStatus = options.requestPermission === true
        ? await requestProjectFileHandleWritePermission(handle)
        : await queryProjectFileHandleWritePermission(handle);
      state.projectFileHandlePermission = writePermissionStatus;
      if (writePermissionStatus !== "granted") {
        throw new Error("Project file write permission is unavailable. Use Ctrl+S or Save as file to re-authorize this file.");
      }

      const savedLabel = await writeProjectLibraryToBrowserHandle(handle, resolvedSnapshot, {
        fallbackFileName: resolveSuggestedProjectFileName(),
        skipPermissionCheck: true,
      });
      await verifyBrowserHandleSnapshotSynced(handle, resolvedSnapshot);
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

      await setActiveProjectFileDestination(browserHandleProjectFilePath || savedLabel, handle, {
        skipProjectFileAutosave: true,
        handlePermission: "granted",
        persistBrowserFileHandle: true,
        persistDesktopProjectFilePath: hasProjectFilePath(browserHandleProjectFilePath),
        clearDesktopProjectFilePath: !hasProjectFilePath(browserHandleProjectFilePath),
        storageMode: "browser-handle",
      });
      persistProjectSnapshotToBrowserCache(resolvedSnapshot, {
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
      if (options.clearAutosaveStateOnSuccess === true || shouldClearProjectAutosaveAfterSuccessfulSave(saveRevision)) {
        clearProjectAutosaveState();
        clearEditorWorkingDirtyState("project-save-succeeded");
      }
      renderHeader();
      return savedLabel;
    } catch (error) {
      const activeProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
      const isBackgroundWritePolicyError = isBrowserHandleBackgroundWritePolicyError(error);
      const isPermissionError = !isBackgroundWritePolicyError && isBrowserHandlePermissionError(error);
      const writeProgress = getProjectFileWriteProgress(error);
      const browserAcceptedSnapshotWrite = writeProgress?.writeCompleted === true;
      if (isBackgroundWritePolicyError && activeProjectId === saveProjectId) {
        const verifiedSynced = await isBrowserHandleSnapshotSynced(handle, resolvedSnapshot);
        if (verifiedSynced || browserAcceptedSnapshotWrite) {
          const savedLabel = handle?.name || browserHandleProjectFilePath || resolveSuggestedProjectFileName();
          await setActiveProjectFileDestination(browserHandleProjectFilePath || savedLabel, handle, {
            skipProjectFileAutosave: true,
            handlePermission: "granted",
            persistBrowserFileHandle: true,
            persistDesktopProjectFilePath: hasProjectFilePath(browserHandleProjectFilePath),
            clearDesktopProjectFilePath: !hasProjectFilePath(browserHandleProjectFilePath),
            storageMode: "browser-handle",
            source: "saveProjectSnapshotToBrowserHandleVerified",
          });
          persistProjectSnapshotToBrowserCache(resolvedSnapshot, {
            target: "browser-handle",
            reason: "save-project",
            filePath: savedLabel,
          });
          state.projectFileStatus = `Saved to ${savedLabel}`;
          reportBrowserLog("info", "project-file", verifiedSynced
            ? "Verified project file write after browser reported a background-write block."
            : "Accepted project file write after browser reported a post-write background block.", {
            filePath: savedLabel,
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? null,
            title: state.projectTitle,
            mode: "browser-handle",
            saveProjectId,
            activeProjectId,
            writeProgress,
          });
          if (options.clearAutosaveStateOnSuccess === true || shouldClearProjectAutosaveAfterSuccessfulSave(saveRevision)) {
            clearProjectAutosaveState();
            clearEditorWorkingDirtyState("project-save-succeeded");
          }
          renderHeader();
          return savedLabel;
        }
      }
      if (activeProjectId === saveProjectId) {
        state.projectFileStatus = `Save failed: ${toErrorMessage(error)}`;
      }
      if (isPermissionError) {
        state.projectFileHandlePermission = "prompt";
      }
      const reportAsRecoverableBrowserWriteBlock =
        (isPermissionError || isBackgroundWritePolicyError) && options.requestPermission !== true;
      reportBrowserLog(
        reportAsRecoverableBrowserWriteBlock ? "warn" : "error",
        "project-file",
        isBackgroundWritePolicyError
          ? "Browser blocked background project file write."
          : isPermissionError && options.requestPermission !== true
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

  async function saveProjectSnapshotToFilePath(filePath, snapshot = null, options = {}) {
    const resolvedPath = normalizeProjectFilePath(filePath);
    if (!resolvedPath) {
      throw new Error("A project file path is required.");
    }

    const resolvedSnapshot = snapshot ?? await buildProjectSnapshotForSaveFileWithRecovery({
      reason: options.reason ?? "save-project",
    });
    const saveProjectId = state.activeProjectId ?? state.workspace?.project?.id ?? "";
    const saveRevision = state.projectFileAutosaveRevision;
    state.projectFileBusy = true;
    state.projectFileStatus = "Saving project file...";
    renderHeader();

    try {
      const savedPath = await writeProjectLibraryToDesktopPath(resolvedPath, resolvedSnapshot, {
        fetchJsonFromDesktopApi,
      });
      await verifyDesktopPathSnapshotSynced(savedPath, resolvedSnapshot, {
        semantic: options.semanticVerification === true,
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

      await setActiveProjectFileDestination(savedPath, null, {
        skipProjectFileAutosave: true,
        persistDesktopProjectFilePath: true,
        clearBrowserFileHandle: true,
        storageMode: options.storageMode,
        source: "saveProjectSnapshotToFilePath",
      });
      persistProjectSnapshotToBrowserCache(options.cacheSnapshot ?? resolvedSnapshot, {
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
      if (options.clearAutosaveStateOnSuccess === true || shouldClearProjectAutosaveAfterSuccessfulSave(saveRevision)) {
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
      await autosaveController.drain();
    }
  }

  function browseDesktopProjectPackages(path = "") {
    return browseProjectPackageDirectories({ path }, { fetchJsonFromDesktopApi });
  }

  // Intent: share filesystem publication ordering so neither New nor Save As exposes an unverified final package.
  async function stageVerifyAndCommitProjectPackage({ portableSnapshot, operation, stagePackage }) {
    const staged = await stagePackage();
    try {
      if (
        typeof staged?.operationToken !== "string"
        || typeof staged?.stagingRootPath !== "string"
        || typeof staged?.finalRootPath !== "string"
      ) {
        throw new Error("Desktop host returned an invalid project package staging operation.");
      }
      const loaded = await loadProjectPackageFromDesktop({
        rootPath: staged.stagingRootPath,
      }, { fetchJsonFromDesktopApi });
      assertProjectSnapshotsSemanticallyEquivalent(portableSnapshot, loaded.snapshot, {
        operation: `${operation} package`,
      });
      projectPersistenceLog.info("validation", "project.package.verified", `Verified the staged ${operation} package before publication.`, {
        rootPath: loaded.rootPath,
        operation,
      });
      const committed = await commitStagedProjectPackageOnDesktop({
        operationToken: staged.operationToken,
      }, { fetchJsonFromDesktopApi });
      return {
        rootPath: committed.rootPath,
        snapshot: loaded.snapshot,
      };
    } catch (error) {
      if (typeof staged?.operationToken === "string" && staged.operationToken) {
        try {
          await discardStagedProjectPackageOnDesktop({
            operationToken: staged.operationToken,
          }, { fetchJsonFromDesktopApi });
        } catch (discardError) {
          projectPersistenceLog.warn("filesystem", "project.package.discard-failed", "Failed to discard a staged project package after publication was aborted.", {
            operation,
            error: toErrorMessage(discardError),
          });
        }
      }
      throw error;
    }
  }

  // Intent: construct, verify, and publish a new package before any candidate project becomes active.
  async function createDesktopProjectPackage({
    parentPath,
    folderName,
    buildCandidateSnapshot,
  } = {}) {
    if (typeof buildCandidateSnapshot !== "function") {
      throw new Error("New Project requires a candidate snapshot builder.");
    }
    await preserveActiveProjectBeforeLoad("create-desktop-project-package");
    const candidateSnapshot = await buildCandidateSnapshot();
    const portableSnapshot = buildPortableExternalProjectSnapshot(candidateSnapshot);
    state.projectFileBusy = true;
    state.projectFileStatus = "Creating project package...";
    renderHeader();
    try {
      const published = await stageVerifyAndCommitProjectPackage({
        portableSnapshot,
        operation: "New Project",
        stagePackage: () => stageNewProjectPackageOnDesktop({
          parentPath,
          folderName,
          snapshot: portableSnapshot,
        }, { fetchJsonFromDesktopApi }),
      });
      await hydrateProjectLibraryFromLoadedSnapshot(published.snapshot, {
        filePath: published.rootPath,
        sourceLabel: "desktop project package",
        reason: "create-project-package",
        mode: "desktop-package",
        preserveProjectIdentity: true,
      });
      state.projectFileStatus = `Created project package at ${published.rootPath}`;
      renderHeader();
      return {
        status: "created",
        rootPath: published.rootPath,
        snapshot: published.snapshot,
      };
    } catch (error) {
      state.projectFileStatus = `Project creation failed: ${toErrorMessage(error)}`;
      renderHeader();
      throw error;
    } finally {
      state.projectFileBusy = false;
      renderHeader();
    }
  }

  // Intent: validate a folder package before draining and replacing the current active project.
  async function openDesktopProjectPackage({ rootPath } = {}) {
    state.projectFileStatus = "Reading project package...";
    renderHeader();
    try {
      const loaded = await loadProjectPackageFromDesktop({ rootPath }, { fetchJsonFromDesktopApi });
      await preserveActiveProjectBeforeLoad("open-desktop-project-package");
      state.projectFileBusy = true;
      await hydrateProjectLibraryFromLoadedSnapshot(loaded.snapshot, {
        filePath: loaded.rootPath,
        sourceLabel: "desktop project package",
        reason: "open-project-package",
        mode: "desktop-package",
        preserveProjectIdentity: true,
      });
      return {
        status: "opened",
        rootPath: loaded.rootPath,
        snapshot: loaded.snapshot,
      };
    } catch (error) {
      state.projectFileStatus = `Open failed: ${toErrorMessage(error)}`;
      renderHeader();
      throw error;
    } finally {
      state.projectFileBusy = false;
      renderHeader();
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
    const loadedRawActiveProject = loadedLibrary.projects.find((project) => project?.id === loadedActiveProjectId)
      ?? loadedLibrary.projects[0]
      ?? null;
    const loadedFileHasExplicitActivePane = hasExplicitProjectSetting(loadedRawActiveProject, "activePane");
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
    const shouldRemapLoadedProjectId = options.preserveProjectIdentity !== true &&
      Boolean(loadedFileDisplayPath) &&
      Boolean(existingProjectWithSameId) &&
      normalizeProjectFilePath(existingProjectFilePath) !== loadedFileDisplayPath;
    const cachedActivePane = !loadedFileHasExplicitActivePane &&
      options.reason === "boot-reconnect" &&
      existingProjectWithSameId &&
      !shouldRemapLoadedProjectId
        ? getProjectActivePaneSetting(existingProjectWithSameId) || normalizeWorkspacePaneSetting(state.activePane)
        : "";
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
          ...(cachedActivePane ? { activePane: cachedActivePane } : {}),
          projectFilePath: loadedFileDisplayPath,
        },
      }
      : null;
    const loadedSceneStore = loadedActiveProject
      ? getProjectSceneStore(loadedLibrary.sceneStore, loadedActiveProject.id)
        ?? getSingleProjectSceneStore(loadedLibrary.sceneStore)
        ?? collectProjectSceneStoreFromRecord(loadedActiveProject)
      : null;
    const importedSceneStore = mergeProjectSceneStores(loadedSceneStore, null);
    const importedProjects = importedProject ? [importedProject] : loadedProjects;
    const importedSceneStoreByProject = importedSceneStore
      ? { [importedProject.id]: importedSceneStore }
      : loadedLibrary.sceneStore ?? {};
    assertProjectLibrarySceneBodyCoverage({
      activeProjectId: importedProject?.id ?? loadedLibrary.activeProjectId,
      projects: importedProjects,
      sceneStore: importedSceneStoreByProject,
    }, {
      operation: "load",
    });
    rememberLoadedProjectSceneStore(importedSceneStoreByProject);

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
    await setActiveProjectFileDestination(loadedDestination.filePath, loadedDestination.fileHandle, {
      skipProjectFileAutosave: true,
      skipProjectRecordPersistence: true,
      handlePermission: loadedHandlePermission,
      persistBrowserFileHandle: Boolean(loadedDestination.fileHandle),
      persistDesktopProjectFilePath: loadedDestination.isDurablePath,
      clearDesktopProjectFilePath: !loadedDestination.isDurablePath,
      clearBrowserFileHandle: !loadedDestination.fileHandle && loadedDestination.isDurablePath,
      storageMode: options.mode === "desktop-package"
        ? "desktop-package"
        : options.mode === "desktop-path"
          ? "desktop-path"
          : loadedDestination.fileHandle
            ? "browser-handle"
            : "",
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

  function exportProjectLibrarySnapshot(snapshot, fileName = resolveSaveAsSuggestedFileName()) {
    return downloadProjectLibrarySnapshot(snapshot, { fileName });
  }

  // Intent: open an explicit chooser when the author wants to switch project files.
  async function chooseProjectSnapshotFileForLoad() {
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
        if (isAbortError(error)) {
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

  // Intent: port Scrivener packages into a new ABE project without treating the source `.scriv` as a save target.
  async function chooseScrivenerProjectForImport() {
    await preserveActiveProjectBeforeLoad("chooseScrivenerProjectForImport");
    state.projectFileBusy = true;
    state.projectFileStatus = "Porting Scrivener project...";
    renderHeader();

    try {
      let scrivenerPackage = null;
      if (canUseBrowserDirectoryPicker(windowRef)) {
        try {
          scrivenerPackage = await pickScrivenerProjectPackageFromDirectory({
            windowRef,
          });
        } catch (error) {
          if (isAbortError(error)) {
            state.projectFileStatus = "Scrivener port cancelled.";
            renderHeader();
            return null;
          }

          state.projectFileStatus = `Scrivener folder picker unavailable: ${toErrorMessage(error)}`;
          renderHeader();
        }
      }

      if (!scrivenerPackage) {
        scrivenerPackage = await promptForScrivenerProjectPackageFromInput({
          windowRef,
        });
      }

      if (!scrivenerPackage?.files?.length) {
        state.projectFileStatus = "Scrivener port cancelled.";
        renderHeader();
        return null;
      }

      const snapshot = await buildScrivenerProjectSnapshotFromFiles(scrivenerPackage.files, {
        sourceLabel: scrivenerPackage.sourceLabel ?? "Scrivener project",
        sourcePath: scrivenerPackage.sourcePath ?? "",
        schemaVersion: projectSchemaVersion,
      });
      await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
        filePath: "",
        fileName: "",
        fileHandle: null,
        sourceLabel: "Scrivener project",
        reason: "scrivener-import",
        mode: "scrivener-import",
      });

      const importedProject = snapshot.projects?.[0] ?? null;
      const sceneCount = Number(importedProject?.importReport?.manuscriptSceneCount ?? 0);
      const metadataCount = Number(importedProject?.importReport?.customMetadataFieldCount ?? 0);
      const saveResult = await saveProjectSnapshotAs({
        reason: "scrivener-import-save-as",
        projectTitle: importedProject?.title ?? "",
      });
      const importSummary = `Ported Scrivener project: ${sceneCount} scene${sceneCount === 1 ? "" : "s"}, ${metadataCount} metadata field${metadataCount === 1 ? "" : "s"}.`;
      if (saveResult?.status === "saved") {
        state.projectFileStatus = `${importSummary} Saved ABE project file to ${saveResult.filePath || state.projectFilePath || "project file"}.`;
      } else if (saveResult?.status === "downloaded") {
        state.projectFileStatus = `${importSummary} Downloaded ${saveResult.filePath || "the ABE project file"}; use Load file to reopen it.`;
      } else if (saveResult?.status === "fallback") {
        state.projectFileStatus = `${importSummary} File save failed; latest project preserved in browser cache. Use Save as file before refreshing.`;
      } else if (saveResult?.status === "cancelled") {
        state.projectFileStatus = `${importSummary} Save As cancelled; use Save as file before refreshing.`;
      } else {
        state.projectFileStatus = `${importSummary} Use Save as file before refreshing.`;
      }
      reportBrowserLog("info", "project-file", "Ported a Scrivener project package.", {
        projectId: snapshot.activeProjectId,
        title: importedProject?.title ?? "",
        sourceLabel: scrivenerPackage.sourceLabel ?? "",
        scenes: sceneCount,
        customMetadataFields: metadataCount,
        mode: "scrivener-import",
        saveMode: saveResult?.mode ?? "",
        projectFilePersisted: saveResult?.projectFilePersisted === true,
        fallbackPersisted: saveResult?.fallbackPersisted === true,
        filePath: saveResult?.filePath ?? state.projectFilePath ?? "",
      });
      return snapshot;
    } catch (error) {
      state.projectFileStatus = `Scrivener port failed: ${toErrorMessage(error)}`;
      reportBrowserLog("error", "project-file", "Scrivener project port failed.", {
        error,
        mode: "scrivener-import",
      });
      renderHeader();
      return null;
    } finally {
      state.projectFileBusy = false;
      queueProjectAutosaveIfDirty();
      renderHeader();
    }
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

    await chooseProjectSnapshotFileForLoad();
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
      const snapshot = await buildProjectSnapshotForSaveFileWithRecovery({ reason });
      const filePath = normalizeProjectFilePath(state.projectFilePath);
      const shouldUseBrowserHandle = Boolean(state.projectFileHandle);
      const shouldUseDesktopPath = !shouldUseBrowserHandle && hasProjectFilePath(filePath);
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
            clearAutosaveStateOnSuccess: reason !== "autosave",
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
              reason: reason === "autosave" && isBrowserHandleBackgroundWritePolicyError(error)
                ? "manual-save-required"
                : isBrowserHandlePermissionError(error)
                  ? "write-permission-required"
                  : "write-failed",
              errorMessage: toErrorMessage(error),
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
        const isDesktopPackage = state.projectFileStorageMode === "desktop-package";
        const externalSnapshot = isDesktopPackage
          ? buildPortableExternalProjectSnapshot(snapshot)
          : snapshot;
        try {
          await saveProjectSnapshotToFilePath(filePath, externalSnapshot, {
            clearAutosaveStateOnSuccess: reason !== "autosave",
            semanticVerification: isDesktopPackage,
            cacheSnapshot: snapshot,
            storageMode: isDesktopPackage ? "desktop-package" : "desktop-path",
          });
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
              errorMessage: toErrorMessage(error),
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

  // Intent: keep A authoritative until staged B has been written, reloaded, verified, and published.
  async function saveProjectSnapshotAsPackage({ destinationParentPath, folderName } = {}) {
    const reason = "save-project-as-package";
    const sourceRoot = hasProjectFilePath(state.projectFilePath)
      ? normalizeProjectFilePath(state.projectFilePath)
      : "";
    await preserveActiveProjectBeforeLoad(reason);
    await prepareProjectSnapshotForSave({ reason });
    const runtimeSnapshot = await buildProjectSnapshotForSaveFileWithRecovery({ reason });
    const portableSnapshot = buildPortableExternalProjectSnapshot(runtimeSnapshot);
    state.projectFileBusy = true;
    state.projectFileStatus = "Saving project package as...";
    renderHeader();
    try {
      const published = await stageVerifyAndCommitProjectPackage({
        portableSnapshot,
        operation: "Save As",
        stagePackage: () => stageSaveAsProjectPackageOnDesktop({
          sourceRoot,
          destinationParentPath,
          folderName,
          snapshot: portableSnapshot,
        }, { fetchJsonFromDesktopApi }),
      });

      await setActiveProjectFileDestination(published.rootPath, null, {
        skipProjectFileAutosave: true,
        persistDesktopProjectFilePath: true,
        clearBrowserFileHandle: true,
        storageMode: "desktop-package",
        source: "saveProjectSnapshotAsPackage",
      });
      clearProjectAutosaveState();
      clearEditorWorkingDirtyState("project-save-as-package-succeeded");
      primeProjectAutosaveTarget();
      state.projectFileStatus = `Saved project package to ${published.rootPath}`;
      renderHeader();
      return {
        status: "saved",
        mode: "desktop-package",
        rootPath: published.rootPath,
        snapshot: published.snapshot,
        projectFilePersisted: true,
        fallbackPersisted: false,
      };
    } catch (error) {
      state.projectFileStatus = `Save As failed: ${toErrorMessage(error)}`;
      renderHeader();
      throw error;
    } finally {
      state.projectFileBusy = false;
      renderHeader();
    }
  }

  async function saveProjectSnapshotAs(options = {}) {
    const reason = options.reason ?? "save-project-as";
    const suggestedProjectFileName = options.suggestedName
      ? normalizeProjectFilePath(options.suggestedName)
      : resolveSaveAsSuggestedFileName(options.projectTitle ?? "");
    beginProjectCacheSuppression();
    beginProjectAutosaveSuppression();
    projectSaveGateLog.info("user-action", "project.save-as.begin", "Starting Save As flow.", {
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      typedPath: state.projectFilePath ?? "",
      reason,
    });
    try {
      const typedPath = normalizeProjectFilePath(state.projectFilePath);
      if (hasProjectFilePath(typedPath)) {
        await prepareProjectSnapshotForSave({ reason });
        const snapshot = await buildProjectSnapshotForSaveFileWithRecovery({ reason });
        try {
          const savedPath = await saveProjectSnapshotToFilePath(typedPath, snapshot, {
            clearAutosaveStateOnSuccess: true,
            storageMode: "desktop-path",
          });
          projectSaveGateLog.info("persistence", "project.save-as.file-path", "Saved project snapshot using typed file path.", {
            projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            filePath: typedPath,
          });
          return {
            status: "saved",
            mode: "desktop-path",
            filePath: savedPath,
            projectFilePersisted: true,
            fallbackPersisted: false,
          };
        } catch (error) {
          const fallbackPersisted = persistProjectSnapshotFallbackAfterFileSaveFailure(snapshot, {
            target: "save-as-desktop-path-fallback",
            reason,
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
            errorMessage: toErrorMessage(error),
          });
          return {
            status: "fallback",
            mode: "desktop-path-fallback",
            filePath: typedPath,
            projectFilePersisted: false,
            fallbackPersisted,
          };
        }
      }

      if (canUseBrowserSavePicker(windowRef)) {
        try {
          const handle = await pickProjectFileHandleForSave({
            suggestedName: suggestedProjectFileName,
            types: getProjectFilePickerTypes(),
            windowRef,
          });
          const handlePermission = await requestProjectFileHandleWritePermission(handle);
          await prepareProjectSnapshotForSave({ reason });
          const browserHandleProjectFilePath = handle.name || suggestedProjectFileName;
          const snapshot = await buildProjectSnapshotForSaveFileWithRecovery({ reason });
          const savedLabel = await saveProjectSnapshotToBrowserHandle(handle, snapshot, {
            requestPermission: false,
            clearAutosaveStateOnSuccess: true,
            destinationPath: browserHandleProjectFilePath,
            handlePermission,
          });
          return {
            status: "saved",
            mode: "browser-handle",
            filePath: savedLabel,
            fileHandle: handle,
            projectFilePersisted: true,
            fallbackPersisted: false,
          };
        } catch (error) {
          if (isAbortError(error)) {
            state.projectFileStatus = "Save As cancelled.";
            projectSaveGateLog.info("user-action", "project.save-as.cancelled", "Save As picker was cancelled.", {
              projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
            });
            renderHeader();
            return {
              status: "cancelled",
              mode: "browser-handle",
              filePath: "",
              projectFilePersisted: false,
              fallbackPersisted: false,
            };
          }

          state.projectFileStatus = `Save picker unavailable: ${toErrorMessage(error)}`;
          projectSaveGateLog.warn("file-access", "project.save-as.picker-failed", "Save As picker unavailable.", {
            error,
          });
          renderHeader();
        }
      }

      await prepareProjectSnapshotForSave({ reason });
      const snapshot = await buildProjectSnapshotForSaveFileWithRecovery({ reason });
      persistProjectSnapshotToBrowserCache(snapshot, {
        target: "download",
        reason,
        filePath: typedPath || suggestedProjectFileName,
      });
      const downloadedName = exportProjectLibrarySnapshot(snapshot, typedPath || suggestedProjectFileName);
      state.projectFileStatus = `Downloaded ${downloadedName}. Use Load file to reopen it later.`;
      projectSaveGateLog.info("persistence", "project.save-as.download", "Downloaded project snapshot as fallback file.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        downloadedName,
      });
      renderHeader();
      return {
        status: "downloaded",
        mode: "download",
        filePath: downloadedName,
        projectFilePersisted: false,
        fallbackPersisted: true,
      };
    } finally {
      projectSaveGateLog.info("lifecycle", "project.save-as.end", "Save As flow completed.", {
        projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
        reason,
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

    await setActiveProjectFileDestination(displayPath, cachedHandleRecord.fileHandle, {
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
    const explicitDesktopProjectFilePath = desktopSettings?.lastProjectFilePathExplicit === true
      ? resolveProjectFilePath(desktopSettings?.lastProjectFilePath)
      : "";
    const activeProjectFilePath = resolveProjectFilePath(state.projectFilePath);
    // Intent: the desktop host's explicit last-opened file wins over stale browser/cache project records on refresh.
    const candidatePath = [
      explicitDesktopProjectFilePath,
      activeProjectFilePath,
    ].find((pathValue) => hasProjectFilePath(pathValue));

    if (!candidatePath) {
      await restoreProjectFileHandleDestinationFromCache("restoreLastOpenedProject");
      return;
    }

    try {
      let snapshot;
      let storageMode = "desktop-package";
      try {
        const loadedPackage = await loadProjectPackageFromDesktop({
          rootPath: candidatePath,
        }, { fetchJsonFromDesktopApi });
        snapshot = loadedPackage.snapshot;
      } catch (packageError) {
        if (!/\.json$/i.test(candidatePath)) throw packageError;
        storageMode = "desktop-path";
        snapshot = await readProjectLibraryFromDesktopPath(candidatePath, {
          fetchJsonFromDesktopApi,
        });
      }
      await hydrateProjectLibraryFromLoadedSnapshot(snapshot, {
        filePath: candidatePath,
        fileHandle: null,
        sourceLabel: storageMode === "desktop-package" ? "desktop project package" : "project file",
        reason: "boot-reconnect",
        mode: storageMode,
      });
      state.projectFileStatus = storageMode === "desktop-package"
        ? `Writing to project package: ${candidatePath}`
        : `Writing to JSON file: ${candidatePath}`;
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

  async function drainProjectAutosave() {
    await autosaveController.drain();
  }

  return {
    beginProjectAutosaveSuppression,
    browseDesktopProjectPackages,
    buildProjectSnapshotForSaveFile,
    chooseProjectSnapshotFileForLoad,
    chooseScrivenerProjectForImport,
    clearProjectAutosaveState,
    clearProjectAutosaveTimer,
    clearEditorWorkingDirtyState,
    commitCanonicalProjectMutation,
    createDesktopProjectPackage,
    drainProjectAutosave,
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
    openDesktopProjectPackage,
    persistActiveProjectRecord,
    persistActiveProjectId,
    persistDesktopProjectFilePath,
    primeProjectAutosaveTarget,
    queueProjectAutosave,
    restoreLastOpenedProject,
    saveProjectSnapshot,
    saveProjectSnapshotAs,
    saveProjectSnapshotAsPackage,
    saveProjectSnapshotToBrowserHandle,
    saveProjectSnapshotToFilePath,
    syncActiveProjectFileDestinationFromRecord,
    setActiveProjectFileDestination,
  };
}
