// Intent: persist browser File System Access handles behind the project persistence boundary.
// Browser handles are structured-cloneable in IndexedDB; localStorage cannot safely store them.

const PROJECT_FILE_HANDLE_DB_NAME = "abe-project-file-handles-v1";
const PROJECT_FILE_HANDLE_DB_VERSION = 1;
const PROJECT_FILE_HANDLE_STORE_NAME = "projectFileHandles";
const ACTIVE_PROJECT_FILE_HANDLE_KEY = "active-project-file-handle";

function normalizeProjectId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function canUseIndexedDb(windowRef = globalThis.window) {
  return typeof windowRef?.indexedDB?.open === "function";
}

function openProjectFileHandleDatabase(windowRef = globalThis.window) {
  if (!canUseIndexedDb(windowRef)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = windowRef.indexedDB.open(PROJECT_FILE_HANDLE_DB_NAME, PROJECT_FILE_HANDLE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_FILE_HANDLE_STORE_NAME)) {
        database.createObjectStore(PROJECT_FILE_HANDLE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open project file handle storage."));
  });
}

function runProjectFileHandleStoreRequest(windowRef, mode, callback) {
  return openProjectFileHandleDatabase(windowRef).then((database) => {
    if (!database) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROJECT_FILE_HANDLE_STORE_NAME, mode);
      const store = transaction.objectStore(PROJECT_FILE_HANDLE_STORE_NAME);
      let requestResult = null;

      transaction.oncomplete = () => {
        database.close();
        resolve(requestResult);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("Project file handle storage failed."));
      };

      callback(store, (value) => {
        requestResult = value;
      });
    });
  });
}

function readProjectFileHandleRecord(windowRef, id) {
  return runProjectFileHandleStoreRequest(windowRef, "readonly", (store, setResult) => {
    const request = store.get(id);
    request.onsuccess = () => setResult(request.result ?? null);
  });
}

// Intent: store both the project-specific handle and the last active handle for refresh and browser-reopen recovery.
export async function saveProjectFileHandleReference({
  windowRef = globalThis.window,
  projectId = "",
  filePath = "",
  fileName = "",
  fileHandle = null,
} = {}) {
  if (!fileHandle || !canUseIndexedDb(windowRef)) {
    return false;
  }

  const resolvedProjectId = normalizeProjectId(projectId);
  const resolvedFileName = normalizeString(fileName) || normalizeString(fileHandle.name);
  const record = {
    id: resolvedProjectId || ACTIVE_PROJECT_FILE_HANDLE_KEY,
    projectId: resolvedProjectId,
    filePath: normalizeString(filePath) || resolvedFileName,
    fileName: resolvedFileName,
    fileHandle,
    updatedAt: new Date().toISOString(),
  };
  const activeRecord = {
    ...record,
    id: ACTIVE_PROJECT_FILE_HANDLE_KEY,
  };

  await runProjectFileHandleStoreRequest(windowRef, "readwrite", (store) => {
    if (resolvedProjectId) {
      store.put(record);
    }
    store.put(activeRecord);
  });
  return true;
}

// Intent: recover the active handle without exposing IndexedDB details to persistence workflows.
export async function loadProjectFileHandleReference({
  windowRef = globalThis.window,
  projectId = "",
} = {}) {
  if (!canUseIndexedDb(windowRef)) {
    return null;
  }

  const resolvedProjectId = normalizeProjectId(projectId);
  const projectRecord = resolvedProjectId
    ? await readProjectFileHandleRecord(windowRef, resolvedProjectId)
    : null;
  const record = projectRecord ?? await readProjectFileHandleRecord(windowRef, ACTIVE_PROJECT_FILE_HANDLE_KEY);

  if (!record?.fileHandle) {
    return null;
  }

  return {
    projectId: normalizeProjectId(record.projectId),
    filePath: normalizeString(record.filePath),
    fileName: normalizeString(record.fileName) || normalizeString(record.fileHandle.name),
    fileHandle: record.fileHandle,
    updatedAt: normalizeString(record.updatedAt),
  };
}

// Intent: clear stale browser handles when a durable desktop path replaces the active save destination.
export async function clearProjectFileHandleReference({
  windowRef = globalThis.window,
  projectId = "",
} = {}) {
  if (!canUseIndexedDb(windowRef)) {
    return false;
  }

  const resolvedProjectId = normalizeProjectId(projectId);
  await runProjectFileHandleStoreRequest(windowRef, "readwrite", (store) => {
    if (resolvedProjectId) {
      store.delete(resolvedProjectId);
    }
    store.delete(ACTIVE_PROJECT_FILE_HANDLE_KEY);
  });
  return true;
}
