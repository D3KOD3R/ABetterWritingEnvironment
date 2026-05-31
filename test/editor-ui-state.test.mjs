// Intent: verify shared editor UI-state transitions stay pure and shell-independent.
import assert from "node:assert/strict";

import {
  createCollapsedConsoleChapterState,
  normalizeCollapsedChapterIds,
  pruneCollapsedChapterIds,
  toggleCollapsedChapterId,
  toggleCollapsedConsoleChapter,
} from "../apps/editor/public/state/editor-ui-state.js";

export function runEditorUiStateTest() {
  assert.deepEqual(normalizeCollapsedChapterIds([" a ", "", "a", "b"]), ["a", "b"]);
  assert.deepEqual(createCollapsedConsoleChapterState({
    issueTasks: ["chapter-1"],
    inspiration: ["chapter-2", "chapter-2"],
  }), {
    issueTasks: ["chapter-1"],
    issues: [],
    inspiration: ["chapter-2"],
    research: [],
  });

  assert.deepEqual(toggleCollapsedChapterId(["chapter-1"], "chapter-1"), []);
  assert.deepEqual(toggleCollapsedChapterId(["chapter-1"], "chapter-2"), ["chapter-1", "chapter-2"]);

  assert.deepEqual(toggleCollapsedConsoleChapter({
    issueTasks: ["chapter-1"],
  }, "issueTasks", "chapter-2"), {
    issueTasks: ["chapter-1", "chapter-2"],
    issues: [],
    inspiration: [],
    research: [],
  });
  const unchanged = { issueTasks: ["chapter-1"] };
  assert.equal(toggleCollapsedConsoleChapter(unchanged, "unknown", "chapter-2"), unchanged);

  assert.deepEqual(
    pruneCollapsedChapterIds(["chapter-1", "chapter-2"], new Set(["chapter-2"])),
    ["chapter-2"],
  );
}
