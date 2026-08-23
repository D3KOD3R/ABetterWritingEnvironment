// Intent: own spellcheck context-menu view modeling and markup while shell handlers own effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function buildSpellcheckContextMenuModel(menu, viewport = {}) {
  if (!menu) {
    return null;
  }

  const mode = menu.mode === "selection" ? "selection" : "word";
  const suggestions = Array.isArray(menu.suggestions) ? menu.suggestions : [];
  const words = Array.isArray(menu.words) && menu.words.length
    ? menu.words
    : (menu.word ? [menu.word] : []);
  const menuWidth = mode === "selection" ? 440 : 360;
  const menuHeight = mode === "selection" ? 320 : 300;
  const viewportWidth = Number(viewport.width ?? 0) || menuWidth;
  const viewportHeight = Number(viewport.height ?? 0) || menuHeight;
  const left = Math.min(Math.max(8, Number(menu.x) || 0), Math.max(8, viewportWidth - menuWidth));
  const top = Math.min(Math.max(8, Number(menu.y) || 0), Math.max(8, viewportHeight - menuHeight));

  return {
    mode,
    suggestions,
    words,
    left,
    top,
    startOffset: menu.startOffset,
    endOffset: menu.endOffset,
    sceneId: menu.sceneId,
    word: menu.normalizedWord ?? menu.word ?? "",
    displayWord: words[0] ?? menu.word ?? "",
  };
}

export function renderSpellcheckContextMenuHTML(menu, viewport = {}) {
  const model = buildSpellcheckContextMenuModel(menu, viewport);
  if (!model) {
    return "";
  }

  return `
      <div
        class="task-context-menu grammar-check-context-menu spellcheck-context-menu"
        style="left:${model.left}px; top:${model.top}px;"
        role="menu"
        data-spellcheck-menu
      >
        <div class="spellcheck-context-menu__header">
          <div class="spellcheck-context-menu__selection-list" aria-label="Flagged spelling word">
            ${model.words.length
              ? model.words.map((word) => `<span class="spellcheck-context-menu__chip">${escapeHtml(word)}</span>`).join("")
              : `<p class="spellcheck-context-menu__empty">No flagged words found.</p>`}
          </div>
          <button class="spellcheck-context-menu__dictionary-button" data-action="add-grammar-check-dictionary" role="menuitem">
            <span class="task-menu-icon" aria-hidden="true">+</span>
            <span>Add to project dictionary</span>
          </button>
          ${model.mode === "word" && model.displayWord
            ? `
              <button
                class="spellcheck-context-menu__dictionary-button"
                data-action="lookup-dictionary-word"
                data-dictionary-word="${escapeHtml(model.displayWord)}"
                data-dictionary-normalized-word="${escapeHtml(model.word)}"
                data-dictionary-scene-id="${escapeHtml(model.sceneId)}"
                data-dictionary-start-offset="${escapeHtml(String(model.startOffset))}"
                data-dictionary-end-offset="${escapeHtml(String(model.endOffset))}"
                data-dictionary-x="${escapeHtml(String(model.left))}"
                data-dictionary-y="${escapeHtml(String(model.top))}"
                role="menuitem"
              >
                <span class="task-menu-icon" aria-hidden="true">d</span>
                <span>Dictionary</span>
              </button>
            `
            : ""}
        </div>
        ${model.mode === "word" && model.suggestions.length
          ? `
            <div class="spellcheck-context-menu__suggestions">
              ${model.suggestions.map((suggestion) => `
                <button
                  class="task-menu-item spellcheck-suggestion-item"
                  data-action="apply-spellcheck-suggestion"
                  data-spellcheck-replacement="${escapeHtml(suggestion)}"
                  data-spellcheck-start-offset="${escapeHtml(String(model.startOffset))}"
                  data-spellcheck-end-offset="${escapeHtml(String(model.endOffset))}"
                  data-spellcheck-scene-id="${escapeHtml(model.sceneId)}"
                  data-spellcheck-word="${escapeHtml(model.word)}"
                  role="menuitem"
                >
                  <span class="task-menu-icon" aria-hidden="true">✓</span>
                  <span>${escapeHtml(suggestion)}</span>
                </button>
              `).join("")}
            </div>
          `
          : ""}
      </div>
    `;
}
