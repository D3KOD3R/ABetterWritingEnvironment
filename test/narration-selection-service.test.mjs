// Intent: verify narration take selection derivation stays outside app.js.
import assert from "node:assert/strict";

import {
  buildNarrationTakeSelection,
  resolveNarrationTakeSelectionFromTextInput,
  selectNarrationTakeSelectionForScene,
} from "../apps/editor/public/features/narration/narration-selection-service.js";

export function runNarrationSelectionServiceTest() {
  const scene = {
    chapterId: "chapter-1",
    chapterTitle: "Opening",
    sceneId: "scene-1",
    sceneTitle: "First Scene",
    blocks: [
      {
        blockId: "block-1",
        paragraphId: "paragraph-1",
        lineNumber: 1,
        kind: "narration",
        text: "First line.",
      },
      {
        blockId: "block-2",
        paragraphId: "paragraph-2",
        lineNumber: 2,
        kind: "dialogue",
        text: "Second line.",
      },
    ],
  };
  const ranges = [
    { blockId: "block-1", startOffset: 0, endOffset: 11 },
    { blockId: "block-2", startOffset: 13, endOffset: 25 },
  ];
  const getSceneBlockRanges = () => ranges;

  const direct = buildNarrationTakeSelection(scene, scene.blocks[1], {
    blockRange: ranges[1],
    selectedText: "Second line.",
    projectId: "project-1",
  });
  assert.equal(direct.id, "scene-1:block-2:13:25");
  assert.equal(direct.kindLabel, "Dialogue");
  assert.equal(direct.projectId, "project-1");

  const selected = selectNarrationTakeSelectionForScene(scene, {
    selectedBlockId: "block-2",
    projectId: "project-1",
    getSceneBlockRanges,
  });
  assert.equal(selected.blockId, "block-2");
  assert.equal(selected.selectedText, "Second line.");

  const reused = selectNarrationTakeSelectionForScene(scene, {
    currentSelection: selected,
    selectedBlockId: "block-1",
    projectId: "project-1",
    getSceneBlockRanges,
  });
  assert.equal(reused, selected);

  const fromInput = resolveNarrationTakeSelectionFromTextInput({
    scene,
    contextRange: {
      hasExplicitSelection: true,
      startOffset: 1,
      endOffset: 5,
      selectedText: "irst",
    },
    caretOffset: 1,
    projectId: "project-1",
    findSceneBlockAtOffset: () => scene.blocks[0],
    getSceneBlockRanges,
  });
  assert.equal(fromInput.blockId, "block-1");
  assert.equal(fromInput.startOffset, 1);
  assert.equal(fromInput.endOffset, 5);
  assert.equal(fromInput.selectedText, "irst");

  const fromCaretLine = resolveNarrationTakeSelectionFromTextInput({
    scene,
    contextRange: {
      hasExplicitSelection: false,
      startOffset: 0,
      endOffset: 0,
      selectedText: "",
    },
    caretOffset: 18,
    caretRange: {
      blockId: "block-2",
      startOffset: 13,
      endOffset: 19,
      selectedText: "Second",
    },
    projectId: "project-1",
    findSceneBlockAtOffset: () => scene.blocks[1],
    getSceneBlockRanges,
  });
  assert.equal(fromCaretLine.blockId, "block-2");
  assert.equal(fromCaretLine.startOffset, 13);
  assert.equal(fromCaretLine.endOffset, 19);
  assert.equal(fromCaretLine.selectedText, "Second");
}
