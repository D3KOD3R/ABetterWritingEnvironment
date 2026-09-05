// Intent: keep a newly generated numbered scene title intact before its first persisted scene chunk exists.
import assert from "node:assert/strict";

import { createProjectRepository } from "../apps/editor/public/adapters/storage/project-repository.js";
import { createProjectService } from "../apps/editor/public/adapters/storage/project-service.js";

function createMemoryStorageAdapter() {
  const values = new Map();
  return {
    readJson(key) {
      return values.has(key) ? structuredClone(values.get(key)) : null;
    },
    writeJson(key, value) {
      values.set(key, structuredClone(value));
      return true;
    },
    remove(key) {
      values.delete(key);
      return true;
    },
    listKeys() {
      return [...values.keys()];
    },
  };
}

export function runUntitledScenePersistenceFallbackTest() {
  const projectRepository = createProjectRepository({
    storageAdapter: createMemoryStorageAdapter(),
  });
  const projectService = createProjectService({
    projectRepository,
    preferencesRepository: {},
  });
  const sceneId = "draft-scene-new";
  const projectRecord = {
    id: "project-1",
    sceneDrafts: {
      [sceneId]: {
        sceneId,
        chapterId: "chapter-oasis",
        chapterTitle: "Oasis",
        sceneTitle: "Untitled Scene 7",
        editorText: "",
        blocks: [],
      },
    },
  };

  // A missing chunk must stay missing so projectService can use the live numbered draft.
  assert.equal(projectRepository.loadScene(projectRecord.id, sceneId), null);
  assert.equal(
    projectService.loadScene({ projectRecord, sceneId })?.sceneTitle,
    "Untitled Scene 7",
  );

  // Once persisted, the same title must round-trip through the repository unchanged.
  projectRepository.saveScene(projectRecord.id, sceneId, projectRecord.sceneDrafts[sceneId]);
  assert.equal(
    projectService.loadScene({ projectRecord, sceneId })?.sceneTitle,
    "Untitled Scene 7",
  );
}
