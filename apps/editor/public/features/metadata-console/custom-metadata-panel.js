// Intent: render custom metadata definition controls without owning persistence.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  CUSTOM_METADATA_ICON_ACCEPT,
  CUSTOM_METADATA_ICON_MAX_BYTES,
  DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR,
} from "./custom-metadata-service.js";

export function renderCustomMetadataFormHTML({
  open = false,
  draft = {},
  error = "",
} = {}) {
  if (!open) {
    return "";
  }

  const label = String(draft?.label ?? "");
  const highlightColor = String(draft?.highlightColor ?? DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR);
  const icon = draft?.icon && typeof draft.icon === "object" ? draft.icon : null;
  const normalizedError = String(error ?? "").trim();

  return `
    <div class="custom-metadata-form" data-custom-metadata-form role="dialog" aria-label="Create custom metadata">
      <button
        class="form-dismiss-button custom-metadata-form__dismiss"
        type="button"
        data-action="close-custom-metadata-form"
        aria-label="Cancel custom metadata form"
        title="Cancel"
      >&times;</button>
      <div class="custom-metadata-form__heading">
        <div>
          <p class="panel-kicker">Custom metadata</p>
          <h2>New tag</h2>
        </div>
      </div>
      <label class="custom-metadata-form__field">
        <span>Name</span>
        <input
          type="text"
          data-custom-metadata-name
          maxlength="32"
          value="${escapeHtml(label)}"
          placeholder="Lore"
        />
      </label>
      <label class="custom-metadata-form__field custom-metadata-form__color">
        <span>Highlight</span>
        <input
          type="color"
          data-custom-metadata-color
          value="${escapeHtml(highlightColor)}"
        />
      </label>
      <label class="custom-metadata-form__field custom-metadata-form__icon">
        <span>Icon image</span>
        <input
          type="file"
          data-custom-metadata-icon
          accept="${escapeHtml(CUSTOM_METADATA_ICON_ACCEPT)}"
        />
        <small>${escapeHtml(formatCustomMetadataIconLimitLabel())}</small>
      </label>
      ${icon?.dataUrl ? `
        <div class="custom-metadata-form__icon-preview" aria-hidden="true">
          <img src="${escapeHtml(icon.dataUrl)}" alt="" draggable="false" />
        </div>
      ` : ""}
      ${normalizedError ? `<p class="custom-metadata-form__error">${escapeHtml(normalizedError)}</p>` : ""}
      <div class="custom-metadata-form__actions">
        <button class="tag-button panel-action-button" type="button" data-action="save-custom-metadata-definition">Create</button>
      </div>
    </div>
  `;
}

function formatCustomMetadataIconLimitLabel() {
  const kilobytes = Math.round(CUSTOM_METADATA_ICON_MAX_BYTES / 1024);
  return `PNG, JPG, WebP, or GIF. ${kilobytes} KB max.`;
}
