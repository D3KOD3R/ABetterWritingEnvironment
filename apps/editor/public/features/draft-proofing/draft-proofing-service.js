// Intent: own draft proof-read run state and coverage intervals outside the editor shell.
import {
  deriveManuscriptEditTransaction,
} from "../manuscript-anchors/manuscript-edit-transaction-service.js";

export const DRAFT_PROOFING_SCHEMA_VERSION = 1;

export const DRAFT_PROOF_RUN_STATUS = Object.freeze({
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
});

const COVERAGE_ADJACENCY_GAP = 1;

export function createDefaultDraftProofingState() {
  return {
    schemaVersion: DRAFT_PROOFING_SCHEMA_VERSION,
    activeRunId: "",
    runs: [],
  };
}

export function normalizeDraftProofingState(candidate) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const runs = Array.isArray(source.runs)
    ? source.runs.map(normalizeDraftProofRun).filter(Boolean)
    : [];
  const activeRunId = typeof source.activeRunId === "string" ? source.activeRunId.trim() : "";
  const hasActiveRun = runs.some((run) =>
    run.id === activeRunId && run.status === DRAFT_PROOF_RUN_STATUS.ACTIVE
  );

  return {
    schemaVersion: DRAFT_PROOFING_SCHEMA_VERSION,
    activeRunId: hasActiveRun ? activeRunId : "",
    runs,
  };
}

export function getActiveDraftProofRun(state) {
  const normalized = normalizeDraftProofingState(state);
  if (!normalized.activeRunId) {
    return null;
  }

  return normalized.runs.find((run) =>
    run.id === normalized.activeRunId &&
    run.status === DRAFT_PROOF_RUN_STATUS.ACTIVE
  ) ?? null;
}

export function startOrResumeDraftProofRun(state, {
  now = new Date().toISOString(),
  label = "",
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const activeRun = getActiveDraftProofRun(normalized);
  if (activeRun) {
    return {
      state: normalized,
      run: activeRun,
      changed: false,
      reason: "already-active",
    };
  }

  const pausedRun = [...normalized.runs]
    .reverse()
    .find((run) => run.status === DRAFT_PROOF_RUN_STATUS.PAUSED);
  if (pausedRun) {
    const nextRuns = normalized.runs.map((run) =>
      run.id === pausedRun.id
        ? {
            ...run,
            status: DRAFT_PROOF_RUN_STATUS.ACTIVE,
            updatedAt: now,
          }
        : run,
    );
    return {
      state: {
        ...normalized,
        activeRunId: pausedRun.id,
        runs: nextRuns,
      },
      run: nextRuns.find((run) => run.id === pausedRun.id) ?? pausedRun,
      changed: true,
      reason: "resumed-run",
    };
  }

  const nextIteration = resolveNextDraftProofIteration(normalized.runs);
  const run = {
    id: formatDraftProofRunId(nextIteration),
    label: String(label ?? "").trim() || `Draft proof ${nextIteration}`,
    iterationNumber: nextIteration,
    status: DRAFT_PROOF_RUN_STATUS.ACTIVE,
    startedAt: now,
    updatedAt: now,
    completedAt: "",
    coverageByScene: {},
  };

  return {
    state: {
      ...normalized,
      activeRunId: run.id,
      runs: [...normalized.runs, run],
    },
    run,
    changed: true,
    reason: "created-run",
  };
}

export function pauseDraftProofRun(state, {
  runId = "",
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const targetRunId = String(runId || normalized.activeRunId || "").trim();
  if (!targetRunId) {
    return {
      state: normalized,
      run: null,
      changed: false,
      reason: "missing-run",
    };
  }

  let changed = false;
  let pausedRun = null;
  const runs = normalized.runs.map((run) => {
    if (run.id !== targetRunId || run.status !== DRAFT_PROOF_RUN_STATUS.ACTIVE) {
      return run;
    }

    changed = true;
    pausedRun = {
      ...run,
      status: DRAFT_PROOF_RUN_STATUS.PAUSED,
      updatedAt: now,
    };
    return pausedRun;
  });

  return {
    state: {
      ...normalized,
      activeRunId: normalized.activeRunId === targetRunId ? "" : normalized.activeRunId,
      runs,
    },
    run: pausedRun,
    changed,
    reason: changed ? "paused-run" : "run-not-active",
  };
}

export function completeDraftProofRun(state, {
  runId = "",
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const targetRunId = String(runId || normalized.activeRunId || "").trim();
  if (!targetRunId) {
    return {
      state: normalized,
      run: null,
      changed: false,
      reason: "missing-run",
    };
  }

  let changed = false;
  let completedRun = null;
  const runs = normalized.runs.map((run) => {
    if (run.id !== targetRunId || run.status === DRAFT_PROOF_RUN_STATUS.COMPLETED) {
      return run;
    }

    changed = true;
    completedRun = {
      ...run,
      status: DRAFT_PROOF_RUN_STATUS.COMPLETED,
      updatedAt: now,
      completedAt: now,
    };
    return completedRun;
  });

  return {
    state: {
      ...normalized,
      activeRunId: normalized.activeRunId === targetRunId ? "" : normalized.activeRunId,
      runs,
    },
    run: completedRun,
    changed,
    reason: changed ? "completed-run" : "run-already-completed",
  };
}

export function addDraftProofCoverageRange(state, {
  runId = "",
  sceneId = "",
  startOffset = 0,
  endOffset = 0,
  textLength = 0,
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const targetRunId = String(runId || normalized.activeRunId || "").trim();
  const normalizedSceneId = String(sceneId ?? "").trim();
  const range = normalizeCoverageRange({
    startOffset,
    endOffset,
    textLength,
  });
  if (!targetRunId || !normalizedSceneId || !range) {
    return {
      state: normalized,
      run: null,
      changed: false,
      reason: "invalid-range",
    };
  }

  let changed = false;
  let updatedRun = null;
  const runs = normalized.runs.map((run) => {
    if (run.id !== targetRunId || run.status !== DRAFT_PROOF_RUN_STATUS.ACTIVE) {
      return run;
    }

    const existingSpans = Array.isArray(run.coverageByScene?.[normalizedSceneId])
      ? run.coverageByScene[normalizedSceneId]
      : [];
    const nextSpans = mergeDraftProofCoverageSpans([
      ...existingSpans,
      {
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        touchedAt: now,
      },
    ], {
      textLength,
      now,
    });
    if (serializeCoverageSpans(existingSpans) === serializeCoverageSpans(nextSpans)) {
      return run;
    }

    changed = true;
    updatedRun = {
      ...run,
      updatedAt: now,
      coverageByScene: {
        ...(run.coverageByScene && typeof run.coverageByScene === "object" && !Array.isArray(run.coverageByScene)
          ? run.coverageByScene
          : {}),
        [normalizedSceneId]: nextSpans,
      },
    };
    return updatedRun;
  });

  return {
    state: {
      ...normalized,
      runs,
    },
    run: updatedRun,
    changed,
    reason: changed ? "coverage-added" : "coverage-unchanged",
  };
}

export function updateDraftProofCoverageForTextEdit(state, {
  sceneId = "",
  previousText = "",
  nextText = "",
  selectionStart = null,
  selectionEnd = null,
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const activeRun = getActiveDraftProofRun(normalized);
  const normalizedSceneId = String(sceneId ?? "").trim();
  if (!activeRun || !normalizedSceneId) {
    return {
      state: normalized,
      run: activeRun,
      changed: false,
      transaction: null,
      reason: "no-active-run",
    };
  }

  const transaction = deriveManuscriptEditTransaction({
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    selectionStart,
    selectionEnd,
    createdAt: now,
  });
  if (!transaction) {
    return {
      state: normalized,
      run: activeRun,
      changed: false,
      transaction: null,
      reason: "no-text-edit",
    };
  }

  const nextTextLength = String(nextText ?? "").length;
  const existingSpans = Array.isArray(activeRun.coverageByScene?.[normalizedSceneId])
    ? activeRun.coverageByScene[normalizedSceneId]
    : [];
  const shiftedSpans = existingSpans
    .map((span) => transformCoverageSpanForEdit(span, transaction, {
      nextTextLength,
      now,
    }))
    .filter(Boolean);
  const editRange = resolveEditCoverageRange(transaction, nextTextLength);
  const nextSpans = mergeDraftProofCoverageSpans([
    ...shiftedSpans,
    ...(editRange ? [{
      ...editRange,
      touchedAt: now,
    }] : []),
  ], {
    textLength: nextTextLength,
    now,
  });

  if (serializeCoverageSpans(existingSpans) === serializeCoverageSpans(nextSpans)) {
    return {
      state: normalized,
      run: activeRun,
      changed: false,
      transaction,
      reason: "coverage-unchanged",
    };
  }

  const runs = normalized.runs.map((run) =>
    run.id === activeRun.id
      ? {
          ...run,
          updatedAt: now,
          coverageByScene: {
            ...(run.coverageByScene && typeof run.coverageByScene === "object" && !Array.isArray(run.coverageByScene)
              ? run.coverageByScene
              : {}),
            [normalizedSceneId]: nextSpans,
          },
        }
      : run,
  );
  const updatedRun = runs.find((run) => run.id === activeRun.id) ?? activeRun;
  return {
    state: {
      ...normalized,
      runs,
    },
    run: updatedRun,
    changed: true,
    transaction,
    reason: "coverage-updated-for-edit",
  };
}

export function createDraftProofCoverageProjections({
  draftProofing = null,
  sceneId = "",
  textLength = 0,
  runId = "",
  includeCompletedRuns = false,
  channel = "draft-proof",
  priority = 95,
} = {}) {
  const normalized = normalizeDraftProofingState(draftProofing);
  const normalizedSceneId = String(sceneId ?? "").trim();
  const targetRunId = String(runId || normalized.activeRunId || "").trim();
  const currentRuns = normalized.runs.filter((run) =>
    run.status === DRAFT_PROOF_RUN_STATUS.ACTIVE ||
    run.status === DRAFT_PROOF_RUN_STATUS.PAUSED
  );
  const latestCompletedRun = [...normalized.runs]
    .reverse()
    .find((run) => run.status === DRAFT_PROOF_RUN_STATUS.COMPLETED);
  const sourceRuns = targetRunId
    ? normalized.runs.filter((run) => run.id === targetRunId)
    : includeCompletedRuns === true
      ? normalized.runs
      : currentRuns.length
        ? currentRuns
        : latestCompletedRun
          ? [latestCompletedRun]
          : [];
  const projections = [];

  for (const run of sourceRuns) {
    const spans = Array.isArray(run.coverageByScene?.[normalizedSceneId])
      ? run.coverageByScene[normalizedSceneId]
      : [];
    for (const span of spans) {
      const range = normalizeCoverageRange({
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        textLength,
      });
      if (!range) {
        continue;
      }

      projections.push({
        id: `${channel}:${run.id}:${normalizedSceneId}:${range.startOffset}:${range.endOffset}`,
        sceneId: normalizedSceneId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        channel,
        styleToken: "covered",
        priority,
        persistence: "derived-durable",
        sourceRef: {
          recordType: "draftProofRun",
          recordId: run.id,
        },
      });
    }
  }

  return projections;
}

export function pruneDraftProofCoverageForScenes(state, {
  remainingSceneIds = [],
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const remainingSet = remainingSceneIds instanceof Set
    ? remainingSceneIds
    : new Set((Array.isArray(remainingSceneIds) ? remainingSceneIds : []).map((sceneId) => String(sceneId ?? "")));
  let changed = false;
  const runs = normalized.runs.map((run) => {
    const coverageByScene = {};
    let runChanged = false;
    for (const [sceneId, spans] of Object.entries(run.coverageByScene ?? {})) {
      if (remainingSet.has(sceneId)) {
        coverageByScene[sceneId] = spans;
        continue;
      }

      runChanged = true;
    }

    if (!runChanged) {
      return run;
    }

    changed = true;
    return {
      ...run,
      updatedAt: now,
      coverageByScene,
    };
  });

  return {
    state: changed
      ? normalizeDraftProofingState({
          ...normalized,
          runs,
        })
      : normalized,
    changed,
    reason: changed ? "coverage-pruned-for-scenes" : "coverage-unchanged",
  };
}

export function mergeDraftProofCoverageSpans(spans = [], {
  textLength = Number.POSITIVE_INFINITY,
  now = new Date().toISOString(),
} = {}) {
  const normalized = (Array.isArray(spans) ? spans : [])
    .map((span) => {
      const range = normalizeCoverageRange({
        startOffset: span?.startOffset,
        endOffset: span?.endOffset,
        textLength,
      });
      return range
        ? {
            ...range,
            touchedAt: typeof span?.touchedAt === "string" && span.touchedAt ? span.touchedAt : now,
          }
        : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset);
  if (!normalized.length) {
    return [];
  }

  const merged = [normalized[0]];
  for (const span of normalized.slice(1)) {
    const previous = merged[merged.length - 1];
    if (span.startOffset <= previous.endOffset + COVERAGE_ADJACENCY_GAP) {
      previous.endOffset = Math.max(previous.endOffset, span.endOffset);
      previous.touchedAt = maxTimestamp(previous.touchedAt, span.touchedAt);
      continue;
    }

    merged.push({ ...span });
  }

  return merged;
}

function normalizeDraftProofRun(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : "";
  if (!id) {
    return null;
  }

  const status = Object.values(DRAFT_PROOF_RUN_STATUS).includes(candidate.status)
    ? candidate.status
    : DRAFT_PROOF_RUN_STATUS.PAUSED;
  const coverageByScene = {};
  const sourceCoverage = candidate.coverageByScene && typeof candidate.coverageByScene === "object" && !Array.isArray(candidate.coverageByScene)
    ? candidate.coverageByScene
    : {};
  for (const [sceneId, spans] of Object.entries(sourceCoverage)) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId) {
      continue;
    }

    const normalizedSpans = mergeDraftProofCoverageSpans(spans);
    if (normalizedSpans.length) {
      coverageByScene[normalizedSceneId] = normalizedSpans;
    }
  }

  return {
    id,
    label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : id,
    iterationNumber: Number.isInteger(candidate.iterationNumber) && candidate.iterationNumber > 0
      ? candidate.iterationNumber
      : extractDraftProofRunIteration(id),
    status,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : "",
    coverageByScene,
  };
}

function normalizeCoverageRange({
  startOffset = 0,
  endOffset = 0,
  textLength = 0,
} = {}) {
  const safeTextLength = Number.isFinite(Number(textLength))
    ? Math.max(0, Math.floor(Number(textLength)))
    : Number.POSITIVE_INFINITY;
  const start = clampOffset(startOffset, safeTextLength);
  const end = clampOffset(endOffset, safeTextLength);
  const safeStart = Math.min(start, end);
  const safeEnd = Math.max(start, end);
  if (safeEnd <= safeStart) {
    return null;
  }

  return {
    startOffset: safeStart,
    endOffset: safeEnd,
  };
}

function transformCoverageSpanForEdit(span, transaction, {
  nextTextLength = 0,
  now = new Date().toISOString(),
} = {}) {
  const range = normalizeCoverageRange({
    startOffset: span?.startOffset,
    endOffset: span?.endOffset,
    textLength: Number.POSITIVE_INFINITY,
  });
  if (!range) {
    return null;
  }

  const editStart = transaction.startOffset;
  const editEnd = transaction.endOffset;
  const delta = transaction.insertedLength - transaction.deletedLength;
  let nextStart = range.startOffset;
  let nextEnd = range.endOffset;

  if (editEnd < range.startOffset || (editEnd === range.startOffset && transaction.deletedLength > 0)) {
    nextStart += delta;
    nextEnd += delta;
  } else if (editStart > range.endOffset || (editStart === range.endOffset && transaction.deletedLength > 0)) {
    // Edits after the coverage do not affect this span.
  } else {
    nextStart = Math.min(range.startOffset, editStart);
    nextEnd = Math.max(range.endOffset + delta, editStart + transaction.insertedLength);
  }

  const normalized = normalizeCoverageRange({
    startOffset: nextStart,
    endOffset: nextEnd,
    textLength: nextTextLength,
  });
  return normalized
    ? {
        ...normalized,
        touchedAt: typeof span?.touchedAt === "string" && span.touchedAt ? span.touchedAt : now,
      }
    : null;
}

function resolveEditCoverageRange(transaction, textLength) {
  if (!transaction || textLength <= 0) {
    return null;
  }

  if (transaction.insertedLength > 0) {
    return normalizeCoverageRange({
      startOffset: transaction.startOffset,
      endOffset: transaction.startOffset + transaction.insertedLength,
      textLength,
    });
  }

  const startOffset = Math.max(0, Math.min(transaction.startOffset, textLength - 1));
  return normalizeCoverageRange({
    startOffset,
    endOffset: Math.min(textLength, startOffset + 1),
    textLength,
  });
}

function resolveNextDraftProofIteration(runs) {
  return (Array.isArray(runs) ? runs : []).reduce((max, run) => {
    const iteration = Number(run?.iterationNumber);
    return Number.isInteger(iteration) && iteration > max ? iteration : max;
  }, 0) + 1;
}

function formatDraftProofRunId(iteration) {
  return `draft-proof-run-${String(iteration).padStart(4, "0")}`;
}

function extractDraftProofRunIteration(id) {
  const match = String(id ?? "").match(/(\d+)$/);
  const value = match ? Number(match[1]) : 1;
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function serializeCoverageSpans(spans) {
  return JSON.stringify((Array.isArray(spans) ? spans : []).map((span) => ({
    startOffset: Number(span?.startOffset),
    endOffset: Number(span?.endOffset),
  })));
}

function maxTimestamp(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime)) {
    return right;
  }
  if (Number.isNaN(rightTime)) {
    return left;
  }
  return rightTime >= leftTime ? right : left;
}

function clampOffset(value, textLength) {
  const number = Number(value);
  const safeNumber = Number.isFinite(number) ? Math.floor(Number(number)) : 0;
  const max = Number.isFinite(Number(textLength))
    ? Math.max(0, Math.floor(Number(textLength)))
    : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(safeNumber, max));
}
