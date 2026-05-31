// Intent: verify anchored task/note creation planning stays outside the app shell.
import assert from "node:assert/strict";

import {
  buildInlinePassageNoteDraftFromContextMenu,
  buildPassageNoteFromComposer,
  buildPassageNotePanelModel,
  buildPassageNoteTitleRequest,
  buildTaskComposerFromContextMenu,
  buildTaskFromComposer,
  buildTaskChapterGroups,
  buildTaskPanelModel,
  buildTaskTitleRequest,
  canApplySuggestedRecordTitle,
  createAnchoredRecordChapterKey,
  getInlinePassageDraftAnchor,
  getTextChangeRange,
  groupAnchoredRecordsByChapter,
  planInlinePassageVerseInsertion,
  selectOpenManuscriptTasks,
  selectPassageNotesByType,
  updateInlinePassageDraftTypingState,
} from "../apps/editor/public/features/anchored-records/anchored-record-controller.js";

export function runAnchoredRecordControllerTest() {
  const menu = {
    sceneId: "scene-1",
    selectedText: "selected passage",
    startOffset: 4,
    endOffset: 20,
    insertionOffset: 20,
    hasExplicitSelection: true,
    inlinePosition: { x: 130, y: 50 },
  };

  assert.deepEqual(buildTaskComposerFromContextMenu(menu, { x: 40, y: 80 }), {
    ...menu,
    composerType: "task",
    x: 50,
    y: 80,
  });

  assert.deepEqual(buildInlinePassageNoteDraftFromContextMenu(menu, "research"), {
    sceneId: "scene-1",
    noteType: "research",
    selectedText: "selected passage",
    startOffset: 4,
    endOffset: 20,
    anchorStartOffset: 4,
    seededSelection: true,
    typedStartOffset: null,
    typedEndOffset: null,
    body: "",
    typedText: "selected passage",
    x: 130,
    y: 50,
  });

  const scene = {
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    sceneId: "scene-1",
    sceneTitle: "Arrival",
  };
  const composer = {
    composerType: "passage-note",
    noteType: "inspiration",
    selectedText: "selected passage",
    startOffset: 4,
    endOffset: 20,
  };

  const task = buildTaskFromComposer({
    composer,
    scene,
    body: "Fix this beat",
    taskNumber: 3,
  });
  assert.equal(task.sceneId, "scene-1");
  assert.equal(task.taskNumber, 3);
  assert.equal(task.body, "Fix this beat");

  const note = buildPassageNoteFromComposer({
    composer,
    scene,
    body: "This inspires a later reveal",
  });
  assert.equal(note.noteType, "inspiration");
  assert.equal(note.selectedText, "selected passage");
  assert.equal(note.body, "This inspires a later reveal");

  assert.deepEqual(buildTaskTitleRequest(task, {
    projectContext: "Demo Project",
    formatChapterTitle: (title) => `Formatted ${title}`,
  }), {
    userInput: "Fix this beat",
    manuscriptContext: [
      "Chapter: Formatted Chapter One",
      "Scene: Arrival",
      "Referenced manuscript text:\nselected passage",
    ].join("\n"),
    projectContext: "Demo Project",
    maxTokens: 20,
  });

  assert.deepEqual(buildPassageNoteTitleRequest(note, {
    projectContext: "Demo Project",
    formatChapterTitle: (title) => `Formatted ${title}`,
  }), {
    userInput: "This inspires a later reveal",
    manuscriptContext: [
      "Chapter: Formatted Chapter One",
      "Scene: Arrival",
      "Referenced manuscript text:\nselected passage",
    ].join("\n"),
    projectContext: "Demo Project",
    maxTokens: 20,
  });
  assert.equal(canApplySuggestedRecordTitle({ title: task.title }, task.title), true);
  assert.equal(canApplySuggestedRecordTitle({ title: "User renamed it" }, task.title), false);
  assert.equal(canApplySuggestedRecordTitle(null, task.title), false);

  assert.deepEqual(getTextChangeRange("alpha omega", "alpha bright omega"), {
    startOffset: 6,
    endOffset: 13,
  });

  const draft = {
    sceneId: "scene-1",
    anchorStartOffset: 6,
    typedStartOffset: null,
    typedEndOffset: null,
  };
  const nextDraft = updateInlinePassageDraftTypingState(
    draft,
    "alpha omega",
    "alpha bright omega",
  );
  assert.equal(nextDraft.typedStartOffset, 6);
  assert.equal(nextDraft.typedEndOffset, 13);

  const extendedDraft = updateInlinePassageDraftTypingState(
    nextDraft,
    "alpha bright omega",
    "alpha brighter omega",
  );
  assert.equal(extendedDraft.typedStartOffset, 6);
  assert.equal(extendedDraft.typedEndOffset, 15);

  const chapters = [
    { chapterId: "chapter-1", chapterTitle: "Chapter One" },
    { chapterId: "chapter-2", chapterTitle: "Chapter Two" },
  ];
  const tasks = [
    { id: "task-1", status: "open", chapterId: "chapter-2" },
    { id: "task-2", status: "done", chapterId: "chapter-1" },
    { id: "task-3", status: "open", chapterId: "chapter-1" },
  ];
  assert.deepEqual(selectOpenManuscriptTasks(tasks).map((item) => item.id), ["task-1", "task-3"]);
  assert.deepEqual(buildTaskChapterGroups(tasks, chapters).map((group) => group.chapterId), ["chapter-1", "chapter-2"]);
  assert.deepEqual(buildTaskPanelModel(tasks, chapters), {
    taskCount: 2,
    groups: [
      { chapterId: "chapter-1", chapterTitle: "Chapter One", tasks: [{ id: "task-3", status: "open", chapterId: "chapter-1" }] },
      { chapterId: "chapter-2", chapterTitle: "Chapter Two", tasks: [{ id: "task-1", status: "open", chapterId: "chapter-2" }] },
    ],
  });

  const notes = [
    { id: "note-1", noteType: "research", chapterId: "chapter-2", chapterTitle: "Two" },
    { id: "note-2", noteType: "inspiration", chapterTitle: "Loose Notes" },
  ];
  assert.deepEqual(selectPassageNotesByType(notes, "research").map((item) => item.id), ["note-1"]);
  assert.deepEqual(buildPassageNotePanelModel(notes, "research", chapters), {
    noteType: "research",
    label: "Research",
    noteCount: 1,
    groups: [{
      chapterKey: "chapter-2",
      chapterId: "chapter-2",
      chapterTitle: "Chapter Two",
      items: [{ id: "note-1", noteType: "research", chapterId: "chapter-2", chapterTitle: "Two" }],
    }],
  });
  assert.equal(createAnchoredRecordChapterKey("Loose Notes"), "chapter-loose-notes");
  assert.deepEqual(
    groupAnchoredRecordsByChapter(notes, chapters).map((group) => group.chapterKey),
    ["chapter-2", "chapter-loose-notes"],
  );

  const trimTextRange = (value, startOffset, endOffset) => {
    const selectedText = String(value).slice(startOffset, endOffset).trim();
    const leadingWhitespace = String(value).slice(startOffset, endOffset).search(/\S/);
    const safeLeading = leadingWhitespace < 0 ? 0 : leadingWhitespace;
    return {
      selectedText,
      startOffset: startOffset + safeLeading,
      endOffset: startOffset + safeLeading + selectedText.length,
    };
  };
  const insertion = planInlinePassageVerseInsertion({
    anchorStartOffset: 6,
    seededSelection: false,
  }, " bright ", "alpha omega", {
    trimTextRange,
  });
  assert.equal(insertion.editorText, "alpha  bright omega");
  assert.deepEqual(insertion.anchor, {
    selectedText: "bright",
    startOffset: 7,
    endOffset: 13,
  });

  assert.deepEqual(getInlinePassageDraftAnchor({
    typedStartOffset: 6,
    typedEndOffset: 14,
  }, "alpha brighter omega", {
    trimTextRange,
  }), {
    selectedText: "brighter",
    startOffset: 6,
    endOffset: 14,
  });
}
