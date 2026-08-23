// Intent: render dictionary lookup state as a transient author utility window without owning lookup effects.
import { escapeHtml } from "../../shared/ui-utils.js";

export function buildDictionaryWindowModel(lookup, viewport = {}) {
  if (!lookup) {
    return null;
  }

  const windowWidth = 420;
  const windowHeight = 360;
  const viewportWidth = Number(viewport.width ?? 0) || windowWidth;
  const viewportHeight = Number(viewport.height ?? 0) || windowHeight;
  const requestedLeft = Number.isFinite(Number(lookup.x)) && Number(lookup.x) > 0
    ? Number(lookup.x)
    : Math.round((viewportWidth - windowWidth) / 2);
  const requestedTop = Number.isFinite(Number(lookup.y)) && Number(lookup.y) > 0
    ? Number(lookup.y)
    : 96;

  const entry = lookup.entry && typeof lookup.entry === "object" ? lookup.entry : null;
  return {
    status: normalizeDictionaryStatus(lookup.status),
    word: String(lookup.word ?? "").trim(),
    normalizedWord: String(lookup.normalizedWord ?? "").trim(),
    matchedWord: String(lookup.matchedWord ?? "").trim(),
    errorMessage: String(lookup.errorMessage ?? "").trim(),
    left: clampWindowPosition(requestedLeft, viewportWidth, windowWidth),
    top: clampWindowPosition(requestedTop, viewportHeight, windowHeight),
    entry: entry ? {
      word: String(entry.word ?? "").trim(),
      pronunciation: String(entry.pronunciation ?? "").trim(),
      sourceLabel: String(entry.sourceLabel ?? "").trim() || "Open English WordNet 2025 (CC BY 4.0)",
      definitions: normalizeDefinitionRows(entry.definitions),
    } : null,
  };
}

export function renderDictionaryWindowHTML(lookup, viewport = {}) {
  const model = buildDictionaryWindowModel(lookup, viewport);
  if (!model) {
    return "";
  }

  return `
    <section
      class="dictionary-lookup-window"
      style="left:${model.left}px; top:${model.top}px;"
      role="dialog"
      aria-label="Dictionary lookup"
      data-dictionary-window
    >
      <header class="dictionary-lookup-window__header">
        <div>
          <p class="dictionary-lookup-window__kicker">Dictionary</p>
          <h2>${escapeHtml(model.entry?.word || model.word || "No word")}</h2>
          ${model.entry?.pronunciation ? `<small>${escapeHtml(model.entry.pronunciation)}</small>` : ""}
        </div>
        <button
          class="dictionary-lookup-window__close"
          type="button"
          data-action="close-dictionary-window"
          aria-label="Close dictionary"
          title="Close"
        >&times;</button>
      </header>
      <div class="dictionary-lookup-window__body">
        ${renderDictionaryWindowBody(model)}
      </div>
    </section>
  `;
}

function renderDictionaryWindowBody(model) {
  if (model.status === "loading") {
    return `<p class="dictionary-lookup-window__status">Looking up ${escapeHtml(model.word)}...</p>`;
  }

  if (model.status === "error") {
    return `
      <p class="dictionary-lookup-window__status dictionary-lookup-window__status--error">
        ${escapeHtml(model.errorMessage || "Dictionary definitions could not be loaded.")}
      </p>
    `;
  }

  if (model.status === "not-found" || !model.entry) {
    return `
      <p class="dictionary-lookup-window__status">No definition found for ${escapeHtml(model.word || "that word")}.</p>
      <p class="dictionary-lookup-window__note">The local English definition data can be expanded without changing manuscript content or project settings.</p>
    `;
  }

  return `
    <ol class="dictionary-lookup-window__definitions">
      ${model.entry.definitions.map((definition) => `
        <li>
          ${definition.partOfSpeech ? `<small>${escapeHtml(definition.partOfSpeech)}</small>` : ""}
          <p>${escapeHtml(definition.definition)}</p>
          ${definition.example ? `<blockquote>${escapeHtml(definition.example)}</blockquote>` : ""}
          ${definition.synonyms.length ? `<span>Synonyms: ${escapeHtml(definition.synonyms.join(", "))}</span>` : ""}
        </li>
      `).join("")}
    </ol>
    <footer class="dictionary-lookup-window__source">${escapeHtml(model.entry.sourceLabel)}</footer>
  `;
}

function normalizeDefinitionRows(definitions) {
  return (Array.isArray(definitions) ? definitions : [])
    .map((definition) => {
      const definitionText = String(definition?.definition ?? "").trim();
      if (!definitionText) {
        return null;
      }

      return {
        partOfSpeech: String(definition?.partOfSpeech ?? "").trim(),
        definition: definitionText,
        example: String(definition?.example ?? "").trim(),
        synonyms: Array.isArray(definition?.synonyms)
          ? definition.synonyms.map((synonym) => String(synonym ?? "").trim()).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean);
}

function normalizeDictionaryStatus(status) {
  const normalizedStatus = String(status ?? "").trim();
  return ["loading", "found", "not-found", "error"].includes(normalizedStatus)
    ? normalizedStatus
    : "loading";
}

function clampWindowPosition(value, viewportSize, windowSize) {
  return Math.min(
    Math.max(8, Number(value) || 0),
    Math.max(8, (Number(viewportSize) || windowSize) - windowSize - 8),
  );
}
