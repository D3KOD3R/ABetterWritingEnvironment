// Intent: render top-chrome card customization controls without owning project persistence.
import { escapeHtml } from "../../shared/ui-utils.js";

export const TOP_PANEL_CUSTOMIZATION_GROUPS = Object.freeze([
  {
    id: "target-strip",
    kicker: "Writing panel",
    title: "Show cards",
  },
  {
    id: "chrome-stats",
    kicker: "Status cards",
    title: "Show cards",
  },
]);

export const TOP_PANEL_CARD_FEATURES = Object.freeze([
  {
    id: "draftProof",
    groupId: "target-strip",
    label: "Proof read",
    panes: ["manuscript"],
  },
  {
    id: "developerLogs",
    groupId: "target-strip",
    label: "Developer logs",
  },
  {
    id: "wordTarget",
    groupId: "target-strip",
    label: "Word target",
  },
  {
    id: "sessionTarget",
    groupId: "target-strip",
    label: "Daily target",
  },
  {
    id: "forecast",
    groupId: "target-strip",
    label: "Days to release",
  },
  {
    id: "sessionTracker",
    groupId: "target-strip",
    label: "Session tracker",
    panes: ["manuscript"],
  },
  {
    id: "autosave",
    groupId: "chrome-stats",
    label: "Autosave",
  },
  {
    id: "writingGoals",
    groupId: "chrome-stats",
    label: "Writing Goals",
  },
  {
    id: "revisions",
    groupId: "chrome-stats",
    label: "Revisions",
  },
]);

export function getTopPanelCustomizationGroup(groupId = "") {
  const normalizedGroupId = String(groupId ?? "").trim();
  return TOP_PANEL_CUSTOMIZATION_GROUPS.find((group) => group.id === normalizedGroupId) ?? TOP_PANEL_CUSTOMIZATION_GROUPS[0];
}

export function getTopPanelCustomizationFeatures({
  groupId = "",
  activePane = "manuscript",
} = {}) {
  const group = getTopPanelCustomizationGroup(groupId);
  return TOP_PANEL_CARD_FEATURES.filter((feature) =>
    feature.groupId === group.id && isFeatureAvailableForPane(feature, activePane)
  );
}

// Intent: decide whether a right-click should open the card-visibility checklist without stealing form/control menus.
export function getTopPanelCustomizationContextFromContextMenuTarget(target) {
  const region = findClosestTarget(target, "[data-top-panel-customization-region]");
  if (!region) {
    return null;
  }

  if (findClosestTarget(target, "[data-top-panel-customization]")) {
    return null;
  }

  const restoreTarget = findClosestTarget(target, "[data-top-panel-restore-target]");
  if (restoreTarget) {
    const groupId = String(restoreTarget.dataset?.topPanelRestoreTarget ?? "").trim();
    return groupId ? { groupId } : null;
  }

  if (findClosestTarget(target, "button, input, textarea, select, a, [role='button'], [data-action]")) {
    return null;
  }

  const groupId = String(region.dataset?.topPanelCustomizationRegion ?? "").trim();
  return groupId ? { groupId } : null;
}

export function renderTopPanelCustomizationPopoverHTML({
  open = false,
  groupId = "",
  activePane = "manuscript",
  position = null,
  visibility = {},
} = {}) {
  if (!open) {
    return "";
  }

  const group = getTopPanelCustomizationGroup(groupId);
  const features = getTopPanelCustomizationFeatures({
    groupId: group.id,
    activePane,
  });
  const safePosition = resolveTopPanelCustomizationPosition(position);
  const pageLabel = formatTopPanelCustomizationPageLabel(activePane);
  return `
    <div
      class="top-panel-customization-popover side-panel-customization-popover"
      data-top-panel-customization
      data-top-panel-customization-group="${escapeHtml(group.id)}"
      data-top-panel-customization-pane="${escapeHtml(String(activePane ?? "").trim() || "manuscript")}"
      role="dialog"
      aria-label="Customize top panel cards"
      style="left:${safePosition.x}px; top:${safePosition.y}px;"
    >
      <div class="side-panel-customization-heading">
        <div>
          <p class="panel-kicker">${escapeHtml(group.kicker)}</p>
          <h2>${escapeHtml(group.title)}</h2>
          <p class="top-panel-customization-scope">${escapeHtml(pageLabel)} page only</p>
        </div>
        <button
          class="side-panel-customization-close"
          type="button"
          data-action="close-top-panel-customization"
          aria-label="Close top panel customization"
          title="Close"
        >x</button>
      </div>
      ${renderTopPanelChecklistHTML({ features, visibility })}
      <div class="side-panel-customization-actions">
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="reset-top-panel-customization"
          data-top-panel-customization-group="${escapeHtml(group.id)}"
        >Show all</button>
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="hide-all-top-panel-customization"
          data-top-panel-customization-group="${escapeHtml(group.id)}"
        >Hide all</button>
      </div>
    </div>
  `;
}

function renderTopPanelChecklistHTML({
  features = [],
  visibility = {},
} = {}) {
  return `
    <div class="side-panel-feature-list" role="group" aria-label="Top panel card visibility">
      ${features.map((feature) => {
        const isChecked = visibility?.[feature.id] !== false;
        return `
          <label class="side-panel-feature-option">
            <input
              type="checkbox"
              data-top-panel-card-toggle="${escapeHtml(feature.id)}"
              ${isChecked ? "checked" : ""}
            />
            <span>
              <strong>${escapeHtml(feature.label)}</strong>
            </span>
            <b>${isChecked ? "Shown" : "Hidden"}</b>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function isFeatureAvailableForPane(feature, activePane) {
  if (!Array.isArray(feature?.panes) || !feature.panes.length) {
    return true;
  }

  return feature.panes.includes(String(activePane ?? "").trim() || "manuscript");
}

// Intent: show the author which feature page the visibility checklist will affect.
function formatTopPanelCustomizationPageLabel(activePane = "manuscript") {
  const normalizedPane = String(activePane ?? "").trim();
  if (normalizedPane === "world") {
    return "World";
  }

  if (normalizedPane === "narration" || normalizedPane === "voice") {
    return "Narration";
  }

  return "Manuscript";
}

function resolveTopPanelCustomizationPosition(position = null) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? Math.max(8, Math.round(x)) : 24,
    y: Number.isFinite(y) ? Math.max(8, Math.round(y)) : 120,
  };
}

function findClosestTarget(target, selector) {
  if (!target || typeof target.closest !== "function") {
    return null;
  }

  return target.closest(selector);
}
