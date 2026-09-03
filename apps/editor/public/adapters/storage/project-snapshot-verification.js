// Intent: compare project semantics independently of the chunked folder package's storage shape.

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

function findFirstSemanticDifference(expected, actual, path = "$" ) {
  if (stableSerialize(expected) === stableSerialize(actual)) return null;
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return `${path}.length`;
    for (let index = 0; index < expected.length; index += 1) {
      const difference = findFirstSemanticDifference(expected[index], actual[index], `${path}[${index}]`);
      if (difference) return difference;
    }
  } else if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)
        || !Object.prototype.hasOwnProperty.call(actual, key)) return `${path}.${key}`;
      const difference = findFirstSemanticDifference(expected[key], actual[key], `${path}.${key}`);
      if (difference) return difference;
    }
  }
  return path;
}

function normalizeSceneId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function composeEditorText(blocks) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => String(block?.text ?? ""))
    .join("\n\n");
}

function normalizeScene(sceneId, candidate = {}) {
  const id = normalizeSceneId(sceneId || candidate?.sceneId);
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const blocks = (Array.isArray(source.blocks) ? source.blocks : []).map((block, index) => ({
    ...cloneValue(block ?? {}),
    blockId: typeof block?.blockId === "string" && block.blockId.trim()
      ? block.blockId
      : `block-${id}-${index + 1}`,
    lineNumber: Number.isFinite(Number(block?.lineNumber)) ? Number(block.lineNumber) : null,
    kind: typeof block?.kind === "string" ? block.kind : "narration",
    speakerLabel: typeof block?.speakerLabel === "string" ? block.speakerLabel : "",
    text: typeof block?.text === "string" ? block.text : "",
    issueIds: Array.isArray(block?.issueIds) ? [...block.issueIds] : [],
    eventTagIds: Array.isArray(block?.eventTagIds) ? [...block.eventTagIds] : [],
    isDraft: block?.isDraft === true || block?.lineNumber == null,
  }));
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
    scene.blocks.push({
      ...cloneValue(line),
      blockId: typeof line?.blockId === "string" && line.blockId.trim()
        ? line.blockId
        : `block-${sceneId}-${scene.blocks.length + 1}`,
      isDraft: false,
    });
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
  return Object.fromEntries(Object.entries({ ...extractedScenes, ...explicitScenes })
    .map(([sceneId, scene]) => [normalizeSceneId(sceneId), normalizeScene(sceneId, scene)])
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
  const projects = Array.isArray(snapshot?.projects) ? snapshot.projects.filter(Boolean) : [];
  const activeProjectId = normalizeSceneId(snapshot?.activeProjectId) || normalizeSceneId(projects[0]?.id);
  return {
    schemaVersion: Number(snapshot?.schemaVersion) || 2,
    activeProjectId,
    projects: projects.map((projectRecord) => {
      const projectId = normalizeSceneId(projectRecord?.id);
      const scenes = collectProjectScenes(snapshot, projectRecord, projectId);
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

export function assertProjectSnapshotsSemanticallyEquivalent(expectedSnapshot, actualSnapshot, {
  operation = "project package",
} = {}) {
  const expected = buildProjectSemanticVerificationSnapshot(expectedSnapshot);
  const actual = buildProjectSemanticVerificationSnapshot(actualSnapshot);
  if (stableSerialize(expected) !== stableSerialize(actual)) {
    const differencePath = findFirstSemanticDifference(expected, actual) ?? "$";
    throw new Error(`${operation} verification failed: the loaded package is not semantically equivalent to the expected project snapshot (first difference: ${differencePath}).`);
  }
  return true;
}
