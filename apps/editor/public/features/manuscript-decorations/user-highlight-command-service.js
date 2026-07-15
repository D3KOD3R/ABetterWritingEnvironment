// Intent: own user-highlight command selection policy outside the editor shell.

export const USER_HIGHLIGHT_COMMAND_MODE = Object.freeze({
  SELECTION: "selection",
  PENDING: "pending",
});

// Intent: expose the same command policy for author mark buttons that share highlight behavior.
export const USER_MARK_COMMAND_MODE = USER_HIGHLIGHT_COMMAND_MODE;

// Intent: split highlight commands into range mutations or caret switch toggles before shell side effects run.
export function resolveUserHighlightCommandIntent({
  liveSelection = null,
  cachedSelection = null,
  sceneId = "",
  text = "",
  formatRanges = [],
  preferPendingToggle = false,
} = {}) {
  const pendingSelection = resolveUserHighlightPendingSelection({
    liveSelection,
    cachedSelection,
    sceneId,
    text,
    formatRanges,
    allowSelectedRangeAsCaret: preferPendingToggle,
  });
  if (preferPendingToggle && pendingSelection) {
    return {
      mode: USER_HIGHLIGHT_COMMAND_MODE.PENDING,
      selection: pendingSelection,
    };
  }

  const selection = resolveUserHighlightCommandSelection({
    liveSelection,
    cachedSelection,
    sceneId,
    text,
    formatRanges,
  });
  if (selection) {
    return {
      mode: USER_HIGHLIGHT_COMMAND_MODE.SELECTION,
      selection,
    };
  }

  if (pendingSelection) {
    return {
      mode: USER_HIGHLIGHT_COMMAND_MODE.PENDING,
      selection: pendingSelection,
    };
  }

  return null;
}

// Intent: prefer the live textarea selection, then recover the last manuscript selection captured before toolbar focus changes.
export function resolveUserHighlightCommandSelection({
  liveSelection = null,
  cachedSelection = null,
  sceneId = "",
  text = "",
  formatRanges = [],
} = {}) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const normalizedText = String(text ?? "");
  const normalizedFormatRanges = Array.isArray(formatRanges) ? formatRanges : [];
  const live = normalizeUserHighlightSelection(liveSelection, {
    sceneId: normalizedSceneId,
    text: normalizedText,
    formatRanges: normalizedFormatRanges,
    requireSceneMatch: false,
    selectionSource: "live",
  });
  if (live) {
    return live;
  }

  return normalizeUserHighlightSelection(cachedSelection, {
    sceneId: normalizedSceneId,
    text: normalizedText,
    formatRanges: normalizedFormatRanges,
    requireSceneMatch: true,
    selectionSource: "cached",
  });
}

// Intent: keep the selection resolver reusable for toolbar author-mark commands.
export const resolveUserMarkCommandIntent = resolveUserHighlightCommandIntent;
export const resolveUserMarkCommandSelection = resolveUserHighlightCommandSelection;

// Intent: resolve caret-based highlight switch commands independently from selected-range commands.
export function resolveUserHighlightPendingSelection({
  liveSelection = null,
  cachedSelection = null,
  sceneId = "",
  text = "",
  formatRanges = [],
  allowSelectedRangeAsCaret = false,
} = {}) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const normalizedText = String(text ?? "");
  const normalizedFormatRanges = Array.isArray(formatRanges) ? formatRanges : [];
  const liveCaret = normalizeUserHighlightCaret(liveSelection, {
    sceneId: normalizedSceneId,
    text: normalizedText,
    formatRanges: normalizedFormatRanges,
    requireSceneMatch: false,
    selectionSource: "live",
    allowSelectedRangeAsCaret,
  });
  if (liveCaret) {
    return liveCaret;
  }

  return normalizeUserHighlightCaret(cachedSelection, {
    sceneId: normalizedSceneId,
    text: normalizedText,
    formatRanges: normalizedFormatRanges,
    requireSceneMatch: true,
    selectionSource: "cached",
    allowSelectedRangeAsCaret,
  });
}

function normalizeUserHighlightSelection(selection, {
  sceneId = "",
  text = "",
  formatRanges = [],
  requireSceneMatch = false,
  selectionSource = "live",
} = {}) {
  if (!selection || typeof selection !== "object" || selection.collapsed === true) {
    return null;
  }

  const normalizedSceneId = String(sceneId ?? "").trim();
  const selectionSceneId = typeof selection.sceneId === "string" ? selection.sceneId.trim() : "";
  if (requireSceneMatch && (!selectionSceneId || selectionSceneId !== normalizedSceneId)) {
    return null;
  }

  const normalizedText = String(text ?? selection.text ?? "");
  const startOffset = clampSelectionOffset(selection.startOffset, normalizedText.length);
  const endOffset = clampSelectionOffset(selection.endOffset, normalizedText.length);
  const start = Math.min(startOffset, endOffset);
  const end = Math.max(startOffset, endOffset);
  if (end <= start) {
    return null;
  }

  return {
    sceneId: selectionSceneId || normalizedSceneId,
    text: normalizedText,
    formatRanges,
    startOffset: start,
    endOffset: end,
    collapsed: false,
    selectionSource,
  };
}

function normalizeUserHighlightCaret(selection, {
  sceneId = "",
  text = "",
  formatRanges = [],
  requireSceneMatch = false,
  selectionSource = "live",
  allowSelectedRangeAsCaret = false,
} = {}) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const normalizedSceneId = String(sceneId ?? "").trim();
  const selectionSceneId = typeof selection.sceneId === "string" ? selection.sceneId.trim() : "";
  if (requireSceneMatch && (!selectionSceneId || selectionSceneId !== normalizedSceneId)) {
    return null;
  }

  const normalizedText = String(text ?? selection.text ?? "");
  const startOffset = clampSelectionOffset(selection.startOffset, normalizedText.length);
  const endOffset = clampSelectionOffset(selection.endOffset, normalizedText.length);
  if (startOffset !== endOffset && selection.collapsed !== true && allowSelectedRangeAsCaret !== true) {
    return null;
  }

  const caretOffset = Math.min(startOffset, endOffset);
  return {
    sceneId: selectionSceneId || normalizedSceneId,
    text: normalizedText,
    formatRanges,
    startOffset: caretOffset,
    endOffset: caretOffset,
    collapsed: true,
    selectionSource,
  };
}

function clampSelectionOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, Math.max(0, Number(textLength) || 0)));
}
