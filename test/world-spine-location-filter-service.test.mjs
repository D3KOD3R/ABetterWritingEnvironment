// Intent: verify World Spine location filtering stays render-only and keyed by timeline locations.
import assert from "node:assert/strict";

import {
  buildWorldSpineLocationFilterModel,
  clearWorldSpineLocationFilterSelection,
  createDefaultWorldSpineLocationFilterState,
  resolveWorldSpineConnectionFilterClass,
  resolveWorldSpineLocationFilterClass,
  updateWorldSpineLocationFilterSelection,
} from "../apps/editor/public/features/world-spine/world-spine-location-filter-service.js";

export function runWorldSpineLocationFilterServiceTest() {
  const timeline = {
    locationRows: [
      { locationKey: "ceres-dock", locationLabel: "Ceres Dock", label: "Ceres Dock", spineLabel: "Main", locationRowIndex: 0 },
      { locationKey: "oasis", locationLabel: "Oasis", label: "Oasis", spineLabel: "Oasis Surface", locationRowIndex: 1 },
      { locationKey: "europa", locationLabel: "Europa", label: "Europa", spineLabel: "Europa Orbit", locationRowIndex: 2 },
    ],
    primaryNodes: [
      { id: "node-ceres", locationKey: "ceres-dock", locationLabel: "Ceres Dock" },
      { id: "node-oasis", locationKey: "oasis", locationLabel: "Oasis" },
      { id: "node-europa", locationKey: "europa", locationLabel: "Europa" },
    ],
  };

  const defaultFilter = buildWorldSpineLocationFilterModel(
    timeline,
    createDefaultWorldSpineLocationFilterState(),
  );
  assert.equal(defaultFilter.active, false);
  assert.equal(defaultFilter.summaryLabel, "All locations");
  assert.deepEqual(defaultFilter.options.map((option) => option.checked), [true, true, true]);

  const oasisOnly = buildWorldSpineLocationFilterModel(timeline, {
    selectedLocationKeys: ["oasis"],
  });
  assert.equal(oasisOnly.active, true);
  assert.equal(oasisOnly.singleLocationKey, "oasis");
  assert.equal(oasisOnly.summaryLabel, "Oasis");
  assert.equal(resolveWorldSpineLocationFilterClass(oasisOnly, "Oasis"), "is-filter-target");
  assert.equal(resolveWorldSpineLocationFilterClass(oasisOnly, "Europa"), "is-filtered-out");

  const nodesById = new Map(timeline.primaryNodes.map((node) => [node.id, node]));
  assert.equal(
    resolveWorldSpineConnectionFilterClass(
      { kind: "implication", fromNodeId: "node-oasis", toNodeId: "node-europa" },
      { filterModel: oasisOnly, nodesById },
    ),
    "is-filter-bridge",
  );
  assert.equal(
    resolveWorldSpineConnectionFilterClass(
      { kind: "child", fromNodeId: "node-ceres", toNodeId: "node-europa" },
      { filterModel: oasisOnly, nodesById },
    ),
    "is-filtered-out",
  );

  const withoutEuropa = updateWorldSpineLocationFilterSelection({
    timeline,
    filterState: createDefaultWorldSpineLocationFilterState(),
    locationKey: "europa",
    checked: false,
  });
  assert.deepEqual(withoutEuropa.selectedLocationKeys, ["ceres-dock", "oasis"]);

  const cleared = clearWorldSpineLocationFilterSelection();
  assert.deepEqual(cleared.selectedLocationKeys, []);
}
