// Intent: verify manuscript ManuScriptInfographicLane markers derive from durable world and custom metadata anchors.
import assert from "node:assert/strict";

import {
  createManuScriptInfographicLanePreviewsForScene,
} from "../apps/editor/public/features/manuscript-editor/ManuScriptInfographicLane-selector.js";

export function runManuScriptInfographicLaneSelectorTest() {
  const metadataIcon = {
    dataUrl: "data:image/png;base64,AAAA",
    mediaType: "image/png",
    name: "lore.png",
    size: 3,
  };
  const scene = {
    sceneId: "scene-1",
    sceneTitle: "Ceres Arrival",
    editorText: "Alpha beta.\n\nGamma delta.",
    blocks: [{
      blockId: "block-1",
      text: "Alpha beta.",
    }, {
      blockId: "block-2",
      text: "Gamma delta.",
    }],
    worldSpineMetadata: {
      criticalEvents: ["Docking clamps catch"],
      locationChanges: ["Observation Deck"],
    },
  };
  const previews = createManuScriptInfographicLanePreviewsForScene({
    scene,
    state: {
      customMetadataDefinitions: [{
        id: "metadata-lore",
        label: "Lore",
        icon: metadataIcon,
      }],
      manuscriptTasks: [{
        id: "task-1",
        sceneId: "scene-1",
        title: "Fix continuity",
        startOffset: 0,
        endOffset: 5,
        status: "open",
      }, {
        id: "task-done",
        sceneId: "scene-1",
        title: "Already fixed",
        startOffset: 0,
        endOffset: 5,
        status: "completed",
      }],
      passageNotes: [{
        id: "note-research-1",
        noteType: "research",
        sceneId: "scene-1",
        title: "Greek goddess source",
        startOffset: 0,
        endOffset: 5,
      }, {
        id: "note-lore-1",
        noteType: "metadata-lore",
        sceneId: "scene-1",
        title: "Gate lore",
        startOffset: 6,
        endOffset: 10,
      }],
      workspace: {
        project: {
          eventTags: [{
            id: "event-1",
            kind: "reveal",
            label: "Ava reveals signal",
            anchor: {
              sceneId: "scene-1",
              blockId: "block-2",
              startOffset: 0,
              endOffset: 5,
            },
          }],
        },
        world: {
          spines: [{
            id: "spine-1",
            label: "Main",
            nodes: [{
              id: "node-1",
              label: "Dock answers the crew",
              primaryBlockId: "block-1",
            }, {
              id: "node-2",
              label: "Signal under the ice",
              eventStartAnchor: {
                sceneId: "scene-1",
                blockId: "block-1",
                startOffset: 0,
                endOffset: 1,
              },
              eventEndAnchor: {
                sceneId: "scene-1",
                blockId: "block-2",
                startOffset: 0,
                endOffset: 1,
              },
            }],
          }],
        },
      },
    },
  });

  assert.equal(previews.length, 9);
  assert.equal(previews.filter((preview) => preview.markerType === "task").length, 1);
  assert.equal(previews.filter((preview) => preview.markerType === "research").length, 1);
  assert.equal(previews.filter((preview) => preview.markerType === "metadata").length, 1);
  assert.equal(previews.filter((preview) => preview.markerType === "world").length, 4);
  assert.equal(previews.filter((preview) => preview.markerType === "world-start").length, 1);
  assert.equal(previews.filter((preview) => preview.markerType === "world-end").length, 1);
  assert.equal(previews.find((preview) => preview.recordType === "task")?.label, "Task: Fix continuity");
  assert.equal(previews.find((preview) => preview.markerType === "research")?.label, "Research: Greek goddess source");
  assert.equal(previews.find((preview) => preview.markerType === "metadata")?.label, "Lore: Gate lore");
  assert.equal(previews.find((preview) => preview.markerType === "metadata")?.metadataIcon.dataUrl, metadataIcon.dataUrl);
  assert.equal(previews.find((preview) => preview.recordType === "eventTag")?.nodeId, "event:event-1");
  assert.equal(previews.find((preview) => preview.recordType === "eventTag")?.startOffset, 13);
  assert.equal(
    previews.some((preview) => preview.nodeId === "metadata:metadata-event:scene-1:docking-clamps-catch"),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.nodeId === "metadata:metadata-location:scene-1:observation-deck"),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.nodeId === "node-2" && preview.markerType === "world-start" && preview.startOffset === 0),
    true,
  );
  assert.equal(
    previews.some((preview) => preview.nodeId === "node-2" && preview.markerType === "world-end" && preview.startOffset === 13),
    true,
  );
}
