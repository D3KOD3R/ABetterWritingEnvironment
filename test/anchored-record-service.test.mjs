// Intent: verify anchored task/note mutation persistence stays in the feature service.
import assert from "node:assert/strict";

import { createAnchoredRecordService } from "../apps/editor/public/features/anchored-records/anchored-record-service.js";

export function runAnchoredRecordServiceTest() {
  const events = [];
  const state = {
    tasks: [],
    notes: [],
  };
  const service = createAnchoredRecordService({
    getTasks: () => state.tasks,
    setTasks: (tasks) => {
      state.tasks = tasks;
    },
    persistTasks: (options) => events.push(["tasks", options]),
    getNotes: () => state.notes,
    setNotes: (notes) => {
      state.notes = notes;
    },
    persistNotes: (options) => events.push(["notes", options]),
  });

  const task = {
    id: "task-1",
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    sceneId: "scene-1",
    sceneTitle: "Arrival",
    selectedText: "passage",
    title: "Old title",
    body: "Fix pacing",
    status: "open",
    startOffset: 2,
    endOffset: 8,
  };
  assert.equal(service.addTask(task, { source: "test.addTask" }), task);
  assert.equal(state.tasks.length, 1);
  assert.deepEqual(events.at(-1), ["tasks", {
    dirtyReason: "manuscript-task-created",
    source: "test.addTask",
  }]);

  const titledTask = service.updateTaskTitle("task-1", "New title", { source: "test.title" });
  assert.equal(titledTask.title, "New title");
  assert.deepEqual(events.at(-1), ["tasks", {
    dirtyReason: "manuscript-task-title-edited",
    source: "test.title",
  }]);

  const repairedTask = service.repairTaskAnchor("task-1", {
    matched: true,
    startOffset: 4,
    endOffset: 10,
  });
  assert.equal(repairedTask.startOffset, 4);
  assert.deepEqual(events.at(-1), ["tasks", {
    dirtyReason: "manuscript-task-anchor-repaired",
    source: "anchoredRecordService.repairTaskAnchor",
  }]);

  const repairedTaskMetadata = service.repairTaskAnchor("task-1", {
    matched: true,
    startOffset: 4,
    endOffset: 10,
    recordPatch: {
      anchorStatus: "resolved",
      originalHash: "fnv1a32:testhash",
    },
  });
  assert.equal(repairedTaskMetadata.originalHash, "fnv1a32:testhash");
  assert.equal(repairedTaskMetadata.anchorStatus, "resolved");
  assert.deepEqual(events.at(-1), ["tasks", {
    dirtyReason: "manuscript-task-anchor-repaired",
    source: "anchoredRecordService.repairTaskAnchor",
  }]);

  const completedTask = service.completeTask("task-1", { source: "test.complete" });
  assert.equal(completedTask.status, "completed");
  assert.deepEqual(events.at(-1), ["tasks", {
    dirtyReason: "manuscript-task-completed",
    source: "test.complete",
  }]);

  const note = {
    id: "note-1",
    noteType: "research",
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    title: "Old note",
    body: "Research body",
    sceneId: "scene-1",
    sceneTitle: "Arrival",
    selectedText: "passage",
    startOffset: 1,
    endOffset: 3,
  };
  const replacement = {
    id: "note-2",
    noteType: "research",
    chapterId: "chapter-1",
    chapterTitle: "Chapter One",
    title: "Replacement",
    body: "Replacement body",
    sceneId: "scene-1",
    sceneTitle: "Arrival",
    selectedText: "replacement",
    startOffset: 15,
    endOffset: 26,
  };
  service.addPassageNote(replacement, { source: "test.addReplacement" });
  service.addPassageNote(note, { source: "test.addNote" });
  assert.deepEqual(state.notes.map((candidate) => candidate.id), ["note-1", "note-2"]);
  assert.deepEqual(events.at(-1), ["notes", {
    dirtyReason: "research-note-created",
    source: "test.addNote",
  }]);

  const updatedNote = service.updatePassageNoteBody("note-1", "Updated body", { source: "test.body" });
  assert.equal(updatedNote.body, "Updated body");
  assert.deepEqual(events.at(-1), ["notes", {
    dirtyReason: "passage-note-body-edited",
    source: "test.body",
  }]);

  const repairedNote = service.repairPassageNoteAnchor("note-1", {
    matched: true,
    startOffset: 6,
    endOffset: 14,
    recordPatch: {
      anchorStatus: "approximate",
      anchorDirtyReason: "context-recovered",
    },
  });
  assert.equal(repairedNote.endOffset, 14);
  assert.equal(repairedNote.anchorStatus, "approximate");
  assert.equal(repairedNote.anchorDirtyReason, "context-recovered");
  assert.deepEqual(events.at(-1), ["notes", {
    dirtyReason: "passage-note-anchor-repaired",
    source: "anchoredRecordService.repairPassageNoteAnchor",
  }]);

  const deletion = service.deletePassageNote("note-1", { source: "test.delete" });
  assert.equal(deletion.note.id, "note-1");
  assert.equal(deletion.sameSceneReplacementNote.id, "note-2");
  assert.deepEqual(state.notes.map((candidate) => candidate.id), ["note-2"]);
  assert.deepEqual(events.at(-1), ["notes", {
    dirtyReason: "research-note-deleted",
    source: "test.delete",
  }]);
}
