// Intent: own grammar-check panel view modeling and markup without taking persistence or editor-host ownership.
import {
  countSpellcheckMisspellings,
  groupSpellcheckMisspellings,
  normalizeSpellcheckWord,
  suggestSpellcheckAlternatives,
} from "../../spellcheck.js";
import {
  clampGrammarCheckPanelBounds,
  clampGrammarCheckPanelPosition,
  normalizeGrammarCheckPanelBounds,
  setGrammarCheckPanelBoundsState,
  setGrammarCheckPanelPositionState,
} from "../../state/grammar-check-panel-state.js";
import { escapeHtml } from "../../shared/ui-utils.js";

export {
  clampGrammarCheckPanelBounds,
  clampGrammarCheckPanelPosition,
  normalizeGrammarCheckPanelBounds,
  setGrammarCheckPanelBoundsState,
  setGrammarCheckPanelPositionState,
};

export function toggleGrammarCheckPanelState(panelState = {}) {
  const isOpen = panelState?.open === true;
  return {
    ...panelState,
    open: !isOpen,
    selectedWords: Array.isArray(panelState?.selectedWords) ? panelState.selectedWords : [],
  };
}

export function closeGrammarCheckPanelState(panelState = {}) {
  if (panelState?.open !== true) {
    return panelState;
  }

  return {
    ...panelState,
    open: false,
  };
}

export function updateGrammarCheckPanelSelectionState(panelState = {}, entries = [], nextSelectedWords = [], selectionAnchorIndex = null) {
  const validWords = new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizeSpellcheckWord(entry?.normalizedWord ?? entry?.word))
      .filter(Boolean),
  );
  const nextSelection = [];
  const seen = new Set();

  for (const word of Array.isArray(nextSelectedWords) ? nextSelectedWords : []) {
    const normalized = normalizeSpellcheckWord(word);
    if (!normalized || !validWords.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    nextSelection.push(normalized);
  }

  return {
    ...panelState,
    selectedWords: nextSelection,
    selectionAnchorIndex: Number.isInteger(selectionAnchorIndex) ? selectionAnchorIndex : null,
  };
}

export function toggleGrammarCheckPanelWordSelectionState(panelState = {}, entries = [], word, entryIndex = -1, isShiftKey = false) {
  const normalizedWord = normalizeSpellcheckWord(word);
  const safeEntries = Array.isArray(entries) ? entries : [];
  if (!normalizedWord) {
    return {
      state: panelState,
      selectedEntry: null,
      changed: false,
    };
  }

  const selectedIndex = Number.isInteger(entryIndex)
    ? entryIndex
    : safeEntries.findIndex((entry) => entry?.normalizedWord === normalizedWord);
  const selectedEntry = selectedIndex >= 0 ? safeEntries[selectedIndex] : null;
  if (!selectedEntry || !safeEntries.some((entry) => entry?.normalizedWord === normalizedWord)) {
    return {
      state: panelState,
      selectedEntry: null,
      changed: false,
    };
  }

  const currentSelection = new Set(
    Array.isArray(panelState?.selectedWords)
      ? panelState.selectedWords.map((entry) => normalizeSpellcheckWord(entry)).filter(Boolean)
      : [],
  );
  const anchorIndex = Number.isInteger(panelState?.selectionAnchorIndex)
    ? panelState.selectionAnchorIndex
    : null;

  if (isShiftKey && anchorIndex !== null) {
    const startIndex = Math.min(anchorIndex, selectedIndex);
    const endIndex = Math.max(anchorIndex, selectedIndex);
    for (let index = startIndex; index <= endIndex; index += 1) {
      const entry = safeEntries[index];
      if (entry?.normalizedWord) {
        currentSelection.add(entry.normalizedWord);
      }
    }

    return {
      state: updateGrammarCheckPanelSelectionState(panelState, safeEntries, [...currentSelection], anchorIndex),
      selectedEntry,
      changed: true,
    };
  }

  if (currentSelection.has(normalizedWord)) {
    currentSelection.delete(normalizedWord);
  } else {
    currentSelection.add(normalizedWord);
  }

  return {
    state: updateGrammarCheckPanelSelectionState(panelState, safeEntries, [...currentSelection], selectedIndex),
    selectedEntry,
    changed: true,
  };
}

export function createGrammarCheckPanelDragController({
  isPanelOpen = () => false,
  getViewport = () => ({ width: 0, height: 0 }),
  setPosition = () => {},
} = {}) {
  let dragState = null;

  function begin(event) {
    if (isPanelOpen() !== true || event?.button !== 0) {
      return false;
    }

    const target = isElement(event.target) ? event.target : null;
    const dragHandle = target?.closest("[data-grammar-check-drag-handle]");
    if (!isHtmlElement(dragHandle)) {
      return false;
    }

    const slot = dragHandle.closest("#grammar-check-slot");
    if (!isHtmlElement(slot)) {
      return false;
    }

    const rect = slot.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      slot,
      dragHandle,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };

    slot.classList.add("is-dragging");
    event.preventDefault();
    if (typeof dragHandle.setPointerCapture === "function") {
      try {
        dragHandle.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures; document-level handlers can still receive move/end events.
      }
    }
    return true;
  }

  function move(event) {
    if (!dragState || event?.pointerId !== dragState.pointerId) {
      return false;
    }

    const nextLeft = event.clientX - dragState.offsetX;
    const nextTop = event.clientY - dragState.offsetY;
    const clamped = clampGrammarCheckPanelPosition(
      nextLeft,
      nextTop,
      dragState.width,
      dragState.height,
      getViewport(),
    );

    setPosition(clamped.left, clamped.top);
    event.preventDefault();
    return true;
  }

  function end(event) {
    if (!dragState || event?.pointerId !== dragState.pointerId) {
      return false;
    }

    const { slot, dragHandle, pointerId } = dragState;
    slot.classList.remove("is-dragging");
    if (typeof dragHandle.releasePointerCapture === "function") {
      try {
        dragHandle.releasePointerCapture(pointerId);
      } catch {
        // Ignore release failures.
      }
    }

    dragState = null;
    return true;
  }

  function getSnapshot() {
    return {
      isDragging: dragState !== null,
      pointerId: dragState?.pointerId ?? null,
    };
  }

  return {
    begin,
    move,
    end,
    getSnapshot,
  };
}

// Intent: resize the floating grammar-check review window while keeping persistence in the shell.
export function createGrammarCheckPanelResizeController({
  isPanelOpen = () => false,
  getViewport = () => ({ width: 0, height: 0 }),
  setBounds = () => {},
} = {}) {
  let resizeState = null;

  function begin(event) {
    if (isPanelOpen() !== true || event?.button !== 0) {
      return false;
    }

    const target = isElement(event.target) ? event.target : null;
    const resizeHandle = target?.closest("[data-grammar-check-resize-handle]");
    if (!isHtmlElement(resizeHandle)) {
      return false;
    }

    const slot = resizeHandle.closest("#grammar-check-slot");
    if (!isHtmlElement(slot)) {
      return false;
    }

    const rect = slot.getBoundingClientRect();
    resizeState = {
      pointerId: event.pointerId,
      slot,
      resizeHandle,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      startX: event.clientX,
      startY: event.clientY,
    };

    slot.classList.add("is-resizing");
    event.preventDefault();
    if (typeof resizeHandle.setPointerCapture === "function") {
      try {
        resizeHandle.setPointerCapture(event.pointerId);
      } catch {
        // Ignore capture failures; document-level handlers can still receive move/end events.
      }
    }
    return true;
  }

  function move(event) {
    if (!resizeState || event?.pointerId !== resizeState.pointerId) {
      return false;
    }

    const bounds = clampGrammarCheckPanelBounds({
      left: resizeState.left,
      top: resizeState.top,
      width: resizeState.width + (event.clientX - resizeState.startX),
      height: resizeState.height + (event.clientY - resizeState.startY),
    }, getViewport());

    setBounds(bounds);
    event.preventDefault();
    return true;
  }

  function end(event) {
    if (!resizeState || event?.pointerId !== resizeState.pointerId) {
      return false;
    }

    const { slot, resizeHandle, pointerId } = resizeState;
    slot.classList.remove("is-resizing");
    if (typeof resizeHandle.releasePointerCapture === "function") {
      try {
        resizeHandle.releasePointerCapture(pointerId);
      } catch {
        // Ignore release failures.
      }
    }

    resizeState = null;
    return true;
  }

  function getSnapshot() {
    return {
      isResizing: resizeState !== null,
      pointerId: resizeState?.pointerId ?? null,
    };
  }

  return {
    begin,
    move,
    end,
    getSnapshot,
  };
}

export function buildGrammarCheckSummary(scene, lexicons = {}) {
  if (!scene || !lexicons?.baseLexicon?.wordList?.length) {
    return {
      count: 0,
      label: "Grammar check",
    };
  }

  const count = countSpellcheckMisspellings(scene.editorText ?? "", lexicons);
  return {
    count,
    label: count === 1 ? "1 flagged word" : `${count} flagged words`,
  };
}

export function buildGrammarCheckEntries(scene, lexicons = {}, options = {}) {
  if (!scene || !lexicons?.baseLexicon?.wordList?.length) {
    return [];
  }

  const sceneId = String(scene?.sceneId ?? "");
  return groupSpellcheckMisspellings(scene.editorText ?? "", lexicons, options)
    .map((entry) => {
      const word = String(entry.word ?? "").trim() || String(entry.normalizedWord ?? "");
      const firstIndex = Number(entry.firstIndex);
      const safeFirstIndex = Number.isInteger(firstIndex) ? firstIndex : 0;
      const firstEndIndex = safeFirstIndex + word.length;
      const suggestions = suggestSpellcheckAlternatives(word, lexicons);
      return {
        ...entry,
        sceneId,
        word,
        normalizedWord: normalizeSpellcheckWord(entry.normalizedWord ?? entry.word),
        count: Number(entry.count ?? 0),
        firstIndex: safeFirstIndex,
        firstEndIndex,
        lastIndex: Number(entry.lastIndex ?? 0),
        suggestions,
        firstSuggestion: suggestions[0] ?? "",
      };
    })
    .filter((entry) => entry.normalizedWord)
    .sort((left, right) => left.firstIndex - right.firstIndex || left.word.localeCompare(right.word));
}

export function renderGrammarCheckPanelHTML({
  selectedSceneId = "",
  selectedSceneTitle,
  selectedSceneChapter,
  entries = [],
  selectedCount = 0,
  selectionSet = new Set(),
  selectionAnchorIndex = null,
} = {}) {
  const totalCount = entries.reduce((total, entry) => total + Number(entry.count ?? 0), 0);
  const uniqueCount = entries.length;
  const addDisabled = selectedCount <= 0;
  const summaryLabel = totalCount
    ? `${totalCount} flagged word${totalCount === 1 ? "" : "s"} · ${uniqueCount} unique`
    : "No flagged words";

  return `
    <section class="manuscript-grammar-panel ${totalCount ? "has-entries" : ""}" data-grammar-check-panel>
      <button
        class="manuscript-grammar-panel__close"
        type="button"
        data-action="close-grammar-check-panel"
        aria-label="Close grammar check window"
        title="Close grammar check window"
      >×</button>
      <div class="manuscript-grammar-panel__dragbar">
        <div class="manuscript-grammar-panel__drag-handle" data-grammar-check-drag-handle aria-label="Drag grammar check window">
          <span>Grammar check</span>
          <strong>Drag to move</strong>
        </div>
      </div>
      <div class="manuscript-grammar-panel__header">
        <div class="manuscript-grammar-panel__titles">
          <p class="manuscript-grammar-panel__kicker">${escapeHtml(selectedSceneChapter)}</p>
          <h2>${escapeHtml(selectedSceneTitle)}</h2>
          <p class="manuscript-grammar-panel__summary">${escapeHtml(summaryLabel)}</p>
        </div>
        <div class="manuscript-grammar-panel__actions">
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-select-all" ${totalCount ? "" : "disabled"}>Select all</button>
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-clear-selection" ${selectedCount ? "" : "disabled"}>Clear</button>
        </div>
      </div>
      <div class="manuscript-grammar-panel__list" data-grammar-check-list>
        ${entries.length
          ? entries.map((entry, index) => {
              const isSelected = selectionSet.has(entry.normalizedWord);
              const isAnchor = selectionAnchorIndex === index;
              return `
                <div class="grammar-check-item ${isSelected ? "is-selected" : ""} ${isAnchor ? "is-anchor" : ""}" data-grammar-check-word="${escapeHtml(entry.normalizedWord)}" data-grammar-check-index="${index}" data-grammar-check-first-index="${escapeHtml(String(entry.firstIndex ?? 0))}" data-grammar-check-first-end-index="${escapeHtml(String(entry.firstEndIndex ?? 0))}">
                  <label class="grammar-check-item__toggle" data-action="toggle-grammar-check-word">
                    <input type="checkbox" ${isSelected ? "checked" : ""} aria-label="Select ${escapeHtml(entry.word)} for project dictionary" />
                  </label>
                  <button class="grammar-check-item__body" type="button" data-action="focus-grammar-check-word" title="Go to this word in the manuscript">
                    <strong class="grammar-check-item__word">${escapeHtml(entry.word)}</strong>
                    <span class="grammar-check-item__meta">${escapeHtml(`${entry.count} occurrence${entry.count === 1 ? "" : "s"}`)}</span>
                  </button>
                  ${renderGrammarCheckSuggestionControls(entry, selectedSceneId)}
                </div>
              `;
            }).join("")
          : `<p class="grammar-check-empty">No flagged words in this scene.</p>`}
      </div>
      <div class="manuscript-grammar-panel__footer">
        <span>${escapeHtml(selectedCount ? `${selectedCount} selected` : "Select words to add them to the project dictionary.")}</span>
        <div class="manuscript-grammar-panel__footer-actions">
          <button class="tag-button editor-action-button" type="button" data-action="grammar-check-add-selected" ${addDisabled ? "disabled" : ""}>Add selected to project dictionary</button>
        </div>
      </div>
      <div class="manuscript-grammar-panel__resize-handle" data-grammar-check-resize-handle role="separator" tabindex="0" aria-label="Resize grammar check window" title="Resize grammar check window"></div>
    </section>
  `;
}

// Intent: expose guarded correction choices while leaving the shell to perform text mutation.
function renderGrammarCheckSuggestionControls(entry, selectedSceneId = "") {
  const sceneId = String(entry?.sceneId || selectedSceneId || "");
  const word = String(entry?.word ?? "");
  const normalizedWord = normalizeSpellcheckWord(entry?.normalizedWord ?? word);
  const firstIndex = Number(entry?.firstIndex);
  const firstEndIndex = Number(entry?.firstEndIndex);
  const suggestions = normalizeSuggestionList(entry?.suggestions);
  const firstSuggestion = String(entry?.firstSuggestion || suggestions[0] || "").trim();
  const dropdownSuggestions = suggestions.length ? suggestions : [firstSuggestion].filter(Boolean);
  const canApply = Boolean(
    sceneId &&
    normalizedWord &&
    firstSuggestion &&
    Number.isInteger(firstIndex) &&
    Number.isInteger(firstEndIndex) &&
    firstEndIndex > firstIndex,
  );

  if (!canApply) {
    return `
      <div class="grammar-check-item__quick-actions">
        ${renderGrammarCheckDictionaryButton({ word, normalizedWord })}
        <button class="grammar-check-item__apply-button" type="button" disabled aria-label="No spelling suggestion available">
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
      <span class="grammar-check-item__no-suggestion">No suggestion</span>
    `;
  }

  const firstSuggestionData = renderSpellcheckSuggestionDataAttributes({
    sceneId,
    replacement: firstSuggestion,
    word: normalizedWord,
    startOffset: firstIndex,
    endOffset: firstEndIndex,
  });
  return `
    <div class="grammar-check-item__quick-actions">
      ${renderGrammarCheckDictionaryButton({ word, normalizedWord })}
      <button
        class="grammar-check-item__apply-button"
        type="button"
        data-action="apply-spellcheck-suggestion"
        ${firstSuggestionData}
        aria-label="Replace ${escapeHtml(word)} with ${escapeHtml(firstSuggestion)}"
        title="Replace first occurrence with ${escapeHtml(firstSuggestion)}"
      >
        <span aria-hidden="true">&rarr;</span>
      </button>
    </div>
    <div class="grammar-check-item__suggestion" data-grammar-check-suggestion>
      <button
        class="grammar-check-item__suggestion-primary"
        type="button"
        data-action="apply-spellcheck-suggestion"
        ${firstSuggestionData}
        title="Replace first occurrence with ${escapeHtml(firstSuggestion)}"
      >${escapeHtml(firstSuggestion)}</button>
      ${dropdownSuggestions.length
        ? `
          <div class="grammar-check-item__suggestion-menu" role="menu" aria-label="Spelling suggestions for ${escapeHtml(word)}">
            ${dropdownSuggestions.map((suggestion) => `
              <button
                class="grammar-check-item__suggestion-option"
                type="button"
                role="menuitem"
                data-action="apply-spellcheck-suggestion"
                ${renderSpellcheckSuggestionDataAttributes({
                  sceneId,
                  replacement: suggestion,
                  word: normalizedWord,
                  startOffset: firstIndex,
                  endOffset: firstEndIndex,
                })}
              >
                <span class="grammar-check-item__suggestion-option-icon" aria-hidden="true">✓</span>
                <span>${escapeHtml(suggestion)}</span>
              </button>
            `).join("")}
          </div>
        `
        : ""}
    </div>
  `;
}

function renderGrammarCheckDictionaryButton({ word, normalizedWord } = {}) {
  const displayWord = String(word || normalizedWord || "").trim();
  const targetWord = displayWord || normalizeSpellcheckWord(normalizedWord);
  if (!targetWord) {
    return `
      <button class="grammar-check-item__dictionary-button" type="button" disabled aria-label="No dictionary word available">
        <span aria-hidden="true">+</span>
      </button>
    `;
  }

  return `
    <button
      class="grammar-check-item__dictionary-button"
      type="button"
      data-action="grammar-check-add-word"
      data-grammar-check-dictionary-word="${escapeHtml(targetWord)}"
      aria-label="Add ${escapeHtml(displayWord || targetWord)} to project dictionary"
      title="Add ${escapeHtml(displayWord || targetWord)} to project dictionary"
    >
      <span aria-hidden="true">+</span>
    </button>
  `;
}

function normalizeSuggestionList(suggestions) {
  const normalizedSuggestions = [];
  const seen = new Set();
  for (const suggestion of Array.isArray(suggestions) ? suggestions : []) {
    const normalizedSuggestion = String(suggestion ?? "").trim();
    if (!normalizedSuggestion || seen.has(normalizedSuggestion)) {
      continue;
    }

    seen.add(normalizedSuggestion);
    normalizedSuggestions.push(normalizedSuggestion);
  }

  return normalizedSuggestions;
}

function renderSpellcheckSuggestionDataAttributes({
  sceneId,
  replacement,
  word,
  startOffset,
  endOffset,
} = {}) {
  return [
    `data-spellcheck-replacement="${escapeHtml(replacement)}"`,
    `data-spellcheck-start-offset="${escapeHtml(String(startOffset))}"`,
    `data-spellcheck-end-offset="${escapeHtml(String(endOffset))}"`,
    `data-spellcheck-scene-id="${escapeHtml(sceneId)}"`,
    `data-spellcheck-word="${escapeHtml(word)}"`,
  ].join(" ");
}

function isElement(value) {
  return typeof Element !== "undefined" && value instanceof Element;
}

function isHtmlElement(value) {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}
