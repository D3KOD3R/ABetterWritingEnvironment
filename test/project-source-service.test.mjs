// Intent: verify project-source desktop loading and library merge/save policy stay outside app.js.
import assert from "node:assert/strict";

import {
  createProjectSourceService,
  loadProjectSource,
} from "../apps/editor/public/adapters/storage/project-source-service.js";

export async function runProjectSourceServiceTest() {
  const calls = [];
  const service = createProjectSourceService({
    fetchJson: async (pathname, options) => {
      calls.push({ pathname, options });
      return {
        ok: true,
        value: {
          activeProjectId: "imported",
          projects: [{ id: "imported", title: "Imported" }],
          sceneStore: {
            imported: {
              "scene-imported": {
                editorText: "Imported scene body.",
              },
            },
          },
        },
      };
    },
    normalizeProjectLibrarySnapshot: (snapshot) => ({
      activeProjectId: snapshot?.activeProjectId ?? "",
      projects: Array.isArray(snapshot?.projects) ? snapshot.projects : [],
      sceneStore: snapshot?.sceneStore ?? {},
    }),
    mergeProjectLibrarySnapshots: (current, imported) => ({
      activeProjectId: imported.activeProjectId || current.activeProjectId,
      projects: [...current.projects, ...imported.projects],
      sceneStore: {
        ...(current.sceneStore ?? {}),
        ...(imported.sceneStore ?? {}),
      },
    }),
    resolveActiveProjectId: (candidate) => candidate,
    saveProjectLibrarySnapshot: (snapshot) => ({
      ...snapshot,
      saved: true,
    }),
  });

  const result = await service.loadProjectSource({
    projectPath: " C:/Novel/project.abe-project.json ",
    activeProjectId: "current",
    projects: [{ id: "current", title: "Current" }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.projectPath, "C:/Novel/project.abe-project.json");
  assert.equal(result.persistedLibrary.saved, true);
  assert.equal(result.persistedLibrary.activeProjectId, "imported");
  assert.deepEqual(result.persistedLibrary.projects.map((project) => project.id), ["current", "imported"]);
  assert.equal(result.persistedLibrary.sceneStore.imported["scene-imported"].editorText, "Imported scene body.");
  assert.equal(calls[0].pathname, "/api/project-source");
  assert.deepEqual(calls[0].options, {
    method: "POST",
    body: {
      projectPath: "C:/Novel/project.abe-project.json",
    },
  });

  const missingPath = await loadProjectSource({ projectPath: "" });
  assert.equal(missingPath.ok, false);
  assert.equal(missingPath.error.message, "Enter a local project source path.");
}
