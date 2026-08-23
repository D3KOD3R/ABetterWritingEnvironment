// Intent: render narration take controls and saved audio metadata for the right-side console.
import { escapeHtml } from "../../shared/ui-utils.js";
import { normalizeNarrationFollowSettings } from "./narration-follow-settings-service.js";
import { formatNarrationRecordingLineLabel } from "./narration-recording-line-label.js";

export const NARRATION_AUDIO_PANEL_ID = "narration-audio";

// Intent: keep the narration workflow's audio controls close to its saved-take metadata.
export function renderNarrationMetadataPanelHTML({
  scene = null,
  selection = null,
  session = null,
  recordings = [],
  followSettings = {},
  playbackState = null,
} = {}) {
  const savedRecordings = Array.isArray(recordings) ? recordings : [];
  const sceneTitle = String(scene?.sceneTitle ?? "").trim() || "Selected scene";
  const normalizedFollowSettings = normalizeNarrationFollowSettings(followSettings);

  return `
    <section class="narration-metadata-panel" aria-label="Narration audio metadata">
      <div class="panel-heading narration-metadata-panel__heading">
        <div class="narration-metadata-panel__title">
          <p class="panel-kicker">Audio Metadata</p>
          <h2>${escapeHtml(sceneTitle)}</h2>
        </div>
        ${renderNarrationTransportActions(scene, selection, session, savedRecordings, playbackState)}
      </div>
      <div class="narration-metadata-panel__controls">
        ${renderNarrationRecordingTools(scene, selection, session, normalizedFollowSettings)}
      </div>
      <div class="narration-metadata-panel__takes-heading">
        <p class="panel-kicker">Saved Takes</p>
        <strong>${escapeHtml(String(savedRecordings.length))}</strong>
      </div>
      ${renderNarrationSavedTakes(scene, savedRecordings, playbackState)}
      ${renderNarrationTrackerMonitor(session)}
    </section>
  `;
}

function renderNarrationTransportActions(scene, selection, session, recordings, playbackState) {
  // Intent: keep active recording and latest-take actions in one compact header cluster.
  const sceneId = String(scene?.sceneId ?? "").trim();
  const primaryRecording = selectPrimaryNarrationRecording(recordings);
  const recordingId = String(primaryRecording?.id ?? "").trim();
  const playbackRecordingId = resolveActivePlaybackRecordingId(playbackState);
  const isRecording = session?.status === "recording";
  const isFinalizing = session?.status === "finalizing";
  const canStart = Boolean(sceneId && selection);
  const canPlay = Boolean(recordingId && primaryRecording?.status === "saved" && primaryRecording?.mediaPath);
  const canStop = Boolean(playbackRecordingId && recordings.some((recording) => recording?.id === playbackRecordingId));
  const recordAction = isRecording ? "stop-narration-recording" : "start-narration-recording";
  const recordLabel = isFinalizing
    ? "Finalizing recording"
    : isRecording
      ? "Stop recording"
      : "Start recording";

  return `
    <div class="narration-transport-actions" aria-label="Narration transport controls">
      <button
        class="tag-button editor-action-button narration-transport-button narration-transport-button--record ${isRecording ? "is-recording-stop" : ""}"
        type="button"
        data-action="${recordAction}"
        data-scene-id="${escapeHtml(sceneId)}"
        aria-label="${escapeHtml(recordLabel)}"
        title="${escapeHtml(recordLabel)}"
        ${isFinalizing ? "disabled" : isRecording ? "" : canStart ? "" : "disabled"}
      ><span aria-hidden="true"></span></button>
      <button
        class="tag-button editor-action-button narration-transport-button narration-transport-button--play"
        type="button"
        data-action="preview-voice-recording"
        data-recording-id="${escapeHtml(recordingId)}"
        aria-label="Play latest saved take"
        title="Play latest saved take"
        ${canPlay ? "" : "disabled"}
      ><span aria-hidden="true"></span></button>
      <button
        class="tag-button editor-action-button narration-transport-button narration-transport-button--stop"
        type="button"
        data-action="stop-voice-recording-preview"
        data-recording-id="${escapeHtml(playbackRecordingId)}"
        aria-label="Stop saved take playback"
        title="Stop saved take playback"
        ${canStop ? "" : "disabled"}
      ><span aria-hidden="true"></span></button>
      <button
        class="tag-button editor-action-button narration-transport-button narration-transport-button--delete"
        type="button"
        data-action="delete-voice-recording"
        data-recording-id="${escapeHtml(recordingId)}"
        aria-label="Delete latest saved take"
        title="Delete latest saved take"
        ${recordingId ? "" : "disabled"}
      ><span aria-hidden="true"></span></button>
    </div>
  `;
}

function resolveActivePlaybackRecordingId(playbackState) {
  const recordingId = typeof playbackState?.recordingId === "string" && playbackState.recordingId.trim()
    ? playbackState.recordingId.trim()
    : "";
  return recordingId && playbackState?.status === "playing" ? recordingId : "";
}

function selectPrimaryNarrationRecording(recordings) {
  const savedRecordings = Array.isArray(recordings) ? recordings.filter(Boolean) : [];
  if (!savedRecordings.length) {
    return null;
  }

  return savedRecordings.reduce((latest, candidate) => {
    const latestTime = Date.parse(latest?.updatedAt ?? latest?.createdAt ?? "") || 0;
    const candidateTime = Date.parse(candidate?.updatedAt ?? candidate?.createdAt ?? "") || 0;
    return candidateTime > latestTime ? candidate : latest;
  }, savedRecordings[0]);
}

function renderNarrationRecordingTools(scene, selection, session, followSettings) {
  // Intent: expose recording commands without coupling the panel to the recorder runtime.
  const selectionLineNumber = Number.isInteger(Number(selection?.displayLineNumber)) && Number(selection.displayLineNumber) > 0
    ? Number(selection.displayLineNumber)
    : Number.isInteger(Number(selection?.lineNumber ?? selection?.blockLineNumber)) && Number(selection?.lineNumber ?? selection?.blockLineNumber) > 0
      ? Number(selection.lineNumber ?? selection.blockLineNumber)
      : "";
  const statusLabel = session?.status === "recording"
    ? `Recording ${session.elapsedLabel ?? "0:00"}`
    : session?.status === "finalizing"
      ? "Finalizing recording"
      : selection
        ? "Ready to record"
        : "Awaiting verse selection";
  const verseLabel = selection
    ? `Line ${String(selectionLineNumber)} · ${selection.kindLabel ?? "Verse"}`
    : "Click a verse to arm recording";
  const trackerLabel = session?.trackerStatus
    ? session.trackerStatus
    : "Speech tracker idle";
  const trackerEngineLabel = session?.speechProviderLabel || session?.speechProviderId || "";
  return `
    <div class="editor-inline-setting narration-recording-field">
      <span>Status</span>
      <div class="narration-recording-value ${session?.status === "recording" ? "is-recording" : ""}" data-narration-status-value>${escapeHtml(statusLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Verse</span>
      <div class="narration-recording-value" data-narration-verse-value>${escapeHtml(verseLabel)}</div>
    </div>
    <div class="editor-inline-setting narration-recording-field">
      <span>Tracker</span>
      <div class="narration-recording-value" data-narration-tracker-value>${escapeHtml(trackerLabel)}</div>
    </div>
    ${trackerEngineLabel ? `
    <div class="editor-inline-setting narration-recording-field">
      <span>Tracker engine</span>
      <div class="narration-recording-value" data-narration-engine-value>${escapeHtml(trackerEngineLabel)}</div>
    </div>
    ` : ""}
    <label class="narration-follow-toggle">
      <input
        type="checkbox"
        data-action="toggle-narration-follow-scroll"
        ${followSettings.followScrollEnabled ? "checked" : ""}
      >
      <span>Follow scroll</span>
    </label>
    ${selection && session?.status !== "recording" && session?.status !== "finalizing" ? `
      <button
        class="tag-button editor-action-button narration-clear-selection-button"
        type="button"
        data-action="clear-narration-selection"
      >Clear armed line</button>
    ` : ""}
  `;
}

function renderNarrationTrackerMonitor(session) {
  const liveTranscriptLabel = resolveLiveTrackerTranscript(session);
  const whisperTranscriptLabel = resolveWhisperCleanupTranscript(session);
  return `
    <section class="narration-tracker-monitor" aria-label="Live speech tracker output">
      <div class="narration-tracker-monitor__row">
        <span>Live tracker</span>
        <p data-narration-live-transcript>${escapeHtml(liveTranscriptLabel)}</p>
      </div>
      <div class="narration-tracker-monitor__row">
        <span>Whisper post</span>
        <p data-narration-whisper-transcript>${escapeHtml(whisperTranscriptLabel)}</p>
      </div>
    </section>
  `;
}

function resolveLiveTrackerTranscript(session) {
  const liveTranscript = String(
    session?.liveTranscript ??
    session?.speechSnapshot?.changedTranscript ??
    (session?.status === "recording" ? session?.transcript : "") ??
    "",
  ).trim();
  return liveTranscript || "Waiting for local speech...";
}

function resolveWhisperCleanupTranscript(session) {
  const cleanupTranscript = String(
    session?.cleanupTranscript ??
    (session?.status === "recording" ? "" : session?.transcript) ??
    "",
  ).trim();
  return cleanupTranscript || "Runs after stop.";
}

function renderNarrationSavedTakes(scene, recordings, playbackState) {
  const savedRecordings = Array.isArray(recordings) ? recordings : [];
  if (!savedRecordings.length) {
    return `
      <section class="narration-saved-takes is-empty" aria-label="Saved narration takes">
        <span>No saved takes for this scene.</span>
      </section>
    `;
  }

  return `
    <section class="narration-saved-takes" aria-label="Saved narration takes">
      ${savedRecordings.map((recording) => renderNarrationSavedTake(scene, recording, playbackState)).join("")}
    </section>
  `;
}

function renderNarrationSavedTake(scene, recording, playbackState) {
  const status = recording.status === "failed" ? "Failed" : "Saved";
  const lineLabel = formatNarrationRecordingLineLabel(recording);
  const durationSeconds = Math.max(0, Math.round(Number(recording.durationMs ?? 0) / 1000));
  const durationLabel = durationSeconds > 0 ? `${durationSeconds}s` : "0s";
  const canPlay = recording.status === "saved" && recording.mediaPath;
  const isPlaying = playbackState?.status === "playing" && playbackState?.recordingId === recording.id;
  const isPreviewing = recording.styleToken === "narration-recording-active";

  return `
    <article
      class="narration-saved-take ${isPreviewing ? "is-previewing" : ""}"
      data-recording-id="${escapeHtml(recording.id)}"
      data-narration-recording-preview-id="${escapeHtml(recording.id)}"
      tabindex="0"
    >
      <div class="narration-saved-take__body">
        <strong>${escapeHtml(`${lineLabel} · ${durationLabel}`)}</strong>
        <span>${escapeHtml(`${status} · ${recording.verseText || scene?.sceneTitle || "Narration take"}`)}</span>
      </div>
      <div class="narration-saved-take__actions">
        <button
          class="tag-button editor-action-button"
          type="button"
          data-action="${isPlaying ? "stop-voice-recording-preview" : "preview-voice-recording"}"
          data-recording-id="${escapeHtml(recording.id)}"
          ${canPlay ? "" : "disabled"}
        >${isPlaying ? "Stop" : "Play"}</button>
        <button
          class="tag-button editor-action-button"
          type="button"
          data-action="re-record-voice-recording"
          data-recording-id="${escapeHtml(recording.id)}"
        >Select range</button>
        <button
          class="tag-button editor-action-button narration-saved-take__delete"
          type="button"
          data-action="delete-voice-recording"
          data-recording-id="${escapeHtml(recording.id)}"
          aria-label="${escapeHtml(`Delete ${lineLabel} narration take`)}"
          title="Delete recording"
        >Delete</button>
      </div>
    </article>
  `;
}
