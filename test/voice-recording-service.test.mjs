// Intent: verify saved voice recording collection access and mutation stay outside app.js.
import assert from "node:assert/strict";

import {
  createVoiceRecordingSceneBlockRanges,
  createVoiceRecordingService,
  deleteVoiceRecordingRecord,
  ensureWorkspaceVoiceRecordings,
  getVoiceRecordingById,
  getVoiceRecordingsForProject,
  resolveVoiceRecordingSceneRange,
  upsertVoiceRecordingRecord,
} from "../apps/editor/public/features/voice/voice-recording-service.js";

export function runVoiceRecordingServiceTest() {
  const workspace = {};
  const recordings = ensureWorkspaceVoiceRecordings(workspace);
  assert.equal(Array.isArray(recordings), true);
  assert.equal(workspace.voice.provider.id, "local-voice-service");

  upsertVoiceRecordingRecord(workspace, {
    id: "take-1",
    projectId: "project-1",
    mediaPath: "project-media/project-1/take-1.webm",
  });
  upsertVoiceRecordingRecord(workspace, {
    id: "take-2",
    projectId: "project-2",
    mediaPath: "project-media/project-2/take-2.webm",
  });
  upsertVoiceRecordingRecord(workspace, {
    id: "take-1",
    projectId: "project-1",
    mediaPath: "project-media/project-1/take-1-updated.webm",
  });

  assert.equal(workspace.voice.recordings.length, 2);
  assert.equal(getVoiceRecordingsForProject(workspace, "project-1").length, 1);
  assert.equal(getVoiceRecordingById(workspace, "take-1", "project-1").mediaPath, "project-media/project-1/take-1-updated.webm");
  assert.equal(getVoiceRecordingById(workspace, "missing", "project-1"), null);

  const service = createVoiceRecordingService({
    getWorkspace: () => workspace,
    getProjectId: () => "project-1",
  });
  assert.equal(service.getForProject().length, 1);
  assert.equal(service.getById("take-1").id, "take-1");
  assert.equal(service.upsert({
    id: "take-3",
    projectId: "project-1",
  }).id, "take-3");
  assert.equal(workspace.voice.recordings[0].id, "take-3");
  assert.equal(deleteVoiceRecordingRecord(workspace, "take-2", "project-1"), null);
  assert.equal(service.deleteById("take-3").id, "take-3");
  assert.equal(service.getById("take-3"), null);
  assert.equal(workspace.voice.recordings.some((recording) => recording.id === "take-3"), false);

  const scene = {
    sceneId: "scene-1",
    blocks: [
      { blockId: "heading", text: "The date is SOL year 2026" },
      {
        blockId: "opening",
        text: "A bright splintering light etched its way into John's retina behind his closed eyelids.",
      },
      {
        blockId: "walkway",
        text: "Making his way toward the docking bay transport pods, John imagined himself walking through the rib cage of a giant winged whale.",
      },
    ],
  };
  scene.editorText = scene.blocks.map((block) => block.text).join("\n\n");
  const blockRanges = createVoiceRecordingSceneBlockRanges(scene);
  const headingEnd = scene.blocks[0].text.length;
  const openingStart = headingEnd + 2;
  const openingEnd = openingStart + scene.blocks[1].text.length;
  const walkwayStart = openingEnd + 2;
  assert.deepEqual(blockRanges.map((range) => [range.blockId, range.startOffset, range.endOffset]), [
    ["heading", 0, headingEnd],
    ["opening", openingStart, openingEnd],
    ["walkway", walkwayStart, walkwayStart + scene.blocks[2].text.length],
  ]);

  const recoveredLeadingWordRange = resolveVoiceRecordingSceneRange({
    id: "take-leading-word",
    sceneId: "scene-1",
    blockId: "walkway",
    startOffset: walkwayStart + "Making ".length,
    endOffset: walkwayStart + "Making his way toward the docking bay transport pods".length,
    verseText: "his way toward the docking bay transport pods",
    transcript: "making his way toward the docking bay transport pods John imagined himself",
  }, scene, { blockRanges });
  assert.equal(recoveredLeadingWordRange.startOffset, walkwayStart);
  assert.equal(
    scene.editorText.slice(recoveredLeadingWordRange.startOffset, recoveredLeadingWordRange.startOffset + "Making".length),
    "Making",
  );

  const staleStart = scene.editorText.indexOf("his closed");
  const recoveredTranscriptRange = resolveVoiceRecordingSceneRange({
    id: "take-stale-offset",
    sceneId: "scene-1",
    blockId: "opening",
    startOffset: staleStart,
    endOffset: staleStart + "his closed".length,
    verseText: "his closed",
    transcript: "bright splintering light etched its way into John's retina",
  }, scene, { blockRanges });
  assert.equal(recoveredTranscriptRange.startOffset, scene.editorText.indexOf("A bright"));
  assert.equal(
    scene.editorText.slice(recoveredTranscriptRange.startOffset, recoveredTranscriptRange.startOffset + "A bright".length),
    "A bright",
  );
}
