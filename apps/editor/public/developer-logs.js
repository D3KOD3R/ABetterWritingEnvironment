import { createDeveloperLogClient } from "./shared/developer-logger.js";
import { createBrowserStorageAdapter } from "./adapters/storage/browser-storage-adapter.js";

const LOG_RUNTIME_BRIDGE_KEY = "__ABE_DEVELOPER_LOG_RUNTIME__";

function resolveRuntimeBridge() {
  try {
    if (window.opener && !window.opener.closed) {
      const bridge = window.opener[LOG_RUNTIME_BRIDGE_KEY];
      if (bridge && typeof bridge === "object") {
        return bridge;
      }
    }
  } catch {
    // Cross-window access can fail in hardened browser contexts.
  }
  return null;
}

function createClient(runtimeBridge, fallbackClient) {
  if (!runtimeBridge || typeof runtimeBridge !== "object") {
    return fallbackClient;
  }

  const read = (methodName, fallbackValue) => {
    const method = runtimeBridge[methodName];
    if (typeof method !== "function") {
      return fallbackValue;
    }
    try {
      return method();
    } catch {
      return fallbackValue;
    }
  };

  return {
    getEntries: () => {
      const runtimeEntries = read("getEntries", null);
      return Array.isArray(runtimeEntries) ? runtimeEntries : fallbackClient.getEntries();
    },
    getSettings: () => read("getSettings", fallbackClient.getSettings()),
    registerSource: (sourceName) => {
      if (typeof runtimeBridge.registerSource === "function") {
        try {
          runtimeBridge.registerSource(sourceName);
          return;
        } catch {
          // Fall back to storage client path.
        }
      }
      fallbackClient.registerSource(sourceName);
    },
    setSourceEnabled: (sourceName, enabled) => {
      if (typeof runtimeBridge.setSourceEnabled === "function") {
        try {
          runtimeBridge.setSourceEnabled(sourceName, enabled === true);
          return;
        } catch {
          // Fall back to storage client path.
        }
      }
      fallbackClient.setSourceEnabled(sourceName, enabled === true);
    },
    setGlobalEnabled: (enabled) => {
      if (typeof runtimeBridge.setGlobalEnabled === "function") {
        try {
          runtimeBridge.setGlobalEnabled(enabled === true);
          return;
        } catch {
          // Fall back to storage client path.
        }
      }
      fallbackClient.setGlobalEnabled(enabled === true);
    },
    setAllSourcesEnabled: (enabled) => {
      if (typeof runtimeBridge.setAllSourcesEnabled === "function") {
        try {
          runtimeBridge.setAllSourcesEnabled(enabled === true);
          return;
        } catch {
          // Fall back to storage client path.
        }
      }
      fallbackClient.setAllSourcesEnabled(enabled === true);
    },
    subscribe: (listener) => {
      if (typeof runtimeBridge.subscribe === "function") {
        try {
          const unsubscribe = runtimeBridge.subscribe(listener);
          if (typeof unsubscribe === "function") {
            return unsubscribe;
          }
        } catch {
          // Fall back to storage client path.
        }
      }
      return fallbackClient.subscribe(listener);
    },
    subscribeSettings: (listener) => {
      if (typeof runtimeBridge.subscribeSettings === "function") {
        try {
          const unsubscribe = runtimeBridge.subscribeSettings(listener);
          if (typeof unsubscribe === "function") {
            return unsubscribe;
          }
        } catch {
          // Fall back to storage client path.
        }
      }
      return fallbackClient.subscribeSettings(listener);
    },
    clear: () => {
      if (typeof runtimeBridge.clear === "function") {
        try {
          runtimeBridge.clear();
          return;
        } catch {
          // Fall back to storage client path.
        }
      }
      fallbackClient.clear();
    },
  };
}

const storageAdapter = createBrowserStorageAdapter({
  windowRef: window,
  reportBrowserLog: () => {},
});
const storageClient = createDeveloperLogClient({
  windowRef: window,
  storageAdapter,
});
const runtimeBridge = resolveRuntimeBridge();
const client = createClient(runtimeBridge, storageClient);
const state = {
  entries: client.getEntries(),
  settings: client.getSettings(),
  paused: false,
  pendingWhilePaused: 0,
  sourceFilter: "",
  categoryFilter: "",
  levelFilter: "",
  searchFilter: "",
  clientMode: runtimeBridge ? "runtime-bridge" : "storage-sync",
  runtimeLog: {
    filePath: "",
    fileName: "",
    sessionNumber: 0,
    keepLatestSessions: 20,
    autoPruneEnabled: true,
    deletedCount: 0,
  },
};

async function postDesktopApi(pathname, payload) {
  const baseUrls = ["http://127.0.0.1:4310", "http://localhost:4310"];
  const body = JSON.stringify(payload ?? {});
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL(pathname, baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore and try the next host origin.
    }
  }
  return false;
}

async function postDesktopApiJson(pathname, payload) {
  const baseUrls = ["http://127.0.0.1:4310", "http://localhost:4310"];
  const body = JSON.stringify(payload ?? {});
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(new URL(pathname, baseUrl).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      if (!text.trim()) {
        return {};
      }
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    } catch {
      // Ignore and try the next host origin.
    }
  }
  return null;
}

const sourceFilter = document.querySelector("#source-filter");
const categoryFilter = document.querySelector("#category-filter");
const levelFilter = document.querySelector("#level-filter");
const searchFilter = document.querySelector("#search-filter");
const pauseButton = document.querySelector("#pause-button");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
const exportButton = document.querySelector("#export-button");
const meta = document.querySelector("#meta");
const logList = document.querySelector("#log-list");
const sourceGates = document.querySelector("#source-gates");
const globalLoggingToggle = document.querySelector("#global-logging-toggle");
const enableAllSourcesButton = document.querySelector("#enable-all-sources-button");
const disableAllSourcesButton = document.querySelector("#disable-all-sources-button");
const settingsMeta = document.querySelector("#settings-meta");
const autoPruneToggle = document.querySelector("#auto-prune-toggle");
const pruneNowButton = document.querySelector("#prune-now-button");
const runtimeLogMeta = document.querySelector("#runtime-log-meta");

function formatCompactPath(path) {
  if (typeof path !== "string" || !path.trim()) {
    return "—";
  }
  const tokens = path.split(/[/\\]/).filter(Boolean);
  if (tokens.length <= 2) {
    return path;
  }
  return `${tokens.slice(0, 1).join("")}\\…\\${tokens.slice(-2).join("\\")}`;
}

function applyRuntimeLogSessionState(payload = {}) {
  state.runtimeLog = {
    ...state.runtimeLog,
    filePath: typeof payload.filePath === "string" ? payload.filePath : state.runtimeLog.filePath,
    fileName: typeof payload.fileName === "string" ? payload.fileName : state.runtimeLog.fileName,
    sessionNumber: Number.isFinite(Number(payload.sessionNumber)) ? Number(payload.sessionNumber) : state.runtimeLog.sessionNumber,
    keepLatestSessions: Number.isFinite(Number(payload.keepLatestSessions))
      ? Math.max(1, Math.round(Number(payload.keepLatestSessions)))
      : state.runtimeLog.keepLatestSessions,
    autoPruneEnabled: payload.autoPruneEnabled === true || payload.autoPruneEnabled === false
      ? payload.autoPruneEnabled === true
      : state.runtimeLog.autoPruneEnabled,
    deletedCount: Number.isFinite(Number(payload.deletedCount)) ? Number(payload.deletedCount) : 0,
  };
}

function renderRuntimeLogMeta() {
  if (autoPruneToggle instanceof HTMLInputElement) {
    autoPruneToggle.checked = state.runtimeLog.autoPruneEnabled === true;
  }
  if (runtimeLogMeta instanceof HTMLElement) {
    const deletedLabel = state.runtimeLog.deletedCount > 0
      ? ` · pruned ${state.runtimeLog.deletedCount}`
      : "";
    const sessionLabel = state.runtimeLog.sessionNumber > 0
      ? `session ${state.runtimeLog.sessionNumber}`
      : "session —";
    const fileLabel = state.runtimeLog.fileName || formatCompactPath(state.runtimeLog.filePath);
    runtimeLogMeta.textContent = `${sessionLabel} · ${fileLabel || "no log file"} · keep ${state.runtimeLog.keepLatestSessions}${deletedLabel}`;
  }
}

async function refreshRuntimeLogSessionState() {
  const payload = await postDesktopApiJson("/api/log/session", {});
  if (payload && typeof payload === "object") {
    applyRuntimeLogSessionState(payload);
    renderRuntimeLogMeta();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEntryLine(entry) {
  const context = entry?.context ? JSON.stringify(entry.context) : "";
  return `[${entry.timestamp}] [${entry.level}] [${entry.source}] [${entry.category}] ${entry.event}: ${entry.message}${context ? ` ${context}` : ""}`;
}

function getKnownSources() {
  const knownSourceSet = new Set();
  const settingSources = Array.isArray(state.settings?.registeredSources) ? state.settings.registeredSources : [];
  for (const sourceName of settingSources) {
    const normalized = String(sourceName ?? "").trim();
    if (normalized) {
      knownSourceSet.add(normalized);
    }
  }
  const sourcesFromMap = state.settings?.sources && typeof state.settings.sources === "object"
    ? Object.keys(state.settings.sources)
    : [];
  for (const sourceName of sourcesFromMap) {
    const normalized = String(sourceName ?? "").trim();
    if (normalized) {
      knownSourceSet.add(normalized);
    }
  }
  for (const entry of state.entries) {
    const normalized = String(entry?.source ?? "").trim();
    if (normalized) {
      knownSourceSet.add(normalized);
    }
  }
  return [...knownSourceSet].sort((left, right) => left.localeCompare(right));
}

function getFilteredEntries() {
  const search = state.searchFilter.trim().toLowerCase();
  return state.entries
    .filter((entry) => !state.sourceFilter || entry.source === state.sourceFilter)
    .filter((entry) => !state.categoryFilter || entry.category === state.categoryFilter)
    .filter((entry) => !state.levelFilter || entry.level === state.levelFilter)
    .filter((entry) => {
      if (!search) {
        return true;
      }
      const haystack = [
        entry.timestamp,
        entry.level,
        entry.source,
        entry.category,
        entry.event,
        entry.message,
        entry.projectId,
        entry.sceneId,
        entry.chapterId,
        entry.blockId,
        JSON.stringify(entry.context ?? {}),
        entry.callsite?.functionName ?? "",
        entry.callsite?.file ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
}

function updateFilterOptions() {
  if (!(sourceFilter instanceof HTMLSelectElement) || !(categoryFilter instanceof HTMLSelectElement)) {
    return;
  }

  const sources = getKnownSources();
  const categories = [...new Set(state.entries.map((entry) => String(entry.category ?? "").trim()).filter(Boolean))].sort();

  sourceFilter.innerHTML = `<option value="">All services</option>${sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("")}`;
  sourceFilter.value = state.sourceFilter;

  categoryFilter.innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  categoryFilter.value = state.categoryFilter;
}

function renderSourceGates() {
  if (!(sourceGates instanceof HTMLElement)) {
    return;
  }

  const sources = getKnownSources();
  if (!sources.length) {
    sourceGates.innerHTML = `<span class="meta">No service sources registered yet.</span>`;
  } else {
    sourceGates.innerHTML = sources.map((sourceName) => {
      const isEnabled = state.settings?.sources?.[sourceName] === true;
      return `
        <label class="source-gate">
          <input type="checkbox" data-source-gate="${escapeHtml(sourceName)}" ${isEnabled ? "checked" : ""} />
          <span>${escapeHtml(sourceName)}</span>
        </label>
      `;
    }).join("");
  }

  if (globalLoggingToggle instanceof HTMLInputElement) {
    globalLoggingToggle.checked = state.settings?.globalEnabled === true;
  }

  if (settingsMeta instanceof HTMLElement) {
    const enabledCount = sources.filter((sourceName) => state.settings?.sources?.[sourceName] === true).length;
    const globalLabel = state.settings?.globalEnabled === true ? "global on" : "global off";
    const modeLabel = state.clientMode === "runtime-bridge"
      ? "live runtime bridge"
      : "storage sync fallback";
    settingsMeta.textContent = `${enabledCount}/${sources.length} services enabled · ${globalLabel} · ${modeLabel}`;
  }
}

function renderEntries() {
  if (!(logList instanceof HTMLElement) || !(meta instanceof HTMLElement)) {
    return;
  }

  updateFilterOptions();
  renderSourceGates();
  renderRuntimeLogMeta();

  const filtered = getFilteredEntries();
  meta.textContent = `${filtered.length} shown / ${state.entries.length} total${state.paused ? ` · paused (${state.pendingWhilePaused} pending)` : ""}`;

  if (!filtered.length) {
    logList.innerHTML = `<li class="empty">No logs match the current filters.</li>`;
    return;
  }

  const newestFirst = [...filtered].reverse();
  logList.innerHTML = newestFirst.map((entry) => {
    const callsite = entry.callsite && typeof entry.callsite === "object" ? entry.callsite : {};
    const functionLabel = callsite.functionName || "unknown";
    const fileLabel = callsite.file || "unknown";
    const lineLabel = Number.isFinite(Number(callsite.line)) ? String(callsite.line) : "—";
    const columnLabel = Number.isFinite(Number(callsite.column)) ? String(callsite.column) : "—";

    return `
      <li class="log-entry">
        <details>
          <summary>
            <span class="chip level-${escapeHtml(entry.level)}">${escapeHtml(entry.level)}</span>
            <span class="chip">${escapeHtml(entry.source)}</span>
            <span class="chip">${escapeHtml(entry.category)}</span>
            <span class="chip">${escapeHtml(entry.timestamp)}</span>
            <span>
              <span class="entry-event">${escapeHtml(entry.event)}</span>
              <div class="entry-message">${escapeHtml(entry.message)}</div>
            </span>
          </summary>
          <div class="entry-details">
            <div class="entry-grid">
              <strong>Project ID</strong><span>${escapeHtml(entry.projectId || "—")}</span>
              <strong>Scene ID</strong><span>${escapeHtml(entry.sceneId || "—")}</span>
              <strong>Chapter ID</strong><span>${escapeHtml(entry.chapterId || "—")}</span>
              <strong>Block ID</strong><span>${escapeHtml(entry.blockId || "—")}</span>
              <strong>Function</strong><span>${escapeHtml(functionLabel)}</span>
              <strong>File</strong><span>${escapeHtml(fileLabel)}</span>
              <strong>Line</strong><span>${escapeHtml(lineLabel)}</span>
              <strong>Column</strong><span>${escapeHtml(columnLabel)}</span>
            </div>
            <pre>${escapeHtml(JSON.stringify(entry.context ?? {}, null, 2))}</pre>
          </div>
        </details>
      </li>
    `;
  }).join("");
}

function wireControls() {
  sourceFilter?.addEventListener("change", () => {
    state.sourceFilter = sourceFilter.value;
    renderEntries();
  });
  categoryFilter?.addEventListener("change", () => {
    state.categoryFilter = categoryFilter.value;
    renderEntries();
  });
  levelFilter?.addEventListener("change", () => {
    state.levelFilter = levelFilter.value;
    renderEntries();
  });
  searchFilter?.addEventListener("input", () => {
    state.searchFilter = searchFilter.value;
    renderEntries();
  });
  pauseButton?.addEventListener("click", () => {
    state.paused = !state.paused;
    if (!state.paused) {
      state.pendingWhilePaused = 0;
      state.entries = client.getEntries();
      renderEntries();
    }
    pauseButton.textContent = state.paused ? "Resume live" : "Pause live";
    pauseButton.classList.toggle("is-active", state.paused);
  });
  clearButton?.addEventListener("click", () => {
    client.clear();
    void (async () => {
      await postDesktopApi("/api/log/clear", {});
      await refreshRuntimeLogSessionState();
      state.entries = [];
      state.pendingWhilePaused = 0;
      renderEntries();
    })();
  });
  copyButton?.addEventListener("click", async () => {
    const text = getFilteredEntries().map((entry) => formatEntryLine(entry)).join("\n");
    if (!text.trim()) {
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  });
  exportButton?.addEventListener("click", () => {
    const payload = JSON.stringify(getFilteredEntries(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `developer-logs-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  });

  sourceGates?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const sourceName = target.dataset.sourceGate ?? "";
    if (!sourceName) {
      return;
    }
    client.setSourceEnabled(sourceName, target.checked === true);
  });

  globalLoggingToggle?.addEventListener("change", () => {
    if (!(globalLoggingToggle instanceof HTMLInputElement)) {
      return;
    }
    client.setGlobalEnabled(globalLoggingToggle.checked === true);
  });

  enableAllSourcesButton?.addEventListener("click", () => {
    client.setAllSourcesEnabled(true);
  });

  disableAllSourcesButton?.addEventListener("click", () => {
    client.setAllSourcesEnabled(false);
  });

  autoPruneToggle?.addEventListener("change", () => {
    if (!(autoPruneToggle instanceof HTMLInputElement)) {
      return;
    }

    void (async () => {
      const payload = await postDesktopApiJson("/api/log/prune-settings", {
        enabled: autoPruneToggle.checked === true,
        keepLatestSessions: 20,
      });
      if (payload && typeof payload === "object") {
        applyRuntimeLogSessionState(payload);
        renderRuntimeLogMeta();
      }
    })();
  });

  pruneNowButton?.addEventListener("click", () => {
    void (async () => {
      const payload = await postDesktopApiJson("/api/log/prune", {
        keepLatestSessions: 20,
      });
      if (payload && typeof payload === "object") {
        applyRuntimeLogSessionState(payload);
        renderRuntimeLogMeta();
      }
    })();
  });
}

client.subscribe((nextEntries) => {
  if (state.paused) {
    state.pendingWhilePaused += 1;
    if (meta instanceof HTMLElement) {
      meta.textContent = `${getFilteredEntries().length} shown / ${state.entries.length} total · paused (${state.pendingWhilePaused} pending)`;
    }
    return;
  }
  state.entries = nextEntries;
  renderEntries();
});

client.subscribeSettings((nextSettings) => {
  state.settings = nextSettings;
  renderEntries();
});

wireControls();
renderEntries();
void refreshRuntimeLogSessionState();
