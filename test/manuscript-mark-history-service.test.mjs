// Intent: verify app-owned manuscript mark decorations can participate in bounded undo/redo history.
import assert from "node:assert/strict";

import {
  createManuscriptMarkHistoryEntry,
  createManuscriptMarkHistorySnapshot,
  createManuscriptMarkHistoryState,
  popManuscriptMarkHistoryRedo,
  popManuscriptMarkHistoryUndo,
  pushManuscriptMarkHistoryEntry,
} from "../apps/editor/public/features/manuscript-editor/manuscript-mark-history-service.js";

export function runManuscriptMarkHistoryServiceTest() {
  const beforeSnapshot = createManuscriptMarkHistorySnapshot({
    marks: [],
    sequences: { mark: 1, issue: 2 },
    inlineFormatRanges: [{
      id: "inline-highlight-0-5",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 5,
    }],
  });
  const afterSnapshot = createManuscriptMarkHistorySnapshot({
    marks: [{
      id: "mark-0002",
      kind: "highlight",
      anchor: {
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 0,
        endOffset: 5,
      },
    }],
    sequences: { mark: 2, issue: 2 },
    inlineFormatRanges: [],
  });

  const entry = createManuscriptMarkHistoryEntry({
    sceneId: " scene-1 ",
    formatId: "highlight",
    beforeSnapshot,
    afterSnapshot,
    selection: {
      startOffset: 5,
      endOffset: 0,
    },
    createdAt: "2026-07-15T00:00:00.000Z",
  });
  assert.equal(entry.sceneId, "scene-1");
  assert.deepEqual(entry.selection, {
    startOffset: 0,
    endOffset: 5,
  });

  const pushed = pushManuscriptMarkHistoryEntry(createManuscriptMarkHistoryState(), entry);
  assert.equal(pushed.undoStack.length, 1);
  assert.equal(pushed.redoStack.length, 0);

  const undo = popManuscriptMarkHistoryUndo(pushed);
  assert.equal(undo.handled, true);
  assert.equal(undo.direction, "undo");
  assert.deepEqual(undo.snapshot, beforeSnapshot);
  assert.equal(undo.history.undoStack.length, 0);
  assert.equal(undo.history.redoStack.length, 1);

  const redo = popManuscriptMarkHistoryRedo(undo.history);
  assert.equal(redo.handled, true);
  assert.equal(redo.direction, "redo");
  assert.deepEqual(redo.snapshot, afterSnapshot);
  assert.equal(redo.history.undoStack.length, 1);
  assert.equal(redo.history.redoStack.length, 0);

  const grouped = pushManuscriptMarkHistoryEntry(createManuscriptMarkHistoryState(), {
    sceneId: "scene-1",
    formatId: "group:bold+highlight",
    beforeSnapshot,
    afterSnapshot,
    selection: {
      startOffset: 0,
      endOffset: 5,
    },
  });
  assert.equal(grouped.undoStack.length, 1);
  assert.equal(grouped.undoStack[0].formatId, "group:bold+highlight");
  const groupedUndo = popManuscriptMarkHistoryUndo(grouped);
  assert.deepEqual(groupedUndo.snapshot, beforeSnapshot);

  const unchanged = pushManuscriptMarkHistoryEntry(redo.history, createManuscriptMarkHistoryEntry({
    sceneId: "scene-1",
    formatId: "highlight",
    beforeSnapshot,
    afterSnapshot: beforeSnapshot,
  }));
  assert.equal(unchanged.undoStack.length, 1);

  const bounded = Array.from({ length: 3 }).reduce((history, _item, index) => pushManuscriptMarkHistoryEntry(history, {
    sceneId: "scene-1",
    formatId: "bold",
    beforeSnapshot: createManuscriptMarkHistorySnapshot({ marks: [{ id: `mark-before-${index}` }] }),
    afterSnapshot: createManuscriptMarkHistorySnapshot({ marks: [{ id: `mark-after-${index}` }] }),
  }, {
    limit: 2,
  }), createManuscriptMarkHistoryState());
  assert.deepEqual(bounded.undoStack.map((historyEntry) => historyEntry.afterSnapshot.marks[0].id), [
    "mark-after-1",
    "mark-after-2",
  ]);
}
