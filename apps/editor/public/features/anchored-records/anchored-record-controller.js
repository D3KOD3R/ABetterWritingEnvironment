// Intent: own anchored task/note composer state and record creation planning without shell persistence effects.
import {
  createManuscriptTask,
  createPassageNote,
} from "../../editor-model.js";
import { createOffsetAnchoredRecordEvidencePatch } from "../manuscript-anchors/manuscript-anchor-record-service.js";

export function buildTaskComposerFromContextMenu(menu, point = {}) {
  if (!menu) {
    return null;
  }

  return {
    ...menu,
    composerType: "task",
    x: (Number(point.x) || 0) + 10,
    y: Number(point.y) || 0,
  };
}

export function buildInlinePassageNoteDraftFromContextMenu(menu, noteType) {
  if (!menu || (noteType !== "inspiration" && noteType !== "research")) {
    return null;
  }

  const selectedText = menu.hasExplicitSelection ? String(menu.selectedText ?? "") : "";
  const anchorStartOffset = menu.hasExplicitSelection
    ? menu.startOffset
    : menu.insertionOffset;
  const anchorEndOffset = menu.hasExplicitSelection
    ? menu.endOffset
    : menu.insertionOffset;

  return {
    sceneId: menu.sceneId,
    noteType,
    selectedText,
    startOffset: anchorStartOffset,
    endOffset: anchorEndOffset,
    anchorStartOffset,
    seededSelection: Boolean(menu.hasExplicitSelection),
    typedStartOffset: null,
    typedEndOffset: null,
    body: "",
    typedText: selectedText,
    x: menu.inlinePosition?.x ?? 110,
    y: menu.inlinePosition?.y ?? 40,
  };
}

export function buildTaskFromComposer({
  composer,
  scene,
  body,
  taskNumber,
} = {}) {
  if (!composer || !scene) {
    return null;
  }

  const task = createManuscriptTask(scene, {
    body,
    taskNumber,
    selectedText: composer.selectedText,
    startOffset: composer.startOffset,
    endOffset: composer.endOffset,
  });

  return applyInitialAnchorEvidence(task, scene?.editorText);
}

export function buildPassageNoteFromComposer({
  composer,
  scene,
  body,
} = {}) {
  if (!composer || composer.composerType !== "passage-note" || !scene) {
    return null;
  }

  const note = createPassageNote(scene, {
    selectedText: composer.selectedText,
    startOffset: composer.startOffset,
    endOffset: composer.endOffset,
    body,
  }, composer.noteType);

  return applyInitialAnchorEvidence(note, scene?.editorText);
}

function applyInitialAnchorEvidence(record, text) {
  if (!record || typeof text !== "string") {
    return record;
  }

  return {
    ...record,
    ...createOffsetAnchoredRecordEvidencePatch({
      text,
      startOffset: record.startOffset,
      endOffset: record.endOffset,
    }),
  };
}

// Intent: prepare Local AI title requests without coupling anchored records to shell effects.
export function buildTaskTitleRequest(task, {
  projectContext = "",
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  if (!task) {
    return null;
  }

  return {
    userInput: task.body || task.description || "",
    manuscriptContext: buildAnchoredRecordManuscriptContext(task, { formatChapterTitle }),
    projectContext,
    maxTokens: 20,
  };
}

export function buildPassageNoteTitleRequest(note, {
  projectContext = "",
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  if (!note) {
    return null;
  }

  return {
    userInput: note.body || "",
    manuscriptContext: buildAnchoredRecordManuscriptContext(note, { formatChapterTitle }),
    projectContext,
    maxTokens: 20,
  };
}

export function canApplySuggestedRecordTitle(record, fallbackTitle) {
  return Boolean(record && record.title === fallbackTitle);
}

export function updateInlinePassageDraftTypingState(draft, previousText, nextText, {
  clampOffset = defaultClampOffset,
} = {}) {
  if (!draft) {
    return draft;
  }

  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  if (previous === next) {
    return draft;
  }

  const change = getTextChangeRange(previous, next);
  if (!change) {
    return draft;
  }

  const anchorStart = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : change.startOffset;
  const previousTypedStart = Number.isInteger(draft.typedStartOffset)
    ? draft.typedStartOffset
    : null;
  const previousTypedEnd = Number.isInteger(draft.typedEndOffset)
    ? draft.typedEndOffset
    : null;
  const delta = next.length - previous.length;

  let typedStart = previousTypedStart;
  let typedEnd = previousTypedEnd;

  if (typedStart === null || typedEnd === null || typedEnd <= typedStart) {
    if (change.endOffset <= change.startOffset || change.startOffset < anchorStart - 1) {
      return draft;
    }
    typedStart = change.startOffset;
    typedEnd = change.endOffset;
  } else if (change.startOffset <= typedEnd + 1) {
    typedStart = Math.min(typedStart, change.startOffset);
    typedEnd = Math.max(typedStart, typedEnd + delta, change.endOffset);
  } else {
    return draft;
  }

  return {
    ...draft,
    typedStartOffset: clampOffset(typedStart, next.length),
    typedEndOffset: clampOffset(typedEnd, next.length),
  };
}

export function planInlinePassageVerseInsertion(draft, verseText, editorText, {
  trimTextRange,
  clampOffset = defaultClampOffset,
} = {}) {
  if (!draft || typeof trimTextRange !== "function") {
    return null;
  }

  const content = String(editorText ?? "");
  const rawVerseText = String(verseText ?? "");
  const existingRange = getInlinePassageDraftExistingSelectionRange(draft, content, { clampOffset });
  const replacementStartOffset = existingRange?.startOffset
    ?? clampOffset(draft.anchorStartOffset, content.length);
  const replacementEndOffset = existingRange?.endOffset ?? replacementStartOffset;
  const nextEditorText = `${content.slice(0, replacementStartOffset)}${rawVerseText}${content.slice(replacementEndOffset)}`;
  const insertedEndOffset = replacementStartOffset + rawVerseText.length;
  const anchor = trimTextRange(nextEditorText, replacementStartOffset, insertedEndOffset, true);

  if (!anchor || !String(anchor.selectedText ?? "").trim()) {
    return null;
  }

  return {
    editorText: nextEditorText,
    previousText: content,
    anchor,
  };
}

export function getInlinePassageDraftExistingSelectionRange(draft, editorText, {
  clampOffset = defaultClampOffset,
} = {}) {
  if (!draft?.seededSelection) {
    return null;
  }

  const content = String(editorText ?? "");
  const startOffset = clampOffset(draft.startOffset, content.length);
  const endOffset = clampOffset(draft.endOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  return {
    startOffset,
    endOffset,
  };
}

export function getInlinePassageDraftPendingVerse(draft, {
  trimTextRange,
} = {}) {
  if (typeof trimTextRange !== "function") {
    return null;
  }

  const rawVerseText = String(draft?.typedText ?? "");
  if (!rawVerseText.trim()) {
    return null;
  }

  const range = trimTextRange(rawVerseText, 0, rawVerseText.length, true);
  if (!range || !String(range.selectedText ?? "").trim()) {
    return null;
  }

  const anchorStartOffset = Number.isInteger(draft.anchorStartOffset)
    ? draft.anchorStartOffset
    : 0;

  return {
    selectedText: range.selectedText,
    startOffset: anchorStartOffset + range.startOffset,
    endOffset: anchorStartOffset + range.endOffset,
  };
}

export function getInlinePassageDraftAnchor(draft, editorText, {
  includePendingVerse = false,
  trimTextRange,
  clampOffset = defaultClampOffset,
} = {}) {
  if (!draft || typeof trimTextRange !== "function") {
    return null;
  }

  if (includePendingVerse) {
    const pendingVerse = getInlinePassageDraftPendingVerse(draft, { trimTextRange });
    if (pendingVerse) {
      return pendingVerse;
    }
  }

  const content = String(editorText ?? "");
  const startOffset = clampOffset(draft.typedStartOffset, content.length);
  const endOffset = clampOffset(draft.typedEndOffset, content.length);
  if (endOffset <= startOffset) {
    return null;
  }

  const range = trimTextRange(content, startOffset, endOffset, true);
  if (!range || !String(range.selectedText ?? "").trim()) {
    return null;
  }

  return range;
}

export function selectOpenManuscriptTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => task?.status === "open");
}

export function selectPassageNotesByType(notes = [], noteType = "") {
  return (Array.isArray(notes) ? notes : []).filter((note) => note?.noteType === noteType);
}

export function getPassageNoteTypeLabel(noteType) {
  return noteType === "research" ? "Research" : "Inspiration";
}

// Intent: derive panel-ready anchored record groupings without taking over rendering effects.
export function buildTaskPanelModel(tasks = [], sceneChapters = []) {
  const openTasks = selectOpenManuscriptTasks(tasks);
  return {
    taskCount: openTasks.length,
    groups: buildTaskChapterGroups(openTasks, sceneChapters),
  };
}

export function buildPassageNotePanelModel(notes = [], noteType = "", sceneChapters = []) {
  const filteredNotes = selectPassageNotesByType(notes, noteType);
  return {
    noteType,
    label: getPassageNoteTypeLabel(noteType),
    noteCount: filteredNotes.length,
    groups: groupAnchoredRecordsByChapter(filteredNotes, sceneChapters),
  };
}

export function buildTaskChapterGroups(tasks = [], sceneChapters = []) {
  const openTasks = selectOpenManuscriptTasks(tasks);
  return (Array.isArray(sceneChapters) ? sceneChapters : [])
    .map((chapter) => ({
      ...chapter,
      tasks: openTasks.filter((task) => task.chapterId === chapter.chapterId),
    }))
    .filter((chapter) => chapter.tasks.length > 0);
}

export function groupAnchoredRecordsByChapter(items = [], sceneChapters = []) {
  const groupsByKey = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const chapterId = typeof item.chapterId === "string" && item.chapterId.trim()
      ? item.chapterId.trim()
      : "";
    const chapterKey = chapterId || createAnchoredRecordChapterKey(item.chapterTitle);
    if (!groupsByKey.has(chapterKey)) {
      groupsByKey.set(chapterKey, {
        chapterKey,
        chapterId: chapterId || chapterKey,
        chapterTitle: item.chapterTitle || "Unknown chapter",
        items: [],
      });
    }

    groupsByKey.get(chapterKey).items.push(item);
  }

  const orderedGroups = [];
  for (const chapter of Array.isArray(sceneChapters) ? sceneChapters : []) {
    const chapterKey = chapter.chapterId;
    const group = groupsByKey.get(chapterKey);
    if (group) {
      orderedGroups.push({
        ...group,
        chapterTitle: chapter.chapterTitle || group.chapterTitle,
      });
      groupsByKey.delete(chapterKey);
    }
  }

  for (const group of groupsByKey.values()) {
    orderedGroups.push(group);
  }

  return orderedGroups;
}

export function createAnchoredRecordChapterKey(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return normalized ? `chapter-${normalized}` : "chapter-unknown";
}

export function getTextChangeRange(previousText, nextText) {
  const previous = String(previousText ?? "");
  const next = String(nextText ?? "");
  let prefixLength = 0;
  const shortestLength = Math.min(previous.length, next.length);

  while (
    prefixLength < shortestLength &&
    previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - prefixLength &&
    suffixLength < next.length - prefixLength &&
    previous[previous.length - 1 - suffixLength] === next[next.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const endOffset = next.length - suffixLength;
  return endOffset >= prefixLength
    ? {
        startOffset: prefixLength,
        endOffset,
      }
    : null;
}

function defaultClampOffset(offset, textLength) {
  const safeLength = Math.max(0, Number(textLength) || 0);
  const safeOffset = Number(offset);
  return Number.isFinite(safeOffset) ? Math.max(0, Math.min(Math.floor(safeOffset), safeLength)) : 0;
}

function buildAnchoredRecordManuscriptContext(record, {
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  return [
    `Chapter: ${formatChapterTitle(record.chapterTitle)}`,
    `Scene: ${record.sceneTitle ?? ""}`,
    `Referenced manuscript text:\n${record.selectedText ?? ""}`,
  ].join("\n");
}

function defaultFormatChapterTitle(chapterTitle) {
  const normalized = String(chapterTitle ?? "").trim();
  return normalized || "Untitled chapter";
}
