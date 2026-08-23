// Intent: derive ManuScriptInfographicLane markers from durable task, research, world, and custom metadata anchors.
import {
  findCustomMetadataDefinition,
  getMetadataNoteLabel,
  isCustomMetadataNoteType,
} from "../metadata-console/custom-metadata-service.js";

const SCENE_METADATA_EVENT_FIELDS = Object.freeze(["criticalEvents", "criticalEvent", "importantEvents", "majorEvents"]);
const SCENE_METADATA_LOCATION_FIELDS = Object.freeze(["locationChanges", "locationChange", "settingChanges", "placeChanges"]);

// Intent: collect only author-navigable records for the ManuScriptInfographicLane.
export function createManuScriptInfographicLanePreviewsForScene({
  state = {},
  scene = null,
} = {}) {
  if (!scene?.sceneId) {
    return [];
  }

  const text = String(scene.editorText ?? "");
  if (!text.length) {
    return [];
  }

  const blockRanges = createSceneBlockRanges(scene);
  const definitions = Array.isArray(state?.customMetadataDefinitions)
    ? state.customMetadataDefinitions
    : [];
  return dedupeManuScriptInfographicLanePreviews([
    ...createTaskPreviews(state?.manuscriptTasks, scene, text.length),
    ...createResearchNotePreviews(state?.passageNotes, scene, text.length),
    ...createCustomMetadataNotePreviews(state?.passageNotes, scene, definitions, text.length),
    ...createEventTagPreviews(state?.workspace?.project?.eventTags, scene, blockRanges, text.length),
    ...createWorldSpineNodePreviews(state?.workspace?.world?.spines, scene, blockRanges, text.length),
    ...createSceneWorldSpineMetadataPreviews(scene, blockRanges, text.length),
  ]);
}

function createTaskPreviews(tasks = [], scene, textLength = 0) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task?.sceneId === scene.sceneId && task?.status !== "completed")
    .map((task) => {
      const range = createBoundedRange(task.startOffset, task.endOffset, textLength);
      if (!range) {
        return null;
      }

      return {
        id: `task:${task.id}`,
        markerType: "task",
        recordType: "task",
        recordId: String(task.id ?? ""),
        sceneId: scene.sceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `Task: ${task.title || task.body || task.description || "Manuscript task"}`,
      };
    })
    .filter(Boolean);
}

function createResearchNotePreviews(notes = [], scene, textLength = 0) {
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => note?.sceneId === scene.sceneId && note?.noteType === "research")
    .map((note) => {
      const range = createBoundedRange(note.startOffset, note.endOffset, textLength);
      if (!range) {
        return null;
      }

      return {
        id: `research-note:${note.id}`,
        markerType: "research",
        recordType: "passageNote",
        recordId: String(note.id ?? ""),
        sceneId: scene.sceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `Research: ${note.title || note.body || "Research note"}`,
      };
    })
    .filter(Boolean);
}

function createCustomMetadataNotePreviews(notes = [], scene, definitions = [], textLength = 0) {
  return (Array.isArray(notes) ? notes : [])
    .filter((note) => note?.sceneId === scene.sceneId && isCustomMetadataNoteType(note?.noteType))
    .map((note) => {
      const range = createBoundedRange(note.startOffset, note.endOffset, textLength);
      if (!range) {
        return null;
      }

      const definition = findCustomMetadataDefinition(definitions, note.noteType);
      const label = definition?.label ?? getMetadataNoteLabel(note.noteType, definitions);
      return {
        id: `metadata-note:${note.id}`,
        markerType: "metadata",
        recordType: "passageNote",
        recordId: String(note.id ?? ""),
        sceneId: scene.sceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `${label}: ${note.title || note.body || "Metadata note"}`,
        ...(definition?.icon ? { metadataIcon: definition.icon } : {}),
      };
    })
    .filter(Boolean);
}

function createEventTagPreviews(eventTags = [], scene, blockRanges = [], textLength = 0) {
  return (Array.isArray(eventTags) ? eventTags : [])
    .filter((eventTag) => resolveEventTagSceneId(eventTag) === scene.sceneId)
    .map((eventTag) => {
      const range = resolveCanonicalRecordSceneRange(eventTag, blockRanges, textLength);
      if (!range) {
        return null;
      }

      const eventId = String(eventTag.id ?? "");
      return {
        id: `world-event:${eventId}`,
        markerType: "world",
        recordType: "eventTag",
        recordId: eventId,
        nodeId: eventId ? `event:${eventId}` : "",
        sceneId: scene.sceneId,
        blockId: String(eventTag?.anchor?.blockId ?? eventTag?.blockId ?? ""),
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `World Spine: ${eventTag.label || eventTag.kind || "Event"}`,
      };
    })
    .filter(Boolean);
}

function createWorldSpineNodePreviews(spines = [], scene, blockRanges = [], textLength = 0) {
  return flattenWorldSpineNodes(spines)
    .flatMap((node) => {
      const nodeId = normalizeString(node.id);
      const boundaryPreviews = createWorldSpineBoundaryNodePreviews(node, scene, blockRanges, textLength, nodeId);
      if (boundaryPreviews.length) {
        return boundaryPreviews;
      }

      const blockId = normalizeString(node.primaryBlockId);
      const blockRange = blockRanges.find((range) => range.blockId === blockId) ?? null;
      if (!blockRange) {
        return [];
      }

      const range = createBoundedRange(blockRange.startOffset, blockRange.startOffset + 1, textLength);
      if (!range) {
        return [];
      }

      return [{
        id: `world-node:${nodeId}`,
        markerType: "world",
        recordType: "worldSpineNode",
        recordId: nodeId,
        nodeId,
        sceneId: scene.sceneId,
        blockId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `World Spine: ${normalizeString(node.label) || "World event"}`,
      }];
    });
}

function createWorldSpineBoundaryNodePreviews(node, scene, blockRanges = [], textLength = 0, nodeId = "") {
  const boundaries = resolveWorldSpineNodeBoundaryAnchors(node);
  return ["start", "end"]
    .map((boundary) => {
      const anchor = boundaries[boundary];
      if (!anchor || (anchor.sceneId && anchor.sceneId !== scene.sceneId)) {
        return null;
      }

      const range = resolveAnchorSceneRange(anchor, blockRanges, textLength);
      if (!range) {
        return null;
      }

      const normalizedNodeId = nodeId || normalizeString(node.id);
      return {
        id: `world-node-${boundary}:${normalizedNodeId}`,
        markerType: boundary === "start" ? "world-start" : "world-end",
        recordType: "worldSpineNode",
        recordId: `${normalizedNodeId}:${boundary}`,
        nodeId: normalizedNodeId,
        sceneId: scene.sceneId,
        blockId: anchor.blockId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        label: `World Spine ${boundary}: ${normalizeString(node.label) || "World event"}`,
      };
    })
    .filter(Boolean);
}

function createSceneWorldSpineMetadataPreviews(scene, blockRanges = [], textLength = 0) {
  const firstBlockRange = blockRanges[0] ?? null;
  const range = firstBlockRange
    ? createBoundedRange(firstBlockRange.startOffset, firstBlockRange.startOffset + 1, textLength)
    : null;
  if (!range) {
    return [];
  }

  const eventPreviews = readSceneMetadataList(scene, SCENE_METADATA_EVENT_FIELDS)
    .map((label) => createSceneMetadataPreview(scene, label, {
      kind: "metadata-event",
      recordType: "worldSpineMetadata",
      range,
      blockId: firstBlockRange.blockId,
    }));
  const locationPreviews = readSceneMetadataList(scene, SCENE_METADATA_LOCATION_FIELDS)
    .map((label) => createSceneMetadataPreview(scene, label, {
      kind: "metadata-location",
      recordType: "worldSpineMetadata",
      range,
      blockId: firstBlockRange.blockId,
    }));

  return [...eventPreviews, ...locationPreviews];
}

function createSceneMetadataPreview(scene, label, {
  kind = "metadata-event",
  recordType = "worldSpineMetadata",
  range = null,
  blockId = "",
} = {}) {
  const title = normalizeString(label);
  const nodeId = `metadata:${kind}:${scene.sceneId}:${slugify(title)}`;
  return {
    id: `world-metadata:${nodeId}`,
    markerType: "world",
    recordType,
    recordId: nodeId,
    nodeId,
    sceneId: scene.sceneId,
    blockId,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    label: `World Spine: ${title || "Scene event"}`,
  };
}

function createSceneBlockRanges(scene) {
  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = String(block?.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      blockId: normalizeString(block?.blockId),
      startOffset,
      endOffset,
      text,
    });
    offset = endOffset + (index < blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

function resolveEventTagSceneId(eventTag) {
  return normalizeString(eventTag?.anchor?.sceneId) || normalizeString(eventTag?.sceneId);
}

function resolveCanonicalRecordSceneRange(record, blockRanges = [], textLength = 0) {
  const blockId = normalizeString(record?.anchor?.blockId) || normalizeString(record?.blockId);
  const blockRange = blockRanges.find((range) => range.blockId === blockId) ?? null;
  if (!blockRange) {
    return null;
  }

  const localStartOffset = Number(record?.anchor?.startOffset);
  const localEndOffset = Number(record?.anchor?.endOffset);
  const startOffset = Number.isInteger(localStartOffset)
    ? blockRange.startOffset + localStartOffset
    : blockRange.startOffset;
  const endOffset = Number.isInteger(localEndOffset) && localEndOffset > localStartOffset
    ? blockRange.startOffset + localEndOffset
    : startOffset + 1;

  return createBoundedRange(startOffset, endOffset, textLength);
}

function resolveWorldSpineNodeBoundaryAnchors(node) {
  const anchors = Array.isArray(node?.manuscriptAnchors) ? node.manuscriptAnchors : [];
  const normalizedAnchors = anchors.map(normalizeBoundaryAnchor).filter(Boolean);
  const explicitStart = normalizeBoundaryAnchor(node?.eventStartAnchor);
  const explicitEnd = normalizeBoundaryAnchor(node?.eventEndAnchor);
  const startAnchor = explicitStart ?? normalizedAnchors.find((anchor) => anchor.boundary === "start") ?? null;
  const endAnchor = explicitEnd ?? normalizedAnchors.find((anchor) => anchor.boundary === "end") ?? null;

  return {
    start: startAnchor ?? (normalizedAnchors.length > 1 ? normalizedAnchors[0] : null),
    end: endAnchor ?? (normalizedAnchors.length > 1 ? normalizedAnchors[normalizedAnchors.length - 1] : null),
  };
}

function normalizeBoundaryAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") {
    return null;
  }

  const blockId = normalizeString(anchor.blockId);
  if (!blockId) {
    return null;
  }

  const startOffset = Number(anchor.startOffset);
  const endOffset = Number(anchor.endOffset);
  return {
    sceneId: normalizeString(anchor.sceneId),
    blockId,
    startOffset: Number.isInteger(startOffset) ? startOffset : 0,
    endOffset: Number.isInteger(endOffset) ? endOffset : (Number.isInteger(startOffset) ? startOffset + 1 : 1),
    boundary: normalizeBoundaryKind(anchor.boundary ?? anchor.boundaryType ?? anchor.kind ?? anchor.role ?? anchor.type),
  };
}

function normalizeBoundaryKind(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (["start", "event-start", "eventstart", "begin", "beginning"].includes(normalized)) {
    return "start";
  }
  if (["end", "event-end", "eventend", "finish", "stop"].includes(normalized)) {
    return "end";
  }
  return "";
}

function resolveAnchorSceneRange(anchor, blockRanges = [], textLength = 0) {
  const blockRange = blockRanges.find((range) => range.blockId === anchor.blockId) ?? null;
  if (!blockRange) {
    return null;
  }

  const localStartOffset = Number(anchor.startOffset);
  const localEndOffset = Number(anchor.endOffset);
  const startOffset = Number.isInteger(localStartOffset)
    ? blockRange.startOffset + localStartOffset
    : blockRange.startOffset;
  const endOffset = Number.isInteger(localEndOffset) && localEndOffset > localStartOffset
    ? blockRange.startOffset + localEndOffset
    : startOffset + 1;

  return createBoundedRange(startOffset, endOffset, textLength);
}

function createBoundedRange(startOffset, endOffset, textLength = 0) {
  const safeTextLength = Math.max(0, Number(textLength) || 0);
  const start = Number(startOffset);
  const end = Number(endOffset);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    start >= safeTextLength
  ) {
    return null;
  }

  return {
    startOffset: Math.max(0, Math.min(start, safeTextLength - 1)),
    endOffset: Math.max(start + 1, Math.min(end, safeTextLength)),
  };
}

function flattenWorldSpineNodes(spines = []) {
  return (Array.isArray(spines) ? spines : []).flatMap((spine) =>
    (Array.isArray(spine?.nodes) ? spine.nodes : []).map((node) => ({
      ...node,
      spineId: normalizeString(node?.spineId) || normalizeString(spine?.id),
      spineLabel: normalizeString(spine?.label),
    })),
  );
}

function readSceneMetadataList(scene, keys = []) {
  const value = readSceneMetadataValue(scene, keys);
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;|]+/)
      : [];
  return uniqueStrings(source.map(normalizeString).filter(Boolean));
}

function readSceneMetadataValue(scene, keys = []) {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  const sources = [
    scene,
    scene?.metadata,
    scene?.worldSpineMetadata,
    scene?.worldMetadata,
    scene?.timelineMetadata,
    scene?.metadata?.worldSpine,
    scene?.metadata?.timeline,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedKeys.has(normalizeKey(key))) {
        return value;
      }
    }
  }

  return "";
}

function dedupeManuScriptInfographicLanePreviews(previews = []) {
  const seen = new Set();
  const result = [];
  for (const preview of Array.isArray(previews) ? previews : []) {
    const key = [
      preview?.markerType,
      preview?.recordType,
      preview?.recordId,
      preview?.sceneId,
      preview?.startOffset,
    ].join(":");
    if (!preview || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(preview);
  }
  return result.sort((left, right) => (
    left.startOffset - right.startOffset ||
    left.markerType.localeCompare(right.markerType) ||
    left.recordId.localeCompare(right.recordId)
  ));
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizeString(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizeKey(value) {
  return normalizeString(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "reference";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}
