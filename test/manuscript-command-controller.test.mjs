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

  const selectedHighlightClearsPending = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "highlight",
    state: {
      pendingFormats: {
        highlight: true,
      },
    },
  });
  assert.equal(selectedHighlightClearsPending.state.pendingFormats.highlight, false);

  const collapsedHighlight = runInlineFormatCommand({
    text: "The door opened.",
    startOffset: 4,
    endOffset: 4,
    format: "highlight",
  });
  assert.equal(collapsedHighlight.mutation.kind, "start-pending-format");
  assert.equal(collapsedHighlight.state.pendingFormats.highlight, true);

  const selectedBold = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "bold",
  });
  assert.deepEqual(selectedBold.ranges, [
    {
      id: "inline-bold-4-14",
      formatId: "bold",
      startOffset: 4,
      endOffset: 14,
    },
  ]);

  const collapsedBold = runInlineFormatCommand({
    text: "The door opened.",
    startOffset: 4,
    endOffset: 4,
    format: "bold",
  });
  assert.equal(collapsedBold.mutation.kind, "start-pending-format");
  assert.equal(collapsedBold.state.pendingFormats.bold, true);

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

  const typedWithRepeatedPrefixHighlight = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "abcabc",
    nextText: "abcaabc",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      highlight: true,
    },
  });
  assert.deepEqual(typedWithRepeatedPrefixHighlight, [
    {
      id: "inline-highlight-3-4",
      formatId: "highlight",
      startOffset: 3,
      endOffset: 4,
    },
  ]);

  const typedWithPendingBold = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "The door opened.",
    nextText: "The gold door opened.",
    pendingFormats: {
      bold: true,
    },
  });
  assert.deepEqual(typedWithPendingBold, [
    {
      id: "inline-bold-4-9",
      formatId: "bold",
      startOffset: 4,
      endOffset: 9,
    },
  ]);

  const typedInsideHighlightWithSwitchOff = updateInlineFormatRangesForTextEdit({
    ranges: [{
      id: "inline-highlight-0-6",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 6,
    }],
    previousText: "abcdef",
    nextText: "abcXdef",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      highlight: false,
    },
  });
  assert.deepEqual(typedInsideHighlightWithSwitchOff, [
    {
      id: "inline-highlight-0-3",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 3,
    },
    {
      id: "inline-highlight-4-7",
      formatId: "highlight",
      startOffset: 4,
      endOffset: 7,
    },
  ]);

  const typedInsideHighlightWithSwitchOn = updateInlineFormatRangesForTextEdit({
    ranges: [{
      id: "inline-highlight-0-6",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 6,
    }],
    previousText: "abcdef",
    nextText: "abcXdef",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      highlight: true,
    },
  });
  assert.deepEqual(typedInsideHighlightWithSwitchOn, [
    {
      id: "inline-highlight-0-7",
      formatId: "highlight",
      startOffset: 0,
      endOffset: 7,
    },
  ]);

  const typedInsideBoldWithSwitchOff = updateInlineFormatRangesForTextEdit({
    ranges: [{
      id: "inline-bold-0-6",
      formatId: "bold",
      startOffset: 0,
      endOffset: 6,
    }],
    previousText: "abcdef",
    nextText: "abcXdef",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      bold: false,
    },
  });
  assert.deepEqual(typedInsideBoldWithSwitchOff, [
    {
      id: "inline-bold-0-3",
      formatId: "bold",
      startOffset: 0,
      endOffset: 3,
    },
    {
      id: "inline-bold-4-7",
      formatId: "bold",
      startOffset: 4,
      endOffset: 7,
    },
  ]);

  const typedInsideBoldWithSwitchOn = updateInlineFormatRangesForTextEdit({
    ranges: [{
      id: "inline-bold-0-6",
      formatId: "bold",
      startOffset: 0,
      endOffset: 6,
    }],
    previousText: "abcdef",
    nextText: "abcXdef",
    selectionStart: 4,
    selectionEnd: 4,
    pendingFormats: {
      bold: true,
    },
  });
  assert.deepEqual(typedInsideBoldWithSwitchOn, [
    {
      id: "inline-bold-0-7",
      formatId: "bold",
      startOffset: 0,
      endOffset: 7,
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
