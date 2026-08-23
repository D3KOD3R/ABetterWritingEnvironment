// Intent: verify proof-read project settings render without owning persistence.
import assert from "node:assert/strict";

import {
  buildDraftProofSettingsWindowModel,
  renderDraftProofSettingsWindowHTML,
  shouldCloseDraftProofSettingsWindowForClick,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-settings-window.js";

export function runDraftProofingSettingsWindowTest() {
  const draftProofing = {
    activeRunId: "draft-proof-run-0002",
    settings: {
      backdropColor: "#abc",
      highlightIntensityByTheme: {
        light: 51,
        dark: 88,
      },
      recentBackdropColors: ["#2ca20b", "#abc", "#2ca20b"],
      backdropColorPresets: ["#fed", "#d5dce0", "#d8dfd2", "#e2d5c6", "#d6d2dc"],
    },
    runs: [{
      id: "draft-proof-run-0001",
      label: "Draft proof 1",
      status: "completed",
      iterationNumber: 1,
      settings: {
        backdropColor: "#123456",
        highlightIntensityByTheme: {
          light: 32,
          dark: 74,
        },
        recentBackdropColors: ["#123456"],
        backdropColorPresets: ["#123456", "#d5dce0", "#d8dfd2", "#e2d5c6", "#d6d2dc"],
      },
      coverageByScene: {
        "scene-1": [{ startOffset: 0, endOffset: 5 }],
      },
    }, {
      id: "draft-proof-run-0002",
      label: "Draft proof 2",
      status: "active",
      iterationNumber: 2,
      settings: {
        backdropColor: "#c69fc6",
        highlightIntensityByTheme: {
          light: 68,
          dark: 85,
        },
        recentBackdropColors: ["#2ca20b", "#c69fc6"],
        backdropColorPresets: ["#fed", "#d5dce0", "#d8dfd2", "#e2d5c6", "#d6d2dc"],
      },
      coverageByScene: {
        "scene-1": [{ startOffset: 8, endOffset: 12 }],
        "scene-2": [{ startOffset: 0, endOffset: 7 }],
      },
    }],
  };

  const model = buildDraftProofSettingsWindowModel({ draftProofing });
  assert.equal(model.selectedRunId, "draft-proof-run-0002");
  assert.equal(model.activeTheme, "light");
  assert.equal(model.backdropColor, "#c69fc6");
  assert.deepEqual(model.highlightIntensityControls.map((control) => [control.theme, control.value]), [
    ["light", 68],
  ]);
  assert.equal(model.runOptions.length, 2);
  assert.equal(model.runOptions[1].label, "Draft proof 2 - Active");
  assert.equal(model.deleteRunOptions.length, 2);
  assert.equal(model.deleteRunOptions[0].coverageSummary, "1 scene - 1 span");
  assert.equal(model.deleteRunOptions[1].coverageSummary, "2 scenes - 2 spans");
  assert.deepEqual(model.backdropColorPresets, ["#ffeedd", "#bcc8cf", "#c1cfb8", "#d1bfa7", "#c4bdd1"]);
  assert.deepEqual(model.recentBackdropColors, ["#c69fc6", "#2ca20b"]);
  assert.equal(model.runCount, 2);
  assert.equal(model.hasRunData, true);

  const darkModel = buildDraftProofSettingsWindowModel({ draftProofing, activeTheme: "dark" });
  assert.equal(darkModel.activeTheme, "dark");
  assert.deepEqual(darkModel.highlightIntensityControls.map((control) => [control.theme, control.value]), [
    ["dark", 85],
  ]);

  const selectedModel = buildDraftProofSettingsWindowModel({
    draftProofing,
    selectedRunId: "draft-proof-run-0001",
    activeTheme: "dark",
  });
  assert.equal(selectedModel.selectedRunId, "draft-proof-run-0001");
  assert.equal(selectedModel.backdropColor, "#123456");
  assert.deepEqual(selectedModel.highlightIntensityControls.map((control) => [control.theme, control.value]), [
    ["dark", 74],
  ]);

  const html = renderDraftProofSettingsWindowHTML({ draftProofing });
  assert.match(html, /draft-proof-settings-window/);
  assert.match(html, /data-action="close-proof-read-settings-window"/);
  assert.match(html, /data-draft-proof-settings-run/);
  assert.match(html, /Draft proof 1 - Completed/);
  assert.match(html, /Draft proof 2 - Active/);
  assert.doesNotMatch(html, /draft-proof-settings-window__stats/);
  assert.doesNotMatch(html, />Runs</);
  assert.doesNotMatch(html, />Active</);
  assert.doesNotMatch(html, />Completed</);
  assert.doesNotMatch(html, />Scenes</);
  assert.doesNotMatch(html, />Spans</);
  assert.match(html, /data-draft-proof-setting="backdropColor"/);
  assert.match(html, /value="#c69fc6"/);
  assert.match(html, /data-draft-proof-setting="highlightIntensity"/);
  assert.match(html, /data-draft-proof-highlight-theme="light"/);
  assert.match(html, /value="68"/);
  assert.match(html, /68%/);
  assert.doesNotMatch(html, /data-draft-proof-highlight-theme="dark"/);
  assert.doesNotMatch(html, /value="85"/);
  assert.doesNotMatch(html, /85%/);
  assert.match(html, /data-action="reset-draft-proof-backdrop-color"/);
  assert.match(html, /data-action="set-draft-proof-backdrop-preset"/);
  assert.match(html, /draft-proof-settings-window__recent-group/);
  assert.match(html, /data-action="set-draft-proof-backdrop-recent"/);
  assert.match(html, /data-draft-proof-recent-index="0"/);
  assert.match(html, /draft-proof-settings-window__delete-list/);
  assert.match(html, /data-draft-proof-delete-run-id="draft-proof-run-0001"/);
  assert.match(html, /data-draft-proof-delete-run-id="draft-proof-run-0002"/);
  assert.match(html, /data-action="delete-selected-draft-proof-runs"/);
  assert.match(html, /Delete selected iterations/);
  assert.match(html, /--draft-proof-settings-preset:#c69fc6/);
  assert.match(html, /--draft-proof-settings-preset:#2ca20b/);
  assert.match(html, /data-draft-proof-preset-index="0"/);
  assert.match(html, /value="#ffeedd"/);
  assert.match(html, /data-action="request-clear-draft-proof-data"/);

  const darkHtml = renderDraftProofSettingsWindowHTML({ draftProofing, activeTheme: "dark" });
  assert.match(darkHtml, /data-draft-proof-setting="highlightIntensity"/);
  assert.match(darkHtml, /data-draft-proof-highlight-theme="dark"/);
  assert.match(darkHtml, /value="85"/);
  assert.match(darkHtml, /85%/);
  assert.doesNotMatch(darkHtml, /data-draft-proof-highlight-theme="light"/);
  assert.doesNotMatch(darkHtml, /value="68"/);
  assert.doesNotMatch(darkHtml, /68%/);

  const armedHtml = renderDraftProofSettingsWindowHTML({
    draftProofing,
    clearConfirmationArmed: true,
  });
  assert.match(armedHtml, /Confirm clear/);
  assert.match(armedHtml, /data-action="clear-draft-proof-data"/);
  assert.match(armedHtml, /data-action="cancel-clear-draft-proof-data"/);

  assert.equal(shouldCloseDraftProofSettingsWindowForClick(createClosestTarget([
    ".draft-proof-settings-window",
  ])), false);
  assert.equal(shouldCloseDraftProofSettingsWindowForClick(createClosestTarget([
    ".draft-proof-panel",
  ])), false);
  assert.equal(shouldCloseDraftProofSettingsWindowForClick(createClosestTarget([
    '[data-action="open-proof-read-settings"]',
  ])), false);
  assert.equal(shouldCloseDraftProofSettingsWindowForClick(createClosestTarget([])), true);
  assert.equal(shouldCloseDraftProofSettingsWindowForClick(null), false);
}

// Intent: exercise click-away decisions without requiring a browser DOM in the Node harness.
function createClosestTarget(matchingSelectors = []) {
  const selectorSet = new Set(matchingSelectors);
  return {
    closest(selector) {
      return selectorSet.has(selector) ? this : null;
    },
  };
}
