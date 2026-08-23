// Intent: verify project-library selection and cache/seed merge policy outside the editor shell.
import assert from "node:assert/strict";

import {
  createProjectLibraryStateService,
  mergeProjectLibraryItemsById,
  normalizeProjectSelectionDefaults,
  shouldPreferBrowserCacheProjectLibraryOnBoot,
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
      sceneStore: {
        "stale-project": {
          "scene-stale": {
            editorText: "Cached scene body.",
          },
        },
      },
    },
    {
      activeProjectId: "seed-project",
      projects: [canonicalSeed],
      sceneStore: {
        "seed-project": {
          "scene-seed": {
            editorText: "Seed scene body.",
          },
        },
      },
    },
    { projectTitle: "Legacy Title" },
  );
  assert.equal(mergeCalls.length, 1);
  assert.equal(merged.projects.length, 1);
  assert.equal(merged.projects[0].id, "seed-project");
  assert.equal(merged.projects[0].retainedFromCache, "stale-project");
  assert.equal(merged.sceneStore["seed-project"]["scene-seed"].editorText, "Seed scene body.");
  assert.equal(merged.sceneStore["stale-project"]["scene-stale"].editorText, "Cached scene body.");

  const browserHandleDuplicate = createProject(
    "originfileproject-serva-vitae",
    "OriginFileproject-serva-vitae",
    "user",
    2,
    3,
    "OriginFileproject-serva-vitae.abe-project.json",
  );
  const projectFileDuplicate = createProject(
    "project-serva-vitae",
    "Project Serva Vitae Novel & Worldbuild",
    "project-file",
    4,
    29,
    "OriginFileproject-serva-vitae.abe-project.json",
  );
  const fileDuplicateMerged = service.mergeProjectLibrarySnapshots(
    {
      activeProjectId: "originfileproject-serva-vitae",
      projects: [browserHandleDuplicate],
      sceneStore: {
        "originfileproject-serva-vitae": {
          "scene-cached": {
            editorText: "Cached duplicate scene body.",
          },
        },
      },
    },
    {
      activeProjectId: "project-serva-vitae",
      projects: [projectFileDuplicate],
      sceneStore: {
        "project-serva-vitae": {
          "scene-file": {
            editorText: "File-backed duplicate scene body.",
          },
        },
      },
    },
  );
  assert.equal(fileDuplicateMerged.projects.length, 1);
  assert.equal(fileDuplicateMerged.projects[0].id, "project-serva-vitae");
  assert.equal(fileDuplicateMerged.projects[0].title, "Project Serva Vitae Novel & Worldbuild");
  assert.equal(fileDuplicateMerged.projects[0].retainedFromCache, "originfileproject-serva-vitae");
  assert.equal(fileDuplicateMerged.activeProjectId, "project-serva-vitae");
  assert.equal(
    fileDuplicateMerged.sceneStore["project-serva-vitae"]["scene-cached"].editorText,
    "Cached duplicate scene body.",
  );
  assert.equal(
    fileDuplicateMerged.sceneStore["project-serva-vitae"]["scene-file"].editorText,
    "File-backed duplicate scene body.",
  );

  const normalizedDuplicateSnapshot = service.normalizeProjectLibrarySnapshot({
    activeProjectId: "originfileproject-serva-vitae",
    projects: [browserHandleDuplicate, projectFileDuplicate],
  });
  assert.equal(normalizedDuplicateSnapshot.projects.length, 1);
  assert.equal(normalizedDuplicateSnapshot.projects[0].id, "project-serva-vitae");
  assert.equal(normalizedDuplicateSnapshot.activeProjectId, "project-serva-vitae");

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

  const bundledSeedPath = "C:\\Repos\\ABetterNovelAuthoringEnvironment\\project-serva-vitae.abe-project.json";
  const cachedLoadedProject = createProject(
    "project-serva-vitae",
    "Project Serva Vitae",
    "project-file",
    4,
    29,
    "SaveTestFile\\project-serva-vitae.abe-project.json",
  );
  const bundledSeedProject = createProject(
    "project-serva-vitae",
    "Project Serva Vitae",
    "project-file",
    4,
    29,
    bundledSeedPath,
  );
  assert.equal(
    shouldPreferBrowserCacheProjectLibraryOnBoot({
      storedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [cachedLoadedProject],
      },
      seedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [bundledSeedProject],
      },
      storedActiveProjectId: "project-serva-vitae",
      explicitProjectFilePath: bundledSeedPath,
    }),
    true,
  );
  assert.equal(
    shouldPreferBrowserCacheProjectLibraryOnBoot({
      storedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [cachedLoadedProject],
      },
      seedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [bundledSeedProject],
      },
      storedActiveProjectId: "project-serva-vitae",
      explicitProjectFilePath: "D:\\Writing\\active-novel.abe-project.json",
    }),
    false,
  );
  assert.equal(
    shouldPreferBrowserCacheProjectLibraryOnBoot({
      storedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [cachedLoadedProject],
      },
      seedLibrary: {
        activeProjectId: "project-serva-vitae",
        projects: [bundledSeedProject],
      },
      storedActiveProjectId: "project-serva-vitae",
      explicitProjectFilePath: "",
    }),
    true,
  );
}

function createProject(id, title, source, chapterCount, sceneCount, projectFilePath = "") {
  return {
    id,
    title,
    source,
    projectSettings: {
      projectFilePath,
    },
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
