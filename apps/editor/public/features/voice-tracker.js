import { renderSessionTrackerPenSvg } from "../session-tracker-icons.js";
import { escapeHtml, formatDisplayNumber } from "../shared/ui-utils.js";
import { renderSessionTrackerClockIcon, renderWritingTargetCard } from "./progress-tracker.js";

export function renderVoiceNarrationStrip(summary) {
  const visibleMetrics = summary?.visibleMetrics ?? [];

  return `
    <div class="desktop-target-strip voice-target-strip" aria-label="Audiobook narration metrics">
      <div class="desktop-target-strip__metrics">
        ${visibleMetrics.map((metric) => renderVoiceNarrationCard(metric, summary)).join("")}
        ${renderVoiceSessionTrackerPanel(summary)}
      </div>
    </div>
  `;
}

export function renderVoiceNarrationCard(metric, summary) {
  return renderWritingTargetCard(metric, summary);
}

export function buildVoiceSessionTrackerMetric(summary) {
  if (!summary) {
    return {
      key: "voiceSessionTracker",
      label: "Session tracker",
      value: "—",
      leftLabel: "0/min",
      rightLabel: "0/min",
      clockLabel: "—",
      wordsRecordedLabel: "0",
      wordsTargetLabel: "0",
      sessionStartTimeLabel: "—",
      sessionMinutesLapsedLabel: "0",
      wpmValue: 0,
      wpmLabel: "0.00",
      progress: 0,
      note: "No session data yet",
    };
  }

  const currentWordsPerMinute = Number(summary.sessionWordsPerMinute) || 0;
  const requiredWordsPerMinute = Number(summary.sessionRequiredWordsPerMinute) || 0;
  const paceRatioValue = Number(summary.sessionWordsPerMinuteRatio);
  const sessionTargetWords = Number(summary.sessionTargetWords ?? 0);
  const currentSessionWords = Number(summary.currentSessionWords ?? 0);
  const sessionTargetProgress = sessionTargetWords > 0
    ? Math.min(1, currentSessionWords / sessionTargetWords)
    : 0;
  const paceRatio = Number.isFinite(paceRatioValue) && paceRatioValue > 0
    ? Math.min(1, paceRatioValue)
    : sessionTargetProgress;
  const statusText = summary.sessionWordsPerMinuteStatusText ?? "";

  return {
    key: "voiceSessionTracker",
    label: "Session tracker",
    value: summary.sessionWordsPerMinuteLabel ?? "0/min",
    leftLabel: summary.sessionWordsPerMinuteLabel ?? formatDisplayNumber(currentWordsPerMinute),
    rightLabel: summary.sessionRequiredWordsPerMinuteLabel ?? formatDisplayNumber(requiredWordsPerMinute),
    clockLabel: summary.sessionCurrentTimeLabel ?? "—",
    wordsRecordedLabel: formatDisplayNumber(Math.round(currentSessionWords)),
    wordsTargetLabel: formatDisplayNumber(Math.round(sessionTargetWords)),
    sessionStartTimeLabel: summary.sessionStartTimeLabel ?? "—",
    sessionMinutesLapsedLabel: formatDisplayNumber(Math.max(0, Math.floor(Number(summary.sessionMinutesLapsed ?? 0)))),
    wpmValue: currentWordsPerMinute,
    wpmLabel: summary.sessionWordsPerMinuteLabel ?? "0/min",
    comparison: true,
    progress: paceRatio,
    barClass: `${summary.sessionWordsPerMinuteOverTarget ? "is-session-pace is-over-target" : "is-session-pace"}`,
    barStyle: `--writing-target-bar-color: ${summary.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"};`,
    note: statusText || "No session data yet",
  };
}

export function getVoiceSessionTrackerVisualState(summary, tracker) {
  const isLiveSession = /^Active\b/.test(summary?.sessionStatusText ?? "");
  const currentWordsPerMinute = Number(summary?.sessionWordsPerMinute ?? tracker?.wpmValue ?? 0);
  const currentWordsRecorded = Number(summary?.currentSessionWords ?? 0);
  const sessionTargetWords = Number(summary?.sessionTargetWords ?? 0);

  if (!isLiveSession && Math.round(currentWordsRecorded) <= 0) {
    return { key: "sleeping" };
  }

  if (
    summary?.sessionWordsPerMinuteOverTarget ||
    (sessionTargetWords > 0 && currentWordsRecorded >= sessionTargetWords) ||
    (isLiveSession && Number.isFinite(currentWordsPerMinute) && currentWordsPerMinute > 0 && currentWordsRecorded > 0 && currentWordsRecorded >= sessionTargetWords)
  ) {
    return { key: "flaming" };
  }

  return (isLiveSession && Math.round(currentWordsPerMinute) > 0) || currentWordsRecorded > 0
    ? { key: "working" }
    : { key: "sleeping" };
}

export function renderVoiceSessionTrackerPanel(summary) {
  const tracker = buildVoiceSessionTrackerMetric(summary);
  const paceRatioValue = Number(summary?.sessionWordsPerMinuteRatio);
  const paceRatio = Number.isFinite(paceRatioValue) && paceRatioValue > 0
    ? Math.min(1, paceRatioValue)
    : tracker.progress;
  const isLiveSession = /^Active\b/.test(summary?.sessionStatusText ?? "");
  const visualState = getVoiceSessionTrackerVisualState(summary, tracker);
  const paceStatus = isLiveSession
    ? summary?.sessionWordsPerMinuteOverTarget
      ? "Ahead of audiobook target"
      : summary?.sessionWordsPerMinuteStatusText === "On track"
        ? "On pace for audiobook release"
        : summary?.sessionWordsPerMinuteStatusText === "Ahead of pace"
          ? "Ahead of audiobook target"
          : summary?.sessionWordsPerMinuteStatusText === "Session target reached"
            ? "Session target reached"
            : summary?.sessionWordsPerMinuteStatusText === "Set an audiobook release date"
              ? "Set an audiobook release date"
              : "Need more pace"
    : summary?.sessionStatusText ?? "No live session";
  const progressWidth = Math.max(
    0,
    Math.min(100, Math.round((Number(summary?.currentSessionWords ?? 0) / Math.max(1, Number(summary?.sessionTargetWords ?? 0))) * 100)),
  );
  const paceColor = isLiveSession || Number(summary?.currentSessionWords ?? 0) > 0
    ? summary?.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"
    : "rgba(31, 36, 48, 0.26)";

  return `
    <article class="session-tracker-panel voice-session-tracker-panel">
      <div class="session-tracker-panel__body">
        <div class="session-tracker-panel__progress-column">
          <div class="session-tracker-panel__titles">
            <span class="session-tracker-panel__eyebrow">Session tracker</span>
          </div>
          <div class="writing-target-bar session-tracker-panel__bar ${visualState.key === "flaming" ? "is-over-target" : ""}" style="--writing-target-bar-color: ${paceColor};" aria-hidden="true">
            <span style="width: ${progressWidth}%"></span>
          </div>
          <div class="session-tracker-panel__count-row">
            <strong>${escapeHtml(tracker.wordsRecordedLabel ?? "0")}</strong>
            <span>${escapeHtml(tracker.wordsTargetLabel ?? "0")}</span>
          </div>
          <p class="session-tracker-panel__count-label">Words recorded</p>
        </div>

        <div class="session-tracker-panel__gauge-column">
          <div class="session-tracker-panel__gauge-row">
            <div class="session-tracker-panel__gauge ${visualState.key === "flaming" ? "is-over-target" : ""}" aria-hidden="true">
              ${renderVoiceSessionTrackerPaceRing(paceRatio, paceColor)}
              <span class="session-tracker-panel__gauge-inner">
                <span class="session-tracker-panel__gauge-icon">${renderSessionTrackerPenSvg(visualState.key)}</span>
              </span>
            </div>
            <div class="session-tracker-panel__gauge-copy">
              <div class="session-tracker-panel__clock">
                <span class="session-tracker-panel__clock-icon" aria-hidden="true">${renderVoiceSessionTrackerClockIcon()}</span>
                <span class="session-tracker-panel__clock-time">${escapeHtml(tracker.clockLabel ?? "—")}</span>
              </div>
              <div class="session-tracker-panel__wpm-row">
                <span class="session-tracker-panel__footer-icon" aria-hidden="true">⌁</span>
                <span>WPM:</span>
                <strong>${escapeHtml(tracker.wpmLabel ?? "0/min")}</strong>
              </div>
              <span class="session-tracker-panel__pace-note">${escapeHtml(paceStatus)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="session-tracker-panel__footer">
        <div class="session-tracker-panel__footer-item">
          <span class="session-tracker-panel__footer-icon" aria-hidden="true">◷</span>
          <span>Start:</span>
          <strong>${escapeHtml(tracker.sessionStartTimeLabel ?? "—")}</strong>
        </div>
        <div class="session-tracker-panel__footer-item">
          <span class="session-tracker-panel__footer-icon" aria-hidden="true">⏱</span>
          <span>Lapsed:</span>
          <strong>${escapeHtml(tracker.sessionMinutesLapsedLabel ?? "0")}</strong>
        </div>
      </div>
    </article>
  `;
}

export function renderVoiceSessionTrackerClockIcon() {
  return renderSessionTrackerClockIcon();
}

function renderVoiceSessionTrackerPaceRing(ratio, color) {
  const normalizedRatio = Math.max(0, Math.min(1, Number(ratio ?? 0)));
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedRatio);

  return `
    <svg class="session-tracker-panel__gauge-ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle class="session-tracker-panel__gauge-track" cx="100" cy="100" r="${radius}"></circle>
      <circle
        class="session-tracker-panel__gauge-progress"
        cx="100"
        cy="100"
        r="${radius}"
        style="stroke: ${escapeHtml(color)}; stroke-dasharray: ${circumference.toFixed(3)} ${circumference.toFixed(3)}; stroke-dashoffset: ${dashOffset.toFixed(3)};"
      ></circle>
    </svg>
  `;
}
