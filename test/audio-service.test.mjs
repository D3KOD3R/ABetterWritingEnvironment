import assert from "node:assert/strict";

import {
  addBlock,
  addChapter,
  addScene,
  createManuscriptAnchor,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import { createInMemoryAudioService } from "../services/audio/src/index.ts";

export function runAudioServiceTest() {
  let project = createProject({
    title: "Narration Fixture",
    now: "2026-04-21T07:20:00.000Z",
  });

  const chapter = addChapter(project, { title: "One" }, "2026-04-21T07:21:00.000Z");
  project = chapter.project;
  const scene = addScene(project, chapter.chapter.id, { title: "Readthrough" }, "2026-04-21T07:22:00.000Z");
  project = scene.project;
  const block = addBlock(
    project,
    scene.scene.id,
    {
      kind: "narration",
      text: "The narrator tracked the sentence without losing the line.",
    },
    "2026-04-21T07:23:00.000Z",
  );
  project = block.project;

  const anchor = createManuscriptAnchor(project, {
    blockId: block.block.id,
    startOffset: 0,
    endOffset: 12,
  });

  const audio = createInMemoryAudioService();
  const session = audio.startNarrationSession({
    project,
    sessionLabel: "Test Session",
    anchor,
    currentLineNumber: 1,
    currentText: block.block.text,
    now: "2026-04-21T07:24:00.000Z",
  });

  const alignment = audio.alignNarration({
    session,
    projectId: project.id,
    anchor,
    transcript: "The narrator tracked",
    resolvedText: block.block.text,
    matchedLineNumber: 1,
    confidence: 0.95,
    now: "2026-04-21T07:25:00.000Z",
  });

  assert.equal(session.status, "tracking");
  assert.equal(alignment.job.status, "completed");
  assert.equal(alignment.job.result?.matchedLineNumber, 1);
  assert.equal(alignment.session.currentText, block.block.text);
}
