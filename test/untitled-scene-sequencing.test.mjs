// Intent: verify generated scene placeholders advance per chapter without colliding after deletes or overriding authored titles.
import assert from "node:assert/strict";

import {
  buildSceneRecords,
  insertStructureSceneDraftAfterAnchor,
  resolveNextUntitledSceneTitle,
} from "../apps/editor/public/editor-model.js";

export function runUntitledSceneSequencingTest() {
  const existingScenes = [
    { sceneId: "scene-1", chapterId: "chapter-1", sceneTitle: "Untitled Scene 1" },
    { sceneId: "scene-named", chapterId: "chapter-1", sceneTitle: "Europa Arrival" },
    { sceneId: "scene-4", chapterId: "chapter-1", sceneTitle: "Untitled Scene 4" },
    { sceneId: "other-99", chapterId: "chapter-2", sceneTitle: "Untitled Scene 99" },
  ];

  assert.equal(resolveNextUntitledSceneTitle(existingScenes, "chapter-1"), "Untitled Scene 5");
  assert.equal(resolveNextUntitledSceneTitle(existingScenes, "chapter-2"), "Untitled Scene 100");
  assert.equal(resolveNextUntitledSceneTitle(existingScenes, "chapter-3"), "Untitled Scene 1");

  const inserted = insertStructureSceneDraftAfterAnchor(
    { scenes: [], sceneOrder: [] },
    existingScenes,
    {
      sceneId: "draft-scene-new",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "New Scene 4",
      initialText: "",
    },
    "scene-4",
  );
  assert.equal(
    inserted.scenes.find((scene) => scene.sceneId === "draft-scene-new")?.sceneTitle,
    "Untitled Scene 5",
  );

  const scenesWithInsertedDraft = [
    ...existingScenes,
    {
      sceneId: "draft-scene-new",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "Untitled Scene 5",
    },
  ];
  const customInserted = insertStructureSceneDraftAfterAnchor(
    inserted,
    scenesWithInsertedDraft,
    {
      sceneId: "draft-scene-custom",
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      sceneTitle: "Green Room",
      initialText: "",
    },
    "draft-scene-new",
  );
  assert.equal(
    customInserted.scenes.find((scene) => scene.sceneId === "draft-scene-custom")?.sceneTitle,
    "Green Room",
  );

  const newChapterScenes = buildSceneRecords(
    { project: { lines: [] } },
    {},
    {
      scenes: [
        {
          sceneId: "draft-scene-100",
          chapterId: "draft-chapter-100",
          chapterTitle: "",
          sceneTitle: "New Scene",
          initialText: "",
        },
      ],
      sceneOrder: ["draft-scene-100"],
    },
  );
  assert.equal(newChapterScenes[0]?.sceneTitle, "Untitled Scene 1");
  assert.equal(newChapterScenes[0]?.sceneId, "draft-scene-100");
  assert.equal(newChapterScenes[0]?.chapterId, "draft-chapter-100");

  // Placeholder-like authored/imported titles alone must not trigger first-scene normalization.
  const authoredScenes = [
    { sceneId: "imported-scene-1", chapterId: "imported-chapter-1", sceneTitle: "New Scene" },
    { sceneId: "imported-scene-2", chapterId: "imported-chapter-1", sceneTitle: "New Scene 7" },
    { sceneId: "imported-scene-3", chapterId: "imported-chapter-1", sceneTitle: "Untitled Scene 12" },
    { sceneId: "draft-scene-authored", chapterId: "chapter-existing", sceneTitle: "New Scene" },
    { sceneId: "imported-scene-4", chapterId: "draft-chapter-100", sceneTitle: "New Scene" },
  ];
  const authoredRecords = buildSceneRecords(
    { project: { lines: [] } }, {}, { scenes: authoredScenes },
  );
  assert.deepEqual(
    authoredRecords.map(({ sceneId, chapterId, sceneTitle }) => ({ sceneId, chapterId, sceneTitle })),
    authoredScenes,
  );

  const renamedNewChapterScene = buildSceneRecords(
    { project: { lines: [] } },
    {
      "draft-scene-100": {
        sceneTitle: "Opening Image",
      },
    },
    {
      scenes: [
        {
          sceneId: "draft-scene-100",
          chapterId: "draft-chapter-100",
          chapterTitle: "",
          sceneTitle: "New Scene",
          initialText: "",
        },
      ],
      sceneOrder: ["draft-scene-100"],
    },
  );
  assert.equal(renamedNewChapterScene[0]?.sceneTitle, "Opening Image");
}
