// Intent: own project media save/load endpoint policy for narration and voice preview workflows.

export function createNarrationMediaService({
  fetchJson,
  saveEndpoint = "/api/project-media/save",
  loadEndpoint = "/api/project-media/load",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createNarrationMediaService requires a fetchJson function.");
  }

  return {
    saveMediaBlob: (request) => saveMediaBlob(request, { fetchJson, saveEndpoint }),
    loadMediaBlob: (request) => loadMediaBlob(request, { fetchJson, loadEndpoint }),
  };
}

export async function saveMediaBlob({
  filePath = "",
  blob = null,
} = {}, {
  fetchJson,
  saveEndpoint = "/api/project-media/save",
} = {}) {
  const normalizedPath = String(filePath ?? "").trim();
  if (!normalizedPath) {
    throw new Error("A media file path is required.");
  }
  if (!(blob instanceof Blob)) {
    throw new Error("A media blob is required.");
  }

  const contentBase64 = await blobToBase64(blob);
  const response = await fetchJson(saveEndpoint, {
    method: "POST",
    body: {
      filePath: normalizedPath,
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
  loadEndpoint = "/api/project-media/load",
} = {}) {
  const normalizedPath = String(filePath ?? "").trim();
  if (!normalizedPath) {
    throw new Error("A media file path is required.");
  }

  const response = await fetchJson(loadEndpoint, {
    method: "POST",
    body: {
      filePath: normalizedPath,
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
