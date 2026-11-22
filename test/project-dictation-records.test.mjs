import assert from "node:assert/strict";
import { normalizeSpeechState } from "../apps/editor/public/shared/speech-records.js";
import { buildPortableProjectSnapshot } from "../apps/editor/public/adapters/storage/project-portable-snapshot.js";
import { migrateProjectData } from "../apps/editor/public/adapters/storage/project-migrations.js";

export async function runProjectDictationRecordsTest() {
  const record = { schemaVersion: 1, id: "session", projectId: "project", sceneId: "scene", captureEpoch: "epoch", sampleRate: 16000, sampleCount: 16000, modelId: "model", modelRevision: "revision", runtimeVersion: "runtime", events: [], recording: { projectRelativePath: "assets/audio/dictation-session.flac", encoding: "flac", bytes: 1024, sha256: "a".repeat(64), startSample: 0, endSample: 16000 } };
  const speech = { schemaVersion: 1, sessions: [record] };
  const snapshot = { schemaVersion: 3, activeProjectId: "project", projects: [{ id: "project", schemaVersion: 3, workspace: { project: { id: "project" }, speech } }], sceneStore: {} };
  const portable = buildPortableProjectSnapshot(snapshot);
  assert.deepEqual(portable.projects[0].workspace.speech, speech);
  assert.deepEqual(migrateProjectData(JSON.parse(JSON.stringify(portable))).projects[0].workspace.speech, speech);
  assert.throws(() => migrateProjectData(portable, { targetSchemaVersion: 2 }), /newer/);
  record.modelRoot = "C:/private-models";
  assert.equal(normalizeSpeechState(speech).sessions[0].modelRoot, undefined);
  record.recording.projectRelativePath = "assets/audio/../../outside.flac";
  assert.throws(() => normalizeSpeechState(speech), /relative/);
  assert.throws(() => normalizeSpeechState({ schemaVersion: 2, sessions: [] }), /schema/);
}
