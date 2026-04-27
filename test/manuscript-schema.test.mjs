import assert from "node:assert/strict";

import {
  addBlock,
  addChapter,
  addEventTag,
  addIssueRecord,
  addScene,
  buildBinderTree,
  buildManuscriptIndex,
  createManuscriptAnchor,
  createProject,
  resolveManuscriptAnchor,
} from "../packages/manuscript-schema/src/index.ts";

export function runManuscriptSchemaTest() {
  let project = createProject({
    title: "Starfall Station",
    now: "2026-04-21T03:00:00.000Z",
  });

  const chapterResult = addChapter(
    project,
    {
      title: "Arrival",
      summary: "The frigate reaches Halcyon Station.",
    },
    "2026-04-21T03:01:00.000Z",
  );
  project = chapterResult.project;

  const sceneResult = addScene(
    project,
    chapterResult.chapter.id,
    {
      title: "Docking Approach",
      synopsis: "The crew lines up for a tense entry.",
    },
    "2026-04-21T03:02:00.000Z",
  );
  project = sceneResult.project;

  const narrationResult = addBlock(
    project,
    sceneResult.scene.id,
    {
      kind: "narration",
      text: "The frigate drifted toward Halcyon Station beneath a field of torn blue plasma.",
    },
    "2026-04-21T03:03:00.000Z",
  );
  project = narrationResult.project;

  const dialogueResult = addBlock(
    project,
    sceneResult.scene.id,
    {
      kind: "dialogue",
      speakerId: "character-auren",
      text: "Keep the lights low until we clear the customs ring.",
    },
    "2026-04-21T03:04:00.000Z",
  );
  project = dialogueResult.project;

  const binder = buildBinderTree(project);
  assert.equal(binder.children.length, 1);
  assert.equal(binder.children[0].children.length, 1);
  assert.equal(binder.children[0].children[0].title, "Docking Approach");

  const index = buildManuscriptIndex(project);
  assert.deepEqual(
    index.map((entry) => ({
      blockId: entry.blockId,
      lineNumber: entry.lineNumber,
    })),
    [
      { blockId: narrationResult.block.id, lineNumber: 1 },
      { blockId: dialogueResult.block.id, lineNumber: 2 },
    ],
  );

  const anchor = createManuscriptAnchor(project, {
    blockId: dialogueResult.block.id,
    startOffset: 0,
    endOffset: 21,
  });

  const resolved = resolveManuscriptAnchor(project, anchor);
  assert.equal(resolved.excerpt, "Keep the lights low u");
  assert.equal(resolved.index.lineNumber, 2);
  assert.equal(resolved.scene.id, sceneResult.scene.id);

  const issueResult = addIssueRecord(
    project,
    {
      category: "clarity",
      severity: "warning",
      summary: "The timing of the customs instruction could be clearer.",
      source: "rule",
      confidence: 0.82,
      anchor,
    },
    "2026-04-21T03:05:00.000Z",
  );
  project = issueResult.project;

  assert.equal(project.issues.length, 1);
  assert.equal(project.issues[0].evidenceExcerpt, "Keep the lights low u");
  assert.equal(project.issues[0].lifecycle, "open");

  const eventAnchor = createManuscriptAnchor(project, {
    blockId: narrationResult.block.id,
    startOffset: 27,
    endOffset: 42,
  });
  const eventResult = addEventTag(
    project,
    {
      kind: "character-introduction",
      label: "Halcyon Station introduced",
      source: "analysis",
      anchor: eventAnchor,
    },
    "2026-04-21T03:06:00.000Z",
  );
  project = eventResult.project;

  assert.equal(project.eventTags.length, 1);
  assert.equal(project.eventTags[0].evidenceExcerpt, "Halcyon Station");
  assert.equal(project.updatedAt, "2026-04-21T03:06:00.000Z");
}
