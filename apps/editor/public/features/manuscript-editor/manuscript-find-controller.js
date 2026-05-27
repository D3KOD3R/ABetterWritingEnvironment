// Intent: own manuscript find/replace derivation and commands without owning DOM focus or project persistence effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function createManuscriptFindController({
  getScenes = () => [],
} = {}) {
  function getMatches(query) {
    const needle = String(query ?? "").trim().toLocaleLowerCase();
    if (!needle) {
      return [];
    }

    const matches = [];
    for (const scene of Array.isArray(getScenes()) ? getScenes() : []) {
      const sceneText = String(scene?.editorText ?? "");
      const haystack = sceneText.toLocaleLowerCase();
      let searchFrom = 0;
      while (searchFrom <= haystack.length) {
        const startOffset = haystack.indexOf(needle, searchFrom);
        if (startOffset === -1) {
          break;
        }

        const endOffset = startOffset + needle.length;
        matches.push({
          sceneId: String(scene?.sceneId ?? ""),
          chapterTitle: String(scene?.chapterTitle ?? ""),
          sceneTitle: String(scene?.sceneTitle ?? ""),
          startOffset,
          endOffset,
          matchText: sceneText.slice(startOffset, endOffset),
          snippetHtml: buildSnippetHtml(sceneText, startOffset, endOffset),
        });
        searchFrom = startOffset + Math.max(1, needle.length);
      }
    }

    return matches;
  }

  function buildPanelModel(findStateCandidate = {}) {
    const state = normalizeFindState(findStateCandidate);
    const matches = state.query.trim() ? getMatches(state.query) : [];
    const activeIndex = matches.length
      ? clampIndex(state.activeIndex, matches.length)
      : 0;
    return {
      ...state,
      matches,
      activeIndex,
      activeMatch: matches[activeIndex] ?? null,
    };
  }

  function open(findState, selectionText = "") {
    const state = normalizeFindState(findState);
    const selected = String(selectionText ?? "").trim();
    return {
      ...state,
      open: true,
      query: selected || state.query,
      activeIndex: 0,
    };
  }

  function close(findState) {
    return {
      ...normalizeFindState(findState),
      open: false,
    };
  }

  function updateField(findState, field, value) {
    const state = normalizeFindState(findState);
    if (field === "manuscript-find-query") {
      return {
        ...state,
        query: String(value ?? ""),
        activeIndex: 0,
      };
    }
    if (field === "manuscript-find-replace") {
      return {
        ...state,
        replaceText: String(value ?? ""),
      };
    }
    return state;
  }

  function selectMatch(findState, index) {
    const model = buildPanelModel(findState);
    if (!model.matches.length) {
      return {
        state: model,
        match: null,
      };
    }

    const activeIndex = clampIndex(index, model.matches.length);
    return {
      state: {
        ...normalizeFindState(findState),
        open: true,
        activeIndex,
      },
      match: model.matches[activeIndex] ?? null,
    };
  }

  function moveMatch(findState, delta) {
    const model = buildPanelModel(findState);
    if (!model.matches.length) {
      return {
        state: model,
        match: null,
      };
    }

    const nextIndex = (model.activeIndex + Number(delta ?? 0) + model.matches.length) % model.matches.length;
    return selectMatch(findState, nextIndex);
  }

  function buildCurrentReplacement(findState) {
    const model = buildPanelModel(findState);
    const match = model.activeMatch;
    if (!match) {
      return null;
    }

    const scene = findScene(match.sceneId);
    if (!scene) {
      return null;
    }

    const previousText = String(scene.editorText ?? "");
    const nextText = replaceRange(previousText, match, model.replaceText);
    return {
      sceneId: match.sceneId,
      match,
      previousText,
      nextText,
      changed: previousText !== nextText,
    };
  }

  function buildAllReplacements(findState) {
    const model = buildPanelModel(findState);
    if (!model.matches.length) {
      return [];
    }

    const matchesByScene = new Map();
    for (const match of model.matches) {
      const matches = matchesByScene.get(match.sceneId) ?? [];
      matches.push(match);
      matchesByScene.set(match.sceneId, matches);
    }

    const replacements = [];
    for (const scene of Array.isArray(getScenes()) ? getScenes() : []) {
      const sceneMatches = matchesByScene.get(scene?.sceneId);
      if (!sceneMatches?.length) {
        continue;
      }

      const previousText = String(scene.editorText ?? "");
      let nextText = previousText;
      for (const match of [...sceneMatches].sort((left, right) => right.startOffset - left.startOffset)) {
        nextText = replaceRange(nextText, match, model.replaceText);
      }
      if (previousText !== nextText) {
        replacements.push({
          sceneId: String(scene.sceneId ?? ""),
          previousText,
          nextText,
          matches: sceneMatches,
        });
      }
    }

    return replacements;
  }

  return {
    buildAllReplacements,
    buildCurrentReplacement,
    buildPanelModel,
    close,
    getMatches,
    moveMatch,
    open,
    renderPanelHTML,
    selectMatch,
    updateField,
  };

  function findScene(sceneId) {
    return (Array.isArray(getScenes()) ? getScenes() : [])
      .find((scene) => scene?.sceneId === sceneId) ?? null;
  }
}

export function renderPanelHTML({
  query = "",
  replaceText = "",
  matches = [],
  activeIndex = 0,
  activeMatch = null,
} = {}) {
  const hasQuery = Boolean(String(query ?? "").trim());
  const matchCount = matches.length;
  const canNavigate = hasQuery && matchCount > 0;
  const activeLabel = activeMatch
    ? `${activeMatch.chapterTitle || "Chapter"} \u00b7 ${activeMatch.sceneTitle || "Scene"}`
    : "Search the manuscript";

  return `
    <section class="manuscript-find-panel ${hasQuery ? "has-query" : ""}" data-manuscript-find-panel>
      <button class="manuscript-find-panel__close" type="button" data-action="close-manuscript-find" aria-label="Close find window" title="Close find window">&times;</button>
      <div class="manuscript-find-panel__dragbar">
        <div class="manuscript-find-panel__drag-handle" data-manuscript-find-drag-handle aria-label="Drag find window">
          <span>Find in manuscript</span>
          <strong>Drag to move</strong>
        </div>
      </div>
      <div class="manuscript-find-panel__header">
        <div class="manuscript-find-panel__fields">
          <label class="manuscript-find-field"><span>Find</span><input type="search" value="${escapeHtml(query)}" data-find-field="manuscript-find-query" placeholder="Search the manuscript" aria-label="Find in manuscript" /></label>
          <label class="manuscript-find-field"><span>Replace</span><input type="text" value="${escapeHtml(replaceText)}" data-find-field="manuscript-find-replace" placeholder="Replace with" aria-label="Replace in manuscript" /></label>
        </div>
        <div class="manuscript-find-panel__actions">
          <button class="tag-button editor-action-button" type="button" data-action="find-prev" ${canNavigate ? "" : "disabled"}>Prev</button>
          <button class="tag-button editor-action-button" type="button" data-action="find-next" ${canNavigate ? "" : "disabled"}>Next</button>
          <button class="tag-button editor-action-button" type="button" data-action="replace-find-current" ${canNavigate ? "" : "disabled"}>Replace</button>
          <button class="tag-button editor-action-button" type="button" data-action="replace-find-all" ${canNavigate ? "" : "disabled"}>Replace all</button>
        </div>
      </div>
      <div class="manuscript-find-panel__status">
        <strong>${escapeHtml(hasQuery ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "Find in manuscript")}</strong>
        <span>${escapeHtml(activeLabel)}</span>
      </div>
      <div class="manuscript-find-results" data-manuscript-find-results>
        ${hasQuery
          ? (matchCount
            ? matches.map((match, index) => renderResultHTML(match, index, index === activeIndex)).join("")
            : `<p class="manuscript-find-empty">No matches found.</p>`)
          : `<p class="manuscript-find-empty">Search the manuscript to jump between matches and replace them in place.</p>`}
      </div>
    </section>
  `;
}

function renderResultHTML(match, index, isActive) {
  return `
    <button class="manuscript-find-result ${isActive ? "is-active" : ""}" type="button" data-action="find-match" data-find-match-index="${index}" aria-current="${isActive ? "true" : "false"}">
      <span class="manuscript-find-result__meta">${escapeHtml(match.chapterTitle || "Chapter")} &middot; ${escapeHtml(match.sceneTitle || "Scene")}</span>
      <strong>${escapeHtml(match.matchText || "Match")}</strong>
      <p>${match.snippetHtml}</p>
    </button>
  `;
}

function buildSnippetHtml(text, startOffset, endOffset) {
  const source = String(text ?? "");
  const snippetStart = Math.max(0, startOffset - 40);
  const snippetEnd = Math.min(source.length, endOffset + 40);
  const normalizeSnippet = (value) => escapeHtml(String(value ?? "")).replace(/\s+/g, " ");
  return `${normalizeSnippet(source.slice(snippetStart, startOffset))}<mark>${normalizeSnippet(source.slice(startOffset, endOffset))}</mark>${normalizeSnippet(source.slice(endOffset, snippetEnd))}`;
}

function normalizeFindState(candidate = {}) {
  return {
    open: candidate?.open === true,
    query: String(candidate?.query ?? ""),
    replaceText: String(candidate?.replaceText ?? ""),
    activeIndex: Number.isInteger(candidate?.activeIndex) ? candidate.activeIndex : 0,
    position: candidate?.position ?? null,
  };
}

function clampIndex(value, length) {
  const number = Number(value);
  const index = Number.isFinite(number) ? Math.floor(number) : 0;
  return Math.min(Math.max(index, 0), Math.max(0, length - 1));
}

function replaceRange(text, match, replacement) {
  return `${text.slice(0, match.startOffset)}${replacement}${text.slice(match.endOffset)}`;
}
