// Intent: provide reusable, escaped form-field components so project lifecycle dialogs do not duplicate field markup.
import { escapeHtml } from "./ui-utils.js";

function normalizeDataAttributeName(value, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^data-[a-z0-9_.:-]+$/.test(normalized) ? normalized : fallback;
}

export function renderFormTextFieldHTML({
  label = "",
  value = "",
  fieldName = "",
  fieldAttribute = "data-form-field",
  placeholder = "",
  disabled = false,
  spellcheck = null,
} = {}) {
  const dataAttribute = normalizeDataAttributeName(fieldAttribute, "data-form-field");
  const disabledAttribute = disabled ? "disabled" : "";
  const placeholderAttribute = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : "";
  const spellcheckAttribute = spellcheck === true
    ? ' spellcheck="true"'
    : spellcheck === false
      ? ' spellcheck="false"'
      : "";

  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input ${dataAttribute}="${escapeHtml(fieldName)}" value="${escapeHtml(value)}"${placeholderAttribute}${spellcheckAttribute} ${disabledAttribute} />
    </label>
  `;
}

export function renderDirectoryLocationFieldHTML({
  label = "Location",
  value = "",
  fieldName = "locationPath",
  fieldAttribute = "data-form-field",
  browseAction = "browse-directory-path",
  placeholder = "Absolute folder path",
  disabled = false,
} = {}) {
  const dataAttribute = normalizeDataAttributeName(fieldAttribute, "data-form-field");
  const disabledAttribute = disabled ? "disabled" : "";

  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <div class="project-package-dialog__path-row">
        <input
          ${dataAttribute}="${escapeHtml(fieldName)}"
          value="${escapeHtml(value)}"
          placeholder="${escapeHtml(placeholder)}"
          spellcheck="false"
          ${disabledAttribute}
        />
        <button type="button" data-action="${escapeHtml(browseAction)}" ${disabledAttribute}>Browse</button>
      </div>
    </label>
  `;
}
