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

export function createProjectPackage({ parentPath, folderName, snapshot } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/create", {
    parentPath,
    folderName,
    snapshot,
  }, options);
}

export function loadProjectPackage({ rootPath } = {}, options = {}) {
  return requestProjectPackage("/api/project-package/load", { rootPath }, options);
}

export function saveProjectPackageAs({
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
