// Intent: verify saved voice recording collection access and mutation stay outside app.js.
import assert from "node:assert/strict";

import {
  createVoiceRecordingService,
  ensureWorkspaceVoiceRecordings,
  getVoiceRecordingById,
  getVoiceRecordingsForProject,
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
}
