// Intent: verify editor storage keys persist current project-state records and remain backward compatible.
import assert from "node:assert/strict";

import {
  EDITOR_DRAFTS_KEY,
  EDITOR_LOCAL_AI_PREFS_KEY,
  EDITOR_PASSAGE_NOTES_KEY,
  EDITOR_PREFS_KEY,
  EDITOR_PROJECT_TITLE_KEY,
  EDITOR_STRUCTURE_KEY,
  EDITOR_TASKS_KEY,
  EDITOR_TEMPLATE_DRAFTS_KEY,
} from "../apps/editor/public/editor-model.js";
import { PROJECT_STATE_STORAGE_KEYS, createEditorStorage } from "../apps/editor/public/adapters/storage/editor-storage.js";

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
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_PREFS_KEY), true);
  assert.equal(PROJECT_STATE_STORAGE_KEYS.has(EDITOR_LOCAL_AI_PREFS_KEY), true);

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
}
