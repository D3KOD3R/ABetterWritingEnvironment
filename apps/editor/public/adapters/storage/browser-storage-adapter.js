// Intent: isolate raw browser storage access behind a replaceable adapter boundary.
// Guardrail: browser storage is a compatibility adapter only; it must be replaceable by desktop storage without changing workflow logic.
export function createBrowserStorageAdapter({
  windowRef = globalThis.window,
  reportBrowserLog = () => {},
} = {}) {
  const hasStorage = () => Boolean(windowRef?.localStorage);

  const readJson = (storageKey) => {
    if (!hasStorage()) {
      return null;
    }

    try {
      const raw = windowRef.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to read ${storageKey}.`, {
        error,
        storageKey,
      });
      return null;
    }
  };

  const writeJson = (storageKey, value) => {
    if (!hasStorage()) {
      return false;
    }

    try {
      windowRef.localStorage.setItem(storageKey, JSON.stringify(value));
      return true;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to write ${storageKey}.`, {
        error,
        storageKey,
      });
      return false;
    }
  };

  // Intent: let higher-level repositories clear their own cache namespace without exposing localStorage directly.
  const listKeys = () => {
    if (!hasStorage()) {
      return [];
    }

    try {
      const storage = windowRef.localStorage;
      if (typeof storage.key !== "function") {
        return [];
      }

      const keys = [];
      const storageLength = Number(storage.length) || 0;
      for (let index = 0; index < storageLength; index += 1) {
        const key = storage.key(index);
        if (typeof key === "string") {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      reportBrowserLog("warn", "storage", "Unable to list browser storage keys.", {
        error,
      });
      return [];
    }
  };

  const remove = (storageKey) => {
    if (!hasStorage()) {
      return false;
    }

    try {
      windowRef.localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to remove ${storageKey}.`, {
        error,
        storageKey,
      });
      return false;
    }
  };

  return {
    hasStorage,
    listKeys,
    readJson,
    remove,
    writeJson,
  };
}
