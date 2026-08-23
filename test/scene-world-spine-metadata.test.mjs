// Intent: verify scene World Spine metadata form models stay independent from the app shell.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applySceneWorldSpineMetadataToDraft,
  buildSceneWorldSpineMetadataFromFormValues,
  buildSceneWorldSpineMetadataMenuModel,
  normalizeSceneWorldSpineMetadata,
  renderSceneWorldSpineMetadataMenuHTML,
} from "../apps/editor/public/features/world-spine/scene-world-spine-metadata.js";

export function runSceneWorldSpineMetadataTest() {
  const normalized = normalizeSceneWorldSpineMetadata({
    location: " Ceres Dock ",
    sublocation: " The Icarus ",
    orbitalBand: " Low orbit ",
    peoplePresent: "John, Ava\nJohn",
    sceneBeats: "Arrival; Discovery; Reversal",
    criticalEvents: "Signal found; Ava reveals signal",
    locationChanges: ["Observation Deck", "Observation Deck", "Airlock"],
    customMetadata: {
      "metadata-lore": " Gate history ",
    },
  });
  assert.deepEqual(normalized, {
    location: "Ceres Dock",
    sublocation: "The Icarus",
    orbitalBand: "Low orbit",
    locationRowLabel: "",
    locationRowKey: "",
    locationScope: "",
    date: "",
    time: "",
    peoplePresent: ["John", "Ava"],
    sceneBeats: ["Arrival", "Discovery", "Reversal"],
    criticalEvents: ["Signal found", "Ava reveals signal"],
    locationChanges: ["Observation Deck", "Airlock"],
    customMetadata: {
      "metadata-lore": "Gate history",
    },
  });

  const model = buildSceneWorldSpineMetadataMenuModel({
    scene: {
      sceneId: "scene-1",
      sceneTitle: "Ceres Arrival",
      worldSpineMetadata: {
        location: "Ceres Dock",
        sublocation: "The Icarus",
        orbitalBand: "Docked",
        sceneBeats: ["Arrival beat"],
        customMetadata: {
          "metadata-lore": "Dock belongs to the old gate network.",
          "metadata-religion": "The Quiet Order",
        },
      },
    },
    draft: {
      worldSpineMetadata: {
        time: "09:12",
      },
    },
    characterOptions: [
      { id: "character-john", name: "John Walker", aliasList: ["Captain John"] },
      "Ava Meerakavita",
    ],
    customMetadataDefinitions: [
      { id: "metadata-lore", label: "Lore" },
      { id: "metadata-religion", label: "Religion" },
    ],
    pickerOptionSets: {
      all: ["The Quiet Order"],
      location: ["Ceres Dock", "Observation Deck"],
      religion: ["The Quiet Order"],
      vehicle: ["The Icarus"],
      __catalogueCategories: [
        { id: "religion", label: "Religion", templateName: "Religion" },
      ],
    },
  });
  assert.equal(model.sceneId, "scene-1");
  assert.equal(model.metadata.location, "Ceres Dock");
  assert.equal(model.metadata.sublocation, "The Icarus");
  assert.equal(model.metadata.orbitalBand, "Docked");
  assert.equal(model.metadata.time, "09:12");
  assert.deepEqual(model.metadata.sceneBeats, ["Arrival beat"]);
  assert.equal(model.metadata.customMetadata["metadata-lore"], "Dock belongs to the old gate network.");
  assert.equal(model.metadata.customMetadata["metadata-religion"], "The Quiet Order");
  assert.equal(model.hasMetadata, true);

  const collapsedHtml = renderSceneWorldSpineMetadataMenuHTML(model);
  assert.match(collapsedHtml, /data-action="open-scene-world-spine-metadata"/);
  assert.match(collapsedHtml, />World Spine</);
  assert.match(collapsedHtml, />Set</);

  const expandedHtml = renderSceneWorldSpineMetadataMenuHTML({
    ...model,
    expanded: true,
  });
  assert.match(expandedHtml, /data-scene-world-spine-metadata-form/);
  assert.match(expandedHtml, /data-scene-world-spine-field="location"/);
  assert.match(expandedHtml, /data-scene-world-spine-field="sublocation"[\s\S]*list="scene-world-spine-sublocation-options-scene-1"/);
  assert.match(expandedHtml, />Child location</);
  assert.match(expandedHtml, /data-scene-world-spine-field="orbitalBand"/);
  assert.match(expandedHtml, /<option value="The Icarus"><\/option>/);
  assert.match(expandedHtml, /<option value="Observation Deck"><\/option>/);
  assert.match(expandedHtml, /data-scene-world-spine-field="peoplePresent"[\s\S]*list="scene-world-spine-character-options-scene-1"/);
  assert.match(expandedHtml, /data-scene-world-spine-character-options/);
  assert.match(expandedHtml, /<option value="Ava Meerakavita"><\/option>/);
  assert.match(expandedHtml, /<option value="Captain John"><\/option>/);
  assert.match(expandedHtml, /<option value="John Walker"><\/option>/);
  assert.match(expandedHtml, /data-scene-world-spine-field="sceneBeats"/);
  assert.match(expandedHtml, /data-scene-world-spine-field="criticalEvents"/);
  assert.match(expandedHtml, /data-scene-world-spine-field="customMetadata\.metadata-lore"/);
  assert.match(expandedHtml, /data-scene-world-spine-field="customMetadata\.metadata-religion"[\s\S]*list="scene-world-spine-catalogue-options-scene-1-religion"/);
  assert.match(expandedHtml, /data-scene-world-spine-catalogue-options/);
  assert.match(expandedHtml, /<option value="The Quiet Order"><\/option>/);
  assert.match(expandedHtml, />Lore</);
  assert.match(expandedHtml, />Religion</);
  assert.match(expandedHtml, /form-dismiss-button binder-world-spine-form__dismiss/);
  assert.match(expandedHtml, /data-action="close-scene-world-spine-metadata"/);
  assert.match(expandedHtml, /data-action="save-scene-world-spine-metadata"/);
  assert.doesNotMatch(expandedHtml, />Back<\/button>/);

  const emptyFormHtml = renderSceneWorldSpineMetadataMenuHTML({
    sceneId: "scene-empty",
    sceneTitle: "Empty scene",
    metadata: {},
    expanded: true,
  });
  assert.match(emptyFormHtml, /placeholder="Where does the event take place\?"/);
  assert.match(emptyFormHtml, /placeholder="Child place, ship, room, facility, orbit, or local stage"/);
  assert.match(emptyFormHtml, /placeholder="Low orbit, high orbit, surface, docked, in transit"/);
  assert.match(emptyFormHtml, /placeholder="YYYY-MM-DD"/);
  assert.match(emptyFormHtml, /placeholder="HH:MM"/);
  assert.match(emptyFormHtml, /placeholder="Who is present\?"/);
  assert.match(emptyFormHtml, /placeholder="List the major beats in this scene\."/);
  assert.match(emptyFormHtml, /placeholder="What critical events happen here\?"/);
  assert.match(emptyFormHtml, /placeholder="Where does the action move\?"/);
  assert.doesNotMatch(emptyFormHtml, /Ceres Dock|John, Ava|Arrival; Discovery; Reversal|Ava reveals|Observation deck|Airlock/);

  const formMetadata = buildSceneWorldSpineMetadataFromFormValues({
    location: "Briefing Room",
    childLocation: "Lift",
    orbitalBand: "Surface",
    date: "2026-05-14",
    time: "10:05",
    peoplePresent: "John, Ava",
    sceneBeats: "Threshold crossed; Evidence reframed",
    criticalEvents: "Mission changes",
    locationChanges: "Lift; Briefing Table",
    "customMetadata.metadata-lore": "Briefing-room faction lore.",
  });
  const patchedDraft = applySceneWorldSpineMetadataToDraft({
    sceneId: "scene-1",
    sceneTitle: "Ceres Arrival",
    editorText: "Scene body.",
  }, {
    editorText: "Draft body.",
  }, formMetadata);
  assert.equal(patchedDraft.sceneId, "scene-1");
  assert.equal(patchedDraft.editorText, "Draft body.");
  assert.equal(patchedDraft.location, "Briefing Room");
  assert.equal(patchedDraft.childLocation, "Lift");
  assert.equal(patchedDraft.sublocation, "Lift");
  assert.equal(patchedDraft.orbitalBand, "Surface");
  assert.equal(patchedDraft.worldSpineMetadata.location, "Briefing Room");
  assert.equal(patchedDraft.worldSpineMetadata.childLocation, "Lift");
  assert.equal(patchedDraft.worldSpineMetadata.sublocation, "Lift");
  assert.equal(patchedDraft.worldSpineMetadata.orbitalBand, "Surface");
  assert.deepEqual(patchedDraft.worldSpineMetadata.sceneBeats, ["Threshold crossed", "Evidence reframed"]);
  assert.equal(patchedDraft.worldSpineMetadata.customMetadata["metadata-lore"], "Briefing-room faction lore.");
  assert.deepEqual(patchedDraft.worldSpineMetadata.locationChanges, ["Lift", "Briefing Table"]);

  const rowAssignedDraft = applySceneWorldSpineMetadataToDraft({
    sceneId: "scene-earth",
    sceneTitle: "Earth Arrival",
  }, {}, {
    location: "Earth",
    sublocation: "New York",
    locationRowLabel: "Earth",
    locationRowKey: "earth",
    locationScope: "planetary",
  });
  assert.equal(rowAssignedDraft.location, "Earth");
  assert.equal(rowAssignedDraft.sublocation, "New York");
  assert.equal(rowAssignedDraft.locationRowLabel, "Earth");
  assert.equal(rowAssignedDraft.locationRowKey, "earth");
  assert.equal(rowAssignedDraft.locationScope, "planetary");
  assert.equal(rowAssignedDraft.worldSpineMetadata.locationRowLabel, "Earth");
  assert.equal(rowAssignedDraft.worldSpineMetadata.locationRowKey, "earth");
  assert.equal(rowAssignedDraft.worldSpineMetadata.locationScope, "planetary");

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const appSource = readFileSync(path.join(repoRoot, "apps/editor/public/app.js"), "utf8");
  const noActionClickBranch = appSource.match(/if \(!target\) \{[\s\S]*?const \{ action \} = target\.dataset;/)?.[0] ?? "";
  const genericDismissGuard = appSource.match(/if \(\s*!isTaskContextMenuOwnedTarget\(target\)[\s\S]*?hideTaskContextMenu\(\);[\s\S]*?\}/)?.[0] ?? "";
  assert.match(appSource, /state\.binderContextMenu && !isTaskContextMenuOwnedTarget\(clickTarget\)/);
  assert.match(noActionClickBranch, /isTaskContextMenuOwnedTarget\(clickTarget\)/);
  assert.match(genericDismissGuard, /!isTaskContextMenuOwnedTarget\(target\)/);
  assert.match(appSource, /target\.closest\("[^"]*\[data-scene-world-spine-metadata-form\][^"]*"\)/);
  assert.match(appSource, /target\.closest\("[^"]*\[data-world-spine-sublocation-form\][^"]*"\)/);
}
