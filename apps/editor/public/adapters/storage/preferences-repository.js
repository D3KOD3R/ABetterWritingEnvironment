// Intent: keep user preference persistence behind a swappable repository contract.
export function createPreferencesRepository({
  storageAdapter,
} = {}) {
  if (!storageAdapter) {
    throw new Error("A storage adapter is required to create the preferences repository.");
  }

  const save = (key, value) => {
    if (typeof key !== "string" || !key.trim()) {
      return;
    }

    storageAdapter.writeJson(key, value);
  };

  const load = (key, fallback = null) => {
    if (typeof key !== "string" || !key.trim()) {
      return fallback;
    }

    const value = storageAdapter.readJson(key);
    return value === null ? fallback : value;
  };

  const remove = (key) => {
    if (typeof key !== "string" || !key.trim()) {
      return;
    }

    storageAdapter.remove(key);
  };

  return {
    load,
    remove,
    save,
  };
}

