// Timing is sample-addressed; milliseconds are a display projection, not file correspondence.
export interface SpeechSourceRange { startSample: number; endSample: number; }
export interface SpeechCaptureFrame extends SpeechSourceRange {
  sessionId: string;
  captureEpoch: string;
  sequence: number;
  sourceSampleRate: number;
  sourceStartSample: number;
  sourceEndSample: number;
  sampleRate: 16000;
  pcm16Base64: string;
}
export interface SpeechRecognitionEvent extends SpeechSourceRange {
  sessionId: string;
  projectId: string;
  sceneId: string;
  captureEpoch: string;
  utteranceId: string;
  revision: number;
  status: "partial" | "final" | "cancelled";
  text: string;
  timestampSource: "engine" | "vad" | "capture";
  timestampGranularity: "utterance" | "segment" | "word";
  words?: Array<SpeechSourceRange & { text: string; timestampSource: "engine" }>;
  modelId: string;
  modelRevision: string;
  runtimeVersion: string;
}
export interface DictationSessionRecord {
  schemaVersion: 1;
  id: string;
  projectId: string;
  sceneId: string;
  captureEpoch: string;
  startedAt: string;
  endedAt: string;
  status: "stopped" | "failed";
  retention: "manual-deletion" | "awaiting-durable-text";
  sampleRate: 16000;
  sampleCount: number;
  modelId: string;
  modelRevision: string;
  runtimeVersion: string;
  events: SpeechRecognitionEvent[];
  recording?: { projectRelativePath: string; encoding: "flac"; bytes: number; sha256: string; startSample: number; endSample: number };
}
