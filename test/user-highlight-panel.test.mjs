// Intent: verify the user-highlight decorations panel renders canonical manuscript marks.
import assert from "node:assert/strict";

import {
  buildUserHighlightPanelModel,
  renderUserHighlightPanelHTML,
} from "../apps/editor/public/features/manuscript-decorations/user-highlight-panel.js";

export function runUserHighlightPanelTest() {
  const model = buildUserHighlightPanelModel({
    selectedHighlightId: "mark-0002",
    activeSelection: {
      sceneId: "scene-1",
      startOffset: 31,
      endOffset: 48,
      selectedText: "selected passage",
    },
    scenes: [{
      sceneId: "scene-1",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1: Arrival",
      chapterOrder: 1,
      sceneTitle: "Docking",
      sceneOrder: 1,
    }, {
      sceneId: "scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Chapter 1: Arrival",
      chapterOrder: 1,
      sceneTitle: "Signal",
      sceneOrder: 2,
    }],
    marks: [{
      id: "mark-0002",
      kind: "highlight",
      source: "author",
      anchorStatus: "resolved",
      evidenceExcerpt: "amber docking lights",
      anchor: {
        projectId: "project-1",
        chapterId: "chapter-1",
        sceneId: "scene-1",
        blockId: "block-1",
        paragraphId: "paragraph-1",
        startOffset: 7,
        endOffset: 27,
      },
    }, {
      id: "mark-0003",
      kind: "italic",
      source: "author",
      anchorStatus: "resolved",
      evidenceExcerpt: "not a panel highlight",
      anchor: {
        sceneId: "scene-1",
        blockId: "block-1",
        startOffset: 0,
        endOffset: 3,
      },
    }, {
      id: "mark-0004",
      kind: "highlight",
      source: "accepted-suggestion",
      anchorStatus: "resolved",
      evidenceExcerpt: "not user approved",
      anchor: {
        sceneId: "scene-2",
        blockId: "block-2",
        startOffset: 0,
        endOffset: 4,
      },
    }],
  });

  assert.equal(model.highlightCount, 1);
  assert.equal(model.activeSelection.selectedText, "selected passage");
  assert.equal(model.groups.length, 1);
  assert.equal(model.groups[0].highlights[0].id, "mark-0002");
  assert.equal(model.groups[0].highlights[0].isSelected, true);

  const html = renderUserHighlightPanelHTML(model, {
    collapsedChapterIds: [],
    formatChapterTitle: (title) => title.replace(/^Chapter 1:\s*/, ""),
  });
  assert.match(html, /User Highlights/);
  assert.match(html, /selected passage/);
  assert.match(html, /data-action="create-user-highlight-from-selection"/);
  assert.match(html, /Highlight selection/);
  assert.match(html, /amber docking lights/);
  assert.match(html, /data-action="select-user-highlight"/);
  assert.match(html, /data-action="delete-user-highlight"/);
  assert.doesNotMatch(html, /not a panel highlight/);
  assert.doesNotMatch(html, /not user approved/);

  const emptyHtml = renderUserHighlightPanelHTML(buildUserHighlightPanelModel());
  assert.match(emptyHtml, /data-action="create-user-highlight-from-selection"/);
  assert.match(emptyHtml, /No user highlights yet/);
}
