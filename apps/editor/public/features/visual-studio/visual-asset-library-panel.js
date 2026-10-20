// Intent: render an accessible visual asset browser without owning data, storage or event routing.
// Its host must wire delegated actions; rendering alone never mutates canonical project state.
import {
  safeVisualAssetPreviewUrl,
  VISUAL_ASSET_CATEGORIES,
} from "./visual-asset-library-model.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

const CATEGORY_LABELS = Object.freeze({
  all: "All",
  character: "Characters",
  costume: "Costumes",
  environment: "Environments",
  scene: "Scenes",
  technology: "Technology",
  vehicle: "Vehicles",
  creature: "Creatures",
  other: "Other",
});

function renderAssetCard(asset) {
  const previewUrl = safeVisualAssetPreviewUrl(asset.previewUrl);
  const title = escapeHtml(asset.title);
  const caption = asset.entityNames?.length
    ? asset.entityNames.join(", ")
    : asset.sceneIds?.length
      ? `Scene: ${asset.sceneIds.join(", ")}`
      : CATEGORY_LABELS[asset.category] || "Artwork";
  const media = previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" alt="${title}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<span class="visual-asset-library__placeholder" aria-label="Preview unavailable">No preview</span>`;
  return `
    <article class="visual-asset-library__card" data-visual-asset-id="${escapeHtml(asset.id)}">
      <button class="visual-asset-library__open" type="button"
        data-action="select-visual-asset" data-visual-asset-id="${escapeHtml(asset.id)}"
        aria-label="Inspect ${title}">
        <span class="visual-asset-library__media">${media}</span>
        <span class="visual-asset-library__title">${title}</span>
        <span class="visual-asset-library__caption">${escapeHtml(caption)}</span>
        <span class="visual-asset-library__status">${escapeHtml(asset.status)}</span>
      </button>
    </article>`;
}

// Intent: keep filtering read-only; host actions and CSS are follow-up implementation slices.
export function renderVisualAssetLibraryPanelHTML(model = {}) {
  const category = VISUAL_ASSET_CATEGORIES.includes(model.category)
    ? model.category : "all";
  const counts = model.counts || {};
  const assets = Array.isArray(model.assets) ? model.assets : [];
  const categories = VISUAL_ASSET_CATEGORIES.map((key) => `
    <button type="button" class="visual-asset-library__filter"
      data-action="filter-visual-assets" data-visual-category="${key}"
      aria-pressed="${key === category ? "true" : "false"}">
      ${CATEGORY_LABELS[key]} (${Number(counts[key]) || 0})
    </button>`).join("");
  const emptyMessage = model.total === 0
    ? "No visual assets have been registered for this project."
    : "No artwork matches the current search and filter.";
  return `
    <section class="visual-asset-library" aria-label="Visual Asset Library">
      <header class="visual-asset-library__header">
        <div>
          <h2>Visual Asset Library</h2>
          <p>Artwork linked to existing world entities and manuscript scenes.</p>
        </div>
        <output aria-live="polite">${Number(model.filteredCount) || 0} of ${Number(model.total) || 0} assets</output>
      </header>
      <div class="visual-asset-library__tools">
        <label for="visual-asset-library-search">Search artwork</label>
        <input id="visual-asset-library-search" type="search"
          data-action="search-visual-assets" value="${escapeHtml(model.query)}"
          placeholder="Character, scene, costume or title">
        <div class="visual-asset-library__filters" role="group" aria-label="Asset category">
          ${categories}
        </div>
      </div>
      <div class="visual-asset-library__grid">
        ${assets.length
          ? assets.map(renderAssetCard).join("")
          : `<p class="visual-asset-library__empty">${escapeHtml(emptyMessage)}</p>`}
      </div>
    </section>`;
}
