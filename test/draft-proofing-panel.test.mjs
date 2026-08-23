// Intent: verify draft proof-read controls render as a top-chrome panel.
import assert from "node:assert/strict";

import {
  buildDraftProofPanelModel,
  renderDraftProofPanel,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-panel.js";

export function runDraftProofingPanelTest() {
  const emptyModel = buildDraftProofPanelModel();
  assert.equal(emptyModel.statusLabel, "Ready");
  assert.equal(emptyModel.label, "New proof read run");
  assert.equal(emptyModel.canToggleRun, false);
  assert.equal(emptyModel.canStartNewRun, true);
  assert.equal(emptyModel.markersVisible, false);
  assert.equal(emptyModel.markerToggleLabel, "Show proof-read marks");

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
  const activeHtml = renderDraftProofPanel({
    ...activeState,
    draftProofMarksVisible: true,
  });
  assert.match(activeHtml, /draft-proof-panel/);
  assert.match(activeHtml, /data-action="toggle-draft-proof-run"/);
  assert.match(activeHtml, /data-action="start-draft-proof-run"/);
  assert.match(activeHtml, /data-action="toggle-draft-proof-markers"/);
  assert.match(activeHtml, /data-action="open-proof-read-settings"/);
  assert.match(activeHtml, /data-action="complete-draft-proof-run"/);
  assert.match(activeHtml, /aria-pressed="true"/);
  assert.match(activeHtml, /aria-label="Hide proof-read marks"/);
  assert.match(activeHtml, /title="Pause proof read"/);
  assert.match(activeHtml, /draft-proof-panel__pause-icon/);
  assert.match(activeHtml, /draft-proof-panel__eye-button is-visible/);
  assert.match(activeHtml, /disabled/);

  const hiddenHtml = renderDraftProofPanel(activeState);
  assert.match(hiddenHtml, /aria-label="Show proof-read marks"/);
  assert.match(hiddenHtml, /aria-pressed="false"/);
  assert.doesNotMatch(hiddenHtml, /draft-proof-panel__eye-button is-visible/);

  const pausedHtml = renderDraftProofPanel({
    draftProofing: {
      runs: [{
        id: "draft-proof-run-0001",
        label: "Draft proof 1",
        status: "paused",
        coverageByScene: {},
      }],
    },
  });
  assert.match(pausedHtml, /title="Resume proof read"/);
  assert.match(pausedHtml, /draft-proof-panel__play-icon/);
  assert.match(pausedHtml, /title="New proof read run"/);

  const completedState = {
    runs: [{
      id: "draft-proof-run-0001",
      label: "Draft proof 1",
      status: "completed",
      coverageByScene: {
        "scene-1": [{ startOffset: 0, endOffset: 12 }],
        "scene-2": [{ startOffset: 0, endOffset: 4 }],
      },
    }],
  };
  const completedModel = buildDraftProofPanelModel(completedState);
  assert.equal(completedModel.statusLabel, "Completed");
  assert.equal(completedModel.hasCurrentRun, false);
  assert.equal(completedModel.canToggleRun, true);
  assert.equal(completedModel.canStartNewRun, true);
  assert.equal(completedModel.runToggleLabel, "Continue proof read run");
  assert.equal(completedModel.coverageLabel, "2 scenes · 2 spans");

  const completedHtml = renderDraftProofPanel({
    draftProofing: completedState,
  });
  assert.match(completedHtml, /title="Continue proof read run"/);
  assert.match(completedHtml, /draft-proof-panel__play-icon/);
  assert.match(completedHtml, /title="New proof read run"/);
}
