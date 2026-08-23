// Intent: keep live narration follow alignment on a bounded transcript tail instead of full ASR history.

export const DEFAULT_NARRATION_FOLLOW_TRANSCRIPT_WINDOW_WORDS = 48;
export const DEFAULT_NARRATION_FOLLOW_CHANGED_WINDOW_WORDS = 24;

function normalizePositiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeTranscriptText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function splitTranscriptWords(value) {
  const normalized = normalizeTranscriptText(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function createWordTail(words, maxWords) {
  return words.length > maxWords ? words.slice(words.length - maxWords) : words;
}

export function createNarrationFollowTranscriptWindow({
  transcript = "",
  changedTranscript = "",
  finalTranscript = "",
  interimTranscript = "",
  maxTranscriptWords = DEFAULT_NARRATION_FOLLOW_TRANSCRIPT_WINDOW_WORDS,
  maxChangedWords = DEFAULT_NARRATION_FOLLOW_CHANGED_WINDOW_WORDS,
} = {}) {
  const safeMaxTranscriptWords = normalizePositiveInteger(
    maxTranscriptWords,
    DEFAULT_NARRATION_FOLLOW_TRANSCRIPT_WINDOW_WORDS,
  );
  const safeMaxChangedWords = normalizePositiveInteger(
    maxChangedWords,
    DEFAULT_NARRATION_FOLLOW_CHANGED_WINDOW_WORDS,
  );

  // Intent: cap each live transcript field independently so runtime state cannot grow for a whole take.
  const transcriptWords = splitTranscriptWords(transcript);
  const changedWords = splitTranscriptWords(changedTranscript);
  const finalWords = splitTranscriptWords(finalTranscript);
  const interimWords = splitTranscriptWords(interimTranscript);
  const transcriptWindowWords = createWordTail(transcriptWords, safeMaxTranscriptWords);
  const changedWindowWords = createWordTail(changedWords, safeMaxChangedWords);
  const finalWindowWords = createWordTail(finalWords, safeMaxTranscriptWords);
  const interimWindowWords = createWordTail(interimWords, safeMaxChangedWords);

  return {
    transcript: transcriptWindowWords.join(" "),
    changedTranscript: changedWindowWords.join(" "),
    finalTranscript: finalWindowWords.join(" "),
    interimTranscript: interimWindowWords.join(" "),
    sourceTranscriptWordCount: transcriptWords.length,
    sourceChangedTranscriptWordCount: changedWords.length,
    sourceFinalTranscriptWordCount: finalWords.length,
    sourceInterimTranscriptWordCount: interimWords.length,
    transcriptWindowWordCount: transcriptWindowWords.length,
    changedTranscriptWindowWordCount: changedWindowWords.length,
    finalTranscriptWindowWordCount: finalWindowWords.length,
    interimTranscriptWindowWordCount: interimWindowWords.length,
    maxTranscriptWords: safeMaxTranscriptWords,
    maxChangedWords: safeMaxChangedWords,
    isTranscriptWindowed: transcriptWindowWords.length < transcriptWords.length,
    isChangedTranscriptWindowed: changedWindowWords.length < changedWords.length,
    isFinalTranscriptWindowed: finalWindowWords.length < finalWords.length,
    isInterimTranscriptWindowed: interimWindowWords.length < interimWords.length,
  };
}

export function applyNarrationFollowTranscriptWindowToSnapshot(snapshot, options = {}) {
  const window = createNarrationFollowTranscriptWindow({
    transcript: snapshot?.transcript,
    changedTranscript: snapshot?.changedTranscript,
    finalTranscript: snapshot?.finalTranscript,
    interimTranscript: snapshot?.interimTranscript,
    ...options,
  });

  // Intent: preserve snapshot metadata while replacing unbounded live text fields with follow-sized windows.
  return {
    ...snapshot,
    transcript: window.transcript,
    changedTranscript: window.changedTranscript,
    finalTranscript: window.finalTranscript,
    interimTranscript: window.interimTranscript,
    transcriptWindow: {
      sourceTranscriptWordCount: window.sourceTranscriptWordCount,
      sourceChangedTranscriptWordCount: window.sourceChangedTranscriptWordCount,
      sourceFinalTranscriptWordCount: window.sourceFinalTranscriptWordCount,
      sourceInterimTranscriptWordCount: window.sourceInterimTranscriptWordCount,
      transcriptWindowWordCount: window.transcriptWindowWordCount,
      changedTranscriptWindowWordCount: window.changedTranscriptWindowWordCount,
      finalTranscriptWindowWordCount: window.finalTranscriptWindowWordCount,
      interimTranscriptWindowWordCount: window.interimTranscriptWindowWordCount,
      maxTranscriptWords: window.maxTranscriptWords,
      maxChangedWords: window.maxChangedWords,
      isTranscriptWindowed: window.isTranscriptWindowed,
      isChangedTranscriptWindowed: window.isChangedTranscriptWindowed,
      isFinalTranscriptWindowed: window.isFinalTranscriptWindowed,
      isInterimTranscriptWindowed: window.isInterimTranscriptWindowed,
    },
  };
}
