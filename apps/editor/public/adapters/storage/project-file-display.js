// Intent: own project-file display labels and tooltips so UI modules do not duplicate path rules.
import {
  getProjectFileHandleDisplayPath,
  getProjectFilePathBaseName,
  getProjectRecordFilePath,
  hasProjectFilePath,
  normalizeProjectFilePath,
} from "./project-file.js";

const DEFAULT_PROJECT_FILE_DISPLAY_NAME = "Untitled project file";
const PROJECT_FILE_PATH_UNAVAILABLE_TOOLTIP =
  "Project file path unavailable. Use Save as file with a full path to set one.";

// Intent: recover the best known full path for tooltips while keeping compact names separate.
export function resolveProjectFileDisplayState({
  projectFilePath = "",
  projectFileHandle = null,
  projectLibrary = [],
  activeProjectId = null,
  projectLibrarySelectionId = null,
  activeProjectRecord = null,
} = {}) {
  const directPath = normalizeProjectFilePath(projectFilePath);
  const handleDisplayPath = getProjectFileHandleDisplayPath(projectFileHandle);
  const record = activeProjectRecord ?? resolveActiveProjectRecord({
    projectLibrary,
    activeProjectId,
    projectLibrarySelectionId,
  });
  const recordPath = getProjectRecordFilePath(record);
  const resolvedPath = resolveProjectFileDisplayPath({
    directPath,
    handleDisplayPath,
    recordPath,
  });
  const displayNameSource = resolvedPath || directPath || handleDisplayPath || recordPath;
  const tooltipSource = resolvedPath || handleDisplayPath;

  return {
    displayName: getProjectFileDisplayName(displayNameSource),
    inputValue: resolvedPath,
    pathLabel: resolvedPath,
    tooltip: tooltipSource || PROJECT_FILE_PATH_UNAVAILABLE_TOOLTIP,
  };
}

// Intent: choose the project record that can recover a full file path after library selection changes.
export function resolveActiveProjectRecord({
  projectLibrary = [],
  activeProjectId = null,
  projectLibrarySelectionId = null,
} = {}) {
  const projects = Array.isArray(projectLibrary) ? projectLibrary : [];
  const projectId = typeof activeProjectId === "string" && activeProjectId.trim()
    ? activeProjectId
    : typeof projectLibrarySelectionId === "string" && projectLibrarySelectionId.trim()
      ? projectLibrarySelectionId
      : "";

  return projects.find((project) => project.id === projectId) ?? projects[0] ?? null;
}

// Intent: return only durable full paths; filenames are not valid tooltip or save-path values.
export function resolveProjectFileDisplayPath({
  directPath = "",
  handleDisplayPath = "",
  recordPath = "",
} = {}) {
  const direct = normalizeProjectFilePath(directPath);
  const handle = normalizeProjectFilePath(handleDisplayPath);
  const record = normalizeProjectFilePath(recordPath);

  if (hasProjectFilePath(direct)) {
    return direct;
  }

  if (hasProjectFilePath(record)) {
    const recordBaseName = getProjectFilePathBaseName(record).toLowerCase();
    const directBaseName = getProjectFilePathBaseName(direct).toLowerCase();
    const handleBaseName = getProjectFilePathBaseName(handle).toLowerCase();

    if (
      (directBaseName && directBaseName === recordBaseName) ||
      (handleBaseName && handleBaseName === recordBaseName) ||
      (!direct && !handle)
    ) {
      return record;
    }
  }

  return "";
}

// Intent: keep compact UI labels separate from full tooltip and save-path values.
export function getProjectFileDisplayName(filePath) {
  return getProjectFilePathBaseName(filePath) || DEFAULT_PROJECT_FILE_DISPLAY_NAME;
}
