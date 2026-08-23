// Intent: verify grammar-check panel modeling and markup stay outside the app shell.
import assert from "node:assert/strict";

import {
  buildGrammarCheckEntries,
  buildGrammarCheckSummary,
  clampGrammarCheckPanelPosition,
  createGrammarCheckPanelDragController,
  createGrammarCheckPanelResizeController,
  normalizeGrammarCheckPanelBounds,
  renderGrammarCheckPanelHTML,
  setGrammarCheckPanelBoundsState,
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
  assert.equal(entries[0].firstEndIndex, 4);
  assert.equal(entries[0].sceneId, "scene-1");
  assert.ok(entries[0].suggestions.includes("When"));

  const markup = renderGrammarCheckPanelHTML({
    selectedSceneId: scene.sceneId,
    selectedSceneTitle: scene.sceneTitle,
    selectedSceneChapter: scene.chapterTitle,
    entries: [{
      ...entries[0],
      suggestions: ["When", "Wean"],
      firstSuggestion: "When",
    }],
    selectedCount: 1,
    selectionSet: new Set(["wehn"]),
    selectionAnchorIndex: 0,
  });
  assert.match(markup, /data-grammar-check-panel/);
  assert.match(markup, /2 flagged words · 1 unique/);
  assert.match(markup, /grammar-check-item is-selected is-anchor/);
  assert.match(markup, /grammar-check-item__dictionary-button/);
  assert.match(markup, /data-action="grammar-check-add-word"/);
  assert.match(markup, /data-grammar-check-dictionary-word="Wehn"/);
  assert.match(markup, /grammar-check-item__apply-button/);
  assert.ok(markup.indexOf("grammar-check-item__dictionary-button") < markup.indexOf("grammar-check-item__apply-button"));
  assert.match(markup, /data-action="apply-spellcheck-suggestion"/);
  assert.match(markup, /data-spellcheck-replacement="When"/);
  assert.match(markup, /grammar-check-item__suggestion-menu/);
  assert.match(markup, /grammar-check-item__suggestion-option-icon/);
  assert.match(markup, /data-spellcheck-replacement="Wean"/);
  const suggestionMenuMarkup = markup.slice(markup.indexOf("grammar-check-item__suggestion-menu"));
  assert.doesNotMatch(suggestionMenuMarkup, /data-action="grammar-check-add-word"/);
  assert.doesNotMatch(suggestionMenuMarkup, /data-grammar-check-dictionary-word/);
  assert.doesNotMatch(suggestionMenuMarkup, /spellcheck-context-menu__chip/);
  assert.match(markup, /data-action="grammar-check-add-selected"/);
  assert.match(markup, /data-grammar-check-resize-handle/);

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
  assert.deepEqual(
    normalizeGrammarCheckPanelBounds(
      { left: -30, top: 999, width: 120, height: 90 },
      { viewport: { width: 700, height: 500 } },
    ),
    { left: 12, top: 228, width: 320, height: 260 },
  );
  assert.deepEqual(
    setGrammarCheckPanelBoundsState({}, { left: 17.2, top: 24.8, width: 388.6, height: 277.2 }).bounds,
    { left: 17, top: 25, width: 389, height: 277 },
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

    const resizedBounds = [];
    let resizeCapturedPointerId = null;
    let resizeReleasedPointerId = null;
    const resizeClassList = new Set();
    const resizeSlot = new FakeElement();
    resizeSlot.getBoundingClientRect = () => ({ left: 20, top: 30, width: 340, height: 280 });
    resizeSlot.classList = {
      add: (className) => resizeClassList.add(className),
      remove: (className) => resizeClassList.delete(className),
    };
    const resizeHandle = new FakeElement();
    resizeHandle.closest = (selector) => selector === "#grammar-check-slot" ? resizeSlot : null;
    resizeHandle.setPointerCapture = (pointerId) => {
      resizeCapturedPointerId = pointerId;
    };
    resizeHandle.releasePointerCapture = (pointerId) => {
      resizeReleasedPointerId = pointerId;
    };
    const resizeTarget = new FakeElement();
    resizeTarget.closest = (selector) => selector === "[data-grammar-check-resize-handle]" ? resizeHandle : null;
    const resizeController = createGrammarCheckPanelResizeController({
      isPanelOpen: () => true,
      getViewport: () => ({ width: 500, height: 400 }),
      setBounds: (bounds) => resizedBounds.push(bounds),
    });

    assert.equal(resizeController.begin({
      button: 0,
      target: resizeTarget,
      pointerId: 8,
      clientX: 360,
      clientY: 310,
      preventDefault: () => {},
    }), true);
    assert.equal(resizeCapturedPointerId, 8);
    assert.equal(resizeClassList.has("is-resizing"), true);

    assert.equal(resizeController.move({
      pointerId: 8,
      clientX: 440,
      clientY: 380,
      preventDefault: () => {},
    }), true);
    assert.deepEqual(resizedBounds[0], { left: 20, top: 30, width: 420, height: 350 });

    assert.equal(resizeController.end({ pointerId: 8 }), true);
    assert.equal(resizeReleasedPointerId, 8);
    assert.equal(resizeClassList.has("is-resizing"), false);
  } finally {
    globalThis.Element = previousElement;
    globalThis.HTMLElement = previousHTMLElement;
  }
}
