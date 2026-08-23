// Intent: verify inserted World Spine events create placed manuscript scene drafts.
import assert from "node:assert/strict";

import { buildSceneRecords } from "../apps/editor/public/editor-model.js";
import {
  createWorldSpineEventScenePlacement,
  resolveWorldSpineEventSceneInsertionIndex,
} from "../apps/editor/public/features/world-spine/world-spine-event-scene-service.js";

export function runWorldSpineEventSceneServiceTest() {
  const scenes = [
    {
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
      sceneTitle: "Opening",
      blocks: [{ blockId: "block-1", text: "Opening text." }],
    },
    {
      sceneId: "scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1",
      sceneTitle: "Fallout",
      blocks: [{ blockId: "block-2", text: "Fallout text." }],
    },
  ];
  const world = {
    spines: [
      {
        id: "spine-0001",
        label: "World Spine",
        nodes: [
          {
            id: "node-0001",
            label: "Beacon wakes",
            summary: "A signal changes the mission.",
            sequenceRank: 0.5,
            timelineSlotIndex: 1,
            location: "Ceres Dock",
            sublocation: "Relay Chamber",
            orbitalBand: "Low orbit",
            locationRowLabel: "Ceres",
            locationRowKey: "ceres",
            locationScope: "planetary",
            date: "2026-05-14",
            time: "09:45",
            people: ["Ava", "John"],
            criticalEvents: ["Signal discovered"],
            metadata: {
              affectedFactions: ["Oasian Council"],
            },
          },
        ],
      },
    ],
  };

  const placement = createWorldSpineEventScenePlacement({
    world,
    eventNode: world.spines[0].nodes[0],
    scenes,
    structureDrafts: { scenes: [], sceneOrder: ["scene-1", "scene-2"] },
    insertionContext: { dropIndex: 1 },
    now: new Date("2026-05-14T09:50:00.000Z"),
  });

  assert.equal(placement.changed, true);
  assert.equal(placement.reason, "scene-created");
  assert.equal(placement.insertionIndex, 1);
  assert.equal(placement.sceneDraft.sceneId, "draft-scene-world-event-1778752200000");
  assert.equal(placement.sceneDraft.sceneTitle, "Beacon wakes");
  assert.equal(placement.sceneDraft.sceneSynopsis, "A signal changes the mission.");
  assert.equal(placement.sceneDraft.chapterId, "chapter-1");
  assert.equal(placement.sceneDraft.initialText, "");
  assert.equal(placement.sceneDraft.location, "Ceres Dock");
  assert.equal(placement.sceneDraft.sublocation, "Relay Chamber");
  assert.equal(placement.sceneDraft.orbitalBand, "Low orbit");
  assert.equal(placement.sceneDraft.locationRowLabel, "Ceres");
  assert.equal(placement.sceneDraft.locationRowKey, "ceres");
  assert.deepEqual(placement.sceneDraft.worldSpineMetadata.peoplePresent, ["Ava", "John"]);
  assert.equal(placement.sceneDraft.worldSpineMetadata.sublocation, "Relay Chamber");
  assert.equal(placement.sceneDraft.worldSpineMetadata.orbitalBand, "Low orbit");
  assert.deepEqual(placement.sceneDraft.worldSpineMetadata.criticalEvents, ["Beacon wakes", "Signal discovered"]);
  assert.deepEqual(
    placement.structureDrafts.sceneOrder,
    ["scene-1", placement.sceneDraft.sceneId, "scene-2"],
  );

  const linkedNode = placement.world.spines[0].nodes[0];
  assert.equal(linkedNode.primaryBlockId, placement.sceneDraft.blockId);
  assert.equal(linkedNode.sceneId, placement.sceneDraft.sceneId);
  assert.deepEqual(linkedNode.manuscriptAnchors[0], {
    sceneId: placement.sceneDraft.sceneId,
    blockId: placement.sceneDraft.blockId,
    startOffset: 0,
    endOffset: 0,
  });
  assert.equal(linkedNode.metadata.manuscriptSceneId, placement.sceneDraft.sceneId);

  const workspace = {
    project: {
      lines: [
        {
          sceneId: "scene-1",
          chapterId: "chapter-1",
          chapterTitle: "Chapter 1",
          sceneTitle: "Opening",
          sceneSynopsis: "",
          blockId: "block-1",
          lineNumber: 1,
          kind: "narration",
          speakerLabel: "",
          text: "Opening text.",
          issueIds: [],
          eventTagIds: [],
        },
        {
          sceneId: "scene-2",
          chapterId: "chapter-1",
          chapterTitle: "Chapter 1",
          sceneTitle: "Fallout",
          sceneSynopsis: "",
          blockId: "block-2",
          lineNumber: 2,
          kind: "narration",
          speakerLabel: "",
          text: "Fallout text.",
          issueIds: [],
          eventTagIds: [],
        },
      ],
    },
  };
  assert.deepEqual(
    buildSceneRecords(workspace, {}, placement.structureDrafts).map((scene) => scene.sceneId),
    ["scene-1", placement.sceneDraft.sceneId, "scene-2"],
  );

  assert.equal(resolveWorldSpineEventSceneInsertionIndex({
    eventNode: { sequenceRank: -0.5 },
    scenes,
  }), 0);
  assert.equal(resolveWorldSpineEventSceneInsertionIndex({
    eventNode: { timelineSlotIndex: 99 },
    scenes,
  }), 2);

  const alreadyAnchored = createWorldSpineEventScenePlacement({
    world,
    eventNode: {
      ...world.spines[0].nodes[0],
      primaryBlockId: "block-1",
    },
    scenes,
  });
  assert.equal(alreadyAnchored.changed, false);
  assert.equal(alreadyAnchored.reason, "already-anchored");
}
