// Intent: keep binder drop-target resolution compatible with draft and portable scenes that do not carry legacy line numbers.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readFileSync(path.join(repoRoot, "apps/editor/public/app.js"), "utf8");

export function runBinderSceneDragDropTargetTest() {
  const start = appSource.indexOf("function resolveBinderSceneDropTarget(event)");
  const end = appSource.indexOf("\nfunction handleBinderSceneDragStart(event)", start);

  assert.notEqual(start, -1, "Expected binder drop-target resolver to exist.");
  assert.notEqual(end, -1, "Expected binder drag-start handler after drop-target resolver.");

  const resolverSource = appSource.slice(start, end);
  assert.equal(
    (resolverSource.match(/getMovableSceneById\(sceneId\)/g) ?? []).length,
    2,
    "Scene rows and explicit drop slots should resolve any movable scene target.",
  );
  assert.match(
    resolverSource,
    /getScenesForChapter\(chapterId\)\.filter\(\(candidate\) => isMovableScene\(candidate\)\)/,
    "Chapter-body drops should consider all movable scenes.",
  );
  assert.equal(
    /getPersistentSceneById|isPersistentScene/.test(resolverSource),
    false,
    "Drop-target resolution must not require legacy persisted line numbers.",
  );
}
