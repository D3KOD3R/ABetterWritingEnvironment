// Intent: verify shared editor UI-state transitions stay pure and shell-independent.
import assert from "node:assert/strict";

import {
  createCollapsedConsoleChapterState,
  createSidePanelVisibilityState,
  createTopPanelVisibilityState,
  getTopPanelVisibilityForPane,
  getVisibleSidePanelIds,
  isTopPanelCardVisible,
  normalizeTopPanelVisibilityPageId,
  normalizeWorkspacePaneId,
  normalizeSidePanelsHiddenState,
  normalizeCollapsedChapterIds,
  pruneCollapsedChapterIds,
  resolveVisibleSidePanelMode,
  setSidePanelFeatureVisible,
  setTopPanelCardVisible,
  toggleSidePanelsHiddenState,
  toggleCollapsedChapterId,
  toggleCollapsedConsoleChapter,
} from "../apps/editor/public/state/editor-ui-state.js";

export function runEditorUiStateTest() {
  assert.deepEqual(normalizeCollapsedChapterIds([" a ", "", "a", "b"]), ["a", "b"]);
  assert.deepEqual(createCollapsedConsoleChapterState({
    issueTasks: ["chapter-1"],
    inspiration: ["chapter-2", "chapter-2"],
    "metadata-lore": ["chapter-3"],
  }), {
    issueTasks: ["chapter-1"],
    issues: [],
    inspiration: ["chapter-2"],
    research: [],
    "metadata-lore": ["chapter-3"],
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
  assert.deepEqual(toggleCollapsedConsoleChapter({}, "metadata-lore", "chapter-3"), {
    issueTasks: [],
    issues: [],
    inspiration: [],
    research: [],
    "metadata-lore": ["chapter-3"],
  });
  const unchanged = { issueTasks: ["chapter-1"] };
  assert.equal(toggleCollapsedConsoleChapter(unchanged, "unknown", "chapter-2"), unchanged);

  assert.deepEqual(
    pruneCollapsedChapterIds(["chapter-1", "chapter-2"], new Set(["chapter-2"])),
    ["chapter-2"],
  );

  assert.deepEqual(createSidePanelVisibilityState({ issues: false, unknown: false }), {
    issues: false,
    inspiration: true,
    research: true,
  });
  assert.deepEqual(createSidePanelVisibilityState({ "metadata-lore": false }), {
    issues: true,
    inspiration: true,
    research: true,
    "metadata-lore": false,
  });
  assert.deepEqual(setSidePanelFeatureVisible({ issues: false }, "issues", true), {
    issues: true,
    inspiration: true,
    research: true,
  });
  assert.deepEqual(setSidePanelFeatureVisible({}, "metadata-lore", false), {
    issues: true,
    inspiration: true,
    research: true,
    "metadata-lore": false,
  });
  assert.deepEqual(setSidePanelFeatureVisible({ issues: false }, "unknown", false), {
    issues: false,
    inspiration: true,
    research: true,
  });
  assert.deepEqual(getVisibleSidePanelIds({
    issues: false,
    inspiration: true,
    research: false,
  }), ["inspiration"]);
  assert.equal(resolveVisibleSidePanelMode("issues", { issues: false, research: true }), "inspiration");
  assert.equal(resolveVisibleSidePanelMode("research", { issues: false, research: true }), "research");
  assert.equal(resolveVisibleSidePanelMode("research", {
    issues: false,
    inspiration: false,
    research: false,
  }), "");
  assert.equal(resolveVisibleSidePanelMode("metadata-lore", {
    issues: false,
    inspiration: false,
    research: false,
    "metadata-lore": true,
  }), "metadata-lore");
  assert.equal(normalizeSidePanelsHiddenState(true), true);
  assert.equal(normalizeSidePanelsHiddenState("true"), false);
  assert.equal(toggleSidePanelsHiddenState(false), true);
  assert.equal(toggleSidePanelsHiddenState(true), false);
  assert.equal(normalizeWorkspacePaneId("world"), "world");
  assert.equal(normalizeWorkspacePaneId("voice"), "narration");
  assert.equal(normalizeWorkspacePaneId("unknown"), "manuscript");

  const legacyTopPanelVisibility = createTopPanelVisibilityState({ wordTarget: false, unknown: false });
  assert.equal(legacyTopPanelVisibility.manuscript.wordTarget, false);
  assert.equal(legacyTopPanelVisibility.world.wordTarget, false);
  assert.equal(legacyTopPanelVisibility.narration.wordTarget, false);
  assert.equal(legacyTopPanelVisibility.manuscript.developerLogs, true);

  const scopedTopPanelVisibility = createTopPanelVisibilityState({
    manuscript: { wordTarget: true, developerLogs: false },
    world: { wordTarget: false },
  });
  assert.equal(scopedTopPanelVisibility.manuscript.wordTarget, true);
  assert.equal(scopedTopPanelVisibility.manuscript.developerLogs, false);
  assert.equal(scopedTopPanelVisibility.world.wordTarget, false);
  assert.equal(scopedTopPanelVisibility.narration.wordTarget, true);
  assert.equal(getTopPanelVisibilityForPane(scopedTopPanelVisibility, "world").wordTarget, false);
  assert.equal(getTopPanelVisibilityForPane(scopedTopPanelVisibility, "manuscript").wordTarget, true);
  assert.equal(normalizeTopPanelVisibilityPageId("voice"), "narration");

  const worldHiddenOnly = setTopPanelCardVisible(scopedTopPanelVisibility, "wordTarget", false, "world");
  assert.equal(worldHiddenOnly.world.wordTarget, false);
  assert.equal(worldHiddenOnly.manuscript.wordTarget, true);
  assert.equal(setTopPanelCardVisible({ manuscript: { wordTarget: true } }, "unknown", false, "world").manuscript.wordTarget, true);
  assert.equal(isTopPanelCardVisible({ manuscript: { developerLogs: false } }, "developerLogs", "manuscript"), false);
  assert.equal(isTopPanelCardVisible({}, "autosave", "world"), true);
}
