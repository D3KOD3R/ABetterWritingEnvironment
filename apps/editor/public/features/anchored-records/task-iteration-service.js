// Intent: model ordered manuscript task iterations independently from panel rendering and persistence effects.

const RESOLVED_TASK_STATUSES = new Set(["complete", "completed", "done", "resolved", "closed"]);

export function normalizeTaskIterationGroupId(value) {
  return String(value ?? "").trim();
}

export function normalizeTaskIterationIndex(value, fallback = 0) {
  const numericValue = Number(value);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }
  const numericFallback = Number(fallback);
  return Number.isInteger(numericFallback) && numericFallback >= 0 ? numericFallback : 0;
}

export function formatTaskIterationSuffix(index) {
  let value = normalizeTaskIterationIndex(index) + 1;
  let suffix = "";
  while (value > 0) {
    value -= 1;
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26);
  }
  return suffix;
}

export function formatTaskIterationLabel(task, {
  fallbackTaskNumber = 1,
} = {}) {
  const taskNumber = Number.isInteger(Number(task?.taskGroupNumber)) && Number(task.taskGroupNumber) > 0
    ? Number(task.taskGroupNumber)
    : Number.isInteger(Number(task?.taskNumber)) && Number(task.taskNumber) > 0
      ? Number(task.taskNumber)
      : fallbackTaskNumber;
  const suffix = formatTaskIterationSuffix(task?.taskIterationIndex);
  return `${taskNumber}${suffix}`;
}

export function createTaskIterationMetadata({
  groupId,
  groupNumber,
  iterationIndex = 0,
} = {}) {
  const taskGroupId = normalizeTaskIterationGroupId(groupId);
  if (!taskGroupId) {
    return null;
  }

  const taskGroupNumber = Number.isInteger(Number(groupNumber)) && Number(groupNumber) > 0
    ? Number(groupNumber)
    : 1;
  const taskIterationIndex = normalizeTaskIterationIndex(iterationIndex);
  return {
    taskGroupId,
    taskGroupNumber,
    taskIterationIndex,
    taskIterationLabel: `${taskGroupNumber}${formatTaskIterationSuffix(taskIterationIndex)}`,
  };
}

export function isTaskIterationResolved(task) {
  return RESOLVED_TASK_STATUSES.has(String(task?.status ?? "").trim().toLowerCase());
}

export function compareTaskIterationPoints(left, right) {
  const leftIndex = normalizeTaskIterationIndex(left?.taskIterationIndex, Number.MAX_SAFE_INTEGER);
  const rightIndex = normalizeTaskIterationIndex(right?.taskIterationIndex, Number.MAX_SAFE_INTEGER);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  const leftCreatedAt = String(left?.createdAt ?? "");
  const rightCreatedAt = String(right?.createdAt ?? "");
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt < rightCreatedAt ? -1 : 1;
  }

  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
}

export function selectTaskIterationGroup(tasks = [], taskOrId = null) {
  const taskList = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const activeTask = typeof taskOrId === "object" && taskOrId
    ? taskOrId
    : taskList.find((task) => task?.id === taskOrId) ?? null;
  const groupId = normalizeTaskIterationGroupId(activeTask?.taskGroupId);
  if (!activeTask || !groupId) {
    return [];
  }

  return taskList
    .filter((task) => normalizeTaskIterationGroupId(task?.taskGroupId) === groupId)
    .slice()
    .sort(compareTaskIterationPoints);
}

export function resolveTaskIterationNavigation(tasks = [], taskOrId = null) {
  const taskList = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const activeTask = typeof taskOrId === "object" && taskOrId
    ? taskOrId
    : taskList.find((task) => task?.id === taskOrId) ?? null;
  const group = selectTaskIterationGroup(taskList, activeTask);
  if (!activeTask || !group.length) {
    return {
      current: activeTask,
      group: [],
      previousUnresolved: null,
      nextUnresolved: null,
    };
  }

  const currentIndex = group.findIndex((task) => task?.id === activeTask.id);
  let previousUnresolved = null;
  let nextUnresolved = null;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!isTaskIterationResolved(group[index])) {
      previousUnresolved = group[index];
      break;
    }
  }

  for (let index = currentIndex + 1; index < group.length; index += 1) {
    if (!isTaskIterationResolved(group[index])) {
      nextUnresolved = group[index];
      break;
    }
  }

  return {
    current: activeTask,
    group,
    previousUnresolved,
    nextUnresolved,
  };
}

export function buildTaskIterationWorldSpineLinks(tasks = []) {
  const taskList = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const groups = new Map();

  for (const task of taskList) {
    const groupId = normalizeTaskIterationGroupId(task?.taskGroupId);
    if (!groupId) {
      continue;
    }
    if (!groups.has(groupId)) {
      groups.set(groupId, []);
    }
    groups.get(groupId).push(task);
  }

  const links = [];
  for (const [groupId, points] of groups.entries()) {
    const ordered = points.slice().sort(compareTaskIterationPoints);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const source = ordered[index];
      const target = ordered[index + 1];
      links.push({
        id: `task-iteration:${groupId}:${source.id}->${target.id}`,
        relationType: "task-iteration",
        taskGroupId: groupId,
        sourceTaskId: source.id,
        targetTaskId: target.id,
        sourceSceneId: source.sceneId ?? "",
        targetSceneId: target.sceneId ?? "",
        sourceLabel: formatTaskIterationLabel(source),
        targetLabel: formatTaskIterationLabel(target),
        sourceResolved: isTaskIterationResolved(source),
        targetResolved: isTaskIterationResolved(target),
      });
    }
  }

  return links;
}
