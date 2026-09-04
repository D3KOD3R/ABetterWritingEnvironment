// Intent: project grouped manuscript task iterations onto the rendered World Spine without owning task persistence.
import {
  buildTaskIterationWorldSpineLinks,
  formatTaskIterationLabel,
  isTaskIterationResolved,
} from "../anchored-records/task-iteration-service.js";

export const WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS = "implications";
export const WORLD_SPINE_RELATIONSHIP_MODE_TASKS = "tasks";
export const WORLD_SPINE_TASK_LAYER_STORAGE_KEY = "abe-world-spine-relationship-mode-v1";
const MANUSCRIPT_TASKS_STORAGE_KEY = "abe-manuscript-tasks-v1";
const TASK_LAYER_SELECTOR = "[data-world-spine-task-layer]";
const TASK_BADGE_LAYER_SELECTOR = "[data-world-spine-task-badge-layer]";
const RELATIONSHIP_CONTROL_SELECTOR = "[data-world-spine-relationship-control]";

export function normalizeWorldSpineRelationshipMode(value) {
  return value === WORLD_SPINE_RELATIONSHIP_MODE_TASKS
    ? WORLD_SPINE_RELATIONSHIP_MODE_TASKS
    : WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS;
}

export function buildWorldSpineTaskLayerModel(tasks = []) {
  const taskList = Array.isArray(tasks) ? tasks.filter(Boolean) : [];
  const groupedTasks = taskList.filter((task) => String(task?.taskGroupId ?? "").trim());
  const points = groupedTasks
    .map((task) => ({
      taskId: String(task.id ?? ""),
      sceneId: String(task.sceneId ?? ""),
      taskGroupId: String(task.taskGroupId ?? ""),
      label: formatTaskIterationLabel(task),
      title: String(task.title ?? task.body ?? "Task iteration"),
      resolved: isTaskIterationResolved(task),
      iterationIndex: Number.isInteger(Number(task.taskIterationIndex)) ? Number(task.taskIterationIndex) : 0,
    }))
    .filter((point) => point.taskId && point.sceneId)
    .sort((left, right) => left.taskGroupId === right.taskGroupId
      ? left.iterationIndex - right.iterationIndex
      : left.taskGroupId.localeCompare(right.taskGroupId));

  return {
    points,
    links: buildTaskIterationWorldSpineLinks(groupedTasks),
    groupCount: new Set(points.map((point) => point.taskGroupId)).size,
    pointCount: points.length,
  };
}

export function createWorldSpineTaskLayerController({
  documentRef = globalThis.document,
  storage = globalThis.localStorage,
} = {}) {
  if (!documentRef) {
    return { refresh() {}, destroy() {} };
  }

  let observer = null;
  let currentRoot = null;
  let refreshQueued = false;

  const readMode = () => {
    try {
      return normalizeWorldSpineRelationshipMode(storage?.getItem?.(WORLD_SPINE_TASK_LAYER_STORAGE_KEY));
    } catch {
      return WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS;
    }
  };

  const writeMode = (mode) => {
    try {
      storage?.setItem?.(WORLD_SPINE_TASK_LAYER_STORAGE_KEY, normalizeWorldSpineRelationshipMode(mode));
    } catch {
      // Relationship display preference is non-critical when storage is unavailable.
    }
  };

  const readTasks = () => {
    try {
      const raw = storage?.getItem?.(MANUSCRIPT_TASKS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  function refresh() {
    refreshQueued = false;
    const root = documentRef.querySelector("[data-world-spine-root]");
    if (!(root instanceof Element)) {
      currentRoot = null;
      return;
    }

    const canvas = root.querySelector("[data-world-spine-canvas]");
    const headerActions = root.querySelector(".world-spine-center__header-actions");
    if (!(canvas instanceof HTMLElement) || !(headerActions instanceof HTMLElement)) {
      return;
    }

    currentRoot = root;
    const mode = readMode();
    const model = buildWorldSpineTaskLayerModel(readTasks());
    root.dataset.worldSpineRelationshipMode = mode;
    renderRelationshipControl(headerActions, mode, model);
    renderTaskLayer(canvas, model, {
      active: mode === WORLD_SPINE_RELATIONSHIP_MODE_TASKS,
      documentRef,
    });
  }

  function queueRefreshForRootChange() {
    const nextRoot = documentRef.querySelector("[data-world-spine-root]");
    if (nextRoot === currentRoot || refreshQueued) {
      return;
    }
    refreshQueued = true;
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(refresh);
    } else {
      globalThis.setTimeout?.(refresh, 0);
    }
  }

  function handleClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("[data-world-spine-relationship-mode]")
      : null;
    if (!target) {
      return;
    }
    writeMode(target.dataset.worldSpineRelationshipMode);
    refresh();
  }

  documentRef.addEventListener("click", handleClick);
  if (typeof MutationObserver === "function" && documentRef.body) {
    observer = new MutationObserver(queueRefreshForRootChange);
    observer.observe(documentRef.body, { childList: true, subtree: true });
  }
  refresh();

  return {
    refresh,
    destroy() {
      observer?.disconnect();
      documentRef.removeEventListener("click", handleClick);
    },
  };
}

function renderRelationshipControl(headerActions, mode, model) {
  const existing = headerActions.querySelector(RELATIONSHIP_CONTROL_SELECTOR);
  const html = `
    <div class="world-spine-relationship-control" data-world-spine-relationship-control aria-label="World Spine relationship layer">
      <span class="world-spine-relationship-control__label">Relationships</span>
      <div class="world-spine-relationship-control__modes">
        ${renderModeButton(WORLD_SPINE_RELATIONSHIP_MODE_IMPLICATIONS, "Implications", mode)}
        ${renderModeButton(WORLD_SPINE_RELATIONSHIP_MODE_TASKS, `Tasks${model.groupCount ? ` · ${model.groupCount}` : ""}`, mode)}
      </div>
    </div>`;
  if (existing) {
    existing.outerHTML = html;
  } else {
    headerActions.insertAdjacentHTML("afterbegin", html);
  }
}

function renderModeButton(modeId, label, activeMode) {
  const active = modeId === activeMode;
  return `<button type="button" class="world-spine-relationship-control__button${active ? " is-active" : ""}" data-world-spine-relationship-mode="${escapeHtml(modeId)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function renderTaskLayer(canvas, model, { active = false, documentRef = document } = {}) {
  canvas.querySelector(TASK_LAYER_SELECTOR)?.remove();
  canvas.querySelector(TASK_BADGE_LAYER_SELECTOR)?.remove();
  if (!active) {
    return;
  }

  const width = Number(canvas.dataset.worldSpineCanvasWidth) || canvas.offsetWidth || 900;
  const height = Number(canvas.dataset.worldSpineCanvasHeight) || canvas.offsetHeight || 520;
  const sceneNodes = createSceneNodeGeometryIndex(canvas);
  const drawableLinks = model.links.map((link, index) => createDrawableTaskLink(link, sceneNodes, index)).filter(Boolean);
  const svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "world-spine-task-layer");
  svg.setAttribute("data-world-spine-task-layer", "");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.innerHTML = `<defs><marker id="world-spine-task-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path class="world-spine-task-arrow" d="M 0 0 L 8 4 L 0 8 z"></path></marker></defs>${drawableLinks.map(renderTaskConnectionSvg).join("")}`;
  canvas.append(svg);

  const badgeLayer = documentRef.createElement("div");
  badgeLayer.className = "world-spine-task-badge-layer";
  badgeLayer.setAttribute("data-world-spine-task-badge-layer", "");
  badgeLayer.innerHTML = model.points.map((point, index) => renderTaskPointBadge(point, sceneNodes, index)).join("");
  canvas.append(badgeLayer);
}

function createSceneNodeGeometryIndex(canvas) {
  const index = new Map();
  canvas.querySelectorAll("[data-world-spine-node-level='primary'][data-world-spine-scene-id]").forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const sceneId = String(element.dataset.worldSpineSceneId ?? "").trim();
    if (!sceneId || index.has(sceneId)) {
      return;
    }
    index.set(sceneId, {
      left: element.offsetLeft,
      top: element.offsetTop,
      width: element.offsetWidth,
      height: element.offsetHeight,
    });
  });
  return index;
}

function createDrawableTaskLink(link, sceneNodes, index) {
  const source = sceneNodes.get(String(link.sourceSceneId ?? ""));
  const target = sceneNodes.get(String(link.targetSceneId ?? ""));
  if (!source || !target) {
    return null;
  }

  const leftToRight = source.left <= target.left;
  const startX = leftToRight ? source.left + source.width : source.left;
  const endX = leftToRight ? target.left : target.left + target.width;
  const startY = source.top + source.height / 2;
  const endY = target.top + target.height / 2;
  const distance = Math.abs(endX - startX);
  const handle = Math.max(46, Math.min(132, distance * 0.38));
  const laneLift = 58 + ((index % 4) * 18);
  const controlY = Math.max(28, Math.min(startY, endY) - laneLift);
  const control1X = startX + (leftToRight ? handle : -handle);
  const control2X = endX - (leftToRight ? handle : -handle);
  return {
    ...link,
    path: `M ${round(startX)} ${round(startY)} C ${round(control1X)} ${round(controlY)}, ${round(control2X)} ${round(controlY)}, ${round(endX)} ${round(endY)}`,
    labelX: round((startX + endX) / 2),
    labelY: round(controlY - 8),
  };
}

function renderTaskConnectionSvg(link) {
  const resolvedClass = link.sourceResolved && link.targetResolved ? " is-resolved" : "";
  const label = `${link.sourceLabel} → ${link.targetLabel}`;
  return `<g class="world-spine-task-connection${resolvedClass}" data-task-preview-id="${escapeHtml(link.targetTaskId)}" tabindex="0" role="link" aria-label="${escapeHtml(`Navigate to ${link.targetLabel}`)}"><path class="world-spine-task-connection__hit" d="${escapeHtml(link.path)}"></path><path class="world-spine-task-connection__line" d="${escapeHtml(link.path)}" marker-end="url(#world-spine-task-arrow)"></path><text class="world-spine-task-connection__label" x="${link.labelX}" y="${link.labelY}"><tspan>${escapeHtml(label)}</tspan></text></g>`;
}

function renderTaskPointBadge(point, sceneNodes, index) {
  const node = sceneNodes.get(point.sceneId);
  if (!node) {
    return "";
  }
  const slot = index % 3;
  const left = node.left + node.width - 12 - (slot * 30);
  const top = node.top - 14;
  return `<button type="button" class="world-spine-task-point${point.resolved ? " is-resolved" : ""}" data-task-preview-id="${escapeHtml(point.taskId)}" data-world-spine-task-group-id="${escapeHtml(point.taskGroupId)}" style="left:${round(left)}px; top:${round(top)}px;" title="${escapeHtml(`${point.label}: ${point.title}`)}" aria-label="${escapeHtml(`Task ${point.label}: ${point.title}`)}"><span>${escapeHtml(point.label)}</span>${point.resolved ? "<i aria-hidden=\"true\">✓</i>" : ""}</button>`;
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

if (typeof document !== "undefined") {
  createWorldSpineTaskLayerController();
}
