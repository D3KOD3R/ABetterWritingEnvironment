// Intent: present existing project and World entity images as a read-only asset collection.
// Durable registration, media URL resolution, and binary writes belong to persistence/host services.
export const VISUAL_ASSET_CATEGORIES = Object.freeze([
  "all", "character", "costume", "environment", "scene",
  "technology", "vehicle", "creature", "other",
]);

const SAFE_INLINE_IMAGE = /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i;
const SAFE_HTTPS_IMAGE = /^https:\/\/[^\s<>"']+$/i;

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function string(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueIds(...values) {
  const seen = new Set();
  for (const value of values.flat()) {
    const id = string(value);
    if (id) seen.add(id);
  }
  return [...seen];
}

function normalizedCategory(value) {
  const raw = string(value).toLowerCase();
  if (VISUAL_ASSET_CATEGORIES.includes(raw)) return raw;
  if (/character|person|people|human/.test(raw)) return "character";
  if (/costume|armou?r|clothing|uniform|outfit|wardrobe/.test(raw)) return "costume";
  if (/scene|chapter|storyboard/.test(raw)) return "scene";
  if (/planet|station|place|region|environment|location|landscape|building|set/.test(raw)) return "environment";
  if (/ship|vehicle|craft|transport|corvette/.test(raw)) return "vehicle";
  if (/fauna|flora|creature|animal|species/.test(raw)) return "creature";
  if (/weapon|technology|equipment|device|prop|tool/.test(raw)) return "technology";
  return "other";
}

export function safeVisualAssetPreviewUrl(value) {
  const candidate = string(value);
  return SAFE_INLINE_IMAGE.test(candidate) || SAFE_HTTPS_IMAGE.test(candidate)
    ? candidate
    : "";
}

function hasLegacyImage(image) {
  const candidate = objectOrEmpty(image);
  return Boolean(
    string(candidate.dataUrl) ||
    string(candidate.url) ||
    string(candidate.projectRelativePath) ||
    string(candidate.mediaPath),
  );
}

function fileLabel(path) {
  return string(path).split(/[\\/]/).filter(Boolean).pop() || "";
}

function resolveWorld(projectRecord) {
  const workspace = objectOrEmpty(projectRecord.workspace);
  const world = objectOrEmpty(workspace.world);
  return Object.keys(world).length ? world : objectOrEmpty(projectRecord.world);
}

function normalizeRegisteredAsset(candidate, entitiesById) {
  const raw = objectOrEmpty(candidate);
  const id = string(raw.id);
  if (!id) return null;
  const metadata = objectOrEmpty(raw.metadata);
  const entityIds = uniqueIds(
    metadata.entityIds,
    metadata.entityId,
    metadata.worldEntityId,
    raw.entityIds,
    raw.entityId,
  );
  const sceneIds = uniqueIds(
    raw.sceneId, raw.sceneIds,
    metadata.sceneId, metadata.sceneIds,
  );
  const firstEntity = entitiesById.get(entityIds[0]);
  const category = normalizedCategory(
    metadata.category || raw.category || raw.kind || raw.role ||
    firstEntity?.templateName || firstEntity?.templateOrigin?.templateKey,
  );
  const relativeFileRef = string(raw.fileRef || raw.path);
  const previewUrl = safeVisualAssetPreviewUrl(
    raw.previewUrl || metadata.previewUrl || metadata.thumbnailUrl,
  );
  return {
    id,
    title: string(metadata.title || raw.title || raw.name) || fileLabel(relativeFileRef) || id,
    category,
    entityIds,
    sceneIds,
    entityNames: entityIds.map((key) => string(entitiesById.get(key)?.name)).filter(Boolean),
    missingEntityIds: entityIds.filter((key) => !entitiesById.has(key)),
    status: string(metadata.status || metadata.reviewStatus) || "concept",
    source: "registered",
    fileRef: relativeFileRef,
    previewUrl,
    availability: relativeFileRef ? "project-reference" : previewUrl ? "preview-only" : "unresolved",
    description: string(metadata.description || metadata.notes),
    createdAt: string(raw.createdAt),
  };
}

function normalizeLegacyWorldImage(entity) {
  const image = objectOrEmpty(entity.image);
  if (!string(entity.id) || !hasLegacyImage(image)) return null;
  const previewUrl = safeVisualAssetPreviewUrl(image.dataUrl || image.url);
  const fileRef = string(image.projectRelativePath);
  return {
    id: `legacy-world-image:${entity.id}`,
    title: `${string(entity.name) || entity.id} — World image`,
    category: normalizedCategory(entity.templateName || entity.templateOrigin?.templateKey),
    entityIds: [entity.id],
    sceneIds: [],
    entityNames: [string(entity.name) || entity.id],
    missingEntityIds: [],
    status: "legacy",
    source: "legacy-world-image",
    fileRef,
    previewUrl,
    availability: fileRef ? "project-reference" : previewUrl ? "preview-only" : "unresolved",
    description: "Existing World catalogue image; read-only until explicitly promoted.",
    createdAt: string(image.attachedAt),
  };
}

function matchesLegacyReference(registryAsset, legacyAsset) {
  if (!registryAsset.entityIds.includes(legacyAsset.entityIds[0])) return false;
  if (registryAsset.fileRef && legacyAsset.fileRef) {
    return registryAsset.fileRef === legacyAsset.fileRef;
  }
  return Boolean(
    registryAsset.previewUrl && legacyAsset.previewUrl &&
    registryAsset.previewUrl === legacyAsset.previewUrl,
  );
}

// Intent: do not mutate project state or assume the project index contains full asset metadata.
// This adapter deliberately does not turn arbitrary file refs into browser URLs.
export function buildVisualAssetLibraryModel({
  projectRecord = {},
  category = "all",
  query = "",
} = {}) {
  const project = objectOrEmpty(projectRecord);
  const world = resolveWorld(project);
  const entities = Array.isArray(world.entities) ? world.entities.filter(Boolean) : [];
  const entitiesById = new Map(
    entities.filter((entity) => string(entity?.id)).map((entity) => [entity.id, entity]),
  );
  const registry = Array.isArray(project.projectSettings?.assetRegistry)
    ? project.projectSettings.assetRegistry
    : [];
  const registeredById = new Map();
  for (const candidate of registry) {
    const asset = normalizeRegisteredAsset(candidate, entitiesById);
    if (asset) registeredById.set(asset.id, asset);
  }
  const assets = [...registeredById.values()];
  for (const entity of entities) {
    const legacyAsset = normalizeLegacyWorldImage(entity);
    if (!legacyAsset) continue;
    if (assets.some((asset) => matchesLegacyReference(asset, legacyAsset))) continue;
    assets.push(legacyAsset);
  }
  assets.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const requestedCategory = string(category).toLowerCase();
  const selectedCategory = VISUAL_ASSET_CATEGORIES.includes(requestedCategory)
    ? requestedCategory : "all";
  const search = string(query).toLocaleLowerCase();
  const filteredAssets = assets.filter((asset) => (
    (selectedCategory === "all" || asset.category === selectedCategory) &&
    (!search || [
      asset.title, asset.category, asset.description, asset.status,
      ...asset.entityNames, ...asset.sceneIds,
    ].join(" ").toLocaleLowerCase().includes(search))
  ));
  const counts = Object.fromEntries(VISUAL_ASSET_CATEGORIES.map((key) => [
    key,
    key === "all" ? assets.length : assets.filter((asset) => asset.category === key).length,
  ]));
  return {
    projectId: string(project.id),
    projectTitle: string(project.title),
    category: selectedCategory,
    query: string(query),
    counts,
    total: assets.length,
    filteredCount: filteredAssets.length,
    assets: filteredAssets,
  };
}
