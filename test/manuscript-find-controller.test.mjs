// Intent: verify manuscript find derivation and replacement planning remain independent from DOM and persistence effects.
import assert from "node:assert/strict";

import { createManuscriptFindController } from "../apps/editor/public/features/manuscript-editor/manuscript-find-controller.js";

export function runManuscriptFindControllerTest() {
  const scenes = [{
    sceneId: "scene-1",
    chapterTitle: "Chapter 1",
    sceneTitle: "Arrival",
    editorText: "Quiet door. Quiet water.",
  }, {
    sceneId: "scene-2",
    chapterTitle: "Chapter 2",
    sceneTitle: "Return",
    editorText: "A quiet answer.",
  }];
  const controller = createManuscriptFindController({
    getScenes: () => scenes,
  });

  const openState = controller.open({
    open: false,
    query: "",
    replaceText: "Still",
    activeIndex: 0,
    position: null,
  }, "Quiet");
  const model = controller.buildPanelModel(openState);
  assert.equal(model.matches.length, 3);
  assert.equal(model.matches[0].sceneId, "scene-1");
  assert.equal(model.matches[0].startOffset, 0);
  assert.match(model.matches[0].snippetHtml, /<mark>Quiet<\/mark>/);
  assert.match(controller.renderPanelHTML(model), /3 matches/);

  const next = controller.moveMatch(openState, 1);
  assert.equal(next.state.activeIndex, 1);
  assert.equal(next.match.startOffset, 12);

  const currentPlan = controller.buildCurrentReplacement({
    ...openState,
    replaceText: "Still",
  });
  assert.equal(currentPlan.sceneId, "scene-1");
  assert.equal(currentPlan.nextText, "Still door. Quiet water.");

  const allPlans = controller.buildAllReplacements({
    ...openState,
    replaceText: "Still",
  });
  assert.equal(allPlans.length, 2);
  assert.equal(allPlans[0].nextText, "Still door. Still water.");
  assert.equal(allPlans[1].nextText, "A Still answer.");

  const updatedField = controller.updateField(openState, "manuscript-find-query", "door");
  assert.equal(updatedField.query, "door");
  assert.equal(updatedField.activeIndex, 0);
  assert.equal(controller.close(openState).open, false);
}
