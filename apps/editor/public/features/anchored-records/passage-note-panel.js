// Intent: render passage-note console items without owning note persistence or navigation effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function renderPassageNotePanelHTML(model, {
  selectedNoteId = "",
  previewNoteId = "",
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  const label = model?.label || "Inspiration";
  const noteType = model?.noteType || "inspiration";
  const groups = Array.isArray(model?.groups) ? model.groups : [];

  return `
    <div class="panel-heading">
      <p class="panel-kicker">${escapeHtml(label)}</p>
    </div>
    ${groups.length ? `
      <div class="passage-note-list console-list console-chapter-list">
        ${groups.map((group) => renderPassageNoteChapterGroupHTML(noteType, group, {
          selectedNoteId,
          previewNoteId,
          collapsedChapterIds,
          formatChapterTitle,
        })).join("")}
      </div>
    ` : renderEmptyPassageNoteStateHTML(label)}
  `;
}

export function renderPassageNoteItemHTML(note, {
  selectedNoteId = "",
  previewNoteId = "",
} = {}) {
  const isSelected = selectedNoteId === note?.id;
  const isPreviewing = previewNoteId === note?.id;
  const sourceLabel = formatImportSourceLabel(note?.source);
  const noteType = note?.noteType === "research" ? "research" : "inspiration";
  const deleteLabel = `Delete ${noteType} note`;
  const editLabel = `Edit ${noteType} note`;
  return `
    <div
      class="console-item passage-note-item ${isSelected ? "is-selected" : ""} ${isPreviewing ? "is-previewing" : ""}"
      data-action="select-passage-note"
      data-note-id="${escapeHtml(note?.id)}"
      role="button"
      tabindex="0"
      aria-expanded="${isPreviewing ? "true" : "false"}"
    >
      <span class="console-meta">${escapeHtml(note?.chapterTitle || "Imported source")} · ${escapeHtml(note?.sceneTitle || "Scene")}${sourceLabel && note?.source !== "manual" ? ` · ${escapeHtml(sourceLabel)}` : ""}</span>
      <input
        class="inline-title-input passage-note-title-input"
        type="text"
        value="${escapeHtml(note?.title || "Inspiration note")}"
        data-title-input
        data-edit-field="passage-note-title"
        data-note-id="${escapeHtml(note?.id)}"
        aria-label="${escapeHtml(noteType === "research" ? "Research title" : "Inspiration title")}"
      />
      <textarea
        class="passage-note-body-input"
        data-edit-field="passage-note-body"
        data-note-id="${escapeHtml(note?.id)}"
        aria-label="${escapeHtml(noteType === "research" ? "Research note body" : "Inspiration note body")}"
        rows="3"
      >${escapeHtml(note?.body || "")}</textarea>
      <div class="passage-note-actions">
        <button
          class="tag-button passage-note-icon-button passage-note-edit-button"
          type="button"
          data-action="edit-passage-note"
          data-note-id="${escapeHtml(note?.id)}"
          aria-label="${escapeHtml(editLabel)}"
          title="Edit this note"
        >
          ${renderPassageNoteEditIcon()}
        </button>
        <button
          class="tag-button passage-note-icon-button passage-note-delete-button"
          type="button"
          data-action="delete-passage-note"
          data-note-id="${escapeHtml(note?.id)}"
          aria-label="${escapeHtml(deleteLabel)}"
          title="Delete this note"
        >
          ${renderPassageNoteDeleteIcon()}
        </button>
      </div>
    </div>
  `;
}

export function formatImportSourceLabel(source) {
  if (typeof source !== "string" || !source.trim()) {
    return "";
  }

  const labels = {
    manual: "Manual",
    "source-research": "Research",
    "source-front-matter": "Front matter",
    "source-comment": "Imported task",
    "source-comment-note": "Imported note",
    "source-asset": "Asset",
    meta: "Project meta",
    trash: "Archive item",
    image: "Image",
    pdf: "PDF",
  };
  if (labels[source]) {
    return labels[source];
  }

  return source
    .replace(/^source-/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderEmptyPassageNoteStateHTML(label) {
  return `
    <div class="empty-note-state">
      <strong>No ${escapeHtml(label.toLowerCase())} bubbles yet.</strong>
      <span>Right-click in the editor, choose ${escapeHtml(label)}, then type into the inline bubble.</span>
    </div>
  `;
}

function renderPassageNoteChapterGroupHTML(noteType, group, {
  selectedNoteId = "",
  previewNoteId = "",
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  return renderCollapsibleChapterGroupHTML({
    panelId: noteType,
    chapterKey: group?.chapterKey,
    chapterTitle: group?.chapterTitle,
    itemCount: Array.isArray(group?.items) ? group.items.length : 0,
    groupClassName: "console-chapter-group passage-note-chapter-group",
    headingClassName: "console-chapter-heading",
    childrenClassName: "console-chapter-children",
    collapsedChapterIds,
    formatChapterTitle,
    bodyHtml: (Array.isArray(group?.items) ? group.items : [])
      .map((note) => renderPassageNoteItemHTML(note, { selectedNoteId, previewNoteId }))
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

function renderPassageNoteEditIcon() {
  return `
    <svg class="passage-note-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M11.8 1.8a1.7 1.7 0 0 1 2.4 2.4l-7.9 7.9-3.1.7.7-3.1 7.9-7.9Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="m10.6 3 2.4 2.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
  `;
}

function renderPassageNoteDeleteIcon() {
  return `
    <svg class="passage-note-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 4.5h9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M6 4.5V3.2h4v1.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M5 6.2 5.5 13h5l.5-6.8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  `;
}
