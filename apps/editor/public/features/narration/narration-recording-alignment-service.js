// Intent: derive saved-take transcript word timings from the actual recorded audio without coupling review UI to an ASR provider.

export const NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION = 4;
export const NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID = "browser-audio-energy-v3";
export const NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID = "whisper-cpp-word-timestamps-v1";

const DEFAULT_FRAME_SECONDS = 0.025;
const DEFAULT_MERGE_GAP_SECONDS = 0.18;
const DEFAULT_MIN_SPEECH_SECONDS = 0.08;
const MIN_WORD_DURATION_SECONDS = 0.04;
const WORD_TIMESTAMP_ALIGNMENT_MIN_MATCH_RATIO = 0.35;

// Intent: provide the browser shell with a small orchestration service around the pure alignment helpers.
export function createNarrationRecordingTranscriptAlignmentService({
  audioContextFactory = createDefaultAudioContext,
  wordTimingProvider = null,
  now = () => new Date().toISOString(),
  reportLog = () => {},
} = {}) {
  return {
    async alignRecording(recording, blob, options = {}) {
      try {
        return await createNarrationRecordingTranscriptAudioAlignment(recording, blob, {
          audioContextFactory,
          wordTimingProvider,
          now,
          ...options,
        });
      } catch (error) {
        reportLog("warn", "voice-recording", "Saved take transcript timing alignment failed.", {
          error,
          recordingId: recording?.id ?? "",
          mediaPath: recording?.mediaPath ?? "",
        });
        throw error;
      }
    },
  };
}

export async function createNarrationRecordingTranscriptAudioAlignment(recording, blob, {
  audioContextFactory = createDefaultAudioContext,
  wordTimingProvider = null,
  now = () => new Date().toISOString(),
  frameSeconds = DEFAULT_FRAME_SECONDS,
  mergeGapSeconds = DEFAULT_MERGE_GAP_SECONDS,
  minSpeechSeconds = DEFAULT_MIN_SPEECH_SECONDS,
} = {}) {
  const transcript = normalizeTranscript(recording?.transcript);
  const transcriptWords = splitTranscriptWords(transcript);
  if (!transcriptWords.length) {
    throw new Error("A saved take transcript is required before word timing can be aligned.");
  }
  if (!(blob instanceof Blob)) {
    throw new Error("A saved take audio blob is required before word timing can be aligned.");
  }

  const audioBuffer = await decodeAudioBlob(blob, {
    audioContextFactory,
  });
  const durationSeconds = resolveAlignmentDurationSeconds(recording, audioBuffer);
  const activity = createSpeechActivityMap(audioBuffer, {
    durationSeconds,
    frameSeconds,
    mergeGapSeconds,
    minSpeechSeconds,
  });
  if (!activity.speechSegments.length) {
    throw new Error("No speech-active intervals were detected in the saved take audio.");
  }

  const wordTimingResolution = await resolveNarrationRecordingWordTimingMap({
    wordTimingProvider,
    recording,
    blob,
    audioBuffer,
    transcript,
    transcriptWords,
    durationSeconds,
    speechSegments: activity.speechSegments,
  });
  const timingMap = wordTimingResolution?.timingMap ?? createFallbackWordTimingMap(transcriptWords, activity.speechSegments, {
    durationSeconds,
    wordTimingProvider: wordTimingResolution?.wordTimingProvider,
  });

  return {
    schemaVersion: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION,
    status: "ready",
    providerId: normalizeString(timingMap.providerId) || NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
    source: normalizeString(timingMap.source) || "audio-speech-activity",
    mediaPath: normalizeString(recording?.mediaPath),
    mediaMimeType: normalizeString(recording?.mediaMimeType),
    transcriptHash: createNarrationRecordingTranscriptHash(transcript),
    wordCount: transcriptWords.length,
    durationSeconds,
    processedAt: typeof now === "function" ? now() : new Date().toISOString(),
    speechSegments: activity.speechSegments,
    segmentAssignments: timingMap.segmentAssignments,
    wordTimings: timingMap.wordTimings,
    wordTimingProvider: normalizeWordTimingProviderMetadata(timingMap.wordTimingProvider),
    stats: {
      frameSeconds: activity.frameSeconds,
      thresholdRms: roundAudioNumber(activity.thresholdRms),
      noiseFloorRms: roundAudioNumber(activity.noiseFloorRms),
      peakRms: roundAudioNumber(activity.peakRms),
      activeDurationSeconds: roundSeconds(sumSegmentDurations(activity.speechSegments)),
      segmentCount: activity.speechSegments.length,
      ...(Number.isFinite(Number(timingMap.matchedWordCount)) ? { matchedWordCount: timingMap.matchedWordCount } : {}),
      ...(Number.isFinite(Number(timingMap.matchRatio)) ? { matchRatio: roundAudioNumber(timingMap.matchRatio) } : {}),
    },
  };
}

export function createWhisperCppWordTimingProvider({
  fetchJson,
  endpoint = "/api/whisper-cpp/word-timings",
  language = "en",
  reportLog = () => {},
} = {}) {
  if (typeof fetchJson !== "function") {
    return null;
  }

  return async function requestWhisperCppWordTimings({
    recording = null,
    audioBuffer = null,
    transcript = "",
  } = {}) {
    const wavBase64 = encodeAudioBufferToWavBase64(audioBuffer);
    if (!wavBase64) {
      return null;
    }

    const response = await fetchJson(endpoint, {
      method: "POST",
      body: {
        recordingId: normalizeString(recording?.id),
        transcriptHash: createNarrationRecordingTranscriptHash(transcript),
        language,
        wavBase64,
      },
    });
    if (!response?.ok) {
      throw response?.error ?? new Error("Unable to request local word timestamps.");
    }

    const result = response.value && typeof response.value === "object" ? response.value : {};
    const words = normalizeRecognizedWordTimings(result.words ?? result.recognizedWords, {
      durationSeconds: Number(audioBuffer?.duration) || 0,
    });
    reportLog("info", "voice-recording", "Local Whisper word timestamps resolved.", {
      recordingId: normalizeString(recording?.id),
      wordCount: words.length,
      providerId: normalizeString(result.providerId) || NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
    });
    return {
      providerId: normalizeString(result.providerId) || NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
      source: "word-timestamp-provider",
      language: normalizeString(result.language) || language,
      transcript: normalizeTranscript(result.transcript),
      words,
      metadata: result.whisper && typeof result.whisper === "object"
        ? {
          engine: "whisper.cpp",
          model: normalizeString(result.whisper.model),
          binary: normalizeString(result.whisper.binary),
        }
        : null,
    };
  };
}

export function shouldRefreshNarrationRecordingTranscriptAlignment(recording, {
  force = false,
} = {}) {
  if (!recording || recording.status !== "saved") {
    return false;
  }
  const transcript = normalizeTranscript(recording.transcript);
  if (!transcript || !normalizeString(recording.mediaPath)) {
    return false;
  }
  if (force) {
    return true;
  }

  const transcriptWords = splitTranscriptWords(transcript);
  const alignedWordTimings = resolveNarrationRecordingAlignedWordTimings({
    transcript,
    transcriptWords,
    durationSeconds: resolveRecordingDurationSeconds(recording),
    transcriptAlignment: recording.transcriptAlignment,
  });
  if (alignedWordTimings.length !== transcriptWords.length) {
    return true;
  }
  return shouldUpgradeSpeechActivityFallbackAlignment(recording.transcriptAlignment);
}

export function resolveNarrationRecordingAlignedWordTimings({
  transcript = "",
  transcriptWords = [],
  durationSeconds = 0,
  transcriptAlignment = null,
} = {}) {
  const words = Array.isArray(transcriptWords)
    ? transcriptWords.map((word) => String(word ?? "")).filter(Boolean)
    : splitTranscriptWords(transcript);
  const alignment = transcriptAlignment && typeof transcriptAlignment === "object"
    ? transcriptAlignment
    : null;
  if (!words.length || !isSupportedNarrationRecordingTranscriptAlignment(alignment)) {
    return [];
  }

  const wordTimings = Array.isArray(alignment.wordTimings) ? alignment.wordTimings : [];
  if (wordTimings.length < words.length) {
    return [];
  }

  const normalizedTranscript = normalizeTranscript(transcript || words.join(" "));
  const expectedHash = createNarrationRecordingTranscriptHash(normalizedTranscript);
  const alignmentHash = normalizeString(alignment.transcriptHash);
  if (alignmentHash && alignmentHash !== expectedHash) {
    return [];
  }

  const duration = normalizeDurationSeconds(durationSeconds || alignment.durationSeconds);
  const speechSegments = normalizeAlignedSpeechSegments(alignment.speechSegments, {
    durationSeconds: duration,
  });
  const resolved = [];
  for (let index = 0; index < words.length; index += 1) {
    const timing = wordTimings[index];
    const timingText = normalizeString(timing?.text);
    if (timingText && normalizeTranscriptWord(timingText) !== normalizeTranscriptWord(words[index])) {
      return [];
    }

    const startTimeSeconds = normalizeNullableSeconds(timing?.startTimeSeconds);
    const endTimeSeconds = normalizeNullableSeconds(timing?.endTimeSeconds);
    if (startTimeSeconds === null) {
      return [];
    }
    const clampedStart = clampSeconds(startTimeSeconds, duration);
    const clampedEnd = clampSeconds(
      endTimeSeconds !== null && endTimeSeconds > startTimeSeconds
        ? endTimeSeconds
        : startTimeSeconds + MIN_WORD_DURATION_SECONDS,
      duration,
    );
    const speechSegmentIndex = normalizeNullableInteger(timing?.speechSegmentIndex);
    if (speechSegmentIndex !== null) {
      const speechSegment = speechSegments[speechSegmentIndex];
      if (
        !speechSegment ||
        clampedStart < speechSegment.startTimeSeconds - 0.001 ||
        clampedEnd > speechSegment.endTimeSeconds + 0.001
      ) {
        return [];
      }
    }
    resolved.push({
      index,
      text: words[index],
      timeSeconds: clampedStart,
      endTimeSeconds: clampedEnd > clampedStart ? clampedEnd : clampedStart,
      timingSource: normalizeString(timing?.source) || normalizeString(alignment.providerId) || "aligned",
      timingConfidence: normalizeNullableNumber(timing?.confidence),
      speechSegmentIndex,
    });
  }

  return resolved;
}

export function isSupportedNarrationRecordingTranscriptAlignment(transcriptAlignment) {
  const alignment = transcriptAlignment && typeof transcriptAlignment === "object"
    ? transcriptAlignment
    : null;
  if (!alignment || alignment.status !== "ready") {
    return false;
  }
  return Number(alignment.schemaVersion) === NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_SCHEMA_VERSION;
}

function shouldUpgradeSpeechActivityFallbackAlignment(transcriptAlignment) {
  const alignment = transcriptAlignment && typeof transcriptAlignment === "object"
    ? transcriptAlignment
    : null;
  if (!alignment) {
    return false;
  }
  if (normalizeString(alignment.providerId) === NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID) {
    return false;
  }
  if (normalizeString(alignment.source) === "word-timestamp-provider") {
    return false;
  }
  const providerMetadata = alignment.wordTimingProvider && typeof alignment.wordTimingProvider === "object"
    ? alignment.wordTimingProvider
    : null;
  return !normalizeString(providerMetadata?.id);
}

export function resolveNarrationRecordingAlignedSeekTime({
  transcriptAlignment = null,
  requestedTimeSeconds = 0,
  durationSeconds = 0,
  boundaryPaddingSeconds = 0.02,
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds || transcriptAlignment?.durationSeconds);
  const requestedTime = clampSeconds(requestedTimeSeconds, duration);
  if (!isSupportedNarrationRecordingTranscriptAlignment(transcriptAlignment)) {
    return requestedTime;
  }

  const speechSegments = normalizeAlignedSpeechSegments(transcriptAlignment.speechSegments, {
    durationSeconds: duration,
  });
  if (!speechSegments.length) {
    return requestedTime;
  }

  const padding = Math.max(0, Number(boundaryPaddingSeconds) || 0);
  for (const segment of speechSegments) {
    if (requestedTime >= segment.startTimeSeconds && requestedTime <= segment.endTimeSeconds) {
      return roundSeconds(requestedTime);
    }
  }

  const closest = speechSegments.reduce((nearest, segment) => {
    const startDistance = Math.abs(requestedTime - segment.startTimeSeconds);
    const endDistance = Math.abs(requestedTime - segment.endTimeSeconds);
    const startCandidate = {
      timeSeconds: segment.startTimeSeconds + padding,
      distance: startDistance,
    };
    const endCandidate = {
      timeSeconds: Math.max(segment.startTimeSeconds, segment.endTimeSeconds - padding),
      distance: endDistance,
    };
    const segmentCandidate = startDistance <= endDistance ? startCandidate : endCandidate;
    return !nearest || segmentCandidate.distance < nearest.distance ? segmentCandidate : nearest;
  }, null);

  return roundSeconds(clampSeconds(closest?.timeSeconds ?? requestedTime, duration));
}

export function createNarrationRecordingWordTimestampTimingMap(transcriptWords, providerResult, {
  durationSeconds = 0,
  speechSegments = [],
} = {}) {
  const words = Array.isArray(transcriptWords) ? transcriptWords.map((word) => String(word ?? "")).filter(Boolean) : [];
  const duration = normalizeDurationSeconds(durationSeconds);
  const recognizedWords = normalizeRecognizedWordTimings(providerResult?.words ?? providerResult?.recognizedWords, {
    durationSeconds: duration,
  });
  if (!words.length || !recognizedWords.length) {
    return null;
  }

  const fallbackTimingMap = createWordTimingsFromSpeechSegments(words, speechSegments, {
    durationSeconds: duration,
  });
  const alignment = alignTranscriptWordsToRecognizedWords(words, recognizedWords);
  if (!isUsableWordTimestampAlignment(alignment, words.length)) {
    return null;
  }

  const directTimings = new Map();
  for (const match of alignment.matches) {
    const recognizedWord = recognizedWords[match.recognizedIndex];
    if (!recognizedWord) {
      continue;
    }
    directTimings.set(match.transcriptIndex, {
      index: match.transcriptIndex,
      text: words[match.transcriptIndex],
      startTimeSeconds: recognizedWord.startTimeSeconds,
      endTimeSeconds: Math.max(recognizedWord.endTimeSeconds, recognizedWord.startTimeSeconds + MIN_WORD_DURATION_SECONDS),
      source: "word-timestamp-provider",
      confidence: roundAudioNumber((recognizedWord.confidence ?? 0.7) * match.similarity),
      recognizedWordIndex: match.recognizedIndex,
      matchSimilarity: roundAudioNumber(match.similarity),
    });
  }

  const wordTimings = fillMissingWordTimestampTimings({
    words,
    directTimings,
    fallbackWordTimings: fallbackTimingMap.wordTimings,
    durationSeconds: duration,
    speechSegments,
  });
  const segmentAssignments = createSegmentAssignmentsFromWordTimings(wordTimings);
  return {
    providerId: normalizeString(providerResult?.providerId) || NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
    source: "word-timestamp-provider",
    wordTimingProvider: {
      id: normalizeString(providerResult?.providerId) || NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
      source: "word-timestamp-provider",
      status: "ready",
      language: normalizeString(providerResult?.language),
      recognizedTranscript: normalizeTranscript(providerResult?.transcript),
      recognizedWordCount: recognizedWords.length,
      matchedWordCount: alignment.matchedWordCount,
      matchRatio: alignment.matchRatio,
      ...(providerResult?.metadata && typeof providerResult.metadata === "object" ? { metadata: providerResult.metadata } : {}),
    },
    segmentAssignments,
    wordTimings,
    matchedWordCount: alignment.matchedWordCount,
    matchRatio: alignment.matchRatio,
  };
}

export function createNarrationRecordingTranscriptHash(value) {
  const normalized = normalizeTranscript(value).toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function encodeAudioBufferToWavBase64(audioBuffer) {
  const wavBytes = encodeAudioBufferToPcm16WavBytes(audioBuffer);
  return wavBytes ? bytesToBase64(wavBytes) : "";
}

// Intent: try model-produced word timestamps before falling back to the browser-only energy heuristic.
async function resolveNarrationRecordingWordTimingMap({
  wordTimingProvider = null,
  recording = null,
  blob = null,
  audioBuffer = null,
  transcript = "",
  transcriptWords = [],
  durationSeconds = 0,
  speechSegments = [],
} = {}) {
  if (typeof wordTimingProvider !== "function") {
    return null;
  }
  try {
    const providerResult = await wordTimingProvider({
      recording,
      blob,
      audioBuffer,
      transcript,
      transcriptWords,
      durationSeconds,
      speechSegments,
    });
    const timingMap = createNarrationRecordingWordTimestampTimingMap(transcriptWords, providerResult, {
      durationSeconds,
      speechSegments,
    });
    if (!timingMap) {
      return {
        timingMap: null,
        wordTimingProvider: createWordTimingProviderAttemptMetadata({
          providerId: providerResult?.providerId,
          status: "unusable",
          errorMessage: "Local word timestamps did not align to enough selected-passage words.",
        }),
      };
    }
    return { timingMap };
  } catch (error) {
    return {
      timingMap: null,
      wordTimingProvider: createWordTimingProviderAttemptMetadata({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error ?? ""),
      }),
    };
  }
}

// Intent: mark energy-derived maps as fallback output while preserving any failed provider attempt for diagnostics.
function createFallbackWordTimingMap(transcriptWords, speechSegments, {
  durationSeconds = 0,
  wordTimingProvider = null,
} = {}) {
  const fallbackTimingMap = createWordTimingsFromSpeechSegments(transcriptWords, speechSegments, {
    durationSeconds,
  });
  return {
    providerId: NARRATION_RECORDING_TRANSCRIPT_ALIGNMENT_PROVIDER_ID,
    source: "audio-speech-activity",
    wordTimingProvider,
    ...fallbackTimingMap,
  };
}

function createWordTimingProviderAttemptMetadata({
  providerId = "",
  status = "",
  errorMessage = "",
} = {}) {
  return {
    id: normalizeString(providerId) || NARRATION_RECORDING_WORD_TIMESTAMP_PROVIDER_ID,
    source: "word-timestamp-provider",
    status: normalizeString(status) || "failed",
    errorMessage: normalizeString(errorMessage),
  };
}

function isUsableWordTimestampAlignment(alignment, transcriptWordCount) {
  const wordCount = Math.max(0, Number(transcriptWordCount) || 0);
  if (!alignment || wordCount <= 0) {
    return false;
  }
  const minimumMatches = Math.min(wordCount, wordCount <= 4 ? 1 : 3);
  return alignment.matchedWordCount >= minimumMatches &&
    alignment.matchRatio >= WORD_TIMESTAMP_ALIGNMENT_MIN_MATCH_RATIO;
}

function alignTranscriptWordsToRecognizedWords(transcriptWords, recognizedWords) {
  const targetWords = Array.isArray(transcriptWords) ? transcriptWords : [];
  const sourceWords = Array.isArray(recognizedWords) ? recognizedWords : [];
  const targetCount = targetWords.length;
  const sourceCount = sourceWords.length;
  const deleteTranscriptPenalty = 0.78;
  const insertRecognizedPenalty = 0.48;
  const matrix = Array.from({ length: targetCount + 1 }, () => Array(sourceCount + 1).fill(0));
  const operations = Array.from({ length: targetCount + 1 }, () => Array(sourceCount + 1).fill(""));

  for (let targetIndex = 1; targetIndex <= targetCount; targetIndex += 1) {
    matrix[targetIndex][0] = matrix[targetIndex - 1][0] + deleteTranscriptPenalty;
    operations[targetIndex][0] = "delete";
  }
  for (let sourceIndex = 1; sourceIndex <= sourceCount; sourceIndex += 1) {
    matrix[0][sourceIndex] = matrix[0][sourceIndex - 1] + insertRecognizedPenalty;
    operations[0][sourceIndex] = "insert";
  }

  for (let targetIndex = 1; targetIndex <= targetCount; targetIndex += 1) {
    for (let sourceIndex = 1; sourceIndex <= sourceCount; sourceIndex += 1) {
      const similarity = calculateWordSimilarity(targetWords[targetIndex - 1], sourceWords[sourceIndex - 1]?.text);
      const matchPenalty = similarity >= 0.68 ? 1 - similarity : 1.08;
      const candidates = [
        {
          operation: "match",
          cost: matrix[targetIndex - 1][sourceIndex - 1] + matchPenalty,
        },
        {
          operation: "delete",
          cost: matrix[targetIndex - 1][sourceIndex] + deleteTranscriptPenalty,
        },
        {
          operation: "insert",
          cost: matrix[targetIndex][sourceIndex - 1] + insertRecognizedPenalty,
        },
      ].sort((left, right) => left.cost - right.cost);
      matrix[targetIndex][sourceIndex] = candidates[0].cost;
      operations[targetIndex][sourceIndex] = candidates[0].operation;
    }
  }

  const matches = [];
  let targetIndex = targetCount;
  let sourceIndex = sourceCount;
  while (targetIndex > 0 || sourceIndex > 0) {
    const operation = operations[targetIndex]?.[sourceIndex];
    if (operation === "match") {
      const similarity = calculateWordSimilarity(targetWords[targetIndex - 1], sourceWords[sourceIndex - 1]?.text);
      if (similarity >= 0.68) {
        matches.push({
          transcriptIndex: targetIndex - 1,
          recognizedIndex: sourceIndex - 1,
          similarity,
        });
      }
      targetIndex -= 1;
      sourceIndex -= 1;
      continue;
    }
    if (operation === "delete" || sourceIndex <= 0) {
      targetIndex -= 1;
      continue;
    }
    sourceIndex -= 1;
  }

  matches.reverse();
  return {
    matches,
    matchedWordCount: matches.length,
    matchRatio: targetCount > 0 ? matches.length / targetCount : 0,
  };
}

function fillMissingWordTimestampTimings({
  words = [],
  directTimings = new Map(),
  fallbackWordTimings = [],
  durationSeconds = 0,
  speechSegments = [],
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  const fallbackByIndex = new Map((Array.isArray(fallbackWordTimings) ? fallbackWordTimings : [])
    .map((timing) => [timing.index, timing]));
  const wordTimings = [];
  let index = 0;
  while (index < words.length) {
    const directTiming = directTimings.get(index);
    if (directTiming) {
      wordTimings.push(normalizeWordTimestampTiming(directTiming, {
        durationSeconds: duration,
        speechSegments,
      }));
      index += 1;
      continue;
    }

    const gapStartIndex = index;
    while (index < words.length && !directTimings.has(index)) {
      index += 1;
    }
    const gapEndIndex = index - 1;
    const previousTiming = wordTimings[wordTimings.length - 1] ?? null;
    const nextTiming = directTimings.get(index) ?? null;
    const interpolatedTimings = interpolateMissingWordTimings({
      words,
      gapStartIndex,
      gapEndIndex,
      previousTiming,
      nextTiming,
      fallbackByIndex,
      durationSeconds: duration,
      speechSegments,
    });
    wordTimings.push(...interpolatedTimings);
  }
  return wordTimings.map((timing, timingIndex) => ({
    ...timing,
    index: timingIndex,
    text: words[timingIndex],
  }));
}

function interpolateMissingWordTimings({
  words = [],
  gapStartIndex = 0,
  gapEndIndex = 0,
  previousTiming = null,
  nextTiming = null,
  fallbackByIndex = new Map(),
  durationSeconds = 0,
  speechSegments = [],
} = {}) {
  const gapWordCount = Math.max(0, gapEndIndex - gapStartIndex + 1);
  if (gapWordCount <= 0) {
    return [];
  }
  const duration = normalizeDurationSeconds(durationSeconds);
  const boundedStart = previousTiming
    ? normalizeNullableSeconds(previousTiming.endTimeSeconds) ?? normalizeNullableSeconds(previousTiming.startTimeSeconds) ?? 0
    : normalizeNullableSeconds(nextTiming?.startTimeSeconds) !== null
      ? Math.max(0, (normalizeNullableSeconds(nextTiming.startTimeSeconds) ?? 0) - (gapWordCount * 0.16))
      : normalizeNullableSeconds(fallbackByIndex.get(gapStartIndex)?.startTimeSeconds) ?? 0;
  const boundedEnd = nextTiming
    ? normalizeNullableSeconds(nextTiming.startTimeSeconds) ?? boundedStart
    : previousTiming
      ? Math.min(duration || Number.POSITIVE_INFINITY, (normalizeNullableSeconds(previousTiming.endTimeSeconds) ?? boundedStart) + (gapWordCount * 0.16))
      : normalizeNullableSeconds(fallbackByIndex.get(gapEndIndex)?.endTimeSeconds) ?? boundedStart;
  if (boundedEnd > boundedStart + MIN_WORD_DURATION_SECONDS) {
    const interpolationWindow = createWeightedTimingWindow(words.slice(gapStartIndex, gapEndIndex + 1), {
      startTimeSeconds: boundedStart,
      endTimeSeconds: boundedEnd,
    });
    return interpolationWindow.map((timing, localIndex) => normalizeWordTimestampTiming({
      index: gapStartIndex + localIndex,
      text: words[gapStartIndex + localIndex],
      startTimeSeconds: timing.startTimeSeconds,
      endTimeSeconds: timing.endTimeSeconds,
      source: "word-timestamp-interpolated",
      confidence: 0.46,
    }, {
      durationSeconds: duration,
      speechSegments,
    }));
  }

  return Array.from({ length: gapWordCount }, (_, localIndex) => {
    const wordIndex = gapStartIndex + localIndex;
    const fallback = fallbackByIndex.get(wordIndex);
    const startTimeSeconds = normalizeNullableSeconds(fallback?.startTimeSeconds) ?? boundedStart;
    const endTimeSeconds = normalizeNullableSeconds(fallback?.endTimeSeconds) ?? startTimeSeconds + MIN_WORD_DURATION_SECONDS;
    return normalizeWordTimestampTiming({
      index: wordIndex,
      text: words[wordIndex],
      startTimeSeconds,
      endTimeSeconds,
      source: "word-timestamp-fallback",
      confidence: 0.38,
    }, {
      durationSeconds: duration,
      speechSegments,
    });
  });
}

function createWeightedTimingWindow(words, {
  startTimeSeconds,
  endTimeSeconds,
} = {}) {
  const startTime = Math.max(0, Number(startTimeSeconds) || 0);
  const endTime = Math.max(startTime, Number(endTimeSeconds) || startTime);
  const durationSeconds = Math.max(0, endTime - startTime);
  const durations = createSegmentWordDurations(words, durationSeconds);
  let cursor = startTime;
  return words.map((word, index) => {
    const start = cursor;
    const end = index === words.length - 1
      ? endTime
      : Math.min(endTime, cursor + (durations[index] ?? MIN_WORD_DURATION_SECONDS));
    cursor = end;
    return {
      text: word,
      startTimeSeconds: start,
      endTimeSeconds: end,
    };
  });
}

function normalizeWordTimestampTiming(timing, {
  durationSeconds = 0,
  speechSegments = [],
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  const startTimeSeconds = clampSeconds(timing?.startTimeSeconds, duration);
  const endTimeSeconds = clampSeconds(
    Number(timing?.endTimeSeconds) > startTimeSeconds
      ? timing.endTimeSeconds
      : startTimeSeconds + MIN_WORD_DURATION_SECONDS,
    duration,
  );
  return {
    index: Number.isInteger(timing?.index) ? timing.index : 0,
    text: normalizeString(timing?.text),
    startTimeSeconds: roundSeconds(startTimeSeconds),
    endTimeSeconds: roundSeconds(Math.max(startTimeSeconds, endTimeSeconds)),
    source: normalizeString(timing?.source) || "word-timestamp-provider",
    confidence: normalizeNullableNumber(timing?.confidence),
    speechSegmentIndex: resolveSpeechSegmentIndexForTiming({
      startTimeSeconds,
      endTimeSeconds,
      speechSegments,
      durationSeconds: duration,
    }),
    ...(Number.isInteger(timing?.recognizedWordIndex) ? { recognizedWordIndex: timing.recognizedWordIndex } : {}),
    ...(Number.isFinite(Number(timing?.matchSimilarity)) ? { matchSimilarity: roundAudioNumber(timing.matchSimilarity) } : {}),
  };
}

function resolveSpeechSegmentIndexForTiming({
  startTimeSeconds,
  endTimeSeconds,
  speechSegments = [],
  durationSeconds = 0,
} = {}) {
  const segments = normalizeAlignedSpeechSegments(speechSegments, {
    durationSeconds,
  });
  if (!segments.length) {
    return null;
  }
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (
      startTimeSeconds >= segment.startTimeSeconds - 0.001 &&
      endTimeSeconds <= segment.endTimeSeconds + 0.001
    ) {
      return index;
    }
  }
  return null;
}

function createSegmentAssignmentsFromWordTimings(wordTimings) {
  const assignments = [];
  let activeAssignment = null;
  for (const timing of Array.isArray(wordTimings) ? wordTimings : []) {
    const speechSegmentIndex = normalizeNullableInteger(timing?.speechSegmentIndex);
    if (!activeAssignment || activeAssignment.speechSegmentIndex !== speechSegmentIndex) {
      if (activeAssignment) {
        assignments.push(activeAssignment);
      }
      activeAssignment = {
        speechSegmentIndex,
        startWordIndex: timing.index,
        endWordIndex: timing.index,
        startTimeSeconds: timing.startTimeSeconds,
        endTimeSeconds: timing.endTimeSeconds,
      };
      continue;
    }
    activeAssignment.endWordIndex = timing.index;
    activeAssignment.endTimeSeconds = timing.endTimeSeconds;
  }
  if (activeAssignment) {
    assignments.push(activeAssignment);
  }
  return assignments;
}

function normalizeWordTimingProviderMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  return {
    id: normalizeString(metadata.id),
    source: normalizeString(metadata.source),
    status: normalizeString(metadata.status),
    language: normalizeString(metadata.language),
    recognizedTranscript: normalizeTranscript(metadata.recognizedTranscript),
    recognizedWordCount: Math.max(0, Number(metadata.recognizedWordCount) || 0),
    matchedWordCount: Math.max(0, Number(metadata.matchedWordCount) || 0),
    matchRatio: roundAudioNumber(metadata.matchRatio),
    errorMessage: normalizeString(metadata.errorMessage),
    ...(metadata.metadata && typeof metadata.metadata === "object" ? { metadata: metadata.metadata } : {}),
  };
}

function normalizeRecognizedWordTimings(value, {
  durationSeconds = 0,
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  return (Array.isArray(value) ? value : [])
    .map((word, index) => {
      const startTimeSeconds = normalizeNullableSeconds(word?.startTimeSeconds ?? word?.start);
      const endTimeSeconds = normalizeNullableSeconds(word?.endTimeSeconds ?? word?.end);
      const text = normalizeString(word?.text ?? word?.word);
      if (!text || startTimeSeconds === null) {
        return null;
      }
      const clampedStart = clampSeconds(startTimeSeconds, duration);
      const clampedEnd = clampSeconds(
        endTimeSeconds !== null && endTimeSeconds > startTimeSeconds
          ? endTimeSeconds
          : startTimeSeconds + MIN_WORD_DURATION_SECONDS,
        duration,
      );
      return {
        index,
        text,
        normalizedText: normalizeComparisonWord(text),
        startTimeSeconds: roundSeconds(clampedStart),
        endTimeSeconds: roundSeconds(Math.max(clampedStart, clampedEnd)),
        confidence: normalizeNullableNumber(word?.confidence ?? word?.probability),
      };
    })
    .filter(Boolean)
    .filter((word) => word.endTimeSeconds > word.startTimeSeconds);
}

function calculateWordSimilarity(left, right) {
  const leftWord = normalizeComparisonWord(left);
  const rightWord = normalizeComparisonWord(right);
  if (!leftWord || !rightWord) {
    return 0;
  }
  if (leftWord === rightWord) {
    return 1;
  }
  if (leftWord.length <= 2 || rightWord.length <= 2) {
    return 0;
  }
  const distance = calculateLevenshteinDistance(leftWord, rightWord);
  return Math.max(0, 1 - (distance / Math.max(leftWord.length, rightWord.length)));
}

function calculateLevenshteinDistance(left, right) {
  const leftLength = left.length;
  const rightLength = right.length;
  const previous = Array.from({ length: rightLength + 1 }, (_, index) => index);
  const current = Array(rightLength + 1).fill(0);
  for (let leftIndex = 1; leftIndex <= leftLength; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= rightLength; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    for (let index = 0; index <= rightLength; index += 1) {
      previous[index] = current[index];
    }
  }
  return previous[rightLength] ?? 0;
}

function normalizeComparisonWord(value) {
  return normalizeTranscriptWord(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

function encodeAudioBufferToPcm16WavBytes(audioBuffer) {
  const sampleRate = normalizePositiveNumber(audioBuffer?.sampleRate, 0);
  const sampleCount = Math.max(0, Math.floor(Number(audioBuffer?.length) || 0));
  if (!sampleRate || sampleCount <= 0 || typeof audioBuffer?.getChannelData !== "function") {
    return null;
  }

  const channelCount = Math.max(1, Math.floor(Number(audioBuffer.numberOfChannels) || 1));
  const samples = new Int16Array(sampleCount);
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    let mixedSample = 0;
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const channel = audioBuffer.getChannelData(channelIndex);
      mixedSample += Number(channel?.[sampleIndex]) || 0;
    }
    const normalizedSample = Math.max(-1, Math.min(1, mixedSample / channelCount));
    samples[sampleIndex] = normalizedSample < 0
      ? Math.round(normalizedSample * 0x8000)
      : Math.round(normalizedSample * 0x7fff);
  }

  const byteLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, byteLength, true);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + (index * 2), samples[index], true);
  }
  return new Uint8Array(buffer);
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function bytesToBase64(bytes) {
  if (!bytes?.length) {
    return "";
  }
  if (typeof globalThis.Buffer !== "undefined") {
    return globalThis.Buffer.from(bytes).toString("base64");
  }
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

// Intent: decode browser-supported media containers such as WebM before deriving local speech activity.
async function decodeAudioBlob(blob, {
  audioContextFactory,
} = {}) {
  const audioContext = typeof audioContextFactory === "function" ? audioContextFactory() : null;
  if (!audioContext || typeof audioContext.decodeAudioData !== "function") {
    throw new Error("Browser audio decoding is unavailable.");
  }

  try {
    const sourceBuffer = await blob.arrayBuffer();
    const decodeResult = audioContext.decodeAudioData(sourceBuffer.slice(0));
    return await Promise.resolve(decodeResult);
  } finally {
    if (typeof audioContext.close === "function") {
      await Promise.resolve(audioContext.close()).catch(() => {});
    }
  }
}

// Intent: find the parts of the recording that contain speech-like energy so word seeks avoid blank audio spans.
function createSpeechActivityMap(audioBuffer, {
  durationSeconds = 0,
  frameSeconds = DEFAULT_FRAME_SECONDS,
  mergeGapSeconds = DEFAULT_MERGE_GAP_SECONDS,
  minSpeechSeconds = DEFAULT_MIN_SPEECH_SECONDS,
} = {}) {
  const sampleRate = normalizePositiveNumber(audioBuffer?.sampleRate, 48000);
  const channelCount = Math.max(1, Math.floor(Number(audioBuffer?.numberOfChannels) || 1));
  const sampleCount = Math.max(0, Math.floor(Number(audioBuffer?.length) || 0));
  if (sampleCount <= 0 || sampleRate <= 0) {
    return createEmptySpeechActivityMap(frameSeconds);
  }

  const channels = [];
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    if (typeof audioBuffer.getChannelData !== "function") {
      break;
    }
    channels.push(audioBuffer.getChannelData(channelIndex));
  }
  if (!channels.length) {
    return createEmptySpeechActivityMap(frameSeconds);
  }

  const frameSize = Math.max(1, Math.round(sampleRate * normalizePositiveNumber(frameSeconds, DEFAULT_FRAME_SECONDS)));
  const frames = [];
  for (let frameStart = 0; frameStart < sampleCount; frameStart += frameSize) {
    const frameEnd = Math.min(sampleCount, frameStart + frameSize);
    const rms = calculateFrameRms(channels, frameStart, frameEnd);
    frames.push({
      startTimeSeconds: frameStart / sampleRate,
      endTimeSeconds: frameEnd / sampleRate,
      rms,
    });
  }

  const rmsValues = frames.map((frame) => frame.rms).filter((rms) => Number.isFinite(rms));
  const sortedRms = [...rmsValues].sort((left, right) => left - right);
  const noiseFloorRms = percentile(sortedRms, 0.2);
  const midRms = percentile(sortedRms, 0.65);
  const highRms = percentile(sortedRms, 0.9);
  const peakRms = sortedRms[sortedRms.length - 1] ?? 0;
  const thresholdRms = Math.max(
    0.0025,
    noiseFloorRms * 3.5,
    midRms + ((highRms - midRms) * 0.3),
    peakRms * 0.06,
  );
  const activeFrames = frames.map((frame) => ({
    ...frame,
    active: frame.rms >= thresholdRms,
  }));

  const rawSegments = createRawSpeechSegments(activeFrames);
  const speechSegments = normalizeSpeechSegments(rawSegments, {
    durationSeconds: normalizeDurationSeconds(durationSeconds || audioBuffer.duration),
    mergeGapSeconds,
    minSpeechSeconds,
  });

  return {
    frameSeconds: normalizePositiveNumber(frameSeconds, DEFAULT_FRAME_SECONDS),
    noiseFloorRms,
    thresholdRms,
    peakRms,
    speechSegments,
  };
}

function createEmptySpeechActivityMap(frameSeconds) {
  return {
    frameSeconds: normalizePositiveNumber(frameSeconds, DEFAULT_FRAME_SECONDS),
    noiseFloorRms: 0,
    thresholdRms: 0,
    peakRms: 0,
    speechSegments: [],
  };
}

function calculateFrameRms(channels, frameStart, frameEnd) {
  let squareTotal = 0;
  let sampleTotal = 0;
  for (const channel of channels) {
    for (let index = frameStart; index < frameEnd; index += 1) {
      const sample = Number(channel[index]) || 0;
      squareTotal += sample * sample;
      sampleTotal += 1;
    }
  }
  return sampleTotal > 0 ? Math.sqrt(squareTotal / sampleTotal) : 0;
}

function createRawSpeechSegments(frames) {
  const segments = [];
  let activeStart = null;
  let activeEnd = null;
  for (const frame of frames) {
    if (frame.active) {
      if (activeStart === null) {
        activeStart = frame.startTimeSeconds;
      }
      activeEnd = frame.endTimeSeconds;
      continue;
    }
    if (activeStart !== null && activeEnd !== null) {
      segments.push({
        startTimeSeconds: activeStart,
        endTimeSeconds: activeEnd,
      });
    }
    activeStart = null;
    activeEnd = null;
  }
  if (activeStart !== null && activeEnd !== null) {
    segments.push({
      startTimeSeconds: activeStart,
      endTimeSeconds: activeEnd,
    });
  }
  return segments;
}

function normalizeSpeechSegments(rawSegments, {
  durationSeconds = 0,
  mergeGapSeconds = DEFAULT_MERGE_GAP_SECONDS,
  minSpeechSeconds = DEFAULT_MIN_SPEECH_SECONDS,
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  const mergeGap = normalizePositiveNumber(mergeGapSeconds, DEFAULT_MERGE_GAP_SECONDS);
  const minSpeech = normalizePositiveNumber(minSpeechSeconds, DEFAULT_MIN_SPEECH_SECONDS);
  const mergedSegments = [];

  for (const segment of rawSegments) {
    const startTimeSeconds = clampSeconds(segment.startTimeSeconds, duration);
    const endTimeSeconds = clampSeconds(segment.endTimeSeconds, duration);
    if (endTimeSeconds <= startTimeSeconds) {
      continue;
    }

    const previous = mergedSegments[mergedSegments.length - 1];
    if (previous && startTimeSeconds - previous.endTimeSeconds <= mergeGap) {
      previous.endTimeSeconds = Math.max(previous.endTimeSeconds, endTimeSeconds);
      continue;
    }

    mergedSegments.push({
      startTimeSeconds,
      endTimeSeconds,
    });
  }

  return mergedSegments
    .filter((segment) => segment.endTimeSeconds - segment.startTimeSeconds >= minSpeech)
    .map((segment) => ({
      startTimeSeconds: roundSeconds(segment.startTimeSeconds),
      endTimeSeconds: roundSeconds(segment.endTimeSeconds),
    }));
}

// Intent: keep each transcript word inside one speech island so word seeks cannot span silent gaps.
function createWordTimingsFromSpeechSegments(transcriptWords, speechSegments, {
  durationSeconds = 0,
} = {}) {
  const words = Array.isArray(transcriptWords) ? transcriptWords : [];
  const duration = normalizeDurationSeconds(durationSeconds);
  const segments = normalizeAlignedSpeechSegments(speechSegments, {
    durationSeconds: duration,
  });
  const activeDurationSeconds = sumSegmentDurations(segments);
  if (!words.length || activeDurationSeconds <= 0) {
    return {
      segmentAssignments: [],
      wordTimings: [],
    };
  }

  const segmentAssignments = allocateTranscriptWordsToSpeechSegments(words, segments);
  const wordTimings = [];
  for (const assignment of segmentAssignments) {
    const segmentWords = words.slice(assignment.startWordIndex, assignment.endWordIndex + 1);
    const segmentDurationSeconds = Math.max(0, assignment.endTimeSeconds - assignment.startTimeSeconds);
    const wordDurations = createSegmentWordDurations(segmentWords, segmentDurationSeconds);
    let cursor = assignment.startTimeSeconds;
    for (let localIndex = 0; localIndex < segmentWords.length; localIndex += 1) {
      const wordIndex = assignment.startWordIndex + localIndex;
      const startTimeSeconds = cursor;
      const endTimeSeconds = localIndex === segmentWords.length - 1
        ? assignment.endTimeSeconds
        : Math.min(assignment.endTimeSeconds, cursor + wordDurations[localIndex]);
      wordTimings.push({
        index: wordIndex,
        text: segmentWords[localIndex],
        startTimeSeconds: roundSeconds(startTimeSeconds),
        endTimeSeconds: roundSeconds(Math.max(startTimeSeconds, endTimeSeconds)),
        source: "speech-activity-segment",
        confidence: 0.68,
        speechSegmentIndex: assignment.speechSegmentIndex,
      });
      cursor = endTimeSeconds;
    }
  }

  return {
    segmentAssignments,
    wordTimings: wordTimings.sort((left, right) => left.index - right.index),
  };
}

function allocateTranscriptWordsToSpeechSegments(words, speechSegments) {
  const segments = (Array.isArray(speechSegments) ? speechSegments : [])
    .map((segment, speechSegmentIndex) => ({
      speechSegmentIndex,
      startTimeSeconds: normalizeNullableSeconds(segment?.startTimeSeconds) ?? 0,
      endTimeSeconds: normalizeNullableSeconds(segment?.endTimeSeconds) ?? 0,
    }))
    .filter((segment) => segment.endTimeSeconds > segment.startTimeSeconds);
  const wordCount = Array.isArray(words) ? words.length : 0;
  if (!wordCount || !segments.length) {
    return [];
  }

  if (wordCount <= segments.length) {
    return allocateSparseTranscriptWordsToSpeechSegments(wordCount, segments);
  }

  const assignments = [];
  let nextWordIndex = 0;
  let remainingWords = wordCount;
  let remainingDurationSeconds = sumSegmentDurations(segments);
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    const remainingSegments = segments.length - segmentIndex;
    const segmentDurationSeconds = Math.max(0, segment.endTimeSeconds - segment.startTimeSeconds);
    const wordShare = remainingSegments === 1
      ? remainingWords
      : Math.round((segmentDurationSeconds / Math.max(remainingDurationSeconds, segmentDurationSeconds)) * remainingWords);
    const maximumWordCount = remainingWords - (remainingSegments - 1);
    const assignedWordCount = Math.max(1, Math.min(maximumWordCount, wordShare));
    assignments.push(createSegmentWordAssignment(segment, nextWordIndex, assignedWordCount));
    nextWordIndex += assignedWordCount;
    remainingWords -= assignedWordCount;
    remainingDurationSeconds -= segmentDurationSeconds;
  }
  return assignments;
}

function allocateSparseTranscriptWordsToSpeechSegments(wordCount, segments) {
  const selectedSegmentIndexes = wordCount === 1
    ? [findLongestSpeechSegmentIndex(segments)]
    : Array.from({ length: wordCount }, (_, index) => Math.round((index / (wordCount - 1)) * (segments.length - 1)));

  return selectedSegmentIndexes
    .map((segmentIndex, wordIndex) => createSegmentWordAssignment(segments[segmentIndex], wordIndex, 1))
    .filter(Boolean);
}

function createSegmentWordAssignment(segment, startWordIndex, wordCount) {
  if (!segment || !Number.isInteger(startWordIndex) || wordCount <= 0) {
    return null;
  }
  return {
    speechSegmentIndex: segment.speechSegmentIndex,
    startWordIndex,
    endWordIndex: startWordIndex + wordCount - 1,
    startTimeSeconds: roundSeconds(segment.startTimeSeconds),
    endTimeSeconds: roundSeconds(segment.endTimeSeconds),
  };
}

function createSegmentWordDurations(words, segmentDurationSeconds) {
  const segmentDuration = Math.max(0, Number(segmentDurationSeconds) || 0);
  const wordCount = Array.isArray(words) ? words.length : 0;
  if (!wordCount || segmentDuration <= 0) {
    return [];
  }
  if (segmentDuration <= wordCount * MIN_WORD_DURATION_SECONDS) {
    const equalDuration = segmentDuration / wordCount;
    return words.map(() => equalDuration);
  }

  const weights = words.map(createTranscriptWordTimingWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || wordCount;
  const distributableDuration = segmentDuration - (wordCount * MIN_WORD_DURATION_SECONDS);
  return weights.map((weight) => MIN_WORD_DURATION_SECONDS + ((weight / totalWeight) * distributableDuration));
}

function createTranscriptWordTimingWeight(word) {
  const normalizedWord = normalizeTranscriptWord(word);
  const characterCount = Math.max(1, normalizedWord.length || String(word ?? "").length);
  const terminalPauseWeight = /[.,;:!?]$/.test(String(word ?? "")) ? 0.18 : 0;
  return Math.max(0.75, Math.min(2.8, Math.sqrt(characterCount) + terminalPauseWeight));
}

function findLongestSpeechSegmentIndex(segments) {
  let longestIndex = 0;
  let longestDurationSeconds = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const durationSeconds = Math.max(0, segments[index].endTimeSeconds - segments[index].startTimeSeconds);
    if (durationSeconds > longestDurationSeconds) {
      longestDurationSeconds = durationSeconds;
      longestIndex = index;
    }
  }
  return longestIndex;
}

function normalizeAlignedSpeechSegments(rawSegments, {
  durationSeconds = 0,
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  const segments = (Array.isArray(rawSegments) ? rawSegments : [])
    .map((segment) => ({
      startTimeSeconds: clampSeconds(segment?.startTimeSeconds, duration),
      endTimeSeconds: clampSeconds(segment?.endTimeSeconds, duration),
    }))
    .filter((segment) => segment.endTimeSeconds > segment.startTimeSeconds)
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);
  const merged = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous && segment.startTimeSeconds <= previous.endTimeSeconds) {
      previous.endTimeSeconds = Math.max(previous.endTimeSeconds, segment.endTimeSeconds);
      continue;
    }
    merged.push({ ...segment });
  }
  return merged.map((segment) => ({
    startTimeSeconds: roundSeconds(segment.startTimeSeconds),
    endTimeSeconds: roundSeconds(segment.endTimeSeconds),
  }));
}

function sumSegmentDurations(segments) {
  return (Array.isArray(segments) ? segments : []).reduce((total, segment) => {
    const startTimeSeconds = normalizeNullableSeconds(segment?.startTimeSeconds) ?? 0;
    const endTimeSeconds = normalizeNullableSeconds(segment?.endTimeSeconds) ?? startTimeSeconds;
    return total + Math.max(0, endTimeSeconds - startTimeSeconds);
  }, 0);
}

function resolveAlignmentDurationSeconds(recording, audioBuffer) {
  return normalizeDurationSeconds(resolveRecordingDurationSeconds(recording) || audioBuffer?.duration);
}

function resolveRecordingDurationSeconds(recording) {
  const durationMs = Number(recording?.durationMs);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
}

function splitTranscriptWords(value) {
  const transcript = normalizeTranscript(value);
  return transcript ? transcript.split(" ").filter(Boolean) : [];
}

function normalizeTranscript(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeTranscriptWord(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function createDefaultAudioContext() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return typeof AudioContextConstructor === "function"
    ? new AudioContextConstructor()
    : null;
}

function normalizeString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeDurationSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizePositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNullableInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeNullableSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function clampSeconds(value, durationSeconds = 0) {
  const number = Number(value);
  const duration = normalizeDurationSeconds(durationSeconds);
  const seconds = Number.isFinite(number) && number > 0 ? number : 0;
  return duration > 0 ? Math.min(seconds, duration) : seconds;
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.round((sortedValues.length - 1) * ratio)));
  return sortedValues[index] ?? 0;
}

function roundSeconds(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function roundAudioNumber(value) {
  return Math.round((Number(value) || 0) * 1000000) / 1000000;
}
