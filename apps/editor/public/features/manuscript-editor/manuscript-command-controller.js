// Intent: own manuscript editor commands so toolbar, shortcut, and menu actions share selection-aware behavior.

export const INLINE_FORMATS = Object.freeze({
  bold: Object.freeze({
    id: "bold",
    label: "Bold",
  }),
  italic: Object.freeze({
    id: "italic",
    label: "Italic",
  }),
  underline: Object.freeze({
    id: "underline",
    label: "Underline",
  }),
  strikethrough: Object.freeze({
    id: "strikethrough",
    label: "Strikethrough",
  }),
  highlight: Object.freeze({
    id: "highlight",
    label: "Highlight",
  }),
});

export function createDefaultManuscriptInlineFormattingState() {
  return {
    pendingFormats: {},
    lastCommand: null,
  };
}

export function normalizeManuscriptInlineFormattingState(candidate) {
  const pendingFormats = {};
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate.pendingFormats
    : null;

  if (source && typeof source === "object" && !Array.isArray(source)) {
    for (const formatId of Object.keys(INLINE_FORMATS)) {
      pendingFormats[formatId] = source[formatId] === true;
    }
  }

  return {
    pendingFormats,
    lastCommand: typeof candidate?.lastCommand === "string" ? candidate.lastCommand : null,
  };
}

export function createManuscriptCommandController({
  getInlineFormattingState,
  setInlineFormattingState,
  resolveSelection,
  applyTextMutation,
  applyRangeMutation,
  log,
} = {}) {
  return {
    execute(command, payload = {}) {
      if (command !== "toggleInlineFormat") {
        return {
          applied: false,
          reason: "unsupported-command",
        };
      }

      return executeToggleInlineFormat({
        formatId: payload.format,
        getInlineFormattingState,
        setInlineFormattingState,
        resolveSelection,
        applyTextMutation,
        applyRangeMutation,
        log,
      });
    },
  };
}

// Intent: keep all inline formatting controls on one span metadata mutation path.
export function executeToggleInlineFormat({
  formatId,
  getInlineFormattingState,
  setInlineFormattingState,
  resolveSelection,
  applyTextMutation,
  applyRangeMutation,
  log,
} = {}) {
  const format = INLINE_FORMATS[formatId];
  if (!format) {
    return {
      applied: false,
      reason: "unsupported-format",
    };
  }

  const selection = typeof resolveSelection === "function" ? resolveSelection() : null;
  if (!selection || typeof selection.text !== "string") {
    return {
      applied: false,
      reason: "missing-selection",
    };
  }

  const state = normalizeManuscriptInlineFormattingState(
    typeof getInlineFormattingState === "function" ? getInlineFormattingState() : null,
  );
  const mutation = selection.collapsed
    ? createCollapsedInlineFormatMutation(selection, format, state)
    : createSelectedInlineFormatMutation(selection, format);

  if (!mutation) {
    return {
      applied: false,
      reason: "no-mutation",
    };
  }

  if (mutation.textMutation && typeof applyTextMutation === "function") {
    applyTextMutation(mutation);
  }

  if (Array.isArray(mutation.ranges) && typeof applyRangeMutation === "function") {
    applyRangeMutation(mutation.ranges, mutation);
  }

  const nextState = normalizeManuscriptInlineFormattingState({
    ...state,
    pendingFormats: {
      ...state.pendingFormats,
      [format.id]: mutation.pending === true,
    },
    lastCommand: `toggleInlineFormat:${format.id}`,
  });

  if (typeof setInlineFormattingState === "function") {
    setInlineFormattingState(nextState);
  }

  logInlineFormatCommand(log, mutation, format, selection);

  return {
    applied: true,
    format: format.id,
    mutation,
    state: nextState,
  };
}

export function resolveTextareaManuscriptSelection(textarea, formatRanges = []) {
  if (!isEditableManuscriptTextarea(textarea)) {
    return null;
  }

  const selectionStart = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0;
  const selectionEnd = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : selectionStart;
  const startOffset = Math.max(0, Math.min(selectionStart, selectionEnd));
  const endOffset = Math.max(startOffset, Math.max(selectionStart, selectionEnd));
  const text = String(textarea.value ?? "");

  return {
    sceneId: typeof textarea.dataset.sceneId === "string" ? textarea.dataset.sceneId : "",
    text,
    formatRanges: normalizeInlineFormatRanges(formatRanges, text.length),
    startOffset: Math.min(startOffset, text.length),
    endOffset: Math.min(endOffset, text.length),
    collapsed: startOffset === endOffset,
  };
}

export function applyTextareaTextMutation(textarea, mutation) {
  if (!isEditableManuscriptTextarea(textarea) || !mutation?.textMutation) {
    return false;
  }

  textarea.setRangeText(
    mutation.replacement,
    mutation.replaceStart,
    mutation.replaceEnd,
    "preserve",
  );
  textarea.setSelectionRange(mutation.selectionStart, mutation.selectionEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
  return true;
}

export function isInlineFormatActiveAtOffset(rangesOrText, offset, formatId) {
  const format = INLINE_FORMATS[formatId];
  if (!format) {
    return false;
  }

  const ranges = normalizeInlineFormatRanges(Array.isArray(rangesOrText) ? rangesOrText : []);
  const safeOffset = Math.max(0, Number.isInteger(offset) ? offset : 0);
  return ranges.some((range) => range.formatId === format.id && range.startOffset <= safeOffset && range.endOffset > safeOffset);
}

export function normalizeInlineFormatRanges(candidate, textLength = Number.POSITIVE_INFINITY) {
  const safeTextLength = Number.isFinite(textLength) ? Math.max(0, Math.floor(textLength)) : Number.POSITIVE_INFINITY;
  const ranges = Array.isArray(candidate) ? candidate : [];
  return ranges
    .map((range) => {
      const formatId = typeof range?.formatId === "string" ? range.formatId : "";
      if (!INLINE_FORMATS[formatId]) {
        return null;
      }

      const startOffset = clampOffset(range.startOffset, safeTextLength);
      const endOffset = clampOffset(range.endOffset, safeTextLength);
      if (endOffset <= startOffset) {
        return null;
      }

      return {
        id: typeof range.id === "string" && range.id ? range.id : createInlineFormatRangeId(formatId, startOffset, endOffset),
        formatId,
        startOffset,
        endOffset,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset || left.formatId.localeCompare(right.formatId));
}

export function toggleInlineFormatRange(ranges, selection, formatId) {
  const format = INLINE_FORMATS[formatId];
  if (!format || !selection || selection.collapsed) {
    return normalizeInlineFormatRanges(ranges, selection?.text?.length ?? Number.POSITIVE_INFINITY);
  }

  const textLength = typeof selection.text === "string" ? selection.text.length : Number.POSITIVE_INFINITY;
  const startOffset = clampOffset(selection.startOffset, textLength);
  const endOffset = clampOffset(selection.endOffset, textLength);
  if (endOffset <= startOffset) {
    return normalizeInlineFormatRanges(ranges, textLength);
  }

  const normalizedRanges = normalizeInlineFormatRanges(ranges, textLength);
  const fullyCovered = isRangeFullyCoveredByFormat(normalizedRanges, startOffset, endOffset, format.id);
  const withoutSelectionOverlap = subtractFormatRange(normalizedRanges, startOffset, endOffset, format.id);
  if (fullyCovered) {
    return withoutSelectionOverlap;
  }

  return mergeInlineFormatRanges([
    ...withoutSelectionOverlap,
    {
      id: createInlineFormatRangeId(format.id, startOffset, endOffset),
      formatId: format.id,
      startOffset,
      endOffset,
    },
  ], textLength);
}

export function updateInlineFormatRangesForTextEdit({
  ranges,
  previousText,
  nextText,
  pendingFormats,
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const oldText = String(previousText ?? "");
  const newText = String(nextText ?? "");
  const normalizedRanges = normalizeInlineFormatRanges(ranges, oldText.length);
  const edit = resolveTextEditSpan(oldText, newText, {
    selectionStart,
    selectionEnd,
  });
  if (!edit) {
    return normalizeInlineFormatRanges(normalizedRanges, newText.length);
  }

  const removedLength = edit.oldEndOffset - edit.startOffset;
  const delta = edit.insertedLength - removedLength;
  const pending = pendingFormats && typeof pendingFormats === "object" ? pendingFormats : {};
  const shiftedRanges = [];
  for (const range of normalizedRanges) {
    if (range.endOffset <= edit.startOffset) {
      shiftedRanges.push(range);
      continue;
    }

    if (range.startOffset >= edit.oldEndOffset) {
      shiftedRanges.push({
        ...range,
        startOffset: range.startOffset + delta,
        endOffset: range.endOffset + delta,
      });
      continue;
    }

    const isPureInsertionInsideRange =
      removedLength === 0 &&
      edit.insertedLength > 0 &&
      range.startOffset < edit.startOffset &&
      range.endOffset > edit.startOffset;
    if (isPureInsertionInsideRange && pending[range.formatId] !== true) {
      const beforeEnd = edit.startOffset;
      const afterStart = edit.startOffset + edit.insertedLength;
      const afterEnd = range.endOffset + delta;
      if (beforeEnd > range.startOffset) {
        shiftedRanges.push({
          ...range,
          id: createInlineFormatRangeId(range.formatId, range.startOffset, beforeEnd),
          endOffset: beforeEnd,
        });
      }
      if (afterEnd > afterStart) {
        shiftedRanges.push({
          ...range,
          id: createInlineFormatRangeId(range.formatId, afterStart, afterEnd),
          startOffset: afterStart,
          endOffset: afterEnd,
        });
      }
      continue;
    }

    const nextStart = Math.min(range.startOffset, edit.startOffset);
    const nextEnd = Math.max(nextStart, range.endOffset + delta);
    if (nextEnd > nextStart) {
      shiftedRanges.push({
        ...range,
        startOffset: nextStart,
        endOffset: nextEnd,
      });
    }
  }

  if (edit.insertedLength > 0) {
    for (const formatId of Object.keys(INLINE_FORMATS)) {
      if (pending[formatId] !== true) {
        continue;
      }

      shiftedRanges.push({
        id: createInlineFormatRangeId(formatId, edit.startOffset, edit.startOffset + edit.insertedLength),
        formatId,
        startOffset: edit.startOffset,
        endOffset: edit.startOffset + edit.insertedLength,
      });
    }
  }

  return mergeInlineFormatRanges(shiftedRanges, newText.length);
}

function createSelectedInlineFormatMutation(selection, format) {
  const selectedText = selection.text.slice(selection.startOffset, selection.endOffset);
  if (!selectedText) {
    return null;
  }

  return {
    kind: "toggle-format-range",
    ranges: toggleInlineFormatRange(selection.formatRanges, selection, format.id),
    selectionStart: selection.startOffset,
    selectionEnd: selection.endOffset,
    pending: false,
  };
}

function createCollapsedInlineFormatMutation(selection, format, state) {
  const pending = state.pendingFormats?.[format.id] === true;
  return {
    kind: pending ? "stop-pending-format" : "start-pending-format",
    selectionStart: selection.startOffset,
    selectionEnd: selection.startOffset,
    pending: !pending,
  };
}

function isEditableManuscriptTextarea(textarea) {
  return Boolean(
    textarea instanceof HTMLTextAreaElement &&
    textarea.classList.contains("editor-document-input") &&
    textarea.disabled !== true &&
    textarea.readOnly !== true,
  );
}

function isRangeFullyCoveredByFormat(ranges, startOffset, endOffset, formatId) {
  let cursor = startOffset;
  for (const range of ranges.filter((candidate) => candidate.formatId === formatId && candidate.endOffset > startOffset && candidate.startOffset < endOffset)) {
    if (range.startOffset > cursor) {
      return false;
    }
    cursor = Math.max(cursor, range.endOffset);
    if (cursor >= endOffset) {
      return true;
    }
  }
  return false;
}

function subtractFormatRange(ranges, startOffset, endOffset, formatId) {
  const nextRanges = [];
  for (const range of ranges) {
    if (range.formatId !== formatId || range.endOffset <= startOffset || range.startOffset >= endOffset) {
      nextRanges.push(range);
      continue;
    }

    if (range.startOffset < startOffset) {
      nextRanges.push({
        ...range,
        endOffset: startOffset,
      });
    }

    if (range.endOffset > endOffset) {
      nextRanges.push({
        ...range,
        id: createInlineFormatRangeId(range.formatId, endOffset, range.endOffset),
        startOffset: endOffset,
      });
    }
  }
  return mergeInlineFormatRanges(nextRanges);
}

function mergeInlineFormatRanges(ranges, textLength = Number.POSITIVE_INFINITY) {
  const normalizedRanges = normalizeInlineFormatRanges(ranges, textLength);
  const merged = [];
  for (const range of normalizedRanges) {
    const previous = merged[merged.length - 1];
    if (previous && previous.formatId === range.formatId && previous.endOffset >= range.startOffset) {
      previous.endOffset = Math.max(previous.endOffset, range.endOffset);
      previous.id = createInlineFormatRangeId(previous.formatId, previous.startOffset, previous.endOffset);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function resolveTextEditSpan(previousText, nextText, {
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  if (previousText === nextText) {
    return null;
  }

  const caretResolvedInsertion = resolveCaretAnchoredInsertion(previousText, nextText, {
    selectionStart,
    selectionEnd,
  });
  if (caretResolvedInsertion) {
    return caretResolvedInsertion;
  }

  let startOffset = 0;
  while (
    startOffset < previousText.length &&
    startOffset < nextText.length &&
    previousText[startOffset] === nextText[startOffset]
  ) {
    startOffset += 1;
  }

  let previousEndOffset = previousText.length;
  let nextEndOffset = nextText.length;
  while (
    previousEndOffset > startOffset &&
    nextEndOffset > startOffset &&
    previousText[previousEndOffset - 1] === nextText[nextEndOffset - 1]
  ) {
    previousEndOffset -= 1;
    nextEndOffset -= 1;
  }

  return {
    startOffset,
    oldEndOffset: previousEndOffset,
    insertedLength: nextEndOffset - startOffset,
  };
}

// Intent: use the browser's post-input caret to disambiguate inserted text when adjacent content repeats.
function resolveCaretAnchoredInsertion(previousText, nextText, {
  selectionStart = null,
  selectionEnd = null,
} = {}) {
  const oldText = String(previousText ?? "");
  const newText = String(nextText ?? "");
  const insertedLength = newText.length - oldText.length;
  if (insertedLength <= 0) {
    return null;
  }

  const caretStart = Number(selectionStart);
  const caretEnd = Number(selectionEnd);
  if (!Number.isInteger(caretStart) || !Number.isInteger(caretEnd) || caretStart !== caretEnd) {
    return null;
  }

  const nextCaretOffset = clampOffset(caretStart, newText.length);
  const startOffset = nextCaretOffset - insertedLength;
  if (startOffset < 0 || startOffset > oldText.length) {
    return null;
  }

  const insertedText = newText.slice(startOffset, nextCaretOffset);
  const reconstructedText = `${oldText.slice(0, startOffset)}${insertedText}${oldText.slice(startOffset)}`;
  if (reconstructedText !== newText) {
    return null;
  }

  return {
    startOffset,
    oldEndOffset: startOffset,
    insertedLength,
  };
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.max(0, Math.min(safeNumber, textLength));
}

function createInlineFormatRangeId(formatId, startOffset, endOffset) {
  return `inline-${formatId}-${startOffset}-${endOffset}`;
}

function logInlineFormatCommand(log, mutation, format, selection) {
  if (!log || typeof log.info !== "function") {
    return;
  }

  log.info("user-action", "manuscript.inline-format.toggle", "Applied manuscript inline formatting command.", {
    format: format.id,
    mutationKind: mutation.kind,
    sceneId: selection.sceneId,
    startOffset: selection.startOffset,
    endOffset: selection.endOffset,
    collapsed: selection.collapsed,
  });
}
