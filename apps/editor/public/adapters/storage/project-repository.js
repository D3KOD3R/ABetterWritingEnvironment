// Intent: isolate chunked project-library persistence so the UI shell never talks to localStorage directly.
// Guardrail: "Browser mode is a workflow prototype and compatibility layer. Core app logic must not depend directly on browser-only APIs."
// Labels:
// - `browser-adapter`: current compatibility layer (this repository can use it, UI should not).
// - `desktop-storage`: future real project-folder package runtime.
// - `scene records`: portable manuscript chunks.
// - `manifest`: project index and metadata, not full manuscript body.
// - `projectService`: stable application boundary UI calls for persistence.
import {
  applyPassageNoteCountsToProjectIndex,
  buildProjectIndexFromProjectRecord,
} from "./project-index.js";
import { migrateProjectData, PROJECT_SCHEMA_VERSION } from "./project-migrations.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeSceneId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProjectId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePathToken(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function composeEditorText(blocks = []) {
  return blocks
    .map((block) => String(block?.text ?? ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function normalizeSceneDraft(candidate, fallback = {}) {
  const base = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const sceneId = normalizeSceneId(base.sceneId ?? fallback.sceneId);
  if (!sceneId) {
    return null;
  }

  const blocks = Array.isArray(base.blocks)
    ? base.blocks.map((block, index) => ({
      blockId: typeof block?.blockId === "string" && block.blockId.trim()
        ? block.blockId
        : `block-${sceneId}-${index + 1}`,
      lineNumber: Number.isFinite(Number(block?.lineNumber))
        ? Number(block.lineNumber)
        : null,
      kind: typeof block?.kind === "string" && block.kind.trim() ? block.kind : "narration",
      speakerLabel: typeof block?.speakerLabel === "string" ? block.speakerLabel : "",
      text: typeof block?.text === "string" ? block.text : "",
      issueIds: Array.isArray(block?.issueIds) ? [...block.issueIds] : [],
      eventTagIds: Array.isArray(block?.eventTagIds) ? [...block.eventTagIds] : [],
      isDraft: block?.isDraft === true || block?.lineNumber == null,
    }))
    : [];
  const editorText = typeof base.editorText === "string" ? base.editorText : composeEditorText(blocks);

  return {
    sceneId,
    chapterId: typeof base.chapterId === "string" ? base.chapterId : (fallback.chapterId ?? ""),
    chapterTitle: typeof base.chapterTitle === "string" ? base.chapterTitle : (fallback.chapterTitle ?? "Untitled Chapter"),
    sceneTitle: typeof base.sceneTitle === "string" ? base.sceneTitle : (fallback.sceneTitle ?? "Untitled Scene"),
    sceneSynopsis: typeof base.sceneSynopsis === "string" ? base.sceneSynopsis : (fallback.sceneSynopsis ?? ""),
    editorText,
    blocks,
    // Intent: preserve author-applied formatting metadata until canonical manuscript marks replace this compatibility field.
    inlineFormatRanges: Array.isArray(base.inlineFormatRanges) ? cloneValue(base.inlineFormatRanges) : [],
  };
}

function sceneDraftHasSubstantiveBody(sceneDraft) {
  if (!sceneDraft || typeof sceneDraft !== "object") {
    return false;
  }

  const editorText = typeof sceneDraft.editorText === "string"
    ? sceneDraft.editorText
    : "";
  if (editorText.trim()) {
    return true;
  }

  const blocks = Array.isArray(sceneDraft.blocks) ? sceneDraft.blocks : [];
  return blocks.some((block) => typeof block?.text === "string" && block.text.trim().length > 0);
}

function mergeSceneMetadataIntoStoredScene(existingScene, candidateScene, sceneId) {
  const merged = {
    ...cloneValue(existingScene ?? {}),
  };
  if (candidateScene && typeof candidateScene === "object") {
    if (typeof candidateScene.chapterId === "string") {
      merged.chapterId = candidateScene.chapterId;
    }
    if (typeof candidateScene.chapterTitle === "string") {
      merged.chapterTitle = candidateScene.chapterTitle;
    }
    if (typeof candidateScene.sceneTitle === "string") {
      merged.sceneTitle = candidateScene.sceneTitle;
    }
    if (typeof candidateScene.sceneSynopsis === "string") {
      merged.sceneSynopsis = candidateScene.sceneSynopsis;
    }
  }

  return normalizeSceneDraft(merged, {
    sceneId,
    chapterId: existingScene?.chapterId ?? "",
    chapterTitle: existingScene?.chapterTitle ?? "Untitled Chapter",
    sceneTitle: existingScene?.sceneTitle ?? "Untitled Scene",
    sceneSynopsis: existingScene?.sceneSynopsis ?? "",
  }) ?? cloneValue(existingScene);
}

function countWords(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return 0;
  }

  return value.split(/\s+/).filter(Boolean).length;
}

function getSceneDraftWordCount(sceneDraft) {
  if (!sceneDraft || typeof sceneDraft !== "object") {
    return 0;
  }

  const editorText = typeof sceneDraft.editorText === "string"
    ? sceneDraft.editorText
    : composeEditorText(sceneDraft.blocks);
  return countWords(editorText);
}

function collectSceneDraftsFromProjectRecord(projectRecord) {
  const sceneMap = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];

  for (const line of lines) {
    const sceneId = normalizeSceneId(line?.sceneId);
    if (!sceneId) {
      continue;
    }

    let scene = sceneMap.get(sceneId);
    if (!scene) {
      scene = {
        sceneId,
        chapterId: typeof line?.chapterId === "string" ? line.chapterId : "",
        chapterTitle: typeof line?.chapterTitle === "string" ? line.chapterTitle : "Untitled Chapter",
        sceneTitle: typeof line?.sceneTitle === "string" ? line.sceneTitle : "Untitled Scene",
        sceneSynopsis: typeof line?.sceneSynopsis === "string" ? line.sceneSynopsis : "",
        blocks: [],
        editorText: "",
      };
      sceneMap.set(sceneId, scene);
    }

    scene.blocks.push({
      blockId: typeof line?.blockId === "string" && line.blockId.trim()
        ? line.blockId
        : `block-${sceneId}-${scene.blocks.length + 1}`,
      lineNumber: Number.isFinite(Number(line?.lineNumber))
        ? Number(line.lineNumber)
        : null,
      kind: typeof line?.kind === "string" && line.kind.trim() ? line.kind : "narration",
      speakerLabel: typeof line?.speakerLabel === "string" ? line.speakerLabel : "",
      text: typeof line?.text === "string" ? line.text : "",
      issueIds: Array.isArray(line?.issueIds) ? [...line.issueIds] : [],
      eventTagIds: Array.isArray(line?.eventTagIds) ? [...line.eventTagIds] : [],
      isDraft: false,
    });
  }

  for (const scene of sceneMap.values()) {
    scene.blocks.sort((left, right) => {
      const leftNumber = left.lineNumber ?? Number.POSITIVE_INFINITY;
      const rightNumber = right.lineNumber ?? Number.POSITIVE_INFINITY;
      return leftNumber - rightNumber;
    });
    scene.editorText = composeEditorText(scene.blocks);
  }

  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  for (const [sceneId, candidate] of Object.entries(sceneDrafts)) {
    const normalizedId = normalizeSceneId(sceneId);
    if (!normalizedId) {
      continue;
    }
    const fallback = sceneMap.get(normalizedId) ?? {
      sceneId: normalizedId,
      chapterId: "",
      chapterTitle: "Untitled Chapter",
      sceneTitle: "Untitled Scene",
      sceneSynopsis: "",
      blocks: [],
      editorText: "",
    };
    const normalizedDraft = normalizeSceneDraft(candidate, fallback);
    if (normalizedDraft) {
      sceneMap.set(normalizedId, normalizedDraft);
    }
  }

  return sceneMap;
}

function stripSceneBodiesFromLines(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines.map((line) => ({
    ...cloneValue(line),
    text: "",
  }));
}

function getSceneOrder(projectRecord, sceneMap) {
  const indexSceneOrder = Array.isArray(projectRecord?.projectIndex?.sceneOrder)
    ? projectRecord.projectIndex.sceneOrder
    : [];
  const normalizedFromIndex = indexSceneOrder
    .map((sceneId) => normalizeSceneId(sceneId))
    .filter(Boolean);
  if (normalizedFromIndex.length) {
    return normalizedFromIndex;
  }

  const orderedFromIndexScenes = Array.isArray(projectRecord?.projectIndex?.scenes)
    ? projectRecord.projectIndex.scenes
      .map((scene) => normalizeSceneId(scene?.id))
      .filter(Boolean)
    : [];
  if (orderedFromIndexScenes.length) {
    return orderedFromIndexScenes;
  }

  return [...sceneMap.keys()];
}

function buildSceneFilesMap(projectId, sceneOrder, existingSceneFiles = {}) {
  const sceneFiles = {};
  for (const sceneId of sceneOrder) {
    if (existingSceneFiles && typeof existingSceneFiles === "object") {
      const existingPath = existingSceneFiles[sceneId];
      if (typeof existingPath === "string" && existingPath.trim()) {
        sceneFiles[sceneId] = existingPath.trim();
        continue;
      }
    }

    sceneFiles[sceneId] = `manuscript/scenes/${sanitizePathToken(projectId || "project")}/scene_${sanitizePathToken(sceneId || "scene")}.json`;
  }

  return sceneFiles;
}

function buildStructureDraftScenes(sceneOrder, sceneMap, fallbackScenes = []) {
  const existingDraftsBySceneId = new Map(
    (Array.isArray(fallbackScenes) ? fallbackScenes : [])
      .filter((scene) => scene && typeof scene === "object")
      .map((scene) => [normalizeSceneId(scene.sceneId), scene]),
  );

  return sceneOrder.map((sceneId, index) => {
    const scene = sceneMap.get(sceneId);
    const fallback = existingDraftsBySceneId.get(sceneId) ?? {};
    return {
      sceneId,
      chapterId: scene?.chapterId ?? (typeof fallback.chapterId === "string" ? fallback.chapterId : ""),
      chapterTitle: scene?.chapterTitle ?? (typeof fallback.chapterTitle === "string" ? fallback.chapterTitle : "Untitled Chapter"),
      sceneTitle: scene?.sceneTitle ?? (typeof fallback.sceneTitle === "string" ? fallback.sceneTitle : "Untitled Scene"),
      sceneSynopsis: scene?.sceneSynopsis ?? (typeof fallback.sceneSynopsis === "string" ? fallback.sceneSynopsis : ""),
      order: Number.isFinite(Number(fallback.order)) ? Number(fallback.order) : index + 1,
      initialText: typeof fallback.initialText === "string" ? fallback.initialText : "",
    };
  });
}

function buildManifestRecord(projectRecord, {
  schemaVersion = PROJECT_SCHEMA_VERSION,
  sceneOrder = [],
  sceneFiles = {},
  sceneMap: providedSceneMap = null,
} = {}) {
  const record = cloneValue(projectRecord);
  const projectSettings = record.projectSettings && typeof record.projectSettings === "object" && !Array.isArray(record.projectSettings)
    ? record.projectSettings
    : {};
  const workspaceProject = record.workspace?.project && typeof record.workspace.project === "object"
    ? record.workspace.project
    : null;
  const sceneMap = providedSceneMap instanceof Map
    ? new Map(
      [...providedSceneMap.entries()].map(([sceneId, sceneDraft]) => [sceneId, cloneValue(sceneDraft)]),
    )
    : collectSceneDraftsFromProjectRecord(projectRecord);
  const resolvedSceneOrder = sceneOrder.length ? sceneOrder : getSceneOrder(projectRecord, sceneMap);
  const activeSceneIdCandidate = normalizeSceneId(
    projectSettings.activeSceneId
      ?? record.projectStorage?.activeSceneId
      ?? resolvedSceneOrder[0]
      ?? "",
  );
  const activeSceneId = resolvedSceneOrder.includes(activeSceneIdCandidate)
    ? activeSceneIdCandidate
    : resolvedSceneOrder[0] ?? "";

  record.sceneDrafts = {};
  if (workspaceProject) {
    workspaceProject.lines = stripSceneBodiesFromLines(workspaceProject.lines);
  }
  record.structureDrafts = {
    ...cloneValue(record.structureDrafts ?? {}),
    scenes: buildStructureDraftScenes(
      resolvedSceneOrder,
      sceneMap,
      record.structureDrafts?.scenes,
    ),
  };
  record.projectSettings = {
    ...projectSettings,
    activeSceneId,
  };
  record.projectStorage = {
    format: "chunked-project-package-v1",
    activeSceneId,
    sceneOrder: [...resolvedSceneOrder],
    sceneFiles: cloneValue(sceneFiles),
  };
  record.schemaVersion = schemaVersion;
  const sceneWordCountsById = {};
  for (const [sceneId, sceneDraft] of sceneMap.entries()) {
    sceneWordCountsById[sceneId] = getSceneDraftWordCount(sceneDraft);
  }
  record.projectIndex = buildProjectIndexFromProjectRecord(record, {
    schemaVersion,
    sceneWordCountsById,
  });
  if (workspaceProject) {
    workspaceProject.stats = buildWorkspaceStatsFromProjectIndex(record.projectIndex, workspaceProject.stats);
  }

  return record;
}

// Intent: keep persisted workspace stats aligned with the chunked scene index used by project-file saves.
function buildWorkspaceStatsFromProjectIndex(projectIndex, currentStats = {}) {
  const chapters = Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [];
  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  return {
    ...(currentStats && typeof currentStats === "object" && !Array.isArray(currentStats) ? currentStats : {}),
    chapterCount: chapters.length,
    sceneCount: scenes.length,
    lineCount: scenes.reduce((total, scene) => total + Math.max(0, Math.round(Number(scene?.lineCount) || 0)), 0),
  };
}

function getSceneStorageKey(libraryStorageKey, projectId, sceneId) {
  return `${libraryStorageKey}:scene:${projectId}:${sceneId}`;
}

function getProjectManifestById(librarySnapshot, projectId) {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    return null;
  }

  return (librarySnapshot?.projects ?? []).find((project) => project.id === normalizedProjectId) ?? null;
}

function loadSceneOrderFromManifest(projectRecord = null) {
  if (!projectRecord || typeof projectRecord !== "object") {
    return [];
  }

  if (Array.isArray(projectRecord?.projectStorage?.sceneOrder)) {
    return projectRecord.projectStorage.sceneOrder
      .map((sceneId) => normalizeSceneId(sceneId))
      .filter(Boolean);
  }

  if (Array.isArray(projectRecord?.projectIndex?.sceneOrder)) {
    return projectRecord.projectIndex.sceneOrder
      .map((sceneId) => normalizeSceneId(sceneId))
      .filter(Boolean);
  }

  return [];
}

function collectProjectCacheKeysFromManifest(librarySnapshot, {
  libraryStorageKey,
  activeProjectIdStorageKey,
} = {}) {
  const storageKeys = new Set([
    libraryStorageKey,
    activeProjectIdStorageKey,
  ]);

  for (const project of Array.isArray(librarySnapshot?.projects) ? librarySnapshot.projects : []) {
    const projectId = normalizeProjectId(project?.id);
    if (!projectId) {
      continue;
    }

    for (const sceneId of loadSceneOrderFromManifest(project)) {
      storageKeys.add(getSceneStorageKey(libraryStorageKey, projectId, sceneId));
    }
  }

  return storageKeys;
}

function hydrateProjectRecord(manifestRecord, {
  loadScene,
  sceneMap = null,
} = {}) {
  const record = cloneValue(manifestRecord);
  const sceneOrder = loadSceneOrderFromManifest(record);
  const activeSceneIdCandidate = normalizeSceneId(
    record?.projectSettings?.activeSceneId
      ?? record?.projectStorage?.activeSceneId
      ?? sceneOrder[0]
      ?? "",
  );
  const activeSceneId = sceneOrder.includes(activeSceneIdCandidate)
    ? activeSceneIdCandidate
    : sceneOrder[0] ?? "";
  const activeSceneDraft =
    activeSceneId && sceneMap instanceof Map
      ? normalizeSceneDraft(sceneMap.get(activeSceneId), { sceneId: activeSceneId })
      : activeSceneId && typeof loadScene === "function"
        ? loadScene(record.id, activeSceneId)
        : null;
  const fallbackDraftCandidate = activeSceneId
    ? normalizeSceneDraft(record?.sceneDrafts?.[activeSceneId], { sceneId: activeSceneId })
    : null;

  record.sceneDrafts = (activeSceneDraft ?? fallbackDraftCandidate)
    ? {
      [activeSceneId]: cloneValue(activeSceneDraft ?? fallbackDraftCandidate),
    }
    : {};
  record.projectSettings = {
    ...(record.projectSettings && typeof record.projectSettings === "object" && !Array.isArray(record.projectSettings)
      ? record.projectSettings
      : {}),
    activeSceneId,
  };
  record.schemaVersion = Number(record.schemaVersion) || PROJECT_SCHEMA_VERSION;
  const existingProjectIndex = record.projectIndex && typeof record.projectIndex === "object" && !Array.isArray(record.projectIndex)
    ? cloneValue(record.projectIndex)
    : null;
  if (existingProjectIndex && Array.isArray(existingProjectIndex.scenes)) {
    record.projectIndex = applyPassageNoteCountsToProjectIndex({
      ...existingProjectIndex,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId: typeof record.id === "string" ? record.id : (existingProjectIndex.projectId ?? ""),
      projectTitle: typeof record.title === "string" ? record.title : (existingProjectIndex.projectTitle ?? "Untitled Project"),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : (existingProjectIndex.updatedAt ?? ""),
    }, record.passageNotes);
  } else {
    record.projectIndex = buildProjectIndexFromProjectRecord(record, {
      schemaVersion: PROJECT_SCHEMA_VERSION,
    });
  }
  if (record.workspace?.project && typeof record.workspace.project === "object") {
    record.workspace.project.stats = buildWorkspaceStatsFromProjectIndex(
      record.projectIndex,
      record.workspace.project.stats,
    );
  }

  return record;
}

function mergeSceneStore(candidateSceneStore = {}, projectId, sceneMap) {
  const projectSceneStore = candidateSceneStore?.[projectId];
  if (!projectSceneStore || typeof projectSceneStore !== "object" || Array.isArray(projectSceneStore)) {
    return;
  }

  for (const [sceneId, candidate] of Object.entries(projectSceneStore)) {
    const normalizedSceneId = normalizeSceneId(sceneId);
    if (!normalizedSceneId) {
      continue;
    }
    const normalizedDraft = normalizeSceneDraft(candidate, {
      sceneId: normalizedSceneId,
    });
    if (normalizedDraft) {
      sceneMap.set(normalizedSceneId, normalizedDraft);
    }
  }
}

export function createProjectRepository({
  storageAdapter,
  libraryStorageKey = "abe-project-library-v1",
  activeProjectIdStorageKey = "abe-active-project-id-v1",
  schemaVersion = PROJECT_SCHEMA_VERSION,
} = {}) {
  if (!storageAdapter) {
    throw new Error("A storage adapter is required to create the project repository.");
  }

  const loadStoredManifestSnapshot = () => migrateProjectData(
    storageAdapter.readJson(libraryStorageKey),
    { targetSchemaVersion: schemaVersion },
  );

  // Intent: make project-file loads authoritative by removing old browser project chunks before caching the loaded JSON.
  const clearProjectLibraryCache = () => {
    const storageKeys = collectProjectCacheKeysFromManifest(loadStoredManifestSnapshot(), {
      libraryStorageKey,
      activeProjectIdStorageKey,
    });
    if (typeof storageAdapter.listKeys === "function") {
      for (const storageKey of storageAdapter.listKeys()) {
        if (
          storageKey === libraryStorageKey ||
          storageKey === activeProjectIdStorageKey ||
          storageKey.startsWith(`${libraryStorageKey}:`)
        ) {
          storageKeys.add(storageKey);
        }
      }
    }

    let cleared = true;
    for (const storageKey of storageKeys) {
      if (storageAdapter.remove(storageKey) !== true) {
        cleared = false;
      }
    }
    return cleared;
  };

  const loadScene = (projectId, sceneId) => {
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedSceneId = normalizeSceneId(sceneId);
    if (!normalizedProjectId || !normalizedSceneId) {
      return null;
    }

    const key = getSceneStorageKey(libraryStorageKey, normalizedProjectId, normalizedSceneId);
    const candidate = storageAdapter.readJson(key);
    return normalizeSceneDraft(candidate, { sceneId: normalizedSceneId });
  };

  // Intent: share scene write normalization so batch saves can stop cleanly after storage quota failures.
  const writeSceneRecord = (projectId, sceneId, sceneRecord) => {
    const normalizedProjectId = normalizeProjectId(projectId);
    const normalizedSceneId = normalizeSceneId(sceneId);
    if (!normalizedProjectId || !normalizedSceneId) {
      throw new Error("A projectId and sceneId are required.");
    }

    const normalizedDraft = normalizeSceneDraft(sceneRecord, { sceneId: normalizedSceneId });
    if (!normalizedDraft) {
      throw new Error("A valid scene record is required.");
    }

    const key = getSceneStorageKey(libraryStorageKey, normalizedProjectId, normalizedSceneId);
    const persisted = storageAdapter.writeJson(key, normalizedDraft);
    return {
      persisted,
      scene: normalizedDraft,
    };
  };

  const saveScene = (projectId, sceneId, sceneRecord) => {
    return writeSceneRecord(projectId, sceneId, sceneRecord).scene;
  };

  const loadAllScenes = (projectId) => {
    const normalizedProjectId = normalizeProjectId(projectId);
    if (!normalizedProjectId) {
      return {};
    }

    const manifestSnapshot = loadStoredManifestSnapshot();
    const projectManifest = getProjectManifestById(manifestSnapshot, normalizedProjectId);
    const sceneOrder = loadSceneOrderFromManifest(projectManifest);
    const scenes = {};
    for (const sceneId of sceneOrder) {
      const sceneDraft = loadScene(normalizedProjectId, sceneId);
      if (sceneDraft) {
        scenes[sceneId] = sceneDraft;
      }
    }

    return scenes;
  };

  const loadProjectLibrarySnapshot = () => {
    const manifestSnapshot = loadStoredManifestSnapshot();
    return {
      schemaVersion,
      activeProjectId: manifestSnapshot.activeProjectId,
      projects: (manifestSnapshot.projects ?? []).map((project) => hydrateProjectRecord(project, { loadScene })),
      sceneStore: {},
    };
  };

  const loadActiveProjectId = () => {
    const candidate = storageAdapter.readJson(activeProjectIdStorageKey);
    return typeof candidate === "string" && candidate.trim() ? candidate : null;
  };

  const saveActiveProjectId = (projectId) => {
    const value = typeof projectId === "string" && projectId.trim() ? projectId : "";
    storageAdapter.writeJson(activeProjectIdStorageKey, value);
    return value || null;
  };

  const saveProjectLibrarySnapshot = (snapshot, options = {}) => {
    const cacheWasCleared = options.replaceExistingCache === true
      ? clearProjectLibraryCache()
      : true;
    const migrated = migrateProjectData(snapshot, {
      targetSchemaVersion: schemaVersion,
    });
    const currentManifest = loadStoredManifestSnapshot();
    const existingProjectsById = new Map(
      (currentManifest.projects ?? []).map((project) => [project.id, project]),
    );
    const changedSceneIdsByProject = options.changedSceneIdsByProject && typeof options.changedSceneIdsByProject === "object"
      ? options.changedSceneIdsByProject
      : {};
    const nextProjects = [];
    const sceneMapsByProjectId = new Map();
    let storageWritesAvailable = cacheWasCleared === true;
    const migratedProjectIds = new Set(
      migrated.projects
        .map((project) => normalizeProjectId(project?.id))
        .filter(Boolean),
    );

    // Intent: clear removed project scene chunks before writing the active cache so old manuscripts cannot crowd out the current one.
    for (const staleProject of existingProjectsById.values()) {
      const staleProjectId = normalizeProjectId(staleProject.id);
      if (!staleProjectId || migratedProjectIds.has(staleProjectId)) {
        continue;
      }

      const staleSceneIds = loadSceneOrderFromManifest(staleProject);
      for (const sceneId of staleSceneIds) {
        const removed = storageAdapter.remove(getSceneStorageKey(libraryStorageKey, staleProjectId, sceneId));
        if (removed !== true) {
          storageWritesAvailable = false;
          break;
        }
      }
    }

    for (const project of migrated.projects) {
      const projectId = normalizeProjectId(project.id);
      if (!projectId) {
        continue;
      }

      const existingManifestRecord = existingProjectsById.get(projectId) ?? null;
      const existingSceneFiles = existingManifestRecord?.projectStorage?.sceneFiles
        && typeof existingManifestRecord.projectStorage.sceneFiles === "object"
        && !Array.isArray(existingManifestRecord.projectStorage.sceneFiles)
        ? existingManifestRecord.projectStorage.sceneFiles
        : {};
      const sceneMap = collectSceneDraftsFromProjectRecord(project);
      mergeSceneStore(migrated.sceneStore, projectId, sceneMap);
      sceneMapsByProjectId.set(projectId, sceneMap);
      const previousSceneIds = loadSceneOrderFromManifest(existingManifestRecord);

      const sceneOrder = getSceneOrder(project, sceneMap);
      const sceneFiles = buildSceneFilesMap(projectId, sceneOrder, existingSceneFiles);
      const changedSceneIds = Array.isArray(changedSceneIdsByProject[projectId])
        ? new Set(changedSceneIdsByProject[projectId].map((sceneId) => normalizeSceneId(sceneId)).filter(Boolean))
        : null;
      for (const existingSceneId of previousSceneIds) {
        const storedScene = loadScene(projectId, existingSceneId);
        if (!storedScene) {
          continue;
        }
        const candidateScene = sceneMap.get(existingSceneId);
        if (!candidateScene) {
          sceneMap.set(existingSceneId, cloneValue(storedScene));
          continue;
        }

        const sceneWasExplicitlyChanged = changedSceneIds ? changedSceneIds.has(existingSceneId) : false;
        if (sceneWasExplicitlyChanged) {
          continue;
        }

        const candidateHasBody = sceneDraftHasSubstantiveBody(candidateScene);
        const storedHasBody = sceneDraftHasSubstantiveBody(storedScene);
        if (!candidateHasBody && storedHasBody) {
          sceneMap.set(existingSceneId, mergeSceneMetadataIntoStoredScene(storedScene, candidateScene, existingSceneId));
        }
      }
      const sceneIdsToWrite = changedSceneIds
        ? sceneOrder.filter((sceneId) => changedSceneIds.has(sceneId))
        : sceneOrder;

      for (const sceneId of sceneIdsToWrite) {
        const sceneDraft = sceneMap.get(sceneId);
        if (!sceneDraft || storageWritesAvailable === false) {
          continue;
        }
        const writeResult = writeSceneRecord(projectId, sceneId, sceneDraft);
        if (writeResult.persisted !== true) {
          storageWritesAvailable = false;
        }
      }

      const nextSceneIdSet = new Set(sceneOrder);
      for (const previousSceneId of previousSceneIds) {
        if (storageWritesAvailable === true && !nextSceneIdSet.has(previousSceneId)) {
          const removed = storageAdapter.remove(getSceneStorageKey(libraryStorageKey, projectId, previousSceneId));
          if (removed !== true) {
            storageWritesAvailable = false;
          }
        }
      }

      const manifestRecord = buildManifestRecord(project, {
        schemaVersion,
        sceneOrder,
        sceneFiles,
        sceneMap,
      });
      nextProjects.push(manifestRecord);
      existingProjectsById.delete(projectId);
    }

    for (const staleProject of existingProjectsById.values()) {
      const staleProjectId = normalizeProjectId(staleProject.id);
      if (!staleProjectId || migratedProjectIds.has(staleProjectId)) {
        continue;
      }
      const staleSceneIds = loadSceneOrderFromManifest(staleProject);
      for (const sceneId of staleSceneIds) {
        if (storageWritesAvailable !== true) {
          continue;
        }
        const removed = storageAdapter.remove(getSceneStorageKey(libraryStorageKey, staleProjectId, sceneId));
        if (removed !== true) {
          storageWritesAvailable = false;
        }
      }
    }

    const activeProjectId = typeof migrated.activeProjectId === "string" && migrated.activeProjectId.trim()
      ? migrated.activeProjectId
      : nextProjects[0]?.id ?? null;
    const resolvedActiveProjectId = nextProjects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : nextProjects[0]?.id ?? null;
    const manifestSnapshot = {
      schemaVersion,
      activeProjectId: resolvedActiveProjectId,
      projects: nextProjects,
      sceneStore: {},
    };
    if (storageWritesAvailable === true) {
      storageWritesAvailable = storageAdapter.writeJson(libraryStorageKey, manifestSnapshot) === true;
    }
    if (storageWritesAvailable === true) {
      saveActiveProjectId(manifestSnapshot.activeProjectId);
    }

    return {
      schemaVersion,
      activeProjectId: manifestSnapshot.activeProjectId,
      projects: manifestSnapshot.projects.map((project) => hydrateProjectRecord(project, {
        loadScene,
        sceneMap: sceneMapsByProjectId.get(project.id) ?? null,
      })),
      sceneStore: {},
      storagePersisted: storageWritesAvailable === true,
    };
  };

  return {
    clearProjectLibraryCache,
    loadActiveProjectId,
    loadAllScenes,
    loadProjectLibrarySnapshot,
    loadScene,
    saveActiveProjectId,
    saveProjectLibrarySnapshot,
    saveScene,
  };
}
