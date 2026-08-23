// Intent: own bounded undo/redo state for app-owned manuscript mark decorations outside the editor shell.

export const MANUSCRIPT_MARK_HISTORY_LIMIT = 20;

export function createManuscriptMarkHistoryState(candidate = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};

  return {
    undoStack: normalizeManuscriptMarkHistoryStack(source.undoStack),
    redoStack: normalizeManuscriptMarkHistoryStack(source.redoStack),
  };
}

// Intent: snapshot only the project-level mark data and scene compatibility ranges that affect decoration rendering.
export function createManuscriptMarkHistorySnapshot(candidate = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};

  return {
    marks: cloneArray(source.marks),
    sequences: cloneObject(source.sequences),
    inlineFormatRanges: cloneArray(source.inlineFormatRanges),
  };
}

export function createManuscriptMarkHistoryEntry({
  sceneId = "",
  formatId = "",
  beforeSnapshot = null,
  afterSnapshot = null,
  selection = null,
  createdAt = "",
} = {}) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const normalizedFormatId = String(formatId ?? "").trim();
  if (!normalizedSceneId || !normalizedFormatId) {
    return null;
  }

  return {
    sceneId: normalizedSceneId,
    formatId: normalizedFormatId,
    beforeSnapshot: createManuscriptMarkHistorySnapshot(beforeSnapshot),
    afterSnapshot: createManuscriptMarkHistorySnapshot(afterSnapshot),
    selection: normalizeSelection(selection),
    createdAt: typeof createdAt === "string" ? createdAt : "",
  };
}

// Intent: record app-owned decoration mutations and invalidate redo state like standard editor history.
export function pushManuscriptMarkHistoryEntry(history, entry, {
  limit = MANUSCRIPT_MARK_HISTORY_LIMIT,
} = {}) {
  const normalizedHistory = createManuscriptMarkHistoryState(history);
  const normalizedEntry = createManuscriptMarkHistoryEntry(entry);
  if (!normalizedEntry || !hasSnapshotChange(normalizedEntry)) {
    return normalizedHistory;
  }

  const maxLength = normalizeHistoryLimit(limit);
  return {
    undoStack: [...normalizedHistory.undoStack, normalizedEntry].slice(-maxLength),
    redoStack: [],
  };
}

export function popManuscriptMarkHistoryUndo(history, {
  limit = MANUSCRIPT_MARK_HISTORY_LIMIT,
} = {}) {
  const normalizedHistory = createManuscriptMarkHistoryState(history);
  const undoStack = [...normalizedHistory.undoStack];
  const entry = undoStack.pop();
  if (!entry) {
    return {
      handled: false,
      entry: null,
      snapshot: null,
      history: normalizedHistory,
    };
  }

  const maxLength = normalizeHistoryLimit(limit);
  return {
    handled: true,
    direction: "undo",
    entry,
    snapshot: createManuscriptMarkHistorySnapshot(entry.beforeSnapshot),
    history: {
      undoStack,
      redoStack: [...normalizedHistory.redoStack, entry].slice(-maxLength),
    },
  };
}

export function popManuscriptMarkHistoryRedo(history, {
  limit = MANUSCRIPT_MARK_HISTORY_LIMIT,
} = {}) {
  const normalizedHistory = createManuscriptMarkHistoryState(history);
  const redoStack = [...normalizedHistory.redoStack];
  const entry = redoStack.pop();
  if (!entry) {
    return {
      handled: false,
      entry: null,
      snapshot: null,
      history: normalizedHistory,
    };
  }

  const maxLength = normalizeHistoryLimit(limit);
  return {
    handled: true,
    direction: "redo",
    entry,
    snapshot: createManuscriptMarkHistorySnapshot(entry.afterSnapshot),
    history: {
      undoStack: [...normalizedHistory.undoStack, entry].slice(-maxLength),
      redoStack,
    },
  };
}

function normalizeManuscriptMarkHistoryStack(candidate = []) {
  return (Array.isArray(candidate) ? candidate : [])
    .map((entry) => createManuscriptMarkHistoryEntry(entry))
    .filter(Boolean);
}

function hasSnapshotChange(entry) {
  return JSON.stringify(entry.beforeSnapshot) !== JSON.stringify(entry.afterSnapshot);
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const startOffset = normalizeOffset(selection.startOffset);
  const endOffset = normalizeOffset(selection.endOffset);
  return {
    startOffset: Math.min(startOffset, endOffset),
    endOffset: Math.max(startOffset, endOffset),
  };
}

function normalizeOffset(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeHistoryLimit(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.floor(number))
    : MANUSCRIPT_MARK_HISTORY_LIMIT;
}

function cloneArray(value) {
  return Array.isArray(value) ? cloneJsonValue(value) : [];
}

function cloneObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? cloneJsonValue(value)
    : {};
}

function cloneJsonValue(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}
