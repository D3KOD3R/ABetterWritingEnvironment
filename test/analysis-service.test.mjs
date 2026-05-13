// Intent: verify local analysis returns anchored issue, event, world, and dream-scaping suggestions.
import assert from "node:assert/strict";

import {
  addBlock,
  addCharacter,
  addChapter,
  addScene,
  assignSpeaker,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import {
  addTimelineNode,
  addTimelineSpine,
  addWorldTemplate,
  createWorldModel,
  instantiateWorldEntity,
} from "../packages/world-schema/src/index.ts";
import { createLocalAnalysisService } from "../services/analysis/src/index.ts";

export function runAnalysisServiceTest() {
  let project = createProject({
    title: "Analysis Fixture",
    now: "2026-04-21T07:00:00.000Z",
  });

  const auren = addCharacter(project, { name: "Auren Vale" }, "2026-04-21T07:00:10.000Z");
  project = auren.project;
  const voss = addCharacter(project, { name: "Inspector Voss" }, "2026-04-21T07:00:20.000Z");
  project = voss.project;

  const chapter = addChapter(project, { title: "Arrival" }, "2026-04-21T07:01:00.000Z");
  project = chapter.project;
  const scene = addScene(project, chapter.chapter.id, { title: "Ring" }, "2026-04-21T07:02:00.000Z");
  project = scene.project;

  const first = addBlock(
    project,
    scene.scene.id,
    {
      kind: "narration",
      text: "Below them, Halcyon Station hung above Khepri under the station glow.",
    },
    "2026-04-21T07:03:00.000Z",
  );
  project = first.project;

  const second = addBlock(
    project,
    scene.scene.id,
    {
      kind: "dialogue",
      text: "Keep the lights low until we clear the customs ring.",
    },
    "2026-04-21T07:04:00.000Z",
  );
  project = second.project;
  project = assignSpeaker(
    project,
    second.block.id,
    {
      role: "character",
      characterId: auren.character.id,
      speakerLabel: "Captain Auren Vale",
    },
    "2026-04-21T07:04:10.000Z",
  ).project;

  const third = addBlock(
    project,
    scene.scene.id,
    {
      kind: "dialogue",
      text: "You are early, Captain. The treaty envoys have not docked.",
    },
    "2026-04-21T07:05:00.000Z",
  );
  project = third.project;
  project = assignSpeaker(
    project,
    third.block.id,
    {
      role: "character",
      characterId: voss.character.id,
      speakerLabel: "Inspector Voss",
    },
    "2026-04-21T07:05:10.000Z",
  ).project;

  const fourth = addBlock(
    project,
    scene.scene.id,
    {
      kind: "narration",
      text: "Auren heard the word treaty and felt the bridge go still.",
    },
    "2026-04-21T07:06:00.000Z",
  );
  project = fourth.project;

  const fifth = addBlock(
    project,
    scene.scene.id,
    {
      kind: "narration",
      text: "The archive note named the Leviathan Corridor for the first time.",
    },
    "2026-04-21T07:07:00.000Z",
  );
  project = fifth.project;

  const sixth = addBlock(
    project,
    scene.scene.id,
    {
      kind: "dialogue",
      text: "If the corridor is real, the war started here.",
    },
    "2026-04-21T07:08:00.000Z",
  );
  project = sixth.project;

  let world = createWorldModel({
    title: "Analysis World Fixture",
    now: "2026-04-21T07:08:10.000Z",
  });
  const factionTemplate = addWorldTemplate(
    world,
    {
      name: "Faction",
      fields: [
        { label: "Seat", valueType: "text", required: true },
        { label: "Mandate", valueType: "text", required: true },
      ],
    },
    "2026-04-21T07:08:20.000Z",
  );
  world = factionTemplate.world;
  const routeTemplate = addWorldTemplate(
    world,
    {
      name: "Stellar Route",
      fields: [{ label: "Status", valueType: "text", required: true }],
    },
    "2026-04-21T07:08:30.000Z",
  );
  world = routeTemplate.world;
  const customs = instantiateWorldEntity(
    world,
    factionTemplate.template.id,
    {
      name: "Customs Directorate",
      fieldValues: { seat: "Halcyon", mandate: "Dock control" },
    },
    "2026-04-21T07:08:40.000Z",
  );
  world = customs.world;
  const corridor = instantiateWorldEntity(
    world,
    routeTemplate.template.id,
    {
      name: "Leviathan Corridor",
      fieldValues: { status: "contested" },
    },
    "2026-04-21T07:08:50.000Z",
  );
  world = corridor.world;
  const treatySpine = addTimelineSpine(
    world,
    { label: "Treaty Pressure", kind: "thread" },
    "2026-04-21T07:09:00.000Z",
  );
  world = treatySpine.world;
  const corridorSpine = addTimelineSpine(
    world,
    { label: "Corridor Archive", kind: "region" },
    "2026-04-21T07:09:10.000Z",
  );
  world = corridorSpine.world;
  const treatyNode = addTimelineNode(
    world,
    treatySpine.spine.id,
    { label: "Treaty silence spreads", linkedEntityIds: [customs.entity.id] },
    "2026-04-21T07:09:20.000Z",
  );
  world = treatyNode.world;
  const corridorNode = addTimelineNode(
    world,
    corridorSpine.spine.id,
    { label: "Leviathan map recovered", linkedEntityIds: [corridor.entity.id] },
    "2026-04-21T07:09:30.000Z",
  );
  world = corridorNode.world;

  const analysisService = createLocalAnalysisService();
  const analysis = analysisService.analyzeWorkspace(
    project,
    world,
    "2026-04-21T07:09:00.000Z",
  );

  assert.equal(analysis.issues.length, 3);
  assert.equal(analysis.events.length, 3);
  assert.equal(analysis.suggestions.length, 3);
  assert.equal(analysis.job.result?.issueCount, 3);
  assert.equal(analysis.job.result?.suggestionCount, 3);
  assert.equal(analysis.provider.executionMode, "local-only");
  assert.match(analysis.issues[0].summary, /customs ring/);
  assert.equal(analysis.events[1].label, "Auren meets Inspector Voss");
  assert.equal(analysis.events[2].evidenceExcerpt, "Leviathan Corridor");
  assert.equal(analysis.suggestions[0].suggestionType, "template");
  assert.equal(analysis.suggestions[1].suggestionType, "entity");
  assert.equal(analysis.suggestions[2].suggestionType, "link");

  const dreamScape = analysisService.exploreDreamScape({
    project,
    world,
    ideaTitle: "Signal under the ice",
    ideaText:
      "A scene where an old beacon under Khepri makes the treaty silence feel deliberately staged.",
    now: "2026-04-21T07:10:00.000Z",
  });

  assert.equal(dreamScape.issues.length, 0);
  assert.equal(dreamScape.events.length, 0);
  assert.equal(dreamScape.suggestions.length, 1);
  assert.equal(dreamScape.job.request.trigger, "dream-scaping");
  assert.equal(dreamScape.job.result?.suggestionCount, 1);
  assert.equal(dreamScape.suggestions[0].suggestionType, "dream-scaping");
  assert.equal(dreamScape.suggestions[0].reviewState, "pending");
  assert.equal(dreamScape.suggestions[0].fit, "world-history");
  assert.equal(dreamScape.suggestions[0].proposedPlacement.target, "timeline-node");
  assert.equal(dreamScape.suggestions[0].evidence.length, 3);
}
