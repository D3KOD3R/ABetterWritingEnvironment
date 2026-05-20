// Intent: verify editor-model helpers preserve scene drafts, preferences, tasks, and passage notes.
import assert from "node:assert/strict";

import {
  buildSceneRecords,
  buildSceneLineMetrics,
  completeManuscriptTask,
  countRemainingTasksByChapter,
  createDefaultEditorPrefs,
  createDefaultLocalAiPrefs,
  createDefaultSpellcheckProjectSettings,
  createDraftBlock,
  createManuscriptTask,
  createPassageNote,
  estimateWrappedLineCount,
  findBlockById,
  findSceneByBlockId,
  getOpenTasksForScene,
  groupScenesByChapter,
  insertStructureSceneDraftAfterAnchor,
  normalizeManuscriptTasks,
  normalizeEditorPrefs,
  normalizeLocalAiPrefs,
  normalizePassageNotes,
  normalizeSpellcheckProjectSettings,
  resolveManuscriptTaskRange,
  updateManuscriptTaskTitle,
  updatePassageNoteBody,
  updatePassageNoteTitle,
} from "../apps/editor/public/editor-model.js";

export function runEditorModelTest() {
  const workspace = {
    project: {
      lines: [
        {
          blockId: "block-1",
          lineNumber: 1,
          sceneLineNumber: 1,
          kind: "narration",
          speakerLabel: undefined,
          text: "The frigate drifted toward Halcyon Station.",
          chapterId: "chapter-1",
          chapterTitle: "Arrival Vector",
          sceneId: "scene-1",
          sceneTitle: "Docking Approach",
          sceneSynopsis: "Auren guides the frigate through the station perimeter.",
          issueIds: ["issue-1"],
          eventTagIds: [],
        },
        {
          blockId: "block-2",
          lineNumber: 2,
          sceneLineNumber: 2,
          kind: "dialogue",
          speakerLabel: "Captain Auren Vale",
          text: "Keep the lights low until we clear the customs ring.",
          chapterId: "chapter-1",
          chapterTitle: "Arrival Vector",
          sceneId: "scene-1",
          sceneTitle: "Docking Approach",
          sceneSynopsis: "Auren guides the frigate through the station perimeter.",
          issueIds: [],
          eventTagIds: ["event-1"],
        },
      ],
    },
  };

  const draftBlock = createDraftBlock("dialogue", 2);
  draftBlock.text = "Another beat follows.";
  const scenes = buildSceneRecords(
    workspace,
    {
      "scene-1": {
        sceneTitle: "Docking Rewrite",
        sceneSynopsis: "A sharper version of the approach scene.",
        editorText: "The frigate crawled toward Halcyon Station in silence.\nAnother beat follows.",
        blocks: [
          {
            blockId: "block-1",
            lineNumber: 1,
            kind: "narration",
            text: "The frigate crawled toward Halcyon Station in silence.",
            speakerLabel: "",
            issueIds: ["issue-1"],
            eventTagIds: [],
            isDraft: false,
          },
          draftBlock,
        ],
      },
    },
    {
      scenes: [
        {
          sceneId: "scene-1",
          chapterId: "chapter-1",
          chapterTitle: "Arrival Vector",
          sceneTitle: "Docking Approach",
          sceneSynopsis: "Structure metadata for an existing scene.",
          initialText: "",
        },
        {
          sceneId: "draft-scene-1",
          chapterId: "draft-chapter-1",
          chapterTitle: "New Chapter",
          sceneTitle: "New Scene",
          initialText: "A blank route opens for a new scene.",
        },
      ],
    },
  );

  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].sceneTitle, "Docking Rewrite");
  assert.equal(scenes[0].sceneSynopsis, "A sharper version of the approach scene.");
  assert.equal(scenes[0].blocks.length, 2);
  assert.equal(scenes[0].editorText, "The frigate crawled toward Halcyon Station in silence.\n\nAnother beat follows.");
  assert.equal(scenes[0].blocks[1].isDraft, true);
  assert.equal(scenes[0].blocks[1].speakerLabel, "Unnamed Speaker");
  assert.equal(scenes[1].sceneTitle, "New Scene");
  assert.equal(scenes[1].blocks[0].text, "A blank route opens for a new scene.");
  assert.equal(scenes[1].editorText, "A blank route opens for a new scene.");
  assert.equal(scenes.filter((scene) => scene.sceneId === "scene-1").length, 1);
  assert.equal(findSceneByBlockId(scenes, draftBlock.blockId)?.sceneId, "scene-1");
  assert.equal(findBlockById(scenes, "block-1")?.text, "The frigate crawled toward Halcyon Station in silence.");
  assert.equal(groupScenesByChapter(scenes).length, 2);

  const orderedWorkspace = {
    project: {
      lines: [
        {
          ...workspace.project.lines[0],
          blockId: "order-block-1",
          lineNumber: 1,
          sceneId: "order-scene-1",
          sceneTitle: "Opening",
        },
        {
          ...workspace.project.lines[0],
          blockId: "order-block-2",
          lineNumber: 2,
          sceneId: "order-scene-2",
          sceneTitle: "Closing",
        },
      ],
    },
  };
  const unorderedDraftScenes = buildSceneRecords(
    orderedWorkspace,
    {},
    {
      scenes: [
        {
          sceneId: "order-draft-scene",
          chapterId: "chapter-1",
          chapterTitle: "Arrival Vector",
          sceneTitle: "Inserted Draft",
          initialText: "",
        },
      ],
    },
  );
  assert.deepEqual(
    unorderedDraftScenes.map((scene) => scene.sceneId),
    ["order-scene-1", "order-scene-2", "order-draft-scene"],
  );

  const orderedDraftScenes = buildSceneRecords(
    orderedWorkspace,
    {},
    {
      sceneOrder: ["order-scene-1", "order-draft-scene", "order-scene-2"],
      scenes: [
        {
          sceneId: "order-draft-scene",
          chapterId: "chapter-1",
          chapterTitle: "Arrival Vector",
          sceneTitle: "Inserted Draft",
          initialText: "",
        },
      ],
    },
  );
  assert.deepEqual(
    orderedDraftScenes.map((scene) => scene.sceneId),
    ["order-scene-1", "order-draft-scene", "order-scene-2"],
  );

  const orderedStructureDrafts = {
    sceneOrder: ["order-scene-1", "order-draft-scene", "order-scene-2"],
    scenes: [
      {
        sceneId: "order-draft-scene",
        chapterId: "chapter-1",
        chapterTitle: "Arrival Vector",
        sceneTitle: "Inserted Draft",
        initialText: "",
      },
    ],
  };
  const insertedSceneDrafts = insertStructureSceneDraftAfterAnchor(
    orderedStructureDrafts,
    orderedDraftScenes,
    {
      sceneId: "order-draft-scene-2",
      chapterId: "chapter-1",
      chapterTitle: "Arrival Vector",
      sceneTitle: "Inserted After Active Scene",
      initialText: "",
    },
    "order-scene-1",
  );
  assert.deepEqual(
    insertedSceneDrafts.sceneOrder,
    ["order-scene-1", "order-draft-scene-2", "order-draft-scene", "order-scene-2"],
  );
  assert.deepEqual(
    buildSceneRecords(orderedWorkspace, {}, insertedSceneDrafts).map((scene) => scene.sceneId),
    ["order-scene-1", "order-draft-scene-2", "order-draft-scene", "order-scene-2"],
  );

  assert.equal(estimateWrappedLineCount("alpha beta gamma delta", 10), 3);
  assert.deepEqual(
    buildSceneLineMetrics(
      [
        { sceneId: "scene-a", editorText: "alpha beta" },
        { sceneId: "scene-b", editorText: "gamma" },
        { sceneId: "scene-c", editorText: "" },
      ],
      5,
    ),
    [
      {
        sceneId: "scene-a",
        startLineNumber: 1,
        endLineNumber: 2,
        lineCount: 2,
      },
      {
        sceneId: "scene-b",
        startLineNumber: 3,
        endLineNumber: 3,
        lineCount: 1,
      },
      {
        sceneId: "scene-c",
        startLineNumber: 4,
        endLineNumber: 4,
        lineCount: 1,
      },
    ],
  );

  const defaults = createDefaultEditorPrefs();
  assert.deepEqual(
    normalizeEditorPrefs({ fontFamilyId: "bad", fontSize: 99, lineHeight: 3.1, editorWidth: 999 }),
    defaults,
  );
  assert.deepEqual(
    normalizeEditorPrefs({ fontFamilyId: "draft-sans", fontSize: 22, lineHeight: 1.9, editorWidth: 840 }),
    {
      fontFamilyId: "draft-sans",
      fontSize: 22,
      lineHeight: 1.9,
      editorWidth: 840,
      projectFileAutosaveEnabled: true,
      grammarCheckEnabled: true,
      revisionOverlayEnabled: false,
      italicText: false,
    },
  );
  assert.deepEqual(normalizeLocalAiPrefs({}), createDefaultLocalAiPrefs());
  assert.deepEqual(normalizeLocalAiPrefs({ enabled: false }), { enabled: false });
  assert.deepEqual(normalizeSpellcheckProjectSettings({}), createDefaultSpellcheckProjectSettings());
  assert.deepEqual(
    normalizeSpellcheckProjectSettings({
      dictionaryWords: ["Khepri", "khepri", "Halcyon"],
      exceptions: ["Mara", "mara", "  "],
    }),
    {
      dictionaryWords: ["khepri", "halcyon"],
      exceptionWords: ["mara"],
    },
  );

  const task = createManuscriptTask(
    scenes[0],
    {
      description: "Ground the station reference",
      selectedText: "Halcyon Station",
      startOffset: 27,
      endOffset: 42,
    },
    "2026-04-24T01:00:00.000Z",
  );
  const normalizedTasks = normalizeManuscriptTasks([task, { id: "bad" }]);
  assert.equal(normalizedTasks.length, 1);
  assert.equal(normalizedTasks[0].status, "open");
  assert.equal(normalizedTasks[0].title, "Docking Rewrite task 1");
  assert.equal(normalizedTasks[0].body, "Ground the station reference");
  assert.equal(normalizedTasks[0].description, "Ground the station reference");
  assert.deepEqual(countRemainingTasksByChapter(normalizedTasks), { "chapter-1": 1 });
  assert.equal(getOpenTasksForScene(normalizedTasks, "scene-1")[0].selectedText, "Halcyon Station");
  assert.equal(
    normalizeManuscriptTasks([
      task,
      {
        ...task,
        id: "task-second",
        description: "Second task body",
        body: undefined,
        taskNumber: undefined,
        title: undefined,
      },
    ])[1].title,
    "Docking Rewrite task 2",
  );
  const renamedTasks = updateManuscriptTaskTitle(normalizedTasks, task.id, "Arrival checkpoint");
  assert.equal(renamedTasks[0].title, "Arrival checkpoint");
  assert.equal(normalizeManuscriptTasks(renamedTasks)[0].title, "Arrival checkpoint");
  const importedTask = normalizeManuscriptTasks([
    {
      ...task,
      id: "source-comment-task-1",
      source: "source-comment",
      sourceDocumentId: "DOC-1",
      sourceCommentId: "COMMENT-1",
      sourcePath: "Manuscript / Chapter 1",
      anchorMode: "location",
      anchorStatus: "active",
      nearbyBefore: "Before",
      nearbyAfter: "After",
      lineIndex: 2,
      paragraphIndex: 1,
    },
  ])[0];
  assert.equal(importedTask.source, "source-comment");
  assert.equal(importedTask.sourceDocumentId, "DOC-1");
  assert.equal(importedTask.anchorStatus, "active");

  const note = createPassageNote(
    scenes[0],
    {
      selectedText: "Halcyon Station",
      startOffset: 27,
      endOffset: 42,
    },
    "inspiration",
    "2026-04-24T02:00:00.000Z",
  );
  const normalizedNotes = normalizePassageNotes([note, { id: "bad" }]);
  assert.equal(normalizedNotes.length, 1);
  assert.equal(normalizedNotes[0].noteType, "inspiration");
  assert.equal(normalizedNotes[0].body, "");
  assert.equal(normalizedNotes[0].title, "Inspiration note");
  assert.equal(normalizedNotes[0].source, "manual");
  const updatedNotes = updatePassageNoteBody(
    normalizedNotes,
    note.id,
    "Convey wonder before the station becomes tactical.",
    "2026-04-24T02:01:00.000Z",
  );
  assert.equal(updatedNotes[0].body, "Convey wonder before the station becomes tactical.");
  assert.equal(updatedNotes[0].title, "Convey wonder before the station becomes tactical.");
  assert.equal(updatedNotes[0].updatedAt, "2026-04-24T02:01:00.000Z");
  const renamedNotes = updatePassageNoteTitle(updatedNotes, note.id, "Reader wonder");
  assert.equal(renamedNotes[0].title, "Reader wonder");
  assert.equal(normalizePassageNotes(renamedNotes)[0].title, "Reader wonder");
  const importedNote = normalizePassageNotes([
    {
      id: "source-note-1",
      noteType: "research",
      chapterId: "source-front-matter",
      chapterTitle: "Front Matter / Paperback",
      sceneId: "source-front-matter-scene",
      sceneTitle: "Copyright",
      selectedText: "Copyright",
      startOffset: 0,
      endOffset: 9,
      body: "Copyright page text",
      title: "Copyright",
      createdAt: "2026-04-24T02:03:00.000Z",
      source: "source-front-matter",
      sourceDocumentId: "FRONT-1",
      sourcePath: "WorldBuilding / Front Matter / Paperback / Copyright",
      attachmentConfidence: 0.2,
      assetIds: ["asset-1"],
    },
  ])[0];
  assert.equal(importedNote.source, "source-front-matter");
  assert.equal(importedNote.sourceDocumentId, "FRONT-1");
  assert.equal(importedNote.attachmentConfidence, 0.2);
  assert.deepEqual(importedNote.assetIds, ["asset-1"]);
  const inlineNote = createPassageNote(
    scenes[0],
    {
      selectedText: "",
      startOffset: 12,
      endOffset: 12,
      body: "What should the reader feel before the reveal?",
    },
    "inspiration",
    "2026-04-24T02:02:00.000Z",
  );
  assert.equal(inlineNote.title, "What should the reader feel before the...");
  assert.equal(inlineNote.selectedText, "");

  assert.deepEqual(
    resolveManuscriptTaskRange(
      {
        ...task,
        startOffset: 27,
        endOffset: 42,
      },
      "New opening line. The frigate crawled toward Halcyon Station in silence.",
    ),
    {
      startOffset: 45,
      endOffset: 60,
      matched: true,
    },
  );
  assert.deepEqual(
    resolveManuscriptTaskRange(
      {
        ...task,
        selectedText: "operator. “Copy Sky Dome,\nI have you loud and clear Haul Carrier X15-8901”",
        startOffset: 0,
        endOffset: 75,
      },
      "The radio cracked, then the operator said Copy Sky Dome, I have you loud and clear Haul Carrier X15-8901 over.",
    ),
    {
      startOffset: 42,
      endOffset: 104,
      matched: true,
    },
  );
  assert.deepEqual(
    resolveManuscriptTaskRange(
      {
        ...task,
        selectedText: "The original lead-in is gone but Copy Sky Dome I have you loud and clear still anchors the task.",
        startOffset: 0,
        endOffset: 91,
      },
      "The bridge feed repeated: Copy Sky Dome, I have you loud and clear.",
    ),
    {
      startOffset: 26,
      endOffset: 66,
      matched: true,
    },
  );
  assert.deepEqual(
    resolveManuscriptTaskRange(
      {
        ...task,
        selectedText: "missing phrase",
        startOffset: 999,
        endOffset: 1010,
      },
      "Short scene.",
    ),
    {
      startOffset: 12,
      endOffset: 12,
      matched: false,
    },
  );

  const completedTasks = completeManuscriptTask(
    normalizedTasks,
    task.id,
    "2026-04-24T01:01:00.000Z",
  );
  assert.equal(completedTasks[0].status, "completed");
  assert.deepEqual(countRemainingTasksByChapter(completedTasks), {});
}
