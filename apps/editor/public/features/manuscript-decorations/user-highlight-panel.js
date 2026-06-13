// Intent: render author-created manuscript highlights as a decoration console without owning persistence.
import { normalizeManuscriptMarks } from "../manuscript-editor/manuscript-mark-service.js";
import { escapeHtml } from "../../shared/ui-utils.js";

const USER_HIGHLIGHT_KIND = "highlight";

export function buildUserHighlightPanelModel({
  marks = [],
  scenes = [],
  selectedHighlightId = "",
  activeSelection = null,
} = {}) {
  const sceneMap = new Map(
    (Array.isArray(scenes) ? scenes : [])
      .filter((scene) => typeof scene?.sceneId === "string" && scene.sceneId)
      .map((scene) => [scene.sceneId, scene]),
  );
  const groups = new Map();
  const normalizedMarks = normalizeManuscriptMarks(marks)
    .filter((mark) => mark.kind === USER_HIGHLIGHT_KIND && mark.source === "author")
    .sort((left, right) => compareHighlightMarks(left, right, sceneMap));

  for (const mark of normalizedMarks) {
    const scene = sceneMap.get(mark.anchor.sceneId) ?? null;
    const chapterKey = mark.anchor.chapterId || scene?.chapterId || "unassigned";
    const group = groups.get(chapterKey) ?? {
      chapterKey,
      chapterTitle: scene?.chapterTitle || "Unassigned chapter",
      chapterOrder: Number.isInteger(scene?.chapterOrder) ? scene.chapterOrder : Number.MAX_SAFE_INTEGER,
      highlights: [],
    };
    group.highlights.push(createUserHighlightItem(mark, scene, selectedHighlightId));
    groups.set(chapterKey, group);
  }

  return {
    activeSelection: createActiveSelectionItem(activeSelection, sceneMap),
    highlightCount: normalizedMarks.length,
    groups: [...groups.values()]
      .sort((left, right) => left.chapterOrder - right.chapterOrder || left.chapterTitle.localeCompare(right.chapterTitle)),
  };
}

export function renderUserHighlightPanelHTML(model, {
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  const highlightCount = Number.isInteger(model?.highlightCount) ? model.highlightCount : 0;

  return `
    <div class="panel-heading">
      <p class="panel-kicker">Decorations</p>
      <h2>User Highlights</h2>
    </div>
    ${renderUserHighlightSelectionCommandHTML(model?.activeSelection ?? null)}
    ${highlightCount ? `
      <div class="user-highlight-list console-list console-chapter-list">
        ${groups.map((group) => renderUserHighlightGroupHTML(group, {
          collapsedChapterIds,
          formatChapterTitle,
        })).join("")}
      </div>
    ` : renderEmptyUserHighlightStateHTML()}
  `;
}

function createUserHighlightItem(mark, scene, selectedHighlightId) {
  const selectedText = mark.evidenceExcerpt || mark.selectedTextPreview || "";
  return {
    id: mark.id,
    sceneId: mark.anchor.sceneId,
    blockId: mark.anchor.blockId,
    startOffset: mark.anchor.startOffset,
    endOffset: mark.anchor.endOffset,
    sceneTitle: scene?.sceneTitle || "Untitled scene",
    sceneOrder: Number.isInteger(scene?.sceneOrder) ? scene.sceneOrder : Number.MAX_SAFE_INTEGER,
    status: mark.anchorStatus || "resolved",
    selectedText,
    isSelected: selectedHighlightId === mark.id,
  };
}

function createActiveSelectionItem(selection, sceneMap) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const sceneId = typeof selection.sceneId === "string" ? selection.sceneId.trim() : "";
  const startOffset = Number(selection.startOffset);
  const endOffset = Number(selection.endOffset);
  if (!sceneId || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  const scene = sceneMap.get(sceneId) ?? null;
  return {
    sceneId,
    sceneTitle: selection.sceneTitle || scene?.sceneTitle || "Untitled scene",
    selectedText: String(selection.selectedText ?? "").trim(),
    startOffset,
    endOffset,
  };
}

function renderUserHighlightSelectionCommandHTML(activeSelection) {
  return `
    <div class="user-highlight-selection-command${activeSelection ? " has-selection" : ""}">
      <div class="user-highlight-selection-copy">
        ${activeSelection ? `
          <span class="console-meta">${escapeHtml(activeSelection.sceneTitle)} · ${escapeHtml(`${activeSelection.startOffset}-${activeSelection.endOffset}`)}</span>
          <strong>${escapeHtml(activeSelection.selectedText || "Selected manuscript passage")}</strong>
        ` : ""}
      </div>
      <button
        class="tag-button user-highlight-create"
        type="button"
        data-action="create-user-highlight-from-selection"
      >Highlight selection</button>
    </div>
  `;
}

function renderUserHighlightGroupHTML(group, {
  collapsedChapterIds = [],
  formatChapterTitle = defaultFormatChapterTitle,
} = {}) {
  const chapterKey = String(group?.chapterKey ?? "");
  if (!chapterKey) {
    return "";
  }

  const highlights = Array.isArray(group?.highlights) ? group.highlights : [];
  const isCollapsed = Array.isArray(collapsedChapterIds) && collapsedChapterIds.includes(chapterKey);
  return `
    <section class="console-chapter-group user-highlight-chapter-group${isCollapsed ? " is-collapsed" : ""}">
      <button
        class="console-chapter-heading"
        type="button"
        data-action="toggle-console-chapter-collapse"
        data-console-panel="decorations"
        data-chapter-key="${escapeHtml(chapterKey)}"
        aria-expanded="${isCollapsed ? "false" : "true"}"
      >
        <span class="console-chapter-disclosure" aria-hidden="true">${isCollapsed ? "&#9656;" : "&#9662;"}</span>
        <strong>${escapeHtml(formatChapterTitle(group?.chapterTitle))}</strong>
        <span class="console-chapter-count">${escapeHtml(String(highlights.length))}</span>
      </button>
      <div class="console-chapter-children">
        ${highlights.map(renderUserHighlightItemHTML).join("")}
      </div>
    </section>
  `;
}

function renderUserHighlightItemHTML(item) {
  return `
    <div
      class="console-item user-highlight-item ${item.isSelected ? "is-selected" : ""}"
      data-action="select-user-highlight"
      data-highlight-id="${escapeHtml(item.id)}"
      role="button"
      tabindex="0"
    >
      <span class="console-meta">${escapeHtml(item.sceneTitle)} · ${escapeHtml(formatAnchorStatus(item.status))}</span>
      <strong>${escapeHtml(item.selectedText || "Highlighted passage")}</strong>
      <span>${escapeHtml(`${item.startOffset}-${item.endOffset}`)}</span>
      <div class="user-highlight-actions">
        <button
          class="tag-button user-highlight-delete"
          type="button"
          data-action="delete-user-highlight"
          data-highlight-id="${escapeHtml(item.id)}"
          aria-label="Delete highlight"
          title="Delete highlight"
        >Delete</button>
      </div>
    </div>
  `;
}

function renderEmptyUserHighlightStateHTML() {
  return `
    <div class="empty-note-state">
      <strong>No user highlights yet.</strong>
      <span>Select manuscript text and press H.</span>
    </div>
  `;
}

function compareHighlightMarks(left, right, sceneMap) {
  const leftScene = sceneMap.get(left.anchor.sceneId) ?? {};
  const rightScene = sceneMap.get(right.anchor.sceneId) ?? {};
  return (
    (leftScene.chapterOrder ?? Number.MAX_SAFE_INTEGER) - (rightScene.chapterOrder ?? Number.MAX_SAFE_INTEGER) ||
    (leftScene.sceneOrder ?? Number.MAX_SAFE_INTEGER) - (rightScene.sceneOrder ?? Number.MAX_SAFE_INTEGER) ||
    String(left.anchor.sceneId).localeCompare(String(right.anchor.sceneId)) ||
    left.anchor.startOffset - right.anchor.startOffset ||
    left.id.localeCompare(right.id)
  );
}

function formatAnchorStatus(status) {
  return String(status ?? "resolved")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function defaultFormatChapterTitle(chapterTitle) {
  const value = String(chapterTitle ?? "").trim();
  return value || "Untitled chapter";
}
