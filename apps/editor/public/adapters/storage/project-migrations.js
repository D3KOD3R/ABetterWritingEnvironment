// Intent: define a migration boundary so project snapshots can evolve without breaking older save data.
import {
  applyPassageNoteCountsToProjectIndex,
  buildProjectIndexFromProjectRecord,
  collectChapterRecords,
} from "./project-index.js";

export const PROJECT_SCHEMA_VERSION = 2;

function requireSupportedSchemaVersion(candidateVersion, targetSchemaVersion, label) {
  const schemaVersion = Number(candidateVersion);
  if (Number.isFinite(schemaVersion) && schemaVersion > targetSchemaVersion) {
    throw new Error(`${label} uses schema version ${schemaVersion}, newer than this app supports (${targetSchemaVersion}).`);
  }
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeSnapshotCandidate(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      activeProjectId: null,
      projects: [],
      sceneStore: {},
    };
  }

  if (Array.isArray(rawData.projects)) {
    return {
      schemaVersion: Number(rawData.schemaVersion) || PROJECT_SCHEMA_VERSION,
      activeProjectId: typeof rawData.activeProjectId === "string" ? rawData.activeProjectId : null,
      projects: rawData.projects,
      sceneStore: rawData.sceneStore,
    };
  }

  if (rawData.workspace && typeof rawData.workspace === "object") {
    return {
      schemaVersion: Number(rawData.schemaVersion) || PROJECT_SCHEMA_VERSION,
      activeProjectId: typeof rawData.id === "string" ? rawData.id : null,
      projects: [rawData],
      sceneStore: {},
    };
  }

  return {
    schemaVersion: Number(rawData.schemaVersion) || PROJECT_SCHEMA_VERSION,
    activeProjectId: null,
    projects: [],
    sceneStore: {},
  };
}

function normalizeSceneStore(sceneStoreCandidate) {
  if (!sceneStoreCandidate || typeof sceneStoreCandidate !== "object" || Array.isArray(sceneStoreCandidate)) {
    return {};
  }

  const normalized = {};
  for (const [projectId, sceneMapCandidate] of Object.entries(sceneStoreCandidate)) {
    if (typeof projectId !== "string" || !projectId.trim()) {
      continue;
    }
    if (!sceneMapCandidate || typeof sceneMapCandidate !== "object" || Array.isArray(sceneMapCandidate)) {
      continue;
    }

    const sceneMap = {};
    for (const [sceneId, sceneRecord] of Object.entries(sceneMapCandidate)) {
      if (typeof sceneId !== "string" || !sceneId.trim()) {
        continue;
      }
      if (!sceneRecord || typeof sceneRecord !== "object" || Array.isArray(sceneRecord)) {
        continue;
      }

      sceneMap[sceneId] = cloneValue(sceneRecord);
    }

    if (Object.keys(sceneMap).length) {
      normalized[projectId] = sceneMap;
    }
  }

  return normalized;
}

function migrateProjectRecord(record, targetSchemaVersion) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const schemaVersion = Number(record.schemaVersion) || targetSchemaVersion;
  const projectSettings = record.projectSettings && typeof record.projectSettings === "object" && !Array.isArray(record.projectSettings)
    ? record.projectSettings
    : {};
  const normalizedAssetRegistry = Array.isArray(projectSettings.assetRegistry)
    ? [...projectSettings.assetRegistry]
    : [];
  const projectStorage = record.projectStorage && typeof record.projectStorage === "object" && !Array.isArray(record.projectStorage)
    ? record.projectStorage
    : {};
  const sceneOrder = Array.isArray(projectStorage.sceneOrder)
    ? projectStorage.sceneOrder.filter((sceneId) => typeof sceneId === "string" && sceneId.trim())
    : [];
  const sceneFiles = projectStorage.sceneFiles && typeof projectStorage.sceneFiles === "object" && !Array.isArray(projectStorage.sceneFiles)
    ? cloneValue(projectStorage.sceneFiles)
    : {};
  const migratedRecord = {
    ...record,
    schemaVersion,
    draftProofing: record.draftProofing && typeof record.draftProofing === "object" && !Array.isArray(record.draftProofing)
      ? cloneValue(record.draftProofing)
      : {
          schemaVersion: 1,
          activeRunId: "",
          runs: [],
        },
    projectSettings: {
      ...projectSettings,
      assetRegistry: normalizedAssetRegistry,
    },
    projectStorage: {
      format: typeof projectStorage.format === "string" ? projectStorage.format : "legacy-single-file",
      sceneOrder,
      sceneFiles,
    },
  };
  if (migratedRecord.workspace?.project && typeof migratedRecord.workspace.project === "object" && !Array.isArray(migratedRecord.workspace.project)) {
    migratedRecord.workspace = {
      ...migratedRecord.workspace,
      project: {
        ...migratedRecord.workspace.project,
        marks: Array.isArray(migratedRecord.workspace.project.marks)
          ? cloneValue(migratedRecord.workspace.project.marks)
          : [],
      },
    };
  }
  const existingProjectIndex = record.projectIndex && typeof record.projectIndex === "object" && !Array.isArray(record.projectIndex)
    ? cloneValue(record.projectIndex)
    : null;
  if (existingProjectIndex && Array.isArray(existingProjectIndex.scenes)) {
    const normalizedSceneOrder = Array.isArray(existingProjectIndex.sceneOrder) && existingProjectIndex.sceneOrder.length
      ? existingProjectIndex.sceneOrder
      : existingProjectIndex.scenes
        .map((scene) => (typeof scene?.id === "string" ? scene.id.trim() : ""))
        .filter(Boolean);
    migratedRecord.projectIndex = applyPassageNoteCountsToProjectIndex({
      ...existingProjectIndex,
      schemaVersion: targetSchemaVersion,
      projectId: typeof migratedRecord.id === "string"
        ? migratedRecord.id
        : (typeof existingProjectIndex.projectId === "string" ? existingProjectIndex.projectId : ""),
      projectTitle: typeof migratedRecord.title === "string"
        ? migratedRecord.title
        : (typeof existingProjectIndex.projectTitle === "string" ? existingProjectIndex.projectTitle : "Untitled Project"),
      updatedAt: typeof migratedRecord.updatedAt === "string"
        ? migratedRecord.updatedAt
        : (typeof existingProjectIndex.updatedAt === "string" ? existingProjectIndex.updatedAt : ""),
      sceneOrder: normalizedSceneOrder,
      chapters: Array.isArray(existingProjectIndex.chapters)
        ? existingProjectIndex.chapters
        : collectChapterRecords(existingProjectIndex.scenes),
    }, migratedRecord.passageNotes);
  } else {
    migratedRecord.projectIndex = buildProjectIndexFromProjectRecord(migratedRecord, {
      schemaVersion: targetSchemaVersion,
    });
  }
  migratedRecord.schemaVersion = targetSchemaVersion;
  return migratedRecord;
}

export function migrateProjectData(rawData, {
  targetSchemaVersion = PROJECT_SCHEMA_VERSION,
} = {}) {
  // Intent: never normalize a future durable schema into today's shape and then overwrite data this app cannot understand.
  requireSupportedSchemaVersion(rawData?.schemaVersion, targetSchemaVersion, "Project snapshot");
  for (const project of Array.isArray(rawData?.projects) ? rawData.projects : [rawData]) {
    requireSupportedSchemaVersion(project?.schemaVersion, targetSchemaVersion, "Project record");
  }
  const snapshot = normalizeSnapshotCandidate(rawData);
  const migratedProjects = (Array.isArray(snapshot.projects) ? snapshot.projects : [])
    .map((project) => migrateProjectRecord(project, targetSchemaVersion))
    .filter(Boolean);

  const activeProjectId = typeof snapshot.activeProjectId === "string" && snapshot.activeProjectId.trim()
    ? snapshot.activeProjectId
    : migratedProjects[0]?.id ?? null;
  const resolvedActiveProjectId = migratedProjects.some((project) => project.id === activeProjectId)
    ? activeProjectId
    : migratedProjects[0]?.id ?? null;

  return {
    schemaVersion: targetSchemaVersion,
    activeProjectId: resolvedActiveProjectId,
    projects: migratedProjects,
    sceneStore: normalizeSceneStore(snapshot.sceneStore),
  };
}
