// Intent: verify chunked project storage persists manifest metadata separately from per-scene content.
import assert from "node:assert/strict";

import { createBrowserStorageAdapter } from "../apps/editor/public/adapters/storage/browser-storage-adapter.js";
import { createPreferencesRepository } from "../apps/editor/public/adapters/storage/preferences-repository.js";
import { migrateProjectData, PROJECT_SCHEMA_VERSION } from "../apps/editor/public/adapters/storage/project-migrations.js";
import { createProjectRepository } from "../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../apps/editor/public/adapters/storage/project-service.js";

export async function runProjectServiceStorageTest() {
  const memoryWindow = createMemoryWindow();
  const storageAdapter = createBrowserStorageAdapter({
    windowRef: memoryWindow,
  });

  storageAdapter.writeJson("contract-key", { ok: true });
  assert.deepEqual(storageAdapter.readJson("contract-key"), { ok: true });
  memoryWindow.localStorage.setItem("broken-json", "{");
  assert.equal(storageAdapter.readJson("broken-json"), null);
  storageAdapter.remove("contract-key");
  assert.equal(storageAdapter.readJson("contract-key"), null);

  const projectRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "test-project-library-v1",
    activeProjectIdStorageKey: "test-project-active-v1",
  });
  const preferencesRepository = createPreferencesRepository({
    storageAdapter,
  });
  const projectService = createProjectService({
    projectRepository,
    preferencesRepository,
    now: () => "2026-05-14T00:00:00.000Z",
  });

  const migrated = migrateProjectData({
    activeProjectId: "project-test",
    projects: [createProjectRecord()],
  });
  assert.equal(migrated.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.projects[0].schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.projects[0].projectIndex.projectId, "project-test");

  const created = projectService.createProject({
    projectRecord: createProjectRecord(),
    persist: true,
  });
  assert.equal(created.librarySnapshot.projects.length, 1);
  assert.equal(created.librarySnapshot.activeProjectId, "project-test");

  const rawStoredManifest = storageAdapter.readJson("test-project-library-v1");
  assert.equal(rawStoredManifest.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(rawStoredManifest.projects.length, 1);
  assert.equal(Object.keys(rawStoredManifest.projects[0].sceneDrafts ?? {}).length, 0);
  assert.equal(rawStoredManifest.projects[0].workspace.project.lines.every((line) => line.text === ""), true);
  assert.equal(rawStoredManifest.projects[0].projectStorage.format, "chunked-project-package-v1");
  assert.deepEqual(rawStoredManifest.projects[0].projectStorage.sceneOrder, ["scene-1", "scene-2"]);
  assert.equal(rawStoredManifest.projects[0].projectSettings.projectFilePath, "C:\\Projects\\project-test.abe-project");
  assert.equal(
    Number(rawStoredManifest.projects[0].projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(rawStoredManifest.projects[0].projectIndex?.scenes?.find((scene) => scene.id === "scene-2")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(rawStoredManifest.projects[0].projectIndex?.chapters?.find((chapter) => chapter.id === "chapter-1")?.wordCount) > 0,
    true,
  );

  const sceneOneStorageKey = "test-project-library-v1:scene:project-test:scene-1";
  const sceneTwoStorageKey = "test-project-library-v1:scene:project-test:scene-2";
  assert.equal(storageAdapter.readJson(sceneOneStorageKey).editorText.includes("Scene one opening line."), true);
  assert.equal(storageAdapter.readJson(sceneTwoStorageKey).editorText.includes("Scene two opening line."), true);

  memoryWindow.__resetCounters();
  const opened = projectService.openProject();
  assert.equal(opened.projectRecord?.id, "project-test");
  assert.equal(opened.projectRecord?.projectSettings?.projectFilePath, "C:\\Projects\\project-test.abe-project");
  assert.equal(
    Number(opened.projectRecord?.projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(opened.projectRecord?.projectIndex?.scenes?.find((scene) => scene.id === "scene-2")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(opened.projectRecord?.projectIndex?.chapters?.find((chapter) => chapter.id === "chapter-1")?.wordCount) > 0,
    true,
  );
  assert.equal(memoryWindow.__getReadCount("test-project-library-v1"), 1);
  assert.equal(memoryWindow.__getReadCount(sceneOneStorageKey) > 0, true);
  assert.equal(memoryWindow.__getReadCount(sceneTwoStorageKey), 0);

  memoryWindow.__resetCounters();
  const loadedSceneTwo = projectService.loadScene({
    projectRecord: opened.projectRecord,
    sceneId: "scene-2",
  });
  assert.equal(loadedSceneTwo.editorText, "Scene two opening line.");
  assert.equal(memoryWindow.__getReadCount(sceneTwoStorageKey), 1);

  const autosaveLikeRecord = structuredClone(opened.projectRecord);
  autosaveLikeRecord.workspace.project.lines = autosaveLikeRecord.workspace.project.lines.map((line) => ({
    ...line,
    text: "",
  }));
  autosaveLikeRecord.sceneDrafts = {
    "scene-1": structuredClone(projectRepository.loadScene("project-test", "scene-1")),
  };
  const transientSaveSnapshot = projectService.saveProject({
    projectRecord: autosaveLikeRecord,
    librarySnapshot: opened.librarySnapshot,
    persist: false,
    setActive: true,
  });
  assert.equal(
    Number(transientSaveSnapshot.librarySnapshot.projects[0]?.projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(transientSaveSnapshot.librarySnapshot.projects[0]?.projectIndex?.scenes?.find((scene) => scene.id === "scene-2")?.wordCount) > 0,
    true,
  );
  assert.equal(
    Number(transientSaveSnapshot.librarySnapshot.projects[0]?.projectIndex?.chapters?.find((chapter) => chapter.id === "chapter-1")?.wordCount) > 0,
    true,
  );

  const persistedFromManifestOnly = projectService.saveProjectLibrarySnapshot({
    activeProjectId: opened.librarySnapshot.activeProjectId,
    projects: opened.librarySnapshot.projects,
  });
  assert.equal(projectRepository.loadScene("project-test", "scene-2")?.editorText, "Scene two opening line.");
  const preservedSceneTwoWordCount = Number(
    persistedFromManifestOnly.projects[0]?.projectIndex?.scenes?.find((scene) => scene.id === "scene-2")?.wordCount,
  );
  assert.equal(preservedSceneTwoWordCount > 0, true);

  const exportedSnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: opened.librarySnapshot,
  });
  assert.equal(Object.keys(exportedSnapshot.sceneStore["project-test"] ?? {}).length, 2);
  assert.equal(
    exportedSnapshot.sceneStore["project-test"]["scene-1"].editorText.includes("Scene one opening line."),
    true,
  );

  // Intent: simulate a live browser edit that has not yet reached repository scene chunks before file export.
  const runtimeEditedRecord = structuredClone(opened.projectRecord);
  runtimeEditedRecord.sceneDrafts = {
    ...(runtimeEditedRecord.sceneDrafts ?? {}),
    "scene-1": {
      ...projectRepository.loadScene("project-test", "scene-1"),
      editorText: "Runtime scene edit waiting for file save.",
      blocks: [
        {
          blockId: "block-1",
          lineNumber: 1,
          kind: "narration",
          speakerLabel: "",
          text: "Runtime scene edit waiting for file save.",
          issueIds: [],
          eventTagIds: [],
          isDraft: false,
        },
      ],
    },
  };
  const exportedRuntimeSnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: {
      activeProjectId: "project-test",
      projects: [runtimeEditedRecord],
    },
  });
  assert.equal(
    exportedRuntimeSnapshot.sceneStore["project-test"]["scene-1"].editorText,
    "Runtime scene edit waiting for file save.",
  );
  assert.equal(
    projectRepository.loadScene("project-test", "scene-1")?.editorText,
    "Scene one opening line.",
  );

  const rewrittenSceneRecord = projectService.saveScene({
    projectRecord: opened.projectRecord,
    sceneId: "scene-1",
    content: "Rewritten scene body",
    persist: true,
  });
  assert.equal(projectRepository.loadScene("project-test", "scene-1")?.editorText, "Rewritten scene body");

  memoryWindow.__resetCounters();
  const persistedAfterSceneSave = projectService.saveProject({
    projectRecord: rewrittenSceneRecord,
    persist: true,
    changedSceneIds: ["scene-1"],
  });
  assert.equal(memoryWindow.__getWriteCount(sceneOneStorageKey) > 0, true);
  assert.equal(memoryWindow.__getWriteCount(sceneTwoStorageKey), 0);
  assert.equal(memoryWindow.__getWriteCount("test-project-library-v1") > 0, true);
  assert.equal(
    persistedAfterSceneSave.librarySnapshot.projects[0].projectIndex.scenes.find((scene) => scene.id === "scene-1")?.wordCount,
    3,
  );
  assert.equal(
    Number(
      persistedAfterSceneSave.librarySnapshot.projects[0].projectIndex.scenes.find((scene) => scene.id === "scene-2")?.wordCount,
    ) > 0,
    true,
  );
  assert.equal(
    Number(
      persistedAfterSceneSave.librarySnapshot.projects[0].projectIndex.chapters.find((chapter) => chapter.id === "chapter-1")?.wordCount,
    ) > 0,
    true,
  );

  projectService.saveUserPreference("pref-editor-width", 760);
  assert.equal(projectService.loadUserPreference("pref-editor-width", 0), 760);
}

function createProjectRecord() {
  return {
    id: "project-test",
    title: "Project Test",
    source: "user",
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
            text: "Scene one opening line.",
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneId: "scene-1",
            sceneTitle: "Scene One",
            sceneSynopsis: "",
            issueIds: [],
            eventTagIds: [],
          },
          {
            blockId: "block-2",
            lineNumber: 2,
            kind: "narration",
            speakerLabel: "",
            text: "Scene two opening line.",
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneId: "scene-2",
            sceneTitle: "Scene Two",
            sceneSynopsis: "",
            issueIds: [],
            eventTagIds: [],
          },
        ],
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
        {
          sceneId: "scene-2",
          chapterId: "chapter-1",
          chapterTitle: "Chapter One",
          sceneTitle: "Scene Two",
          sceneSynopsis: "",
          order: 2,
          initialText: "",
        },
      ],
    },
    templateDrafts: [],
    manuscriptTasks: [],
    passageNotes: [],
    projectSettings: {
      projectFilePath: "C:\\Projects\\project-test.abe-project",
      projectSourcePath: "C:\\Projects\\project-test.scriv",
      assetRegistry: [],
    },
    editorPrefs: {},
    localAiPrefs: {
      enabled: true,
    },
  };
}

function createMemoryWindow() {
  const values = new Map();
  const readCounts = new Map();
  const writeCounts = new Map();

  function increment(counter, key) {
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  return {
    __resetCounters() {
      readCounts.clear();
      writeCounts.clear();
    },
    __getReadCount(key) {
      return readCounts.get(key) ?? 0;
    },
    __getWriteCount(key) {
      return writeCounts.get(key) ?? 0;
    },
    localStorage: {
      getItem(key) {
        increment(readCounts, key);
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        increment(writeCounts, key);
        values.set(key, String(value));
      },
      removeItem(key) {
        increment(writeCounts, key);
        values.delete(key);
      },
    },
  };
}
