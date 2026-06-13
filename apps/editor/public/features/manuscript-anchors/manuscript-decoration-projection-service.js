// Intent: convert anchor and runtime decoration DTOs into render-only manuscript projections.
import {
  isManuscriptAnchorRenderable,
  normalizeManuscriptAnchor,
} from "./manuscript-anchor-service.js";

export function createAnchorDecorationProjections(anchorEntries = [], {
  sceneId = "",
  textLength = Number.POSITIVE_INFINITY,
  channelByOwnerType = {},
  styleTokenByOwnerType = {},
  priorityByChannel = {},
  persistence = "derived-durable",
  renderableStatuses,
} = {}) {
  const projections = [];
  for (const entry of Array.isArray(anchorEntries) ? anchorEntries : []) {
    const channel = String(entry?.channel ?? channelByOwnerType[entry?.ownerType] ?? "");
    if (!channel) {
      continue;
    }

    const projection = createAnchorDecorationProjection(entry, {
      sceneId,
      textLength,
      channel,
      styleToken: entry?.styleToken ?? styleTokenByOwnerType[entry?.ownerType] ?? channel,
      priority: Number(priorityByChannel[channel] ?? entry?.priority ?? 0),
      persistence,
      renderableStatuses,
    });
    if (projection) {
      projections.push(projection);
    }
  }
  return projections;
}

export function createAnchorDecorationProjection(anchorEntry = {}, {
  sceneId = "",
  textLength = Number.POSITIVE_INFINITY,
  channel = "",
  styleToken = "",
  priority = 0,
  persistence = "derived-durable",
  renderableStatuses,
} = {}) {
  const normalized = normalizeManuscriptAnchor(anchorEntry, {
    textLength,
    defaultSceneId: sceneId,
  });
  if (
    !normalized ||
    normalized.sceneId !== sceneId ||
    !isManuscriptAnchorRenderable(normalized, renderableStatuses)
  ) {
    return null;
  }

  const ownerType = String(anchorEntry?.ownerType ?? anchorEntry?.sourceRef?.recordType ?? "anchor");
  const ownerId = String(anchorEntry?.ownerId ?? anchorEntry?.sourceRef?.recordId ?? anchorEntry?.anchorId ?? "");
  const projectionId = String(anchorEntry?.projectionId ?? `${channel}:${ownerType}:${ownerId || normalized.startOffset}`);
  return {
    id: projectionId,
    sceneId: normalized.sceneId,
    startOffset: normalized.startOffset,
    endOffset: normalized.endOffset,
    channel,
    styleToken: String(styleToken || channel),
    priority: Number(priority) || 0,
    persistence,
    sourceRef: {
      recordType: ownerType,
      recordId: ownerId,
    },
  };
}

export function createSpellcheckDecorationProjections({
  sceneId = "",
  text = "",
  misspellings = [],
  channel = "spellcheck",
  styleToken = "misspelled",
  priority = 40,
} = {}) {
  const normalizedText = String(text ?? "");
  const normalizedSceneId = String(sceneId ?? "");
  const projections = [];
  for (const misspelling of Array.isArray(misspellings) ? misspellings : []) {
    const projection = createRuntimeRangeDecorationProjection({
      sceneId: normalizedSceneId,
      textLength: normalizedText.length,
      startOffset: Number(misspelling?.index),
      endOffset: Number(misspelling?.endIndex),
      channel,
      styleToken,
      priority,
      id: `spellcheck:${normalizedSceneId}:${Number(misspelling?.index)}:${Number(misspelling?.endIndex)}:${normalizeRuntimeToken(misspelling)}`,
    });
    if (projection) {
      projections.push(projection);
    }
  }
  return projections;
}

export function createRuntimeRangeDecorationProjection({
  id = "",
  sceneId = "",
  textLength = 0,
  startOffset = 0,
  endOffset = 0,
  channel = "",
  styleToken = "",
  priority = 0,
} = {}) {
  if (
    !channel ||
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset <= startOffset ||
    endOffset > textLength
  ) {
    return null;
  }

  return {
    id: String(id || `${channel}:${sceneId}:${startOffset}:${endOffset}`),
    sceneId: String(sceneId ?? ""),
    startOffset,
    endOffset,
    channel,
    styleToken: String(styleToken || channel),
    priority: Number(priority) || 0,
    persistence: "runtime-only",
  };
}

function normalizeRuntimeToken(misspelling) {
  if (typeof misspelling?.normalizedWord === "string" && misspelling.normalizedWord) {
    return misspelling.normalizedWord;
  }
  return String(misspelling?.word ?? "").toLowerCase();
}
