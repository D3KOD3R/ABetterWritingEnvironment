// Intent: own scene-level World Spine metadata form models and draft patches outside the app shell.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  buildWorldSpineCharacterOptions,
  getWorldSpinePickerOptionsForField,
  resolveWorldSpinePickerTypeForField,
} from "./world-spine-character-options.js";

const WORLD_SPINE_METADATA_LIST_FIELDS = Object.freeze(["peoplePresent", "sceneBeats", "criticalEvents", "locationChanges"]);
const CUSTOM_METADATA_FIELD_PREFIX = "customMetadata.";
// Intent: keep empty form guidance generic so seeded examples never expose a specific author's book data.
const WORLD_SPINE_METADATA_PLACEHOLDERS = Object.freeze({
  location: "Where does the event take place?",
  sublocation: "Child place, ship, room, facility, orbit, or local stage",
  orbitalBand: "Low orbit, high orbit, surface, docked, in transit",
  date: "YYYY-MM-DD",
  time: "HH:MM",
  peoplePresent: "Who is present?",
  sceneBeats: "List the major beats in this scene.",
  criticalEvents: "What critical events happen here?",
  locationChanges: "Where does the action move?",
});

// Intent: keep scene metadata compact and predictable for timeline rendering.
export function normalizeSceneWorldSpineMetadata(candidate = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};

  return {
    location: normalizeString(source.location ?? source.storyLocation ?? source.place ?? source.setting),
    sublocation: normalizeString(source.childLocation ?? source.childLocationLabel ?? source.sublocation ?? source.subLocation ?? source.specificLocation ?? source.localPlace ?? source.ship ?? source.vehicle),
    orbitalBand: normalizeString(source.orbitalBand ?? source.orbit ?? source.orbitalPosition ?? source.position),
    locationRowLabel: normalizeString(source.locationRowLabel ?? source.locationRow?.label ?? source.timelineRow?.label),
    locationRowKey: normalizeString(source.locationRowKey ?? source.locationRow?.key ?? source.timelineRow?.key),
    locationScope: normalizeString(source.locationScope ?? source.locationRow?.scope ?? source.timelineRow?.scope),
    date: normalizeString(source.date ?? source.storyDate ?? source.timelineDate ?? source.chronologyDate),
    time: normalizeString(source.time ?? source.storyTime ?? source.timelineTime ?? source.chronologyTime),
    peoplePresent: normalizeList(source.peoplePresent ?? source.people ?? source.charactersPresent ?? source.characters),
    sceneBeats: normalizeList(source.sceneBeats ?? source.sceneBeat ?? source.beats ?? source.beatSheet ?? source.storyBeats),
    criticalEvents: normalizeList(source.criticalEvents ?? source.criticalEvent ?? source.importantEvents ?? source.majorEvents),
    locationChanges: normalizeList(source.locationChanges ?? source.locationChange ?? source.settingChanges ?? source.placeChanges),
    customMetadata: normalizeCustomMetadataValueMap(source.customMetadata),
  };
}

// Intent: merge all supported scene metadata sources before showing the author the editable World Spine fields.
export function buildSceneWorldSpineMetadataMenuModel({
  scene = null,
  draft = null,
  expanded = false,
  characterOptions = [],
  customMetadataDefinitions = [],
  pickerOptionSets = {},
} = {}) {
  const sceneMetadata = collectSceneWorldSpineMetadataSources(scene);
  const draftMetadata = collectSceneWorldSpineMetadataSources(draft);
  const metadata = normalizeSceneWorldSpineMetadata({
    ...sceneMetadata,
    ...draftMetadata,
  });

  return {
    expanded: expanded === true,
    sceneId: normalizeString(scene?.sceneId ?? draft?.sceneId),
    sceneTitle: normalizeString(draft?.sceneTitle ?? scene?.sceneTitle) || "Untitled scene",
    metadata,
    characterOptions: buildWorldSpineCharacterOptions({ characters: characterOptions }),
    customMetadataDefinitions: normalizeCustomMetadataDefinitionsForWorldSpine(customMetadataDefinitions),
    pickerOptionSets: normalizeSceneWorldSpinePickerOptionSets(pickerOptionSets),
    hasMetadata: hasSceneWorldSpineMetadata(metadata),
  };
}

// Intent: render either the compact entry button or the editable metadata fields inside the scene menu.
export function renderSceneWorldSpineMetadataMenuHTML(model = {}) {
  const sceneId = normalizeString(model.sceneId);
  if (!sceneId) {
    return "";
  }

  if (model.expanded) {
    return renderSceneWorldSpineMetadataFormHTML(model);
  }

  return `
    <button
      class="task-menu-item binder-world-spine-button"
      type="button"
      data-action="open-scene-world-spine-metadata"
      data-scene-id="${escapeHtml(sceneId)}"
      role="menuitem"
    >
      <span class="task-menu-icon" aria-hidden="true">W</span>
      <span>World Spine</span>
      ${model.hasMetadata ? `<strong>Set</strong>` : ""}
    </button>
  `;
}

// Intent: convert raw form values into the saved draft metadata shape.
export function buildSceneWorldSpineMetadataFromFormValues(values = {}) {
  const customMetadata = {};
  for (const [key, value] of Object.entries(values && typeof values === "object" ? values : {})) {
    if (!key.startsWith(CUSTOM_METADATA_FIELD_PREFIX)) {
      continue;
    }

    const definitionId = normalizeString(key.slice(CUSTOM_METADATA_FIELD_PREFIX.length));
    const text = normalizeString(value);
    if (definitionId && text) {
      customMetadata[definitionId] = text;
    }
  }

  return normalizeSceneWorldSpineMetadata({
    location: values.location,
    sublocation: values.childLocation ?? values.sublocation,
    orbitalBand: values.orbitalBand,
    date: values.date,
    time: values.time,
    peoplePresent: values.peoplePresent,
    sceneBeats: values.sceneBeats,
    criticalEvents: values.criticalEvents,
    locationChanges: values.locationChanges,
    customMetadata,
  });
}

// Intent: apply metadata to a scene draft without changing manuscript text or scene identity.
export function applySceneWorldSpineMetadataToDraft(scene = {}, draft = {}, metadata = {}) {
  const baseDraft = draft && typeof draft === "object" && !Array.isArray(draft)
    ? { ...draft }
    : { ...scene };
  const normalizedMetadata = normalizeSceneWorldSpineMetadata(metadata);

  return {
    ...baseDraft,
    sceneId: normalizeString(baseDraft.sceneId ?? scene?.sceneId),
    sceneTitle: normalizeString(baseDraft.sceneTitle ?? scene?.sceneTitle),
    location: normalizedMetadata.location,
    childLocation: normalizedMetadata.sublocation,
    childLocationLabel: normalizedMetadata.sublocation,
    sublocation: normalizedMetadata.sublocation,
    orbitalBand: normalizedMetadata.orbitalBand,
    locationRowLabel: normalizedMetadata.locationRowLabel,
    locationRowKey: normalizedMetadata.locationRowKey,
    locationScope: normalizedMetadata.locationScope,
    worldSpineMetadata: {
      ...normalizedMetadata,
      childLocation: normalizedMetadata.sublocation,
      childLocationLabel: normalizedMetadata.sublocation,
    },
  };
}

function renderSceneWorldSpineMetadataFormHTML(model = {}) {
  const metadata = normalizeSceneWorldSpineMetadata(model.metadata);
  const sceneId = normalizeString(model.sceneId);
  const characterOptions = buildWorldSpineCharacterOptions({ characters: model.characterOptions });
  const characterListId = createSceneWorldSpineCharacterListId(sceneId);
  const customMetadataDefinitions = normalizeCustomMetadataDefinitionsForWorldSpine(model.customMetadataDefinitions);
  const pickerOptionSets = normalizeSceneWorldSpinePickerOptionSets(model.pickerOptionSets);

  return `
    <form
      class="binder-world-spine-form has-form-dismiss"
      data-scene-world-spine-metadata-form
      data-scene-id="${escapeHtml(sceneId)}"
    >
      <button
        class="form-dismiss-button binder-world-spine-form__dismiss"
        type="button"
        data-action="close-scene-world-spine-metadata"
        data-scene-id="${escapeHtml(sceneId)}"
        aria-label="Cancel World Spine metadata form"
        title="Cancel"
      >&times;</button>
      <div class="binder-world-spine-form__heading">
        <span>World Spine</span>
        <strong>${escapeHtml(model.sceneTitle || "Scene metadata")}</strong>
      </div>
      ${renderTextField("location", "Location", metadata.location, WORLD_SPINE_METADATA_PLACEHOLDERS.location)}
      ${renderTextField("sublocation", "Child location", metadata.sublocation, WORLD_SPINE_METADATA_PLACEHOLDERS.sublocation, {
        listId: getSceneWorldSpineStaticPickerListId(sceneId, "sublocation", pickerOptionSets),
        pickerClass: "has-catalogue-picker",
      })}
      ${renderTextField("orbitalBand", "Orbital position", metadata.orbitalBand, WORLD_SPINE_METADATA_PLACEHOLDERS.orbitalBand)}
      ${renderTextField("date", "Date", metadata.date, WORLD_SPINE_METADATA_PLACEHOLDERS.date)}
      ${renderTextField("time", "Time", metadata.time, WORLD_SPINE_METADATA_PLACEHOLDERS.time)}
      ${renderTextField("peoplePresent", "People present", metadata.peoplePresent, WORLD_SPINE_METADATA_PLACEHOLDERS.peoplePresent, {
        listId: characterOptions.length ? characterListId : "",
        pickerClass: "has-character-picker",
      })}
      ${renderSceneWorldSpineCharacterDatalist(characterListId, characterOptions)}
      ${renderTextAreaField("sceneBeats", "Scene beats", metadata.sceneBeats, WORLD_SPINE_METADATA_PLACEHOLDERS.sceneBeats)}
      ${renderTextAreaField("criticalEvents", "Critical events", metadata.criticalEvents, WORLD_SPINE_METADATA_PLACEHOLDERS.criticalEvents)}
      ${renderTextAreaField("locationChanges", "Location changes", metadata.locationChanges, WORLD_SPINE_METADATA_PLACEHOLDERS.locationChanges)}
      ${renderCustomMetadataFields(customMetadataDefinitions, metadata.customMetadata, {
        sceneId,
        pickerOptionSets,
      })}
      ${renderSceneWorldSpineStaticDatalists(sceneId, pickerOptionSets)}
      ${renderSceneWorldSpineCatalogueDatalists(sceneId, customMetadataDefinitions, pickerOptionSets)}
      <div class="binder-world-spine-form__actions">
        <button
          class="tag-button panel-action-button"
          type="button"
          data-action="save-scene-world-spine-metadata"
          data-scene-id="${escapeHtml(sceneId)}"
        >Save</button>
      </div>
    </form>
  `;
}

function renderCustomMetadataFields(definitions = [], customMetadata = {}, {
  sceneId = "",
  pickerOptionSets = {},
} = {}) {
  const safeDefinitions = normalizeCustomMetadataDefinitionsForWorldSpine(definitions);
  if (!safeDefinitions.length) {
    return "";
  }

  return `
    <div class="binder-world-spine-form__custom-fields">
      <span>Custom metadata</span>
      ${safeDefinitions.map((definition) => renderCustomMetadataField(definition, customMetadata[definition.id] ?? "", {
        sceneId,
        pickerOptionSets,
      })).join("")}
    </div>
  `;
}

function renderCustomMetadataField(definition = {}, value = "", {
  sceneId = "",
  pickerOptionSets = {},
} = {}) {
  const fieldId = `${CUSTOM_METADATA_FIELD_PREFIX}${definition.id}`;
  const pickerListId = getSceneWorldSpineCatalogueListIdForField(sceneId, definition, pickerOptionSets);
  if (!pickerListId) {
    return renderTextAreaField(
      fieldId,
      definition.label,
      value,
      `${definition.label} for this scene`,
    );
  }

  return renderTextField(
    fieldId,
    definition.label,
    value,
    `${definition.label} for this scene`,
    {
      listId: pickerListId,
      pickerClass: "has-catalogue-picker",
    },
  );
}

function renderTextField(fieldId, label, value, placeholder, { listId = "", pickerClass = "" } = {}) {
  const text = Array.isArray(value) ? value.join(", ") : normalizeString(value);
  const listAttribute = listId
    ? ` list="${escapeHtml(listId)}" autocomplete="off"`
    : "";
  return `
    <label class="binder-world-spine-field ${listAttribute ? pickerClass : ""}">
      <span>${escapeHtml(label)}</span>
      <input
        type="text"
        data-scene-world-spine-field="${escapeHtml(fieldId)}"
        value="${escapeHtml(text)}"
        placeholder="${escapeHtml(placeholder)}"
        ${listAttribute}
      />
    </label>
  `;
}

function renderSceneWorldSpineCharacterDatalist(listId, characterOptions = []) {
  const options = uniqueStrings((Array.isArray(characterOptions) ? characterOptions : []).map(normalizeString).filter(Boolean));
  if (!listId || !options.length) {
    return "";
  }

  return `
    <datalist id="${escapeHtml(listId)}" data-scene-world-spine-character-options>
      ${options.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}
    </datalist>
  `;
}

function createSceneWorldSpineCharacterListId(sceneId = "") {
  return `scene-world-spine-character-options-${slugify(sceneId) || "scene"}`;
}

// Intent: let scene sublocations reuse catalogue places and vehicles without forcing a closed picker.
function renderSceneWorldSpineStaticDatalists(sceneId = "", pickerOptionSets = {}) {
  return renderSceneWorldSpinePickerDatalist(
    createSceneWorldSpineStaticListId(sceneId, "sublocation"),
    collectSceneWorldSpineSublocationOptions(pickerOptionSets),
  );
}

function getSceneWorldSpineStaticPickerListId(sceneId = "", fieldId = "", pickerOptionSets = {}) {
  if (fieldId !== "sublocation" || !collectSceneWorldSpineSublocationOptions(pickerOptionSets).length) {
    return "";
  }

  return createSceneWorldSpineStaticListId(sceneId, fieldId);
}

function createSceneWorldSpineStaticListId(sceneId = "", fieldId = "") {
  return `scene-world-spine-${slugify(fieldId) || "field"}-options-${slugify(sceneId) || "scene"}`;
}

function collectSceneWorldSpineSublocationOptions(pickerOptionSets = {}) {
  const childLocationOptions = Array.isArray(pickerOptionSets?.childLocation)
    ? pickerOptionSets.childLocation
    : [];
  if (childLocationOptions.length) {
    return uniqueStrings(childLocationOptions);
  }

  return uniqueStrings([
    ...(Array.isArray(pickerOptionSets?.location) ? pickerOptionSets.location : []),
    ...(Array.isArray(pickerOptionSets?.vehicle) ? pickerOptionSets.vehicle : []),
  ]);
}

// Intent: expose catalogue records as type-filtering options for matching custom event metadata fields.
function renderSceneWorldSpineCatalogueDatalists(sceneId = "", definitions = [], pickerOptionSets = {}) {
  const pickerTypes = uniqueStrings(
    normalizeCustomMetadataDefinitionsForWorldSpine(definitions)
      .map((definition) => resolveWorldSpinePickerTypeForField(definition, pickerOptionSets))
      .filter(Boolean),
  );
  return pickerTypes
    .map((pickerType) => renderSceneWorldSpinePickerDatalist(
      createSceneWorldSpineCatalogueListId(sceneId, pickerType),
      pickerOptionSets?.[pickerType],
    ))
    .join("");
}

function renderSceneWorldSpinePickerDatalist(listId = "", options = []) {
  const normalizedOptions = uniqueStrings((Array.isArray(options) ? options : []).map(normalizeString).filter(Boolean));
  if (!listId || !normalizedOptions.length) {
    return "";
  }

  return `
    <datalist id="${escapeHtml(listId)}" data-scene-world-spine-catalogue-options>
      ${normalizedOptions.map((option) => `<option value="${escapeHtml(option)}"></option>`).join("")}
    </datalist>
  `;
}

function getSceneWorldSpineCatalogueListIdForField(sceneId = "", field = {}, pickerOptionSets = {}) {
  const pickerType = resolveWorldSpinePickerTypeForField(field, pickerOptionSets);
  return pickerType && getWorldSpinePickerOptionsForField(field, pickerOptionSets).length
    ? createSceneWorldSpineCatalogueListId(sceneId, pickerType)
    : "";
}

function createSceneWorldSpineCatalogueListId(sceneId = "", pickerType = "") {
  return `scene-world-spine-catalogue-options-${slugify(sceneId) || "scene"}-${slugify(pickerType) || "catalogue"}`;
}

function renderTextAreaField(fieldId, label, value, placeholder) {
  const text = Array.isArray(value) ? value.join(", ") : normalizeString(value);
  return `
    <label class="binder-world-spine-field">
      <span>${escapeHtml(label)}</span>
      <textarea
        rows="2"
        data-scene-world-spine-field="${escapeHtml(fieldId)}"
        placeholder="${escapeHtml(placeholder)}"
      >${escapeHtml(text)}</textarea>
    </label>
  `;
}

function collectSceneWorldSpineMetadataSources(record = null) {
  const source = record && typeof record === "object" && !Array.isArray(record)
    ? record
    : {};
  const customMetadata = collectSceneCustomMetadataSource(source);
  return {
    ...pickPlainObject(source.metadata?.worldSpine),
    ...pickPlainObject(source.metadata?.timeline),
    ...pickPlainObject(source.worldMetadata),
    ...pickPlainObject(source.timelineMetadata),
    ...pickPlainObject(source.worldSpineMetadata),
    ...(Object.keys(customMetadata).length ? { customMetadata } : {}),
    ...pickKnownTopLevelMetadata(source),
  };
}

function collectSceneCustomMetadataSource(source = {}) {
  return {
    ...pickPlainObject(source.metadata?.customMetadata),
    ...pickPlainObject(source.metadata?.worldSpine?.customMetadata),
    ...pickPlainObject(source.worldSpineMetadata?.customMetadata),
    ...pickPlainObject(source.customMetadata),
  };
}

function pickKnownTopLevelMetadata(source = {}) {
  const metadata = {};
  for (const key of [
    "location",
    "storyLocation",
    "place",
    "setting",
    "childLocation",
    "childLocationLabel",
    "sublocation",
    "subLocation",
    "specificLocation",
    "localPlace",
    "ship",
    "vehicle",
    "orbitalBand",
    "orbit",
    "orbitalPosition",
    "position",
    "locationRowLabel",
    "locationRowKey",
    "locationScope",
    "date",
    "storyDate",
    "timelineDate",
    "chronologyDate",
    "time",
    "storyTime",
    "timelineTime",
    "chronologyTime",
    "people",
    "peoplePresent",
    "characters",
    "charactersPresent",
    "sceneBeats",
    "sceneBeat",
    "beats",
    "beatSheet",
    "storyBeats",
    "criticalEvents",
    "criticalEvent",
    "importantEvents",
    "majorEvents",
    "locationChanges",
    "locationChange",
    "settingChanges",
    "placeChanges",
  ]) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      metadata[key] = source[key];
    }
  }
  return metadata;
}

function pickPlainObject(candidate = null) {
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? { ...candidate }
    : {};
}

function hasSceneWorldSpineMetadata(metadata = {}) {
  const normalized = normalizeSceneWorldSpineMetadata(metadata);
  return Boolean(
    normalized.location ||
    normalized.sublocation ||
    normalized.orbitalBand ||
    normalized.locationRowLabel ||
    normalized.date ||
    normalized.time ||
    WORLD_SPINE_METADATA_LIST_FIELDS.some((fieldId) => normalized[fieldId].length > 0) ||
    Object.keys(normalized.customMetadata).length > 0
  );
}

function normalizeCustomMetadataDefinitionsForWorldSpine(definitions = []) {
  const source = Array.isArray(definitions) ? definitions : [];
  const usedIds = new Set();
  const normalizedDefinitions = [];
  for (const definition of source) {
    const id = normalizeString(definition?.id);
    const label = normalizeString(definition?.label ?? definition?.name);
    if (!id || !label || usedIds.has(id)) {
      continue;
    }

    usedIds.add(id);
    normalizedDefinitions.push({
      id,
      label,
    });
  }
  return normalizedDefinitions;
}

function normalizeSceneWorldSpinePickerOptionSets(optionSets = {}) {
  return optionSets && typeof optionSets === "object" && !Array.isArray(optionSets)
    ? optionSets
    : {};
}

function normalizeCustomMetadataValueMap(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const result = {};
  for (const [key, rawValue] of Object.entries(source)) {
    const id = normalizeString(key);
    const text = normalizeString(rawValue);
    if (id && text) {
      result[id] = text;
    }
  }
  return result;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map(normalizeString).filter(Boolean));
  }

  if (typeof value === "string") {
    return uniqueStrings(value.split(/[\n,;|]+/).map(normalizeString).filter(Boolean));
  }

  return [];
}

function normalizeString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
