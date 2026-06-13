// Intent: render the top-level editor chrome without owning editor state or persistence.
import { renderWritingTargetStrip } from "../features/progress-tracker.js";
import { buildProjectAutosaveStatusModel } from "../shared/project-autosave-status.js";
import { escapeHtml, formatDisplayNumber } from "../shared/ui-utils.js";

export function renderEditorChrome({
  state,
  workspace,
  writingTargetSummary,
  projectFileAutosaveConnected = false,
  projectFileDisplay,
  createProjectLibraryRecord,
  getSuggestedProjectFilePath,
}) {
  const projectWorkspace = workspace ?? state?.workspace ?? null;
  const activePane = state?.activePane ?? "manuscript";
  const safeProjectFileDisplay = projectFileDisplay ?? {
    inputValue: state?.projectFilePath ?? "",
    pathLabel: state?.projectFilePath ?? "",
    tooltip: "No project file selected",
  };
  const projects = state?.projectLibrary?.length
    ? state.projectLibrary
    : (projectWorkspace ? [createProjectLibraryRecord()] : []);

  return `
    <header class="desktop-chrome">
      <div class="desktop-menubar">
        <div class="desktop-menu-cluster">
          <div class="file-menu ${state.fileMenuOpen ? "is-open" : ""}" data-file-menu>
            <button
              class="menu-button"
              type="button"
              data-action="toggle-file-menu"
              aria-expanded="${state.fileMenuOpen ? "true" : "false"}"
              aria-haspopup="menu"
            >File</button>
            ${state.fileMenuOpen ? renderFileMenu({
              state,
              projects,
              projectFileAutosaveConnected,
              projectFileDisplay: safeProjectFileDisplay,
              createProjectLibraryRecord,
              getSuggestedProjectFilePath,
            }) : ""}
          </div>
        <div class="desktop-title-cluster">
          <span class="desktop-app-name">A Better Novel Authoring Environment</span>
          <span class="desktop-environment-badge" aria-label="Environment marker">Version: Test</span>
          <span class="project-file-tooltip desktop-project-title-shell" data-file-path-tooltip="${escapeHtml(safeProjectFileDisplay.tooltip)}">
              <input
                class="project-title-input desktop-project-title"
                type="text"
                value="${escapeHtml(state.projectTitle)}"
                data-edit-field="project-title"
                aria-label="Project title"
              />
            </span>
          </div>
        </div>
        <div class="desktop-menubar-center">
          <nav class="workspace-tabs" aria-label="Workspace panes">
            ${renderPaneTab("manuscript", "Manuscript", projectWorkspace?.settings?.executionMode ?? "local", activePane)}
            ${renderPaneTab("world", "World", "Spines and templates", activePane)}
            ${renderPaneTab("narration", "Narration + Voice", "Whisper follow-track", activePane)}
          </nav>
        </div>
        <div class="desktop-stat-strip" aria-label="Project statistics">
          ${renderStat("Lines", projectWorkspace?.project?.stats?.lineCount ?? 0, "lines")}
          ${renderWritingTargetToggle(state, writingTargetSummary)}
          ${renderRevisionToggle(state)}
        </div>
      </div>
      ${renderWritingTargetStrip(writingTargetSummary, {
        autosaveIndicator: buildProjectAutosaveIndicatorModel(state, projectFileAutosaveConnected),
      })}
      <div class="desktop-toolbar">
        ${renderLocalAiSetting(state)}
      </div>
    </header>
  `;
}

// Intent: keep the file menu markup together so file-related controls can evolve independently.
function renderFileMenu({
  state,
  projects,
  projectFileAutosaveConnected,
  projectFileDisplay,
  createProjectLibraryRecord,
  getSuggestedProjectFilePath,
}) {
  const selectedProjectId = state.projectLibrarySelectionId ?? state.activeProjectId ?? projects[0]?.id ?? "";
  const selectedProject = projects.find((project) => project.id === selectedProjectId)
    ?? projects[0]
    ?? null;
  const activeProject = projects.find((project) => project.id === state.activeProjectId)
    ?? selectedProject;
  const status = activeProject
    ? `${projects.length} saved project${projects.length === 1 ? "" : "s"}`
    : "No saved projects yet";
  const manuscriptStats = activeProject?.workspace?.project?.stats ?? null;
  const worldStats = activeProject?.workspace?.world?.stats ?? null;
  const manuscriptStatus = manuscriptStats
    ? ` · ${manuscriptStats.chapterCount} chapters, ${manuscriptStats.sceneCount} scenes`
    : "";
  const templateStatus = worldStats
    ? ` · ${worldStats.templateCount} templates`
    : "";
  const importReport = activeProject?.importReport && typeof activeProject.importReport === "object"
    ? activeProject.importReport
    : null;
  const importedNoteCount = Number(importReport?.importedNotes ?? (Number(importReport?.importedResearchNotes ?? 0) + Number(importReport?.importedFrontMatterNotes ?? 0)));
  const importedAssetCount = Number(importReport?.importedAssetNotes ?? 0);
  const archivedCount = Number(importReport?.archivedItems ?? 0);
  const selectionStatus =
    selectedProject && activeProject && selectedProject.id !== activeProject.id
      ? ` · Selected: ${selectedProject.title}`
      : "";
  const importStatus = importReport
    ? ` · Import: ${importedNoteCount} notes${importedAssetCount ? `, ${importedAssetCount} assets` : ""}${archivedCount ? `, ${archivedCount} archived` : ""}`
    : "";
  const projectFilePathLabel = projectFileDisplay?.pathLabel ?? state.projectFilePath ?? "";
  const projectFileStatus = projectFilePathLabel
    ? `Project file: ${projectFilePathLabel}`
    : "No project file selected";
  const projectFileFeedback = state.projectFileStatus ? ` · ${state.projectFileStatus}` : "";
  const integratorStatus = state.projectSourceStatus
    ? ` · Integrator: ${state.projectSourceStatus}`
    : "";

  return `
    <div class="file-menu-panel" role="menu" aria-label="File menu">
      <div class="file-menu-section">
        <span class="file-menu-label">Project</span>
        <label class="project-library-select-shell compact">
          <span>Saved projects</span>
          <select data-project-library-select aria-label="Saved projects">
            ${projects.map((project) => `
              <option value="${escapeHtml(project.id)}" ${project.id === selectedProjectId ? "selected" : ""}>
                ${escapeHtml(formatProjectLibraryLabel(project))}
              </option>
            `).join("")}
          </select>
        </label>
        <div class="file-menu-actions">
          <button class="tag-button panel-action-button" type="button" data-action="load-project">Load project</button>
          <button class="tag-button panel-action-button" type="button" data-action="save-project">Save project</button>
          <button class="tag-button panel-action-button" type="button" data-action="create-project">Create project</button>
          <button class="tag-button panel-action-button" type="button" data-action="open-developer-logs">Developer logs</button>
          <button class="tag-button panel-action-button" type="button" data-action="toggle-writing-target-window">
            Writing target
          </button>
        </div>
      </div>
      <div class="file-menu-section">
        <span class="file-menu-label">Project file</span>
        ${renderProjectFileAutosaveSetting(state, projectFileAutosaveConnected)}
        <label class="project-file-shell compact">
          <span>Save path</span>
          <input
            type="text"
            value="${escapeHtml(projectFileDisplay?.inputValue ?? state.projectFilePath)}"
            data-edit-field="project-file-path"
            placeholder="${escapeHtml(getSuggestedProjectFilePath())}"
            aria-label="Project file path"
            spellcheck="false"
          />
        </label>
        <div class="file-menu-actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="save-project-file-as"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            ${state.projectFileBusy ? "Saving..." : "Save as file"}
          </button>
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="load-project-file"
            ${state.projectFileBusy ? "disabled" : ""}
          >
            Load file
          </button>
        </div>
        <p class="project-file-status">
          ${escapeHtml(projectFileStatus)}${escapeHtml(projectFileFeedback)}
        </p>
      </div>
      <div class="file-menu-section">
        <span class="file-menu-label">Import</span>
        <label class="project-source-shell compact">
          <span>Project source</span>
          <input
            type="text"
            value="${escapeHtml(state.projectSourcePath)}"
            data-edit-field="project-source-path"
            placeholder="C:\\Projects\\Novel.abe-project.json or ...\\Project folder"
            aria-label="Project source path"
            spellcheck="false"
          />
        </label>
        <div class="file-menu-actions">
          <button
            class="tag-button panel-action-button"
            type="button"
            data-action="load-project-source"
            ${state.projectSourceBusy ? "disabled" : ""}
          >
            ${state.projectSourceBusy ? "Importing..." : "Load Project Source"}
          </button>
        </div>
      </div>
      <p class="project-library-status">
        ${escapeHtml(status)}${activeProject ? ` · Active: ${activeProject.title}` : ""}${escapeHtml(manuscriptStatus)}${escapeHtml(templateStatus)}${escapeHtml(selectionStatus)}${escapeHtml(importStatus)}${escapeHtml(integratorStatus)}
      </p>
      <p class="file-menu-shortcuts" aria-label="Keyboard shortcuts">
        <span>Ctrl+S save</span>
        <span>Ctrl+Shift+S save as</span>
        <span>Ctrl+Shift+O load file</span>
        <span>Ctrl+Shift+L logs</span>
        <span>Ctrl+N new</span>
        <span>Ctrl+O file</span>
        <span>Ctrl+Alt+T goals</span>
        <span>Ctrl+1-4 panes</span>
        <span>Esc close</span>
      </p>
    </div>
  `;
}

// Intent: keep small chrome controls local to the shell module instead of spreading them across app.js.
function renderLocalAiSetting(state) {
  const enabled = state.localAiPrefs.enabled;
  return `
    <label class="local-ai-setting">
      <input
        type="checkbox"
        data-local-ai-setting="enabled"
        ${enabled ? "checked" : ""}
      />
      <span>Local AI</span>
      <strong>${enabled ? "Titles on" : "Titles off"}</strong>
    </label>
  `;
}

// Intent: describe autosave runtime state for the top metric strip without exposing persistence internals to UI callers.
function buildProjectAutosaveIndicatorModel(state, projectFileAutosaveConnected = false) {
  return buildProjectAutosaveStatusModel(state, {
    connected: projectFileAutosaveConnected,
  });
}

// Intent: keep autosave status visible where file actions live.
function renderProjectFileAutosaveSetting(state, projectFileAutosaveConnected = false) {
  const enabled = state.editorPrefs.projectFileAutosaveEnabled === true;
  const checked = enabled && projectFileAutosaveConnected;
  const autosaveStatus = buildProjectAutosaveStatusModel(state, {
    connected: projectFileAutosaveConnected,
  });
  const destinationLabel = state.projectFileAutosaveBlocked
    ? "Project file out of sync"
    : projectFileAutosaveConnected
      ? "Writing to JSON file"
      : "Waiting for file";
  const statusNote = state.projectFileAutosaveBlocked
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
      <span>Autosave project file</span>
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

  return `
    <button
      class="chrome-stat chrome-target-toggle"
      type="button"
      data-writing-target-toggle
      data-action="toggle-writing-target-window"
      aria-pressed="${state.writingTargetWindowOpen ? "true" : "false"}"
      title="Open writing goals (Ctrl+Alt+T)"
      aria-label="Open writing goals"
    >
      <span class="chrome-target-icon" aria-hidden="true">◎</span>
      <span>Writing Goals</span>
      <strong data-writing-target-toggle-value>${escapeHtml(targetLabel)}</strong>
    </button>
  `;
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

// Intent: keep project library labels stable and readable in the file menu.
function formatProjectLibraryLabel(project) {
  return typeof project?.title === "string" && project.title.trim()
    ? project.title
    : "Untitled Project";
}
