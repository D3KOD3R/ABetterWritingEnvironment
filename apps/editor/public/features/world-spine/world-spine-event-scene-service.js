// Intent: materialize newly inserted World Spine events as placed manuscript scene drafts.
import { normalizeSceneWorldSpineMetadata } from "./scene-world-spine-metadata.js";

// Intent: create a scene shell and anchor the saved world node to its first draft block.
export function createWorldSpineEventScenePlacement({
  world = {},
  eventNode = null,
  scenes = [],
  structureDrafts = {},
  insertionContext = {},
  now = new Date(),
} = {}) {
  const nodeId = normalizeString(eventNode?.id);
  const sourceNode = findWorldSpineStorageNode(world, nodeId) ?? eventNode;
  if (!nodeId || !sourceNode || typeof sourceNode !== "object") {
    return {
      world,
      structureDrafts,
      sceneDraft: null,
      node: eventNode,
      changed: false,
      reason: "missing-event-node",
    };
  }

  if (hasManuscriptAnchor(sourceNode) || hasManuscriptAnchor(eventNode)) {
    return {
      world,
      structureDrafts,
      sceneDraft: null,
      node: hasManuscriptAnchor(eventNode) ? eventNode : sourceNode,
      changed: false,
      reason: "already-anchored",
    };
  }

  const orderedScenes = normalizeSceneRecords(scenes);
  const insertionIndex = resolveWorldSpineEventSceneInsertionIndex({
    eventNode: sourceNode,
    insertionContext,
    scenes: orderedScenes,
  });
  const sceneDraft = buildWorldSpineEventSceneDraft(sourceNode, {
    insertionIndex,
    scenes: orderedScenes,
    structureDrafts,
    now,
  });
  const nextStructureDrafts = insertSceneDraftAtIndex(structureDrafts, orderedScenes, sceneDraft, insertionIndex);
  const nextWorld = linkWorldSpineNodeToSceneDraft(world, nodeId, sceneDraft);

  return {
    world: nextWorld,
    structureDrafts: nextStructureDrafts,
    sceneDraft,
    node: findWorldSpineStorageNode(nextWorld, nodeId) ?? {
      ...sourceNode,
      sceneId: sceneDraft.sceneId,
      primaryBlockId: sceneDraft.blockId,
    },
    changed: true,
    reason: "scene-created",
    insertionIndex,
  };
}

// Intent: map timeline slot ranks to the ordered manuscript scene list.
export function resolveWorldSpineEventSceneInsertionIndex({
  eventNode = null,
  insertionContext = {},
  scenes = [],
} = {}) {
  const sceneCount = normalizeSceneRecords(scenes).length;
  const rank = Number(eventNode?.sequenceRank);
  if (Number.isFinite(rank)) {
    return clampIndex(Math.floor(rank) + 1, sceneCount);
  }

  const slotIndex = Number(eventNode?.timelineSlotIndex ?? insertionContext?.dropIndex);
  return clampIndex(Number.isFinite(slotIndex) ? Math.round(slotIndex) : sceneCount, sceneCount);
}

// Intent: convert the event record into scene metadata without inserting generated prose.
function buildWorldSpineEventSceneDraft(eventNode = {}, {
  insertionIndex = 0,
  scenes = [],
  structureDrafts = {},
  now = new Date(),
} = {}) {
  const timestamp = resolveTimestampPart(now);
  const existingSceneIds = new Set([
    ...normalizeSceneRecords(scenes).map((scene) => scene.sceneId),
    ...normalizeStructureSceneDrafts(structureDrafts).map((scene) => normalizeString(scene.sceneId)),
  ].filter(Boolean));
  const sceneId = createUniqueId(`draft-scene-world-event-${timestamp}`, existingSceneIds);
  const blockId = `draft-block-${sceneId}-1`;
  const neighbor = resolveScenePlacementNeighbor(scenes, insertionIndex);
  const title = normalizeString(eventNode.label ?? eventNode.title) || "World Spine event";
  const summary = normalizeString(eventNode.summary);
  const peoplePresent = uniqueStrings([
    ...normalizeStringList(eventNode.people),
    ...normalizeStringList(eventNode.charactersPresent),
  ]);
  const criticalEvents = uniqueStrings([
    title,
    ...normalizeStringList(eventNode.criticalEvents),
  ]);
  const locationMetadata = normalizeWorldSpineEventNodeLocationMetadata(eventNode);
  const metadata = normalizeSceneWorldSpineMetadata({
    ...locationMetadata,
    date: normalizeString(eventNode.date ?? eventNode.metadata?.date),
    time: normalizeString(eventNode.time ?? eventNode.metadata?.time),
    peoplePresent,
    sceneBeats: normalizeStringList(eventNode.sceneBeats),
    criticalEvents,
  });

  return {
    sceneId,
    blockId,
    paragraphId: `draft-paragraph-${sceneId}-1`,
    chapterId: neighbor.chapterId || "draft-chapter-world-spine",
    chapterTitle: neighbor.chapterTitle || "World Spine Drafts",
    sceneTitle: title,
    sceneSynopsis: summary,
    initialText: "",
    location: metadata.location,
    childLocation: metadata.sublocation,
    childLocationLabel: metadata.sublocation,
    sublocation: metadata.sublocation,
    orbitalBand: metadata.orbitalBand,
    locationRowLabel: metadata.locationRowLabel,
    locationRowKey: metadata.locationRowKey,
    locationScope: metadata.locationScope,
    date: metadata.date,
    time: metadata.time,
    peoplePresent: metadata.peoplePresent,
    criticalEvents: metadata.criticalEvents,
    sceneBeats: metadata.sceneBeats,
    worldSpineMetadata: {
      ...metadata,
      sourceWorldSpineNodeId: normalizeString(eventNode.id),
    },
  };
}

// Intent: preserve broad row placement separately from finer ship, facility, or orbital detail.
function normalizeWorldSpineEventNodeLocationMetadata(eventNode = {}) {
  const metadata = eventNode?.metadata && typeof eventNode.metadata === "object" && !Array.isArray(eventNode.metadata)
    ? eventNode.metadata
    : {};
  const placement = eventNode?.locationPlacement && typeof eventNode.locationPlacement === "object" && !Array.isArray(eventNode.locationPlacement)
    ? eventNode.locationPlacement
    : {};

  return {
    location: normalizeString(
      eventNode.location ??
        eventNode.locationLabel ??
        placement.locationLabel ??
        placement.eventLocationLabel ??
        metadata.location ??
        metadata.locationLabel,
    ),
    sublocation: normalizeString(
      eventNode.childLocation ??
        eventNode.childLocationLabel ??
        eventNode.sublocation ??
        eventNode.subLocation ??
        eventNode.sublocationLabel ??
        placement.childLocationLabel ??
        placement.sublocationLabel ??
        metadata.childLocation ??
        metadata.childLocationLabel ??
        metadata.sublocation ??
        metadata.subLocation ??
        metadata.sublocationLabel,
    ),
    orbitalBand: normalizeString(
      eventNode.orbitalBand ??
        placement.orbitalBand ??
        metadata.orbitalBand,
    ),
    locationRowLabel: normalizeString(
      eventNode.locationRowLabel ??
        placement.locationRowLabel ??
        metadata.locationRowLabel,
    ),
    locationRowKey: normalizeString(
      eventNode.locationRowKey ??
        placement.locationRowKey ??
        metadata.locationRowKey,
    ),
    locationScope: normalizeString(
      eventNode.locationScope ??
        placement.locationScope ??
        metadata.locationScope,
    ),
  };
}

// Intent: persist scene ordering explicitly so before-first timeline inserts stay before the first scene.
function insertSceneDraftAtIndex(structureDrafts = {}, scenes = [], sceneDraft = {}, insertionIndex = 0) {
  const existingOrder = normalizeSceneRecords(scenes)
    .map((scene) => scene.sceneId)
    .filter((sceneId) => sceneId && sceneId !== sceneDraft.sceneId);
  const targetIndex = clampIndex(insertionIndex, existingOrder.length);
  const nextSceneOrder = [...existingOrder];
  nextSceneOrder.splice(targetIndex, 0, sceneDraft.sceneId);
  const existingDraftScenes = normalizeStructureSceneDrafts(structureDrafts)
    .filter((scene) => normalizeString(scene.sceneId) !== sceneDraft.sceneId);

  return {
    ...cloneValue(structureDrafts && typeof structureDrafts === "object" ? structureDrafts : {}),
    scenes: [...existingDraftScenes, cloneValue(sceneDraft)],
    sceneOrder: nextSceneOrder,
  };
}

// Intent: make the world node resolvable through the manuscript scene created for this event.
function linkWorldSpineNodeToSceneDraft(world = {}, nodeId = "", sceneDraft = {}) {
  const nextWorld = cloneValue(world && typeof world === "object" ? world : {});
  const anchor = {
    sceneId: normalizeString(sceneDraft.sceneId),
    blockId: normalizeString(sceneDraft.blockId),
    startOffset: 0,
    endOffset: 0,
  };
  nextWorld.spines = (Array.isArray(nextWorld.spines) ? nextWorld.spines : []).map((spine) => ({
    ...spine,
    nodes: (Array.isArray(spine.nodes) ? spine.nodes : []).map((node) => {
      if (normalizeString(node?.id) !== nodeId) {
        return node;
      }

      const metadata = node?.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
        ? node.metadata
        : {};
      return {
        ...node,
        sceneId: anchor.sceneId,
        primaryBlockId: anchor.blockId,
        manuscriptAnchors: mergeManuscriptAnchors(node.manuscriptAnchors, anchor),
        eventStartAnchor: hasAnchor(node.eventStartAnchor) ? node.eventStartAnchor : anchor,
        metadata: {
          ...metadata,
          manuscriptSceneId: anchor.sceneId,
          manuscriptBlockId: anchor.blockId,
        },
      };
    }),
  }));
  return nextWorld;
}

function resolveScenePlacementNeighbor(scenes = [], insertionIndex = 0) {
  const orderedScenes = normalizeSceneRecords(scenes);
  const previousScene = insertionIndex > 0 ? orderedScenes[insertionIndex - 1] : null;
  const nextScene = orderedScenes[insertionIndex] ?? null;
  const neighbor = previousScene ?? nextScene ?? {};
  return {
    chapterId: normalizeString(neighbor.chapterId),
    chapterTitle: normalizeString(neighbor.chapterTitle),
  };
}

function hasManuscriptAnchor(node = {}) {
  return Boolean(
    normalizeString(node.primaryBlockId) ||
    hasAnchor(node.eventStartAnchor) ||
    hasAnchor(node.eventEndAnchor) ||
    (Array.isArray(node.manuscriptAnchors) && node.manuscriptAnchors.some(hasAnchor))
  );
}

function hasAnchor(anchor = null) {
  return Boolean(normalizeString(anchor?.sceneId) && normalizeString(anchor?.blockId));
}

function mergeManuscriptAnchors(existingAnchors = [], anchor = {}) {
  const anchors = [];
  const seen = new Set();
  for (const candidate of [...(Array.isArray(existingAnchors) ? existingAnchors : []), anchor]) {
    if (!hasAnchor(candidate)) {
      continue;
    }

    const normalized = {
      sceneId: normalizeString(candidate.sceneId),
      blockId: normalizeString(candidate.blockId),
      startOffset: Number.isInteger(Number(candidate.startOffset)) ? Number(candidate.startOffset) : 0,
      endOffset: Number.isInteger(Number(candidate.endOffset)) ? Number(candidate.endOffset) : 0,
    };
    const key = `${normalized.sceneId}:${normalized.blockId}:${normalized.startOffset}:${normalized.endOffset}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    anchors.push(normalized);
  }
  return anchors;
}

function findWorldSpineStorageNode(world = {}, nodeId = "") {
  const normalizedNodeId = normalizeString(nodeId);
  if (!normalizedNodeId) {
    return null;
  }

  for (const spine of Array.isArray(world?.spines) ? world.spines : []) {
    for (const node of Array.isArray(spine?.nodes) ? spine.nodes : []) {
      if (normalizeString(node?.id) === normalizedNodeId) {
        return node;
      }
    }
  }
  return null;
}

function normalizeSceneRecords(scenes = []) {
  return (Array.isArray(scenes) ? scenes : [])
    .filter((scene) => scene && typeof scene === "object")
    .map((scene) => ({
      ...scene,
      sceneId: normalizeString(scene.sceneId),
      chapterId: normalizeString(scene.chapterId),
      chapterTitle: normalizeString(scene.chapterTitle),
    }))
    .filter((scene) => scene.sceneId);
}

function normalizeStructureSceneDrafts(structureDrafts = {}) {
  return (Array.isArray(structureDrafts?.scenes) ? structureDrafts.scenes : [])
    .filter((scene) => scene && typeof scene === "object")
    .map((scene) => cloneValue(scene));
}

function resolveTimestampPart(now = new Date()) {
  if (now instanceof Date && Number.isFinite(now.getTime())) {
    return String(now.getTime());
  }

  const numericNow = Number(now);
  if (Number.isFinite(numericNow)) {
    return String(Math.max(0, Math.round(numericNow)));
  }

  const parsed = Date.parse(String(now ?? ""));
  return Number.isFinite(parsed) ? String(parsed) : String(Date.now());
}

function createUniqueId(baseId = "", existingIds = new Set()) {
  const normalizedBaseId = normalizeString(baseId) || `draft-scene-world-event-${Date.now()}`;
  if (!existingIds.has(normalizedBaseId)) {
    return normalizedBaseId;
  }

  let suffix = 2;
  let candidate = `${normalizedBaseId}-${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBaseId}-${suffix}`;
  }
  return candidate;
}

function clampIndex(index = 0, length = 0) {
  const safeLength = Math.max(0, Number(length) || 0);
  const safeIndex = Number.isFinite(Number(index)) ? Math.round(Number(index)) : safeLength;
  return Math.max(0, Math.min(safeLength, safeIndex));
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    const text = normalizeString(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);
  }
  return result;
}

function normalizeStringList(value = []) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  return uniqueStrings(String(value ?? "").split(/[\n,;]+/));
}

function normalizeString(value = "") {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
