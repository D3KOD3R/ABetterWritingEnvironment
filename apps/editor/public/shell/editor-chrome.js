// Intent: render the top-level editor chrome without owning editor state or persistence.
import { renderWritingTargetStrip } from "../features/progress-tracker.js";
import { renderDraftProofPanel } from "../features/draft-proofing/draft-proofing-panel.js";
import { renderTopPanelCustomizationPopoverHTML } from "../features/top-panel-customization/top-panel-customization.js";
import {
  renderSpotifyDeveloperOptionsHTML,
  renderSpotifyMusicChromeHTML,
} from "../features/spotify-music/spotify-music-service.js";
import { buildProjectAutosaveStatusModel } from "../shared/project-autosave-status.js";
import { escapeHtml, formatDisplayNumber } from "../shared/ui-utils.js";
import {
  APPEARANCE_MODE_OPTIONS,
  normalizeEditorAppearanceMode,
} from "../editor-model.js";
import {
  getEffectiveKeyboardShortcutsForBehavior,
  getKeyboardShortcutBehavior,
} from "../state/keyboard-shortcut-state.js";
import {
  getTopPanelVisibilityForPane,
  isTopPanelCardVisible,
} from "../state/editor-ui-state.js";

const RECENT_PROJECT_MENU_LIMIT = 5;
const APPEARANCE_MODE_LABELS = Object.freeze({
  light: "Light mode",
  dark: "Dark mode",
  system: "Follow system appearance",
});

export function renderEditorChrome({
  state,
  workspace,
  writingTargetSummary,
  projectFileAutosaveConnected = false,
  projectFileDisplay,
  getSuggestedProjectFilePath,
}) {
  const projectWorkspace = workspace ?? state?.workspace ?? null;
  const activePane = state?.activePane ?? "manuscript";
  const proofReadAvailable = activePane === "manuscript";
  const chromeWritingTargetSummary = buildChromeWritingTargetSummary(activePane, writingTargetSummary);
  const topPanelVisibility = getTopPanelVisibilityForPane(state?.topPanelVisibility ?? {}, activePane);
  // Intent: collapse the status-card strip when every configurable card is hidden.
  const chromeStatCardsHTML = renderChromeStatCards({
    state,
    summary: writingTargetSummary,
    projectFileAutosaveConnected,
    topPanelVisibility,
  });
  const chromeStatStripIsEmpty = !chromeStatCardsHTML.trim();
  const safeProjectFileDisplay = projectFileDisplay ?? {
    inputValue: state?.projectFilePath ?? "",
    pathLabel: state?.projectFilePath ?? "",
    tooltip: "No project file selected",
  };
  return `
    <header class="desktop-chrome">
      <div class="desktop-menubar">
        <div class="desktop-menu-cluster">
          <div
            class="file-menu project-file-tooltip ${state.fileMenuOpen ? "is-open" : ""}"
            data-file-menu
            data-file-path-tooltip="${escapeHtml(safeProjectFileDisplay.tooltip)}"
          >
            <button
              class="menu-button"
              type="button"
              data-action="toggle-file-menu"
              aria-expanded="${state.fileMenuOpen ? "true" : "false"}"
              aria-haspopup="menu"
            >File</button>
            ${state.fileMenuOpen ? renderFileMenu({
              state,
              projectFileAutosaveConnected,
              projectFileDisplay: safeProjectFileDisplay,
              getSuggestedProjectFilePath,
            }) : ""}
          </div>
          ${renderProjectSettingsControl(state, { proofReadAvailable })}
          <div class="desktop-title-cluster">
            <span class="desktop-app-name">A Better Novel Authoring Environment</span>
            <div class="desktop-title-tools" role="group" aria-label="Environment and layout controls">
              ${renderDeveloperOptionsControl(state)}
              ${renderAppearanceModeControl(state)}
              ${renderSidePanelsFocusToggle(state)}
            </div>
          </div>
        </div>
        <div class="desktop-menubar-center">
          <nav class="workspace-tabs" aria-label="Workspace panes">
            ${renderPaneTab("manuscript", "Manuscript", projectWorkspace?.settings?.executionMode ?? "local", activePane)}
            ${renderPaneTab("world", "World", "Spines and templates", activePane)}
            ${renderPaneTab("narration", "Narration + Voice", "Whisper follow-track", activePane)}
          </nav>
          ${renderSpotifyMusicChromeHTML({
            state: state?.spotifyMusic,
            open: state?.spotifyMusicPanelOpen === true,
          })}
          ${renderLocalAiSetting(state)}
        </div>
        <div
          class="desktop-stat-strip ${chromeStatStripIsEmpty ? "is-empty" : ""}"
          aria-label="Project statistics"
          data-top-panel-customization-region="chrome-stats"
          data-top-panel-region-empty="${chromeStatStripIsEmpty ? "true" : "false"}"
        >
          ${chromeStatStripIsEmpty ? renderTopPanelRestoreTarget("chrome-stats", "Restore status cards") : chromeStatCardsHTML}
        </div>
      </div>
      ${renderWritingTargetStrip(chromeWritingTargetSummary, {
        leadingPanelHTML: renderLeadingTargetStripCards({
          state,
          summary: writingTargetSummary,
          proofReadAvailable,
          topPanelVisibility,
        }),
        isMetricVisible: (metricKey) => isTopPanelCardVisible(topPanelVisibility, metricKey),
        wrapMetricCard: ({ cardId, label, html }) => renderTopPanelCardShell(cardId, label, html),
        renderEmptyRegion: ({ groupId, label }) => renderTopPanelRestoreTarget(groupId, label),
      })}
      ${renderTopPanelCustomizationPopoverHTML({
        open: state?.topPanelCustomizationOpen === true,
        groupId: state?.topPanelCustomizationGroupId ?? "",
        activePane,
        position: state?.topPanelCustomizationPosition ?? null,
        visibility: topPanelVisibility,
      })}
    </header>
  `;
}

// Intent: keep test-build-only setup controls behind the environment badge so normal author UI stays focused.
function renderDeveloperOptionsControl(state = {}) {
  const open = state?.developerOptionsMenuOpen === true;
  return `
    <div
      class="developer-options-menu ${open ? "is-open" : ""}"
      data-developer-options-menu
    >
      <button
        class="desktop-environment-badge desktop-environment-badge--button"
        type="button"
        data-action="toggle-developer-options-menu"
        aria-expanded="${open ? "true" : "false"}"
        aria-haspopup="menu"
        aria-label="Open developer options"
        title="Open developer options"
      >Version: Test</button>
      ${open ? `
        <div class="file-menu-panel developer-options-menu-panel" role="menu" aria-label="Developer options menu">
          <div class="file-menu-section">
            ${renderSpotifyDeveloperOptionsHTML({ state: state?.spotifyMusic })}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

// Intent: keep collapsed top-panel regions easy to reopen without reserving card-sized whitespace.
function renderTopPanelRestoreTarget(groupId, label) {
  const normalizedGroupId = String(groupId ?? "").trim();
  if (!normalizedGroupId) {
    return "";
  }

  const safeLabel = label || "Restore hidden cards";
  return `
    <button
      class="top-panel-restore-target"
      type="button"
      data-top-panel-restore-target="${escapeHtml(normalizedGroupId)}"
      aria-label="${escapeHtml(safeLabel)}"
      title="${escapeHtml(safeLabel)}"
    ><span class="top-panel-restore-icon" aria-hidden="true"></span></button>
  `;
}

// Intent: keep the target-strip leading cards configurable without moving proof-read or log behavior into this shell.
function renderLeadingTargetStripCards({
  state,
  summary,
  proofReadAvailable = false,
  topPanelVisibility = {},
} = {}) {
  return [
    proofReadAvailable && isTopPanelCardVisible(topPanelVisibility, "draftProof")
      ? renderTopPanelCardShell("draftProof", "Proof read", renderDraftProofPanel(state))
      : "",
    isTopPanelCardVisible(topPanelVisibility, "developerLogs")
      ? renderTopPanelCardShell("developerLogs", "Developer logs", renderDeveloperLogsControl(summary))
      : "",
  ].join("");
}

// Intent: keep top status-card visibility separate from writing-target metric preferences.
function renderChromeStatCards({
  state,
  summary,
  projectFileAutosaveConnected = false,
  topPanelVisibility = {},
} = {}) {
  return [
    renderBenchedLinesStat(),
    isTopPanelCardVisible(topPanelVisibility, "autosave")
      ? renderTopPanelCardShell("autosave", "Autosave", renderChromeAutosaveIndicator(buildProjectAutosaveIndicatorModel(state, projectFileAutosaveConnected)))
      : "",
    isTopPanelCardVisible(topPanelVisibility, "writingGoals")
      ? renderTopPanelCardShell("writingGoals", "Writing Goals", renderWritingTargetToggle(state, summary))
      : "",
    isTopPanelCardVisible(topPanelVisibility, "revisions")
      ? renderTopPanelCardShell("revisions", "Revisions", renderRevisionToggle(state))
      : "",
  ].join("");
}

// BENCHED: the top Lines stat is not useful enough for the main chrome, but renderStat remains available for later revival.
function renderBenchedLinesStat() {
  return "";
}

// Intent: give each configurable top card its own hide affordance without changing the card's feature-owned markup.
function renderTopPanelCardShell(cardId, label, contentHTML) {
  const normalizedCardId = String(cardId ?? "").trim();
  if (!normalizedCardId || typeof contentHTML !== "string" || !contentHTML.trim()) {
    return "";
  }

  const safeLabel = label || normalizedCardId;
  return `
    <div class="top-panel-card-shell" data-top-panel-card="${escapeHtml(normalizedCardId)}">
      <button
        class="top-panel-card-hide-button"
        type="button"
        data-action="hide-top-panel-card"
        data-top-panel-card-id="${escapeHtml(normalizedCardId)}"
        aria-label="Hide ${escapeHtml(safeLabel)}"
        title="Hide ${escapeHtml(safeLabel)}"
      ><span class="top-panel-card-hide-icon" aria-hidden="true"></span></button>
      ${contentHTML}
    </div>
  `;
}

// Intent: keep project and user settings available while scoping manuscript-only actions by pane.
function renderProjectSettingsControl(state, { proofReadAvailable = false } = {}) {
  return `
    <div
      class="project-settings-menu ${state.projectSettingsMenuOpen ? "is-open" : ""}"
      data-project-settings-menu
    >
      <button
        class="menu-button"
        type="button"
        data-action="toggle-project-settings-menu"
        aria-expanded="${state.projectSettingsMenuOpen ? "true" : "false"}"
        aria-haspopup="menu"
      >Project</button>
      ${state.projectSettingsMenuOpen ? renderProjectSettingsMenu(state, { proofReadAvailable }) : ""}
    </div>
  `;
}

// Intent: hide manuscript-session-specific metrics outside Manuscript without changing saved metric preferences.
function buildChromeWritingTargetSummary(activePane, summary) {
  if (activePane === "manuscript" || !summary || !Array.isArray(summary.visibleMetrics)) {
    return summary;
  }

  return {
    ...summary,
    visibleMetrics: summary.visibleMetrics.filter((metric) => metric?.key !== "sessionTracker"),
  };
}

// Intent: keep project settings discoverable from the top chrome while feature windows own their markup.
function renderProjectSettingsMenu(state = {}, { proofReadAvailable = false } = {}) {
  const milestoneSoundEffectsEnabled = state?.editorPrefs?.milestoneSoundEffectsEnabled !== false;
  return `
    <div class="file-menu-panel project-settings-menu-panel" role="menu" aria-label="Project settings menu">
      <div class="file-menu-section">
        <span class="file-menu-label">Project Settings</span>
        <div class="file-menu-actions project-settings-actions">
          ${proofReadAvailable ? `
            <button
              class="tag-button panel-action-button"
              type="button"
              data-action="open-proof-read-settings"
            >Proof read</button>
          ` : ""}
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="open-local-ai-panel"
          >Local AI</button>
        </div>
      </div>
      <div class="file-menu-section">
        <span class="file-menu-label">User Settings</span>
        <div class="file-menu-actions project-settings-actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="open-keyboard-shortcut-settings"
          >Shortcuts</button>
          <label class="project-file-autosave-setting">
            <input
              type="checkbox"
              data-editor-pref="milestoneSoundEffectsEnabled"
              ${milestoneSoundEffectsEnabled ? "checked" : ""}
            />
            <span>Milestone sounds</span>
            <strong>${milestoneSoundEffectsEnabled ? "On" : "Off"}</strong>
            <small>Catalogue, session, and daily target completions.</small>
          </label>
        </div>
      </div>
    </div>
  `;
}

// Intent: keep the file menu markup together so file-related controls can evolve independently.
function renderFileMenu({
  state,
  projectFileAutosaveConnected,
  projectFileDisplay,
  getSuggestedProjectFilePath,
}) {
  const projectFilePathLabel = projectFileDisplay?.pathLabel ?? state.projectFilePath ?? "";
  const recentProjects = buildRecentProjectMenuItems(state);
  const projectFileStatus = state.projectFileStatus
    ? state.projectFileStatus
    : projectFilePathLabel
      ? `Path: ${projectFilePathLabel}`
      : "No project path selected.";

  return `
    <div class="file-menu-panel" role="menu" aria-label="Project menu">
      <div class="file-menu-section">
        <span class="file-menu-label">Project</span>
        <label class="project-file-shell compact">
          <span>Path</span>
          <input
            type="text"
            value="${escapeHtml(projectFileDisplay?.inputValue ?? state.projectFilePath)}"
            data-edit-field="project-file-path"
            placeholder="${escapeHtml(getSuggestedProjectFilePath())}"
            aria-label="Project path"
            spellcheck="false"
          />
        </label>
        <div class="file-menu-actions project-file-actions">
          <button
            class="panel-action-button project-menu-button"
            type="button"
            data-action="create-project"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            New project
          </button>
          <div class="project-load-menu">
            <button
              class="panel-action-button project-menu-button project-load-menu__trigger"
              type="button"
              data-action="load-project-file"
              ${state.projectFileBusy ? "disabled" : ""}
              aria-haspopup="menu"
            >
              Load project
            </button>
            ${renderRecentProjectMenu(recentProjects, state)}
          </div>
          <button
            class="panel-action-button project-menu-button"
            type="button"
            data-action="import-scrivener-project"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            Port Scrivener
          </button>
          <button
            class="panel-action-button project-menu-button"
            type="button"
            data-action="save-project"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            Save
          </button>
        </div>
        ${renderProjectFileAutosaveSetting(state, projectFileAutosaveConnected)}
        <p class="project-file-status">
          ${escapeHtml(projectFileStatus)}
        </p>
      </div>
    </div>
  `;
}

// Intent: expose recently loaded project records without adding another persistence path.
function renderRecentProjectMenu(recentProjects, state) {
  if (!Array.isArray(recentProjects) || !recentProjects.length) {
    return "";
  }

  return `
    <div class="project-recent-menu" role="menu" aria-label="Recent loaded projects">
      <span class="project-recent-menu__label">Recent projects</span>
      ${recentProjects.map((project) => `
        <button
          class="project-recent-menu__item ${project.id === state.activeProjectId ? "is-active" : ""}"
          type="button"
          data-action="load-project"
          data-project-id="${escapeHtml(project.id)}"
          title="${escapeHtml(project.tooltip)}"
        >
          <span>${escapeHtml(project.title)}</span>
          <small>${escapeHtml(project.pathLabel)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

// Intent: derive the visible recent-project list from durable project records only.
function buildRecentProjectMenuItems(state) {
  const projects = Array.isArray(state?.projectLibrary) ? state.projectLibrary : [];
  const activeProjectId = typeof state?.activeProjectId === "string" ? state.activeProjectId.trim() : "";
  return projects
    .map((project, index) => {
      const id = typeof project?.id === "string" ? project.id.trim() : "";
      if (!id) {
        return null;
      }

      const title = formatProjectLibraryLabel(project);
      const pathLabel = formatProjectPathLabel(project);
      return {
        id,
        title,
        pathLabel,
        tooltip: pathLabel === "No project path recorded" ? title : `${title} - ${pathLabel}`,
        isActive: id === activeProjectId,
        sortTime: resolveProjectSortTime(project),
        index,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || (right.sortTime - left.sortTime) || (left.index - right.index))
    .slice(0, RECENT_PROJECT_MENU_LIMIT);
}

function resolveProjectSortTime(project) {
  const updatedAtMs = Date.parse(project?.updatedAt ?? "");
  if (Number.isFinite(updatedAtMs)) {
    return updatedAtMs;
  }

  const createdAtMs = Date.parse(project?.createdAt ?? "");
  return Number.isFinite(createdAtMs) ? createdAtMs : 0;
}

function formatProjectPathLabel(project) {
  const projectSettings = project?.projectSettings && typeof project.projectSettings === "object"
    ? project.projectSettings
    : {};
  const path = typeof projectSettings.projectFilePath === "string" && projectSettings.projectFilePath.trim()
    ? projectSettings.projectFilePath.trim()
    : typeof project?.projectFilePath === "string" && project.projectFilePath.trim()
      ? project.projectFilePath.trim()
      : "";
  return path || "No project path recorded";
}

// Intent: keep project library labels stable and readable in the file menu.
function formatProjectLibraryLabel(project) {
  return typeof project?.title === "string" && project.title.trim()
    ? project.title
    : "Untitled Project";
}

// Intent: keep small chrome controls local to the shell module instead of spreading them across app.js.
function renderLocalAiSetting(state) {
  const enabled = state.localAiPrefs.enabled;
  return `
    <div class="local-ai-cluster">
      <label class="local-ai-setting">
        <input
          type="checkbox"
          data-local-ai-setting="enabled"
          ${enabled ? "checked" : ""}
        />
        <span>Local AI</span>
        <strong>${enabled ? "Titles on" : "Titles off"}</strong>
      </label>
      <button
        class="local-ai-model-button"
        type="button"
        data-action="open-local-ai-panel"
        title="Open Local AI model settings"
        aria-label="Open Local AI model settings"
      >Models</button>
    </div>
  `;
}

// Intent: expose the editor appearance as a compact mode switch without making theme a manuscript setting.
function renderAppearanceModeControl(state) {
  const activeMode = normalizeEditorAppearanceMode(state?.editorPrefs?.appearanceMode);
  return `
    <div class="appearance-mode-control" role="group" aria-label="Editor appearance">
      ${APPEARANCE_MODE_OPTIONS.map((mode) => {
        const label = APPEARANCE_MODE_LABELS[mode] ?? mode;
        const isActive = mode === activeMode;
        return `
          <button
            class="appearance-mode-button ${isActive ? "is-active" : ""}"
            type="button"
            data-action="set-appearance-mode"
            data-appearance-mode="${escapeHtml(mode)}"
            aria-label="${escapeHtml(label)}"
            aria-pressed="${isActive ? "true" : "false"}"
            title="${escapeHtml(label)}"
          ><span class="appearance-mode-icon appearance-mode-icon--${escapeHtml(mode)}" aria-hidden="true"></span></button>
        `;
      }).join("")}
    </div>
  `;
}

// Intent: expose side-rail focus mode as an icon-only control that stays available on every workspace page.
function renderSidePanelsFocusToggle(state) {
  const sidePanelsHidden = state?.sidePanelsHidden === true;
  const label = sidePanelsHidden ? "Show side panels" : "Hide side panels";
  return `
    <button
      class="side-panels-focus-toggle ${sidePanelsHidden ? "is-active" : ""}"
      type="button"
      data-action="toggle-side-panels-hidden"
      aria-pressed="${sidePanelsHidden ? "true" : "false"}"
      aria-label="${escapeHtml(label)}"
      title="${escapeHtml(label)}"
    >
      <span class="side-panels-focus-toggle__icon" aria-hidden="true"></span>
    </button>
  `;
}

// Intent: keep autosave state beside top-level project stats rather than in the lower target strip.
function renderChromeAutosaveIndicator(indicator) {
  return `
    <div
      class="project-autosave-indicator ${escapeHtml(indicator.toneClass)}"
      data-project-autosave-indicator
      data-status-key="${escapeHtml(indicator.statusKey)}"
      title="${escapeHtml(indicator.note)}"
    >
      <span class="project-autosave-indicator__label">${escapeHtml(indicator.label)}</span>
      <strong class="project-autosave-indicator__status" data-project-autosave-status>${escapeHtml(indicator.statusLabel)}</strong>
      <span class="project-autosave-indicator__note" data-project-autosave-note>${escapeHtml(indicator.note)}</span>
    </div>
  `;
}

// Intent: keep developer diagnostics available beside proof-read controls without pulling them into writing metrics.
function renderDeveloperLogsControl(summary) {
  const debugTerminal = summary?.debugTerminal ?? {
    entryCount: 0,
    recentErrorCount: 0,
    lastEventLabel: "",
  };
  const entryCount = Math.max(0, Math.round(Number(debugTerminal.entryCount) || 0));
  const recentErrorCount = Math.max(0, Math.round(Number(debugTerminal.recentErrorCount) || 0));
  const meta = recentErrorCount > 0
    ? `${formatDisplayNumber(entryCount)} events · ${formatDisplayNumber(recentErrorCount)} errors`
    : `${formatDisplayNumber(entryCount)} events`;

  return `
    <div class="developer-log-chip">
      <button
        class="tag-button panel-action-button developer-log-chip__button"
        type="button"
        data-action="open-developer-logs"
        aria-pressed="false"
        title="Open developer logs in a separate tab"
      >
        Developer logs
      </button>
      <span class="developer-log-chip__meta">${escapeHtml(meta)}</span>
    </div>
  `;
}

// Intent: describe autosave runtime state for the top chrome without exposing persistence internals to UI callers.
function buildProjectAutosaveIndicatorModel(state, projectFileAutosaveConnected = false) {
  return buildProjectAutosaveStatusModel(state, {
    connected: projectFileAutosaveConnected,
    saveShortcutLabel: formatConfiguredKeyboardShortcut(state, "project.save"),
  });
}

// Intent: keep autosave status visible where file actions live.
function renderProjectFileAutosaveSetting(state, projectFileAutosaveConnected = false) {
  const enabled = state.editorPrefs.projectFileAutosaveEnabled === true;
  const checked = enabled && projectFileAutosaveConnected;
  const autosaveStatus = buildProjectAutosaveStatusModel(state, {
    connected: projectFileAutosaveConnected,
    saveShortcutLabel: formatConfiguredKeyboardShortcut(state, "project.save"),
  });
  const projectFileOutOfSync =
    autosaveStatus.statusKey === "permission-required" ||
    autosaveStatus.statusKey === "manual-save-required" ||
    autosaveStatus.statusKey === "out-of-sync";
  const destinationLabel = projectFileOutOfSync
    ? "Out of sync"
    : projectFileAutosaveConnected
      ? "Writing to JSON"
      : "Waiting for path";
  const statusNote = projectFileOutOfSync
    ? autosaveStatus.note
    : enabled
      ? "Saves after 5 seconds of idle editing."
      : "Turn on autosave to keep the project file in sync.";
  return `
    <label class="project-file-autosave-setting">
      <input
        type="checkbox"
        data-editor-pref="projectFileAutosaveEnabled"
        ${checked ? "checked" : ""}
      />
      <span>Autosave</span>
      <strong>${escapeHtml(destinationLabel)}</strong>
      <small>${escapeHtml(statusNote)}</small>
    </label>
  `;
}

// Intent: provide a single place for the workspace tab buttons.
function renderPaneTab(paneId, label, detail, activePane) {
  const isActive = paneId === activePane;
  return `
    <button
      class="workspace-tab ${isActive ? "is-active" : ""}"
      type="button"
      data-action="select-pane"
      data-pane-id="${escapeHtml(paneId)}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(detail)}</strong>
    </button>
  `;
}

// Intent: keep stat formatting consistent across the top chrome.
function renderStat(label, value, statKey = "") {
  return `
    <div class="chrome-stat"${statKey ? ` data-stat-key="${escapeHtml(statKey)}"` : ""}>
      <span>${escapeHtml(label)}</span>
      <strong data-stat-value>${escapeHtml(formatDisplayNumber(value))}</strong>
    </div>
  `;
}

// Intent: keep writing-goal CTA state in the shell layer rather than the main app file.
function renderWritingTargetToggle(state, summary) {
  const targetLabel = summary?.goalButtonLabel ?? "Writing Goals";
  const writingGoalsShortcut = formatConfiguredKeyboardShortcut(state, "writingTargets.toggle");
  const title = writingGoalsShortcut
    ? `Open writing goals (${writingGoalsShortcut})`
    : "Open writing goals";

  return `
    <button
      class="chrome-stat chrome-target-toggle"
      type="button"
      data-writing-target-toggle
      data-action="toggle-writing-target-window"
      aria-pressed="${state.writingTargetWindowOpen ? "true" : "false"}"
      title="${escapeHtml(title)}"
      aria-label="Open writing goals"
    >
      <span class="chrome-target-icon" aria-hidden="true">◎</span>
      <span>Writing Goals</span>
      <strong data-writing-target-toggle-value>${escapeHtml(targetLabel)}</strong>
    </button>
  `;
}

// Intent: keep shortcut hints in chrome aligned with user-configured keymap preferences.
function formatConfiguredKeyboardShortcut(state, behaviorId) {
  const behavior = getKeyboardShortcutBehavior(behaviorId);
  if (!behavior) {
    return "";
  }

  return getEffectiveKeyboardShortcutsForBehavior(behavior, state?.editorPrefs?.keyboardShortcuts)[0] ?? "";
}

// Intent: keep the revision-window CTA beside writing goals while the revisions feature owns the window body.
function renderRevisionToggle(state) {
  const revisionCount = Array.isArray(state?.revisionState?.sessions)
    ? state.revisionState.sessions.length
    : 0;

  return `
    <button
      class="chrome-stat chrome-target-toggle chrome-revision-toggle"
      type="button"
      data-action="toggle-revision-window"
      aria-pressed="${state.revisionWindowOpen ? "true" : "false"}"
      title="Open revisions panel"
      aria-label="Open revisions panel"
    >
      <span class="chrome-target-icon" aria-hidden="true">R</span>
      <span>Revisions</span>
      <strong>${escapeHtml(`${formatDisplayNumber(revisionCount)} session${revisionCount === 1 ? "" : "s"}`)}</strong>
    </button>
  `;
}
