// Intent: coordinate a pending external-project import in runtime memory without making it durable before package publication.

const listeners = new Set();
let pendingCandidate = null;

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function notifyPendingCandidateChanged(candidate, reason = "updated") {
  for (const listener of listeners) {
    try {
      listener(candidate, { reason });
    } catch (error) {
      console.warn("Project import candidate listener failed.", error);
    }
  }
}

export function stageProjectImportCandidate(candidate = {}) {
  const snapshot = candidate?.snapshot;
  const projects = Array.isArray(snapshot?.projects) ? snapshot.projects.filter(Boolean) : [];
  if (!projects.length) {
    throw new Error("A project import candidate must contain at least one project record.");
  }

  const activeProjectId = normalizeText(snapshot.activeProjectId) || normalizeText(projects[0]?.id);
  const activeProject = projects.find((project) => project?.id === activeProjectId) ?? projects[0];
  pendingCandidate = {
    kind: normalizeText(candidate.kind) || "external-project",
    projectTitle: normalizeText(candidate.projectTitle) || normalizeText(activeProject?.title) || "Imported Project",
    sourceLabel: normalizeText(candidate.sourceLabel),
    sourcePath: normalizeText(candidate.sourcePath),
    sceneCount: Math.max(0, Number(candidate.sceneCount) || 0),
    metadataCount: Math.max(0, Number(candidate.metadataCount) || 0),
    snapshot,
  };
  notifyPendingCandidateChanged(pendingCandidate, "staged");
  return pendingCandidate;
}

export function peekProjectImportCandidate() {
  return pendingCandidate;
}

export function clearProjectImportCandidate(reason = "cleared") {
  if (!pendingCandidate) return false;
  pendingCandidate = null;
  notifyPendingCandidateChanged(null, reason);
  return true;
}

export function subscribeProjectImportCandidate(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("Project import candidate subscribers must be functions.");
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyImportedProjectTitle(projectRecord, projectTitle) {
  if (!projectRecord || typeof projectRecord !== "object" || Array.isArray(projectRecord)) return projectRecord;
  const title = normalizeText(projectTitle) || normalizeText(projectRecord.title) || "Imported Project";
  const projectId = normalizeText(projectRecord.id);
  projectRecord.title = title;

  if (projectRecord.workspace?.project && typeof projectRecord.workspace.project === "object") {
    projectRecord.workspace.project.title = title;
    if (projectRecord.workspace.project.binder && typeof projectRecord.workspace.project.binder === "object") {
      projectRecord.workspace.project.binder.title = title;
    }
    if (
      projectId
      && projectRecord.workspace.project.navigationTargets?.[projectId]
      && typeof projectRecord.workspace.project.navigationTargets[projectId] === "object"
    ) {
      projectRecord.workspace.project.navigationTargets[projectId].title = title;
    }
  }

  if (projectRecord.projectIndex && typeof projectRecord.projectIndex === "object" && !Array.isArray(projectRecord.projectIndex)) {
    projectRecord.projectIndex.projectTitle = title;
  }
  return projectRecord;
}

// Intent: reuse the normal New Project candidate boundary while substituting the already-converted import snapshot.
export function buildPendingProjectImportSnapshot(projectTitle = "") {
  if (!pendingCandidate?.snapshot) return null;

  const snapshot = cloneValue(pendingCandidate.snapshot);
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const activeProjectId = normalizeText(snapshot.activeProjectId) || normalizeText(projects[0]?.id);
  const activeProject = projects.find((project) => project?.id === activeProjectId) ?? projects[0] ?? null;
  if (!activeProject) return null;

  applyImportedProjectTitle(activeProject, projectTitle || pendingCandidate.projectTitle);
  return snapshot;
}
