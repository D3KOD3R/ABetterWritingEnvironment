// Intent: reproduce desktop-package activation through the browser repository and retain Scrivener provenance for the immediate Save.
import assert from "node:assert/strict";

import { createBrowserStorageAdapter } from "../apps/editor/public/adapters/storage/browser-storage-adapter.js";
import { createPreferencesRepository } from "../apps/editor/public/adapters/storage/preferences-repository.js";
import { createProjectRepository } from "../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../apps/editor/public/adapters/storage/project-service.js";

const PROJECT_ID = "scrivener-runtime-hydration";
const SCENE_ID = "scene-0001";
const SCRIVENER_METADATA = Object.freeze({
  uuid: "SCRIVENER-SCENE-0001",
  type: "Text",
  binderPath: ["Draft", "Chapter One", "Opening Scene"],
  contentFilePath: "Files/Data/SCRIVENER-SCENE-0001/content.rtf",
  label: "First Draft",
  status: "To Do",
  notes: "Imported inspector note",
  keywords: ["opening"],
  includeInCompile: true,
  rawCustomMetadata: {},
  raw: {},
});

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

function createImportedSnapshot() {
  const block = {
    blockId: "block-0001",
    paragraphId: "paragraph-0001",
    lineNumber: 1,
    kind: "narration",
    speakerLabel: "",
    text: "Imported scene body.",
    issueIds: [],
    eventTagIds: [],
    isDraft: false,
  };
  const scene = {
    sceneId: SCENE_ID,
    chapterId: "chapter-0001",
    chapterTitle: "Chapter One",
    sceneTitle: "Opening Scene",
    sceneSynopsis: "",
    editorText: block.text,
    blocks: [block],
    scrivenerMetadata: structuredClone(SCRIVENER_METADATA),
  };
  return {
    schemaVersion: 2,
    activeProjectId: PROJECT_ID,
    projects: [{
      id: PROJECT_ID,
      schemaVersion: 2,
      title: "Imported Novel",
      source: "scrivener-import",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
      workspace: {
        generatedAt: "2026-09-04T00:00:00.000Z",
        workspaceTitle: "ABetterNovelAuthoringEnvironment",
        project: {
          id: PROJECT_ID,
          title: "Imported Novel",
          lines: [{
            ...block,
            sceneId: SCENE_ID,
            chapterId: "chapter-0001",
            chapterTitle: "Chapter One",
            sceneTitle: "Opening Scene",
            sceneSynopsis: "",
          }],
        },
      },
      sceneDrafts: { [SCENE_ID]: scene },
      structureDrafts: {
        sceneOrder: [SCENE_ID],
        scenes: [{
          sceneId: SCENE_ID,
          chapterId: "chapter-0001",
          chapterTitle: "Chapter One",
          sceneTitle: "Opening Scene",
          sceneSynopsis: "",
          order: 1,
          initialText: "",
        }],
      },
      projectSettings: { activeSceneId: SCENE_ID },
    }],
    sceneStore: { [PROJECT_ID]: { [SCENE_ID]: scene } },
  };
}

export async function runScrivenerMetadataRuntimeHydrationTest() {
  const storageAdapter = createBrowserStorageAdapter({ windowRef: createMemoryWindow() });
  const projectRepository = createProjectRepository({
    storageAdapter,
    libraryStorageKey: "scrivener-runtime-project-library",
    activeProjectIdStorageKey: "scrivener-runtime-active-project",
  });
  const projectService = createProjectService({
    projectRepository,
    preferencesRepository: createPreferencesRepository({ storageAdapter }),
    now: () => "2026-09-04T00:00:00.000Z",
  });

  // This is the same cache replacement performed while hydrateProjectLibraryFromLoadedSnapshot activates a desktop package.
  const activatedLibrary = projectService.saveProjectLibrarySnapshot(createImportedSnapshot(), {
    replaceExistingCache: true,
  });
  assert.deepEqual(
    activatedLibrary.projects[0].sceneDrafts[SCENE_ID].scrivenerMetadata,
    SCRIVENER_METADATA,
  );
  assert.deepEqual(
    activatedLibrary.sceneStore[PROJECT_ID][SCENE_ID].scrivenerMetadata,
    SCRIVENER_METADATA,
  );
  assert.equal(Object.hasOwn(activatedLibrary.sceneStore[PROJECT_ID][SCENE_ID], "editorText"), false);

  // The immediate GUI Save merges the active body-bearing runtime draft with retained scene metadata here.
  const immediateSaveSnapshot = projectService.exportProjectLibrarySnapshot({
    librarySnapshot: activatedLibrary,
  });
  assert.equal(immediateSaveSnapshot.sceneStore[PROJECT_ID][SCENE_ID].editorText, "Imported scene body.");
  assert.deepEqual(immediateSaveSnapshot.sceneStore[PROJECT_ID][SCENE_ID].scrivenerMetadata, SCRIVENER_METADATA);

  projectService.saveProjectLibrarySnapshot(immediateSaveSnapshot, { replaceExistingCache: true });
  const reopenedLibrary = projectService.loadProjectLibrarySnapshot();
  assert.deepEqual(
    reopenedLibrary.projects[0].sceneDrafts[SCENE_ID].scrivenerMetadata,
    SCRIVENER_METADATA,
  );
  assert.deepEqual(
    reopenedLibrary.sceneStore[PROJECT_ID][SCENE_ID].scrivenerMetadata,
    SCRIVENER_METADATA,
  );
}
