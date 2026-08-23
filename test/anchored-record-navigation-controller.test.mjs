// Intent: verify anchored record selection and projection derivation remain independent of browser navigation effects.
import assert from "node:assert/strict";

import { createAnchoredRecordNavigationController } from "../apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js";

export function runAnchoredRecordNavigationControllerTest() {
  const repairs = [];
  const resolveCalls = [];
  const ranges = new Map([
    ["task-wide", { startOffset: 0, endOffset: 12, matched: true }],
    ["task-small", { startOffset: 2, endOffset: 7, matched: true }],
    ["task-stale", { startOffset: 3, endOffset: 6, matched: false }],
    ["note-1", { startOffset: 8, endOffset: 12, matched: true }],
  ]);
  const controller = createAnchoredRecordNavigationController({
    resolveRecordRange: (record, text, { recordType } = {}) => {
      resolveCalls.push({ id: record.id, recordType });
      return ranges.get(record.id);
    },
    repairResolvedRange: (recordType, record, range) => {
      repairs.push({ recordType, id: record.id, startOffset: range.startOffset });
    },
  });
  const tasks = [{
    id: "task-wide",
    sceneId: "scene-1",
  }, {
    id: "task-stale",
    sceneId: "scene-1",
  }, {
    id: "task-small",
    sceneId: "scene-1",
  }];

  const selectedTask = controller.findRecordAtSelection({
    records: tasks,
    recordType: "task",
    sceneId: "scene-1",
    selectionStart: 3,
    selectionEnd: 5,
    text: "Quiet water.",
  });
  assert.equal(selectedTask.id, "task-small");
  assert.ok(resolveCalls.some((call) => call.id === "task-small" && call.recordType === "task"));
  assert.deepEqual(repairs[0], {
    recordType: "task",
    id: "task-small",
    startOffset: 2,
  });

  const note = {
    id: "note-1",
    sceneId: "scene-1",
    noteType: "research",
  };
  const preview = controller.buildPreview({
    record: note,
    recordType: "passageNote",
    text: "Quiet water.",
  });
  assert.equal(preview.projection.channel, "note");
  assert.equal(preview.projection.styleToken, "research");
  assert.equal(preview.projection.persistence, "derived-durable");
  assert.deepEqual(preview.previewSelection, {
    taskId: "note-1",
    sceneId: "scene-1",
    selectionStart: 8,
    selectionEnd: 12,
  });
  const customPreview = controller.buildPreview({
    record: {
      id: "note-1",
      sceneId: "scene-1",
      noteType: "metadata-lore",
      metadataHighlightColor: "#7fcf9f",
    },
    recordType: "passageNote",
    text: "Quiet water.",
  });
  assert.equal(customPreview.projection.styleToken, "metadata");
  assert.equal(customPreview.projection.visualStyle.highlightColor, "rgba(127, 207, 159, 0.56)");
  controller.buildPreview({
    record: tasks[0],
    recordType: "task",
    text: "Quiet water.",
    repair: false,
  });
  assert.equal(repairs.length, 3);
  assert.equal(controller.buildPreview({
    record: tasks[1],
    recordType: "task",
    text: "Quiet water.",
  }), null);
  assert.equal(controller.findRecordAtSelection({
    records: tasks,
    recordType: "task",
    sceneId: "scene-2",
    selectionStart: 3,
    selectionEnd: 5,
    text: "Quiet water.",
  }), null);
}
