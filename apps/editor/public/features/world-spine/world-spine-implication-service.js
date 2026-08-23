// Intent: own author-created World Spine implication edge normalization and persistence mutations.

export const WORLD_SPINE_IMPLICATION_EDGE_KIND = "implicates";

// Intent: keep persisted edge records structured while accepting older or partial world data.
export function normalizeWorldSpineEdges(edges = []) {
  return (Array.isArray(edges) ? edges : [])
    .map((edge, index) => {
      const fromNodeId = normalizeString(edge?.fromNodeId ?? edge?.sourceNodeId ?? edge?.from);
      const toNodeId = normalizeString(edge?.toNodeId ?? edge?.targetNodeId ?? edge?.to);
      if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
        return null;
      }

      const label = normalizeWorldSpineImplicationText(
        edge?.label ?? edge?.effect ?? edge?.summary ?? edge?.description,
      );
      const effect = normalizeWorldSpineImplicationText(edge?.effect ?? edge?.label);
      return removeUndefinedFields({
        ...edge,
        id: normalizeString(edge?.id) || `edge-${String(index + 1).padStart(4, "0")}`,
        fromNodeId,
        toNodeId,
        kind: normalizeString(edge?.kind) || WORLD_SPINE_IMPLICATION_EDGE_KIND,
        label: label || undefined,
        effect: effect || undefined,
        createdAt: normalizeString(edge?.createdAt) || undefined,
        updatedAt: normalizeString(edge?.updatedAt) || undefined,
      });
    })
    .filter(Boolean);
}

// Intent: create a durable manual implication edge from a reviewed node-to-node link.
export function applyWorldSpineImplicationEdgeToWorld(world = {}, input = {}, now = new Date()) {
  const fromNodeId = normalizeString(input.fromNodeId);
  const toNodeId = normalizeString(input.toNodeId);
  const effect = normalizeWorldSpineImplicationText(input.effect ?? input.label);
  const nextWorld = clonePlainObject(world);
  const edges = normalizeWorldSpineEdges(nextWorld.edges);

  if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "invalid-endpoints",
    };
  }

  if (!effect) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "missing-effect",
    };
  }

  const timestamp = normalizeDateISOString(now);
  const edge = removeUndefinedFields({
    id: createNextWorldSpineEdgeId(edges),
    fromNodeId,
    toNodeId,
    kind: WORLD_SPINE_IMPLICATION_EDGE_KIND,
    label: effect,
    effect,
    source: "manual",
    createdAt: timestamp || undefined,
    updatedAt: timestamp || undefined,
  });
  const nextEdges = [...edges, edge];

  return {
    world: {
      ...nextWorld,
      edges: nextEdges,
      stats: {
        ...(nextWorld.stats && typeof nextWorld.stats === "object" ? nextWorld.stats : {}),
        edgeCount: nextEdges.length,
      },
      updatedAt: timestamp || nextWorld.updatedAt,
    },
    edge,
    reason: "created",
  };
}

// Intent: remove a reviewed implication edge while preserving normalized world graph records.
export function deleteWorldSpineImplicationEdgeFromWorld(world = {}, edgeId = "", now = new Date()) {
  const normalizedEdgeId = normalizeString(edgeId);
  const nextWorld = clonePlainObject(world);
  const edges = normalizeWorldSpineEdges(nextWorld.edges);
  if (!normalizedEdgeId) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "missing-edge-id",
    };
  }

  const deletedEdge = edges.find((edge) => edge.id === normalizedEdgeId) ?? null;
  if (!deletedEdge) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "edge-not-found",
    };
  }

  const timestamp = normalizeDateISOString(now);
  const nextEdges = edges.filter((edge) => edge.id !== normalizedEdgeId);
  return {
    world: {
      ...nextWorld,
      edges: nextEdges,
      stats: {
        ...(nextWorld.stats && typeof nextWorld.stats === "object" ? nextWorld.stats : {}),
        edgeCount: nextEdges.length,
      },
      updatedAt: timestamp || nextWorld.updatedAt,
    },
    edge: deletedEdge,
    reason: "deleted",
  };
}

// Intent: edit only the reviewed implication text while preserving the existing edge endpoints and ID.
export function updateWorldSpineImplicationEdgeInWorld(world = {}, input = {}, now = new Date()) {
  const normalizedEdgeId = normalizeString(input.edgeId ?? input.id);
  const effect = normalizeWorldSpineImplicationText(input.effect ?? input.label);
  const nextWorld = clonePlainObject(world);
  const edges = normalizeWorldSpineEdges(nextWorld.edges);
  if (!normalizedEdgeId) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "missing-edge-id",
    };
  }

  if (!effect) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "missing-effect",
    };
  }

  const existingEdge = edges.find((edge) => edge.id === normalizedEdgeId) ?? null;
  if (!existingEdge) {
    return {
      world: {
        ...nextWorld,
        edges,
      },
      edge: null,
      reason: "edge-not-found",
    };
  }

  const timestamp = normalizeDateISOString(now);
  const updatedEdge = removeUndefinedFields({
    ...existingEdge,
    label: effect,
    effect,
    updatedAt: timestamp || existingEdge.updatedAt,
  });
  const nextEdges = edges.map((edge) => edge.id === normalizedEdgeId ? updatedEdge : edge);
  return {
    world: {
      ...nextWorld,
      edges: nextEdges,
      stats: {
        ...(nextWorld.stats && typeof nextWorld.stats === "object" ? nextWorld.stats : {}),
        edgeCount: nextEdges.length,
      },
      updatedAt: timestamp || nextWorld.updatedAt,
    },
    edge: updatedEdge,
    reason: "updated",
  };
}

export function normalizeWorldSpineImplicationText(value) {
  return normalizeString(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function createNextWorldSpineEdgeId(edges = [], prefix = "edge") {
  const highest = normalizeWorldSpineEdges(edges).reduce((max, edge) => {
    const match = normalizeString(edge.id).match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}

function removeUndefinedFields(record) {
  const result = {};
  for (const [key, value] of Object.entries(record && typeof record === "object" ? record : {})) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
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

function normalizeDateISOString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function escapeRegExp(value) {
  return normalizeString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
