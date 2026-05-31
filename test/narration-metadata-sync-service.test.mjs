// Intent: verify narration and voice metadata sync stays outside app.js.
import assert from "node:assert/strict";

import {
  syncNarrationAlignmentJobsMetadata,
  syncNarrationSessionMetadata,
  syncVoiceRecordingsMetadata,
  syncVoiceRenderJobsMetadata,
} from "../apps/editor/public/features/narration/narration-metadata-sync-service.js";

export function runNarrationMetadataSyncServiceTest() {
  const lineByBlockId = new Map([
    ["block-1", {
      chapterId: "chapter-new",
      chapterTitle: "Chapter New",
      sceneId: "scene-new",
      sceneTitle: "Scene New",
      lineNumber: 12,
      text: "Moved line.",
    }],
  ]);

  const session = syncNarrationSessionMetadata({
    currentAnchor: {
      chapterId: "chapter-old",
      sceneId: "scene-old",
      blockId: "block-1",
    },
    currentLineNumber: 2,
    currentText: "Old line.",
  }, lineByBlockId, {
    now: "2026-05-31T00:00:00.000Z",
  });
  assert.equal(session.currentAnchor.chapterId, "chapter-new");
  assert.equal(session.currentAnchor.sceneId, "scene-new");
  assert.equal(session.currentLineNumber, 12);
  assert.equal(session.currentText, "Moved line.");
  assert.equal(session.updatedAt, "2026-05-31T00:00:00.000Z");

  const jobs = syncNarrationAlignmentJobsMetadata([{
    id: "job-1",
    request: {
      anchor: {
        blockId: "block-1",
        chapterId: "chapter-old",
        sceneId: "scene-old",
      },
    },
    result: {},
  }], lineByBlockId);
  assert.equal(jobs[0].request.anchor.chapterId, "chapter-new");
  assert.equal(jobs[0].result.matchedLineNumber, 12);

  const recordings = syncVoiceRecordingsMetadata([{
    id: "take-1",
    blockId: "block-1",
    sceneId: "scene-old",
  }], lineByBlockId);
  assert.equal(recordings[0].sceneId, "scene-new");
  assert.equal(recordings[0].sceneTitle, "Scene New");
  assert.equal(recordings[0].lineNumber, 12);

  const renderJobs = syncVoiceRenderJobsMetadata([{
    id: "voice-job-1",
    request: {
      sceneId: "scene-new",
      chapterId: "chapter-old",
    },
  }], new Map([
    ["scene-new", { chapterId: "chapter-new" }],
  ]));
  assert.equal(renderJobs[0].request.chapterId, "chapter-new");
}
