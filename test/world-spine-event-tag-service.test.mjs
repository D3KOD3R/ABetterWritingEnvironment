// Intent: verify manual World Spine event tags preserve canonical manuscript anchors.
import assert from "node:assert/strict";

import {
  buildWorldSpineEventComposerFromContextMenu,
  buildWorldSpineEventTagFromComposer,
} from "../apps/editor/public/features/world-spine/world-spine-event-tag-service.js";

export function runWorldSpineEventTagServiceTest() {
  const composer = buildWorldSpineEventComposerFromContextMenu({
    sceneId: "scene-1",
    selectedText: "Gamma delta",
    startOffset: 13,
    endOffset: 24,
  }, {
    x: 20,
    y: 30,
  });
  assert.equal(composer.composerType, "world-spine-event");
  assert.equal(composer.x, 30);

  const scene = {
    chapterId: "chapter-1",
    chapterTitle: "Chapter 1",
    sceneId: "scene-1",
    sceneTitle: "Ceres Arrival",
    worldSpineMetadata: {
      location: "Ceres Dock",
    },
    editorText: "Alpha beta.\n\nGamma delta.",
    blocks: [{
      blockId: "block-1",
      paragraphId: "paragraph-1",
      lineNumber: 1,
      sceneLineNumber: 1,
      text: "Alpha beta.",
    }, {
      blockId: "block-2",
      paragraphId: "paragraph-2",
      lineNumber: 2,
      sceneLineNumber: 2,
      text: "Gamma delta.",
    }],
  };
  const eventTag = buildWorldSpineEventTagFromComposer({
    composer,
    scene,
    label: "Docking clamps catch",
    projectId: "project-1",
    sequence: 7,
  });

  assert.equal(eventTag.id, "event-0008");
  assert.equal(eventTag.kind, "plot-turn");
  assert.equal(eventTag.label, "Docking clamps catch");
  assert.equal(eventTag.anchor.projectId, "project-1");
  assert.equal(eventTag.anchor.blockId, "block-2");
  assert.equal(eventTag.anchor.startOffset, 0);
  assert.equal(eventTag.anchor.endOffset, 11);
  assert.equal(eventTag.evidenceExcerpt, "Gamma delta");
  assert.equal(eventTag.blockId, "block-2");
  assert.equal(eventTag.sceneLineNumber, 2);
  assert.equal(eventTag.location, "Ceres Dock");
}
