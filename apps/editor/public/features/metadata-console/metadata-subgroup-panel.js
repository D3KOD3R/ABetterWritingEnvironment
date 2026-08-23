// Intent: render project metadata folder notes without owning persistence or manuscript navigation.
import { escapeHtml } from "../../shared/ui-utils.js";

export function renderMetadataSubgroupPanelHTML({
  groupId = "",
  subgroups = [],
  selectedNoteId = "",
} = {}) {
  const normalizedGroupId = String(groupId ?? "").trim();
  if (!normalizedGroupId) {
    return "";
  }

  return `
    <section class="metadata-subgroup-panel" data-metadata-subgroup-panel="${escapeHtml(normalizedGroupId)}">
      <div class="metadata-subgroup-panel__toolbar">
        <strong>Folders</strong>
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="add-metadata-folder"
          data-metadata-group-id="${escapeHtml(normalizedGroupId)}"
        >New folder</button>
      </div>
      ${Array.isArray(subgroups) && subgroups.length
        ? subgroups.map((subgroup) => renderMetadataSubgroupHTML(subgroup, {
            selectedNoteId,
            depth: 0,
          })).join("")
        : renderMetadataSubgroupEmptyHTML()}
    </section>
  `;
}

function renderMetadataSubgroupHTML(subgroup, {
  selectedNoteId = "",
  depth = 0,
} = {}) {
  const notes = Array.isArray(subgroup?.notes) ? subgroup.notes : [];
  const childFolders = Array.isArray(subgroup?.folders) ? subgroup.folders : [];
  return `
    <section
      class="metadata-subgroup-card"
      data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
      data-metadata-group-id="${escapeHtml(subgroup?.groupId)}"
      data-metadata-folder-drop-target="true"
      style="--metadata-folder-depth:${escapeHtml(String(Math.max(0, depth)))}"
    >
      <div class="metadata-subgroup-card__heading">
        <label class="metadata-subgroup-title-field">
          <span class="metadata-folder-title-row">
            ${renderMetadataFolderIcon()}
            <input
              class="inline-title-input metadata-subgroup-title-input"
              type="text"
              value="${escapeHtml(subgroup?.title || "Notes")}"
              data-title-input
              data-edit-field="metadata-subgroup-title"
              data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
              aria-label="Folder name"
            />
          </span>
        </label>
        <div class="metadata-subgroup-card__actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="add-metadata-child-folder"
            data-metadata-group-id="${escapeHtml(subgroup?.groupId)}"
            data-metadata-parent-subgroup-id="${escapeHtml(subgroup?.id)}"
          >New folder</button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="add-metadata-folder-note"
            data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
          >New note</button>
          <button
            class="tag-button panel-action-button metadata-subgroup-danger"
            type="button"
            data-action="delete-metadata-folder"
            data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
          >Delete folder</button>
        </div>
      </div>
      <div class="metadata-subgroup-note-list">
        ${notes.length
          ? notes.map((note) => renderMetadataSubgroupNoteHTML(subgroup, note, { selectedNoteId })).join("")
          : `<div class="metadata-subgroup-empty-note">No notes in this folder yet.</div>`}
      </div>
      ${childFolders.length
        ? `
          <div class="metadata-subgroup-child-list">
            ${childFolders.map((child) => renderMetadataSubgroupHTML(child, {
              selectedNoteId,
              depth: depth + 1,
            })).join("")}
          </div>
        `
        : ""}
    </section>
  `;
}

function renderMetadataSubgroupNoteHTML(subgroup, note, {
  selectedNoteId = "",
} = {}) {
  const isSelected = selectedNoteId === note?.id;
  const anchor = note?.anchor ?? null;
  return `
    <article class="metadata-subgroup-note ${isSelected ? "is-selected" : ""}" data-metadata-note-id="${escapeHtml(note?.id)}">
      <input
        class="inline-title-input metadata-subgroup-note-title-input"
        type="text"
        value="${escapeHtml(note?.title || "Note")}"
        data-title-input
        data-edit-field="metadata-subgroup-note-title"
        data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
        data-metadata-note-id="${escapeHtml(note?.id)}"
        aria-label="Folder note title"
      />
      <textarea
        class="metadata-subgroup-note-body-input"
        data-edit-field="metadata-subgroup-note-body"
        data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
        data-metadata-note-id="${escapeHtml(note?.id)}"
        aria-label="Folder note body"
        rows="3"
      >${escapeHtml(note?.body || "")}</textarea>
      ${anchor ? renderMetadataSubgroupAnchorHTML(anchor) : ""}
      <div class="metadata-subgroup-note__actions">
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="point-metadata-subgroup-note-to-selection"
          data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
          data-metadata-note-id="${escapeHtml(note?.id)}"
        >Point to selected verse</button>
        ${anchor ? `
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="open-metadata-subgroup-note-anchor"
            data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
            data-metadata-note-id="${escapeHtml(note?.id)}"
          >Open verse</button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="clear-metadata-subgroup-note-anchor"
            data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
            data-metadata-note-id="${escapeHtml(note?.id)}"
          >Clear verse</button>
        ` : ""}
        <button
          class="tag-button panel-action-button metadata-subgroup-danger"
          type="button"
          data-action="delete-metadata-folder-note"
          data-metadata-subgroup-id="${escapeHtml(subgroup?.id)}"
          data-metadata-note-id="${escapeHtml(note?.id)}"
        >Delete</button>
      </div>
    </article>
  `;
}

function renderMetadataSubgroupAnchorHTML(anchor) {
  const label = [
    anchor.chapterTitle,
    anchor.sceneTitle,
  ].filter(Boolean).join(" / ") || "Manuscript verse";
  return `
    <p class="metadata-subgroup-anchor">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(anchor.selectedText ?? "").slice(0, 160))}</strong>
    </p>
  `;
}

function renderMetadataFolderIcon() {
  return `
    <svg class="metadata-folder-icon" viewBox="0 0 18 16" aria-hidden="true" focusable="false">
      <path d="M1.8 4.4c0-.8.6-1.4 1.4-1.4h4l1.4 1.7h6.2c.8 0 1.4.6 1.4 1.4v6.7c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4V4.4Z" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>
      <path d="M1.9 6.2h14.2" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>
    </svg>
  `;
}

function renderMetadataSubgroupEmptyHTML() {
  return `
    <div class="metadata-subgroup-empty">No folders yet.</div>
  `;
}
