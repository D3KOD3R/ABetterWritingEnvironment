// Intent: own saved voice/narration recording collection access, mutation, and anchor recovery outside app.js.

const MAX_PASSAGE_START_EXPANSION_CHARACTERS = 36;
const MAX_PASSAGE_START_EXPANSION_WORDS = 3;
const TRANSCRIPT_STALE_ANCHOR_MIN_MATCH_LENGTH = 18;

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

// Intent: reconstruct scene offsets from block anchors without depending on editor DOM layout.
export function createVoiceRecordingSceneBlockRanges(scene) {
  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  const ranges = [];
  let offset = 0;

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const text = String(block?.text ?? "");
    const startOffset = offset;
    const endOffset = startOffset + text.length;
    ranges.push({
      ...block,
      text,
      startOffset,
      endOffset,
    });
    offset = endOffset + (index < blocks.length - 1 ? 2 : 0);
  }

  return ranges;
}

// Intent: recover saved recording manuscript spans from current scene text before rendering or navigating.
export function resolveVoiceRecordingSceneRange(recording, scene, {
  blockRanges = null,
} = {}) {
  const sceneText = resolveVoiceRecordingSceneText(scene);
  const sceneLength = sceneText.length;
  const ranges = Array.isArray(blockRanges) ? blockRanges : createVoiceRecordingSceneBlockRanges(scene);
  const recordingBlockRange = ranges.find((block) => block.blockId === recording?.blockId) ?? null;
  const selectedBlockRange = recordingBlockRange ?? ranges[0] ?? null;
  const fallbackStart = Number.isInteger(selectedBlockRange?.startOffset) ? selectedBlockRange.startOffset : 0;
  const fallbackEnd = Number.isInteger(selectedBlockRange?.endOffset) && selectedBlockRange.endOffset > fallbackStart
    ? selectedBlockRange.endOffset
    : fallbackStart;
  const storedRange = normalizeVoiceRecordingStoredRange(recording, {
    sceneLength,
    fallbackStart,
    fallbackEnd,
  });
  if (!sceneText) {
    return storedRange;
  }

  const evidenceRange = resolveVoiceRecordingEvidenceRange(recording, sceneText, {
    fallbackStart: storedRange.startOffset,
  });
  const recoveredRange = chooseVoiceRecordingRecoveredRange({
    storedRange,
    evidenceRange,
    sceneText,
    blockRange: selectedBlockRange,
  });
  const resolvedRange = recoveredRange ?? storedRange;

  return normalizeResolvedVoiceRecordingRange(
    evidenceRange
      ? expandVoiceRecordingRangeToPassageStart(resolvedRange, sceneText, selectedBlockRange)
      : resolvedRange,
    sceneLength,
  );
}

// Intent: remove an anchored narration/voice recording without leaking cross-project records.
export function deleteVoiceRecordingRecord(workspace, recordingId, projectId = "") {
  if (typeof recordingId !== "string" || !recordingId.trim() || !workspace) {
    return null;
  }

  const recordings = ensureWorkspaceVoiceRecordings(workspace);
  const normalizedProjectId = typeof projectId === "string" ? projectId.trim() : "";
  const existingIndex = recordings.findIndex((candidate) => (
    candidate?.id === recordingId &&
    (!normalizedProjectId || candidate.projectId === normalizedProjectId)
  ));
  if (existingIndex < 0) {
    return null;
  }

  const [removedRecord] = recordings.splice(existingIndex, 1);
  workspace.voice.recordings = recordings;
  return removedRecord ?? null;
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
    deleteById(recordingId, projectId = getProjectId()) {
      return deleteVoiceRecordingRecord(getWorkspace(), recordingId, projectId);
    },
    ensure() {
      return ensureWorkspaceVoiceRecordings(getWorkspace());
    },
  };
}

function resolveVoiceRecordingSceneText(scene) {
  if (typeof scene?.editorText === "string" && scene.editorText.length) {
    return scene.editorText;
  }

  const blocks = Array.isArray(scene?.blocks) ? scene.blocks : [];
  return blocks.map((block) => String(block?.text ?? "")).join("\n\n");
}

function normalizeVoiceRecordingStoredRange(recording, {
  sceneLength = 0,
  fallbackStart = 0,
  fallbackEnd = 0,
} = {}) {
  const maxOffset = Math.max(0, sceneLength, fallbackEnd, fallbackStart);
  const rawStartOffset = Number.isInteger(recording?.startOffset)
    ? recording.startOffset
    : fallbackStart;
  const rawEndOffset = Number.isInteger(recording?.endOffset) && recording.endOffset > rawStartOffset
    ? recording.endOffset
    : fallbackEnd;
  const startOffset = clampTextOffset(rawStartOffset, maxOffset);
  const endOffset = Math.max(startOffset, clampTextOffset(rawEndOffset, maxOffset));

  return { startOffset, endOffset };
}

function resolveVoiceRecordingEvidenceRange(recording, sceneText, {
  fallbackStart = 0,
} = {}) {
  const selectedEvidenceRange = chooseBestVoiceRecordingEvidenceCandidate([
    createVoiceRecordingEvidenceCandidate(sceneText, recording?.verseText, {
      source: "verseText",
      fallbackStart,
      trustWeight: 5,
    }),
    createVoiceRecordingEvidenceCandidate(sceneText, recording?.selectedText, {
      source: "selectedText",
      fallbackStart,
      trustWeight: 5,
    }),
  ]);
  const transcriptEvidenceRange = chooseBestVoiceRecordingEvidenceCandidate([
    createVoiceRecordingEvidenceCandidate(sceneText, recording?.transcript, {
      source: "transcript",
      fallbackStart,
      trustWeight: 4,
    }),
    createVoiceRecordingEvidenceCandidate(sceneText, recording?.cleanupTranscript, {
      source: "cleanupTranscript",
      fallbackStart,
      trustWeight: 4,
    }),
  ]);

  if (selectedEvidenceRange && transcriptEvidenceRange) {
    if (rangesOverlapOrNearlyTouch(selectedEvidenceRange, transcriptEvidenceRange)) {
      return {
        ...selectedEvidenceRange,
        startOffset: Math.min(selectedEvidenceRange.startOffset, transcriptEvidenceRange.startOffset),
        endOffset: Math.max(selectedEvidenceRange.endOffset, transcriptEvidenceRange.endOffset),
        matchLength: selectedEvidenceRange.matchLength + transcriptEvidenceRange.matchLength,
      };
    }

    if (
      selectedEvidenceRange.matchLength < TRANSCRIPT_STALE_ANCHOR_MIN_MATCH_LENGTH &&
      transcriptEvidenceRange.matchLength >= TRANSCRIPT_STALE_ANCHOR_MIN_MATCH_LENGTH
    ) {
      return transcriptEvidenceRange;
    }

    return selectedEvidenceRange;
  }

  return selectedEvidenceRange ?? transcriptEvidenceRange ?? null;
}

function createVoiceRecordingEvidenceCandidate(sceneText, evidence, {
  source = "",
  fallbackStart = 0,
  trustWeight = 1,
} = {}) {
  const evidenceText = String(evidence ?? "").replace(/\s+/g, " ").trim();
  const normalizedEvidence = normalizeSearchText(evidenceText);
  if (normalizedEvidence.length < 3) {
    return null;
  }

  const exactRange = findClosestExactRange(sceneText, evidenceText, fallbackStart)
    ?? findClosestCaseInsensitiveRange(sceneText, evidenceText, fallbackStart);
  const normalizedRange = findClosestNormalizedRange(
    createNormalizedTextMap(sceneText),
    normalizedEvidence,
    fallbackStart,
  );
  const fragmentRange = findBestNormalizedFragmentRange(sceneText, evidenceText, fallbackStart);
  const range = chooseBestVoiceRecordingEvidenceCandidate([
    createCandidateFromRange(exactRange, {
      source,
      matchType: "exact",
      matchLength: evidenceText.length,
      fallbackStart,
      trustWeight,
    }),
    createCandidateFromRange(normalizedRange, {
      source,
      matchType: "normalized",
      matchLength: normalizedEvidence.length,
      fallbackStart,
      trustWeight,
    }),
    createCandidateFromRange(fragmentRange, {
      source,
      matchType: "fragment",
      matchLength: fragmentRange?.matchLength ?? 0,
      fallbackStart,
      trustWeight,
    }),
  ]);

  return range;
}

function createCandidateFromRange(range, {
  source = "",
  matchType = "",
  matchLength = 0,
  fallbackStart = 0,
  trustWeight = 1,
} = {}) {
  if (!range || !Number.isInteger(range.startOffset) || !Number.isInteger(range.endOffset) || range.endOffset <= range.startOffset) {
    return null;
  }

  const safeMatchLength = Math.max(0, Number(matchLength) || 0);
  return {
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    source,
    matchType,
    matchLength: safeMatchLength,
    score: safeMatchLength + (trustWeight * 100),
    distance: Math.abs(range.startOffset - fallbackStart),
  };
}

function chooseBestVoiceRecordingEvidenceCandidate(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .filter(Boolean)
    .sort((left, right) => (
      right.score - left.score ||
      right.matchLength - left.matchLength ||
      left.distance - right.distance ||
      left.startOffset - right.startOffset
    ))[0] ?? null;
}

function chooseVoiceRecordingRecoveredRange({
  storedRange = null,
  evidenceRange = null,
  sceneText = "",
  blockRange = null,
} = {}) {
  if (!evidenceRange) {
    return storedRange;
  }

  const normalizedStored = normalizeResolvedVoiceRecordingRange(storedRange, sceneText.length);
  const normalizedEvidence = normalizeResolvedVoiceRecordingRange(evidenceRange, sceneText.length);
  if (!normalizedStored) {
    return normalizedEvidence;
  }

  if (rangesOverlapOrNearlyTouch(normalizedStored, normalizedEvidence)) {
    return {
      startOffset: Math.min(normalizedStored.startOffset, normalizedEvidence.startOffset),
      endOffset: Math.max(normalizedStored.endOffset, normalizedEvidence.endOffset),
    };
  }

  const blockStart = Number.isInteger(blockRange?.startOffset) ? blockRange.startOffset : null;
  const blockEnd = Number.isInteger(blockRange?.endOffset) ? blockRange.endOffset : null;
  const evidenceInBlock = blockStart !== null &&
    blockEnd !== null &&
    normalizedEvidence.startOffset >= blockStart &&
    normalizedEvidence.endOffset <= blockEnd;
  if (evidenceInBlock || evidenceRange.matchLength >= TRANSCRIPT_STALE_ANCHOR_MIN_MATCH_LENGTH) {
    return normalizedEvidence;
  }

  return normalizedStored;
}

function expandVoiceRecordingRangeToPassageStart(range, sceneText, blockRange) {
  const normalizedRange = normalizeResolvedVoiceRecordingRange(range, sceneText.length);
  if (!normalizedRange) {
    return normalizedRange;
  }

  const passageStart = resolveNearbyPassageStart(sceneText, normalizedRange.startOffset, blockRange);
  if (!Number.isInteger(passageStart) || passageStart >= normalizedRange.startOffset) {
    return normalizedRange;
  }

  const leadingText = sceneText.slice(passageStart, normalizedRange.startOffset);
  if (!isExpandablePassageStartPrefix(leadingText)) {
    return normalizedRange;
  }

  return {
    ...normalizedRange,
    startOffset: passageStart,
  };
}

function resolveNearbyPassageStart(sceneText, startOffset, blockRange) {
  const safeStart = clampTextOffset(startOffset, sceneText.length);
  const blockStart = Number.isInteger(blockRange?.startOffset)
    ? clampTextOffset(blockRange.startOffset, sceneText.length)
    : 0;
  const previousBreak = sceneText.lastIndexOf("\n\n", Math.max(0, safeStart - 1));
  const paragraphStart = previousBreak >= 0
    ? previousBreak + 2
    : blockStart;
  const candidateStart = Math.max(blockStart, paragraphStart);
  const firstTextOffset = findFirstNonWhitespaceOffset(sceneText, candidateStart, safeStart);

  return safeStart - firstTextOffset <= MAX_PASSAGE_START_EXPANSION_CHARACTERS
    ? firstTextOffset
    : null;
}

function findFirstNonWhitespaceOffset(sceneText, startOffset, endOffset) {
  for (let offset = startOffset; offset < endOffset; offset += 1) {
    if (!/\s/.test(sceneText[offset])) {
      return offset;
    }
  }

  return startOffset;
}

function isExpandablePassageStartPrefix(value) {
  const text = String(value ?? "");
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_PASSAGE_START_EXPANSION_CHARACTERS) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_PASSAGE_START_EXPANSION_WORDS;
}

function normalizeResolvedVoiceRecordingRange(range, sceneLength) {
  if (!range || !Number.isInteger(range.startOffset) || !Number.isInteger(range.endOffset)) {
    return null;
  }

  const startOffset = clampTextOffset(range.startOffset, sceneLength);
  const endOffset = Math.max(startOffset, clampTextOffset(range.endOffset, sceneLength));
  return endOffset > startOffset
    ? { startOffset, endOffset }
    : { startOffset, endOffset: startOffset };
}

function rangesOverlapOrNearlyTouch(left, right, maximumGap = 80) {
  if (!left || !right) {
    return false;
  }

  return left.startOffset <= right.endOffset + maximumGap &&
    right.startOffset <= left.endOffset + maximumGap;
}

function findClosestExactRange(content, selectedText, fallbackStart) {
  const needleLength = selectedText.length;
  if (!needleLength) {
    return null;
  }

  let bestStart = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;
  while (searchFrom <= content.length) {
    const foundStart = content.indexOf(selectedText, searchFrom);
    if (foundStart === -1) {
      break;
    }

    const distance = Math.abs(foundStart - fallbackStart);
    if (distance < bestDistance) {
      bestStart = foundStart;
      bestDistance = distance;
    }
    searchFrom = foundStart + Math.max(1, needleLength);
  }

  return bestStart >= 0
    ? {
        startOffset: bestStart,
        endOffset: bestStart + needleLength,
      }
    : null;
}

function findClosestCaseInsensitiveRange(content, selectedText, fallbackStart) {
  const lowerContent = String(content ?? "").toLocaleLowerCase();
  const lowerNeedle = String(selectedText ?? "").toLocaleLowerCase();
  const range = findClosestExactRange(lowerContent, lowerNeedle, fallbackStart);
  return range
    ? {
        startOffset: range.startOffset,
        endOffset: range.endOffset,
      }
    : null;
}

function findBestNormalizedFragmentRange(content, selectedText, fallbackStart) {
  const contentIndex = createNormalizedTextMap(content);
  const words = normalizeSearchText(selectedText).split(" ").filter(Boolean);
  let bestRange = null;
  let bestScore = null;

  for (let wordCount = Math.min(16, words.length); wordCount >= 1; wordCount -= 1) {
    for (let wordStart = 0; wordStart <= words.length - wordCount; wordStart += 1) {
      const fragment = words.slice(wordStart, wordStart + wordCount).join(" ");
      if (fragment.length < 3 || (wordCount === 1 && fragment.length < 5)) {
        continue;
      }

      const range = findClosestNormalizedRange(contentIndex, fragment, fallbackStart);
      if (!range) {
        continue;
      }

      const score = {
        length: fragment.length,
        distance: Math.abs(range.startOffset - fallbackStart),
      };
      if (
        !bestScore ||
        score.length > bestScore.length ||
        (score.length === bestScore.length && score.distance < bestScore.distance)
      ) {
        bestRange = {
          ...range,
          matchLength: fragment.length,
        };
        bestScore = score;
      }
    }
  }

  return bestRange;
}

function findClosestNormalizedRange(contentIndex, normalizedNeedle, fallbackStart) {
  const needle = normalizedNeedle.trim();
  if (!needle) {
    return null;
  }

  let bestStart = -1;
  let bestEnd = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let searchFrom = 0;
  while (searchFrom <= contentIndex.normalized.length) {
    const normalizedStart = contentIndex.normalized.indexOf(needle, searchFrom);
    if (normalizedStart === -1) {
      break;
    }

    const normalizedEnd = normalizedStart + needle.length - 1;
    const sourceStart = contentIndex.sourceOffsets[normalizedStart];
    const sourceEnd = contentIndex.sourceOffsets[normalizedEnd] + 1;
    const distance = Math.abs(sourceStart - fallbackStart);
    if (distance < bestDistance) {
      bestStart = sourceStart;
      bestEnd = sourceEnd;
      bestDistance = distance;
    }
    searchFrom = normalizedStart + Math.max(1, needle.length);
  }

  return bestStart >= 0
    ? {
        startOffset: bestStart,
        endOffset: Math.max(bestStart, bestEnd),
      }
    : null;
}

function createNormalizedTextMap(text) {
  let normalized = "";
  const sourceOffsets = [];
  let previousWasSpace = true;

  for (let sourceOffset = 0; sourceOffset < text.length; sourceOffset += 1) {
    const normalizedCharacter = normalizeSearchCharacter(text[sourceOffset]);
    if (normalizedCharacter === " ") {
      if (!previousWasSpace && normalized.length) {
        normalized += " ";
        sourceOffsets.push(sourceOffset);
        previousWasSpace = true;
      }
      continue;
    }

    normalized += normalizedCharacter;
    sourceOffsets.push(sourceOffset);
    previousWasSpace = false;
  }

  return {
    normalized: normalized.trimEnd(),
    sourceOffsets,
  };
}

function normalizeSearchText(value) {
  return createNormalizedTextMap(String(value ?? "")).normalized.trim();
}

function normalizeSearchCharacter(character) {
  return /[\p{L}\p{N}]/u.test(character)
    ? character.toLocaleLowerCase()
    : " ";
}

function clampTextOffset(value, textLength) {
  const numericValue = Number(value);
  const length = Math.max(0, Number(textLength) || 0);

  if (!Number.isInteger(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(numericValue, length));
}
