// Intent: derive one truthful project-file autosave status for every editor surface.
export function buildProjectAutosaveStatusModel(state, {
  connected = false,
} = {}) {
  const enabled = state?.editorPrefs?.projectFileAutosaveEnabled === true;
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
        note: "Press Ctrl+S to re-authorize the project file.",
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
  if (blocked && typeof blocked === "object") {
    const permissionRequired = blocked.reason === "write-permission-required";
    return createStatus({
      statusKey: permissionRequired ? "permission-required" : "out-of-sync",
      statusLabel: permissionRequired ? "Needs permission" : "Out of sync",
      note: permissionRequired
        ? "Project file is out of sync. Latest changes are preserved in browser cache; press Ctrl+S to re-authorize."
        : "Project file is out of sync. Latest changes are preserved in browser cache; press Ctrl+S to retry.",
      tone: "waiting",
    });
  }

  if (state?.projectFileAutosaveDirty === true) {
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
