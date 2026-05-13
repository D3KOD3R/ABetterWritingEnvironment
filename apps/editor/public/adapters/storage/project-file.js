// Intent: keep project file destination, browser picker, and desktop file I/O rules out of the editor shell.
import {
  hasProjectFilePath,
  normalizeProjectFilePath,
} from "../../shared/project-file-path.js";

export {
  hasProjectFilePath,
  normalizeProjectFilePath,
  resolveLoadedProjectFilePath,
} from "../../shared/project-file-path.js";

// Intent: centralize project-file naming so save prompts and path fallbacks stay consistent.
export function normalizeProjectFileName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function getSuggestedProjectFileName(projectTitle = "Untitled Project") {
  const title = normalizeProjectFileName(projectTitle || "Untitled Project");
  return `${title || "untitled-project"}.abe-project.json`;
}

export function getSuggestedProjectFilePath({
  projectTitle = "Untitled Project",
  projectRoot = "",
} = {}) {
  const fileName = getSuggestedProjectFileName(projectTitle);
  const normalizedRoot = normalizeProjectFilePath(projectRoot).replace(/[\\/]+$/, "");
  if (!normalizedRoot) {
    return fileName;
  }

  return `${normalizedRoot}\\${fileName}`;
}

export function resolveProjectFilePath(value) {
  return normalizeProjectFilePath(value);
}

export function buildProjectFilePathFromRoot(projectRoot = "", fileName = "") {
  const normalizedRoot = normalizeProjectFilePath(projectRoot);
  if (!normalizedRoot) {
    return "";
  }

  const normalizedFileName = normalizeProjectFilePath(fileName) || getSuggestedProjectFileName();
  return `${normalizedRoot.replace(/[\\/]+$/, "")}\\${normalizedFileName}`;
}

// Intent: read durable file paths from project records regardless of legacy or current field placement.
// why are we reading project file paths from records. The project file path should always be set when the user loads or saves a project. 
export function getProjectRecordFilePath(record) {
  const candidatePath = normalizeProjectFilePath(record?.projectSettings?.projectFilePath ?? record?.projectFilePath ?? "");
  return hasProjectFilePath(candidatePath) ? candidatePath : "";
}

// Intent: resolve the active save target from the user's load action, not stale paths embedded in project data.
export function getProjectFilePathBaseName(filePath) {
  return normalizeProjectFilePath(filePath).split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

export function getProjectFileHandleDisplayPath(fileHandle) {
  return typeof fileHandle?.name === "string" && fileHandle.name.trim()
    ? fileHandle.name.trim()
    : "";
}

//Manual Debug. The resolve loaded project file destination is prioritising the projects saved location 
// from a record as opposed to using the most recent loaded project path.

// export function resolveLoadedProjectFileDestination({
//   requestedFilePath = "",
//   recordFilePath = "",
//   fileHandle = null,
//   useRecordFilePath = false,
// } = {}) {
//   const requested = normalizeProjectFilePath(requestedFilePath);
//   if (hasProjectFilePath(requested)) {
//     return {
//       filePath: requested,
//       fileHandle,
//       isDurablePath: true,
//     };
//   }

//   const record = normalizeProjectFilePath(recordFilePath);
//   const handleDisplayPath = getProjectFileHandleDisplayPath(fileHandle);
//   if (handleDisplayPath) {
//     const recordBaseName = getProjectFilePathBaseName(record);
//     if (
//       hasProjectFilePath(record) &&
//       recordBaseName.toLowerCase() === handleDisplayPath.toLowerCase()
//     ) {
//       return {
//         filePath: record,
//         fileHandle,
//         isDurablePath: true,
//       };
//     }

//     return {
//       filePath: handleDisplayPath,
//       fileHandle,
//       isDurablePath: false,
//     };
//   }

//   if (useRecordFilePath && hasProjectFilePath(record)) {
//     return {
//       filePath: record,
//       fileHandle: null,
//       isDurablePath: true,
//     };
//   }

//   return {
//     filePath: "",
//     fileHandle: null,
//     isDurablePath: false,
//   };
// }

export function resolveLoadedProjectFileDestination({
  requestedFilePath = "",
  recordFilePath = "",
  fileHandle = null,
  useRecordFilePath = false,
} = {}) {
  const requested = normalizeProjectFilePath(requestedFilePath);
  const handleDisplayPath = getProjectFileHandleDisplayPath(fileHandle);

  // PRIORITY 1: Explicitly requested path (Desktop Load)
  if (hasProjectFilePath(requested)) {
    return { filePath: requested, fileHandle, isDurablePath: true };
  }

  // PRIORITY 2: Browser File Handle
  // If we have a handle, we strictly ignore the record path because 
  // the user just manually picked this file.
  if (handleDisplayPath) {
    return {
      filePath: handleDisplayPath,
      fileHandle,
      isDurablePath: false,
    };
  }

  // PRIORITY 3: Fallback to record only if no active load context exists
  const record = normalizeProjectFilePath(recordFilePath);
  if (useRecordFilePath && hasProjectFilePath(record)) {
    return { filePath: record, fileHandle: null, isDurablePath: true };
  }

  return { filePath: "", fileHandle: null, isDurablePath: false };
}

export function hasProjectFileDestination({ fileHandle = null, filePath = "" } = {}) {
  return Boolean(fileHandle || hasProjectFilePath(filePath));
}

// Intent: isolate browser file-system capability checks from the editor's event handlers.
export function canUseBrowserSavePicker(windowRef = globalThis.window) {
  return typeof windowRef?.showSaveFilePicker === "function";
}

export function canUseBrowserOpenPicker(windowRef = globalThis.window) {
  return typeof windowRef?.showOpenFilePicker === "function";
}

export function getProjectFilePickerTypes() {
  return [
    {
      description: "ABetterNovelAuthoringEnvironment project file",
      accept: {
        "application/json": [".json"],
      },
    },
  ];
}

export function getProjectFileInputAccept() {
  return ".json,application/json";
}

// Intent: persist only durable desktop paths into desktop settings.
export async function persistDesktopProjectFilePathPreference(filePath, {
  explicit = true,
  fetchJsonFromDesktopApi,
  onError = () => {},
} = {}) {
  const resolvedPath = resolveProjectFilePath(filePath);
  try {
    await fetchJsonFromDesktopApi("/api/settings", {
      method: "POST",
      body: {
        lastProjectFilePath: explicit && hasProjectFilePath(resolvedPath) ? resolvedPath : "",
        lastProjectFilePathExplicit: explicit && hasProjectFilePath(resolvedPath),
      },
    });
  } catch (error) {
    onError(error, resolvedPath);
  }
}

// Intent: keep project-file read/write transports swappable between browser handles and desktop routes.
export async function writeProjectLibraryToBrowserHandle(handle, snapshot, {
  fallbackFileName = getSuggestedProjectFileName(),
} = {}) {
  if (!handle) {
    throw new Error("A browser file handle is required.");
  }

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(snapshot, null, 2));
  await writable.close();

  return handle.name || fallbackFileName;
}

export async function writeProjectLibraryToDesktopPath(filePath, snapshot, {
  fetchJsonFromDesktopApi,
} = {}) {
  const resolvedPath = normalizeProjectFilePath(filePath);
  if (!resolvedPath) {
    throw new Error("A project file path is required.");
  }

  const response = await fetchJsonFromDesktopApi("/api/project-file/save", {
    method: "POST",
    body: {
      filePath: resolvedPath,
      snapshot,
    },
  });

  if (!response.ok) {
    throw response.error ?? new Error("Project file save failed.");
  }

  return typeof response.value?.filePath === "string" && response.value.filePath.trim()
    ? response.value.filePath.trim()
    : resolvedPath;
}

export async function readProjectLibraryFromBrowserHandle(handle) {
  if (!handle) {
    throw new Error("A browser file handle is required.");
  }

  const file = await handle.getFile();
  return readProjectLibraryFromBrowserFile(file);
}

// Intent: parse project files from browser and desktop transports into the same snapshot shape.
export async function readProjectLibraryFromBrowserFile(file) {
  if (!file) {
    throw new Error("A browser file is required.");
  }

  const content = await file.text();
  return JSON.parse(content.replace(/^\uFEFF/, ""));
}

export async function readProjectLibraryFromDesktopPath(filePath, {
  fetchJsonFromDesktopApi,
} = {}) {
  const resolvedPath = normalizeProjectFilePath(filePath);
  if (!resolvedPath) {
    throw new Error("A project file path is required.");
  }

  const response = await fetchJsonFromDesktopApi("/api/project-file/load", {
    method: "POST",
    body: {
      filePath: resolvedPath,
    },
  });

  if (!response.ok) {
    throw response.error ?? new Error("Project file load failed.");
  }

  return response.value;
}

// Intent: provide the file-input fallback for browsers that cannot use the file-system picker API.
export function promptForProjectFileFromInput({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  accept = getProjectFileInputAccept(),
} = {}) {
  return new Promise((resolve, reject) => {
    if (!documentRef?.body) {
      resolve(null);
      return;
    }

    const input = documentRef.createElement("input");
    let settled = false;

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      windowRef.removeEventListener("focus", handleWindowFocus);
      input.remove();
    };

    const finish = (file) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(file);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const handleChange = () => {
      finish(input.files?.[0] ?? null);
    };

    const handleCancel = () => {
      finish(null);
    };

    const handleWindowFocus = () => {
      windowRef.removeEventListener("focus", handleWindowFocus);
      windowRef.setTimeout(() => {
        if (!settled) {
          finish(input.files?.[0] ?? null);
        }
      }, 50);
    };

    input.type = "file";
    input.accept = accept;
    input.multiple = false;
    input.tabIndex = -1;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "-9999px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    windowRef.addEventListener("focus", handleWindowFocus);
    documentRef.body.appendChild(input);

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (error) {
      fail(error);
    }
  });
}

export function downloadProjectLibrarySnapshot(snapshot, {
  fileName = getSuggestedProjectFileName(),
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  urlRef = globalThis.URL,
  blobCtor = globalThis.Blob,
} = {}) {
  const resolvedFileName = normalizeProjectFilePath(fileName) || getSuggestedProjectFileName();
  const blob = new blobCtor([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const downloadUrl = urlRef.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = resolvedFileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  windowRef.setTimeout(() => urlRef.revokeObjectURL(downloadUrl), 1000);
  return resolvedFileName;
}
