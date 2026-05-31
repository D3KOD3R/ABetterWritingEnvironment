// Intent: own anchored task/note collection mutations and persistence reasons outside app.js.
import {
  completeManuscriptTask,
  updateManuscriptTaskTitle,
  updatePassageNoteBody,
  updatePassageNoteTitle,
} from "../../editor-model.js";

export function createAnchoredRecordService({
  getTasks,
  setTasks,
  persistTasks,
  getNotes,
  setNotes,
  persistNotes,
} = {}) {
  const dependencies = {
    getTasks,
    setTasks,
    persistTasks,
    getNotes,
    setNotes,
    persistNotes,
  };

  return {
    addTask: (task, options = {}) => addTask(task, options, dependencies),
    updateTaskTitle: (taskId, title, options = {}) => updateTaskTitle(taskId, title, options, dependencies),
    repairTaskAnchor: (taskId, range, options = {}) => repairTaskAnchor(taskId, range, options, dependencies),
    completeTask: (taskId, options = {}) => completeTaskRecord(taskId, options, dependencies),
    addPassageNote: (note, options = {}) => addPassageNote(note, options, dependencies),
    updatePassageNoteTitle: (noteId, title, options = {}) => updatePassageNoteTitleRecord(noteId, title, options, dependencies),
    updatePassageNoteBody: (noteId, body, options = {}) => updatePassageNoteBodyRecord(noteId, body, options, dependencies),
    repairPassageNoteAnchor: (noteId, range, options = {}) => repairPassageNoteAnchor(noteId, range, options, dependencies),
    deletePassageNote: (noteId, options = {}) => deletePassageNote(noteId, options, dependencies),
  };
}

export function addTask(task, {
  dirtyReason = "manuscript-task-created",
  source = "anchoredRecordService.addTask",
} = {}, dependencies = {}) {
  if (!task) {
    return null;
  }

  const tasks = readCollection(dependencies.getTasks);
  const nextTasks = [...tasks, task];
  writeCollection(dependencies.setTasks, nextTasks);
  persist(dependencies.persistTasks, { dirtyReason, source });
  return task;
}

export function updateTaskTitle(taskId, title, {
  dirtyReason = "manuscript-task-title-edited",
  source = "anchoredRecordService.updateTaskTitle",
} = {}, dependencies = {}) {
  const tasks = updateManuscriptTaskTitle(readCollection(dependencies.getTasks), taskId, title);
  writeCollection(dependencies.setTasks, tasks);
  persist(dependencies.persistTasks, { dirtyReason, source });
  return tasks.find((task) => task.id === taskId) ?? null;
}

export function repairTaskAnchor(taskId, range, {
  dirtyReason = "manuscript-task-anchor-repaired",
  source = "anchoredRecordService.repairTaskAnchor",
} = {}, dependencies = {}) {
  if (!range?.matched) {
    return null;
  }

  const tasks = readCollection(dependencies.getTasks);
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    return null;
  }

  if (task.startOffset === range.startOffset && task.endOffset === range.endOffset) {
    return task;
  }

  const nextTasks = tasks.map((candidate) =>
    candidate.id === taskId
      ? {
          ...candidate,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
        }
      : candidate,
  );
  writeCollection(dependencies.setTasks, nextTasks);
  persist(dependencies.persistTasks, { dirtyReason, source });
  return nextTasks.find((candidate) => candidate.id === taskId) ?? null;
}

export function completeTaskRecord(taskId, {
  dirtyReason = "manuscript-task-completed",
  source = "anchoredRecordService.completeTask",
} = {}, dependencies = {}) {
  const tasks = completeManuscriptTask(readCollection(dependencies.getTasks), taskId);
  writeCollection(dependencies.setTasks, tasks);
  persist(dependencies.persistTasks, { dirtyReason, source });
  return tasks.find((task) => task.id === taskId) ?? null;
}

export function addPassageNote(note, {
  dirtyReason = `${note?.noteType === "research" ? "research" : "inspiration"}-note-created`,
  source = "anchoredRecordService.addPassageNote",
} = {}, dependencies = {}) {
  if (!note) {
    return null;
  }

  const notes = readCollection(dependencies.getNotes);
  const nextNotes = [note, ...notes];
  writeCollection(dependencies.setNotes, nextNotes);
  persist(dependencies.persistNotes, { dirtyReason, source });
  return note;
}

export function updatePassageNoteTitleRecord(noteId, title, {
  dirtyReason = "passage-note-title-edited",
  source = "anchoredRecordService.updatePassageNoteTitle",
} = {}, dependencies = {}) {
  const notes = updatePassageNoteTitle(readCollection(dependencies.getNotes), noteId, title);
  writeCollection(dependencies.setNotes, notes);
  persist(dependencies.persistNotes, { dirtyReason, source });
  return notes.find((note) => note.id === noteId) ?? null;
}

export function updatePassageNoteBodyRecord(noteId, body, {
  dirtyReason = "passage-note-body-edited",
  source = "anchoredRecordService.updatePassageNoteBody",
} = {}, dependencies = {}) {
  const notes = updatePassageNoteBody(readCollection(dependencies.getNotes), noteId, body);
  writeCollection(dependencies.setNotes, notes);
  persist(dependencies.persistNotes, { dirtyReason, source });
  return notes.find((note) => note.id === noteId) ?? null;
}

export function repairPassageNoteAnchor(noteId, range, {
  dirtyReason = "passage-note-anchor-repaired",
  source = "anchoredRecordService.repairPassageNoteAnchor",
} = {}, dependencies = {}) {
  if (!range?.matched) {
    return null;
  }

  const notes = readCollection(dependencies.getNotes);
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return null;
  }

  if (note.startOffset === range.startOffset && note.endOffset === range.endOffset) {
    return note;
  }

  const nextNotes = notes.map((candidate) =>
    candidate.id === noteId
      ? {
          ...candidate,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
        }
      : candidate,
  );
  writeCollection(dependencies.setNotes, nextNotes);
  persist(dependencies.persistNotes, { dirtyReason, source });
  return nextNotes.find((candidate) => candidate.id === noteId) ?? null;
}

export function deletePassageNote(noteId, {
  dirtyReason,
  source = "anchoredRecordService.deletePassageNote",
} = {}, dependencies = {}) {
  const notes = readCollection(dependencies.getNotes);
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) {
    return null;
  }

  const sameSceneReplacementNote = notes.find(
    (candidate) =>
      candidate.id !== note.id &&
      candidate.noteType === note.noteType &&
      candidate.sceneId === note.sceneId,
  ) ?? null;
  const nextNotes = notes.filter((candidate) => candidate.id !== note.id);

  writeCollection(dependencies.setNotes, nextNotes);
  persist(dependencies.persistNotes, {
    dirtyReason: dirtyReason ?? `${note.noteType === "research" ? "research" : "inspiration"}-note-deleted`,
    source,
  });

  return {
    note,
    sameSceneReplacementNote,
    notes: nextNotes,
  };
}

function readCollection(reader) {
  if (typeof reader !== "function") {
    return [];
  }

  const value = reader();
  return Array.isArray(value) ? value : [];
}

function writeCollection(writer, value) {
  if (typeof writer === "function") {
    writer(value);
  }
}

function persist(writer, options) {
  if (typeof writer === "function") {
    writer(options);
  }
}
