// Intent: verify project-scoped shortcut settings normalize, match key events, and render controls.
import assert from "node:assert/strict";

import {
  captureKeyboardShortcutFromEvent,
  createDefaultKeyboardShortcutSettings,
  findKeyboardShortcutConflict,
  normalizeKeyboardShortcutSettings,
  resolveKeyboardShortcutBehaviorIdForEvent,
  setKeyboardShortcutBinding,
} from "../apps/editor/public/state/keyboard-shortcut-state.js";
import {
  buildKeyboardShortcutSettingsWindowModel,
  renderKeyboardShortcutSettingsWindowHTML,
} from "../apps/editor/public/features/keyboard-shortcuts/keyboard-shortcut-settings-window.js";

export function runKeyboardShortcutSettingsTest() {
  const defaults = createDefaultKeyboardShortcutSettings();
  assert.equal(defaults.bindings["project.save"], "Ctrl+S");
  assert.equal(defaults.bindings["format.highlight"], "Ctrl+H");
  assert.equal(defaults.bindings["manuscript.dictionaryLookup"], "Ctrl+T");

  const normalized = normalizeKeyboardShortcutSettings({
    bindings: {
      "project.save": " ctrl + shift + p ",
      "format.bold": "",
      "unknown.behavior": "Ctrl+9",
    },
  });
  assert.equal(normalized.bindings["project.save"], "Ctrl+Shift+P");
  assert.equal(normalized.bindings["format.bold"], "");
  assert.equal(normalized.bindings["project.new"], "Ctrl+N");
  assert.equal(normalized.bindings["unknown.behavior"], undefined);

  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "s", ctrlKey: true }), defaults),
    "project.save",
  );
  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "z", ctrlKey: true, shiftKey: true }), defaults),
    "history.redo",
  );
  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "t", ctrlKey: true }), defaults),
    "manuscript.dictionaryLookup",
  );

  const customSave = setKeyboardShortcutBinding(defaults, "project.save", "F2").settings;
  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "F2" }), customSave),
    "project.save",
  );
  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "s", ctrlKey: true }), customSave),
    "",
  );
  assert.equal(
    resolveKeyboardShortcutBehaviorIdForEvent(createKeyEvent({ key: "a" }), {
      bindings: { "project.save": "A" },
    }),
    "",
  );

  assert.equal(
    findKeyboardShortcutConflict(defaults, "project.save", "Ctrl+Shift+Z")?.id,
    "history.redo",
  );
  assert.equal(
    findKeyboardShortcutConflict(defaults, "project.save", "Ctrl+T")?.id,
    "manuscript.dictionaryLookup",
  );
  assert.equal(captureKeyboardShortcutFromEvent(createKeyEvent({ key: "a" })).status, "invalid");
  assert.deepEqual(captureKeyboardShortcutFromEvent(createKeyEvent({ key: "F6" })), {
    status: "captured",
    shortcut: "F6",
    message: "",
  });
  assert.equal(captureKeyboardShortcutFromEvent(createKeyEvent({ key: "Escape" })).status, "cancelled");

  const model = buildKeyboardShortcutSettingsWindowModel({
    settings: customSave,
    captureBehaviorId: "project.save",
    statusMessage: "Capturing Save project.",
  });
  const projectGroup = model.groups.find((group) => group.category === "Project");
  assert.equal(projectGroup.rows.find((row) => row.id === "project.save").displayShortcut, "F2");
  assert.equal(projectGroup.rows.find((row) => row.id === "project.save").isCapturing, true);

  const html = renderKeyboardShortcutSettingsWindowHTML({
    settings: customSave,
    captureBehaviorId: "project.save",
    statusMessage: "Capturing Save project.",
  });
  assert.match(html, /keyboard-shortcut-settings-window/);
  assert.match(html, /data-action="start-keyboard-shortcut-capture"/);
  assert.match(html, /data-action="clear-keyboard-shortcut-binding"/);
  assert.match(html, /data-action="reset-keyboard-shortcut-binding"/);
  assert.match(html, /data-action="reset-all-keyboard-shortcuts"/);
  assert.match(html, /value="Capturing\.\.\."/);
  assert.match(html, /Save project/);
}

// Intent: keep keyboard event fixtures browser-shaped without depending on DOM APIs.
function createKeyEvent({
  key,
  ctrlKey = false,
  metaKey = false,
  altKey = false,
  shiftKey = false,
} = {}) {
  return {
    key,
    ctrlKey,
    metaKey,
    altKey,
    shiftKey,
  };
}
