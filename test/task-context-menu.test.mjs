// Intent: verify anchored task/note context surfaces render outside the app shell.
import assert from "node:assert/strict";

import {
  buildAnchoredRecordContextMenuModel,
  buildTaskComposerModel,
  renderAnchoredRecordContextMenuHTML,
  renderTaskComposerHTML,
} from "../apps/editor/public/features/anchored-records/task-context-menu.js";

export function runTaskContextMenuTest() {
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
  assert.match(composerMarkup, /Save research/);

  const menu = {
    sceneId: "scene-1",
    selectedText: "Selected line",
    hasExplicitSelection: false,
    x: 900,
    y: 700,
  };
  const menuModel = buildAnchoredRecordContextMenuModel(menu, {
    width: 1000,
    height: 800,
  });
  assert.equal(menuModel.left, 724);
  assert.equal(menuModel.top, 570);

  const menuMarkup = renderAnchoredRecordContextMenuHTML(menu, {
    width: 1000,
    height: 800,
  });
  assert.match(menuMarkup, /Add task from line/);
  assert.match(menuMarkup, /data-action="add-passage-note" data-note-type="inspiration"/);
  assert.match(menuMarkup, /data-action="trim-scene-whitespace" data-scene-id="scene-1"/);
}
