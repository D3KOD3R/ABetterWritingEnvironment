// Intent: verify manuscript inline commands mutate style metadata without inserting markup into scene text.
import assert from "node:assert/strict";
import {
  createDefaultManuscriptInlineFormattingState,
  executeToggleInlineFormat,
  isInlineFormatActiveAtOffset,
  updateInlineFormatRangesForTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-command-controller.js";

export async function runManuscriptCommandControllerTest() {
  const selectedItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
  });
  assert.equal(selectedItalic.mutation.kind, "toggle-format-range");
  assert.deepEqual(selectedItalic.ranges, [
    {
      id: "inline-italic-4-14",
      formatId: "italic",
      startOffset: 4,
      endOffset: 14,
    },
  ]);
  assert.equal(selectedItalic.mutation.selectionStart, 4);
  assert.equal(selectedItalic.mutation.selectionEnd, 14);

  const unwrappedItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
    ranges: selectedItalic.ranges,
  });
  assert.deepEqual(unwrappedItalic.ranges, []);

  const collapsedItalic = runInlineFormatCommand({
    text: "The door opened.",
    startOffset: 4,
    endOffset: 4,
    format: "italic",
  });
  assert.equal(collapsedItalic.mutation.kind, "start-pending-format");
  assert.equal(collapsedItalic.mutation.selectionStart, 4);
  assert.equal(collapsedItalic.state.pendingFormats.italic, true);

  const finishedItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 9,
    endOffset: 9,
    format: "italic",
    state: {
      pendingFormats: {
        italic: true,
      },
    },
  });
  assert.equal(finishedItalic.mutation.kind, "stop-pending-format");
  assert.equal(finishedItalic.mutation.selectionStart, 9);
  assert.equal(finishedItalic.state.pendingFormats.italic, false);

  const selectedHighlight = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "highlight",
  });
  assert.deepEqual(selectedHighlight.ranges, [
    {
      id: "inline-highlight-4-14",
      formatId: "highlight",
      startOffset: 4,
      endOffset: 14,
    },
  ]);

  const selectedStrikethrough = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "strikethrough",
  });
  assert.deepEqual(selectedStrikethrough.ranges, [
    {
      id: "inline-strikethrough-4-14",
      formatId: "strikethrough",
      startOffset: 4,
      endOffset: 14,
    },
  ]);

  const typedWithPendingHighlight = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "The door opened.",
    nextText: "The gold door opened.",
    pendingFormats: {
      highlight: true,
    },
  });
  assert.deepEqual(typedWithPendingHighlight, [
    {
      id: "inline-highlight-4-9",
      formatId: "highlight",
      startOffset: 4,
      endOffset: 9,
    },
  ]);

  assert.equal(isInlineFormatActiveAtOffset(selectedItalic.ranges, 8, "italic"), true);
  assert.equal(isInlineFormatActiveAtOffset(selectedItalic.ranges, 18, "italic"), false);
}

function runInlineFormatCommand({
  text,
  startOffset,
  endOffset,
  format,
  state = createDefaultManuscriptInlineFormattingState(),
  ranges = [],
}) {
  let nextState = state;
  let nextRanges = null;
  const result = executeToggleInlineFormat({
    formatId: format,
    getInlineFormattingState: () => nextState,
    setInlineFormattingState: (candidate) => {
      nextState = candidate;
    },
    resolveSelection: () => ({
      sceneId: "scene-test",
      text,
      formatRanges: ranges,
      startOffset,
      endOffset,
      collapsed: startOffset === endOffset,
    }),
    applyRangeMutation: (candidate) => {
      nextRanges = candidate;
    },
  });

  return {
    ...result,
    ranges: nextRanges,
    state: nextState,
  };
}
