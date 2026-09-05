// Intent: guard single-scene deletion from dropping sibling draft scenes in the same chapter.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function runSceneSingleDeletePreservesSiblingDraftsTest() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const appSource = readFileSync(path.join(repoRoot, "apps", "editor", "public", "app.js"), "utf8");

  const removalStart = appSource.indexOf("function removeScenesFromProject(removedSceneIds)");
  const removalEnd = appSource.indexOf("function isManuscriptAnchorStillPresent", removalStart);
  assert.notEqual(removalStart, -1);
  assert.notEqual(removalEnd, -1);
  const removalSource = appSource.slice(removalStart, removalEnd);

  assert.match(removalSource, /return !removedSet\.has\(draftSceneId\);/);
  assert.doesNotMatch(removalSource, /!removedChapterIds\.has\(draftChapterId\)/);

  const singleDeleteStart = appSource.indexOf("function deleteSceneFromBinder(sceneId)");
  const singleDeleteEnd = appSource.indexOf("function deleteChapterFromBinder", singleDeleteStart);
  const singleDeleteSource = appSource.slice(singleDeleteStart, singleDeleteEnd);
  assert.match(singleDeleteSource, /return removeScenesFromProject\(\[scene\.sceneId\]\);/);

  const chapterDeleteStart = appSource.indexOf("function deleteChapterFromBinder(chapterId)");
  const chapterDeleteEnd = appSource.indexOf("function removeScenesFromProject", chapterDeleteStart);
  const chapterDeleteSource = appSource.slice(chapterDeleteStart, chapterDeleteEnd);
  assert.match(chapterDeleteSource, /const removedSceneIds = chapterScenes\.map\(\(scene\) => scene\.sceneId\);/);
  assert.match(chapterDeleteSource, /return removeScenesFromProject\(removedSceneIds\);/);

  const siblingDrafts = [
    { sceneId: "draft-scene-1", chapterId: "chapter-a" },
    { sceneId: "draft-scene-2", chapterId: "chapter-a" },
    { sceneId: "draft-scene-3", chapterId: "chapter-a" },
  ];
  const removedSet = new Set(["draft-scene-2"]);
  const survivors = siblingDrafts.filter((draftScene) => !removedSet.has(String(draftScene?.sceneId ?? "")));
  assert.deepEqual(survivors.map((scene) => scene.sceneId), ["draft-scene-1", "draft-scene-3"]);
}
