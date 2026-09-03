// Intent: keep the desktop folder-package transport behind a small same-origin editor adapter.

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

export function loadProjectPackage({ rootPath } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/load", { rootPath }, options);
}

export function stageProjectPackageSave({ rootPath, snapshot } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-stage", { rootPath, snapshot }, options);
}

export function loadStagedProjectPackageSave({ operationToken } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/save-load", { operationToken }, options);
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
