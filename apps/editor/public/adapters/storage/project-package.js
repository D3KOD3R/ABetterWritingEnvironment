// Intent: keep the desktop folder-package transport behind a small same-origin editor adapter.

const NONCANONICAL_SCENE_RUNTIME_FIELD_NAMES = Object.freeze([
  "revisionStats",
]);

function cloneValue(value) {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function stripNoncanonicalSceneRuntimeFields(scene) {
  if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
    return scene;
  }
  for (const fieldName of NONCANONICAL_SCENE_RUNTIME_FIELD_NAMES) {
    delete scene[fieldName];
  }
  return scene;
}

function sanitizeSceneMap(sceneMap) {
  if (!sceneMap || typeof sceneMap !== "object" || Array.isArray(sceneMap)) {
    return;
  }
  for (const scene of Object.values(sceneMap)) {
    stripNoncanonicalSceneRuntimeFields(scene);
  }
}

// Intent: old package sidecars can retain derived scene runtime projections that are not canonical authored data.
// Never rehydrate those fields or allow them to poison staged package readback verification after a restart.
export function sanitizeLoadedProjectPackageValue(value) {
  const result = cloneValue(value);
  const snapshot = result?.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return result;
  }

  const sceneStore = snapshot.sceneStore;
  if (sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)) {
    for (const projectScenes of Object.values(sceneStore)) {
      sanitizeSceneMap(projectScenes);
    }
  }

  for (const project of Array.isArray(snapshot.projects) ? snapshot.projects : []) {
    sanitizeSceneMap(project?.sceneDrafts);
  }

  return result;
}

async function requestProjectPackage(pathname, body, { fetchJsonFromDesktopApi } = {}) {
  if (typeof fetchJsonFromDesktopApi !== "function") {
    throw new Error("Project package operations require the desktop request bridge.");
  }

  const response = await fetchJsonFromDesktopApi(pathname, {
    method: "POST",
    body,
  });
  if (!response?.ok) {
    throw response?.error ?? new Error("Desktop project package request failed.");
  }
  return response.value;
}

export function browseProjectPackageDirectories({ path = "" } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/browse", { path }, options);
}

export function stageNewProjectPackage({ parentPath, folderName, snapshot } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/create", {
    parentPath,
    folderName,
    snapshot,
  }, options);
}

export async function loadProjectPackage({ rootPath } = {}, options = {}) {
  const value = await requestProjectPackage("/api/project-package/load", { rootPath }, options);
  return sanitizeLoadedProjectPackageValue(value);
}

export function stageProjectPackageSave({ rootPath, snapshot } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-stage", { rootPath, snapshot }, options);
}

export async function loadStagedProjectPackageSave({ operationToken } = {}, options = {}) {
  const value = await requestProjectPackage("/api/project-package/save-load", { operationToken }, options);
  return sanitizeLoadedProjectPackageValue(value);
}

export function commitStagedProjectPackageSave({ operationToken } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-commit", { operationToken }, options);
}

export function discardStagedProjectPackageSave({ operationToken } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-discard", { operationToken }, options);
}

export function stageSaveAsProjectPackage({
  sourceRoot = "",
  destinationParentPath,
  folderName,
  snapshot,
} = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-as", {
    sourceRoot,
    destinationParentPath,
    folderName,
    snapshot,
  }, options);
}

export function commitStagedProjectPackage({ operationToken } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/commit", { operationToken }, options);
}

export function discardStagedProjectPackage({ operationToken } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/discard", { operationToken }, options);
}
