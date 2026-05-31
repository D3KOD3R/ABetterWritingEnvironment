// Intent: own saved voice/narration recording collection access and mutation outside app.js.

export function ensureWorkspaceVoiceRecordings(workspace) {
  if (!workspace || typeof workspace !== "object") {
    return [];
  }

  if (!workspace.voice || typeof workspace.voice !== "object") {
    workspace.voice = {
      provider: {
        id: "local-voice-service",
        label: "Local Voice",
        availability: "ready",
        synthesisMode: "local",
      },
      profiles: [],
      bindings: [],
      renderJobs: [],
      recordings: [],
    };
  }

  if (!Array.isArray(workspace.voice.recordings)) {
    workspace.voice.recordings = [];
  }

  return workspace.voice.recordings;
}

export function getVoiceRecordingsForProject(workspace, projectId = "") {
  const recordings = Array.isArray(workspace?.voice?.recordings)
    ? workspace.voice.recordings
    : [];
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  if (!normalizedProjectId) {
    return recordings;
  }

  return recordings.filter((recording) => recording.projectId === normalizedProjectId);
}

export function getVoiceRecordingById(workspace, recordingId, projectId = "") {
  if (typeof recordingId !== "string" || !recordingId.trim()) {
    return null;
  }

  return getVoiceRecordingsForProject(workspace, projectId)
    .find((recording) => recording.id === recordingId) ?? null;
}

export function upsertVoiceRecordingRecord(workspace, record) {
  if (!record || !workspace) {
    return null;
  }

  const recordings = ensureWorkspaceVoiceRecordings(workspace);
  const existingIndex = recordings.findIndex((candidate) => candidate.id === record.id);
  if (existingIndex >= 0) {
    recordings.splice(existingIndex, 1, record);
  } else {
    recordings.unshift(record);
  }
  workspace.voice.recordings = recordings;
  return record;
}

export function createVoiceRecordingService({
  getWorkspace = () => null,
  getProjectId = () => "",
} = {}) {
  return {
    getForProject(projectId = getProjectId()) {
      return getVoiceRecordingsForProject(getWorkspace(), projectId);
    },
    getById(recordingId, projectId = getProjectId()) {
      return getVoiceRecordingById(getWorkspace(), recordingId, projectId);
    },
    upsert(record) {
      return upsertVoiceRecordingRecord(getWorkspace(), record);
    },
    ensure() {
      return ensureWorkspaceVoiceRecordings(getWorkspace());
    },
  };
}
