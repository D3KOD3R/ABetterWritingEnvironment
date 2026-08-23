// Intent: own custom metadata tag definitions without owning anchored note records.

export const CUSTOM_METADATA_NOTE_TYPE_PREFIX = "metadata-";
export const DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR = "#8bd3c7";
export const CUSTOM_METADATA_ICON_ALLOWED_MEDIA_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
export const CUSTOM_METADATA_ICON_ACCEPT = CUSTOM_METADATA_ICON_ALLOWED_MEDIA_TYPES.join(",");
export const CUSTOM_METADATA_ICON_MAX_BYTES = 512 * 1024;

const CUSTOM_METADATA_NOTE_TYPE_PATTERN = /^metadata-[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const CUSTOM_METADATA_ICON_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=]+)$/i;

export function isCustomMetadataNoteType(noteType) {
  return CUSTOM_METADATA_NOTE_TYPE_PATTERN.test(String(noteType ?? "").trim());
}

export function normalizeCustomMetadataDefinitions(candidate = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  const definitions = [];
  const usedIds = new Set();

  for (const item of source) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const label = normalizeMetadataLabel(item.label ?? item.name);
    if (!label) {
      continue;
    }

    const id = createUniqueMetadataId(
      isCustomMetadataNoteType(item.id) ? String(item.id).trim() : createMetadataIdFromLabel(label),
      usedIds,
    );
    usedIds.add(id);
    const icon = normalizeCustomMetadataIcon(item.icon ?? item.metadataIcon ?? item.imageIcon);
    const definition = {
      id,
      label,
      highlightColor: normalizeMetadataHighlightColor(item.highlightColor ?? item.color),
      createdAt: typeof item.createdAt === "string" && item.createdAt.trim() ? item.createdAt : "",
      updatedAt: typeof item.updatedAt === "string" && item.updatedAt.trim() ? item.updatedAt : "",
    };
    if (icon) {
      definition.icon = icon;
    }
    definitions.push(definition);
  }

  return definitions;
}

export function createCustomMetadataDefinition(input = {}, existingDefinitions = [], now = new Date().toISOString()) {
  const label = normalizeMetadataLabel(input.label ?? input.name);
  if (!label) {
    return {
      definition: null,
      definitions: normalizeCustomMetadataDefinitions(existingDefinitions),
      error: "name-required",
    };
  }

  const definitions = normalizeCustomMetadataDefinitions(existingDefinitions);
  const iconInputProvided = input.icon != null && input.icon !== "";
  const icon = normalizeCustomMetadataIcon(input.icon);
  if (iconInputProvided && !icon) {
    return {
      definition: null,
      definitions,
      error: "icon-invalid",
    };
  }

  const usedIds = new Set(definitions.map((definition) => definition.id));
  const id = createUniqueMetadataId(createMetadataIdFromLabel(label), usedIds);
  const definition = {
    id,
    label,
    highlightColor: normalizeMetadataHighlightColor(input.highlightColor ?? input.color),
    createdAt: now,
    updatedAt: now,
  };
  if (icon) {
    definition.icon = icon;
  }

  return {
    definition,
    definitions: [...definitions, definition],
    error: "",
  };
}

export function buildCustomMetadataSidePanelFeatures(definitions = []) {
  return normalizeCustomMetadataDefinitions(definitions).map((definition) => ({
    id: definition.id,
    label: definition.label,
    custom: true,
    highlightColor: definition.highlightColor,
    ...(definition.icon ? { icon: definition.icon } : {}),
  }));
}

export function findCustomMetadataDefinition(definitions = [], noteType = "") {
  const normalizedNoteType = String(noteType ?? "").trim();
  if (!isCustomMetadataNoteType(normalizedNoteType)) {
    return null;
  }

  return normalizeCustomMetadataDefinitions(definitions)
    .find((definition) => definition.id === normalizedNoteType) ?? null;
}

export function getMetadataNoteLabel(noteType = "", definitions = []) {
  const normalizedNoteType = String(noteType ?? "").trim();
  if (normalizedNoteType === "research") {
    return "Research";
  }

  if (normalizedNoteType === "inspiration") {
    return "Inspiration";
  }

  return findCustomMetadataDefinition(definitions, normalizedNoteType)?.label ?? "Metadata";
}

export function getCustomMetadataVisualStyle(noteType = "", definitions = []) {
  const definition = findCustomMetadataDefinition(definitions, noteType);
  if (!definition) {
    return null;
  }

  return buildCustomMetadataVisualStyle(definition.highlightColor);
}

export function buildCustomMetadataVisualStyle(highlightColor = DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR) {
  const color = normalizeMetadataHighlightColor(highlightColor);
  const rgb = hexToRgb(color);
  return {
    highlightColor: `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.56)`,
    highlightOutline: `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.32)`,
    highlightShadow: `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, 0.48)`,
    colorToken: color,
  };
}

export function normalizeMetadataHighlightColor(value) {
  const normalized = String(value ?? "").trim();
  return HEX_COLOR_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : DEFAULT_CUSTOM_METADATA_HIGHLIGHT_COLOR;
}

export function normalizeCustomMetadataIcon(candidate = null) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const dataUrl = String(candidate.dataUrl ?? candidate.url ?? candidate.src ?? "").trim();
  if (!dataUrl || dataUrl.length > getCustomMetadataIconMaxDataUrlLength()) {
    return null;
  }

  const match = dataUrl.match(CUSTOM_METADATA_ICON_DATA_URL_PATTERN);
  if (!match) {
    return null;
  }

  const mediaType = normalizeCustomMetadataIconMediaType(candidate.mediaType ?? candidate.type ?? match[1]);
  if (!mediaType || mediaType !== String(match[1] ?? "").toLowerCase()) {
    return null;
  }

  const estimatedSize = Number.isFinite(Number(candidate.size))
    ? Math.max(0, Math.round(Number(candidate.size)))
    : estimateCustomMetadataIconByteSize(match[2]);
  if (!estimatedSize || estimatedSize > CUSTOM_METADATA_ICON_MAX_BYTES) {
    return null;
  }

  return {
    dataUrl,
    mediaType,
    name: normalizeCustomMetadataIconName(candidate.name),
    size: estimatedSize,
  };
}

export function validateCustomMetadataIconFile(candidate = null) {
  if (!candidate || typeof candidate !== "object") {
    return "icon-missing";
  }

  const mediaType = normalizeCustomMetadataIconMediaType(candidate.type ?? candidate.mediaType);
  if (!mediaType) {
    return "icon-type-unsupported";
  }

  const size = Number(candidate.size);
  if (!Number.isFinite(size) || size <= 0) {
    return "icon-empty";
  }

  if (size > CUSTOM_METADATA_ICON_MAX_BYTES) {
    return "icon-too-large";
  }

  return "";
}

export function normalizeMetadataLabel(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

export function createMetadataIdFromLabel(label) {
  const slug = normalizeMetadataLabel(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 38);
  return `${CUSTOM_METADATA_NOTE_TYPE_PREFIX}${slug || "custom"}`;
}

function createUniqueMetadataId(baseId, usedIds) {
  const fallbackId = isCustomMetadataNoteType(baseId) ? baseId : `${CUSTOM_METADATA_NOTE_TYPE_PREFIX}custom`;
  let id = fallbackId;
  let suffix = 2;
  while (usedIds.has(id)) {
    const suffixText = `-${suffix}`;
    const base = fallbackId.slice(0, Math.max(CUSTOM_METADATA_NOTE_TYPE_PREFIX.length + 1, 55 - suffixText.length));
    id = `${base.replace(/-+$/g, "")}${suffixText}`;
    suffix += 1;
  }
  return id;
}

function hexToRgb(hexColor) {
  const normalized = normalizeMetadataHighlightColor(hexColor).slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function normalizeCustomMetadataIconMediaType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CUSTOM_METADATA_ICON_ALLOWED_MEDIA_TYPES.includes(normalized) ? normalized : "";
}

function normalizeCustomMetadataIconName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96) || "metadata icon";
}

function estimateCustomMetadataIconByteSize(base64Payload = "") {
  const payload = String(base64Payload ?? "").replace(/\s+/g, "");
  if (!payload) {
    return 0;
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function getCustomMetadataIconMaxDataUrlLength() {
  return Math.ceil(CUSTOM_METADATA_ICON_MAX_BYTES * 1.4) + 64;
}
