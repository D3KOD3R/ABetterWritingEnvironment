// Intent: own editor-side state normalization, draft records, task records, and scene derivation helpers.
// Intent: keep storage keys centralized so project save migration can reason about every browser cache.
export const EDITOR_DRAFTS_KEY = "abe-scene-drafts-v1";
export const EDITOR_PREFS_KEY = "abe-editor-prefs-v1";
export const EDITOR_LOCAL_AI_PREFS_KEY = "abe-local-ai-prefs-v1";
export const EDITOR_PROJECT_TITLE_KEY = "abe-project-title-v1";
export const EDITOR_PROJECT_LIBRARY_KEY = "abe-project-library-v1";
export const EDITOR_ACTIVE_PROJECT_ID_KEY = "abe-active-project-id-v1";
export const EDITOR_PROJECT_SOURCE_PATH_KEY = "abe-project-source-path-v1";
export const EDITOR_PASSAGE_NOTES_KEY = "abe-passage-notes-v1";
export const EDITOR_STRUCTURE_KEY = "abe-structure-drafts-v1";
export const EDITOR_TEMPLATE_DRAFTS_KEY = "abe-template-drafts-v1";
export const EDITOR_TASKS_KEY = "abe-manuscript-tasks-v1";

export const FONT_OPTIONS = [
  {
    id: "story-serif",
    label: "Story Serif",
    stack: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },
  {
    id: "draft-sans",
    label: "Draft Sans",
    stack: '"Bahnschrift", "Trebuchet MS", Verdana, sans-serif',
  },
  {
    id: "quiet-mono",
    label: "Quiet Mono",
    stack: '"Consolas", "Lucida Console", "Courier New", monospace',
  },
];

export const FONT_SIZE_OPTIONS = [16, 18, 20, 22];
export const LINE_HEIGHT_OPTIONS = [1.5, 1.7, 1.9, 2.1];
export const EDITOR_WIDTH_OPTIONS = [560, 680, 760, 840];

// Intent: define safe editor preference defaults before user or project-specific settings are applied.
export function createDefaultEditorPrefs() {
  return {
    fontFamilyId: "story-serif",
    fontSize: 18,
    lineHeight: 1.7,
    editorWidth: 760,
    projectFileAutosaveEnabled: true,
    grammarCheckEnabled: true,
    revisionOverlayEnabled: false,
    italicText: false,
  };
}

export function createDefaultLocalAiPrefs() {
  return {
    enabled: true,
  };
}

export function createDefaultSpellcheckProjectSettings() {
  return {
    dictionaryWords: [],
    exceptionWords: [],
  };
}

export function normalizeLocalAiPrefs(candidate) {
  const defaults = createDefaultLocalAiPrefs();
  return {
    enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : defaults.enabled,
  };
}

export function normalizeSpellcheckProjectSettings(candidate) {
  const defaults = createDefaultSpellcheckProjectSettings();
  const normalizedCandidate = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};

  return {
    dictionaryWords: normalizeSpellcheckWordList(
      normalizedCandidate.dictionaryWords ??
      normalizedCandidate.dictionary ??
      defaults.dictionaryWords,
    ),
    exceptionWords: normalizeSpellcheckWordList(
      normalizedCandidate.exceptionWords ??
      normalizedCandidate.exceptions ??
      defaults.exceptionWords,
    ),
  };
}

export function normalizeEditorPrefs(candidate) {
  const defaults = createDefaultEditorPrefs();
  const fontFamilyId = FONT_OPTIONS.some((option) => option.id === candidate?.fontFamilyId)
    ? candidate.fontFamilyId
    : defaults.fontFamilyId;
  const fontSize = FONT_SIZE_OPTIONS.includes(Number(candidate?.fontSize))
    ? Number(candidate.fontSize)
    : defaults.fontSize;
  const lineHeight = LINE_HEIGHT_OPTIONS.includes(Number(candidate?.lineHeight))
    ? Number(candidate.lineHeight)
    : defaults.lineHeight;
  const editorWidth = EDITOR_WIDTH_OPTIONS.includes(Number(candidate?.editorWidth))
    ? Number(candidate.editorWidth)
    : defaults.editorWidth;
  const revisionOverlayEnabled =
    typeof candidate?.revisionOverlayEnabled === "boolean"
      ? candidate.revisionOverlayEnabled
      : defaults.revisionOverlayEnabled;
  const projectFileAutosaveEnabled =
    typeof candidate?.projectFileAutosaveEnabled === "boolean"
      ? candidate.projectFileAutosaveEnabled
      : defaults.projectFileAutosaveEnabled;
  const grammarCheckEnabled =
    typeof candidate?.grammarCheckEnabled === "boolean"
      ? candidate.grammarCheckEnabled
      : defaults.grammarCheckEnabled;
  const italicText =
    typeof candidate?.italicText === "boolean"
      ? candidate.italicText
      : defaults.italicText;

  return {
    fontFamilyId,
    fontSize,
    lineHeight,
    editorWidth,
    projectFileAutosaveEnabled,
    grammarCheckEnabled,
    revisionOverlayEnabled,
    italicText,
  };
}

function normalizeSpellcheckWordList(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const normalizedWords = [];
  const seen = new Set();

  for (const item of candidate) {
    const normalized = normalizeSpellcheckWord(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedWords.push(normalized);
  }

  return normalizedWords;
}

function normalizeSpellcheckWord(word) {
  const normalized = String(word ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  return /[a-z]/.test(normalized) ? normalized : "";
}

// Intent: derive scene records from canonical workspace lines plus draft structure without mutating the project.
export function buildSceneRecords(workspace, sceneDrafts = {}, structureDrafts = {}) {
  const baseScenes = [];
  const baseSceneMap = new Map();

  for (const line of workspace.project.lines) {
    let scene = baseSceneMap.get(line.sceneId);
    if (!scene) {
      scene = {
        sceneId: line.sceneId,
        chapterId: line.chapterId,
        chapterTitle: line.chapterTitle,
        sceneTitle: line.sceneTitle,
        sceneSynopsis: line.sceneSynopsis,
        editorText: "",
        blocks: [],
      };
      baseSceneMap.set(line.sceneId, scene);
      baseScenes.push(scene);
    }

    scene.blocks.push({
      blockId: line.blockId,
      lineNumber: line.lineNumber,
      kind: line.kind,
      speakerLabel: line.speakerLabel,
      text: line.text,
      issueIds: [...line.issueIds],
      eventTagIds: [...line.eventTagIds],
      isDraft: false,
    });
  }

  for (const scene of baseScenes) {
    scene.editorText = composeEditorText(scene.blocks);
  }

  const structureSceneMetadata = new Map();
  if (Array.isArray(structureDrafts?.scenes)) {
    for (const candidate of structureDrafts.scenes) {
      if (!candidate || typeof candidate !== "object") {
        continue;
      }
      const sceneId = typeof candidate.sceneId === "string" ? candidate.sceneId : "";
      if (!sceneId) {
        continue;
      }
      structureSceneMetadata.set(sceneId, candidate);
    }
  }

  for (const scene of baseScenes) {
    const metadata = structureSceneMetadata.get(scene.sceneId);
    if (!metadata) {
      continue;
    }

    scene.chapterId = typeof metadata.chapterId === "string" ? metadata.chapterId : scene.chapterId;
    scene.chapterTitle = typeof metadata.chapterTitle === "string" ? metadata.chapterTitle : scene.chapterTitle;
    scene.sceneTitle = typeof metadata.sceneTitle === "string" ? metadata.sceneTitle : scene.sceneTitle;
    scene.sceneSynopsis = typeof metadata.sceneSynopsis === "string" ? metadata.sceneSynopsis : scene.sceneSynopsis;
  }

  const draftSceneIds = new Set();
  const draftScenes = Array.isArray(structureDrafts?.scenes)
    ? structureDrafts.scenes
      .filter((scene) => {
        const sceneId = typeof scene?.sceneId === "string" ? scene.sceneId : "";
        if (baseSceneMap.has(sceneId)) {
          return false;
        }
        if (sceneId && draftSceneIds.has(sceneId)) {
          return false;
        }
        if (sceneId) {
          draftSceneIds.add(sceneId);
        }
        return true;
      })
      .map((scene, index) => ({
        sceneId: scene.sceneId ?? `draft-scene-${index + 1}`,
        chapterId: scene.chapterId ?? "draft-chapter",
        chapterTitle: scene.chapterTitle ?? "New Chapter",
        sceneTitle: scene.sceneTitle ?? "New Scene",
        sceneSynopsis: scene.sceneSynopsis ?? "",
        editorText: scene.initialText ?? "",
        blocks: [
          {
            blockId: scene.blockId ?? `draft-block-${scene.sceneId ?? index + 1}-1`,
            lineNumber: null,
            kind: "narration",
            speakerLabel: "",
            text: scene.initialText ?? "",
            issueIds: [],
            eventTagIds: [],
            isDraft: true,
          },
        ],
      }))
    : [];

  return [...baseScenes, ...draftScenes].map((scene) => {
    const draft = sceneDrafts?.[scene.sceneId];
    if (!draft) {
      return cloneValue(scene);
    }

    const draftBlocks = Array.isArray(draft.blocks) ? draft.blocks : null;
    const draftEditorText = typeof draft.editorText === "string" ? draft.editorText : null;
    const composedDraftText = draftBlocks ? composeEditorText(draftBlocks) : null;
    const legacyDraftText = draftBlocks ? composeEditorText(draftBlocks, "\n") : null;
    const resolvedEditorText =
      draftEditorText && draftEditorText === legacyDraftText && draftEditorText !== composedDraftText
        ? composedDraftText
        : draftEditorText ?? composedDraftText ?? scene.editorText;

    return {
      sceneId: scene.sceneId,
      chapterId: scene.chapterId,
      chapterTitle: scene.chapterTitle,
      sceneTitle: draft.sceneTitle ?? scene.sceneTitle,
      sceneSynopsis: draft.sceneSynopsis ?? scene.sceneSynopsis,
      editorText: resolvedEditorText,
      blocks: draftBlocks
        ? draftBlocks.map((block, index) => ({
            blockId: block.blockId ?? `draft-block-${scene.sceneId}-${index + 1}`,
            lineNumber: block.lineNumber ?? null,
            kind: block.kind ?? "narration",
            speakerLabel: block.speakerLabel ?? "",
            text: block.text ?? "",
            issueIds: Array.isArray(block.issueIds) ? [...block.issueIds] : [],
            eventTagIds: Array.isArray(block.eventTagIds) ? [...block.eventTagIds] : [],
            isDraft: Boolean(block.isDraft ?? block.lineNumber == null),
          }))
        : cloneValue(scene.blocks),
    };
  });
}

export function createSceneDraft(scene) {
  const draft = cloneValue(scene);
  draft.editorText ??= composeEditorText(scene.blocks);
  return draft;
}

export function createDraftBlock(kind, blockCount) {
  return {
    blockId: `draft-block-${Date.now()}-${blockCount + 1}`,
    lineNumber: null,
    kind,
    speakerLabel: kind === "dialogue" ? "Unnamed Speaker" : "",
    text: "",
    issueIds: [],
    eventTagIds: [],
    isDraft: true,
  };
}

export function createStructureDrafts() {
  return {
    scenes: [],
  };
}

export function createTemplateDrafts() {
  return [];
}

// Intent: validate and normalize anchored task records before the issue console renders or persists them.
export function normalizeManuscriptTasks(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  const taskOrderByScene = {};

  return candidate
    .filter((task) => task && typeof task === "object")
    .filter((task) =>
      typeof task.id === "string" &&
      typeof task.chapterId === "string" &&
      typeof task.sceneId === "string" &&
      typeof task.selectedText === "string" &&
      Number.isInteger(task.startOffset) &&
      Number.isInteger(task.endOffset),
    )
    .map((task) => {
      const sceneTitle = typeof task.sceneTitle === "string" ? task.sceneTitle : "";
      const previousTaskOrder = taskOrderByScene[task.sceneId] ?? 0;
      const taskNumber =
        Number.isInteger(task.taskNumber) && task.taskNumber > 0
          ? task.taskNumber
          : previousTaskOrder + 1;
      taskOrderByScene[task.sceneId] = Math.max(previousTaskOrder, taskNumber);
      const body =
        typeof task.body === "string"
          ? task.body
          : typeof task.description === "string"
            ? task.description
            : "";

      return {
        id: task.id,
        chapterId: task.chapterId,
        chapterTitle: typeof task.chapterTitle === "string" ? task.chapterTitle : "",
        sceneId: task.sceneId,
        sceneTitle,
        taskNumber,
        title: getStoredOrGeneratedTitle(
          task.title,
          createManuscriptTaskTitle({ sceneTitle, taskNumber }),
        ),
        body,
        description: body,
        selectedText: task.selectedText,
        startOffset: task.startOffset,
        endOffset: task.endOffset,
        status: task.status === "completed" ? "completed" : "open",
        createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date(0).toISOString(),
        completedAt: typeof task.completedAt === "string" ? task.completedAt : undefined,
        source: typeof task.source === "string" ? task.source : undefined,
        sourceDocumentId: typeof task.sourceDocumentId === "string" ? task.sourceDocumentId : undefined,
        sourceCommentId: typeof task.sourceCommentId === "string" ? task.sourceCommentId : undefined,
        sourcePath: typeof task.sourcePath === "string" ? task.sourcePath : undefined,
        anchorMode: typeof task.anchorMode === "string" ? task.anchorMode : undefined,
        anchorStatus: typeof task.anchorStatus === "string" ? task.anchorStatus : undefined,
        lineIndex: Number.isInteger(task.lineIndex) ? task.lineIndex : undefined,
        paragraphIndex: Number.isInteger(task.paragraphIndex) ? task.paragraphIndex : undefined,
        nearbyBefore: typeof task.nearbyBefore === "string" ? task.nearbyBefore : undefined,
        nearbyAfter: typeof task.nearbyAfter === "string" ? task.nearbyAfter : undefined,
      };
    });
}

export function normalizePassageNotes(candidate) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .filter((note) => note && typeof note === "object")
    .filter((note) =>
      typeof note.id === "string" &&
      (note.noteType === "inspiration" || note.noteType === "research") &&
      typeof note.chapterId === "string" &&
      typeof note.sceneId === "string" &&
      typeof note.selectedText === "string" &&
      Number.isInteger(note.startOffset) &&
      Number.isInteger(note.endOffset),
    )
    .map((note) => ({
      id: note.id,
      noteType: note.noteType,
      chapterId: note.chapterId,
      chapterTitle: typeof note.chapterTitle === "string" ? note.chapterTitle : "",
      sceneId: note.sceneId,
      sceneTitle: typeof note.sceneTitle === "string" ? note.sceneTitle : "",
      selectedText: note.selectedText,
      startOffset: note.startOffset,
      endOffset: note.endOffset,
      body: typeof note.body === "string" ? note.body : "",
      title: getStoredOrGeneratedTitle(note.title, createPassageNoteTitle(note)),
      createdAt: typeof note.createdAt === "string" ? note.createdAt : new Date(0).toISOString(),
      updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : undefined,
      source: typeof note.source === "string" ? note.source : "manual",
      sourceDocumentId: typeof note.sourceDocumentId === "string" ? note.sourceDocumentId : undefined,
      sourcePath: typeof note.sourcePath === "string" ? note.sourcePath : undefined,
      attachmentConfidence: Number.isFinite(Number(note.attachmentConfidence))
        ? Number(note.attachmentConfidence)
        : undefined,
      assetIds: Array.isArray(note.assetIds)
        ? note.assetIds.filter((assetId) => typeof assetId === "string")
        : undefined,
    }));
}

// Intent: create actionable manuscript tasks that retain a resolvable scene range.
export function createManuscriptTask(scene, selection, now = new Date().toISOString()) {
  const startOffset = Number(selection?.startOffset);
  const endOffset = Number(selection?.endOffset);
  const selectedText = String(selection?.selectedText ?? "");
  const body = String(selection?.body ?? selection?.description ?? "").trim();
  const taskNumber = Number(selection?.taskNumber);

  if (!scene) {
    throw new Error("A scene is required to create a manuscript task.");
  }

  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset <= startOffset) {
    throw new Error("A manuscript task requires a valid selected text range.");
  }

  if (!selectedText.trim()) {
    throw new Error("A manuscript task requires selected text.");
  }

  if (!body) {
    throw new Error("A manuscript task requires a task body.");
  }

  const normalizedTaskNumber =
    Number.isInteger(taskNumber) && taskNumber > 0
      ? taskNumber
      : 1;

  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chapterId: scene.chapterId,
    chapterTitle: scene.chapterTitle,
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle,
    taskNumber: normalizedTaskNumber,
    title: createManuscriptTaskTitle({
      sceneTitle: scene.sceneTitle,
      taskNumber: normalizedTaskNumber,
    }),
    body,
    description: body,
    selectedText,
    startOffset,
    endOffset,
    status: "open",
    createdAt: now,
  };
}

export function createManuscriptTaskTitle(task) {
  const sceneTitle = String(task?.sceneTitle ?? "").trim() || "Scene";
  const taskNumber =
    Number.isInteger(task?.taskNumber) && task.taskNumber > 0
      ? task.taskNumber
      : 1;
  return `${sceneTitle} task ${taskNumber}`;
}

export function createPassageNote(scene, selection, noteType, now = new Date().toISOString()) {
  const startOffset = Number(selection?.startOffset);
  const endOffset = Number(selection?.endOffset);
  const selectedText = String(selection?.selectedText ?? "");
  const body = String(selection?.body ?? "").trim();

  if (!scene) {
    throw new Error("A scene is required to create a passage note.");
  }

  if (noteType !== "inspiration" && noteType !== "research") {
    throw new Error("A passage note requires a supported note type.");
  }

  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || endOffset < startOffset) {
    throw new Error("A passage note requires a valid selected text range.");
  }

  const noteSeed = {
    noteType,
    body,
    selectedText,
  };
  return {
    id: `${noteType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    noteType,
    chapterId: scene.chapterId,
    chapterTitle: scene.chapterTitle,
    sceneId: scene.sceneId,
    sceneTitle: scene.sceneTitle,
    selectedText,
    startOffset,
    endOffset,
    body,
    title: createPassageNoteTitle(noteSeed),
    createdAt: now,
    source: "manual",
  };
}

export function createPassageNoteTitle(note) {
  const body = String(note?.body ?? "").trim();
  const fallback =
    note?.noteType === "research"
      ? "Research note"
      : "Inspiration note";

  if (!body) {
    return fallback;
  }

  const words = body
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .slice(0, 7)
    .join(" ");

  return words.length < body.length ? `${words}...` : words;
}

export function updatePassageNoteBody(notes, noteId, body, now = new Date().toISOString()) {
  return normalizePassageNotes(notes).map((note) =>
    note.id === noteId
      ? {
          ...note,
          body: String(body ?? ""),
          title: createPassageNoteTitle({ ...note, body }),
          updatedAt: now,
        }
      : note,
  );
}

export function updateManuscriptTaskTitle(tasks, taskId, title) {
  return normalizeManuscriptTasks(tasks).map((task) =>
    task.id === taskId
      ? {
          ...task,
          title: getStoredOrGeneratedTitle(
            title,
            createManuscriptTaskTitle(task),
          ),
        }
      : task,
  );
}

export function updatePassageNoteTitle(notes, noteId, title) {
  return normalizePassageNotes(notes).map((note) =>
    note.id === noteId
      ? {
          ...note,
          title: getStoredOrGeneratedTitle(title, createPassageNoteTitle(note)),
          updatedAt: new Date().toISOString(),
        }
      : note,
  );
}

// Intent: summarize anchored task state for binder badges and chapter-level console groups.
export function countRemainingTasksByChapter(tasks) {
  const counts = {};

  for (const task of normalizeManuscriptTasks(tasks)) {
    if (task.status !== "open") {
      continue;
    }

    counts[task.chapterId] = (counts[task.chapterId] ?? 0) + 1;
  }

  return counts;
}

export function getOpenTasksForScene(tasks, sceneId) {
  return normalizeManuscriptTasks(tasks).filter(
    (task) => task.status === "open" && task.sceneId === sceneId,
  );
}

export function resolveManuscriptTaskRange(task, text) {
  const content = String(text ?? "");
  const selectedText = String(task?.selectedText ?? "");
  const fallbackStart = clampTextOffset(task?.startOffset, content.length);
  const fallbackEnd = Math.max(
    fallbackStart,
    clampTextOffset(
      Number.isInteger(task?.endOffset)
        ? task.endOffset
        : fallbackStart + selectedText.length,
      content.length,
    ),
  );

  if (!selectedText) {
    return {
      startOffset: fallbackStart,
      endOffset: fallbackEnd,
      matched: false,
    };
  }

  const directRange = findClosestExactRange(
    content,
    selectedText,
    fallbackStart,
    fallbackStart,
  );
  if (directRange && directRange.startOffset === fallbackStart) {
    return {
      ...directRange,
      matched: true,
    };
  }

  if (directRange) {
    return {
      ...directRange,
      matched: true,
    };
  }

  const normalizedRange = findClosestNormalizedRange(
    createNormalizedTextMap(content),
    normalizeSearchText(selectedText),
    fallbackStart,
  ) ?? findBestNormalizedFragmentRange(content, selectedText, fallbackStart);

  if (normalizedRange) {
    return {
      ...normalizedRange,
      matched: true,
    };
  }

  return {
    startOffset: fallbackStart,
    endOffset: fallbackEnd,
    matched: false,
  };
}

export function completeManuscriptTask(tasks, taskId, now = new Date().toISOString()) {
  return normalizeManuscriptTasks(tasks).map((task) =>
    task.id === taskId
      ? {
          ...task,
          status: "completed",
          completedAt: now,
        }
      : task,
  );
}

// Intent: project flat scene records back into chapter groups for binder and rendering surfaces.
export function groupScenesByChapter(scenes) {
  const chapterMap = new Map();

  for (const scene of scenes) {
    let chapter = chapterMap.get(scene.chapterId);
    if (!chapter) {
      chapter = {
        chapterId: scene.chapterId,
        chapterTitle: scene.chapterTitle,
        scenes: [],
      };
      chapterMap.set(scene.chapterId, chapter);
    }

    chapter.scenes.push(scene);
  }

  return [...chapterMap.values()];
}

export function estimateWrappedLineCount(text, maxCharactersPerLine) {
  const maxWidth = Math.max(4, Number(maxCharactersPerLine) || 80);
  const paragraphs = String(text ?? "").split("\n");
  let lineCount = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lineCount += 1;
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentWidth = 0;
    let paragraphLines = 1;

    for (const word of words) {
      const wordWidth = word.length;
      if (currentWidth === 0) {
        currentWidth = wordWidth;
        continue;
      }

      if (currentWidth + 1 + wordWidth <= maxWidth) {
        currentWidth += 1 + wordWidth;
        continue;
      }

      paragraphLines += 1;
      currentWidth = wordWidth;
    }

    lineCount += paragraphLines;
  }

  return Math.max(1, lineCount);
}

export function buildSceneLineMetrics(scenes, maxCharactersPerLine, sceneTextOverrides = {}) {
  const metrics = [];
  let lineNumber = 1;

  for (const scene of Array.isArray(scenes) ? scenes : []) {
    if (!scene || typeof scene !== "object") {
      continue;
    }

    const sceneId = typeof scene.sceneId === "string" ? scene.sceneId : "";
    if (!sceneId) {
      continue;
    }

    const overrideText = sceneTextOverrides?.[sceneId];
    const sceneText = typeof overrideText === "string" ? overrideText : scene.editorText ?? "";
    const lineCount = estimateWrappedLineCount(sceneText, maxCharactersPerLine);
    const startLineNumber = lineNumber;
    const endLineNumber = startLineNumber + lineCount - 1;

    metrics.push({
      sceneId,
      startLineNumber,
      endLineNumber,
      lineCount,
    });

    lineNumber = endLineNumber + 1;
  }

  return metrics;
}

export function findSceneByBlockId(scenes, blockId) {
  return scenes.find((scene) => scene.blocks.some((block) => block.blockId === blockId)) ?? null;
}

export function findBlockById(scenes, blockId) {
  for (const scene of scenes) {
    const block = scene.blocks.find((candidate) => candidate.blockId === blockId);
    if (block) {
      return block;
    }
  }

  return null;
}

// Intent: isolate cloning so draft helpers do not leak object references into canonical workspace data.
function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function getStoredOrGeneratedTitle(title, fallbackTitle) {
  const normalizedTitle = String(title ?? "").trim();
  return normalizedTitle || fallbackTitle;
}

function composeEditorText(blocks, separator = "\n\n") {
  return blocks.map((block) => block.text).join(separator);
}

function findClosestExactRange(content, selectedText, fallbackStart, preferredStart = null) {
  const needleLength = selectedText.length;

  if (!needleLength) {
    return null;
  }

  let bestStart = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;

  while (searchFrom <= content.length) {
    const foundStart = content.indexOf(selectedText, searchFrom);
    if (foundStart === -1) {
      break;
    }

    const distance = Math.abs(foundStart - fallbackStart);
    if (foundStart === preferredStart || distance < bestDistance) {
      bestStart = foundStart;
      bestDistance = distance;
    }

    if (foundStart === preferredStart) {
      break;
    }

    searchFrom = foundStart + Math.max(1, needleLength);
  }

  return bestStart >= 0
    ? {
        startOffset: bestStart,
        endOffset: bestStart + needleLength,
      }
    : null;
}

function findBestNormalizedFragmentRange(content, selectedText, fallbackStart) {
  const contentIndex = createNormalizedTextMap(content);
  const words = normalizeSearchText(selectedText).split(" ").filter(Boolean);
  let bestRange = null;
  let bestScore = null;

  for (let wordCount = Math.min(16, words.length); wordCount >= 4; wordCount -= 1) {
    for (let wordStart = 0; wordStart <= words.length - wordCount; wordStart += 1) {
      const fragment = words.slice(wordStart, wordStart + wordCount).join(" ");
      if (fragment.length < 18) {
        continue;
      }

      const range = findClosestNormalizedRange(contentIndex, fragment, fallbackStart);
      if (!range) {
        continue;
      }

      const score = {
        length: fragment.length,
        distance: Math.abs(range.startOffset - fallbackStart),
      };
      if (
        !bestScore ||
        score.length > bestScore.length ||
        (score.length === bestScore.length && score.distance < bestScore.distance)
      ) {
        bestRange = range;
        bestScore = score;
      }
    }
  }

  return bestRange;
}

function findClosestNormalizedRange(contentIndex, normalizedNeedle, fallbackStart) {
  const needle = normalizedNeedle.trim();

  if (!needle) {
    return null;
  }

  let bestStart = -1;
  let bestEnd = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;

  while (searchFrom <= contentIndex.normalized.length) {
    const normalizedStart = contentIndex.normalized.indexOf(needle, searchFrom);
    if (normalizedStart === -1) {
      break;
    }

    const normalizedEnd = normalizedStart + needle.length - 1;
    const sourceStart = contentIndex.sourceOffsets[normalizedStart];
    const sourceEnd = contentIndex.sourceOffsets[normalizedEnd] + 1;
    const distance = Math.abs(sourceStart - fallbackStart);

    if (distance < bestDistance) {
      bestStart = sourceStart;
      bestEnd = sourceEnd;
      bestDistance = distance;
    }

    searchFrom = normalizedStart + Math.max(1, needle.length);
  }

  return bestStart >= 0
    ? {
        startOffset: bestStart,
        endOffset: Math.max(bestStart, bestEnd),
      }
    : null;
}

function createNormalizedTextMap(text) {
  let normalized = "";
  const sourceOffsets = [];
  let previousWasSpace = true;

  for (let sourceOffset = 0; sourceOffset < text.length; sourceOffset += 1) {
    const normalizedCharacter = normalizeSearchCharacter(text[sourceOffset]);

    if (normalizedCharacter === " ") {
      if (!previousWasSpace && normalized.length) {
        normalized += " ";
        sourceOffsets.push(sourceOffset);
        previousWasSpace = true;
      }
      continue;
    }

    normalized += normalizedCharacter;
    sourceOffsets.push(sourceOffset);
    previousWasSpace = false;
  }

  return {
    normalized: normalized.trimEnd(),
    sourceOffsets,
  };
}

function normalizeSearchText(value) {
  return createNormalizedTextMap(String(value ?? "")).normalized.trim();
}

function normalizeSearchCharacter(character) {
  return /[\p{L}\p{N}]/u.test(character)
    ? character.toLocaleLowerCase()
    : " ";
}

function clampTextOffset(value, textLength) {
  const numericValue = Number(value);
  const length = Math.max(0, Number(textLength) || 0);

  if (!Number.isInteger(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(numericValue, length));
}
