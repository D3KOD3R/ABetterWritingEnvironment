// Intent: keep native directory selection and selected-root read access behind one reusable desktop capability adapter.

const DIRECTORY_PICKER_BRIDGE_FLAG = "__abeDesktopDirectoryPickerBridgeInstalled";
const pendingDirectoryHandles = new WeakMap();

function toErrorMessage(payload, fallback) {
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  return message || fallback;
}

async function postDesktopDirectoryRequest(pathname, body, {
  fetchImpl = globalThis.fetch,
  allowUnsupported = false,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Desktop directory access requires fetch.");
  }

  const response = await fetchImpl(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (allowUnsupported && (response.status === 404 || response.status === 501 || payload?.supported === false)) {
    return {
      supported: false,
      payload,
    };
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(toErrorMessage(payload, "Desktop directory request failed."));
  }

  return {
    supported: true,
    payload,
  };
}

export async function chooseDesktopDirectory({
  initialPath = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const result = await postDesktopDirectoryRequest("/api/platform/pick-directory", {
    initialPath: String(initialPath ?? "").trim(),
  }, {
    fetchImpl,
    allowUnsupported: true,
  });

  if (!result.supported) {
    return {
      supported: false,
      cancelled: false,
      path: "",
    };
  }

  return {
    supported: true,
    cancelled: result.payload?.cancelled === true,
    path: typeof result.payload?.path === "string" ? result.payload.path : "",
  };
}

export async function listDesktopDirectoryEntries({
  rootPath = "",
  relativePath = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const result = await postDesktopDirectoryRequest("/api/platform/directory/list", {
    rootPath: String(rootPath ?? "").trim(),
    relativePath: String(relativePath ?? "").trim(),
  }, { fetchImpl });

  return {
    rootPath: typeof result.payload?.rootPath === "string" ? result.payload.rootPath : "",
    relativePath: typeof result.payload?.relativePath === "string" ? result.payload.relativePath : "",
    entries: Array.isArray(result.payload?.entries) ? result.payload.entries : [],
  };
}

export async function readDesktopDirectoryFile({
  rootPath = "",
  relativePath = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const result = await postDesktopDirectoryRequest("/api/platform/directory/read-file", {
    rootPath: String(rootPath ?? "").trim(),
    relativePath: String(relativePath ?? "").trim(),
  }, { fetchImpl });

  return result.payload ?? {};
}

function normalizeRelativePath(value = "") {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function getPathName(value = "") {
  return String(value ?? "")
    .replace(/[\\/]+$/g, "")
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1) ?? "";
}

function decodeBase64Bytes(contentBase64 = "") {
  const binary = globalThis.atob(String(contentBase64 ?? ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createDesktopFileHandle(entry, {
  rootPath,
  fetchImpl,
} = {}) {
  const name = String(entry?.name ?? getPathName(entry?.relativePath));
  const relativePath = normalizeRelativePath(entry?.relativePath ?? name);
  return {
    kind: "file",
    name,
    async getFile() {
      let contentPromise = null;
      const loadContent = async () => {
        if (!contentPromise) {
          contentPromise = readDesktopDirectoryFile({
            rootPath,
            relativePath,
            fetchImpl,
          });
        }
        return contentPromise;
      };

      return {
        name,
        size: Number(entry?.size) || 0,
        type: typeof entry?.type === "string" ? entry.type : "",
        lastModified: Number(entry?.lastModified) || 0,
        async text() {
          const payload = await loadContent();
          return new TextDecoder("utf-8").decode(decodeBase64Bytes(payload?.contentBase64));
        },
        async arrayBuffer() {
          const payload = await loadContent();
          const bytes = decodeBase64Bytes(payload?.contentBase64);
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
      };
    },
  };
}

export function createDesktopDirectoryHandle({
  rootPath = "",
  relativePath = "",
  name = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedRootPath = String(rootPath ?? "").trim();
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  return {
    kind: "directory",
    name: String(name || getPathName(normalizedRelativePath) || getPathName(normalizedRootPath) || "Selected folder"),
    async *entries() {
      const listing = await listDesktopDirectoryEntries({
        rootPath: normalizedRootPath,
        relativePath: normalizedRelativePath,
        fetchImpl,
      });

      for (const entry of listing.entries) {
        if (entry?.kind === "directory") {
          yield [entry.name, createDesktopDirectoryHandle({
            rootPath: listing.rootPath || normalizedRootPath,
            relativePath: entry.relativePath,
            name: entry.name,
            fetchImpl,
          })];
          continue;
        }
        if (entry?.kind === "file") {
          yield [entry.name, createDesktopFileHandle(entry, {
            rootPath: listing.rootPath || normalizedRootPath,
            fetchImpl,
          })];
        }
      }
    },
  };
}

function createDirectoryPickerUnavailableError() {
  const error = new Error("Directory picker API is unavailable.");
  error.name = "NotSupportedError";
  return error;
}

// Intent: let legacy/import flows consume a desktop-selected directory without owning another picker implementation.
export function installDesktopDirectoryPickerBridge({
  windowRef = globalThis.window,
} = {}) {
  if (!windowRef || windowRef[DIRECTORY_PICKER_BRIDGE_FLAG] === true) {
    return Boolean(windowRef);
  }

  const browserDirectoryPicker = typeof windowRef.showDirectoryPicker === "function"
    ? windowRef.showDirectoryPicker.bind(windowRef)
    : null;

  const bridgedDirectoryPicker = function bridgedDirectoryPicker(options = {}) {
    const pendingHandle = pendingDirectoryHandles.get(windowRef);
    if (pendingHandle) {
      pendingDirectoryHandles.delete(windowRef);
      return Promise.resolve(pendingHandle);
    }
    if (browserDirectoryPicker) {
      return browserDirectoryPicker(options);
    }
    return Promise.reject(createDirectoryPickerUnavailableError());
  };

  try {
    Object.defineProperty(windowRef, "showDirectoryPicker", {
      configurable: true,
      writable: true,
      value: bridgedDirectoryPicker,
    });
  } catch {
    try {
      windowRef.showDirectoryPicker = bridgedDirectoryPicker;
    } catch {
      return false;
    }
  }

  try {
    windowRef[DIRECTORY_PICKER_BRIDGE_FLAG] = true;
  } catch {
    // The bridge itself is already installed; a non-extensible test/window object only loses the repeat-call marker.
  }
  return true;
}

export function queueDesktopDirectoryForNextPicker({
  rootPath = "",
  windowRef = globalThis.window,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!windowRef) {
    throw new Error("A window is required to queue a desktop directory selection.");
  }
  const normalizedRootPath = String(rootPath ?? "").trim();
  if (!normalizedRootPath) {
    throw new Error("A selected desktop directory path is required.");
  }
  installDesktopDirectoryPickerBridge({ windowRef });
  pendingDirectoryHandles.set(windowRef, createDesktopDirectoryHandle({
    rootPath: normalizedRootPath,
    fetchImpl,
  }));
}
