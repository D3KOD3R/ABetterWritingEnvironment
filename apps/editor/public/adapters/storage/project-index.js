// Intent: build a lightweight, schema-versioned project index that maps cleanly to future folder-based storage.
function normalizePath(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function toNumber(value, fallback = Number.POSITIVE_INFINITY) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function countWords(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return 0;
  }

  return value.split(/\s+/).filter(Boolean).length;
}

function resolveSceneDraftWordCount(sceneDraft) {
  if (!sceneDraft || typeof sceneDraft !== "object") {
    return 0;
  }

  if (typeof sceneDraft.editorText === "string") {
    return countWords(sceneDraft.editorText);
  }

  const blockText = Array.isArray(sceneDraft.blocks)
    ? sceneDraft.blocks
      .map((block) => String(block?.text ?? ""))
      .join("\n\n")
    : "";
  return countWords(blockText);
}

// Intent: keep chapter totals derived from persisted scene totals so the project index can survive lazy scene loading.
export function collectChapterRecords(sceneRecords) {
  const chapters = new Map();
  const safeSceneRecords = Array.isArray(sceneRecords) ? sceneRecords : [];

  for (let index = 0; index < safeSceneRecords.length; index += 1) {
    const scene = safeSceneRecords[index];
    const chapterId = typeof scene?.chapterId === "string" && scene.chapterId.trim() ? scene.chapterId.trim() : "unassigned-chapter";
    const chapterTitle = typeof scene?.chapterTitle === "string" && scene.chapterTitle.trim() ? scene.chapterTitle.trim() : "Unassigned Chapter";
    const existing = chapters.get(chapterId) ?? {
      id: chapterId,
      title: chapterTitle,
      order: index + 1,
      sceneIds: [],
      lineCount: 0,
      wordCount: 0,
    };

    existing.title = chapterTitle;
    existing.sceneIds.push(scene?.id ?? "");
    existing.lineCount += Number.isFinite(Number(scene?.lineCount)) ? Math.max(0, Math.round(Number(scene.lineCount))) : 0;
    existing.wordCount += Math.max(0, Math.round(Number(scene?.wordCount) || 0));
    chapters.set(chapterId, existing);
  }

  return [...chapters.values()].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.id.localeCompare(right.id);
  });
}

function normalizeAssetRecord(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const id = typeof candidate.id === "string" && candidate.id.trim()
    ? candidate.id.trim()
    : "";
  if (!id) {
    return null;
  }

  return {
    id,
    sceneId: typeof candidate.sceneId === "string" ? candidate.sceneId.trim() : "",
    kind: typeof candidate.kind === "string" ? candidate.kind.trim() : "",
    role: typeof candidate.role === "string" ? candidate.role.trim() : "",
    path: normalizePath(candidate.path),
    fileRef: normalizePath(candidate.fileRef),
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

function collectSceneRecords(projectRecord) {
  const lineScenes = new Map();
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];

  for (const line of lines) {
    const sceneId = typeof line?.sceneId === "string" && line.sceneId.trim() ? line.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    const existing = lineScenes.get(sceneId) ?? {
      id: sceneId,
      title: typeof line?.sceneTitle === "string" && line.sceneTitle.trim() ? line.sceneTitle.trim() : "Untitled Scene",
      chapterId: typeof line?.chapterId === "string" && line.chapterId.trim() ? line.chapterId.trim() : "",
      chapterTitle: typeof line?.chapterTitle === "string" && line.chapterTitle.trim() ? line.chapterTitle.trim() : "Untitled Chapter",
      synopsis: "",
      lineCount: 0,
      wordCount: 0,
      sortOrder: toNumber(line?.lineNumber),
      source: "workspace",
    };

    existing.lineCount += 1;
    existing.wordCount += countWords(line?.text);
    existing.sortOrder = Math.min(existing.sortOrder, toNumber(line?.lineNumber));
    lineScenes.set(sceneId, existing);
  }

  const draftScenes = Array.isArray(projectRecord?.structureDrafts?.scenes)
    ? projectRecord.structureDrafts.scenes
    : [];
  for (let index = 0; index < draftScenes.length; index += 1) {
    const scene = draftScenes[index];
    const sceneId = typeof scene?.sceneId === "string" && scene.sceneId.trim() ? scene.sceneId.trim() : "";
    if (!sceneId) {
      continue;
    }

    const existing = lineScenes.get(sceneId) ?? {
      id: sceneId,
      title: "Untitled Scene",
      chapterId: "",
      chapterTitle: "Untitled Chapter",
      synopsis: "",
      lineCount: 0,
      wordCount: 0,
      sortOrder: Number.POSITIVE_INFINITY,
      source: "structure-draft",
    };

    existing.title = typeof scene?.sceneTitle === "string" && scene.sceneTitle.trim()
      ? scene.sceneTitle.trim()
      : existing.title;
    existing.chapterId = typeof scene?.chapterId === "string" && scene.chapterId.trim()
      ? scene.chapterId.trim()
      : existing.chapterId;
    existing.chapterTitle = typeof scene?.chapterTitle === "string" && scene.chapterTitle.trim()
      ? scene.chapterTitle.trim()
      : existing.chapterTitle;
    existing.synopsis = typeof scene?.sceneSynopsis === "string" ? scene.sceneSynopsis : existing.synopsis;
    existing.sortOrder = Math.min(existing.sortOrder, Number.isFinite(toNumber(scene?.order)) ? toNumber(scene?.order) : 100000 + index);
    lineScenes.set(sceneId, existing);
  }

  const sceneDrafts = projectRecord?.sceneDrafts && typeof projectRecord.sceneDrafts === "object"
    ? projectRecord.sceneDrafts
    : {};
  for (const sceneId of Object.keys(sceneDrafts)) {
    const draft = sceneDrafts[sceneId];
    const existing = lineScenes.get(sceneId) ?? {
      id: sceneId,
      title: "Untitled Scene",
      chapterId: "",
      chapterTitle: "Untitled Chapter",
      synopsis: "",
      lineCount: 0,
      wordCount: 0,
      sortOrder: Number.POSITIVE_INFINITY,
      source: "scene-draft",
    };

    existing.title = typeof draft?.sceneTitle === "string" && draft.sceneTitle.trim()
      ? draft.sceneTitle.trim()
      : existing.title;
    existing.synopsis = typeof draft?.sceneSynopsis === "string"
      ? draft.sceneSynopsis
      : existing.synopsis;
    existing.wordCount = resolveSceneDraftWordCount(draft);
    lineScenes.set(sceneId, existing);
  }

  return [...lineScenes.values()].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

export function buildProjectIndexFromProjectRecord(projectRecord, {
  schemaVersion = 1,
  sceneWordCountsById = {},
} = {}) {
  const sceneRecords = collectSceneRecords(projectRecord);
  const assetRegistry = Array.isArray(projectRecord?.projectSettings?.assetRegistry)
    ? projectRecord.projectSettings.assetRegistry
    : [];
  const normalizedAssets = assetRegistry
    .map((asset) => normalizeAssetRecord(asset))
    .filter(Boolean);
  const sceneAssets = new Map();
  for (const asset of normalizedAssets) {
    if (!asset.sceneId) {
      continue;
    }
    const ids = sceneAssets.get(asset.sceneId) ?? [];
    if (!ids.includes(asset.id)) {
      ids.push(asset.id);
      sceneAssets.set(asset.sceneId, ids);
    }
  }

  const scenes = sceneRecords.map((scene, index) => {
    const overrideWordCount = Number(sceneWordCountsById?.[scene.id]);
    const resolvedWordCount = Number.isFinite(overrideWordCount) && overrideWordCount >= 0
      ? Math.round(overrideWordCount)
      : Math.max(0, Math.round(Number(scene.wordCount) || 0));

    return {
      id: scene.id,
      title: scene.title,
      chapterId: scene.chapterId || "unassigned-chapter",
      order: index + 1,
      lineCount: scene.lineCount,
      wordCount: resolvedWordCount,
      synopsis: scene.synopsis || "",
      assetIds: sceneAssets.get(scene.id) ?? [],
    };
  });
  const chapters = collectChapterRecords(scenes);

  const projectFilePath = normalizePath(
    projectRecord?.projectSettings?.projectFilePath ??
    projectRecord?.projectFilePath ??
    "",
  );
  const projectSourcePath = normalizePath(
    projectRecord?.projectSettings?.projectSourcePath ??
    projectRecord?.projectSourcePath ??
    "",
  );

  return {
    schemaVersion,
    projectId: typeof projectRecord?.id === "string" ? projectRecord.id : "",
    projectTitle: typeof projectRecord?.title === "string" ? projectRecord.title : "Untitled Project",
    createdAt: typeof projectRecord?.createdAt === "string" ? projectRecord.createdAt : "",
    updatedAt: typeof projectRecord?.updatedAt === "string" ? projectRecord.updatedAt : "",
    chapters,
    scenes,
    sceneOrder: scenes.map((scene) => scene.id),
    assetIds: normalizedAssets.map((asset) => asset.id),
    assets: cloneValue(normalizedAssets),
    fileRefs: {
      projectFilePath,
      projectSourcePath,
    },
  };
}
