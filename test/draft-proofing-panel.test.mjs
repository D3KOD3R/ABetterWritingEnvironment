// Intent: verify draft proof-read controls render as a top-chrome panel.
import assert from "node:assert/strict";

import {
  buildDraftProofPanelModel,
  renderDraftProofPanel,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-panel.js";

export function runDraftProofingPanelTest() {
  const emptyModel = buildDraftProofPanelModel();
  assert.equal(emptyModel.statusLabel, "Ready");
  assert.equal(emptyModel.label, "Start proof read");

  const activeState = {
    draftProofing: {
      activeRunId: "draft-proof-run-0001",
      runs: [{
        id: "draft-proof-run-0001",
        label: "Draft proof 1",
        status: "active",
        coverageByScene: {
          "scene-1": [{ startOffset: 0, endOffset: 12 }],
        },
      }],
    },
  };
  const activeHtml = renderDraftProofPanel(activeState);
  assert.match(activeHtml, /draft-proof-panel/);
  assert.match(activeHtml, /data-action="toggle-draft-proof-run"/);
  assert.match(activeHtml, /data-action="complete-draft-proof-run"/);
  assert.match(activeHtml, /aria-pressed="true"/);
  assert.match(activeHtml, /Pause/);

  const completedModel = buildDraftProofPanelModel({
    runs: [{
      id: "draft-proof-run-0001",
      label: "Draft proof 1",
      status: "completed",
      coverageByScene: {
        "scene-1": [{ startOffset: 0, endOffset: 12 }],
        "scene-2": [{ startOffset: 0, endOffset: 4 }],
      },
    }],
  });
  assert.equal(completedModel.statusLabel, "Completed");
  assert.equal(completedModel.hasCurrentRun, false);
  assert.equal(completedModel.coverageLabel, "2 scenes · 2 spans");
}
