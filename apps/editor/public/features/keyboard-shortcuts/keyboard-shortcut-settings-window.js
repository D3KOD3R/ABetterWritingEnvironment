// Intent: render user shortcut settings without owning persistence or command execution.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  KEYBOARD_SHORTCUT_BEHAVIORS,
  getEffectiveKeyboardShortcutsForBehavior,
  normalizeKeyboardShortcutSettings,
  normalizeKeyboardShortcutText,
} from "../../state/keyboard-shortcut-state.js";

// Intent: derive grouped row data for the project-scoped user shortcut settings window.
export function buildKeyboardShortcutSettingsWindowModel({
  settings = null,
  captureBehaviorId = "",
  statusMessage = "",
} = {}) {
  const normalizedSettings = normalizeKeyboardShortcutSettings(settings);
  const activeCaptureBehaviorId = String(captureBehaviorId ?? "").trim();
  const groups = [];
  const groupByCategory = new Map();

  for (const behavior of KEYBOARD_SHORTCUT_BEHAVIORS) {
    const currentShortcut = normalizeKeyboardShortcutText(
      normalizedSettings.bindings?.[behavior.id],
      { allowEmpty: true },
    );
    const defaultShortcut = normalizeKeyboardShortcutText(behavior.defaultShortcut, { allowEmpty: true });
    const alternateShortcuts = getEffectiveKeyboardShortcutsForBehavior(behavior, normalizedSettings)
      .filter((shortcut) => shortcut !== currentShortcut);
    const row = {
      id: behavior.id,
      label: behavior.label,
      description: behavior.description,
      scope: behavior.scope,
      shortcut: currentShortcut,
      displayShortcut: currentShortcut || "Unassigned",
      defaultShortcut,
      alternateShortcuts,
      isCapturing: activeCaptureBehaviorId === behavior.id,
      isDefault: currentShortcut === defaultShortcut,
      isAssigned: Boolean(currentShortcut),
    };

    if (!groupByCategory.has(behavior.category)) {
      const group = {
        category: behavior.category,
        rows: [],
      };
      groups.push(group);
      groupByCategory.set(behavior.category, group);
    }
    groupByCategory.get(behavior.category).rows.push(row);
  }

  return {
    groups,
    captureBehaviorId: activeCaptureBehaviorId,
    statusMessage: String(statusMessage ?? ""),
  };
}

// Intent: keep the shortcut editor compact enough to sit beside other Project settings windows.
export function renderKeyboardShortcutSettingsWindowHTML(options = {}) {
  const model = buildKeyboardShortcutSettingsWindowModel(options);
  return `
    <section class="keyboard-shortcut-settings-window" role="dialog" aria-label="Keyboard shortcut settings" data-keyboard-shortcut-settings-window>
      <header class="keyboard-shortcut-settings-window__header">
        <div>
          <p class="keyboard-shortcut-settings-window__kicker">User Settings</p>
          <h2>Shortcuts</h2>
        </div>
        <button
          class="keyboard-shortcut-settings-window__close"
          type="button"
          data-action="close-keyboard-shortcut-settings-window"
          aria-label="Close shortcut settings"
          title="Close"
        >&times;</button>
      </header>

      <div class="keyboard-shortcut-settings-window__toolbar">
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="reset-all-keyboard-shortcuts"
        >Reset all</button>
        ${model.statusMessage ? `<p class="keyboard-shortcut-settings-window__status">${escapeHtml(model.statusMessage)}</p>` : ""}
      </div>

      <div class="keyboard-shortcut-settings-window__group-list">
        ${model.groups.map(renderKeyboardShortcutGroup).join("")}
      </div>
    </section>
  `;
}

// Intent: group shortcuts by author-facing workspace area for scanning.
function renderKeyboardShortcutGroup(group) {
  return `
    <section class="keyboard-shortcut-settings-window__section">
      <span class="keyboard-shortcut-settings-window__label">${escapeHtml(group.category)}</span>
      <div class="keyboard-shortcut-settings-window__rows">
        ${group.rows.map(renderKeyboardShortcutRow).join("")}
      </div>
    </section>
  `;
}

// Intent: render one editable behavior binding while keeping the behavior ID machine-readable.
function renderKeyboardShortcutRow(row) {
  const shortcutValue = row.isCapturing ? "Capturing..." : row.displayShortcut;
  const defaultLabel = row.alternateShortcuts.length
    ? `Default ${row.defaultShortcut}; also ${row.alternateShortcuts.join(", ")}`
    : `Default ${row.defaultShortcut}`;
  return `
    <div class="keyboard-shortcut-settings-window__row ${row.isCapturing ? "is-capturing" : ""}">
      <div class="keyboard-shortcut-settings-window__row-copy">
        <strong>${escapeHtml(row.label)}</strong>
        <small>${escapeHtml(row.description)}</small>
      </div>
      <div class="keyboard-shortcut-settings-window__binding">
        <input
          type="text"
          value="${escapeHtml(shortcutValue)}"
          readonly
          data-keyboard-shortcut-input="${escapeHtml(row.id)}"
          aria-label="${escapeHtml(`${row.label} shortcut`)}"
        />
        <small>${escapeHtml(defaultLabel)}</small>
      </div>
      <div class="keyboard-shortcut-settings-window__actions">
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="start-keyboard-shortcut-capture"
          data-keyboard-shortcut-behavior-id="${escapeHtml(row.id)}"
        >Set</button>
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="clear-keyboard-shortcut-binding"
          data-keyboard-shortcut-behavior-id="${escapeHtml(row.id)}"
          ${row.isAssigned ? "" : "disabled"}
        >Clear</button>
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="reset-keyboard-shortcut-binding"
          data-keyboard-shortcut-behavior-id="${escapeHtml(row.id)}"
          ${row.isDefault ? "disabled" : ""}
        >Reset</button>
      </div>
    </div>
  `;
}
