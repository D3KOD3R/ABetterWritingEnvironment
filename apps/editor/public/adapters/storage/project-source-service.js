// Intent: own project-source desktop loading and project-library merge policy outside app.js.

export function createProjectSourceService({
  fetchJson,
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  saveProjectLibrarySnapshot,
  endpoint = "/api/project-source",
} = {}) {
  if (typeof fetchJson !== "function") {
    throw new TypeError("createProjectSourceService requires a fetchJson function.");
  }
  if (typeof normalizeProjectLibrarySnapshot !== "function") {
    throw new TypeError("createProjectSourceService requires normalizeProjectLibrarySnapshot.");
  }
  if (typeof mergeProjectLibrarySnapshots !== "function") {
    throw new TypeError("createProjectSourceService requires mergeProjectLibrarySnapshots.");
  }
  if (typeof resolveActiveProjectId !== "function") {
    throw new TypeError("createProjectSourceService requires resolveActiveProjectId.");
  }
  if (typeof saveProjectLibrarySnapshot !== "function") {
    throw new TypeError("createProjectSourceService requires saveProjectLibrarySnapshot.");
  }

  return {
    loadProjectSource: (request) => loadProjectSource(request, {
      fetchJson,
      normalizeProjectLibrarySnapshot,
      mergeProjectLibrarySnapshots,
      resolveActiveProjectId,
      saveProjectLibrarySnapshot,
      endpoint,
    }),
  };
}

export async function loadProjectSource({
  projectPath = "",
  activeProjectId = "",
  projects = [],
  sceneStore = {},
} = {}, {
  fetchJson,
  normalizeProjectLibrarySnapshot,
  mergeProjectLibrarySnapshots,
  resolveActiveProjectId,
  saveProjectLibrarySnapshot,
  endpoint = "/api/project-source",
} = {}) {
  const normalizedPath = String(projectPath ?? "").trim();
  if (!normalizedPath) {
    return {
      ok: false,
      error: new Error("Enter a local project source path."),
    };
  }

  const response = await fetchJson(endpoint, {
    method: "POST",
    body: {
      projectPath: normalizedPath,
    },
  });

  if (!response?.ok) {
    throw response?.error ?? new Error("Project source load failed.");
  }

  const importedLibrary = normalizeProjectLibrarySnapshot(response.value);
  const currentLibrary = normalizeProjectLibrarySnapshot({
    activeProjectId,
    projects,
    sceneStore,
  });
  const mergedLibrary = mergeProjectLibrarySnapshots(currentLibrary, importedLibrary, null);
  const nextActiveProjectId = resolveActiveProjectId(
    importedLibrary.activeProjectId ?? mergedLibrary.activeProjectId,
    mergedLibrary,
  );
  const persistedLibrary = saveProjectLibrarySnapshot({
    activeProjectId: nextActiveProjectId,
    projects: mergedLibrary.projects,
    sceneStore: mergedLibrary.sceneStore ?? {},
  });

  return {
    ok: true,
    projectPath: normalizedPath,
    importedLibrary,
    mergedLibrary,
    persistedLibrary,
    activeProjectId: persistedLibrary.activeProjectId,
  };
}
