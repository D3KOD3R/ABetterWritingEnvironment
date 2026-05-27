// Intent: verify manuscript selection state remains deterministic outside browser DOM and save effects.
import assert from "node:assert/strict";

import { createManuscriptSelectionController } from "../apps/editor/public/features/manuscript-editor/manuscript-selection-controller.js";

export function runManuscriptSelectionControllerTest() {
  const scene = {
    sceneId: "scene-1",
    editorText: "  Quiet door.\nSecond line.  ",
    blocks: [{
      blockId: "block-1",
      lineNumber: 11,
    }, {
      blockId: "block-2",
      lineNumber: 12,
    }],
  };
  const controller = createManuscriptSelectionController({
    findSceneBlockAtOffset: (_scene, offset) => offset < 14 ? scene.blocks[0] : scene.blocks[1],
  });

  assert.deepEqual(controller.createBookmark({
    sceneId: " scene-1 ",
    startOffset: 10,
    endOffset: 4,
    scrollTop: -5,
    scrollLeft: 12,
  }), {
    sceneId: "scene-1",
    selectionStart: 4,
    selectionEnd: 10,
    codeframeScrollTop: 0,
    codeframeScrollLeft: 12,
  });
  assert.equal(controller.getSelectedText({
    text: scene.editorText,
    startOffset: 0,
    endOffset: 14,
  }), "Quiet door.");
  assert.deepEqual(controller.getContextRange({
    text: scene.editorText,
    startOffset: 3,
    endOffset: 3,
  }), {
    selectedText: "Quiet door.",
    startOffset: 2,
    endOffset: 13,
    hasExplicitSelection: false,
  });

  const liveSnapshot = controller.createSelectionSnapshot({
    scene,
    startOffset: 16,
    endOffset: 22,
    lineNumber: 12,
    scrollTop: 28,
    scrollLeft: 4,
  });
  assert.equal(liveSnapshot.blockId, "block-2");
  assert.equal(liveSnapshot.startOffset, 16);
  assert.equal(liveSnapshot.lineNumber, 12);

  assert.deepEqual(controller.resolveSelectionDefaultsForSave({
    selectedBlockId: "block-1",
    scene,
    liveSelection: liveSnapshot,
  }), {
    blockId: "block-2",
    lineNumber: 12,
    startOffset: 16,
    endOffset: 22,
    scrollTop: 28,
    scrollLeft: 4,
  });

  assert.deepEqual(controller.normalizeSavedSceneSelection({
    sceneSelectionBlockId: "block-2",
    sceneSelectionLineNumber: 0,
    sceneSelectionStart: 200,
    sceneSelectionEnd: 2,
    sceneSelectionScrollTop: -12,
    sceneSelectionScrollLeft: 5,
  }, scene), {
    blockId: "block-2",
    lineNumber: 1,
    startOffset: scene.editorText.length,
    endOffset: 2,
    scrollTop: 0,
    scrollLeft: 5,
  });
}
