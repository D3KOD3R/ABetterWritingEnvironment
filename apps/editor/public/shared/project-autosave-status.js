// Intent: derive one truthful project-file autosave status for every editor surface.
export function buildProjectAutosaveStatusModel(state, {
  connected = false,
  saveShortcutLabel = "Ctrl+S",
} = {}) {
  const enabled = state?.editorPrefs?.projectFileAutosaveEnabled === true;
  const manualSavePrompt = formatManualSavePrompt(saveShortcutLabel, { sentenceStart: true });
  const inlineManualSavePrompt = formatManualSavePrompt(saveShortcutLabel);
  const dirtyDomains = state?.projectPersistenceDirtyDomains && typeof state.projectPersistenceDirtyDomains === "object"
    ? Object.keys(state.projectPersistenceDirtyDomains)
    : [];
  const hasDirtyProjectFileState = state?.projectFileAutosaveDirty === true && dirtyDomains.length > 0;
  if (!enabled) {
    return createStatus({
      statusKey: "off",
      statusLabel: "Off",
      note: "Project-file autosave is disabled.",
      tone: "off",
    });
  }

  if (!connected) {
    if (state?.projectFileHandle && state?.projectFileHandlePermission !== "granted") {
      return createStatus({
        statusKey: "waiting",
        statusLabel: "Needs permission",
        note: `${manualSavePrompt} to re-authorize the project file.`,
        tone: "waiting",
      });
    }

    return createStatus({
      statusKey: "waiting",
      statusLabel: "Waiting",
      note: "Select a project file destination.",
      tone: "waiting",
    });
  }

  if (state?.projectFileBusy === true) {
    return createStatus({
      statusKey: "saving",
      statusLabel: "Saving",
      note: "Writing project snapshot.",
      tone: "saving",
    });
  }

  if ((Number(state?.projectFileAutosaveSuppressionDepth) || 0) > 0) {
    return createStatus({
      statusKey: "suppressed",
      statusLabel: "Suppressed",
      note: "Paused while project changes are batched.",
      tone: "suppressed",
    });
  }

  const blocked = state?.projectFileAutosaveBlocked;
  if (hasDirtyProjectFileState && blocked && typeof blocked === "object") {
    const permissionRequired = blocked.reason === "write-permission-required";
    const manualSaveRequired = blocked.reason === "manual-save-required";
    const failureCause = formatAutosaveFailureCause(blocked.errorMessage);
    return createStatus({
      statusKey: permissionRequired
        ? "permission-required"
        : manualSaveRequired
          ? "manual-save-required"
          : "out-of-sync",
      statusLabel: permissionRequired
        ? "Needs permission"
        : manualSaveRequired
          ? "Manual save"
          : "Out of sync",
      note: permissionRequired
        ? `Project file is out of sync. Latest changes are preserved in browser cache; ${inlineManualSavePrompt} to re-authorize.`
        : manualSaveRequired
          ? `Browser blocked background file writes. Latest changes are preserved in browser cache; ${inlineManualSavePrompt} to write the project file.`
          : failureCause
            ? `Project file is out of sync: ${failureCause} Latest changes are preserved in browser cache; ${inlineManualSavePrompt} to retry.`
            : `Project file is out of sync. Latest changes are preserved in browser cache; ${inlineManualSavePrompt} to retry.`,
      tone: "waiting",
    });
  }

  if (hasDirtyProjectFileState) {
    return createStatus({
      statusKey: "pending",
      statusLabel: "Pending",
      note: "Queued for idle save.",
      tone: "pending",
    });
  }

  return createStatus({
    statusKey: "ready",
    statusLabel: "Ready",
    note: "Project file is in sync.",
    tone: "ready",
  });
}

// Intent: let UI callers avoid stale hard-coded shortcut text after keymap customization.
function formatManualSavePrompt(saveShortcutLabel, { sentenceStart = false } = {}) {
  const shortcut = String(saveShortcutLabel ?? "").trim();
  if (shortcut) {
    return `${sentenceStart ? "Press" : "press"} ${shortcut}`;
  }

  return sentenceStart ? "Use Save" : "use Save";
}

// Intent: keep the autosave badge diagnostic useful without letting a raw stack or large error fill the header.
function formatAutosaveFailureCause(value) {
  const candidate = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!candidate) {
    return "";
  }

  const truncated = candidate.length > 180 ? `${candidate.slice(0, 177)}...` : candidate;
  return /[.!?]$/.test(truncated) ? truncated : `${truncated}.`;
}

function createStatus({
  statusKey,
  statusLabel,
  note,
  tone,
}) {
  return {
    label: "Autosave",
    statusKey,
    statusLabel,
    note,
    tone,
    toneClass: `is-${tone}`,
  };
}
