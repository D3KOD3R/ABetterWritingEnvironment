// Intent: render anchored-record delete confirmation UI without owning preferences or delete effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function createDeleteConfirmationPreferences(candidate = {}) {
  return {
    passageNotes: Boolean(candidate?.passageNotes),
    tasks: Boolean(candidate?.tasks ?? candidate?.comments),
  };
}

export function renderDeleteConfirmationDialogHTML(dialog, preferences = {}) {
  if (!dialog) {
    return "";
  }

  const preferenceKey = dialog.preferenceKey === "tasks" ? "tasks" : "passageNotes";
  const skipConfirmation = Boolean(preferences?.[preferenceKey]);
  return `
    <div class="delete-confirmation-backdrop" data-action="cancel-delete-confirmation" aria-hidden="true"></div>
    <section class="delete-confirmation-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(dialog.title)}">
      <header class="delete-confirmation-header">
        <strong>${escapeHtml(dialog.title)}</strong>
        <button
          class="delete-confirmation-close"
          type="button"
          data-action="cancel-delete-confirmation"
          aria-label="Close delete confirmation"
          title="Close"
        >×</button>
      </header>
      <p class="delete-confirmation-copy">${escapeHtml(dialog.message)}</p>
      <label class="delete-confirmation-checkbox">
        <input
          type="checkbox"
          data-action="toggle-delete-confirmation-preference"
          data-confirmation-key="${escapeHtml(preferenceKey)}"
          ${skipConfirmation ? "checked" : ""}
        />
        <span>Do not ask me again</span>
      </label>
      <div class="delete-confirmation-actions">
        <button
          class="tag-button delete-confirmation-cancel"
          type="button"
          data-action="cancel-delete-confirmation"
        >Cancel</button>
        <button
          class="tag-button delete-confirmation-confirm"
          type="button"
          data-action="confirm-delete-confirmation"
        >Delete</button>
      </div>
    </section>
  `;
}
