// Intent: own project-file autosave timing and dirty-state transitions outside the editor shell.
export function createProjectFileAutosaveController({
  state,
  delayMs,
  windowRef = globalThis.window,
  getTarget,
  hasDestination,
  isBusy,
  isEnabled,
  save,
  setStatus,
  renderStatus,
}) {
  // Intent: make timer cleanup explicit because queued autosaves must not survive project switches.
  const clearTimer = () => {
    if (!state.projectFileAutosaveTimer) {
      return;
    }

    windowRef.clearTimeout(state.projectFileAutosaveTimer);
    state.projectFileAutosaveTimer = null;
  };

  const clearState = () => {
    clearTimer();
    state.projectFileAutosaveDirty = false;
    state.projectFileAutosaveTarget = null;
    state.projectFileAutosaveRevision = 0;
  };

  // Intent: schedule writes only when a writable destination is still connected and the editor is idle.
  const queue = () => {
    if (
      !state.projectFileAutosaveDirty ||
      state.projectFileAutosaveSuppressionDepth > 0 ||
      !isEnabled() ||
      !hasDestination()
    ) {
      return;
    }

    clearTimer();
    if (isBusy()) {
      return;
    }

    state.projectFileAutosaveTimer = windowRef.setTimeout(() => {
      state.projectFileAutosaveTimer = null;
      void flush();
    }, delayMs);
  };

  // Intent: let save/load flows batch changes without immediately writing partial project state.
  const beginSuppression = () => {
    state.projectFileAutosaveSuppressionDepth += 1;
  };

  const endSuppression = () => {
    if (state.projectFileAutosaveSuppressionDepth > 0) {
      state.projectFileAutosaveSuppressionDepth -= 1;
    }

    if (
      state.projectFileAutosaveSuppressionDepth === 0 &&
      state.projectFileAutosaveDirty &&
      isEnabled()
    ) {
      queue();
    }
  };

  // Intent: bind each dirty mark to the current project destination so stale autosave jobs can be discarded.
  const markDirty = () => {
    state.projectFileAutosaveDirty = true;
    state.projectFileAutosaveRevision += 1;
    state.projectFileAutosaveTarget = getTarget();
    queue();
  };

  const prime = () => {
    if (
      state.projectFileAutosaveDirty ||
      !isEnabled() ||
      !hasDestination()
    ) {
      return;
    }

    markDirty();
  };

  // Intent: write only if the dirty target still matches the active project file destination.
  const flush = async () => {
    if (
      !state.projectFileAutosaveDirty ||
      state.projectFileAutosaveSuppressionDepth > 0 ||
      !isEnabled() ||
      !hasDestination() ||
      isBusy()
    ) {
      return;
    }

    const target = state.projectFileAutosaveTarget;
    const currentTarget = getTarget();
    if (
      !target ||
      target.projectId !== currentTarget.projectId ||
      target.filePath !== currentTarget.filePath ||
      target.fileHandle !== currentTarget.fileHandle
    ) {
      clearState();
      return;
    }

    clearTimer();
    setStatus("Autosaving project file...");
    renderStatus();

    const saveRevision = state.projectFileAutosaveRevision;
    try {
      await save();
    } catch {
      // Save errors are surfaced by the project-file adapter caller.
    }

    if (state.projectFileAutosaveRevision === saveRevision) {
      clearState();
    }

    if (state.projectFileAutosaveDirty) {
      queue();
    }
  };

  return {
    beginSuppression,
    clearState,
    clearTimer,
    endSuppression,
    flush,
    isEnabled,
    markDirty,
    prime,
    queue,
  };
}
