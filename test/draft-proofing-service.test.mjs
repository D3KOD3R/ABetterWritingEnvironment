// Intent: verify draft proof-read runs track simple expanding manuscript coverage.
import assert from "node:assert/strict";

import {
  DRAFT_PROOF_RUN_STATUS,
  addDraftProofCoverageRange,
  completeDraftProofRun,
  createDefaultDraftProofingState,
  createDraftProofCoverageProjections,
  pauseDraftProofRun,
  pruneDraftProofCoverageForScenes,
  startOrResumeDraftProofRun,
  updateDraftProofCoverageForTextEdit,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";

export function runDraftProofingServiceTest() {
  const started = startOrResumeDraftProofRun(createDefaultDraftProofingState(), {
    now: "2026-07-15T01:00:00.000Z",
  });
  assert.equal(started.changed, true);
  assert.equal(started.run.id, "draft-proof-run-0001");
  assert.equal(started.run.label, "Draft proof 1");
  assert.equal(started.run.status, DRAFT_PROOF_RUN_STATUS.ACTIVE);
  assert.equal(started.state.activeRunId, started.run.id);

  const covered = addDraftProofCoverageRange(started.state, {
    sceneId: "scene-1",
    startOffset: 0,
    endOffset: 5,
    textLength: 30,
    now: "2026-07-15T01:01:00.000Z",
  });
  const merged = addDraftProofCoverageRange(covered.state, {
    sceneId: "scene-1",
    startOffset: 5,
    endOffset: 12,
    textLength: 30,
    now: "2026-07-15T01:02:00.000Z",
  });
  assert.deepEqual(
    merged.run.coverageByScene["scene-1"].map((span) => [span.startOffset, span.endOffset]),
    [[0, 12]],
  );

  const editInside = updateDraftProofCoverageForTextEdit(merged.state, {
    sceneId: "scene-1",
    previousText: "Alpha target omega",
    nextText: "Alpha bright target omega",
    selectionStart: 13,
    selectionEnd: 13,
    now: "2026-07-15T01:03:00.000Z",
  });
  assert.equal(editInside.changed, true);
  assert.deepEqual(
    editInside.run.coverageByScene["scene-1"].map((span) => [span.startOffset, span.endOffset]),
    [[0, 19]],
  );

  const editOutside = updateDraftProofCoverageForTextEdit(editInside.state, {
    sceneId: "scene-1",
    previousText: "Alpha bright target omega",
    nextText: "Alpha bright target omega tail",
    selectionStart: 29,
    selectionEnd: 29,
    now: "2026-07-15T01:04:00.000Z",
  });
  assert.deepEqual(
    editOutside.run.coverageByScene["scene-1"].map((span) => [span.startOffset, span.endOffset]),
    [[0, 19], [25, 30]],
  );

  const projections = createDraftProofCoverageProjections({
    draftProofing: editOutside.state,
    sceneId: "scene-1",
    textLength: 30,
    channel: "draft-proof",
  });
  assert.equal(projections.length, 2);
  assert.equal(projections[0].channel, "draft-proof");
  assert.equal(projections[0].styleToken, "covered");
  assert.equal(projections[0].persistence, "derived-durable");
  assert.deepEqual(projections[0].sourceRef, {
    recordType: "draftProofRun",
    recordId: "draft-proof-run-0001",
  });

  const paused = pauseDraftProofRun(editOutside.state, {
    now: "2026-07-15T01:05:00.000Z",
  });
  assert.equal(paused.changed, true);
  assert.equal(paused.state.activeRunId, "");
  assert.equal(paused.run.status, DRAFT_PROOF_RUN_STATUS.PAUSED);

  const resumed = startOrResumeDraftProofRun(paused.state, {
    now: "2026-07-15T01:06:00.000Z",
  });
  assert.equal(resumed.reason, "resumed-run");
  assert.equal(resumed.state.activeRunId, "draft-proof-run-0001");

  const secondSceneCovered = addDraftProofCoverageRange(resumed.state, {
    sceneId: "scene-2",
    startOffset: 0,
    endOffset: 8,
    textLength: 20,
    now: "2026-07-15T01:06:30.000Z",
  });
  const pruned = pruneDraftProofCoverageForScenes(secondSceneCovered.state, {
    remainingSceneIds: new Set(["scene-1"]),
    now: "2026-07-15T01:06:45.000Z",
  });
  assert.equal(pruned.changed, true);
  assert.equal(pruned.state.runs[0].coverageByScene["scene-2"], undefined);

  const completed = completeDraftProofRun(pruned.state, {
    now: "2026-07-15T01:07:00.000Z",
  });
  assert.equal(completed.changed, true);
  assert.equal(completed.state.activeRunId, "");
  assert.equal(completed.run.status, DRAFT_PROOF_RUN_STATUS.COMPLETED);
  assert.equal(completed.run.completedAt, "2026-07-15T01:07:00.000Z");

  const completedProjections = createDraftProofCoverageProjections({
    draftProofing: completed.state,
    sceneId: "scene-1",
    textLength: 30,
    channel: "draft-proof",
  });
  assert.equal(completedProjections.length, 2);
  assert.equal(completedProjections[0].sourceRef.recordId, "draft-proof-run-0001");
}
