// Intent: own durable project-record construction and normalization apart from live editor runtime effects.

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

export function createProjectRecordStateService({
  clone = cloneValue,
  createStructureDrafts,
  createTemplateDrafts,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  normalizeManuscriptTasks,
  normalizePassageNotes,
  normalizeMetadataSubgroups = (value) => Array.isArray(value) ? clone(value) : [],
  normalizeDraftProofingState = () => ({ schemaVersion: 1, activeRunId: "", runs: [] }),
  normalizeProjectSelectionDefaults,
  normalizeProjectSettingsSnapshot,
  buildProjectSettingsCandidate,
  getProjectRecordWordCountForSettings,
  getPersistableRevisionProjectState,
  buildProjectIndexForRecord,
  buildWorkspaceStatsFromProjectIndex,
  projectSchemaVersion,
} = {}) {
  const requiredFunctions = {
    createStructureDrafts,
    createTemplateDrafts,
    createDefaultEditorPrefs,
    createDefaultLocalAiPrefs,
    normalizeManuscriptTasks,
    normalizePassageNotes,
    normalizeProjectSelectionDefaults,
    normalizeProjectSettingsSnapshot,
    buildProjectSettingsCandidate,
    getProjectRecordWordCountForSettings,
    getPersistableRevisionProjectState,
    buildProjectIndexForRecord,
    buildWorkspaceStatsFromProjectIndex,
  };
  for (const [name, fn] of Object.entries(requiredFunctions)) {
    if (typeof fn !== "function") {
      throw new Error(`ProjectRecordStateService requires ${name}.`);
    }
  }

  const schemaVersion = Number(projectSchemaVersion) || 1;

  // Intent: normalize loaded records before they enter either the project library or runtime state.
  function normalizeProjectRecord(candidate, legacyState = null) {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }

    const workspace = clone(candidate.workspace ?? {});
    const workspaceProject = workspace?.project && typeof workspace.project === "object" ? workspace.project : null;
    if (!workspaceProject) {
      return null;
    }

    const id =
      typeof candidate.id === "string" && candidate.id.trim()
        ? candidate.id
        : typeof workspaceProject.id === "string" && workspaceProject.id.trim()
          ? workspaceProject.id
          : `project-${Date.now()}`;
    const title =
      typeof legacyState?.projectTitle === "string" && legacyState.projectTitle.trim()
        ? legacyState.projectTitle
        : typeof candidate.title === "string" && candidate.title.trim()
          ? candidate.title
          : typeof workspaceProject.title === "string" && workspaceProject.title.trim()
            ? workspaceProject.title
            : "Untitled Project";
    const now = new Date().toISOString();

    workspace.project = {
      ...workspaceProject,
      id,
      title,
    };
    workspace.workspaceTitle =
      typeof workspace.workspaceTitle === "string" && workspace.workspaceTitle.trim()
        ? workspace.workspaceTitle
        : "ABetterNovelAuthoringEnvironment";
    workspace.selectionDefaults = normalizeProjectSelectionDefaults(workspace.selectionDefaults, workspace.project);
    const sceneDrafts =
      candidate.sceneDrafts && typeof candidate.sceneDrafts === "object"
        ? candidate.sceneDrafts
        : legacyState?.sceneDrafts ?? {};
    const projectSettings = normalizeProjectSettingsSnapshot(
      buildProjectSettingsCandidate({
        ...clone(candidate),
        editorPrefs: candidate.editorPrefs ?? legacyState?.editorPrefs,
        localAiPrefs: candidate.localAiPrefs ?? legacyState?.localAiPrefs,
        projectFilePath: candidate.projectSettings?.projectFilePath ?? candidate.projectFilePath ?? legacyState?.projectFilePath,
        projectSourcePath: candidate.projectSourcePath ?? legacyState?.projectSourcePath,
      }),
      id,
      getProjectRecordWordCountForSettings({
        workspace,
        sceneDrafts,
        projectIndex: candidate.projectIndex ?? null,
      }),
      new Date(now),
    );
    const metadataGroupIds = getMetadataSubgroupGroupIds(projectSettings);

    const normalizedRecord = {
      id,
      title,
      source: typeof candidate.source === "string" ? candidate.source : "user",
      createdAt:
        typeof candidate.createdAt === "string" && candidate.createdAt.trim()
          ? candidate.createdAt
          : workspace.generatedAt ?? now,
      updatedAt:
        typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
          ? candidate.updatedAt
          : candidate.createdAt ?? workspace.generatedAt ?? now,
      workspace,
      sceneDrafts: clone(sceneDrafts),
      structureDrafts:
        candidate.structureDrafts && typeof candidate.structureDrafts === "object"
          ? clone(candidate.structureDrafts)
          : legacyState?.structureDrafts ?? createStructureDrafts(),
      templateDrafts: Array.isArray(candidate.templateDrafts)
        ? clone(candidate.templateDrafts)
        : legacyState?.templateDrafts ?? createTemplateDrafts(),
      manuscriptTasks: normalizeManuscriptTasks(candidate.manuscriptTasks ?? legacyState?.manuscriptTasks),
      passageNotes: normalizePassageNotes(candidate.passageNotes ?? legacyState?.passageNotes),
      metadataSubgroups: normalizeMetadataSubgroups(candidate.metadataSubgroups ?? legacyState?.metadataSubgroups, metadataGroupIds),
      draftProofing: normalizeDraftProofingState(candidate.draftProofing ?? legacyState?.draftProofing),
      sourceArchive: Array.isArray(candidate.sourceArchive) ? clone(candidate.sourceArchive) : [],
      importReport: candidate.importReport && typeof candidate.importReport === "object"
        ? clone(candidate.importReport)
        : {},
      projectSettings,
      editorPrefs: clone(projectSettings.editorPrefs),
      localAiPrefs: clone(projectSettings.localAiPrefs),
    };
    const revisionState = getPersistableRevisionProjectState(candidate.revisions);
    if (revisionState) {
      normalizedRecord.revisions = revisionState;
    }
    normalizedRecord.schemaVersion = Number(candidate.schemaVersion) || schemaVersion;
    normalizedRecord.projectIndex = buildProjectIndexForRecord(normalizedRecord, candidate.projectIndex);
    normalizedRecord.workspace.project.stats = buildWorkspaceStatsFromProjectIndex(
      normalizedRecord.projectIndex,
      normalizedRecord.workspace.project.stats,
    );
    return normalizedRecord;
  }

  // Intent: create a persistable record from a canonical workspace snapshot and durable feature records.
  function createProjectRecordFromWorkspace(workspace, options = {}) {
    const normalizedWorkspace = clone(workspace);
    const project = normalizedWorkspace?.project && typeof normalizedWorkspace.project === "object"
      ? normalizedWorkspace.project
      : {
          id: typeof options.id === "string" && options.id.trim() ? options.id : `project-${Date.now()}`,
          title: typeof options.title === "string" && options.title.trim() ? options.title : "Untitled Project",
          lines: [],
        };
    const id =
      typeof options.id === "string" && options.id.trim()
        ? options.id
        : typeof project.id === "string" && project.id.trim()
          ? project.id
          : `project-${Date.now()}`;
    const title =
      typeof options.title === "string" && options.title.trim()
        ? options.title
        : typeof project.title === "string" && project.title.trim()
          ? project.title
          : "Untitled Project";
    const workspaceTitle =
      typeof normalizedWorkspace?.workspaceTitle === "string" && normalizedWorkspace.workspaceTitle.trim()
        ? normalizedWorkspace.workspaceTitle
        : "ABetterNovelAuthoringEnvironment";
    const now = options.updatedAt ?? options.createdAt ?? normalizedWorkspace.generatedAt ?? new Date().toISOString();

    normalizedWorkspace.project = {
      ...project,
      id,
      title,
    };
    normalizedWorkspace.workspaceTitle = workspaceTitle;
    normalizedWorkspace.selectionDefaults = normalizeProjectSelectionDefaults(
      normalizedWorkspace.selectionDefaults,
      normalizedWorkspace.project,
    );
    const currentWordCount = getProjectRecordWordCountForSettings({
      workspace: normalizedWorkspace,
      sceneDrafts: options.sceneDrafts ?? {},
      projectIndex: options.persistedProjectIndex ?? null,
    });
    const projectSettings = normalizeProjectSettingsSnapshot(
      buildProjectSettingsCandidate({
        ...clone(options),
        editorPrefs: options.editorPrefs ?? createDefaultEditorPrefs(),
        localAiPrefs: options.localAiPrefs ?? createDefaultLocalAiPrefs(),
        projectFilePath: options.projectFilePath ?? options.projectSettings?.projectFilePath ?? "",
      }),
      id,
      currentWordCount,
      new Date(now),
    );
    const metadataGroupIds = getMetadataSubgroupGroupIds(projectSettings);

    const record = {
      id,
      title,
      source: typeof options.source === "string" ? options.source : "user",
      createdAt: typeof options.createdAt === "string" ? options.createdAt : now,
      updatedAt: typeof options.updatedAt === "string" ? options.updatedAt : now,
      workspace: normalizedWorkspace,
      sceneDrafts: clone(options.sceneDrafts ?? {}),
      structureDrafts: clone(options.structureDrafts ?? createStructureDrafts()),
      templateDrafts: clone(options.templateDrafts ?? createTemplateDrafts()),
      manuscriptTasks: normalizeManuscriptTasks(options.manuscriptTasks),
      passageNotes: normalizePassageNotes(options.passageNotes),
      metadataSubgroups: normalizeMetadataSubgroups(options.metadataSubgroups, metadataGroupIds),
      draftProofing: normalizeDraftProofingState(options.draftProofing),
      sourceArchive: Array.isArray(options.sourceArchive) ? clone(options.sourceArchive) : [],
      importReport: options.importReport && typeof options.importReport === "object"
        ? clone(options.importReport)
        : {},
      projectSettings,
      editorPrefs: clone(projectSettings.editorPrefs),
      localAiPrefs: clone(projectSettings.localAiPrefs),
    };
    const revisionState = getPersistableRevisionProjectState(options.revisions);
    if (revisionState) {
      record.revisions = revisionState;
    }
    record.schemaVersion = Number(options.schemaVersion) || schemaVersion;
    record.projectIndex = buildProjectIndexForRecord(record, options.persistedProjectIndex ?? null);
    record.workspace.project.stats = buildWorkspaceStatsFromProjectIndex(
      record.projectIndex,
      record.workspace.project.stats,
    );
    return record;
  }

  return {
    normalizeProjectRecord,
    createProjectRecordFromWorkspace,
  };
}

function getMetadataSubgroupGroupIds(projectSettings = {}) {
  const customDefinitions = Array.isArray(projectSettings?.customMetadataDefinitions)
    ? projectSettings.customMetadataDefinitions
    : [];
  return [
    "inspiration",
    "research",
    ...customDefinitions
      .map((definition) => (typeof definition?.id === "string" ? definition.id.trim() : ""))
      .filter(Boolean),
  ];
}
