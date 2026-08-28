// Intent: resolve complete-project metrics from the persisted project index plus explicit live scene overrides.

function normalizeCount(value, fallback = 0) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0
    ? Math.max(0, Math.round(count))
    : Math.max(0, Math.round(Number(fallback) || 0));
}

function countWords(text) {
  const value = String(text ?? "").trim();
  return value ? value.split(/\s+/).filter(Boolean).length : 0;
}

export function resolveProjectSceneDraftText(sceneDraft = null) {
  if (typeof sceneDraft?.editorText === "string") {
    return sceneDraft.editorText;
  }

  return (Array.isArray(sceneDraft?.blocks) ? sceneDraft.blocks : [])
    .map((block) => String(block?.text ?? ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function hasSceneDraftBody(sceneDraft) {
  return Boolean(
    sceneDraft &&
    typeof sceneDraft === "object" &&
    !Array.isArray(sceneDraft) &&
    (
      typeof sceneDraft.editorText === "string" ||
      Array.isArray(sceneDraft.blocks)
    )
  );
}

export function buildLiveSceneWordCountOverrides(sceneDrafts = {}) {
  const overrides = {};
  const safeDrafts = sceneDrafts && typeof sceneDrafts === "object" && !Array.isArray(sceneDrafts)
    ? sceneDrafts
    : {};
  for (const [sceneId, sceneDraft] of Object.entries(safeDrafts)) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (!normalizedSceneId || !hasSceneDraftBody(sceneDraft)) {
      continue;
    }
    overrides[normalizedSceneId] = countWords(resolveProjectSceneDraftText(sceneDraft));
  }
  return overrides;
}

function normalizeLiveSceneWordCounts(liveSceneWordCounts = {}) {
  if (liveSceneWordCounts instanceof Map) {
    return new Map(
      [...liveSceneWordCounts.entries()]
        .map(([sceneId, wordCount]) => [String(sceneId ?? "").trim(), normalizeCount(wordCount)])
        .filter(([sceneId]) => Boolean(sceneId)),
    );
  }

  const safeCounts = liveSceneWordCounts && typeof liveSceneWordCounts === "object" && !Array.isArray(liveSceneWordCounts)
    ? liveSceneWordCounts
    : {};
  return new Map(
    Object.entries(safeCounts)
      .map(([sceneId, wordCount]) => [String(sceneId ?? "").trim(), normalizeCount(wordCount)])
      .filter(([sceneId]) => Boolean(sceneId)),
  );
}

export function getProjectIndexSceneWordCount(projectIndex, sceneId) {
  const normalizedSceneId = String(sceneId ?? "").trim();
  const scene = (Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [])
    .find((candidate) => String(candidate?.id ?? "").trim() === normalizedSceneId);
  const wordCount = Number(scene?.wordCount);
  return Number.isFinite(wordCount) && wordCount >= 0 ? normalizeCount(wordCount) : null;
}

export function getProjectIndexChapterWordCount(projectIndex, chapterId) {
  const normalizedChapterId = String(chapterId ?? "").trim();
  const chapter = (Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [])
    .find((candidate) => String(candidate?.id ?? "").trim() === normalizedChapterId);
  const wordCount = Number(chapter?.wordCount);
  if (Number.isFinite(wordCount) && wordCount >= 0) {
    return normalizeCount(wordCount);
  }

  if (!normalizedChapterId) {
    return 0;
  }
  return (Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [])
    .filter((scene) => String(scene?.chapterId ?? "").trim() === normalizedChapterId)
    .reduce((total, scene) => total + normalizeCount(scene?.wordCount), 0);
}

export function getProjectWordCount(projectIndex, liveSceneWordCounts = {}) {
  const liveCounts = normalizeLiveSceneWordCounts(liveSceneWordCounts);
  const indexedSceneIds = new Set();
  let total = 0;
  for (const scene of Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : []) {
    const sceneId = String(scene?.id ?? "").trim();
    if (!sceneId) {
      continue;
    }
    indexedSceneIds.add(sceneId);
    total += liveCounts.has(sceneId) ? liveCounts.get(sceneId) : normalizeCount(scene?.wordCount);
  }
  for (const [sceneId, wordCount] of liveCounts.entries()) {
    if (!indexedSceneIds.has(sceneId)) {
      total += wordCount;
    }
  }
  return total;
}

export function getChapterWordCount(projectIndex, chapterId, liveSceneWordCounts = {}) {
  const normalizedChapterId = String(chapterId ?? "").trim();
  if (!normalizedChapterId) {
    return 0;
  }
  const liveCounts = normalizeLiveSceneWordCounts(liveSceneWordCounts);
  return (Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [])
    .filter((scene) => String(scene?.chapterId ?? "").trim() === normalizedChapterId)
    .reduce((total, scene) => {
      const sceneId = String(scene?.id ?? "").trim();
      return total + (sceneId && liveCounts.has(sceneId) ? liveCounts.get(sceneId) : normalizeCount(scene?.wordCount));
    }, 0);
}

export function adjustChapterWordCountForLiveScene({
  projectIndex,
  chapterId,
  sceneId,
  liveSceneWordCount,
} = {}) {
  const persistedSceneWordCount = getProjectIndexSceneWordCount(projectIndex, sceneId) ?? 0;
  return Math.max(
    0,
    getProjectIndexChapterWordCount(projectIndex, chapterId) - persistedSceneWordCount + normalizeCount(liveSceneWordCount),
  );
}

export function getProjectRecordWordCountForSettings(recordLike = {}) {
  const projectIndex = recordLike?.projectIndex && typeof recordLike.projectIndex === "object"
    ? recordLike.projectIndex
    : null;
  const liveSceneWordCounts = buildLiveSceneWordCountOverrides(recordLike?.sceneDrafts);
  if (Array.isArray(projectIndex?.scenes) && projectIndex.scenes.length) {
    return getProjectWordCount(projectIndex, liveSceneWordCounts);
  }

  const lines = Array.isArray(recordLike?.workspace?.project?.lines) ? recordLike.workspace.project.lines : [];
  const workspaceWordCount = lines.reduce((total, line) => total + countWords(line?.text), 0);
  if (workspaceWordCount > 0) {
    return workspaceWordCount;
  }
  return [...normalizeLiveSceneWordCounts(liveSceneWordCounts).values()]
    .reduce((total, wordCount) => total + wordCount, 0);
}

export function buildWorkspaceStatsFromProjectIndex(projectIndex, currentStats = {}, liveSceneWordCounts = {}) {
  const chapters = Array.isArray(projectIndex?.chapters) ? projectIndex.chapters : [];
  const scenes = Array.isArray(projectIndex?.scenes) ? projectIndex.scenes : [];
  return {
    ...(currentStats && typeof currentStats === "object" && !Array.isArray(currentStats) ? currentStats : {}),
    chapterCount: chapters.length,
    sceneCount: scenes.length,
    lineCount: scenes.reduce((total, scene) => total + normalizeCount(scene?.lineCount), 0),
    wordCount: getProjectWordCount(projectIndex, liveSceneWordCounts),
  };
}

function collectWorkspaceSceneWordCounts(projectRecord) {
  const counts = new Map();
  for (const line of Array.isArray(projectRecord?.workspace?.project?.lines) ? projectRecord.workspace.project.lines : []) {
    const sceneId = String(line?.sceneId ?? "").trim();
    if (sceneId) {
      counts.set(sceneId, (counts.get(sceneId) ?? 0) + countWords(line?.text));
    }
  }
  return counts;
}

function collectCurrentChapterMetrics(scenes = [], persistedChapters = []) {
  const persistedById = new Map(
    (Array.isArray(persistedChapters) ? persistedChapters : [])
      .map((chapter) => [String(chapter?.id ?? "").trim(), chapter])
      .filter(([chapterId]) => Boolean(chapterId)),
  );
  const chapters = new Map();
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const chapterId = String(scene?.chapterId ?? "").trim() || "unassigned-chapter";
    const persisted = persistedById.get(chapterId) ?? {};
    const chapter = chapters.get(chapterId) ?? {
      ...persisted,
      id: chapterId,
      title: String(scene?.chapterTitle ?? persisted.title ?? "Untitled Chapter"),
      order: Number.isFinite(Number(persisted.order)) ? Number(persisted.order) : index + 1,
      sceneIds: [],
      lineCount: 0,
      wordCount: 0,
      inspirationCount: 0,
      researchCount: 0,
    };
    chapter.sceneIds.push(scene?.id ?? "");
    chapter.lineCount += normalizeCount(scene?.lineCount);
    chapter.wordCount += normalizeCount(scene?.wordCount);
    chapter.inspirationCount += normalizeCount(scene?.inspirationCount);
    chapter.researchCount += normalizeCount(scene?.researchCount);
    chapters.set(chapterId, chapter);
  }
  return [...chapters.values()].sort((left, right) => Number(left.order) - Number(right.order));
}

// Intent: retain persisted complete-project rows while accepting metrics and metadata from explicitly loaded/dirty scenes.
export function mergeProjectIndexWithLiveSceneOverrides({
  computedIndex = {},
  persistedProjectIndex = null,
  projectRecord = {},
} = {}) {
  const persistedScenes = Array.isArray(persistedProjectIndex?.scenes) ? persistedProjectIndex.scenes : [];
  if (!persistedScenes.length) {
    return computedIndex;
  }
  const computedById = new Map(
    (Array.isArray(computedIndex?.scenes) ? computedIndex.scenes : [])
      .map((scene) => [String(scene?.id ?? "").trim(), scene])
      .filter(([sceneId]) => Boolean(sceneId)),
  );
  const liveDraftIds = new Set(
    Object.entries(
      projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object" && !Array.isArray(projectRecord.sceneDrafts)
        ? projectRecord.sceneDrafts
        : {},
    )
      .filter(([, sceneDraft]) => hasSceneDraftBody(sceneDraft))
      .map(([sceneId]) => sceneId),
  );
  const workspaceSceneWordCounts = collectWorkspaceSceneWordCounts(projectRecord);
  const mergedSceneIds = [];
  for (const sceneId of [
    ...(Array.isArray(persistedProjectIndex?.sceneOrder) ? persistedProjectIndex.sceneOrder : persistedScenes.map((scene) => scene?.id)),
    ...(Array.isArray(computedIndex?.sceneOrder) ? computedIndex.sceneOrder : [...computedById.keys()]),
  ]) {
    const normalizedSceneId = String(sceneId ?? "").trim();
    if (normalizedSceneId && !mergedSceneIds.includes(normalizedSceneId)) {
      mergedSceneIds.push(normalizedSceneId);
    }
  }
  const persistedById = new Map(persistedScenes.map((scene) => [String(scene?.id ?? "").trim(), scene]));
  const scenes = mergedSceneIds.map((sceneId, index) => {
    const persisted = persistedById.get(sceneId) ?? {};
    const computed = computedById.get(sceneId) ?? {};
    const hasLiveMetric = liveDraftIds.has(sceneId) || (workspaceSceneWordCounts.get(sceneId) ?? 0) > 0;
    return {
      ...persisted,
      ...computed,
      id: sceneId,
      order: index + 1,
      metadata: {
        ...(persisted?.metadata && typeof persisted.metadata === "object" ? persisted.metadata : {}),
        ...(computed?.metadata && typeof computed.metadata === "object" ? computed.metadata : {}),
      },
      wordCount: hasLiveMetric ? normalizeCount(computed?.wordCount) : normalizeCount(persisted?.wordCount, computed?.wordCount),
    };
  });
  return {
    ...persistedProjectIndex,
    ...computedIndex,
    scenes,
    chapters: collectCurrentChapterMetrics(scenes, persistedProjectIndex?.chapters),
    sceneOrder: scenes.map((scene) => scene.id),
  };
}
