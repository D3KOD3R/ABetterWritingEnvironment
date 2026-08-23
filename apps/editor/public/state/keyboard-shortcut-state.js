// Intent: own editor keyboard shortcut behavior metadata and preference normalization outside the shell.

const KEYBOARD_SHORTCUT_MODIFIER_ORDER = Object.freeze(["Ctrl", "Alt", "Shift"]);
const KEYBOARD_SHORTCUT_MODIFIER_ALIASES = Object.freeze({
  control: "Ctrl",
  ctrl: "Ctrl",
  command: "Ctrl",
  cmd: "Ctrl",
  meta: "Ctrl",
  option: "Alt",
  alt: "Alt",
  shift: "Shift",
});
const KEYBOARD_SHORTCUT_MODIFIER_KEYS = new Set(["Control", "Ctrl", "Alt", "Shift", "Meta"]);
const KEYBOARD_SHORTCUT_STANDALONE_KEY_PATTERN = /^F(?:[1-9]|1[0-2])$/;

export const KEYBOARD_SHORTCUT_BEHAVIORS = Object.freeze([
  {
    id: "project.save",
    category: "Project",
    label: "Save project",
    description: "Write the active project through the project persistence service.",
    defaultShortcut: "Ctrl+S",
    scope: "global",
  },
  {
    id: "project.saveAs",
    category: "Project",
    label: "Save project as",
    description: "Choose a new save destination for the active project.",
    defaultShortcut: "Ctrl+Shift+S",
    scope: "global",
  },
  {
    id: "project.load",
    category: "Project",
    label: "Load project",
    description: "Open a project save file.",
    defaultShortcut: "Ctrl+Shift+O",
    scope: "global",
  },
  {
    id: "project.new",
    category: "Project",
    label: "New project",
    description: "Create a blank authoring project.",
    defaultShortcut: "Ctrl+N",
    scope: "global",
  },
  {
    id: "project.openMenu",
    category: "Project",
    label: "Project file menu",
    description: "Open the file menu and focus the project path field.",
    defaultShortcut: "Ctrl+O",
    scope: "global",
  },
  {
    id: "project.developerLogs",
    category: "Project",
    label: "Developer logs",
    description: "Open the developer log window.",
    defaultShortcut: "Ctrl+Shift+L",
    scope: "global",
  },
  {
    id: "manuscript.find",
    category: "Manuscript",
    label: "Find manuscript",
    description: "Open manuscript find and replacement controls.",
    defaultShortcut: "Ctrl+F",
    scope: "global",
  },
  {
    id: "manuscript.dictionaryLookup",
    category: "Manuscript",
    label: "Dictionary lookup",
    description: "Look up the word immediately behind the manuscript cursor.",
    defaultShortcut: "Ctrl+T",
    scope: "manuscript-editor",
  },
  {
    id: "writingTargets.toggle",
    category: "Writing",
    label: "Writing goals",
    description: "Open or close the writing goals dashboard.",
    defaultShortcut: "Ctrl+Alt+T",
    scope: "global",
  },
  {
    id: "pane.manuscript",
    category: "Workspace",
    label: "Manuscript pane",
    description: "Switch to the manuscript workspace.",
    defaultShortcut: "Ctrl+1",
    scope: "global",
  },
  {
    id: "pane.world",
    category: "Workspace",
    label: "World pane",
    description: "Switch to the World Spine workspace.",
    defaultShortcut: "Ctrl+2",
    scope: "global",
  },
  {
    id: "pane.narration",
    category: "Workspace",
    label: "Narration pane",
    description: "Switch to the narration and voice workspace.",
    defaultShortcut: "Ctrl+3",
    scope: "global",
  },
  {
    id: "pane.voice",
    category: "Workspace",
    label: "Voice pane",
    description: "Switch to the narration and voice workspace.",
    defaultShortcut: "Ctrl+4",
    scope: "global",
  },
  {
    id: "format.bold",
    category: "Manuscript formatting",
    label: "Bold",
    description: "Toggle bold author decoration in the manuscript editor.",
    defaultShortcut: "Ctrl+B",
    scope: "manuscript-editor",
  },
  {
    id: "format.italic",
    category: "Manuscript formatting",
    label: "Italic",
    description: "Toggle italic author decoration in the manuscript editor.",
    defaultShortcut: "Ctrl+I",
    scope: "manuscript-editor",
  },
  {
    id: "format.highlight",
    category: "Manuscript formatting",
    label: "Highlight",
    description: "Toggle highlight author decoration in the manuscript editor.",
    defaultShortcut: "Ctrl+H",
    scope: "manuscript-editor",
  },
  {
    id: "history.undo",
    category: "History",
    label: "Undo",
    description: "Undo editor-owned manuscript marks, binder moves, or World Spine edits.",
    defaultShortcut: "Ctrl+Z",
    scope: "contextual",
  },
  {
    id: "history.redo",
    category: "History",
    label: "Redo",
    description: "Redo editor-owned manuscript marks, binder moves, or World Spine edits.",
    defaultShortcut: "Ctrl+Y",
    defaultAlternates: ["Ctrl+Shift+Z"],
    scope: "contextual",
  },
  {
    id: "inlineNote.commit",
    category: "Metadata",
    label: "Save inline note",
    description: "Commit the inline passage-note composer.",
    defaultShortcut: "Ctrl+Enter",
    scope: "inline-note",
  },
]);

const KEYBOARD_SHORTCUT_BEHAVIOR_BY_ID = new Map(
  KEYBOARD_SHORTCUT_BEHAVIORS.map((behavior) => [behavior.id, behavior]),
);

// Intent: build a complete keymap so missing project settings can be repaired deterministically.
export function createDefaultKeyboardShortcutSettings() {
  return {
    schemaVersion: 1,
    bindings: Object.fromEntries(
      KEYBOARD_SHORTCUT_BEHAVIORS.map((behavior) => [
        behavior.id,
        normalizeKeyboardShortcutText(behavior.defaultShortcut),
      ]),
    ),
  };
}

// Intent: keep persisted shortcut preferences bounded to known editor behaviors.
export function normalizeKeyboardShortcutSettings(candidate) {
  const defaults = createDefaultKeyboardShortcutSettings();
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const candidateBindings = source.bindings && typeof source.bindings === "object" && !Array.isArray(source.bindings)
    ? source.bindings
    : source;
  const bindings = {};

  for (const behavior of KEYBOARD_SHORTCUT_BEHAVIORS) {
    if (Object.prototype.hasOwnProperty.call(candidateBindings, behavior.id)) {
      const normalizedShortcut = normalizeKeyboardShortcutText(candidateBindings[behavior.id], {
        allowEmpty: true,
      });
      bindings[behavior.id] = normalizedShortcut;
      continue;
    }

    bindings[behavior.id] = defaults.bindings[behavior.id];
  }

  return {
    schemaVersion: 1,
    bindings,
  };
}

// Intent: normalize saved or captured shortcut strings into one comparison format.
export function normalizeKeyboardShortcutText(value, options = {}) {
  const allowEmpty = options.allowEmpty !== false;
  const rawValue = typeof value === "string"
    ? value.trim()
    : typeof value?.shortcut === "string"
      ? value.shortcut.trim()
      : "";
  if (!rawValue) {
    return allowEmpty ? "" : null;
  }

  const modifierSet = new Set();
  let keyToken = "";
  for (const rawPart of rawValue.split("+")) {
    const part = rawPart.trim();
    if (!part) {
      continue;
    }

    const modifier = KEYBOARD_SHORTCUT_MODIFIER_ALIASES[part.toLowerCase()];
    if (modifier) {
      modifierSet.add(modifier);
      continue;
    }

    keyToken = normalizeKeyboardShortcutKeyName(part);
  }

  if (!keyToken || KEYBOARD_SHORTCUT_MODIFIER_KEYS.has(keyToken)) {
    return allowEmpty ? "" : null;
  }

  return [
    ...KEYBOARD_SHORTCUT_MODIFIER_ORDER.filter((modifier) => modifierSet.has(modifier)),
    keyToken,
  ].join("+");
}

// Intent: convert browser key names and imported labels into compact shortcut tokens.
export function normalizeKeyboardShortcutKeyName(value) {
  const rawKey = String(value ?? "").trim();
  if (!rawKey) {
    return "";
  }

  const lowerKey = rawKey.toLowerCase();
  if (lowerKey === " ") {
    return "Space";
  }
  if (lowerKey === "esc") {
    return "Escape";
  }
  if (lowerKey === "return") {
    return "Enter";
  }
  if (lowerKey === "spacebar") {
    return "Space";
  }
  if (lowerKey === "del") {
    return "Delete";
  }
  if (lowerKey === "arrowup") {
    return "ArrowUp";
  }
  if (lowerKey === "arrowright") {
    return "ArrowRight";
  }
  if (lowerKey === "arrowdown") {
    return "ArrowDown";
  }
  if (lowerKey === "arrowleft") {
    return "ArrowLeft";
  }
  if (/^f(?:[1-9]|1[0-2])$/.test(lowerKey)) {
    return lowerKey.toUpperCase();
  }
  if (/^[a-z]$/.test(lowerKey)) {
    return lowerKey.toUpperCase();
  }

  return rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
}

// Intent: derive a shortcut from a browser key event for matching or capture flows.
export function createKeyboardShortcutFromEvent(event) {
  if (!event || typeof event.key !== "string") {
    return "";
  }

  const keyName = normalizeKeyboardShortcutKeyName(event.key);
  if (!keyName || KEYBOARD_SHORTCUT_MODIFIER_KEYS.has(keyName)) {
    return "";
  }

  const modifiers = [];
  if (event.ctrlKey || event.metaKey) {
    modifiers.push("Ctrl");
  }
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }

  return [...modifiers, keyName].join("+");
}

// Intent: keep capture validation separate from the browser event listener side effects.
export function captureKeyboardShortcutFromEvent(event) {
  const shortcut = createKeyboardShortcutFromEvent(event);
  const keyName = normalizeKeyboardShortcutKeyName(event?.key);
  if (!shortcut) {
    return {
      status: "pending",
      shortcut: "",
      message: "",
    };
  }

  if (shortcut === "Escape") {
    return {
      status: "cancelled",
      shortcut: "",
      message: "Shortcut capture cancelled.",
    };
  }

  if (!hasShortcutModifier(shortcut) && !KEYBOARD_SHORTCUT_STANDALONE_KEY_PATTERN.test(keyName)) {
    return {
      status: "invalid",
      shortcut,
      message: "Use Ctrl, Alt, or a function key.",
    };
  }

  return {
    status: "captured",
    shortcut,
    message: "",
  };
}

// Intent: resolve the first user-configured behavior matching a keyboard event.
export function resolveKeyboardShortcutBehaviorIdForEvent(event, settings, options = {}) {
  const eventShortcut = createKeyboardShortcutFromEvent(event);
  if (!eventShortcut) {
    return "";
  }
  if (!isExecutableKeyboardShortcut(eventShortcut)) {
    return "";
  }

  const behaviorIds = Array.isArray(options.behaviorIds)
    ? new Set(options.behaviorIds)
    : null;
  const normalizedSettings = normalizeKeyboardShortcutSettings(settings);
  for (const behavior of KEYBOARD_SHORTCUT_BEHAVIORS) {
    if (behaviorIds && !behaviorIds.has(behavior.id)) {
      continue;
    }

    if (getEffectiveKeyboardShortcutsForBehavior(behavior, normalizedSettings).includes(eventShortcut)) {
      return behavior.id;
    }
  }

  return "";
}

// Intent: compare a proposed binding with all other active bindings and default alternates.
export function findKeyboardShortcutConflict(settings, behaviorId, shortcut) {
  const normalizedBehaviorId = String(behaviorId ?? "").trim();
  const normalizedShortcut = normalizeKeyboardShortcutText(shortcut, { allowEmpty: true });
  if (!normalizedBehaviorId || !normalizedShortcut) {
    return null;
  }

  const normalizedSettings = normalizeKeyboardShortcutSettings(settings);
  for (const behavior of KEYBOARD_SHORTCUT_BEHAVIORS) {
    if (behavior.id === normalizedBehaviorId) {
      continue;
    }

    if (getEffectiveKeyboardShortcutsForBehavior(behavior, normalizedSettings).includes(normalizedShortcut)) {
      return behavior;
    }
  }

  return null;
}

// Intent: update one known behavior binding without mutating the caller's settings object.
export function setKeyboardShortcutBinding(settings, behaviorId, shortcut) {
  const normalizedBehaviorId = String(behaviorId ?? "").trim();
  if (!KEYBOARD_SHORTCUT_BEHAVIOR_BY_ID.has(normalizedBehaviorId)) {
    return {
      settings: normalizeKeyboardShortcutSettings(settings),
      changed: false,
    };
  }

  const normalizedSettings = normalizeKeyboardShortcutSettings(settings);
  const nextShortcut = normalizeKeyboardShortcutText(shortcut, { allowEmpty: true });
  const previousShortcut = normalizedSettings.bindings[normalizedBehaviorId] ?? "";
  normalizedSettings.bindings[normalizedBehaviorId] = nextShortcut;
  return {
    settings: normalizedSettings,
    changed: previousShortcut !== nextShortcut,
  };
}

// Intent: restore one behavior to the app's current default binding.
export function resetKeyboardShortcutBinding(settings, behaviorId) {
  const behavior = KEYBOARD_SHORTCUT_BEHAVIOR_BY_ID.get(String(behaviorId ?? "").trim());
  if (!behavior) {
    return {
      settings: normalizeKeyboardShortcutSettings(settings),
      changed: false,
    };
  }

  return setKeyboardShortcutBinding(settings, behavior.id, behavior.defaultShortcut);
}

// Intent: restore the whole keymap without affecting unrelated editor preferences.
export function resetKeyboardShortcutSettings() {
  return createDefaultKeyboardShortcutSettings();
}

// Intent: expose safe behavior metadata lookup to UI and dispatch layers.
export function getKeyboardShortcutBehavior(behaviorId) {
  return KEYBOARD_SHORTCUT_BEHAVIOR_BY_ID.get(String(behaviorId ?? "").trim()) ?? null;
}

// Intent: report the shortcuts a behavior currently accepts, including default alternates.
export function getEffectiveKeyboardShortcutsForBehavior(behavior, settings) {
  const normalizedSettings = normalizeKeyboardShortcutSettings(settings);
  const primary = normalizeKeyboardShortcutText(
    normalizedSettings.bindings?.[behavior.id] ?? behavior.defaultShortcut,
    { allowEmpty: true },
  );
  if (!primary) {
    return [];
  }

  const defaultPrimary = normalizeKeyboardShortcutText(behavior.defaultShortcut, { allowEmpty: true });
  const defaultAlternates = Array.isArray(behavior.defaultAlternates)
    ? behavior.defaultAlternates
        .map((shortcut) => normalizeKeyboardShortcutText(shortcut, { allowEmpty: true }))
        .filter(Boolean)
    : [];
  return primary === defaultPrimary
    ? [primary, ...defaultAlternates]
    : [primary];
}

// Intent: determine whether a captured shortcut is safe for app-wide command use.
function hasShortcutModifier(shortcut) {
  return String(shortcut ?? "")
    .split("+")
    .some((part) => KEYBOARD_SHORTCUT_MODIFIER_ORDER.includes(part));
}

// Intent: prevent imported plain-letter bindings from hijacking manuscript typing.
function isExecutableKeyboardShortcut(shortcut) {
  const keyName = String(shortcut ?? "").split("+").at(-1) ?? "";
  return hasShortcutModifier(shortcut) || KEYBOARD_SHORTCUT_STANDALONE_KEY_PATTERN.test(keyName);
}
