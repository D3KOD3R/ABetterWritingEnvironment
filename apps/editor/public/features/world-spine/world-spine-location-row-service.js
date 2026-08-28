// Intent: own World Spine row-location assignment patches for scene-backed event records.

const DEFAULT_LOCATION_SCOPE = "planetary";
const DEFAULT_LOCATION_LABEL = "Unplaced location";
const DEFAULT_LOCATION_ROW_PROMPT = "Insert Location Name";

export function createWorldSpineLocationRowAssignment(location = "", context = {}) {
  const locationRowLabel = normalizeString(location);
  return {
    location: locationRowLabel,
    locationRowLabel,
    locationRowKey: createWorldSpineLocationKey(locationRowLabel),
    locationScope: normalizeString(context?.locationScope) || DEFAULT_LOCATION_SCOPE,
  };
}

// Intent: make the default row identity explicit without erasing useful event-local setting metadata.
export function createWorldSpineUnplacedLocationRowAssignment(context = {}) {
  return {
    location: DEFAULT_LOCATION_LABEL,
    locationRowLabel: DEFAULT_LOCATION_LABEL,
    locationRowKey: createWorldSpineLocationKey(DEFAULT_LOCATION_LABEL),
    locationScope: normalizeString(context?.locationScope) || DEFAULT_LOCATION_SCOPE,
  };
}

// Intent: carry scene-row mutations through binder reorder persistence without losing their explicit chunk IDs.
export function createWorldSpineSceneDropPersistenceOptions({
  changedSceneIds = [],
  changedPlaceLinks = false,
} = {}) {
  const normalizedSceneIds = normalizeStringList(changedSceneIds);
  const hasSceneChanges = normalizedSceneIds.length > 0;
  const hasWorldChanges = changedPlaceLinks === true;
  return {
    changedSceneIds: normalizedSceneIds,
    domain: hasSceneChanges && hasWorldChanges ? "world-spine" : hasSceneChanges ? "manuscript" : "world",
    dirtyReason: hasSceneChanges && hasWorldChanges
      ? "world-spine-scene-node-reordered-and-location-updated"
      : hasSceneChanges
        ? "world-spine-scene-location-updated"
        : "world-spine-scene-location-place-links-updated",
    source: "worldSpineController.onSceneNodeReorder",
    flushProjectFileAutosave: hasSceneChanges || hasWorldChanges,
  };
}

export function applyWorldSpineUnplacementToSceneRecord(scene = {}, assignment = {}) {
  const normalizedAssignment = normalizeWorldSpineUnplacedLocationAssignment(assignment, scene);
  const existingMetadata = isPlainObject(scene?.worldSpineMetadata) ? scene.worldSpineMetadata : {};
  return {
    ...scene,
    locationRowLabel: normalizedAssignment.locationRowLabel,
    locationRowKey: normalizedAssignment.locationRowKey,
    locationScope: normalizedAssignment.locationScope,
    worldSpineMetadata: {
      ...existingMetadata,
      locationRowLabel: normalizedAssignment.locationRowLabel,
      locationRowKey: normalizedAssignment.locationRowKey,
      locationScope: normalizedAssignment.locationScope,
    },
  };
}

export function applyWorldSpineLocationAssignmentToSceneRecord(scene = {}, assignment = {}) {
  const normalizedAssignment = normalizeWorldSpineLocationAssignment(assignment);
  if (!normalizedAssignment.location) {
    return scene;
  }

  const existingMetadata = isPlainObject(scene?.worldSpineMetadata) ? scene.worldSpineMetadata : {};
  return {
    ...scene,
    location: normalizedAssignment.location,
    locationRowLabel: normalizedAssignment.locationRowLabel,
    locationRowKey: normalizedAssignment.locationRowKey,
    locationScope: normalizedAssignment.locationScope,
    worldSpineMetadata: {
      ...existingMetadata,
      location: normalizedAssignment.location,
      locationRowLabel: normalizedAssignment.locationRowLabel,
      locationRowKey: normalizedAssignment.locationRowKey,
      locationScope: normalizedAssignment.locationScope,
    },
  };
}

export function applyWorldSpineLocationAssignmentToStructureDrafts(structureDrafts = {}, sceneId = "", assignment = {}) {
  const normalizedSceneId = normalizeString(sceneId);
  const scenes = Array.isArray(structureDrafts?.scenes) ? structureDrafts.scenes : [];
  if (!normalizedSceneId || !scenes.length) {
    return {
      structureDrafts,
      changed: false,
    };
  }

  let changed = false;
  const nextScenes = scenes.map((scene) => {
    if (normalizeString(scene?.sceneId) !== normalizedSceneId) {
      return scene;
    }
    if (hasWorldSpineLocationAssignment(scene, assignment)) {
      return scene;
    }
    changed = true;
    return applyWorldSpineLocationAssignmentToSceneRecord(scene, assignment);
  });

  return {
    structureDrafts: changed
      ? {
          ...structureDrafts,
          scenes: nextScenes,
        }
      : structureDrafts,
    changed,
  };
}

export function applyWorldSpineUnplacementToStructureDrafts(structureDrafts = {}, sceneId = "", assignment = {}) {
  const normalizedSceneId = normalizeString(sceneId);
  const scenes = Array.isArray(structureDrafts?.scenes) ? structureDrafts.scenes : [];
  if (!normalizedSceneId || !scenes.length) {
    return {
      structureDrafts,
      changed: false,
    };
  }

  let changed = false;
  const nextScenes = scenes.map((scene) => {
    if (normalizeString(scene?.sceneId) !== normalizedSceneId) {
      return scene;
    }
    if (hasWorldSpineUnplacedLocationRowAssignment(scene, assignment)) {
      return scene;
    }
    changed = true;
    return applyWorldSpineUnplacementToSceneRecord(scene, assignment);
  });

  return {
    structureDrafts: changed
      ? {
          ...structureDrafts,
          scenes: nextScenes,
        }
      : structureDrafts,
    changed,
  };
}

export function applyWorldSpineLocationAssignmentToSceneEventTags(eventTags = [], scene = {}, assignment = {}) {
  const sourceEventTags = Array.isArray(eventTags) ? eventTags : [];
  const sceneId = normalizeString(scene?.sceneId);
  const sceneBlockIds = new Set(
    (Array.isArray(scene?.blocks) ? scene.blocks : [])
      .map((block) => normalizeString(block?.blockId))
      .filter(Boolean),
  );
  if (!sceneId && !sceneBlockIds.size) {
    return {
      eventTags: sourceEventTags,
      changedEventTagIds: [],
    };
  }

  const changedEventTagIds = [];
  const nextEventTags = sourceEventTags.map((eventTag) => {
    if (!isEventTagLinkedToScene(eventTag, sceneId, sceneBlockIds)) {
      return eventTag;
    }
    if (hasWorldSpineLocationAssignment(eventTag, assignment)) {
      return eventTag;
    }

    changedEventTagIds.push(normalizeString(eventTag?.id));
    const metadata = isPlainObject(eventTag?.metadata) ? eventTag.metadata : {};
    const normalizedAssignment = normalizeWorldSpineLocationAssignment(assignment);
    return {
      ...eventTag,
      location: normalizedAssignment.location,
      locationRowLabel: normalizedAssignment.locationRowLabel,
      locationRowKey: normalizedAssignment.locationRowKey,
      locationScope: normalizedAssignment.locationScope,
      metadata: {
        ...metadata,
        location: normalizedAssignment.location,
        locationRowLabel: normalizedAssignment.locationRowLabel,
        locationRowKey: normalizedAssignment.locationRowKey,
        locationScope: normalizedAssignment.locationScope,
      },
    };
  });

  return {
    eventTags: nextEventTags,
    changedEventTagIds: changedEventTagIds.filter(Boolean),
  };
}

export function applyWorldSpineUnplacementToSceneEventTags(eventTags = [], scene = {}, assignment = {}) {
  const sourceEventTags = Array.isArray(eventTags) ? eventTags : [];
  const sceneId = normalizeString(scene?.sceneId);
  const sceneBlockIds = new Set(
    (Array.isArray(scene?.blocks) ? scene.blocks : [])
      .map((block) => normalizeString(block?.blockId))
      .filter(Boolean),
  );
  if (!sceneId && !sceneBlockIds.size) {
    return {
      eventTags: sourceEventTags,
      changedEventTagIds: [],
    };
  }

  const changedEventTagIds = [];
  const nextEventTags = sourceEventTags.map((eventTag) => {
    if (!isEventTagLinkedToScene(eventTag, sceneId, sceneBlockIds)) {
      return eventTag;
    }
    if (hasWorldSpineUnplacedLocationRowAssignment(eventTag, assignment)) {
      return eventTag;
    }

    changedEventTagIds.push(normalizeString(eventTag?.id));
    const metadata = isPlainObject(eventTag?.metadata) ? eventTag.metadata : {};
    const normalizedAssignment = normalizeWorldSpineUnplacedLocationAssignment(assignment, eventTag);
    return {
      ...eventTag,
      locationRowLabel: normalizedAssignment.locationRowLabel,
      locationRowKey: normalizedAssignment.locationRowKey,
      locationScope: normalizedAssignment.locationScope,
      metadata: {
        ...metadata,
        locationRowLabel: normalizedAssignment.locationRowLabel,
        locationRowKey: normalizedAssignment.locationRowKey,
        locationScope: normalizedAssignment.locationScope,
      },
    };
  });

  return {
    eventTags: nextEventTags,
    changedEventTagIds: changedEventTagIds.filter(Boolean),
  };
}

export function applyWorldSpineLocationAssignmentToWorldPlaceLinks(world = {}, {
  nodeIds = [],
  sceneIds = [],
  assignment = {},
} = {}) {
  const normalizedAssignment = normalizeWorldSpineLocationAssignment(assignment);
  const targetNodeIds = new Set([
    ...normalizeStringList(nodeIds),
    ...normalizeStringList(sceneIds).map((sceneId) => `scene:${sceneId}`),
  ].filter(Boolean));
  if (!normalizedAssignment.location || !targetNodeIds.size) {
    return {
      world,
      changed: false,
      removedEntityLinkIds: [],
      removedEntityIds: [],
    };
  }

  const sourceWorld = isPlainObject(world) ? world : {};
  const placeEntitiesById = buildWorldSpinePlaceEntityIndex(sourceWorld.entities);
  if (!placeEntitiesById.size) {
    return {
      world,
      changed: false,
      removedEntityLinkIds: [],
      removedEntityIds: [],
    };
  }

  const allowedPlaceKeys = new Set([
    createWorldSpineLocationKey(normalizedAssignment.location),
    createWorldSpineLocationKey(normalizedAssignment.locationRowLabel),
  ].filter(Boolean));
  const removedEntityIds = new Set();
  const removedEntityLinkIds = [];
  const sourceEntityLinks = Array.isArray(sourceWorld.entityLinks) ? sourceWorld.entityLinks : [];
  const nextEntityLinks = sourceEntityLinks.filter((link) => {
    const normalizedLink = normalizeWorldSpineEntityLink(link);
    if (
      normalizedLink.kind !== "timeline-presence" ||
      !targetNodeIds.has(normalizedLink.nodeId) ||
      !placeEntitiesById.has(normalizedLink.entityId)
    ) {
      return true;
    }

    const placeEntity = placeEntitiesById.get(normalizedLink.entityId);
    const matchesAssignedLocation = placeEntity.keys.some((key) => allowedPlaceKeys.has(key));
    if (matchesAssignedLocation) {
      return true;
    }

    removedEntityIds.add(normalizedLink.entityId);
    if (normalizedLink.id) {
      removedEntityLinkIds.push(normalizedLink.id);
    }
    return false;
  });

  if (!removedEntityIds.size) {
    return {
      world,
      changed: false,
      removedEntityLinkIds: [],
      removedEntityIds: [],
    };
  }

  return {
    world: {
      ...sourceWorld,
      entityLinks: nextEntityLinks,
      spines: removeWorldSpinePlaceLinksFromStoredNodes(sourceWorld.spines, {
        targetNodeIds,
        removedEntityIds,
        placeEntitiesById,
      }),
    },
    changed: true,
    removedEntityLinkIds,
    removedEntityIds: [...removedEntityIds],
  };
}

export function upsertWorldSpineLocationAssignmentInSceneStore(sceneStore = {}, {
  projectId = "",
  sceneId = "",
  sceneRecord = {},
  assignment = {},
} = {}) {
  const normalizedProjectId = normalizeString(projectId);
  const normalizedSceneId = normalizeString(sceneId);
  if (!normalizedProjectId || !normalizedSceneId) {
    return sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)
      ? sceneStore
      : {};
  }

  const sourceStore = sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)
    ? sceneStore
    : {};
  const projectStore = isPlainObject(sourceStore[normalizedProjectId]) ? sourceStore[normalizedProjectId] : {};
  const existingSceneRecord = isPlainObject(projectStore[normalizedSceneId]) ? projectStore[normalizedSceneId] : {};
  const mergedSceneRecord = {
    ...existingSceneRecord,
    ...sceneRecord,
    sceneId: normalizedSceneId,
  };

  // Intent: row-location metadata updates must not collapse retained manuscript body chunks.
  if (!sceneRecordHasSubstantiveBody(sceneRecord) && sceneRecordHasSubstantiveBody(existingSceneRecord)) {
    mergedSceneRecord.editorText = typeof existingSceneRecord.editorText === "string"
      ? existingSceneRecord.editorText
      : mergedSceneRecord.editorText;
    mergedSceneRecord.blocks = Array.isArray(existingSceneRecord.blocks)
      ? existingSceneRecord.blocks.map((block) => (isPlainObject(block) ? { ...block } : block))
      : mergedSceneRecord.blocks;
  }

  const nextSceneRecord = applyWorldSpineLocationAssignmentToSceneRecord(mergedSceneRecord, assignment);

  return {
    ...sourceStore,
    [normalizedProjectId]: {
      ...projectStore,
      [normalizedSceneId]: nextSceneRecord,
    },
  };
}

export function upsertWorldSpineUnplacementInSceneStore(sceneStore = {}, {
  projectId = "",
  sceneId = "",
  sceneRecord = {},
  assignment = {},
} = {}) {
  const normalizedProjectId = normalizeString(projectId);
  const normalizedSceneId = normalizeString(sceneId);
  if (!normalizedProjectId || !normalizedSceneId) {
    return sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)
      ? sceneStore
      : {};
  }

  const sourceStore = sceneStore && typeof sceneStore === "object" && !Array.isArray(sceneStore)
    ? sceneStore
    : {};
  const projectStore = isPlainObject(sourceStore[normalizedProjectId]) ? sourceStore[normalizedProjectId] : {};
  const existingSceneRecord = isPlainObject(projectStore[normalizedSceneId]) ? projectStore[normalizedSceneId] : {};
  const mergedSceneRecord = {
    ...existingSceneRecord,
    ...sceneRecord,
    sceneId: normalizedSceneId,
  };

  if (!sceneRecordHasSubstantiveBody(sceneRecord) && sceneRecordHasSubstantiveBody(existingSceneRecord)) {
    mergedSceneRecord.editorText = typeof existingSceneRecord.editorText === "string"
      ? existingSceneRecord.editorText
      : mergedSceneRecord.editorText;
    mergedSceneRecord.blocks = Array.isArray(existingSceneRecord.blocks)
      ? existingSceneRecord.blocks.map((block) => (isPlainObject(block) ? { ...block } : block))
      : mergedSceneRecord.blocks;
  }

  const nextSceneRecord = applyWorldSpineUnplacementToSceneRecord(mergedSceneRecord, assignment);
  return {
    ...sourceStore,
    [normalizedProjectId]: {
      ...projectStore,
      [normalizedSceneId]: nextSceneRecord,
    },
  };
}

function sceneRecordHasSubstantiveBody(sceneRecord = {}) {
  if (!isPlainObject(sceneRecord)) {
    return false;
  }
  if (typeof sceneRecord.editorText === "string" && sceneRecord.editorText.trim()) {
    return true;
  }
  return Array.isArray(sceneRecord.blocks) && sceneRecord.blocks.some((block) =>
    typeof block?.text === "string" && block.text.trim().length > 0,
  );
}

export function hasWorldSpineLocationAssignment(record = {}, assignment = {}) {
  const normalizedAssignment = normalizeWorldSpineLocationAssignment(assignment);
  const metadata = isPlainObject(record?.metadata) ? record.metadata : {};
  const worldSpineMetadata = isPlainObject(record?.worldSpineMetadata) ? record.worldSpineMetadata : {};
  return (
    normalizeString(record?.location ?? worldSpineMetadata.location ?? metadata.location) === normalizedAssignment.location &&
    normalizeString(record?.locationRowLabel ?? worldSpineMetadata.locationRowLabel ?? metadata.locationRowLabel) === normalizedAssignment.locationRowLabel &&
    normalizeString(record?.locationRowKey ?? worldSpineMetadata.locationRowKey ?? metadata.locationRowKey) === normalizedAssignment.locationRowKey &&
    normalizeString(record?.locationScope ?? worldSpineMetadata.locationScope ?? metadata.locationScope) === normalizedAssignment.locationScope
  );
}

export function hasWorldSpineUnplacedLocationRowAssignment(record = {}, assignment = {}) {
  const normalizedAssignment = normalizeWorldSpineUnplacedLocationAssignment(assignment, record);
  const metadata = isPlainObject(record?.metadata) ? record.metadata : {};
  const worldSpineMetadata = isPlainObject(record?.worldSpineMetadata) ? record.worldSpineMetadata : {};
  return (
    normalizeString(record?.locationRowLabel ?? worldSpineMetadata.locationRowLabel ?? metadata.locationRowLabel) === normalizedAssignment.locationRowLabel &&
    normalizeString(record?.locationRowKey ?? worldSpineMetadata.locationRowKey ?? metadata.locationRowKey) === normalizedAssignment.locationRowKey &&
    normalizeString(record?.locationScope ?? worldSpineMetadata.locationScope ?? metadata.locationScope) === normalizedAssignment.locationScope
  );
}

function normalizeWorldSpineLocationAssignment(assignment = {}) {
  const location = normalizeString(assignment?.location ?? assignment?.locationRowLabel);
  const locationRowLabel = normalizeString(assignment?.locationRowLabel) || location;
  const locationRowKey = resolveWorldSpineLocationRowKey(locationRowLabel, assignment?.locationRowKey);
  return {
    location,
    locationRowLabel,
    locationRowKey,
    locationScope: normalizeString(assignment?.locationScope) || DEFAULT_LOCATION_SCOPE,
  };
}

function normalizeWorldSpineUnplacedLocationAssignment(assignment = {}, record = {}) {
  const metadata = isPlainObject(record?.metadata) ? record.metadata : {};
  const worldSpineMetadata = isPlainObject(record?.worldSpineMetadata) ? record.worldSpineMetadata : {};
  return {
    location: DEFAULT_LOCATION_LABEL,
    locationRowLabel: DEFAULT_LOCATION_LABEL,
    locationRowKey: createWorldSpineLocationKey(DEFAULT_LOCATION_LABEL),
    locationScope: normalizeString(
      assignment?.locationScope ?? record?.locationScope ?? worldSpineMetadata.locationScope ?? metadata.locationScope,
    ) || DEFAULT_LOCATION_SCOPE,
  };
}

// Intent: stale prompt/default row keys should not override a newly named main location.
function resolveWorldSpineLocationRowKey(label = "", key = "") {
  const labelKey = normalizeString(label) ? createWorldSpineLocationKey(label) : "";
  const explicitKey = normalizeString(key) ? createWorldSpineLocationKey(key) : "";
  if (labelKey && !isDefaultWorldSpineLocationKey(labelKey)) {
    return labelKey;
  }
  if (explicitKey && !isDefaultWorldSpineLocationKey(explicitKey)) {
    return explicitKey;
  }
  return labelKey || explicitKey;
}

function isDefaultWorldSpineLocationKey(value = "") {
  const key = createWorldSpineLocationKey(value);
  return (
    key === createWorldSpineLocationKey(DEFAULT_LOCATION_LABEL) ||
    key === createWorldSpineLocationKey(DEFAULT_LOCATION_ROW_PROMPT)
  );
}

function buildWorldSpinePlaceEntityIndex(entities = []) {
  const index = new Map();
  for (const entity of Array.isArray(entities) ? entities : []) {
    const entityId = normalizeString(entity?.id);
    if (!entityId || !isWorldSpinePlaceEntity(entity)) {
      continue;
    }

    const keys = uniqueStrings(collectWorldSpinePlaceEntityNames(entity).map(createWorldSpineLocationKey));
    if (!keys.length) {
      continue;
    }

    index.set(entityId, {
      id: entityId,
      name: normalizeString(entity?.name),
      keys,
    });
  }
  return index;
}

function isWorldSpinePlaceEntity(entity = {}) {
  const categoryText = [
    entity?.categoryId,
    entity?.category,
    entity?.type,
    entity?.templateName,
    entity?.templateId,
    entity?.categoryLabel,
    entity?.kind,
  ].map(normalizeString).join(" ").toLowerCase();
  return /\b(planets?|worlds?|moons?|locations?|places?|settlements?|stations?|facilities?|docks?|cities?|regions?)\b/.test(categoryText);
}

function collectWorldSpinePlaceEntityNames(entity = {}) {
  const aliasValues = (Array.isArray(entity?.fields) ? entity.fields : [])
    .filter((field) => /alias|also known|aka/i.test(`${field?.key ?? ""} ${field?.label ?? ""}`))
    .flatMap((field) => normalizeStringList(field?.value));
  return uniqueStrings([
    entity?.name,
    ...aliasValues,
  ]);
}

function normalizeWorldSpineEntityLink(link = {}) {
  return {
    id: normalizeString(link?.id),
    entityId: normalizeString(link?.entityId),
    kind: normalizeString(link?.kind),
    nodeId: normalizeString(link?.nodeId ?? link?.timelineNodeId ?? link?.targetNodeId),
  };
}

function removeWorldSpinePlaceLinksFromStoredNodes(spines = [], {
  targetNodeIds = new Set(),
  removedEntityIds = new Set(),
  placeEntitiesById = new Map(),
} = {}) {
  if (!Array.isArray(spines) || !targetNodeIds.size || !removedEntityIds.size) {
    return Array.isArray(spines) ? spines : [];
  }

  return spines.map((spine) => {
    const nodes = Array.isArray(spine?.nodes) ? spine.nodes : [];
    let changed = false;
    const nextNodes = nodes.map((node) => {
      const nodeId = normalizeString(node?.id);
      if (!nodeId || !targetNodeIds.has(nodeId)) {
        return node;
      }

      const linkedEntityIds = normalizeStringList(node?.linkedEntityIds);
      const linkedEntityNames = normalizeStringList(node?.linkedEntityNames);
      const nextEntityIds = linkedEntityIds.filter((entityId) => !removedEntityIds.has(entityId));
      const removedPlaceNames = new Set(
        [...removedEntityIds]
          .map((entityId) => normalizeString(placeEntitiesById.get(entityId)?.name).toLowerCase())
          .filter(Boolean),
      );
      const nextEntityNames = linkedEntityNames.filter((name) => !removedPlaceNames.has(name.toLowerCase()));
      if (nextEntityIds.length === linkedEntityIds.length && nextEntityNames.length === linkedEntityNames.length) {
        return node;
      }

      changed = true;
      return {
        ...node,
        linkedEntityIds: nextEntityIds,
        linkedEntityNames: nextEntityNames,
      };
    });

    return changed
      ? {
          ...spine,
          nodes: nextNodes,
        }
      : spine;
  });
}

function isEventTagLinkedToScene(eventTag = {}, sceneId = "", sceneBlockIds = new Set()) {
  const tagSceneId = normalizeString(eventTag?.anchor?.sceneId ?? eventTag?.sceneId);
  if (sceneId && tagSceneId === sceneId) {
    return true;
  }

  const tagBlockId = normalizeString(eventTag?.anchor?.blockId ?? eventTag?.blockId);
  return Boolean(tagBlockId && sceneBlockIds instanceof Set && sceneBlockIds.has(tagBlockId));
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeString).filter(Boolean);
  }

  const text = normalizeString(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[,;\n]/)
    .map(normalizeString)
    .filter(Boolean);
}

function createWorldSpineLocationKey(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
