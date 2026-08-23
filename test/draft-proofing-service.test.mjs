// Intent: verify draft proof-read runs track simple expanding manuscript coverage.
import assert from "node:assert/strict";

import {
  DRAFT_PROOF_BACKDROP_COLOR_DEFAULT,
  DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS,
  DRAFT_PROOF_RUN_STATUS,
  addDraftProofCoverageRange,
  addRecentDraftProofBackdropColor,
  clearDraftProofRunData,
  completeDraftProofRun,
  continueDraftProofRun,
  createDefaultDraftProofingState,
  createDraftProofCoverageProjections,
  deleteDraftProofRuns,
  getDraftProofSettingsForRun,
  normalizeDraftProofBackdropColor,
  normalizeDraftProofRecentBackdropColors,
  pauseDraftProofRun,
  pruneDraftProofCoverageForScenes,
  removeDraftProofCoverageRange,
  resolveDraftProofSettingsRunId,
  startNewDraftProofRun,
  startOrResumeDraftProofRun,
  updateDraftProofRunSettings,
  updateDraftProofSettings,
  updateDraftProofCoverageForTextEdit,
} from "../apps/editor/public/features/draft-proofing/draft-proofing-service.js";

export function runDraftProofingServiceTest() {
  const defaultState = createDefaultDraftProofingState();
  assert.equal(defaultState.settings.backdropColor, DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
  assert.deepEqual(defaultState.settings.backdropColorPresets, DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS);
  assert.deepEqual(defaultState.settings.recentBackdropColors, []);
  assert.deepEqual(defaultState.settings.highlightIntensityByTheme, { light: 42, dark: 100 });
  assert.equal(normalizeDraftProofBackdropColor("#abc"), "#aabbcc");
  assert.equal(normalizeDraftProofBackdropColor("not-a-colour"), DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
  assert.deepEqual(
    normalizeDraftProofRecentBackdropColors(["#abc", "#aabbcc", "not-a-colour", "#123456", "#456", "#789abc", "#fedcba"]),
    ["#aabbcc", "#123456", "#445566", "#789abc", "#fedcba"],
  );
  assert.deepEqual(
    addRecentDraftProofBackdropColor(["#111111", "#222222", "#333333", "#444444", "#555555"], "#333"),
    ["#333333", "#111111", "#222222", "#444444", "#555555"],
  );

  const started = startOrResumeDraftProofRun(defaultState, {
    now: "2026-07-15T01:00:00.000Z",
  });
  assert.equal(started.changed, true);
  assert.equal(started.run.id, "draft-proof-run-0001");
  assert.equal(started.run.label, "Draft proof 1");
  assert.equal(started.run.status, DRAFT_PROOF_RUN_STATUS.ACTIVE);
  assert.equal(started.state.activeRunId, started.run.id);
  assert.equal(started.run.settings.backdropColor, DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
  assert.deepEqual(started.run.settings.highlightIntensityByTheme, { light: 42, dark: 100 });
  assert.equal(resolveDraftProofSettingsRunId(started.state), started.run.id);
  assert.equal(getDraftProofSettingsForRun(started.state, started.run.id).settings.backdropColor, DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);

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

  const erasedSelection = removeDraftProofCoverageRange(editOutside.state, {
    sceneId: "scene-1",
    startOffset: 4,
    endOffset: 10,
    textLength: 30,
    now: "2026-07-15T01:04:30.000Z",
  });
  assert.equal(erasedSelection.changed, true);
  assert.deepEqual(
    erasedSelection.run.coverageByScene["scene-1"].map((span) => [span.startOffset, span.endOffset]),
    [[0, 4], [10, 19], [25, 30]],
  );

  const restoredSelection = addDraftProofCoverageRange(erasedSelection.state, {
    sceneId: "scene-1",
    startOffset: 4,
    endOffset: 10,
    textLength: 30,
    now: "2026-07-15T01:04:45.000Z",
  });
  assert.deepEqual(
    restoredSelection.run.coverageByScene["scene-1"].map((span) => [span.startOffset, span.endOffset]),
    [[0, 19], [25, 30]],
  );

  const projections = createDraftProofCoverageProjections({
    draftProofing: restoredSelection.state,
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
  assert.equal(projections[0].visualStyle.backdropColor, DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
  assert.deepEqual(projections[0].visualStyle.highlightIntensityByTheme, { light: 42, dark: 100 });

  const paused = pauseDraftProofRun(restoredSelection.state, {
    now: "2026-07-15T01:05:00.000Z",
    resumePoint: {
      sceneId: "scene-1",
      startOffset: 18,
      endOffset: 19,
      updatedAt: "2026-07-15T01:05:00.000Z",
    },
  });
  assert.equal(paused.changed, true);
  assert.equal(paused.state.activeRunId, "");
  assert.equal(paused.run.status, DRAFT_PROOF_RUN_STATUS.PAUSED);
  assert.deepEqual(paused.run.resumePoint, {
    sceneId: "scene-1",
    startOffset: 18,
    endOffset: 19,
    updatedAt: "2026-07-15T01:05:00.000Z",
  });

  const explicitNewRun = startNewDraftProofRun(paused.state, {
    now: "2026-07-15T01:05:30.000Z",
  });
  assert.equal(explicitNewRun.changed, true);
  assert.equal(explicitNewRun.reason, "created-run");
  assert.equal(explicitNewRun.run.id, "draft-proof-run-0002");
  assert.equal(explicitNewRun.state.activeRunId, "draft-proof-run-0002");
  assert.equal(explicitNewRun.state.runs.find((run) => run.id === "draft-proof-run-0001").status, DRAFT_PROOF_RUN_STATUS.PAUSED);

  const deletedPausedRun = deleteDraftProofRuns(explicitNewRun.state, {
    runIds: ["draft-proof-run-0001"],
  });
  assert.equal(deletedPausedRun.changed, true);
  assert.equal(deletedPausedRun.reason, "runs-deleted");
  assert.deepEqual(deletedPausedRun.deletedRunIds, ["draft-proof-run-0001"]);
  assert.equal(deletedPausedRun.state.activeRunId, "draft-proof-run-0002");
  assert.deepEqual(deletedPausedRun.state.runs.map((run) => run.id), ["draft-proof-run-0002"]);

  const deletedActiveRun = deleteDraftProofRuns(explicitNewRun.state, {
    runIds: ["draft-proof-run-0002"],
  });
  assert.equal(deletedActiveRun.changed, true);
  assert.equal(deletedActiveRun.state.activeRunId, "");
  assert.deepEqual(deletedActiveRun.state.runs.map((run) => run.id), ["draft-proof-run-0001"]);
  assert.equal(deleteDraftProofRuns(explicitNewRun.state, { runIds: [] }).reason, "missing-run-selection");

  const completedPausedRun = completeDraftProofRun(paused.state, {
    runId: paused.run.id,
    now: "2026-07-15T01:05:45.000Z",
  });
  assert.equal(completedPausedRun.changed, true);
  assert.equal(completedPausedRun.run.status, DRAFT_PROOF_RUN_STATUS.COMPLETED);
  assert.deepEqual(completedPausedRun.run.resumePoint, paused.run.resumePoint);

  const resumed = startOrResumeDraftProofRun(paused.state, {
    now: "2026-07-15T01:06:00.000Z",
  });
  assert.equal(resumed.reason, "resumed-run");
  assert.equal(resumed.state.activeRunId, "draft-proof-run-0001");
  assert.deepEqual(resumed.run.resumePoint, paused.run.resumePoint);

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

  const runSettingsUpdated = updateDraftProofRunSettings(completed.state, {
    runId: completed.run.id,
    settingsPatch: {
      backdropColor: "#123",
      highlightIntensityByTheme: {
        light: 75,
        dark: 55,
      },
      recentBackdropColors: ["#123"],
    },
  });
  assert.equal(runSettingsUpdated.changed, true);
  assert.equal(runSettingsUpdated.run.settings.backdropColor, "#112233");
  assert.deepEqual(runSettingsUpdated.run.settings.highlightIntensityByTheme, { light: 75, dark: 55 });
  assert.equal(runSettingsUpdated.state.settings.backdropColor, DRAFT_PROOF_BACKDROP_COLOR_DEFAULT);
  assert.deepEqual(runSettingsUpdated.run.settings.recentBackdropColors, ["#112233"]);
  assert.equal(getDraftProofSettingsForRun(runSettingsUpdated.state, completed.run.id).settings.backdropColor, "#112233");
  const runColourProjections = createDraftProofCoverageProjections({
    draftProofing: runSettingsUpdated.state,
    sceneId: "scene-1",
    textLength: 30,
    channel: "draft-proof",
  });
  assert.equal(runColourProjections[0].visualStyle.backdropColor, "#112233");
  assert.deepEqual(runColourProjections[0].visualStyle.highlightIntensityByTheme, { light: 75, dark: 55 });

  const continued = continueDraftProofRun(completed.state, {
    now: "2026-07-15T01:08:00.000Z",
  });
  assert.equal(continued.changed, true);
  assert.equal(continued.reason, "continued-run");
  assert.equal(continued.run.id, "draft-proof-run-0001");
  assert.equal(continued.run.status, DRAFT_PROOF_RUN_STATUS.ACTIVE);
  assert.equal(continued.run.completedAt, "");
  assert.equal(continued.state.activeRunId, "draft-proof-run-0001");
  assert.deepEqual(continued.run.resumePoint, completed.run.resumePoint);

  const settingsUpdated = updateDraftProofSettings(runSettingsUpdated.state, {
    backdropColor: "#abc",
    backdropColorPresets: ["#fed", "#123456", "not-a-colour", "#456", "#789abc"],
    highlightIntensityByTheme: {
      light: 150,
      dark: -10,
    },
    recentBackdropColors: ["#abc", "#123456", "#abc"],
  });
  assert.equal(settingsUpdated.changed, true);
  assert.equal(settingsUpdated.state.settings.backdropColor, "#aabbcc");
  assert.deepEqual(settingsUpdated.state.settings.backdropColorPresets, [
    "#ffeedd",
    "#123456",
    DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS[2],
    "#445566",
    "#789abc",
  ]);
  assert.deepEqual(settingsUpdated.state.settings.highlightIntensityByTheme, { light: 100, dark: 0 });
  assert.deepEqual(settingsUpdated.state.settings.recentBackdropColors, ["#aabbcc", "#123456"]);
  assert.equal(settingsUpdated.state.runs.length, 1);
  assert.equal(settingsUpdated.state.runs[0].settings.backdropColor, "#112233");

  const cleared = clearDraftProofRunData(settingsUpdated.state);
  assert.equal(cleared.changed, true);
  assert.equal(cleared.clearedRunCount, 1);
  assert.equal(cleared.state.activeRunId, "");
  assert.deepEqual(cleared.state.runs, []);
  assert.equal(cleared.state.settings.backdropColor, "#aabbcc");
  assert.deepEqual(cleared.state.settings.backdropColorPresets, settingsUpdated.state.settings.backdropColorPresets);
  assert.deepEqual(cleared.state.settings.recentBackdropColors, settingsUpdated.state.settings.recentBackdropColors);
}
