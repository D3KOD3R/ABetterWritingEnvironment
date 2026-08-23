// Intent: render console panel customization controls without owning panel state or persistence.
import { escapeHtml } from "../../shared/ui-utils.js";

export const SIDE_PANEL_FEATURES = Object.freeze([
  {
    id: "issues",
    label: "Tasks",
  },
  {
    id: "inspiration",
    label: "Inspiration",
  },
  {
    id: "research",
    label: "Research",
  },
  // BENCHED: Spotify now lives in the top chrome; the service remains available for revival if the console tab returns.
]);

// Intent: render only the feature buttons the author has left visible.
export function renderSidePanelTabsHTML({
  activePanelId = "issues",
  visiblePanelIds = [],
  counts = {},
  features = SIDE_PANEL_FEATURES,
  showCreateButton = false,
} = {}) {
  const visibleIds = new Set(Array.isArray(visiblePanelIds) ? visiblePanelIds : []);
  const visibleFeatures = features.filter((feature) => visibleIds.has(feature.id));
  const tabCount = visibleFeatures.length + (showCreateButton ? 1 : 0);
  const scrollHint = tabCount > 3;
  return `
    <div
      class="side-panel-tabs ${visibleFeatures.length ? "" : "has-no-visible-panels"} ${scrollHint ? "is-scrollable" : ""}"
      aria-label="Editor side panel modes"
      data-side-panel-tabs
      data-scroll-hint="${scrollHint ? "true" : "false"}"
      title="${scrollHint ? "Scroll to see other metadata options" : ""}"
    >
      ${visibleFeatures.map((feature) => renderSidePanelTabHTML(feature, {
        activePanelId,
        count: counts[feature.id] ?? 0,
      })).join("")}
      ${showCreateButton ? renderCreateMetadataTabHTML() : ""}
    </div>
  `;
}

// Intent: render the floating checklist opened from right-clicking active console whitespace.
export function renderSidePanelCustomizationPopoverHTML({
  open = false,
  position = null,
  visibility = {},
  counts = {},
  features = SIDE_PANEL_FEATURES,
} = {}) {
  if (!open) {
    return "";
  }

  const safePosition = resolveCustomizationPosition(position);
  return `
    <div
      class="side-panel-customization-popover"
      data-side-panel-customization
      role="dialog"
      aria-label="Customize console panels"
      style="left:${safePosition.x}px; top:${safePosition.y}px;"
    >
      <div class="side-panel-customization-heading">
        <div>
          <p class="panel-kicker">Console panels</p>
          <h2>Customize</h2>
        </div>
        <button
          class="side-panel-customization-close"
          type="button"
          data-action="close-side-panel-customization"
          aria-label="Close console panel customization"
          title="Close"
        >x</button>
      </div>
      ${renderSidePanelChecklistHTML({ features, visibility, counts })}
      <div class="side-panel-customization-actions">
        <button class="tag-button panel-action-button" type="button" data-action="reset-side-panel-customization">Show all</button>
        <button class="tag-button panel-action-button" type="button" data-action="open-custom-metadata-form">New metadata</button>
      </div>
    </div>
  `;
}

// Intent: keep every hidden panel recoverable when no console feature buttons remain visible.
export function renderHiddenSidePanelOverviewHTML({
  visibility = {},
  counts = {},
  features = SIDE_PANEL_FEATURES,
} = {}) {
  return `
    <div class="side-panel-hidden-overview" data-side-panel-customization>
      <div class="side-panel-customization-heading">
        <div>
          <p class="panel-kicker">Console panels</p>
          <h2>All hidden</h2>
        </div>
      </div>
      ${renderSidePanelChecklistHTML({ features, visibility, counts })}
      <div class="side-panel-customization-actions">
        <button class="tag-button panel-action-button" type="button" data-action="open-custom-metadata-form">New metadata</button>
      </div>
    </div>
  `;
}

function renderSidePanelTabHTML(feature, {
  activePanelId = "",
  count = 0,
} = {}) {
  const isActive = activePanelId === feature.id;
  const visual = renderSidePanelFeatureVisualHTML(feature, "metadata-image-icon--tab");
  return `
    <button
      class="side-panel-tab ${feature.custom ? "is-custom-metadata" : ""} ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-side-panel"
      data-side-panel="${escapeHtml(feature.id)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${visual}${escapeHtml(feature.label)}</span>
      <strong>${escapeHtml(String(count))}</strong>
    </button>
  `;
}

function renderCreateMetadataTabHTML() {
  return `
    <button
      class="side-panel-tab side-panel-tab--create"
      type="button"
      data-action="open-custom-metadata-form"
      aria-label="Create custom metadata"
      title="Create custom metadata"
    >
      <span>+</span>
      <strong>New</strong>
    </button>
  `;
}

function renderSidePanelChecklistHTML({
  features = SIDE_PANEL_FEATURES,
  visibility = {},
  counts = {},
} = {}) {
  return `
    <div class="side-panel-feature-list" role="group" aria-label="Console panel visibility">
      ${features.map((feature) => {
        const isChecked = visibility?.[feature.id] !== false;
        return `
          <label class="side-panel-feature-option">
            <input
              type="checkbox"
              data-side-panel-feature-toggle="${escapeHtml(feature.id)}"
              ${isChecked ? "checked" : ""}
            />
            <span class="side-panel-feature-option__label">
              ${renderSidePanelFeatureVisualHTML(feature, "metadata-image-icon--checklist")}
              <strong>${escapeHtml(feature.label)}</strong>
            </span>
            <b>${escapeHtml(String(counts[feature.id] ?? 0))}</b>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function resolveCustomizationPosition(position = null) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? Math.max(8, Math.round(x)) : 24,
    y: Number.isFinite(y) ? Math.max(8, Math.round(y)) : 120,
  };
}

function renderSidePanelFeatureVisualHTML(feature, iconClassName = "") {
  if (feature?.custom && feature?.icon?.dataUrl) {
    return `
      <img
        class="metadata-image-icon ${escapeHtml(iconClassName)}"
        src="${escapeHtml(feature.icon.dataUrl)}"
        alt=""
        aria-hidden="true"
        draggable="false"
      />
    `;
  }

  return feature?.custom && feature.highlightColor
    ? `<span class="metadata-color-swatch" style="--metadata-swatch-color:${escapeHtml(feature.highlightColor)}" aria-hidden="true"></span>`
    : "";
}
