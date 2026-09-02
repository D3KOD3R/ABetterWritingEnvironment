// Intent: own project media save/load endpoint policy for narration and voice preview workflows.

export function createNarrationMediaService({
  fetchJson,
  getActiveProjectRoot,
  saveEndpoint = "/api/project-media/save",
  loadEndpoint = "/api/project-media/load",
  deleteEndpoint = "/api/project-media/delete",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createNarrationMediaService requires a fetchJson function.");
  }
  if (typeof getActiveProjectRoot !== "function") {
    throw new TypeError("createNarrationMediaService requires getActiveProjectRoot.");
  }

  return {
    saveMediaBlob: (request) => saveMediaBlob(request, { fetchJson, getActiveProjectRoot, saveEndpoint }),
    loadMediaBlob: (request) => loadMediaBlob(request, { fetchJson, getActiveProjectRoot, loadEndpoint }),
    deleteMediaFile: (request) => deleteMediaFile(request, { fetchJson, getActiveProjectRoot, deleteEndpoint }),
  };
}

export async function saveMediaBlob({
  filePath = "",
  blob = null,
} = {}, {
  fetchJson,
  getActiveProjectRoot,
  saveEndpoint = "/api/project-media/save",
} = {}) {
  const normalizedPath = requireProjectRelativeMediaPath(filePath);
  const activeProjectRoot = requireActiveProjectRoot(getActiveProjectRoot);
  if (!(blob instanceof Blob)) {
    throw new Error("A media blob is required.");
  }

  const contentBase64 = await blobToBase64(blob);
  const response = await fetchJson(saveEndpoint, {
    method: "POST",
    body: {
      activeProjectRoot,
      projectRelativePath: normalizedPath,
      contentBase64,
    },
  });

  if (!response?.ok) {
    throw response?.error ?? new Error("Unable to save the narration media file.");
  }

  return {
    ok: true,
    filePath: normalizedPath,
  };
}

export async function loadMediaBlob({
  filePath = "",
  mediaMimeType = "",
} = {}, {
  fetchJson,
  getActiveProjectRoot,
  loadEndpoint = "/api/project-media/load",
} = {}) {
  const normalizedPath = requireProjectRelativeMediaPath(filePath);
  const activeProjectRoot = requireActiveProjectRoot(getActiveProjectRoot);

  const response = await fetchJson(loadEndpoint, {
    method: "POST",
    body: {
      activeProjectRoot,
      projectRelativePath: normalizedPath,
    },
  });

  if (!response?.ok) {
    throw response?.error ?? new Error("Unable to load the voice recording.");
  }

  const blob = base64ToBlob(response.value?.contentBase64 ?? "", mediaMimeType);
  if (!blob) {
    throw new Error("The voice recording was empty.");
  }

  return {
    ok: true,
    filePath: normalizedPath,
    blob,
  };
}

// Intent: delete saved narration media through the desktop project-media boundary.
export async function deleteMediaFile({
  filePath = "",
} = {}, {
  fetchJson,
  getActiveProjectRoot,
  deleteEndpoint = "/api/project-media/delete",
} = {}) {
  const normalizedPath = requireProjectRelativeMediaPath(filePath);
  const activeProjectRoot = requireActiveProjectRoot(getActiveProjectRoot);

  const response = await fetchJson(deleteEndpoint, {
    method: "POST",
    body: {
      activeProjectRoot,
      projectRelativePath: normalizedPath,
    },
  });

  if (!response?.ok) {
    throw response?.error ?? new Error("Unable to delete the voice recording.");
  }

  const responseValue = response.value && typeof response.value === "object"
    ? response.value
    : response;

  return {
    ok: true,
    filePath: normalizedPath,
    removed: responseValue?.removed !== false,
  };
}

// Intent: keep durable narration references normalized and project-relative before they cross the desktop boundary.
function requireProjectRelativeMediaPath(filePath) {
  const normalizedPath = String(filePath ?? "").trim().replace(/\\/g, "/");
  const segments = normalizedPath.split("/");
  if (
    !normalizedPath
    || normalizedPath.startsWith("/")
    || /^[A-Za-z]:/.test(normalizedPath)
    || segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("A normalized project-relative media path is required.");
  }
  return normalizedPath;
}

function requireActiveProjectRoot(getActiveProjectRoot) {
  const activeProjectRoot = typeof getActiveProjectRoot === "function"
    ? String(getActiveProjectRoot() ?? "").trim()
    : "";
  if (!activeProjectRoot) {
    throw new Error("Save this project to a folder-backed package before creating or using project media.");
  }
  return activeProjectRoot;
}

export async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBufferToBase64(arrayBuffer);
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(bytes).toString("base64");
  }

  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

export function base64ToBlob(contentBase64, mediaMimeType = "") {
  const normalizedContent = typeof contentBase64 === "string" ? contentBase64.trim() : "";
  if (!normalizedContent) {
    return null;
  }

  const bytes = base64ToBytes(normalizedContent);
  return new Blob([bytes], {
    type: normalizeMediaMimeType(mediaMimeType),
  });
}

function base64ToBytes(contentBase64) {
  if (typeof globalThis.Buffer !== "undefined") {
    return new Uint8Array(globalThis.Buffer.from(contentBase64, "base64"));
  }

  const binary = globalThis.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeMediaMimeType(mediaMimeType) {
  const normalized = String(mediaMimeType ?? "").trim();
  return normalized || "audio/webm";
}
