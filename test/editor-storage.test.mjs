// Intent: verify editor storage keys persist current project-state records and remain backward compatible.
import assert from "node:assert/strict";

import {
  EDITOR_DRAFTS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PROJECT_SOURCE_PATH_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
} from "../apps/editor/public/editor-model.js";
import {
  PROJECT_CONTENT_STORAGE_KEYS,
  PROJECT_STATE_STORAGE_KEYS,
  createEditorStorage,
} from "../apps/editor/public/adapters/storage/editor-storage.js";

export function runEditorStorageTest() {
  const storageValues = new Map();
  const windowRef = {
    localStorage: {
      getItem(key) {
        return storageValues.has(key) ? storageValues.get(key) : null;
      },
      setItem(key, value) {
        storageValues.set(key, String(value));
      },
      removeItem(key) {
        storageValues.delete(key);
      },
    },
  };
  const editorStorage = createEditorStorage({ windowRef });

  // Current canonical keys must trigger project-record persistence in app.js.
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_DRAFTS_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_STRUCTURE_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_TEMPLATE_DRAFTS_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_TASKS_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_PASSAGE_NOTES_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_PROJECT_TITLE_KEY), true);
  assert.equal(PROJECT_CONTENT_STORAGE_KEYS.has(EDITOR_PROJECT_SOURCE_PATH_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_PREFS_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_LOCAL_AI_PREFS_KEY), true);
  assert.equal(PROJECT_CONTENT_STORAGE_KEYS.has(EDITOR_PREFS_KEY), false);
  assert.equal(PROJECT_CONTENT_STORAGE_KEYS.has(EDITOR_LOCAL_AI_PREFS_KEY), false);

  // Canonical load path.
  storageValues.set(EDITOR_DRAFTS_KEY, JSON.stringify({ "scene-1": { sceneId: "scene-1" } }));
  storageValues.set(EDITOR_STRUCTURE_KEY, JSON.stringify({ scenes: [{ sceneId: "draft-scene-1" }] }));
  storageValues.set(EDITOR_TASKS_KEY, JSON.stringify([
    {
      id: "task-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "hello",
      startOffset: 0,
      endOffset: 5,
      status: "open",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]));
  assert.equal(Object.keys(editorStorage.loadSceneDrafts()).length, 1);
  assert.equal(Array.isArray(editorStorage.loadStructureDrafts().scenes), true);
  assert.equal(editorStorage.loadManuscriptTasks().length, 1);

  // Legacy fallback path remains compatible for existing browser snapshots.
  storageValues.delete(EDITOR_DRAFTS_KEY);
  storageValues.delete(EDITOR_STRUCTURE_KEY);
  storageValues.delete(EDITOR_TASKS_KEY);
  storageValues.set("abe-drafts-v1", JSON.stringify({ "scene-2": { sceneId: "scene-2" } }));
  storageValues.set("abe-structure-v1", JSON.stringify({ scenes: [{ sceneId: "draft-scene-legacy" }] }));
  storageValues.set("abe-task-list-v1", JSON.stringify([
    {
      id: "task-legacy-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneId: "scene-1",
      sceneTitle: "Scene One",
      selectedText: "legacy",
      startOffset: 0,
      endOffset: 6,
      status: "open",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]));
  assert.equal(Object.keys(editorStorage.loadSceneDrafts()).length, 1);
  assert.equal(Array.isArray(editorStorage.loadStructureDrafts().scenes), true);
  assert.equal(editorStorage.loadManuscriptTasks().length, 1);

  storageValues.set(EDITOR_PREFS_KEY, JSON.stringify({ theme: "dark" }));
  storageValues.set(EDITOR_PROJECT_SOURCE_PATH_KEY, JSON.stringify("C:\\Projects\\old.scriv"));
  storageValues.set("abe-collapsed-chapters-v1", JSON.stringify({ "project-old": ["chapter-1"] }));
  storageValues.set("abe-writing-targets-v1", JSON.stringify({ "project-old": { targetWords: 90000 } }));
  assert.equal(editorStorage.clearProjectContentStorage({
    additionalStorageKeys: ["abe-writing-targets-v1"],
  }), true);
  assert.equal(storageValues.has("abe-drafts-v1"), false);
  assert.equal(storageValues.has("abe-structure-v1"), false);
  assert.equal(storageValues.has("abe-task-list-v1"), false);
  assert.equal(storageValues.has(EDITOR_PROJECT_SOURCE_PATH_KEY), false);
  assert.equal(storageValues.has("abe-collapsed-chapters-v1"), false);
  assert.equal(storageValues.has("abe-writing-targets-v1"), false);
  assert.equal(storageValues.has(EDITOR_PREFS_KEY), true);
}
