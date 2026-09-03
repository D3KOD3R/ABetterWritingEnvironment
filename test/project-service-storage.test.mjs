// Intent: verify chunked project storage persists manifest metadata separately from per-scene content.
import assert from "node:assert/strict";

import { createBrowserStorageAdapter } from "../apps/editor/public/adapters/storage/browser-storage-adapter.js";
import { createPreferencesRepository } from "../apps/editor/public/adapters/storage/preferences-repository.js";
import { migrateProjectData, PROJECT_SCHEMA_VERSION } from "../apps/editor/public/adapters/storage/project-migrations.js";
import { createProjectRepository } from "../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../apps/editor/public/adapters/storage/project-service.js";
import { buildSceneRecords } from "../apps/editor/public/editor-model.js";
import { buildWorldSpineTimelineModel } from "../apps/editor/public/features/world-spine/world-spine-panel.js";

export async function runProjectServiceStorageTest() {
  const memoryWindow = createMemoryWindow();
  const storageAdapter = createBrowserStorageAdapter({
    windowRef: memoryWindow,
  });

  assert.equal(storageAdapter.writeJson("contract-key", { ok: true }), true);
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

  // Intent: a full browser cache must not force project-file loads to rehydrate stale scene chunks.
  const quotaWarnings = [];
  const quotaStorageAdapter = createBrowserStorageAdapter({
    windowRef: createQuotaFailingWindow(),
    reportBrowserLog: (level, source, message, context) => {
      quotaWarnings.push({ level, source, message, context });
    },
  });
  const quotaProjectService = createProjectService({
    projectRepository: createProjectRepository({
      storageAdapter: quotaStorageAdapter,
      libraryStorageKey: "quota-test-project-library-v1",
      activeProjectIdStorageKey: "quota-test-active-v1",
    }),
    preferencesRepository: createPreferencesRepository({
      storageAdapter: quotaStorageAdapter,
    }),
    now: () => "2026-05-14T00:00:00.000Z",
  });
  const quotaPersistedSnapshot = quotaProjectService.saveProjectLibrarySnapshot({
    activeProjectId: "project-test",
    projects: [createProjectRecord()],
  });
  assert.equal(quotaPersistedSnapshot.activeProjectId, "project-test");
  assert.equal(quotaPersistedSnapshot.storagePersisted, false);
  assert.equal(
    quotaPersistedSnapshot.projects[0]?.sceneDrafts?.["scene-1"]?.editorText.includes("Scene one opening line."),
    true,
  );
  assert.equal(quotaWarnings.length, 1);
  assert.equal(quotaWarnings[0]?.context?.error?.name, "QuotaExceededError");

  const migrated = migrateProjectData({
    activeProjectId: "project-test",
    projects: [createProjectRecord()],
  });
  assert.equal(migrated.schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.projects[0].schemaVersion, PROJECT_SCHEMA_VERSION);
  assert.equal(migrated.projects[0].projectIndex.projectId, "project-test");
  assert.deepEqual(migrated.projects[0].workspace.project.marks, []);
  assert.equal(
    migrated.projects[0].projectIndex.scenes.find((scene) => scene.id === "scene-1")?.inspirationCount,
    1,
  );
  assert.deepEqual(
    migrateProjectData(migrated),
    migrated,
    "Migrating the current schema twice must be idempotent.",
  );
  assert.throws(
    () => migrateProjectData({ schemaVersion: PROJECT_SCHEMA_VERSION + 1, projects: [createProjectRecord()] }),
    /newer than this app supports/,
  );
  assert.throws(
    () => migrateProjectData({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projects: [{ ...createProjectRecord(), schemaVersion: PROJECT_SCHEMA_VERSION + 1 }],
    }),
    /newer than this app supports/,
  );

  // Intent: existing indexes from older project files must be repaired from passage notes during migration.
  const migratedWithExistingIndex = migrateProjectData({
    activeProjectId: "project-test",
    projects: [{
      ...createProjectRecord(),
      projectIndex: {
        schemaVersion: 1,
        projectId: "project-test",
        projectTitle: "Project Test",
        scenes: [
          {
            id: "scene-1",
            title: "Scene One",
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            order: 1,
            lineCount: 1,
            wordCount: 4,
            synopsis: "",
            assetIds: [],
          },
        ],
        chapters: [
          {
            id: "chapter-1",
            title: "Chapter One",
            order: 1,
            sceneIds: ["scene-1"],
            lineCount: 1,
            wordCount: 4,
          },
        ],
        sceneOrder: ["scene-1"],
      },
    }],
  });
  assert.equal(
    migratedWithExistingIndex.projects[0].projectIndex.scenes.find((scene) => scene.id === "scene-1")?.inspirationCount,
    1,
  );
  assert.equal(
    migratedWithExistingIndex.projects[0].projectIndex.chapters.find((chapter) => chapter.id === "chapter-1")?.inspirationCount,
    1,
  );

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
  assert.equal(rawStoredManifest.projects[0].passageNotes.length, 1);
  assert.equal(rawStoredManifest.projects[0].passageNotes[0].id, "inspiration-1");
  assert.equal(
    rawStoredManifest.projects[0].projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.inspirationCount,
    1,
  );
  assert.equal(
    rawStoredManifest.projects[0].projectIndex?.chapters?.find((chapter) => chapter.id === "chapter-1")?.inspirationCount,
    1,
  );
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
  assert.equal(opened.projectRecord?.passageNotes?.length, 1);
  assert.equal(opened.projectRecord?.passageNotes?.[0]?.id, "inspiration-1");
  assert.equal(
    opened.projectRecord?.projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.inspirationCount,
    1,
  );
  assert.equal(
    opened.projectRecord?.projectIndex?.chapters?.find((chapter) => chapter.id === "chapter-1")?.inspirationCount,
    1,
  );
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
  assert.equal(exportedSnapshot.projects[0].passageNotes.length, 1);
  assert.equal(exportedSnapshot.projects[0].passageNotes[0].id, "inspiration-1");
  assert.equal(
    exportedSnapshot.projects[0].projectIndex?.scenes?.find((scene) => scene.id === "scene-1")?.inspirationCount,
    1,
  );
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
  const runtimeMetadataOnlyRecord = structuredClone(opened.projectRecord);
  runtimeMetadataOnlyRecord.sceneDrafts = {
    ...(runtimeMetadataOnlyRecord.sceneDrafts ?? {}),
    "scene-1": {
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "Scene One",
      location: "Earth",
      locationRowLabel: "Earth",
      locationRowKey: "earth",
      locationScope: "planetary",
      worldSpineMetadata: {
        location: "Earth",
        locationRowLabel: "Earth",
        locationRowKey: "earth",
        locationScope: "planetary",
        sublocation: "The Lost Facility",
      },
    },
  };
  const exportedMetadataOnlySnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: {
      activeProjectId: "project-test",
      projects: [runtimeMetadataOnlyRecord],
    },
  });
  assert.equal(
    exportedMetadataOnlySnapshot.sceneStore["project-test"]["scene-1"].editorText,
    "Scene one opening line.",
  );
  assert.equal(exportedMetadataOnlySnapshot.sceneStore["project-test"]["scene-1"].location, "Earth");
  assert.equal(exportedMetadataOnlySnapshot.sceneStore["project-test"]["scene-1"].locationRowKey, "earth");
  assert.equal(exportedMetadataOnlySnapshot.sceneStore["project-test"]["scene-1"].worldSpineMetadata.location, "Earth");
  assert.equal(exportedMetadataOnlySnapshot.sceneStore["project-test"]["scene-1"].worldSpineMetadata.sublocation, "The Lost Facility");
  projectService.saveProjectLibrarySnapshot({
    activeProjectId: "project-test",
    projects: [runtimeMetadataOnlyRecord],
    sceneStore: exportedMetadataOnlySnapshot.sceneStore,
  }, {
    changedSceneIdsByProject: {
      "project-test": ["scene-1"],
    },
  });
  const storedMetadataOnlyScene = projectRepository.loadScene("project-test", "scene-1");
  assert.equal(storedMetadataOnlyScene.editorText, "Scene one opening line.");
  assert.equal(storedMetadataOnlyScene.location, "Earth");
  assert.equal(storedMetadataOnlyScene.locationRowLabel, "Earth");
  assert.equal(storedMetadataOnlyScene.locationRowKey, "earth");
  assert.equal(storedMetadataOnlyScene.worldSpineMetadata.location, "Earth");
  const reopenedMetadataOnlyProject = projectService.openProject();
  assert.equal(reopenedMetadataOnlyProject.projectRecord.sceneDrafts["scene-1"].location, "Earth");
  assert.equal(reopenedMetadataOnlyProject.projectRecord.sceneDrafts["scene-1"].locationRowKey, "earth");
  assert.equal(reopenedMetadataOnlyProject.projectRecord.sceneDrafts["scene-1"].worldSpineMetadata.location, "Earth");
  const metadataOnlyChangedSceneRecord = structuredClone(opened.projectRecord);
  metadataOnlyChangedSceneRecord.sceneDrafts = {
    "scene-2": {
      sceneId: "scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "Scene Two",
      location: "Mars",
      locationRowLabel: "Mars",
      locationRowKey: "mars",
      locationScope: "planetary",
      worldSpineMetadata: {
        location: "Mars",
        locationRowLabel: "Mars",
        locationRowKey: "mars",
        locationScope: "planetary",
      },
    },
  };
  projectService.saveProject({
    projectRecord: metadataOnlyChangedSceneRecord,
    persist: true,
    changedSceneIds: ["scene-2"],
  });
  const storedMetadataOnlyChangedScene = projectRepository.loadScene("project-test", "scene-2");
  assert.equal(storedMetadataOnlyChangedScene.editorText, "Scene two opening line.");
  assert.equal(storedMetadataOnlyChangedScene.blocks[0].text, "Scene two opening line.");
  assert.equal(storedMetadataOnlyChangedScene.location, "Mars");
  assert.equal(storedMetadataOnlyChangedScene.locationRowKey, "mars");
  assert.equal(storedMetadataOnlyChangedScene.worldSpineMetadata.location, "Mars");
  const metadataOnlyChangedProject = projectService.openProject().projectRecord;
  assert.equal(
    metadataOnlyChangedProject.projectIndex.scenes.find((scene) => scene.id === "scene-2")?.wordCount,
    4,
  );

  // Intent: a browser reload keeps non-active scene placement projectable without eagerly hydrating its body.
  const browserReloadRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "test-project-library-v1",
    activeProjectIdStorageKey: "test-project-active-v1",
  });
  const browserReloadService = createProjectService({
    projectRepository: browserReloadRepository,
    preferencesRepository: createPreferencesRepository({ storageAdapter }),
    now: () => "2026-05-14T00:00:00.000Z",
  });
  const browserReloadLibrary = browserReloadService.loadProjectLibrarySnapshot();
  const browserReloadProject = browserReloadLibrary.projects[0];
  assert.deepEqual(Object.keys(browserReloadProject.sceneDrafts), ["scene-1"]);
  const reloadedNonActiveSceneMetadata = browserReloadLibrary.sceneStore?.["project-test"]?.["scene-2"];
  assert.equal(reloadedNonActiveSceneMetadata?.location, "Mars");
  assert.equal(reloadedNonActiveSceneMetadata?.locationRowLabel, "Mars");
  assert.equal(reloadedNonActiveSceneMetadata?.locationRowKey, "mars");
  assert.equal(reloadedNonActiveSceneMetadata?.worldSpineMetadata?.locationRowKey, "mars");
  assert.equal(Object.hasOwn(reloadedNonActiveSceneMetadata ?? {}, "editorText"), false);
  assert.equal(Object.hasOwn(reloadedNonActiveSceneMetadata ?? {}, "blocks"), false);
  const reloadedLogicalScenes = buildSceneRecords(
    browserReloadProject.workspace,
    {
      ...(browserReloadLibrary.sceneStore?.["project-test"] ?? {}),
      ...browserReloadProject.sceneDrafts,
    },
    browserReloadProject.structureDrafts,
  );
  const reloadedWorldSpine = buildWorldSpineTimelineModel({
    workspace: browserReloadProject.workspace,
    scenes: reloadedLogicalScenes,
  });
  assert.equal(
    reloadedWorldSpine.timeline.locationRows.some((row) => row.locationKey === "mars"),
    true,
  );
  assert.equal(
    reloadedWorldSpine.timeline.primaryNodes.find((node) => node.sceneId === "scene-2")?.locationRowKey,
    "mars",
  );
  const indexedManifestSnapshot = storageAdapter.readJson("test-project-library-v1");
  const legacyManifestSnapshot = structuredClone(indexedManifestSnapshot);
  legacyManifestSnapshot.projects[0].projectIndex.scenes.forEach((scene) => {
    delete scene.metadata;
  });
  storageAdapter.writeJson("test-project-library-v1", legacyManifestSnapshot);
  const legacyReloadRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "test-project-library-v1",
    activeProjectIdStorageKey: "test-project-active-v1",
  });
  const legacyReloadLibrary = legacyReloadRepository.loadProjectLibrarySnapshot();
  assert.equal(legacyReloadLibrary.sceneStore["project-test"]["scene-2"].locationRowKey, "mars");
  assert.equal(Object.hasOwn(legacyReloadLibrary.sceneStore["project-test"]["scene-2"], "editorText"), false);
  assert.deepEqual(Object.keys(legacyReloadLibrary.projects[0].sceneDrafts), ["scene-1"]);
  storageAdapter.writeJson("test-project-library-v1", indexedManifestSnapshot);

  // Intent: successive metadata-only row assignments must accumulate before a single browser reload.
  const sequentialWindow = createMemoryWindow();
  const sequentialStorageAdapter = createBrowserStorageAdapter({ windowRef: sequentialWindow });
  const sequentialRepository = createProjectRepository({
    storageAdapter: sequentialStorageAdapter,
    libraryStorageKey: "sequential-project-library-v1",
    activeProjectIdStorageKey: "sequential-project-active-v1",
  });
  const sequentialService = createProjectService({
    projectRepository: sequentialRepository,
    preferencesRepository: createPreferencesRepository({ storageAdapter: sequentialStorageAdapter }),
    now: () => "2026-05-14T00:00:00.000Z",
  });
  const sequentialSeed = createProjectRecord();
  sequentialSeed.workspace.project.lines.push({
    ...structuredClone(sequentialSeed.workspace.project.lines[1]),
    blockId: "block-3",
    lineNumber: 3,
    text: "Scene three opening line.",
    sceneId: "scene-3",
    sceneTitle: "Scene Three",
  });
  sequentialSeed.structureDrafts.scenes.push({
    ...structuredClone(sequentialSeed.structureDrafts.scenes[1]),
    sceneId: "scene-3",
    sceneTitle: "Scene Three",
    order: 3,
  });
  let sequentialSave = sequentialService.createProject({
    projectRecord: sequentialSeed,
    persist: true,
  });
  for (const [sceneId, location] of [
    ["scene-1", "Earth"],
    ["scene-2", "Earth"],
    ["scene-3", "Mars"],
  ]) {
    const currentRecord = sequentialSave.librarySnapshot.projects[0];
    sequentialSave = sequentialService.saveProject({
      projectRecord: {
        ...structuredClone(currentRecord),
        sceneDrafts: {
          [sceneId]: {
            sceneId,
            chapterId: "chapter-1",
            chapterTitle: "Chapter One",
            sceneTitle: sceneId === "scene-3" ? "Scene Three" : `Scene ${sceneId.endsWith("1") ? "One" : "Two"}`,
            location,
            locationRowLabel: location,
            locationRowKey: location.toLowerCase(),
            locationScope: "planetary",
            worldSpineMetadata: {
              location,
              locationRowLabel: location,
              locationRowKey: location.toLowerCase(),
              locationScope: "planetary",
            },
          },
        },
      },
      librarySnapshot: sequentialSave.librarySnapshot,
      persist: true,
      changedSceneIds: [sceneId],
    });
  }
  const sequentialReloadRepository = createProjectRepository({
    storageAdapter: sequentialStorageAdapter,
    libraryStorageKey: "sequential-project-library-v1",
    activeProjectIdStorageKey: "sequential-project-active-v1",
  });
  const sequentialReloadLibrary = sequentialReloadRepository.loadProjectLibrarySnapshot();
  const sequentialReloadProject = sequentialReloadLibrary.projects[0];
  assert.deepEqual(
    sequentialReloadProject.projectIndex.scenes.map((scene) => [scene.id, scene.metadata?.locationRowKey]),
    [["scene-1", "earth"], ["scene-2", "earth"], ["scene-3", "mars"]],
  );
  assert.deepEqual(
    ["scene-1", "scene-2", "scene-3"].map((sceneId) =>
      sequentialReloadLibrary.sceneStore["project-test"][sceneId].locationRowKey),
    ["earth", "earth", "mars"],
  );
  const sequentialReloadScenes = buildSceneRecords(
    sequentialReloadProject.workspace,
    {
      ...sequentialReloadLibrary.sceneStore["project-test"],
      ...sequentialReloadProject.sceneDrafts,
    },
    sequentialReloadProject.structureDrafts,
  );
  const sequentialReloadWorldSpine = buildWorldSpineTimelineModel({
    workspace: sequentialReloadProject.workspace,
    scenes: sequentialReloadScenes,
  });
  assert.deepEqual(
    sequentialReloadWorldSpine.timeline.primaryNodes.map((node) => [node.sceneId, node.locationRowKey]),
    [["scene-1", "earth"], ["scene-2", "earth"], ["scene-3", "mars"]],
  );

  // Intent: project-file scene stores are authoritative for unopened scenes during export.
  const exportedAuthoritativeFileSnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: {
      activeProjectId: "project-test",
      projects: [
        {
          ...opened.projectRecord,
          sceneDrafts: {},
        },
      ],
      sceneStore: {
        "project-test": {
          "scene-1": {
            ...projectRepository.loadScene("project-test", "scene-1"),
            editorText: "File authority scene one.",
          },
          "scene-2": {
            ...projectRepository.loadScene("project-test", "scene-2"),
            editorText: "File authority scene two.",
          },
        },
      },
    },
  });
  assert.equal(
    exportedAuthoritativeFileSnapshot.sceneStore["project-test"]["scene-2"].editorText,
    "File authority scene two.",
  );
  const exportedEmptyAuthoritativeFileSnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: {
      activeProjectId: "project-test",
      projects: [{ ...opened.projectRecord, sceneDrafts: {} }],
      sceneStore: {
        "project-test": {
          "scene-2": {
            ...projectRepository.loadScene("project-test", "scene-2"),
            editorText: "",
            blocks: [],
          },
        },
      },
    },
  });
  assert.equal(exportedEmptyAuthoritativeFileSnapshot.sceneStore["project-test"]["scene-2"].editorText, "");
  assert.deepEqual(exportedEmptyAuthoritativeFileSnapshot.sceneStore["project-test"]["scene-2"].blocks, []);

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

  // Intent: loading a project JSON file must replace the browser project cache instead of merging with stale chunks.
  storageAdapter.writeJson("test-project-library-v1:scene:stale-project:scene-old", {
    sceneId: "scene-old",
    editorText: "Stale browser manuscript body.",
    blocks: [],
  });
  storageAdapter.writeJson("test-project-library-v1:stale-extra", { stale: true });
  const replacementRecord = {
    ...createProjectRecord(),
    title: "Replacement Project",
  };
  const replacementSnapshot = projectService.saveProjectLibrarySnapshot({
    activeProjectId: "project-test",
    projects: [replacementRecord],
  }, {
    replaceExistingCache: true,
  });
  assert.equal(replacementSnapshot.storagePersisted, true);
  assert.equal(storageAdapter.readJson("test-project-library-v1:scene:stale-project:scene-old"), null);
  assert.equal(storageAdapter.readJson("test-project-library-v1:stale-extra"), null);
  assert.equal(storageAdapter.readJson("test-project-library-v1").projects.length, 1);

  // Intent: authoritative file loads must not borrow old scene bodies even when browser cache removal fails.
  const removeFailWindow = createMemoryWindow();
  const removeFailStorageAdapter = createBrowserStorageAdapter({
    windowRef: removeFailWindow,
  });
  const removeFailProjectService = createProjectService({
    projectRepository: createProjectRepository({
      storageAdapter: removeFailStorageAdapter,
      libraryStorageKey: "remove-fail-project-library-v1",
      activeProjectIdStorageKey: "remove-fail-active-v1",
    }),
    preferencesRepository: createPreferencesRepository({
      storageAdapter: removeFailStorageAdapter,
    }),
    now: () => "2026-05-14T00:00:00.000Z",
  });
  removeFailProjectService.saveProjectLibrarySnapshot({
    activeProjectId: "project-test",
    projects: [createProjectRecord()],
  });
  removeFailStorageAdapter.writeJson("remove-fail-project-library-v1:scene:project-test:scene-1", {
    sceneId: "scene-1",
    editorText: "Stale browser manuscript body.",
    blocks: [
      {
        blockId: "block-stale",
        lineNumber: 1,
        kind: "narration",
        speakerLabel: "",
        text: "Stale browser manuscript body.",
        issueIds: [],
        eventTagIds: [],
        isDraft: false,
      },
    ],
  });
  const manifestOnlyRecord = structuredClone(
    removeFailStorageAdapter.readJson("remove-fail-project-library-v1").projects[0],
  );
  removeFailWindow.__setRemoveFailure(true);
  const authoritativeReplacement = removeFailProjectService.saveProjectLibrarySnapshot({
    activeProjectId: "project-test",
    projects: [manifestOnlyRecord],
  }, {
    replaceExistingCache: true,
  });
  assert.equal(authoritativeReplacement.storagePersisted, false);
  assert.equal(
    authoritativeReplacement.projects[0].sceneDrafts?.["scene-1"]?.editorText,
    "",
  );
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
    passageNotes: [
      {
        id: "inspiration-1",
        noteType: "inspiration",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneId: "scene-1",
        sceneTitle: "Scene One",
        selectedText: "Scene one opening",
        startOffset: 0,
        endOffset: 17,
        body: "Keep the first image vivid.",
        title: "Opening image",
        createdAt: "2026-05-20T00:00:00.000Z",
        source: "manual",
      },
    ],
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
  let removeShouldFail = false;

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
    __setRemoveFailure(value) {
      removeShouldFail = value === true;
    },
    localStorage: {
      get length() {
        return values.size;
      },
      getItem(key) {
        increment(readCounts, key);
        return values.has(key) ? values.get(key) : null;
      },
      key(index) {
        return [...values.keys()][index] ?? null;
      },
      setItem(key, value) {
        increment(writeCounts, key);
        values.set(key, String(value));
      },
      removeItem(key) {
        increment(writeCounts, key);
        if (removeShouldFail) {
          throw new Error("Synthetic remove failure.");
        }
        values.delete(key);
      },
    },
  };
}

function createQuotaFailingWindow() {
  return {
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {
        const error = new Error("Synthetic quota exceeded.");
        error.name = "QuotaExceededError";
        throw error;
      },
      removeItem() {},
    },
  };
}
