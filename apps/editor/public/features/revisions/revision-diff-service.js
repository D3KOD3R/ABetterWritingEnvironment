// Intent: generate compact, ID-aware revision diffs from a project digest instead of storing full project snapshots.

const LARGE_TEXT_CHANGE_PREVIEW_LIMIT = 180;

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function stableSerialize(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (valueType === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function hashString(value) {
  const input = String(value ?? "");
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function hashValue(value) {
  return hashString(stableSerialize(value));
}

function countWords(text) {
  const value = String(text ?? "").trim();
  if (!value) {
    return 0;
  }
  return value.split(/\s+/).filter(Boolean).length;
}

function previewText(text, limit = LARGE_TEXT_CHANGE_PREVIEW_LIMIT) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit).trim()}...`;
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function collectSceneTextFromLines(lines, sceneId) {
  if (!Array.isArray(lines)) {
    return "";
  }

  return lines
    .filter((line) => line?.sceneId === sceneId)
    .map((line) => String(line?.text ?? ""))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function collectSceneDigest(projectRecord) {
  const scenesById = {};
  const projectIndexScenes = Array.isArray(projectRecord?.projectIndex?.scenes)
    ? projectRecord.projectIndex.scenes
    : [];
  const structureScenes = Array.isArray(projectRecord?.structureDrafts?.scenes)
    ? projectRecord.structureDrafts.scenes
    : [];
  const sceneDrafts = normalizeObject(projectRecord?.sceneDrafts);
  const lines = Array.isArray(projectRecord?.workspace?.project?.lines)
    ? projectRecord.workspace.project.lines
    : [];
  const orderedIds = [
    ...(Array.isArray(projectRecord?.projectIndex?.sceneOrder) ? projectRecord.projectIndex.sceneOrder : []),
    ...(Array.isArray(projectRecord?.projectStorage?.sceneOrder) ? projectRecord.projectStorage.sceneOrder : []),
    ...projectIndexScenes.map((scene) => scene?.id),
    ...structureScenes.map((scene) => scene?.sceneId),
    ...Object.keys(sceneDrafts),
  ].map(normalizeId).filter(Boolean);
  const sceneIds = [...new Set(orderedIds)];

  for (const sceneId of sceneIds) {
    const indexScene = projectIndexScenes.find((scene) => scene?.id === sceneId) ?? {};
    const structureScene = structureScenes.find((scene) => scene?.sceneId === sceneId) ?? {};
    const draft = normalizeObject(sceneDrafts[sceneId]);
    const title = String(draft.sceneTitle ?? structureScene.sceneTitle ?? indexScene.title ?? "Untitled Scene");
    const chapterId = String(draft.chapterId ?? structureScene.chapterId ?? indexScene.chapterId ?? "");
    const chapterTitle = String(draft.chapterTitle ?? structureScene.chapterTitle ?? indexScene.chapterTitle ?? "");
    const text = typeof draft.editorText === "string"
      ? draft.editorText
      : collectSceneTextFromLines(lines, sceneId);
    const wordCount = text
      ? countWords(text)
      : Math.max(0, Math.round(Number(indexScene.wordCount) || 0));
    const charCount = text.length;

    scenesById[sceneId] = {
      id: sceneId,
      entityType: "scene",
      title,
      chapterId,
      chapterTitle,
      order: sceneIds.indexOf(sceneId) + 1,
      wordCount,
      charCount,
      textHash: text ? hashString(text) : String(indexScene.textHash ?? ""),
      preview: previewText(text),
      synopsisHash: hashString(String(draft.sceneSynopsis ?? structureScene.sceneSynopsis ?? indexScene.synopsis ?? "")),
    };
  }

  return scenesById;
}

function collectRecordsById(records, entityType, projectId) {
  const output = {};
  for (const record of Array.isArray(records) ? records : []) {
    const id = normalizeId(record?.id);
    if (!id) {
      continue;
    }
    output[id] = {
      id,
      entityType,
      projectId,
      title: String(record.title ?? record.name ?? record.label ?? id),
      sceneId: normalizeId(record.sceneId),
      status: String(record.status ?? record.reviewState ?? ""),
      hash: hashValue(record),
      preview: previewText(record.body ?? record.description ?? record.rationale ?? record.notes ?? ""),
    };
  }
  return output;
}

function collectWorldDigest(projectRecord) {
  const world = normalizeObject(projectRecord?.workspace?.world);
  const nodes = {};
  for (const spine of Array.isArray(world.spines) ? world.spines : []) {
    for (const node of Array.isArray(spine?.nodes) ? spine.nodes : []) {
      const id = normalizeId(node?.id);
      if (!id) {
        continue;
      }
      nodes[id] = {
        id,
        entityType: "timeline_node",
        spineId: normalizeId(spine.id),
        title: String(node.title ?? node.label ?? id),
        hash: hashValue(node),
      };
    }
  }

  return {
    templates: collectRecordsById([...(Array.isArray(world.templates) ? world.templates : []), ...(Array.isArray(projectRecord?.templateDrafts) ? projectRecord.templateDrafts : [])], "world_template", projectRecord?.id ?? ""),
    entities: collectRecordsById(world.entities, "world_entity", projectRecord?.id ?? ""),
    timelineNodes: nodes,
  };
}

export function buildRevisionProjectDigest(projectRecord) {
  const projectSettings = normalizeObject(projectRecord?.projectSettings);
  const settingsDigest = {
    editorPrefsHash: hashValue(projectSettings.editorPrefs ?? projectRecord?.editorPrefs ?? {}),
    localAiPrefsHash: hashValue(projectSettings.localAiPrefs ?? projectRecord?.localAiPrefs ?? {}),
    spellcheckHash: hashValue(projectSettings.spellcheck ?? {}),
    writingTargetHash: hashValue(projectSettings.writingTargetState ?? {}),
    layoutHash: hashValue({
      binderPanelWidth: projectSettings.binderPanelWidth,
      consoleDockWidth: projectSettings.consoleDockWidth,
      consoleDockCollapsed: projectSettings.consoleDockCollapsed,
    }),
  };

  return {
    schemaVersion: 1,
    project: {
      id: String(projectRecord?.id ?? ""),
      title: String(projectRecord?.title ?? projectRecord?.workspace?.project?.title ?? "Untitled Project"),
      source: String(projectRecord?.source ?? "user"),
    },
    manuscript: {
      scenesById: collectSceneDigest(projectRecord),
      tasksById: collectRecordsById(projectRecord?.manuscriptTasks, "manuscript_task", projectRecord?.id ?? ""),
      notesById: collectRecordsById(projectRecord?.passageNotes, "passage_note", projectRecord?.id ?? ""),
    },
    world: collectWorldDigest(projectRecord),
    settings: settingsDigest,
  };
}

function buildPath(basePath, key) {
  return basePath ? `${basePath}.${key}` : String(key);
}

function valuesEqual(left, right) {
  return stableSerialize(left) === stableSerialize(right);
}

function diffValues(before, after, basePath = "", operations = []) {
  if (valuesEqual(before, after)) {
    return operations;
  }

  const beforeIsObject = before && typeof before === "object" && !Array.isArray(before);
  const afterIsObject = after && typeof after === "object" && !Array.isArray(after);
  if (!beforeIsObject || !afterIsObject) {
    operations.push({
      op: before === undefined ? "add" : after === undefined ? "remove" : "replace",
      path: basePath,
      before: before === undefined ? undefined : cloneValue(before),
      after: after === undefined ? undefined : cloneValue(after),
    });
    return operations;
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    diffValues(before[key], after[key], buildPath(basePath, key), operations);
  }
  return operations;
}

function eventOriginsForEntity(events, entityType, entityId) {
  const origins = new Set();
  const categories = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.entityType !== entityType || event?.entityId !== entityId) {
      continue;
    }
    if (event.origin) {
      origins.add(event.origin);
    }
    if (event.changeCategory) {
      categories.add(event.changeCategory);
    }
  }
  return {
    origins: [...origins],
    categories: [...categories],
  };
}

function buildSceneChanges(beforeScenes, afterScenes, events) {
  const sceneIds = [...new Set([...Object.keys(beforeScenes ?? {}), ...Object.keys(afterScenes ?? {})])].sort();
  const changes = [];
  for (const sceneId of sceneIds) {
    const before = beforeScenes?.[sceneId] ?? null;
    const after = afterScenes?.[sceneId] ?? null;
    if (valuesEqual(before, after)) {
      continue;
    }

    const eventContext = eventOriginsForEntity(events, "scene", sceneId);
    changes.push({
      entityType: "scene",
      entityId: sceneId,
      title: after?.title ?? before?.title ?? "Untitled Scene",
      chapterId: after?.chapterId ?? before?.chapterId ?? "",
      chapterTitle: after?.chapterTitle ?? before?.chapterTitle ?? "",
      status: !before ? "added" : !after ? "removed" : "changed",
      beforeWordCount: before?.wordCount ?? 0,
      afterWordCount: after?.wordCount ?? 0,
      wordCountDelta: (after?.wordCount ?? 0) - (before?.wordCount ?? 0),
      beforePreview: before?.preview ?? "",
      afterPreview: after?.preview ?? "",
      beforeTextHash: before?.textHash ?? "",
      afterTextHash: after?.textHash ?? "",
      textChangeKind: before?.textHash && after?.textHash && before.textHash !== after.textHash
        ? "text_changed"
        : "metadata_changed",
      origins: eventContext.origins,
      changeCategories: eventContext.categories,
    });
  }
  return changes;
}

function collectChangedEntitiesFromOperations(operations, sceneChanges) {
  const entities = new Map();
  for (const sceneChange of sceneChanges) {
    entities.set(`scene:${sceneChange.entityId}`, {
      entityType: "scene",
      entityId: sceneChange.entityId,
      title: sceneChange.title,
      status: sceneChange.status,
      wordCountDelta: sceneChange.wordCountDelta,
    });
  }

  for (const operation of operations) {
    const path = String(operation.path ?? "");
    const match = path.match(/^(?:manuscript|world)\.([A-Za-z]+)ById\.([^.]+)/);
    if (!match) {
      continue;
    }

    const collectionName = match[1];
    const entityId = match[2];
    const entityType = collectionName === "tasks"
      ? "manuscript_task"
      : collectionName === "notes"
        ? "passage_note"
        : collectionName === "templates"
          ? "world_template"
          : collectionName === "entities"
            ? "world_entity"
            : collectionName === "timelineNodes"
              ? "timeline_node"
              : collectionName;
    const key = `${entityType}:${entityId}`;
    if (!entities.has(key)) {
      entities.set(key, {
        entityType,
        entityId,
        title: operation.after?.title ?? operation.before?.title ?? entityId,
        status: operation.op === "add" ? "added" : operation.op === "remove" ? "removed" : "changed",
      });
    }
  }

  return [...entities.values()];
}

function summarizeOperations(operations) {
  return operations.reduce((summary, operation) => {
    if (operation.op === "add") {
      summary.added += 1;
    } else if (operation.op === "remove") {
      summary.removed += 1;
    } else {
      summary.changed += 1;
    }
    return summary;
  }, {
    added: 0,
    removed: 0,
    changed: 0,
  });
}

export function createRevisionDiffService({
  now = () => new Date().toISOString(),
} = {}) {
  function createJsonDiff(baselineDigest, currentDigest, events = []) {
    const before = baselineDigest && typeof baselineDigest === "object"
      ? baselineDigest
      : {};
    const after = currentDigest && typeof currentDigest === "object"
      ? currentDigest
      : {};
    const operations = diffValues(before, after).filter((operation) =>
      !String(operation.path ?? "").includes(".revisions"),
    );
    const sceneChanges = buildSceneChanges(
      before.manuscript?.scenesById ?? {},
      after.manuscript?.scenesById ?? {},
      events,
    );
    const changedEntities = collectChangedEntitiesFromOperations(operations, sceneChanges);

    return {
      schemaVersion: 1,
      generatedAt: now(),
      baselineHash: hashValue(before),
      finalHash: hashValue(after),
      operations,
      changedEntities,
      sceneChanges,
      summary: summarizeOperations(operations),
    };
  }

  function listChangedEntities(diff) {
    return Array.isArray(diff?.changedEntities) ? diff.changedEntities.map(cloneValue) : [];
  }

  function createSceneChangeSummary(diff) {
    return Array.isArray(diff?.sceneChanges) ? diff.sceneChanges.map(cloneValue) : [];
  }

  function createDiffPreview(diff, limit = 20) {
    const operations = Array.isArray(diff?.operations) ? diff.operations : [];
    return operations.slice(0, limit).map((operation) => ({
      op: operation.op,
      path: operation.path,
      before: operation.before,
      after: operation.after,
    }));
  }

  function summariseDiff(diff, events = []) {
    const sceneChanges = createSceneChangeSummary(diff);
    const changedEntities = listChangedEntities(diff);
    const eventCount = Array.isArray(events) ? events.length : 0;
    const lines = [
      "# Revision Summary",
      "",
      `- Events recorded: ${eventCount}`,
      `- Changed entities: ${changedEntities.length}`,
      `- Changed scenes: ${sceneChanges.length}`,
      `- JSON operations: ${Array.isArray(diff?.operations) ? diff.operations.length : 0}`,
    ];

    if (sceneChanges.length) {
      lines.push("", "## Changed Scenes");
      for (const scene of sceneChanges.slice(0, 12)) {
        const delta = scene.wordCountDelta > 0 ? `+${scene.wordCountDelta}` : String(scene.wordCountDelta);
        lines.push(`- ${scene.title}: ${scene.beforeWordCount} -> ${scene.afterWordCount} words (${delta})`);
      }
    }

    return lines.join("\n");
  }

  return {
    buildProjectDigest: buildRevisionProjectDigest,
    createDiffPreview,
    createJsonDiff,
    createSceneChangeSummary,
    hashValue,
    listChangedEntities,
    summariseDiff,
  };
}
