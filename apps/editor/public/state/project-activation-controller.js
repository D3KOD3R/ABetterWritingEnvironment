// Intent: coordinate project activation effects around state hydration without embedding them in the editor shell.

export function createProjectActivationController({
  state,
  clone,
  applyProjectRecordToState,
  persistActiveProjectId,
  saveWritingTargetState,
  clearWritingTargetDraft,
  clearWritingTargetSnapshotTimer,
  clearProjectAutosaveState,
  getNarrationRecordingRuntime,
  setNarrationRecordingRuntime,
  cleanupNarrationRecordingRuntime,
  getVoiceRecordingPreviewAudio,
  setVoiceRecordingPreviewAudio,
  getVoiceRecordingPreviewUrl,
  setVoiceRecordingPreviewUrl,
  revokeObjectUrl,
  clearBinderTitleClickState,
  writeProjectSourcePath,
  writeBinderWidth,
  writeConsoleWidth,
  writePanelResizerLayoutProfiles,
  persistConsoleDockCollapsedState,
  persistCollapsedChapterState,
  persistCollapsedConsoleChapterState,
  readWritingTargetStore,
  writeWritingTargetStore,
  syncLegacyProjectStorageFromState,
  logWritingTargetDebugEvent,
  projectLoadGateLog,
  manuscriptStateLog,
  refreshScenes,
  restoreSelectionFromWorkspaceDefaults,
  syncWritingTargetState,
  refreshWritingTargetSessionLifecycle,
  logWritingTargetLoadCheckpoint,
  render,
  recordWritingTargetSnapshot,
} = {}) {
  const requiredFunctions = {
    applyProjectRecordToState,
    persistActiveProjectId,
    saveWritingTargetState,
    clearWritingTargetDraft,
    clearWritingTargetSnapshotTimer,
    clearProjectAutosaveState,
    getNarrationRecordingRuntime,
    setNarrationRecordingRuntime,
    cleanupNarrationRecordingRuntime,
    getVoiceRecordingPreviewAudio,
    setVoiceRecordingPreviewAudio,
    getVoiceRecordingPreviewUrl,
    setVoiceRecordingPreviewUrl,
    revokeObjectUrl,
    clearBinderTitleClickState,
    writeProjectSourcePath,
    writeBinderWidth,
    writeConsoleWidth,
    writePanelResizerLayoutProfiles,
    persistConsoleDockCollapsedState,
    persistCollapsedChapterState,
    persistCollapsedConsoleChapterState,
    readWritingTargetStore,
    writeWritingTargetStore,
    syncLegacyProjectStorageFromState,
    logWritingTargetDebugEvent,
    refreshScenes,
    restoreSelectionFromWorkspaceDefaults,
    syncWritingTargetState,
    refreshWritingTargetSessionLifecycle,
    logWritingTargetLoadCheckpoint,
    render,
    recordWritingTargetSnapshot,
    clone,
  };

  if (!state || typeof state !== "object") {
    throw new Error("ProjectActivationController requires state.");
  }
  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`ProjectActivationController requires ${name}.`);
    }
  }

  // Intent: end in-flight recording and preview resources before a different project becomes active.
  function stopProjectScopedMedia() {
    const narrationRuntime = getNarrationRecordingRuntime();
    cleanupNarrationRecordingRuntime(narrationRuntime);
    setNarrationRecordingRuntime(null);
    state.narrationTakeSelection = null;
    state.narrationTakeSession = null;
    state.narrationRecordingReview = null;
    state.narrationRecordingPreviewId = null;

    const previewAudio = getVoiceRecordingPreviewAudio();
    if (previewAudio) {
      try {
        previewAudio.pause();
      } catch {
        // Ignore cleanup failures while replacing the active project.
      }
      setVoiceRecordingPreviewAudio(null);
    }
    const previewUrl = getVoiceRecordingPreviewUrl();
    if (previewUrl) {
      revokeObjectUrl(previewUrl);
      setVoiceRecordingPreviewUrl(null);
    }
  }

  // Intent: persist compatibility settings after state hydration until all consumers use canonical records.
  function persistActivatedProjectCompatibilityState(record) {
    writeProjectSourcePath(state.projectSourcePath);
    writeBinderWidth(state.binderPanelWidth);
    writeConsoleWidth(state.consoleDockWidth);
    writePanelResizerLayoutProfiles(state.panelResizerLayoutProfiles);
    persistConsoleDockCollapsedState(state.consoleDockCollapsed);
    persistCollapsedChapterState(record.id, state.collapsedChapterIds);
    persistCollapsedConsoleChapterState(record.id, state.collapsedConsoleChapterIds);
    const writingTargetStore = readWritingTargetStore();
    writingTargetStore[record.id] = clone(state.writingTargetState);
    writeWritingTargetStore(writingTargetStore);
    syncLegacyProjectStorageFromState();
  }

  // Intent: replace the active project and run required teardown/persistence effects once.
  function applyProjectRecord(record) {
    if (!record) {
      throw new Error("Unable to load a saved project.");
    }
    projectLoadGateLog?.info?.("lifecycle", "project.apply.begin", "Applying project record into runtime state.", {
      projectId: record.id,
      title: record.title,
    });
    saveWritingTargetState({
      skipProjectFileAutosave: true,
    });
    clearWritingTargetDraft();
    clearWritingTargetSnapshotTimer();
    clearProjectAutosaveState();
    stopProjectScopedMedia();
    applyProjectRecordToState(record);
    persistActiveProjectId(record.id);
    clearBinderTitleClickState();
    persistActivatedProjectCompatibilityState(record);
    logWritingTargetDebugEvent("info", "project.apply", "Applied project record into editor state.", {
      projectId: record.id,
      title: record.title,
      sceneDraftCount: Object.keys(state.sceneDrafts ?? {}).length,
      writingTargetHistoryEntries: Array.isArray(state.writingTargetState?.history) ? state.writingTargetState.history.length : 0,
      writingTargetDailyBaselineWordCount: state.writingTargetState?.dailyBaselineWordCount ?? 0,
      writingTargetDailyBaselineDateKey: state.writingTargetState?.dailyBaselineDateKey ?? "",
    }, {
      skipUpload: true,
    });
    manuscriptStateLog?.info?.("state-change", "state.hydration.completed", "State hydration completed from active project record.", {
      projectId: record.id,
      sceneDraftCount: Object.keys(state.sceneDrafts ?? {}).length,
      selectedSceneId: state.selectedSceneId ?? "",
    });
  }

  // Intent: provide the shared activation path used by project switching, creation, and loaded snapshots.
  function activateProjectRecord(record, {
    reason = "",
    refreshSessionLifecycle = false,
    logLoadCheckpoint = false,
    beforeRender = null,
    renderAfter = false,
    afterRender = null,
    recordSnapshot = false,
  } = {}) {
    applyProjectRecord(record);
    refreshScenes();
    restoreSelectionFromWorkspaceDefaults();
    syncWritingTargetState({ forceReload: true });
    if (refreshSessionLifecycle) {
      refreshWritingTargetSessionLifecycle({ reason });
    }
    if (logLoadCheckpoint) {
      logWritingTargetLoadCheckpoint(reason);
    }
    if (typeof beforeRender === "function") {
      beforeRender();
    }
    if (renderAfter) {
      render();
    }
    if (typeof afterRender === "function") {
      afterRender();
    }
    if (recordSnapshot) {
      recordWritingTargetSnapshot({
        immediate: true,
        reason,
        skipProjectFileAutosave: true,
      });
    }
  }

  return {
    applyProjectRecord,
    activateProjectRecord,
  };
}
