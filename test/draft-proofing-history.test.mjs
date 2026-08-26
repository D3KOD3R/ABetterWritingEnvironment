// Intent: verify durable proof-read history remains logical, attributable, and safe to reverse.
import assert from "node:assert/strict";

import {
  DRAFT_PROOFING_SCHEMA_VERSION,
  completeDraftProofRun,
  executeDraftProofChangeReversal,
  executeDraftProofRunReversal,
  normalizeDraftProofingState,
  pauseDraftProofRun,
  planDraftProofRunReversal,
  preflightDraftProofChangeReversal,
  startNewDraftProofRun,
  startOrResumeDraftProofRun,
  updateDraftProofCoverageForTextEdit,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";

export function runDraftProofingHistoryTest() {
  const legacy = normalizeDraftProofingState({
    schemaVersion: 1,
    activeRunId: "",
    runs: [{
      id: "draft-proof-run-0003",
      iterationNumber: 3,
      status: "completed",
      startedAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
      completedAt: "2026-07-02T00:00:00.000Z",
      resumePoint: { sceneId: "scene-1", startOffset: 4, endOffset: 8 },
      coverageByScene: { "scene-1": [{ startOffset: 0, endOffset: 12 }] },
      settings: { backdropColor: "#123456" },
    }],
  });
  assert.equal(legacy.schemaVersion, DRAFT_PROOFING_SCHEMA_VERSION);
  assert.equal(legacy.runs[0].id, "draft-proof-run-0003");
  assert.equal(legacy.runs[0].iterationNumber, 3);
  assert.equal(legacy.runs[0].completedAt, "2026-07-02T00:00:00.000Z");
  assert.deepEqual(legacy.runs[0].resumePoint, {
    sceneId: "scene-1",
    startOffset: 4,
    endOffset: 8,
    updatedAt: "",
  });
  assert.equal(legacy.runs[0].coverageByScene["scene-1"][0].endOffset, 12);
  assert.equal(legacy.runs[0].settings.backdropColor, "#123456");
  assert.equal(legacy.runs[0].changeHistoryAvailable, false);
  assert.equal(legacy.runs[0].changeSummary, null);

  let state = startNewDraftProofRun(undefined, { now: "2026-08-26T01:00:00.000Z" }).state;
  assert.equal(state.runs[0].changeHistoryAvailable, true);
  assert.deepEqual(state.runs[0].changes, []);

  const noOp = updateDraftProofCoverageForTextEdit(state, {
    sceneId: "scene-1",
    previousText: "The sea was still.",
    nextText: "The sea was still.",
  });
  assert.equal(noOp.changed, false);
  assert.equal(noOp.reason, "no-text-edit");

  const firstTyping = updateDraftProofCoverageForTextEdit(state, {
    sceneId: "scene-1",
    previousText: "The sea was still.",
    nextText: "The blue sea was still.",
    selectionStart: 8,
    selectionEnd: 8,
    now: "2026-08-26T01:00:01.000Z",
  });
  const secondTyping = updateDraftProofCoverageForTextEdit(firstTyping.state, {
    sceneId: "scene-1",
    previousText: "The blue sea was still.",
    nextText: "The blue-green sea was still.",
    selectionStart: 14,
    selectionEnd: 14,
    now: "2026-08-26T01:00:01.500Z",
  });
  assert.equal(secondTyping.changed, true);
  assert.equal(secondTyping.run.changes.length, 1);
  assert.equal(secondTyping.run.changes[0].beforeText, "");
  assert.equal(secondTyping.run.changes[0].afterText, " blue-green");
  assert.equal(secondTyping.run.changes[0].changeType, "insertion");
  assert.equal(secondTyping.run.changeSummary.logicalChangeCount, 1);
  assert.equal(secondTyping.run.changeSummary.wordsAdded, 1);
  assert.equal(secondTyping.run.changeSummary.wordsChanged, 1);
  assert.equal(secondTyping.run.changeSummary.netWordDelta, 1);

  let boundaryState = startNewDraftProofRun(undefined, { now: "2026-08-26T01:10:00.000Z" }).state;
  boundaryState = updateDraftProofCoverageForTextEdit(boundaryState, {
    sceneId: "scene-boundary",
    previousText: "Sea",
    nextText: "Seas",
    now: "2026-08-26T01:10:00.100Z",
  }).state;
  boundaryState = pauseDraftProofRun(boundaryState, { now: "2026-08-26T01:10:00.200Z" }).state;
  boundaryState = startOrResumeDraftProofRun(boundaryState, { now: "2026-08-26T01:10:00.300Z" }).state;
  boundaryState = updateDraftProofCoverageForTextEdit(boundaryState, {
    sceneId: "scene-boundary",
    previousText: "Seas",
    nextText: "Seaside",
    now: "2026-08-26T01:10:00.400Z",
  }).state;
  assert.equal(boundaryState.runs[0].changes.length, 2);

  const separateTyping = updateDraftProofCoverageForTextEdit(secondTyping.state, {
    sceneId: "scene-1",
    previousText: "The blue-green sea was still.",
    nextText: "The blue-green sea lay still.",
    now: "2026-08-26T01:00:04.000Z",
  });
  assert.equal(separateTyping.run.changes.length, 2);
  assert.equal(separateTyping.run.changes[1].beforeText, "was");
  assert.equal(separateTyping.run.changes[1].afterText, "lay");
  assert.equal(separateTyping.run.changes[1].wordsChanged, 1);

  const reloaded = normalizeDraftProofingState(JSON.parse(JSON.stringify(separateTyping.state)));
  assert.equal(reloaded.runs[0].changeHistoryAvailable, true);
  assert.equal(reloaded.runs[0].changes.length, 2);
  assert.equal(reloaded.runs[0].changes[1].beforeHash, separateTyping.run.changes[1].beforeHash);

  const runOneCompleted = completeDraftProofRun(separateTyping.state, {
    now: "2026-08-26T01:01:00.000Z",
  }).state;
  const runTwoStarted = startNewDraftProofRun(runOneCompleted, {
    now: "2026-08-26T02:00:00.000Z",
  }).state;
  const runTwoEdit = updateDraftProofCoverageForTextEdit(runTwoStarted, {
    sceneId: "scene-1",
    previousText: "The blue-green sea lay still.",
    nextText: "The blue-green sea rested glass-smooth.",
    now: "2026-08-26T02:00:02.000Z",
  });
  const earlierReplacement = runTwoEdit.state.runs[0].changes[1];
  assert.equal(earlierReplacement.lineage.length, 1);
  assert.equal(earlierReplacement.lineage[0].laterRunId, "draft-proof-run-0002");

  const runTwoCompleted = completeDraftProofRun(runTwoEdit.state, {
    now: "2026-08-26T02:01:00.000Z",
  }).state;
  const runThreeStarted = startNewDraftProofRun(runTwoCompleted, {
    now: "2026-08-26T03:00:00.000Z",
  }).state;
  const runThreeEdit = updateDraftProofCoverageForTextEdit(runThreeStarted, {
    sceneId: "scene-1",
    previousText: "The blue-green sea rested glass-smooth.",
    nextText: "The blue-green sea shone glass-smooth.",
    now: "2026-08-26T03:00:02.000Z",
  });
  assert.equal(runThreeEdit.state.runs[1].changes[0].lineage.length, 1);
  assert.equal(runThreeEdit.state.runs[1].changes[0].lineage[0].laterRunId, "draft-proof-run-0003");

  const unsafeLaterPreflight = preflightDraftProofChangeReversal(runThreeEdit.state, {
    runId: "draft-proof-run-0001",
    changeId: earlierReplacement.changeId,
    action: "undo",
    sceneTexts: { "scene-1": "The blue-green sea shone glass-smooth." },
  });
  assert.equal(unsafeLaterPreflight.safe, false);
  assert.equal(unsafeLaterPreflight.reason, "changed-by-later-proofread");
  assert.deepEqual(unsafeLaterPreflight.provenance.map((item) => item.run.id), [
    "draft-proof-run-0002",
    "draft-proof-run-0003",
  ]);

  const standalone = createTwoChangeRun();
  const secondChange = standalone.state.runs[0].changes[1];
  const safeUndo = executeDraftProofChangeReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    changeId: secondChange.changeId,
    action: "undo",
    sceneTexts: { "scene-undo": standalone.text },
    now: "2026-08-26T04:01:00.000Z",
  });
  assert.equal(safeUndo.changed, true);
  assert.equal(safeUndo.sceneTexts["scene-undo"], "Bright moon above water.");
  assert.equal(safeUndo.state.runs[0].changes[1].state, "reverted");
  assert.equal(safeUndo.transaction.origin, "proofread-history-replay");
  assert.equal(safeUndo.transaction.sourceRunId, standalone.state.runs[0].id);
  assert.equal(safeUndo.transaction.sourceChangeId, secondChange.changeId);
  const safeRedo = executeDraftProofChangeReversal(safeUndo.state, {
    runId: safeUndo.state.runs[0].id,
    changeId: secondChange.changeId,
    action: "redo",
    sceneTexts: safeUndo.sceneTexts,
    now: "2026-08-26T04:02:00.000Z",
  });
  assert.equal(safeRedo.changed, true);
  assert.equal(safeRedo.sceneTexts["scene-undo"], standalone.text);
  assert.equal(safeRedo.state.runs[0].changes[1].state, "applied");

  const ordinaryEdit = updateDraftProofCoverageForTextEdit(
    completeDraftProofRun(standalone.state, { now: "2026-08-26T04:03:00.000Z" }).state,
    {
      sceneId: "scene-undo",
      previousText: standalone.text,
      nextText: "Bright moon above restless water.",
      now: "2026-08-26T04:04:00.000Z",
    },
  );
  const outsideConflict = preflightDraftProofChangeReversal(ordinaryEdit.state, {
    runId: ordinaryEdit.state.runs[0].id,
    changeId: secondChange.changeId,
    action: "undo",
    sceneTexts: { "scene-undo": "Bright moon above restless water." },
  });
  assert.equal(outsideConflict.safe, false);
  assert.equal(outsideConflict.reason, "manuscript-changed");
  assert.deepEqual(outsideConflict.provenance, []);
  assert.equal(preflightDraftProofChangeReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    changeId: secondChange.changeId,
    action: "undo",
    sceneTexts: {},
  }).unresolved, true);

  const runPlan = planDraftProofRunReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    action: "undo",
    sceneTexts: { "scene-undo": standalone.text },
  });
  assert.deepEqual(runPlan.safeOperations.map((operation) => operation.sequence), [2, 1]);
  const runUndo = executeDraftProofRunReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    action: "undo",
    sceneTexts: { "scene-undo": standalone.text },
    now: "2026-08-26T04:05:00.000Z",
  });
  assert.deepEqual(runUndo.applied.map((operation) => operation.sequence), [2, 1]);
  assert.equal(runUndo.sceneTexts["scene-undo"], "Moon above water.");
  const runRedo = executeDraftProofRunReversal(runUndo.state, {
    runId: standalone.state.runs[0].id,
    action: "redo",
    sceneTexts: runUndo.sceneTexts,
    now: "2026-08-26T04:06:00.000Z",
  });
  assert.deepEqual(runRedo.applied.map((operation) => operation.sequence), [1, 2]);
  assert.equal(runRedo.sceneTexts["scene-undo"], standalone.text);

  const safeSubsetText = "Bright moon above restless water.";
  const safeSubset = planDraftProofRunReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    action: "undo",
    sceneTexts: { "scene-undo": safeSubsetText },
  });
  assert.equal(safeSubset.summary.safeCount, 1);
  assert.equal(safeSubset.summary.changedOutsideProofreadCount, 1);
  const subsetUndo = executeDraftProofRunReversal(standalone.state, {
    runId: standalone.state.runs[0].id,
    action: "undo",
    sceneTexts: { "scene-undo": safeSubsetText },
  });
  assert.equal(subsetUndo.applied.length, 1);
  assert.equal(subsetUndo.skipped.length, 1);

  const priorCompleted = completeDraftProofRun(standalone.state, {
    now: "2026-08-26T04:10:00.000Z",
  }).state;
  const activeSecondRun = startNewDraftProofRun(priorCompleted, {
    now: "2026-08-26T04:11:00.000Z",
  }).state;
  const replaySuppressed = executeDraftProofChangeReversal(activeSecondRun, {
    runId: "draft-proof-run-0001",
    changeId: activeSecondRun.runs[0].changes[1].changeId,
    action: "undo",
    sceneTexts: { "scene-undo": standalone.text },
  });
  assert.equal(replaySuppressed.changed, true);
  assert.equal(replaySuppressed.state.runs[1].changes.length, 0);
}

function createTwoChangeRun() {
  let state = startNewDraftProofRun(undefined, { now: "2026-08-26T04:00:00.000Z" }).state;
  let text = "Moon above water.";
  const firstText = "Bright moon above water.";
  state = updateDraftProofCoverageForTextEdit(state, {
    sceneId: "scene-undo",
    previousText: text,
    nextText: firstText,
    now: "2026-08-26T04:00:01.000Z",
  }).state;
  text = firstText;
  const secondText = "Bright moon above calm water.";
  state = updateDraftProofCoverageForTextEdit(state, {
    sceneId: "scene-undo",
    previousText: text,
    nextText: secondText,
    now: "2026-08-26T04:00:04.000Z",
  }).state;
  return { state, text: secondText };
}
