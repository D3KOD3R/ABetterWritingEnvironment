// Intent: verify manuscript dictionary lookup requests are derived outside shell event handlers.
import assert from "node:assert/strict";

import {
  buildDictionaryEditorContextMenu,
  buildDictionaryLookupContext,
  buildDictionaryShortcutContext,
} from "../apps/editor/public/features/dictionary/dictionary-context-controller.js";

export function runDictionaryContextControllerTest() {
  const textarea = {
    value: "The manuscript breathes.",
    selectionStart: 14,
    dataset: {
      sceneId: "scene-1",
    },
  };

  const pointerContext = buildDictionaryEditorContextMenu(
    { textarea },
    { clientX: 25, clientY: 30 },
    {
      getTextareaOffsetFromPoint: () => 6,
    },
  );
  assert.equal(pointerContext.word, "manuscript");
  assert.equal(pointerContext.normalizedWord, "manuscript");
  assert.equal(pointerContext.sceneId, "scene-1");
  assert.equal(pointerContext.source, "contextmenu");

  const selectedWordTextarea = {
    value: "The rifle began to glow and hum. Steam billowed from the shroud.",
    dataset: {
      sceneId: "scene-1",
    },
  };
  const selectedStart = selectedWordTextarea.value.indexOf("billowed");
  const selectedEnd = selectedStart + "billowed".length;
  const selectedWordContext = buildDictionaryEditorContextMenu(
    {
      textarea: selectedWordTextarea,
      contextRange: {
        selectedText: "billowed",
        startOffset: selectedStart,
        endOffset: selectedEnd,
        hasExplicitSelection: true,
      },
    },
    { clientX: 25, clientY: 30 },
    {
      getTextareaOffsetFromPoint: () => selectedWordTextarea.value.indexOf("hum"),
    },
  );
  assert.equal(selectedWordContext.word, "billowed");
  assert.equal(selectedWordContext.normalizedWord, "billowed");

  const shortcutContext = buildDictionaryShortcutContext(textarea, {
    x: 100,
    y: 120,
  });
  assert.equal(shortcutContext.word, "manuscript");
  assert.equal(shortcutContext.source, "shortcut");
  assert.equal(shortcutContext.x, 100);

  assert.equal(buildDictionaryLookupContext({ word: "", sceneId: "scene-1" }), null);
}
