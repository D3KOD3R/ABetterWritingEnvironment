// Intent: central structured logging service for developer diagnostics across browser prototype and future desktop runtimes.
// Usage guidance:
// - Create stable source names for real subsystems (for example `AutosaveCoordinator`, `ProjectPersistenceService`).
// - Choose categories that describe intent (`autosave`, `persistence`, `user-action`, `state-change`, `file-access`).
// - Use `debug` for high-volume traces, `info` for normal lifecycle, `warn` for recoverable issues, and `error` for failures.
// - Keep context focused on IDs, counters, and status fields; avoid dumping full manuscript bodies into logs.
// - Service/source gates default to OFF. Developers explicitly enable only the sources they need.

const DEFAULT_STORAGE_KEY = "abe-developer-logs-v1";
const DEFAULT_SETTINGS_STORAGE_KEY = "abe-developer-log-settings-v1";
const DEFAULT_CHANNEL_NAME = "abe-developer-logs-channel-v1";
const DEFAULT_MAX_ENTRIES = 3000;
const SETTINGS_VERSION = 1;
const MAX_STRING_LENGTH = 1600;
const MAX_OBJECT_KEYS = 40;
const MAX_ARRAY_ITEMS = 40;

function sanitizeValue(value, depth = 0) {
  if (value == null) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) {
      return value;
    }
    return `${value.slice(0, MAX_STRING_LENGTH)}…[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (depth >= 6) {
    return "[max-depth]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
  return Object.fromEntries(entries.map(([key, item]) => [key, sanitizeValue(item, depth + 1)]));
}

function normalizeLevel(level) {
  const normalized = String(level ?? "").toLowerCase();
  if (normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error") {
    return normalized;
  }
  return "info";
}

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text || fallback;
}

function normalizeSourceName(value) {
  return normalizeText(value, "");
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function parseStackLine(stackLine) {
  if (typeof stackLine !== "string" || !stackLine.trim()) {
    return null;
  }

  const line = stackLine.trim().replace(/^at\s+/, "");
  const match = line.match(/^(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
  if (!match) {
    return {
      raw: line,
      functionName: "",
      file: "",
      line: null,
      column: null,
    };
  }

  return {
    raw: line,
    functionName: normalizeText(match[1], ""),
    file: normalizeText(match[2], ""),
    line: Number.isFinite(Number(match[3])) ? Number(match[3]) : null,
    column: Number.isFinite(Number(match[4])) ? Number(match[4]) : null,
  };
}

function captureCallsite(skipFrames = 0) {
  const stack = typeof new Error().stack === "string"
    ? String(new Error().stack).split("\n").slice(1).map((line) => line.trim())
    : [];
  const candidates = stack.filter((line) => !line.includes("developer-logger.js"));
  const chosen = candidates[skipFrames] ?? candidates[0] ?? "";
  return parseStackLine(chosen);
}

function extractRelatedIds(context) {
  const safeContext = context && typeof context === "object" ? context : {};
  return {
    projectId: normalizeText(safeContext.projectId, ""),
    sceneId: normalizeText(safeContext.sceneId, ""),
    chapterId: normalizeText(safeContext.chapterId, ""),
    blockId: normalizeText(safeContext.blockId, ""),
  };
}

function buildLogEntry(entry, options = {}) {
  const context = sanitizeValue(entry.context ?? {});
  const related = extractRelatedIds(context);
  const callsite = options.callsite ?? captureCallsite(options.callsiteSkipFrames ?? 2);
  return {
    id: normalizeText(entry.id, `devlog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    timestamp: new Date().toISOString(),
    level: normalizeLevel(entry.level),
    source: normalizeText(entry.source, "AppRuntime"),
    category: normalizeText(entry.category, "lifecycle"),
    event: normalizeText(entry.event, "event"),
    message: normalizeText(entry.message, "Developer log entry"),
    context,
    callsite,
    projectId: normalizeText(entry.projectId, related.projectId),
    sceneId: normalizeText(entry.sceneId, related.sceneId),
    chapterId: normalizeText(entry.chapterId, related.chapterId),
    blockId: normalizeText(entry.blockId, related.blockId),
  };
}

function loadEntriesFromStorage(storageAdapter, storageKey, maxEntries) {
  if (!storageAdapter || typeof storageAdapter.readJson !== "function") {
    return [];
  }

  try {
    const parsed = storageAdapter.readJson(storageKey);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.slice(-maxEntries);
  } catch {
    return [];
  }
}

function createDefaultSettings() {
  return {
    version: SETTINGS_VERSION,
    globalEnabled: true,
    registeredSources: [],
    sources: {},
  };
}

function normalizeSettings(candidate) {
  const defaults = createDefaultSettings();
  if (!candidate || typeof candidate !== "object") {
    return defaults;
  }

  const registeredSourceSet = new Set(
    Array.isArray(candidate.registeredSources)
      ? candidate.registeredSources.map((source) => normalizeSourceName(source)).filter(Boolean)
      : [],
  );

  const normalizedSources = {};
  const sourceEntries = candidate.sources && typeof candidate.sources === "object"
    ? Object.entries(candidate.sources)
    : [];
  for (const [rawSourceName, rawEnabled] of sourceEntries) {
    const sourceName = normalizeSourceName(rawSourceName);
    if (!sourceName) {
      continue;
    }
    normalizedSources[sourceName] = rawEnabled === true;
    registeredSourceSet.add(sourceName);
  }

  const registeredSources = [...registeredSourceSet];
  for (const sourceName of registeredSources) {
    if (!(sourceName in normalizedSources)) {
      normalizedSources[sourceName] = false;
    }
  }

  return {
    version: SETTINGS_VERSION,
    globalEnabled: candidate.globalEnabled !== false,
    registeredSources: registeredSources.sort((a, b) => a.localeCompare(b)),
    sources: normalizedSources,
  };
}

function loadSettingsFromStorage(storageAdapter, settingsStorageKey) {
  if (!storageAdapter || typeof storageAdapter.readJson !== "function") {
    return createDefaultSettings();
  }

  try {
    return normalizeSettings(storageAdapter.readJson(settingsStorageKey));
  } catch {
    return createDefaultSettings();
  }
}

function persistSettingsToStorage(storageAdapter, settingsStorageKey, settings) {
  if (!storageAdapter || typeof storageAdapter.writeJson !== "function") {
    return;
  }

  try {
    storageAdapter.writeJson(settingsStorageKey, settings);
  } catch {
    // Settings persistence failures are non-fatal by design.
  }
}

function createBroadcastChannel(windowRef, channelName, onMessage) {
  if (!windowRef || typeof windowRef.BroadcastChannel !== "function") {
    return null;
  }
  const channel = new windowRef.BroadcastChannel(channelName);
  channel.onmessage = onMessage;
  return channel;
}

function mergeRegisteredSource(settings, sourceName) {
  const normalizedSource = normalizeSourceName(sourceName);
  if (!normalizedSource) {
    return settings;
  }

  if (
    Array.isArray(settings.registeredSources) &&
    settings.registeredSources.includes(normalizedSource) &&
    settings.sources &&
    typeof settings.sources === "object" &&
    normalizedSource in settings.sources
  ) {
    return settings;
  }

  const nextSettings = {
    ...settings,
    registeredSources: [...(Array.isArray(settings.registeredSources) ? settings.registeredSources : []), normalizedSource]
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right)),
    sources: {
      ...(settings.sources && typeof settings.sources === "object" ? settings.sources : {}),
      [normalizedSource]: settings?.sources?.[normalizedSource] === true,
    },
  };
  return nextSettings;
}

export function createDeveloperLogger({
  windowRef = globalThis.window,
  storageAdapter = null,
  storageKey = DEFAULT_STORAGE_KEY,
  settingsStorageKey = DEFAULT_SETTINGS_STORAGE_KEY,
  channelName = DEFAULT_CHANNEL_NAME,
  maxEntries = DEFAULT_MAX_ENTRIES,
  mirrorConsole = false,
  persistEntriesToStorage = true,
  onEntry = null,
} = {}) {
  let entries = persistEntriesToStorage
    ? loadEntriesFromStorage(storageAdapter, storageKey, maxEntries)
    : [];
  let settings = loadSettingsFromStorage(storageAdapter, settingsStorageKey);
  let lastSettingsStorageSyncAt = 0;
  const listeners = new Set();
  const settingsListeners = new Set();
  const channel = createBroadcastChannel(windowRef, channelName, (event) => {
    const payload = event?.data;
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.type === "append" && payload.entry) {
      entries = [...entries, payload.entry].slice(-maxEntries);
      notifyEntries();
    }
    if (payload.type === "clear") {
      entries = [];
      notifyEntries();
    }
    if (payload.type === "settings-update" && payload.settings) {
      settings = normalizeSettings(payload.settings);
      notifySettings();
    }
  });

  function notifyEntries() {
    const snapshot = entries.slice();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break logging.
      }
    }
  }

  function notifySettings() {
    const snapshot = cloneValue(settings);
    for (const listener of settingsListeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break logger settings updates.
      }
    }
  }

  function persistEntries() {
    if (persistEntriesToStorage !== true) {
      return;
    }
    if (!storageAdapter || typeof storageAdapter.writeJson !== "function") {
      return;
    }
    try {
      storageAdapter.writeJson(storageKey, entries.slice(-maxEntries));
    } catch {
      // Logging persistence failures are non-fatal by design.
    }
  }

  function emit(payload) {
    try {
      channel?.postMessage(payload);
    } catch {
      // Cross-window sync is best-effort.
    }
  }

  function persistAndBroadcastSettings(nextSettings) {
    settings = normalizeSettings(nextSettings);
    lastSettingsStorageSyncAt = Date.now();
    persistSettingsToStorage(storageAdapter, settingsStorageKey, settings);
    emit({ type: "settings-update", settings });
    notifySettings();
  }

  function maybeSyncSettingsFromStorage(force = false) {
    const now = Date.now();
    if (!force && now - lastSettingsStorageSyncAt < 250) {
      return;
    }
    lastSettingsStorageSyncAt = now;
    const loaded = loadSettingsFromStorage(storageAdapter, settingsStorageKey);
    const loadedJson = JSON.stringify(loaded);
    const currentJson = JSON.stringify(settings);
    if (loadedJson === currentJson) {
      return;
    }
    settings = loaded;
    notifySettings();
  }

  function registerSource(sourceName) {
    const normalizedSource = normalizeSourceName(sourceName);
    if (!normalizedSource) {
      return "";
    }
    const mergedSettings = mergeRegisteredSource(settings, normalizedSource);
    if (mergedSettings !== settings) {
      persistAndBroadcastSettings(mergedSettings);
    }
    return normalizedSource;
  }

  function isSourceEnabled(sourceName) {
    maybeSyncSettingsFromStorage();
    const normalizedSource = normalizeSourceName(sourceName);
    if (!normalizedSource) {
      return false;
    }
    return settings.globalEnabled === true && settings?.sources?.[normalizedSource] === true;
  }

  function append(entry) {
    entries = [...entries, entry].slice(-maxEntries);
    persistEntries();
    emit({ type: "append", entry });
    notifyEntries();
    if (typeof onEntry === "function") {
      try {
        onEntry(cloneValue(entry));
      } catch {
        // Sink failures must not break logger append.
      }
    }
    if (mirrorConsole) {
      const method = entry.level === "error"
        ? "error"
        : entry.level === "warn"
          ? "warn"
          : entry.level === "debug"
            ? "debug"
            : "info";
      console[method](`[${entry.source}] [${entry.category}] ${entry.event}: ${entry.message}`, entry.context);
    }
  }

  function shouldLogForSource(sourceName) {
    maybeSyncSettingsFromStorage();
    const normalizedSource = normalizeSourceName(sourceName);
    if (!normalizedSource) {
      return false;
    }
    return isSourceEnabled(normalizedSource);
  }

  function log(payload, options = {}) {
    maybeSyncSettingsFromStorage();
    const source = registerSource(payload?.source);
    if (!shouldLogForSource(source)) {
      return null;
    }
    const entry = buildLogEntry({
      ...(payload ?? {}),
      source,
    }, options);
    append(entry);
    return entry;
  }

  function clear() {
    entries = [];
    persistEntries();
    emit({ type: "clear" });
    notifyEntries();
  }

  function getEntries() {
    return entries.slice();
  }

  function getSettings() {
    return cloneValue(settings);
  }

  function setGlobalEnabled(enabled) {
    persistAndBroadcastSettings({
      ...settings,
      globalEnabled: enabled === true,
    });
  }

  function setSourceEnabled(sourceName, enabled) {
    const source = registerSource(sourceName);
    if (!source) {
      return;
    }
    persistAndBroadcastSettings({
      ...settings,
      globalEnabled: enabled === true ? true : settings.globalEnabled !== false,
      sources: {
        ...(settings.sources ?? {}),
        [source]: enabled === true,
      },
    });
  }

  function setAllSourcesEnabled(enabled) {
    const nextSources = { ...(settings.sources ?? {}) };
    for (const source of settings.registeredSources ?? []) {
      nextSources[source] = enabled === true;
    }
    persistAndBroadcastSettings({
      ...settings,
      sources: nextSources,
    });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function subscribeSettings(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  }

  function createSource(sourceName) {
    const source = registerSource(sourceName) || "AppRuntime";
    return {
      isEnabled() {
        return isSourceEnabled(source);
      },
      setEnabled(enabled) {
        setSourceEnabled(source, enabled);
      },
      log(level, category, event, message, context = {}, options = {}) {
        return log({ level, source, category, event, message, context }, options);
      },
      debug(category, event, message, context = {}, options = {}) {
        return log({ level: "debug", source, category, event, message, context }, options);
      },
      info(category, event, message, context = {}, options = {}) {
        return log({ level: "info", source, category, event, message, context }, options);
      },
      warn(category, event, message, context = {}, options = {}) {
        return log({ level: "warn", source, category, event, message, context }, options);
      },
      error(category, event, message, context = {}, options = {}) {
        return log({ level: "error", source, category, event, message, context }, options);
      },
    };
  }

  if (windowRef && typeof windowRef.addEventListener === "function") {
    windowRef.addEventListener("storage", (event) => {
      if (persistEntriesToStorage === true && event.key === storageKey) {
        entries = loadEntriesFromStorage(storageAdapter, storageKey, maxEntries);
        notifyEntries();
      }
      if (event.key === settingsStorageKey) {
        settings = loadSettingsFromStorage(storageAdapter, settingsStorageKey);
        lastSettingsStorageSyncAt = Date.now();
        notifySettings();
      }
    });
  }

  return {
    storageKey,
    settingsStorageKey,
    channelName,
    maxEntries,
    getEntries,
    getSettings,
    isSourceEnabled,
    registerSource,
    setAllSourcesEnabled,
    setGlobalEnabled,
    setSourceEnabled,
    subscribe,
    subscribeSettings,
    clear,
    log,
    debug(source, category, event, message, context = {}, options = {}) {
      return log({ level: "debug", source, category, event, message, context }, options);
    },
    info(source, category, event, message, context = {}, options = {}) {
      return log({ level: "info", source, category, event, message, context }, options);
    },
    warn(source, category, event, message, context = {}, options = {}) {
      return log({ level: "warn", source, category, event, message, context }, options);
    },
    error(source, category, event, message, context = {}, options = {}) {
      return log({ level: "error", source, category, event, message, context }, options);
    },
    createSource,
  };
}

export function createDeveloperLogClient({
  windowRef = globalThis.window,
  storageAdapter = null,
  storageKey = DEFAULT_STORAGE_KEY,
  settingsStorageKey = DEFAULT_SETTINGS_STORAGE_KEY,
  channelName = DEFAULT_CHANNEL_NAME,
  maxEntries = DEFAULT_MAX_ENTRIES,
} = {}) {
  let entries = loadEntriesFromStorage(storageAdapter, storageKey, maxEntries);
  let settings = loadSettingsFromStorage(storageAdapter, settingsStorageKey);
  const listeners = new Set();
  const settingsListeners = new Set();
  const channel = createBroadcastChannel(windowRef, channelName, (event) => {
    const payload = event?.data;
    if (!payload || typeof payload !== "object") {
      return;
    }
    if (payload.type === "append" && payload.entry) {
      entries = [...entries, payload.entry].slice(-maxEntries);
      notifyEntries();
    }
    if (payload.type === "clear") {
      entries = [];
      notifyEntries();
    }
    if (payload.type === "settings-update" && payload.settings) {
      settings = normalizeSettings(payload.settings);
      notifySettings();
    }
  });

  function notifyEntries() {
    const snapshot = entries.slice();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break diagnostics.
      }
    }
  }

  function notifySettings() {
    const snapshot = cloneValue(settings);
    for (const listener of settingsListeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener errors must not break settings updates.
      }
    }
  }

  function persistSettings(nextSettings) {
    settings = normalizeSettings(nextSettings);
    persistSettingsToStorage(storageAdapter, settingsStorageKey, settings);
    try {
      channel?.postMessage({ type: "settings-update", settings });
    } catch {
      // Ignore cross-window settings sync failures.
    }
    notifySettings();
  }

  function getEntries() {
    return entries.slice();
  }

  function getSettings() {
    return cloneValue(settings);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function subscribeSettings(listener) {
    if (typeof listener !== "function") {
      return () => {};
    }
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  }

  function clear() {
    entries = [];
    try {
      if (storageAdapter && typeof storageAdapter.writeJson === "function") {
        storageAdapter.writeJson(storageKey, []);
      }
    } catch {
      // Ignore clear persistence failures.
    }
    try {
      channel?.postMessage({ type: "clear" });
    } catch {
      // Ignore cross-window clear failures.
    }
    notifyEntries();
  }

  function registerSource(sourceName) {
    const source = normalizeSourceName(sourceName);
    if (!source) {
      return;
    }
    const merged = mergeRegisteredSource(settings, source);
    if (merged !== settings) {
      persistSettings(merged);
    }
  }

  function setGlobalEnabled(enabled) {
    persistSettings({
      ...settings,
      globalEnabled: enabled === true,
    });
  }

  function setSourceEnabled(sourceName, enabled) {
    const source = normalizeSourceName(sourceName);
    if (!source) {
      return;
    }
    registerSource(source);
    persistSettings({
      ...settings,
      globalEnabled: enabled === true ? true : settings.globalEnabled !== false,
      sources: {
        ...(settings.sources ?? {}),
        [source]: enabled === true,
      },
    });
  }

  function setAllSourcesEnabled(enabled) {
    const nextSources = { ...(settings.sources ?? {}) };
    for (const source of settings.registeredSources ?? []) {
      nextSources[source] = enabled === true;
    }
    persistSettings({
      ...settings,
      globalEnabled: enabled === true ? true : settings.globalEnabled,
      sources: nextSources,
    });
  }

  if (windowRef && typeof windowRef.addEventListener === "function") {
    windowRef.addEventListener("storage", (event) => {
      if (event.key === storageKey) {
        entries = loadEntriesFromStorage(storageAdapter, storageKey, maxEntries);
        notifyEntries();
      }
      if (event.key === settingsStorageKey) {
        settings = loadSettingsFromStorage(storageAdapter, settingsStorageKey);
        notifySettings();
      }
    });
  }

  return {
    storageKey,
    settingsStorageKey,
    channelName,
    maxEntries,
    getEntries,
    getSettings,
    registerSource,
    setAllSourcesEnabled,
    setGlobalEnabled,
    setSourceEnabled,
    subscribe,
    subscribeSettings,
    clear,
  };
}
