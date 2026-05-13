// Intent: verify world schema templates, entities, spines, and cross-links remain structured.
import assert from "node:assert/strict";

import {
  addBlock,
  addChapter,
  addScene,
  createManuscriptAnchor,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import {
  addTimelineNode,
  addTimelineSpine,
  addWorldTemplate,
  createWorldModel,
  instantiateWorldEntity,
  linkTimelineNodes,
  registerEntityIntroduction,
} from "../packages/world-schema/src/index.ts";

export function runWorldSchemaTest() {
  let project = createProject({
    title: "Starfall Station",
    now: "2026-04-21T04:00:00.000Z",
  });

  const chapterResult = addChapter(project, { title: "Survey Log" }, "2026-04-21T04:01:00.000Z");
  project = chapterResult.project;

  const sceneResult = addScene(
    project,
    chapterResult.chapter.id,
    { title: "First Pass" },
    "2026-04-21T04:02:00.000Z",
  );
  project = sceneResult.project;

  const blockResult = addBlock(
    project,
    sceneResult.scene.id,
    {
      kind: "narration",
      text: "Halcyon Station turned once above the ice world as the survey team marked its first orbit.",
    },
    "2026-04-21T04:03:00.000Z",
  );
  project = blockResult.project;

  const introductionAnchor = createManuscriptAnchor(project, {
    blockId: blockResult.block.id,
    startOffset: 0,
    endOffset: 15,
  });

  let world = createWorldModel({
    title: "Halcyon Reference",
    now: "2026-04-21T04:10:00.000Z",
  });

  const templateResult = addWorldTemplate(
    world,
    {
      name: "Planet",
      description: "Structured planetary metadata.",
      fields: [
        {
          label: "Government",
          valueType: "text",
          required: true,
        },
        {
          label: "Moons",
          valueType: "number",
          defaultValue: 0,
        },
        {
          label: "Traits",
          valueType: "list",
          defaultValue: ["glacial"],
        },
        {
          label: "Status",
          valueType: "enum",
          options: ["settled", "contested", "quarantined"],
          defaultValue: "settled",
        },
      ],
    },
    "2026-04-21T04:11:00.000Z",
  );
  world = templateResult.world;

  const entityResult = instantiateWorldEntity(
    world,
    templateResult.template.id,
    {
      name: "Khepri",
      fieldValues: {
        government: "Consortium Protectorate",
      },
    },
    "2026-04-21T04:12:00.000Z",
  );
  world = entityResult.world;

  assert.equal(entityResult.entity.fields.government, "Consortium Protectorate");
  assert.equal(entityResult.entity.fields.moons, 0);
  assert.deepEqual(entityResult.entity.fields.traits, ["glacial"]);
  assert.equal(entityResult.entity.fields.status, "settled");

  const spineResult = addTimelineSpine(
    world,
    {
      label: "Khepri Orbit",
      kind: "planet",
    },
    "2026-04-21T04:13:00.000Z",
  );
  world = spineResult.world;

  const nodeOneResult = addTimelineNode(
    world,
    spineResult.spine.id,
    {
      label: "First Survey",
      summary: "The team establishes orbital contact.",
      manuscriptAnchors: [introductionAnchor],
    },
    "2026-04-21T04:14:00.000Z",
  );
  world = nodeOneResult.world;

  const introductionResult = registerEntityIntroduction(
    world,
    {
      entityId: entityResult.entity.id,
      anchor: introductionAnchor,
      timelineNodeId: nodeOneResult.node.id,
      notes: "First clear manuscript mention of Khepri.",
    },
    "2026-04-21T04:15:00.000Z",
  );
  world = introductionResult.world;

  const nodeTwoResult = addTimelineNode(
    world,
    spineResult.spine.id,
    {
      label: "Treaty Proposal",
      summary: "A follow-up diplomatic proposal reaches orbit.",
      linkedEntityIds: [entityResult.entity.id],
    },
    "2026-04-21T04:16:00.000Z",
  );
  world = nodeTwoResult.world;

  const edgeResult = linkTimelineNodes(
    world,
    {
      fromNodeId: nodeOneResult.node.id,
      toNodeId: nodeTwoResult.node.id,
      kind: "causes",
      label: "Survey enables diplomacy",
    },
    "2026-04-21T04:17:00.000Z",
  );
  world = edgeResult.world;

  assert.equal(world.entities[0].introduction.id, introductionResult.introduction.id);
  assert.equal(world.nodes[0].linkedEntityIds[0], entityResult.entity.id);
  assert.equal(world.entityLinks.length, 2);
  assert.equal(world.edges[0].kind, "causes");
  assert.equal(world.updatedAt, "2026-04-21T04:17:00.000Z");
}
