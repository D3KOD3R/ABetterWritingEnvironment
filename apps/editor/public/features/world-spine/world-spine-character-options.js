// Intent: share catalogue-backed picker options across World Spine relationship-entry forms.
const PICKER_OPTION_SET_CATEGORY_META_KEY = "__catalogueCategories";
const DEFAULT_CORE_LOCATION_PICKER_CATEGORIES = Object.freeze(["planet"]);
const DEFAULT_CHILD_LOCATION_PICKER_CATEGORIES = Object.freeze(["location", "vehicle"]);
const PARENT_LOCATION_FIELD_KEYS = Object.freeze([
  "parentPlace",
  "parentLocation",
  "parent",
  "mainLocation",
  "coreLocation",
  "planet",
  "world",
  "homeWorld",
  "homePort",
  "orbitalBody",
]);
const FIXED_CHILD_LOCATION_FIELD_KEYS = Object.freeze([
  "fixedChildLocation",
  "childLocation",
  "childLocationLabel",
  "sublocation",
  "subLocation",
  "sublocationLabel",
]);

const CHARACTER_PICKER_FIELD_IDS = Object.freeze([
  "charactersPresent",
  "peoplePresent",
  "people",
  "characters",
  "newCharacters",
  "deaths",
  "crew",
  "participants",
  "keyActors",
  "owner",
  "wornBy",
  "leadership",
]);

const FIELD_PICKER_TYPES_BY_ID = Object.freeze({
  affectedFactions: "faction",
  allies: "faction",
  captain: "character",
  characters: "character",
  charactersPresent: "character",
  controller: "faction",
  createdBy: "character",
  creator: "character",
  crew: "character",
  deaths: "character",
  discoveredBy: "character",
  enemies: "faction",
  faction: "faction",
  factionControl: "faction",
  fixedChildLocation: "fixedChildLocation",
  founder: "character",
  governance: "faction",
  holder: "character",
  home: "place",
  inventor: "character",
  introducedBy: "character",
  knownResidents: "character",
  leadership: "character",
  linkedItems: "all",
  linkedLocation: "location",
  members: "character",
  newCharacters: "character",
  operator: "character",
  owner: "character",
  parentPlace: "location",
  parentLocation: "location",
  passengers: "character",
  people: "character",
  peoplePresent: "character",
  participants: "character",
  residents: "character",
  responsibleParty: "character",
  rulingFaction: "faction",
  settlements: "childLocation",
  stolenBy: "character",
  target: "all",
  wieldedBy: "character",
  witnesses: "character",
  wornBy: "character",
});

const CHARACTER_PICKER_LABEL_PATTERN = /\b(characters?|people|person|cast|crew|actors?|deaths?|owner|worn\s+by|leadership)\b/i;
const CHARACTER_ENTITY_PATTERN = /\b(characters?|people|person|cast)\b/i;
const FIELD_PICKER_LABEL_PATTERNS = Object.freeze([
  { pickerType: "character", pattern: /\b(characters?|people|person|cast|crew|actors?|deaths?|owner|worn\s+by|leadership|members?|founder|captain|passengers?|witness(?:es)?|operator|inventor|creator|created\s+by|holder|discovered\s+by|stolen\s+by|wielded\s+by|residents?|introduced\s+by|responsible\s+party)\b/i },
  { pickerType: "faction", pattern: /\b(factions?|governance|ruling\s+faction|controller|control|allies|enemies)\b/i },
  { pickerType: "fixedChildLocation", pattern: /\bfixed\s+child\s+location\b/i },
  { pickerType: "childLocation", pattern: /\bchild\s+locations?\b/i },
  { pickerType: "place", pattern: /\b(home|home\s+location)\b/i },
  { pickerType: "location", pattern: /\b(locations?|places?|parent\s+(?:place|location)|settlements?|linked\s+location)\b/i },
  { pickerType: "vehicle", pattern: /\b(vehicles?|ships?|vessels?|craft|rovers?)\b/i },
  { pickerType: "all", pattern: /\b(linked\s+items?|target)\b/i },
]);
const WORLD_ENTITY_CATEGORY_PATTERNS = Object.freeze([
  { categoryId: "character", pattern: /\b(characters?|people|person|cast)\b/i },
  { categoryId: "faction", pattern: /\b(factions?|organizations?|organisations?|orders?|governments?)\b/i },
  { categoryId: "culture", pattern: /\b(cultures?|religions?|societies)\b/i },
  { categoryId: "planet", pattern: /\b(planets?|moons?|worlds?)\b/i },
  { categoryId: "location", pattern: /\b(locations?|places?|stations?|facilit(?:y|ies)|cities|regions?|settlements?)\b/i },
  { categoryId: "flora", pattern: /\b(floras?|plants?|fung(?:us|i)|botany)\b/i },
  { categoryId: "fauna", pattern: /\b(faunas?|creatures?|animals?|species|beasts?)\b/i },
  { categoryId: "weapon", pattern: /\b(weapons?|rifles?|guns?|ordnance)\b/i },
  { categoryId: "outfit", pattern: /\b(outfits?|clothing|armor|armour|uniforms?|suits?)\b/i },
  { categoryId: "technology", pattern: /\b(technolog(?:y|ies)|devices?|systems?|engines?|gates?|tools?)\b/i },
  { categoryId: "vehicle", pattern: /\b(vehicles?|ships?|vessels?|rovers?|craft|shuttles?)\b/i },
  { categoryId: "artifact", pattern: /\b(artifacts?|artefacts?|relics?|keys?|documents?)\b/i },
]);

export function isWorldSpineCharacterPickerField(field = {}, optionSets = {}) {
  return resolveWorldSpinePickerTypeForField(field, optionSets) === "character";
}

export function isWorldSpinePickerField(field = {}, optionSets = {}) {
  return Boolean(resolveWorldSpinePickerTypeForField(field, optionSets));
}

export function resolveWorldSpinePickerTypeForField(field = {}, optionSets = {}) {
  const id = normalizeString(typeof field === "string" ? field : field?.id);
  const label = normalizeString(typeof field === "string" ? "" : field?.label);
  if (FIELD_PICKER_TYPES_BY_ID[id]) {
    return FIELD_PICKER_TYPES_BY_ID[id];
  }

  const customPickerType = resolveCustomWorldSpinePickerTypeForField({ id, label }, optionSets);
  if (customPickerType) {
    return customPickerType;
  }

  if (CHARACTER_PICKER_FIELD_IDS.includes(id) || CHARACTER_PICKER_LABEL_PATTERN.test(label)) {
    return "character";
  }

  return FIELD_PICKER_LABEL_PATTERNS.find((entry) => entry.pattern.test(label))?.pickerType ?? "";
}

export function buildWorldSpineCharacterOptions({
  projectCharacters = [],
  characters = [],
  world = {},
  worldEntities = [],
} = {}) {
  return uniqueStrings([
    ...collectCharacterRecordNames(projectCharacters),
    ...collectCharacterRecordNames(characters),
    ...collectCharacterRecordNames(world?.characters),
    ...collectWorldCharacterEntityNames(worldEntities),
    ...collectWorldCharacterEntityNames(world?.entities),
  ]).sort((left, right) => left.localeCompare(right));
}

export function buildWorldSpinePickerOptionSets({
  projectCharacters = [],
  characters = [],
  world = {},
  worldEntities = [],
} = {}) {
  const customCatalogueCategories = collectWorldCatalogueCategoryDescriptors(world?.worldbuildingCategories);
  const worldEntityRecords = [
    ...(Array.isArray(worldEntities) ? worldEntities : []),
    ...(Array.isArray(world?.entities) ? world.entities : []),
  ];
  const entityNamesByCategory = collectWorldEntityNamesByCategory(worldEntityRecords);
  const character = buildWorldSpineCharacterOptions({
    projectCharacters,
    characters,
    world,
    worldEntities,
  });
  const coreLocationCategoryIds = collectWorldSpineCoreLocationPickerCategoryIds(world);
  const childLocationCategoryIds = collectWorldSpineChildLocationPickerCategoryIds(world);
  const location = uniqueStrings(
    coreLocationCategoryIds
      .flatMap((categoryId) => getCategoryOptions(entityNamesByCategory, categoryId)),
  ).sort((left, right) => left.localeCompare(right));
  const faction = getCategoryOptions(entityNamesByCategory, "faction");
  const vehicle = getCategoryOptions(entityNamesByCategory, "vehicle");
  const childLocationRecords = collectWorldSpineChildLocationRecords(worldEntityRecords, childLocationCategoryIds);
  const fixedChildLocationRecords = collectWorldSpineFixedChildLocationRecords(worldEntityRecords, childLocationCategoryIds);
  const childLocation = uniqueStrings(childLocationRecords.map((record) => record.label))
    .sort((left, right) => left.localeCompare(right));
  const fixedChildLocation = uniqueStrings([
    ...childLocationRecords.map((record) => record.label),
    ...fixedChildLocationRecords.map((record) => record.label),
  ]).sort((left, right) => left.localeCompare(right));
  const childLocationByParent = buildWorldSpineOptionsByParent(childLocationRecords);
  const fixedChildLocationByParent = buildWorldSpineOptionsByParent([
    ...childLocationRecords,
    ...fixedChildLocationRecords,
  ]);
  const placeByParent = buildWorldSpinePlaceOptionsByParent(location, fixedChildLocationByParent);
  const place = uniqueStrings([
    ...location,
    ...fixedChildLocation,
  ]).sort((left, right) => left.localeCompare(right));
  const all = uniqueStrings([
    ...character,
    ...Object.values(entityNamesByCategory).flat(),
  ]).sort((left, right) => left.localeCompare(right));
  const customOptionSets = buildCustomCataloguePickerOptionSets(entityNamesByCategory, customCatalogueCategories);

  return {
    all,
    artifact: getCategoryOptions(entityNamesByCategory, "artifact"),
    character,
    culture: getCategoryOptions(entityNamesByCategory, "culture"),
    faction,
    fauna: getCategoryOptions(entityNamesByCategory, "fauna"),
    flora: getCategoryOptions(entityNamesByCategory, "flora"),
    childLocation,
    childLocationByParent,
    fixedChildLocation,
    fixedChildLocationByParent,
    location,
    place,
    placeByParent,
    outfit: getCategoryOptions(entityNamesByCategory, "outfit"),
    planet: getCategoryOptions(entityNamesByCategory, "planet"),
    technology: getCategoryOptions(entityNamesByCategory, "technology"),
    vehicle,
    weapon: getCategoryOptions(entityNamesByCategory, "weapon"),
    ...customOptionSets,
    [PICKER_OPTION_SET_CATEGORY_META_KEY]: customCatalogueCategories,
  };
}

// Intent: let category-level world settings decide which catalogue classes can fill parent location fields.
function collectWorldSpineCoreLocationPickerCategoryIds(world = {}) {
  const source = resolveWorldSpineLocationThemeSource(world);
  const categoryIds = normalizeStringList(
    source?.coreLocationCategories ??
      source?.coreCategories ??
      source?.mainLocationCategories,
  );
  return categoryIds.length
    ? categoryIds.map(slugify).filter(Boolean)
    : [...DEFAULT_CORE_LOCATION_PICKER_CATEGORIES];
}

// Intent: let category-level world settings decide which catalogue classes can fill child-location fields.
function collectWorldSpineChildLocationPickerCategoryIds(world = {}) {
  const source = resolveWorldSpineLocationThemeSource(world);
  const categoryIds = normalizeStringList(
    source?.sublocationCategories ??
      source?.childLocationCategories ??
      source?.subLocationCategories,
  );
  return categoryIds.length
    ? categoryIds.map(slugify).filter(Boolean)
    : [...DEFAULT_CHILD_LOCATION_PICKER_CATEGORIES];
}

function resolveWorldSpineLocationThemeSource(world = {}) {
  return [
    world?.timelineSettings?.locationTheme,
    world?.locationTheme,
    world?.settings?.locationTheme,
  ].find((candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate)) ?? null;
}

export function getWorldSpinePickerOptionsForField(field = {}, optionSets = {}, context = {}) {
  const pickerType = resolveWorldSpinePickerTypeForField(field, optionSets);
  const parentLocation = resolveWorldSpinePickerParentLocation(field, context?.values);
  if (pickerType === "fixedChildLocation") {
    return getWorldSpineParentScopedOptions(optionSets?.fixedChildLocationByParent, parentLocation, {
      fallbackOptions: [],
    });
  }
  if (pickerType === "childLocation" && parentLocation) {
    return getWorldSpineParentScopedOptions(optionSets?.childLocationByParent, parentLocation, {
      fallbackOptions: [],
    });
  }
  if (pickerType === "place" && parentLocation) {
    return getWorldSpineParentScopedOptions(optionSets?.placeByParent, parentLocation, {
      fallbackOptions: uniqueStrings([
        parentLocation,
        ...getWorldSpineParentScopedOptions(optionSets?.fixedChildLocationByParent, parentLocation, {
          fallbackOptions: [],
        }),
      ]),
    });
  }
  if (pickerType === "place") {
    const mainLocationOptions = Array.isArray(optionSets?.location) ? optionSets.location : [];
    return uniqueStrings(mainLocationOptions).sort((left, right) => left.localeCompare(right));
  }

  const options = pickerType ? optionSets?.[pickerType] : [];
  return Array.isArray(options) ? options : [];
}

function resolveWorldSpinePickerParentLocation(field = {}, values = {}) {
  const fieldId = normalizeString(typeof field === "string" ? field : field?.id);
  const source = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  const explicitParent = normalizeString(
    source.parentPlace ??
    source.parentLocation ??
    source.mainLocation ??
    source.coreLocation,
  );
  if (explicitParent) {
    return explicitParent;
  }

  if (["childLocation", "childLocationLabel", "fixedChildLocation", "sublocation", "subLocation", "home"].includes(fieldId)) {
    return normalizeString(source.location ?? source.locationLabel ?? source.eventLocationLabel);
  }
  return "";
}

function getWorldSpineParentScopedOptions(optionsByParent = {}, parentLocation = "", {
  fallbackOptions = [],
} = {}) {
  const parentKey = slugify(parentLocation);
  if (!parentKey) {
    return [];
  }

  const scopedOptions = optionsByParent && typeof optionsByParent === "object" && !Array.isArray(optionsByParent)
    ? optionsByParent[parentKey]
    : [];
  return Array.isArray(scopedOptions) && scopedOptions.length
    ? scopedOptions
    : uniqueStrings(Array.isArray(fallbackOptions) ? fallbackOptions : [])
      .sort((left, right) => left.localeCompare(right));
}

// Intent: derive fixed child-location suggestions from child-location catalogue records and per-item fixed-location fields.
function collectWorldSpineChildLocationRecords(entities = [], childLocationCategoryIds = []) {
  const childCategorySet = new Set(normalizeStringList(childLocationCategoryIds).map(slugify));
  return (Array.isArray(entities) ? entities : [])
    .map((entity) => {
      const categoryId = resolveWorldEntityCategoryId(entity);
      if (!childCategorySet.has(categoryId)) {
        return null;
      }

      return {
        label: normalizeString(entity?.name),
        parentLabel: readWorldEntityFieldString(entity, PARENT_LOCATION_FIELD_KEYS),
      };
    })
    .filter((record) => record?.label);
}

function collectWorldSpineFixedChildLocationRecords(entities = [], childLocationCategoryIds = []) {
  const childCategorySet = new Set(normalizeStringList(childLocationCategoryIds).map(slugify));
  return (Array.isArray(entities) ? entities : [])
    .flatMap((entity) => {
      const parentLabel = readWorldEntityFieldString(entity, PARENT_LOCATION_FIELD_KEYS);
      const fixedChildLocations = normalizeStringList(readWorldEntityFieldString(entity, FIXED_CHILD_LOCATION_FIELD_KEYS));
      const isChildLocationEntity = childCategorySet.has(resolveWorldEntityCategoryId(entity));
      return fixedChildLocations.map((label) => ({
        label,
        parentLabel,
        sourceEntityLabel: isChildLocationEntity ? "" : normalizeString(entity?.name),
      }));
    })
    .filter((record) => record.label && record.parentLabel);
}

function buildWorldSpineOptionsByParent(records = []) {
  const grouped = {};
  for (const record of Array.isArray(records) ? records : []) {
    const parentKey = slugify(record?.parentLabel);
    const label = normalizeString(record?.label);
    if (!parentKey || !label) {
      continue;
    }

    grouped[parentKey] = Array.isArray(grouped[parentKey]) ? grouped[parentKey] : [];
    grouped[parentKey].push(label);
  }

  return Object.fromEntries(
    Object.entries(grouped)
      .map(([parentKey, options]) => [
        parentKey,
        uniqueStrings(options).sort((left, right) => left.localeCompare(right)),
      ]),
  );
}

function buildWorldSpinePlaceOptionsByParent(locationOptions = [], fixedChildLocationByParent = {}) {
  const placesByParent = {};
  for (const parentLocation of Array.isArray(locationOptions) ? locationOptions : []) {
    const parentKey = slugify(parentLocation);
    if (!parentKey) {
      continue;
    }

    placesByParent[parentKey] = uniqueStrings([
      parentLocation,
      ...(Array.isArray(fixedChildLocationByParent?.[parentKey]) ? fixedChildLocationByParent[parentKey] : []),
    ]).sort((left, right) => left.localeCompare(right));
  }
  return placesByParent;
}

// Intent: let author-created catalogue categories behave like built-in picker categories.
function buildCustomCataloguePickerOptionSets(entityNamesByCategory = {}, customCatalogueCategories = []) {
  return (Array.isArray(customCatalogueCategories) ? customCatalogueCategories : []).reduce((sets, category) => {
    const categoryId = normalizeString(category?.id);
    const options = getCategoryOptions(entityNamesByCategory, categoryId);
    if (!categoryId || !options.length) {
      return sets;
    }

    sets[categoryId] = options;
    const labelKey = slugify(category?.label);
    if (labelKey && !sets[labelKey]) {
      sets[labelKey] = options;
    }
    return sets;
  }, {});
}

function collectWorldCatalogueCategoryDescriptors(categories = []) {
  const usedIds = new Set();
  return (Array.isArray(categories) ? categories : [])
    .map((category) => {
      const label = normalizeString(category?.label ?? category?.name);
      const id = normalizeString(category?.id) || slugify(label);
      if (!id || !label || usedIds.has(id)) {
        return null;
      }

      usedIds.add(id);
      return {
        id,
        label,
        templateName: normalizeString(category?.templateName) || label,
      };
    })
    .filter(Boolean);
}

function resolveCustomWorldSpinePickerTypeForField(field = {}, optionSets = {}) {
  const customCatalogueCategories = Array.isArray(optionSets?.[PICKER_OPTION_SET_CATEGORY_META_KEY])
    ? optionSets[PICKER_OPTION_SET_CATEGORY_META_KEY]
    : [];
  if (!customCatalogueCategories.length) {
    return "";
  }

  const fieldTokens = new Set(createCatalogueMatcherTokens([
    field.id,
    field.label,
    normalizeString(field.id).replace(/^metadata[-_.:]+/i, ""),
  ]));
  for (const category of customCatalogueCategories) {
    const categoryId = normalizeString(category?.id);
    if (!categoryId || !Array.isArray(optionSets?.[categoryId]) || !optionSets[categoryId].length) {
      continue;
    }

    const categoryTokens = createCatalogueMatcherTokens([
      categoryId,
      category?.label,
      category?.templateName,
    ]);
    if (categoryTokens.some((token) => fieldTokens.has(token))) {
      return categoryId;
    }
  }
  return "";
}

function createCatalogueMatcherTokens(values = []) {
  return uniqueStrings(
    (Array.isArray(values) ? values : [])
      .flatMap((value) => {
        const text = normalizeString(value);
        const singular = text.replace(/ies$/i, "y").replace(/s$/i, "");
        return [
          text,
          singular,
          slugify(text),
          slugify(singular),
        ];
      })
      .filter(Boolean),
  ).map((token) => token.toLowerCase());
}

function collectCharacterRecordNames(records = []) {
  return (Array.isArray(records) ? records : [])
    .flatMap((record) => {
      if (typeof record === "string") {
        return [record];
      }

      return [
        record?.name,
        record?.displayName,
        record?.fullName,
        ...normalizeStringList(record?.aliasList),
        ...normalizeStringList(record?.aliases),
      ];
    })
    .map(normalizeString)
    .filter(Boolean);
}

function collectWorldCharacterEntityNames(entities = []) {
  return (Array.isArray(entities) ? entities : [])
    .filter(isWorldCharacterEntity)
    .flatMap((entity) => [
      entity?.name,
      ...normalizeStringList(entity?.aliases),
      ...normalizeStringList(entity?.aliasList),
    ])
    .map(normalizeString)
    .filter(Boolean);
}

function isWorldCharacterEntity(entity = {}) {
  return resolveWorldEntityCategoryId(entity) === "character";
}

function collectWorldEntityNamesByCategory(entities = []) {
  return (Array.isArray(entities) ? entities : []).reduce((groups, entity) => {
    const categoryId = resolveWorldEntityCategoryId(entity);
    const name = normalizeString(entity?.name);
    if (!categoryId || !name) {
      return groups;
    }

    groups[categoryId] = Array.isArray(groups[categoryId]) ? groups[categoryId] : [];
    groups[categoryId].push(name);
    return groups;
  }, {});
}

function getCategoryOptions(entityNamesByCategory = {}, categoryId = "") {
  return uniqueStrings(entityNamesByCategory[categoryId] ?? [])
    .sort((left, right) => left.localeCompare(right));
}

function resolveWorldEntityCategoryId(entity = {}) {
  const explicitCategoryId = normalizeString(entity?.categoryId);
  if (explicitCategoryId) {
    return slugify(explicitCategoryId);
  }

  const fieldCategory = (Array.isArray(entity?.fields) ? entity.fields : [])
    .find((field) => normalizeString(field?.label ?? field?.key).toLowerCase() === "category");
  const categoryText = [
    entity?.categoryLabel,
    entity?.templateName,
    entity?.kind,
    fieldCategory?.value,
    entity?.sourcePath,
    entity?.scrivenerBinderPath,
  ].map(normalizeString).join(" ");
  if (CHARACTER_ENTITY_PATTERN.test(categoryText)) {
    return "character";
  }

  return WORLD_ENTITY_CATEGORY_PATTERNS.find((entry) => entry.pattern.test(categoryText))?.categoryId ?? "";
}

// Intent: read catalogue field DTOs and legacy map/top-level values through the same key aliases.
function readWorldEntityFieldString(entity = {}, keys = []) {
  const normalizedKeys = new Set((Array.isArray(keys) ? keys : []).map(normalizeFieldKey).filter(Boolean));
  if (!normalizedKeys.size) {
    return "";
  }

  for (const key of Array.isArray(keys) ? keys : []) {
    const value = normalizeString(entity?.[key]);
    if (value) {
      return value;
    }
  }

  const fieldValueMaps = [
    entity?.fieldValues,
    entity?.values,
    entity?.fields && !Array.isArray(entity.fields) ? entity.fields : null,
    entity?.metadata?.fieldValues,
  ].filter((source) => source && typeof source === "object" && !Array.isArray(source));
  for (const source of fieldValueMaps) {
    for (const [key, value] of Object.entries(source)) {
      if (normalizedKeys.has(normalizeFieldKey(key))) {
        const normalizedValue = normalizeString(value);
        if (normalizedValue) {
          return normalizedValue;
        }
      }
    }
  }

  for (const field of Array.isArray(entity?.fields) ? entity.fields : []) {
    const fieldKeys = [field?.key, field?.id, field?.name, field?.label].map(normalizeFieldKey);
    if (fieldKeys.some((key) => normalizedKeys.has(key))) {
      const normalizedValue = normalizeString(field?.value ?? field?.text);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
  }

  return "";
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]+/)
      : [];
  return source.map(normalizeString).filter(Boolean);
}

function uniqueStrings(values = []) {
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

function normalizeString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeFieldKey(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
