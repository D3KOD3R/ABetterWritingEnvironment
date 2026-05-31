// Intent: verify editor voice workflow profiles, jobs, and storage are outside app.js.
import assert from "node:assert/strict";

import {
  createVoiceNarrationJobRecord,
  createVoiceWorkflowService,
  normalizeVoiceNarrationJobs,
  queueVoiceNarrationJobRecord,
  renderPlaceholderVoiceNarrationJobRecord,
  startVoiceNarrationJobRenderingRecord,
} from "../apps/editor/public/features/voice/voice-workflow-service.js";

export function runVoiceWorkflowServiceTest() {
  const now = "2026-05-31T01:00:00.000Z";
  const job = createVoiceNarrationJobRecord({
    projectId: "project-1",
    sourceLine: {
      chapterId: "chapter-1",
      sceneId: "scene-1",
      blockId: "block-1",
      paragraphId: "paragraph-1",
      text: "The archive door opened.",
    },
    sourceScene: {
      editorText: "The archive door opened.",
      blocks: [
        { blockId: "block-1" },
      ],
    },
    voiceProfile: {
      id: "voice-profile-lantern",
    },
  }, {
    now,
    createId: () => "voice-job-1",
  });

  assert.equal(job.id, "voice-job-1");
  assert.equal(job.status, "draft");
  assert.equal(job.manuscriptRef.blockId, "block-1");
  assert.equal(job.blockRange.startBlockId, "block-1");

  const queued = queueVoiceNarrationJobRecord(job, "2026-05-31T01:01:00.000Z");
  assert.equal(queued.status, "queued");
  assert.equal(queued.progress, 0.15);

  const rendering = startVoiceNarrationJobRenderingRecord(queued, "2026-05-31T01:02:00.000Z");
  assert.equal(rendering.status, "rendering");
  assert.equal(rendering.progress, 0.55);

  const rendered = renderPlaceholderVoiceNarrationJobRecord(rendering, "2026-05-31T01:03:00.000Z");
  assert.equal(rendered.status, "rendered");
  assert.equal(rendered.outputAudioRef, "voice-output://placeholder/voice-job-1");

  assert.deepEqual(normalizeVoiceNarrationJobs([{
    ...rendered,
    progress: 2,
  }])[0].progress, 1);

  const preferences = new Map();
  const projectService = {
    loadUserPreference: (key, fallback) => preferences.has(key) ? preferences.get(key) : fallback,
    saveUserPreference: (key, value) => {
      preferences.set(key, value);
    },
  };
  const service = createVoiceWorkflowService({ projectService });
  const initialState = service.loadState();
  assert.equal(initialState.voiceProfiles.length, 4);
  assert.equal(initialState.selectedVoiceProfileId, "voice-profile-lantern");

  service.saveState({
    voiceProfiles: initialState.voiceProfiles,
    narrationJobs: [rendered],
    selectedVoiceProfileId: "voice-profile-lantern",
  });
  const reloadedState = service.loadState();
  assert.equal(reloadedState.narrationJobs[0].id, "voice-job-1");
  assert.equal(reloadedState.narrationJobs[0].status, "rendered");
}
