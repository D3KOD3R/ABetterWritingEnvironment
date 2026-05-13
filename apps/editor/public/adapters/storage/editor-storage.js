// Intent: keep browser-backed editor cache, preference, and small project-state helpers out of the shell.
import {
  createStructureDrafts,
  createTemplateDrafts,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizeManuscriptTasks,
  normalizePassageNotes,
} from "../../editor-model.js";

// Intent: keep the storage key list centralized so shell persistence rules can reuse one guard set.
export const PROJECT_STATE_STORAGE_KEYS = new Set([
  "abe-drafts-v1",
  "abe-structure-v1",
  "abe-template-drafts-v1",
  "abe-task-list-v1",
  "abe-passage-notes-v1",
  "abe-project-title-v1",
  "abe-editor-prefs-v1",
  "abe-local-ai-prefs-v1",
]);

// Intent: return editor cache helpers that share the same logging and localStorage context.
export function createEditorStorage({
  reportBrowserLog = () => {},
  windowRef = globalThis.window,
} = {}) {
  // Intent: isolate browser localStorage reads so corrupt values fail safely instead of breaking boot.
  const readStoredJson = (storageKey) => {
    if (!("localStorage" in windowRef)) {
      return null;
    }

    try {
      const value = windowRef.localStorage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to read ${storageKey}.`, { error, storageKey });
      console.warn(`Unable to read ${storageKey}`, error);
      return null;
    }
  };

  // Intent: isolate browser localStorage writes so persistence errors stay non-fatal.
  const writeStoredJsonRaw = (storageKey, value) => {
    if (!("localStorage" in windowRef)) {
      return;
    }

    try {
      windowRef.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      reportBrowserLog("warn", "storage", `Unable to write ${storageKey}.`, { error, storageKey });
      console.warn(`Unable to write ${storageKey}`, error);
    }
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

  // Intent: normalize chapter id lists once so collapsed-panel persistence stays deterministic.
  const normalizeChapterIdList = (candidate) => {
    if (!Array.isArray(candidate)) {
      return [];
    }

    return [...new Set(candidate.filter((chapterId) => typeof chapterId === "string" && chapterId.trim()))];
  };

  // Intent: keep persisted scene, template, and preference snapshots safe to read during boot.
  const loadSceneDrafts = () => {
    const candidate = readStoredJson("abe-drafts-v1");
    return candidate && typeof candidate === "object" ? candidate : {};
  };

  const loadStructureDrafts = () => {
    const candidate = readStoredJson("abe-structure-v1");
    return candidate && typeof candidate === "object"
      ? candidate
      : createStructureDrafts();
  };

  const loadTemplateDrafts = () => {
    const candidate = readStoredJson("abe-template-drafts-v1");
    return Array.isArray(candidate) ? candidate : createTemplateDrafts();
  };

  const loadManuscriptTasks = () => normalizeManuscriptTasks(readStoredJson("abe-task-list-v1"));

  const loadPassageNotes = () => normalizePassageNotes(readStoredJson("abe-passage-notes-v1"));

  const loadProjectTitle = (defaultTitle) => {
    const candidate = readStoredJson("abe-project-title-v1");
    return typeof candidate === "string" && candidate.trim()
      ? candidate
      : defaultTitle;
  };

  const loadEditorPrefs = () => normalizeEditorPrefs(readStoredJson("abe-editor-prefs-v1"));

  const loadLocalAiPrefs = () => normalizeLocalAiPrefs(readStoredJson("abe-local-ai-prefs-v1"));

  // Intent: keep chapter-collapse persistence project-scoped and reversible.
  const loadCollapsedChapterIds = (projectId) => {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return [];
    }

    const candidate = readStoredJson("abe-collapsed-chapters-v1");
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
      writeStoredJsonRaw("abe-collapsed-chapters-v1", snapshot);
      return;
    }

    if ("localStorage" in windowRef) {
      windowRef.localStorage.removeItem("abe-collapsed-chapters-v1");
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

    const candidate = readStoredJson("abe-console-collapsed-chapters-v1");
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

    const candidate = readStoredJson("abe-console-collapsed-chapters-v1");
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
      writeStoredJsonRaw("abe-console-collapsed-chapters-v1", snapshot);
      return;
    }

    if ("localStorage" in windowRef) {
      windowRef.localStorage.removeItem("abe-console-collapsed-chapters-v1");
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
    writeStoredJsonRaw,
  };
}
