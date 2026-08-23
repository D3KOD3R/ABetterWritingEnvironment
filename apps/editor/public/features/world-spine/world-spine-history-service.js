// Intent: own bounded undo/redo state for author-visible World Spine mutations.

export const WORLD_SPINE_HISTORY_LIMIT = 30;

// Intent: create a stable empty history shape that callers can reset between projects.
export function createWorldSpineHistoryState(history = {}) {
  return {
    undoStack: normalizeHistoryEntries(history.undoStack),
    redoStack: normalizeHistoryEntries(history.redoStack),
  };
}

// Intent: push one reviewed World Spine interaction and clear redo state after a new mutation.
export function pushWorldSpineHistoryEntry(history = {}, entry = {}, { limit = WORLD_SPINE_HISTORY_LIMIT } = {}) {
  const normalizedEntry = normalizeWorldSpineHistoryEntry(entry);
  const currentHistory = createWorldSpineHistoryState(history);
  if (!normalizedEntry || snapshotsAreEqual(normalizedEntry.before, normalizedEntry.after)) {
    return currentHistory;
  }

  const safeLimit = Math.max(1, Math.floor(Number(limit) || WORLD_SPINE_HISTORY_LIMIT));
  return {
    undoStack: [...currentHistory.undoStack, normalizedEntry].slice(-safeLimit),
    redoStack: [],
  };
}

// Intent: move the latest undo entry to redo and return the snapshot that should be restored.
export function undoWorldSpineHistory(history = {}, { limit = WORLD_SPINE_HISTORY_LIMIT } = {}) {
  const currentHistory = createWorldSpineHistoryState(history);
  const undoStack = [...currentHistory.undoStack];
  const entry = undoStack.pop();
  if (!entry) {
    return {
      history: currentHistory,
      entry: null,
      snapshot: null,
      direction: "undo",
    };
  }

  const safeLimit = Math.max(1, Math.floor(Number(limit) || WORLD_SPINE_HISTORY_LIMIT));
  return {
    history: {
      undoStack,
      redoStack: [...currentHistory.redoStack, entry].slice(-safeLimit),
    },
    entry,
    snapshot: cloneValue(entry.before),
    direction: "undo",
  };
}

// Intent: move the latest redo entry back to undo and return the snapshot that should be restored.
export function redoWorldSpineHistory(history = {}, { limit = WORLD_SPINE_HISTORY_LIMIT } = {}) {
  const currentHistory = createWorldSpineHistoryState(history);
  const redoStack = [...currentHistory.redoStack];
  const entry = redoStack.pop();
  if (!entry) {
    return {
      history: currentHistory,
      entry: null,
      snapshot: null,
      direction: "redo",
    };
  }

  const safeLimit = Math.max(1, Math.floor(Number(limit) || WORLD_SPINE_HISTORY_LIMIT));
  return {
    history: {
      undoStack: [...currentHistory.undoStack, entry].slice(-safeLimit),
      redoStack,
    },
    entry,
    snapshot: cloneValue(entry.after),
    direction: "redo",
  };
}

export function canUndoWorldSpineHistory(history = {}) {
  return createWorldSpineHistoryState(history).undoStack.length > 0;
}

export function canRedoWorldSpineHistory(history = {}) {
  return createWorldSpineHistoryState(history).redoStack.length > 0;
}

// Intent: normalize entries at the boundary so stale or partial history records cannot poison stack reads.
export function normalizeWorldSpineHistoryEntry(entry = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const before = normalizeWorldSpineHistorySnapshot(entry.before);
  const after = normalizeWorldSpineHistorySnapshot(entry.after);
  if (!before || !after) {
    return null;
  }

  return {
    id: normalizeString(entry.id) || `world-spine-history-${Date.now()}`,
    label: normalizeString(entry.label) || "World Spine change",
    source: normalizeString(entry.source) || "world-spine",
    dirtyReason: normalizeString(entry.dirtyReason) || "world-spine-history",
    timestamp: normalizeString(entry.timestamp) || new Date().toISOString(),
    before,
    after,
  };
}

// Intent: keep the snapshot intentionally scoped to World Spine data and display state.
export function normalizeWorldSpineHistorySnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return {
    world: cloneValue(snapshot.world ?? {}),
    projectEventTags: cloneValue(snapshot.projectEventTags ?? []),
    projectSequences: cloneValue(snapshot.projectSequences ?? {}),
    projectStats: cloneValue(snapshot.projectStats ?? {}),
    projectLines: cloneValue(snapshot.projectLines ?? []),
    sceneDrafts: cloneValue(snapshot.sceneDrafts ?? {}),
    structureDrafts: cloneValue(snapshot.structureDrafts ?? {}),
    selectedNodeId: normalizeString(snapshot.selectedNodeId),
    selectedBlockId: normalizeString(snapshot.selectedBlockId),
    selectedIssueId: normalizeNullableString(snapshot.selectedIssueId),
    selectedEntityId: normalizeNullableString(snapshot.selectedEntityId),
    worldSpineEventRailWidth: normalizeOptionalNumber(snapshot.worldSpineEventRailWidth),
    worldSpineManuscriptPaneWidth: normalizeOptionalNumber(snapshot.worldSpineManuscriptPaneWidth),
    worldSpinePanelLayoutProfiles: cloneValue(snapshot.worldSpinePanelLayoutProfiles ?? {}),
    worldSpineTimelineScrollLeft: normalizeOptionalNumber(snapshot.worldSpineTimelineScrollLeft),
    worldSpineManuscriptScrollTop: normalizeOptionalNumber(snapshot.worldSpineManuscriptScrollTop),
    timelineZoom: normalizeOptionalNumber(snapshot.timelineZoom) ?? 1,
  };
}

function normalizeHistoryEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeWorldSpineHistoryEntry)
    .filter(Boolean);
}

function snapshotsAreEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value) {
  return JSON.stringify(value ?? null);
}

function cloneValue(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return value && typeof value === "object" ? { ...value } : value;
  }
}

function normalizeOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNullableString(value) {
  if (value === null) {
    return null;
  }
  return normalizeString(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}
