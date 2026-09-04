// Intent: verify grouped task iterations preserve ordered manuscript navigation and World Spine linkage semantics.
import assert from "node:assert/strict";

import {
  buildTaskIterationWorldSpineLinks,
  createTaskIterationMetadata,
  formatTaskIterationLabel,
  formatTaskIterationSuffix,
  isTaskIterationResolved,
  resolveTaskIterationNavigation,
  selectTaskIterationGroup,
} from "../apps/editor/public/features/anchored-records/task-iteration-service.js";

export function runTaskIterationServiceTest() {
  assert.equal(formatTaskIterationSuffix(0), "a");
  assert.equal(formatTaskIterationSuffix(1), "b");
  assert.equal(formatTaskIterationSuffix(25), "z");
  assert.equal(formatTaskIterationSuffix(26), "aa");

  assert.deepEqual(createTaskIterationMetadata({
    groupId: "lore-change-1",
    groupNumber: 1,
    iterationIndex: 2,
  }), {
    taskGroupId: "lore-change-1",
    taskGroupNumber: 1,
    taskIterationIndex: 2,
    taskIterationLabel: "1c",
  });

  const tasks = [
    {
      id: "task-1d",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 3,
      sceneId: "scene-9",
      status: "open",
      createdAt: "2026-09-04T01:04:00.000Z",
    },
    {
      id: "task-1a",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 0,
      sceneId: "scene-2",
      status: "open",
      createdAt: "2026-09-04T01:01:00.000Z",
    },
    {
      id: "task-1c",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 2,
      sceneId: "scene-7",
      status: "done",
      createdAt: "2026-09-04T01:03:00.000Z",
    },
    {
      id: "task-1b",
      taskGroupId: "lore-change-1",
      taskGroupNumber: 1,
      taskIterationIndex: 1,
      sceneId: "scene-5",
      status: "open",
      createdAt: "2026-09-04T01:02:00.000Z",
    },
    {
      id: "task-2a",
      taskGroupId: "other-group",
      taskGroupNumber: 2,
      taskIterationIndex: 0,
      sceneId: "scene-3",
      status: "open",
    },
  ];

  const group = selectTaskIterationGroup(tasks, "task-1b");
  assert.deepEqual(group.map((task) => task.id), ["task-1a", "task-1b", "task-1c", "task-1d"]);
  assert.equal(formatTaskIterationLabel(group[1]), "1b");
  assert.equal(isTaskIterationResolved(group[2]), true);
  assert.equal(isTaskIterationResolved(group[1]), false);

  const navigation = resolveTaskIterationNavigation(tasks, "task-1b");
  assert.equal(navigation.previousUnresolved?.id, "task-1a");
  assert.equal(navigation.nextUnresolved?.id, "task-1d");

  const withResolvedA = tasks.map((task) => task.id === "task-1a" ? { ...task, status: "resolved" } : task);
  const navigationWithoutPrevious = resolveTaskIterationNavigation(withResolvedA, "task-1b");
  assert.equal(navigationWithoutPrevious.previousUnresolved, null);
  assert.equal(navigationWithoutPrevious.nextUnresolved?.id, "task-1d");

  const links = buildTaskIterationWorldSpineLinks(tasks);
  const loreLinks = links.filter((link) => link.taskGroupId === "lore-change-1");
  assert.equal(loreLinks.length, 3);
  assert.deepEqual(loreLinks.map((link) => [link.sourceLabel, link.targetLabel]), [
    ["1a", "1b"],
    ["1b", "1c"],
    ["1c", "1d"],
  ]);
  assert.deepEqual(loreLinks[1], {
    id: "task-iteration:lore-change-1:task-1b->task-1c",
    relationType: "task-iteration",
    taskGroupId: "lore-change-1",
    sourceTaskId: "task-1b",
    targetTaskId: "task-1c",
    sourceSceneId: "scene-5",
    targetSceneId: "scene-7",
    sourceLabel: "1b",
    targetLabel: "1c",
    sourceResolved: false,
    targetResolved: true,
  });
}
