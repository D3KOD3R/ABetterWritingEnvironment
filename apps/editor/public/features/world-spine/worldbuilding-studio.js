// Intent: own Dream Scaping worldbuilding catalogue forms and World Spine event draft mutations.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  buildWorldSpinePickerOptionSets,
  getWorldSpinePickerOptionsForField,
  resolveWorldSpinePickerTypeForField,
} from "./world-spine-character-options.js";

const DEFAULT_UNPLACED_LOCATION_LABEL = "Unplaced location";
const DEFAULT_LOCATION_ROW_PROMPT = "Insert Location Name";

const WORLD_SPINE_CATEGORY_GROUPS = Object.freeze([
  {
    id: "places",
    label: "Places",
    categories: ["planet", "location"],
  },
  {
    id: "people",
    label: "People",
    categories: ["character", "faction", "culture"],
  },
  {
    id: "living",
    label: "Living World",
    categories: ["flora", "fauna"],
  },
  {
    id: "story",
    label: "Story",
    categories: ["event", "critical-event"],
  },
  {
    id: "objects",
    label: "Objects",
    categories: ["weapon", "outfit", "technology", "vehicle", "artifact"],
  },
  {
    id: "custom",
    label: "Custom",
    categories: ["custom"],
  },
]);

const WORLD_SPINE_CATEGORY_DEFINITIONS = Object.freeze([
  {
    id: "planet",
    groupId: "places",
    label: "Planet",
    code: "PL",
    itemKind: "entity",
    templateName: "Planet",
    description: "World-scale place, orbit, culture and environmental rules.",
    fields: [
      textField("name", "Name"),
      textField("starSystem", "Star system"),
      textField("climate", "Climate"),
      textField("settlements", "Settlements"),
      textField("governance", "Governance"),
      textField("rulingFaction", "Ruling faction"),
      textField("knownResidents", "Known residents"),
      textField("introducedBy", "Introduced by"),
      textAreaField("notes", "Identifying lore"),
    ],
  },
  {
    id: "location",
    groupId: "places",
    label: "Location",
    code: "LO",
    itemKind: "entity",
    templateName: "Location",
    description: "Specific place that can host events and manuscript anchors.",
    fields: [
      textField("name", "Name"),
      textField("parentPlace", "Parent location"),
      textField("sensorySignature", "Sensory signature"),
      textField("access", "Access"),
      textField("hazards", "Hazards"),
      textField("residents", "Residents"),
      textField("owner", "Owner"),
      textField("controller", "Controller"),
      textAreaField("notes", "Lore notes"),
    ],
  },
  {
    id: "character",
    groupId: "people",
    label: "Character",
    code: "CH",
    itemKind: "entity",
    templateName: "Character",
    description: "Named actor with role, traits, stakes and timeline presence.",
    fields: [
      textField("name", "Name"),
      textField("aliases", "Aliases"),
      textField("role", "Role"),
      textField("parentPlace", "Parent location"),
      textField("home", "Home"),
      textField("traits", "Traits"),
      textField("motivation", "Motivation"),
      textAreaField("notes", "Continuity notes"),
    ],
  },
  {
    id: "faction",
    groupId: "people",
    label: "Faction",
    code: "FA",
    itemKind: "entity",
    templateName: "Faction",
    description: "Political, military, corporate or social force.",
    fields: [
      textField("name", "Name"),
      textField("domain", "Domain"),
      textField("leadership", "Leadership"),
      textField("members", "Members"),
      textField("allies", "Allies"),
      textField("enemies", "Enemies"),
      textField("founder", "Founder"),
      textField("resources", "Resources"),
      textField("conflicts", "Conflicts"),
      textAreaField("notes", "Faction lore"),
    ],
  },
  {
    id: "culture",
    groupId: "people",
    label: "Culture",
    code: "CU",
    itemKind: "entity",
    templateName: "Culture",
    description: "Shared customs, language, law, rituals and taboos.",
    fields: [
      textField("name", "Name"),
      textField("values", "Values"),
      textField("rituals", "Rituals"),
      textField("taboos", "Taboos"),
      textField("language", "Language"),
      textAreaField("notes", "Cultural markers"),
    ],
  },
  {
    id: "flora",
    groupId: "living",
    label: "Flora",
    code: "FL",
    itemKind: "entity",
    templateName: "Flora",
    description: "Plants, fungi, engineered growths and ecological markers.",
    fields: [
      textField("name", "Name"),
      textField("habitat", "Habitat"),
      textField("appearance", "Appearance"),
      textField("uses", "Uses"),
      textField("risks", "Risks"),
      textAreaField("notes", "Lore traits"),
    ],
  },
  {
    id: "fauna",
    groupId: "living",
    label: "Fauna",
    code: "AN",
    itemKind: "entity",
    templateName: "Fauna",
    description: "Creatures, species, engineered animals and threat ecology.",
    fields: [
      textField("name", "Name"),
      textField("habitat", "Habitat"),
      textField("appearance", "Appearance"),
      textField("behaviour", "Behaviour"),
      textField("storyUse", "Story use"),
      textAreaField("notes", "Identifying features"),
    ],
  },
  {
    id: "event",
    groupId: "story",
    label: "Event",
    code: "EV",
    itemKind: "eventDraft",
    templateName: "World Event",
    description: "Standalone timeline beat that may exist before manuscript pages.",
    fields: createEventFields("Event title"),
  },
  {
    id: "critical-event",
    groupId: "story",
    label: "Critical Event",
    code: "CE",
    itemKind: "eventDraft",
    templateName: "Critical Event",
    description: "Major consequence, discovery, death, betrayal or irreversible turn.",
    fields: [
      ...createEventFields("Critical event title"),
      textField("consequence", "Consequence"),
      textField("reversibility", "Reversibility"),
    ],
  },
  {
    id: "weapon",
    groupId: "objects",
    label: "Weapon",
    code: "WP",
    itemKind: "entity",
    templateName: "Weapon",
    description: "Combat, defensive or symbolic tool with rules and limits.",
    fields: [
      textField("name", "Name"),
      textField("origin", "Origin"),
      textField("capability", "Capability"),
      textField("limitation", "Limitation"),
      textField("owner", "Owner"),
      textField("wieldedBy", "Wielded by"),
      textField("createdBy", "Created by"),
      textField("target", "Target"),
      textAreaField("notes", "Continuity notes"),
    ],
  },
  {
    id: "outfit",
    groupId: "objects",
    label: "Outfit",
    code: "OF",
    itemKind: "entity",
    templateName: "Outfit",
    description: "Clothing, armor, uniform, pressure suit or disguise.",
    fields: [
      textField("name", "Name"),
      textField("wornBy", "Worn by"),
      textField("materials", "Materials"),
      textField("features", "Features"),
      textField("symbolism", "Symbolism"),
      textAreaField("notes", "Visual continuity"),
    ],
  },
  {
    id: "technology",
    groupId: "objects",
    label: "Technology",
    code: "TE",
    itemKind: "entity",
    templateName: "Technology",
    description: "Device, system, infrastructure or scientific rule.",
    fields: [
      textField("name", "Name"),
      textField("function", "Function"),
      textField("owner", "Owner"),
      textField("inventor", "Inventor"),
      textField("operator", "Operator"),
      textField("factionControl", "Faction control"),
      textField("constraints", "Constraints"),
      textField("failureMode", "Failure mode"),
      textAreaField("notes", "Tech lore"),
    ],
  },
  {
    id: "vehicle",
    groupId: "objects",
    label: "Vehicle",
    code: "VH",
    itemKind: "entity",
    templateName: "Vehicle",
    description: "Ship, rover, rail system, mount or transit technology.",
    fields: [
      textField("name", "Name"),
      textField("class", "Class"),
      textField("crew", "Crew"),
      textField("captain", "Captain"),
      textField("owner", "Owner"),
      textField("passengers", "Passengers"),
      textField("faction", "Faction"),
      textField("capability", "Capability"),
      textField("flaws", "Flaws"),
      textAreaField("notes", "Continuity notes"),
    ],
  },
  {
    id: "artifact",
    groupId: "objects",
    label: "Artifact",
    code: "AR",
    itemKind: "entity",
    templateName: "Artifact",
    description: "Relic, document, signal object, map, key or lore-bearing item.",
    fields: [
      textField("name", "Name"),
      textField("origin", "Origin"),
      textField("appearance", "Appearance"),
      textField("power", "Power or use"),
      textField("risk", "Risk"),
      textField("owner", "Owner"),
      textField("holder", "Holder"),
      textField("creator", "Creator"),
      textField("discoveredBy", "Discovered by"),
      textField("stolenBy", "Stolen by"),
      textAreaField("notes", "Lore significance"),
    ],
  },
  {
    id: "custom",
    groupId: "custom",
    label: "Custom",
    code: "CU+",
    itemKind: "custom",
    templateName: "Custom",
    description: "Author-defined category with reusable fields.",
    fields: [
      textField("customCategoryName", "Category name"),
      fieldList("customFieldLabels", "Fields"),
      textField("name", "Item name"),
      textAreaField("notes", "Notes"),
    ],
  },
]);

export const DEFAULT_WORLDBUILDING_CATEGORY_ID = "event";
export const WORLDBUILDING_CATALOGUE_IMAGE_ALLOWED_MEDIA_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
export const WORLDBUILDING_CATALOGUE_IMAGE_ACCEPT = WORLDBUILDING_CATALOGUE_IMAGE_ALLOWED_MEDIA_TYPES.join(",");
export const WORLDBUILDING_CATALOGUE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const WORLDBUILDING_CATALOGUE_IMAGE_PROJECT_RELATIVE_ROOT = "assets/images/worldbuilding";

const DEFAULT_CORE_LOCATION_CATEGORIES = Object.freeze(["planet"]);
const DEFAULT_CHILD_LOCATION_CATEGORIES = Object.freeze(["location", "vehicle"]);
const WORLDBUILDING_CATEGORY_LOCATION_ROLE_OPTIONS = Object.freeze([
  { id: "", label: "Catalogue only" },
  { id: "main-location", label: "Main location" },
  { id: "child-location", label: "Child location" },
]);
const STANDARD_ENTITY_LOCATION_FIELDS = Object.freeze([
  textField("parentPlace", "Parent location"),
  textField("fixedChildLocation", "Fixed child location"),
]);

const WORLD_CATALOGUE_CATEGORY_ALIASES = Object.freeze([
  {
    categoryId: "character",
    patterns: [/\bcharacters?\b/i, /\bpeople\b/i, /\bcast\b/i, /\bcrew\b/i, /\bperson\b/i],
  },
  {
    categoryId: "faction",
    patterns: [/\bfactions?\b/i, /\borganizations?\b/i, /\borganisations?\b/i, /\borders?\b/i, /\bgovernments?\b/i],
  },
  {
    categoryId: "culture",
    patterns: [/\bcultures?\b/i, /\breligions?\b/i, /\bsocieties?\b/i],
  },
  {
    categoryId: "planet",
    patterns: [/\bplanets?\b/i, /\bmoons?\b/i, /\bworlds?\b/i],
  },
  {
    categoryId: "location",
    patterns: [/\blocations?\b/i, /\bplaces?\b/i, /\bstations?\b/i, /\bfacilit(?:y|ies)\b/i, /\bcities\b/i, /\bregions?\b/i, /\bsettlements?\b/i],
  },
  {
    categoryId: "flora",
    patterns: [/\bfloras?\b/i, /\bplants?\b/i, /\bfung(?:us|i)\b/i, /\bbotany\b/i],
  },
  {
    categoryId: "fauna",
    patterns: [/\bfaunas?\b/i, /\bcreatures?\b/i, /\banimals?\b/i, /\bspecies\b/i, /\bbeasts?\b/i],
  },
  {
    categoryId: "weapon",
    patterns: [/\bweapons?\b/i, /\brifles?\b/i, /\bguns?\b/i, /\bordnance\b/i],
  },
  {
    categoryId: "outfit",
    patterns: [/\boutfits?\b/i, /\bsuits?\b/i, /\barmou?r\b/i, /\bclothing\b/i, /\buniforms?\b/i],
  },
  {
    categoryId: "technology",
    patterns: [/\btechnolog(?:y|ies)\b/i, /\bdevices?\b/i, /\bsystems?\b/i, /\bengines?\b/i, /\bgates?\b/i, /\btools?\b/i],
  },
  {
    categoryId: "vehicle",
    patterns: [/\bvehicles?\b/i, /\bships?\b/i, /\bvessels?\b/i, /\brovers?\b/i, /\bcraft\b/i, /\bshuttles?\b/i],
  },
  {
    categoryId: "artifact",
    patterns: [/\bartifacts?\b/i, /\bartefacts?\b/i, /\brelics?\b/i, /\bkeys?\b/i, /\bdocuments?\b/i],
  },
]);
const WORLD_SPINE_CATEGORY_COLLECTION_LABELS = Object.freeze({
  planet: "Planets",
  location: "Locations",
  character: "Characters",
  faction: "Factions",
  culture: "Cultures",
  flora: "Flora",
  fauna: "Fauna",
  event: "Events",
  "critical-event": "Critical Events",
  weapon: "Weapons",
  outfit: "Outfits",
  technology: "Technologies",
  vehicle: "Vehicles",
  artifact: "Artifacts",
});
const WORLDBUILDING_CATALOGUE_IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=]+)$/i;
const WORLDBUILDING_CATALOGUE_IMAGE_MEDIA_ENDPOINT = "/api/project-media/file/";

// Intent: combine built-ins and author-created custom categories into a stable Dream Scaping view model.
export function buildWorldbuildingStudioModel({
  world = {},
  projectCharacters = [],
  characters = [],
  activeCategoryId = "",
  editingItemId = "",
  editingItemKind = "",
  catalogueCategoryId = "",
  cataloguePosition = null,
  catalogueBounds = null,
  catalogueSelectedItemId = "",
  catalogueSelectedItemKind = "",
  catalogueScope = null,
  status = "",
} = {}) {
  const customCategories = normalizeCustomWorldbuildingCategories(world?.worldbuildingCategories);
  const categories = [
    ...WORLD_SPINE_CATEGORY_DEFINITIONS,
    ...customCategories,
  ];
  const entityCatalogue = normalizeWorldbuildingEntities(world?.entities, world?.worldbuildingCategories);
  const eventDrafts = normalizeWorldbuildingEventDrafts(world?.eventDrafts ?? world?.timelineEventDrafts);
  const locationTheme = normalizeWorldbuildingLocationThemeSettings(world);
  const editingItem = findWorldbuildingEditableCatalogueRecord(world, {
    itemId: editingItemId,
    itemKind: editingItemKind,
    categories,
    entityCatalogue,
    eventDrafts,
  });
  const normalizedActiveCategoryId = editingItem?.categoryId || normalizeString(activeCategoryId);
  const isFormOpen = Boolean(normalizedActiveCategoryId);
  const activeCategory = resolveWorldbuildingCategory(categories, normalizedActiveCategoryId || DEFAULT_WORLDBUILDING_CATEGORY_ID);
  const normalizedCatalogueScope = normalizeWorldbuildingCatalogueScope(catalogueScope);
  const pickerOptionSets = buildWorldSpinePickerOptionSets({
    world,
    worldEntities: entityCatalogue,
    projectCharacters,
    characters,
  });
  const categoryCountsById = buildWorldbuildingCategoryCounts({
    categories,
    entityCatalogue,
    eventDrafts,
    catalogueScope: normalizedCatalogueScope,
  });
  const catalogue = buildWorldbuildingCatalogueModel({
    categories,
    categoryId: catalogueCategoryId,
    entityCatalogue,
    eventDrafts,
    locationTheme,
    catalogueScope: normalizedCatalogueScope,
    position: cataloguePosition,
    bounds: catalogueBounds,
    selectedItemId: catalogueSelectedItemId,
    selectedItemKind: catalogueSelectedItemKind,
  });

  return {
    groups: WORLD_SPINE_CATEGORY_GROUPS,
    categories,
    activeCategory,
    activeCategoryId: activeCategory.id,
    isFormOpen,
    entityCatalogue,
    eventDrafts,
    pickerOptionSets,
    locationTheme,
    editingItem,
    categoryCountsById,
    catalogueScope: normalizedCatalogueScope,
    catalogue,
    status: normalizeString(status),
  };
}

// Intent: render a compact authoring surface where world records and event drafts are created before timeline placement.
export function renderWorldbuildingStudioHTML(model = {}) {
  const categories = Array.isArray(model.categories) ? model.categories : [];
  const activeCategory = model.activeCategory ?? resolveWorldbuildingCategory(categories, model.activeCategoryId);
  const groups = Array.isArray(model.groups) ? model.groups : WORLD_SPINE_CATEGORY_GROUPS;
  const groupedCategoryIds = new Set(groups.flatMap((group) => group.categories));
  const ungroupedCategories = categories.filter((category) => !groupedCategoryIds.has(category.id) && category.isCustomCategory);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const eventDrafts = Array.isArray(model.eventDrafts) ? model.eventDrafts : [];
  const categoryCountsById = model.categoryCountsById && typeof model.categoryCountsById === "object"
    ? model.categoryCountsById
    : {};
  const orderedCategoryIds = [
    ...groups.flatMap((group) => group.categories),
    ...ungroupedCategories.map((category) => category.id),
  ];

  return `
    <section class="worldbuilding-studio" data-worldbuilding-studio>
      <div class="worldbuilding-studio__strip">
        <div class="worldbuilding-studio__toolbar" aria-label="Worldbuilding categories">
          ${groups.map((group, groupIndex) => `
            ${groupIndex > 0 ? '<span class="worldbuilding-category-separator" aria-hidden="true"></span>' : ""}
            <div class="worldbuilding-category-group" aria-label="${escapeHtml(group.label)}">
              ${group.categories.map((categoryId) => categoriesById.has(categoryId)
                ? renderWorldbuildingCategoryButton(
                  categoriesById.get(categoryId),
                  activeCategory.id,
                  categoryCountsById[categoryId] ?? 0,
                  model.isFormOpen,
                  model.catalogueScope,
                )
                : "").join("")}
            </div>
          `).join("")}
          ${ungroupedCategories.length ? `
            <span class="worldbuilding-category-separator" aria-hidden="true"></span>
            <div class="worldbuilding-category-group" aria-label="Author categories">
              ${ungroupedCategories.map((category) => renderWorldbuildingCategoryButton(
                category,
                activeCategory.id,
                categoryCountsById[category.id] ?? 0,
                model.isFormOpen,
                model.catalogueScope,
              )).join("")}
            </div>
          ` : ""}
        </div>
        ${renderWorldbuildingCustomCreateAction()}
        ${renderWorldbuildingDraftTray(eventDrafts)}
      </div>
      ${model.status ? `<p class="worldbuilding-studio__status" role="status">${escapeHtml(model.status)}</p>` : ""}
      ${renderWorldbuildingCatalogueHTML(model.catalogue)}
      ${model.isFormOpen ? `
      <div
        class="worldbuilding-entry-popover"
        data-worldbuilding-entry-popover
        role="dialog"
        aria-label="${escapeHtml(model.editingItem ? `Edit ${model.editingItem.title}` : `Create ${activeCategory.label}`)}"
      >
        ${renderWorldbuildingForm(activeCategory, model.pickerOptionSets, {
          editingItem: model.editingItem,
        })}
      </div>` : ""}
    </section>
  `;
}

// Intent: derive a read-only catalogue from structured world data when the author inspects a category.
function buildWorldbuildingCatalogueModel({
  categories = [],
  categoryId = "",
  entityCatalogue = [],
  eventDrafts = [],
  locationTheme = null,
  catalogueScope = null,
  position = null,
  bounds = null,
  selectedItemId = "",
  selectedItemKind = "",
} = {}) {
  const normalizedCategoryId = normalizeString(categoryId);
  if (!normalizedCategoryId) {
    return null;
  }

  const sourceCategories = Array.isArray(categories) ? categories : [];
  const category = sourceCategories.find((candidate) => candidate.id === normalizedCategoryId);
  if (!category) {
    return null;
  }

  const items = selectWorldbuildingCatalogueItems(category, {
    categories: sourceCategories,
    entityCatalogue,
    eventDrafts,
    catalogueScope,
  });
  const selectedItem = selectWorldbuildingCatalogueDetailItem(items, {
    itemId: selectedItemId,
    itemKind: selectedItemKind,
  });
  return {
    categoryId: category.id,
    categoryLabel: category.label,
    categorySettings: buildWorldbuildingCategorySettingsModel(category, locationTheme),
    scopeLabel: catalogueScope?.label ?? "",
    itemCount: items.length,
    items,
    selectedItem,
    position: resolveCataloguePosition(position),
    bounds: resolveCatalogueBounds(bounds),
  };
}

// Intent: expose category-level timeline placement semantics without turning catalogue items into settings records.
function buildWorldbuildingCategorySettingsModel(category = {}, locationTheme = null) {
  const categoryId = normalizeString(category?.id);
  if (!categoryId || category?.itemKind !== "entity") {
    return null;
  }

  const theme = locationTheme && typeof locationTheme === "object"
    ? locationTheme
    : normalizeWorldbuildingLocationThemeSettings({});
  const locationRole = resolveWorldbuildingCategoryLocationRole(categoryId, theme);
  return {
    categoryId,
    categoryLabel: normalizeString(category?.label) || categoryId,
    locationRole,
    locationRoleOptions: WORLDBUILDING_CATEGORY_LOCATION_ROLE_OPTIONS,
  };
}

function selectWorldbuildingCatalogueItems(category, {
  categories = [],
  entityCatalogue = [],
  eventDrafts = [],
  catalogueScope = null,
} = {}) {
  if (category.id === "custom" && category.itemKind === "custom") {
    return categories
      .filter((candidate) => candidate.isCustomCategory)
      .filter((candidate) => !catalogueScope || selectWorldbuildingCatalogueItems(candidate, {
        categories,
        entityCatalogue,
        eventDrafts,
        catalogueScope,
      }).length > 0)
      .map((candidate) => ({
        id: candidate.id,
        itemKind: "customCategory",
        categoryId: candidate.id,
        title: candidate.label,
        meta: `${candidate.fields.length} fields`,
        detail: candidate.description,
        detailSummary: candidate.description,
        detailRows: buildCustomCategoryCatalogueDetailRows(candidate),
        provenanceRows: [],
        anchorRows: [],
        iconCategoryId: "custom",
        image: null,
      }));
  }

  if (category.itemKind === "eventDraft") {
    return eventDrafts
      .filter((draft) => draft.categoryId === category.id)
      .filter((draft) => isEventDraftInCatalogueScope(draft, catalogueScope))
      .map((draft) => ({
        id: draft.id,
        itemKind: "eventDraft",
        categoryId: draft.categoryId || category.id,
        title: draft.title || "Untitled event",
        meta: formatEventDraftMeta(draft),
        detail: draft.summary,
        detailSummary: draft.summary,
        detailRows: buildEventDraftCatalogueDetailRows(draft, category),
        provenanceRows: buildCatalogueProvenanceRows(draft),
        anchorRows: buildCatalogueAnchorRows(draft),
        iconCategoryId: draft.categoryId || category.id,
        image: normalizeWorldbuildingCatalogueImage(draft.image ?? draft.catalogueImage),
      }));
  }

  return entityCatalogue
    .filter((entity) => isEntityInWorldbuildingCategory(entity, category))
    .filter((entity) => isEntityInCatalogueScope(entity, catalogueScope))
    .map((entity) => ({
      id: entity.id,
      itemKind: "entity",
      categoryId: entity.categoryId || category.id,
      title: entity.name || "Untitled item",
      meta: entity.templateName || entity.categoryLabel || category.label,
      detail: formatEntityFields(entity.fields) || entity.notes,
      detailSummary: entity.notes,
      detailRows: buildEntityCatalogueDetailRows(entity, category),
      provenanceRows: buildCatalogueProvenanceRows(entity),
      anchorRows: buildCatalogueAnchorRows(entity),
      iconCategoryId: entity.categoryId || category.id,
      image: normalizeWorldbuildingCatalogueImage(entity.image ?? entity.catalogueImage),
    }));
}

// Intent: keep catalogue item selection as a render-only detail lookup inside the current filtered list.
function selectWorldbuildingCatalogueDetailItem(items = [], { itemId = "", itemKind = "" } = {}) {
  const normalizedItemId = normalizeString(itemId);
  const normalizedItemKind = normalizeString(itemKind);
  if (!normalizedItemId) {
    return null;
  }

  return (Array.isArray(items) ? items : []).find((item) =>
    item.id === normalizedItemId && (!normalizedItemKind || item.itemKind === normalizedItemKind)
  ) ?? null;
}

// Intent: map a selected catalogue record back to the form category that can safely edit it.
function findWorldbuildingEditableCatalogueRecord(world = {}, {
  itemId = "",
  itemKind = "",
  categories = [],
  entityCatalogue = null,
  eventDrafts = null,
} = {}) {
  const normalizedItemId = normalizeString(itemId);
  const normalizedItemKind = normalizeString(itemKind);
  if (!normalizedItemId || !isEditableWorldbuildingCatalogueItemKind(normalizedItemKind)) {
    return null;
  }

  const sourceCategories = Array.isArray(categories) && categories.length
    ? categories
    : [
        ...WORLD_SPINE_CATEGORY_DEFINITIONS,
        ...normalizeCustomWorldbuildingCategories(world?.worldbuildingCategories),
      ];
  if (normalizedItemKind === "entity") {
    const entities = Array.isArray(entityCatalogue)
      ? entityCatalogue
      : normalizeWorldbuildingEntities(world?.entities, world?.worldbuildingCategories);
    const entity = entities.find((candidate) => candidate.id === normalizedItemId) ?? null;
    if (!entity) {
      return null;
    }

    const category = resolveWorldbuildingCategoryForEntity(entity, sourceCategories);
    if (!category || category.itemKind !== "entity") {
      return null;
    }

    return {
      itemId: entity.id,
      itemKind: "entity",
      categoryId: category.id,
      title: entity.name || "Untitled item",
      record: entity,
    };
  }

  const drafts = Array.isArray(eventDrafts)
    ? eventDrafts
    : normalizeWorldbuildingEventDrafts(world?.eventDrafts ?? world?.timelineEventDrafts);
  const draft = drafts.find((candidate) => candidate.id === normalizedItemId) ?? null;
  if (!draft) {
    return null;
  }

  const category = sourceCategories.find((candidate) => candidate.id === draft.categoryId)
    ?? sourceCategories.find((candidate) => candidate.itemKind === "eventDraft")
    ?? null;
  if (!category) {
    return null;
  }

  return {
    itemId: draft.id,
    itemKind: "eventDraft",
    categoryId: category.id,
    title: draft.title || "Untitled event",
    record: draft,
  };
}

function isEditableWorldbuildingCatalogueItemKind(itemKind = "") {
  return ["entity", "eventDraft"].includes(normalizeString(itemKind));
}

function resolveWorldbuildingCategoryForEntity(entity = {}, categories = []) {
  const customCategoryIds = new Set(
    (Array.isArray(categories) ? categories : [])
      .filter((category) => category?.isCustomCategory)
      .map((category) => normalizeString(category?.id))
      .filter(Boolean),
  );
  const categoryId = resolveWorldbuildingEntityCategoryId(entity, null, customCategoryIds);
  return (Array.isArray(categories) ? categories : []).find((category) => category.id === categoryId)
    ?? (Array.isArray(categories) ? categories : []).find((category) => category.itemKind === "entity" && isEntityInWorldbuildingCategory(entity, category))
    ?? null;
}

// Intent: display catalogue strip numbers as live record counts, optionally scoped to the selected timeline node.
function buildWorldbuildingCategoryCounts({
  categories = [],
  entityCatalogue = [],
  eventDrafts = [],
  catalogueScope = null,
} = {}) {
  return (Array.isArray(categories) ? categories : []).reduce((counts, category) => {
    if (!category?.id) {
      return counts;
    }

    counts[category.id] = selectWorldbuildingCatalogueItems(category, {
      categories,
      entityCatalogue,
      eventDrafts,
      catalogueScope,
    }).length;
    return counts;
  }, {});
}

// Intent: normalize selected timeline nodes into reusable catalogue-scope terms without making the selection durable.
function normalizeWorldbuildingCatalogueScope(scope = null) {
  if (!scope || typeof scope !== "object") {
    return null;
  }

  const nodeId = normalizeString(scope.nodeId ?? scope.id);
  const sceneId = normalizeString(scope.sceneId);
  const primaryBlockId = normalizeString(scope.primaryBlockId ?? scope.blockId);
  const people = normalizeStringList(scope.people ?? scope.charactersPresent ?? scope.characters);
  const linkedEntityNames = normalizeStringList(scope.linkedEntityNames ?? scope.linkedItems);
  const linkedLocations = normalizeStringList(scope.linkedLocations ?? scope.linkedLocation);
  const criticalEvents = normalizeStringList(scope.criticalEvents);
  const sceneBeats = normalizeStringList(scope.sceneBeats);
  const customMetadataRows = normalizeCatalogueScopeMetadataRows(scope.customMetadata);
  const scopeTitle = normalizeString(scope.title);
  const scopeTypeLabel = normalizeString(scope.typeLabel);
  const mainLocation = normalizeString(scope.mainLocation ?? scope.locationRowLabel ?? scope.rowLocation ?? scope.location);
  const sublocation = normalizeString(scope.childLocation ?? scope.childLocationLabel ?? scope.sublocation ?? scope.subLocation ?? scope.sublocationLabel ?? scope.specificLocation);
  const location = mainLocation || normalizeString(scope.location);
  const locationTerms = uniqueStrings([
    location,
    mainLocation,
    sublocation,
    ...linkedLocations,
  ]).filter(isMeaningfulCatalogueTerm);
  const label = normalizeString(scope.label) ||
    (scopeTypeLabel && scopeTitle ? `${scopeTypeLabel}: ${scopeTitle}` : "") ||
    scopeTitle ||
    normalizeString(scope.sceneTitle) ||
    scopeTypeLabel ||
    "selected node";
  const scopeTexts = [
    label,
    scope.title,
    scope.summary,
    scope.sceneTitle,
    scope.chapterTitle,
    location,
    sublocation,
    scope.date,
    scope.time,
    scope.searchText,
    ...people,
    ...linkedEntityNames,
    ...linkedLocations,
    ...criticalEvents,
    ...sceneBeats,
    ...customMetadataRows.flatMap((row) => [row.label, row.value]),
  ];
  const terms = uniqueStrings([
    ...locationTerms,
    ...people,
    ...linkedEntityNames,
    ...criticalEvents,
    ...sceneBeats,
    ...customMetadataRows.map((row) => row.value),
    normalizeString(scope.title),
  ]).filter(isMeaningfulCatalogueTerm);

  return {
    nodeId,
    sourceId: normalizeString(scope.sourceId),
    sceneId,
    chapterId: normalizeString(scope.chapterId),
    primaryBlockId,
    level: normalizeString(scope.level),
    kind: normalizeString(scope.kind),
    typeLabel: normalizeString(scope.typeLabel),
    label,
    title: normalizeString(scope.title),
    summary: normalizeString(scope.summary),
    sceneTitle: normalizeString(scope.sceneTitle),
    location,
    mainLocation,
    sublocation,
    linkedLocations,
    people,
    linkedEntityNames,
    criticalEvents,
    sceneBeats,
    customMetadata: customMetadataRows,
    lineNumbers: normalizeNumberList(scope.lineNumbers),
    locationTerms,
    terms,
    searchText: normalizeString(scopeTexts.join(" ")).toLowerCase(),
  };
}

function normalizeCatalogueScopeMetadataRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: normalizeString(row?.label ?? row?.id),
      value: normalizeString(row?.value),
    }))
    .filter((row) => row.label && row.value);
}

function isEntityInCatalogueScope(entity, catalogueScope = null) {
  if (!catalogueScope) {
    return true;
  }

  if (recordMatchesCatalogueScopeAnchor(entity, catalogueScope)) {
    return true;
  }

  const entityNames = collectEntityCatalogueNames(entity);
  const entityText = buildCatalogueEntitySearchText(entity);
  const categoryId = resolveWorldbuildingEntityCategoryId(entity);

  if (isWorldbuildingPlaceCategoryId(categoryId)) {
    const locationTerms = Array.isArray(catalogueScope.locationTerms) ? catalogueScope.locationTerms : [];
    return entityNames.some((name) =>
      locationTerms.some((term) => catalogueTermsMatch(name, term))
    );
  }

  if (entityNames.some((name) => catalogueScope.terms.some((term) => catalogueTermsMatch(name, term)))) {
    return true;
  }

  if (entityNames.some((name) => scopeSearchTextMentionsName(catalogueScope.searchText, name))) {
    return true;
  }

  if (categoryId === "character" && entityNames.some((name) =>
    catalogueScope.people.some((person) => catalogueTermsMatch(name, person))
  )) {
    return true;
  }

  return catalogueScope.terms.some((term) =>
    isMeaningfulCatalogueTerm(term) && entityText.includes(term.toLowerCase())
  );
}

function isEventDraftInCatalogueScope(draft, catalogueScope = null) {
  if (!catalogueScope) {
    return true;
  }

  if (recordMatchesCatalogueScopeAnchor(draft, catalogueScope)) {
    return true;
  }

  const draftNames = uniqueStrings([
    draft?.title,
    ...(Array.isArray(draft?.criticalEvents) ? draft.criticalEvents : []),
    ...(Array.isArray(draft?.sceneBeats) ? draft.sceneBeats : []),
  ]);
  if (draftNames.some((name) => catalogueScope.terms.some((term) => catalogueTermsMatch(name, term)))) {
    return true;
  }

  const draftText = normalizeString([
    draft?.title,
    draft?.summary,
    draft?.location,
    draft?.sublocation,
    draft?.orbitalBand,
    ...(Array.isArray(draft?.people) ? draft.people : []),
    ...(Array.isArray(draft?.linkedEntityNames) ? draft.linkedEntityNames : []),
    ...(Array.isArray(draft?.criticalEvents) ? draft.criticalEvents : []),
  ].join(" ")).toLowerCase();
  return catalogueScope.terms.some((term) =>
    isMeaningfulCatalogueTerm(term) && draftText.includes(term.toLowerCase())
  );
}

function recordMatchesCatalogueScopeAnchor(record, catalogueScope) {
  if (!record || !catalogueScope) {
    return false;
  }

  const sceneId = normalizeString(record.sceneId ?? record.introductionSceneId ?? record.primarySceneId);
  const blockId = normalizeString(record.blockId ?? record.introductionBlockId ?? record.primaryBlockId);
  if (catalogueScope.sceneId && sceneId && catalogueScope.sceneId === sceneId) {
    return true;
  }
  if (catalogueScope.primaryBlockId && blockId && catalogueScope.primaryBlockId === blockId) {
    return true;
  }

  const anchors = [
    ...(Array.isArray(record.manuscriptAnchors) ? record.manuscriptAnchors : []),
    record.eventStartAnchor,
    record.eventEndAnchor,
  ].filter(Boolean);
  return anchors.some((anchor) => {
    const anchorSceneId = normalizeString(anchor.sceneId);
    const anchorBlockId = normalizeString(anchor.blockId);
    return (
      (catalogueScope.sceneId && anchorSceneId && catalogueScope.sceneId === anchorSceneId) ||
      (catalogueScope.primaryBlockId && anchorBlockId && catalogueScope.primaryBlockId === anchorBlockId)
    );
  });
}

function collectEntityCatalogueNames(entity) {
  const aliasValues = (Array.isArray(entity?.fields) ? entity.fields : [])
    .filter((field) => /alias|also known|aka/i.test(`${field?.key ?? ""} ${field?.label ?? ""}`))
    .flatMap((field) => normalizeStringList(field?.value));
  const name = normalizeString(entity?.name);
  const categoryId = resolveWorldbuildingEntityCategoryId(entity);
  const shortCharacterName = categoryId === "character"
    ? normalizeString(name.split(/\s+/)[0])
    : "";
  return uniqueStrings([
    name,
    shortCharacterName,
    ...aliasValues,
  ]).filter(isMeaningfulCatalogueTerm);
}

function buildCatalogueEntitySearchText(entity) {
  const fields = Array.isArray(entity?.fields)
    ? entity.fields.flatMap((field) => [field?.label, field?.value])
    : [];
  return normalizeString([
    entity?.name,
    entity?.categoryLabel,
    entity?.templateName,
    entity?.sourcePath,
    entity?.scrivenerBinderPath,
    entity?.notes,
    ...fields,
  ].join(" ")).toLowerCase();
}

function catalogueTermsMatch(left, right) {
  const leftTerm = normalizeString(left).toLowerCase();
  const rightTerm = normalizeString(right).toLowerCase();
  if (!isMeaningfulCatalogueTerm(leftTerm) || !isMeaningfulCatalogueTerm(rightTerm)) {
    return false;
  }
  return leftTerm === rightTerm || leftTerm.includes(rightTerm) || rightTerm.includes(leftTerm);
}

function scopeSearchTextMentionsName(searchText, name) {
  const normalizedName = normalizeString(name).toLowerCase();
  if (!isMeaningfulCatalogueTerm(normalizedName)) {
    return false;
  }
  return normalizeString(searchText).toLowerCase().includes(normalizedName);
}

function isMeaningfulCatalogueTerm(value) {
  const normalized = normalizeString(value);
  return normalized.length >= 3 && !/^(none|n\/a|unknown|untitled|world|event|scene|item)$/i.test(normalized);
}

function renderWorldbuildingCatalogueHTML(catalogue = null) {
  if (!catalogue) {
    return "";
  }

  const safeBounds = resolveCatalogueBounds(catalogue.bounds);
  const safePosition = safeBounds
    ? { x: safeBounds.left, y: safeBounds.top }
    : resolveCataloguePosition(catalogue.position);
  const sizeStyle = safeBounds
    ? ` width:${safeBounds.width}px; height:${safeBounds.height}px;`
    : "";
  const hasSelectedItem = Boolean(catalogue.selectedItem);
  return `
    <div
      class="worldbuilding-catalogue-popover ${hasSelectedItem ? "has-detail" : ""}"
      data-worldbuilding-catalogue
      data-worldbuilding-catalogue-category-id="${escapeHtml(catalogue.categoryId)}"
      role="dialog"
      aria-label="${escapeHtml(`${catalogue.categoryLabel} catalogue`)}"
      style="left:${safePosition.x}px; top:${safePosition.y}px;${sizeStyle}"
    >
      <div class="worldbuilding-catalogue-heading" data-worldbuilding-catalogue-drag-handle>
        <div>
          <p class="panel-kicker">Catalogue</p>
          <h3>${escapeHtml(catalogue.categoryLabel)}</h3>
          ${catalogue.scopeLabel ? `<span class="worldbuilding-catalogue-scope">${escapeHtml(catalogue.scopeLabel)}</span>` : ""}
        </div>
        <strong>${escapeHtml(formatCatalogueCountLabel(catalogue.itemCount))}</strong>
        <button
          type="button"
          class="worldbuilding-catalogue-add"
          data-action="add-worldbuilding-catalogue-item"
          data-worldbuilding-category-id="${escapeHtml(catalogue.categoryId)}"
          aria-label="${escapeHtml(`Add ${catalogue.categoryLabel}`)}"
          title="${escapeHtml(`Add ${catalogue.categoryLabel}`)}"
        >+</button>
        <button
          type="button"
          class="worldbuilding-catalogue-close"
          data-action="close-worldbuilding-catalogue"
          aria-label="Close catalogue"
          title="Close"
        >x</button>
      </div>
      ${renderWorldbuildingCatalogueCategorySettingsHTML(catalogue.categorySettings)}
      <div class="worldbuilding-catalogue-body">
        <div class="worldbuilding-catalogue-list" role="list">
          ${catalogue.items.length
            ? catalogue.items.map((item) => renderWorldbuildingCatalogueItem(
              item,
              catalogue.selectedItem?.id === item.id && catalogue.selectedItem?.itemKind === item.itemKind,
            )).join("")
            : '<p class="worldbuilding-catalogue-empty">No items yet</p>'}
        </div>
        ${hasSelectedItem ? renderWorldbuildingCatalogueDetailHTML(catalogue.selectedItem) : ""}
      </div>
      <span
        class="worldbuilding-catalogue-resize-handle"
        data-worldbuilding-catalogue-resize-handle
        aria-hidden="true"
      ></span>
    </div>
  `;
}

function renderWorldbuildingCatalogueCategorySettingsHTML(settings = null) {
  if (!settings?.categoryId) {
    return "";
  }

  const options = Array.isArray(settings.locationRoleOptions)
    ? settings.locationRoleOptions
    : WORLDBUILDING_CATEGORY_LOCATION_ROLE_OPTIONS;
  return `
    <form
      class="worldbuilding-catalogue-properties"
      data-worldbuilding-category-properties-form
      data-worldbuilding-category-id="${escapeHtml(settings.categoryId)}"
    >
      <label class="worldbuilding-catalogue-properties__field">
        <span>Location role</span>
        <select
          data-worldbuilding-category-property="locationRole"
          aria-label="${escapeHtml(`${settings.categoryLabel} location role`)}"
        >
          ${options.map((option) => `
            <option
              value="${escapeHtml(option.id)}"
              ${option.id === settings.locationRole ? "selected" : ""}
            >${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </label>
      <button
        type="button"
        class="worldbuilding-catalogue-properties__save"
        data-action="save-worldbuilding-category-properties"
        data-worldbuilding-category-id="${escapeHtml(settings.categoryId)}"
      >Save</button>
    </form>
  `;
}

function renderWorldbuildingCatalogueItem(item, isSelected = false) {
  return `
    <article
      class="worldbuilding-catalogue-item ${isSelected ? "is-selected" : ""}"
      data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
      data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
      role="listitem"
    >
      <button
        type="button"
        class="worldbuilding-catalogue-item__button"
        data-action="select-worldbuilding-catalogue-item"
        data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
        data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
        aria-pressed="${isSelected ? "true" : "false"}"
      >
        ${renderWorldbuildingCatalogueItemMediaHTML(item)}
        <span class="worldbuilding-catalogue-item__body">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.meta)}</span>
          ${item.detail ? `<em>${escapeHtml(item.detail)}</em>` : ""}
        </span>
      </button>
    </article>
  `;
}

function renderWorldbuildingCatalogueItemMediaHTML(item = {}) {
  const image = normalizeWorldbuildingCatalogueImage(item.image);
  const imageSource = createWorldbuildingCatalogueImageSource(image);
  if (imageSource) {
    return `
      <span class="worldbuilding-catalogue-item__media" aria-hidden="true">
        <img
          class="worldbuilding-catalogue-item__image"
          src="${escapeHtml(imageSource)}"
          alt=""
          loading="lazy"
        >
      </span>
    `;
  }

  return `
    <span class="worldbuilding-catalogue-item__media worldbuilding-catalogue-item__media--icon" aria-hidden="true">
      ${renderWorldbuildingCategoryIcon(item.iconCategoryId)}
    </span>
  `;
}

function renderWorldbuildingCatalogueDetailHTML(item) {
  const detailRows = Array.isArray(item.detailRows) ? item.detailRows : [];
  const provenanceRows = Array.isArray(item.provenanceRows) ? item.provenanceRows : [];
  const anchorRows = Array.isArray(item.anchorRows) ? item.anchorRows : [];
  const actions = renderWorldbuildingCatalogueDetailActions(item);
  return `
    <aside
      class="worldbuilding-catalogue-detail"
      data-worldbuilding-catalogue-detail
      data-worldbuilding-catalogue-detail-item-id="${escapeHtml(item.id)}"
      data-worldbuilding-catalogue-detail-item-kind="${escapeHtml(item.itemKind)}"
      aria-label="${escapeHtml(`${item.title} catalogue item details`)}"
    >
      <div class="worldbuilding-catalogue-detail__heading">
        <div class="worldbuilding-catalogue-detail__title">
          <span>Details</span>
          <h4>${escapeHtml(item.title)}</h4>
          <small>${escapeHtml(item.meta || "Catalogue item")}</small>
        </div>
        ${actions}
      </div>
      ${renderWorldbuildingCatalogueDetailImageHTML(item)}
      ${item.detailSummary ? `<p class="worldbuilding-catalogue-detail__summary">${escapeHtml(item.detailSummary)}</p>` : ""}
      ${renderWorldbuildingCatalogueDetailRows("Fields", detailRows)}
      ${renderWorldbuildingCatalogueDetailRows("Source", provenanceRows)}
      ${renderWorldbuildingCatalogueDetailRows("Anchors", anchorRows)}
    </aside>
  `;
}

function renderWorldbuildingCatalogueDetailImageHTML(item = {}) {
  const image = normalizeWorldbuildingCatalogueImage(item.image);
  const imageSource = createWorldbuildingCatalogueImageSource(image);
  if (!imageSource) {
    return "";
  }

  return `
    <figure class="worldbuilding-catalogue-detail__image">
      <img src="${escapeHtml(imageSource)}" alt="${escapeHtml(`${item.title || "Catalogue item"} reference image`)}" loading="lazy">
      <figcaption>${escapeHtml(image.name || "Catalogue image")}</figcaption>
    </figure>
  `;
}

function renderWorldbuildingCatalogueDetailActions(item = {}) {
  if (!isEditableWorldbuildingCatalogueItemKind(item?.itemKind)) {
    return "";
  }

  const title = normalizeString(item.title) || "catalogue item";
  return `
    <div class="worldbuilding-catalogue-detail__actions" aria-label="${escapeHtml(`${title} actions`)}">
      <button
        type="button"
        class="worldbuilding-catalogue-detail__action"
        data-action="attach-worldbuilding-catalogue-image"
        data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
        data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
        aria-label="${escapeHtml(`Attach image to ${title}`)}"
        title="Attach image"
      >
        <span class="worldbuilding-catalogue-action-icon worldbuilding-catalogue-action-icon--image" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        class="worldbuilding-catalogue-detail__action"
        data-action="edit-worldbuilding-catalogue-item"
        data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
        data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
        aria-label="${escapeHtml(`Edit ${title}`)}"
        title="Edit"
      >
        <span class="worldbuilding-catalogue-action-icon worldbuilding-catalogue-action-icon--edit" aria-hidden="true"></span>
      </button>
      <button
        type="button"
        class="worldbuilding-catalogue-detail__action is-danger"
        data-action="delete-worldbuilding-catalogue-item"
        data-worldbuilding-catalogue-item-id="${escapeHtml(item.id)}"
        data-worldbuilding-catalogue-item-kind="${escapeHtml(item.itemKind)}"
        aria-label="${escapeHtml(`Delete ${title}`)}"
        title="Delete"
      >
        <span class="worldbuilding-catalogue-action-icon worldbuilding-catalogue-action-icon--delete" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

// Intent: derive event-scoped catalogue cards for the World Spine right pane without mutating saved world records.
export function buildWorldbuildingRelatedCatalogueCardsModel({
  world = {},
  catalogueScope = null,
} = {}) {
  const studioModel = buildWorldbuildingStudioModel({
    world,
    catalogueScope,
  });
  const categories = Array.isArray(studioModel.categories) ? studioModel.categories : [];
  const entityCatalogue = Array.isArray(studioModel.entityCatalogue) ? studioModel.entityCatalogue : [];
  const eventDrafts = Array.isArray(studioModel.eventDrafts) ? studioModel.eventDrafts : [];
  const locationGroup = buildWorldbuildingRelatedLocationCardGroup({
    categories,
    entityCatalogue,
    eventDrafts,
    locationTheme: studioModel.locationTheme,
    catalogueScope: studioModel.catalogueScope,
  });
  const groups = [
    locationGroup,
    ...categories
    .filter((category) => ["entity", "eventDraft"].includes(normalizeString(category?.itemKind)))
    .filter((category) => !isWorldbuildingCoreLocationCategoryId(category?.id, studioModel.locationTheme))
    .filter((category) => normalizeString(category?.id) !== "location")
    .map((category) => {
      const items = selectWorldbuildingCatalogueItems(category, {
        categories,
        entityCatalogue,
        eventDrafts,
        catalogueScope: studioModel.catalogueScope,
      })
        .filter((item) => ["entity", "eventDraft"].includes(normalizeString(item.itemKind)))
        .map((item) => createWorldbuildingRelatedCardItem(item, {
          catalogueScope: studioModel.catalogueScope,
        }))
        .filter((item) => item.id && item.title);

      return {
        id: normalizeString(category.id),
        label: formatWorldbuildingCatalogueCollectionLabel(category),
        itemCount: items.length,
        items,
      };
    })
    .filter((group) => group?.id && group.items.length > 0),
  ].filter(Boolean);

  return {
    scopeLabel: normalizeString(studioModel.catalogueScope?.label),
    scopeTitle: normalizeString(studioModel.catalogueScope?.title),
    hasScope: Boolean(studioModel.catalogueScope),
    totalItemCount: groups.reduce((total, group) => total + group.items.length, 0),
    groups,
  };
}

// Intent: present setting as a writer-facing Location hierarchy instead of leaking Planet/Location storage buckets.
function buildWorldbuildingRelatedLocationCardGroup({
  categories = [],
  entityCatalogue = [],
  eventDrafts = [],
  locationTheme = null,
  catalogueScope = null,
} = {}) {
  if (!catalogueScope?.location) {
    return null;
  }

  const placeCategories = (Array.isArray(categories) ? categories : [])
    .filter((category) => isWorldbuildingLocationRoleCategoryId(category?.id, locationTheme));
  const placeItems = uniqueRelatedCatalogueItems(
    placeCategories.flatMap((category) =>
      selectWorldbuildingCatalogueItems(category, {
        categories,
        entityCatalogue,
        eventDrafts,
        catalogueScope,
      })
        .filter((item) => normalizeString(item.itemKind) === "entity")
        .map((item) => createWorldbuildingRelatedCardItem(item, {
          catalogueScope,
          forcePlaceMeta: true,
        }))
    ),
  );
  const contextItems = buildWorldbuildingLocationContextItems(catalogueScope, placeItems);
  const items = uniqueRelatedCatalogueItems([
    ...contextItems,
    ...placeItems,
  ]);

  return {
    id: "location",
    label: formatWorldbuildingRelatedLocationGroupLabel(catalogueScope),
    itemCount: items.length,
    canAddSublocation: Boolean(normalizeString(catalogueScope?.nodeId) && normalizeString(catalogueScope?.location)),
    nodeId: normalizeString(catalogueScope?.nodeId),
    sceneId: normalizeString(catalogueScope?.sceneId),
    locationLabel: normalizeString(catalogueScope?.mainLocation ?? catalogueScope?.location),
    sublocationLabel: normalizeString(catalogueScope?.sublocation),
    items,
  };
}

function createWorldbuildingRelatedCardItem(item = {}, {
  catalogueScope = null,
  forcePlaceMeta = false,
} = {}) {
  const categoryId = normalizeString(item.categoryId);
  const title = normalizeString(item.title) || "Untitled item";
  return {
    id: normalizeString(item.id),
    itemKind: normalizeString(item.itemKind),
    categoryId,
    title,
    meta: forcePlaceMeta ? formatWorldbuildingRelatedPlaceCardMeta(title, catalogueScope, item.meta) : normalizeString(item.meta),
    detail: normalizeString(item.detail),
    detailSummary: normalizeString(item.detailSummary),
    detailRows: normalizeWorldbuildingRelatedCardRows(item.detailRows),
    image: normalizeWorldbuildingCatalogueImage(item.image),
    iconCategoryId: normalizeString(item.iconCategoryId),
    canAttachImage: normalizeString(item.itemKind) === "entity",
    canEditSceneMetadata: forcePlaceMeta && Boolean(normalizeString(catalogueScope?.sceneId)),
    sceneId: forcePlaceMeta ? normalizeString(catalogueScope?.sceneId) : "",
  };
}

function buildWorldbuildingLocationContextItems(catalogueScope = null, existingItems = []) {
  const mainLocation = normalizeString(catalogueScope?.mainLocation ?? catalogueScope?.location);
  const sublocation = normalizeString(catalogueScope?.sublocation);
  const sceneId = normalizeString(catalogueScope?.sceneId);
  const items = [];
  if (mainLocation && !relatedCatalogueItemsContainTitle(existingItems, mainLocation)) {
    items.push({
      id: `location:${slugify(mainLocation)}`,
      itemKind: "locationContext",
      categoryId: "location",
      title: mainLocation,
      meta: "Main location",
      detail: "Current event location.",
      detailSummary: "Current event location.",
      detailRows: normalizeWorldbuildingRelatedCardRows([
        { label: "Location", value: mainLocation },
        { label: "Child location", value: sublocation },
      ]),
      image: null,
      iconCategoryId: "location",
      canAttachImage: false,
      canEditSceneMetadata: Boolean(sceneId),
      sceneId,
    });
  }

  if (sublocation && !relatedCatalogueItemsContainTitle([...existingItems, ...items], sublocation)) {
    items.push({
      id: `child-location:${slugify(`${mainLocation}-${sublocation}`)}`,
      itemKind: "locationContext",
      categoryId: "location",
      title: sublocation,
      meta: "Child location",
      detail: mainLocation ? `Specific place inside ${mainLocation}.` : "Specific event place.",
      detailSummary: mainLocation ? `Specific place inside ${mainLocation}.` : "Specific event place.",
      detailRows: normalizeWorldbuildingRelatedCardRows([
        { label: "Location", value: mainLocation },
        { label: "Child location", value: sublocation },
      ]),
      image: null,
      iconCategoryId: "location",
      canAttachImage: false,
      canEditSceneMetadata: Boolean(sceneId),
      sceneId,
    });
  }

  return items;
}

function formatWorldbuildingRelatedLocationGroupLabel(catalogueScope = null) {
  const mainLocation = normalizeString(catalogueScope?.mainLocation ?? catalogueScope?.location);
  return mainLocation ? `Location > ${mainLocation}` : "Location";
}

function formatWorldbuildingRelatedPlaceCardMeta(title = "", catalogueScope = null, fallback = "") {
  const titleKey = slugify(title);
  const mainLocationKey = slugify(catalogueScope?.mainLocation ?? catalogueScope?.location);
  const sublocationKey = slugify(catalogueScope?.sublocation);
  if (titleKey && mainLocationKey && titleKey === mainLocationKey) {
    return "Main location";
  }
  if (titleKey && sublocationKey && titleKey === sublocationKey) {
    return "Child location";
  }
  return normalizeString(fallback) || "Location";
}

function normalizeWorldbuildingRelatedCardRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: normalizeString(row?.label),
      value: normalizeString(row?.value),
    }))
    .filter((row) => row.label && row.value);
}

function uniqueRelatedCatalogueItems(items = []) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = `${normalizeString(item?.itemKind)}:${normalizeString(item?.id)}`;
    if (!normalizeString(item?.id) || !normalizeString(item?.title) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function relatedCatalogueItemsContainTitle(items = [], title = "") {
  const titleKey = slugify(title);
  return Boolean(titleKey && (Array.isArray(items) ? items : []).some((item) => slugify(item?.title) === titleKey));
}

function isWorldbuildingPlaceCategoryId(categoryId = "") {
  return ["planet", "location"].includes(normalizeString(categoryId));
}

function isWorldbuildingLocationRoleCategoryId(categoryId = "", locationTheme = null) {
  const normalizedCategoryId = slugify(categoryId);
  if (!normalizedCategoryId) {
    return false;
  }

  const theme = locationTheme && typeof locationTheme === "object"
    ? locationTheme
    : normalizeWorldbuildingLocationThemeSettings({});
  return [
    ...normalizeStringList(theme.coreLocationCategories),
    ...normalizeStringList(theme.sublocationCategories),
  ].map(slugify).includes(normalizedCategoryId);
}

function isWorldbuildingCoreLocationCategoryId(categoryId = "", locationTheme = null) {
  const normalizedCategoryId = slugify(categoryId);
  if (!normalizedCategoryId) {
    return false;
  }

  const theme = locationTheme && typeof locationTheme === "object"
    ? locationTheme
    : normalizeWorldbuildingLocationThemeSettings({});
  return normalizeStringList(theme.coreLocationCategories).map(slugify).includes(normalizedCategoryId);
}

// Intent: keep collection headings plural while preserving singular labels for create/edit forms.
function formatWorldbuildingCatalogueCollectionLabel(category = {}) {
  const categoryId = normalizeString(category?.id);
  const explicitCollectionLabel = normalizeString(category?.collectionLabel ?? category?.pluralLabel);
  const label = normalizeString(category?.label) || "Catalogue";
  if (explicitCollectionLabel) {
    return explicitCollectionLabel;
  }
  if (categoryId && WORLD_SPINE_CATEGORY_COLLECTION_LABELS[categoryId]) {
    return WORLD_SPINE_CATEGORY_COLLECTION_LABELS[categoryId];
  }
  return pluralizeWorldbuildingCatalogueLabel(label);
}

function pluralizeWorldbuildingCatalogueLabel(label = "") {
  const normalizedLabel = normalizeString(label) || "Catalogue";
  if (/s$/i.test(normalizedLabel)) {
    return normalizedLabel;
  }
  if (/[^aeiou]y$/i.test(normalizedLabel)) {
    return `${normalizedLabel.slice(0, -1)}ies`;
  }
  return `${normalizedLabel}s`;
}

function renderWorldbuildingCatalogueDetailRows(title, rows = []) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: normalizeString(row?.label),
      value: normalizeString(row?.value),
    }))
    .filter((row) => row.label && row.value);
  if (!normalizedRows.length) {
    return "";
  }

  return `
    <section class="worldbuilding-catalogue-detail__section">
      <h5>${escapeHtml(title)}</h5>
      <dl>
        ${normalizedRows.map((row) => `
          <div>
            <dt>${escapeHtml(row.label)}</dt>
            <dd>${escapeHtml(row.value)}</dd>
          </div>
        `).join("")}
      </dl>
    </section>
  `;
}

// Intent: render the node-shaped native drag image used only when placing crafted events on the spine.
export function renderWorldbuildingEventDraftPlacementPreviewHTML(world = {}, draftId = "") {
  const normalizedDraftId = normalizeString(draftId);
  const draft = normalizeWorldbuildingEventDrafts(world?.eventDrafts ?? world?.timelineEventDrafts)
    .find((candidate) => candidate.id === normalizedDraftId);
  if (!draft) {
    return "";
  }

  return `
    <article class="world-spine-node world-spine-node--primary world-spine-node--event worldbuilding-event-draft-drag-image" aria-hidden="true">
      <span class="world-spine-node__title">${escapeHtml(draft.title || "World event")}</span>
      <span class="world-spine-node__meta">${escapeHtml(formatEventDraftMeta(draft))}</span>
      <span class="world-spine-node__icons">
        ${renderEventDraftPreviewBadge(draft.location, "L", "Location")}
        ${renderEventDraftPreviewBadge(draft.people.length, "P", "People present")}
        ${renderEventDraftPreviewBadge(draft.criticalEvents.length, "C", "Critical event")}
      </span>
    </article>
  `;
}

// Intent: collect tab-navigable form data using the stable data attributes owned by this feature slice.
export function collectWorldbuildingFormValues(form) {
  const isFormLike = typeof HTMLFormElement === "undefined"
    ? form && typeof form.querySelectorAll === "function"
    : form instanceof HTMLFormElement;
  if (!isFormLike) {
    return {};
  }

  const values = {};
  form.querySelectorAll("[data-worldbuilding-field]").forEach((field) => {
    const key = normalizeString(field.dataset.worldbuildingField);
    if (!key) {
      return;
    }

    values[key] = "value" in field ? String(field.value ?? "") : "";
  });
  const listValues = {};
  form.querySelectorAll("[data-worldbuilding-field-list]").forEach((field) => {
    const key = normalizeString(field.dataset.worldbuildingFieldList);
    if (!key) {
      return;
    }

    listValues[key] = Array.isArray(listValues[key]) ? listValues[key] : [];
    listValues[key].push("value" in field ? String(field.value ?? "") : "");
  });
  for (const [key, entries] of Object.entries(listValues)) {
    values[key] = entries.map(normalizeString).filter(Boolean).join(", ");
  }
  return values;
}

// Intent: refresh parent-scoped child-place datalists while preserving free-text catalogue entry fields.
export function refreshWorldbuildingScopedPickerDatalists(form, pickerOptionSets = {}) {
  const isFormLike = typeof HTMLFormElement === "undefined"
    ? form && typeof form.querySelectorAll === "function"
    : form instanceof HTMLFormElement;
  if (!isFormLike) {
    return;
  }

  const categoryId = normalizeString(form?.dataset?.worldbuildingCategoryId) || "category";
  const values = collectWorldbuildingFormValues(form);
  form.querySelectorAll("[data-worldbuilding-field]").forEach((input) => {
    const field = {
      id: normalizeString(input?.dataset?.worldbuildingField),
      label: readWorldbuildingRenderedFieldLabel(input),
    };
    const pickerType = resolveWorldSpinePickerTypeForField(field, pickerOptionSets);
    if (!isWorldbuildingDynamicScopedPickerType(pickerType)) {
      return;
    }

    const listId = createWorldbuildingPickerListId(categoryId, pickerType);
    const options = getWorldSpinePickerOptionsForField(field, pickerOptionSets, { values });
    if (typeof input.setAttribute === "function") {
      input.setAttribute("list", listId);
      input.setAttribute("autocomplete", "off");
    }
    upsertWorldbuildingPickerDatalist(form, {
      listId,
      pickerType,
      options,
    });
  });
}

function readWorldbuildingRenderedFieldLabel(input = null) {
  const label = typeof input?.closest === "function"
    ? input.closest(".worldbuilding-field")
    : null;
  const labelSpan = label && typeof label.querySelector === "function"
    ? label.querySelector("span")
    : null;
  return normalizeString(labelSpan?.textContent);
}

function upsertWorldbuildingPickerDatalist(form, {
  listId = "",
  pickerType = "",
  options = [],
} = {}) {
  if (!listId || typeof document === "undefined") {
    return;
  }

  let datalist = document.getElementById(listId);
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = listId;
    datalist.dataset.worldbuildingPickerOptions = "";
    const actionRow = typeof form.querySelector === "function"
      ? form.querySelector(".worldbuilding-form__actions")
      : null;
    if (actionRow && typeof form.insertBefore === "function") {
      form.insertBefore(datalist, actionRow);
    } else if (typeof form.appendChild === "function") {
      form.appendChild(datalist);
    }
  }

  datalist.dataset.worldbuildingPickerType = pickerType;
  if (typeof datalist.replaceChildren === "function") {
    datalist.replaceChildren(
      ...uniqueStrings((Array.isArray(options) ? options : []).map(normalizeString).filter(Boolean))
        .map((option) => {
          const optionElement = document.createElement("option");
          optionElement.value = option;
          return optionElement;
        }),
    );
  }
}

// Intent: resolve the selected catalogue detail into the category/form state needed for an edit session.
export function createWorldbuildingCatalogueEditFormState(world = {}, {
  itemId = "",
  itemKind = "",
} = {}) {
  const model = buildWorldbuildingStudioModel({ world });
  const editingItem = findWorldbuildingEditableCatalogueRecord(world, {
    itemId,
    itemKind,
    categories: model.categories,
    entityCatalogue: model.entityCatalogue,
    eventDrafts: model.eventDrafts,
  });
  if (!editingItem) {
    return {
      itemId: normalizeString(itemId),
      itemKind: normalizeString(itemKind),
      categoryId: "",
      record: null,
      reason: "not-editable",
    };
  }

  return {
    itemId: editingItem.itemId,
    itemKind: editingItem.itemKind,
    categoryId: editingItem.categoryId,
    record: editingItem.record,
    reason: "editable",
  };
}

// Intent: convert author form values into either a reusable catalogue entity, a custom category, or a timeline event draft.
export function buildWorldbuildingItemFromFormValues({
  categoryId = DEFAULT_WORLDBUILDING_CATEGORY_ID,
  values = {},
  world = {},
  existingItemId = "",
  existingItemKind = "",
  now = new Date(),
} = {}) {
  const model = buildWorldbuildingStudioModel({ world, activeCategoryId: categoryId });
  const category = model.activeCategory;
  const submittedValues = normalizeValueRecord(values);
  const timestamp = normalizeDateISOString(now);
  const editingItem = findWorldbuildingEditableCatalogueRecord(world, {
    itemId: existingItemId,
    itemKind: existingItemKind,
    categories: model.categories,
    entityCatalogue: model.entityCatalogue,
    eventDrafts: model.eventDrafts,
  });
  const operation = editingItem ? "updated" : "created";

  if (existingItemId && !editingItem) {
    return {
      itemType: "missing",
      operation: "missing",
      reason: "missing-catalogue-item",
    };
  }

  if (category.id === "custom") {
    const customCategory = createCustomCategoryFromValues(submittedValues, world);
    const entity = createWorldbuildingEntityFromValues(customCategory, submittedValues, world, timestamp);
    return {
      itemType: "customCategory",
      operation,
      customCategory,
      entity,
    };
  }

  if (category.itemKind === "eventDraft") {
    return {
      itemType: "eventDraft",
      operation,
      eventDraft: createWorldbuildingEventDraftFromValues(
        category,
        submittedValues,
        world,
        timestamp,
        editingItem?.record ?? null,
      ),
    };
  }

  return {
    itemType: "entity",
    operation,
    entity: createWorldbuildingEntityFromValues(
      category,
      submittedValues,
      world,
      timestamp,
      editingItem?.record ?? null,
    ),
  };
}

// Intent: apply pure worldbuilding mutations so the shell only handles persistence and repainting.
export function applyWorldbuildingItemToWorld(world = {}, item = {}) {
  const nextWorld = clonePlainObject(world);
  const customCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  const entities = normalizeWorldbuildingEntities(nextWorld.entities, customCategories);
  const eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);

  if (item?.customCategory) {
    const exists = customCategories.some((category) => category.id === item.customCategory.id);
    nextWorld.worldbuildingCategories = exists
      ? customCategories.map((category) => category.id === item.customCategory.id ? item.customCategory : category)
      : [...customCategories, item.customCategory];
  } else {
    nextWorld.worldbuildingCategories = customCategories;
  }

  if (item?.entity) {
    const previousEntity = entities.find((entity) => entity.id === item.entity.id) ?? null;
    nextWorld.entities = [...entities.filter((entity) => entity.id !== item.entity.id), item.entity];
    nextWorld.spines = updateWorldbuildingEntityNameInStoredSpines(nextWorld.spines, previousEntity, item.entity);
  } else {
    nextWorld.entities = entities;
  }

  if (item?.eventDraft) {
    nextWorld.eventDrafts = [...eventDrafts.filter((draft) => draft.id !== item.eventDraft.id), item.eventDraft];
  } else {
    nextWorld.eventDrafts = eventDrafts;
  }

  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
  return nextWorld;
}

// Intent: persist which catalogue classes behave as main timeline rows or child locations.
export function applyWorldbuildingCategoryLocationRoleToWorld(world = {}, {
  categoryId = "",
  locationRole = "",
  now = new Date(),
} = {}) {
  const normalizedCategoryId = slugify(categoryId);
  const normalizedRole = normalizeWorldbuildingCategoryLocationRole(locationRole);
  const nextWorld = clonePlainObject(world);
  const currentTheme = normalizeWorldbuildingLocationThemeSettings(nextWorld);
  const coreLocationCategories = normalizeStringList(currentTheme.coreLocationCategories);
  const childLocationCategories = normalizeStringList(currentTheme.sublocationCategories);

  if (!normalizedCategoryId) {
    return {
      world: nextWorld,
      changed: false,
      reason: "category-required",
      locationTheme: currentTheme,
    };
  }

  const nextCoreCategories = normalizedRole === "main-location"
    ? uniqueStrings([...coreLocationCategories, normalizedCategoryId])
    : coreLocationCategories.filter((item) => item !== normalizedCategoryId);
  const nextChildCategories = normalizedRole === "child-location"
    ? uniqueStrings([...childLocationCategories, normalizedCategoryId])
    : childLocationCategories.filter((item) => item !== normalizedCategoryId);
  const nextTheme = {
    locationScope: currentTheme.locationScope,
    coreLocationCategories: nextCoreCategories,
    sublocationCategories: nextChildCategories,
  };
  const changed = !currentTheme.hasExplicitSource ||
    currentTheme.locationScope !== nextTheme.locationScope ||
    !stringListsEqual(coreLocationCategories, nextCoreCategories) ||
    !stringListsEqual(childLocationCategories, nextChildCategories);

  nextWorld.locationTheme = nextTheme;
  nextWorld.timelineSettings = {
    ...(nextWorld.timelineSettings && typeof nextWorld.timelineSettings === "object" && !Array.isArray(nextWorld.timelineSettings)
      ? nextWorld.timelineSettings
      : {}),
    locationTheme: nextTheme,
  };
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  if (changed) {
    nextWorld.updatedAt = normalizeDateISOString(now);
  }
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);

  return {
    world: nextWorld,
    changed,
    reason: changed ? "updated" : "unchanged",
    categoryId: normalizedCategoryId,
    locationRole: normalizedRole,
    locationTheme: nextTheme,
  };
}

function normalizeWorldbuildingLocationThemeSettings(world = {}) {
  const source = [
    world?.timelineSettings?.locationTheme,
    world?.locationTheme,
    world?.settings?.locationTheme,
  ].find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) ?? null;
  const coreLocationCategories = normalizeStringList(source?.coreLocationCategories ?? source?.coreCategories);
  const childLocationCategories = normalizeStringList(
    source?.sublocationCategories ??
      source?.childLocationCategories ??
      source?.subLocationCategories,
  );

  return {
    hasExplicitSource: Boolean(source),
    locationScope: normalizeString(source?.locationScope ?? source?.coreLocationScope) || "planetary",
    coreLocationCategories: coreLocationCategories.length
      ? coreLocationCategories.map(slugify).filter(Boolean)
      : [...DEFAULT_CORE_LOCATION_CATEGORIES],
    sublocationCategories: childLocationCategories.length
      ? childLocationCategories.map(slugify).filter(Boolean)
      : [...DEFAULT_CHILD_LOCATION_CATEGORIES],
  };
}

function resolveWorldbuildingCategoryLocationRole(categoryId = "", locationTheme = {}) {
  const normalizedCategoryId = slugify(categoryId);
  if (!normalizedCategoryId) {
    return "";
  }

  const coreCategories = normalizeStringList(locationTheme.coreLocationCategories).map(slugify);
  if (coreCategories.includes(normalizedCategoryId)) {
    return "main-location";
  }

  const childCategories = normalizeStringList(locationTheme.sublocationCategories).map(slugify);
  return childCategories.includes(normalizedCategoryId) ? "child-location" : "";
}

function normalizeWorldbuildingCategoryLocationRole(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  if (["main-location", "main", "core-location", "core", "location-row"].includes(normalized)) {
    return "main-location";
  }
  if (["child-location", "child", "sublocation", "sub-location", "sub"].includes(normalized)) {
    return "child-location";
  }
  return "";
}

function stringListsEqual(left = [], right = []) {
  const leftList = normalizeStringList(left).map(slugify).filter(Boolean);
  const rightList = normalizeStringList(right).map(slugify).filter(Boolean);
  return leftList.length === rightList.length && leftList.every((item, index) => item === rightList[index]);
}

// Intent: attach a project-local reference image to any editable catalogue item.
export function applyWorldbuildingCatalogueItemImageToWorld(world = {}, {
  itemId = "",
  itemKind = "",
  image = null,
  now = new Date(),
} = {}) {
  const normalizedItemId = normalizeString(itemId);
  const normalizedItemKind = normalizeString(itemKind);
  const normalizedImage = normalizeWorldbuildingCatalogueImage(image);
  const nextWorld = clonePlainObject(world);

  if (!normalizedItemId || !isEditableWorldbuildingCatalogueItemKind(normalizedItemKind)) {
    return {
      world: nextWorld,
      changed: false,
      reason: "not-editable",
      item: null,
    };
  }

  if (!normalizedImage) {
    return {
      world: nextWorld,
      changed: false,
      reason: "invalid-image",
      item: null,
    };
  }

  const timestamp = normalizeDateISOString(now);
  const imageRecord = {
    ...normalizedImage,
    attachedAt: timestamp,
  };

  if (normalizedItemKind === "entity") {
    const entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
    const entity = entities.find((candidate) => candidate.id === normalizedItemId) ?? null;
    if (!entity) {
      nextWorld.entities = entities;
      return {
        world: nextWorld,
        changed: false,
        reason: "missing-entity",
        item: null,
      };
    }

    const updatedEntity = {
      ...entity,
      image: imageRecord,
      updatedAt: timestamp,
    };
    nextWorld.entities = entities.map((candidate) => candidate.id === normalizedItemId ? updatedEntity : candidate);
    nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
    nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
    nextWorld.updatedAt = timestamp;
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: true,
      reason: "attached",
      item: {
        id: updatedEntity.id,
        itemKind: "entity",
        title: updatedEntity.name,
      },
      image: imageRecord,
    };
  }

  const eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  const eventDraft = eventDrafts.find((candidate) => candidate.id === normalizedItemId) ?? null;
  if (!eventDraft) {
    nextWorld.eventDrafts = eventDrafts;
    return {
      world: nextWorld,
      changed: false,
      reason: "missing-event-draft",
      item: null,
    };
  }

  const updatedDraft = {
    ...eventDraft,
    image: imageRecord,
    updatedAt: timestamp,
  };
  nextWorld.eventDrafts = eventDrafts.map((candidate) => candidate.id === normalizedItemId ? updatedDraft : candidate);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.updatedAt = timestamp;
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
  return {
    world: nextWorld,
    changed: true,
    reason: "attached",
    item: {
      id: updatedDraft.id,
      itemKind: "eventDraft",
      title: updatedDraft.title,
    },
    image: imageRecord,
  };
}

// Intent: expose location/planet catalogue imagery to the World Spine row renderer without mutating world data.
export function buildWorldSpineLocationImageIndex(world = {}) {
  const entities = normalizeWorldbuildingEntities(world?.entities, world?.worldbuildingCategories);
  const index = new Map();

  entities
    .filter(isWorldSpineLocationImageEntity)
    .forEach((entity) => {
      const image = normalizeWorldbuildingCatalogueImage(entity.image ?? entity.catalogueImage);
      if (!image) {
        return;
      }

      collectWorldSpineLocationImageNames(entity).forEach((locationName) => {
        const key = slugify(locationName);
        if (!key || index.has(key)) {
          return;
        }

        index.set(key, {
          itemId: entity.id,
          itemKind: "entity",
          categoryId: entity.categoryId,
          title: entity.name,
          locationLabel: locationName,
          image,
        });
      });
    });

  return index;
}

// Intent: attach row artwork to a structured Location/Planet entity, creating a Location record when the row is scene-derived only.
export function applyWorldSpineLocationImageToWorld(world = {}, {
  location = "",
  image = null,
  now = new Date(),
} = {}) {
  const normalizedLocation = normalizeString(location);
  const normalizedImage = normalizeWorldbuildingCatalogueImage(image);
  const nextWorld = clonePlainObject(world);
  const customCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  const entities = normalizeWorldbuildingEntities(nextWorld.entities, customCategories);

  if (!normalizedLocation) {
    nextWorld.worldbuildingCategories = customCategories;
    nextWorld.entities = entities;
    nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: false,
      reason: "location-required",
      item: null,
    };
  }

  if (!normalizedImage) {
    nextWorld.worldbuildingCategories = customCategories;
    nextWorld.entities = entities;
    nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: false,
      reason: "invalid-image",
      item: null,
    };
  }

  const timestamp = normalizeDateISOString(now);
  const imageRecord = {
    ...normalizedImage,
    attachedAt: timestamp,
  };
  const existingEntity = findWorldSpineLocationImageEntityForLabel(entities, normalizedLocation);
  const updatedEntity = existingEntity
    ? {
        ...existingEntity,
        image: imageRecord,
        updatedAt: timestamp,
      }
    : createWorldSpineLocationEntityForImage(entities, normalizedLocation, imageRecord, timestamp);

  nextWorld.entities = existingEntity
    ? entities.map((entity) => entity.id === updatedEntity.id ? updatedEntity : entity)
    : [...entities, updatedEntity];
  nextWorld.worldbuildingCategories = customCategories;
  nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  nextWorld.updatedAt = timestamp;
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);

  return {
    world: nextWorld,
    changed: true,
    reason: existingEntity ? "attached" : "created-location",
    item: {
      id: updatedEntity.id,
      itemKind: "entity",
      categoryId: updatedEntity.categoryId,
      title: updatedEntity.name,
    },
    image: imageRecord,
  };
}

export function validateWorldbuildingCatalogueImageFile(candidate = null) {
  if (!candidate || typeof candidate !== "object") {
    return "image-required";
  }

  const mediaType = normalizeWorldbuildingCatalogueImageMediaType(candidate.type ?? candidate.mediaType);
  if (!mediaType) {
    return "image-type";
  }

  const size = Number(candidate.size);
  if (!Number.isFinite(size) || size <= 0) {
    return "image-empty";
  }

  if (size > WORLDBUILDING_CATALOGUE_IMAGE_MAX_BYTES) {
    return "image-too-large";
  }

  return "";
}

// Intent: remove catalogue records and any reviewed timeline-presence mirrors that reference deleted entities.
export function deleteWorldbuildingCatalogueItemFromWorld(world = {}, {
  itemId = "",
  itemKind = "",
  now = new Date(),
} = {}) {
  const normalizedItemId = normalizeString(itemId);
  const normalizedItemKind = normalizeString(itemKind);
  const nextWorld = clonePlainObject(world);

  if (!normalizedItemId || !isEditableWorldbuildingCatalogueItemKind(normalizedItemKind)) {
    return {
      world: nextWorld,
      changed: false,
      reason: "not-editable",
      item: null,
    };
  }

  if (normalizedItemKind === "entity") {
    const entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
    const entity = entities.find((candidate) => candidate.id === normalizedItemId) ?? null;
    if (!entity) {
      nextWorld.entities = entities;
      nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
      return {
        world: nextWorld,
        changed: false,
        reason: "missing-entity",
        item: null,
      };
    }

    nextWorld.entities = entities.filter((candidate) => candidate.id !== normalizedItemId);
    nextWorld.entityLinks = filterWorldbuildingEntityLinksForDeletedEntity(nextWorld.entityLinks, normalizedItemId);
    nextWorld.spines = removeWorldbuildingEntityFromStoredSpines(nextWorld.spines, entity);
    nextWorld.updatedAt = normalizeDateISOString(now);
    nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
    nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: true,
      reason: "deleted",
      item: {
        id: entity.id,
        itemKind: "entity",
        title: entity.name,
      },
    };
  }

  const eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  const eventDraft = eventDrafts.find((candidate) => candidate.id === normalizedItemId) ?? null;
  if (!eventDraft) {
    nextWorld.eventDrafts = eventDrafts;
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: false,
      reason: "missing-event-draft",
      item: null,
    };
  }

  nextWorld.eventDrafts = eventDrafts.filter((candidate) => candidate.id !== normalizedItemId);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.updatedAt = normalizeDateISOString(now);
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
  return {
    world: nextWorld,
    changed: true,
    reason: "deleted",
    item: {
      id: eventDraft.id,
      itemKind: "eventDraft",
      title: eventDraft.title,
    },
  };
}

// Intent: turn a crafted Dream Scaping event into a first-class World Spine node at the requested timeline slot.
export function dropWorldbuildingEventDraftOnWorldSpine(world = {}, draftId = "", { dropIndex = null, spineId = "", locationLabel = "" } = {}) {
  const normalizedDraftId = normalizeString(draftId);
  const requestedSpineId = normalizeString(spineId);
  const nextWorld = clonePlainObject(world);
  const eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  const draft = eventDrafts.find((candidate) => candidate.id === normalizedDraftId);
  if (!draft) {
    return {
      world: nextWorld,
      node: null,
      reason: "missing-draft",
    };
  }

  const spines = normalizeWorldSpines(nextWorld.spines);
  const targetSpine = spines.find((spine) => spine.id === requestedSpineId) ?? spines[0] ?? createDefaultWorldSpine();
  const targetNodes = Array.isArray(targetSpine.nodes) ? targetSpine.nodes.slice() : [];
  const requestedSlotIndex = Number.isInteger(Number(dropIndex))
    ? Math.max(0, Number(dropIndex))
    : targetNodes.length;
  const node = createTimelineNodeFromEventDraft(draft, {
    spineId: targetSpine.id,
    existingNodes: spines.flatMap((spine) => Array.isArray(spine.nodes) ? spine.nodes : []),
    timelineSlotIndex: requestedSlotIndex,
    locationLabel,
  });

  const nextNodes = [...targetNodes, node].sort(compareWorldSpineStorageNodes).map((candidate, index) => ({
    ...candidate,
    order: index + 1,
    timelineOrder: index + 1,
  }));

  const updatedTargetSpine = {
    ...targetSpine,
    nodes: nextNodes,
  };
  nextWorld.spines = spines.length
    ? spines.map((spine) => spine.id === targetSpine.id ? updatedTargetSpine : spine)
    : [updatedTargetSpine];
  nextWorld.eventDrafts = eventDrafts.filter((candidate) => candidate.id !== normalizedDraftId);
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);

  return {
    world: nextWorld,
    node,
    reason: "placed",
  };
}

// Intent: append a structured parallel timeline lane instead of creating a loose UI-only tier.
export function addParallelWorldSpine(world = {}, {
  label = "",
  location = "",
  thread = "",
  purpose = "",
  participants = [],
  startMarker = "",
  notes = "",
  sourceContext = null,
  now = new Date(),
} = {}) {
  const nextWorld = clonePlainObject(world);
  const spines = normalizeWorldSpines(nextWorld.spines);
  const primarySpine = spines[0] ?? createDefaultWorldSpine();
  const createdAt = normalizeDateISOString(now);
  const existingSpines = spines.length ? spines : [primarySpine];
  const details = normalizeParallelWorldSpineDetails({
    location,
    thread: thread || purpose,
    participants,
    startMarker,
    notes,
    sourceContext,
  });
  const spineLabel = normalizeString(label) || (
    details.location ? `${details.location} Timeline` : createParallelWorldSpineLabel(existingSpines)
  );
  const spine = {
    id: createNextWorldbuildingId(existingSpines, "spine"),
    key: createUniqueSlugId(spineLabel, existingSpines.map((candidate) => candidate.key)),
    label: spineLabel,
    kind: "custom",
    description: createParallelWorldSpineDescription(details),
    location: details.location,
    localityLabel: details.location,
    thread: details.thread,
    participants: details.participants,
    startMarker: details.startMarker,
    notes: details.notes,
    metadata: details,
    nodes: [],
    nodeIds: [],
    createdAt,
  };
  nextWorld.spines = [...existingSpines, spine];
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
  return {
    world: nextWorld,
    spine,
    created: true,
  };
}

// Intent: name an existing rendered location row without creating another timeline lane.
export function applyWorldSpineLocationRowNameToWorld(world = {}, {
  spineId = "",
  worldNodeIds = [],
  location = "",
  now = new Date(),
} = {}) {
  const normalizedLocation = normalizeString(location);
  const requestedSpineId = normalizeString(spineId) || "spine-0001";
  const targetWorldNodeIds = new Set(normalizeStringList(worldNodeIds));
  const nextWorld = clonePlainObject(world);
  const storedSpines = normalizeWorldSpines(nextWorld.spines);
  const spines = storedSpines.length ? storedSpines : [createDefaultWorldSpine()];

  if (!normalizedLocation) {
    nextWorld.spines = spines;
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      changed: false,
      reason: "location-required",
    };
  }

  let foundSpine = false;
  let changed = false;
  const nextSpines = spines.map((spine) => {
    if (spine.id !== requestedSpineId) {
      return spine;
    }

    foundSpine = true;
    if (targetWorldNodeIds.size) {
      const nodes = Array.isArray(spine.nodes) ? spine.nodes : [];
      const nextNodes = nodes.map((node) => {
        if (!targetWorldNodeIds.has(normalizeString(node?.id))) {
          return node;
        }

        const nextNode = applyWorldSpineLocationToNode(node, normalizedLocation);
        changed = changed || nextNode !== node;
        return nextNode;
      });
      return changed ? { ...spine, nodes: nextNodes } : spine;
    }

    const nextSpine = applyWorldSpineLocationToSpine(spine, normalizedLocation);
    changed = changed || nextSpine !== spine;
    return nextSpine;
  });

  nextWorld.spines = nextSpines;
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  if (changed) {
    nextWorld.updatedAt = normalizeDateISOString(now);
  }
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);

  return {
    world: nextWorld,
    changed,
    reason: foundSpine ? (changed ? "renamed" : "unchanged") : "missing-spine",
  };
}

// Intent: unplace only the rendered row identity while retaining world-event chronology, anchors, and setting detail.
export function applyWorldSpineLocationRowUnplacementToWorld(world = {}, {
  spineId = "",
  worldNodeIds = [],
  now = new Date(),
} = {}) {
  const requestedSpineId = normalizeString(spineId) || "spine-0001";
  const targetWorldNodeIds = new Set(normalizeStringList(worldNodeIds));
  const nextWorld = clonePlainObject(world);
  const storedSpines = normalizeWorldSpines(nextWorld.spines);
  const spines = storedSpines.length ? storedSpines : [createDefaultWorldSpine()];
  let foundSpine = false;
  let changed = false;

  const nextSpines = spines.map((spine) => {
    if (spine.id !== requestedSpineId) {
      return spine;
    }

    foundSpine = true;
    const nodes = Array.isArray(spine.nodes) ? spine.nodes : [];
    const nextNodes = nodes.map((node) => {
      if (!targetWorldNodeIds.has(normalizeString(node?.id))) {
        return node;
      }

      const nextNode = applyWorldSpineUnplacementToNode(node);
      changed = changed || nextNode !== node;
      return nextNode;
    });
    return changed ? { ...spine, nodes: nextNodes } : spine;
  });

  nextWorld.spines = nextSpines;
  nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
  nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
  nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
  if (changed) {
    nextWorld.updatedAt = normalizeDateISOString(now);
  }
  nextWorld.stats = recalculateWorldbuildingStats(nextWorld);

  return {
    world: nextWorld,
    changed,
    reason: !foundSpine ? "missing-spine" : !targetWorldNodeIds.size ? "node-ids-required" : changed ? "unplaced" : "unchanged",
  };
}

function applyWorldSpineLocationToSpine(spine = {}, location = "") {
  const metadata = spine?.metadata && typeof spine.metadata === "object" && !Array.isArray(spine.metadata)
    ? spine.metadata
    : {};
  if (
    normalizeString(spine.location) === location &&
    normalizeString(spine.localityLabel) === location &&
    normalizeString(metadata.location) === location
  ) {
    return spine;
  }

  return {
    ...spine,
    location,
    localityLabel: location,
    metadata: {
      ...metadata,
      location,
    },
  };
}

function applyWorldSpineLocationToNode(node = {}, location = "") {
  const metadata = node?.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
    ? node.metadata
    : {};
  const locationKey = slugify(location);
  if (
    normalizeString(node.location) === location &&
    normalizeString(node.locationRowLabel) === location &&
    normalizeString(node.locationRowKey) === locationKey &&
    normalizeString(metadata.location) === location &&
    normalizeString(metadata.locationRowLabel) === location &&
    normalizeString(metadata.locationRowKey) === locationKey
  ) {
    return node;
  }

  return {
    ...node,
    location,
    locationRowLabel: location,
    locationRowKey: locationKey,
    locationScope: normalizeString(node.locationScope) || "planetary",
    metadata: {
      ...metadata,
      location,
      locationRowLabel: location,
      locationRowKey: locationKey,
      locationScope: normalizeString(metadata.locationScope) || normalizeString(node.locationScope) || "planetary",
    },
  };
}

function applyWorldSpineUnplacementToNode(node = {}) {
  const locationRowLabel = "Unplaced location";
  const locationRowKey = slugify(locationRowLabel);
  const metadata = node?.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)
    ? node.metadata
    : {};
  const locationPlacement = node?.locationPlacement && typeof node.locationPlacement === "object" && !Array.isArray(node.locationPlacement)
    ? node.locationPlacement
    : null;
  const locationScope = normalizeString(
    node.locationScope ?? locationPlacement?.locationScope ?? metadata.locationScope,
  ) || "planetary";
  if (
    normalizeString(node.locationRowLabel) === locationRowLabel &&
    normalizeString(node.locationRowKey) === locationRowKey &&
    normalizeString(metadata.locationRowLabel) === locationRowLabel &&
    normalizeString(metadata.locationRowKey) === locationRowKey &&
    (!locationPlacement || (
      normalizeString(locationPlacement.locationRowLabel) === locationRowLabel &&
      normalizeString(locationPlacement.locationRowKey) === locationRowKey
    ))
  ) {
    return node;
  }

  return {
    ...node,
    locationRowLabel,
    locationRowKey,
    locationScope,
    ...(locationPlacement
      ? {
          locationPlacement: {
            ...locationPlacement,
            locationRowLabel,
            locationRowKey,
            locationScope,
          },
        }
      : {}),
    metadata: {
      ...metadata,
      locationRowLabel,
      locationRowKey,
      locationScope,
    },
  };
}

function normalizeParallelWorldSpineDetails({
  location = "",
  thread = "",
  participants = [],
  startMarker = "",
  notes = "",
  sourceContext = null,
} = {}) {
  const normalizedLocation = normalizeString(location);
  const normalizedThread = normalizeString(thread);
  const normalizedParticipants = normalizeStringList(participants);
  const normalizedStartMarker = normalizeString(startMarker);
  const normalizedNotes = normalizeString(notes);
  const normalizedSourceContext = sourceContext && typeof sourceContext === "object"
    ? {
        spineId: normalizeString(sourceContext.spineId),
        spineLabel: normalizeString(sourceContext.spineLabel),
        dropIndex: Number.isFinite(Number(sourceContext.dropIndex)) ? Number(sourceContext.dropIndex) : 0,
        locationLabel: normalizeString(sourceContext.locationLabel),
        locationKey: normalizeString(sourceContext.locationKey),
      }
    : null;

  return {
    location: normalizedLocation,
    thread: normalizedThread,
    participants: normalizedParticipants,
    startMarker: normalizedStartMarker,
    notes: normalizedNotes,
    sourceContext: normalizedSourceContext,
  };
}

function createParallelWorldSpineDescription(details = {}) {
  const location = normalizeString(details.location);
  const thread = normalizeString(details.thread);
  if (location && thread) {
    return `Tracks ${thread} at ${location}.`;
  }
  if (location) {
    return `Parallel timeline lane for ${location}.`;
  }
  return "Parallel location or world timeline lane.";
}

// Intent: keep the older dual-timeline contract available while newer UI paths add unlimited parallels.
export function ensureDualWorldSpine(world = {}, {
  label = "Parallel Timeline",
  now = new Date(),
} = {}) {
  const nextWorld = clonePlainObject(world);
  const spines = normalizeWorldSpines(nextWorld.spines);
  if (spines.length > 1) {
    nextWorld.spines = spines;
    nextWorld.worldbuildingCategories = normalizeCustomWorldbuildingCategories(nextWorld.worldbuildingCategories);
    nextWorld.entities = normalizeWorldbuildingEntities(nextWorld.entities, nextWorld.worldbuildingCategories);
    nextWorld.eventDrafts = normalizeWorldbuildingEventDrafts(nextWorld.eventDrafts ?? nextWorld.timelineEventDrafts);
    nextWorld.stats = recalculateWorldbuildingStats(nextWorld);
    return {
      world: nextWorld,
      spine: spines[1],
      created: false,
    };
  }

  return addParallelWorldSpine(world, { label, now });
}

function renderWorldbuildingCategoryButton(category, activeCategoryId, categoryCount = 0, isFormOpen = false, catalogueScope = null) {
  const isActive = isFormOpen && category.id === activeCategoryId;
  const label = `View ${category.label} catalogue`;
  const safeCount = Math.max(0, Math.round(Number(categoryCount) || 0));
  const countLabel = formatCatalogueCountLabel(safeCount);
  const scopeLabel = normalizeString(catalogueScope?.label);
  const countScope = scopeLabel ? ` for ${scopeLabel}` : "";
  const addHint = `Right-click to add ${category.label}.`;
  return `
    <button
      type="button"
      class="worldbuilding-category-button ${isActive ? "is-active" : ""}"
      data-action="open-worldbuilding-catalogue"
      data-worldbuilding-category-id="${escapeHtml(category.id)}"
      data-worldbuilding-category-count="${escapeHtml(safeCount)}"
      aria-pressed="${isActive ? "true" : "false"}"
      aria-label="${escapeHtml(`${label}; ${countLabel}${countScope}. ${addHint}`)}"
      title="${escapeHtml(`${label}; ${countLabel}${countScope}. ${addHint} ${category.description}`)}"
    >
      <span class="worldbuilding-category-button__icon" aria-hidden="true">${renderWorldbuildingCategoryIcon(category.id)}</span>
      <span class="worldbuilding-category-button__count" aria-hidden="true">${escapeHtml(safeCount)}</span>
    </button>
  `;
}

// Intent: expose custom catalogue creation as a visible RHS action instead of relying on the category context menu.
function renderWorldbuildingCustomCreateAction() {
  return `
    <div class="worldbuilding-studio__rhs-actions" aria-label="Worldbuilding catalogue actions">
      <button
        type="button"
        class="worldbuilding-custom-create-button"
        data-action="open-worldbuilding-custom-catalogue-item"
        aria-label="Add custom catalogue item"
        title="Add custom catalogue item"
      >
        <span class="worldbuilding-category-button__icon" aria-hidden="true">${renderWorldbuildingCategoryIcon("custom")}</span>
      </button>
    </div>
  `;
}

function renderWorldbuildingCategoryIcon(categoryId) {
  const iconBodyByCategory = {
    planet: '<circle cx="12" cy="12" r="5.2"/><path d="M3.5 13.8c4.6-3 12.4-4 17-2.1"/>',
    location: '<path d="M12 21s5.2-5.4 5.2-10a5.2 5.2 0 0 0-10.4 0c0 4.6 5.2 10 5.2 10z"/><circle cx="12" cy="11" r="1.8"/>',
    character: '<circle cx="12" cy="8.2" r="3"/><path d="M6.8 19c.9-3 2.8-4.6 5.2-4.6S16.3 16 17.2 19"/>',
    faction: '<path d="M5 19V7l7-3 7 3v12"/><path d="M8 10h8M8 14h8"/>',
    culture: '<path d="M6 16c2-5 10-5 12 0"/><path d="M8 9h8M10 6h4M12 6v12"/>',
    flora: '<path d="M12 20V9"/><path d="M12 13c-4.4-.4-6.2-3-6.6-6.2 3.6.1 5.8 1.8 6.6 5.2"/><path d="M12 14c3.7-.2 5.8-2.1 6.4-5.5-3.3 0-5.3 1.6-6.4 4.5"/>',
    fauna: '<circle cx="8" cy="9" r="1.4"/><circle cx="12" cy="7" r="1.4"/><circle cx="16" cy="9" r="1.4"/><path d="M7.4 17.4c1.2-3 2.8-4.5 4.6-4.5s3.4 1.5 4.6 4.5c-2 1.2-7.2 1.2-9.2 0z"/>',
    event: '<path d="M7 5h8.5l2 2v12H7z"/><path d="M10 10h5M10 14h4"/>',
    "critical-event": '<path d="M12 4v8"/><path d="M7 8l5 4 5-4"/><path d="M6.5 19h11"/>',
    weapon: '<path d="M5 19 18.5 5.5"/><path d="m15.8 5.2 3 3"/><path d="M6.5 15.5l2 2"/>',
    outfit: '<path d="M8 6 5 8.5 7 12v7h10v-7l2-3.5L16 6l-2 2h-4z"/>',
    technology: '<circle cx="7" cy="12" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 11.2 15.2 8M9 12.8 15.2 16"/>',
    vehicle: '<path d="M4.5 14.5h12l3-3-3-3h-12z"/><path d="M7 17h7M7 9V6h6v3"/>',
    artifact: '<path d="M12 4 18 9v7l-6 4-6-4V9z"/><path d="M9 12h6M12 9v6"/>',
    custom: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="7"/>',
  };
  const iconBody = iconBodyByCategory[categoryId] || iconBodyByCategory.custom;
  return `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${iconBody}</g>
    </svg>
  `;
}

function renderWorldbuildingForm(category, pickerOptionSets = {}, { editingItem = null } = {}) {
  const editValues = buildWorldbuildingEditFormValues(category, editingItem);
  const fields = getWorldbuildingCategoryFormFields(category)
    .map((field) => applyWorldbuildingEditValueToField(field, editValues));
  const pickerDatalists = buildWorldbuildingPickerDatalistModels(category.id, fields, pickerOptionSets, editValues);
  const isEditing = Boolean(editingItem?.record);
  const submitLabel = isEditing
    ? "Save changes"
    : category.itemKind === "eventDraft"
      ? "Create draft"
      : category.id === "custom"
        ? "Create custom"
        : "Add item";
  const editAttributes = isEditing
    ? ` data-worldbuilding-edit-item-id="${escapeHtml(editingItem.itemId)}" data-worldbuilding-edit-item-kind="${escapeHtml(editingItem.itemKind)}"`
    : "";
  return `
    <form class="worldbuilding-form has-form-dismiss" data-worldbuilding-studio-form data-worldbuilding-category-id="${escapeHtml(category.id)}"${editAttributes}>
      <button
        type="button"
        class="form-dismiss-button worldbuilding-form__dismiss"
        data-action="cancel-worldbuilding-item"
        aria-label="Cancel ${escapeHtml(category.label)} form"
        title="Cancel"
      >&times;</button>
      <div class="worldbuilding-panel-heading">
        <span>${escapeHtml(category.label)}</span>
        <strong>${escapeHtml(isEditing ? editingItem.title : category.templateName)}</strong>
      </div>
      <div class="worldbuilding-form__grid">
        ${fields.map((field) => renderWorldbuildingField(field, {
          pickerListId: getWorldbuildingPickerListIdForField(category.id, field, pickerOptionSets, editValues),
        })).join("")}
      </div>
      ${renderWorldbuildingPickerDatalists(pickerDatalists)}
      <div class="worldbuilding-form__actions">
        <button type="button" class="tag-button panel-action-button" data-action="save-worldbuilding-item">
          ${escapeHtml(submitLabel)}
        </button>
      </div>
    </form>
  `;
}

// Intent: make fixed child-location placement available to every persisted catalogue item class.
function getWorldbuildingCategoryFormFields(category = {}) {
  const fields = Array.isArray(category?.fields)
    ? category.fields.map(cloneWorldbuildingFieldDefinition)
    : [];
  if (normalizeString(category?.itemKind) !== "entity") {
    return fields;
  }

  const existingFieldIds = new Set(fields.map((field) => normalizeString(field?.id)).filter(Boolean));
  const addedFields = STANDARD_ENTITY_LOCATION_FIELDS
    .filter((field) => !existingFieldIds.has(normalizeString(field.id)))
    .map(cloneWorldbuildingFieldDefinition);
  return [...fields, ...addedFields];
}

function cloneWorldbuildingFieldDefinition(field = {}) {
  return {
    ...field,
    values: Array.isArray(field.values) ? field.values.slice() : field.values,
  };
}

function buildWorldbuildingEditFormValues(category, editingItem = null) {
  const record = editingItem?.record && typeof editingItem.record === "object" ? editingItem.record : null;
  if (!record) {
    return {};
  }

  if (editingItem.itemKind === "eventDraft") {
    const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    return {
      title: record.title,
      summary: record.summary,
      location: record.location ?? metadata.location,
      date: record.date ?? metadata.date,
      time: record.time ?? metadata.time,
      charactersPresent: formatWorldbuildingFormListValue(record.charactersPresent ?? record.people ?? metadata.charactersPresent ?? metadata.people),
      newCharacters: formatWorldbuildingFormListValue(record.newCharacters ?? metadata.newCharacters),
      responsibleParty: formatWorldbuildingFormListValue(record.responsibleParty ?? metadata.responsibleParty),
      witnesses: formatWorldbuildingFormListValue(record.witnesses ?? metadata.witnesses),
      affectedFactions: formatWorldbuildingFormListValue(record.affectedFactions ?? metadata.affectedFactions),
      linkedLocation: formatWorldbuildingFormListValue(record.linkedLocations ?? metadata.linkedLocations ?? metadata.linkedLocation),
      criticalEvents: formatWorldbuildingFormListValue(record.criticalEvents ?? metadata.criticalEvents),
      deaths: formatWorldbuildingFormListValue(record.deaths ?? metadata.deaths),
      linkedItems: formatWorldbuildingFormListValue(record.linkedEntityNames ?? metadata.linkedItems),
      consequence: metadata.consequence,
      reversibility: metadata.reversibility,
    };
  }

  const fieldValues = {};
  (Array.isArray(record.fields) ? record.fields : []).forEach((field) => {
    const key = normalizeString(field?.key ?? field?.id);
    if (key) {
      fieldValues[key] = normalizeString(field?.value);
    }
  });

  return {
    ...fieldValues,
    name: record.name,
    notes: record.notes,
    description: record.notes,
    categoryId: normalizeString(category?.id),
  };
}

function applyWorldbuildingEditValueToField(field = {}, values = {}) {
  const fieldId = normalizeString(field.id);
  if (!fieldId || !Object.prototype.hasOwnProperty.call(values, fieldId)) {
    return field;
  }

  return {
    ...field,
    value: normalizeString(values[fieldId]),
  };
}

function formatWorldbuildingFormListValue(value) {
  return normalizeStringList(value).join(", ");
}

function renderWorldbuildingField(field, { pickerListId = "" } = {}) {
  if (field.input === "field-list") {
    return renderWorldbuildingFieldList(field);
  }

  const Tag = field.input === "textarea" ? "textarea" : "input";
  const typeAttribute = field.input === "textarea" ? "" : ` type="${escapeHtml(field.input || "text")}"`;
  const valueAttribute = field.input === "textarea" ? "" : ` value="${escapeHtml(field.value || "")}"`;
  const listAttribute = Tag === "input" && pickerListId
    ? ` list="${escapeHtml(pickerListId)}" autocomplete="off"`
    : "";
  return `
    <label class="worldbuilding-field ${field.input === "textarea" ? "is-wide" : ""} ${listAttribute ? "has-character-picker" : ""}">
      <span>${escapeHtml(field.label)}</span>
      <${Tag}${typeAttribute}
        data-worldbuilding-field="${escapeHtml(field.id)}"
        placeholder="${escapeHtml(field.placeholder)}"
        ${field.required ? "required" : ""}
        ${listAttribute}
      ${field.input === "textarea" ? `>${escapeHtml(field.value || "")}</textarea>` : `${valueAttribute}>`}
    </label>
  `;
}

function renderWorldbuildingPickerDatalists(datalistModels = []) {
  return (Array.isArray(datalistModels) ? datalistModels : [])
    .map((model) => renderWorldbuildingPickerDatalist(model.listId, model.options, {
      pickerType: model.pickerType,
      renderEmpty: model.renderEmpty,
    }))
    .join("");
}

function renderWorldbuildingPickerDatalist(listId, options = [], {
  pickerType = "",
  renderEmpty = false,
} = {}) {
  const normalizedOptions = uniqueStrings((Array.isArray(options) ? options : []).map(normalizeString).filter(Boolean));
  if (!listId || (!normalizedOptions.length && !renderEmpty)) {
    return "";
  }

  return `
    <datalist id="${escapeHtml(listId)}" data-worldbuilding-picker-options data-worldbuilding-picker-type="${escapeHtml(pickerType)}">
      ${normalizedOptions.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}
    </datalist>
  `;
}

function getWorldbuildingPickerListIdForField(categoryId = "", field = {}, pickerOptionSets = {}, values = {}) {
  const pickerType = resolveWorldSpinePickerTypeForField(field, pickerOptionSets);
  return pickerType && (
    getWorldSpinePickerOptionsForField(field, pickerOptionSets, { values }).length ||
    isWorldbuildingDynamicScopedPickerType(pickerType)
  )
    ? createWorldbuildingPickerListId(categoryId, pickerType)
    : "";
}

function buildWorldbuildingPickerDatalistModels(categoryId = "", fields = [], pickerOptionSets = {}, values = {}) {
  const modelsByListId = new Map();
  for (const field of Array.isArray(fields) ? fields : []) {
    const pickerType = resolveWorldSpinePickerTypeForField(field, pickerOptionSets);
    if (!pickerType) {
      continue;
    }

    const options = getWorldSpinePickerOptionsForField(field, pickerOptionSets, { values });
    const renderEmpty = isWorldbuildingDynamicScopedPickerType(pickerType);
    if (!options.length && !renderEmpty) {
      continue;
    }

    const listId = createWorldbuildingPickerListId(categoryId, pickerType);
    modelsByListId.set(listId, {
      listId,
      pickerType,
      renderEmpty,
      options,
    });
  }
  return [...modelsByListId.values()];
}

function isWorldbuildingDynamicScopedPickerType(pickerType = "") {
  return ["childLocation", "fixedChildLocation", "place"].includes(normalizeString(pickerType));
}

function createWorldbuildingPickerListId(categoryId = "", pickerType = "") {
  const normalizedType = slugify(pickerType) || "catalogue";
  const normalizedCategory = slugify(categoryId) || "category";
  return normalizedType === "character"
    ? `worldbuilding-character-options-${normalizedCategory}`
    : `worldbuilding-${normalizedType}-options-${normalizedCategory}`;
}

function renderWorldbuildingFieldList(field) {
  const values = getWorldbuildingFieldListValues(field);
  return `
    <fieldset class="worldbuilding-field-list is-wide" data-worldbuilding-field-list-group="${escapeHtml(field.id)}">
      <legend>${escapeHtml(field.label)}</legend>
      <div class="worldbuilding-field-list__rows" data-worldbuilding-field-list-rows>
        ${values.map((value, index) => renderWorldbuildingFieldListRow(field, value, index)).join("")}
      </div>
      <button
        type="button"
        class="tag-button panel-action-button worldbuilding-field-list__add"
        data-action="add-worldbuilding-custom-field"
      >
        Add field
      </button>
    </fieldset>
  `;
}

function renderWorldbuildingFieldListRow(field, value = "", index = 0) {
  return `
    <label class="worldbuilding-field worldbuilding-field-list__row">
      <span>${escapeHtml(`Field ${index + 1}`)}</span>
      <input
        type="text"
        data-worldbuilding-field-list="${escapeHtml(field.id)}"
        placeholder="${escapeHtml(field.placeholder)}"
        value="${escapeHtml(value)}"
      >
    </label>
  `;
}

function getWorldbuildingFieldListValues(field) {
  const values = Array.isArray(field.values)
    ? field.values.map(normalizeString).filter(Boolean)
    : normalizeStringList(field.value);
  return values.length ? values : [""];
}

function renderWorldbuildingDraftTray(eventDrafts = []) {
  if (!eventDrafts.length) {
    return "";
  }

  return `
    <div class="worldbuilding-event-drafts" aria-label="Crafted timeline events" data-worldbuilding-draft-tray>
      ${eventDrafts.map(renderWorldbuildingEventDraft).join("")}
    </div>
  `;
}

function renderWorldbuildingEventDraft(draft) {
  return `
    <article
      class="worldbuilding-event-draft"
      data-worldbuilding-event-draft-id="${escapeHtml(draft.id)}"
      draggable="true"
      tabindex="0"
      aria-label="${escapeHtml(`Drag ${draft.title} onto the World Spine`)}"
      title="${escapeHtml(`Drag ${draft.title || "event draft"} onto the World Spine`)}"
    >
      <span aria-hidden="true">${renderWorldbuildingCategoryIcon(draft.categoryId || "event")}</span>
      <strong>${escapeHtml(draft.title || "Untitled event")}</strong>
    </article>
  `;
}

function createWorldbuildingEventDraftFromValues(category, values, world, createdAt, existingDraft = null) {
  const title = normalizeString(values.title) || normalizeString(values.name) || `${category.label} ${nextSequenceNumber(world?.eventDrafts, "world-event-draft")}`;
  const location = normalizeString(values.location);
  const sublocation = normalizeString(values.childLocation ?? values.childLocationLabel ?? values.sublocation ?? values.subLocation);
  const orbitalBand = normalizeString(values.orbitalBand);
  const date = normalizeString(values.date);
  const time = normalizeString(values.time);
  const people = normalizeStringList(values.charactersPresent);
  const newCharacters = normalizeStringList(values.newCharacters);
  const deaths = normalizeStringList(values.deaths);
  const responsibleParty = normalizeStringList(values.responsibleParty);
  const witnesses = normalizeStringList(values.witnesses);
  const affectedFactions = normalizeStringList(values.affectedFactions);
  const linkedLocations = normalizeStringList(values.linkedLocation);
  const criticalEvents = normalizeStringList([
    values.criticalEvents,
    category.id === "critical-event" ? title : "",
    values.consequence,
  ]);
  const linkedEntityNames = uniqueStrings([
    ...normalizeStringList(values.linkedItems),
    ...responsibleParty,
    ...witnesses,
    ...affectedFactions,
    ...linkedLocations,
  ]);
  const existingMetadata = existingDraft?.metadata && typeof existingDraft.metadata === "object"
    ? existingDraft.metadata
    : {};
  const isUpdate = Boolean(existingDraft?.id);
  return {
    ...(existingDraft && typeof existingDraft === "object" ? existingDraft : {}),
    id: normalizeString(existingDraft?.id) || createNextWorldbuildingId(world?.eventDrafts, "world-event-draft"),
    categoryId: category.id,
    categoryLabel: category.label,
    title,
    summary: normalizeString(values.summary) || normalizeString(values.notes),
    location,
    childLocation: sublocation,
    childLocationLabel: sublocation,
    sublocation,
    orbitalBand,
    date,
    time,
    people,
    charactersPresent: people,
    newCharacters,
    responsibleParty,
    witnesses,
    affectedFactions,
    linkedLocations,
    criticalEvents,
    deaths,
    linkedEntityNames,
    metadata: {
      ...existingMetadata,
      location,
      childLocation: sublocation,
      childLocationLabel: sublocation,
      sublocation,
      orbitalBand,
      date,
      time,
      people,
      charactersPresent: people,
      newCharacters,
      responsibleParty,
      witnesses,
      affectedFactions,
      linkedLocations,
      criticalEvents,
      deaths,
      consequence: normalizeString(values.consequence),
      reversibility: normalizeString(values.reversibility),
      linkedItems: linkedEntityNames,
    },
    createdAt: normalizeString(existingDraft?.createdAt) || createdAt,
    ...(isUpdate ? { updatedAt: createdAt } : {}),
  };
}

function createWorldbuildingEntityFromValues(category, values, world, createdAt, existingEntity = null) {
  const fieldDefinitions = getWorldbuildingCategoryFormFields(category)
    .filter((field) => !["name", "notes", "customCategoryName", "customFieldLabels"].includes(field.id));
  const editableFieldIds = new Set(fieldDefinitions.map((field) => normalizeString(field.id)).filter(Boolean));
  const preservedFields = (Array.isArray(existingEntity?.fields) ? existingEntity.fields : [])
    .map((field) => ({
      key: normalizeString(field?.key ?? field?.id),
      label: normalizeString(field?.label ?? field?.name ?? field?.key),
      value: normalizeString(field?.value),
    }))
    .filter((field) => field.key && field.label && field.value && !editableFieldIds.has(field.key));
  const name = normalizeString(values.name) || `${category.label} ${nextSequenceNumber(world?.entities, "entity")}`;
  const notes = normalizeString(values.notes) || normalizeString(values.description);
  const isUpdate = Boolean(existingEntity?.id);
  return {
    ...(existingEntity && typeof existingEntity === "object" ? existingEntity : {}),
    id: normalizeString(existingEntity?.id) || createNextWorldbuildingId(world?.entities, "entity"),
    name,
    templateName: category.templateName || category.label,
    categoryId: category.id,
    categoryLabel: category.label,
    notes,
    fields: [
      ...fieldDefinitions
      .map((field) => ({
        key: field.id,
        label: field.label,
        value: normalizeString(values[field.id]),
      }))
      .filter((field) => field.value),
      ...preservedFields,
    ],
    createdAt: normalizeString(existingEntity?.createdAt) || createdAt,
    ...(isUpdate ? { updatedAt: createdAt } : {}),
  };
}

function createCustomCategoryFromValues(values, world) {
  const label = normalizeString(values.customCategoryName) || "Custom Item";
  const id = createUniqueSlugId(label, [
    ...WORLD_SPINE_CATEGORY_DEFINITIONS.map((category) => category.id),
    ...normalizeCustomWorldbuildingCategories(world?.worldbuildingCategories).map((category) => category.id),
  ]);
  const fieldLabels = normalizeStringList(values.customFieldLabels).slice(0, 8);
  return {
    id,
    label,
    code: createCategoryCode(label),
    groupId: "custom",
    itemKind: "entity",
    templateName: label,
    description: `Custom ${label} lore category.`,
    isCustomCategory: true,
    fields: [
      textField("name", "Name"),
      ...fieldLabels.map((fieldLabel) => textField(slugify(fieldLabel), fieldLabel)),
      textAreaField("notes", "Notes"),
    ],
  };
}

function createTimelineNodeFromEventDraft(draft, { spineId = "", existingNodes = [], timelineSlotIndex = null, locationLabel = "" } = {}) {
  const nodeId = createNextWorldbuildingId(existingNodes, "node");
  const metadata = draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {};
  const normalizedTimelineSlotIndex = Number.isFinite(Number(timelineSlotIndex)) ? Number(timelineSlotIndex) : null;
  const droppedLocation = normalizeWorldSpinePlacementLocationLabel(locationLabel);
  const location = droppedLocation || normalizeString(draft.location) || normalizeString(metadata.location);
  const sublocation = normalizeString(draft.childLocation ?? draft.childLocationLabel ?? draft.sublocation ?? draft.subLocation ?? metadata.childLocation ?? metadata.childLocationLabel ?? metadata.sublocation ?? metadata.subLocation);
  const orbitalBand = normalizeString(draft.orbitalBand ?? metadata.orbitalBand);
  const locationPlacement = createWorldbuildingTimelineNodeLocationPlacement({
    location,
    sublocation,
    orbitalBand,
  });
  return {
    id: nodeId,
    spineId,
    label: normalizeString(draft.title) || "World event",
    summary: normalizeString(draft.summary),
    nodeKind: "event",
    categoryId: normalizeString(draft.categoryId) || "event",
    ...(normalizedTimelineSlotIndex !== null ? {
      timelineSlotIndex: normalizedTimelineSlotIndex,
      sequenceRank: normalizedTimelineSlotIndex - 0.5,
    } : {}),
    location,
    locationLabel: location,
    locationKey: slugify(location),
    locationRowLabel: location,
    locationRowKey: slugify(location),
    locationScope: "planetary",
    eventLocationLabel: location,
    eventLocationKey: slugify(location),
    coreLocationLabel: location,
    coreLocationKey: slugify(location),
    sublocation,
    childLocation: sublocation,
    childLocationLabel: sublocation,
    childLocationKey: slugify(sublocation),
    sublocationLabel: sublocation,
    sublocationKey: slugify(sublocation),
    orbitalBand,
    locationPlacement,
    date: normalizeString(draft.date) || normalizeString(metadata.date),
    time: normalizeString(draft.time) || normalizeString(metadata.time),
    people: normalizeStringList(draft.people ?? draft.charactersPresent ?? metadata.people ?? metadata.charactersPresent),
    charactersPresent: normalizeStringList(draft.charactersPresent ?? draft.people ?? metadata.charactersPresent ?? metadata.people),
    newCharacters: normalizeStringList(draft.newCharacters ?? metadata.newCharacters),
    responsibleParty: normalizeStringList(draft.responsibleParty ?? metadata.responsibleParty),
    witnesses: normalizeStringList(draft.witnesses ?? metadata.witnesses),
    affectedFactions: normalizeStringList(draft.affectedFactions ?? metadata.affectedFactions),
    linkedLocations: normalizeStringList(draft.linkedLocations ?? draft.linkedLocation ?? metadata.linkedLocations ?? metadata.linkedLocation),
    criticalEvents: normalizeStringList(draft.criticalEvents ?? metadata.criticalEvents),
    deaths: normalizeStringList(draft.deaths ?? metadata.deaths),
    linkedEntityNames: normalizeStringList(draft.linkedEntityNames ?? metadata.linkedItems),
    manuscriptAnchors: normalizeWorldbuildingAnchors(draft.manuscriptAnchors),
    eventStartAnchor: normalizeWorldbuildingAnchor(draft.eventStartAnchor),
    eventEndAnchor: normalizeWorldbuildingAnchor(draft.eventEndAnchor),
    metadata: {
      ...metadata,
      location,
      locationLabel: location,
      locationKey: slugify(location),
      locationRowLabel: location,
      locationRowKey: slugify(location),
      locationScope: "planetary",
      eventLocationLabel: location,
      eventLocationKey: slugify(location),
      coreLocationLabel: location,
      coreLocationKey: slugify(location),
      sublocation,
      childLocation: sublocation,
      childLocationLabel: sublocation,
      childLocationKey: slugify(sublocation),
      sublocationLabel: sublocation,
      sublocationKey: slugify(sublocation),
      orbitalBand,
      locationPlacement,
      date: normalizeString(draft.date) || normalizeString(metadata.date),
      time: normalizeString(draft.time) || normalizeString(metadata.time),
      people: normalizeStringList(draft.people ?? metadata.people),
      charactersPresent: normalizeStringList(draft.charactersPresent ?? draft.people ?? metadata.charactersPresent),
      newCharacters: normalizeStringList(draft.newCharacters ?? metadata.newCharacters),
      responsibleParty: normalizeStringList(draft.responsibleParty ?? metadata.responsibleParty),
      witnesses: normalizeStringList(draft.witnesses ?? metadata.witnesses),
      affectedFactions: normalizeStringList(draft.affectedFactions ?? metadata.affectedFactions),
      linkedLocations: normalizeStringList(draft.linkedLocations ?? draft.linkedLocation ?? metadata.linkedLocations ?? metadata.linkedLocation),
      criticalEvents: normalizeStringList(draft.criticalEvents ?? metadata.criticalEvents),
      deaths: normalizeStringList(draft.deaths ?? metadata.deaths),
    },
    sourceDraftId: draft.id,
  };
}

// Intent: mirror the schema-level placement DTO for browser-authored world event nodes.
function createWorldbuildingTimelineNodeLocationPlacement({
  location = "",
  sublocation = "",
  orbitalBand = "",
} = {}) {
  const locationLabel = normalizeString(location);
  const locationKey = slugify(locationLabel);
  const sublocationLabel = normalizeString(sublocation);
  return {
    locationLabel,
    locationKey,
    locationRowLabel: locationLabel,
    locationRowKey: locationKey,
    locationScope: "planetary",
    eventLocationLabel: locationLabel,
    eventLocationKey: locationKey,
    coreLocationLabel: locationLabel,
    coreLocationKey: locationKey,
    sublocationLabel,
    sublocationKey: slugify(sublocationLabel),
    childLocationLabel: sublocationLabel,
    childLocationKey: slugify(sublocationLabel),
    orbitalBand: normalizeString(orbitalBand),
  };
}

// Intent: treat the unnamed prompt row as an empty placement, while named rows own dropped event locations.
function normalizeWorldSpinePlacementLocationLabel(value = "") {
  const normalized = normalizeString(value);
  if (
    !normalized ||
    slugify(normalized) === slugify(DEFAULT_UNPLACED_LOCATION_LABEL) ||
    slugify(normalized) === slugify(DEFAULT_LOCATION_ROW_PROMPT)
  ) {
    return "";
  }

  return normalized;
}

function compareWorldSpineStorageNodes(left, right) {
  return (
    resolveStorageNodeRank(left) - resolveStorageNodeRank(right) ||
    Number(left?.order) - Number(right?.order) ||
    normalizeString(left?.id).localeCompare(normalizeString(right?.id))
  );
}

function resolveStorageNodeRank(node) {
  const sequenceRank = Number(node?.sequenceRank);
  if (Number.isFinite(sequenceRank)) {
    return sequenceRank;
  }

  const slotIndex = Number(node?.timelineSlotIndex);
  if (Number.isFinite(slotIndex)) {
    return slotIndex - 0.5;
  }

  const order = Number(node?.order ?? node?.timelineOrder);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function normalizeCustomWorldbuildingCategories(categories = []) {
  const usedIds = new Set(WORLD_SPINE_CATEGORY_DEFINITIONS.map((category) => category.id));
  return (Array.isArray(categories) ? categories : [])
    .map((category) => normalizeWorldbuildingCategory(category, { usedIds }))
    .filter(Boolean);
}

function normalizeWorldbuildingCategory(category, { usedIds = new Set() } = {}) {
  const label = normalizeString(category?.label ?? category?.name);
  const id = normalizeString(category?.id) || slugify(label);
  if (!id || !label || usedIds.has(id)) {
    return null;
  }

  usedIds.add(id);
  return {
    id,
    groupId: "custom",
    label,
    code: normalizeString(category?.code).slice(0, 4).toUpperCase() || createCategoryCode(label),
    itemKind: "entity",
    templateName: normalizeString(category?.templateName) || label,
    description: normalizeString(category?.description) || `Custom ${label} lore category.`,
    isCustomCategory: true,
    fields: normalizeCategoryFields(category?.fields, label),
  };
}

function normalizeCategoryFields(fields = [], label = "Item") {
  const normalizedFields = (Array.isArray(fields) ? fields : [])
    .map((field) => {
      const fieldLabel = normalizeString(field?.label ?? field?.name);
      return {
        id: normalizeString(field?.id ?? field?.key) || slugify(fieldLabel),
        label: fieldLabel,
        placeholder: createFieldPlaceholder(fieldLabel),
        input: field?.input === "textarea" || field?.type === "textarea" ? "textarea" : "text",
        required: field?.required === true,
      };
    })
    .filter((field) => field.id && field.label);
  const hasName = normalizedFields.some((field) => field.id === "name");
  const hasNotes = normalizedFields.some((field) => field.id === "notes");
  return [
    ...(hasName ? [] : [textField("name", "Name")]),
    ...normalizedFields,
    ...(hasNotes ? [] : [textAreaField("notes", "Notes")]),
  ];
}

function normalizeWorldbuildingEntities(entities = [], customCategories = []) {
  const normalizedCustomCategories = normalizeCustomWorldbuildingCategories(customCategories);
  const customCategoryIds = new Set(normalizedCustomCategories.map((category) => category.id));
  const categories = [
    ...WORLD_SPINE_CATEGORY_DEFINITIONS,
    ...normalizedCustomCategories,
  ];
  return (Array.isArray(entities) ? entities : [])
    .map((entity) => {
      const fields = Array.isArray(entity?.fields) ? entity.fields.map((field) => ({
        key: normalizeString(field?.key ?? field?.id),
        label: normalizeString(field?.label ?? field?.name ?? field?.key),
        value: normalizeString(field?.value),
      })).filter((field) => field.key && field.label && field.value) : [];
      const categoryId = resolveWorldbuildingEntityCategoryId(entity, fields, customCategoryIds);
      const category = categories.find((candidate) => candidate.id === categoryId);
      const image = normalizeWorldbuildingCatalogueImage(entity?.image ?? entity?.catalogueImage);
      return {
        ...entity,
        id: normalizeString(entity?.id),
        name: normalizeString(entity?.name),
        templateName: normalizeString(entity?.templateName) || normalizeString(entity?.categoryLabel) || category?.templateName || "World Item",
        categoryId,
        categoryLabel: normalizeString(entity?.categoryLabel) || category?.label || "",
        notes: normalizeString(entity?.notes),
        fields,
        ...(image ? { image } : {}),
      };
    })
    .filter((entity) => entity.id && entity.name);
}

function normalizeWorldbuildingEventDrafts(eventDrafts = []) {
  return (Array.isArray(eventDrafts) ? eventDrafts : [])
    .map((draft) => {
      const image = normalizeWorldbuildingCatalogueImage(draft?.image ?? draft?.catalogueImage);
      const metadata = draft?.metadata && typeof draft.metadata === "object" ? draft.metadata : {};
      return {
        ...draft,
        id: normalizeString(draft?.id),
        title: normalizeString(draft?.title ?? draft?.label ?? draft?.name),
        summary: normalizeString(draft?.summary ?? draft?.notes),
        categoryId: normalizeString(draft?.categoryId) || "event",
        categoryLabel: normalizeString(draft?.categoryLabel) || "Event",
        location: normalizeString(draft?.location ?? metadata.location),
        childLocation: normalizeString(draft?.childLocation ?? draft?.childLocationLabel ?? draft?.sublocation ?? draft?.subLocation ?? metadata.childLocation ?? metadata.childLocationLabel ?? metadata.sublocation ?? metadata.subLocation),
        childLocationLabel: normalizeString(draft?.childLocation ?? draft?.childLocationLabel ?? draft?.sublocation ?? draft?.subLocation ?? metadata.childLocation ?? metadata.childLocationLabel ?? metadata.sublocation ?? metadata.subLocation),
        sublocation: normalizeString(draft?.childLocation ?? draft?.childLocationLabel ?? draft?.sublocation ?? draft?.subLocation ?? metadata.childLocation ?? metadata.childLocationLabel ?? metadata.sublocation ?? metadata.subLocation),
        orbitalBand: normalizeString(draft?.orbitalBand ?? metadata.orbitalBand),
        date: normalizeString(draft?.date ?? metadata.date),
        time: normalizeString(draft?.time ?? metadata.time),
        people: normalizeStringList(draft?.people ?? draft?.charactersPresent ?? metadata.people ?? metadata.charactersPresent),
        charactersPresent: normalizeStringList(draft?.charactersPresent ?? draft?.people ?? metadata.charactersPresent ?? metadata.people),
        newCharacters: normalizeStringList(draft?.newCharacters ?? metadata.newCharacters),
        responsibleParty: normalizeStringList(draft?.responsibleParty ?? metadata.responsibleParty),
        witnesses: normalizeStringList(draft?.witnesses ?? metadata.witnesses),
        affectedFactions: normalizeStringList(draft?.affectedFactions ?? metadata.affectedFactions),
        linkedLocations: normalizeStringList(draft?.linkedLocations ?? draft?.linkedLocation ?? metadata.linkedLocations ?? metadata.linkedLocation),
        criticalEvents: normalizeStringList(draft?.criticalEvents ?? metadata.criticalEvents),
        deaths: normalizeStringList(draft?.deaths ?? metadata.deaths),
        linkedEntityNames: normalizeStringList(draft?.linkedEntityNames ?? metadata.linkedItems),
        manuscriptAnchors: normalizeWorldbuildingAnchors(draft?.manuscriptAnchors),
        eventStartAnchor: normalizeWorldbuildingAnchor(draft?.eventStartAnchor),
        eventEndAnchor: normalizeWorldbuildingAnchor(draft?.eventEndAnchor),
        metadata,
        ...(image ? { image } : {}),
      };
    })
    .filter((draft) => draft.id && draft.title);
}

// Intent: keep World Spine location artwork tied to place-like catalogue records, not arbitrary world entities.
function isWorldSpineLocationImageEntity(entity = {}) {
  return ["location", "planet"].includes(normalizeString(entity?.categoryId));
}

function findWorldSpineLocationImageEntityForLabel(entities = [], location = "") {
  const normalizedLocationKey = slugify(location);
  if (!normalizedLocationKey) {
    return null;
  }

  const placeEntities = (Array.isArray(entities) ? entities : [])
    .filter(isWorldSpineLocationImageEntity);
  return (
    placeEntities.find((entity) =>
      normalizeString(entity?.categoryId) === "location" &&
      collectWorldSpineLocationImageNames(entity).some((name) => slugify(name) === normalizedLocationKey)
    ) ??
    placeEntities.find((entity) =>
      normalizeString(entity?.categoryId) === "planet" &&
      collectWorldSpineLocationImageNames(entity).some((name) => slugify(name) === normalizedLocationKey)
    ) ??
    null
  );
}

function collectWorldSpineLocationImageNames(entity = {}) {
  const aliasValues = (Array.isArray(entity?.fields) ? entity.fields : [])
    .filter((field) => /alias|also known|aka/i.test(`${field?.key ?? ""} ${field?.label ?? ""}`))
    .flatMap((field) => normalizeStringList(field?.value));
  return uniqueStrings([
    entity?.name,
    ...aliasValues,
  ]);
}

function createWorldSpineLocationEntityForImage(entities = [], location = "", image = null, timestamp = "") {
  return {
    id: createNextWorldbuildingId(entities, "entity"),
    name: location,
    templateName: "Location",
    categoryId: "location",
    categoryLabel: "Location",
    notes: "Location reference created from World Spine row imagery.",
    fields: [],
    image,
    source: "world-spine-location-row",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeWorldbuildingCatalogueImage(candidate = null) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const candidateUrl = normalizeString(candidate.url ?? candidate.src);
  const explicitDataUrl = normalizeString(candidate.dataUrl);
  const dataUrl = explicitDataUrl || (candidateUrl.startsWith("data:") ? candidateUrl : "");
  const sourceUrl = candidateUrl && !candidateUrl.startsWith("data:") ? candidateUrl : "";
  const mediaPath = normalizeString(candidate.mediaPath ?? candidate.filePath);
  const projectRelativePath = normalizeWorldbuildingCatalogueImageRelativePath(
    candidate.projectRelativePath ?? candidate.relativePath,
  );
  const match = dataUrl ? dataUrl.match(WORLDBUILDING_CATALOGUE_IMAGE_DATA_URL_PATTERN) : null;
  if (dataUrl && !match) {
    return null;
  }

  const mediaType = normalizeWorldbuildingCatalogueImageMediaType(
    candidate.mediaType ??
    candidate.type ??
    match?.[1] ??
    inferWorldbuildingCatalogueImageMediaType(mediaPath || projectRelativePath || sourceUrl || candidate.name),
  );
  if (!mediaType) {
    return null;
  }

  const estimatedInlineSize = match ? estimateBase64ByteSize(match[2]) : 0;
  const declaredSize = Number(candidate.size);
  const estimatedSize = Number.isFinite(declaredSize) && declaredSize > 0
    ? declaredSize
    : estimatedInlineSize;
  if (!match && !mediaPath && !projectRelativePath && !sourceUrl) {
    return null;
  }

  if (estimatedSize > WORLDBUILDING_CATALOGUE_IMAGE_MAX_BYTES) {
    return null;
  }

  return {
    mediaType,
    name: normalizeWorldbuildingCatalogueImageName(candidate.name),
    size: Math.max(0, Math.round(estimatedSize)),
    ...(match ? { dataUrl } : {}),
    ...(mediaPath ? { mediaPath } : {}),
    ...(projectRelativePath ? { projectRelativePath } : {}),
    ...(sourceUrl ? { url: sourceUrl } : {}),
    ...(normalizeString(candidate.attachedAt) ? { attachedAt: normalizeString(candidate.attachedAt) } : {}),
  };
}

// Intent: let renderers lazy-load referenced local media while preserving legacy inline image saves.
export function createWorldbuildingCatalogueImageSource(candidate = null) {
  const image = normalizeWorldbuildingCatalogueImage(candidate);
  if (!image) {
    return "";
  }

  if (image.url) {
    return image.url;
  }

  if (image.mediaPath) {
    return createWorldbuildingCatalogueMediaFileUrl(image.mediaPath);
  }

  return image.dataUrl ?? "";
}

export function createWorldbuildingCatalogueMediaFileUrl(filePath = "") {
  const normalizedPath = normalizeString(filePath);
  if (!normalizedPath) {
    return "";
  }

  const mediaPath = `${WORLDBUILDING_CATALOGUE_IMAGE_MEDIA_ENDPOINT}${encodeURIComponent(normalizedPath)}`;
  const origin = getWorldbuildingCatalogueMediaOrigin();
  return origin ? `${origin}${mediaPath}` : mediaPath;
}

// Intent: plan local-first image file destinations without forcing binary payloads into project JSON.
export function buildWorldbuildingCatalogueImageMediaPath({
  projectFilePath = "",
  projectRoot = "",
  projectId = "",
  itemKind = "",
  itemId = "",
  title = "",
  fileName = "",
  mediaType = "",
  nowMs = Date.now(),
} = {}) {
  const projectSegment = sanitizeWorldbuildingCatalogueImagePathSegment(projectId || "project");
  const contextSegment = sanitizeWorldbuildingCatalogueImagePathSegment(itemKind || "catalogue");
  const itemSegment = sanitizeWorldbuildingCatalogueImagePathSegment(title || itemId || "image");
  const stamp = Math.max(0, Math.round(Number(nowMs) || Date.now())).toString(36);
  const extension = getWorldbuildingCatalogueImageExtension(mediaType, fileName);
  const imageFileName = `${itemSegment}-${stamp}.${extension}`;
  const projectRelativePath = [
    WORLDBUILDING_CATALOGUE_IMAGE_PROJECT_RELATIVE_ROOT,
    projectSegment,
    contextSegment,
    imageFileName,
  ].join("/");
  const packageRoot = resolveWorldbuildingCatalogueImageProjectRoot(projectFilePath, projectRoot);
  if (packageRoot) {
    return {
      mediaPath: joinWorldbuildingCatalogueImageLocalPath(packageRoot, projectRelativePath),
      projectRelativePath,
    };
  }

  return {
    mediaPath: ["project-media", projectSegment, projectRelativePath].join("/"),
    projectRelativePath,
  };
}

function normalizeWorldSpines(spines = []) {
  return (Array.isArray(spines) ? spines : [])
    .map((spine) => ({
      ...spine,
      id: normalizeString(spine?.id),
      label: normalizeString(spine?.label) || "World Spine",
      nodes: Array.isArray(spine?.nodes) ? spine.nodes.slice() : [],
    }))
    .filter((spine) => spine.id);
}

function updateWorldbuildingEntityNameInStoredSpines(spines = [], previousEntity = null, nextEntity = null) {
  const entityId = normalizeString(nextEntity?.id ?? previousEntity?.id);
  const previousName = normalizeString(previousEntity?.name);
  const nextName = normalizeString(nextEntity?.name);
  if (!Array.isArray(spines) || !entityId || !nextName) {
    return spines;
  }

  return spines.map((spine) => {
    const nodes = Array.isArray(spine?.nodes) ? spine.nodes : [];
    let changed = false;
    const nextNodes = nodes.map((node) => {
      const linkedEntityIds = normalizeStringList(node?.linkedEntityIds);
      if (!linkedEntityIds.includes(entityId)) {
        return node;
      }

      changed = true;
      const nextNames = uniqueStrings([
        ...normalizeStringList(node?.linkedEntityNames).filter((name) =>
          name.toLowerCase() !== previousName.toLowerCase() &&
          name.toLowerCase() !== nextName.toLowerCase()
        ),
        nextName,
      ]);
      return {
        ...node,
        linkedEntityIds,
        linkedEntityNames: nextNames,
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

function filterWorldbuildingEntityLinksForDeletedEntity(entityLinks = [], entityId = "") {
  const normalizedEntityId = normalizeString(entityId);
  return (Array.isArray(entityLinks) ? entityLinks : [])
    .filter((link) => normalizeString(link?.entityId) !== normalizedEntityId);
}

function removeWorldbuildingEntityFromStoredSpines(spines = [], entity = {}) {
  const entityId = normalizeString(entity?.id);
  const entityName = normalizeString(entity?.name).toLowerCase();
  if (!Array.isArray(spines) || !entityId) {
    return spines;
  }

  return spines.map((spine) => {
    const nodes = Array.isArray(spine?.nodes) ? spine.nodes : [];
    let changed = false;
    const nextNodes = nodes.map((node) => {
      const linkedEntityIds = normalizeStringList(node?.linkedEntityIds);
      const linkedEntityNames = normalizeStringList(node?.linkedEntityNames);
      const nextEntityIds = linkedEntityIds.filter((id) => id !== entityId);
      const nextEntityNames = linkedEntityNames.filter((name) => !entityName || name.toLowerCase() !== entityName);
      if (
        nextEntityIds.length === linkedEntityIds.length &&
        nextEntityNames.length === linkedEntityNames.length
      ) {
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

function normalizeWorldbuildingAnchors(anchors = []) {
  return (Array.isArray(anchors) ? anchors : [])
    .map(normalizeWorldbuildingAnchor)
    .filter(Boolean);
}

function normalizeWorldbuildingAnchor(anchor) {
  if (!anchor || typeof anchor !== "object") {
    return null;
  }

  const sceneId = normalizeString(anchor.sceneId);
  const blockId = normalizeString(anchor.blockId);
  if (!sceneId || !blockId) {
    return null;
  }

  return {
    sceneId,
    blockId,
    startOffset: Number.isInteger(Number(anchor.startOffset)) ? Number(anchor.startOffset) : 0,
    endOffset: Number.isInteger(Number(anchor.endOffset)) ? Number(anchor.endOffset) : Number(anchor.startOffset) + 1,
  };
}

function recalculateWorldbuildingStats(world) {
  const spines = normalizeWorldSpines(world?.spines);
  const existingStats = world?.stats && typeof world.stats === "object" ? world.stats : {};
  return {
    ...existingStats,
    entityCount: normalizeWorldbuildingEntities(world?.entities, world?.worldbuildingCategories).length,
    templateCount: Array.isArray(world?.templates) ? world.templates.length : Number(existingStats.templateCount) || 0,
    spineCount: spines.length,
    nodeCount: spines.reduce((count, spine) => count + (Array.isArray(spine.nodes) ? spine.nodes.length : 0), 0),
    eventDraftCount: normalizeWorldbuildingEventDrafts(world?.eventDrafts).length,
    customCategoryCount: normalizeCustomWorldbuildingCategories(world?.worldbuildingCategories).length,
  };
}

function resolveWorldbuildingCategory(categories, categoryId) {
  const normalizedCategoryId = normalizeString(categoryId);
  return (
    (Array.isArray(categories) ? categories : []).find((category) => category.id === normalizedCategoryId) ??
    WORLD_SPINE_CATEGORY_DEFINITIONS.find((category) => category.id === DEFAULT_WORLDBUILDING_CATEGORY_ID)
  );
}

function createDefaultWorldSpine() {
  return {
    id: "spine-0001",
    label: "World Spine",
    kind: "thread",
    nodes: [],
  };
}

function createParallelWorldSpineLabel(spines = []) {
  const parallelIndex = Math.max(1, normalizeWorldSpines(spines).length);
  return parallelIndex === 1
    ? "Parallel Timeline"
    : `Parallel Timeline ${parallelIndex}`;
}

function createEventFields(titleLabel) {
  return [
    textField("title", titleLabel),
    textAreaField("summary", "Summary"),
    textField("location", "Location"),
    textField("sublocation", "Child location"),
    textField("orbitalBand", "Orbital position"),
    textField("date", "Date"),
    textField("time", "Time"),
    textField("charactersPresent", "Characters present"),
    textField("newCharacters", "New characters"),
    textField("responsibleParty", "Responsible party"),
    textField("witnesses", "Witnesses"),
    textField("affectedFactions", "Affected factions"),
    textField("linkedLocation", "Linked location"),
    textField("criticalEvents", "Critical events"),
    textField("deaths", "Deaths"),
    textField("linkedItems", "Linked items"),
  ];
}

function textField(id, label) {
  return {
    id,
    label,
    placeholder: createFieldPlaceholder(label),
    input: "text",
  };
}

function textAreaField(id, label) {
  return {
    id,
    label,
    placeholder: createFieldPlaceholder(label),
    input: "textarea",
  };
}

function fieldList(id, label, values = []) {
  return {
    id,
    label,
    values,
    placeholder: "Enter field name",
    input: "field-list",
  };
}

function createFieldPlaceholder(label) {
  const normalizedLabel = normalizeString(label).toLowerCase();
  return `Enter ${normalizedLabel || "value"}`;
}

function normalizeValueRecord(values = {}) {
  const result = {};
  for (const [key, value] of Object.entries(values && typeof values === "object" ? values : {})) {
    result[normalizeString(key)] = Array.isArray(value)
      ? value.map(normalizeString).filter(Boolean).join(", ")
      : normalizeString(value);
  }
  return result;
}

function createNextWorldbuildingId(records = [], prefix = "world-item") {
  return `${prefix}-${String(nextSequenceNumber(records, prefix)).padStart(4, "0")}`;
}

function nextSequenceNumber(records = [], prefix = "world-item") {
  const highest = (Array.isArray(records) ? records : []).reduce((max, record) => {
    const id = normalizeString(record?.id);
    const match = id.match(new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return highest + 1;
}

function createUniqueSlugId(value, existingIds = []) {
  const base = slugify(value) || "custom-item";
  const used = new Set(existingIds.map(normalizeString).filter(Boolean));
  if (!used.has(base)) {
    return base;
  }

  let index = 2;
  while (used.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function createCategoryCode(label) {
  const words = normalizeString(label).split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  }
  return normalizeString(label).slice(0, 3).toUpperCase() || "CU";
}

function formatEntityFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .slice(0, 2)
    .map((field) => `${field.label}: ${field.value}`)
    .join(" / ");
}

function formatEventDraftMeta(draft) {
  return [
    draft.date,
    draft.time,
    draft.location,
    draft.sublocation,
    draft.orbitalBand,
    draft.people?.length ? `${draft.people.length} people` : "",
    draft.criticalEvents?.length ? `${draft.criticalEvents.length} critical` : "",
  ].filter(Boolean).join(" / ") || "Drag to timeline";
}

function renderEventDraftPreviewBadge(condition, label, title) {
  return condition
    ? `<span title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${escapeHtml(label)}</span>`
    : "";
}

function isEntityInWorldbuildingCategory(entity, category) {
  const explicitCategoryId = normalizeString(entity?.categoryId);
  if (explicitCategoryId && explicitCategoryId === category.id) {
    return true;
  }

  const entityCategoryId = resolveWorldbuildingEntityCategoryId(entity);
  if (entityCategoryId) {
    return entityCategoryId === category.id;
  }

  const categoryLabel = normalizeString(category?.label).toLowerCase();
  const templateName = normalizeString(category?.templateName).toLowerCase();
  return [entity?.categoryLabel, entity?.templateName]
    .map((value) => normalizeString(value).toLowerCase())
    .some((value) => value && (value === categoryLabel || value === templateName));
}

function resolveWorldbuildingEntityCategoryId(entity, normalizedFields = null, customCategoryIds = new Set()) {
  const explicitCategoryId = normalizeString(entity?.categoryId);
  if (WORLD_SPINE_CATEGORY_DEFINITIONS.some((category) => category.id === explicitCategoryId)) {
    return explicitCategoryId;
  }
  if (customCategoryIds instanceof Set && customCategoryIds.has(explicitCategoryId)) {
    return explicitCategoryId;
  }

  const fields = Array.isArray(normalizedFields)
    ? normalizedFields
    : Array.isArray(entity?.fields)
      ? entity.fields.map((field) => ({
          label: normalizeString(field?.label ?? field?.name ?? field?.key),
          value: normalizeString(field?.value),
        }))
      : [];
  const categoryField = fields.find((field) => normalizeString(field?.label).toLowerCase() === "category");
  const candidates = [
    explicitCategoryId,
    entity?.categoryLabel,
    entity?.templateName,
    categoryField?.value,
    entity?.sourcePath,
    entity?.scrivenerBinderPath,
  ];
  return resolveWorldbuildingCategoryIdFromText(candidates.join(" "));
}

function resolveWorldbuildingCategoryIdFromText(value) {
  const source = normalizeString(value);
  if (!source) {
    return "";
  }

  const normalizedSource = source.toLowerCase();
  const exactCategory = WORLD_SPINE_CATEGORY_DEFINITIONS.find((category) =>
    [category.id, category.label, category.templateName]
      .map((candidate) => normalizeString(candidate).toLowerCase())
      .includes(normalizedSource)
  );
  if (exactCategory) {
    return exactCategory.id;
  }

  const matchedAlias = WORLD_CATALOGUE_CATEGORY_ALIASES.find((alias) =>
    alias.patterns.some((pattern) => pattern.test(source))
  );
  return matchedAlias?.categoryId ?? "";
}

function buildCustomCategoryCatalogueDetailRows(category) {
  const fieldLabels = (Array.isArray(category?.fields) ? category.fields : [])
    .map((field) => field?.label)
    .map(normalizeString)
    .filter(Boolean);
  return uniqueCatalogueDetailRows([
    { label: "Type", value: "Custom category" },
    { label: "Template", value: category?.templateName },
    { label: "Fields", value: fieldLabels.join(", ") },
  ]);
}

function buildEntityCatalogueDetailRows(entity, category) {
  const fieldRows = (Array.isArray(entity?.fields) ? entity.fields : []).map((field) => ({
    label: field?.label,
    value: field?.value,
  }));
  return uniqueCatalogueDetailRows([
    { label: "Type", value: entity?.templateName },
    { label: "Category", value: entity?.categoryLabel || category?.label },
    { label: "Entity ID", value: entity?.id },
    ...fieldRows,
  ]);
}

function buildEventDraftCatalogueDetailRows(draft, category) {
  return uniqueCatalogueDetailRows([
    { label: "Type", value: category?.templateName || draft?.categoryLabel },
    { label: "Location", value: draft?.location },
    { label: "Child location", value: draft?.childLocation ?? draft?.sublocation },
    { label: "Orbital position", value: draft?.orbitalBand },
    { label: "Date", value: draft?.date },
    { label: "Time", value: draft?.time },
    { label: "People", value: formatCatalogueListValue(draft?.people ?? draft?.charactersPresent) },
    { label: "New characters", value: formatCatalogueListValue(draft?.newCharacters) },
    { label: "Responsible party", value: formatCatalogueListValue(draft?.responsibleParty) },
    { label: "Witnesses", value: formatCatalogueListValue(draft?.witnesses) },
    { label: "Affected factions", value: formatCatalogueListValue(draft?.affectedFactions) },
    { label: "Linked location", value: formatCatalogueListValue(draft?.linkedLocations) },
    { label: "Critical events", value: formatCatalogueListValue(draft?.criticalEvents) },
    { label: "Deaths", value: formatCatalogueListValue(draft?.deaths) },
    { label: "Linked items", value: formatCatalogueListValue(draft?.linkedEntityNames) },
    { label: "Draft ID", value: draft?.id },
  ]);
}

function buildCatalogueProvenanceRows(record = {}) {
  return uniqueCatalogueDetailRows([
    { label: "Source", value: formatCatalogueSourceLabel(record?.source) },
    { label: "Source path", value: record?.sourcePath ?? record?.scrivenerBinderPath },
    { label: "Content file", value: record?.sourceContentFilePath },
    { label: "Document ID", value: record?.sourceDocumentId },
    { label: "Created", value: formatCatalogueDate(record?.createdAt) },
    { label: "Updated", value: formatCatalogueDate(record?.updatedAt) },
  ]);
}

function buildCatalogueAnchorRows(record = {}) {
  const rows = [];
  const introductionAnchor = normalizeCatalogueAnchorForDisplay({
    sceneId: record?.introductionSceneId ?? record?.primarySceneId,
    blockId: record?.introductionBlockId ?? record?.primaryBlockId,
  });
  if (introductionAnchor) {
    rows.push({ label: "Introduction", value: formatCatalogueAnchor(introductionAnchor) });
  }

  const anchors = [
    ...(Array.isArray(record?.manuscriptAnchors) ? record.manuscriptAnchors : []),
  ].map(normalizeCatalogueAnchorForDisplay).filter(Boolean);
  anchors.forEach((anchor, index) => {
    rows.push({ label: `Manuscript ${index + 1}`, value: formatCatalogueAnchor(anchor) });
  });

  const eventStartAnchor = normalizeCatalogueAnchorForDisplay(record?.eventStartAnchor);
  if (eventStartAnchor) {
    rows.push({ label: "Event start", value: formatCatalogueAnchor(eventStartAnchor) });
  }

  const eventEndAnchor = normalizeCatalogueAnchorForDisplay(record?.eventEndAnchor);
  if (eventEndAnchor) {
    rows.push({ label: "Event end", value: formatCatalogueAnchor(eventEndAnchor) });
  }

  return uniqueCatalogueDetailRows(rows);
}

function normalizeCatalogueAnchorForDisplay(anchor) {
  if (!anchor || typeof anchor !== "object") {
    return null;
  }

  const sceneId = normalizeString(anchor.sceneId);
  const blockId = normalizeString(anchor.blockId);
  if (!sceneId && !blockId) {
    return null;
  }

  const startOffset = Number(anchor.startOffset);
  const endOffset = Number(anchor.endOffset);
  return {
    sceneId,
    blockId,
    startOffset: Number.isFinite(startOffset) ? startOffset : null,
    endOffset: Number.isFinite(endOffset) ? endOffset : null,
  };
}

function formatCatalogueAnchor(anchor) {
  const location = [
    anchor.sceneId ? `Scene ${anchor.sceneId}` : "",
    anchor.blockId ? `Block ${anchor.blockId}` : "",
  ].filter(Boolean).join(" / ");
  if (anchor.startOffset === null || anchor.endOffset === null) {
    return location;
  }

  return `${location} (${anchor.startOffset}-${anchor.endOffset})`;
}

function formatCatalogueListValue(value) {
  return normalizeStringList(value).join(", ");
}

function formatCatalogueSourceLabel(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCatalogueDate(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return "";
  }

  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return normalized;
  }

  return date.toISOString().slice(0, 10);
}

function uniqueCatalogueDetailRows(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      label: normalizeString(row?.label),
      value: normalizeString(row?.value),
    }))
    .filter((row) => row.label && row.value)
    .filter((row) => {
      const key = `${row.label.toLowerCase()}::${row.value.toLowerCase()}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function formatCatalogueCountLabel(count = 0) {
  const safeCount = Math.max(0, Math.round(Number(count) || 0));
  return `${safeCount} item${safeCount === 1 ? "" : "s"}`;
}

function resolveCataloguePosition(position = null) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  return {
    x: Number.isFinite(x) ? Math.max(8, Math.round(x)) : 24,
    y: Number.isFinite(y) ? Math.max(8, Math.round(y)) : 120,
  };
}

function resolveCatalogueBounds(bounds = null) {
  const left = Number(bounds?.left ?? bounds?.x);
  const top = Number(bounds?.top ?? bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (![left, top, width, height].every(Number.isFinite)) {
    return null;
  }

  return {
    left: Math.max(8, Math.round(left)),
    top: Math.max(8, Math.round(top)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function normalizeDateISOString(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]+/)
      : [];
  return uniqueStrings(source.map(normalizeString).filter(Boolean));
}

function normalizeNumberList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => Number(item))
    .filter(Number.isFinite);
}

function normalizeWorldbuildingCatalogueImageMediaType(value) {
  const normalized = normalizeString(value).toLowerCase();
  return WORLDBUILDING_CATALOGUE_IMAGE_ALLOWED_MEDIA_TYPES.includes(normalized) ? normalized : "";
}

function normalizeWorldbuildingCatalogueImageName(value) {
  const normalized = normalizeString(value).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized.slice(0, 120) || "catalogue-image";
}

function normalizeWorldbuildingCatalogueImageRelativePath(value) {
  const normalized = normalizeString(value)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
  if (!normalized || normalized.split("/").some((segment) => segment === "." || segment === ".." || !segment)) {
    return "";
  }

  return normalized;
}

function inferWorldbuildingCatalogueImageMediaType(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (/\.(png)(?:[?#].*)?$/.test(normalized)) {
    return "image/png";
  }
  if (/\.(jpe?g)(?:[?#].*)?$/.test(normalized)) {
    return "image/jpeg";
  }
  if (/\.(webp)(?:[?#].*)?$/.test(normalized)) {
    return "image/webp";
  }
  if (/\.(gif)(?:[?#].*)?$/.test(normalized)) {
    return "image/gif";
  }

  return "";
}

function getWorldbuildingCatalogueImageExtension(mediaType = "", fileName = "") {
  const normalizedMediaType = normalizeWorldbuildingCatalogueImageMediaType(mediaType);
  if (normalizedMediaType === "image/png") {
    return "png";
  }
  if (normalizedMediaType === "image/jpeg") {
    return "jpg";
  }
  if (normalizedMediaType === "image/webp") {
    return "webp";
  }
  if (normalizedMediaType === "image/gif") {
    return "gif";
  }

  const inferred = inferWorldbuildingCatalogueImageMediaType(fileName);
  return getWorldbuildingCatalogueImageExtension(inferred || "image/png");
}

function resolveWorldbuildingCatalogueImageProjectRoot(projectFilePath = "", projectRoot = "") {
  const normalizedProjectFilePath = normalizeString(projectFilePath).replace(/[\\/]+$/, "");
  if (isAbsoluteWorldbuildingCatalogueImagePath(normalizedProjectFilePath)) {
    if (/[\\/]project\.json$/i.test(normalizedProjectFilePath)) {
      return getWorldbuildingCatalogueImagePathDirectory(normalizedProjectFilePath);
    }
    if (/\.json$/i.test(normalizedProjectFilePath)) {
      return normalizedProjectFilePath.replace(/\.json$/i, "");
    }
    return normalizedProjectFilePath;
  }

  const normalizedProjectRoot = normalizeString(projectRoot).replace(/[\\/]+$/, "");
  return isAbsoluteWorldbuildingCatalogueImagePath(normalizedProjectRoot)
    ? normalizedProjectRoot
    : "";
}

function getWorldbuildingCatalogueImagePathDirectory(filePath = "") {
  const normalized = normalizeString(filePath).replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]+/);
  parts.pop();
  return parts.join(normalized.includes("\\") ? "\\" : "/");
}

function joinWorldbuildingCatalogueImageLocalPath(root = "", relativePath = "") {
  const normalizedRoot = normalizeString(root).replace(/[\\/]+$/, "");
  const normalizedRelativePath = normalizeWorldbuildingCatalogueImageRelativePath(relativePath);
  const separator = normalizedRoot.includes("\\") ? "\\" : "/";
  return normalizedRelativePath
    ? `${normalizedRoot}${separator}${normalizedRelativePath.replace(/\//g, separator)}`
    : normalizedRoot;
}

function isAbsoluteWorldbuildingCatalogueImagePath(value = "") {
  const normalized = normalizeString(value);
  return /^[A-Za-z]:[\\/]/.test(normalized) || /^\\\\/.test(normalized) || normalized.startsWith("/");
}

function sanitizeWorldbuildingCatalogueImagePathSegment(value = "") {
  return normalizeString(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .replace(/^-|-$/g, "")
    .slice(0, 96)
    .toLowerCase() || "image";
}

function getWorldbuildingCatalogueMediaOrigin() {
  const origin = normalizeString(globalThis?.location?.origin);
  if (/^https?:\/\//i.test(origin)) {
    return origin.replace(/\/+$/, "");
  }

  return "http://127.0.0.1:4310";
}

function estimateBase64ByteSize(base64 = "") {
  const normalized = normalizeString(base64).replace(/\s+/g, "");
  if (!normalized) {
    return 0;
  }

  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
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

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function escapeRegExp(value) {
  return normalizeString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
