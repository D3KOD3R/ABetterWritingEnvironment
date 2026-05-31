// Intent: verify grammar-check panel modeling and markup stay outside the app shell.
import assert from "node:assert/strict";

import {
  buildGrammarCheckEntries,
  buildGrammarCheckSummary,
  clampGrammarCheckPanelPosition,
  createGrammarCheckPanelDragController,
  renderGrammarCheckPanelHTML,
  setGrammarCheckPanelPositionState,
  toggleGrammarCheckPanelState,
  toggleGrammarCheckPanelWordSelectionState,
  updateGrammarCheckPanelSelectionState,
} from "../apps/editor/public/features/spellcheck/grammar-check-panel.js";
import {
  createSpellcheckLexiconFromWords,
  buildSpellcheckProjectLexicon,
} from "../apps/editor/public/spellcheck.js";

export function runGrammarCheckPanelTest() {
  const scene = {
    sceneId: "scene-1",
    sceneTitle: "Customs Hall",
    chapterTitle: "Chapter One",
    editorText: "Wehn wehn customs arrive.",
  };
  const lexicons = {
    baseLexicon: createSpellcheckLexiconFromWords(["when", "customs", "arrive"]),
    projectLexicon: buildSpellcheckProjectLexicon([]),
    referenceLexicon: createSpellcheckLexiconFromWords([]),
  };

  const summary = buildGrammarCheckSummary(scene, lexicons);
  assert.deepEqual(summary, {
    count: 2,
    label: "2 flagged words",
  });

  const entries = buildGrammarCheckEntries(scene, lexicons);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].word, "Wehn");
  assert.equal(entries[0].normalizedWord, "wehn");
  assert.equal(entries[0].count, 2);
  assert.equal(entries[0].firstIndex, 0);

  const markup = renderGrammarCheckPanelHTML({
    selectedSceneTitle: scene.sceneTitle,
    selectedSceneChapter: scene.chapterTitle,
    entries,
    selectedCount: 1,
    selectionSet: new Set(["wehn"]),
    selectionAnchorIndex: 0,
  });
  assert.match(markup, /data-grammar-check-panel/);
  assert.match(markup, /2 flagged words · 1 unique/);
  assert.match(markup, /grammar-check-item is-selected is-anchor/);
  assert.match(markup, /data-action="grammar-check-add-selected"/);

  assert.deepEqual(toggleGrammarCheckPanelState({ open: false, selectedWords: ["wehn"] }), {
    open: true,
    selectedWords: ["wehn"],
  });
  assert.deepEqual(setGrammarCheckPanelPositionState({}, 17.6, 24.2).position, {
    left: 18,
    top: 24,
  });
  assert.deepEqual(
    clampGrammarCheckPanelPosition(-100, 999, 200, 160, { width: 500, height: 400 }),
    { left: 12, top: 228 },
  );

  const selectedState = updateGrammarCheckPanelSelectionState(
    {},
    entries,
    ["wehn", "unknown", "WEHN"],
    0,
  );
  assert.deepEqual(selectedState.selectedWords, ["wehn"]);
  assert.equal(selectedState.selectionAnchorIndex, 0);

  const toggled = toggleGrammarCheckPanelWordSelectionState(
    selectedState,
    entries,
    "wehn",
    0,
    false,
  );
  assert.equal(toggled.changed, true);
  assert.deepEqual(toggled.state.selectedWords, []);

  const previousElement = globalThis.Element;
  const previousHTMLElement = globalThis.HTMLElement;
  class FakeElement {}
  globalThis.Element = FakeElement;
  globalThis.HTMLElement = FakeElement;
  try {
    const positions = [];
    let capturedPointerId = null;
    let releasedPointerId = null;
    const classList = new Set();
    const slot = new FakeElement();
    slot.getBoundingClientRect = () => ({ left: 20, top: 30, width: 240, height: 180 });
    slot.classList = {
      add: (className) => classList.add(className),
      remove: (className) => classList.delete(className),
    };
    const handle = new FakeElement();
    handle.closest = (selector) => selector === "#grammar-check-slot" ? slot : null;
    handle.setPointerCapture = (pointerId) => {
      capturedPointerId = pointerId;
    };
    handle.releasePointerCapture = (pointerId) => {
      releasedPointerId = pointerId;
    };
    const target = new FakeElement();
    target.closest = (selector) => selector === "[data-grammar-check-drag-handle]" ? handle : null;
    const dragController = createGrammarCheckPanelDragController({
      isPanelOpen: () => true,
      getViewport: () => ({ width: 500, height: 400 }),
      setPosition: (left, top) => positions.push({ left, top }),
    });

    assert.equal(dragController.begin({
      button: 0,
      target,
      pointerId: 7,
      clientX: 50,
      clientY: 70,
      preventDefault: () => {},
    }), true);
    assert.equal(capturedPointerId, 7);
    assert.equal(classList.has("is-dragging"), true);

    assert.equal(dragController.move({
      pointerId: 7,
      clientX: 220,
      clientY: 240,
      preventDefault: () => {},
    }), true);
    assert.deepEqual(positions[0], { left: 190, top: 200 });

    assert.equal(dragController.end({ pointerId: 7 }), true);
    assert.equal(releasedPointerId, 7);
    assert.equal(classList.has("is-dragging"), false);
  } finally {
    globalThis.Element = previousElement;
    globalThis.HTMLElement = previousHTMLElement;
  }
}
