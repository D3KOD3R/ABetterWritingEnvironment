// Intent: verify anchored task/note context surfaces render outside the app shell.
import assert from "node:assert/strict";

import {
  buildAnchoredRecordContextMenuModel,
  buildTaskComposerModel,
  renderAnchoredRecordContextMenuHTML,
  renderTaskComposerHTML,
} from "../apps/editor/public/features/anchored-records/task-context-menu.js";

export function runTaskContextMenuTest() {
  const metadataIcon = {
    dataUrl: "data:image/png;base64,AAAA",
    mediaType: "image/png",
    name: "lore.png",
    size: 3,
  };
  const composer = {
    composerType: "passage-note",
    noteType: "research",
    selectedText: "A selected passage that should be quoted in the composer.",
    x: 900,
    y: 700,
  };
  const composerModel = buildTaskComposerModel(composer, {
    width: 1000,
    height: 800,
  }, {
    passageNotePlaceholder: "Research note",
    editorStyle: "--editor-font-size: 16px;",
  });
  assert.equal(composerModel.left, 620);
  assert.equal(composerModel.top, 540);
  assert.equal(composerModel.noteLabel, "Research");

  const composerMarkup = renderTaskComposerHTML(composer, {
    width: 1000,
    height: 800,
  }, {
    passageNotePlaceholder: "Research note",
  });
  assert.match(composerMarkup, /data-passage-note-body/);
  assert.match(composerMarkup, /data-action="save-passage-note"/);
  assert.match(composerMarkup, /form-dismiss-button task-composer__dismiss/);
  assert.match(composerMarkup, /data-action="cancel-selection-task"/);
  assert.match(composerMarkup, /Save research/);
  assert.doesNotMatch(composerMarkup, />Cancel<\/button>/);

  const worldComposerMarkup = renderTaskComposerHTML({
    composerType: "world-spine-event",
    selectedText: "The docking clamps catch.",
    x: 80,
    y: 90,
  });
  assert.match(worldComposerMarkup, /data-world-spine-event-label/);
  assert.match(worldComposerMarkup, /data-action="save-world-spine-event"/);
  assert.match(worldComposerMarkup, /Add World Spine event/);

  const menu = {
    sceneId: "scene-1",
    selectedText: "Selected line",
    hasExplicitSelection: false,
    dictionaryContext: {
      word: "Selected",
      normalizedWord: "selected",
      sceneId: "scene-1",
      startOffset: 0,
      endOffset: 8,
      x: 900,
      y: 700,
    },
    x: 900,
    y: 700,
  };
  const menuModel = buildAnchoredRecordContextMenuModel(menu, {
    width: 1000,
    height: 800,
  }, {
    customMetadataDefinitions: [{ id: "metadata-lore", label: "Lore", highlightColor: "#7fcf9f", icon: metadataIcon }],
  });
  assert.equal(menuModel.left, 724);
  assert.equal(menuModel.top, 520);
  assert.equal(menuModel.dictionaryContext.word, "Selected");
  assert.equal(menuModel.customMetadataDefinitions[0].label, "Lore");
  assert.equal(menuModel.customMetadataDefinitions[0].icon.dataUrl, metadataIcon.dataUrl);

  const menuMarkup = renderAnchoredRecordContextMenuHTML(menu, {
    width: 1000,
    height: 800,
  }, {
    customMetadataDefinitions: [{ id: "metadata-lore", label: "Lore", highlightColor: "#7fcf9f", icon: metadataIcon }],
  });
  assert.match(menuMarkup, /Add task from line/);
  assert.match(menuMarkup, /data-action="lookup-dictionary-word"/);
  assert.match(menuMarkup, /data-dictionary-word="Selected"/);
  assert.match(menuMarkup, /data-action="add-world-spine-event"/);
  assert.match(menuMarkup, /Add World Spine event from line/);
  assert.match(menuMarkup, /data-action="add-passage-note" data-note-type="inspiration"/);
  assert.match(menuMarkup, /data-note-type="metadata-lore"/);
  assert.match(menuMarkup, /Add Lore/);
  assert.match(menuMarkup, /metadata-image-icon--task-menu/);
  assert.match(menuMarkup, /data-action="trim-scene-whitespace" data-scene-id="scene-1"/);
}
