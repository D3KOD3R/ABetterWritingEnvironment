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
      return;
    }

    try {
      windowRef.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to write ${storageKey}.`, {
        error,
        storageKey,
      });
    }
  };

  const remove = (storageKey) => {
    if (!hasStorage()) {
      return;
    }

    try {
      windowRef.localStorage.removeItem(storageKey);
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to remove ${storageKey}.`, {
        error,
        storageKey,
      });
    }
  };

  return {
    hasStorage,
    readJson,
    remove,
    writeJson,
  };
}
