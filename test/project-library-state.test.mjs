// Intent: verify project-library selection and cache/seed merge policy outside the editor shell.
import assert from "node:assert/strict";

import {
  createProjectLibraryStateService,
  mergeProjectLibraryItemsById,
  normalizeProjectSelectionDefaults,
} from "../apps/editor/public/state/project-library-state.js";

export function runProjectLibraryStateTest() {
  const state = {
    activeProjectId: "project-active",
    projectLibrarySelectionId: null,
    projectLibrary: [
      createProject("project-active", "Active Project", "user", 1, 1),
      createProject("project-second", "Second Project", "user", 1, 1),
    ],
    workspace: {
      project: {
        id: "workspace-fallback",
        title: "Workspace Fallback",
      },
    },
  };
  const mergeCalls = [];
  const service = createProjectLibraryStateService({
    state,
    normalizeProjectRecord: (record, legacyState) => record
      ? {
          ...structuredClone(record),
          legacyTitle: legacyState?.projectTitle ?? "",
        }
      : null,
    mergeProjectRecords: (storedRecord, seedRecord, legacyState) => {
      mergeCalls.push({ storedRecord, seedRecord, legacyState });
      return {
        ...structuredClone(seedRecord),
        retainedFromCache: storedRecord.id,
      };
    },
    createProjectRecordFromWorkspace: (workspace, legacyState) => ({
      id: workspace.project.id,
      title: legacyState.projectTitle,
      workspace,
    }),
  });

  const sceneStore = {
    "project-active": {
      "scene-1": {
        editorText: "Opening line.",
      },
    },
  };
  const normalized = service.normalizeProjectLibrarySnapshot({
    activeProjectId: "project-active",
    projects: [state.projectLibrary[0], null],
    sceneStore,
  });
  sceneStore["project-active"]["scene-1"].editorText = "Changed after normalization.";
  assert.equal(normalized.projects.length, 1);
  assert.equal(normalized.sceneStore["project-active"]["scene-1"].editorText, "Opening line.");

  const staleCache = createProject("stale-project", "Seed Project", "user", 1, 1);
  const canonicalSeed = createProject("seed-project", "Seed Project", "project-file", 2, 3);
  const merged = service.mergeProjectLibrarySnapshots(
    {
      activeProjectId: "stale-project",
      projects: [staleCache],
    },
    {
      activeProjectId: "seed-project",
      projects: [canonicalSeed],
    },
    { projectTitle: "Legacy Title" },
  );
  assert.equal(mergeCalls.length, 1);
  assert.equal(merged.projects.length, 1);
  assert.equal(merged.projects[0].id, "seed-project");
  assert.equal(merged.projects[0].retainedFromCache, "stale-project");

  assert.equal(service.resolveActiveProjectId("project-second", {
    activeProjectId: "project-active",
    projects: state.projectLibrary,
  }), "project-second");
  assert.equal(service.resolveActiveProjectId("missing", {
    activeProjectId: "project-active",
    projects: state.projectLibrary,
  }), "project-active");
  assert.equal(service.getActiveProjectRecord().id, "project-active");
  assert.equal(service.getProjectRecordById("project-second").title, "Second Project");

  const mergedItems = mergeProjectLibraryItemsById(
    [{
      id: "task-imported",
      source: "source-comment",
      title: "Author revised title",
      status: "done",
    }],
    [{
      id: "task-imported",
      source: "source-comment",
      title: "Fresh imported title",
      status: "open",
      selectedText: "Updated source anchor evidence.",
    }],
  );
  assert.equal(mergedItems.length, 1);
  assert.equal(mergedItems[0].title, "Author revised title");
  assert.equal(mergedItems[0].status, "done");
  assert.equal(mergedItems[0].selectedText, "Updated source anchor evidence.");

  const selectionDefaults = normalizeProjectSelectionDefaults({
    lineId: "block-2",
    sceneSelectionStart: 4,
    inlinePassageDraft: {
      sceneId: "scene-2",
      noteType: "research",
      body: "Track supporting reference.",
    },
  }, {
    lines: [
      { blockId: "block-1", sceneId: "scene-1" },
      { blockId: "block-2", sceneId: "scene-2" },
    ],
  });
  assert.equal(selectionDefaults.sceneId, "scene-2");
  assert.equal(selectionDefaults.sceneSelectionStart, 4);
  assert.equal(selectionDefaults.inlinePassageDraft.noteType, "research");
  assert.equal(selectionDefaults.inlinePassageDraft.body, "Track supporting reference.");
}

function createProject(id, title, source, chapterCount, sceneCount) {
  return {
    id,
    title,
    source,
    workspace: {
      project: {
        id,
        title,
        stats: {
          chapterCount,
          sceneCount,
        },
      },
    },
  };
}
