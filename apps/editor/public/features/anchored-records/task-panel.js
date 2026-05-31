// Intent: render anchored task console items without owning task persistence effects.
import { escapeHtml } from "../../shared/ui-utils.js";
import { formatImportSourceLabel } from "./passage-note-panel.js";

export function renderTaskPanelHTML(model, {
  selectedTaskId = "",
  previewTaskId = "",
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  const taskCount = Number.isInteger(model?.taskCount) ? model.taskCount : 0;
  if (!taskCount || !groups.length) {
    return "";
  }

  return `
    <div class="task-panel">
      <div class="task-panel-heading">
        <p class="selection-label">Tasks</p>
        <strong>${escapeHtml(String(taskCount))}</strong>
      </div>
      <div class="task-chapter-list">
        ${groups.map((chapter) => renderTaskChapterGroupHTML(chapter, {
          selectedTaskId,
          previewTaskId,
          collapsedChapterIds,
          formatChapterTitle,
        })).join("")}
      </div>
    </div>
  `;
}

export function renderTaskItemHTML(task, {
  selectedTaskId = "",
  previewTaskId = "",
} = {}) {
  const isSelected = selectedTaskId === task?.id;
  const isPreviewing = previewTaskId === task?.id;
  const sourceLabel = formatImportSourceLabel(task?.source);
  const taskNumberLabel = String(task?.taskNumber || 1).padStart(2, "0");
  return `
    <div class="task-item ${isSelected ? "is-selected" : ""} ${isPreviewing ? "is-previewing" : ""}" data-task-preview-id="${escapeHtml(task?.id)}" tabindex="0">
      <button
        class="task-thumb"
        type="button"
        tabindex="-1"
        data-action="toggle-task-preview"
        data-task-preview-trigger
        data-task-preview-task-id="${escapeHtml(task?.id)}"
        aria-pressed="${isPreviewing ? "true" : "false"}"
        aria-label="${escapeHtml(`Preview ${task?.title || task?.sceneTitle || "task"}`)}"
        title="${escapeHtml(isPreviewing ? "Click to collapse the task text" : "Hover or click to preview the task text")}"
      >
        <span class="task-thumb-label" aria-hidden="true">${escapeHtml(taskNumberLabel)}</span>
      </button>
      <div class="task-copy">
        ${sourceLabel && task?.source !== "manual" ? `<span class="console-meta task-source">${escapeHtml(sourceLabel)}</span>` : ""}
        <input
          class="inline-title-input task-title-input"
          type="text"
          value="${escapeHtml(task?.title || `${task?.sceneTitle || "Scene"} task ${task?.taskNumber || 1}`)}"
          data-title-input
          data-edit-field="task-title"
          data-task-id="${escapeHtml(task?.id)}"
          aria-label="Task title"
        />
        <span class="task-body">${escapeHtml(task?.body || task?.description || "No task body")}</span>
        ${isSelected ? `<em class="task-reference">Reference: ${escapeHtml(task?.selectedText)}</em>` : ""}
      </div>
      <button class="tag-button task-complete-button" data-action="complete-task" data-task-id="${escapeHtml(task?.id)}">Done</button>
    </div>
  `;
}

function renderTaskChapterGroupHTML(chapter, {
  selectedTaskId = "",
  previewTaskId = "",
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  return renderCollapsibleChapterGroupHTML({
    panelId: "issueTasks",
    chapterKey: chapter?.chapterId,
    chapterTitle: chapter?.chapterTitle,
    itemCount: Array.isArray(chapter?.tasks) ? chapter.tasks.length : 0,
    groupClassName: "task-chapter-group",
    headingClassName: "task-chapter-heading",
    childrenClassName: "task-list",
    collapsedChapterIds,
    formatChapterTitle,
    bodyHtml: (Array.isArray(chapter?.tasks) ? chapter.tasks : [])
      .map((task) => renderTaskItemHTML(task, { selectedTaskId, previewTaskId }))
      .join(""),
  });
}

function renderCollapsibleChapterGroupHTML({
  panelId,
  chapterKey,
  chapterTitle,
  itemCount,
  bodyHtml,
  groupClassName,
  headingClassName,
  childrenClassName,
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
}) {
  const normalizedPanelId = String(panelId ?? "").trim();
  const normalizedChapterKey = String(chapterKey ?? "").trim();
  if (!normalizedPanelId || !normalizedChapterKey) {
    return "";
  }

  const isCollapsed = Array.isArray(collapsedChapterIds) && collapsedChapterIds.includes(normalizedChapterKey);
  return `
    <section class="${escapeHtml(groupClassName)}${isCollapsed ? " is-collapsed" : ""}">
      <button
        class="${escapeHtml(headingClassName)}"
        type="button"
        data-action="toggle-console-chapter-collapse"
        data-console-panel="${escapeHtml(normalizedPanelId)}"
        data-chapter-key="${escapeHtml(normalizedChapterKey)}"
        aria-expanded="${isCollapsed ? "false" : "true"}"
      >
        <span class="console-chapter-disclosure" aria-hidden="true">${isCollapsed ? "&#9656;" : "&#9662;"}</span>
        <strong>${escapeHtml(formatChapterTitle(chapterTitle))}</strong>
        <span class="console-chapter-count">${escapeHtml(String(itemCount))}</span>
      </button>
      <div class="${escapeHtml(childrenClassName)}">
        ${bodyHtml}
      </div>
    </section>
  `;
}

function defaultFormatChapterTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  return value || "Untitled chapter";
}
