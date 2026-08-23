// Intent: verify top-panel card visibility context-menu routing stays in the feature slice.
import assert from "node:assert/strict";

import {
  getTopPanelCustomizationContextFromContextMenuTarget,
} from "../apps/editor/public/features/top-panel-customization/top-panel-customization.js";

export function runTopPanelCustomizationTest() {
  const cardTarget = createClosestTarget({
    regionGroupId: "target-strip",
    cardId: "wordTarget",
  });
  assert.deepEqual(
    getTopPanelCustomizationContextFromContextMenuTarget(cardTarget),
    { groupId: "target-strip" },
  );

  const statusRegionTarget = createClosestTarget({
    regionGroupId: "chrome-stats",
  });
  assert.deepEqual(
    getTopPanelCustomizationContextFromContextMenuTarget(statusRegionTarget),
    { groupId: "chrome-stats" },
  );

  const restoreTarget = createClosestTarget({
    regionGroupId: "target-strip",
    restoreGroupId: "target-strip",
  });
  assert.deepEqual(
    getTopPanelCustomizationContextFromContextMenuTarget(restoreTarget),
    { groupId: "target-strip" },
  );

  const controlTarget = createClosestTarget({
    regionGroupId: "target-strip",
    isControl: true,
  });
  assert.equal(getTopPanelCustomizationContextFromContextMenuTarget(controlTarget), null);

  const popoverTarget = createClosestTarget({
    regionGroupId: "target-strip",
    insidePopover: true,
  });
  assert.equal(getTopPanelCustomizationContextFromContextMenuTarget(popoverTarget), null);

  assert.equal(getTopPanelCustomizationContextFromContextMenuTarget(null), null);
}

function createClosestTarget({
  regionGroupId = "",
  restoreGroupId = "",
  cardId = "",
  isControl = false,
  insidePopover = false,
} = {}) {
  const region = regionGroupId
    ? { dataset: { topPanelCustomizationRegion: regionGroupId } }
    : null;
  const restore = restoreGroupId
    ? { dataset: { topPanelRestoreTarget: restoreGroupId } }
    : null;
  const card = cardId
    ? { dataset: { topPanelCard: cardId } }
    : null;
  const control = isControl ? { dataset: { action: "hide-top-panel-card" } } : null;
  const popover = insidePopover ? { dataset: { topPanelCustomization: "" } } : null;

  return {
    closest(selector) {
      if (selector === "[data-top-panel-customization-region]") {
        return region;
      }
      if (selector === "[data-top-panel-customization]") {
        return popover;
      }
      if (selector === "[data-top-panel-restore-target]") {
        return restore;
      }
      if (selector.includes("[data-top-panel-card]")) {
        return card;
      }
      if (selector === "button, input, textarea, select, a, [role='button'], [data-action]") {
        return control;
      }
      return null;
    },
  };
}
