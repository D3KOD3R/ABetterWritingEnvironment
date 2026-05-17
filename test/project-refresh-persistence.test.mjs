// Intent: verify an editor edit survives autosave and a fresh browser refresh through persisted project storage.
import assert from "node:assert/strict";

import { createBrowserStorageAdapter } from "../apps/editor/public/adapters/storage/browser-storage-adapter.js";
import { createPreferencesRepository } from "../apps/editor/public/adapters/storage/preferences-repository.js";
import { createProjectPersistenceService } from "../apps/editor/public/adapters/storage/project-persistence-service.js";
import { createProjectRepository } from "../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../apps/editor/public/adapters/storage/project-service.js";

export async function runProjectRefreshPersistenceTest() {
  // Intent: keep the refresh scenario isolated so it exercises the same browser-backed storage the editor uses.
  const windowRef = createMemoryWindow();
  const storageAdapter = createBrowserStorageAdapter({ windowRef });
  const projectRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "refresh-test-library-v1",
    activeProjectIdStorageKey: "refresh-test-active-v1",
  });
  const preferencesRepository = createPreferencesRepository({ storageAdapter });
  const projectService = createProjectService({
    projectRepository,
    preferencesRepository,
    now: () => "2026-05-14T00:00:00.000Z",
  });

  const initialProject = createProjectRecord("Old browser text.");
  const created = projectService.createProject({
    projectRecord: initialProject,
    persist: true,
  });
  const opened = projectService.openProject();
  const editedRecord = projectService.saveScene({
    projectRecord: opened.projectRecord,
    sceneId: "scene-1",
    content: "Edited browser text survives refresh.",
    persist: true,
  });
  const persistedRecord = projectService.saveProject({
    projectRecord: editedRecord,
    persist: true,
    changedSceneIds: ["scene-1"],
  });

  const filePath = "C:\\Projects\\project-test.abe-project.json";
  const desktopFiles = new Map();
  desktopFiles.set(filePath, structuredClone(created.librarySnapshot));

  const state = {
    activeProjectId: persistedRecord.projectRecord.id,
    projectLibrarySelectionId: persistedRecord.projectRecord.id,
    projectLibrary: [persistedRecord.projectRecord],
    projectTitle: persistedRecord.projectRecord.title,
    projectFileHandle: null,
    projectFilePath: filePath,
    projectFileStatus: "",
    projectFileBusy: false,
    projectFileAutosaveDirty: false,
    projectFileAutosaveTarget: null,
    projectFileAutosaveRevision: 0,
    projectFileAutosaveSuppressionDepth: 0,
    projectCacheSuppressionDepth: 0,
    editorPrefs: {
      projectFileAutosaveEnabled: true,
    },
    workspace: persistedRecord.projectRecord.workspace,
    projectPersistenceDirtyDomains: {},
    projectEditorWorkingDirtyState: {
      dirty: false,
      lastMutationAt: "",
      domains: {},
    },
    projectFileAutosaveTimer: null,
  };

  const persistence = createProjectPersistenceService({
    state,
    windowRef: {
      setTimeout: (callback) => ({ callback }),
      clearTimeout: () => {},
    },
    projectService,
    projectRepository,
    fetchJsonFromDesktopApi: async (pathname, requestOptions = {}) => {
      if (pathname === "/api/project-file/save") {
        const { filePath: savedPath, snapshot } = requestOptions.body ?? {};
        desktopFiles.set(savedPath, structuredClone(snapshot));
        return {
          ok: true,
          value: {
            filePath: savedPath,
          },
        };
      }

      if (pathname === "/api/project-file/load") {
        const { filePath: loadPath } = requestOptions.body ?? {};
        const snapshot = desktopFiles.get(loadPath);
        if (!snapshot) {
          return {
            ok: false,
            error: new Error("Missing desktop file snapshot."),
          };
        }
        return {
          ok: true,
          value: structuredClone(snapshot),
        };
      }

      return {
        ok: false,
        error: new Error(`Unhandled desktop API path: ${pathname}`),
      };
    },
    projectSchemaVersion: 2,
    autosaveDelayMs: 1,
    shouldPersistProjectCache: () => state.projectCacheSuppressionDepth === 0,
    writeProjectFilePathCache: () => {},
    createProjectRecordFromRuntimeState: () => state.projectLibrary[0],
    getActiveProjectRecord: () => state.projectLibrary[0],
    normalizeProjectLibrarySnapshot: (candidate) => ({
      activeProjectId: candidate?.activeProjectId ?? null,
      projects: Array.isArray(candidate?.projects) ? candidate.projects : [],
    }),
    normalizeProjectRecord: (candidate) => candidate ?? null,
    resolveActiveProjectId: (candidate, library) => candidate ?? library?.projects?.[0]?.id ?? null,
    activateLoadedProjectRecord: () => {},
    prepareProjectSnapshotForSave: () => {},
    reportBrowserLog: () => {},
    renderHeader: () => {},
    resolveSuggestedProjectFileName: () => "project-test.abe-project.json",
    loggerSources: {},
  });

  // Intent: simulate text entry landing in the active project before autosave flushes.
  state.projectLibrary[0].workspace.project.lines[0].text = "Edited browser text survives refresh.";
  state.projectLibrary[0].sceneDrafts = {
    "scene-1": {
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "Scene One",
      sceneSynopsis: "",
      editorText: "Edited browser text survives refresh.",
      blocks: [],
    },
  };

  persistence.markProjectAutosaveDirty({
    domain: "project",
    reason: "editor-input",
    source: "test",
  });
  await persistence.flushProjectAutosave();

  // Intent: simulate a browser refresh by constructing a fresh repository and service from the same storage.
  const refreshedRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "refresh-test-library-v1",
    activeProjectIdStorageKey: "refresh-test-active-v1",
  });
  const refreshedPreferencesRepository = createPreferencesRepository({ storageAdapter });
  const refreshedService = createProjectService({
    projectRepository: refreshedRepository,
    preferencesRepository: refreshedPreferencesRepository,
    now: () => "2026-05-14T00:00:00.000Z",
  });

  const refreshedLibrary = refreshedService.loadProjectLibrarySnapshot();
  const refreshedProject = refreshedService.openProject().projectRecord;
  const refreshedScene = refreshedService.loadScene({
    projectRecord: refreshedProject,
    sceneId: "scene-1",
  });
  const refreshedManifest = storageAdapter.readJson("refresh-test-library-v1");
  const desktopSnapshot = desktopFiles.get(filePath);

  assert.equal(refreshedScene?.editorText, "Edited browser text survives refresh.");
  assert.equal(
    refreshedLibrary.projects[0]?.projectSettings?.projectFilePath,
    filePath,
  );
  assert.equal(
    refreshedLibrary.projects[0]?.projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.wordCount > 0,
    true,
  );
  assert.equal(
    refreshedManifest.projects[0]?.projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.wordCount > 0,
    true,
  );
  assert.equal(
    desktopSnapshot?.sceneStore?.["project-test"]?.["scene-1"]?.editorText,
    "Edited browser text survives refresh.",
  );
}

function createProjectRecord(text) {
  return {
    id: "project-test",
    title: "Project Test",
    source: "test",
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:00.000Z",
    workspace: {
      generatedAt: "2026-05-14T00:00:00.000Z",
      workspaceTitle: "ABetterNovelAuthoringEnvironment",
      project: {
        id: "project-test",
        title: "Project Test",
        lines: [
          {
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            speakerLabel: "",
            text,
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneId: "scene-1",
            sceneTitle: "Scene One",
            sceneSynopsis: "",
            issueIds: [],
            eventTagIds: [],
          },
        ],
        stats: {
          chapterCount: 1,
          sceneCount: 1,
        },
      },
      selectionDefaults: {
        lineId: "block-1",
      },
    },
    sceneDrafts: {},
    structureDrafts: {
      scenes: [
        {
          sceneId: "scene-1",
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Scene One",
          sceneSynopsis: "",
          order: 1,
          initialText: "",
        },
      ],
    },
    templateDrafts: [],
    manuscriptTasks: [],
    passageNotes: [],
    projectSettings: {
      projectFilePath: "C:\\Projects\\project-test.abe-project.json",
    },
    editorPrefs: {},
    localAiPrefs: {
      enabled: true,
    },
  };
}

function createMemoryWindow() {
  const values = new Map();
  return {
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      },
    },
  };
}
