// Intent: render anchored task/note context surfaces without owning record persistence effects.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  getMetadataNoteLabel,
  normalizeCustomMetadataDefinitions,
} from "../metadata-console/custom-metadata-service.js";

export function buildTaskComposerModel(composer, viewport = {}, options = {}) {
  if (!composer) {
    return null;
  }

  const isPassageNoteComposer = composer.composerType === "passage-note";
  const isWorldSpineEventComposer = composer.composerType === "world-spine-event";
  const noteLabel = composer.metadataLabel || getMetadataNoteLabel(composer.noteType);
  return {
    isPassageNoteComposer,
    isWorldSpineEventComposer,
    noteLabel,
    fieldLabel: isWorldSpineEventComposer
      ? "World Spine event"
      : isPassageNoteComposer
        ? noteLabel
        : "Task body",
    saveLabel: isWorldSpineEventComposer
      ? "Add World Spine event"
      : isPassageNoteComposer
        ? `Save ${noteLabel.toLowerCase()}`
        : "Add task",
    saveAction: isWorldSpineEventComposer
      ? "save-world-spine-event"
      : isPassageNoteComposer
        ? "save-passage-note"
        : "save-selection-task",
    excerpt: String(composer.selectedText ?? "").trim().slice(0, 120),
    left: clampMenuPosition(composer.x, viewport.width, 380),
    top: clampMenuPosition(composer.y, viewport.height, 260),
    editorStyle: String(options.editorStyle ?? ""),
    placeholder: isWorldSpineEventComposer
      ? "Name the story event for the World Spine..."
      : isPassageNoteComposer
      ? String(options.passageNotePlaceholder ?? "")
      : "Describe what needs to be done for this task...",
  };
}

export function renderTaskComposerHTML(composer, viewport = {}, options = {}) {
  const model = buildTaskComposerModel(composer, viewport, options);
  if (!model) {
    return "";
  }

  return `
      <form
        class="task-composer has-form-dismiss"
        style="left:${model.left}px; top:${model.top}px; ${escapeHtml(model.editorStyle)}"
      >
        <button
          class="form-dismiss-button task-composer__dismiss"
          type="button"
          data-action="cancel-selection-task"
          aria-label="Cancel ${escapeHtml(model.fieldLabel)} form"
          title="Cancel"
        >&times;</button>
        <label for="task-description-input">${escapeHtml(model.fieldLabel)}</label>
        <textarea
          id="task-description-input"
          class="task-description-input"
          placeholder="${escapeHtml(model.placeholder)}"
          ${model.isWorldSpineEventComposer ? "data-world-spine-event-label" : model.isPassageNoteComposer ? "data-passage-note-body" : "data-task-description"}
        ></textarea>
        <p>${escapeHtml(model.excerpt)}</p>
        <div class="task-composer-actions">
          <button class="tag-button" type="button" data-action="${model.saveAction}">
            ${escapeHtml(model.saveLabel)}
          </button>
        </div>
      </form>
    `;
}

export function buildAnchoredRecordContextMenuModel(menu, viewport = {}, {
  customMetadataDefinitions = [],
} = {}) {
  if (!menu) {
    return null;
  }

  return {
    sceneId: String(menu.sceneId ?? ""),
    hasExplicitSelection: menu.hasExplicitSelection === true,
    excerpt: String(menu.selectedText ?? "").trim().slice(0, 80),
    left: clampMenuPosition(menu.x, viewport.width, 276),
    top: clampMenuPosition(menu.y, viewport.height, 280),
    dictionaryContext: normalizeDictionaryMenuContext(menu.dictionaryContext),
    customMetadataDefinitions: normalizeCustomMetadataDefinitions(customMetadataDefinitions),
  };
}

export function renderAnchoredRecordContextMenuHTML(menu, viewport = {}, options = {}) {
  const model = buildAnchoredRecordContextMenuModel(menu, viewport, options);
  if (!model) {
    return "";
  }

  return `
    <div
      class="task-context-menu"
      style="left:${model.left}px; top:${model.top}px;"
      role="menu"
      >
      ${model.dictionaryContext ? renderDictionaryMenuItem(model.dictionaryContext) : ""}
      <button class="task-menu-item" data-action="add-selection-task" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">+</span>
        <span>${escapeHtml(model.hasExplicitSelection ? "Add task" : "Add task from line")}</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="inspiration" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">i</span>
        <span>Add inspiration</span>
      </button>
      <button class="task-menu-item" data-action="add-passage-note" data-note-type="research" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">r</span>
        <span>Add research</span>
      </button>
      <button class="task-menu-item" data-action="add-world-spine-event" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">w</span>
        <span>${escapeHtml(model.hasExplicitSelection ? "Add World Spine event" : "Add World Spine event from line")}</span>
      </button>
      ${model.customMetadataDefinitions.map((definition) => `
        <button class="task-menu-item task-menu-item--metadata" style="--metadata-menu-color:${escapeHtml(definition.highlightColor)}" data-action="add-passage-note" data-note-type="${escapeHtml(definition.id)}" role="menuitem">
          <span class="task-menu-icon task-menu-icon--metadata" aria-hidden="true">${renderTaskMenuMetadataIconHTML(definition)}</span>
          <span>Add ${escapeHtml(definition.label)}</span>
        </button>
      `).join("")}
      <button class="task-menu-item" data-action="trim-scene-whitespace" data-scene-id="${escapeHtml(model.sceneId)}" role="menuitem">
        <span class="task-menu-icon" aria-hidden="true">↧</span>
        <span>Trim scene whitespace</span>
      </button>
      <p>${escapeHtml(model.excerpt)}</p>
    </div>
  `;
}

function clampMenuPosition(value, viewportSize, menuSize) {
  return Math.min(
    Math.max(8, Number(value) || 0),
    Math.max(8, (Number(viewportSize) || menuSize) - menuSize),
  );
}

function normalizeDictionaryMenuContext(context) {
  if (!context || typeof context !== "object") {
    return null;
  }

  const word = String(context.word ?? "").trim();
  const normalizedWord = String(context.normalizedWord ?? "").trim();
  const sceneId = String(context.sceneId ?? "").trim();
  const startOffset = Number(context.startOffset);
  const endOffset = Number(context.endOffset);
  if (!word || !normalizedWord || !sceneId || !Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    return null;
  }

  return {
    word,
    normalizedWord,
    sceneId,
    startOffset,
    endOffset,
    x: Number(context.x) || 0,
    y: Number(context.y) || 0,
  };
}

function renderDictionaryMenuItem(context) {
  return `
    <button
      class="task-menu-item"
      data-action="lookup-dictionary-word"
      data-dictionary-word="${escapeHtml(context.word)}"
      data-dictionary-normalized-word="${escapeHtml(context.normalizedWord)}"
      data-dictionary-scene-id="${escapeHtml(context.sceneId)}"
      data-dictionary-start-offset="${escapeHtml(String(context.startOffset))}"
      data-dictionary-end-offset="${escapeHtml(String(context.endOffset))}"
      data-dictionary-x="${escapeHtml(String(context.x))}"
      data-dictionary-y="${escapeHtml(String(context.y))}"
      role="menuitem"
    >
      <span class="task-menu-icon" aria-hidden="true">d</span>
      <span>Dictionary</span>
    </button>
  `;
}

function renderTaskMenuMetadataIconHTML(definition) {
  if (definition?.icon?.dataUrl) {
    return `
      <img
        class="metadata-image-icon metadata-image-icon--task-menu"
        src="${escapeHtml(definition.icon.dataUrl)}"
        alt=""
        draggable="false"
      />
    `;
  }

  return "m";
}
