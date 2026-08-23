// Intent: own small UI-state transitions before a broader editor store facade exists.

export const SIDE_PANEL_FEATURE_IDS = Object.freeze(["issues", "inspiration", "research"]);
export const WORKSPACE_PANE_IDS = Object.freeze(["manuscript", "world", "narration"]);
export const TOP_PANEL_CARD_IDS = Object.freeze([
  "draftProof",
  "developerLogs",
  "wordTarget",
  "sessionTarget",
  "forecast",
  "sessionTracker",
  "autosave",
  "writingGoals",
  "revisions",
]);
export const TOP_PANEL_VISIBILITY_PAGE_IDS = WORKSPACE_PANE_IDS;
const DEFAULT_WORKSPACE_PANE_ID = "manuscript";
const DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID = DEFAULT_WORKSPACE_PANE_ID;
const CONSOLE_COLLAPSE_PANEL_IDS = Object.freeze(["issueTasks", ...SIDE_PANEL_FEATURE_IDS]);

const CUSTOM_METADATA_PANEL_ID_PATTERN = /^metadata-[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function normalizeSidePanelFeatureIds(candidate = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [...new Set(source.map((value) => String(value ?? "").trim()).filter(isSupportedSidePanelFeatureId))];
}

export function isSupportedSidePanelFeatureId(panelId = "") {
  const normalizedPanelId = String(panelId ?? "").trim();
  return SIDE_PANEL_FEATURE_IDS.includes(normalizedPanelId) || CUSTOM_METADATA_PANEL_ID_PATTERN.test(normalizedPanelId);
}

export function isSupportedTopPanelCardId(cardId = "") {
  return TOP_PANEL_CARD_IDS.includes(String(cardId ?? "").trim());
}

function isSupportedConsoleCollapsePanelId(panelId = "") {
  const normalizedPanelId = String(panelId ?? "").trim();
  return CONSOLE_COLLAPSE_PANEL_IDS.includes(normalizedPanelId) || CUSTOM_METADATA_PANEL_ID_PATTERN.test(normalizedPanelId);
}

function collectSidePanelFeatureIds(candidate = {}, extraPanelIds = []) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  return [
    ...SIDE_PANEL_FEATURE_IDS,
    ...normalizeSidePanelFeatureIds(extraPanelIds),
    ...normalizeSidePanelFeatureIds(Object.keys(source)),
  ].filter((panelId, index, ids) => ids.indexOf(panelId) === index);
}

function collectTopPanelCardIds(candidate = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  return [
    ...TOP_PANEL_CARD_IDS,
    ...Object.keys(source).map((value) => String(value ?? "").trim()).filter(isSupportedTopPanelCardId),
  ].filter((cardId, index, ids) => ids.indexOf(cardId) === index);
}

// Intent: distinguish durable settings objects from arrays or primitive compatibility values.
function isPlainObject(candidate) {
  return candidate && typeof candidate === "object" && !Array.isArray(candidate);
}

// Intent: keep historic pane aliases compatible with the current feature-page visibility keys.
export function normalizeWorkspacePaneId(paneId = DEFAULT_WORKSPACE_PANE_ID) {
  const normalizedPaneId = String(paneId ?? "").trim();
  if (normalizedPaneId === "voice") {
    return "narration";
  }

  return WORKSPACE_PANE_IDS.includes(normalizedPaneId)
    ? normalizedPaneId
    : DEFAULT_WORKSPACE_PANE_ID;
}

// Intent: keep top-card page keys aligned with the persisted workspace pane IDs.
export function normalizeTopPanelVisibilityPageId(pageId = DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID) {
  return normalizeWorkspacePaneId(pageId);
}

// Intent: normalize one page's card switches without carrying unknown settings into the renderer.
function createTopPanelCardVisibilityState(candidate = {}) {
  const source = isPlainObject(candidate) ? candidate : {};
  return collectTopPanelCardIds(source).reduce((visibility, cardId) => ({
    ...visibility,
    [cardId]: source[cardId] !== false,
  }), {});
}

// Intent: accept both the current page-scoped shape and earlier wrapper names used in prototypes.
function getScopedTopPanelVisibilitySource(source, pageId) {
  if (!isPlainObject(source)) {
    return null;
  }

  if (isPlainObject(source[pageId])) {
    return source[pageId];
  }

  if (isPlainObject(source.pages) && isPlainObject(source.pages[pageId])) {
    return source.pages[pageId];
  }

  if (isPlainObject(source.panes) && isPlainObject(source.panes[pageId])) {
    return source.panes[pageId];
  }

  return null;
}

// Intent: detect whether stored visibility is already scoped or must be treated as a legacy flat record.
function hasScopedTopPanelVisibilitySource(source) {
  if (!isPlainObject(source)) {
    return false;
  }

  return TOP_PANEL_VISIBILITY_PAGE_IDS.some((pageId) =>
    getScopedTopPanelVisibilitySource(source, pageId) != null
  );
}

export function normalizeCollapsedChapterIds(candidate = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [...new Set(source.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

export function createCollapsedConsoleChapterState(candidate = {}, extraPanelIds = []) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const panelState = {
    issueTasks: normalizeCollapsedChapterIds(candidate?.issueTasks),
    issues: normalizeCollapsedChapterIds(candidate?.issues),
    inspiration: normalizeCollapsedChapterIds(candidate?.inspiration),
    research: normalizeCollapsedChapterIds(candidate?.research),
  };

  // Intent: custom metadata panels share the same chapter-collapse behavior as built-in note panels.
  for (const panelId of collectSidePanelFeatureIds(source, extraPanelIds)) {
    if (Object.prototype.hasOwnProperty.call(panelState, panelId) || !isSupportedSidePanelFeatureId(panelId)) {
      continue;
    }
    panelState[panelId] = normalizeCollapsedChapterIds(source[panelId]);
  }

  return panelState;
}

export function toggleCollapsedChapterId(collapsedChapterIds = [], chapterId = "") {
  const normalizedChapterId = String(chapterId ?? "").trim();
  if (!normalizedChapterId) {
    return normalizeCollapsedChapterIds(collapsedChapterIds);
  }

  const nextCollapsed = new Set(normalizeCollapsedChapterIds(collapsedChapterIds));
  if (nextCollapsed.has(normalizedChapterId)) {
    nextCollapsed.delete(normalizedChapterId);
  } else {
    nextCollapsed.add(normalizedChapterId);
  }

  return [...nextCollapsed];
}

export function toggleCollapsedConsoleChapter(state = {}, panelId = "", chapterKey = "") {
  const normalizedPanelId = String(panelId ?? "").trim();
  const normalizedChapterKey = String(chapterKey ?? "").trim();

  if (
    !normalizedPanelId ||
    !normalizedChapterKey ||
    !isSupportedConsoleCollapsePanelId(normalizedPanelId)
  ) {
    return state;
  }

  const panelState = createCollapsedConsoleChapterState(state);
  return {
    ...panelState,
    [normalizedPanelId]: toggleCollapsedChapterId(panelState[normalizedPanelId], normalizedChapterKey),
  };
}

export function pruneCollapsedChapterIds(collapsedChapterIds = [], allowedChapterIds = new Set()) {
  const allowed = allowedChapterIds instanceof Set ? allowedChapterIds : new Set();
  return normalizeCollapsedChapterIds(collapsedChapterIds).filter((chapterId) => allowed.has(chapterId));
}

// Intent: keep console panel visibility deterministic when authors customize the right dock.
export function createSidePanelVisibilityState(candidate = {}, extraPanelIds = []) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  return collectSidePanelFeatureIds(source, extraPanelIds).reduce((visibility, panelId) => ({
    ...visibility,
    [panelId]: source[panelId] !== false,
  }), {});
}

export function setSidePanelFeatureVisible(candidate = {}, panelId = "", isVisible = true) {
  const normalizedPanelId = String(panelId ?? "").trim();
  const visibility = createSidePanelVisibilityState(candidate);
  if (!isSupportedSidePanelFeatureId(normalizedPanelId)) {
    return visibility;
  }

  return {
    ...visibility,
    [normalizedPanelId]: isVisible === true,
  };
}

export function getVisibleSidePanelIds(candidate = {}, extraPanelIds = []) {
  const visibility = createSidePanelVisibilityState(candidate, extraPanelIds);
  return collectSidePanelFeatureIds(visibility, extraPanelIds).filter((panelId) => visibility[panelId] !== false);
}

export function resolveVisibleSidePanelMode(activePanelId = "", candidate = {}, extraPanelIds = []) {
  const visiblePanelIds = getVisibleSidePanelIds(candidate, extraPanelIds);
  const normalizedActivePanelId = String(activePanelId ?? "").trim();
  if (visiblePanelIds.includes(normalizedActivePanelId)) {
    return normalizedActivePanelId;
  }

  return visiblePanelIds[0] ?? "";
}

// Intent: keep whole-layout side-rail focus mode as a small boolean app setting.
export function normalizeSidePanelsHiddenState(candidate = false) {
  return candidate === true;
}

export function toggleSidePanelsHiddenState(candidate = false) {
  return !normalizeSidePanelsHiddenState(candidate);
}

// Intent: keep top chrome card visibility deterministic per feature page while the shell owns render and persistence effects.
export function createTopPanelVisibilityState(candidate = {}) {
  const source = isPlainObject(candidate) ? candidate : {};
  const hasScopedSource = hasScopedTopPanelVisibilitySource(source);
  const legacyVisibility = createTopPanelCardVisibilityState(source);

  return TOP_PANEL_VISIBILITY_PAGE_IDS.reduce((visibility, pageId) => {
    const pageSource = getScopedTopPanelVisibilitySource(source, pageId);
    return {
      ...visibility,
      [pageId]: createTopPanelCardVisibilityState(hasScopedSource ? pageSource : legacyVisibility),
    };
  }, {});
}

export function getTopPanelVisibilityForPane(candidate = {}, pageId = DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID) {
  const scopedVisibility = createTopPanelVisibilityState(candidate);
  const normalizedPageId = normalizeTopPanelVisibilityPageId(pageId);
  return scopedVisibility[normalizedPageId] ?? scopedVisibility[DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID];
}

export function setTopPanelCardVisible(candidate = {}, cardId = "", isVisible = true, pageId = DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID) {
  const normalizedCardId = String(cardId ?? "").trim();
  const visibility = createTopPanelVisibilityState(candidate);
  const normalizedPageId = normalizeTopPanelVisibilityPageId(pageId);
  if (!isSupportedTopPanelCardId(normalizedCardId)) {
    return visibility;
  }

  return {
    ...visibility,
    [normalizedPageId]: {
      ...getTopPanelVisibilityForPane(visibility, normalizedPageId),
      [normalizedCardId]: isVisible === true,
    },
  };
}

export function isTopPanelCardVisible(candidate = {}, cardId = "", pageId = DEFAULT_TOP_PANEL_VISIBILITY_PAGE_ID) {
  const normalizedCardId = String(cardId ?? "").trim();
  if (!isSupportedTopPanelCardId(normalizedCardId)) {
    return false;
  }

  return getTopPanelVisibilityForPane(candidate, pageId)[normalizedCardId] !== false;
}
