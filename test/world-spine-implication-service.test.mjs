// Intent: verify manual World Spine implication edges persist as structured world graph records.
import assert from "node:assert/strict";

import {
  WORLD_SPINE_IMPLICATION_EDGE_KIND,
  applyWorldSpineImplicationEdgeToWorld,
  deleteWorldSpineImplicationEdgeFromWorld,
  normalizeWorldSpineEdges,
  normalizeWorldSpineImplicationText,
  updateWorldSpineImplicationEdgeInWorld,
} from "../apps/editor/public/features/world-spine/world-spine-implication-service.js";

export function runWorldSpineImplicationServiceTest() {
  const world = {
    title: "Story Timeline",
    edges: [
      {
        id: "edge-0004",
        from: "scene:scene-1",
        to: "event:event-1",
        effect: "  Reveals the mission risk.  ",
        kind: "causes",
      },
    ],
    stats: {
      nodeCount: 2,
    },
  };

  const normalizedEdges = normalizeWorldSpineEdges(world.edges);
  assert.equal(normalizedEdges[0].fromNodeId, "scene:scene-1");
  assert.equal(normalizedEdges[0].toNodeId, "event:event-1");
  assert.equal(normalizedEdges[0].label, "Reveals the mission risk.");

  const missingEffect = applyWorldSpineImplicationEdgeToWorld(world, {
    fromNodeId: "scene:scene-1",
    toNodeId: "event:event-1",
    effect: "   ",
  }, "2026-07-20T08:00:00.000Z");
  assert.equal(missingEffect.edge, null);
  assert.equal(missingEffect.reason, "missing-effect");
  assert.equal(missingEffect.world.edges.length, 1);

  const result = applyWorldSpineImplicationEdgeToWorld(world, {
    fromNodeId: "event:event-1",
    toNodeId: "scene:scene-2",
    effect: "The reveal forces the briefing to change.",
  }, "2026-07-20T08:01:00.000Z");

  assert.equal(result.reason, "created");
  assert.equal(result.edge.id, "edge-0005");
  assert.equal(result.edge.kind, WORLD_SPINE_IMPLICATION_EDGE_KIND);
  assert.equal(result.edge.source, "manual");
  assert.equal(result.edge.label, "The reveal forces the briefing to change.");
  assert.equal(result.world.edges.length, 2);
  assert.equal(result.world.stats.edgeCount, 2);
  assert.equal(result.world.updatedAt, "2026-07-20T08:01:00.000Z");
  assert.equal(world.edges.length, 1);

  const updated = updateWorldSpineImplicationEdgeInWorld(result.world, {
    edgeId: "edge-0005",
    effect: "The briefing changes again.",
  }, "2026-07-20T08:01:30.000Z");
  assert.equal(updated.reason, "updated");
  assert.equal(updated.edge.id, "edge-0005");
  assert.equal(updated.edge.fromNodeId, "event:event-1");
  assert.equal(updated.edge.toNodeId, "scene:scene-2");
  assert.equal(updated.edge.label, "The briefing changes again.");
  assert.equal(updated.world.edges.length, 2);
  assert.equal(updated.world.stats.edgeCount, 2);
  assert.equal(updated.world.updatedAt, "2026-07-20T08:01:30.000Z");

  const missingUpdate = updateWorldSpineImplicationEdgeInWorld(result.world, {
    edgeId: "edge-missing",
    effect: "No edge changes.",
  }, "2026-07-20T08:01:45.000Z");
  assert.equal(missingUpdate.reason, "edge-not-found");
  assert.equal(missingUpdate.edge, null);
  assert.equal(missingUpdate.world.edges.length, 2);

  const deleted = deleteWorldSpineImplicationEdgeFromWorld(updated.world, "edge-0005", "2026-07-20T08:02:00.000Z");
  assert.equal(deleted.reason, "deleted");
  assert.equal(deleted.edge.label, "The briefing changes again.");
  assert.equal(deleted.world.edges.length, 1);
  assert.equal(deleted.world.stats.edgeCount, 1);
  assert.equal(deleted.world.updatedAt, "2026-07-20T08:02:00.000Z");

  const missingDelete = deleteWorldSpineImplicationEdgeFromWorld(result.world, "edge-missing", "2026-07-20T08:03:00.000Z");
  assert.equal(missingDelete.reason, "edge-not-found");
  assert.equal(missingDelete.edge, null);
  assert.equal(missingDelete.world.edges.length, 2);

  assert.equal(
    normalizeWorldSpineImplicationText("First line\nsecond line"),
    "First line second line",
  );
}
