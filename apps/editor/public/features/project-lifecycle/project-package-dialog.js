// Intent: own runtime-only project package dialog state and markup without persistence side effects.
import { escapeHtml } from "../../shared/ui-utils.js";
import { peekProjectImportCandidate } from "../../state/project-import-candidate-store.js";
import {
  renderDirectoryLocationFieldHTML,
  renderFormTextFieldHTML,
} from "../../shared/form-field-components.js";

export const PROJECT_PACKAGE_DIALOG_MODES = Object.freeze({
  NEW: "new",
  OPEN: "open",
  SAVE_AS: "save-as",
});

export const PROJECT_PACKAGE_DIALOG_INTENTS = Object.freeze({
  NEW_PROJECT: "new-project",
  SCRIVENER_IMPORT: "scrivener-import",
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
  const pendingImport = normalizedMode === PROJECT_PACKAGE_DIALOG_MODES.NEW
    ? peekProjectImportCandidate()
    : null;
  const isScrivenerImport = pendingImport?.kind === "scrivener";
  const resolvedProjectTitle = isScrivenerImport
    ? pendingImport.projectTitle || projectTitle
    : projectTitle;
  const resolvedSourceRoot = isScrivenerImport
    ? pendingImport.sourcePath || pendingImport.sourceLabel || sourceRoot
    : sourceRoot;

  return {
    mode: normalizedMode,
    intent: isScrivenerImport
      ? PROJECT_PACKAGE_DIALOG_INTENTS.SCRIVENER_IMPORT
      : PROJECT_PACKAGE_DIALOG_INTENTS.NEW_PROJECT,
    projectName: normalizedMode === PROJECT_PACKAGE_DIALOG_MODES.NEW ? resolvedProjectTitle : "",
    folderName: normalizedMode === PROJECT_PACKAGE_DIALOG_MODES.OPEN
      ? ""
      : deriveProjectPackageFolderName(resolvedProjectTitle),
    sourceRoot: String(resolvedSourceRoot ?? "").trim(),
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
  const isScrivenerImport = dialog.intent === PROJECT_PACKAGE_DIALOG_INTENTS.SCRIVENER_IMPORT;
  const title = isScrivenerImport
    ? "Import Scrivener Project"
    : isNew
      ? "New Project"
      : isOpen
        ? "Open Project"
        : "Save Project As";
  const confirmLabel = isScrivenerImport
    ? "Import Project"
    : isNew
      ? "Create Project"
      : isOpen
        ? "Open Project"
        : "Save As";
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
      <section
        class="project-package-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="${escapeHtml(title)}"
        data-project-package-intent="${escapeHtml(dialog.intent ?? "")}"
      >
        <header>
          <div>
            <p class="panel-kicker">Project package</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <button type="button" data-action="cancel-project-package-dialog" aria-label="Close" ${disabled}>×</button>
        </header>
        ${isNew ? renderFormTextFieldHTML({
          label: "Project name",
          value: dialog.projectName,
          fieldName: "projectName",
          fieldAttribute: "data-project-package-field",
          disabled: dialog.busy,
        }) : ""}
        ${!isOpen ? renderFormTextFieldHTML({
          label: "Project folder name",
          value: dialog.folderName,
          fieldName: "folderName",
          fieldAttribute: "data-project-package-field",
          disabled: dialog.busy,
        }) : ""}
        ${isScrivenerImport ? renderFormTextFieldHTML({
          label: "Scrivener source",
          value: dialog.sourceRoot,
          fieldName: "sourceRoot",
          fieldAttribute: "data-project-import-source",
          disabled: true,
          spellcheck: false,
        }) : ""}
        ${renderDirectoryLocationFieldHTML({
          label: "Location",
          value: dialog.locationPath,
          fieldName: "locationPath",
          fieldAttribute: "data-project-package-field",
          browseAction: "browse-project-package-path",
          placeholder: "Absolute folder path",
          disabled: dialog.busy,
        })}
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
          ? '<p class="project-package-dialog__hint">Folders update automatically as you edit the location.</p>'
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
