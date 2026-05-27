// Intent: own project-library normalization and selection policy outside the editor composition shell.

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

// Intent: normalize persistable inline note drafts without depending on an active DOM surface.
function normalizeInlinePassageDraftSelectionDefaults(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const noteType = candidate.noteType === "research" ? "research" : candidate.noteType === "inspiration" ? "inspiration" : "";
  const sceneId = typeof candidate.sceneId === "string" && candidate.sceneId.trim()
    ? candidate.sceneId.trim()
    : "";
  if (!noteType || !sceneId) {
    return null;
  }

  return {
    sceneId,
    noteType,
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

  // Intent: normalize external project-library data before it enters editor runtime state.
  function normalizeProjectLibrarySnapshot(candidate) {
    const projects = Array.isArray(candidate?.projects)
      ? candidate.projects.map((project) => normalizeProjectRecord(project)).filter(Boolean)
      : [];

    return {
      activeProjectId:
        typeof candidate?.activeProjectId === "string" && candidate.activeProjectId.trim()
          ? candidate.activeProjectId
          : null,
      projects,
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

    return {
      activeProjectId: safeStoredLibrary.activeProjectId ?? safeSeedLibrary.activeProjectId ?? mergedProjects[0]?.id ?? null,
      projects: mergedProjects,
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
