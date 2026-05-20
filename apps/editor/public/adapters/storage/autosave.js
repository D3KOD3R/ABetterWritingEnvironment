// Intent: own project-file autosave timing and dirty-state transitions outside the editor shell.
export function createProjectFileAutosaveController({
  state,
  delayMs,
  logger = null,
  windowRef = globalThis.window,
  getTarget,
  hasDestination,
  isBusy,
  isEnabled,
  save,
  setStatus,
  renderStatus,
}) {
  let lastQueueSkipReason = "";
  const DEFAULT_DIRTY_DOMAIN = "project";

  const normalizeDirtyDomain = (value) => {
    const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
    return candidate || DEFAULT_DIRTY_DOMAIN;
  };

  const ensureDirtyDomainState = () => {
    if (!state.projectPersistenceDirtyDomains || typeof state.projectPersistenceDirtyDomains !== "object") {
      state.projectPersistenceDirtyDomains = {};
    }
    return state.projectPersistenceDirtyDomains;
  };

  const getDirtyDomainNames = () => Object.keys(ensureDirtyDomainState()).sort();

  const logDebug = (event, message, context = {}) => {
    if (!logger || typeof logger.debug !== "function") {
      return;
    }
    logger.debug("autosave", event, message, context);
  };

  const logInfo = (event, message, context = {}) => {
    if (!logger || typeof logger.info !== "function") {
      return;
    }
    logger.info("autosave", event, message, context);
  };

  const logWarn = (event, message, context = {}) => {
    if (!logger || typeof logger.warn !== "function") {
      return;
    }
    logger.warn("autosave", event, message, context);
  };

  const logError = (event, message, context = {}) => {
    if (!logger || typeof logger.error !== "function") {
      return;
    }
    logger.error("autosave", event, message, context);
  };

  const logQueueSkip = (reason, context = {}) => {
    if (lastQueueSkipReason === reason) {
      return;
    }
    lastQueueSkipReason = reason;
    logDebug("autosave.skipped", "Autosave queue skipped.", { reason, ...context });
  };

  // Intent: make timer cleanup explicit because queued autosaves must not survive project switches.
  const clearTimer = (reason = "clear") => {
    if (!state.projectFileAutosaveTimer) {
      return;
    }

    windowRef.clearTimeout(state.projectFileAutosaveTimer);
    state.projectFileAutosaveTimer = null;
    logDebug("autosave.cancelled", "Autosave timer cancelled.", { reason });
  };

  const clearState = () => {
    clearTimer("clear-state");
    state.projectFileAutosaveDirty = false;
    state.projectFileAutosaveTarget = null;
    state.projectFileAutosaveRevision = 0;
    state.projectPersistenceDirtyDomains = {};
    lastQueueSkipReason = "";
    logDebug("autosave.state-cleared", "Autosave dirty state cleared.");
  };

  // Intent: schedule writes only when a writable destination is still connected and the editor is idle.
  const queue = () => {
    if (!state.projectFileAutosaveDirty) {
      logQueueSkip("not-dirty");
      return;
    }

    if (state.projectFileAutosaveSuppressionDepth > 0) {
      logQueueSkip("suppressed", {
        suppressionDepth: state.projectFileAutosaveSuppressionDepth,
      });
      return;
    }

    if (!isEnabled()) {
      logQueueSkip("autosave-disabled");
      return;
    }

    if (!hasDestination()) {
      logQueueSkip("no-destination");
      return;
    }

    clearTimer("rescheduled-by-new-input");
    if (isBusy()) {
      logQueueSkip("busy");
      return;
    }
    lastQueueSkipReason = "";

    state.projectFileAutosaveTimer = windowRef.setTimeout(() => {
      state.projectFileAutosaveTimer = null;
      logInfo("autosave.idle-detected", "Idle detected; autosave flush starting.", {
        delayMs,
        dirtyDomains: getDirtyDomainNames(),
      });
      void flush();
    }, delayMs);
    logInfo("autosave.scheduled", "Autosave scheduled after idle window.", {
      delayMs,
      projectId: state.activeProjectId ?? state.workspace?.project?.id ?? "",
      dirtyDomains: getDirtyDomainNames(),
    });
  };

  // Intent: let save/load flows batch changes without immediately writing partial project state.
  const beginSuppression = () => {
    state.projectFileAutosaveSuppressionDepth += 1;
    logDebug("autosave.suppression-begin", "Autosave suppression incremented.", {
      suppressionDepth: state.projectFileAutosaveSuppressionDepth,
    });
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
    logDebug("autosave.suppression-end", "Autosave suppression decremented.", {
      suppressionDepth: state.projectFileAutosaveSuppressionDepth,
      dirty: state.projectFileAutosaveDirty === true,
    });
  };

  // Intent: bind each dirty mark to the current project destination so stale autosave jobs can be discarded.
  const markDirty = (context = {}) => {
    const domain = normalizeDirtyDomain(context.domain);
    const dirtyDomains = ensureDirtyDomainState();
    dirtyDomains[domain] = {
      markedAt: new Date().toISOString(),
      reason: typeof context.reason === "string" && context.reason.trim() ? context.reason.trim() : "user-edit",
      source: typeof context.source === "string" && context.source.trim() ? context.source.trim() : "persistence",
    };
    state.projectFileAutosaveDirty = true;
    state.projectFileAutosaveRevision += 1;
    state.projectFileAutosaveTarget = getTarget();
    logDebug("autosave.dirty-marked", "Editor mutation marked autosave as dirty.", {
      revision: state.projectFileAutosaveRevision,
      domain,
      dirtyDomainCount: Object.keys(dirtyDomains).length,
      dirtyDomains: getDirtyDomainNames(),
      projectId: state.projectFileAutosaveTarget?.projectId ?? "",
      filePath: state.projectFileAutosaveTarget?.filePath ?? "",
      hasHandle: Boolean(state.projectFileAutosaveTarget?.fileHandle),
    });
    queue();
  };

  // Intent: sync the active destination after a project switch without manufacturing dirty state.
  const prime = () => {
    if (
      state.projectFileAutosaveDirty ||
      !isEnabled() ||
      !hasDestination()
    ) {
      return;
    }

    clearTimer("prime");
    state.projectFileAutosaveTarget = getTarget();
    logDebug("autosave.prime", "Autosave target primed for current project destination.", {
      projectId: state.projectFileAutosaveTarget?.projectId ?? "",
      filePath: state.projectFileAutosaveTarget?.filePath ?? "",
      hasHandle: Boolean(state.projectFileAutosaveTarget?.fileHandle),
    });
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
      logQueueSkip("flush-precondition-failed", {
        dirty: state.projectFileAutosaveDirty === true,
        suppressionDepth: state.projectFileAutosaveSuppressionDepth,
        enabled: isEnabled() === true,
        hasDestination: hasDestination() === true,
        busy: isBusy() === true,
      });
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
      logWarn("autosave.skipped", "Autosave target changed before flush; pending write discarded.", {
        targetProjectId: target?.projectId ?? "",
        currentProjectId: currentTarget?.projectId ?? "",
      });
      clearState();
      return;
    }

    clearTimer("flush-start");
    setStatus("Autosaving project file...");
    renderStatus();

    const saveRevision = state.projectFileAutosaveRevision;
    logInfo("autosave.started", "Autosave write started.", {
      revision: saveRevision,
      dirtyDomains: getDirtyDomainNames(),
      projectId: currentTarget?.projectId ?? "",
      filePath: currentTarget?.filePath ?? "",
      hasHandle: Boolean(currentTarget?.fileHandle),
    });
    let saveSucceeded = false;
    try {
      await save();
      saveSucceeded = true;
      logInfo("autosave.succeeded", "Autosave write succeeded.", {
        revision: saveRevision,
      });
    } catch {
      // Save errors are surfaced by the project-file adapter caller.
      logError("autosave.failed", "Autosave write failed.", {
        revision: saveRevision,
      });
    }

    if (saveSucceeded && state.projectFileAutosaveRevision === saveRevision) {
      clearState();
    }

    if (saveSucceeded && state.projectFileAutosaveDirty) {
      logInfo("autosave.rescheduled", "Autosave detected new edits during write; scheduling another run.", {
        revision: state.projectFileAutosaveRevision,
      });
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
