// Intent: own draft proof-read run state and coverage intervals outside the editor shell.
import {
  deriveManuscriptEditTransaction,
} from "../manuscript-anchors/manuscript-edit-transaction-service.js";
import {
  MANUSCRIPT_ANCHOR_STATUS,
  createManuscriptAnchor,
  createStableTextHash,
  normalizeManuscriptAnchor,
} from "../manuscript-anchors/manuscript-anchor-service.js";
import {
  applyEditTransactionToAnchor,
} from "../manuscript-anchors/manuscript-anchor-mutation-service.js";

export const DRAFT_PROOFING_SCHEMA_VERSION = 2;
const LEGACY_DRAFT_PROOF_BACKDROP_COLOR_DEFAULT = "#d8d1c5";
const LEGACY_DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS = Object.freeze([
  "#d8d1c5",
  "#d5dce0",
  "#d8dfd2",
  "#e2d5c6",
  "#d6d2dc",
]);
export const DRAFT_PROOF_BACKDROP_COLOR_DEFAULT = "#c7b99f";
export const DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS = Object.freeze([
  "#c7b99f",
  "#bcc8cf",
  "#c1cfb8",
  "#d1bfa7",
  "#c4bdd1",
]);
export const MAX_DRAFT_PROOF_RECENT_BACKDROP_COLORS = 5;
export const DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN = 0;
export const DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX = 100;
export const DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS = Object.freeze({
  light: 42,
  dark: 100,
});

export const DRAFT_PROOF_RUN_STATUS = Object.freeze({
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
});

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COVERAGE_ADJACENCY_GAP = 0;
const LOGICAL_CHANGE_BURST_WINDOW_MS = 1500;

export const DRAFT_PROOF_CHANGE_STATE = Object.freeze({
  APPLIED: "applied",
  REVERTED: "reverted",
  CONFLICT: "conflict",
});

export const DRAFT_PROOF_HISTORY_REPLAY_ORIGIN = "proofread-history-replay";

export function createDefaultDraftProofSettings() {
  return {
    backdropColor: DRAFT_PROOF_BACKDROP_COLOR_DEFAULT,
    backdropColorPresets: [...DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS],
    recentBackdropColors: [],
    highlightIntensityByTheme: { ...DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS },
  };
}

export function createDefaultDraftProofingState() {
  return {
    schemaVersion: DRAFT_PROOFING_SCHEMA_VERSION,
    activeRunId: "",
    runs: [],
    settings: createDefaultDraftProofSettings(),
  };
}

export function normalizeDraftProofingState(candidate) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const settings = normalizeDraftProofSettings(source.settings ?? source);
  const sourceSchemaVersion = Number.isInteger(source.schemaVersion) ? source.schemaVersion : 1;
  const runs = Array.isArray(source.runs)
    ? source.runs.map((run) => normalizeDraftProofRun(run, settings, { sourceSchemaVersion })).filter(Boolean)
    : [];
  const activeRunId = typeof source.activeRunId === "string" ? source.activeRunId.trim() : "";
  const hasActiveRun = runs.some((run) =>
    run.id === activeRunId && run.status === DRAFT_PROOF_RUN_STATUS.ACTIVE
  );

  return {
    schemaVersion: DRAFT_PROOFING_SCHEMA_VERSION,
    activeRunId: hasActiveRun ? activeRunId : "",
    runs,
    settings,
  };
}

export function normalizeDraftProofSettings(candidate) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const backdropColor = normalizeDraftProofBackdropSettingColor(source.backdropColor);
  const backdropColorPresets = normalizeDraftProofBackdropColorPresets(source.backdropColorPresets);
  const recentBackdropColors = normalizeDraftProofRecentBackdropColors(
    source.recentBackdropColors ?? source.backdropRecentColors,
  );
  const highlightIntensityByTheme = normalizeDraftProofHighlightIntensityByTheme(
    source.highlightIntensityByTheme ?? source.highlightIntensity,
  );

  return {
    backdropColor,
    backdropColorPresets,
    recentBackdropColors: isDraftProofCustomBackdropColor(backdropColor, backdropColorPresets)
      ? addRecentDraftProofBackdropColor(recentBackdropColors, backdropColor)
      : recentBackdropColors,
    highlightIntensityByTheme,
  };
}

export function normalizeDraftProofBackdropColor(value, fallback = DRAFT_PROOF_BACKDROP_COLOR_DEFAULT) {
  const normalizedFallback = typeof fallback === "string" && HEX_COLOR_PATTERN.test(fallback)
    ? expandHexColor(fallback)
    : DRAFT_PROOF_BACKDROP_COLOR_DEFAULT;
  const raw = typeof value === "string" ? value.trim() : "";
  if (!HEX_COLOR_PATTERN.test(raw)) {
    return normalizedFallback;
  }

  return expandHexColor(raw);
}

// Intent: migrate unchanged legacy defaults while preserving deliberate user-selected colours.
function normalizeDraftProofBackdropSettingColor(value) {
  const normalized = normalizeDraftProofBackdropColor(value);
  return normalized === LEGACY_DRAFT_PROOF_BACKDROP_COLOR_DEFAULT
    ? DRAFT_PROOF_BACKDROP_COLOR_DEFAULT
    : normalized;
}

// Intent: keep editable preset slots stable so project settings can persist a small paper-adjacent palette.
export function normalizeDraftProofBackdropColorPresets(value) {
  const source = Array.isArray(value) ? value : [];
  return DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS.map((defaultColor, index) => {
    const normalized = normalizeDraftProofBackdropColor(source[index], defaultColor);
    return normalized === LEGACY_DRAFT_PROOF_BACKDROP_COLOR_PRESET_DEFAULTS[index]
      ? defaultColor
      : normalized;
  });
}

// Intent: remember recent proof-read backdrop colours without letting the palette grow or duplicate itself.
export function normalizeDraftProofRecentBackdropColors(value) {
  const source = Array.isArray(value) ? value : [];
  const colors = [];
  const seen = new Set();

  for (const item of source) {
    const color = normalizeDraftProofOptionalBackdropColor(item);
    if (!color || seen.has(color)) {
      continue;
    }

    seen.add(color);
    colors.push(color);
    if (colors.length >= MAX_DRAFT_PROOF_RECENT_BACKDROP_COLORS) {
      break;
    }
  }

  return colors;
}

export function normalizeDraftProofHighlightIntensity(value, fallback = DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS.light) {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber)
    ? Math.max(
        DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN,
        Math.min(Math.round(fallbackNumber), DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX),
      )
    : DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS.light;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return normalizedFallback;
  }

  return Math.max(
    DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN,
    Math.min(Math.round(number), DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX),
  );
}

// Intent: save one author-facing proof-read highlight dial per editor theme.
export function normalizeDraftProofHighlightIntensityByTheme(value) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return {
    light: normalizeDraftProofHighlightIntensity(
      source.light ?? source.day ?? source.lightMode,
      DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS.light,
    ),
    dark: normalizeDraftProofHighlightIntensity(
      source.dark ?? source.night ?? source.darkMode,
      DRAFT_PROOF_HIGHLIGHT_INTENSITY_DEFAULTS.dark,
    ),
  };
}

export function addRecentDraftProofBackdropColor(recentColors, color) {
  const normalizedColor = normalizeDraftProofOptionalBackdropColor(color);
  if (!normalizedColor) {
    return normalizeDraftProofRecentBackdropColors(recentColors);
  }

  return normalizeDraftProofRecentBackdropColors([
    normalizedColor,
    ...normalizeDraftProofRecentBackdropColors(recentColors)
    .filter((candidate) => candidate !== normalizedColor),
  ]);
}

function normalizeDraftProofOptionalBackdropColor(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!HEX_COLOR_PATTERN.test(raw)) {
    return "";
  }

  return expandHexColor(raw);
}

function isDraftProofCustomBackdropColor(color, presets) {
  return Boolean(color) &&
    color !== DRAFT_PROOF_BACKDROP_COLOR_DEFAULT &&
    !presets.includes(color);
}

function areDraftProofSettingsEqual(left, right) {
  return left?.backdropColor === right?.backdropColor &&
    serializeDraftProofColorPresets(left?.backdropColorPresets) ===
      serializeDraftProofColorPresets(right?.backdropColorPresets) &&
    serializeDraftProofColorPresets(left?.recentBackdropColors) ===
      serializeDraftProofColorPresets(right?.recentBackdropColors) &&
    serializeDraftProofHighlightIntensityByTheme(left?.highlightIntensityByTheme) ===
      serializeDraftProofHighlightIntensityByTheme(right?.highlightIntensityByTheme);
}

export function updateDraftProofSettings(state, settingsPatch = {}) {
  const normalized = normalizeDraftProofingState(state);
  const nextSettings = normalizeDraftProofSettings({
    ...normalized.settings,
    ...(settingsPatch && typeof settingsPatch === "object" && !Array.isArray(settingsPatch) ? settingsPatch : {}),
  });
  const changed = !areDraftProofSettingsEqual(nextSettings, normalized.settings);

  return {
    state: changed
      ? {
          ...normalized,
          settings: nextSettings,
        }
      : normalized,
    settings: nextSettings,
    changed,
    reason: changed ? "settings-updated" : "settings-unchanged",
  };
}

// Intent: target a single proof-read iteration's visual settings while preserving project defaults for future runs.
export function updateDraftProofRunSettings(state, {
  runId = "",
  settingsPatch = {},
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const targetRunId = String(runId ?? "").trim();
  if (!targetRunId) {
    return updateDraftProofSettings(normalized, settingsPatch);
  }

  let changed = false;
  let updatedRun = null;
  const runs = normalized.runs.map((run) => {
    if (run.id !== targetRunId) {
      return run;
    }

    const nextSettings = normalizeDraftProofSettings({
      ...run.settings,
      ...(settingsPatch && typeof settingsPatch === "object" && !Array.isArray(settingsPatch) ? settingsPatch : {}),
    });
    const runChanged = !areDraftProofSettingsEqual(nextSettings, run.settings);
    updatedRun = runChanged
      ? {
          ...run,
          settings: nextSettings,
        }
      : run;
    changed = changed || runChanged;
    return updatedRun;
  });

  return {
    state: changed
      ? {
          ...normalized,
          runs,
        }
      : normalized,
    settings: updatedRun?.settings ?? null,
    run: updatedRun,
    changed,
    reason: updatedRun
      ? changed
        ? "run-settings-updated"
        : "run-settings-unchanged"
      : "missing-run",
  };
}

// Intent: resolve the proof-read iteration whose settings should be shown when the settings panel opens.
export function resolveDraftProofSettingsRunId(state, preferredRunId = "") {
  const normalized = normalizeDraftProofingState(state);
  const requestedRunId = String(preferredRunId ?? "").trim();
  if (requestedRunId && normalized.runs.some((run) => run.id === requestedRunId)) {
    return requestedRunId;
  }

  if (normalized.activeRunId && normalized.runs.some((run) => run.id === normalized.activeRunId)) {
    return normalized.activeRunId;
  }

  const pausedRun = [...normalized.runs]
    .reverse()
    .find((run) => run.status === DRAFT_PROOF_RUN_STATUS.PAUSED);
  if (pausedRun) {
    return pausedRun.id;
  }

  const completedRun = [...normalized.runs]
    .reverse()
    .find((run) => run.status === DRAFT_PROOF_RUN_STATUS.COMPLETED);
  return completedRun?.id ?? normalized.runs[0]?.id ?? "";
}

// Intent: expose the selected iteration settings without making UI code inspect run records directly.
export function getDraftProofSettingsForRun(state, runId = "") {
  const normalized = normalizeDraftProofingState(state);
  const selectedRunId = resolveDraftProofSettingsRunId(normalized, runId);
  const run = normalized.runs.find((candidate) => candidate.id === selectedRunId) ?? null;
  return {
    runId: run?.id ?? "",
    run,
    settings: run?.settings ?? normalized.settings,
  };
}

export function clearDraftProofRunData(state) {
  const normalized = normalizeDraftProofingState(state);
  const clearedRunCount = normalized.runs.length;
  const changed = Boolean(normalized.activeRunId) || clearedRunCount > 0;

  return {
    state: changed
      ? {
          ...normalized,
          activeRunId: "",
          runs: [],
        }
      : normalized,
    changed,
    clearedRunCount,
    reason: changed ? "run-data-cleared" : "no-run-data",
  };
}

export function deleteDraftProofRuns(state, {
  runIds = [],
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const requestedRunIds = new Set((Array.isArray(runIds) ? runIds : [runIds])
    .map((runId) => String(runId ?? "").trim())
    .filter(Boolean));
  if (!requestedRunIds.size) {
    return {
      state: normalized,
      changed: false,
      deletedRunCount: 0,
      deletedRunIds: [],
      reason: "missing-run-selection",
    };
  }

  const deletedRunIds = normalized.runs
    .filter((run) => requestedRunIds.has(run.id))
    .map((run) => run.id);
  if (!deletedRunIds.length) {
    return {
      state: normalized,
      changed: false,
      deletedRunCount: 0,
      deletedRunIds: [],
      reason: "no-matching-runs",
    };
  }

  const deletedRunIdSet = new Set(deletedRunIds);
  const remainingRuns = normalized.runs.filter((run) => !deletedRunIdSet.has(run.id));
  const activeRunId = deletedRunIdSet.has(normalized.activeRunId) ? "" : normalized.activeRunId;
  return {
    state: normalizeDraftProofingState({
      ...normalized,
      activeRunId,
      runs: remainingRuns,
    }),
    changed: true,
    deletedRunCount: deletedRunIds.length,
    deletedRunIds,
    reason: "runs-deleted",
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

export function startNewDraftProofRun(state, {
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

  const nextIteration = resolveNextDraftProofIteration(normalized.runs);
  const run = createDraftProofRunRecord(nextIteration, {
    now,
    label,
    settings: normalized.settings,
  });

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

  return startNewDraftProofRun(normalized, {
    now,
    label,
  });
}

export function continueDraftProofRun(state, {
  runId = "",
  now = new Date().toISOString(),
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

  const completedRun = resolveDraftProofRunByStatus(normalized.runs, {
    runId,
    status: DRAFT_PROOF_RUN_STATUS.COMPLETED,
  });
  if (!completedRun) {
    return {
      state: normalized,
      run: null,
      changed: false,
      reason: "missing-completed-run",
    };
  }

  const nextRuns = normalized.runs.map((run) =>
    run.id === completedRun.id
      ? {
          ...run,
          status: DRAFT_PROOF_RUN_STATUS.ACTIVE,
          updatedAt: now,
          completedAt: "",
        }
      : run,
  );

  return {
    state: {
      ...normalized,
      activeRunId: completedRun.id,
      runs: nextRuns,
    },
    run: nextRuns.find((run) => run.id === completedRun.id) ?? completedRun,
    changed: true,
    reason: "continued-run",
  };
}

export function pauseDraftProofRun(state, {
  runId = "",
  now = new Date().toISOString(),
  resumePoint = null,
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
      ...closeDraftProofChangeBurst(run, now),
      status: DRAFT_PROOF_RUN_STATUS.PAUSED,
      updatedAt: now,
      resumePoint: normalizeDraftProofResumePoint(resumePoint) ?? run.resumePoint,
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
  resumePoint = null,
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
      ...closeDraftProofChangeBurst(run, now),
      status: DRAFT_PROOF_RUN_STATUS.COMPLETED,
      updatedAt: now,
      completedAt: now,
      resumePoint: normalizeDraftProofResumePoint(resumePoint) ?? run.resumePoint,
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

export function removeDraftProofCoverageRange(state, {
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

    const coverageByScene = run.coverageByScene && typeof run.coverageByScene === "object" && !Array.isArray(run.coverageByScene)
      ? run.coverageByScene
      : {};
    const existingSpans = Array.isArray(coverageByScene[normalizedSceneId])
      ? coverageByScene[normalizedSceneId]
      : [];
    const nextSpans = subtractDraftProofCoverageSpans(existingSpans, range, {
      textLength,
    });
    if (serializeCoverageSpans(existingSpans) === serializeCoverageSpans(nextSpans)) {
      return run;
    }

    const nextCoverageByScene = {
      ...coverageByScene,
    };
    if (nextSpans.length) {
      nextCoverageByScene[normalizedSceneId] = nextSpans;
    } else {
      delete nextCoverageByScene[normalizedSceneId];
    }

    changed = true;
    updatedRun = {
      ...run,
      updatedAt: now,
      coverageByScene: nextCoverageByScene,
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
    reason: changed ? "coverage-removed" : "coverage-unchanged",
  };
}

export function updateDraftProofCoverageForTextEdit(state, {
  sceneId = "",
  previousText = "",
  nextText = "",
  selectionStart = null,
  selectionEnd = null,
  selectionBeforeInputStart = null,
  selectionBeforeInputEnd = null,
  origin = "manual-editor",
  sourceRunId = "",
  sourceChangeId = "",
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const normalizedSceneId = String(sceneId ?? "").trim();
  if (!normalizedSceneId) {
    return {
      state: normalized,
      run: getActiveDraftProofRun(normalized),
      changed: false,
      transaction: null,
      reason: "missing-scene",
    };
  }

  const derivedTransaction = deriveManuscriptEditTransaction({
    sceneId: normalizedSceneId,
    previousText,
    nextText,
    selectionStart,
    selectionEnd,
    selectionBeforeInputStart,
    selectionBeforeInputEnd,
    createdAt: now,
  });
  if (!derivedTransaction) {
    return {
      state: normalized,
      run: getActiveDraftProofRun(normalized),
      changed: false,
      transaction: null,
      reason: "no-text-edit",
    };
  }

  const transaction = {
    ...derivedTransaction,
    origin,
    sourceRunId: String(sourceRunId ?? ""),
    sourceChangeId: String(sourceChangeId ?? ""),
  };
  const historyResult = updateDraftProofHistoryForTransaction(normalized, {
    transaction,
    previousText,
    nextText,
    origin,
    now,
  });
  const historyState = historyResult.state;
  const activeRun = getActiveDraftProofRun(historyState);
  if (!activeRun) {
    return {
      state: historyState,
      run: null,
      changed: historyResult.changed,
      transaction,
      reason: historyResult.changed ? historyResult.reason : "no-active-run",
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
  const includeEditCoverage = origin !== DRAFT_PROOF_HISTORY_REPLAY_ORIGIN;
  const nextSpans = mergeDraftProofCoverageSpans([
    ...shiftedSpans,
    ...(includeEditCoverage && editRange ? [{
      ...editRange,
      touchedAt: now,
    }] : []),
  ], {
    textLength: nextTextLength,
    now,
  });

  if (serializeCoverageSpans(existingSpans) === serializeCoverageSpans(nextSpans)) {
    return {
      state: historyState,
      run: activeRun,
      changed: historyResult.changed,
      transaction,
      reason: historyResult.changed ? historyResult.reason : "coverage-unchanged",
    };
  }

  const runs = historyState.runs.map((run) =>
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
      ...historyState,
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

      const runSettings = run.settings ?? normalized.settings;
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
        visualStyle: {
          backdropColor: runSettings.backdropColor,
          highlightIntensityByTheme: runSettings.highlightIntensityByTheme,
        },
      });
    }
  }

  return projections;
}

// Intent: consume runtime-only manuscript edits into a proof-read-owned durable ledger and anchor drift state.
export function updateDraftProofHistoryForTransaction(state, {
  transaction = null,
  previousText = "",
  nextText = "",
  origin = "manual-editor",
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  if (!transaction || !transaction.sceneId || String(previousText ?? "") === String(nextText ?? "")) {
    return { state: normalized, changed: false, change: null, reason: "no-text-edit" };
  }

  const activeRun = getActiveDraftProofRun(normalized);
  const captureAllowed = Boolean(
    activeRun?.changeHistoryAvailable &&
    origin !== DRAFT_PROOF_HISTORY_REPLAY_ORIGIN,
  );
  const activeChanges = captureAllowed && Array.isArray(activeRun.changes) ? activeRun.changes : [];
  const lastChange = activeChanges.at(-1) ?? null;
  const coalesce = lastChange && canCoalesceDraftProofChange(lastChange, transaction, now);
  const changeId = coalesce
    ? lastChange.changeId
    : captureAllowed
      ? formatDraftProofChangeId(activeRun.id, resolveNextDraftProofChangeSequence(activeChanges))
      : "";
  const laterChangeIdentity = captureAllowed
    ? {
        changeId,
        runId: activeRun.id,
        iterationNumber: activeRun.iterationNumber,
      }
    : null;
  let changed = false;
  let capturedChange = null;
  const runs = normalized.runs.map((run) => {
    let nextChanges = (Array.isArray(run.changes) ? run.changes : []).map((change) => {
      if (coalesce && run.id === activeRun.id && change.changeId === lastChange.changeId) {
        const merged = mergeDraftProofLogicalChange(change, transaction, {
          previousText,
          nextText,
          now,
        });
        capturedChange = merged;
        changed = true;
        return merged;
      }

      const anchorBeforeEdit = change.anchor;
      const drift = applyEditTransactionToAnchor(anchorBeforeEdit, transaction, {
        textLength: String(previousText ?? "").length,
        now,
      });
      let nextChange = drift.changed
        ? { ...change, anchor: drift.anchor, updatedAt: now }
        : change;
      if (drift.changed) {
        changed = true;
      }

      if (
        laterChangeIdentity &&
        run.id !== laterChangeIdentity.runId &&
        rangesOverlapForLineage(anchorBeforeEdit, transaction)
      ) {
        nextChange = {
          ...nextChange,
          lineage: upsertDraftProofLineage(nextChange.lineage, {
            earlierChangeId: change.changeId,
            laterChangeId: laterChangeIdentity.changeId,
            earlierRunId: run.id,
            laterRunId: laterChangeIdentity.runId,
            relation: classifyDraftProofLineageRelation(anchorBeforeEdit, transaction),
            createdAt: now,
          }),
          updatedAt: now,
        };
        changed = true;
      }
      return nextChange;
    });

    if (
      origin === DRAFT_PROOF_HISTORY_REPLAY_ORIGIN &&
      run.id === activeRun?.id &&
      nextChanges.length
    ) {
      nextChanges = nextChanges.map((change, index) => index === nextChanges.length - 1
        ? { ...change, burstClosedAt: now || transaction.createdAt || change.updatedAt }
        : change);
      changed = true;
    }

    if (captureAllowed && run.id === activeRun.id && !coalesce) {
      capturedChange = createDraftProofLogicalChange({
        run,
        transaction,
        previousText,
        nextText,
        now,
        changeId,
      });
      nextChanges.push(capturedChange);
      changed = true;
    }

    if (!run.changeHistoryAvailable) {
      return run;
    }
    return {
      ...run,
      changes: nextChanges,
      changeSummary: summarizeDraftProofChanges(nextChanges),
      updatedAt: run.id === activeRun?.id && capturedChange ? now : run.updatedAt,
    };
  });

  return {
    state: changed ? { ...normalized, runs } : normalized,
    changed,
    change: capturedChange,
    reason: captureAllowed
      ? coalesce ? "logical-change-coalesced" : "logical-change-captured"
      : changed ? "history-anchors-shifted" : origin === DRAFT_PROOF_HISTORY_REPLAY_ORIGIN
        ? "history-replay-suppressed"
        : "no-active-history-run",
  };
}

export function summarizeDraftProofChanges(changes = []) {
  const source = Array.isArray(changes) ? changes : [];
  const summary = {
    logicalChangeCount: source.length,
    wordsAdded: 0,
    wordsRemoved: 0,
    wordsChanged: 0,
    netWordDelta: 0,
    appliedChangeCount: 0,
    revertedChangeCount: 0,
    changedLaterCount: 0,
  };
  for (const change of source) {
    summary.wordsAdded += normalizeNonNegativeInteger(change?.wordsAdded);
    summary.wordsRemoved += normalizeNonNegativeInteger(change?.wordsRemoved);
    summary.wordsChanged += normalizeNonNegativeInteger(change?.wordsChanged);
    summary.netWordDelta += normalizeInteger(change?.netWordDelta);
    if (change?.state === DRAFT_PROOF_CHANGE_STATE.REVERTED) {
      summary.revertedChangeCount += 1;
    } else {
      summary.appliedChangeCount += 1;
    }
    if (Array.isArray(change?.lineage) && change.lineage.length) {
      summary.changedLaterCount += 1;
    }
  }
  return summary;
}

export function preflightDraftProofChangeReversal(state, {
  runId = "",
  changeId = "",
  action = "undo",
  sceneTexts = {},
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const target = resolveDraftProofChange(normalized, runId, changeId);
  if (!target) {
    return createDraftProofPreflightResult({ action, safe: false, reason: "missing-change" });
  }
  const { run, change } = target;
  const normalizedAction = action === "redo" ? "redo" : "undo";
  const requiredState = normalizedAction === "redo"
    ? DRAFT_PROOF_CHANGE_STATE.REVERTED
    : DRAFT_PROOF_CHANGE_STATE.APPLIED;
  if (change.state !== requiredState) {
    return createDraftProofPreflightResult({
      action: normalizedAction,
      run,
      change,
      safe: false,
      reason: normalizedAction === "redo" ? "change-not-reverted" : "change-not-applied",
    });
  }

  const sceneText = resolveSceneText(sceneTexts, change.sceneId);
  if (sceneText === null) {
    return createDraftProofPreflightResult({
      action: normalizedAction,
      run,
      change,
      safe: false,
      unresolved: true,
      reason: "unresolved-scene",
    });
  }
  const expectedText = normalizedAction === "redo" ? change.beforeText : change.afterText;
  const replacementText = normalizedAction === "redo" ? change.afterText : change.beforeText;
  const location = resolveDraftProofExpectedTextLocation(change, sceneText, expectedText);
  if (!location) {
    const provenance = resolveDraftProofChangeLineage(normalized, change);
    return createDraftProofPreflightResult({
      action: normalizedAction,
      run,
      change,
      safe: false,
      conflict: true,
      reason: provenance.length ? "changed-by-later-proofread" : "manuscript-changed",
      provenance,
    });
  }

  return createDraftProofPreflightResult({
    action: normalizedAction,
    run,
    change,
    safe: true,
    reason: "safe",
    startOffset: location.startOffset,
    endOffset: location.endOffset,
    expectedText,
    replacementText,
    provenance: resolveDraftProofChangeLineage(normalized, change),
  });
}

export function planDraftProofRunReversal(state, {
  runId = "",
  action = "undo",
  sceneTexts = {},
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const run = normalized.runs.find((candidate) => candidate.id === String(runId ?? "").trim()) ?? null;
  const normalizedAction = action === "redo" ? "redo" : "undo";
  if (!run?.changeHistoryAvailable) {
    return {
      action: normalizedAction,
      runId: run?.id ?? "",
      available: false,
      reason: run ? "change-history-unavailable" : "missing-run",
      results: [],
      safeOperations: [],
      summary: createDraftProofRunPreflightSummary(0),
    };
  }
  const eligibleState = normalizedAction === "redo"
    ? DRAFT_PROOF_CHANGE_STATE.REVERTED
    : DRAFT_PROOF_CHANGE_STATE.APPLIED;
  const eligibleChanges = run.changes
    .filter((change) => change.state === eligibleState)
    .sort((left, right) => normalizedAction === "undo"
      ? right.sequence - left.sequence
      : left.sequence - right.sequence);
  let simulatedState = normalized;
  let simulatedSceneTexts = { ...sceneTexts };
  const results = [];
  for (const change of eligibleChanges) {
    const result = preflightDraftProofChangeReversal(simulatedState, {
      runId: run.id,
      changeId: change.changeId,
      action: normalizedAction,
      sceneTexts: simulatedSceneTexts,
    });
    results.push(result);
    if (result.safe) {
      const simulation = executeDraftProofChangeReversal(simulatedState, {
        runId: run.id,
        changeId: change.changeId,
        action: normalizedAction,
        sceneTexts: simulatedSceneTexts,
        now: "",
      });
      simulatedState = simulation.state;
      simulatedSceneTexts = simulation.sceneTexts;
    }
  }
  const safeOperations = results.filter((result) => result.safe);
  const summary = createDraftProofRunPreflightSummary(eligibleChanges.length);
  for (const result of results) {
    if (result.safe) {
      summary.safeCount += 1;
    } else if (result.unresolved) {
      summary.unresolvedCount += 1;
    } else if (result.reason === "changed-by-later-proofread") {
      summary.changedByLaterProofreadCount += 1;
    } else {
      summary.changedOutsideProofreadCount += 1;
    }
  }
  return {
    action: normalizedAction,
    runId: run.id,
    available: true,
    reason: "preflight-complete",
    results,
    safeOperations,
    summary,
  };
}

// Intent: provide a deterministic pure executor for service tests and non-DOM callers; the editor shell applies the same plans through its normal mutation path.
export function executeDraftProofChangeReversal(state, {
  runId = "",
  changeId = "",
  action = "undo",
  sceneTexts = {},
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const preflight = preflightDraftProofChangeReversal(normalized, {
    runId,
    changeId,
    action,
    sceneTexts,
  });
  if (!preflight.safe) {
    return { state: normalized, sceneTexts: { ...sceneTexts }, changed: false, preflight };
  }
  const previousText = resolveSceneText(sceneTexts, preflight.sceneId);
  const nextText = `${previousText.slice(0, preflight.startOffset)}${preflight.replacementText}${previousText.slice(preflight.endOffset)}`;
  const derivedTransaction = deriveManuscriptEditTransaction({
    sceneId: preflight.sceneId,
    previousText,
    nextText,
    createdAt: now,
  });
  const transaction = {
    ...derivedTransaction,
    origin: DRAFT_PROOF_HISTORY_REPLAY_ORIGIN,
    sourceRunId: preflight.sourceRunId,
    sourceChangeId: preflight.sourceChangeId,
  };
  const drifted = updateDraftProofHistoryForTransaction(normalized, {
    transaction,
    previousText,
    nextText,
    origin: DRAFT_PROOF_HISTORY_REPLAY_ORIGIN,
    now,
  });
  const marked = markDraftProofChangeReversal(drifted.state, {
    runId: preflight.runId,
    changeId: preflight.changeId,
    action: preflight.action,
    now,
  });
  return {
    state: marked.state,
    sceneTexts: { ...sceneTexts, [preflight.sceneId]: nextText },
    changed: marked.changed,
    preflight,
    transaction,
  };
}

export function executeDraftProofRunReversal(state, {
  runId = "",
  action = "undo",
  sceneTexts = {},
  now = new Date().toISOString(),
} = {}) {
  const preflight = planDraftProofRunReversal(state, { runId, action, sceneTexts });
  let nextState = normalizeDraftProofingState(state);
  let nextSceneTexts = { ...sceneTexts };
  const applied = [];
  const skipped = preflight.results.filter((result) => !result.safe);
  for (const operation of preflight.safeOperations) {
    const execution = executeDraftProofChangeReversal(nextState, {
      runId,
      changeId: operation.changeId,
      action: preflight.action,
      sceneTexts: nextSceneTexts,
      now,
    });
    if (execution.changed) {
      nextState = execution.state;
      nextSceneTexts = execution.sceneTexts;
      applied.push(execution.preflight);
    } else {
      skipped.push(execution.preflight);
    }
  }
  return {
    state: nextState,
    sceneTexts: nextSceneTexts,
    changed: applied.length > 0,
    preflight,
    applied,
    skipped,
  };
}

export function markDraftProofChangeReversal(state, {
  runId = "",
  changeId = "",
  action = "undo",
  now = new Date().toISOString(),
} = {}) {
  const normalized = normalizeDraftProofingState(state);
  const normalizedAction = action === "redo" ? "redo" : "undo";
  let changed = false;
  const runs = normalized.runs.map((run) => {
    if (run.id !== runId || !run.changeHistoryAvailable) {
      return run;
    }
    const changes = run.changes.map((change) => {
      if (change.changeId !== changeId) {
        return change;
      }
      const stateValue = normalizedAction === "redo"
        ? DRAFT_PROOF_CHANGE_STATE.APPLIED
        : DRAFT_PROOF_CHANGE_STATE.REVERTED;
      if (change.state === stateValue) {
        return change;
      }
      changed = true;
      return {
        ...change,
        state: stateValue,
        updatedAt: now,
        revertedAt: normalizedAction === "undo" ? now : change.revertedAt,
        reappliedAt: normalizedAction === "redo" ? now : change.reappliedAt,
      };
    });
    return changed
      ? { ...run, changes, changeSummary: summarizeDraftProofChanges(changes), updatedAt: now }
      : run;
  });
  return {
    state: changed ? { ...normalized, runs } : normalized,
    changed,
    reason: changed ? `change-${normalizedAction === "redo" ? "reapplied" : "reverted"}` : "change-state-unchanged",
  };
}

export function resolveDraftProofChangeLineage(state, changeOrId) {
  const normalized = normalizeDraftProofingState(state);
  const change = typeof changeOrId === "string"
    ? normalized.runs.flatMap((run) => run.changes).find((candidate) => candidate.changeId === changeOrId)
    : changeOrId;
  if (!change) {
    return [];
  }
  const changeIndex = new Map();
  for (const run of normalized.runs) {
    for (const candidate of run.changes) {
      changeIndex.set(candidate.changeId, { run, change: candidate });
    }
  }
  const results = [];
  const visited = new Set();
  const queue = [...(Array.isArray(change.lineage) ? change.lineage : [])];
  while (queue.length) {
    const relationship = queue.shift();
    if (!relationship?.laterChangeId || visited.has(relationship.laterChangeId)) {
      continue;
    }
    visited.add(relationship.laterChangeId);
    const target = changeIndex.get(relationship.laterChangeId);
    if (!target) {
      continue;
    }
    results.push({ relationship, run: target.run, change: target.change });
    queue.push(...(Array.isArray(target.change.lineage) ? target.change.lineage : []));
  }
  return results.sort((left, right) => (
    left.run.iterationNumber - right.run.iterationNumber || left.change.sequence - right.change.sequence
  ));
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

export function subtractDraftProofCoverageSpans(spans = [], range = null, {
  textLength = Number.POSITIVE_INFINITY,
} = {}) {
  const removalRange = normalizeCoverageRange({
    startOffset: range?.startOffset,
    endOffset: range?.endOffset,
    textLength,
  });
  if (!removalRange) {
    return mergeDraftProofCoverageSpans(spans, {
      textLength,
    });
  }

  const nextSpans = [];
  for (const span of Array.isArray(spans) ? spans : []) {
    const existingRange = normalizeCoverageRange({
      startOffset: span?.startOffset,
      endOffset: span?.endOffset,
      textLength,
    });
    if (!existingRange) {
      continue;
    }

    const touchedAt = typeof span?.touchedAt === "string" && span.touchedAt ? span.touchedAt : "";
    if (
      existingRange.endOffset <= removalRange.startOffset ||
      existingRange.startOffset >= removalRange.endOffset
    ) {
      nextSpans.push({
        ...existingRange,
        touchedAt,
      });
      continue;
    }

    if (existingRange.startOffset < removalRange.startOffset) {
      const leftRange = normalizeCoverageRange({
        startOffset: existingRange.startOffset,
        endOffset: removalRange.startOffset,
        textLength,
      });
      if (leftRange) {
        nextSpans.push({
          ...leftRange,
          touchedAt,
        });
      }
    }

    if (existingRange.endOffset > removalRange.endOffset) {
      const rightRange = normalizeCoverageRange({
        startOffset: removalRange.endOffset,
        endOffset: existingRange.endOffset,
        textLength,
      });
      if (rightRange) {
        nextSpans.push({
          ...rightRange,
          touchedAt,
        });
      }
    }
  }

  return nextSpans
    .sort((left, right) => left.startOffset - right.startOffset || left.endOffset - right.endOffset)
    .map((span) => ({
      ...span,
      touchedAt: span.touchedAt || "",
    }));
}

function createDraftProofLogicalChange({
  run,
  transaction,
  previousText,
  nextText,
  now,
  changeId,
}) {
  const beforeText = String(transaction.deletedText ?? "");
  const afterText = String(transaction.insertedText ?? "");
  const startOffset = transaction.startOffset;
  const anchor = createDraftProofChangeAnchor({
    changeId,
    sceneId: transaction.sceneId,
    text: nextText,
    startOffset,
    endOffset: startOffset + afterText.length,
    now,
    editId: transaction.editId,
  });
  return normalizeDraftProofChange({
    changeId,
    runId: run.id,
    iterationNumber: run.iterationNumber,
    sequence: resolveNextDraftProofChangeSequence(run.changes),
    sceneId: transaction.sceneId,
    createdAt: now,
    updatedAt: now,
    beforeText,
    afterText,
    originalStartOffset: startOffset,
    originalEndOffset: transaction.endOffset,
    anchor,
    beforeHash: createStableTextHash(beforeText),
    afterHash: createStableTextHash(afterText),
    changeType: classifyDraftProofChangeType(beforeText, afterText),
    state: DRAFT_PROOF_CHANGE_STATE.APPLIED,
    revertedAt: "",
    reappliedAt: "",
    burstClosedAt: "",
    lineage: [],
  }, {
    runId: run.id,
    iterationNumber: run.iterationNumber,
    sequence: resolveNextDraftProofChangeSequence(run.changes),
  });
}

function mergeDraftProofLogicalChange(change, transaction, {
  previousText,
  nextText,
  now,
}) {
  const currentStart = change.anchor.startOffset;
  const currentEnd = change.anchor.endOffset;
  const unionStart = Math.min(currentStart, transaction.startOffset);
  const unionEnd = Math.max(currentEnd, transaction.endOffset);
  const baselineStart = unionStart <= currentStart ? unionStart : change.originalStartOffset;
  const baselineEnd = unionEnd >= currentEnd
    ? unionEnd + change.beforeText.length - change.afterText.length
    : change.originalEndOffset;
  const prefix = unionStart < currentStart ? String(previousText).slice(unionStart, currentStart) : "";
  const suffix = unionEnd > currentEnd ? String(previousText).slice(currentEnd, unionEnd) : "";
  const beforeText = `${prefix}${change.beforeText}${suffix}`;
  const nextUnionEnd = Math.max(unionStart, unionEnd + transaction.delta);
  const afterText = String(nextText).slice(unionStart, nextUnionEnd);
  const anchor = createDraftProofChangeAnchor({
    changeId: change.changeId,
    sceneId: change.sceneId,
    text: nextText,
    startOffset: unionStart,
    endOffset: unionStart + afterText.length,
    now,
    editId: transaction.editId,
  });
  return normalizeDraftProofChange({
    ...change,
    updatedAt: now,
    beforeText,
    afterText,
    originalStartOffset: baselineStart,
    originalEndOffset: baselineEnd,
    anchor,
    beforeHash: createStableTextHash(beforeText),
    afterHash: createStableTextHash(afterText),
    changeType: classifyDraftProofChangeType(beforeText, afterText),
  }, {
    runId: change.runId,
    iterationNumber: change.iterationNumber,
    sequence: change.sequence,
  });
}

function createDraftProofChangeAnchor({
  changeId,
  sceneId,
  text,
  startOffset,
  endOffset,
  now,
  editId,
}) {
  return createManuscriptAnchor({
    anchorId: `proofread-change-anchor:${changeId}`,
    sceneId,
    startOffset,
    endOffset,
    text,
    status: MANUSCRIPT_ANCHOR_STATUS.RESOLVED,
    lastTouchedAt: now,
    lastTouchedByEditId: editId,
  });
}

function normalizeDraftProofChange(candidate, {
  runId = "",
  iterationNumber = 1,
  sequence = 1,
} = {}) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const changeId = String(candidate.changeId ?? candidate.id ?? "").trim();
  const sceneId = String(candidate.sceneId ?? candidate.anchor?.sceneId ?? "").trim();
  if (!changeId || !sceneId) {
    return null;
  }
  const beforeText = String(candidate.beforeText ?? "");
  const afterText = String(candidate.afterText ?? "");
  const originalStartOffset = normalizeNonNegativeInteger(candidate.originalStartOffset);
  const originalEndOffset = Math.max(originalStartOffset, normalizeNonNegativeInteger(
    candidate.originalEndOffset ?? originalStartOffset + beforeText.length,
  ));
  const anchor = normalizeManuscriptAnchor(candidate.anchor, {
    defaultSceneId: sceneId,
    allowCollapsed: true,
  }) ?? createDraftProofChangeAnchor({
    changeId,
    sceneId,
    text: afterText,
    startOffset: 0,
    endOffset: afterText.length,
    now: candidate.updatedAt ?? candidate.createdAt ?? "",
    editId: "",
  });
  const statistics = calculateDraftProofChangeStatistics(beforeText, afterText);
  return {
    changeId,
    runId: String(candidate.runId ?? runId).trim() || runId,
    iterationNumber: normalizePositiveInteger(candidate.iterationNumber, iterationNumber),
    sequence: normalizePositiveInteger(candidate.sequence, sequence),
    sceneId,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    beforeText,
    afterText,
    originalStartOffset,
    originalEndOffset,
    anchor,
    beforeHash: typeof candidate.beforeHash === "string" && candidate.beforeHash
      ? candidate.beforeHash
      : createStableTextHash(beforeText),
    afterHash: typeof candidate.afterHash === "string" && candidate.afterHash
      ? candidate.afterHash
      : createStableTextHash(afterText),
    changeType: classifyDraftProofChangeType(beforeText, afterText),
    ...statistics,
    state: Object.values(DRAFT_PROOF_CHANGE_STATE).includes(candidate.state)
      ? candidate.state
      : DRAFT_PROOF_CHANGE_STATE.APPLIED,
    revertedAt: typeof candidate.revertedAt === "string" ? candidate.revertedAt : "",
    reappliedAt: typeof candidate.reappliedAt === "string" ? candidate.reappliedAt : "",
    burstClosedAt: typeof candidate.burstClosedAt === "string" ? candidate.burstClosedAt : "",
    lineage: normalizeDraftProofLineage(candidate.lineage),
  };
}

function calculateDraftProofChangeStatistics(beforeText, afterText) {
  const wordsRemoved = countDraftProofWords(beforeText);
  const wordsAdded = countDraftProofWords(afterText);
  return {
    wordsAdded,
    wordsRemoved,
    wordsChanged: Math.max(wordsRemoved, wordsAdded),
    netWordDelta: wordsAdded - wordsRemoved,
  };
}

function classifyDraftProofChangeType(beforeText, afterText) {
  if (!beforeText && afterText) {
    return "insertion";
  }
  if (beforeText && !afterText) {
    return "deletion";
  }
  return "replacement";
}

function canCoalesceDraftProofChange(change, transaction, now) {
  if (
    !change ||
    change.state !== DRAFT_PROOF_CHANGE_STATE.APPLIED ||
    Boolean(change.burstClosedAt) ||
    change.sceneId !== transaction.sceneId
  ) {
    return false;
  }
  const previousAt = Date.parse(change.updatedAt || change.createdAt);
  const currentAt = Date.parse(now || transaction.createdAt);
  if (
    Number.isFinite(previousAt) &&
    Number.isFinite(currentAt) &&
    currentAt - previousAt > LOGICAL_CHANGE_BURST_WINDOW_MS
  ) {
    return false;
  }
  const start = Number(change.anchor?.startOffset);
  const end = Number(change.anchor?.endOffset);
  return Number.isInteger(start) && Number.isInteger(end) && (
    transaction.startOffset <= end + 1 && transaction.endOffset >= Math.max(0, start - 1)
  );
}

function rangesOverlapForLineage(anchor, transaction) {
  const start = Number(anchor?.startOffset);
  const end = Number(anchor?.endOffset);
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return false;
  }
  if (start === end) {
    return transaction.startOffset <= start && transaction.endOffset >= start;
  }
  if (transaction.startOffset === transaction.endOffset) {
    return transaction.startOffset >= start && transaction.startOffset <= end;
  }
  return transaction.startOffset < end && transaction.endOffset > start;
}

function classifyDraftProofLineageRelation(anchor, transaction) {
  const start = Number(anchor?.startOffset);
  const end = Number(anchor?.endOffset);
  if (transaction.startOffset <= start && transaction.endOffset >= end) {
    return transaction.insertedLength > 0 ? "replaces" : "removes";
  }
  if (transaction.startOffset === transaction.endOffset) {
    return "extends";
  }
  return "overlaps";
}

function upsertDraftProofLineage(lineage, relationship) {
  const source = normalizeDraftProofLineage(lineage);
  const index = source.findIndex((candidate) => candidate.laterChangeId === relationship.laterChangeId);
  if (index < 0) {
    return [...source, relationship];
  }
  return source.map((candidate, candidateIndex) => candidateIndex === index
    ? { ...candidate, relation: relationship.relation }
    : candidate);
}

function normalizeDraftProofLineage(lineage) {
  return (Array.isArray(lineage) ? lineage : [])
    .map((candidate) => ({
      earlierChangeId: String(candidate?.earlierChangeId ?? "").trim(),
      laterChangeId: String(candidate?.laterChangeId ?? "").trim(),
      earlierRunId: String(candidate?.earlierRunId ?? "").trim(),
      laterRunId: String(candidate?.laterRunId ?? "").trim(),
      relation: ["overlaps", "replaces", "extends", "removes"].includes(candidate?.relation)
        ? candidate.relation
        : "overlaps",
      createdAt: typeof candidate?.createdAt === "string" ? candidate.createdAt : "",
    }))
    .filter((candidate) => candidate.earlierChangeId && candidate.laterChangeId && candidate.earlierRunId && candidate.laterRunId);
}

function resolveDraftProofExpectedTextLocation(change, sceneText, expectedText) {
  const source = String(sceneText ?? "");
  const expected = String(expectedText ?? "");
  const anchorStart = clampOffset(change.anchor?.startOffset, source.length);
  const anchorEnd = Math.min(source.length, anchorStart + expected.length);
  if (source.slice(anchorStart, anchorEnd) === expected && (
    expected || doesCollapsedDraftProofContextMatch(change.anchor, source, anchorStart)
  )) {
    return { startOffset: anchorStart, endOffset: anchorEnd };
  }

  if (!expected) {
    const candidates = [];
    for (let offset = 0; offset <= source.length; offset += 1) {
      if (doesCollapsedDraftProofContextMatch(change.anchor, source, offset)) {
        candidates.push(offset);
      }
    }
    return selectNearestUniqueOffset(candidates, anchorStart);
  }

  const candidates = [];
  let offset = source.indexOf(expected);
  while (offset >= 0) {
    candidates.push(offset);
    offset = source.indexOf(expected, offset + 1);
  }
  const selected = selectNearestUniqueOffset(candidates, anchorStart);
  return selected ? { startOffset: selected.startOffset, endOffset: selected.startOffset + expected.length } : null;
}

function doesCollapsedDraftProofContextMatch(anchor, source, offset) {
  const prefix = String(anchor?.prefixContext ?? "");
  const suffix = String(anchor?.suffixContext ?? "");
  if (!prefix && !suffix) {
    return false;
  }
  return (!prefix || source.slice(Math.max(0, offset - prefix.length), offset) === prefix)
    && (!suffix || source.slice(offset, offset + suffix.length) === suffix);
}

function selectNearestUniqueOffset(offsets, expectedOffset) {
  if (!offsets.length) {
    return null;
  }
  const ranked = offsets
    .map((startOffset) => ({ startOffset, endOffset: startOffset, distance: Math.abs(startOffset - expectedOffset) }))
    .sort((left, right) => left.distance - right.distance || left.startOffset - right.startOffset);
  if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) {
    return null;
  }
  return ranked[0];
}

function createDraftProofPreflightResult({
  action,
  run = null,
  change = null,
  safe = false,
  conflict = false,
  unresolved = false,
  reason = "",
  startOffset = null,
  endOffset = null,
  expectedText = "",
  replacementText = "",
  provenance = [],
}) {
  return {
    action: action === "redo" ? "redo" : "undo",
    runId: run?.id ?? "",
    changeId: change?.changeId ?? "",
    sequence: change?.sequence ?? 0,
    sceneId: change?.sceneId ?? "",
    safe,
    conflict,
    unresolved,
    reason,
    startOffset,
    endOffset,
    expectedText,
    replacementText,
    provenance,
    origin: DRAFT_PROOF_HISTORY_REPLAY_ORIGIN,
    sourceRunId: run?.id ?? "",
    sourceChangeId: change?.changeId ?? "",
  };
}

function resolveDraftProofChange(state, runId, changeId) {
  const run = state.runs.find((candidate) => candidate.id === String(runId ?? "").trim()) ?? null;
  const change = run?.changes.find((candidate) => candidate.changeId === String(changeId ?? "").trim()) ?? null;
  return run && change ? { run, change } : null;
}

function resolveSceneText(sceneTexts, sceneId) {
  if (typeof sceneTexts === "function") {
    const value = sceneTexts(sceneId);
    return typeof value === "string" ? value : null;
  }
  return sceneTexts && typeof sceneTexts === "object" && typeof sceneTexts[sceneId] === "string"
    ? sceneTexts[sceneId]
    : null;
}

function createDraftProofRunPreflightSummary(totalCount) {
  return {
    totalCount,
    safeCount: 0,
    changedByLaterProofreadCount: 0,
    changedOutsideProofreadCount: 0,
    unresolvedCount: 0,
  };
}

function countDraftProofWords(text) {
  return String(text ?? "").match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function formatDraftProofChangeId(runId, sequence) {
  return `${runId}-change-${String(sequence).padStart(4, "0")}`;
}

function resolveNextDraftProofChangeSequence(changes) {
  return (Array.isArray(changes) ? changes : []).reduce((maximum, change) => (
    Math.max(maximum, normalizePositiveInteger(change?.sequence, 0))
  ), 0) + 1;
}

function normalizePositiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function normalizeNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function closeDraftProofChangeBurst(run, now) {
  if (!run?.changeHistoryAvailable || !Array.isArray(run.changes) || !run.changes.length) {
    return run;
  }
  return {
    ...run,
    changes: run.changes.map((change, index) => index === run.changes.length - 1
      ? { ...change, burstClosedAt: now || change.updatedAt }
      : change),
  };
}

function normalizeDraftProofRun(candidate, fallbackSettings = createDefaultDraftProofSettings(), {
  sourceSchemaVersion = DRAFT_PROOFING_SCHEMA_VERSION,
} = {}) {
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

  const changeHistoryAvailable = candidate.changeHistoryAvailable === true
    || (candidate.changeHistoryAvailable !== false && sourceSchemaVersion >= DRAFT_PROOFING_SCHEMA_VERSION);
  const changes = changeHistoryAvailable && Array.isArray(candidate.changes)
    ? candidate.changes
      .map((change, index) => normalizeDraftProofChange(change, {
        runId: id,
        iterationNumber: Number.isInteger(candidate.iterationNumber) ? candidate.iterationNumber : extractDraftProofRunIteration(id),
        sequence: index + 1,
      }))
      .filter(Boolean)
    : [];

  return {
    id,
    label: typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : id,
    iterationNumber: Number.isInteger(candidate.iterationNumber) && candidate.iterationNumber > 0
      ? candidate.iterationNumber
      : extractDraftProofRunIteration(id),
    status,
    settings: normalizeDraftProofSettings(candidate.settings ?? fallbackSettings),
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    completedAt: typeof candidate.completedAt === "string" ? candidate.completedAt : "",
    resumePoint: normalizeDraftProofResumePoint(candidate.resumePoint),
    coverageByScene,
    changeHistoryAvailable,
    changes,
    changeSummary: changeHistoryAvailable
      ? summarizeDraftProofChanges(changes)
      : null,
  };
}

function normalizeDraftProofResumePoint(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const sceneId = typeof candidate.sceneId === "string" ? candidate.sceneId.trim() : "";
  if (!sceneId) {
    return null;
  }

  const startOffset = normalizeResumeOffset(candidate.startOffset);
  const endOffset = normalizeResumeOffset(candidate.endOffset);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    return null;
  }

  return {
    sceneId,
    startOffset: Math.min(startOffset, endOffset),
    endOffset: Math.max(startOffset, endOffset),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

function normalizeResumeOffset(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : null;
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

function resolveDraftProofRunByStatus(runs, {
  runId = "",
  status = "",
} = {}) {
  const targetRunId = String(runId ?? "").trim();
  const sourceRuns = Array.isArray(runs) ? runs : [];
  if (targetRunId) {
    const targetRun = sourceRuns.find((run) => run.id === targetRunId && run.status === status);
    return targetRun ?? null;
  }

  return [...sourceRuns].reverse().find((run) => run.status === status) ?? null;
}

function createDraftProofRunRecord(iteration, {
  now = new Date().toISOString(),
  label = "",
  settings = createDefaultDraftProofSettings(),
} = {}) {
  return {
    id: formatDraftProofRunId(iteration),
    label: String(label ?? "").trim() || `Draft proof ${iteration}`,
    iterationNumber: iteration,
    status: DRAFT_PROOF_RUN_STATUS.ACTIVE,
    settings: normalizeDraftProofSettings(settings),
    startedAt: now,
    updatedAt: now,
    completedAt: "",
    coverageByScene: {},
    changeHistoryAvailable: true,
    changes: [],
    changeSummary: summarizeDraftProofChanges([]),
  };
}

function formatDraftProofRunId(iteration) {
  return `draft-proof-run-${String(iteration).padStart(4, "0")}`;
}

function expandHexColor(value) {
  const raw = String(value ?? "").trim().replace(/^#/, "").toLowerCase();
  if (raw.length === 3) {
    return `#${raw.split("").map((character) => `${character}${character}`).join("")}`;
  }

  return `#${raw.padStart(6, "0").slice(0, 6)}`;
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

function serializeDraftProofColorPresets(colors) {
  return JSON.stringify(Array.isArray(colors) ? colors : []);
}

function serializeDraftProofHighlightIntensityByTheme(value) {
  const normalized = normalizeDraftProofHighlightIntensityByTheme(value);
  return JSON.stringify(normalized);
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
