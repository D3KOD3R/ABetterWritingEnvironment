// Only completed transcript records are portable. Microphones, model paths and partial hypotheses are runtime state.
export function normalizeSpeechState(value) {
  if (value == null) return undefined;
  if (value.schemaVersion !== 1 || !Array.isArray(value.sessions)) throw new Error("Unsupported speech data schema.");
  return { schemaVersion: 1, sessions: value.sessions.map(normalizeDictationRecord) };
}

export function normalizeDictationRecord(record) {
  const fields = ["schemaVersion", "id", "projectId", "sceneId", "captureEpoch", "startedAt", "endedAt", "status", "retention", "sampleRate", "sampleCount", "sourceSampleRate", "sourceSampleCount", "resampling", "modelId", "modelRevision", "runtimeVersion"];
  const result = Object.fromEntries(fields.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
  if (record.schemaVersion !== 1 || !record.id || !record.projectId || !record.sceneId || record.sampleRate !== 16000
    || !Number.isSafeInteger(record.sampleCount) || record.sampleCount < 0 || !Array.isArray(record.events)) throw new Error("Invalid completed dictation session.");
  const eventFields = ["sessionId", "projectId", "sceneId", "captureEpoch", "utteranceId", "revision", "status", "text", "startSample", "endSample", "timestampSource", "timestampGranularity", "modelId", "modelRevision", "runtimeVersion"];
  const ids = new Set();
  result.events = record.events.filter((event) => event.status === "final").map((event) => {
    if (event.sessionId !== record.id || event.projectId !== record.projectId || event.sceneId !== record.sceneId || ids.has(event.utteranceId)
      || !Number.isSafeInteger(event.startSample) || !Number.isSafeInteger(event.endSample) || event.startSample < 0 || event.endSample < event.startSample
      || event.endSample > record.sampleCount || typeof event.text !== "string") throw new Error("Invalid finalized speech correspondence.");
    ids.add(event.utteranceId);
    return Object.fromEntries(eventFields.map((key) => [key, event[key]]));
  });
  if (record.recording) {
    const r = record.recording;
    if (!/^assets\/audio\/dictation-[a-zA-Z0-9-]+\.flac$/.test(r.projectRelativePath) || r.encoding !== "flac"
      || !Number.isSafeInteger(r.bytes) || r.bytes < 4 || !/^[a-f0-9]{64}$/.test(r.sha256)
      || r.startSample !== 0 || r.endSample !== record.sampleCount) throw new Error("Invalid project-relative dictation recording.");
    result.recording = Object.fromEntries(["projectRelativePath", "encoding", "bytes", "sha256", "startSample", "endSample"].map((key) => [key, r[key]]));
  }
  return result;
}
