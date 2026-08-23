// Intent: verify manuscript inline commands mutate style metadata without inserting markup into scene text.
import assert from "node:assert/strict";
import {
  clearInlineFormatRangesForSelection,
  createDefaultManuscriptInlineFormattingState,
  createNextDecorationEraserState,
  executeToggleInlineFormat,
  isInlineFormatActiveAtOffset,
  isDecorationEraserPending,
  updateInlineFormatRangesForTextEdit,
} from "../apps/editor/public/features/manuscript-editor/manuscript-command-controller.js";

export async function runManuscriptCommandControllerTest() {
  const selectedItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
  });
  assert.equal(selectedItalic.mutation.kind, "apply-format-range");
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
  assert.equal(selectedItalic.state.pendingFormats.italic, true);

  const reappliedItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
    ranges: selectedItalic.ranges,
  });
  assert.deepEqual(reappliedItalic.ranges, selectedItalic.ranges);
  assert.equal(reappliedItalic.state.pendingFormats.italic, true);

  const selectedItalicKeepsStackedBold = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
    state: {
      pendingFormats: {
        bold: true,
      },
    },
  });
  assert.equal(selectedItalicKeepsStackedBold.state.pendingFormats.italic, true);
  assert.equal(selectedItalicKeepsStackedBold.state.pendingFormats.bold, true);
  assert.equal(selectedItalicKeepsStackedBold.state.pendingClearDecorations, false);

  const eraserState = createNextDecorationEraserState({
    pendingFormats: {
      bold: true,
      highlight: true,
      italic: true,
    },
  }, true);
  assert.equal(eraserState.pendingFormats.bold, false);
  assert.equal(eraserState.pendingFormats.highlight, false);
  assert.equal(eraserState.pendingFormats.italic, false);
  assert.equal(isDecorationEraserPending(eraserState), true);

  const appliedCoveredItalic = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "italic",
    ranges: selectedItalic.ranges,
    state: {
      pendingFormats: {
        italic: true,
      },
    },
    applyOnly: true,
  });
  assert.equal(appliedCoveredItalic.mutation.kind, "apply-format-range");
  assert.deepEqual(appliedCoveredItalic.ranges, selectedItalic.ranges);
  assert.equal(appliedCoveredItalic.state.pendingFormats.italic, true);

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

  const finishedItalicKeepsStackedBold = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 9,
    endOffset: 9,
    format: "italic",
    state: {
      pendingFormats: {
        bold: true,
        italic: true,
      },
    },
  });
  assert.equal(finishedItalicKeepsStackedBold.state.pendingFormats.italic, false);
  assert.equal(finishedItalicKeepsStackedBold.state.pendingFormats.bold, true);

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
  assert.equal(selectedHighlight.state.pendingFormats.highlight, true);

  const selectedHighlightKeepsPending = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "highlight",
    state: {
      pendingFormats: {
        highlight: true,
        italic: true,
      },
    },
  });
  assert.equal(selectedHighlightKeepsPending.state.pendingFormats.highlight, true);
  assert.equal(selectedHighlightKeepsPending.state.pendingFormats.italic, true);

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
  assert.equal(selectedBold.state.pendingFormats.bold, true);

  const collapsedBold = runInlineFormatCommand({
    text: "The door opened.",
    startOffset: 4,
    endOffset: 4,
    format: "bold",
    state: eraserState,
  });
  assert.equal(collapsedBold.mutation.kind, "start-pending-format");
  assert.equal(collapsedBold.state.pendingFormats.bold, true);
  assert.equal(collapsedBold.state.pendingClearDecorations, false);

  const selectedUnderline = runInlineFormatCommand({
    text: "The quiet door opened.",
    startOffset: 4,
    endOffset: 14,
    format: "underline",
  });
  assert.deepEqual(selectedUnderline.ranges, [
    {
      id: "inline-underline-4-14",
      formatId: "underline",
      startOffset: 4,
      endOffset: 14,
    },
  ]);
  assert.equal(selectedUnderline.state.pendingFormats.underline, true);

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
  assert.equal(selectedStrikethrough.state.pendingFormats.strikethrough, true);

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

  const typedWithPendingHighlightColor = updateInlineFormatRangesForTextEdit({
    ranges: [],
    previousText: "The door opened.",
    nextText: "The gold door opened.",
    pendingFormats: {
      highlight: true,
    },
    pendingFormatMetadata: {
      highlight: {
        highlightColor: {
          id: "mint",
          color: "rgba(127, 220, 164, 0.38)",
          outline: "rgba(73, 174, 112, 0.24)",
        },
      },
    },
  });
  assert.deepEqual(typedWithPendingHighlightColor, [
    {
      id: "inline-highlight-4-9",
      formatId: "highlight",
      startOffset: 4,
      endOffset: 9,
      metadata: {
        highlightColor: {
          id: "mint",
          color: "rgba(127, 220, 164, 0.38)",
          outline: "rgba(73, 174, 112, 0.24)",
        },
      },
    },
  ]);

  const differentlyColoredAdjacentHighlights = updateInlineFormatRangesForTextEdit({
    ranges: typedWithPendingHighlightColor,
    previousText: "The gold door opened.",
    nextText: "The gold red door opened.",
    selectionStart: 13,
    selectionEnd: 13,
    pendingFormats: {
      highlight: true,
    },
    pendingFormatMetadata: {
      highlight: {
        highlightColor: {
          id: "rose",
          color: "rgba(255, 148, 164, 0.34)",
          outline: "rgba(216, 86, 112, 0.22)",
        },
      },
    },
  });
  assert.equal(differentlyColoredAdjacentHighlights.length, 2);
  assert.deepEqual(differentlyColoredAdjacentHighlights.map((range) => range.metadata.highlightColor.id), ["mint", "rose"]);

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

  const erasedInlineDecorations = clearInlineFormatRangesForSelection([
    {
      id: "inline-bold-0-20",
      formatId: "bold",
      startOffset: 0,
      endOffset: 20,
    },
    {
      id: "inline-highlight-5-15",
      formatId: "highlight",
      startOffset: 5,
      endOffset: 15,
      metadata: {
        highlightColor: {
          id: "mint",
          color: "rgba(127, 220, 164, 0.38)",
          outline: "rgba(73, 174, 112, 0.24)",
        },
      },
    },
    {
      id: "inline-italic-22-28",
      formatId: "italic",
      startOffset: 22,
      endOffset: 28,
    },
  ], {
    text: "The quiet door opened again.",
    startOffset: 6,
    endOffset: 12,
    collapsed: false,
  });
  assert.deepEqual(erasedInlineDecorations, [
    {
      id: "inline-bold-0-6",
      formatId: "bold",
      startOffset: 0,
      endOffset: 6,
    },
    {
      id: "inline-highlight-5-6",
      formatId: "highlight",
      startOffset: 5,
      endOffset: 6,
      metadata: {
        highlightColor: {
          id: "mint",
          color: "rgba(127, 220, 164, 0.38)",
          outline: "rgba(73, 174, 112, 0.24)",
        },
      },
    },
    {
      id: "inline-highlight-12-15",
      formatId: "highlight",
      startOffset: 12,
      endOffset: 15,
      metadata: {
        highlightColor: {
          id: "mint",
          color: "rgba(127, 220, 164, 0.38)",
          outline: "rgba(73, 174, 112, 0.24)",
        },
      },
    },
    {
      id: "inline-bold-12-20",
      formatId: "bold",
      startOffset: 12,
      endOffset: 20,
    },
    {
      id: "inline-italic-22-28",
      formatId: "italic",
      startOffset: 22,
      endOffset: 28,
    },
  ]);
}

function runInlineFormatCommand({
  text,
  startOffset,
  endOffset,
  format,
  state = createDefaultManuscriptInlineFormattingState(),
  ranges = [],
  applyOnly = false,
}) {
  let nextState = state;
  let nextRanges = null;
  const result = executeToggleInlineFormat({
    formatId: format,
    applyOnly,
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
