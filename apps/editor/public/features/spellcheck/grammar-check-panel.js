// Intent: own grammar-check panel view modeling and markup without taking persistence or editor-host ownership.
import {
  countSpellcheckMisspellings,
  groupSpellcheckMisspellings,
  normalizeSpellcheckWord,
} from "../../spellcheck.js";
import { escapeHtml } from "../../shared/ui-utils.js";

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

export function setGrammarCheckPanelPositionState(panelState = {}, left, top) {
  return {
    ...panelState,
    position: {
      left: Math.round(Number(left) || 0),
      top: Math.round(Number(top) || 0),
    },
  };
}

export function clampGrammarCheckPanelPosition(left, top, width, height, viewport = {}) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const viewportWidth = Math.max(0, Number(viewport.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport.height) || 0);
  const minLeft = 12;
  const minTop = 12;
  const maxLeft = Math.max(minLeft, viewportWidth - safeWidth - 12);
  const maxTop = Math.max(minTop, viewportHeight - safeHeight - 12);

  return {
    left: Math.min(Math.max(minLeft, Number(left) || 0), maxLeft),
    top: Math.min(Math.max(minTop, Number(top) || 0), maxTop),
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

  return groupSpellcheckMisspellings(scene.editorText ?? "", lexicons, options)
    .map((entry) => ({
      ...entry,
      word: String(entry.word ?? "").trim() || String(entry.normalizedWord ?? ""),
      normalizedWord: normalizeSpellcheckWord(entry.normalizedWord ?? entry.word),
      count: Number(entry.count ?? 0),
      firstIndex: Number(entry.firstIndex ?? 0),
      lastIndex: Number(entry.lastIndex ?? 0),
    }))
    .filter((entry) => entry.normalizedWord)
    .sort((left, right) => left.firstIndex - right.firstIndex || left.word.localeCompare(right.word));
}

export function renderGrammarCheckPanelHTML({
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
                <div class="grammar-check-item ${isSelected ? "is-selected" : ""} ${isAnchor ? "is-anchor" : ""}" data-grammar-check-word="${escapeHtml(entry.normalizedWord)}" data-grammar-check-index="${index}" data-grammar-check-first-index="${escapeHtml(String(entry.firstIndex ?? 0))}">
                  <label class="grammar-check-item__toggle" data-action="toggle-grammar-check-word">
                    <input type="checkbox" ${isSelected ? "checked" : ""} aria-label="Select ${escapeHtml(entry.word)} for project dictionary" />
                  </label>
                  <button class="grammar-check-item__body" type="button" data-action="focus-grammar-check-word" title="Go to this word in the manuscript">
                    <strong class="grammar-check-item__word">${escapeHtml(entry.word)}</strong>
                    <span class="grammar-check-item__meta">${escapeHtml(`${entry.count} occurrence${entry.count === 1 ? "" : "s"}`)}</span>
                  </button>
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
    </section>
  `;
}

function isElement(value) {
  return typeof Element !== "undefined" && value instanceof Element;
}

function isHtmlElement(value) {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}
