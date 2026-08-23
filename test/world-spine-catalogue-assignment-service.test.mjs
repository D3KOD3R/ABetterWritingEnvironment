// Intent: verify manual World Spine event catalogue assignments create reviewed presence links.
import assert from "node:assert/strict";

import {
  applyWorldSpineCatalogueItemAssignmentToWorld,
  applyWorldSpineEventSublocationToWorld,
  buildWorldSpineCatalogueAssignmentMenuModel,
  buildWorldSpineEntityPresenceIndex,
  selectWorldSpineAssignedEntityIdsForNode,
} from "../apps/editor/public/features/world-spine/world-spine-catalogue-assignment-service.js";

export function runWorldSpineCatalogueAssignmentServiceTest() {
  const world = {
    title: "Story world",
    sequences: {
      link: 3,
    },
    entities: [
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
        notes: "Mounted rail weapon.",
      },
      {
        id: "entity-quiet-order",
        name: "The Quiet Order",
        categoryId: "religion",
        categoryLabel: "Religion",
        templateName: "Religion",
        notes: "Signal monks who keep the old relay vows.",
      },
    ],
    worldbuildingCategories: [
      {
        id: "religion",
        label: "Religion",
        templateName: "Religion",
        itemKind: "entity",
        fields: [
          { id: "name", label: "Name", input: "text" },
          { id: "doctrine", label: "Doctrine", input: "text" },
          { id: "notes", label: "Notes", input: "textarea" },
        ],
      },
    ],
    spines: [
      {
        id: "spine-1",
        label: "Main",
        nodes: [
          {
            id: "node-world-1",
            label: "Docking clamps engage",
          },
        ],
      },
    ],
    entityLinks: [],
  };

  const menuModel = buildWorldSpineCatalogueAssignmentMenuModel({
    world,
    node: {
      id: "event:event-1",
      title: "Ava reveals the signal",
      typeLabel: "In-scene event",
      kind: "event",
    },
  });
  const shipGroup = menuModel.groups.find((group) => group.id === "vehicle");
  const weaponGroup = menuModel.groups.find((group) => group.id === "weapon");
  const religionGroup = menuModel.groups.find((group) => group.id === "religion");
  assert.equal(menuModel.selectedCategoryId, "");
  assert.equal(shipGroup.label, "Ships");
  assert.equal(weaponGroup.label, "Weapons");
  assert.equal(religionGroup.label, "Religions");
  assert.deepEqual(shipGroup.items.map((item) => item.title), ["The Icarus"]);
  assert.deepEqual(weaponGroup.items.map((item) => item.title), ["Storm Rail"]);
  assert.deepEqual(religionGroup.items.map((item) => item.title), ["The Quiet Order"]);
  assert.equal(shipGroup.items[0].isAssigned, false);

  const assigned = applyWorldSpineCatalogueItemAssignmentToWorld(world, {
    nodeId: "event:event-1",
    entityId: "entity-icarus",
    now: new Date("2026-07-21T10:00:00.000Z"),
  });
  assert.equal(assigned.changed, true);
  assert.equal(assigned.link.id, "link-0004");
  assert.equal(assigned.link.kind, "timeline-presence");
  assert.equal(assigned.link.nodeId, "event:event-1");
  assert.equal(assigned.link.source, "manual-world-spine-context-menu");
  assert.equal(assigned.world.sequences.link, 4);

  const assignedIds = selectWorldSpineAssignedEntityIdsForNode(assigned.world, "event:event-1");
  assert.equal(assignedIds.has("entity-icarus"), true);

  const presenceIndex = buildWorldSpineEntityPresenceIndex(assigned.world);
  assert.deepEqual(presenceIndex.get("event:event-1").entityNames, ["The Icarus"]);

  const duplicate = applyWorldSpineCatalogueItemAssignmentToWorld(assigned.world, {
    nodeId: "event:event-1",
    entityId: "entity-icarus",
    now: new Date("2026-07-21T10:01:00.000Z"),
  });
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.reason, "already-assigned");
  assert.equal(duplicate.world.entityLinks.length, 1);

  const storedNodeAssignment = applyWorldSpineCatalogueItemAssignmentToWorld(assigned.world, {
    nodeId: "node-world-1",
    entityId: "entity-icarus",
    now: new Date("2026-07-21T10:02:00.000Z"),
  });
  assert.deepEqual(storedNodeAssignment.world.spines[0].nodes[0].linkedEntityIds, ["entity-icarus"]);
  assert.deepEqual(storedNodeAssignment.world.spines[0].nodes[0].linkedEntityNames, ["The Icarus"]);

  const assignedMenuModel = buildWorldSpineCatalogueAssignmentMenuModel({
    world: assigned.world,
    node: {
      id: "event:event-1",
      title: "Ava reveals the signal",
      typeLabel: "In-scene event",
      kind: "event",
    },
  });
  const assignedShipGroup = assignedMenuModel.groups.find((group) => group.id === "vehicle");
  assert.equal(assignedShipGroup.items[0].isAssigned, true);

  const assignedReligion = applyWorldSpineCatalogueItemAssignmentToWorld(assigned.world, {
    nodeId: "event:event-1",
    entityId: "entity-quiet-order",
    now: new Date("2026-07-21T10:03:00.000Z"),
  });
  assert.equal(assignedReligion.changed, true);
  assert.equal(assignedReligion.link.entityId, "entity-quiet-order");

  const sublocationAdded = applyWorldSpineEventSublocationToWorld(world, {
    nodeId: "node-world-1",
    location: "Earth",
    childLocation: "Docking Ring",
    now: new Date("2026-07-21T10:04:00.000Z"),
  });
  assert.equal(sublocationAdded.changed, true);
  assert.equal(sublocationAdded.reason, "created-sublocation");
  assert.equal(sublocationAdded.entity.name, "Docking Ring");
  assert.equal(sublocationAdded.entity.categoryId, "location");
  assert.equal(
    sublocationAdded.entity.fields.find((field) => field.key === "parentPlace")?.value,
    "Earth",
  );
  assert.equal(sublocationAdded.link.kind, "timeline-presence");
  assert.equal(sublocationAdded.link.nodeId, "node-world-1");
  assert.equal(sublocationAdded.world.spines[0].nodes[0].childLocationLabel, "Docking Ring");
  assert.equal(sublocationAdded.world.spines[0].nodes[0].sublocationLabel, "Docking Ring");
  assert.equal(sublocationAdded.world.spines[0].nodes[0].locationRowLabel, "Earth");
  assert.equal(sublocationAdded.world.spines[0].nodes[0].locationPlacement.childLocationKey, "docking-ring");
  assert.equal(sublocationAdded.world.spines[0].nodes[0].locationPlacement.sublocationKey, "docking-ring");

  const duplicateSublocation = applyWorldSpineEventSublocationToWorld(sublocationAdded.world, {
    nodeId: "node-world-1",
    location: "Earth",
    sublocation: "Docking Ring",
    now: new Date("2026-07-21T10:05:00.000Z"),
  });
  assert.equal(duplicateSublocation.changed, false);
  assert.equal(duplicateSublocation.reason, "already-assigned");
  assert.equal(
    duplicateSublocation.world.entities.filter((entity) => entity.name === "Docking Ring").length,
    1,
  );
}
