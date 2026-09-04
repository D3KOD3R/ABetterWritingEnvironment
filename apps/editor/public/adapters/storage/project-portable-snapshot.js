import { canonicalizeJsonPersistenceValue } from "./json-persistence-boundary.js";

const PROJECT_RECORD_FIELDS = Object.freeze([
  "id",
  "schemaVersion",
  "title",
  "source",
  "createdAt",
  "updatedAt",
  "sceneDrafts",
  "structureDrafts",
  "templateDrafts",
  "manuscriptTasks",
  "passageNotes",
  "metadataSubgroups",
  "draftProofing",
  "sourceArchive",
  "importReport",
  "editorPrefs",
  "localAiPrefs",
  "revisions",
]);

const PROJECT_SETTINGS_FIELDS = Object.freeze([
  "activeSceneId",
  "assetRegistry",
  "editorPrefs",
  "localAiPrefs",
  "activePane",
  "binderPanelWidth",
  "consoleDockWidth",
  "userSettingPanelResizerLeftPercent",
  "userSettingPanelResizerRightPercent",
  "panelResizerLayoutProfiles",
  "worldSpineEventRailWidth",
  "worldSpineManuscriptPaneWidth",
  "worldSpinePanelLayoutProfiles",
  "worldSpineRightPaneMode",
  "worldSpineUnplacedDockCollapsed",
  "worldSpineLocationFilter",
  "consoleDockCollapsed",
  "sidePanelsHidden",
  "sidePanelVisibility",
  "topPanelVisibility",
  "customMetadataDefinitions",
  "collapsedChapterIds",
  "collapsedConsoleChapterIds",
  "writingTargetState",
  "writingTargetViewMode",
  "writingTargetSelectedDateKey",
  "writingTargetCalendarMonthKey",
  "spellcheck",
]);

const PROJECT_INDEX_FIELDS = Object.freeze([
  "schemaVersion",
  "projectId",
  "projectTitle",
  "createdAt",
  "updatedAt",
  "chapters",
  "scenes",
  "sceneOrder",
  "assetIds",
  "assets",
]);

const WORKSPACE_FIELDS = Object.freeze([
  "generatedAt",
  "workspaceTitle",
  "project",
  "world",
  "selectionDefaults",
]);

const MACHINE_PATH_FIELDS = new Set([
  "projectFilePath",
  "projectSourcePath",
  "projectRoot",
  "modelRoot",
  "assetRoot",
  "defaultProjectRoot",
]);

const NONCANONICAL_SCENE_RUNTIME_FIELD_NAMES = Object.freeze([
  "revisionStats",
]);

function sanitizePortableValue(value, ancestors = new Set()) {
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError("Portable project state cannot contain cycles.");
    ancestors.add(value);
    const result = value.map((entry) => sanitizePortableValue(entry, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  if (ancestors.has(value)) throw new TypeError("Portable project state cannot contain cycles.");
  ancestors.add(value);
  const result = Object.fromEntries(Object.entries(value)
    .filter(([key]) => !MACHINE_PATH_FIELDS.has(key))
    .map(([key, entry]) => [key, sanitizePortableValue(entry, ancestors)]));
  ancestors.delete(value);
  return result;
}

function stripNoncanonicalSceneRuntimeFields(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) return scene;
  for (const fieldName of NONCANONICAL_SCENE_RUNTIME_FIELD_NAMES) {
    delete scene[fieldName];
  }
  return scene;
}

function sanitizePortableSceneMap(sceneMap) {
  const portableSceneMap = sanitizePortableValue(sceneMap);
  if (!portableSceneMap || typeof portableSceneMap !== "object" || Array.isArray(portableSceneMap)) {
    return portableSceneMap;
  }
  for (const scene of Object.values(portableSceneMap)) {
    stripNoncanonicalSceneRuntimeFields(scene);
  }
  return portableSceneMap;
}

function sanitizePortableSceneStore(sceneStore) {
  const portableSceneStore = sanitizePortableValue(sceneStore);
  if (!portableSceneStore || typeof portableSceneStore !== "object" || Array.isArray(portableSceneStore)) {
    return portableSceneStore;
  }
  for (const projectScenes of Object.values(portableSceneStore)) {
    if (!projectScenes || typeof projectScenes !== "object" || Array.isArray(projectScenes)) continue;
    for (const scene of Object.values(projectScenes)) {
      stripNoncanonicalSceneRuntimeFields(scene);
    }
  }
  return portableSceneStore;
}

function selectFields(source, fieldNames) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.fromEntries(fieldNames
    .filter((fieldName) => Object.prototype.hasOwnProperty.call(source, fieldName))
    .map((fieldName) => [fieldName, sanitizePortableValue(source[fieldName])]));
}

function serializeWorkspace(workspace) {
  const portableWorkspace = selectFields(workspace, WORKSPACE_FIELDS);
  if (workspace?.voice && typeof workspace.voice === "object" && !Array.isArray(workspace.voice)) {
    portableWorkspace.voice = selectFields(workspace.voice, ["profiles", "bindings", "recordings"]);
  }
  return portableWorkspace;
}

function serializeImportReport(importReport) {
  const portableImportReport = sanitizePortableValue(importReport);
  if (!portableImportReport || typeof portableImportReport !== "object" || Array.isArray(portableImportReport)) {
    return portableImportReport;
  }
  // The selected source package is import-time authority only; relative provenance elsewhere remains portable project data.
  delete portableImportReport.sourcePath;
  return portableImportReport;
}

function serializeProjectRecord(project) {
  const portableProject = selectFields(project, PROJECT_RECORD_FIELDS);
  if (Object.prototype.hasOwnProperty.call(portableProject, "sceneDrafts")) {
    portableProject.sceneDrafts = sanitizePortableSceneMap(project?.sceneDrafts);
  }
  if (Object.prototype.hasOwnProperty.call(portableProject, "importReport")) {
    portableProject.importReport = serializeImportReport(project?.importReport);
  }
  portableProject.workspace = serializeWorkspace(project?.workspace);
  portableProject.projectSettings = selectFields(project?.projectSettings, PROJECT_SETTINGS_FIELDS);
  portableProject.projectIndex = selectFields(project?.projectIndex, PROJECT_INDEX_FIELDS);
  return portableProject;
}

// Intent: only current semantic state and deliberate project preferences cross the external package boundary.
export function buildPortableProjectSnapshot(snapshot = {}) {
  return canonicalizeJsonPersistenceValue({
    schemaVersion: snapshot?.schemaVersion,
    activeProjectId: snapshot?.activeProjectId,
    projects: (Array.isArray(snapshot?.projects) ? snapshot.projects : []).map(serializeProjectRecord),
    sceneStore: sanitizePortableSceneStore(snapshot?.sceneStore ?? {}),
  });
}
