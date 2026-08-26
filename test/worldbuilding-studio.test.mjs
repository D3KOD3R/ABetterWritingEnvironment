// Intent: verify Dream Scaping worldbuilding forms create structured catalogue items and draggable timeline drafts.
import assert from "node:assert/strict";

import {
  addParallelWorldSpine,
  applyWorldSpineLocationImageToWorld,
  applyWorldSpineLocationRowNameToWorld,
  applyWorldSpineLocationRowUnplacementToWorld,
  applyWorldbuildingCategoryLocationRoleToWorld,
  applyWorldbuildingCatalogueItemImageToWorld,
  applyWorldbuildingItemToWorld,
  buildWorldSpineLocationImageIndex,
  buildWorldbuildingCatalogueImageMediaPath,
  buildWorldbuildingItemFromFormValues,
  buildWorldbuildingRelatedCatalogueCardsModel,
  buildWorldbuildingStudioModel,
  createWorldbuildingCatalogueImageSource,
  createWorldbuildingCatalogueEditFormState,
  deleteWorldbuildingCatalogueItemFromWorld,
  dropWorldbuildingEventDraftOnWorldSpine,
  normalizeWorldbuildingCatalogueImage,
  ensureDualWorldSpine,
  renderWorldbuildingEventDraftPlacementPreviewHTML,
  renderWorldbuildingStudioHTML,
  validateWorldbuildingCatalogueImageFile,
} from "../apps/editor/public/features/world-spine/worldbuilding-studio.js";
import {
  getWorldSpinePickerOptionsForField,
} from "../apps/editor/public/features/world-spine/world-spine-character-options.js";

export function runWorldbuildingStudioTest() {
  const imageDataUrl = "data:image/png;base64,aGVsbG8=";
  const catalogueImage = normalizeWorldbuildingCatalogueImage({
    dataUrl: imageDataUrl,
    mediaType: "image/png",
    name: "khepri.png",
    size: 5,
  });
  const emptyWorld = {
    title: "Project Serva Vitae World",
    entities: [],
    spines: [],
  };
  const model = buildWorldbuildingStudioModel({
    world: emptyWorld,
    activeCategoryId: "event",
  });
  assert.equal(model.activeCategory.id, "event");
  assert.equal(model.isFormOpen, true);
  assert.equal(model.categories.some((category) => category.id === "fauna"), true);

  const html = renderWorldbuildingStudioHTML(model);
  assert.match(html, /data-worldbuilding-studio/);
  assert.match(html, /data-action="open-worldbuilding-catalogue"/);
  assert.match(html, /worldbuilding-studio__rhs-actions/);
  assert.match(html, /data-action="open-worldbuilding-custom-catalogue-item"/);
  assert.match(html, /aria-label="Add custom catalogue item"/);
  assert.match(html, /View Event catalogue; 0 items\. Right-click to add Event\./);
  assert.match(html, /worldbuilding-category-button__icon/);
  assert.match(html, /worldbuilding-category-button__count/);
  assert.match(html, /data-worldbuilding-category-count="0"/);
  assert.match(html, /data-worldbuilding-field="charactersPresent"/);
  assert.match(html, /worldbuilding-entry-popover/);
  assert.match(html, /data-worldbuilding-entry-popover/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /placeholder="Enter event title"/);
  assert.match(html, /placeholder="Enter characters present"/);
  assert.doesNotMatch(html, /Signal under the ice/);
  assert.doesNotMatch(html, /John, Ava/);
  assert.match(html, /form-dismiss-button worldbuilding-form__dismiss/);
  assert.match(html, /data-action="cancel-worldbuilding-item"/);
  assert.doesNotMatch(html, />Cancel<\/button>/);
  assert.doesNotMatch(html, /Timeline Drafts/);
  assert.doesNotMatch(html, /No catalogue items yet/);
  assert.doesNotMatch(html, /worldbuilding-catalogue-strip/);

  const characterPickerWorld = {
    ...emptyWorld,
    entities: [
      { id: "entity-ava", name: "Ava Meerakavita", categoryId: "character", templateName: "Character" },
      { id: "entity-khepri", name: "Khepri", categoryId: "planet", templateName: "Planet" },
    ],
  };
  const vehiclePickerHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: characterPickerWorld,
    projectCharacters: [{ id: "character-john", name: "John Walker", aliasList: ["Captain John"] }],
    activeCategoryId: "vehicle",
  }));
  assert.match(vehiclePickerHtml, /data-worldbuilding-field="crew"[\s\S]*list="worldbuilding-character-options-vehicle"/);
  assert.match(vehiclePickerHtml, /data-worldbuilding-field="captain"[\s\S]*list="worldbuilding-character-options-vehicle"/);
  assert.match(vehiclePickerHtml, /data-worldbuilding-field="fixedChildLocation"[\s\S]*list="worldbuilding-fixedchildlocation-options-vehicle"/);
  assert.match(vehiclePickerHtml, /data-worldbuilding-field="parentPlace"[\s\S]*list="worldbuilding-location-options-vehicle"/);
  assert.match(vehiclePickerHtml, /data-worldbuilding-picker-options/);
  assert.match(vehiclePickerHtml, /<option value="Ava Meerakavita"><\/option>/);
  assert.match(vehiclePickerHtml, /<option value="John Walker"><\/option>/);
  assert.match(vehiclePickerHtml, /<option value="Captain John"><\/option>/);
  assert.doesNotMatch(
    vehiclePickerHtml.match(/<datalist id="worldbuilding-character-options-vehicle"[\s\S]*?<\/datalist>/)?.[0] ?? "",
    /<option value="Khepri"><\/option>/,
  );

  const typedPickerWorld = {
    ...emptyWorld,
    entities: [
      { id: "entity-ava", name: "Ava Meerakavita", categoryId: "character", templateName: "Character" },
      { id: "entity-council", name: "Oasian Council", categoryId: "faction", templateName: "Faction" },
      { id: "entity-khepri", name: "Khepri", categoryId: "planet", templateName: "Planet" },
      { id: "entity-europa", name: "Europa", categoryId: "planet", templateName: "Planet" },
      {
        id: "entity-dock",
        name: "Ceres Dock",
        categoryId: "location",
        templateName: "Location",
        fields: [{ key: "parentPlace", label: "Parent location", value: "Khepri" }],
      },
      {
        id: "entity-icarus",
        name: "The Icarus",
        categoryId: "vehicle",
        templateName: "Vehicle",
        fields: [
          { key: "parentPlace", label: "Parent location", value: "Khepri" },
          { key: "fixedChildLocation", label: "Fixed child location", value: "Icarus Berth" },
        ],
      },
      {
        id: "entity-europa-dock",
        name: "Europa Dock",
        categoryId: "location",
        templateName: "Location",
        fields: [{ key: "parentPlace", label: "Parent location", value: "Europa" }],
      },
    ],
  };
  const typedPickerOptionSets = buildWorldbuildingStudioModel({ world: typedPickerWorld }).pickerOptionSets;
  assert.deepEqual(typedPickerOptionSets.location, ["Europa", "Khepri"]);
  assert.deepEqual(typedPickerOptionSets.childLocation, ["Ceres Dock", "Europa Dock", "The Icarus"]);
  assert.deepEqual(typedPickerOptionSets.fixedChildLocationByParent.khepri, ["Ceres Dock", "Icarus Berth", "The Icarus"]);
  assert.deepEqual(
    getWorldSpinePickerOptionsForField(
      { id: "fixedChildLocation", label: "Fixed child location" },
      typedPickerOptionSets,
      { values: { parentPlace: "Khepri" } },
    ),
    ["Ceres Dock", "Icarus Berth", "The Icarus"],
  );
  assert.deepEqual(
    getWorldSpinePickerOptionsForField(
      { id: "fixedChildLocation", label: "Fixed child location" },
      typedPickerOptionSets,
      { values: { parentPlace: "Europa" } },
    ),
    ["Europa Dock"],
  );
  assert.deepEqual(
    getWorldSpinePickerOptionsForField(
      { id: "fixedChildLocation", label: "Fixed child location" },
      typedPickerOptionSets,
      { values: {} },
    ),
    [],
  );
  assert.deepEqual(
    getWorldSpinePickerOptionsForField(
      { id: "home", label: "Home" },
      typedPickerOptionSets,
      { values: {} },
    ),
    ["Europa", "Khepri"],
  );
  assert.deepEqual(
    getWorldSpinePickerOptionsForField(
      { id: "home", label: "Home" },
      typedPickerOptionSets,
      { values: { parentPlace: "Khepri" } },
    ),
    ["Ceres Dock", "Icarus Berth", "Khepri", "The Icarus"],
  );
  assert.deepEqual(
    buildWorldbuildingStudioModel({
      world: {
        ...typedPickerWorld,
        locationTheme: {
          coreLocationCategories: ["planet"],
          sublocationCategories: ["location"],
        },
      },
    }).pickerOptionSets.childLocation,
    ["Ceres Dock", "Europa Dock"],
  );
  const characterHomeHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: typedPickerWorld,
    activeCategoryId: "character",
  }));
  assert.match(characterHomeHtml, /data-worldbuilding-field="home"[\s\S]*list="worldbuilding-place-options-character"/);
  assert.match(characterHomeHtml, /<option value="Khepri"><\/option>/);
  assert.match(characterHomeHtml, /<option value="Europa"><\/option>/);
  assert.doesNotMatch(
    characterHomeHtml.match(/<datalist id="worldbuilding-place-options-character"[\s\S]*?<\/datalist>/)?.[0] ?? "",
    /<option value="Ceres Dock"><\/option>/,
  );
  const planetPickerHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: typedPickerWorld,
    activeCategoryId: "planet",
  }));
  assert.match(planetPickerHtml, /data-worldbuilding-field="rulingFaction"[\s\S]*list="worldbuilding-faction-options-planet"/);
  assert.match(planetPickerHtml, /data-worldbuilding-field="knownResidents"[\s\S]*list="worldbuilding-character-options-planet"/);
  assert.match(planetPickerHtml, /data-worldbuilding-field="settlements"[\s\S]*list="worldbuilding-childlocation-options-planet"/);
  assert.match(planetPickerHtml, /<option value="Oasian Council"><\/option>/);
  assert.match(planetPickerHtml, /<option value="Ceres Dock"><\/option>/);

  const eventTypedPickerHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: typedPickerWorld,
    activeCategoryId: "event",
  }));
  assert.match(eventTypedPickerHtml, /data-worldbuilding-field="affectedFactions"[\s\S]*list="worldbuilding-faction-options-event"/);
  assert.match(eventTypedPickerHtml, /data-worldbuilding-field="linkedLocation"[\s\S]*list="worldbuilding-location-options-event"/);
  assert.match(eventTypedPickerHtml, /data-worldbuilding-field="linkedItems"[\s\S]*list="worldbuilding-all-options-event"/);
  assert.match(eventTypedPickerHtml, /<option value="The Icarus"><\/option>/);

  const eventPickerHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: characterPickerWorld,
    projectCharacters: [{ id: "character-john", name: "John Walker" }],
    activeCategoryId: "event",
  }));
  assert.match(eventPickerHtml, /data-worldbuilding-field="charactersPresent"[\s\S]*list="worldbuilding-character-options-event"/);
  assert.match(eventPickerHtml, /data-worldbuilding-field="newCharacters"[\s\S]*list="worldbuilding-character-options-event"/);
  assert.match(eventPickerHtml, /data-worldbuilding-field="deaths"[\s\S]*list="worldbuilding-character-options-event"/);

  const fixedChildVehicleItem = buildWorldbuildingItemFromFormValues({
    categoryId: "vehicle",
    values: {
      name: "Courier Skiff",
      parentPlace: "Khepri",
      fixedChildLocation: "Ceres Dock",
    },
    world: emptyWorld,
    now: new Date("2026-08-14T06:30:00.000Z"),
  });
  assert.deepEqual(
    fixedChildVehicleItem.entity.fields
      .filter((field) => ["parentPlace", "fixedChildLocation"].includes(field.key))
      .map((field) => [field.key, field.label, field.value]),
    [
      ["parentPlace", "Parent location", "Khepri"],
      ["fixedChildLocation", "Fixed child location", "Ceres Dock"],
    ],
  );

  const characterHomeItem = buildWorldbuildingItemFromFormValues({
    categoryId: "character",
    values: {
      name: "Ava Meerakavita",
      parentPlace: "Khepri",
      home: "Ceres Dock",
    },
    world: emptyWorld,
    now: new Date("2026-08-14T06:31:00.000Z"),
  });
  assert.deepEqual(
    characterHomeItem.entity.fields
      .filter((field) => ["parentPlace", "home"].includes(field.key))
      .map((field) => [field.key, field.label, field.value]),
    [
      ["parentPlace", "Parent location", "Khepri"],
      ["home", "Home", "Ceres Dock"],
    ],
  );

  const customHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: emptyWorld,
    activeCategoryId: "custom",
  }));
  assert.match(customHtml, /data-worldbuilding-field-list="customFieldLabels"/);
  assert.match(customHtml, /data-action="add-worldbuilding-custom-field"/);
  assert.match(customHtml, /placeholder="Enter category name"/);
  assert.match(customHtml, /placeholder="Enter field name"/);
  assert.match(customHtml, /placeholder="Enter item name"/);
  assert.doesNotMatch(customHtml, /Doctrine/);
  assert.doesNotMatch(customHtml, /The Quiet Order/);

  const collapsedModel = buildWorldbuildingStudioModel({
    world: emptyWorld,
    activeCategoryId: "",
  });
  assert.equal(collapsedModel.isFormOpen, false);
  const collapsedHtml = renderWorldbuildingStudioHTML(collapsedModel);
  assert.match(collapsedHtml, /worldbuilding-studio__strip/);
  assert.doesNotMatch(collapsedHtml, /data-worldbuilding-studio-form/);

  const catalogueWorld = {
    ...emptyWorld,
    entities: [
      {
        id: "entity-khepri",
        name: "Khepri",
        categoryId: "planet",
        templateName: "Planet",
        fields: [
          { key: "climate", label: "Climate", value: "Ice shell" },
          { key: "importCategory", label: "Import category", value: "Research planet" },
        ],
        notes: "Frozen planet with buried relay architecture.",
        image: catalogueImage,
        source: "scrivener-reference",
        sourcePath: "Research / Planets / Khepri",
      },
      {
        id: "entity-station",
        name: "Ceres Dock",
        templateName: "Station",
        fields: [
          { key: "category", label: "Category", value: "Station" },
        ],
        notes: "A Scrivener reference station imported before native category IDs existed.",
      },
      {
        id: "entity-icarus",
        name: "The Icarus",
        templateName: "Ship",
        fields: [
          { key: "category", label: "Category", value: "Ship" },
        ],
        notes: "John's drop ship.",
      },
    ],
  };
  const catalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: catalogueWorld,
    catalogueCategoryId: "planet",
    cataloguePosition: { x: 42, y: 64 },
  }));
  assert.match(catalogueHtml, /data-worldbuilding-catalogue/);
  assert.match(catalogueHtml, /style="left:42px; top:64px;"/);
  assert.match(catalogueHtml, /worldbuilding-catalogue-list/);
  assert.match(catalogueHtml, /data-worldbuilding-catalogue-drag-handle/);
  assert.match(catalogueHtml, /data-worldbuilding-catalogue-resize-handle/);
  assert.match(catalogueHtml, /data-action="add-worldbuilding-catalogue-item"/);
  assert.match(catalogueHtml, /aria-label="Add Planet"/);
  assert.match(catalogueHtml, /data-action="select-worldbuilding-catalogue-item"/);
  assert.match(catalogueHtml, /Khepri/);
  assert.match(catalogueHtml, /Climate: Ice shell/);
  assert.match(catalogueHtml, /worldbuilding-catalogue-item__image/);
  assert.match(catalogueHtml, /data-action="close-worldbuilding-catalogue"/);
  assert.match(catalogueHtml, /data-worldbuilding-category-count="1"/);
  assert.match(catalogueHtml, /data-worldbuilding-category-id="location"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(catalogueHtml, /data-worldbuilding-category-id="vehicle"[\s\S]*?data-worldbuilding-category-count="1"/);

  const vehicleCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: catalogueWorld,
    catalogueCategoryId: "vehicle",
    cataloguePosition: { x: 42, y: 64 },
  }));
  assert.match(vehicleCatalogueHtml, /data-worldbuilding-category-properties-form/);
  assert.match(vehicleCatalogueHtml, /data-worldbuilding-category-id="vehicle"/);
  assert.match(vehicleCatalogueHtml, />Location role</);
  assert.match(vehicleCatalogueHtml, /<option[\s\S]*value="child-location"[\s\S]*selected[\s\S]*>Child location<\/option>/);
  assert.match(vehicleCatalogueHtml, /data-action="save-worldbuilding-category-properties"/);

  const vehicleRoleResult = applyWorldbuildingCategoryLocationRoleToWorld({
    ...catalogueWorld,
    locationTheme: {
      locationScope: "planetary",
      coreLocationCategories: ["planet"],
      sublocationCategories: ["location"],
    },
  }, {
    categoryId: "vehicle",
    locationRole: "child-location",
    now: new Date("2026-08-14T06:12:00.000Z"),
  });
  assert.equal(vehicleRoleResult.changed, true);
  assert.equal(vehicleRoleResult.locationRole, "child-location");
  assert.deepEqual(vehicleRoleResult.world.locationTheme.sublocationCategories, ["location", "vehicle"]);
  assert.deepEqual(vehicleRoleResult.world.timelineSettings.locationTheme.sublocationCategories, ["location", "vehicle"]);

  const resizedCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: catalogueWorld,
    catalogueCategoryId: "planet",
    catalogueBounds: { left: 52, top: 74, width: 540, height: 360 },
  }));
  assert.match(resizedCatalogueHtml, /style="left:52px; top:74px; width:540px; height:360px;"/);

  const selectedCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: catalogueWorld,
    catalogueCategoryId: "planet",
    catalogueSelectedItemId: "entity-khepri",
    catalogueSelectedItemKind: "entity",
  }));
  assert.match(selectedCatalogueHtml, /worldbuilding-catalogue-popover has-detail/);
  assert.match(selectedCatalogueHtml, /data-worldbuilding-catalogue-detail/);
  assert.match(selectedCatalogueHtml, /data-worldbuilding-catalogue-detail-item-id="entity-khepri"/);
  assert.match(selectedCatalogueHtml, /data-action="edit-worldbuilding-catalogue-item"/);
  assert.match(selectedCatalogueHtml, /data-action="delete-worldbuilding-catalogue-item"/);
  assert.match(selectedCatalogueHtml, /data-action="attach-worldbuilding-catalogue-image"/);
  assert.match(selectedCatalogueHtml, /worldbuilding-catalogue-detail__image/);
  assert.match(selectedCatalogueHtml, /Frozen planet with buried relay architecture\./);
  assert.match(selectedCatalogueHtml, /Scrivener Reference/);
  assert.match(selectedCatalogueHtml, /Research \/ Planets \/ Khepri/);
  const relatedLocationCards = buildWorldbuildingRelatedCatalogueCardsModel({
    world: {
      ...emptyWorld,
      entities: [
        { id: "entity-earth", name: "Earth", categoryId: "planet", templateName: "Planet" },
        { id: "entity-europa", name: "Europa", categoryId: "planet", templateName: "Planet" },
        {
          id: "entity-lost-facility",
          name: "The lost facility",
          categoryId: "location",
          templateName: "Location",
          fields: [{ key: "parentPlace", label: "Parent place", value: "Earth" }],
        },
      ],
    },
    catalogueScope: {
      label: "Scene: (John) The Mess",
      sceneId: "scene-0003",
      title: "(John) The Mess",
      location: "Earth",
      sublocation: "The lost facility",
      searchText: "The commander mentions Europa's new workers, but the scene is set on Earth.",
    },
  });
  assert.equal(relatedLocationCards.groups[0].label, "Location > Earth");
  assert.deepEqual(relatedLocationCards.groups[0].items.map((item) => item.title), ["Earth", "The lost facility"]);
  assert.deepEqual(relatedLocationCards.groups[0].items.map((item) => item.meta), ["Main location", "Child location"]);
  assert.deepEqual(relatedLocationCards.groups[0].items.map((item) => item.canEditSceneMetadata), [true, true]);
  assert.deepEqual(relatedLocationCards.groups[0].items.map((item) => item.sceneId), ["scene-0003", "scene-0003"]);
  assert.equal(
    relatedLocationCards.groups.flatMap((group) => group.items).some((item) => item.title === "Europa"),
    false,
  );
  const relatedVehicleLocationCards = buildWorldbuildingRelatedCatalogueCardsModel({
    world: {
      ...emptyWorld,
      locationTheme: {
        coreLocationCategories: ["planet"],
        sublocationCategories: ["location", "vehicle"],
      },
      entities: [
        { id: "entity-earth", name: "Earth", categoryId: "planet", templateName: "Planet" },
        {
          id: "entity-icarus",
          name: "The Icarus",
          categoryId: "vehicle",
          templateName: "Vehicle",
          fields: [{ key: "parentPlace", label: "Parent place", value: "Earth" }],
        },
      ],
    },
    catalogueScope: {
      label: "Scene: Low Orbit Burn",
      sceneId: "scene-orbit",
      title: "Low Orbit Burn",
      location: "Earth",
      childLocation: "The Icarus",
    },
  });
  assert.equal(relatedVehicleLocationCards.groups[0].label, "Location > Earth");
  assert.deepEqual(relatedVehicleLocationCards.groups[0].items.map((item) => item.title), ["Earth", "The Icarus"]);
  assert.deepEqual(relatedVehicleLocationCards.groups[0].items.map((item) => item.meta), ["Main location", "Child location"]);
  assert.equal(relatedVehicleLocationCards.groups.some((group) => group.id === "vehicle"), true);

  const editState = createWorldbuildingCatalogueEditFormState(catalogueWorld, {
    itemId: "entity-khepri",
    itemKind: "entity",
  });
  assert.equal(editState.categoryId, "planet");
  assert.equal(editState.reason, "editable");
  const editHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: catalogueWorld,
    activeCategoryId: editState.categoryId,
    editingItemId: editState.itemId,
    editingItemKind: editState.itemKind,
  }));
  assert.match(editHtml, /data-worldbuilding-edit-item-id="entity-khepri"/);
  assert.match(editHtml, /data-worldbuilding-edit-item-kind="entity"/);
  assert.match(editHtml, /value="Khepri"/);
  assert.match(editHtml, /value="Ice shell"/);
  assert.match(editHtml, /Frozen planet with buried relay architecture\./);
  assert.match(editHtml, /Save changes/);

  const updatedPlanetItem = buildWorldbuildingItemFromFormValues({
    categoryId: "planet",
    world: {
      ...catalogueWorld,
      entityLinks: [
        {
          id: "link-0001",
          entityId: "entity-khepri",
          kind: "timeline-presence",
          nodeId: "node-0001",
        },
      ],
      spines: [
        {
          id: "spine-0001",
          label: "Main",
          nodes: [
            {
              id: "node-0001",
              label: "Khepri introduction",
              linkedEntityIds: ["entity-khepri"],
              linkedEntityNames: ["Khepri"],
            },
          ],
        },
      ],
    },
    existingItemId: "entity-khepri",
    existingItemKind: "entity",
    now: new Date("2026-05-14T10:15:00.000Z"),
    values: {
      name: "Khepri Prime",
      climate: "Ice shell, bright relay grid",
      notes: "Updated relay world.",
    },
  });
  assert.equal(updatedPlanetItem.operation, "updated");
  assert.equal(updatedPlanetItem.entity.id, "entity-khepri");
  assert.equal(updatedPlanetItem.entity.createdAt, "2026-05-14T10:15:00.000Z");
  assert.equal(updatedPlanetItem.entity.updatedAt, "2026-05-14T10:15:00.000Z");
  const worldWithUpdatedPlanet = applyWorldbuildingItemToWorld({
    ...catalogueWorld,
    entityLinks: [
      {
        id: "link-0001",
        entityId: "entity-khepri",
        kind: "timeline-presence",
        nodeId: "node-0001",
      },
    ],
    spines: [
      {
        id: "spine-0001",
        label: "Main",
        nodes: [
          {
            id: "node-0001",
            label: "Khepri introduction",
            linkedEntityIds: ["entity-khepri"],
            linkedEntityNames: ["Khepri"],
          },
        ],
      },
    ],
  }, updatedPlanetItem);
  assert.equal(worldWithUpdatedPlanet.entities.find((entity) => entity.id === "entity-khepri").name, "Khepri Prime");
  assert.equal(
    worldWithUpdatedPlanet.entities.find((entity) => entity.id === "entity-khepri").image.name,
    "khepri.png",
  );
  assert.equal(
    worldWithUpdatedPlanet.entities
      .find((entity) => entity.id === "entity-khepri")
      .fields.some((field) => field.key === "importCategory" && field.value === "Research planet"),
    true,
  );
  assert.deepEqual(worldWithUpdatedPlanet.spines[0].nodes[0].linkedEntityNames, ["Khepri Prime"]);

  const deletedPlanet = deleteWorldbuildingCatalogueItemFromWorld(worldWithUpdatedPlanet, {
    itemId: "entity-khepri",
    itemKind: "entity",
  });
  assert.equal(deletedPlanet.changed, true);
  assert.equal(deletedPlanet.world.entities.some((entity) => entity.id === "entity-khepri"), false);
  assert.equal(deletedPlanet.world.entityLinks.some((link) => link.entityId === "entity-khepri"), false);
  assert.deepEqual(deletedPlanet.world.spines[0].nodes[0].linkedEntityIds, []);
  assert.deepEqual(deletedPlanet.world.spines[0].nodes[0].linkedEntityNames, []);

  const attachedImage = applyWorldbuildingCatalogueItemImageToWorld(catalogueWorld, {
    itemId: "entity-icarus",
    itemKind: "entity",
    image: {
      dataUrl: "data:image/webp;base64,aWNhcnVz",
      mediaType: "image/webp",
      name: "icarus.webp",
      size: 6,
    },
    now: new Date("2026-05-14T10:20:00.000Z"),
  });
  assert.equal(attachedImage.changed, true);
  assert.equal(attachedImage.world.entities.find((entity) => entity.id === "entity-icarus").image.name, "icarus.webp");
  assert.equal(
    attachedImage.world.entities.find((entity) => entity.id === "entity-icarus").image.attachedAt,
    "2026-05-14T10:20:00.000Z",
  );
  assert.equal(validateWorldbuildingCatalogueImageFile({ type: "image/svg+xml", size: 12 }), "image-type");
  assert.equal(validateWorldbuildingCatalogueImageFile({ type: "image/png", size: 2 * 1024 * 1024 }), "");
  assert.equal(validateWorldbuildingCatalogueImageFile({ type: "image/png", size: 11 * 1024 * 1024 }), "image-too-large");
  const referencedImage = normalizeWorldbuildingCatalogueImage({
    mediaPath: "C:\\Projects\\Novel.abe-project\\assets\\images\\worldbuilding\\project-1\\location\\europa.png",
    projectRelativePath: "assets/images/worldbuilding/project-1/location/europa.png",
    mediaType: "image/png",
    name: "europa.png",
    size: 10 * 1024 * 1024,
  });
  assert.equal(referencedImage.mediaPath.includes("europa.png"), true);
  assert.equal(referencedImage.dataUrl, undefined);
  assert.match(createWorldbuildingCatalogueImageSource(referencedImage), /^http:\/\/127\.0\.0\.1:4310\/api\/project-media\/file\//);
  const referencedImagePlan = buildWorldbuildingCatalogueImageMediaPath({
    projectFilePath: "C:\\Projects\\Novel.abe-project.json",
    projectId: "project-1",
    itemKind: "location",
    title: "Europa",
    fileName: "surface.png",
    mediaType: "image/png",
    nowMs: 1000,
  });
  assert.match(referencedImagePlan.mediaPath, /Novel\.abe-project[\\/]assets[\\/]images[\\/]worldbuilding[\\/]project-1[\\/]location[\\/]europa-rs\.png$/);
  assert.equal(referencedImagePlan.projectRelativePath, "assets/images/worldbuilding/project-1/location/europa-rs.png");

  const locationImage = applyWorldSpineLocationImageToWorld(catalogueWorld, {
    location: "Ceres Dock",
    image: {
      dataUrl: "data:image/png;base64,Y2VyZXM=",
      mediaType: "image/png",
      name: "ceres.png",
      size: 5,
    },
    now: new Date("2026-05-14T10:25:00.000Z"),
  });
  assert.equal(locationImage.changed, true);
  assert.equal(locationImage.reason, "attached");
  assert.equal(locationImage.item.id, "entity-station");
  assert.equal(locationImage.world.entities.find((entity) => entity.id === "entity-station").image.name, "ceres.png");
  assert.equal(
    buildWorldSpineLocationImageIndex(locationImage.world).get("ceres-dock").image.name,
    "ceres.png",
  );

  const createdLocationImage = applyWorldSpineLocationImageToWorld(emptyWorld, {
    location: "Europa",
    image: {
      dataUrl: "data:image/webp;base64,ZXVyb3Bh",
      mediaType: "image/webp",
      name: "europa.webp",
      size: 6,
    },
    now: new Date("2026-05-14T10:26:00.000Z"),
  });
  assert.equal(createdLocationImage.changed, true);
  assert.equal(createdLocationImage.reason, "created-location");
  assert.equal(createdLocationImage.world.entities.length, 1);
  assert.equal(createdLocationImage.world.entities[0].categoryId, "location");
  assert.equal(createdLocationImage.world.entities[0].name, "Europa");

  const scopedCatalogueWorld = {
    ...emptyWorld,
    entities: [
      {
        id: "entity-ava",
        name: "Ava Meerakavita",
        templateName: "Character",
        notes: "Senior councillor.",
      },
      {
        id: "entity-john",
        name: "John Walker",
        templateName: "Character",
        notes: "Captain.",
      },
      {
        id: "entity-icarus",
        name: "The Icarus",
        templateName: "Ship",
        notes: "John's drop ship.",
      },
      {
        id: "entity-storm-rail",
        name: "Storm Rail",
        templateName: "Weapon",
        notes: "Heavy rail weapon.",
      },
    ],
    eventDrafts: [
      {
        id: "world-event-draft-0002",
        categoryId: "critical-event",
        title: "Beacon wakes",
        summary: "The beacon changes the mission.",
      },
    ],
  };

  const scopedCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: scopedCatalogueWorld,
    catalogueCategoryId: "character",
    catalogueScope: {
      nodeId: "event:event-1",
      typeLabel: "In-scene event",
      title: "Ava reveals the signal",
      sceneId: "scene-1",
      primaryBlockId: "block-2",
      location: "Ceres Dock",
      people: ["Ava"],
      linkedEntityNames: ["The Icarus", "Storm Rail"],
      criticalEvents: ["Beacon wakes"],
      searchText: "Ava checks the Storm Rail beside The Icarus.",
    },
  }));
  assert.match(scopedCatalogueHtml, /In-scene event: Ava reveals the signal/);
  assert.match(scopedCatalogueHtml, /Ava Meerakavita/);
  assert.doesNotMatch(scopedCatalogueHtml, /John Walker/);
  assert.match(scopedCatalogueHtml, /data-worldbuilding-category-id="character"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(scopedCatalogueHtml, /data-worldbuilding-category-id="vehicle"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(scopedCatalogueHtml, /data-worldbuilding-category-id="weapon"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(scopedCatalogueHtml, /data-worldbuilding-category-id="critical-event"[\s\S]*?data-worldbuilding-category-count="1"/);

  const unscopedCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: scopedCatalogueWorld,
    catalogueCategoryId: "character",
  }));
  assert.match(unscopedCatalogueHtml, /Ava Meerakavita/);
  assert.match(unscopedCatalogueHtml, /John Walker/);
  assert.match(unscopedCatalogueHtml, /data-worldbuilding-category-id="character"[\s\S]*?data-worldbuilding-category-count="2"/);
  assert.match(unscopedCatalogueHtml, /data-worldbuilding-category-id="vehicle"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(unscopedCatalogueHtml, /data-worldbuilding-category-id="weapon"[\s\S]*?data-worldbuilding-category-count="1"/);
  assert.match(unscopedCatalogueHtml, /data-worldbuilding-category-id="critical-event"[\s\S]*?data-worldbuilding-category-count="1"/);

  const relatedCardsModel = buildWorldbuildingRelatedCatalogueCardsModel({
    world: {
      ...emptyWorld,
      worldbuildingCategories: [
        {
          id: "guild",
          label: "Guild",
          templateName: "Guild",
          itemKind: "entity",
          fields: [
            { id: "name", label: "Name", input: "text" },
            { id: "charter", label: "Charter", input: "text" },
            { id: "notes", label: "Notes", input: "textarea" },
          ],
        },
      ],
      entities: [
        {
          id: "entity-ava",
          name: "Ava Meerakavita",
          templateName: "Character",
          notes: "Senior councillor.",
          image: catalogueImage,
        },
        {
          id: "entity-icarus",
          name: "The Icarus",
          templateName: "Ship",
          notes: "John's drop ship.",
        },
        {
          id: "entity-storm-rail",
          name: "Storm Rail",
          templateName: "Weapon",
          notes: "Heavy rail weapon.",
        },
        {
          id: "entity-quiet-order",
          name: "The Quiet Order",
          categoryId: "guild",
          categoryLabel: "Guild",
          templateName: "Guild",
          notes: "Signal monks who keep the old relay vows.",
        },
      ],
    },
    catalogueScope: {
      typeLabel: "In-scene event",
      title: "Ava reveals the signal",
      people: ["Ava"],
      linkedEntityNames: ["The Icarus", "Storm Rail", "The Quiet Order"],
      searchText: "Ava checks the Storm Rail beside The Icarus while The Quiet Order listens.",
    },
  });
  assert.equal(relatedCardsModel.hasScope, true);
  assert.equal(relatedCardsModel.totalItemCount, 4);
  assert.deepEqual(
    relatedCardsModel.groups.map((group) => group.label),
    ["Characters", "Weapons", "Vehicles", "Guilds"],
  );
  assert.equal(relatedCardsModel.groups[0].items[0].image.name, "khepri.png");

  const eventCatalogueHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: {
      ...emptyWorld,
      eventDrafts: [
        {
          id: "world-event-draft-0001",
          categoryId: "event",
          title: "Signal under the ice",
          summary: "A corridor beacon wakes beneath Khepri.",
          location: "Subsurface Facility",
        },
      ],
    },
    catalogueCategoryId: "event",
  }));
  assert.match(eventCatalogueHtml, /Signal under the ice/);
  assert.match(eventCatalogueHtml, /Subsurface Facility/);

  const eventEditState = createWorldbuildingCatalogueEditFormState({
    ...emptyWorld,
    eventDrafts: [
      {
        id: "world-event-draft-0001",
        categoryId: "event",
        title: "Signal under the ice",
        summary: "A corridor beacon wakes beneath Khepri.",
        location: "Subsurface Facility",
        createdAt: "2026-05-14T09:00:00.000Z",
      },
    ],
  }, {
    itemId: "world-event-draft-0001",
    itemKind: "eventDraft",
  });
  assert.equal(eventEditState.categoryId, "event");
  const eventEditHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: {
      ...emptyWorld,
      eventDrafts: [
        {
          id: "world-event-draft-0001",
          categoryId: "event",
          title: "Signal under the ice",
          summary: "A corridor beacon wakes beneath Khepri.",
          location: "Subsurface Facility",
          createdAt: "2026-05-14T09:00:00.000Z",
        },
      ],
    },
    activeCategoryId: eventEditState.categoryId,
    editingItemId: eventEditState.itemId,
    editingItemKind: eventEditState.itemKind,
  }));
  assert.match(eventEditHtml, /data-worldbuilding-edit-item-kind="eventDraft"/);
  assert.match(eventEditHtml, /value="Signal under the ice"/);
  assert.match(eventEditHtml, /A corridor beacon wakes beneath Khepri\./);
  assert.match(eventEditHtml, /Save changes/);

  const updatedEventDraft = buildWorldbuildingItemFromFormValues({
    categoryId: "event",
    world: {
      ...emptyWorld,
      eventDrafts: [
        {
          id: "world-event-draft-0001",
          categoryId: "event",
          title: "Signal under the ice",
          summary: "A corridor beacon wakes beneath Khepri.",
          location: "Subsurface Facility",
          createdAt: "2026-05-14T09:00:00.000Z",
        },
      ],
    },
    existingItemId: "world-event-draft-0001",
    existingItemKind: "eventDraft",
    now: new Date("2026-05-14T10:30:00.000Z"),
    values: {
      title: "Signal above the ice",
      summary: "The beacon reaches orbit.",
      location: "Khepri Orbit",
    },
  });
  assert.equal(updatedEventDraft.operation, "updated");
  assert.equal(updatedEventDraft.eventDraft.id, "world-event-draft-0001");
  assert.equal(updatedEventDraft.eventDraft.createdAt, "2026-05-14T09:00:00.000Z");
  assert.equal(updatedEventDraft.eventDraft.updatedAt, "2026-05-14T10:30:00.000Z");
  const deletedEventDraft = deleteWorldbuildingCatalogueItemFromWorld(applyWorldbuildingItemToWorld({
    ...emptyWorld,
    eventDrafts: [
      {
        id: "world-event-draft-0001",
        categoryId: "event",
        title: "Signal under the ice",
        summary: "A corridor beacon wakes beneath Khepri.",
        location: "Subsurface Facility",
      },
    ],
  }, updatedEventDraft), {
    itemId: "world-event-draft-0001",
    itemKind: "eventDraft",
  });
  assert.equal(deletedEventDraft.changed, true);
  assert.equal(deletedEventDraft.world.eventDrafts.some((draft) => draft.id === "world-event-draft-0001"), false);

  const eventItem = buildWorldbuildingItemFromFormValues({
    categoryId: "event",
    world: emptyWorld,
    now: new Date("2026-05-14T09:25:00.000Z"),
    values: {
      title: "Signal under the ice",
      summary: "A corridor beacon wakes beneath Khepri.",
      location: "Subsurface Facility",
      sublocation: "Relay Chamber",
      orbitalBand: "Below ice shell",
      date: "2026-05-14",
      time: "12:15",
      charactersPresent: "John, Ava",
      newCharacters: "Tau",
      responsibleParty: "Ava",
      witnesses: "John",
      affectedFactions: "Oasian Council",
      linkedLocation: "Ceres Dock",
      criticalEvents: "Beacon wakes",
      deaths: "None",
      linkedItems: "Helmholtz suit",
    },
  });
  assert.equal(eventItem.itemType, "eventDraft");
  assert.equal(eventItem.eventDraft.people.length, 2);
  assert.deepEqual(eventItem.eventDraft.responsibleParty, ["Ava"]);
  assert.deepEqual(eventItem.eventDraft.witnesses, ["John"]);
  assert.deepEqual(eventItem.eventDraft.affectedFactions, ["Oasian Council"]);
  assert.deepEqual(eventItem.eventDraft.linkedLocations, ["Ceres Dock"]);
  assert.equal(eventItem.eventDraft.linkedEntityNames.includes("Ceres Dock"), true);
  assert.equal(eventItem.eventDraft.criticalEvents[0], "Beacon wakes");
  assert.equal(eventItem.eventDraft.sublocation, "Relay Chamber");
  assert.equal(eventItem.eventDraft.orbitalBand, "Below ice shell");

  const worldWithDraft = applyWorldbuildingItemToWorld(emptyWorld, eventItem);
  assert.equal(worldWithDraft.eventDrafts.length, 1);
  assert.equal(worldWithDraft.stats.eventDraftCount, 1);

  const dragPreviewHtml = renderWorldbuildingEventDraftPlacementPreviewHTML(worldWithDraft, eventItem.eventDraft.id);
  assert.match(dragPreviewHtml, /worldbuilding-event-draft-drag-image/);
  assert.match(dragPreviewHtml, /Signal under the ice/);
  assert.match(dragPreviewHtml, /Subsurface Facility \/ Relay Chamber \/ Below ice shell/);

  const placement = dropWorldbuildingEventDraftOnWorldSpine(worldWithDraft, eventItem.eventDraft.id, {
    dropIndex: 0,
  });
  assert.equal(placement.reason, "placed");
  assert.equal(placement.node.label, "Signal under the ice");
  assert.equal(placement.node.location, "Subsurface Facility");
  assert.equal(placement.node.sublocation, "Relay Chamber");
  assert.equal(placement.node.orbitalBand, "Below ice shell");
  assert.equal(placement.node.locationPlacement.locationRowLabel, "Subsurface Facility");
  assert.equal(placement.node.locationPlacement.sublocationLabel, "Relay Chamber");
  assert.deepEqual(placement.node.people, ["John", "Ava"]);
  assert.deepEqual(placement.node.metadata.responsibleParty, ["Ava"]);
  assert.equal(placement.node.metadata.sublocation, "Relay Chamber");
  assert.equal(placement.node.metadata.locationPlacement.orbitalBand, "Below ice shell");
  assert.deepEqual(placement.node.metadata.affectedFactions, ["Oasian Council"]);
  assert.deepEqual(placement.node.metadata.linkedLocations, ["Ceres Dock"]);
  assert.equal(placement.node.timelineSlotIndex, 0);
  assert.equal(placement.node.sequenceRank, -0.5);
  assert.equal(placement.world.eventDrafts.length, 0);
  assert.equal(placement.world.spines[0].nodes[0].id, placement.node.id);
  assert.equal(placement.world.stats.nodeCount, 1);

  const dualTimeline = addParallelWorldSpine(placement.world, {
    label: "Oasis Surface Timeline",
    location: "Oasis Surface",
    thread: "Surface alarms while the crew is underground",
    participants: "John, Ava, Oasian Council",
    startMarker: "Chapter 2",
    notes: "Keep the surface consequences visible beside the main manuscript lane.",
    now: new Date("2026-05-14T09:45:00.000Z"),
  });
  assert.equal(dualTimeline.created, true);
  assert.equal(dualTimeline.world.spines.length, 2);
  assert.equal(dualTimeline.spine.id, "spine-0002");
  assert.equal(dualTimeline.spine.label, "Oasis Surface Timeline");
  assert.equal(dualTimeline.spine.location, "Oasis Surface");
  assert.equal(dualTimeline.spine.thread, "Surface alarms while the crew is underground");
  assert.deepEqual(dualTimeline.spine.participants, ["John", "Ava", "Oasian Council"]);
  assert.equal(dualTimeline.spine.startMarker, "Chapter 2");
  assert.equal(dualTimeline.spine.metadata.location, "Oasis Surface");
  assert.match(dualTimeline.spine.description, /Surface alarms while the crew is underground/);
  assert.equal(dualTimeline.world.stats.spineCount, 2);

  const namedDefaultSpine = applyWorldSpineLocationRowNameToWorld({ spines: [] }, {
    spineId: "spine-0001",
    location: "Athos",
    now: new Date("2026-07-30T00:00:00.000Z"),
  });
  assert.equal(namedDefaultSpine.changed, true);
  assert.equal(namedDefaultSpine.world.spines[0].location, "Athos");
  assert.equal(namedDefaultSpine.world.spines[0].metadata.location, "Athos");

  const namedWorldNodeRow = applyWorldSpineLocationRowNameToWorld({
    spines: [{
      id: "spine-2",
      label: "Parallel",
      nodes: [
        { id: "node-europa-1", label: "Europa test" },
        { id: "node-other", label: "Other", location: "Old Place" },
      ],
    }],
  }, {
    spineId: "spine-2",
    worldNodeIds: ["node-europa-1"],
    location: "Europa",
  });
  assert.equal(namedWorldNodeRow.changed, true);
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].location, "Europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].locationRowLabel, "Europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].locationRowKey, "europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].metadata.location, "Europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].metadata.locationRowLabel, "Europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[0].metadata.locationRowKey, "europa");
  assert.equal(namedWorldNodeRow.world.spines[0].nodes[1].location, "Old Place");

  const unplacedWorldNodeRow = applyWorldSpineLocationRowUnplacementToWorld({
    entities: [{ id: "entity-earth", name: "Earth", categoryId: "planet", image: { name: "earth.png" } }],
    edges: [{ id: "edge-world-row", fromNodeId: "node-europa-1", toNodeId: "node-other", kind: "implicates" }],
    spines: [{
      id: "spine-2",
      label: "Parallel",
      nodes: [
        {
          id: "node-europa-1",
          label: "Europa test",
          location: "Europa Station",
          childLocation: "Dock Seven",
          locationPlacement: {
            location: "Europa Station",
            childLocation: "Dock Seven",
            locationRowLabel: "Europa",
            locationRowKey: "europa",
          },
          metadata: { location: "Europa Station", orbitalBand: "Low orbit" },
        },
        { id: "node-other", label: "Other", location: "Old Place" },
      ],
    }],
  }, {
    spineId: "spine-2",
    worldNodeIds: ["node-europa-1"],
  });
  assert.equal(unplacedWorldNodeRow.changed, true);
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].location, "Europa Station");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].childLocation, "Dock Seven");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].locationRowLabel, "Unplaced location");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].locationRowKey, "unplaced-location");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].locationPlacement.location, "Europa Station");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].locationPlacement.childLocation, "Dock Seven");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].locationPlacement.locationRowKey, "unplaced-location");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].metadata.location, "Europa Station");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[0].metadata.orbitalBand, "Low orbit");
  assert.equal(unplacedWorldNodeRow.world.entities[0].image.name, "earth.png");
  assert.equal(unplacedWorldNodeRow.world.edges[0].id, "edge-world-row");
  assert.equal(unplacedWorldNodeRow.world.spines[0].nodes[1].location, "Old Place");

  const thirdTimeline = addParallelWorldSpine(dualTimeline.world, {
    now: new Date("2026-05-14T09:46:00.000Z"),
  });
  assert.equal(thirdTimeline.created, true);
  assert.equal(thirdTimeline.world.spines.length, 3);
  assert.equal(thirdTimeline.spine.id, "spine-0003");
  assert.equal(thirdTimeline.spine.label, "Parallel Timeline 2");
  assert.equal(thirdTimeline.world.stats.spineCount, 3);

  const existingDualTimeline = ensureDualWorldSpine(thirdTimeline.world);
  assert.equal(existingDualTimeline.created, false);
  assert.equal(existingDualTimeline.spine.id, "spine-0002");

  const parallelEventItem = buildWorldbuildingItemFromFormValues({
    categoryId: "event",
    world: thirdTimeline.world,
    now: new Date("2026-05-14T09:50:00.000Z"),
    values: {
      title: "Oasis surface alarms",
      summary: "A second location changes while the crew is away.",
      location: "Oasis Surface",
    },
  });
  const worldWithParallelDraft = applyWorldbuildingItemToWorld(thirdTimeline.world, parallelEventItem);
  const parallelPlacement = dropWorldbuildingEventDraftOnWorldSpine(
    worldWithParallelDraft,
    parallelEventItem.eventDraft.id,
    {
      dropIndex: 2,
      spineId: thirdTimeline.spine.id,
    },
  );
  assert.equal(parallelPlacement.reason, "placed");
  assert.equal(parallelPlacement.node.spineId, thirdTimeline.spine.id);
  assert.equal(parallelPlacement.node.timelineSlotIndex, 2);
  assert.equal(parallelPlacement.node.sequenceRank, 1.5);
  assert.equal(parallelPlacement.world.spines[0].nodes[0].id, placement.node.id);
  assert.equal(parallelPlacement.world.spines[1].nodes.length, 0);
  assert.equal(parallelPlacement.world.spines[2].nodes[0].id, parallelPlacement.node.id);
  assert.equal(parallelPlacement.world.stats.nodeCount, 2);

  const blankLocationEventItem = buildWorldbuildingItemFromFormValues({
    categoryId: "event",
    world: parallelPlacement.world,
    now: new Date("2026-05-14T09:55:00.000Z"),
    values: {
      title: "Europa row-only event",
      summary: "The event inherits its row location.",
    },
  });
  const worldWithBlankLocationDraft = applyWorldbuildingItemToWorld(parallelPlacement.world, blankLocationEventItem);
  const locationInheritedPlacement = dropWorldbuildingEventDraftOnWorldSpine(
    worldWithBlankLocationDraft,
    blankLocationEventItem.eventDraft.id,
    {
      dropIndex: 0,
      spineId: thirdTimeline.spine.id,
      locationLabel: "Europa Orbit",
    },
  );
  assert.equal(locationInheritedPlacement.node.location, "Europa Orbit");
  assert.equal(locationInheritedPlacement.node.metadata.location, "Europa Orbit");

  const existingLocationEventItem = buildWorldbuildingItemFromFormValues({
    categoryId: "event",
    world: locationInheritedPlacement.world,
    now: new Date("2026-05-14T09:56:00.000Z"),
    values: {
      title: "Existing location moves rows",
      summary: "The drop target row becomes the event location.",
      location: "Old Place",
    },
  });
  const worldWithExistingLocationDraft = applyWorldbuildingItemToWorld(locationInheritedPlacement.world, existingLocationEventItem);
  const rowOverridePlacement = dropWorldbuildingEventDraftOnWorldSpine(
    worldWithExistingLocationDraft,
    existingLocationEventItem.eventDraft.id,
    {
      dropIndex: 1,
      spineId: thirdTimeline.spine.id,
      locationLabel: "Europa Orbit",
    },
  );
  assert.equal(rowOverridePlacement.node.location, "Europa Orbit");
  assert.equal(rowOverridePlacement.node.metadata.location, "Europa Orbit");

  const customItem = buildWorldbuildingItemFromFormValues({
    categoryId: "custom",
    world: parallelPlacement.world,
    now: new Date("2026-05-14T10:00:00.000Z"),
    values: {
      customCategoryName: "Religion",
      customFieldLabels: ["Doctrine", "Rituals", "Symbols", "Oaths"],
      name: "The Quiet Order",
      notes: "Signal monks who keep the old relay vows.",
    },
  });
  const worldWithCustom = applyWorldbuildingItemToWorld(parallelPlacement.world, customItem);
  assert.equal(worldWithCustom.worldbuildingCategories.some((category) => category.id === "religion"), true);
  assert.equal(worldWithCustom.entities.some((entity) => entity.templateName === "Religion"), true);
  const religionCategory = worldWithCustom.worldbuildingCategories.find((category) => category.id === "religion");
  assert.equal(religionCategory.fields.some((field) => field.label === "Oaths"), true);
  assert.equal(religionCategory.fields.find((field) => field.label === "Oaths").placeholder, "Enter oaths");

  const customLinkedItemPickerHtml = renderWorldbuildingStudioHTML(buildWorldbuildingStudioModel({
    world: worldWithCustom,
    activeCategoryId: "event",
  }));
  assert.match(customLinkedItemPickerHtml, /data-worldbuilding-field="linkedItems"[\s\S]*list="worldbuilding-all-options-event"/);
  assert.match(customLinkedItemPickerHtml, /<option value="The Quiet Order"><\/option>/);
}
