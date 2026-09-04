// Intent: compare project semantics independently of the chunked folder package's storage shape.
import { canonicalizeJsonPersistenceValue } from "./json-persistence-boundary.js";
import {
  composePersistedSceneEditorText,
  normalizePersistedSceneBlock,
} from "./project-scene-block.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function stableSerialize(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function collectSemanticDifferences(expected, actual, path, differences, limit) {
  if (differences.length >= limit || stableSerialize(expected) === stableSerialize(actual)) return;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) differences.push(`${path}.length`);
    const sharedLength = Math.min(expected.length, actual.length);
    for (let index = 0; index < sharedLength && differences.length < limit; index += 1) {
      collectSemanticDifferences(expected[index], actual[index], `${path}[${index}]`, differences, limit);
    }
  } else if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      if (differences.length >= limit) break;
      if (!Object.prototype.hasOwnProperty.call(expected, key)
        || !Object.prototype.hasOwnProperty.call(actual, key)) {
        differences.push(`${path}.${key}`);
        continue;
      }
      collectSemanticDifferences(expected[key], actual[key], `${path}.${key}`, differences, limit);
    }
  } else {
    differences.push(path);
  }
}

function normalizeSceneId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function composeEditorText(blocks) {
  return composePersistedSceneEditorText(Array.isArray(blocks) ? blocks : []);
}

function normalizeScene(sceneId, candidate = {}) {
  const id = normalizeSceneId(sceneId || candidate?.sceneId);
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const blocks = (Array.isArray(source.blocks) ? source.blocks : []).map((block, index) => (
    normalizePersistedSceneBlock(block, { fallbackBlockId: `block-${id}-${index + 1}` })
  ));
  return {
    ...cloneValue(source),
    sceneId: id,
    chapterId: typeof source.chapterId === "string" ? source.chapterId : "",
    chapterTitle: typeof source.chapterTitle === "string" ? source.chapterTitle : "Untitled Chapter",
    sceneTitle: typeof source.sceneTitle === "string" ? source.sceneTitle : "Untitled Scene",
    sceneSynopsis: typeof source.sceneSynopsis === "string" ? source.sceneSynopsis : "",
    editorText: typeof source.editorText === "string" ? source.editorText : composeEditorText(blocks),
    blocks,
  };
}

function collectScenesFromLines(projectRecord) {
  const sceneMap = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  for (const line of lines) {
    const sceneId = normalizeSceneId(line?.sceneId);
    if (!sceneId) continue;
    const scene = sceneMap.get(sceneId) ?? {
      sceneId,
      chapterId: typeof line?.chapterId === "string" ? line.chapterId : "",
      chapterTitle: typeof line?.chapterTitle === "string" ? line.chapterTitle : "Untitled Chapter",
      sceneTitle: typeof line?.sceneTitle === "string" ? line.sceneTitle : "Untitled Scene",
      sceneSynopsis: typeof line?.sceneSynopsis === "string" ? line.sceneSynopsis : "",
      blocks: [],
    };
    scene.blocks.push(normalizePersistedSceneBlock(line, {
      fallbackBlockId: `block-${sceneId}-${scene.blocks.length + 1}`,
    }));
    sceneMap.set(sceneId, scene);
  }
  return Object.fromEntries([...sceneMap.entries()].map(([sceneId, scene]) => [
    sceneId,
    normalizeScene(sceneId, scene),
  ]));
}

function collectProjectScenes(snapshot, projectRecord, projectId) {
  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
    ? projectRecord.sceneDrafts
    : {};
  const extractedScenes = Object.keys(sceneDrafts).length
    ? Object.fromEntries(Object.entries(sceneDrafts).map(([sceneId, scene]) => [sceneId, normalizeScene(sceneId, scene)]))
    : collectScenesFromLines(projectRecord);
  const explicitScenes = snapshot?.sceneStore?.[projectId] && typeof snapshot.sceneStore[projectId] === "object"
    ? snapshot.sceneStore[projectId]
    : {};
  const sceneIds = [...new Set([...Object.keys(extractedScenes), ...Object.keys(explicitScenes)])];

  // Intent: sceneStore owns current body/chunk facts, but an older sidecar may omit durable metadata still carried by the canonical record.
  // Compose those representations field-by-field just like the folder-package writer instead of replacing the whole scene DTO.
  return Object.fromEntries(sceneIds
    .map((sceneId) => {
      const normalizedId = normalizeSceneId(sceneId);
      const mergedScene = {
        ...(extractedScenes[sceneId] ?? {}),
        ...(explicitScenes[sceneId] ?? {}),
      };
      return [normalizedId, normalizeScene(normalizedId, mergedScene)];
    })
    .filter(([sceneId]) => Boolean(sceneId)));
}

function getSceneOrder(projectRecord, scenes) {
  const candidates = [
    ...(Array.isArray(projectRecord?.projectStorage?.sceneOrder) ? projectRecord.projectStorage.sceneOrder : []),
    ...(Array.isArray(projectRecord?.projectIndex?.sceneOrder) ? projectRecord.projectIndex.sceneOrder : []),
    ...(Array.isArray(projectRecord?.structureDrafts?.scenes)
      ? projectRecord.structureDrafts.scenes.map((scene) => scene?.sceneId)
      : []),
    ...Object.keys(scenes),
  ];
  return [...new Set(candidates.map(normalizeSceneId).filter(Boolean))];
}

function buildWriterGeneratedStructuralScene(sceneId, index, indexScene = {}) {
  return {
    sceneId,
    chapterId: indexScene.chapterId ?? "",
    chapterTitle: "Untitled Chapter",
    sceneTitle: indexScene.title ?? "Untitled Scene",
    sceneSynopsis: indexScene.synopsis ?? "",
    order: index + 1,
    initialText: "",
  };
}

const WRITER_STRUCTURAL_FIELD_NAMES = Object.freeze([
  "sceneId",
  "chapterId",
  "chapterTitle",
  "sceneTitle",
  "sceneSynopsis",
  "order",
  "initialText",
]);

function collectAuthoredStructuralProperties(existingScene) {
  const authoredProperties = cloneValue(existingScene);
  for (const fieldName of WRITER_STRUCTURAL_FIELD_NAMES) {
    delete authoredProperties[fieldName];
  }
  return authoredProperties;
}

function resolveStructuralString(existingValue, generatedValue, canonicalValue) {
  const normalizedValue = typeof existingValue === "string" ? existingValue : generatedValue;
  return normalizedValue === generatedValue ? canonicalValue : normalizedValue;
}

function resolveStructuralOrder(existingValue, generatedValue) {
  const normalizedValue = Number.isFinite(Number(existingValue)) ? Number(existingValue) : generatedValue;
  return normalizedValue === generatedValue ? generatedValue : normalizedValue;
}

// Intent: merge canonical scene facts with authored structure without treating manifest scaffolding as authored data.
function buildCanonicalStructuralScenes(projectRecord, scenes, sceneOrder) {
  const structuralScenes = Array.isArray(projectRecord?.structureDrafts?.scenes)
    ? projectRecord.structureDrafts.scenes
    : [];
  const structureBySceneId = new Map(
    structuralScenes
      .filter((scene) => scene && typeof scene === "object" && !Array.isArray(scene))
      .map((scene) => [normalizeSceneId(scene.sceneId), scene]),
  );
  const indexBySceneId = new Map(
    (Array.isArray(projectRecord?.projectIndex?.scenes) ? projectRecord.projectIndex.scenes : [])
      .map((scene) => [normalizeSceneId(scene?.id), scene]),
  );

  return sceneOrder.map((sceneId, index) => {
    const existingScene = structureBySceneId.get(sceneId) ?? {};
    const indexScene = indexBySceneId.get(sceneId) ?? {};
    const canonicalScene = scenes[sceneId] ?? {};
    const generatedScene = buildWriterGeneratedStructuralScene(sceneId, index, indexScene);
    const authoredProperties = collectAuthoredStructuralProperties(existingScene);
    const canonicalChapterId = typeof indexScene.chapterId === "string"
      ? indexScene.chapterId
      : canonicalScene.chapterId ?? "";
    const canonicalSceneTitle = typeof indexScene.title === "string"
      ? indexScene.title
      : canonicalScene.sceneTitle ?? "Untitled Scene";
    const canonicalSceneSynopsis = typeof indexScene.synopsis === "string"
      ? indexScene.synopsis
      : canonicalScene.sceneSynopsis ?? "";
    return {
      ...authoredProperties,
      sceneId,
      chapterId: resolveStructuralString(existingScene.chapterId, generatedScene.chapterId, canonicalChapterId),
      chapterTitle: resolveStructuralString(
        existingScene.chapterTitle,
        generatedScene.chapterTitle,
        canonicalScene.chapterTitle ?? "Untitled Chapter",
      ),
      sceneTitle: resolveStructuralString(existingScene.sceneTitle, generatedScene.sceneTitle, canonicalSceneTitle),
      sceneSynopsis: resolveStructuralString(
        existingScene.sceneSynopsis,
        generatedScene.sceneSynopsis,
        canonicalSceneSynopsis,
      ),
      order: resolveStructuralOrder(existingScene.order, generatedScene.order),
      initialText: resolveStructuralString(existingScene.initialText, generatedScene.initialText, ""),
    };
  });
}

function normalizeProjectRecord(projectRecord, sceneOrder) {
  const record = cloneValue(projectRecord ?? {});
  delete record.projectFilePath;
  delete record.projectStorage;
  delete record.sceneDrafts;
  record.structureDrafts = record.structureDrafts
    && typeof record.structureDrafts === "object"
    && !Array.isArray(record.structureDrafts)
    ? record.structureDrafts
    : {};
  delete record.structureDrafts.scenes;
  record.schemaVersion = Number(record.schemaVersion) || 2;
  record.metadataSubgroups = Array.isArray(record.metadataSubgroups) ? record.metadataSubgroups : [];
  if (record.projectSettings && typeof record.projectSettings === "object" && !Array.isArray(record.projectSettings)) {
    delete record.projectSettings.projectFilePath;
    const activeSceneId = normalizeSceneId(record.projectSettings.activeSceneId ?? sceneOrder[0] ?? "");
    record.projectSettings.activeSceneId = sceneOrder.includes(activeSceneId) ? activeSceneId : (sceneOrder[0] ?? "");
  }
  if (Array.isArray(record?.workspace?.project?.lines)) {
    record.workspace.project.lines = record.workspace.project.lines.map((line) => ({
      ...line,
      text: "",
    }));
  }
  return record;
}

export function buildProjectSemanticVerificationSnapshot(snapshot = {}) {
  // Package verification compares the JSON domain: undefined object properties are absent while array slots become null.
  const jsonSnapshot = canonicalizeJsonPersistenceValue(snapshot);
  const projects = Array.isArray(jsonSnapshot?.projects) ? jsonSnapshot.projects.filter(Boolean) : [];
  const activeProjectId = normalizeSceneId(jsonSnapshot?.activeProjectId) || normalizeSceneId(projects[0]?.id);
  return {
    schemaVersion: Number(jsonSnapshot?.schemaVersion) || 2,
    activeProjectId,
    projects: projects.map((projectRecord) => {
      const projectId = normalizeSceneId(projectRecord?.id);
      const scenes = collectProjectScenes(jsonSnapshot, projectRecord, projectId);
      const sceneOrder = getSceneOrder(projectRecord, scenes);
      return {
        project: normalizeProjectRecord(projectRecord, sceneOrder),
        sceneOrder,
        structuralScenes: buildCanonicalStructuralScenes(projectRecord, scenes, sceneOrder),
        scenes: Object.fromEntries(sceneOrder.map((sceneId) => [sceneId, scenes[sceneId] ?? null])),
      };
    }),
  };
}

export function collectProjectSnapshotSemanticDifferences(expectedSnapshot, actualSnapshot, {
  limit = 20,
} = {}) {
  const normalizedLimit = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 20));
  const expected = buildProjectSemanticVerificationSnapshot(expectedSnapshot);
  const actual = buildProjectSemanticVerificationSnapshot(actualSnapshot);
  const differences = [];
  collectSemanticDifferences(expected, actual, "$", differences, normalizedLimit);
  return differences;
}

export function assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, actualSnapshot, {
  operation = "project package",
  differenceLimit = 20,
} = {}) {
  const differences = collectProjectSnapshotSemanticDifferences(expectedSnapshot, actualSnapshot, {
    limit: differenceLimit,
  });
  if (differences.length) {
    throw new Error(`${operation} verification failed: the loaded package is not semantically equivalent to the expected project snapshot (first difference: ${differences[0]}; difference paths: ${differences.join(", ")}).`);
  }
  return true;
}
