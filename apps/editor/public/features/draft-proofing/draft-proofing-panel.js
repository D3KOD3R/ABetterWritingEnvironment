// Intent: render draft proof-read controls for the top chrome without owning run mutations.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";
import { DRAFT_PROOF_RUN_STATUS } from "./draft-proofing-service.js";

export function buildDraftProofPanelModel(draftProofing = {}) {
  const runs = Array.isArray(draftProofing?.runs) ? draftProofing.runs : [];
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
    hasCurrentRun: Boolean(currentRun),
    label: activeRun ? "Pause" : pausedRun ? "Resume proof" : "Start proof read",
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
  };
}

export function renderDraftProofPanel(state = {}) {
  const model = buildDraftProofPanelModel(state?.draftProofing);
  return `
    <section class="draft-proof-panel ${model.active ? "is-active" : ""}" aria-label="Draft proof-read controls">
      <div class="draft-proof-panel__copy">
        <span class="draft-proof-panel__eyebrow">Proof read</span>
        <strong class="draft-proof-panel__status">${escapeHtml(model.statusLabel)}</strong>
        <span class="draft-proof-panel__meta">${escapeHtml(model.runLabel)} · ${escapeHtml(model.coverageLabel)}</span>
      </div>
      <div class="draft-proof-panel__actions">
        <button
          class="tag-button panel-action-button draft-proof-panel__button draft-proof-panel__button--primary"
          type="button"
          data-action="toggle-draft-proof-run"
          aria-pressed="${model.active ? "true" : "false"}"
          title="Track proof-read coverage while working through the manuscript"
        >${escapeHtml(model.label)}</button>
        ${model.hasCurrentRun ? `
          <button
            class="tag-button panel-action-button draft-proof-panel__button"
            type="button"
            data-action="complete-draft-proof-run"
            title="Finish the current proof-read run"
          >Finish</button>
        ` : ""}
      </div>
    </section>
  `;
}
