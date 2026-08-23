// Intent: verify World Spine undo/redo stacks preserve bounded before/after snapshots.
import assert from "node:assert/strict";

import {
  canRedoWorldSpineHistory,
  canUndoWorldSpineHistory,
  createWorldSpineHistoryState,
  pushWorldSpineHistoryEntry,
  redoWorldSpineHistory,
  undoWorldSpineHistory,
} from "../apps/editor/public/features/world-spine/world-spine-history-service.js";

export function runWorldSpineHistoryServiceTest() {
  const empty = createWorldSpineHistoryState();
  assert.deepEqual(empty, { undoStack: [], redoStack: [] });
  assert.equal(canUndoWorldSpineHistory(empty), false);
  assert.equal(canRedoWorldSpineHistory(empty), false);

  const before = {
    world: { edges: [] },
    projectEventTags: [],
    projectLines: [{ sceneId: "scene-one", line: 1 }],
    sceneDrafts: {},
    structureDrafts: {},
    selectedNodeId: "scene:one",
    worldSpineEventRailWidth: 224,
    timelineZoom: 1,
  };
  const after = {
    ...before,
    world: { edges: [{ id: "edge-0001", fromNodeId: "scene:one", toNodeId: "scene:two" }] },
    projectLines: [{ sceneId: "scene-two", line: 1 }],
    selectedNodeId: "scene:two",
    timelineZoom: 1.2,
  };

  const pushed = pushWorldSpineHistoryEntry(empty, {
    id: "history-1",
    label: "Created implication",
    source: "test",
    dirtyReason: "world-spine-implication-edge-created",
    before,
    after,
  });
  assert.equal(pushed.undoStack.length, 1);
  assert.equal(pushed.redoStack.length, 0);
  assert.equal(canUndoWorldSpineHistory(pushed), true);

  const ignored = pushWorldSpineHistoryEntry(pushed, {
    id: "history-ignored",
    before: after,
    after,
  });
  assert.equal(ignored.undoStack.length, 1);

  const undone = undoWorldSpineHistory(pushed);
  assert.equal(undone.entry.label, "Created implication");
  assert.equal(undone.snapshot.world.edges.length, 0);
  assert.equal(undone.snapshot.projectLines[0].sceneId, "scene-one");
  assert.equal(undone.history.undoStack.length, 0);
  assert.equal(undone.history.redoStack.length, 1);

  const redone = redoWorldSpineHistory(undone.history);
  assert.equal(redone.snapshot.world.edges.length, 1);
  assert.equal(redone.snapshot.projectLines[0].sceneId, "scene-two");
  assert.equal(redone.snapshot.timelineZoom, 1.2);
  assert.equal(redone.history.undoStack.length, 1);
  assert.equal(redone.history.redoStack.length, 0);

  const bounded = [1, 2, 3].reduce((history, index) => pushWorldSpineHistoryEntry(history, {
    id: `history-${index}`,
    before: { ...before, selectedNodeId: `before-${index}` },
    after: { ...after, selectedNodeId: `after-${index}` },
  }, { limit: 2 }), empty);
  assert.deepEqual(bounded.undoStack.map((entry) => entry.id), ["history-2", "history-3"]);
}
