// Intent: verify manuscript tasks and grouped iterations become a World Spine-ready visual projection.
import assert from "node:assert/strict";

import {
  WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS,
  WORLD_SPINE_RELATIONSHIP_MODE_TASKS,
  buildWorldSpineTaskLayerModel,
  normalizeWorldSpineRelationshipMode,
} from "../apps/editor/public/features/world-spine/world-spine-task-layer.js";

export function runWorldSpineTaskLayerTest() {
  assert.equal(normalizeWorldSpineRelationshipMode("tasks"), WORLD_SPINE_RELATIONSHIP_MODE_TASKS);
  assert.equal(normalizeWorldSpineRelationshipMode("unknown"), WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS);

  const model = buildWorldSpineTaskLayerModel([
    {
      id: "task-a",
      sceneId: "scene-a",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 0,
      title: "Establish the old lore",
      status: "open",
    },
    {
      id: "task-b",
      sceneId: "scene-b",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 1,
      title: "Update the reveal",
      status: "open",
    },
    {
      id: "task-c",
      sceneId: "scene-c",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 2,
      title: "Repair the consequence",
      status: "resolved",
    },
    {
      id: "ordinary-task",
      sceneId: "scene-d",
      taskNumber: 9,
      title: "Standalone task",
      status: "open",
    },
  ]);

  assert.equal(model.groupCount, 1);
  assert.equal(model.pointCount, 4);
  assert.deepEqual(model.points.map((point) => point.label), ["1a", "1b", "1c", "T9"]);
  assert.equal(model.points[2].resolved, true);
  assert.equal(model.points[3].isGrouped, false);
  assert.equal(model.links.length, 2);
  assert.deepEqual(model.links.map((link) => [link.sourceSceneId, link.targetSceneId]), [
    ["scene-a", "scene-b"],
    ["scene-b", "scene-c"],
  ]);
  assert.deepEqual(model.links.map((link) => [link.sourceLabel, link.targetLabel]), [
    ["1a", "1b"],
    ["1b", "1c"],
  ]);
}
