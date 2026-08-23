// Intent: assemble durable project records from live editor state without owning UI capture behavior.

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function createProjectRuntimeRecordStateService({
  state,
  clone = cloneValue,
  getCurrentManuscriptWordCount,
  createProjectSettingsSnapshotFromState,
  captureSceneSelectionDefaultsForSave,
  captureInlinePassageDraftDefaultsForSave,
  createProjectRecordFromWorkspace,
  createTimestamp = () => new Date().toISOString(),
} = {}) {
  const requiredFunctions = {
    getCurrentManuscriptWordCount,
    createProjectSettingsSnapshotFromState,
    captureSceneSelectionDefaultsForSave,
    captureInlinePassageDraftDefaultsForSave,
    createProjectRecordFromWorkspace,
    createTimestamp,
  };

  if (!state || typeof state !== "object") {
    throw new Error("ProjectRuntimeRecordStateService requires state.");
  }
  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`ProjectRuntimeRecordStateService requires ${name}.`);
    }
  }

  // Intent: project identity metadata must be read from the record representing the live workspace.
  function getWorkspaceProjectRecord() {
    const workspaceProjectId = state.workspace?.project?.id;
    return Array.isArray(state.projectLibrary)
      ? state.projectLibrary.find((project) => project?.id === workspaceProjectId) ?? null
      : null;
  }

  // Intent: preserve a persisted project index across record rebuilding while the workspace stays active.
  function getCurrentProjectIndexRecord() {
    const workspaceProjectRecord = getWorkspaceProjectRecord();
    if (workspaceProjectRecord) {
      return workspaceProjectRecord;
    }

    return Array.isArray(state.projectLibrary)
      ? state.projectLibrary.find((project) => project?.id === state.activeProjectId) ?? null
      : null;
  }

  // Intent: create the canonical save payload from live state and externally captured editor selections.
  function createProjectRecordFromRuntimeState(options = {}) {
    if (!state.workspace?.project) {
      return null;
    }

    const workspaceProjectRecord = getWorkspaceProjectRecord();
    const currentProjectIndexRecord = getCurrentProjectIndexRecord();
    const updatedAt = options.updatedAt ?? createTimestamp();
    const projectSettings = createProjectSettingsSnapshotFromState({
      currentWordCount: getCurrentManuscriptWordCount(),
      now: new Date(updatedAt),
    });
    const sceneSelection = captureSceneSelectionDefaultsForSave();
    const workspaceSnapshot = clone(state.workspace);

    workspaceSnapshot.selectionDefaults = {
      ...(workspaceSnapshot.selectionDefaults && typeof workspaceSnapshot.selectionDefaults === "object"
        ? workspaceSnapshot.selectionDefaults
        : {}),
      sceneId: state.selectedSceneId ?? "",
      sceneSelectionBlockId: sceneSelection?.blockId ?? "",
      sceneSelectionLineNumber: sceneSelection?.lineNumber ?? null,
      sceneSelectionStart: sceneSelection?.startOffset ?? null,
      sceneSelectionEnd: sceneSelection?.endOffset ?? null,
      sceneSelectionScrollTop: sceneSelection?.scrollTop ?? null,
      sceneSelectionScrollLeft: sceneSelection?.scrollLeft ?? null,
      inlinePassageDraft: captureInlinePassageDraftDefaultsForSave(),
    };

    return createProjectRecordFromWorkspace(workspaceSnapshot, {
      ...options,
      id: state.workspace.project.id,
      title: state.projectTitle || state.workspace.project.title,
      source: options.source ?? workspaceProjectRecord?.source ?? "user",
      createdAt: options.createdAt ?? workspaceProjectRecord?.createdAt ?? state.workspace.generatedAt,
      updatedAt,
      sceneDrafts: state.sceneDrafts,
      structureDrafts: state.structureDrafts,
      templateDrafts: state.templateDrafts,
      persistedProjectIndex: currentProjectIndexRecord?.projectIndex ?? null,
      manuscriptTasks: state.manuscriptTasks,
      passageNotes: state.passageNotes,
      metadataSubgroups: state.metadataSubgroups,
      draftProofing: state.draftProofing,
      revisions: state.revisionState,
      sourceArchive: workspaceProjectRecord?.sourceArchive ?? [],
      importReport: workspaceProjectRecord?.importReport ?? {},
      projectSettings,
      editorPrefs: state.editorPrefs,
      localAiPrefs: state.localAiPrefs,
    });
  }

  return {
    createProjectRecordFromRuntimeState,
  };
}
