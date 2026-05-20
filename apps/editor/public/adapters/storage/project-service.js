// Intent: provide a UI-agnostic project workflow service that can run on browser, desktop, or future backends.
// Guardrail: "Browser mode is a workflow prototype and compatibility layer. Core app logic must not depend directly on browser-only APIs."
// Storage boundary rules:
// - UI/workflow code must call `projectService` + storage adapters.
// - UI/workflow code must not call `localStorage`, File System Access APIs, or future native shell APIs directly.
// - browser storage is a `browser-adapter` compatibility layer only.
// - `desktop-storage` should replace adapters later without changing workflow logic.
import { buildProjectIndexFromProjectRecord, collectChapterRecords } from "./project-index.js";
import { migrateProjectData, PROJECT_SCHEMA_VERSION } from "./project-migrations.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeIsoTimestamp(value) {
  return typeof value === "string" && value.trim() ? value : new Date().toISOString();
}

function normalizeSceneId(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Intent: decide when a runtime scene draft should replace an older persisted scene chunk during export.
function sceneDraftHasSubstantiveBody(sceneDraft) {
  if (!sceneDraft || typeof sceneDraft !== "object" || Array.isArray(sceneDraft)) {
    return false;
  }

  if (typeof sceneDraft.editorText === "string" && sceneDraft.editorText.trim()) {
    return true;
  }

  const blocks = Array.isArray(sceneDraft.blocks) ? sceneDraft.blocks : [];
  return blocks.some((block) => typeof block?.text === "string" && block.text.trim().length > 0);
}

function composeSceneDraftText(blocks = []) {
  return blocks
    .map((block) => String(block?.text ?? ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

// Intent: normalize live editor scene drafts just enough for portable project-file scene stores.
function normalizeRuntimeSceneDraft(candidate, fallbackSceneId) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const sceneId = normalizeSceneId(candidate.sceneId) || normalizeSceneId(fallbackSceneId);
  if (!sceneId) {
    return null;
  }

  const blocks = Array.isArray(candidate.blocks) ? cloneValue(candidate.blocks) : [];
  return {
    ...cloneValue(candidate),
    sceneId,
    blocks,
    editorText: typeof candidate.editorText === "string"
      ? candidate.editorText
      : composeSceneDraftText(blocks),
  };
}

function normalizeLibrarySnapshot(snapshot) {
  return migrateProjectData(snapshot, {
    targetSchemaVersion: PROJECT_SCHEMA_VERSION,
  });
}

function collectWorkspaceSceneWordCounts(projectRecord) {
  const counts = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  for (const line of lines) {
    const sceneId = normalizeSceneId(line?.sceneId);
    if (!sceneId) {
      continue;
    }
    const text = String(line?.text ?? "").trim();
    if (!text) {
      continue;
    }
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    counts.set(sceneId, (counts.get(sceneId) ?? 0) + wordCount);
  }
  return counts;
}

function readProjectIndexSceneWordCounts(projectRecord) {
  const counts = new Map();
  const scenes = Array.isArray(projectRecord?.projectIndex?.scenes)
    ? projectRecord.projectIndex.scenes
    : [];
  for (const scene of scenes) {
    const sceneId = normalizeSceneId(scene?.id);
    const wordCount = Number(scene?.wordCount);
    if (!sceneId || !Number.isFinite(wordCount) || wordCount < 0) {
      continue;
    }
    counts.set(sceneId, Math.max(0, Math.round(wordCount)));
  }
  return counts;
}

function buildStableProjectIndex(projectRecord) {
  const computedIndex = buildProjectIndexFromProjectRecord(projectRecord, {
    schemaVersion: PROJECT_SCHEMA_VERSION,
  });
  const persistedWordCounts = readProjectIndexSceneWordCounts(projectRecord);
  if (!persistedWordCounts.size) {
    return computedIndex;
  }

  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  const workspaceSceneWordCounts = collectWorkspaceSceneWordCounts(projectRecord);
  const mergedScenes = computedIndex.scenes.map((scene) => {
    const sceneId = normalizeSceneId(scene?.id);
    if (!sceneId) {
      return scene;
    }
    const hasLoadedDraft = sceneDrafts[sceneId] && typeof sceneDrafts[sceneId] === "object";
    const workspaceWordCount = workspaceSceneWordCounts.get(sceneId) ?? 0;
    const computedWordCount = Number(scene?.wordCount);
    const hasComputedWordCount = Number.isFinite(computedWordCount) && computedWordCount > 0;
    if (hasLoadedDraft || workspaceWordCount > 0 || hasComputedWordCount) {
      return scene;
    }
    if (!persistedWordCounts.has(sceneId)) {
      return scene;
    }
    return {
      ...scene,
      wordCount: persistedWordCounts.get(sceneId),
    };
  });
  const mergedChapters = collectChapterRecords(mergedScenes);

  return {
    ...computedIndex,
    scenes: mergedScenes,
    chapters: mergedChapters,
    sceneOrder: mergedScenes.map((scene) => scene.id),
  };
}

function upsertProjectRecord(librarySnapshot, projectRecord, {
  setActive = true,
} = {}) {
  const library = normalizeLibrarySnapshot(librarySnapshot);
  const now = new Date().toISOString();
  const record = {
    ...cloneValue(projectRecord),
    updatedAt: normalizeIsoTimestamp(projectRecord?.updatedAt ?? now),
    schemaVersion: PROJECT_SCHEMA_VERSION,
  };
  record.projectIndex = buildStableProjectIndex(record);

  const existingIndex = library.projects.findIndex((project) => project.id === record.id);
  if (existingIndex === -1) {
    library.projects.push(record);
  } else {
    library.projects[existingIndex] = record;
  }

  if (setActive) {
    library.activeProjectId = record.id;
  } else if (!library.projects.some((project) => project.id === library.activeProjectId)) {
    library.activeProjectId = library.projects[0]?.id ?? null;
  }

  return {
    librarySnapshot: library,
    projectRecord: record,
  };
}

function resolveSceneDraft(projectRecord, sceneId) {
  const draft = projectRecord?.sceneDrafts?.[sceneId];
  if (draft && typeof draft === "object") {
    return cloneValue(draft);
  }

  const sceneLines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines.filter((line) => line?.sceneId === sceneId)
    : [];
  if (!sceneLines.length) {
    return null;
  }

  return {
    sceneId,
    chapterId: sceneLines[0]?.chapterId ?? "",
    chapterTitle: sceneLines[0]?.chapterTitle ?? "Untitled Chapter",
    sceneTitle: sceneLines[0]?.sceneTitle ?? "Untitled Scene",
    sceneSynopsis: sceneLines[0]?.sceneSynopsis ?? "",
    blocks: sceneLines.map((line) => ({
      blockId: line?.blockId ?? `draft-block-${sceneId}`,
      lineNumber: Number.isFinite(Number(line?.lineNumber)) ? Number(line.lineNumber) : null,
      kind: line?.kind ?? "narration",
      speakerLabel: line?.speakerLabel ?? "",
      text: line?.text ?? "",
      issueIds: Array.isArray(line?.issueIds) ? [...line.issueIds] : [],
      eventTagIds: Array.isArray(line?.eventTagIds) ? [...line.eventTagIds] : [],
      isDraft: false,
    })),
    editorText: sceneLines.map((line) => line?.text ?? "").join("\n\n"),
  };
}

function getSceneOrdering(projectRecord) {
  const index = buildStableProjectIndex(projectRecord);
  return index.scenes;
}

export function createProjectService({
  projectRepository,
  preferencesRepository,
  now = () => new Date().toISOString(),
} = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required to create the project service.");
  }
  if (!preferencesRepository) {
    throw new Error("A preferences repository is required to create the project service.");
  }

  const loadProjectLibrarySnapshot = () => {
    const snapshot = projectRepository.loadProjectLibrarySnapshot();
    const storedActiveProjectId = projectRepository.loadActiveProjectId();
    if (
      storedActiveProjectId &&
      snapshot.projects.some((project) => project.id === storedActiveProjectId)
    ) {
      return {
        ...snapshot,
        activeProjectId: storedActiveProjectId,
      };
    }

    return snapshot;
  };

  const saveProjectLibrarySnapshot = (snapshot, options = {}) =>
    projectRepository.saveProjectLibrarySnapshot(snapshot, options);

  const exportProjectLibrarySnapshot = ({
    librarySnapshot = null,
  } = {}) => {
    const snapshot = normalizeLibrarySnapshot(librarySnapshot ?? loadProjectLibrarySnapshot());
    const sceneStore = {};
    for (const project of snapshot.projects) {
      if (!project?.id) {
        continue;
      }
      const scenes = projectRepository.loadAllScenes(project.id);
      const mergedScenes = scenes && typeof scenes === "object" && !Array.isArray(scenes)
        ? cloneValue(scenes)
        : {};
      const runtimeDrafts = project.sceneDrafts && typeof project.sceneDrafts === "object" && !Array.isArray(project.sceneDrafts)
        ? project.sceneDrafts
        : {};

      // Intent: file exports must prefer live runtime scene drafts over stale repository chunks.
      for (const [sceneId, candidate] of Object.entries(runtimeDrafts)) {
        const normalizedSceneId = normalizeSceneId(sceneId);
        if (!normalizedSceneId) {
          continue;
        }

        const normalizedDraft = normalizeRuntimeSceneDraft(candidate, normalizedSceneId);
        if (!normalizedDraft) {
          continue;
        }

        const storedDraft = mergedScenes[normalizedSceneId];
        if (sceneDraftHasSubstantiveBody(normalizedDraft) || !sceneDraftHasSubstantiveBody(storedDraft)) {
          mergedScenes[normalizedSceneId] = normalizedDraft;
        }
      }

      if (Object.keys(mergedScenes).length) {
        sceneStore[project.id] = mergedScenes;
      }
    }

    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      activeProjectId: snapshot.activeProjectId,
      projects: cloneValue(snapshot.projects),
      sceneStore,
    };
  };

  const openProject = ({
    projectId = null,
    librarySnapshot = null,
  } = {}) => {
    const snapshot = librarySnapshot
      ? normalizeLibrarySnapshot(librarySnapshot)
      : loadProjectLibrarySnapshot();
    const activeProjectId = typeof projectId === "string" && projectId.trim()
      ? projectId
      : snapshot.activeProjectId;
    const projectRecord = snapshot.projects.find((project) => project.id === activeProjectId)
      ?? snapshot.projects[0]
      ?? null;

    return {
      activeProjectId: projectRecord?.id ?? null,
      librarySnapshot: snapshot,
      projectRecord,
    };
  };

  const createProject = ({
    projectRecord,
    librarySnapshot = null,
    persist = false,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      throw new Error("A project record is required.");
    }

    const createdRecord = {
      ...cloneValue(projectRecord),
      createdAt: normalizeIsoTimestamp(projectRecord.createdAt ?? now()),
      updatedAt: normalizeIsoTimestamp(projectRecord.updatedAt ?? now()),
    };
    const next = upsertProjectRecord(
      librarySnapshot ?? loadProjectLibrarySnapshot(),
      createdRecord,
      { setActive: true },
    );
    if (persist) {
      next.librarySnapshot = saveProjectLibrarySnapshot(next.librarySnapshot, {
        changedSceneIdsByProject: {
          [next.projectRecord.id]: getSceneOrdering(next.projectRecord).map((scene) => scene.id),
        },
      });
    }

    return next;
  };

  const saveProject = ({
    projectRecord,
    librarySnapshot = null,
    persist = false,
    setActive = true,
    changedSceneIds = null,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      throw new Error("A project record is required.");
    }

    const next = upsertProjectRecord(
      librarySnapshot ?? loadProjectLibrarySnapshot(),
      {
        ...cloneValue(projectRecord),
        updatedAt: normalizeIsoTimestamp(now()),
      },
      { setActive },
    );
    if (persist) {
      const projectId = next.projectRecord.id;
      const normalizedChangedSceneIds = Array.isArray(changedSceneIds)
        ? changedSceneIds.map((sceneId) => normalizeSceneId(sceneId)).filter(Boolean)
        : null;
      next.librarySnapshot = saveProjectLibrarySnapshot(next.librarySnapshot, {
        changedSceneIdsByProject: normalizedChangedSceneIds
          ? { [projectId]: normalizedChangedSceneIds }
          : {},
      });
    }

    return next;
  };

  const loadScene = ({
    projectRecord,
    sceneId,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      return null;
    }
    if (typeof sceneId !== "string" || !sceneId.trim()) {
      return null;
    }

    const resolvedSceneId = sceneId.trim();
    const resolvedProjectId = typeof projectRecord.id === "string" ? projectRecord.id.trim() : "";
    if (resolvedProjectId) {
      const storedScene = projectRepository.loadScene(resolvedProjectId, resolvedSceneId);
      if (storedScene) {
        return storedScene;
      }
    }

    return resolveSceneDraft(projectRecord, resolvedSceneId);
  };

  const saveScene = ({
    projectRecord,
    sceneId,
    content,
    metadata = {},
    persist = false,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      throw new Error("A project record is required.");
    }
    if (typeof sceneId !== "string" || !sceneId.trim()) {
      throw new Error("A sceneId is required.");
    }

    const resolvedSceneId = sceneId.trim();
    const nextRecord = cloneValue(projectRecord);
    const draft = resolveSceneDraft(nextRecord, resolvedSceneId) ?? {
      sceneId: resolvedSceneId,
      chapterId: "",
      chapterTitle: "Untitled Chapter",
      sceneTitle: "Untitled Scene",
      sceneSynopsis: "",
      blocks: [],
      editorText: "",
    };
    draft.editorText = typeof content === "string" ? content : draft.editorText;
    if (typeof metadata.sceneTitle === "string") {
      draft.sceneTitle = metadata.sceneTitle;
    }
    if (typeof metadata.sceneSynopsis === "string") {
      draft.sceneSynopsis = metadata.sceneSynopsis;
    }
    if (typeof metadata.chapterId === "string") {
      draft.chapterId = metadata.chapterId;
    }
    if (typeof metadata.chapterTitle === "string") {
      draft.chapterTitle = metadata.chapterTitle;
    }

    nextRecord.sceneDrafts = {
      ...(nextRecord.sceneDrafts && typeof nextRecord.sceneDrafts === "object"
        ? nextRecord.sceneDrafts
        : {}),
      [resolvedSceneId]: draft,
    };
    nextRecord.updatedAt = normalizeIsoTimestamp(now());
    nextRecord.schemaVersion = PROJECT_SCHEMA_VERSION;
    nextRecord.projectIndex = buildStableProjectIndex(nextRecord);
    if (persist) {
      const projectId = typeof nextRecord.id === "string" && nextRecord.id.trim()
        ? nextRecord.id.trim()
        : "";
      if (!projectId) {
        throw new Error("A project id is required to persist scene content.");
      }

      projectRepository.saveScene(projectId, resolvedSceneId, draft);
    }
    return nextRecord;
  };

  const listScenes = ({
    projectRecord,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      return [];
    }

    return getSceneOrdering(projectRecord).map((scene) => ({
      id: scene.id,
      title: scene.title,
      chapterId: scene.chapterId,
      order: scene.order,
      lineCount: scene.lineCount,
      synopsis: scene.synopsis,
      assetIds: [...scene.assetIds],
    }));
  };

  const updateSceneMetadata = ({
    projectRecord,
    sceneId,
    metadata = {},
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      throw new Error("A project record is required.");
    }
    if (typeof sceneId !== "string" || !sceneId.trim()) {
      throw new Error("A sceneId is required.");
    }

    return saveScene({
      projectRecord,
      sceneId,
      content: resolveSceneDraft(projectRecord, sceneId)?.editorText ?? "",
      metadata,
    });
  };

  const registerAsset = ({
    projectRecord,
    asset,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      throw new Error("A project record is required.");
    }
    if (!asset || typeof asset !== "object") {
      throw new Error("An asset record is required.");
    }
    const assetId = typeof asset.id === "string" && asset.id.trim()
      ? asset.id.trim()
      : `asset-${Date.now()}`;

    const nextRecord = cloneValue(projectRecord);
    const settings = nextRecord.projectSettings && typeof nextRecord.projectSettings === "object" && !Array.isArray(nextRecord.projectSettings)
      ? nextRecord.projectSettings
      : {};
    const existingRegistry = Array.isArray(settings.assetRegistry)
      ? [...settings.assetRegistry]
      : [];
    const normalizedAsset = {
      id: assetId,
      sceneId: typeof asset.sceneId === "string" ? asset.sceneId : "",
      kind: typeof asset.kind === "string" ? asset.kind : "",
      role: typeof asset.role === "string" ? asset.role : "",
      path: typeof asset.path === "string" ? asset.path : "",
      fileRef: typeof asset.fileRef === "string" ? asset.fileRef : "",
      createdAt: normalizeIsoTimestamp(asset.createdAt ?? now()),
      updatedAt: normalizeIsoTimestamp(now()),
      metadata: asset.metadata && typeof asset.metadata === "object" ? cloneValue(asset.metadata) : {},
    };
    const existingIndex = existingRegistry.findIndex((existing) => existing?.id === assetId);
    if (existingIndex === -1) {
      existingRegistry.push(normalizedAsset);
    } else {
      existingRegistry[existingIndex] = normalizedAsset;
    }

    nextRecord.projectSettings = {
      ...settings,
      assetRegistry: existingRegistry,
    };
    nextRecord.updatedAt = normalizeIsoTimestamp(now());
    nextRecord.schemaVersion = PROJECT_SCHEMA_VERSION;
    nextRecord.projectIndex = buildStableProjectIndex(nextRecord);
    return nextRecord;
  };

  const getProjectIndex = ({
    projectRecord,
  } = {}) => {
    if (!projectRecord || typeof projectRecord !== "object") {
      return null;
    }

    return buildStableProjectIndex(projectRecord);
  };

  const saveUserPreference = (key, value) => {
    preferencesRepository.save(key, value);
  };

  const loadUserPreference = (key, fallback = null) => preferencesRepository.load(key, fallback);

  return {
    createProject,
    exportProjectLibrarySnapshot,
    getProjectIndex,
    listScenes,
    loadProjectLibrarySnapshot,
    loadScene,
    loadUserPreference,
    openProject,
    registerAsset,
    saveProject,
    saveProjectLibrarySnapshot,
    saveScene,
    saveUserPreference,
    updateSceneMetadata,
  };
}
