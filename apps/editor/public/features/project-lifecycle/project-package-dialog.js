// Intent: own runtime-only project package dialog state and markup without persistence side effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export const PROJECT_PACKAGE_DIALOG_MODES = Object.freeze({
  NEW: "new",
  OPEN: "open",
  SAVE_AS: "save-as",
});

export function deriveProjectPackageFolderName(projectTitle = "") {
  return String(projectTitle || "Untitled Project")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .trim() || "Untitled Project";
}

export function createProjectPackageDialogState({
  mode = PROJECT_PACKAGE_DIALOG_MODES.OPEN,
  projectTitle = "Untitled Project",
  sourceRoot = "",
} = {}) {
  const normalizedMode = Object.values(PROJECT_PACKAGE_DIALOG_MODES).includes(mode)
    ? mode
    : PROJECT_PACKAGE_DIALOG_MODES.OPEN;
  return {
    mode: normalizedMode,
    projectName: normalizedMode === PROJECT_PACKAGE_DIALOG_MODES.NEW ? projectTitle : "",
    folderName: normalizedMode === PROJECT_PACKAGE_DIALOG_MODES.OPEN
      ? ""
      : deriveProjectPackageFolderName(projectTitle),
    sourceRoot: String(sourceRoot ?? "").trim(),
    locationPath: "",
    validatedLocationPath: "",
    parentPath: "",
    isProjectPackage: false,
    directories: [],
    busy: false,
    errorMessage: "",
  };
}

export function updateProjectPackageDialogField(dialog, field, value) {
  if (!dialog || !["projectName", "folderName", "locationPath"].includes(field)) return dialog;
  const normalizedValue = String(value ?? "");
  if (field === "locationPath") {
    return {
      ...dialog,
      locationPath: normalizedValue,
      validatedLocationPath: "",
      parentPath: "",
      isProjectPackage: false,
      directories: [],
      errorMessage: "",
    };
  }
  return {
    ...dialog,
    [field]: normalizedValue,
    errorMessage: "",
  };
}

export function applyProjectPackageBrowseResult(dialog, result = {}) {
  return {
    ...dialog,
    locationPath: String(result.path ?? ""),
    validatedLocationPath: String(result.path ?? ""),
    parentPath: String(result.parentPath ?? ""),
    isProjectPackage: result.isProjectPackage === true,
    directories: Array.isArray(result.directories) ? result.directories : [],
    busy: false,
    errorMessage: "",
  };
}

export function canConfirmProjectPackageDialog(dialog) {
  if (!dialog || dialog.busy) return false;
  const locationPath = String(dialog.locationPath ?? "").trim();
  const locationValidated = locationPath && locationPath === String(dialog.validatedLocationPath ?? "").trim();
  if (dialog.mode === PROJECT_PACKAGE_DIALOG_MODES.OPEN) {
    return Boolean(locationValidated && dialog.isProjectPackage === true);
  }
  return Boolean(
    locationValidated
    && String(dialog.folderName ?? "").trim()
    && (dialog.mode !== PROJECT_PACKAGE_DIALOG_MODES.NEW || String(dialog.projectName ?? "").trim()),
  );
}

export function renderProjectPackageDialogHTML(dialog) {
  if (!dialog) return "";
  const isNew = dialog.mode === PROJECT_PACKAGE_DIALOG_MODES.NEW;
  const isOpen = dialog.mode === PROJECT_PACKAGE_DIALOG_MODES.OPEN;
  const title = isNew ? "New Project" : isOpen ? "Open Project" : "Save Project As";
  const confirmLabel = isNew ? "Create Project" : isOpen ? "Open Project" : "Save As";
  const disabled = dialog.busy ? "disabled" : "";
  const confirmDisabled = canConfirmProjectPackageDialog(dialog) ? "" : "disabled";
  const directories = dialog.directories.map((directory) => `
    <button
      type="button"
      class="project-package-dialog__directory ${directory.isProjectPackage ? "is-project-package" : ""}"
      data-action="navigate-project-package"
      data-project-package-path="${escapeHtml(directory.path)}"
      ${disabled}
    >
      <span>${escapeHtml(directory.name)}</span>
      <small>${directory.isProjectPackage ? "Project package" : "Folder"}</small>
    </button>
  `).join("");

  return `
    <div class="project-package-dialog-backdrop" data-project-package-dialog-backdrop>
      <section class="project-package-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <div>
            <p class="panel-kicker">Project package</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <button type="button" data-action="cancel-project-package-dialog" aria-label="Close" ${disabled}>×</button>
        </header>
        ${isNew ? `
          <label>
            <span>Project name</span>
            <input data-project-package-field="projectName" value="${escapeHtml(dialog.projectName)}" ${disabled} />
          </label>
        ` : ""}
        ${!isOpen ? `
          <label>
            <span>Project folder name</span>
            <input data-project-package-field="folderName" value="${escapeHtml(dialog.folderName)}" ${disabled} />
          </label>
        ` : ""}
        <label>
          <span>Location</span>
          <div class="project-package-dialog__path-row">
            <input data-project-package-field="locationPath" value="${escapeHtml(dialog.locationPath)}" placeholder="Absolute folder path" spellcheck="false" ${disabled} />
            <button type="button" data-action="browse-project-package-path" ${disabled}>Browse</button>
          </div>
        </label>
        <div class="project-package-dialog__browser" aria-label="Project folders">
          ${dialog.parentPath ? `
            <button type="button" class="project-package-dialog__directory" data-action="navigate-project-package" data-project-package-path="${escapeHtml(dialog.parentPath)}" ${disabled}>
              <span>..</span><small>Parent folder</small>
            </button>
          ` : ""}
          ${directories || "<p>No child folders.</p>"}
        </div>
        ${dialog.errorMessage ? `<p class="project-package-dialog__error" role="alert">${escapeHtml(dialog.errorMessage)}</p>` : ""}
        ${dialog.locationPath && dialog.locationPath !== dialog.validatedLocationPath
          ? '<p class="project-package-dialog__hint">Press Enter or Browse to validate this location and show its folders.</p>'
          : ""}
        ${isOpen && dialog.locationPath && !dialog.isProjectPackage
          ? '<p class="project-package-dialog__hint">Choose a folder containing project.json.</p>'
          : ""}
        <footer>
          <button type="button" data-action="cancel-project-package-dialog" ${disabled}>Cancel</button>
          <button type="button" class="primary" data-action="confirm-project-package-dialog" ${confirmDisabled}>${dialog.busy ? "Working..." : escapeHtml(confirmLabel)}</button>
        </footer>
      </section>
    </div>
  `;
}
