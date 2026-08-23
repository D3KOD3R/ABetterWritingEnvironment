// Intent: own project-library normalization and selection policy outside the editor composition shell.

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function isSupportedPassageNoteType(noteType) {
  const normalizedNoteType = String(noteType ?? "").trim();
  return normalizedNoteType === "inspiration" ||
    normalizedNoteType === "research" ||
    /^metadata-[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(normalizedNoteType);
}

// Intent: identify the durable project-file destination that makes recent-project entries equivalent.
function getProjectRecordFilePath(project) {
  const projectSettings = project?.projectSettings && typeof project.projectSettings === "object" && !Array.isArray(project.projectSettings)
    ? project.projectSettings
    : {};
  const settingsPath = typeof projectSettings.projectFilePath === "string" ? projectSettings.projectFilePath.trim() : "";
  if (settingsPath) {
    return settingsPath;
  }

  return typeof project?.projectFilePath === "string" ? project.projectFilePath.trim() : "";
}

// Intent: normalize comparable file labels without requiring storage adapters in the state layer.
function normalizeProjectFileDedupeKey(filePath) {
  const path = typeof filePath === "string" ? filePath.trim() : "";
  if (!path) {
    return "";
  }

  const normalizedSeparators = path.replace(/\\+/g, "/").replace(/\/{2,}/g, "/");
  const isWindowsPath = /^[A-Za-z]:\//.test(normalizedSeparators) || path.includes("\\");
  return isWindowsPath ? normalizedSeparators.toLowerCase() : normalizedSeparators;
}

// Intent: avoid treating the generated file stem as a stronger project title than the payload title.
function getProjectFileStem(filePath) {
  const normalizedPath = typeof filePath === "string" ? filePath.trim().replace(/\\+/g, "/") : "";
  const fileName = normalizedPath.split("/").filter(Boolean).at(-1) ?? "";
  return fileName
    .replace(/\.abe-project\.json$/i, "")
    .replace(/\.json$/i, "")
    .trim();
}

function normalizeProjectTitleKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeProjectSceneStoreMap(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {};
  }

  return cloneValue(candidate);
}

function mergeProjectSceneStoreMaps(primaryMap, fallbackMap) {
  const merged = normalizeProjectSceneStoreMap(fallbackMap);
  const primary = normalizeProjectSceneStoreMap(primaryMap);
  for (const [sceneId, sceneDraft] of Object.entries(primary)) {
    merged[sceneId] = cloneValue(sceneDraft);
  }
  return merged;
}

// Intent: carry split-storage manuscript bodies through cache/seed merges instead of relying on browser chunks.
function mergeProjectLibrarySceneStores(...sceneStores) {
  const merged = {};
  for (const sceneStore of sceneStores) {
    if (!sceneStore || typeof sceneStore !== "object" || Array.isArray(sceneStore)) {
      continue;
    }

    for (const [projectId, projectSceneStore] of Object.entries(sceneStore)) {
      if (typeof projectId !== "string" || !projectId.trim()) {
        continue;
      }
      if (!projectSceneStore || typeof projectSceneStore !== "object" || Array.isArray(projectSceneStore)) {
        continue;
      }

      merged[projectId] = mergeProjectSceneStoreMaps(projectSceneStore, merged[projectId]);
    }
  }

  return merged;
}

function applyProjectSceneStoreAliases(sceneStore, idAliases) {
  const remapped = mergeProjectLibrarySceneStores(sceneStore);
  if (!(idAliases instanceof Map)) {
    return remapped;
  }

  for (const [sourceProjectId, canonicalProjectId] of idAliases.entries()) {
    if (!sourceProjectId || !canonicalProjectId || sourceProjectId === canonicalProjectId) {
      continue;
    }
    if (!remapped[sourceProjectId]) {
      continue;
    }

    remapped[canonicalProjectId] = mergeProjectSceneStoreMaps(remapped[canonicalProjectId], remapped[sourceProjectId]);
  }

  return remapped;
}

function resolveProjectId(candidate, library) {
  const projects = Array.isArray(library?.projects) ? library.projects : [];
  if (typeof candidate === "string" && projects.some((project) => project?.id === candidate)) {
    return candidate;
  }

  if (typeof library?.activeProjectId === "string" && projects.some((project) => project?.id === library.activeProjectId)) {
    return library.activeProjectId;
  }

  return projects[0]?.id ?? null;
}

function findProjectById(library, projectId) {
  const projects = Array.isArray(library?.projects) ? library.projects : [];
  if (typeof projectId !== "string" || !projectId.trim()) {
    return projects[0] ?? null;
  }

  return projects.find((project) => project?.id === projectId) ?? projects[0] ?? null;
}

// Intent: keep the bundled default project from replacing a newer active browser-cache project during boot.
export function shouldPreferBrowserCacheProjectLibraryOnBoot({
  storedLibrary = null,
  seedLibrary = null,
  storedActiveProjectId = null,
  explicitProjectFilePath = "",
} = {}) {
  const storedProjects = Array.isArray(storedLibrary?.projects) ? storedLibrary.projects : [];
  if (!storedProjects.length) {
    return false;
  }

  const explicitPathKey = normalizeProjectFileDedupeKey(explicitProjectFilePath);
  if (!explicitPathKey) {
    return true;
  }

  const seedProjectId = resolveProjectId(seedLibrary?.activeProjectId, seedLibrary);
  const seedProject = findProjectById(seedLibrary, seedProjectId);
  const seedPathKey = normalizeProjectFileDedupeKey(getProjectRecordFilePath(seedProject));
  if (!seedPathKey || seedPathKey !== explicitPathKey) {
    return false;
  }

  const storedProjectId = resolveProjectId(storedActiveProjectId, storedLibrary);
  const storedProject = findProjectById(storedLibrary, storedProjectId);
  if (!storedProject) {
    return false;
  }

  const storedPathKey = normalizeProjectFileDedupeKey(getProjectRecordFilePath(storedProject));
  if (storedPathKey && storedPathKey !== seedPathKey) {
    return true;
  }

  if (storedProject.id && seedProject?.id && storedProject.id !== seedProject.id) {
    return true;
  }

  const storedUpdatedAt = Date.parse(storedProject.updatedAt ?? "");
  const seedUpdatedAt = Date.parse(seedProject?.updatedAt ?? "");
  return Number.isFinite(storedUpdatedAt) &&
    (!Number.isFinite(seedUpdatedAt) || storedUpdatedAt > seedUpdatedAt);
}

// Intent: prefer the record whose identity came from the checked project file while preserving cached edits through merge.
function scoreProjectFileDuplicate(project, activeProjectId) {
  const filePath = getProjectRecordFilePath(project);
  const title = typeof project?.title === "string" ? project.title.trim() : "";
  const fileStem = getProjectFileStem(filePath);
  let score = 0;

  if (project?.source === "project-file") {
    score += 500;
  } else if (project?.source === "user-created" || project?.source === "user") {
    score += 100;
  }

  if (typeof project?.id === "string" && project.id && project.id === activeProjectId) {
    score += 50;
  }

  if (
    title &&
    normalizeProjectTitleKey(title) !== normalizeProjectTitleKey(fileStem) &&
    normalizeProjectTitleKey(title) !== normalizeProjectTitleKey(project?.id)
  ) {
    score += 75;
  }

  const updatedAtMs = Date.parse(project?.updatedAt ?? "");
  if (Number.isFinite(updatedAtMs)) {
    score += Math.min(25, Math.max(0, updatedAtMs / 1000 / 60 / 60 / 24 / 365));
  }

  return score;
}

// Intent: normalize persistable inline note drafts without depending on an active DOM surface.
function normalizeInlinePassageDraftSelectionDefaults(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const noteType = isSupportedPassageNoteType(candidate.noteType) ? String(candidate.noteType).trim() : "";
  const sceneId = typeof candidate.sceneId === "string" && candidate.sceneId.trim()
    ? candidate.sceneId.trim()
    : "";
  if (!noteType || !sceneId) {
    return null;
  }

  return {
    sceneId,
    noteType,
    metadataDefinitionId: typeof candidate.metadataDefinitionId === "string" ? candidate.metadataDefinitionId : "",
    metadataLabel: typeof candidate.metadataLabel === "string" ? candidate.metadataLabel : "",
    metadataHighlightColor: typeof candidate.metadataHighlightColor === "string" ? candidate.metadataHighlightColor : "",
    selectedText: String(candidate.selectedText ?? ""),
    startOffset: Number.isInteger(candidate.startOffset) ? candidate.startOffset : null,
    endOffset: Number.isInteger(candidate.endOffset) ? candidate.endOffset : null,
    anchorStartOffset: Number.isInteger(candidate.anchorStartOffset) ? candidate.anchorStartOffset : null,
    seededSelection: Boolean(candidate.seededSelection),
    typedStartOffset: Number.isInteger(candidate.typedStartOffset) ? candidate.typedStartOffset : null,
    typedEndOffset: Number.isInteger(candidate.typedEndOffset) ? candidate.typedEndOffset : null,
    body: String(candidate.body ?? ""),
    typedText: String(candidate.typedText ?? ""),
    editingNoteId: typeof candidate.editingNoteId === "string" ? candidate.editingNoteId : "",
    x: Number.isFinite(candidate.x) ? candidate.x : 110,
    y: Number.isFinite(candidate.y) ? candidate.y : 40,
  };
}

// Intent: keep durable project selection defaults valid before a project is activated into runtime UI state.
export function normalizeProjectSelectionDefaults(candidate, project) {
  const sceneIdFromLine =
    typeof candidate?.lineId === "string" && candidate.lineId.trim()
      ? project?.lines?.find((line) => line?.blockId === candidate.lineId)?.sceneId ?? ""
      : "";
  const normalizedSceneSelectionStart = Number.isInteger(candidate?.sceneSelectionStart)
    ? candidate.sceneSelectionStart
    : null;
  const normalizedSceneSelectionEnd = Number.isInteger(candidate?.sceneSelectionEnd)
    ? candidate.sceneSelectionEnd
    : null;

  return {
    lineId:
      typeof candidate?.lineId === "string" && candidate.lineId.trim()
        ? candidate.lineId
        : project?.lines?.[0]?.blockId ?? "",
    sceneId:
      typeof candidate?.sceneId === "string" && candidate.sceneId.trim()
        ? candidate.sceneId
        : (sceneIdFromLine || project?.lines?.[0]?.sceneId) ?? "",
    issueId:
      typeof candidate?.issueId === "string" && candidate.issueId.trim()
        ? candidate.issueId
        : undefined,
    nodeId:
      typeof candidate?.nodeId === "string" && candidate.nodeId.trim()
        ? candidate.nodeId
        : undefined,
    entityId:
      typeof candidate?.entityId === "string" && candidate.entityId.trim()
        ? candidate.entityId
        : undefined,
    sceneSelectionBlockId:
      typeof candidate?.sceneSelectionBlockId === "string" && candidate.sceneSelectionBlockId.trim()
        ? candidate.sceneSelectionBlockId
        : "",
    sceneSelectionLineNumber: Number.isInteger(candidate?.sceneSelectionLineNumber)
      ? candidate.sceneSelectionLineNumber
      : null,
    sceneSelectionStart: normalizedSceneSelectionStart,
    sceneSelectionEnd: normalizedSceneSelectionEnd,
    sceneSelectionScrollTop: Number.isFinite(candidate?.sceneSelectionScrollTop)
      ? candidate.sceneSelectionScrollTop
      : null,
    sceneSelectionScrollLeft: Number.isFinite(candidate?.sceneSelectionScrollLeft)
      ? candidate.sceneSelectionScrollLeft
      : null,
    inlinePassageDraft: normalizeInlinePassageDraftSelectionDefaults(candidate?.inlinePassageDraft),
  };
}

// Intent: preserve user-edited imported records while refreshing source-derived metadata.
function mergeImportedRecord(storedItem, seedItem, clone) {
  const seedSource = typeof seedItem.source === "string" ? seedItem.source : "";
  const storedSource = typeof storedItem.source === "string" ? storedItem.source : "";
  const isImported = seedSource.startsWith("source-") || storedSource.startsWith("source-");

  if (!isImported) {
    return clone(storedItem);
  }

  const merged = clone(seedItem);
  const userEditableFields = [
    "title",
    "body",
    "description",
    "status",
    "completedAt",
    "updatedAt",
    "assetIds",
    "attachmentConfidence",
  ];

  for (const field of userEditableFields) {
    if (Object.prototype.hasOwnProperty.call(storedItem, field) && storedItem[field] !== undefined) {
      merged[field] = clone(storedItem[field]);
    }
  }

  return merged;
}

// Intent: combine persisted and seeded anchored records by stable identity.
export function mergeProjectLibraryItemsById(storedItems, seedItems, {
  clone = cloneValue,
} = {}) {
  const merged = [];
  const storedById = new Map();

  for (const item of Array.isArray(storedItems) ? storedItems : []) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || storedById.has(item.id)) {
      continue;
    }
    storedById.set(item.id, clone(item));
  }

  for (const item of Array.isArray(seedItems) ? seedItems : []) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      continue;
    }
    const storedItem = storedById.get(item.id);
    if (storedItem) {
      merged.push(mergeImportedRecord(storedItem, item, clone));
      storedById.delete(item.id);
      continue;
    }
    merged.push(clone(item));
  }

  for (const item of storedById.values()) {
    merged.push(item);
  }

  return merged;
}

// Intent: identify obsolete seeded project overlays without deleting distinct author projects.
function findStaleSeedProjectMatch(projects, seedProject) {
  const seedTitle = typeof seedProject.title === "string" ? seedProject.title.trim() : "";
  const seedChapterCount = Number(seedProject.workspace?.project?.stats?.chapterCount ?? 0);
  const seedSceneCount = Number(seedProject.workspace?.project?.stats?.sceneCount ?? 0);

  if (!seedTitle) {
    return null;
  }

  return (
    projects.find((project) => {
      if (!project || project.id === seedProject.id || project.source === "project-file") {
        return false;
      }

      const projectTitle = typeof project.title === "string" ? project.title.trim() : "";
      if (projectTitle !== seedTitle) {
        return false;
      }

      const chapterCount = Number(project.workspace?.project?.stats?.chapterCount ?? 0);
      const sceneCount = Number(project.workspace?.project?.stats?.sceneCount ?? 0);
      return chapterCount < seedChapterCount || sceneCount < seedSceneCount;
    }) ?? null
  );
}

export function createProjectLibraryStateService({
  state,
  normalizeProjectRecord,
  mergeProjectRecords,
  createProjectRecordFromWorkspace,
  clone = cloneValue,
} = {}) {
  if (!state || typeof state !== "object") {
    throw new Error("ProjectLibraryStateService requires state.");
  }
  if (typeof normalizeProjectRecord !== "function") {
    throw new Error("ProjectLibraryStateService requires normalizeProjectRecord.");
  }
  if (typeof mergeProjectRecords !== "function") {
    throw new Error("ProjectLibraryStateService requires mergeProjectRecords.");
  }
  if (typeof createProjectRecordFromWorkspace !== "function") {
    throw new Error("ProjectLibraryStateService requires createProjectRecordFromWorkspace.");
  }

  // Intent: collapse cache/seed records that point to the same project JSON file before UI selection sees them.
  function dedupeProjectRecordsByFileDestination(projects, activeProjectId = null, legacyState = null) {
    const dedupedProjects = [];
    const projectFileIndexes = new Map();
    const idAliases = new Map();
    const normalizedActiveProjectId = typeof activeProjectId === "string" && activeProjectId.trim()
      ? activeProjectId
      : null;

    for (const project of Array.isArray(projects) ? projects : []) {
      if (!project || typeof project !== "object") {
        continue;
      }

      const fileKey = normalizeProjectFileDedupeKey(getProjectRecordFilePath(project));
      if (!fileKey) {
        dedupedProjects.push(project);
        continue;
      }

      const existingIndex = projectFileIndexes.get(fileKey);
      if (existingIndex === undefined) {
        projectFileIndexes.set(fileKey, dedupedProjects.length);
        dedupedProjects.push(project);
        continue;
      }

      const existingProject = dedupedProjects[existingIndex];
      const existingScore = scoreProjectFileDuplicate(existingProject, normalizedActiveProjectId);
      const candidateScore = scoreProjectFileDuplicate(project, normalizedActiveProjectId);
      const canonicalProject = candidateScore > existingScore ? project : existingProject;
      const cachedProject = canonicalProject === project ? existingProject : project;
      const mergedProject = mergeProjectRecords(cachedProject, canonicalProject, legacyState);

      dedupedProjects[existingIndex] = mergedProject;
      if (typeof existingProject?.id === "string" && existingProject.id.trim()) {
        idAliases.set(existingProject.id, mergedProject.id);
      }
      if (typeof project?.id === "string" && project.id.trim()) {
        idAliases.set(project.id, mergedProject.id);
      }
      if (typeof mergedProject?.id === "string" && mergedProject.id.trim()) {
        idAliases.set(mergedProject.id, mergedProject.id);
      }
    }

    return {
      projects: dedupedProjects,
      idAliases,
    };
  }

  // Intent: keep active-project selection valid after duplicate recent-project records are collapsed.
  function resolveDedupedActiveProjectId(candidate, dedupeResult) {
    const projects = Array.isArray(dedupeResult?.projects) ? dedupeResult.projects : [];
    const candidateId = typeof candidate === "string" && candidate.trim() ? candidate : null;
    const mappedCandidateId = candidateId
      ? dedupeResult.idAliases.get(candidateId) ?? candidateId
      : null;

    if (mappedCandidateId && projects.some((project) => project.id === mappedCandidateId)) {
      return mappedCandidateId;
    }

    return projects[0]?.id ?? null;
  }

  // Intent: normalize external project-library data before it enters editor runtime state.
  function normalizeProjectLibrarySnapshot(candidate) {
    const projects = Array.isArray(candidate?.projects)
      ? candidate.projects.map((project) => normalizeProjectRecord(project)).filter(Boolean)
      : [];
    const activeProjectId =
      typeof candidate?.activeProjectId === "string" && candidate.activeProjectId.trim()
        ? candidate.activeProjectId
        : null;
    const dedupedLibrary = dedupeProjectRecordsByFileDestination(projects, activeProjectId);

    return {
      activeProjectId: resolveDedupedActiveProjectId(activeProjectId, dedupedLibrary),
      projects: dedupedLibrary.projects,
      sceneStore: candidate?.sceneStore && typeof candidate.sceneStore === "object" && !Array.isArray(candidate.sceneStore)
        ? clone(candidate.sceneStore)
        : {},
    };
  }

  // Intent: merge compatibility-cache projects with seeded projects while keeping author records stable.
  function mergeProjectLibrarySnapshots(storedLibrary, seedLibrary, legacyState = null) {
    const safeStoredLibrary = storedLibrary ?? { activeProjectId: null, projects: [] };
    const safeSeedLibrary = seedLibrary ?? { activeProjectId: null, projects: [] };
    const projectsById = new Map();
    const mergedProjects = [];
    const mergedSceneStore = mergeProjectLibrarySceneStores(
      safeStoredLibrary.sceneStore,
      safeSeedLibrary.sceneStore,
    );
    const seedProjects = (Array.isArray(safeSeedLibrary.projects) ? safeSeedLibrary.projects : [])
      .map((project) => normalizeProjectRecord(project, legacyState))
      .filter(Boolean);

    for (const project of Array.isArray(safeStoredLibrary.projects) ? safeStoredLibrary.projects : []) {
      const normalized = normalizeProjectRecord(project);
      if (!normalized || projectsById.has(normalized.id)) {
        continue;
      }
      projectsById.set(normalized.id, normalized);
      mergedProjects.push(normalized);
    }

    for (const normalized of seedProjects) {
      const existing = projectsById.get(normalized.id) ?? findStaleSeedProjectMatch(mergedProjects, normalized);
      if (!existing) {
        projectsById.set(normalized.id, normalized);
        mergedProjects.push(normalized);
        continue;
      }

      const merged = mergeProjectRecords(existing, normalized, legacyState);
      const index = mergedProjects.findIndex((candidate) => candidate.id === existing.id);
      if (index !== -1) {
        mergedProjects[index] = merged;
      } else {
        mergedProjects.push(merged);
      }

      projectsById.delete(existing.id);
      projectsById.set(merged.id, merged);
    }

    const canonicalSeedProject = seedProjects.find((project) => project.source === "project-file") ?? seedProjects[0] ?? null;
    if (canonicalSeedProject) {
      const staleDuplicate = findStaleSeedProjectMatch(
        mergedProjects.filter((project) => project.id !== canonicalSeedProject.id),
        canonicalSeedProject,
      );
      if (staleDuplicate) {
        const staleIndex = mergedProjects.findIndex((candidate) => candidate.id === staleDuplicate.id);
        if (staleIndex !== -1) {
          mergedProjects.splice(staleIndex, 1);
        }
      }
    }

    if (!mergedProjects.length && legacyState) {
      const fallbackProject = createProjectRecordFromWorkspace(
        safeSeedLibrary.projects?.[0]?.workspace ?? state.workspace,
        legacyState,
      );
      if (fallbackProject) {
        mergedProjects.push(fallbackProject);
      }
    }
    const activeProjectIdCandidate = safeStoredLibrary.activeProjectId ?? safeSeedLibrary.activeProjectId ?? mergedProjects[0]?.id ?? null;
    const dedupedLibrary = dedupeProjectRecordsByFileDestination(mergedProjects, activeProjectIdCandidate, legacyState);
    const sceneStore = applyProjectSceneStoreAliases(mergedSceneStore, dedupedLibrary.idAliases);

    return {
      activeProjectId: resolveDedupedActiveProjectId(activeProjectIdCandidate, dedupedLibrary),
      projects: dedupedLibrary.projects,
      sceneStore,
    };
  }

  // Intent: resolve project activation deterministically after load, import, or cache hydration.
  function resolveActiveProjectId(candidate, library) {
    const projects = Array.isArray(library?.projects) ? library.projects : [];
    if (typeof candidate === "string" && projects.some((project) => project.id === candidate)) {
      return candidate;
    }

    if (typeof library?.activeProjectId === "string" && projects.some((project) => project.id === library.activeProjectId)) {
      return library.activeProjectId;
    }

    return projects[0]?.id ?? null;
  }

  function getActiveProjectRecord() {
    const projectId = state.activeProjectId ?? state.projectLibrarySelectionId;
    if (!projectId) {
      return state.projectLibrary[0] ?? null;
    }

    return state.projectLibrary.find((project) => project.id === projectId) ?? state.projectLibrary[0] ?? null;
  }

  function getProjectRecordById(projectId) {
    if (typeof projectId !== "string" || !projectId.trim()) {
      return null;
    }

    return state.projectLibrary.find((project) => project.id === projectId) ?? null;
  }

  return {
    normalizeProjectLibrarySnapshot,
    mergeProjectLibrarySnapshots,
    resolveActiveProjectId,
    getActiveProjectRecord,
    getProjectRecordById,
  };
}
