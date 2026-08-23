// Intent: own reviewed catalogue-item assignments from World Spine events to structured world links.
import {
  applyWorldbuildingItemToWorld,
  buildWorldbuildingItemFromFormValues,
  buildWorldbuildingStudioModel,
} from "./worldbuilding-studio.js";

export const WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID = "vehicle";

// Intent: build a compact event-context picker from normalized catalogue records without mutating world data.
export function buildWorldSpineCatalogueAssignmentMenuModel({
  world = {},
  node = null,
} = {}) {
  const normalizedNode = normalizeWorldSpineAssignmentNode(node);
  if (!normalizedNode) {
    return {
      node: null,
      groups: [],
    };
  }

  const assignedEntityIds = selectWorldSpineAssignedEntityIdsForNode(world, normalizedNode.id);
  const studioModel = buildWorldbuildingStudioModel({ world });
  const groups = (Array.isArray(studioModel.categories) ? studioModel.categories : [])
    .filter((category) => normalizeString(category?.itemKind) === "entity")
    .map((category) => {
      const items = selectWorldSpineCatalogueAssignmentItems(world, {
        categoryId: category.id,
        assignedEntityIds,
      });
      return {
        id: normalizeString(category.id),
        label: formatWorldSpineAssignmentCategoryLabel(category),
        itemCount: items.length,
        items,
      };
    })
    .filter((group) => group.id && group.items.length > 0)
    .sort(compareWorldSpineAssignmentGroups);

  return {
    node: normalizedNode,
    selectedCategoryId: "",
    groups,
  };
}

// Intent: expose category item selection for focused tests and future AI-backed assignment previews.
export function selectWorldSpineCatalogueAssignmentItems(world = {}, {
  categoryId = WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID,
  assignedEntityIds = new Set(),
} = {}) {
  const normalizedCategoryId = normalizeString(categoryId) || WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID;
  const assignedIds = assignedEntityIds instanceof Set
    ? assignedEntityIds
    : new Set(normalizeStringList(assignedEntityIds));
  const model = buildWorldbuildingStudioModel({
    world,
    catalogueCategoryId: normalizedCategoryId,
  });

  return (Array.isArray(model.catalogue?.items) ? model.catalogue.items : [])
    .filter((item) => normalizeString(item?.itemKind) === "entity")
    .map((item) => {
      const itemId = normalizeString(item.id);
      return {
        id: itemId,
        entityId: itemId,
        categoryId: normalizeString(item.categoryId) || normalizedCategoryId,
        title: normalizeString(item.title) || "Untitled item",
        meta: normalizeString(item.meta),
        detail: normalizeString(item.detail),
        isAssigned: assignedIds.has(itemId),
      };
    })
    .filter((item) => item.id && item.title);
}

// Intent: persist a manual event presence link while preserving existing world records and avoiding duplicate links.
export function applyWorldSpineCatalogueItemAssignmentToWorld(world = {}, {
  nodeId = "",
  entityId = "",
  now = new Date(),
} = {}) {
  const normalizedNodeId = normalizeString(nodeId);
  const normalizedEntityId = normalizeString(entityId);
  const nextWorld = clonePlainObject(world);
  const entity = selectWorldSpineCatalogueEntities(nextWorld)
    .find((candidate) => candidate.id === normalizedEntityId);

  if (!normalizedNodeId) {
    return {
      world: nextWorld,
      changed: false,
      reason: "missing-node",
      link: null,
      entity: null,
    };
  }

  if (!entity) {
    return {
      world: nextWorld,
      changed: false,
      reason: "missing-entity",
      link: null,
      entity: null,
    };
  }

  const existingEntityLinks = Array.isArray(nextWorld.entityLinks) ? nextWorld.entityLinks : [];
  const presenceLinks = normalizeWorldSpineEntityLinks(existingEntityLinks);
  const existing = presenceLinks.find((link) =>
    link.kind === "timeline-presence" &&
    link.nodeId === normalizedNodeId &&
    link.entityId === normalizedEntityId
  );
  if (existing) {
    nextWorld.entityLinks = existingEntityLinks;
    return {
      world: nextWorld,
      changed: false,
      reason: "already-assigned",
      link: existing,
      entity,
    };
  }

  const timestamp = normalizeDateISOString(now);
  const nextSequence = resolveNextEntityLinkSequence(existingEntityLinks, nextWorld.sequences?.link);
  const link = {
    id: formatLinkId(nextSequence),
    entityId: normalizedEntityId,
    kind: "timeline-presence",
    nodeId: normalizedNodeId,
    source: "manual-world-spine-context-menu",
    createdAt: timestamp,
  };

  nextWorld.entityLinks = [...existingEntityLinks, link];
  nextWorld.spines = attachEntityToStoredWorldSpineNodes(nextWorld.spines, {
    nodeId: normalizedNodeId,
    entity,
  });
  if (nextWorld.sequences && typeof nextWorld.sequences === "object") {
    nextWorld.sequences = {
      ...nextWorld.sequences,
      link: Math.max(Number(nextWorld.sequences.link) || 0, nextSequence),
    };
  }
  nextWorld.updatedAt = timestamp;

  return {
    world: nextWorld,
    changed: true,
    reason: "assigned",
    link,
    entity,
  };
}

// Intent: create or reuse a Location catalogue record while marking the selected event's precise child location.
export function applyWorldSpineEventSublocationToWorld(world = {}, {
  nodeId = "",
  location = "",
  childLocation = "",
  sublocation = "",
  orbitalBand = "",
  now = new Date(),
} = {}) {
  const normalizedNodeId = normalizeString(nodeId);
  const normalizedSublocation = normalizeString(childLocation) || normalizeString(sublocation);
  const normalizedLocation = normalizeString(location);
  const normalizedOrbitalBand = normalizeString(orbitalBand);
  const timestamp = normalizeDateISOString(now);
  const sourceWorld = clonePlainObject(world);

  if (!normalizedNodeId) {
    return {
      world: sourceWorld,
      changed: false,
      reason: "missing-node",
      entity: null,
      link: null,
      storedNodeUpdated: false,
    };
  }

  if (!normalizedSublocation) {
    return {
      world: sourceWorld,
      changed: false,
      reason: "missing-sublocation",
      entity: null,
      link: null,
      storedNodeUpdated: false,
    };
  }

  const locationEntityResult = ensureWorldSpineSublocationEntity(sourceWorld, {
    location: normalizedLocation,
    sublocation: normalizedSublocation,
    now,
  });
  if (!locationEntityResult.entity?.id) {
    return {
      world: locationEntityResult.world,
      changed: false,
      reason: "missing-entity",
      entity: null,
      link: null,
      storedNodeUpdated: false,
    };
  }

  const assignment = applyWorldSpineCatalogueItemAssignmentToWorld(locationEntityResult.world, {
    nodeId: normalizedNodeId,
    entityId: locationEntityResult.entity?.id,
    now,
  });
  const storedNodeResult = applyWorldSpineSublocationToStoredNodes(assignment.world, {
    nodeId: normalizedNodeId,
    location: normalizedLocation,
    sublocation: normalizedSublocation,
    orbitalBand: normalizedOrbitalBand,
    timestamp,
  });

  return {
    world: storedNodeResult.world,
    changed: Boolean(locationEntityResult.created || assignment.changed || storedNodeResult.changed),
    reason: locationEntityResult.created
      ? "created-sublocation"
      : assignment.changed || storedNodeResult.changed
        ? "assigned-sublocation"
        : "already-assigned",
    entity: locationEntityResult.entity,
    link: assignment.link,
    storedNodeUpdated: storedNodeResult.changed,
  };
}

// Intent: let render models resolve reviewed presence links back to display names.
export function buildWorldSpineEntityPresenceIndex(world = {}) {
  const entitiesById = new Map(
    selectWorldSpineCatalogueEntities(world)
      .map((entity) => [entity.id, entity]),
  );
  const index = new Map();

  normalizeWorldSpineEntityLinks(world?.entityLinks)
    .filter((link) => link.kind === "timeline-presence")
    .forEach((link) => {
      const entity = entitiesById.get(link.entityId);
      const name = normalizeString(entity?.name);
      if (!link.nodeId || !name) {
        return;
      }

      const current = index.get(link.nodeId) ?? {
        entityIds: [],
        entityNames: [],
      };
      current.entityIds = uniqueStrings([...current.entityIds, link.entityId]);
      current.entityNames = uniqueStrings([...current.entityNames, name]);
      index.set(link.nodeId, current);
    });

  return index;
}

export function selectWorldSpineAssignedEntityIdsForNode(world = {}, nodeId = "") {
  const normalizedNodeId = normalizeString(nodeId);
  return new Set(
    normalizeWorldSpineEntityLinks(world?.entityLinks)
      .filter((link) => link.kind === "timeline-presence" && link.nodeId === normalizedNodeId)
      .map((link) => link.entityId)
      .filter(Boolean),
  );
}

// Intent: keep child-location creation as structured Location catalogue data, not only event metadata text.
function ensureWorldSpineSublocationEntity(world = {}, {
  location = "",
  sublocation = "",
  now = new Date(),
} = {}) {
  const normalizedSublocation = normalizeString(sublocation);
  const normalizedLocation = normalizeString(location);
  const existingEntity = findWorldSpineSublocationEntity(world, normalizedSublocation);
  if (existingEntity) {
    return {
      world,
      entity: existingEntity,
      created: false,
    };
  }

  const item = buildWorldbuildingItemFromFormValues({
    categoryId: "location",
    values: {
      name: normalizedSublocation,
      parentPlace: normalizedLocation,
      notes: normalizedLocation ? `Child location inside ${normalizedLocation}.` : "Event child location.",
    },
    world,
    now,
  });
  if (!item?.entity) {
    return {
      world,
      entity: null,
      created: false,
    };
  }

  return {
    world: applyWorldbuildingItemToWorld(world, item),
    entity: item.entity,
    created: true,
  };
}

function findWorldSpineSublocationEntity(world = {}, sublocation = "") {
  const targetKey = createWorldSpineLocationKey(sublocation);
  if (!targetKey) {
    return null;
  }

  return buildWorldbuildingStudioModel({ world }).entityCatalogue
    .find((entity) =>
      isWorldSpineLocationEntity(entity) &&
      createWorldSpineLocationKey(entity?.name) === targetKey
    ) ?? null;
}

function isWorldSpineLocationEntity(entity = {}) {
  const categoryId = normalizeString(entity?.categoryId);
  const templateName = normalizeString(entity?.templateName);
  const categoryLabel = normalizeString(entity?.categoryLabel);
  return (
    categoryId === "location" ||
    /location|place|settlement|facility|station|dock|ship|vehicle/i.test(`${templateName} ${categoryLabel}`)
  );
}

// Intent: mirror the selected event's precise place into stored World Spine nodes when the event is world-authored.
function applyWorldSpineSublocationToStoredNodes(world = {}, {
  nodeId = "",
  location = "",
  sublocation = "",
  orbitalBand = "",
  timestamp = "",
} = {}) {
  const normalizedNodeId = normalizeString(nodeId);
  const sourceWorld = world && typeof world === "object" && !Array.isArray(world) ? world : {};
  const sourceSpines = Array.isArray(sourceWorld.spines) ? sourceWorld.spines : [];
  if (!normalizedNodeId || !sourceSpines.length) {
    return {
      world: sourceWorld,
      changed: false,
    };
  }

  let changed = false;
  const nextSpines = sourceSpines.map((spine) => {
    const nodes = Array.isArray(spine?.nodes) ? spine.nodes : [];
    let spineChanged = false;
    const nextNodes = nodes.map((node) => {
      if (normalizeString(node?.id) !== normalizedNodeId) {
        return node;
      }

      const nextNode = applyWorldSpineSublocationToStoredNode(node, {
        location,
        sublocation,
        orbitalBand,
        timestamp,
      });
      spineChanged = spineChanged || nextNode !== node;
      changed = changed || nextNode !== node;
      return nextNode;
    });

    return spineChanged ? { ...spine, nodes: nextNodes } : spine;
  });

  return {
    world: changed
      ? {
          ...sourceWorld,
          spines: nextSpines,
          updatedAt: timestamp || sourceWorld.updatedAt,
        }
      : sourceWorld,
    changed,
  };
}

function applyWorldSpineSublocationToStoredNode(node = {}, {
  location = "",
  sublocation = "",
  orbitalBand = "",
  timestamp = "",
} = {}) {
  const metadata = node?.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
    ? node.metadata
    : {};
  const locationPlacement = node?.locationPlacement && typeof node.locationPlacement === "object" && !Array.isArray(node.locationPlacement)
    ? node.locationPlacement
    : {};
  const normalizedSublocation = normalizeString(sublocation);
  const rowLabel = normalizeString(location) ||
    normalizeString(node.locationRowLabel) ||
    normalizeString(locationPlacement.locationRowLabel) ||
    normalizeString(metadata.locationRowLabel) ||
    normalizeString(node.location) ||
    normalizeString(locationPlacement.locationLabel) ||
    normalizedSublocation;
  const normalizedOrbitalBand = normalizeString(orbitalBand);
  const placement = createWorldSpineSublocationPlacement({
    location: rowLabel,
    sublocation: normalizedSublocation,
    orbitalBand: normalizedOrbitalBand,
    locationScope: node.locationScope ?? locationPlacement.locationScope ?? metadata.locationScope,
  });
  const nextNode = {
    ...node,
    location: rowLabel,
    locationLabel: rowLabel,
    locationKey: placement.locationKey,
    locationRowLabel: placement.locationRowLabel,
    locationRowKey: placement.locationRowKey,
    locationScope: placement.locationScope,
    eventLocationLabel: placement.eventLocationLabel,
    eventLocationKey: placement.eventLocationKey,
    coreLocationLabel: placement.coreLocationLabel,
    coreLocationKey: placement.coreLocationKey,
    childLocation: normalizedSublocation,
    childLocationLabel: normalizedSublocation,
    childLocationKey: placement.sublocationKey,
    sublocation: normalizedSublocation,
    sublocationLabel: normalizedSublocation,
    sublocationKey: placement.sublocationKey,
    orbitalBand: normalizedOrbitalBand,
    locationPlacement: placement,
    metadata: {
      ...metadata,
      location: rowLabel,
      locationLabel: rowLabel,
      locationKey: placement.locationKey,
      locationRowLabel: placement.locationRowLabel,
      locationRowKey: placement.locationRowKey,
      locationScope: placement.locationScope,
      eventLocationLabel: placement.eventLocationLabel,
      eventLocationKey: placement.eventLocationKey,
      coreLocationLabel: placement.coreLocationLabel,
      coreLocationKey: placement.coreLocationKey,
      childLocation: normalizedSublocation,
      childLocationLabel: normalizedSublocation,
      childLocationKey: placement.sublocationKey,
      sublocation: normalizedSublocation,
      sublocationLabel: normalizedSublocation,
      sublocationKey: placement.sublocationKey,
      orbitalBand: normalizedOrbitalBand,
      locationPlacement: placement,
    },
  };

  if (JSON.stringify(nextNode) === JSON.stringify(node)) {
    return node;
  }

  return timestamp ? { ...nextNode, updatedAt: timestamp } : nextNode;
}

function createWorldSpineSublocationPlacement({
  location = "",
  sublocation = "",
  orbitalBand = "",
  locationScope = "",
} = {}) {
  const locationLabel = normalizeString(location) || normalizeString(sublocation);
  const sublocationLabel = normalizeString(sublocation);
  const locationKey = createWorldSpineLocationKey(locationLabel);
  return {
    locationLabel,
    locationKey,
    locationRowLabel: locationLabel,
    locationRowKey: locationKey,
    locationScope: normalizeString(locationScope) || "planetary",
    eventLocationLabel: locationLabel,
    eventLocationKey: locationKey,
    coreLocationLabel: locationLabel,
    coreLocationKey: locationKey,
    sublocationLabel,
    sublocationKey: createWorldSpineLocationKey(sublocationLabel),
    childLocationLabel: sublocationLabel,
    childLocationKey: createWorldSpineLocationKey(sublocationLabel),
    orbitalBand: normalizeString(orbitalBand),
  };
}

function normalizeWorldSpineAssignmentNode(node = null) {
  const nodeId = normalizeString(node?.id ?? node?.nodeId);
  if (!nodeId) {
    return null;
  }

  return {
    id: nodeId,
    title: normalizeString(node?.title ?? node?.label) || "Timeline event",
    typeLabel: normalizeString(node?.typeLabel) || "World Spine event",
    kind: normalizeString(node?.kind),
    sceneId: normalizeString(node?.sceneId),
    primaryBlockId: normalizeString(node?.primaryBlockId ?? node?.blockId),
  };
}

function formatWorldSpineAssignmentCategoryLabel(category = {}) {
  const categoryId = normalizeString(category?.id);
  const label = normalizeString(category?.label) || "Catalogue";
  if (categoryId === WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID) {
    return "Ships";
  }
  if (/s$/i.test(label)) {
    return label;
  }
  if (/y$/i.test(label)) {
    return `${label.slice(0, -1)}ies`;
  }
  return `${label}s`;
}

// Intent: keep the manual assignment workflow centered on ships before broader catalogue groups.
function compareWorldSpineAssignmentGroups(left, right) {
  const leftId = normalizeString(left?.id);
  const rightId = normalizeString(right?.id);
  if (leftId === WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID && rightId !== WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID) {
    return -1;
  }
  if (rightId === WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID && leftId !== WORLD_SPINE_SHIP_ASSIGNMENT_CATEGORY_ID) {
    return 1;
  }

  return normalizeString(left?.label).localeCompare(normalizeString(right?.label));
}

function selectWorldSpineCatalogueEntities(world = {}) {
  return buildWorldbuildingStudioModel({ world }).entityCatalogue
    .map((entity) => ({
      ...entity,
      id: normalizeString(entity?.id),
      name: normalizeString(entity?.name),
    }))
    .filter((entity) => entity.id && entity.name);
}

function normalizeWorldSpineEntityLinks(entityLinks = []) {
  return (Array.isArray(entityLinks) ? entityLinks : [])
    .map((link) => {
      const kind = normalizeString(link?.kind);
      const nodeId = normalizeString(link?.nodeId ?? link?.timelineNodeId ?? link?.targetNodeId);
      return {
        ...link,
        id: normalizeString(link?.id),
        entityId: normalizeString(link?.entityId),
        kind,
        nodeId,
        createdAt: normalizeString(link?.createdAt),
      };
    })
    .filter((link) => link.id && link.entityId && link.kind && link.nodeId);
}

function attachEntityToStoredWorldSpineNodes(spines = [], { nodeId = "", entity = null } = {}) {
  const normalizedNodeId = normalizeString(nodeId);
  const entityId = normalizeString(entity?.id);
  const entityName = normalizeString(entity?.name);
  if (!Array.isArray(spines) || !normalizedNodeId || !entityId) {
    return Array.isArray(spines) ? spines : [];
  }

  return spines.map((spine) => {
    const nodes = Array.isArray(spine?.nodes) ? spine.nodes : [];
    let changed = false;
    const nextNodes = nodes.map((node) => {
      if (normalizeString(node?.id) !== normalizedNodeId) {
        return node;
      }

      changed = true;
      return {
        ...node,
        linkedEntityIds: uniqueStrings([
          ...normalizeStringList(node?.linkedEntityIds),
          entityId,
        ]),
        linkedEntityNames: uniqueStrings([
          ...normalizeStringList(node?.linkedEntityNames),
          entityName,
        ]),
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

function resolveNextEntityLinkSequence(entityLinks = [], explicitSequence = 0) {
  const sequenceFromIds = (Array.isArray(entityLinks) ? entityLinks : []).reduce((highest, link) => {
    const match = normalizeString(link?.id).match(/^link-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return Math.max(sequenceFromIds, Number(explicitSequence) || 0) + 1;
}

function formatLinkId(sequence) {
  return `link-${String(Math.max(1, Number(sequence) || 1)).padStart(4, "0")}`;
}

function normalizeDateISOString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clonePlainObject(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { ...value };
  }
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
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

function createWorldSpineLocationKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeString(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}
