import type { SpeechRecognitionEvent } from "../../../packages/shared-types/src/speech-events.ts";

export function createDictationJournal(identity: { sessionId: string; captureEpoch: string; projectId: string; sceneId: string }) {
  const utterances = new Map<string, SpeechRecognitionEvent>();
  let closed = false;
  return {
    accept(event: SpeechRecognitionEvent) {
      if (closed || Object.entries(identity).some(([key, value]) => event[key as keyof SpeechRecognitionEvent] !== value)) return false;
      if (!event.utteranceId || !Number.isSafeInteger(event.revision) || event.revision < 1
        || !Number.isSafeInteger(event.startSample) || !Number.isSafeInteger(event.endSample)
        || event.startSample < 0 || event.endSample < event.startSample || typeof event.text !== "string"
        || !["partial", "final", "cancelled"].includes(event.status)) throw new Error("Invalid speech event.");
      const previous = utterances.get(event.utteranceId);
      // A newer revision does not grant permission to replace already-finalized author-visible text.
      if (previous && (previous.status !== "partial" || event.revision <= previous.revision)) return false;
      utterances.set(event.utteranceId, structuredClone(event));
      return true;
    },
    snapshot() { return [...utterances.values()].sort((a, b) => a.startSample - b.startSample).map((event) => structuredClone(event)); },
    close() { closed = true; },
  };
}
