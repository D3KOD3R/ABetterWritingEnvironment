// Intent: keep project file destination, browser picker, and desktop file I/O rules out of the editor shell.
// Architecture labels:
// - `browser-adapter`: compatibility layer for browser-only APIs.
// - `desktop-storage`: future real project-folder package runtime.
// - `projectService`: stable boundary the UI should call instead of runtime-specific APIs.
// Boundary rule: UI/workflow modules must never call File System Access APIs directly.
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

// Intent: derive the canonical project identity for file-backed projects from the project filename.
export function getProjectFileIdentity(filePath) {
  const baseName = getProjectFilePathBaseName(filePath);
  const withoutProjectSuffix = baseName.replace(/\.abe-project\.json$/i, "");
  const withoutJsonSuffix = withoutProjectSuffix.replace(/\.json$/i, "");
  return withoutJsonSuffix
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getProjectFileHandleDisplayPath(fileHandle) {
  return typeof fileHandle?.name === "string" && fileHandle.name.trim()
    ? fileHandle.name.trim()
    : "";
}

// Intent: keep browser file-handle permission checks in the file adapter, not in UI orchestration.
export async function queryProjectFileHandleWritePermission(fileHandle) {
  if (!fileHandle || typeof fileHandle.queryPermission !== "function") {
    return fileHandle ? "granted" : "denied";
  }

  try {
    const status = await fileHandle.queryPermission({ mode: "readwrite" });
    return normalizeProjectFileHandlePermission(status);
  } catch {
    return "prompt";
  }
}

export async function requestProjectFileHandleWritePermission(fileHandle) {
  if (!fileHandle) {
    return "denied";
  }

  if (typeof fileHandle.requestPermission !== "function") {
    return queryProjectFileHandleWritePermission(fileHandle);
  }

  try {
    const status = await fileHandle.requestPermission({ mode: "readwrite" });
    return normalizeProjectFileHandlePermission(status);
  } catch {
    return "prompt";
  }
}

export async function ensureProjectFileHandleWritePermission(fileHandle, {
  requestPermission = false,
} = {}) {
  const status = requestPermission
    ? await requestProjectFileHandleWritePermission(fileHandle)
    : await queryProjectFileHandleWritePermission(fileHandle);
  return status === "granted";
}

function normalizeProjectFileHandlePermission(status) {
  return ["granted", "prompt", "denied"].includes(status) ? status : "prompt";
}

export function resolveLoadedProjectFileDestination({
  requestedFilePath = "",
  recordFilePath = "",
  fileHandle = null,
  useRecordFilePath = false,
} = {}) {
  const requested = normalizeProjectFilePath(requestedFilePath);
  if (hasProjectFilePath(requested)) {
    return {
      filePath: requested,
      fileHandle,
      isDurablePath: true,
    };
  }

  const record = normalizeProjectFilePath(recordFilePath);
  const handleDisplayPath = getProjectFileHandleDisplayPath(fileHandle);

  if (handleDisplayPath) {
    const recordBaseName = getProjectFilePathBaseName(record);
    if (
      hasProjectFilePath(record) &&
      recordBaseName.toLowerCase() === handleDisplayPath.toLowerCase()
    ) {
      return {
        filePath: record,
        fileHandle,
        isDurablePath: true,
      };
    }

    return {
      filePath: handleDisplayPath,
      fileHandle,
      isDurablePath: false,
    };
  }

  if (useRecordFilePath && hasProjectFilePath(record)) {
    return {
      filePath: record,
      fileHandle: null,
      isDurablePath: true,
    };
  }

  return {
    filePath: "",
    fileHandle: null,
    isDurablePath: false,
  };
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

// Intent: isolate File System Access API calls so UI modules do not depend on browser-only APIs directly.
export async function pickProjectFileHandleForOpen({
  windowRef = globalThis.window,
  types = getProjectFilePickerTypes(),
} = {}) {
  if (typeof windowRef?.showOpenFilePicker !== "function") {
    throw new Error("Open file picker API is unavailable.");
  }

  const [handle] = await windowRef.showOpenFilePicker({
    multiple: false,
    types,
  });
  return handle ?? null;
}

// Intent: isolate File System Access API calls so save workflows stay adapter-owned and portable.
export async function pickProjectFileHandleForSave({
  suggestedName = getSuggestedProjectFileName(),
  windowRef = globalThis.window,
  types = getProjectFilePickerTypes(),
} = {}) {
  if (typeof windowRef?.showSaveFilePicker !== "function") {
    throw new Error("Save file picker API is unavailable.");
  }

  return windowRef.showSaveFilePicker({
    suggestedName,
    types,
  });
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

// Intent: keep new-project title prompts out of the shell so browser-only UI primitives stay adapter-owned.
export function promptForProjectTitle({
  message = "Name your new project:",
  defaultTitle = "Untitled Project",
  windowRef = globalThis.window,
} = {}) {
  if (typeof windowRef?.prompt !== "function") {
    return defaultTitle;
  }

  return windowRef.prompt(String(message), String(defaultTitle));
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
  requestPermission = false,
  skipPermissionCheck = false,
} = {}) {
  if (!handle) {
    throw new Error("A browser file handle is required.");
  }

  if (!skipPermissionCheck) {
    const hasWritePermission = await ensureProjectFileHandleWritePermission(handle, {
      requestPermission,
    });
    if (!hasWritePermission) {
      throw new Error("Project file write permission is unavailable. Use Ctrl+S or Save as file to re-authorize this file.");
    }
  }

  const writeProgress = {
    writableOpened: false,
    writeCompleted: false,
    closeCompleted: false,
  };
  try {
    const writable = await handle.createWritable();
    writeProgress.writableOpened = true;
    await writable.write(JSON.stringify(snapshot, null, 2));
    writeProgress.writeCompleted = true;
    await writable.close();
    writeProgress.closeCompleted = true;
  } catch (error) {
    attachProjectFileWriteProgress(error, writeProgress);
    throw error;
  }

  return handle.name || fallbackFileName;
}

export function getProjectFileWriteProgress(error) {
  const progress = error && typeof error === "object" ? error.projectFileWriteProgress : null;
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
    return null;
  }

  return {
    writableOpened: progress.writableOpened === true,
    writeCompleted: progress.writeCompleted === true,
    closeCompleted: progress.closeCompleted === true,
  };
}

function attachProjectFileWriteProgress(error, progress) {
  if (!error || typeof error !== "object") {
    return;
  }

  try {
    Object.defineProperty(error, "projectFileWriteProgress", {
      configurable: true,
      enumerable: false,
      value: {
        writableOpened: progress.writableOpened === true,
        writeCompleted: progress.writeCompleted === true,
        closeCompleted: progress.closeCompleted === true,
      },
    });
  } catch {
    error.projectFileWriteProgress = {
      writableOpened: progress.writableOpened === true,
      writeCompleted: progress.writeCompleted === true,
      closeCompleted: progress.closeCompleted === true,
    };
  }
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
