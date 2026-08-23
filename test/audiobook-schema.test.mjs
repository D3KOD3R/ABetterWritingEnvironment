// Intent: verify the audiobook recording model can migrate legacy takes without changing live narration follow code.
import assert from "node:assert/strict";

import {
  DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS,
  DEFAULT_AUDIOBOOK_RECORDING_FORMAT,
  buildProjectOwnedRecordingPath,
  createDerivedRecordingClip,
  createTimelineItemsFromSelectedTakes,
  migrateLegacyNarrationRecordingsToAudiobookModel,
} from "../packages/audiobook-schema/src/index.ts";

export function runAudiobookSchemaTest() {
  assert.deepEqual(DEFAULT_AUDIOBOOK_RECORDING_FORMAT, {
    container: "wav",
    codec: "pcm-s24le",
    sampleRate: 48000,
    bitDepth: 24,
    channelCount: 1,
    mimeType: "audio/wav",
  });
  assert.equal(DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS.defaultScope, "scene");
  assert.equal(DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS.rollingPreloadItemCount, 3);
  assert.equal(DEFAULT_AUDIOBOOK_PLAYBACK_SETTINGS.continueAcrossScenes, false);

  const model = migrateLegacyNarrationRecordingsToAudiobookModel({
    projectId: "project-1",
    title: "Serva Vitae",
    author: "A. Writer",
    narrator: "Narrator One",
    now: "2026-07-29T01:00:00.000Z",
    recordings: [
      {
        id: "take-002",
        projectId: "project-1",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneId: "scene-1",
        blockId: "block-1",
        paragraphId: "paragraph-1",
        startOffset: 0,
        endOffset: 40,
        verseText: "The ship crossed the morning line.",
        mediaPath: "project-media/project-1/take-002.webm",
        mediaName: "take-002.webm",
        mediaMimeType: "audio/webm;codecs=opus",
        durationMs: 11200,
        status: "saved",
        createdAt: "2026-07-29T01:03:00.000Z",
        updatedAt: "2026-07-29T01:04:00.000Z",
      },
      {
        id: "take-001",
        projectId: "project-1",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneId: "scene-1",
        blockId: "block-1",
        paragraphId: "paragraph-1",
        startOffset: 0,
        endOffset: 40,
        verseText: "The ship crossed the morning line.",
        mediaPath: "project-media/project-1/take-001.webm",
        mediaName: "take-001.webm",
        mediaMimeType: "audio/webm;codecs=opus",
        durationMs: 10400,
        status: "saved",
        createdAt: "2026-07-29T01:01:00.000Z",
        updatedAt: "2026-07-29T01:02:00.000Z",
      },
      {
        id: "take-003",
        projectId: "project-1",
        chapterId: "chapter-1",
        chapterTitle: "Chapter One",
        sceneId: "scene-1",
        blockId: "block-2",
        paragraphId: "paragraph-2",
        startOffset: 0,
        endOffset: 35,
        verseText: "Keep the lantern under your coat.",
        mediaPath: "project-media/project-1/take-003.webm",
        mediaName: "take-003.webm",
        mediaMimeType: "audio/webm;codecs=opus",
        durationMs: 9300,
        status: "failed",
        createdAt: "2026-07-29T01:05:00.000Z",
        updatedAt: "2026-07-29T01:05:30.000Z",
      },
    ],
  });

  assert.equal(model.schemaVersion, "audiobook-recording-v1");
  assert.equal(model.book.defaultExportProfileId, "editing-master-wav");
  assert.equal(model.chapters.length, 1);
  assert.equal(model.sections.length, 2);
  assert.equal(model.clips.length, 3);
  assert.equal(model.sections[0].sectionType, "user-defined");
  assert.match(model.sections[0].sourceTextFingerprint, /^fnv1a32:/);
  assert.equal(model.sections[0].sourceAnchor?.blockId, "block-1");
  assert.equal(model.clips[0].id, "take-001");
  assert.equal(model.clips[0].takeNumber, 1);
  assert.equal(model.clips[1].id, "take-002");
  assert.equal(model.clips[1].takeNumber, 2);
  assert.equal(model.clips[1].format.container, "webm");
  assert.equal(model.clips[1].format.codec, "opus");

  const firstSectionState = model.sectionTakeStates.find(
    (state) => state.sectionId === model.sections[0].id,
  );
  assert.equal(firstSectionState?.takeCount, 2);
  assert.equal(firstSectionState?.latestClipId, "take-002");
  assert.equal(firstSectionState?.selectedClipId, "take-002");
  assert.equal(firstSectionState?.approvalStatus, "needs-review");

  const failedSectionState = model.sectionTakeStates.find(
    (state) => state.sectionId === model.sections[1].id,
  );
  assert.equal(failedSectionState?.selectedClipId, undefined);
  assert.equal(failedSectionState?.approvalStatus, "needs-rerecording");
  assert.equal(model.timelineItems.length, 1);
  assert.equal(model.timelineItems[0].clipId, "take-002");
  assert.equal(model.timelineItems[0].pauseAfterMs, 500);

  const convertedClip = createDerivedRecordingClip({
    id: "character-one-line-001",
    sectionId: model.sections[0].id,
    sourceClipId: "take-002",
    productionKind: "voice-conversion",
    productionLane: "character-conversion",
    characterId: "character-one",
    voiceProfileId: "voice-character-one",
    filePath: "renders/character-one-line-001.wav",
  });
  assert.equal(convertedClip.productionRef.sourceClipId, "take-002");
  assert.equal(convertedClip.productionRef.characterId, "character-one");
  assert.equal(convertedClip.productionLane, "character-conversion");

  const characterTimeline = createTimelineItemsFromSelectedTakes({
    sections: model.sections,
    clips: [...model.clips, convertedClip],
    sectionTakeStates: [
      {
        sectionId: model.sections[0].id,
        takeCount: 1,
        latestClipId: convertedClip.id,
        selectedClipId: convertedClip.id,
        approvalStatus: "needs-review",
        updatedAt: "2026-07-29T01:07:00.000Z",
      },
    ],
    productionLane: "character-conversion",
  });
  assert.equal(characterTimeline.length, 1);
  assert.equal(characterTimeline[0].clipId, "character-one-line-001");

  assert.equal(
    buildProjectOwnedRecordingPath({
      chapterId: "Chapter 01",
      sectionId: "Scene 1 / Line 2",
      clipId: "Take 003",
    }),
    "recordings/chapter-01/scene-1-line-2/take-003.wav",
  );
}
