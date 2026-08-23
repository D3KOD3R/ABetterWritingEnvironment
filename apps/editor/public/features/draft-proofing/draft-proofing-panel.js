// Intent: render draft proof-read controls for the top chrome without owning run mutations.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";
import { DRAFT_PROOF_RUN_STATUS } from "./draft-proofing-service.js";

export function buildDraftProofPanelModel(draftProofing = {}, options = {}) {
  const runs = Array.isArray(draftProofing?.runs) ? draftProofing.runs : [];
  const markersVisible = options?.markersVisible === true;
  const activeRun = runs.find((run) =>
    run?.id === draftProofing?.activeRunId && run?.status === DRAFT_PROOF_RUN_STATUS.ACTIVE
  ) ?? null;
  const pausedRun = [...runs].reverse().find((run) => run?.status === DRAFT_PROOF_RUN_STATUS.PAUSED) ?? null;
  const latestCompletedRun = [...runs]
    .reverse()
    .find((run) => run?.status === DRAFT_PROOF_RUN_STATUS.COMPLETED) ?? null;
  const currentRun = activeRun ?? pausedRun;
  const displayRun = currentRun ?? latestCompletedRun;
  const coveredSceneCount = displayRun?.coverageByScene && typeof displayRun.coverageByScene === "object"
    ? Object.keys(displayRun.coverageByScene).length
    : 0;
  const coveredSpanCount = displayRun?.coverageByScene && typeof displayRun.coverageByScene === "object"
    ? Object.values(displayRun.coverageByScene).reduce((total, spans) =>
        total + (Array.isArray(spans) ? spans.length : 0), 0)
    : 0;

  return {
    active: Boolean(activeRun),
    paused: Boolean(pausedRun && !activeRun),
    completed: Boolean(latestCompletedRun && !currentRun),
    hasCurrentRun: Boolean(currentRun),
    canToggleRun: Boolean(activeRun || pausedRun || (!currentRun && latestCompletedRun)),
    canStartNewRun: !activeRun,
    label: activeRun
      ? "Pause proof read"
      : pausedRun
        ? "Resume proof read"
        : latestCompletedRun
          ? "Continue proof read run"
          : "New proof read run",
    runToggleLabel: activeRun
      ? "Pause proof read"
      : pausedRun
        ? "Resume proof read"
        : "Continue proof read run",
    runToggleIcon: activeRun ? "pause" : "play",
    newRunLabel: "New proof read run",
    statusLabel: activeRun
      ? "Active"
      : pausedRun
        ? "Paused"
        : latestCompletedRun
          ? "Completed"
          : "Ready",
    runLabel: displayRun?.label ?? "No run",
    coverageLabel: displayRun
      ? `${formatDisplayNumber(coveredSceneCount)} scene${coveredSceneCount === 1 ? "" : "s"} · ${formatDisplayNumber(coveredSpanCount)} span${coveredSpanCount === 1 ? "" : "s"}`
      : "No coverage yet",
    markersVisible,
    markerToggleLabel: markersVisible ? "Hide proof-read marks" : "Show proof-read marks",
  };
}

export function renderDraftProofPanel(state = {}) {
  const model = buildDraftProofPanelModel(state?.draftProofing, {
    markersVisible: state?.draftProofMarksVisible === true,
  });
  return `
    <section class="draft-proof-panel ${model.active ? "is-active" : ""}" aria-label="Draft proof-read controls">
      <div class="draft-proof-panel__copy">
        <span class="draft-proof-panel__eyebrow">Proof read</span>
        <strong class="draft-proof-panel__status">${escapeHtml(model.statusLabel)}</strong>
        <span class="draft-proof-panel__meta">${escapeHtml(model.runLabel)} · ${escapeHtml(model.coverageLabel)}</span>
      </div>
      <div class="draft-proof-panel__actions">
        <button
          class="tag-button panel-action-button draft-proof-panel__button draft-proof-panel__icon-button draft-proof-panel__eye-button ${model.markersVisible ? "is-visible" : ""}"
          type="button"
          data-action="toggle-draft-proof-markers"
          aria-label="${escapeHtml(model.markerToggleLabel)}"
          aria-pressed="${model.markersVisible ? "true" : "false"}"
          title="${escapeHtml(model.markerToggleLabel)}"
        ><span class="draft-proof-panel__eye-icon" aria-hidden="true"></span></button>
        <button
          class="tag-button panel-action-button draft-proof-panel__button draft-proof-panel__icon-button draft-proof-panel__settings-button"
          type="button"
          data-action="open-proof-read-settings"
          aria-label="Proof read settings"
          title="Proof read settings"
        ><span class="draft-proof-panel__pen-icon" aria-hidden="true"></span></button>
        ${model.canToggleRun ? `
          <button
            class="tag-button panel-action-button draft-proof-panel__button draft-proof-panel__icon-button draft-proof-panel__run-button"
            type="button"
            data-action="toggle-draft-proof-run"
            aria-label="${escapeHtml(model.runToggleLabel)}"
            aria-pressed="${model.active ? "true" : "false"}"
            title="${escapeHtml(model.runToggleLabel)}"
          ><span class="draft-proof-panel__${escapeHtml(model.runToggleIcon)}-icon" aria-hidden="true"></span></button>
        ` : ""}
        <button
          class="tag-button panel-action-button draft-proof-panel__button draft-proof-panel__icon-button draft-proof-panel__new-run-button"
          type="button"
          data-action="start-draft-proof-run"
          aria-label="${escapeHtml(model.newRunLabel)}"
          title="${escapeHtml(model.newRunLabel)}"
          ${model.canStartNewRun ? "" : "disabled"}
        ><span class="draft-proof-panel__new-run-icon" aria-hidden="true"></span></button>
        ${model.hasCurrentRun ? `
          <button
            class="tag-button panel-action-button draft-proof-panel__button"
            type="button"
            data-action="complete-draft-proof-run"
            title="Finish proof read"
          >Finish</button>
        ` : ""}
      </div>
    </section>
  `;
}
