// Intent: model and render opened saved-take review state without persisting UI playhead data.
import { escapeHtml } from "../../shared/ui-utils.js";
import {
  formatNarrationRecordingLineLabel,
  resolveNarrationRecordingLineRange,
} from "./narration-recording-line-label.js";
import {
  resolveNarrationRecordingAlignedWordTimings,
} from "./narration-recording-alignment-service.js";

export function createNarrationRecordingReviewState(recording, {
  currentTimeSeconds = 0,
  durationSeconds = null,
  waveformZoom = 1,
  selection = null,
} = {}) {
  const recordingId = normalizeRecordingId(recording?.id);
  if (!recordingId) {
    return null;
  }

  const duration = normalizeDurationSeconds(
    durationSeconds ?? getRecordingDurationSeconds(recording),
  );

  return {
    recordingId,
    currentTimeSeconds: clampPlaybackTime(currentTimeSeconds, duration),
    durationSeconds: duration,
    waveformZoom: normalizeWaveformZoom(waveformZoom),
    selection: normalizeNarrationReviewSelectionState(selection, duration),
  };
}

export function createNarrationRecordingReviewSelection({
  recording = null,
  scene = null,
  startOffset = null,
  endOffset = null,
  startTimeSeconds = null,
  endTimeSeconds = null,
  durationSeconds = 0,
  source = "word",
  selectedText = "",
  startWordIndex = null,
  endWordIndex = null,
} = {}) {
  const sceneText = typeof scene?.editorText === "string" ? scene.editorText : "";
  const recordingRange = resolveRecordingSceneRange(recording, scene);
  if (!sceneText || !recordingRange || recordingRange.endOffset <= recordingRange.startOffset) {
    return null;
  }

  const duration = normalizeDurationSeconds(durationSeconds || getRecordingDurationSeconds(recording));
  const rawOffsets = Number.isInteger(startOffset) && Number.isInteger(endOffset)
    ? {
      startOffset,
      endOffset,
    }
    : resolveReviewOffsetsFromTimeRange({
      recordingRange,
      durationSeconds: duration,
      startTimeSeconds,
      endTimeSeconds,
    });
  if (!rawOffsets) {
    return null;
  }

  const clampedStartOffset = clampInteger(rawOffsets.startOffset, recordingRange.startOffset, recordingRange.endOffset);
  const clampedEndOffset = clampInteger(rawOffsets.endOffset, recordingRange.startOffset, recordingRange.endOffset);
  const snappedRange = snapSceneOffsetRangeToWords(
    sceneText,
    Math.min(clampedStartOffset, clampedEndOffset),
    Math.max(clampedStartOffset, clampedEndOffset),
    recordingRange,
  );
  if (!snappedRange || snappedRange.endOffset <= snappedRange.startOffset) {
    return null;
  }

  const timedRange = resolveReviewTimeRangeFromOffsets({
    recordingRange,
    durationSeconds: duration,
    startOffset: snappedRange.startOffset,
    endOffset: snappedRange.endOffset,
    startTimeSeconds,
    endTimeSeconds,
  });

  return normalizeNarrationReviewSelectionState({
    source,
    startOffset: snappedRange.startOffset,
    endOffset: snappedRange.endOffset,
    startTimeSeconds: timedRange.startTimeSeconds,
    endTimeSeconds: timedRange.endTimeSeconds,
    selectedText: normalizeTranscript(selectedText) || sceneText.slice(snappedRange.startOffset, snappedRange.endOffset).trim(),
    startWordIndex,
    endWordIndex,
  }, duration);
}

export function createNarrationRecordingReviewModel({
  recording = null,
  scene = null,
  reviewState = null,
  playbackState = null,
  waveformState = null,
} = {}) {
  const recordingId = normalizeRecordingId(recording?.id);
  if (!recordingId) {
    return null;
  }

  const playbackApplies = normalizeRecordingId(playbackState?.recordingId) === recordingId;
  const playbackStatus = playbackApplies ? normalizePlaybackStatus(playbackState?.status) : "idle";
  const playbackIsActive = playbackApplies && (
    playbackState?.active === true ||
    playbackStatus === "playing" ||
    playbackStatus === "loading"
  );
  const durationSeconds = normalizeDurationSeconds(
    playbackApplies && Number(playbackState?.durationSeconds) > 0
      ? playbackState.durationSeconds
      : Number(reviewState?.durationSeconds) > 0
        ? reviewState.durationSeconds
        : getRecordingDurationSeconds(recording),
  );
  const currentTimeSeconds = clampPlaybackTime(
    playbackIsActive
      ? playbackState?.currentTimeSeconds
      : reviewState?.currentTimeSeconds,
    durationSeconds,
  );
  const transcript = normalizeTranscript(recording?.transcript);
  const transcriptWords = createTranscriptWordRecords(transcript, durationSeconds, recording?.transcriptAlignment);
  const matchedLines = createMatchedTranscriptLines({
    recording,
    scene,
    transcriptWords,
  });
  const cursor = createTranscriptCursor({
    transcriptWords,
    currentTimeSeconds,
    durationSeconds,
  });
  const selection = normalizeNarrationReviewSelectionState(reviewState?.selection, durationSeconds);
  const durationLabel = formatNarrationReviewTime(durationSeconds);
  const waveform = createNarrationReviewWaveformModel({
    waveformState,
    currentTimeSeconds,
    durationSeconds,
    waveformZoom: reviewState?.waveformZoom,
    selection,
  });

  return {
    recordingId,
    title: formatNarrationRecordingLineLabel(recording, "Saved take"),
    subtitle: normalizeTranscript(recording?.sceneTitle || ""),
    transcript,
    hasTranscript: Boolean(transcript),
    currentTimeSeconds,
    durationSeconds,
    currentTimeLabel: formatNarrationReviewTime(currentTimeSeconds),
    durationLabel,
    progressPercent: durationSeconds > 0
      ? Math.round((currentTimeSeconds / durationSeconds) * 100)
      : 0,
    playbackStatus,
    isPlaying: playbackApplies && playbackStatus === "playing",
    isPaused: playbackApplies && playbackStatus === "paused",
    canPlay: recording?.status === "saved" && Boolean(recording?.mediaPath),
    canRerecord: Boolean(recording?.sceneId && recording?.blockId),
    canRerecordSelection: Boolean(recording?.sceneId && recording?.blockId && selection),
    cursor,
    matchedLines,
    transcriptWords,
    selection,
    waveform,
  };
}

export function renderNarrationRecordingReviewHTML({
  recording = null,
  scene = null,
  reviewState = null,
  playbackState = null,
  waveformState = null,
} = {}) {
  const model = createNarrationRecordingReviewModel({
    recording,
    scene,
    reviewState,
    playbackState,
    waveformState,
  });
  if (!model) {
    return "";
  }

  return `
    <section
      class="narration-recording-review"
      data-narration-recording-review
      data-recording-id="${escapeHtml(model.recordingId)}"
      aria-label="Opened narration take"
    >
      <div class="narration-recording-review__header">
        <div class="narration-recording-review__title">
          <p class="panel-kicker">Opened Take</p>
          <h3>${escapeHtml(model.title)}</h3>
          ${model.subtitle ? `<span>${escapeHtml(model.subtitle)}</span>` : ""}
        </div>
        <div class="narration-recording-review__actions">
          <button
            class="tag-button editor-action-button"
            type="button"
            data-action="re-record-voice-recording-selection"
            data-recording-id="${escapeHtml(model.recordingId)}"
            ${model.canRerecordSelection ? "" : "disabled"}
            title="Select words or drag the oscillogram before recording the replacement take."
          >Re-record selection</button>
          <button
            class="tag-button editor-action-button"
            type="button"
            data-action="preview-voice-recording"
            data-recording-id="${escapeHtml(model.recordingId)}"
            ${model.canPlay ? "" : "disabled"}
          >Play from cursor</button>
          <button
            class="tag-button editor-action-button"
            type="button"
            data-action="stop-voice-recording-preview"
            data-recording-id="${escapeHtml(model.recordingId)}"
            ${model.isPlaying || model.isPaused ? "" : "disabled"}
          >Stop</button>
          <button
            class="tag-button editor-action-button"
            type="button"
            data-action="close-narration-recording-review"
            data-recording-id="${escapeHtml(model.recordingId)}"
            aria-label="Close opened narration take"
          >Close</button>
        </div>
      </div>
      ${renderNarrationRecordingReviewWaveformHTML(model)}
      <div class="narration-recording-review__seek">
        <span data-narration-review-current-time>${escapeHtml(model.currentTimeLabel)}</span>
        <input
          type="range"
          min="0"
          max="${escapeHtml(String(Math.max(0, model.durationSeconds)))}"
          step="0.1"
          value="${escapeHtml(String(model.currentTimeSeconds))}"
          data-narration-review-seek
          data-recording-id="${escapeHtml(model.recordingId)}"
          aria-label="Narration take position"
        />
        <span data-narration-review-duration>${escapeHtml(model.durationLabel)}</span>
        <strong data-narration-review-progress>${escapeHtml(`${model.progressPercent}%`)}</strong>
      </div>
      <div class="narration-recording-review__transcript" data-narration-review-transcript>
        ${renderNarrationRecordingReviewTranscriptHTML(model)}
      </div>
    </section>
  `;
}

export function renderNarrationRecordingReviewWaveformHTML(model) {
  const waveform = model?.waveform ?? createNarrationReviewWaveformModel();
  const bars = waveform.hasPeaks
    ? waveform.peaks.map((peak, index) => `
        <span
          class="narration-recording-review__waveform-bar"
          data-waveform-peak-index="${escapeHtml(String(waveform.startPeakIndex + index))}"
          style="--waveform-peak:${escapeHtml(`${Math.max(4, Math.round(peak * 100))}%`)}"
        ></span>
      `).join("")
    : `<span class="narration-recording-review__waveform-placeholder">${escapeHtml(waveform.statusLabel)}</span>`;

  return `
    <div class="narration-recording-review__waveform-panel" data-narration-review-waveform-panel>
      <div class="narration-recording-review__waveform-toolbar">
        <span data-narration-review-waveform-start>${escapeHtml(waveform.startTimeLabel)}</span>
        <label>
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="8"
            step="0.5"
            value="${escapeHtml(String(waveform.zoom))}"
            data-narration-review-waveform-zoom
            data-recording-id="${escapeHtml(model?.recordingId ?? "")}"
            aria-label="Narration take waveform zoom"
          />
          <strong data-narration-review-waveform-zoom-label>${escapeHtml(`${waveform.zoomLabel}x`)}</strong>
        </label>
        <span data-narration-review-waveform-end>${escapeHtml(waveform.endTimeLabel)}</span>
      </div>
      <button
        class="narration-recording-review__waveform"
        type="button"
        data-action="seek-narration-recording-waveform"
        data-narration-review-waveform
        data-recording-id="${escapeHtml(model?.recordingId ?? "")}"
        data-waveform-start="${escapeHtml(String(waveform.startTimeSeconds))}"
        data-waveform-end="${escapeHtml(String(waveform.endTimeSeconds))}"
        style="--waveform-cursor:${escapeHtml(String(waveform.cursorPercent))}%;--waveform-selection-start:${escapeHtml(String(waveform.selectionStartPercent))}%;--waveform-selection-width:${escapeHtml(String(waveform.selectionWidthPercent))}%"
        aria-label="Narration take oscillogram"
        data-waveform-duration="${escapeHtml(String(Math.max(0, waveform.durationSeconds)))}"
        data-waveform-current-time="${escapeHtml(String(Math.max(0, model?.currentTimeSeconds ?? 0)))}"
      >
        <span class="narration-recording-review__waveform-grid" aria-hidden="true"></span>
        <span class="narration-recording-review__waveform-bars" aria-hidden="true">${bars}</span>
        ${waveform.hasSelection ? `<span class="narration-recording-review__waveform-selection" aria-hidden="true"></span>` : ""}
        <span class="narration-recording-review__waveform-cursor" aria-hidden="true"></span>
      </button>
    </div>
  `;
}

export function renderNarrationRecordingReviewTranscriptHTML(model) {
  const matchedLines = Array.isArray(model?.matchedLines) ? model.matchedLines : [];
  const hasReviewWords = matchedLines.some((line) => Array.isArray(line.words) && line.words.length > 0);
  if (!hasReviewWords && !model?.hasTranscript) {
    return `
      <p class="narration-recording-review__empty">Transcript pending.</p>
    `;
  }

  return `
    <div class="narration-recording-review__line-list">
      ${matchedLines.map((line) => renderMatchedTranscriptLineHTML(line, model)).join("")}
    </div>
  `;
}

export function formatNarrationReviewTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createNarrationReviewWaveformModel({
  waveformState = null,
  currentTimeSeconds = 0,
  durationSeconds = 0,
  waveformZoom = 1,
  selection = null,
} = {}) {
  const peaks = normalizeWaveformPeaks(waveformState?.peaks);
  const status = normalizeWaveformStatus(waveformState?.status, peaks);
  const duration = normalizeDurationSeconds(durationSeconds || waveformState?.durationSeconds);
  const zoom = normalizeWaveformZoom(waveformZoom);
  const currentTime = clampPlaybackTime(currentTimeSeconds, duration);
  const windowDuration = duration > 0
    ? Math.max(0.1, duration / zoom)
    : 0;
  const maxStartTime = Math.max(0, duration - windowDuration);
  const startTimeSeconds = duration > 0 && zoom > 1
    ? Math.min(maxStartTime, Math.max(0, currentTime - (windowDuration / 2)))
    : 0;
  const endTimeSeconds = duration > 0
    ? Math.min(duration, startTimeSeconds + windowDuration)
    : 0;
  const startPeakIndex = duration > 0 && peaks.length
    ? Math.max(0, Math.min(peaks.length - 1, Math.floor((startTimeSeconds / duration) * peaks.length)))
    : 0;
  const endPeakIndex = duration > 0 && peaks.length
    ? Math.max(startPeakIndex + 1, Math.min(peaks.length, Math.ceil((endTimeSeconds / duration) * peaks.length)))
    : peaks.length;
  const visiblePeaks = peaks.slice(startPeakIndex, endPeakIndex);
  const cursorPercent = endTimeSeconds > startTimeSeconds
    ? Math.max(0, Math.min(100, ((currentTime - startTimeSeconds) / (endTimeSeconds - startTimeSeconds)) * 100))
    : 0;
  const selectionStartSeconds = normalizeNullableSeconds(selection?.startTimeSeconds);
  const selectionEndSeconds = normalizeNullableSeconds(selection?.endTimeSeconds);
  const hasSelection = selectionStartSeconds !== null &&
    selectionEndSeconds !== null &&
    selectionEndSeconds > startTimeSeconds &&
    selectionStartSeconds < endTimeSeconds;
  const visibleSelectionStartSeconds = hasSelection
    ? Math.max(startTimeSeconds, selectionStartSeconds)
    : startTimeSeconds;
  const visibleSelectionEndSeconds = hasSelection
    ? Math.min(endTimeSeconds, selectionEndSeconds)
    : startTimeSeconds;
  const selectionStartPercent = hasSelection && endTimeSeconds > startTimeSeconds
    ? ((visibleSelectionStartSeconds - startTimeSeconds) / (endTimeSeconds - startTimeSeconds)) * 100
    : 0;
  const selectionWidthPercent = hasSelection && endTimeSeconds > startTimeSeconds
    ? ((visibleSelectionEndSeconds - visibleSelectionStartSeconds) / (endTimeSeconds - startTimeSeconds)) * 100
    : 0;

  return {
    status,
    statusLabel: formatWaveformStatusLabel(status),
    peaks: visiblePeaks,
    hasPeaks: visiblePeaks.length > 0,
    startPeakIndex,
    durationSeconds: duration,
    startTimeSeconds,
    endTimeSeconds,
    startTimeLabel: formatNarrationReviewTime(startTimeSeconds),
    endTimeLabel: formatNarrationReviewTime(endTimeSeconds || duration),
    cursorPercent: Math.round(cursorPercent * 10) / 10,
    hasSelection,
    selectionStartPercent: Math.round(Math.max(0, Math.min(100, selectionStartPercent)) * 10) / 10,
    selectionWidthPercent: Math.round(Math.max(0, Math.min(100, selectionWidthPercent)) * 10) / 10,
    zoom,
    zoomLabel: formatWaveformZoomLabel(zoom),
  };
}

function normalizeWaveformPeaks(peaks) {
  return (Array.isArray(peaks) ? peaks : [])
    .map((peak) => Math.max(0, Math.min(1, Number(peak) || 0)))
    .filter((peak) => Number.isFinite(peak));
}

function normalizeWaveformStatus(status, peaks) {
  const normalizedStatus = typeof status === "string" && status.trim() ? status.trim() : "";
  if (["idle", "loading", "ready", "unavailable", "error"].includes(normalizedStatus)) {
    return normalizedStatus;
  }
  return peaks.length ? "ready" : "idle";
}

function formatWaveformStatusLabel(status) {
  if (status === "loading") {
    return "Preparing oscillogram...";
  }
  if (status === "error") {
    return "Oscillogram unavailable.";
  }
  if (status === "unavailable") {
    return "Oscillogram unavailable.";
  }
  return "Open or play the take to build the oscillogram.";
}

function normalizeWaveformZoom(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.max(1, Math.min(8, Math.round(number * 2) / 2))
    : 1;
}

function formatWaveformZoomLabel(value) {
  const number = normalizeWaveformZoom(value);
  return Number.isInteger(number)
    ? String(number)
    : String(number).replace(/\.0$/, "");
}

function renderMatchedTranscriptLineHTML(line, model) {
  const lineLabel = line.lineNumber ? `Line ${line.lineNumber}` : "Matched passage";
  const hasWords = Array.isArray(line.words) && line.words.length > 0;
  return `
    <article class="narration-recording-review__line">
      <div class="narration-recording-review__line-heading">
        <span>${escapeHtml(lineLabel)}</span>
        ${line.manuscriptText && !hasWords ? `<p>${escapeHtml(line.manuscriptText)}</p>` : ""}
      </div>
      ${hasWords ? `
        <p class="narration-recording-review__words">
          ${line.words.map((word) => renderTranscriptWordButtonHTML(word, model)).join("")}
        </p>
      ` : ""}
    </article>
  `;
}

function renderTranscriptWordButtonHTML(word, model) {
  const isCurrent = word.index === model.cursor.wordIndex;
  const isSelected = isTranscriptWordSelected(word, model.selection);
  const className = [
    "narration-recording-review__word",
    isCurrent ? "is-current" : "",
    isSelected ? "is-selected" : "",
  ].filter(Boolean).join(" ");
  const timeLabel = formatNarrationReviewTime(word.timeSeconds);
  return `
    <button
      class="${escapeHtml(className)}"
      type="button"
      data-action="seek-narration-recording-word"
      data-recording-id="${escapeHtml(model.recordingId)}"
      data-review-word-index="${escapeHtml(String(word.index))}"
      data-review-word-time="${escapeHtml(String(word.timeSeconds))}"
      data-review-word-end-time="${escapeHtml(String(word.endTimeSeconds ?? word.timeSeconds))}"
      data-review-word-timing-source="${escapeHtml(String(word.timingSource ?? ""))}"
      data-review-word-start-offset="${escapeHtml(String(word.startOffset ?? ""))}"
      data-review-word-end-offset="${escapeHtml(String(word.endOffset ?? ""))}"
      title="${escapeHtml(`Jump to ${timeLabel}. Shift-click to select for re-recording.`)}"
    >${escapeHtml(word.text)}</button>
  `;
}

function isTranscriptWordSelected(word, selection) {
  if (!selection) {
    return false;
  }

  const startWordIndex = normalizeNullableInteger(selection.startWordIndex);
  const endWordIndex = normalizeNullableInteger(selection.endWordIndex);
  if (Number.isInteger(word?.index) && startWordIndex !== null && endWordIndex !== null) {
    return word.index >= Math.min(startWordIndex, endWordIndex) &&
      word.index <= Math.max(startWordIndex, endWordIndex);
  }

  if (!Number.isInteger(word?.startOffset) || !Number.isInteger(word?.endOffset)) {
    return false;
  }

  return word.startOffset < selection.endOffset && word.endOffset > selection.startOffset;
}

function renderMatchedManuscriptFallbackHTML(model) {
  const lines = Array.isArray(model?.matchedLines) ? model.matchedLines : [];
  if (!lines.length) {
    return "";
  }

  return `
    <div class="narration-recording-review__line-list">
      ${lines.map((line) => `
        <article class="narration-recording-review__line">
          <div class="narration-recording-review__line-heading">
            <span>${escapeHtml(line.lineNumber ? `Line ${line.lineNumber}` : "Matched passage")}</span>
            ${line.manuscriptText ? `<p>${escapeHtml(line.manuscriptText)}</p>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function createTranscriptCursor({
  transcriptWords = [],
  currentTimeSeconds = 0,
  durationSeconds = 0,
} = {}) {
  const words = Array.isArray(transcriptWords) ? transcriptWords : [];
  const timingSummary = createTranscriptCursorTimingSummary(words);
  if (!words.length) {
    return {
      beforeWords: [],
      currentWords: [],
      afterWords: [],
      wordIndex: -1,
      wordCount: 0,
      timingResolution: {
        strategy: "none",
        reason: "no-transcript-words",
        usedDurationFallback: false,
        currentTimeSeconds: 0,
        fallbackRatio: 0,
        ...timingSummary,
      },
    };
  }

  const currentTime = clampPlaybackTime(currentTimeSeconds, durationSeconds);
  const fallbackRatio = durationSeconds > 0
    ? Math.max(0, Math.min(1, currentTime / durationSeconds))
    : 0;
  let timingStrategy = "exact-range";
  let timingReason = "";
  let wordIndex = words.findIndex((word) => {
    const wordStartTime = normalizeNullableSeconds(word.timeSeconds) ?? 0;
    const wordEndTime = normalizeNullableSeconds(word.endTimeSeconds);
    return currentTime >= wordStartTime &&
      (wordEndTime === null || currentTime < wordEndTime);
  });
  if (wordIndex < 0) {
    timingStrategy = "previous-start";
    timingReason = currentTime < (timingSummary.firstTimedWord?.timeSeconds ?? 0)
      ? "before-first-timed-word"
      : "between-timed-words";
    for (let index = words.length - 1; index >= 0; index -= 1) {
      const wordStartTime = normalizeNullableSeconds(words[index].timeSeconds) ?? 0;
      if (wordStartTime <= currentTime) {
        wordIndex = index;
        break;
      }
    }
  }
  if (wordIndex < 0) {
    timingStrategy = "duration-ratio";
    timingReason = timingReason || "no-timed-word-at-current-time";
    wordIndex = Math.min(words.length - 1, Math.floor(fallbackRatio * words.length));
  }
  const currentEndIndex = Math.min(words.length, wordIndex + 3);
  const beforeStartIndex = Math.max(0, wordIndex - 18);
  const afterEndIndex = Math.min(words.length, currentEndIndex + 18);
  const resolvedWord = words[wordIndex] ?? null;

  return {
    beforeWords: words.slice(beforeStartIndex, wordIndex).map((word) => word.text),
    currentWords: words.slice(wordIndex, currentEndIndex).map((word) => word.text),
    afterWords: words.slice(currentEndIndex, afterEndIndex).map((word) => word.text),
    wordIndex,
    wordCount: words.length,
    timingResolution: {
      strategy: timingStrategy,
      reason: timingReason,
      usedDurationFallback: timingStrategy === "duration-ratio",
      currentTimeSeconds: currentTime,
      fallbackRatio,
      resolvedWordIndex: wordIndex,
      resolvedWordText: resolvedWord?.text ?? "",
      resolvedWordTimeSeconds: normalizeNullableSeconds(resolvedWord?.timeSeconds),
      resolvedWordEndTimeSeconds: normalizeNullableSeconds(resolvedWord?.endTimeSeconds),
      resolvedWordTimingSource: normalizeTranscript(resolvedWord?.timingSource),
      ...timingSummary,
    },
  };
}

// Intent: expose enough cursor timing context for the shell to log why review playback fell back from model timings.
function createTranscriptCursorTimingSummary(words) {
  const timedWords = (Array.isArray(words) ? words : [])
    .map((word, index) => ({
      index,
      text: normalizeTranscript(word?.text),
      timeSeconds: normalizeNullableSeconds(word?.timeSeconds),
      endTimeSeconds: normalizeNullableSeconds(word?.endTimeSeconds),
      timingSource: normalizeTranscript(word?.timingSource),
    }))
    .filter((word) => word.timeSeconds !== null)
    .sort((left, right) => left.timeSeconds - right.timeSeconds);
  const firstTimedWord = timedWords[0] ?? null;
  const lastTimedWord = timedWords.reduce((latest, word) => {
    if (!latest) {
      return word;
    }
    const latestEnd = normalizeNullableSeconds(latest.endTimeSeconds) ?? normalizeNullableSeconds(latest.timeSeconds) ?? 0;
    const wordEnd = normalizeNullableSeconds(word.endTimeSeconds) ?? normalizeNullableSeconds(word.timeSeconds) ?? 0;
    return wordEnd >= latestEnd ? word : latest;
  }, null);
  const timingSourceCounts = {};
  let providerTimedWordCount = 0;
  for (const word of timedWords) {
    const source = word.timingSource || "unknown";
    timingSourceCounts[source] = (timingSourceCounts[source] ?? 0) + 1;
    if (source && source !== "duration-estimate") {
      providerTimedWordCount += 1;
    }
  }

  return {
    timedWordCount: timedWords.length,
    providerTimedWordCount,
    timingSourceCounts,
    firstTimedWord,
    lastTimedWord,
  };
}

function createTranscriptWordRecords(transcript, durationSeconds, transcriptAlignment = null) {
  const words = splitTranscriptWords(transcript);
  const duration = normalizeDurationSeconds(durationSeconds);
  const alignedWordTimings = resolveNarrationRecordingAlignedWordTimings({
    transcript,
    transcriptWords: words,
    durationSeconds: duration,
    transcriptAlignment,
  });
  if (alignedWordTimings.length === words.length) {
    return alignedWordTimings.map((word, index) => ({
      index,
      text: word.text,
      timeSeconds: word.timeSeconds,
      endTimeSeconds: word.endTimeSeconds,
      timingSource: word.timingSource,
      timingConfidence: word.timingConfidence,
    }));
  }

  return words.map((word, index) => ({
    index,
    text: word,
    timeSeconds: duration > 0 && words.length > 0
      ? (index / words.length) * duration
      : 0,
    endTimeSeconds: duration > 0 && words.length > 0
      ? ((index + 1) / words.length) * duration
      : 0,
    timingSource: "duration-estimate",
  }));
}

// Intent: keep displayed review words sourced from the saved take transcript while manuscript text only labels the anchor.
function createMatchedTranscriptLines({
  recording,
  scene,
  transcriptWords = [],
} = {}) {
  const manuscriptLines = createMatchedManuscriptLines(recording, scene);
  const words = Array.isArray(transcriptWords) ? transcriptWords : [];
  if (words.length) {
    const primaryLine = manuscriptLines[0] ?? {};
    return [{
      id: primaryLine.id ? `${primaryLine.id}-whisper-transcript` : "recording-whisper-transcript",
      lineNumber: primaryLine.lineNumber ?? resolveRecordingLineNumber(recording),
      manuscriptText: "",
      startOffset: Number.isInteger(primaryLine.startOffset) ? primaryLine.startOffset : null,
      endOffset: Number.isInteger(primaryLine.endOffset) ? primaryLine.endOffset : null,
      words,
    }];
  }

  return manuscriptLines.map((line) => ({
    ...line,
    words: [],
  }));
}

function createMatchedManuscriptLines(recording, scene) {
  const sceneText = typeof scene?.editorText === "string" ? scene.editorText : "";
  const startOffset = Number.isInteger(recording?.startOffset) ? Math.max(0, recording.startOffset) : null;
  const endOffset = Number.isInteger(recording?.endOffset) && startOffset !== null && recording.endOffset > startOffset
    ? Math.min(sceneText.length, recording.endOffset)
    : null;
  const baseLineNumber = resolveRecordingLineNumber(recording);

  if (sceneText && startOffset !== null && endOffset !== null && endOffset > startOffset) {
    const lines = [];
    let lineStartOffset = 0;
    const rawLines = sceneText.split("\n");

    for (let index = 0; index < rawLines.length; index += 1) {
      const rawLine = rawLines[index];
      const lineEndOffset = lineStartOffset + rawLine.length;
      const intersects = startOffset < lineEndOffset && endOffset > lineStartOffset;
      if (intersects) {
        const sliceStart = Math.max(0, startOffset - lineStartOffset);
        const sliceEnd = Math.min(rawLine.length, endOffset - lineStartOffset);
        const manuscriptText = rawLine.slice(sliceStart, sliceEnd).replace(/\s+/g, " ").trim();
        if (manuscriptText) {
          lines.push({
            id: `manuscript-line-${index}`,
            lineNumber: baseLineNumber ? baseLineNumber + lines.length : index + 1,
            manuscriptText,
            startOffset: lineStartOffset + sliceStart + countLeadingWhitespace(rawLine.slice(sliceStart, sliceEnd)),
            endOffset: lineStartOffset + sliceEnd - countTrailingWhitespace(rawLine.slice(sliceStart, sliceEnd)),
          });
        }
      }
      lineStartOffset = lineEndOffset + 1;
    }

    if (lines.length) {
      return lines;
    }
  }

  const blockText = Array.isArray(scene?.blocks)
    ? normalizeTranscript(scene.blocks.find((block) => block?.blockId === recording?.blockId)?.text)
    : "";
  const fallbackText = normalizeTranscript(recording?.verseText || blockText);
  const fallbackRange = resolveRecordingSceneRange(recording, scene);
  return fallbackText
    ? [{
      id: "recording-verse",
      lineNumber: baseLineNumber,
      manuscriptText: fallbackText,
      startOffset: fallbackRange?.startOffset ?? null,
      endOffset: fallbackRange?.endOffset ?? null,
    }]
    : [];
}

function createManuscriptWordRecordsForLine(line, {
  durationSeconds = 0,
  recordingRange = null,
  sceneText = "",
  startIndex = 0,
} = {}) {
  const absoluteLineStart = Number.isInteger(line?.startOffset) ? line.startOffset : null;
  const absoluteLineEnd = Number.isInteger(line?.endOffset) ? line.endOffset : null;
  const sourceText = absoluteLineStart !== null && absoluteLineEnd !== null && sceneText
    ? sceneText.slice(absoluteLineStart, absoluteLineEnd)
    : String(line?.manuscriptText ?? "");
  const sourceOffset = absoluteLineStart ?? 0;
  const tokens = tokenizeReviewWords(sourceText, sourceOffset);
  const duration = normalizeDurationSeconds(durationSeconds);
  const rangeStart = Number.isInteger(recordingRange?.startOffset)
    ? recordingRange.startOffset
    : sourceOffset;
  const rangeEnd = Number.isInteger(recordingRange?.endOffset) && recordingRange.endOffset > rangeStart
    ? recordingRange.endOffset
    : sourceOffset + sourceText.length;
  const rangeLength = Math.max(1, rangeEnd - rangeStart);
  const fallbackWordCount = Math.max(1, tokens.length);

  return tokens.map((token, tokenIndex) => {
    const index = startIndex + tokenIndex;
    const startRatio = Math.max(0, Math.min(1, (token.startOffset - rangeStart) / rangeLength));
    const endRatio = Math.max(startRatio, Math.min(1, (token.endOffset - rangeStart) / rangeLength));
    return {
      index,
      text: token.text,
      startOffset: token.startOffset,
      endOffset: token.endOffset,
      timeSeconds: duration > 0
        ? startRatio * duration
        : tokenIndex / fallbackWordCount,
      endTimeSeconds: duration > 0
        ? endRatio * duration
        : (tokenIndex + 1) / fallbackWordCount,
    };
  });
}

function resolveReviewOffsetsFromTimeRange({
  recordingRange = null,
  durationSeconds = 0,
  startTimeSeconds = null,
  endTimeSeconds = null,
} = {}) {
  const startTime = normalizeNullableSeconds(startTimeSeconds);
  const endTime = normalizeNullableSeconds(endTimeSeconds);
  const duration = normalizeDurationSeconds(durationSeconds);
  if (!recordingRange || startTime === null || endTime === null || duration <= 0) {
    return null;
  }

  const rangeLength = recordingRange.endOffset - recordingRange.startOffset;
  const startRatio = Math.max(0, Math.min(1, Math.min(startTime, endTime) / duration));
  const endRatio = Math.max(0, Math.min(1, Math.max(startTime, endTime) / duration));
  return {
    startOffset: recordingRange.startOffset + Math.round(rangeLength * startRatio),
    endOffset: recordingRange.startOffset + Math.round(rangeLength * endRatio),
  };
}

function resolveReviewTimeRangeFromOffsets({
  recordingRange = null,
  durationSeconds = 0,
  startOffset = null,
  endOffset = null,
  startTimeSeconds = null,
  endTimeSeconds = null,
} = {}) {
  const duration = normalizeDurationSeconds(durationSeconds);
  const suppliedStartTime = normalizeNullableSeconds(startTimeSeconds);
  const suppliedEndTime = normalizeNullableSeconds(endTimeSeconds);
  if (!recordingRange || duration <= 0 || recordingRange.endOffset <= recordingRange.startOffset) {
    return {
      startTimeSeconds: suppliedStartTime ?? 0,
      endTimeSeconds: suppliedEndTime ?? suppliedStartTime ?? 0,
    };
  }

  const rangeLength = recordingRange.endOffset - recordingRange.startOffset;
  const resolvedStartTime = suppliedStartTime ?? (
    Math.max(0, Math.min(1, (startOffset - recordingRange.startOffset) / rangeLength)) * duration
  );
  const resolvedEndTime = suppliedEndTime ?? (
    Math.max(0, Math.min(1, (endOffset - recordingRange.startOffset) / rangeLength)) * duration
  );

  return {
    startTimeSeconds: Math.min(resolvedStartTime, resolvedEndTime),
    endTimeSeconds: Math.max(resolvedStartTime, resolvedEndTime),
  };
}

function snapSceneOffsetRangeToWords(sceneText, startOffset, endOffset, recordingRange) {
  const rangeStart = Number.isInteger(recordingRange?.startOffset) ? recordingRange.startOffset : 0;
  const rangeEnd = Number.isInteger(recordingRange?.endOffset) && recordingRange.endOffset > rangeStart
    ? recordingRange.endOffset
    : String(sceneText ?? "").length;
  const tokens = tokenizeReviewWords(String(sceneText ?? "").slice(rangeStart, rangeEnd), rangeStart);
  if (!tokens.length) {
    return null;
  }

  const selectedTokens = tokens.filter((token) => token.endOffset > startOffset && token.startOffset < endOffset);
  if (selectedTokens.length) {
    return {
      startOffset: selectedTokens[0].startOffset,
      endOffset: selectedTokens[selectedTokens.length - 1].endOffset,
    };
  }

  const nearestToken = tokens.reduce((nearest, token) => {
    const tokenCenter = token.startOffset + ((token.endOffset - token.startOffset) / 2);
    const nearestCenter = nearest.startOffset + ((nearest.endOffset - nearest.startOffset) / 2);
    return Math.abs(tokenCenter - startOffset) < Math.abs(nearestCenter - startOffset)
      ? token
      : nearest;
  }, tokens[0]);
  return {
    startOffset: nearestToken.startOffset,
    endOffset: nearestToken.endOffset,
  };
}

function tokenizeReviewWords(text, sourceOffset = 0) {
  const source = String(text ?? "");
  const words = [];
  const wordPattern = /\S+/g;
  let match = wordPattern.exec(source);
  while (match) {
    words.push({
      text: match[0],
      startOffset: sourceOffset + match.index,
      endOffset: sourceOffset + match.index + match[0].length,
    });
    match = wordPattern.exec(source);
  }
  return words;
}

function resolveRecordingSceneRange(recording, scene) {
  const sceneText = typeof scene?.editorText === "string" ? scene.editorText : "";
  const sceneLength = sceneText.length;
  const blockRanges = createSceneBlockRanges(scene);
  const blockRange = blockRanges.find((block) => block.blockId === recording?.blockId) ?? blockRanges[0] ?? null;
  const fallbackStart = Number.isInteger(blockRange?.startOffset) ? blockRange.startOffset : 0;
  const fallbackEnd = Number.isInteger(blockRange?.endOffset) && blockRange.endOffset > fallbackStart
    ? blockRange.endOffset
    : sceneLength;
  const rawStartOffset = Number.isInteger(recording?.startOffset)
    ? recording.startOffset
    : fallbackStart;
  const rawEndOffset = Number.isInteger(recording?.endOffset) && recording.endOffset > rawStartOffset
    ? recording.endOffset
    : fallbackEnd;
  const maxOffset = Math.max(sceneLength, fallbackEnd, rawEndOffset, rawStartOffset, 0);
  const startOffset = clampInteger(rawStartOffset, 0, maxOffset);
  const endOffset = clampInteger(rawEndOffset, startOffset, maxOffset);
  return endOffset > startOffset
    ? { startOffset, endOffset }
    : null;
}

function createSceneBlockRanges(scene) {
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

function normalizeNarrationReviewSelectionState(selection, durationSeconds = 0) {
  const startOffset = normalizeNullableInteger(selection?.startOffset);
  const endOffset = normalizeNullableInteger(selection?.endOffset);
  if (startOffset === null || endOffset === null || endOffset <= startOffset) {
    return null;
  }

  const duration = normalizeDurationSeconds(durationSeconds);
  const startTime = normalizeNullableSeconds(selection?.startTimeSeconds);
  const endTime = normalizeNullableSeconds(selection?.endTimeSeconds);
  const source = ["word", "waveform"].includes(selection?.source) ? selection.source : "word";
  const normalizedSelection = {
    source,
    startOffset,
    endOffset,
    startTimeSeconds: duration > 0
      ? clampPlaybackTime(startTime ?? 0, duration)
      : startTime ?? 0,
    endTimeSeconds: duration > 0
      ? clampPlaybackTime(endTime ?? startTime ?? 0, duration)
      : endTime ?? startTime ?? 0,
    selectedText: normalizeTranscript(selection?.selectedText),
  };
  const startWordIndex = normalizeNullableInteger(selection?.startWordIndex);
  const endWordIndex = normalizeNullableInteger(selection?.endWordIndex);
  if (startWordIndex !== null && endWordIndex !== null) {
    normalizedSelection.startWordIndex = Math.min(startWordIndex, endWordIndex);
    normalizedSelection.endWordIndex = Math.max(startWordIndex, endWordIndex);
  }
  return normalizedSelection;
}

function splitTranscriptWords(value) {
  const transcript = normalizeTranscript(value);
  return transcript ? transcript.split(" ").filter(Boolean) : [];
}

function normalizeTranscript(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeRecordingId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getRecordingDurationSeconds(recording) {
  const durationMs = Number(recording?.durationMs);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
}

function normalizeDurationSeconds(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizeNullableSeconds(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function clampInteger(value, min, max) {
  const number = Number(value);
  const lower = Number.isInteger(min) ? min : 0;
  const upper = Number.isInteger(max) && max >= lower ? max : lower;
  if (!Number.isFinite(number)) {
    return lower;
  }
  return Math.max(lower, Math.min(upper, Math.round(number)));
}

function clampPlaybackTime(value, durationSeconds = 0) {
  const number = Number(value);
  const currentTimeSeconds = Number.isFinite(number) && number > 0 ? number : 0;
  return durationSeconds > 0
    ? Math.min(currentTimeSeconds, durationSeconds)
    : currentTimeSeconds;
}

function normalizePlaybackStatus(value) {
  const status = typeof value === "string" ? value.trim() : "";
  return ["idle", "loading", "playing", "paused", "stopped", "ended", "error"].includes(status)
    ? status
    : "idle";
}

function countLeadingWhitespace(value) {
  const match = String(value ?? "").match(/^\s*/);
  return match ? match[0].length : 0;
}

function countTrailingWhitespace(value) {
  const match = String(value ?? "").match(/\s*$/);
  return match ? match[0].length : 0;
}

function resolveRecordingLineNumber(recording) {
  const lineRange = resolveNarrationRecordingLineRange(recording);
  if (lineRange?.startLineNumber) {
    return lineRange.startLineNumber;
  }

  const displayLineNumber = Number(recording?.displayLineNumber);
  if (Number.isInteger(displayLineNumber) && displayLineNumber > 0) {
    return displayLineNumber;
  }

  const lineNumber = Number(recording?.lineNumber);
  return Number.isInteger(lineNumber) && lineNumber > 0 ? lineNumber : null;
}
