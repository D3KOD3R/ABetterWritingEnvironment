// Intent: own small UI-state transitions before a broader editor store facade exists.

export function normalizeCollapsedChapterIds(candidate = []) {
  const source = Array.isArray(candidate) ? candidate : [];
  return [...new Set(source.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

export function createCollapsedConsoleChapterState(candidate = {}) {
  return {
    issueTasks: normalizeCollapsedChapterIds(candidate?.issueTasks),
    issues: normalizeCollapsedChapterIds(candidate?.issues),
    inspiration: normalizeCollapsedChapterIds(candidate?.inspiration),
    research: normalizeCollapsedChapterIds(candidate?.research),
  };
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
    !Object.prototype.hasOwnProperty.call(createCollapsedConsoleChapterState(), normalizedPanelId)
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
