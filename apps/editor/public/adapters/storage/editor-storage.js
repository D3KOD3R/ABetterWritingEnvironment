// Intent: keep browser-backed editor cache, preference, and small project-state helpers out of the shell.
// Guardrail: browser localStorage is temporary prototype runtime storage (`browser-adapter`) and not the final desktop-storage model.
import {
  EDITOR_DRAFTS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_SOURCE_PATH_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  createStructureDrafts,
  createTemplateDrafts,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizeManuscriptTasks,
  normalizePassageNotes,
} from "../../editor-model.js";

const LEGACY_EDITOR_DRAFTS_KEY = "abe-drafts-v1";
const LEGACY_EDITOR_STRUCTURE_KEY = "abe-structure-v1";
const LEGACY_EDITOR_TASKS_KEY = "abe-task-list-v1";
const EDITOR_COLLAPSED_CHAPTERS_KEY = "abe-collapsed-chapters-v1";
const EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY = "abe-console-collapsed-chapters-v1";

// Intent: keep project-content cache keys distinct from durable user preferences and panel layout settings.
export const PROJECT_CONTENT_STORAGE_KEYS = new Set([
  EDITOR_DRAFTS_KEY,
  LEGACY_EDITOR_DRAFTS_KEY,
  EDITOR_STRUCTURE_KEY,
  LEGACY_EDITOR_STRUCTURE_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
  EDITOR_TASKS_KEY,
  LEGACY_EDITOR_TASKS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_PROJECT_SOURCE_PATH_KEY,
  EDITOR_COLLAPSED_CHAPTERS_KEY,
  EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY,
]);

// Intent: keep the storage key list centralized so shell persistence rules can reuse one guard set.
export const PROJECT_STATE_STORAGE_KEYS = new Set([
  ...PROJECT_CONTENT_STORAGE_KEYS,
  EDITOR_PREFS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
]);

// Intent: return editor cache helpers that share the same logging and localStorage context.
export function createEditorStorage({
  reportBrowserLog = () => {},
  debugStorageAccess = false,
  windowRef = globalThis.window,
} = {}) {
  // Intent: isolate browser localStorage reads so corrupt values fail safely instead of breaking boot.
  const readStoredJson = (storageKey) => {
    if (!("localStorage" in windowRef)) {
      return null;
    }

    try {
      const value = windowRef.localStorage.getItem(storageKey);
      const parsedValue = value ? JSON.parse(value) : null;
      // Intent: keep high-frequency storage probes out of runtime logs unless explicitly profiling storage.
      if (debugStorageAccess === true) {
        reportBrowserLog("debug", "storage", `Read ${storageKey}.`, {
          storageKey,
          hit: value != null,
        });
      }
      return parsedValue;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to read ${storageKey}.`, { error, storageKey });
      console.warn(`Unable to read ${storageKey}`, error);
      return null;
    }
  };

  // Intent: isolate browser localStorage writes so persistence errors stay non-fatal.
  const writeStoredJsonRaw = (storageKey, value) => {
    if (!("localStorage" in windowRef)) {
      return false;
    }

    try {
      windowRef.localStorage.setItem(storageKey, JSON.stringify(value));
      // Intent: avoid turning normal preference/cache writes into a log storm during typing.
      if (debugStorageAccess === true) {
        reportBrowserLog("debug", "storage", `Wrote ${storageKey}.`, {
          storageKey,
          valueType: Array.isArray(value) ? "array" : typeof value,
        });
      }
      return true;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to write ${storageKey}.`, { error, storageKey });
      console.warn(`Unable to write ${storageKey}`, error);
      return false;
    }
  };

  // Intent: remove project-specific browser cache when a JSON project file becomes the source of truth.
  const removeStoredJson = (storageKey) => {
    if (!("localStorage" in windowRef)) {
      return false;
    }

    try {
      windowRef.localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to remove ${storageKey}.`, { error, storageKey });
      console.warn(`Unable to remove ${storageKey}`, error);
      return false;
    }
  };

  const clearProjectContentStorage = ({
    additionalStorageKeys = [],
  } = {}) => {
    const storageKeys = new Set([
      ...PROJECT_CONTENT_STORAGE_KEYS,
      ...additionalStorageKeys.filter((storageKey) => typeof storageKey === "string" && storageKey.trim()),
    ]);
    let cleared = true;
    for (const storageKey of storageKeys) {
      if (removeStoredJson(storageKey) !== true) {
        cleared = false;
      }
    }
    return cleared;
  };

  // Intent: keep small read helpers close to the storage boundary so app.js can stay focused on shell flow.
  const loadStoredString = (storageKey) => {
    const candidate = readStoredJson(storageKey);
    return typeof candidate === "string" && candidate.trim() ? candidate : "";
  };

  const loadStoredNumber = (storageKey, fallback) => {
    const candidate = readStoredJson(storageKey);
    const value = Number(candidate);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const readStoredJsonWithFallback = (...storageKeys) => {
    for (const storageKey of storageKeys) {
      const candidate = readStoredJson(storageKey);
      if (candidate !== null) {
        return candidate;
      }
    }

    return null;
  };

  // Intent: normalize chapter id lists once so collapsed-panel persistence stays deterministic.
  const normalizeChapterIdList = (candidate) => {
    if (!Array.isArray(candidate)) {
      return [];
    }

    return [...new Set(candidate.filter((chapterId) => typeof chapterId === "string" && chapterId.trim()))];
  };

  // Intent: keep persisted scene, template, and preference snapshots safe to read during boot.
  const loadSceneDrafts = () => {
    const candidate = readStoredJsonWithFallback(EDITOR_DRAFTS_KEY, LEGACY_EDITOR_DRAFTS_KEY);
    return candidate && typeof candidate === "object" ? candidate : {};
  };

  const loadStructureDrafts = () => {
    const candidate = readStoredJsonWithFallback(EDITOR_STRUCTURE_KEY, LEGACY_EDITOR_STRUCTURE_KEY);
    return candidate && typeof candidate === "object"
      ? candidate
      : createStructureDrafts();
  };

  const loadTemplateDrafts = () => {
    const candidate = readStoredJson(EDITOR_TEMPLATE_DRAFTS_KEY);
    return Array.isArray(candidate) ? candidate : createTemplateDrafts();
  };

  const loadManuscriptTasks = () =>
    normalizeManuscriptTasks(readStoredJsonWithFallback(EDITOR_TASKS_KEY, LEGACY_EDITOR_TASKS_KEY));

  const loadPassageNotes = () => normalizePassageNotes(readStoredJson(EDITOR_PASSAGE_NOTES_KEY));

  const loadProjectTitle = (defaultTitle) => {
    const candidate = readStoredJson(EDITOR_PROJECT_TITLE_KEY);
    return typeof candidate === "string" && candidate.trim()
      ? candidate
      : defaultTitle;
  };

  const loadEditorPrefs = () => normalizeEditorPrefs(readStoredJson(EDITOR_PREFS_KEY));

  const loadLocalAiPrefs = () => normalizeLocalAiPrefs(readStoredJson(EDITOR_LOCAL_AI_PREFS_KEY));

  // Intent: keep chapter-collapse persistence project-scoped and reversible.
  const loadCollapsedChapterIds = (projectId) => {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return [];
    }

    const candidate = readStoredJson(EDITOR_COLLAPSED_CHAPTERS_KEY);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return [];
    }

    return normalizeChapterIdList(candidate[projectId]);
  };

  const persistCollapsedChapterState = (projectId, chapterIds) => {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return;
    }

    const candidate = readStoredJson("abe-collapsed-chapters-v1");
    const snapshot = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? { ...candidate }
      : {};
    const normalizedChapterIds = normalizeChapterIdList(chapterIds);

    if (normalizedChapterIds.length) {
      snapshot[projectId] = normalizedChapterIds;
    } else {
      delete snapshot[projectId];
    }

    if (Object.keys(snapshot).length) {
      writeStoredJsonRaw(EDITOR_COLLAPSED_CHAPTERS_KEY, snapshot);
      return;
    }

    if ("localStorage" in windowRef) {
      windowRef.localStorage.removeItem(EDITOR_COLLAPSED_CHAPTERS_KEY);
    }
  };

  const loadCollapsedConsoleChapterIds = (projectId) => {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return {
        issueTasks: [],
        issues: [],
        inspiration: [],
        research: [],
      };
    }

    const candidate = readStoredJson(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return {
        issueTasks: [],
        issues: [],
        inspiration: [],
        research: [],
      };
    }

    const snapshot = candidate[projectId];
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return {
        issueTasks: [],
        issues: [],
        inspiration: [],
        research: [],
      };
    }

    return {
      issueTasks: normalizeChapterIdList(snapshot.issueTasks),
      issues: normalizeChapterIdList(snapshot.issues),
      inspiration: normalizeChapterIdList(snapshot.inspiration),
      research: normalizeChapterIdList(snapshot.research),
    };
  };

  const persistCollapsedConsoleChapterState = (projectId, collapsedByPanel) => {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return;
    }

    const candidate = readStoredJson(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
    const snapshot = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? { ...candidate }
      : {};
    const normalized = {
      issueTasks: normalizeChapterIdList(collapsedByPanel?.issueTasks),
      issues: normalizeChapterIdList(collapsedByPanel?.issues),
      inspiration: normalizeChapterIdList(collapsedByPanel?.inspiration),
      research: normalizeChapterIdList(collapsedByPanel?.research),
    };

    if (
      normalized.issueTasks.length ||
      normalized.issues.length ||
      normalized.inspiration.length ||
      normalized.research.length
    ) {
      snapshot[projectId] = normalized;
    } else {
      delete snapshot[projectId];
    }

    if (Object.keys(snapshot).length) {
      writeStoredJsonRaw(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY, snapshot);
      return;
    }

    if ("localStorage" in windowRef) {
      windowRef.localStorage.removeItem(EDITOR_CONSOLE_COLLAPSED_CHAPTERS_KEY);
    }
  };

  // Intent: persist the dock collapse toggle with the same resilience as the rest of the cache layer.
  const persistConsoleDockCollapsedState = (isCollapsed) => {
    if (!("localStorage" in windowRef)) {
      return;
    }

    try {
      if (isCollapsed) {
        windowRef.localStorage.setItem("abe-right-dock-collapsed-v1", JSON.stringify(true));
      } else {
        windowRef.localStorage.removeItem("abe-right-dock-collapsed-v1");
      }
    } catch (error) {
      reportBrowserLog("warn", "storage", "Unable to persist console dock state.", {
        error,
        storageKey: "abe-right-dock-collapsed-v1",
      });
      console.warn("Unable to persist console dock state", error);
    }
  };

  return {
    clearProjectContentStorage,
    loadCollapsedChapterIds,
    loadCollapsedConsoleChapterIds,
    loadEditorPrefs,
    loadLocalAiPrefs,
    loadManuscriptTasks,
    loadPassageNotes,
    loadProjectTitle,
    loadSceneDrafts,
    loadStoredNumber,
    loadStoredString,
    loadStructureDrafts,
    loadTemplateDrafts,
    normalizeChapterIdList,
    persistCollapsedChapterState,
    persistCollapsedConsoleChapterState,
    persistConsoleDockCollapsedState,
    readStoredJson,
    removeStoredJson,
    writeStoredJsonRaw,
  };
}
