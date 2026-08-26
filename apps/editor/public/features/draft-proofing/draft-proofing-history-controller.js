// Intent: own transient proof-read history review policy without persisting render projections or UI selection.
import {
  DRAFT_PROOF_CHANGE_STATE,
  normalizeDraftProofingState,
  resolveDraftProofChangeLineage,
} from "./draft-proofing-service.js";
import {
  updateInlineFormatRangesForTextEdit,
} from "../manuscript-editor/manuscript-command-controller.js";
import {
  reconcileSceneBlocksWithEditorText,
  updateSceneBlocksForTextEdit,
} from "../manuscript-editor/manuscript-block-text-service.js";

export const DRAFT_PROOF_HISTORY_FILTERS = Object.freeze([
  "all",
  "applied",
  "reverted",
  "changed-later",
  "conflicts",
]);

export function createDefaultDraftProofHistoryReviewState() {
  return {
    reviewRunId: "",
    selectedChangeId: "",
    filter: "all",
    conflictChangeIds: [],
    preflightResult: null,
    statusMessage: "",
  };
}

export function normalizeDraftProofHistoryReviewState(candidate) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
  const filter = DRAFT_PROOF_HISTORY_FILTERS.includes(source.filter) ? source.filter : "all";
  return {
    reviewRunId: String(source.reviewRunId ?? "").trim(),
    selectedChangeId: String(source.selectedChangeId ?? "").trim(),
    filter,
    conflictChangeIds: [...new Set((Array.isArray(source.conflictChangeIds) ? source.conflictChangeIds : [])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean))],
    preflightResult: source.preflightResult && typeof source.preflightResult === "object"
      ? { ...source.preflightResult }
      : null,
    statusMessage: String(source.statusMessage ?? ""),
  };
}

export function selectDraftProofHistoryReviewRun(reviewState, {
  draftProofing = null,
  runId = "",
} = {}) {
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  const draftProofState = normalizeDraftProofingState(draftProofing);
  const targetRunId = String(runId ?? "").trim();
  const run = draftProofState.runs.find((candidate) => candidate.id === targetRunId) ?? null;
  if (!run) {
    return createDefaultDraftProofHistoryReviewState();
  }
  return {
    ...state,
    reviewRunId: run.id,
    selectedChangeId: "",
    conflictChangeIds: [],
    preflightResult: null,
    statusMessage: "",
  };
}

export function clearDraftProofHistoryReview() {
  return createDefaultDraftProofHistoryReviewState();
}

export function updateDraftProofHistoryReviewFilter(reviewState, filter) {
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  return {
    ...state,
    filter: DRAFT_PROOF_HISTORY_FILTERS.includes(filter) ? filter : "all",
  };
}

export function setDraftProofHistoryPreflightResult(reviewState, preflightResult, {
  statusMessage = "",
} = {}) {
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  const conflictChangeId = preflightResult?.safe === false && preflightResult?.changeId
    ? preflightResult.changeId
    : "";
  return {
    ...state,
    selectedChangeId: String(preflightResult?.changeId ?? state.selectedChangeId ?? ""),
    conflictChangeIds: conflictChangeId ? [conflictChangeId] : [],
    preflightResult: preflightResult && typeof preflightResult === "object" ? { ...preflightResult } : null,
    statusMessage: String(statusMessage ?? ""),
  };
}

export function isDraftProofHistoryReviewActive({
  settingsOpen = false,
  activePane = "",
  reviewState = null,
} = {}) {
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  return settingsOpen === true && activePane === "manuscript" && Boolean(state.reviewRunId);
}

export function createDraftProofHistoryProjections({
  draftProofing = null,
  reviewState = null,
  sceneId = "",
  textLength = 0,
  settingsOpen = false,
  activePane = "",
  channel = "draft-proof",
  priority = 97,
} = {}) {
  if (!isDraftProofHistoryReviewActive({ settingsOpen, activePane, reviewState })) {
    return [];
  }
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  const draftProofState = normalizeDraftProofingState(draftProofing);
  const run = draftProofState.runs.find((candidate) => candidate.id === state.reviewRunId) ?? null;
  const normalizedSceneId = String(sceneId ?? "").trim();
  const safeTextLength = Math.max(0, Math.floor(Number(textLength) || 0));
  if (!run?.changeHistoryAvailable || !normalizedSceneId) {
    return [];
  }
  return run.changes
    .filter((change) => change.sceneId === normalizedSceneId)
    .map((change) => {
      const range = resolveDraftProofHistoryProjectionRange(change, safeTextLength);
      if (!range) {
        return null;
      }
      const isConflict = state.conflictChangeIds.includes(change.changeId);
      const changedLater = Array.isArray(change.lineage) && change.lineage.length > 0;
      return {
        id: `${channel}:history:${run.id}:${change.changeId}`,
        sceneId: normalizedSceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        channel,
        styleToken: isConflict ? "conflict" : changedLater ? "changed-later" : "review",
        priority,
        persistence: "transient-derived",
        sourceRef: {
          recordType: "draftProofChange",
          recordId: change.changeId,
          runId: run.id,
        },
        visualStyle: {
          backdropColor: run.settings?.backdropColor ?? draftProofState.settings.backdropColor,
        },
      };
    })
    .filter(Boolean);
}

export function buildDraftProofHistoryCompareModel({
  draftProofing = null,
  runId = "",
  changeId = "",
} = {}) {
  const state = normalizeDraftProofingState(draftProofing);
  const run = state.runs.find((candidate) => candidate.id === String(runId ?? "").trim()) ?? null;
  const change = run?.changes.find((candidate) => candidate.changeId === String(changeId ?? "").trim()) ?? null;
  if (!run || !change) {
    return null;
  }
  return {
    runId: run.id,
    runLabel: run.label,
    iterationNumber: run.iterationNumber,
    changeId: change.changeId,
    sceneId: change.sceneId,
    beforeText: change.beforeText,
    afterText: change.afterText,
    state: change.state,
    changeType: change.changeType,
    createdAt: change.createdAt,
    lineage: resolveDraftProofChangeLineage(state, change).map((item) => ({
      runId: item.run.id,
      runLabel: item.run.label,
      iterationNumber: item.run.iterationNumber,
      date: item.change.createdAt || item.run.startedAt,
      changeId: item.change.changeId,
      beforeText: item.change.beforeText,
      afterText: item.change.afterText,
      relation: item.relationship.relation,
    })),
  };
}

export function resolveDraftProofHistoryHoverTarget({
  draftProofing = null,
  reviewState = null,
  projections = [],
  offset = null,
} = {}) {
  const numericOffset = Number(offset);
  if (!Number.isInteger(numericOffset)) {
    return null;
  }
  const projection = (Array.isArray(projections) ? projections : [])
    .filter((candidate) => candidate?.sourceRef?.recordType === "draftProofChange")
    .find((candidate) => candidate.startOffset <= numericOffset && candidate.endOffset >= numericOffset);
  if (!projection) {
    return null;
  }
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  return buildDraftProofHistoryCompareModel({
    draftProofing,
    runId: projection.sourceRef.runId || state.reviewRunId,
    changeId: projection.sourceRef.recordId,
  });
}

export function filterDraftProofHistoryChanges(changes, reviewState) {
  const state = normalizeDraftProofHistoryReviewState(reviewState);
  const conflictIds = new Set(state.conflictChangeIds);
  return (Array.isArray(changes) ? changes : []).filter((change) => {
    if (state.filter === "applied") {
      return change.state === DRAFT_PROOF_CHANGE_STATE.APPLIED;
    }
    if (state.filter === "reverted") {
      return change.state === DRAFT_PROOF_CHANGE_STATE.REVERTED;
    }
    if (state.filter === "changed-later") {
      return Array.isArray(change.lineage) && change.lineage.length > 0;
    }
    if (state.filter === "conflicts") {
      return conflictIds.has(change.changeId);
    }
    return true;
  });
}

// Intent: plan replay text, block, and inline-format mutations outside the shell before normal persistence effects run.
export function planDraftProofHistorySceneMutation({
  preflight = null,
  scene = null,
  sourceBlocks = [],
  inlineFormatRanges = [],
} = {}) {
  const previousText = String(scene?.editorText ?? "");
  if (
    !preflight?.safe ||
    !scene?.sceneId ||
    previousText.slice(preflight.startOffset, preflight.endOffset) !== preflight.expectedText
  ) {
    return null;
  }
  const nextText = `${previousText.slice(0, preflight.startOffset)}${preflight.replacementText}${previousText.slice(preflight.endOffset)}`;
  const selectionStart = preflight.startOffset + preflight.replacementText.length;
  const editedBlocks = updateSceneBlocksForTextEdit({
    blocks: sourceBlocks,
    sceneId: scene.sceneId,
    previousText,
    nextText,
    selectionStart,
    selectionEnd: selectionStart,
    selectionBeforeInputStart: preflight.startOffset,
    selectionBeforeInputEnd: preflight.endOffset,
  });
  return {
    previousText,
    nextText,
    selectionStart,
    nextBlocks: reconcileSceneBlocksWithEditorText({
      blocks: editedBlocks,
      sceneId: scene.sceneId,
      chapterId: scene.chapterId ?? "",
      text: nextText,
    }),
    inlineFormatRanges: updateInlineFormatRangesForTextEdit({
      ranges: inlineFormatRanges,
      previousText,
      nextText,
      pendingFormats: {},
      selectionStart,
      selectionEnd: selectionStart,
    }),
  };
}

function resolveDraftProofHistoryProjectionRange(change, textLength) {
  const startOffset = Math.max(0, Math.min(Number(change?.anchor?.startOffset) || 0, textLength));
  const endOffset = Math.max(startOffset, Math.min(Number(change?.anchor?.endOffset) || startOffset, textLength));
  if (endOffset > startOffset) {
    return { startOffset, endOffset };
  }
  if (textLength <= 0) {
    return null;
  }
  return startOffset < textLength
    ? { startOffset, endOffset: startOffset + 1 }
    : { startOffset: Math.max(0, startOffset - 1), endOffset: startOffset };
}
