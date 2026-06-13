// Intent: verify toolbar-triggered user highlights can recover the active manuscript selection.
import assert from "node:assert/strict";

import {
  USER_HIGHLIGHT_COMMAND_MODE,
  resolveUserHighlightCommandIntent,
  resolveUserHighlightCommandSelection,
} from "../apps/editor/public/features/manuscript-decorations/user-highlight-command-service.js";

export function runUserHighlightCommandServiceTest() {
  const text = "The amber signal crossed the hangar floor.";
  const liveSelection = resolveUserHighlightCommandSelection({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 4,
      endOffset: 10,
      collapsed: false,
    },
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 11,
      endOffset: 17,
    },
    formatRanges: [{
      id: "inline-bold-4-10",
      formatId: "bold",
      startOffset: 4,
      endOffset: 10,
    }],
  });
  assert.equal(liveSelection.selectionSource, "live");
  assert.equal(liveSelection.startOffset, 4);
  assert.equal(liveSelection.endOffset, 10);
  assert.equal(liveSelection.formatRanges.length, 1);

  const cachedSelection = resolveUserHighlightCommandSelection({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 10,
      endOffset: 10,
      collapsed: true,
    },
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 11,
      endOffset: 17,
    },
  });
  assert.equal(cachedSelection.selectionSource, "cached");
  assert.equal(cachedSelection.startOffset, 11);
  assert.equal(cachedSelection.endOffset, 17);
  assert.equal(cachedSelection.text, text);
  assert.equal(cachedSelection.collapsed, false);

  const clampedCachedSelection = resolveUserHighlightCommandSelection({
    sceneId: "scene-1",
    text,
    liveSelection: null,
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 34,
      endOffset: 200,
    },
  });
  assert.equal(clampedCachedSelection.selectionSource, "cached");
  assert.equal(clampedCachedSelection.startOffset, 34);
  assert.equal(clampedCachedSelection.endOffset, text.length);

  const staleCachedSelection = resolveUserHighlightCommandSelection({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 5,
      endOffset: 5,
      collapsed: true,
    },
    cachedSelection: {
      sceneId: "scene-2",
      startOffset: 0,
      endOffset: 9,
    },
  });
  assert.equal(staleCachedSelection, null);

  const selectedIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 4,
      endOffset: 10,
      collapsed: false,
    },
    cachedSelection: null,
  });
  assert.equal(selectedIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.SELECTION);
  assert.equal(selectedIntent.selection.startOffset, 4);
  assert.equal(selectedIntent.selection.endOffset, 10);
  assert.equal(selectedIntent.selection.collapsed, false);

  const pendingLiveIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 18,
      endOffset: 18,
      collapsed: true,
    },
    cachedSelection: null,
  });
  assert.equal(pendingLiveIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.PENDING);
  assert.equal(pendingLiveIntent.selection.startOffset, 18);
  assert.equal(pendingLiveIntent.selection.endOffset, 18);
  assert.equal(pendingLiveIntent.selection.collapsed, true);
  assert.equal(pendingLiveIntent.selection.selectionSource, "live");

  const pendingCachedIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: null,
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 7,
      endOffset: 7,
      collapsed: true,
    },
  });
  assert.equal(pendingCachedIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.PENDING);
  assert.equal(pendingCachedIntent.selection.startOffset, 7);
  assert.equal(pendingCachedIntent.selection.selectionSource, "cached");

  const cachedSelectionIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 18,
      endOffset: 18,
      collapsed: true,
    },
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 4,
      endOffset: 10,
      collapsed: false,
    },
  });
  assert.equal(cachedSelectionIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.SELECTION);
  assert.equal(cachedSelectionIntent.selection.selectionSource, "cached");

  const pendingToggleIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 18,
      endOffset: 18,
      collapsed: true,
    },
    cachedSelection: {
      sceneId: "scene-1",
      startOffset: 4,
      endOffset: 10,
      collapsed: false,
    },
    preferPendingToggle: true,
  });
  assert.equal(pendingToggleIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.PENDING);
  assert.equal(pendingToggleIntent.selection.startOffset, 18);
  assert.equal(pendingToggleIntent.selection.selectionSource, "live");

  const selectedPendingToggleIntent = resolveUserHighlightCommandIntent({
    sceneId: "scene-1",
    text,
    liveSelection: {
      sceneId: "scene-1",
      text,
      startOffset: 4,
      endOffset: 10,
      collapsed: false,
    },
    cachedSelection: null,
    preferPendingToggle: true,
  });
  assert.equal(selectedPendingToggleIntent.mode, USER_HIGHLIGHT_COMMAND_MODE.PENDING);
  assert.equal(selectedPendingToggleIntent.selection.startOffset, 4);
  assert.equal(selectedPendingToggleIntent.selection.endOffset, 4);
  assert.equal(selectedPendingToggleIntent.selection.selectionSource, "live");
}
