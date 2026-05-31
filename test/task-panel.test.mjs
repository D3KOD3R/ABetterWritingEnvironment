// Intent: verify anchored task console item rendering stays outside the app shell.
import assert from "node:assert/strict";

import {
  renderTaskItemHTML,
  renderTaskPanelHTML,
} from "../apps/editor/public/features/anchored-records/task-panel.js";

export function runTaskPanelTest() {
  const markup = renderTaskItemHTML({
    id: "task-1",
    source: "source-comment",
    title: "Fix pacing",
    sceneTitle: "Arrival",
    taskNumber: 4,
    body: "Tighten the paragraph",
    selectedText: "A long passage",
  }, {
    selectedTaskId: "task-1",
    previewTaskId: "task-1",
  });

  assert.match(markup, /task-item is-selected is-previewing/);
  assert.match(markup, /data-action="toggle-task-preview"/);
  assert.match(markup, /Imported task/);
  assert.match(markup, /data-edit-field="task-title"/);
  assert.match(markup, /Reference: A long passage/);
  assert.match(markup, /data-action="complete-task"/);

  const panelMarkup = renderTaskPanelHTML({
    taskCount: 1,
    groups: [{
      chapterId: "chapter-1",
      chapterTitle: "Chapter One",
      tasks: [{
        id: "task-1",
        title: "Fix pacing",
        sceneTitle: "Arrival",
        taskNumber: 4,
        body: "Tighten the paragraph",
      }],
    }],
  }, {
    previewTaskId: "task-1",
    collapsedChapterIds: ["chapter-1"],
  });

  assert.match(panelMarkup, /task-panel-heading/);
  assert.match(panelMarkup, /data-console-panel="issueTasks"/);
  assert.match(panelMarkup, /class="task-chapter-group is-collapsed"/);
  assert.match(panelMarkup, /aria-expanded="false"/);
}
