// Intent: verify historical proof-read projections exist only inside the explicit review session.
import assert from "node:assert/strict";

import {
  buildDraftProofHistoryCompareModel,
  clearDraftProofHistoryReview,
  createDefaultDraftProofHistoryReviewState,
  createDraftProofHistoryProjections,
  planDraftProofHistorySceneMutation,
  selectDraftProofHistoryReviewRun,
  setDraftProofHistoryPreflightResult,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-history-controller.js";

export function runDraftProofingHistoryControllerTest() {
  const draftProofing = {
    schemaVersion: 2,
    activeRunId: "",
    runs: [{
      id: "draft-proof-run-0001",
      label: "Proofread 1",
      iterationNumber: 1,
      status: "completed",
      changeHistoryAvailable: true,
      changes: [{
        changeId: "change-1",
        runId: "draft-proof-run-0001",
        iterationNumber: 1,
        sequence: 1,
        sceneId: "scene-1",
        beforeText: "still",
        afterText: "silent",
        state: "applied",
        anchor: { sceneId: "scene-1", startOffset: 4, endOffset: 10 },
        lineage: [{
          earlierChangeId: "change-1",
          laterChangeId: "change-2",
          earlierRunId: "draft-proof-run-0001",
          laterRunId: "draft-proof-run-0002",
          relation: "replaces",
        }],
      }],
    }, {
      id: "draft-proof-run-0002",
      label: "Proofread 2",
      iterationNumber: 2,
      status: "completed",
      changeHistoryAvailable: true,
      changes: [{
        changeId: "change-2",
        runId: "draft-proof-run-0002",
        iterationNumber: 2,
        sequence: 1,
        sceneId: "scene-1",
        beforeText: "silent",
        afterText: "glass-smooth",
        state: "applied",
        anchor: { sceneId: "scene-1", startOffset: 4, endOffset: 16 },
        lineage: [],
      }],
    }],
  };
  const selected = selectDraftProofHistoryReviewRun(createDefaultDraftProofHistoryReviewState(), {
    draftProofing,
    runId: "draft-proof-run-0001",
  });
  assert.equal(selected.reviewRunId, "draft-proof-run-0001");
  const common = {
    draftProofing,
    reviewState: selected,
    sceneId: "scene-1",
    textLength: 20,
  };
  assert.deepEqual(createDraftProofHistoryProjections({ ...common, settingsOpen: false, activePane: "manuscript" }), []);
  assert.deepEqual(createDraftProofHistoryProjections({ ...common, settingsOpen: true, activePane: "world" }), []);
  const projections = createDraftProofHistoryProjections({ ...common, settingsOpen: true, activePane: "manuscript" });
  assert.equal(projections.length, 1);
  assert.equal(projections[0].styleToken, "changed-later");
  assert.equal(projections[0].persistence, "transient-derived");
  assert.equal(projections[0].sourceRef.recordId, "change-1");

  const switched = selectDraftProofHistoryReviewRun(selected, {
    draftProofing,
    runId: "draft-proof-run-0002",
  });
  const switchedProjections = createDraftProofHistoryProjections({
    ...common,
    reviewState: switched,
    settingsOpen: true,
    activePane: "manuscript",
  });
  assert.equal(switchedProjections.length, 1);
  assert.equal(switchedProjections[0].sourceRef.recordId, "change-2");
  assert.equal(switchedProjections.some((projection) => projection.sourceRef.recordId === "change-1"), false);

  const conflictState = setDraftProofHistoryPreflightResult(selected, {
    safe: false,
    changeId: "change-1",
  });
  const conflicts = createDraftProofHistoryProjections({
    ...common,
    reviewState: conflictState,
    settingsOpen: true,
    activePane: "manuscript",
  });
  assert.equal(conflicts[0].styleToken, "conflict");
  assert.deepEqual(createDraftProofHistoryProjections({
    ...common,
    reviewState: clearDraftProofHistoryReview(),
    settingsOpen: true,
    activePane: "manuscript",
  }), []);

  const compare = buildDraftProofHistoryCompareModel({
    draftProofing,
    runId: "draft-proof-run-0001",
    changeId: "change-1",
  });
  assert.equal(compare.beforeText, "still");
  assert.equal(compare.afterText, "silent");
  assert.deepEqual(compare.lineage.map((item) => item.runId), ["draft-proof-run-0002"]);

  const replayPlan = planDraftProofHistorySceneMutation({
    preflight: {
      safe: true,
      startOffset: 4,
      endOffset: 10,
      expectedText: "silent",
      replacementText: "still",
    },
    scene: {
      sceneId: "scene-1",
      chapterId: "chapter-1",
      editorText: "The silent sea.",
    },
    sourceBlocks: [{ blockId: "block-1", sceneId: "scene-1", text: "The silent sea." }],
    inlineFormatRanges: [{ id: "italic-1", formatId: "italic", startOffset: 0, endOffset: 3 }],
  });
  assert.equal(replayPlan.nextText, "The still sea.");
  assert.equal(replayPlan.nextBlocks[0].text, "The still sea.");
  assert.equal(replayPlan.inlineFormatRanges[0].endOffset, 3);
}
