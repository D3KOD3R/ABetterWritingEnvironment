// Intent: render project-level proof-read settings without owning persistence or editor effects.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";
import {
  DRAFT_PROOF_BACKDROP_COLOR_DEFAULT,
  DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX,
  DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN,
  resolveDraftProofSettingsRunId,
  normalizeDraftProofingState,
} from "./draft-proofing-service.js";

const DRAFT_PROOF_SETTINGS_WINDOW_SELECTOR = ".draft-proof-settings-window";
const DRAFT_PROOF_PANEL_SELECTOR = ".draft-proof-panel";
const DRAFT_PROOF_SETTINGS_TRIGGER_SELECTOR = '[data-action="open-proof-read-settings"]';

// Intent: keep click-away behavior scoped to the proof-read settings surface and its owning chrome control.
export function shouldCloseDraftProofSettingsWindowForClick(target) {
  if (!target || typeof target.closest !== "function") {
    return false;
  }

  return !target.closest(DRAFT_PROOF_SETTINGS_WINDOW_SELECTOR) &&
    !target.closest(DRAFT_PROOF_PANEL_SELECTOR) &&
    !target.closest(DRAFT_PROOF_SETTINGS_TRIGGER_SELECTOR);
}

export function buildDraftProofSettingsWindowModel({
  draftProofing = null,
  clearConfirmationArmed = false,
  selectedRunId = "",
  activeTheme = "light",
} = {}) {
  const normalized = normalizeDraftProofingState(draftProofing);
  const runs = normalized.runs;
  const resolvedSelectedRunId = resolveDraftProofSettingsRunId(normalized, selectedRunId);
  const selectedRun = runs.find((run) => run.id === resolvedSelectedRunId) ?? null;
  const selectedSettings = selectedRun?.settings ?? normalized.settings;
  const resolvedActiveTheme = normalizeDraftProofSettingsTheme(activeTheme);

  return {
    selectedRunId: selectedRun?.id ?? "",
    selectedRunLabel: selectedRun?.label ?? "Project default",
    activeTheme: resolvedActiveTheme,
    runOptions: runs.map((run) => ({
      id: run.id,
      label: formatDraftProofRunOptionLabel(run),
      active: run.id === selectedRun?.id,
    })),
    deleteRunOptions: runs.map((run) => ({
      id: run.id,
      label: formatDraftProofRunOptionLabel(run),
      coverageSummary: formatDraftProofRunCoverageSummary(run),
    })),
    backdropColor: selectedSettings.backdropColor,
    backdropColorPresets: selectedSettings.backdropColorPresets,
    recentBackdropColors: selectedSettings.recentBackdropColors,
    highlightIntensityControls: buildHighlightIntensityControls(
      selectedSettings.highlightIntensityByTheme,
      resolvedActiveTheme,
    ),
    defaultBackdropColor: DRAFT_PROOF_BACKDROP_COLOR_DEFAULT,
    runCount: runs.length,
    hasRunData: runs.length > 0,
    clearConfirmationArmed: clearConfirmationArmed === true,
  };
}

export function renderDraftProofSettingsWindowHTML(options = {}) {
  const model = buildDraftProofSettingsWindowModel(options);
  return `
    <section class="draft-proof-settings-window" role="dialog" aria-label="Proof read settings">
      <header class="draft-proof-settings-window__header">
        <div>
          <p class="draft-proof-settings-window__kicker">Project Settings</p>
          <h2>Proof Read</h2>
        </div>
        ${renderIterationSelect(model)}
        <button
          class="draft-proof-settings-window__close"
          type="button"
          data-action="close-proof-read-settings-window"
          aria-label="Close proof read settings"
          title="Close"
        >&times;</button>
      </header>

      <section class="draft-proof-settings-window__section">
        <span class="draft-proof-settings-window__label">Backdrop colour</span>
        <div class="draft-proof-settings-window__colour-row">
          <label class="draft-proof-settings-window__colour-control">
            <input
              type="color"
              value="${escapeHtml(model.backdropColor)}"
              data-draft-proof-setting="backdropColor"
              aria-label="Proof read backdrop colour"
            />
            <span style="--draft-proof-settings-swatch:${escapeHtml(model.backdropColor)};"></span>
            <strong>${escapeHtml(model.backdropColor)}</strong>
          </label>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="reset-draft-proof-backdrop-color"
            ${model.backdropColor === model.defaultBackdropColor ? "disabled" : ""}
          >Reset colour</button>
          <div class="draft-proof-settings-window__preset-group" aria-label="Proof read backdrop presets">
            ${model.backdropColorPresets.map((color, index) => renderBackdropPreset(color, index, model.backdropColor)).join("")}
          </div>
          <div class="draft-proof-settings-window__recent-group" aria-label="Recent custom proof read backdrop colours">
            ${model.recentBackdropColors.map((color, index) => renderRecentBackdropColor(color, index, model.backdropColor)).join("")}
          </div>
        </div>
      </section>

      <section class="draft-proof-settings-window__section">
        <span class="draft-proof-settings-window__label">Highlight strength</span>
        <div class="draft-proof-settings-window__intensity-grid">
          ${model.highlightIntensityControls.map(renderHighlightIntensityControl).join("")}
        </div>
      </section>

      <section class="draft-proof-settings-window__section draft-proof-settings-window__section--danger">
        <span class="draft-proof-settings-window__label">Version data</span>
        ${renderRunDeleteChecklist(model)}
        ${model.clearConfirmationArmed ? renderClearConfirmation(model) : renderClearRequest(model)}
      </section>
    </section>
  `;
}

// Intent: expose only the active editor theme's persisted proof-read intensity dial.
function buildHighlightIntensityControls(highlightIntensityByTheme = {}, activeTheme = "light") {
  const theme = normalizeDraftProofSettingsTheme(activeTheme);
  return [{
    theme,
    label: theme === "dark" ? "Dark theme" : "Light theme",
    value: normalizeDisplayIntensity(highlightIntensityByTheme[theme]),
  }];
}

function normalizeDraftProofSettingsTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function normalizeDisplayIntensity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN;
  }

  return Math.max(
    DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN,
    Math.min(Math.round(number), DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX),
  );
}

function renderHighlightIntensityControl(control) {
  return `
    <label class="draft-proof-settings-window__intensity-control">
      <span>
        <strong>${escapeHtml(control.label)}</strong>
        <output>${escapeHtml(`${control.value}%`)}</output>
      </span>
      <input
        type="range"
        min="${DRAFT_PROOF_HIGHLIGHT_INTENSITY_MIN}"
        max="${DRAFT_PROOF_HIGHLIGHT_INTENSITY_MAX}"
        step="1"
        value="${escapeHtml(String(control.value))}"
        data-draft-proof-setting="highlightIntensity"
        data-draft-proof-highlight-theme="${escapeHtml(control.theme)}"
        aria-label="${escapeHtml(`${control.label} proof read highlight strength`)}"
      />
    </label>
  `;
}

// Intent: make the edited proof-read visual setting explicit when a project has multiple iterations.
function renderIterationSelect(model) {
  const options = model.runOptions.length
    ? model.runOptions.map((run) => `
        <option value="${escapeHtml(run.id)}" ${run.active ? "selected" : ""}>${escapeHtml(run.label)}</option>
      `).join("")
    : `<option value="">No proof-read runs</option>`;

  return `
    <label class="draft-proof-settings-window__iteration-control">
      <span>Iteration</span>
      <select
        data-draft-proof-settings-run
        aria-label="Proof read iteration"
        ${model.runOptions.length ? "" : "disabled"}
      >${options}</select>
    </label>
  `;
}

function formatDraftProofRunOptionLabel(run) {
  const iteration = Number(run?.iterationNumber);
  const fallback = typeof run?.label === "string" && run.label.trim() ? run.label.trim() : "Draft proof";
  const base = Number.isInteger(iteration) && iteration > 0
    ? `Draft proof ${formatDisplayNumber(iteration)}`
    : fallback;
  const status = formatDraftProofRunStatus(run?.status);
  return status ? `${base} - ${status}` : base;
}

function formatDraftProofRunStatus(status) {
  if (status === "active") {
    return "Active";
  }
  if (status === "paused") {
    return "Paused";
  }
  if (status === "completed") {
    return "Completed";
  }

  return "";
}

function formatDraftProofRunCoverageSummary(run) {
  const coverageByScene = run?.coverageByScene && typeof run.coverageByScene === "object" && !Array.isArray(run.coverageByScene)
    ? run.coverageByScene
    : {};
  const scenes = Object.values(coverageByScene).filter((spans) => Array.isArray(spans) && spans.length > 0).length;
  const spans = Object.values(coverageByScene).reduce((total, sceneSpans) =>
    total + (Array.isArray(sceneSpans) ? sceneSpans.length : 0), 0);
  return `${formatDisplayNumber(scenes)} scene${scenes === 1 ? "" : "s"} - ${formatDisplayNumber(spans)} span${spans === 1 ? "" : "s"}`;
}

// Intent: render recently committed custom backdrop colours without exposing them as editable preset slots.
function renderRecentBackdropColor(color, index, activeColor) {
  const recentNumber = index + 1;
  const active = color === activeColor;
  return `
    <button
      class="draft-proof-settings-window__preset-button draft-proof-settings-window__recent-button ${active ? "is-active" : ""}"
      type="button"
      data-action="set-draft-proof-backdrop-recent"
      data-draft-proof-recent-index="${index}"
      aria-label="${escapeHtml(`Use recent custom proof read backdrop ${recentNumber}`)}"
      aria-pressed="${active ? "true" : "false"}"
      title="${escapeHtml(`Use recent custom ${recentNumber}`)}"
      style="--draft-proof-settings-preset:${escapeHtml(color)};"
    ><span aria-hidden="true"></span></button>
  `;
}

// Intent: keep proof-read settings focused on editable visual controls rather than run data summaries.
function renderBackdropPreset(color, index, activeColor) {
  const presetNumber = index + 1;
  const active = color === activeColor;
  return `
    <div class="draft-proof-settings-window__preset-control">
      <button
        class="draft-proof-settings-window__preset-button ${active ? "is-active" : ""}"
        type="button"
        data-action="set-draft-proof-backdrop-preset"
        data-draft-proof-preset-index="${index}"
        aria-label="${escapeHtml(`Use proof read backdrop preset ${presetNumber}`)}"
        aria-pressed="${active ? "true" : "false"}"
        title="${escapeHtml(`Use preset ${presetNumber}`)}"
        style="--draft-proof-settings-preset:${escapeHtml(color)};"
      ><span aria-hidden="true"></span></button>
      <input
        class="draft-proof-settings-window__preset-editor"
        type="color"
        value="${escapeHtml(color)}"
        data-draft-proof-preset-index="${index}"
        aria-label="${escapeHtml(`Change proof read backdrop preset ${presetNumber}`)}"
        title="${escapeHtml(`Edit preset ${presetNumber}`)}"
      />
    </div>
  `;
}

// Intent: expose targeted proof-read run deletion without replacing the guarded clear-all path.
function renderRunDeleteChecklist(model) {
  if (!model.deleteRunOptions.length) {
    return `<p class="draft-proof-settings-window__empty">No proof-read iterations</p>`;
  }

  return `
    <div class="draft-proof-settings-window__delete-list" role="group" aria-label="Proof read iterations">
      ${model.deleteRunOptions.map((run) => `
        <label class="draft-proof-settings-window__delete-option">
          <input
            type="checkbox"
            value="${escapeHtml(run.id)}"
            data-draft-proof-delete-run-id="${escapeHtml(run.id)}"
          />
          <span>
            <strong>${escapeHtml(run.label)}</strong>
            <small>${escapeHtml(run.coverageSummary)}</small>
          </span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderClearRequest(model) {
  return `
    <div class="draft-proof-settings-window__danger-actions">
      <button
        class="tag-button panel-action-button draft-proof-settings-window__danger-button"
        type="button"
        data-action="delete-selected-draft-proof-runs"
        ${model.hasRunData ? "" : "disabled"}
      >Delete selected iterations</button>
      <button
        class="tag-button panel-action-button draft-proof-settings-window__danger-button"
        type="button"
        data-action="request-clear-draft-proof-data"
        ${model.hasRunData ? "" : "disabled"}
      >Clear all proof-read data</button>
    </div>
  `;
}

function renderClearConfirmation(model) {
  return `
    <div class="draft-proof-settings-window__danger-actions is-armed">
      <span>${escapeHtml(formatDisplayNumber(model.runCount))} run${model.runCount === 1 ? "" : "s"} will be deleted.</span>
      <button
        class="tag-button panel-action-button draft-proof-settings-window__danger-button"
        type="button"
        data-action="clear-draft-proof-data"
      >Confirm clear</button>
      <button
        class="tag-button panel-action-button"
        type="button"
        data-action="cancel-clear-draft-proof-data"
      >Cancel</button>
    </div>
  `;
}
