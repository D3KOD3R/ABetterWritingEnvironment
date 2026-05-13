// Intent: verify voice narration profiles, queues, storage, and placeholder rendering stay deterministic.
import assert from "node:assert/strict";

import {
  addBlock,
  addChapter,
  addScene,
  createManuscriptAnchor,
  createProject,
} from "../packages/manuscript-schema/src/index.ts";
import {
  createNarrationJob,
  createVoiceProfile,
  createVoiceQueue,
  loadNarrationJobs,
  loadVoiceProfiles,
  loadVoiceNarrationSnapshot,
  renderPlaceholderNarration,
  saveNarrationJobs,
  saveVoiceProfiles,
  saveVoiceNarrationSnapshot,
  VOICE_NARRATION_STORAGE_KEY,
} from "../services/voice/src/index.ts";

export function runVoiceNarrationFoundationTest() {
  const now = "2026-04-21T08:00:00.000Z";
  const profile = createVoiceProfile({
    id: "voice-profile-lantern",
    displayName: "Lantern Narrator",
    engineType: "local-placeholder",
    voiceStyleLabel: "Measured documentary warmth",
    description: "Foundation narrator profile.",
    settings: {
      pace: 0.95,
    },
    now,
  });

  assert.equal(profile.language, "und");
  assert.equal(profile.accent, "neutral");
  assert.equal(profile.createdAt, now);
  assert.equal(profile.updatedAt, now);
  assert.equal(profile.settings.pace, 0.95);

  assert.throws(
    () => createVoiceProfile({
      id: "",
      displayName: "Broken",
      engineType: "local-placeholder",
    }),
    /cannot be empty/i,
  );

  assert.throws(
    () => createVoiceProfile({
      id: "voice-profile-broken",
      displayName: "Broken",
      engineType: "not-supported",
    }),
    /supported placeholder engines/i,
  );

  let project = createProject({
    title: "Voice Fixture",
    now,
  });
  const chapter = addChapter(project, { title: "Chapter 1" }, "2026-04-21T08:01:00.000Z");
  project = chapter.project;
  const scene = addScene(project, chapter.chapter.id, { title: "Opening Scene" }, "2026-04-21T08:02:00.000Z");
  project = scene.project;
  const block = addBlock(
    project,
    scene.scene.id,
    { kind: "narration", text: "The corridor lights sank to a low amber hush." },
    "2026-04-21T08:03:00.000Z",
  );
  project = block.project;

  const anchor = createManuscriptAnchor(project, { blockId: block.block.id });
  const job = createNarrationJob({
    id: "voice-job-0001",
    projectId: project.id,
    manuscriptRef: anchor,
    chapterId: chapter.chapter.id,
    sceneId: scene.scene.id,
    blockRange: {
      startBlockId: block.block.id,
      endBlockId: block.block.id,
    },
    sourceTextSnapshot: block.block.text,
    voiceProfileId: profile.id,
    now: "2026-04-21T08:04:00.000Z",
  });

  assert.equal(job.status, "draft");
  assert.equal(job.progress, 0);
  assert.equal(job.manuscriptRef.blockId, block.block.id);
  assert.equal(job.sourceTextSnapshot, block.block.text);

  const queue = createVoiceQueue([job]);
  const queued = queue.queueJob(job.id, "2026-04-21T08:05:00.000Z");
  assert.equal(queued.status, "queued");
  assert.equal(queue.getJob(job.id)?.status, "queued");

  const rendering = queue.markJobRendering(job.id, "2026-04-21T08:05:10.000Z");
  assert.equal(rendering.status, "rendering");
  assert.equal(rendering.progress, 0.55);

  const rendered = queue.markJobRendered(
    job.id,
    `voice-output://placeholder/${job.id}`,
    "2026-04-21T08:05:20.000Z",
  );
  assert.equal(rendered.status, "rendered");
  assert.equal(rendered.outputAudioRef, `voice-output://placeholder/${job.id}`);
  assert.equal(queue.filterJobsByStatus("rendered")[0].id, job.id);

  const failingJob = createNarrationJob({
    id: "voice-job-0002",
    projectId: project.id,
    manuscriptRef: anchor,
    chapterId: chapter.chapter.id,
    sceneId: scene.scene.id,
    sourceTextSnapshot: block.block.text,
    voiceProfileId: profile.id,
    now: "2026-04-21T08:06:00.000Z",
  });
  const failingQueue = createVoiceQueue([failingJob]);
  failingQueue.queueJob(failingJob.id, "2026-04-21T08:06:10.000Z");
  failingQueue.markJobRendering(failingJob.id, "2026-04-21T08:06:20.000Z");
  const failed = failingQueue.markJobFailed(failingJob.id, "No audio buffer available", "2026-04-21T08:06:30.000Z");
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "No audio buffer available");

  const cancelledJob = createNarrationJob({
    id: "voice-job-0003",
    projectId: project.id,
    manuscriptRef: anchor,
    chapterId: chapter.chapter.id,
    sceneId: scene.scene.id,
    sourceTextSnapshot: block.block.text,
    voiceProfileId: profile.id,
    now: "2026-04-21T08:07:00.000Z",
  });
  const cancelledQueue = createVoiceQueue([cancelledJob]);
  const cancelled = cancelledQueue.cancelJob(cancelledJob.id, "2026-04-21T08:07:10.000Z");
  assert.equal(cancelled.status, "cancelled");
  assert.throws(
    () => cancelledQueue.queueJob(cancelledJob.id, "2026-04-21T08:07:20.000Z"),
    /cannot queue a narration job with status 'cancelled'/i,
  );

  const placeholderJob = createNarrationJob({
    id: "voice-job-0004",
    projectId: project.id,
    manuscriptRef: anchor,
    chapterId: chapter.chapter.id,
    sceneId: scene.scene.id,
    sourceTextSnapshot: block.block.text,
    voiceProfileId: profile.id,
    now: "2026-04-21T08:08:00.000Z",
  });
  const placeholderQueue = createVoiceQueue([placeholderJob]);
  const placeholderRendered = renderPlaceholderNarration(
    placeholderQueue.queueJob(placeholderJob.id, "2026-04-21T08:08:10.000Z"),
    "2026-04-21T08:08:20.000Z",
  );
  assert.equal(placeholderRendered.status, "rendered");
  assert.equal(placeholderRendered.outputAudioRef, `voice-output://placeholder/${placeholderJob.id}`);

  const storage = createMemoryStorage({
    preserved: "keep-me",
  });
  saveVoiceProfiles(storage, [profile], "2026-04-21T08:09:00.000Z");
  saveNarrationJobs(storage, [rendered], "2026-04-21T08:09:10.000Z");
  saveVoiceNarrationSnapshot(storage, {
    version: 1,
    voiceProfiles: [profile],
    narrationJobs: [rendered],
    selectedVoiceProfileId: profile.id,
    updatedAt: "2026-04-21T08:09:20.000Z",
  });

  assert.equal(storage.getItem("preserved"), "keep-me");
  assert.equal(storage.getItem(VOICE_NARRATION_STORAGE_KEY) !== null, true);
  assert.equal(loadVoiceProfiles(storage)[0].id, profile.id);
  assert.equal(loadNarrationJobs(storage)[0].outputAudioRef, `voice-output://placeholder/${job.id}`);
  assert.equal(loadVoiceNarrationSnapshot(storage).selectedVoiceProfileId, profile.id);
}

function createMemoryStorage(initialEntries = {}) {
  const entries = new Map(Object.entries(initialEntries));

  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
  };
}
