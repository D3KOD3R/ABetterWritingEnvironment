// Intent: verify the World Spine feature derives compact chronological nodes and explicit detail-card placement.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWorldSpineTimelineModel,
  calculateWorldSpineDetailCardPlacement,
  calculateWorldSpineImplicationComposerPlacement,
  createWorldSpineLocationFilterViewportModel,
  findWorldSpineNode,
  isWorldSpineAssignableEventNode,
  isWorldSpineLocationRowDeleteEligible,
  normalizeWorldSpineRightPaneMode,
  normalizeWorldSpineTimelineZoom,
  renderWorldSpineDetailCardHTML,
  renderWorldSpinePanelHTML,
  renderWorldSpineWhitespaceContextMenuHTML,
  resolveWorldSpineTimelineWheelScrollPlan,
  resolveWorldSpineTimelineZoomFromWheel,
  resolveWorldSpineSceneReorderDropTarget,
  resolveWorldSpineWhitespaceContextFromPoint,
  resolveWorldSpineViewportChapterAnchor,
  shouldConsumeWorldSpineSuppressedClick,
} from "../apps/editor/public/features/world-spine/world-spine-panel.js";
import {
  applyWorldSpineLocationAssignmentToSceneEventTags,
  applyWorldSpineLocationAssignmentToSceneRecord,
  applyWorldSpineLocationAssignmentToStructureDrafts,
  applyWorldSpineLocationAssignmentToWorldPlaceLinks,
  applyWorldSpineUnplacementToSceneEventTags,
  applyWorldSpineUnplacementToSceneRecord,
  applyWorldSpineUnplacementToStructureDrafts,
  createWorldSpineUnplacedLocationRowAssignment,
  createWorldSpineLocationRowAssignment,
  createWorldSpineSceneDropPersistenceOptions,
  upsertWorldSpineUnplacementInSceneStore,
  upsertWorldSpineLocationAssignmentInSceneStore,
} from "../apps/editor/public/features/world-spine/world-spine-location-row-service.js";

export function runWorldSpinePanelTest() {
  const scenes = [
    {
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
      sceneTitle: "Ceres Arrival",
      sceneSynopsis: "The crew reaches the dock.",
      location: "Ceres Dock",
      date: "2026-05-14",
      time: "09:12",
      peoplePresent: ["John", "Ava"],
      worldSpineMetadata: {
        sceneBeats: ["Arrival beat", "Signal beat"],
        criticalEvents: ["Docking clamps catch"],
        locationChanges: ["Observation Deck"],
        customMetadata: {
          "metadata-lore": "Ceres Dock still answers to the gate-era authority.",
        },
      },
      blocks: [
        {
          blockId: "block-1",
          lineNumber: 1,
          kind: "narration",
          text: "The ship settled against Ceres Dock.",
          eventTagIds: [],
        },
        {
          blockId: "block-2",
          lineNumber: 2,
          kind: "dialogue",
          speakerLabel: "Ava",
          text: "There it is.",
          eventTagIds: ["event-1"],
        },
      ],
    },
    {
      sceneId: "scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
      sceneTitle: "Mission Briefing",
      sceneSynopsis: "The crew enters the briefing room.",
      metadata: {
        location: "Briefing Room",
        storyDate: "2026-05-14",
        storyTime: "10:05",
      },
      blocks: [
        {
          blockId: "block-3",
          lineNumber: 3,
          kind: "narration",
          text: "A new mission begins.",
          eventTagIds: [],
        },
      ],
    },
  ];
  const workspace = {
    project: {
      eventTags: [
        {
          id: "event-1",
          kind: "reveal",
          label: "Ava reveals the signal",
          notes: "Ava identifies faint telemetry.",
          evidenceExcerpt: "There it is.",
          blockId: "block-2",
          lineNumber: 2,
          sceneLineNumber: 2,
        },
      ],
      characters: [
        { id: "character-1", name: "John", aliasList: [] },
        { id: "character-2", name: "Ava", aliasList: [] },
      ],
    },
    world: {
      title: "Story Timeline",
      spines: [
        {
          id: "spine-1",
          label: "Main",
          nodes: [
            {
              id: "node-world-1",
              label: "Docking clamps engage",
              summary: "The dock takes control of the ship.",
              primaryBlockId: "block-1",
              lineNumbers: [1],
              linkedEntityNames: ["Ceres Dock"],
            },
            {
              id: "node-world-2",
              label: "Signal under the ice",
              summary: "A corridor beacon wakes beneath Khepri.",
              sequenceRank: 0.5,
              location: "Subsurface Facility",
              date: "2026-05-14",
              time: "12:15",
              people: ["John", "Ava"],
              criticalEvents: ["Beacon wakes"],
              deaths: ["None"],
              linkedEntityNames: ["Helmholtz suit"],
            },
          ],
        },
      ],
      edges: [
        {
          id: "edge-1",
          fromNodeId: "event:event-1",
          toNodeId: "scene:scene-2",
          kind: "implicates",
          label: "Ava's signal changes the briefing stakes",
        },
        {
          id: "edge-2",
          fromNodeId: "ref:location:scene-1:ceres-dock",
          toNodeId: "ref:location:scene-2:briefing-room",
          kind: "implicates",
          label: "Dock geography echoes the briefing room",
        },
        {
          id: "edge-3",
          fromNodeId: "scene:scene-1",
          toNodeId: "scene:scene-2",
          kind: "implicates",
          label: "Arrival sets up the briefing",
        },
      ],
      entities: [
        {
          id: "entity-location-1",
          name: "Ceres Dock",
          templateName: "Location",
          notes: "Ice-rimmed port above Ceres.",
          introductionBlockId: "block-1",
          image: {
            dataUrl: "data:image/png;base64,Y2VyZXM=",
            mediaType: "image/png",
            name: "ceres.png",
            size: 5,
          },
        },
        {
          id: "entity-location-2",
          name: "Subsurface Facility",
          templateName: "Location",
          notes: "Facility cut under Europa's ice.",
          image: {
            mediaPath: "C:\\Projects\\Novel.abe-project\\assets\\images\\worldbuilding\\project-1\\location\\subsurface-facility.png",
            projectRelativePath: "assets/images/worldbuilding/project-1/location/subsurface-facility.png",
            mediaType: "image/png",
            name: "subsurface-facility.png",
            size: 2048,
          },
        },
        {
          id: "entity-icarus",
          name: "The Icarus",
          templateName: "Ship",
          notes: "John's drop ship.",
        },
      ],
      entityLinks: [
        {
          id: "link-1",
          entityId: "entity-icarus",
          kind: "timeline-presence",
          nodeId: "event:event-1",
          createdAt: "2026-07-21T10:00:00.000Z",
        },
      ],
    },
  };

  const model = buildWorldSpineTimelineModel({
    workspace,
    scenes,
    selectedNodeId: "event:event-1",
    selectedBlockId: "block-2",
    customMetadataDefinitions: [{ id: "metadata-lore", label: "Lore" }],
  });

  assert.equal(model.timeline.primaryNodes.length, 3);
  assert.equal(model.stats.sceneCount, 2);
  assert.equal(model.stats.sceneBeatCount, 2);
  assert.deepEqual(model.eventRailItems.map((item) => item.type), ["chapter", "event", "event", "event"]);
  assert.equal(model.eventRailItems[0].title, "Chapter 1");
  assert.equal(model.eventRailItems[1].eventNumber, 1);
  assert.equal(model.eventRailItems[2].eventNumber, 2);
  assert.equal(model.eventRailItems[3].eventNumber, 3);
  assert.equal(model.timeline.primaryNodes[0].y + (model.timeline.primaryNodes[0].height / 2), 230);
  assert.deepEqual(
    model.timeline.locationRows.map((row) => row.locationLabel),
    ["Ceres Dock", "Subsurface Facility", "Briefing Room"],
  );
  assert.equal(model.timeline.locationRows[0].locationImage.image.name, "ceres.png");
  assert.equal(model.timeline.locationRows[1].locationImage.image.name, "subsurface-facility.png");
  assert.equal(model.timeline.locationRows[2].locationImage, null);
  assert.equal(model.timeline.primaryNodes[1].y + (model.timeline.primaryNodes[1].height / 2), 380);
  assert.equal(model.timeline.primaryNodes[2].y + (model.timeline.primaryNodes[2].height / 2), 530);
  assert.equal(model.timeline.mainSpineY, 570);
  assert.equal(model.timeline.axisY, 596);
  assert.equal(model.timeline.primaryNodes[0].location, "Ceres Dock");
  assert.equal(model.timeline.primaryNodes[0].locationKey, "ceres-dock");
  assert.equal(model.timeline.primaryNodes[0].time, "09:12");
  const rowAssignmentModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        entities: [],
        spines: [],
      },
    },
    scenes: [{
      sceneId: "scene-icarus",
      chapterId: "chapter-2",
      chapterTitle: "Chapter 2",
      sceneTitle: "Boarding the Icarus",
      location: "The Icarus",
      worldSpineMetadata: {
        locationRowLabel: "Earth",
        locationRowKey: "earth",
        locationScope: "planetary",
      },
      blocks: [{ blockId: "block-icarus", lineNumber: 11, kind: "narration", text: "They boarded the Icarus." }],
    }],
  });
  const rowAssignmentNode = findWorldSpineNode(rowAssignmentModel, "scene:scene-icarus");
  assert.deepEqual(rowAssignmentModel.timeline.locationRows.map((row) => row.locationLabel), ["Earth"]);
  assert.equal(rowAssignmentNode.location, "The Icarus");
  assert.equal(rowAssignmentNode.locationLabel, "The Icarus");
  assert.equal(rowAssignmentNode.locationKey, "the-icarus");
  assert.equal(rowAssignmentNode.locationRowLabel, "Earth");
  assert.equal(rowAssignmentNode.locationRowKey, "earth");
  assert.equal(rowAssignmentNode.eventLocationLabel, "The Icarus");
  assert.equal(rowAssignmentNode.locationWarning.kind, "location-row-mismatch");
  const staleDefaultRowKeyModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        entities: [],
        spines: [],
      },
    },
    scenes: [{
      sceneId: "scene-stale-row-key",
      chapterId: "chapter-2",
      chapterTitle: "Chapter 2",
      sceneTitle: "Return to Earth",
      location: "Earth",
      worldSpineMetadata: {
        locationRowKey: "unplaced-location",
      },
      blocks: [{ blockId: "block-stale-row-key", lineNumber: 12, kind: "narration", text: "They returned to Earth." }],
    }],
  });
  const staleDefaultRowKeyNode = findWorldSpineNode(staleDefaultRowKeyModel, "scene:scene-stale-row-key");
  assert.deepEqual(staleDefaultRowKeyModel.timeline.locationRows.map((row) => row.locationLabel), ["Earth"]);
  assert.deepEqual(staleDefaultRowKeyModel.timeline.locationRows.map((row) => row.locationKey), ["earth"]);
  assert.equal(staleDefaultRowKeyNode.locationRowLabel, "Earth");
  assert.equal(staleDefaultRowKeyNode.locationRowKey, "earth");
  assert.equal(staleDefaultRowKeyModel.timeline.dropZones[0].locationLabel, "Earth");
  assert.equal(staleDefaultRowKeyModel.timeline.dropZones[0].locationKey, "earth");
  const rowAssignmentHtml = renderWorldSpinePanelHTML(rowAssignmentModel);
  assert.match(rowAssignmentHtml, /data-world-spine-location-label="Earth"/);
  assert.match(rowAssignmentHtml, /data-world-spine-event-location-label="The Icarus"/);
  assert.match(rowAssignmentHtml, /Earth \/ The Icarus/);
  assert.match(rowAssignmentHtml, /data-world-spine-location-warning-kind="location-row-mismatch"/);
  assert.match(rowAssignmentHtml, /has-location-warning/);
  const locationRowAssignment = createWorldSpineLocationRowAssignment("Earth");
  const patchedSceneRecord = applyWorldSpineLocationAssignmentToSceneRecord({
    sceneId: "scene-row",
    sceneTitle: "Row scene",
    location: "",
    worldSpineMetadata: {
      sublocation: "The Icarus",
    },
    blocks: [{ blockId: "block-row" }],
  }, locationRowAssignment);
  assert.equal(patchedSceneRecord.location, "Earth");
  assert.equal(patchedSceneRecord.locationRowLabel, "Earth");
  assert.equal(patchedSceneRecord.locationRowKey, "earth");
  assert.equal(patchedSceneRecord.worldSpineMetadata.location, "Earth");
  assert.equal(patchedSceneRecord.worldSpineMetadata.sublocation, "The Icarus");
  const patchedStaleKeySceneRecord = applyWorldSpineLocationAssignmentToSceneRecord({
    sceneId: "scene-stale-row-key",
  }, {
    location: "Earth",
    locationRowLabel: "Earth",
    locationRowKey: "unplaced-location",
  });
  assert.equal(patchedStaleKeySceneRecord.location, "Earth");
  assert.equal(patchedStaleKeySceneRecord.locationRowLabel, "Earth");
  assert.equal(patchedStaleKeySceneRecord.locationRowKey, "earth");
  assert.equal(patchedStaleKeySceneRecord.worldSpineMetadata.locationRowKey, "earth");
  const eventTagAssignment = applyWorldSpineLocationAssignmentToSceneEventTags([
    { id: "event-row", blockId: "block-row", location: "Unplaced location" },
    { id: "event-other", blockId: "block-other", location: "Europa" },
  ], patchedSceneRecord, locationRowAssignment);
  assert.deepEqual(eventTagAssignment.changedEventTagIds, ["event-row"]);
  assert.equal(eventTagAssignment.eventTags[0].location, "Earth");
  assert.equal(eventTagAssignment.eventTags[0].metadata.locationRowKey, "earth");
  assert.equal(eventTagAssignment.eventTags[1].location, "Europa");
  const structureAssignment = applyWorldSpineLocationAssignmentToStructureDrafts({
    scenes: [
      { sceneId: "scene-row", sceneTitle: "Row scene", location: "" },
      { sceneId: "scene-other", sceneTitle: "Other scene", location: "Europa" },
    ],
  }, "scene-row", locationRowAssignment);
  assert.equal(structureAssignment.changed, true);
  assert.equal(structureAssignment.structureDrafts.scenes[0].location, "Earth");
  assert.equal(structureAssignment.structureDrafts.scenes[1].location, "Europa");
  const sceneStoreAssignment = upsertWorldSpineLocationAssignmentInSceneStore({}, {
    projectId: "project-row",
    sceneId: "scene-row",
    sceneRecord: patchedSceneRecord,
    assignment: locationRowAssignment,
  });
  assert.equal(sceneStoreAssignment["project-row"]["scene-row"].location, "Earth");
  assert.equal(sceneStoreAssignment["project-row"]["scene-row"].worldSpineMetadata.locationRowLabel, "Earth");
  const preservedSceneStoreAssignment = upsertWorldSpineLocationAssignmentInSceneStore({
    "project-row": {
      "scene-row": {
        sceneId: "scene-row",
        editorText: "Existing manuscript body.",
        blocks: [{ blockId: "body-block", text: "Existing manuscript body." }],
      },
    },
  }, {
    projectId: "project-row",
    sceneId: "scene-row",
    sceneRecord: {
      sceneId: "scene-row",
      location: "Earth",
      worldSpineMetadata: {
        sublocation: "The Lost Facility",
      },
    },
    assignment: locationRowAssignment,
  });
  assert.equal(preservedSceneStoreAssignment["project-row"]["scene-row"].editorText, "Existing manuscript body.");
  assert.equal(preservedSceneStoreAssignment["project-row"]["scene-row"].blocks[0].text, "Existing manuscript body.");
  assert.equal(preservedSceneStoreAssignment["project-row"]["scene-row"].locationRowKey, "earth");
  assert.equal(preservedSceneStoreAssignment["project-row"]["scene-row"].worldSpineMetadata.sublocation, "The Lost Facility");
  const placeLinkAssignment = applyWorldSpineLocationAssignmentToWorldPlaceLinks({
    entities: [
      { id: "entity-earth", name: "Earth", categoryId: "planet", templateName: "Planet" },
      { id: "entity-europa", name: "Europa", categoryId: "planet", templateName: "Planet" },
      { id: "entity-storm-rail", name: "Storm Rail", categoryId: "weapon", templateName: "Weapon" },
    ],
    entityLinks: [
      { id: "link-earth", entityId: "entity-earth", kind: "timeline-presence", nodeId: "scene:scene-row" },
      { id: "link-europa", entityId: "entity-europa", kind: "timeline-presence", nodeId: "scene:scene-row" },
      { id: "link-weapon", entityId: "entity-storm-rail", kind: "timeline-presence", nodeId: "scene:scene-row" },
    ],
    spines: [
      {
        id: "spine-1",
        nodes: [
          {
            id: "scene:scene-row",
            linkedEntityIds: ["entity-earth", "entity-europa", "entity-storm-rail"],
            linkedEntityNames: ["Earth", "Europa", "Storm Rail"],
          },
        ],
      },
    ],
  }, {
    nodeIds: ["scene:scene-row"],
    assignment: locationRowAssignment,
  });
  assert.equal(placeLinkAssignment.changed, true);
  assert.deepEqual(placeLinkAssignment.removedEntityLinkIds, ["link-europa"]);
  assert.deepEqual(placeLinkAssignment.world.entityLinks.map((link) => link.id), ["link-earth", "link-weapon"]);
  assert.deepEqual(placeLinkAssignment.world.spines[0].nodes[0].linkedEntityIds, ["entity-earth", "entity-storm-rail"]);
  assert.deepEqual(placeLinkAssignment.world.spines[0].nodes[0].linkedEntityNames, ["Earth", "Storm Rail"]);

  const unplacedAssignment = createWorldSpineUnplacedLocationRowAssignment({ locationScope: "planetary" });
  const unplacedSceneRecord = applyWorldSpineUnplacementToSceneRecord({
    sceneId: "scene-row",
    location: "Earth",
    childLocation: "The Icarus",
    orbitalBand: "Low orbit",
    worldSpineMetadata: {
      location: "Earth",
      childLocation: "The Icarus",
      sublocation: "The Icarus",
      orbitalBand: "Low orbit",
    },
    blocks: [{ blockId: "block-row", text: "The manuscript survives." }],
  }, unplacedAssignment);
  assert.equal(unplacedSceneRecord.location, "Earth");
  assert.equal(unplacedSceneRecord.locationRowLabel, "Unplaced location");
  assert.equal(unplacedSceneRecord.locationRowKey, "unplaced-location");
  assert.equal(unplacedSceneRecord.childLocation, "The Icarus");
  assert.equal(unplacedSceneRecord.worldSpineMetadata.location, "Earth");
  assert.equal(unplacedSceneRecord.worldSpineMetadata.sublocation, "The Icarus");
  assert.equal(unplacedSceneRecord.blocks[0].text, "The manuscript survives.");
  const unplacedEventTags = applyWorldSpineUnplacementToSceneEventTags([
    {
      id: "event-row",
      blockId: "block-row",
      location: "Earth",
      metadata: { childLocation: "The Icarus" },
    },
  ], unplacedSceneRecord, unplacedAssignment);
  assert.deepEqual(unplacedEventTags.changedEventTagIds, ["event-row"]);
  assert.equal(unplacedEventTags.eventTags[0].location, "Earth");
  assert.equal(unplacedEventTags.eventTags[0].locationRowKey, "unplaced-location");
  assert.equal(unplacedEventTags.eventTags[0].metadata.childLocation, "The Icarus");
  const unplacedStructure = applyWorldSpineUnplacementToStructureDrafts({
    scenes: [{ sceneId: "scene-row", location: "Earth", editorText: "Retained body" }],
  }, "scene-row", unplacedAssignment);
  assert.equal(unplacedStructure.changed, true);
  assert.equal(unplacedStructure.structureDrafts.scenes[0].location, "Earth");
  assert.equal(unplacedStructure.structureDrafts.scenes[0].locationRowKey, "unplaced-location");
  assert.equal(unplacedStructure.structureDrafts.scenes[0].editorText, "Retained body");
  const unplacedSceneStore = upsertWorldSpineUnplacementInSceneStore({
    "project-row": {
      "scene-row": {
        sceneId: "scene-row",
        editorText: "Retained body",
        blocks: [{ blockId: "block-row", text: "Retained body" }],
      },
    },
  }, {
    projectId: "project-row",
    sceneId: "scene-row",
    sceneRecord: unplacedSceneRecord,
    assignment: unplacedAssignment,
  });
  assert.equal(unplacedSceneStore["project-row"]["scene-row"].location, "Earth");
  assert.equal(unplacedSceneStore["project-row"]["scene-row"].locationRowKey, "unplaced-location");
  assert.equal(unplacedSceneStore["project-row"]["scene-row"].blocks[0].text, "The manuscript survives.");
  const unplacedPlaceLinks = applyWorldSpineLocationAssignmentToWorldPlaceLinks({
    entities: [
      { id: "entity-earth", name: "Earth", categoryId: "planet", image: { name: "earth.png" } },
      { id: "entity-icarus", name: "The Icarus", categoryId: "vehicle" },
      { id: "entity-weapon", name: "Storm Rail", categoryId: "weapon" },
    ],
    entityLinks: [
      { id: "link-earth", entityId: "entity-earth", kind: "timeline-presence", nodeId: "scene:scene-row" },
      { id: "link-icarus", entityId: "entity-icarus", kind: "timeline-presence", nodeId: "scene:scene-row" },
      { id: "link-weapon", entityId: "entity-weapon", kind: "timeline-presence", nodeId: "scene:scene-row" },
    ],
    edges: [{ id: "edge-retained", fromNodeId: "scene:scene-row", toNodeId: "node-other", kind: "implicates" }],
  }, {
    nodeIds: ["scene:scene-row"],
    assignment: unplacedAssignment,
  });
  assert.deepEqual(unplacedPlaceLinks.world.entityLinks.map((link) => link.id), ["link-icarus", "link-weapon"]);
  assert.equal(unplacedPlaceLinks.world.entities[0].image.name, "earth.png");
  assert.equal(unplacedPlaceLinks.world.edges[0].id, "edge-retained");

  const unplacedDockModel = buildWorldSpineTimelineModel({
    workspace: {
      project: {
        eventTags: [{
          id: "event-unplaced-child",
          label: "Docked child beat",
          blockId: "block-unplaced",
        }],
      },
      world: {
        entities: [],
        spines: [],
        edges: [{
          id: "edge-unplaced-to-mars",
          fromNodeId: "scene:scene-unplaced",
          toNodeId: "scene:scene-mars",
          kind: "implicates",
        }],
      },
    },
    scenes: [
      {
        sceneId: "scene-earth",
        sceneTitle: "Earth first",
        location: "Earth",
        worldSpineMetadata: { locationRowLabel: "Earth", locationRowKey: "earth" },
        blocks: [{ blockId: "block-earth", lineNumber: 1, text: "Earth text." }],
      },
      {
        sceneId: "scene-unplaced",
        sceneTitle: "Unplaced second",
        location: "Europa",
        worldSpineMetadata: {
          location: "Europa",
          locationRowLabel: "Unplaced location",
          locationRowKey: "unplaced-location",
          childLocation: "The Icarus",
        },
        blocks: [{ blockId: "block-unplaced", lineNumber: 2, text: "Unplaced text." }],
      },
      {
        sceneId: "scene-mars",
        sceneTitle: "Mars third",
        location: "Mars",
        worldSpineMetadata: { locationRowLabel: "Mars", locationRowKey: "mars" },
        blocks: [{ blockId: "block-mars", lineNumber: 3, text: "Mars text." }],
      },
    ],
  });
  assert.deepEqual(unplacedDockModel.timeline.locationRows.map((row) => row.locationLabel), ["Earth", "Mars"]);
  assert.equal(unplacedDockModel.timeline.unplacedDock.count, 1);
  assert.deepEqual(unplacedDockModel.timeline.unplacedDock.primaryNodeIds, ["scene:scene-unplaced"]);
  assert.equal(unplacedDockModel.timeline.unplacedDock.primaryNodes[0].x, 370);
  assert.deepEqual(unplacedDockModel.timeline.primaryNodes.map((node) => node.x), [120, 370, 620]);
  assert.equal(unplacedDockModel.timeline.canvasNodes.some((node) => node.id === "scene:scene-unplaced"), false);
  assert.equal(unplacedDockModel.timeline.canvasNodes.some((node) => node.parentNodeId === "scene:scene-unplaced"), false);
  const canvasNodeIds = new Set(unplacedDockModel.timeline.canvasNodes.map((node) => node.id));
  assert.equal(unplacedDockModel.timeline.canvasConnections.every((connection) => (
    canvasNodeIds.has(connection.fromNodeId) && canvasNodeIds.has(connection.toNodeId)
  )), true);
  assert.equal(unplacedDockModel.timeline.connections.some((connection) => connection.kind === "implication"), true);
  const unplacedDockHtml = renderWorldSpinePanelHTML(unplacedDockModel, { unplacedDockCollapsed: false });
  assert.match(unplacedDockHtml, /data-world-spine-unplaced-dock/);
  assert.match(unplacedDockHtml, /data-world-spine-unplaced-count="1"/);
  assert.match(unplacedDockHtml, /data-world-spine-node-surface="unplaced-dock"/);
  assert.equal((unplacedDockHtml.match(/data-world-spine-node-id="scene:scene-unplaced"/g) ?? []).length, 1);
  assert.match(unplacedDockHtml, /Unplaced location/);
  const unplacedDockMarkup = unplacedDockHtml.match(/<section[\s\S]*?data-world-spine-unplaced-dock[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.doesNotMatch(unplacedDockMarkup, /Unplaced location \/ Europa/);
  const collapsedUnplacedDockHtml = renderWorldSpinePanelHTML(unplacedDockModel, { unplacedDockCollapsed: true });
  assert.match(collapsedUnplacedDockHtml, /data-world-spine-unplaced-dock-collapsed="true"/);
  assert.match(collapsedUnplacedDockHtml, /aria-expanded="false"/);
  assert.doesNotMatch(collapsedUnplacedDockHtml, /data-world-spine-node-surface="unplaced-dock"/);
  const filteredUnplacedDockHtml = renderWorldSpinePanelHTML(unplacedDockModel, {
    locationFilter: { selectedLocationKeys: ["earth"] },
  });
  assert.match(filteredUnplacedDockHtml, /data-world-spine-unplaced-dock-visible="false"/);
  assert.doesNotMatch(filteredUnplacedDockHtml, /<section[\s\S]*?data-world-spine-unplaced-dock/);

  const sublocationModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        entities: [
          { id: "planet-earth", name: "Earth", categoryId: "planet", templateName: "Planet" },
          {
            id: "vehicle-icarus",
            name: "The Icarus",
            categoryId: "vehicle",
            templateName: "Vehicle",
            fields: [{ key: "parentPlace", value: "Earth" }],
          },
        ],
        spines: [],
      },
    },
    scenes: [{
      sceneId: "scene-low-orbit",
      chapterId: "chapter-2",
      chapterTitle: "Chapter 2",
      sceneTitle: "Low Orbit Burn",
      location: "The Icarus",
      worldSpineMetadata: {
        orbitalBand: "Low orbit",
      },
      blocks: [{ blockId: "block-orbit", lineNumber: 12, kind: "narration", text: "The Icarus crossed low orbit." }],
    }],
  });
  const sublocationNode = findWorldSpineNode(sublocationModel, "scene:scene-low-orbit");
  assert.deepEqual(sublocationModel.timeline.locationRows.map((row) => row.locationLabel), ["Earth"]);
  assert.equal(sublocationNode.location, "The Icarus");
  assert.equal(sublocationNode.locationLabel, "The Icarus");
  assert.equal(sublocationNode.locationKey, "the-icarus");
  assert.equal(sublocationNode.locationRowLabel, "Earth");
  assert.equal(sublocationNode.locationRowKey, "earth");
  assert.equal(sublocationNode.eventLocationLabel, "The Icarus");
  assert.equal(sublocationNode.sublocationLabel, "The Icarus");
  assert.equal(sublocationNode.orbitalBand, "Low orbit");
  assert.equal(sublocationNode.locationWarning, null);
  const sublocationHtml = renderWorldSpinePanelHTML(sublocationModel);
  assert.match(sublocationHtml, /data-world-spine-sublocation-label="The Icarus"/);
  assert.match(sublocationHtml, /data-world-spine-orbital-band="Low orbit"/);
  assert.match(sublocationHtml, /Earth \/ The Icarus \/ Low orbit/);
  const nestedPlacementModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        entities: [],
        spines: [{
          id: "spine-placement",
          label: "Placement DTO",
          nodes: [{
            id: "node-placement",
            label: "Low orbit arrival",
            summary: "A DTO-only node carries row and child-location data.",
            locationPlacement: {
              locationLabel: "Docking Ring",
              locationKey: "docking-ring",
              locationRowLabel: "Earth",
              locationRowKey: "earth",
              locationScope: "planetary",
              eventLocationLabel: "Docking Ring",
              eventLocationKey: "docking-ring",
              coreLocationLabel: "Earth",
              coreLocationKey: "earth",
              sublocationLabel: "Docking Ring",
              sublocationKey: "docking-ring",
              orbitalBand: "Low orbit",
            },
          }],
        }],
      },
    },
    scenes: [],
  });
  const nestedPlacementNode = findWorldSpineNode(nestedPlacementModel, "node-placement");
  assert.deepEqual(nestedPlacementModel.timeline.locationRows.map((row) => row.locationLabel), ["Earth"]);
  assert.equal(nestedPlacementNode.location, "Docking Ring");
  assert.equal(nestedPlacementNode.locationRowLabel, "Earth");
  assert.equal(nestedPlacementNode.sublocationLabel, "Docking Ring");
  assert.equal(nestedPlacementNode.orbitalBand, "Low orbit");
  assert.deepEqual(model.timeline.primaryNodes[0].sceneBeats, ["Arrival beat", "Signal beat"]);
  assert.equal(isWorldSpineAssignableEventNode(findWorldSpineNode(model, "scene:scene-1")), true);
  assert.equal(isWorldSpineAssignableEventNode(findWorldSpineNode(model, "metadata:metadata-beat:scene-1:arrival-beat")), true);
  assert.equal(isWorldSpineAssignableEventNode(findWorldSpineNode(model, "ref:person:scene-1:john")), false);
  assert.deepEqual(
    resolveWorldSpineViewportChapterAnchor({
      nodes: [
        {
          id: "scene:opening",
          level: "primary",
          kind: "scene",
          x: 0,
          width: 160,
          sceneId: "opening",
          sceneTitle: "Opening Signal",
          chapterId: "chapter-1",
          chapterTitle: "Chapter 1",
        },
        {
          id: "scene:fallout",
          level: "primary",
          kind: "scene",
          x: 340,
          width: 160,
          sceneId: "fallout",
          sceneTitle: "Fallout",
          chapterId: "chapter-2",
          chapterTitle: "Chapter 2",
        },
      ],
      scrollLeft: 300,
      viewportWidth: 220,
    }),
    {
      nodeId: "scene:fallout",
      sceneId: "fallout",
      chapterId: "chapter-2",
      chapterTitle: "Chapter 2",
      sceneTitle: "Fallout",
      label: "Looking over Chapter 2",
    },
  );
  assert.equal(normalizeWorldSpineTimelineZoom(0.1), 0.7);
  assert.equal(normalizeWorldSpineTimelineZoom(2.2), 1.6);
  assert.equal(resolveWorldSpineTimelineZoomFromWheel(1, -100), 1.1);
  assert.equal(resolveWorldSpineTimelineZoomFromWheel(1, 100), 0.9);
  assert.deepEqual(
    resolveWorldSpineTimelineWheelScrollPlan({ deltaX: 0, deltaY: 120, shiftKey: false }),
    { axis: "horizontal", delta: 120 },
  );
  assert.deepEqual(
    resolveWorldSpineTimelineWheelScrollPlan({ deltaX: 0, deltaY: 120, shiftKey: true }),
    { axis: "vertical", delta: 120 },
  );
  assert.deepEqual(
    resolveWorldSpineTimelineWheelScrollPlan({ deltaX: -90, deltaY: 20, shiftKey: true }),
    { axis: "vertical", delta: -90 },
  );
  assert.deepEqual(
    resolveWorldSpineTimelineWheelScrollPlan({ deltaX: 0, deltaY: 0, shiftKey: true }),
    { axis: "none", delta: 0 },
  );
  assert.equal(model.timeline.primaryNodes[1].id, "node-world-2");
  assert.equal(model.timeline.primaryNodes[1].location, "Subsurface Facility");
  assert.deepEqual(model.timeline.primaryNodes[1].people, ["John", "Ava"]);
  assert.equal(model.timeline.primaryNodes[1].criticalEvents[0], "Beacon wakes");
  assert.equal(model.timeline.childNodes.some((node) => node.id === "event:event-1"), true);
  assert.equal(model.timeline.childNodes.some((node) =>
    node.id === "metadata:metadata-beat:scene-1:arrival-beat" &&
    node.kind === "beat" &&
    node.typeLabel === "Scene beat"
  ), true);
  assert.equal(model.timeline.childNodes.some((node) => node.id === "metadata:metadata-event:scene-1:docking-clamps-catch"), true);
  assert.equal(model.timeline.childNodes.some((node) => node.id === "metadata:metadata-location:scene-1:observation-deck"), true);
  assert.equal(model.timeline.childNodes.some((node) => node.id === "node-world-1"), true);
  assert.equal(model.timeline.referenceNodes.some((node) => node.kind === "location"), true);
  assert.equal(model.stats.implicationEdgeCount, 3);
  assert.equal(model.timeline.connections.some((connection) =>
    connection.kind === "implication" &&
    connection.fromNodeId === "event:event-1" &&
    connection.toNodeId === "scene:scene-2" &&
    connection.label === "Ava's signal changes the briefing stakes"
  ), true);
  const childToSceneConnection = model.timeline.connections.find((connection) => connection.id === "edge-1");
  assert.ok(childToSceneConnection);
  assert.equal(childToSceneConnection.fromNodeId, "event:event-1");
  assert.equal(childToSceneConnection.renderFromNodeId, "scene:scene-1");
  assert.equal(childToSceneConnection.renderToNodeId, "scene:scene-2");
  assertImplicationUsesEventBlockHandles(childToSceneConnection, model, {
    fromSide: "right",
    toSide: "left",
    routeDirection: "below",
  });
  const lowerReferenceConnection = model.timeline.connections.find((connection) => connection.id === "edge-2");
  assert.ok(lowerReferenceConnection);
  assert.equal(lowerReferenceConnection.kind, "implication");
  assert.equal(lowerReferenceConnection.renderFromNodeId, "scene:scene-1");
  assert.equal(lowerReferenceConnection.renderToNodeId, "scene:scene-2");
  assertImplicationUsesEventBlockHandles(lowerReferenceConnection, model, {
    fromSide: "right",
    toSide: "left",
    routeDirection: "above",
  });
  const primaryConnection = model.timeline.connections.find((connection) => connection.id === "edge-3");
  assert.ok(primaryConnection);
  assertImplicationUsesEventBlockHandles(primaryConnection, model, {
    fromSide: "right",
    toSide: "left",
    routeDirection: "below",
  });
  assert.equal(model.manuscript.scenes[0].blocks[1].isSelected, true);

  const eventNode = findWorldSpineNode(model, "event:event-1");
  assert.equal(eventNode.primaryBlockId, "block-2");
  assert.equal(eventNode.isSelected, true);
  assert.equal(eventNode.location, "Ceres Dock");
  assert.deepEqual(eventNode.linkedEntityNames, ["The Icarus"]);
  const sceneOneNode = findWorldSpineNode(model, "scene:scene-1");
  const sceneTwoNode = findWorldSpineNode(model, "scene:scene-2");
  const worldOnlyNode = findWorldSpineNode(model, "node-world-2");
  assert.equal(sceneOneNode.chapterId, "chapter-1");
  assert.deepEqual(
    resolveWorldSpineSceneReorderDropTarget({
      sourceNodeId: "scene:scene-2",
      targetNodeId: "scene:scene-1",
      pointerX: sceneOneNode.x - 4,
      nodes: model.timeline.primaryNodes,
    }),
    {
      type: "before",
      nodeId: "scene:scene-1",
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
    },
  );
  assert.deepEqual(
    resolveWorldSpineSceneReorderDropTarget({
      sourceNodeId: "scene:scene-1",
      targetNodeId: "scene:scene-2",
      pointerX: sceneTwoNode.x + sceneTwoNode.width + 4,
      nodes: model.timeline.primaryNodes,
    }),
    {
      type: "after",
      nodeId: "scene:scene-2",
      sceneId: "scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
    },
  );
  assert.equal(
    resolveWorldSpineSceneReorderDropTarget({
      sourceNodeId: worldOnlyNode.id,
      targetNodeId: "scene:scene-1",
      pointerX: sceneOneNode.x,
      nodes: model.timeline.primaryNodes,
    }),
    null,
  );

  const panelHtml = renderWorldSpinePanelHTML(model, {
    layout: {
      eventRailWidth: 260,
      manuscriptPaneWidth: 360,
    },
    history: {
      canUndo: true,
      canRedo: false,
    },
  });
  assert.match(panelHtml, /data-world-spine-root/);
  assert.match(panelHtml, /--world-spine-event-rail-width:260px/);
  assert.match(panelHtml, /--world-spine-manuscript-pane-width:360px/);
  assert.match(panelHtml, /data-action="world-spine-undo"/);
  assert.match(panelHtml, /data-action="world-spine-redo"[\s\S]*?disabled/);
  assert.match(panelHtml, /data-world-spine-resize-handle="event-rail"/);
  assert.match(panelHtml, /data-world-spine-resize-handle="manuscript-pane"/);
  assert.match(panelHtml, /data-world-spine-timeline-scroll/);
  assert.match(panelHtml, /data-world-spine-manuscript-scroll/);
  assert.match(panelHtml, /data-action="set-world-spine-right-pane-mode"/);
  assert.match(panelHtml, /data-world-spine-right-pane-mode="manuscript"[\s\S]*aria-pressed="true"/);
  assert.match(panelHtml, /data-world-spine-right-pane-mode="event-section"/);
  assert.match(panelHtml, /data-world-spine-right-pane-mode="related-cards"/);
  assert.match(panelHtml, /data-world-spine-chapter-anchor/);
  assert.match(panelHtml, /world-spine-event-list__chapter/);
  assert.match(panelHtml, /data-world-spine-rail-chapter-id="chapter-1"/);
  assert.match(panelHtml, /Chapter 1[\s\S]*data-node-id="scene:scene-1"/);
  assert.match(panelHtml, /--world-spine-timeline-zoom:1/);
  assert.match(panelHtml, /data-world-spine-timeline-zoom="1"/);
  assert.match(panelHtml, /data-world-spine-timeline-zoom-frame/);
  assert.match(panelHtml, /data-world-spine-canvas-width="\d+"/);
  assert.match(panelHtml, /data-world-spine-canvas-height="\d+"/);
  assert.match(panelHtml, /Looking over/);
  assert.match(panelHtml, /Chapter 1/);
  assert.match(panelHtml, /Ceres Arrival/);
  assert.match(panelHtml, /<svg class="world-spine-connections"[^>]*style="width:\d+px; height:\d+px;"/);
  assert.match(panelHtml, /data-world-spine-drop-index="0"/);
  assert.match(panelHtml, /data-world-spine-drop-spine-id="spine-1"/);
  assert.match(panelHtml, /data-world-spine-location-row-guide/);
  assert.match(panelHtml, /data-world-spine-location-row-artwork/);
  assert.match(panelHtml, /data-world-spine-location-row-artwork-height="\d+(?:\.\d+)?"/);
  assert.match(panelHtml, /data:image\/png;base64,Y2VyZXM=/);
  assert.match(panelHtml, /\/api\/project-media\/file\//);
  assert.match(panelHtml, /subsurface-facility\.png/);
  assert.match(panelHtml, /data-world-spine-location-label="Ceres Dock"/);
  assert.match(panelHtml, /data-world-spine-drop-location-label="Ceres Dock"/);
  assert.doesNotMatch(panelHtml, /data-world-spine-tier-guide/);
  assert.match(panelHtml, /data-world-spine-link-handle="left"/);
  assert.match(panelHtml, /data-world-spine-link-handle="right"/);
  assert.match(panelHtml, /data-world-spine-node-layer/);
  assert.match(panelHtml, /data-world-spine-implication-connections/);
  assert.match(panelHtml, /world-spine-connection--implication/);
  assert.match(panelHtml, /Ava&#39;s signal changes the briefing stakes/);
  assert.match(panelHtml, /Dock geography echoes the briefing room/);
  assert.match(panelHtml, /Arrival sets up the briefing/);
  const structuralConnectionSvg = extractSvgByClass(panelHtml, "world-spine-connections");
  const nodeLayerHtml = extractElementByDataAttribute(panelHtml, "data-world-spine-node-layer");
  const implicationConnectionSvg = extractSvgByClass(panelHtml, "world-spine-node-layer__implications");
  assert.doesNotMatch(panelHtml, /world-spine-connection--main/);
  assert.doesNotMatch(structuralConnectionSvg, /world-spine-connection--implication/);
  assert.match(nodeLayerHtml, /world-spine-node-layer__implications/);
  assert.match(implicationConnectionSvg, /style="width:\d+px; height:\d+px;"/);
  assert.match(nodeLayerHtml, /world-spine-node--primary/);
  assert.match(implicationConnectionSvg, /world-spine-connection--implication/);
  assert.match(implicationConnectionSvg, /Ava&#39;s signal changes the briefing stakes/);
  assert.match(implicationConnectionSvg, /data-world-spine-render-from-node-id="scene:scene-1"/);
  assert.match(implicationConnectionSvg, /data-world-spine-render-to-node-id="scene:scene-2"/);
  assert.match(implicationConnectionSvg, /data-world-spine-connection-path/);
  assert.match(implicationConnectionSvg, /data-world-spine-connection-hit-path/);
  assert.match(implicationConnectionSvg, /world-spine-connection-hit-area/);
  assert.match(implicationConnectionSvg, /data-world-spine-connection-label/);
  assert.match(implicationConnectionSvg, /data-world-spine-connection-label-text="Ava&#39;s signal changes the briefing stakes"/);
  assert.match(implicationConnectionSvg, /data-world-spine-from-node-id="event:event-1"/);
  assert.match(implicationConnectionSvg, /data-world-spine-to-node-id="scene:scene-2"/);
  assert.match(implicationConnectionSvg, /data-world-spine-route-direction="below"/);
  assert.match(implicationConnectionSvg, /data-world-spine-route-direction="above"/);
  assert.match(implicationConnectionSvg, /data-world-spine-obstacle-count="1"/);
  assert.doesNotMatch(panelHtml, /data-world-spine-implication-chip/);
  assert.doesNotMatch(panelHtml, /world-spine-implication-chip/);
  assert.match(panelHtml, /data-world-spine-connection-id="edge-1"/);
  assert.match(panelHtml, /world-spine-node--primary/);
  assert.match(panelHtml, /data-world-spine-node-level="primary"/);
  assert.match(panelHtml, /data-world-spine-node-kind="scene"/);
  assert.match(panelHtml, /data-world-spine-node-kind="beat"/);
  assert.match(panelHtml, /data-world-spine-parent-node-id="scene:scene-1"/);
  assert.match(panelHtml, /world-spine-node--reference/);
  assert.match(panelHtml, /title="People present"[^>]*>P</);
  assert.match(panelHtml, /title="Scene beat"[^>]*>B</);
  assert.match(panelHtml, /title="Critical event"[^>]*>C</);
  assert.doesNotMatch(panelHtml, /World Inspector/);
  assert.equal(normalizeWorldSpineRightPaneMode("event-section"), "event-section");
  assert.equal(normalizeWorldSpineRightPaneMode("related-cards"), "related-cards");
  assert.equal(normalizeWorldSpineRightPaneMode("unknown"), "manuscript");

  const eventSectionHtml = renderWorldSpinePanelHTML(model, {
    rightPaneMode: "event-section",
  });
  assert.match(eventSectionHtml, /world-spine-right-pane--event-section/);
  assert.match(eventSectionHtml, /Event Section/);
  assert.match(eventSectionHtml, /In-scene event: Ava reveals the signal/);
  assert.match(eventSectionHtml, /data-world-spine-event-section-node-id="event:event-1"/);
  assert.match(eventSectionHtml, /data-world-spine-event-section-block-id="block-2"/);
  assert.match(eventSectionHtml, /data-world-spine-right-pane-mode="event-section"[\s\S]*aria-pressed="true"/);
  assert.match(eventSectionHtml, /The ship settled against Ceres Dock\./);
  assert.match(eventSectionHtml, /There it is\./);
  assert.match(eventSectionHtml, /world-spine-event-section-block is-anchor[\s\S]*data-line-id="block-2"/);

  const relatedCardsModel = {
    hasScope: true,
    scopeLabel: "In-scene event: Ava reveals the signal",
    groups: [
      {
        id: "location",
        label: "Location > Earth",
        canAddSublocation: true,
        nodeId: "event:event-1",
        sceneId: "scene-1",
        locationLabel: "Earth",
        items: [
          {
            id: "location:earth",
            itemKind: "locationContext",
            categoryId: "location",
            title: "Earth",
            meta: "Main location",
            detailSummary: "Current event location.",
            detailRows: [
              { label: "Location", value: "Earth" },
              { label: "Child location", value: "The Mess" },
            ],
            canAttachImage: false,
            canEditSceneMetadata: true,
            sceneId: "scene-1",
          },
        ],
      },
      {
        id: "character",
        label: "Characters",
        items: [
          {
            id: "entity-ava",
            itemKind: "entity",
            categoryId: "character",
            title: "Ava Meerakavita",
            meta: "Character",
            detailSummary: "Senior councillor.",
            detailRows: [
              { label: "Role", value: "Navigator" },
              { label: "Entity ID", value: "entity-ava" },
            ],
            image: {
              dataUrl: "data:image/png;base64,aXZh",
              mediaType: "image/png",
              name: "ava.png",
              size: 3,
            },
          },
        ],
      },
    ],
  };
  const relatedCardsHtml = renderWorldSpinePanelHTML(model, {
    rightPaneMode: "related-cards",
    relatedCards: relatedCardsModel,
  });
  assert.match(relatedCardsHtml, /world-spine-right-pane--related/);
  assert.match(relatedCardsHtml, /Related Cards/);
  assert.match(relatedCardsHtml, /In-scene event: Ava reveals the signal/);
  assert.match(relatedCardsHtml, /Location &gt; Earth/);
  assert.match(relatedCardsHtml, /data-action="open-world-spine-sublocation-composer"/);
  assert.match(relatedCardsHtml, /data-world-spine-node-id="event:event-1"/);
  assert.match(relatedCardsHtml, /title="Add child location"/);
  assert.match(relatedCardsHtml, /data-action="world-spine-edit-scene-metadata"/);
  assert.match(relatedCardsHtml, /data-scene-id="scene-1"/);
  assert.match(relatedCardsHtml, /Ava Meerakavita/);
  assert.match(relatedCardsHtml, /data-action="toggle-world-spine-related-card"/);
  assert.match(relatedCardsHtml, /data-world-spine-related-card-key="entity:entity-ava"/);
  assert.match(relatedCardsHtml, /aria-expanded="false"/);
  assert.match(relatedCardsHtml, /data-action="attach-worldbuilding-catalogue-image"/);
  assert.match(relatedCardsHtml, /world-spine-related-card__media[\s\S]*data:image\/png;base64,aXZh/);
  assert.doesNotMatch(relatedCardsHtml, /Senior councillor\./);
  assert.doesNotMatch(relatedCardsHtml, /Navigator/);
  assert.doesNotMatch(relatedCardsHtml, /Entity ID/);

  const sublocationComposerHtml = renderWorldSpinePanelHTML(model, {
    rightPaneMode: "related-cards",
    relatedCards: relatedCardsModel,
    sublocationComposer: {
      nodeId: "event:event-1",
      sublocation: "Docking Ring",
    },
  });
  assert.match(sublocationComposerHtml, /data-world-spine-sublocation-form/);
  assert.match(sublocationComposerHtml, /data-world-spine-location-label="Earth"/);
  assert.match(sublocationComposerHtml, /data-world-spine-sublocation-field="sublocation"/);
  assert.match(sublocationComposerHtml, />Child location</);
  assert.match(sublocationComposerHtml, /value="Docking Ring"/);
  assert.match(sublocationComposerHtml, /data-action="save-world-spine-sublocation"/);

  const expandedRelatedCardsHtml = renderWorldSpinePanelHTML(model, {
    rightPaneMode: "related-cards",
    relatedCards: relatedCardsModel,
    relatedCardExpandedKey: "entity:entity-ava",
  });
  assert.match(expandedRelatedCardsHtml, /world-spine-related-card is-expanded/);
  assert.match(expandedRelatedCardsHtml, /aria-expanded="true"/);
  assert.match(expandedRelatedCardsHtml, /Senior councillor\./);
  assert.match(expandedRelatedCardsHtml, /Navigator/);
  assert.doesNotMatch(expandedRelatedCardsHtml, /Entity ID/);

  const splitChapterModel = buildWorldSpineTimelineModel({
    workspace: {
      project: {},
      world: {
        title: "Story Timeline",
        spines: [],
      },
    },
    scenes: [
      {
        sceneId: "chapter-one-scene",
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        sceneTitle: "First chapter scene",
        blocks: [{ blockId: "chapter-one-block", lineNumber: 1, kind: "narration", text: "First chapter text." }],
      },
      {
        sceneId: "chapter-two-scene",
        chapterId: "chapter-2",
        chapterTitle: "Chapter 2",
        sceneTitle: "Second chapter scene",
        blocks: [{ blockId: "chapter-two-block", lineNumber: 2, kind: "narration", text: "Second chapter text." }],
      },
    ],
  });
  assert.deepEqual(
    splitChapterModel.eventRailItems
      .filter((item) => item.type === "chapter")
      .map((item) => item.title),
    ["Chapter 1", "Chapter 2"],
  );
  const splitChapterRailHtml = renderWorldSpinePanelHTML(splitChapterModel);
  assert.match(splitChapterRailHtml, /data-world-spine-rail-chapter-id="chapter-1"/);
  assert.match(splitChapterRailHtml, /data-world-spine-rail-chapter-id="chapter-2"/);
  assert.match(splitChapterRailHtml, /Chapter 1[\s\S]*First chapter scene[\s\S]*Chapter 2[\s\S]*Second chapter scene/);

  const repeatedChapterModel = buildWorldSpineTimelineModel({
    workspace: {
      project: {},
      world: {
        title: "Story Timeline",
        spines: [],
      },
    },
    scenes: [
      {
        sceneId: "opening-scene",
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        sceneTitle: "Opening scene",
        blocks: [{ blockId: "opening-block", lineNumber: 1, kind: "narration", text: "Opening text." }],
      },
      {
        sceneId: "facility-demo",
        chapterId: "chapter-2",
        chapterTitle: "Chapter 2",
        sceneTitle: "Facility demo",
        blocks: [{ blockId: "facility-demo-block", lineNumber: 2, kind: "narration", text: "Facility text." }],
      },
      {
        sceneId: "stale-chapter-scene",
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        sceneTitle: "Stale chapter scene",
        blocks: [{ blockId: "stale-chapter-block", lineNumber: 3, kind: "narration", text: "Stale text." }],
      },
      {
        sceneId: "facility-return",
        chapterId: "chapter-2",
        chapterTitle: "Chapter 2",
        sceneTitle: "Facility return",
        blocks: [{ blockId: "facility-return-block", lineNumber: 4, kind: "narration", text: "Return text." }],
      },
    ],
  });
  assert.deepEqual(
    repeatedChapterModel.eventRailItems
      .filter((item) => item.type === "chapter")
      .map((item) => item.title),
    ["Chapter 1", "Chapter 2"],
  );
  const repeatedChapterRailHtml = renderWorldSpinePanelHTML(repeatedChapterModel);
  assert.equal((repeatedChapterRailHtml.match(/data-world-spine-rail-chapter-id="chapter-1"/g) ?? []).length, 1);
  assert.equal((repeatedChapterRailHtml.match(/data-world-spine-rail-chapter-id="chapter-2"/g) ?? []).length, 1);

  const zoomedPanelHtml = renderWorldSpinePanelHTML(model, { timelineZoom: 1.3 });
  assert.match(zoomedPanelHtml, /--world-spine-timeline-zoom:1.3/);
  assert.match(zoomedPanelHtml, /data-world-spine-timeline-zoom="1.3"/);
  assert.match(
    zoomedPanelHtml,
    new RegExp(`data-world-spine-timeline-zoom-frame[\\s\\S]*width:${Math.round(model.timeline.width * 1.3)}px; height:${Math.round(model.timeline.height * 1.3)}px;`),
  );

  const dualModel = buildWorldSpineTimelineModel({
    workspace: {
      ...workspace,
      world: {
        ...workspace.world,
        spines: [
          workspace.world.spines[0],
          {
            id: "spine-2",
            label: "Oasis Surface",
            nodes: [
              {
                id: "node-oasis-1",
                label: "Oasis wakes",
                summary: "A parallel location changes while the crew travels.",
                sequenceRank: 1.5,
                location: "Oasis",
              },
            ],
          },
          {
            id: "spine-3",
            label: "Europa Orbit",
            nodes: [
              {
                id: "node-europa-1",
                label: "Europa relay burns",
                summary: "A third location advances its own timeline.",
                sequenceRank: 2.5,
                location: "Europa",
              },
            ],
          },
        ],
      },
    },
    scenes,
  });
  const oasisNode = findWorldSpineNode(dualModel, "node-oasis-1");
  const europaNode = findWorldSpineNode(dualModel, "node-europa-1");
  assert.equal(dualModel.timeline.tiers.length, 3);
  assert.deepEqual(
    dualModel.timeline.locationRows.map((row) => row.locationLabel),
    ["Ceres Dock", "Subsurface Facility", "Briefing Room", "Oasis", "Europa"],
  );
  assert.deepEqual(
    dualModel.timeline.locationRows.map((row) => row.label),
    ["Ceres Dock", "Subsurface Facility", "Briefing Room", "Oasis", "Europa"],
  );
  assert.equal(oasisNode.spineId, "spine-2");
  assert.equal(oasisNode.tierIndex, 1);
  assert.equal(oasisNode.y + (oasisNode.height / 2), 680);
  assert.equal(europaNode.spineId, "spine-3");
  assert.equal(europaNode.tierIndex, 2);
  assert.equal(europaNode.y + (europaNode.height / 2), 830);
  const dualPanelHtml = renderWorldSpinePanelHTML(dualModel);
  assert.match(dualPanelHtml, /data-world-spine-tier-guide/);
  assert.match(dualPanelHtml, /data-world-spine-location-row-guide/);
  assert.match(dualPanelHtml, /data-world-spine-location-row-label/);
  assert.doesNotMatch(dualPanelHtml, /Location lane/);
  assert.doesNotMatch(dualPanelHtml, /World Spine \/ Ceres Dock/);
  assert.doesNotMatch(dualPanelHtml, /Europa Orbit \/ Europa/);
  assert.match(dualPanelHtml, /Oasis Surface/);
  assert.match(dualPanelHtml, /Europa Orbit/);
  assert.match(dualPanelHtml, /data-world-spine-drop-spine-id="spine-2"/);
  assert.match(dualPanelHtml, /data-world-spine-drop-spine-id="spine-3"/);
  assert.match(dualPanelHtml, /data-world-spine-drop-location-label="Oasis"/);
  const filteredDualPanelHtml = renderWorldSpinePanelHTML(dualModel, {
    locationFilter: { selectedLocationKeys: ["oasis"] },
    locationFilterOpen: true,
  });
  assert.match(filteredDualPanelHtml, /data-world-spine-location-filter-active="true"/);
  assert.match(filteredDualPanelHtml, /data-world-spine-location-filter-open="true"/);
  assert.match(filteredDualPanelHtml, /data-world-spine-location-filter-fit="true"/);
  assert.match(filteredDualPanelHtml, /data-world-spine-canvas-height="520"/);
  assert.match(filteredDualPanelHtml, /world-spine-location-filter__pane/);
  assert.match(filteredDualPanelHtml, /data-world-spine-location-filter-key="oasis"[\s\S]*?checked/);
  assert.match(filteredDualPanelHtml, /style="left:\d+px; top:192px; width:184px; height:76px;"[\s\S]*data-node-id="node-oasis-1"/);
  assert.match(filteredDualPanelHtml, /data-node-id="node-oasis-1"[\s\S]*?data-world-spine-location-key="oasis"/);
  assert.match(filteredDualPanelHtml, /world-spine-node world-spine-node--primary world-spine-node--world is-filter-target/);
  assert.match(filteredDualPanelHtml, /data-node-id="node-europa-1"[\s\S]*?data-world-spine-location-key="europa"/);
  assert.match(filteredDualPanelHtml, /world-spine-node world-spine-node--primary world-spine-node--world is-filtered-out/);
  const fittedOasisModel = createWorldSpineLocationFilterViewportModel(dualModel, {
    selectedLocationKeys: ["oasis"],
  });
  assert.equal(fittedOasisModel.timeline.locationFilterViewportFit, true);
  assert.equal(fittedOasisModel.timeline.height, 520);
  assert.equal(findWorldSpineNode(fittedOasisModel, "node-oasis-1").y + (oasisNode.height / 2), 230);
  const fittedTwoTimelineModel = createWorldSpineLocationFilterViewportModel(dualModel, {
    selectedLocationKeys: ["oasis", "europa"],
  });
  assert.equal(fittedTwoTimelineModel.timeline.locationFilterViewportFit, true);
  assert.equal(fittedTwoTimelineModel.timeline.height, 520);
  assert.equal(findWorldSpineNode(fittedTwoTimelineModel, "node-oasis-1").y + (oasisNode.height / 2), 230);
  assert.equal(findWorldSpineNode(fittedTwoTimelineModel, "node-europa-1").y + (europaNode.height / 2), 380);
  const bridgeFilterPanelHtml = renderWorldSpinePanelHTML(model, {
    locationFilter: { selectedLocationKeys: ["ceres-dock"] },
  });
  assert.match(bridgeFilterPanelHtml, /world-spine-connection-group--implication is-filter-bridge/);
  const whitespaceContext = resolveWorldSpineWhitespaceContextFromPoint({
    timeline: dualModel.timeline,
    canvasX: oasisNode.x + (oasisNode.width / 2),
    canvasY: oasisNode.y + (oasisNode.height / 2),
    clientX: 540,
    clientY: 320,
  });
  assert.equal(whitespaceContext.spineId, "spine-2");
  assert.equal(whitespaceContext.spineLabel, "Oasis Surface");
  assert.equal(whitespaceContext.tierIndex, 1);
  assert.equal(whitespaceContext.locationLabel, "Oasis");
  assert.equal(whitespaceContext.locationKey, "oasis");
  assert.equal(Number.isFinite(whitespaceContext.dropIndex), true);
  const worldSpineMenuHtml = renderWorldSpineWhitespaceContextMenuHTML(whitespaceContext, {
    width: 800,
    height: 600,
  });
  assert.match(worldSpineMenuHtml, /data-world-spine-context-menu/);
  assert.match(worldSpineMenuHtml, /Insert event here/);
  assert.match(worldSpineMenuHtml, /Add parallel timeline/);
  assert.match(worldSpineMenuHtml, /data-world-spine-id="spine-2"/);
  assert.match(worldSpineMenuHtml, /data-world-spine-location-label="Oasis"/);
  const emptyParallelLaneModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        spines: [
          { id: "spine-main", label: "World Spine", nodes: [] },
          { id: "spine-empty-europa", label: "Europa Timeline", location: "Europa", nodes: [] },
        ],
      },
    },
    scenes: [],
  });
  assert.deepEqual(
    emptyParallelLaneModel.timeline.locationRows.map((row) => row.label),
    ["Insert Location Name", "Europa"],
  );
  const emptyParallelLaneHtml = renderWorldSpinePanelHTML(emptyParallelLaneModel);
  assert.match(emptyParallelLaneHtml, />Insert Location Name<\/strong>/);
  assert.match(emptyParallelLaneHtml, />Europa<\/strong>/);
  assert.match(emptyParallelLaneHtml, /data-action="world-spine-edit-location-row"/);
  assert.match(emptyParallelLaneHtml, /data-world-spine-location-row-prompt="true"/);
  assert.match(emptyParallelLaneHtml, /data-world-spine-row-scene-ids="\[\]"/);
  assert.doesNotMatch(emptyParallelLaneHtml, /Europa Timeline \/ Unplaced location/);
  const populatedDuplicateLaneModel = buildWorldSpineTimelineModel({
    workspace: {
      world: {
        spines: [
          { id: "spine-main", label: "World Spine", nodes: [] },
          { id: "spine-empty-europa", label: "Europa Timeline", location: "Europa", nodes: [] },
        ],
      },
    },
    scenes: [{
      sceneId: "scene-europa-dragged",
      chapterId: "chapter-europa",
      chapterTitle: "Chapter Europa",
      sceneTitle: "Dragged to Europa",
      location: "Europa",
      worldSpineMetadata: {
        locationRowLabel: "Europa",
        locationRowKey: "unplaced-location",
      },
      blocks: [{ blockId: "block-europa", lineNumber: 4, kind: "narration", text: "The event moves to Europa." }],
    }],
  });
  assert.deepEqual(
    populatedDuplicateLaneModel.timeline.locationRows.map((row) => row.locationLabel),
    ["Europa"],
  );
  assert.deepEqual(populatedDuplicateLaneModel.timeline.locationRows.map((row) => row.locationKey), ["europa"]);
  assert.deepEqual(populatedDuplicateLaneModel.timeline.locationRows[0].sceneIds, ["scene-europa-dragged"]);
  const locationRowFormHtml = renderWorldSpineWhitespaceContextMenuHTML({
    ...whitespaceContext,
    menuType: "location-form",
    location: "",
    pickerOptionSets: {
      location: ["Oasis", "Europa Orbit"],
    },
  }, {
    width: 800,
    height: 600,
  });
  assert.match(locationRowFormHtml, /data-world-spine-context-kind="location-form"/);
  assert.match(locationRowFormHtml, /Location row/);
  assert.match(locationRowFormHtml, /data-action="save-world-spine-location-row"/);
  assert.match(locationRowFormHtml, /data-action="attach-world-spine-location-row-image"/);
  assert.doesNotMatch(locationRowFormHtml, /data-action="delete-world-spine-location-row"/);
  assert.match(locationRowFormHtml, /data-world-spine-location-label=""/);
  assert.doesNotMatch(locationRowFormHtml, /data-world-spine-parallel-timeline-field="participants"/);
  const populatedLocationRowFormHtml = renderWorldSpineWhitespaceContextMenuHTML({
    ...whitespaceContext,
    menuType: "location-form",
    location: "Earth",
    locationLabel: "Earth",
    primaryNodeIds: ["scene:scene-earth"],
    sceneIds: ["scene-earth"],
  }, {
    width: 800,
    height: 600,
  });
  assert.match(populatedLocationRowFormHtml, /data-action="delete-world-spine-location-row"/);
  const sceneOnlyLocationRow = {
    menuType: "location-form",
    location: "Earth",
    locationLabel: "Earth",
    sceneIds: ["scene-earth"],
  };
  assert.equal(isWorldSpineLocationRowDeleteEligible(sceneOnlyLocationRow), true);
  assert.match(renderWorldSpineWhitespaceContextMenuHTML(sceneOnlyLocationRow, {
    width: 800,
    height: 600,
  }), /data-action="delete-world-spine-location-row"/);
  const worldOnlyLocationRow = {
    menuType: "location-form",
    location: "Oasis",
    locationLabel: "Oasis",
    worldNodeIds: ["world-event-oasis"],
  };
  assert.equal(isWorldSpineLocationRowDeleteEligible(worldOnlyLocationRow), true);
  assert.match(renderWorldSpineWhitespaceContextMenuHTML(worldOnlyLocationRow, {
    width: 800,
    height: 600,
  }), /data-action="delete-world-spine-location-row"/);
  assert.equal(isWorldSpineLocationRowDeleteEligible({
    ...sceneOnlyLocationRow,
    location: "Unplaced location",
    locationLabel: "Unplaced location",
  }), false);
  assert.deepEqual(createWorldSpineSceneDropPersistenceOptions({
    changedSceneIds: ["scene-earth"],
    changedPlaceLinks: true,
  }), {
    changedSceneIds: ["scene-earth"],
    domain: "world-spine",
    dirtyReason: "world-spine-scene-node-reordered-and-location-updated",
    source: "worldSpineController.onSceneNodeReorder",
    flushProjectFileAutosave: true,
  });
  const parallelTimelineFormHtml = renderWorldSpineWhitespaceContextMenuHTML({
    ...whitespaceContext,
    menuType: "timeline-form",
    location: "Oasis",
    participants: "John, Ava",
    startMarker: "Chapter 2",
    pickerOptionSets: {
      character: ["Ava Meerakavita", "John Walker"],
      location: ["Oasis", "Europa Orbit"],
    },
  }, {
    width: 800,
    height: 600,
  });
  assert.match(parallelTimelineFormHtml, /data-world-spine-context-kind="timeline-form"/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-form/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="location"[\s\S]*?required/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="participants"/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="startMarker"/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="participants"[\s\S]*?list="world-spine-parallel-character-options"/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="location"[\s\S]*?list="world-spine-parallel-location-options"/);
  assert.match(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-picker-options/);
  assert.match(parallelTimelineFormHtml, /<option value="Ava Meerakavita"><\/option>/);
  assert.match(parallelTimelineFormHtml, /<option value="Europa Orbit"><\/option>/);
  assert.doesNotMatch(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="label"/);
  assert.doesNotMatch(parallelTimelineFormHtml, /data-world-spine-parallel-timeline-field="thread"/);
  assert.match(parallelTimelineFormHtml, /data-action="save-world-spine-parallel-timeline"/);
  const parallelTimelineErrorHtml = renderWorldSpineWhitespaceContextMenuHTML({
    ...whitespaceContext,
    menuType: "timeline-form",
    location: "",
    error: "Location is required before creating a parallel timeline.",
  }, {
    width: 800,
    height: 600,
  });
  assert.match(parallelTimelineErrorHtml, /role="alert">Location is required before creating a parallel timeline\./);
  assert.match(parallelTimelineErrorHtml, /data-world-spine-parallel-timeline-field="location"[\s\S]*?value=""/);
  assert.doesNotMatch(parallelTimelineErrorHtml, /data-world-spine-parallel-timeline-field="location"[\s\S]*?value="Oasis"/);

  const implicationMenuHtml = renderWorldSpineWhitespaceContextMenuHTML({
    menuType: "implication",
    x: 120,
    y: 80,
    edgeId: "edge-1",
    label: "Ava's signal changes the briefing stakes",
  }, {
    width: 800,
    height: 600,
  });
  assert.match(implicationMenuHtml, /data-world-spine-context-kind="implication"/);
  assert.match(implicationMenuHtml, /data-action="world-spine-edit-implication"/);
  assert.match(implicationMenuHtml, /data-action="world-spine-delete-implication"/);
  assert.match(implicationMenuHtml, /data-world-spine-edge-id="edge-1"/);

  const assignmentModel = {
    groups: [
      {
        id: "vehicle",
        label: "Ships",
        items: [
          {
            id: "entity-icarus",
            categoryId: "vehicle",
            title: "The Icarus",
            meta: "Ship",
            detail: "John's drop ship.",
          },
        ],
      },
      {
        id: "weapon",
        label: "Weapons",
        items: [
          {
            id: "entity-storm-rail",
            categoryId: "weapon",
            title: "Storm Rail",
            meta: "Weapon",
            detail: "Mounted rail weapon.",
          },
        ],
      },
    ],
  };

  const initialEventContextMenuHtml = renderWorldSpineWhitespaceContextMenuHTML({
    menuType: "event",
    x: 180,
    y: 120,
    nodeId: "event:event-1",
    nodeTitle: "Ava reveals the signal",
    nodeTypeLabel: "In-scene event",
    assignmentModel,
  }, {
    width: 800,
    height: 600,
  });
  assert.match(initialEventContextMenuHtml, /data-world-spine-context-kind="event"/);
  assert.match(initialEventContextMenuHtml, /Ships/);
  assert.match(initialEventContextMenuHtml, /Weapons/);
  assert.match(initialEventContextMenuHtml, /form-dismiss-button world-spine-context-menu__dismiss/);
  assert.match(initialEventContextMenuHtml, /aria-label="Cancel assignment form"/);
  assert.match(initialEventContextMenuHtml, /data-action="world-spine-select-catalogue-assignment-category"/);
  assert.match(initialEventContextMenuHtml, /data-world-spine-assignment-category-id="weapon"[\s\S]*?aria-expanded="false"/);
  assert.doesNotMatch(initialEventContextMenuHtml, /data-world-spine-assignment-filter/);
  assert.doesNotMatch(initialEventContextMenuHtml, /world-spine-assignment-items-pane/);
  assert.doesNotMatch(initialEventContextMenuHtml, /Storm Rail/);
  assert.doesNotMatch(initialEventContextMenuHtml, /The Icarus/);
  assert.doesNotMatch(initialEventContextMenuHtml, /<span>Cancel<\/span>/);

  const eventContextMenuHtml = renderWorldSpineWhitespaceContextMenuHTML({
    menuType: "event",
    x: 180,
    y: 120,
    nodeId: "event:event-1",
    nodeTitle: "Ava reveals the signal",
    nodeTypeLabel: "In-scene event",
    assignmentCategoryId: "weapon",
    assignmentModel,
  }, {
    width: 800,
    height: 600,
  });
  assert.match(eventContextMenuHtml, /data-world-spine-context-kind="event"/);
  assert.match(eventContextMenuHtml, /Assign catalogue item/);
  assert.match(eventContextMenuHtml, /Ships/);
  assert.match(eventContextMenuHtml, /Weapons/);
  assert.match(eventContextMenuHtml, /data-action="world-spine-select-catalogue-assignment-category"/);
  assert.match(eventContextMenuHtml, /data-world-spine-assignment-category-id="weapon"/);
  assert.match(eventContextMenuHtml, /data-world-spine-assignment-category-id="weapon"[\s\S]*?aria-expanded="true"[\s\S]*?world-spine-assignment-items-pane[\s\S]*?Storm Rail/);
  assert.match(eventContextMenuHtml, /data-world-spine-assignment-filter/);
  assert.match(eventContextMenuHtml, /placeholder="Type to filter Weapons"/);
  assert.match(eventContextMenuHtml, /Storm Rail/);
  assert.doesNotMatch(eventContextMenuHtml, /The Icarus/);
  assert.match(eventContextMenuHtml, /data-action="world-spine-assign-catalogue-item"/);
  assert.match(eventContextMenuHtml, /data-world-spine-assignment-search-text="[^"]*Storm Rail[^"]*"/);
  assert.match(eventContextMenuHtml, /data-world-spine-catalogue-item-id="entity-storm-rail"/);
  assert.doesNotMatch(eventContextMenuHtml, /<span>Cancel<\/span>/);

  const detailHtml = renderWorldSpineDetailCardHTML(eventNode);
  assert.match(detailHtml, /Ava reveals the signal/);
  assert.match(detailHtml, /Ava identifies faint telemetry\./);
  assert.match(detailHtml, /world-spine-detail-card__body" tabindex="0"/);
  assert.doesNotMatch(detailHtml, /data-action="world-spine-open-passage"/);
  assert.doesNotMatch(detailHtml, /data-action="world-spine-edit-scene-metadata"/);
  assert.doesNotMatch(detailHtml, /world-spine-detail-card__meta/);
  assert.doesNotMatch(detailHtml, /world-spine-detail-card__stamp/);
  assert.doesNotMatch(detailHtml, /world-spine-detail-card__actions/);
  assert.doesNotMatch(detailHtml, /The Icarus/);
  assert.doesNotMatch(detailHtml, /Lore/);
  assert.doesNotMatch(detailHtml, /Ceres Dock still answers to the gate-era authority/);

  const sceneDetailHtml = renderWorldSpineDetailCardHTML(findWorldSpineNode(model, "scene:scene-1"));
  assert.match(sceneDetailHtml, /Ceres Arrival/);
  assert.match(sceneDetailHtml, /The crew reaches the dock\./);
  assert.doesNotMatch(sceneDetailHtml, /Scene beats/);
  assert.doesNotMatch(sceneDetailHtml, /Arrival beat/);
  assert.doesNotMatch(sceneDetailHtml, /Signal beat/);

  const composerHtml = renderWorldSpinePanelHTML(model, {
    implicationComposer: {
      edgeId: "edge-1",
      fromNodeId: "event:event-1",
      toNodeId: "scene:scene-2",
      x: 120,
      y: 80,
      effect: "Raises mission risk",
    },
  });
  assert.match(composerHtml, /data-world-spine-implication-composer/);
  assert.match(composerHtml, /data-action="world-spine-save-implication"/);
  assert.match(composerHtml, /form-dismiss-button world-spine-implication-composer__dismiss/);
  assert.match(composerHtml, /data-action="world-spine-cancel-implication"/);
  assert.match(composerHtml, /data-world-spine-edge-id="edge-1"/);
  assert.match(composerHtml, /Raises mission risk/);
  assert.doesNotMatch(composerHtml, /data-action="world-spine-cancel-implication">Cancel/);

  const bottomPlacement = calculateWorldSpineDetailCardPlacement({
    viewportRect: { left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400 },
    nodeRect: { left: 430, top: 120, right: 530, bottom: 180, width: 100, height: 60 },
    cardSize: { width: 520, height: 260 },
  });
  assert.equal(bottomPlacement.side, "bottom");
  assert.equal(bottomPlacement.width, 320);
  assert.equal(bottomPlacement.top >= 190, true);
  assert.equal(bottomPlacement.left >= 8, true);
  assert.equal(bottomPlacement.left + bottomPlacement.width <= 592, true);

  const topPlacement = calculateWorldSpineDetailCardPlacement({
    viewportRect: { left: 0, top: 0, right: 600, bottom: 240, width: 600, height: 240 },
    nodeRect: { left: 70, top: 180, right: 170, bottom: 230, width: 100, height: 50 },
    cardSize: { width: 220, height: 320 },
  });
  assert.equal(topPlacement.side, "top");
  assert.equal(topPlacement.maxHeight <= 162, true);
  assert.equal(topPlacement.top < 180, true);
  assert.equal(topPlacement.left <= 120, true);

  const implicationPlacement = calculateWorldSpineImplicationComposerPlacement({
    viewportRect: { left: 0, top: 0, right: 360, bottom: 220, width: 360, height: 220 },
    fromNodeRect: { left: 10, top: 24, right: 94, bottom: 80, width: 84, height: 56 },
    toNodeRect: { left: 300, top: 170, right: 380, bottom: 226, width: 80, height: 56 },
    composerSize: { width: 280, height: 160 },
  });
  assert.equal(implicationPlacement.left >= 12, true);
  assert.equal(implicationPlacement.top >= 12, true);
  assert.equal(implicationPlacement.left + implicationPlacement.width <= 348, true);
  assert.equal(shouldConsumeWorldSpineSuppressedClick(null), true);
  assert.equal(
    shouldConsumeWorldSpineSuppressedClick({
      closest: (selector) => selector === "[data-world-spine-implication-composer]" ? {} : null,
    }),
    false,
  );
  assert.equal(
    shouldConsumeWorldSpineSuppressedClick({
      closest: () => null,
    }),
    true,
  );

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const panelSource = readFileSync(path.join(repoRoot, "apps/editor/public/features/world-spine/world-spine-panel.js"), "utf8");
  const styleSource = readFileSync(path.join(repoRoot, "apps/editor/public/styles.css"), "utf8");
  const pointerOverHandler = panelSource.match(/function handlePointerOver[\s\S]*?function handlePointerOut/)?.[0] ?? "";
  assert.match(pointerOverHandler, /data-world-spine-detail-card/);
  assert.doesNotMatch(pointerOverHandler, /openNode\(/);
  assert.doesNotMatch(panelSource, /world-spine-link-ghost/);
  assert.match(panelSource, /beginNodeBlockDrag/);
  assert.match(panelSource, /startNodeBlockDragPreview/);
  assert.match(panelSource, /resolveWorldSpineSceneReorderDropTarget/);
  assert.match(panelSource, /onSceneNodeReorder/);
  assert.match(panelSource, /is-reorder-drop-before/);
  assert.match(panelSource, /is-reorder-drop-after/);
  assert.match(panelSource, /world-spine-node-drag-ghost/);
  assert.match(panelSource, /data-world-spine-link-handle/);
  assert.match(panelSource, /resolveImplicationDisplayNode/);
  assert.match(panelSource, /findNearestPrimaryImplicationNode/);
  assert.match(panelSource, /syncImplicationConnectionsToEventBlocks/);
  assert.match(panelSource, /resolveRenderedNodeHandlePoint/);
  assert.match(panelSource, /offsetTop/);
  assert.match(panelSource, /createNodeGraphCurvePath/);
  assert.match(panelSource, /resolveImplicationSplineRoute/);
  assert.match(panelSource, /findIntermediatePrimaryRouteObstacles/);
  assert.match(panelSource, /createRoutedNodeGraphSplinePath/);
  assert.match(panelSource, /IMPLICATION_ROUTE_MIN_TURN_DISTANCE/);
  assert.match(panelSource, /routeHandleDistance/);
  assert.match(panelSource, /verticalOffset/);
  assert.match(panelSource, /data-world-spine-node-layer/);
  assert.match(panelSource, /data-world-spine-implication-connections/);
  assert.match(panelSource, /world-spine-connection-hit-area/);
  assert.match(panelSource, /data-world-spine-connection-hit-path/);
  assert.match(panelSource, /data-world-spine-context-kind="implication"/);
  assert.match(panelSource, /onImplicationContextMenu/);
  assert.match(panelSource, /world-spine-edit-implication/);
  assert.match(panelSource, /world-spine-delete-implication/);
  assert.doesNotMatch(panelSource, /renderWorldSpineImplicationActionChips/);
  assert.doesNotMatch(panelSource, /data-world-spine-implication-chip/);
  assert.match(panelSource, /renderWorldSpineWhitespaceContextMenuHTML/);
  assert.match(panelSource, /resolveWorldSpineWhitespaceContextFromPoint/);
  assert.match(panelSource, /handleContextMenu/);
  assert.match(panelSource, /canvasX: \(event\.clientX - canvasRect\.left\) \/ zoom/);
  assert.match(panelSource, /canvasY: \(event\.clientY - canvasRect\.top\) \/ zoom/);
  assert.match(panelSource, /data-world-spine-tier-guide/);
  assert.match(panelSource, /data-world-spine-location-row-guide/);
  assert.match(panelSource, /data-world-spine-location-row-artwork/);
  assert.match(panelSource, /buildWorldSpineLocationImageIndex/);
  assert.match(panelSource, /createWorldbuildingCatalogueImageSource/);
  assert.match(panelSource, /world-spine-edit-location-row/);
  assert.match(panelSource, /attach-world-spine-location-row-image/);
  assert.match(panelSource, /data-world-spine-row-scene-ids/);
  assert.match(panelSource, /\[data-world-spine-location-row-label\]/);
  assert.match(panelSource, /data-world-spine-drop-spine-id/);
  assert.match(panelSource, /data-world-spine-drop-location-label/);
  assert.match(panelSource, /createWorldSpineTimelineLocationRows/);
  assert.match(panelSource, /resolveTimelineLocationRowForCanvasY/);
  assert.match(panelSource, /locationRows/);
  assert.match(panelSource, /data-world-spine-timeline-zoom-frame/);
  assert.match(panelSource, /event\.ctrlKey/);
  assert.match(panelSource, /event\.ctrlKey \|\| event\.shiftKey/);
  assert.match(panelSource, /event\?\.shiftKey \? "vertical" : "horizontal"/);
  assert.match(panelSource, /resolveWorldSpineTimelineWheelScrollPlan/);
  assert.match(panelSource, /scroll\.scrollTop \+= scrollPlan\.delta/);
  assert.match(panelSource, /scroll\.scrollLeft \+= scrollPlan\.delta/);
  assert.match(panelSource, /target\?\.closest\("\[data-world-spine-root\]"\)/);
  assert.match(panelSource, /applyTimelineZoomFromWheel/);
  assert.match(panelSource, /onTimelineZoom/);
  assert.match(panelSource, /setTimelineZoom: applyTimelineZoomValue/);
  assert.match(panelSource, /resolveWorldSpineViewportChapterAnchor/);
  assert.match(panelSource, /syncChapterAnchorToTimelineViewport/);
  assert.match(panelSource, /scroll\.scrollLeft \/ getTimelineZoom\(\)/);
  assert.match(styleSource, /world-spine-chapter-anchor/);
  assert.match(styleSource, /world-spine-event-list__chapter/);
  assert.match(styleSource, /world-spine-canvas-frame/);
  assert.match(styleSource, /transform: scale\(var\(--world-spine-timeline-zoom/);
  assert.match(styleSource, /world-spine-node-drag-ghost/);
  assert.match(styleSource, /is-dragging-world-spine-node/);
  assert.match(styleSource, /is-reorder-drop-before/);
  assert.match(styleSource, /is-reorder-drop-after/);
  assert.match(styleSource, /world-spine-node-layer/);
  assert.match(styleSource, /world-spine-node-layer__implications/);
  assert.match(styleSource, /world-spine-history-button/);
  assert.match(styleSource, /world-spine-connection-hit-area/);
  assert.match(styleSource, /drop-shadow/);
  assert.doesNotMatch(styleSource, /world-spine-implication-chip/);
  assert.match(styleSource, /world-spine-tier-guide/);
  assert.match(styleSource, /world-spine-location-row-guide/);
  assert.match(styleSource, /world-spine-location-row-artwork/);
  assert.match(styleSource, /--world-spine-location-row-sticky-x/);
  assert.match(styleSource, /transform: translateX\(var\(--world-spine-location-row-sticky-x/);
  assert.match(styleSource, /is-world-spine-location-fit/);
  assert.match(styleSource, /world-spine-unplaced-dock/);
  assert.match(styleSource, /--world-spine-unplaced-dock-safe-area/);
  assert.match(styleSource, /--world-spine-timeline-scroll-left/);
  assert.match(styleSource, /\.app-shell\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/);
  assert.match(styleSource, /\.spine-panel\s*\{[^}]*height:\s*100%;/);
  assert.doesNotMatch(styleSource, /\.spine-panel\s*\{[^}]*height:\s*calc\(100vh\s*-\s*168px\)/);
  assert.match(styleSource, /world-spine-context-menu/);
  assert.match(styleSource, /stroke-linecap: round/);
  assert.match(styleSource, /stroke-linejoin: round/);
  assert.doesNotMatch(styleSource, /world-spine-connection--main/);
  const appSource = readFileSync(path.join(repoRoot, "apps/editor/public/app.js"), "utf8");
  assert.match(panelSource, /syncLocationRowHeaderOffset/);
  assert.match(panelSource, /createWorldSpineLocationFilterViewportModel/);
  assert.match(appSource, /onSceneNodeReorder/);
  assert.match(appSource, /onWhitespaceContextMenu/);
  assert.match(appSource, /world-spine-insert-event-here/);
  assert.match(appSource, /world-spine-add-parallel-timeline/);
  assert.match(appSource, /world-spine-edit-location-row/);
  assert.match(appSource, /attachWorldSpineLocationRowImage/);
  assert.match(appSource, /createWorldbuildingCatalogueImageRecordFromFile/);
  assert.match(appSource, /\/api\/project-media\/save/);
  assert.match(appSource, /applyWorldSpineLocationImageToWorld/);
  assert.match(appSource, /save-world-spine-location-row/);
  assert.match(appSource, /delete-world-spine-location-row/);
  assert.match(appSource, /deleteWorldSpineLocationRowFromForm/);
  assert.match(appSource, /toggle-world-spine-unplaced-dock/);
  assert.match(appSource, /worldSpineUnplacedDockCollapsed/);
  assert.match(appSource, /save-world-spine-parallel-timeline/);
  assert.match(appSource, /openParallelTimelineFormFromWorldSpineContextMenu/);
  assert.match(appSource, /openWorldSpineLocationRowFormFromLabel/);
  assert.match(appSource, /saveWorldSpineLocationRowFromForm/);
  assert.match(appSource, /saveParallelTimelineFromWorldSpineForm/);
  assert.match(appSource, /buildSceneDraftsWithLoadedSceneStoreBodies/);
  assert.match(appSource, /mergeSceneDraftWithLoadedSceneStoreBody/);
  assert.match(appSource, /state\.scenes = buildSceneRecords\(\s*state\.workspace,\s*buildSceneDraftsWithLoadedSceneStoreBodies\(\),\s*state\.structureDrafts/s);
  assert.match(appSource, /const existingDraft = mergeSceneDraftWithLoadedSceneStoreBody\(\s*sceneId,\s*state\.sceneDrafts\?\.\[sceneId\] \?\? createSceneDraft\(scene\),\s*\)/s);
  assert.match(appSource, /clickTarget\?\.closest\("\[data-world-spine-context-menu\]"\)/);
  assert.match(appSource, /addParallelWorldSpine/);
  assert.match(appSource, /locationLabel: target\?\.dataset\?\.worldSpineLocationLabel/);
  assert.match(appSource, /locationLabel: zone\.dataset\.worldSpineDropLocationLabel/);
  assert.match(appSource, /applyWorldSpineInsertionLocationToEventDraftItem/);
  assert.match(appSource, /moveBinderScene\(sourceSceneId/);
  assert.match(appSource, /createWorldSpineSceneDropPersistenceOptions/);
  assert.match(appSource, /changedSceneIds: options\.changedSceneIds/);
  assert.match(appSource, /source: "saveWorldSpineLocationRowFromForm"[\s\S]*flushProjectFileAutosave: true/);
  assert.match(appSource, /source: "handleWorldSpineTimelineDrop"[\s\S]*flushProjectFileAutosave: true/);
  assert.match(appSource, /deleteWorldSpineImplication/);
  assert.match(appSource, /openWorldSpineImplicationEditorFromContextMenu/);
  assert.match(appSource, /updateWorldSpineImplicationEdgeInWorld/);
  assert.match(appSource, /world-spine-edit-implication/);
  assert.match(appSource, /undoWorldSpineInteraction/);
  assert.match(appSource, /redoWorldSpineInteraction/);
  assert.match(appSource, /pushWorldSpineHistoryChange/);
  assert.match(appSource, /timelineZoom: worldSpineController\.getTimelineZoom\(\)/);
}

// Intent: inspect routed SVG cubic handles without coupling tests to the full renderer output.
function extractSvgCubicSegments(pathValue) {
  return [...String(pathValue ?? "").matchAll(/C\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?),\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .map((match) => match.slice(1).map(Number));
}

function extractSvgPathYValues(pathValue) {
  const values = String(pathValue ?? "")
    .match(/-?\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter(Number.isFinite) ?? [];
  return values.filter((_, index) => index % 2 === 1);
}

// Intent: keep smoothed implication bends from folding backward on tight skipped-node routes.
function assertMonotonicSplineXValues(values) {
  const safeValues = values.filter(Number.isFinite);
  const direction = safeValues.at(-1) >= safeValues[0] ? 1 : -1;
  for (let index = 1; index < safeValues.length; index += 1) {
    assert.equal((safeValues[index] - safeValues[index - 1]) * direction >= 0, true);
  }
}

function assertImplicationUsesEventBlockHandles(connection, model, { fromSide, toSide, routeDirection = "" }) {
  const nodesById = new Map(model.timeline.nodes.map((node) => [node.id, node]));
  const fromNode = nodesById.get(connection.renderFromNodeId);
  const toNode = nodesById.get(connection.renderToNodeId);
  assert.ok(fromNode);
  assert.ok(toNode);
  assert.equal(connection.fromHandleSide, fromSide);
  assert.equal(connection.toHandleSide, toSide);
  const fromEventBlockRowY = fromNode.y + (fromNode.height / 2);
  const toEventBlockRowY = toNode.y + (toNode.height / 2);
  assert.equal(connection.fromPoint.x, fromSide === "right" ? fromNode.x + fromNode.width : fromNode.x);
  assert.equal(connection.fromPoint.y, fromEventBlockRowY);
  assert.equal(connection.toPoint.x, toSide === "right" ? toNode.x + toNode.width : toNode.x);
  assert.equal(connection.toPoint.y, toEventBlockRowY);
  const yValues = extractSvgPathYValues(connection.path);
  const cubicSegments = extractSvgCubicSegments(connection.path);
  assert.equal(cubicSegments.length >= 3, true);
  assert.notEqual(cubicSegments[0][2], cubicSegments[0][4]);
  assert.notEqual(cubicSegments.at(-1)[0], cubicSegments.at(-2)[4]);
  assertMonotonicSplineXValues([
    connection.fromPoint.x,
    cubicSegments[0][0],
    cubicSegments[0][2],
    cubicSegments[0][4],
  ]);
  assertMonotonicSplineXValues([
    cubicSegments.at(-2)[4],
    cubicSegments.at(-1)[0],
    cubicSegments.at(-1)[2],
    connection.toPoint.x,
  ]);
  assert.equal(connection.obstacleCount, 1);
  assert.equal(connection.routeDirection, routeDirection);
  assert.equal(Number.isFinite(connection.routeY), true);
  if (routeDirection === "above") {
    assert.equal(connection.routeY < Math.min(fromNode.y, toNode.y), true);
    assert.equal(Math.min(...yValues) <= connection.routeY, true);
    assert.equal(connection.labelY < Math.min(fromNode.y, toNode.y), true);
  } else {
    assert.equal(connection.routeY > Math.min(fromNode.y + fromNode.height, toNode.y + toNode.height), true);
    assert.equal(connection.routeY < model.timeline.axisY, true);
    assert.equal(Math.max(...yValues) >= connection.routeY, true);
    assert.equal(connection.labelY > connection.routeY, true);
  }
  assert.equal(connection.fromPoint.y < model.timeline.axisY, true);
  assert.equal(connection.toPoint.y < model.timeline.axisY, true);
}

function extractSvgByClass(html, className) {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(html ?? "").match(new RegExp(`<svg[^>]*class="${escapedClassName}"[\\s\\S]*?<\\/svg>`))?.[0] ?? "";
}

function extractElementByDataAttribute(html, attributeName) {
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(html ?? "").match(new RegExp(`<div[^>]*${escapedAttributeName}[\\s\\S]*?<\\/div>\\s*<div class="world-spine-axis"`))?.[0] ?? "";
}
