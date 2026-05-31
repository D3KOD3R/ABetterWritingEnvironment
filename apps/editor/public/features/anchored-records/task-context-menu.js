// Intent: render anchored task/note context surfaces without owning record persistence effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function buildTaskComposerModel(composer, viewport = {}, options = {}) {
  if (!composer) {
    return null;
  }

  const isPassageNoteComposer = composer.composerType === "passage-note";
  const noteLabel = composer.noteType === "research" ? "Research" : "Inspiration";
  return {
    isPassageNoteComposer,
    noteLabel,
    excerpt: String(composer.selectedText ?? "").trim().slice(0, 120),
    left: clampMenuPosition(composer.x, viewport.width, 380),
    top: clampMenuPosition(composer.y, viewport.height, 260),
    editorStyle: String(options.editorStyle ?? ""),
    placeholder: isPassageNoteComposer
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
        class="task-composer"
        style="left:${model.left}px; top:${model.top}px; ${escapeHtml(model.editorStyle)}"
      >
        <label for="task-description-input">${escapeHtml(model.isPassageNoteComposer ? model.noteLabel : "Task body")}</label>
        <textarea
          id="task-description-input"
          class="task-description-input"
          placeholder="${escapeHtml(model.placeholder)}"
          ${model.isPassageNoteComposer ? "data-passage-note-body" : "data-task-description"}
        ></textarea>
        <p>${escapeHtml(model.excerpt)}</p>
        <div class="task-composer-actions">
          <button class="tag-button" type="button" data-action="${model.isPassageNoteComposer ? "save-passage-note" : "save-selection-task"}">
            ${escapeHtml(model.isPassageNoteComposer ? `Save ${model.noteLabel.toLowerCase()}` : "Add task")}
          </button>
          <button class="tag-button" type="button" data-action="cancel-selection-task">Cancel</button>
        </div>
      </form>
    `;
}

export function buildAnchoredRecordContextMenuModel(menu, viewport = {}) {
  if (!menu) {
    return null;
  }

  return {
    sceneId: String(menu.sceneId ?? ""),
    hasExplicitSelection: menu.hasExplicitSelection === true,
    excerpt: String(menu.selectedText ?? "").trim().slice(0, 80),
    left: clampMenuPosition(menu.x, viewport.width, 276),
    top: clampMenuPosition(menu.y, viewport.height, 230),
  };
}

export function renderAnchoredRecordContextMenuHTML(menu, viewport = {}) {
  const model = buildAnchoredRecordContextMenuModel(menu, viewport);
  if (!model) {
    return "";
  }

  return `
    <div
      class="task-context-menu"
      style="left:${model.left}px; top:${model.top}px;"
      role="menu"
      >
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
