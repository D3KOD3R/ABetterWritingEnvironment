import { renderSessionTrackerPenSvg } from "../session-tracker-icons.js";
import { escapeHtml, formatDisplayNumber } from "../shared/ui-utils.js";

export function renderWritingTargetStrip(summary) {
  const visibleMetrics = summary?.visibleMetrics ?? [];
  return `
    <div class="desktop-target-strip" aria-label="Writing target metrics">
      <div class="desktop-target-strip__metrics">
        ${visibleMetrics.map((metric) => renderWritingTargetCard(metric, summary)).join("")}
        ${renderSessionTrackerPanel(summary)}
      </div>
    </div>
  `;
}

export function buildSessionTrackerMetric(summary) {
  if (!summary) {
    return {
      key: "sessionTracker",
      label: "Session tracker",
      value: "—",
      leftLabel: "0/min",
      rightLabel: "0/min",
      clockLabel: "—",
      wordsWrittenLabel: "0",
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
  const paceRatio = Number(summary.sessionWordsPerMinuteRatio);
  const statusText = summary.sessionWordsPerMinuteStatusText ?? "";

  return {
    key: "sessionTracker",
    label: "Session tracker",
    value: summary.sessionWordsPerMinuteLabel ?? "0/min",
    leftLabel: summary.sessionWordsPerMinuteLabel ?? formatDisplayNumber(currentWordsPerMinute),
    rightLabel: summary.sessionRequiredWordsPerMinuteLabel ?? formatDisplayNumber(requiredWordsPerMinute),
    clockLabel: summary.sessionCurrentTimeLabel ?? "—",
    wordsWrittenLabel: formatDisplayNumber(Math.round(summary.currentSessionWords ?? 0)),
    wordsTargetLabel: formatDisplayNumber(Math.round(summary.sessionTargetWordsPerSession ?? 0)),
    sessionStartTimeLabel: summary.sessionStartTimeLabel ?? "—",
    sessionMinutesLapsedLabel: formatDisplayNumber(Math.max(0, Math.floor(Number(summary.sessionMinutesLapsed ?? 0)))),
    wpmValue: currentWordsPerMinute,
    wpmLabel: summary.sessionWordsPerMinuteLabel ?? "0/min",
    comparison: true,
    progress: Number.isFinite(paceRatio) && paceRatio >= 0 && paceRatio <= 1
      ? paceRatio
      : requiredWordsPerMinute > 0
        ? Math.min(1, currentWordsPerMinute / requiredWordsPerMinute)
      : 0,
    barClass: `${summary.sessionWordsPerMinuteOverTarget ? "is-session-pace is-over-target" : "is-session-pace"}`,
    barStyle: `--writing-target-bar-color: ${summary.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"};`,
    note: statusText || "No session data yet",
  };
}

export function getSessionTrackerVisualState(summary, tracker) {
  const isLiveSession = /^Active\b/.test(summary?.sessionStatusText ?? "");
  const currentWordsPerMinute = Number(summary?.sessionWordsPerMinute ?? tracker?.wpmValue ?? 0);

  if (!isLiveSession || Math.round(currentWordsPerMinute) <= 0) {
    return { key: "sleeping" };
  }

  if (summary?.sessionWordsPerMinuteOverTarget) {
    return { key: "flaming" };
  }

  return { key: "working" };
}

export function renderSessionTrackerPaceRing(ratio, color) {
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

export function renderSessionTrackerPanel(summary) {
  const tracker = buildSessionTrackerMetric(summary);
  const paceRatio = Math.max(0, Math.min(1, Number(summary?.sessionWordsPerMinuteRatio ?? tracker.progress ?? 0)));
  const isLiveSession = /^Active\b/.test(summary?.sessionStatusText ?? "");
  const visualState = getSessionTrackerVisualState(summary, tracker);
  const paceStatus = isLiveSession
    ? summary?.sessionWordsPerMinuteOverTarget
      ? "You’re outperforming"
      : summary?.sessionWordsPerMinuteStatusText === "On track"
        ? "You’re on pace"
        : summary?.sessionWordsPerMinuteStatusText === "Ahead of pace"
          ? "You’re outperforming"
          : "Need more pace"
    : "No live session";
  const progressWidth = Math.max(0, Math.min(100, Math.round((Number(summary?.currentSessionWords ?? 0) / Math.max(1, Number(summary?.sessionTargetWordsPerSession ?? 0))) * 100)));
  const paceColor = isLiveSession
    ? summary?.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"
    : "rgba(31, 36, 48, 0.26)";

  return `
    <article class="session-tracker-panel">
      <div class="session-tracker-panel__body">
        <div class="session-tracker-panel__progress-column">
          <div class="session-tracker-panel__titles">
            <span class="session-tracker-panel__eyebrow">Session tracker</span>
          </div>
          <div class="writing-target-bar session-tracker-panel__bar ${visualState.key === "flaming" ? "is-over-target" : ""}" style="--writing-target-bar-color: ${paceColor};" aria-hidden="true">
            <span style="width: ${progressWidth}%"></span>
          </div>
          <div class="session-tracker-panel__count-row">
            <strong>${escapeHtml(tracker.wordsWrittenLabel ?? "0")}</strong>
            <span>${escapeHtml(tracker.wordsTargetLabel ?? "0")}</span>
          </div>
          <p class="session-tracker-panel__count-label">Words written</p>
        </div>

        <div class="session-tracker-panel__gauge-column">
          <div class="session-tracker-panel__gauge-row">
            <div class="session-tracker-panel__gauge ${visualState.key === "flaming" ? "is-over-target" : ""}" aria-hidden="true">
              ${renderSessionTrackerPaceRing(paceRatio, paceColor)}
              <span class="session-tracker-panel__gauge-inner">
                <span class="session-tracker-panel__gauge-icon">${renderSessionTrackerPenSvg(visualState.key)}</span>
              </span>
            </div>
            <div class="session-tracker-panel__gauge-copy">
              <div class="session-tracker-panel__clock">
                <span class="session-tracker-panel__clock-icon" aria-hidden="true">${renderSessionTrackerClockIcon()}</span>
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

export function renderSessionTrackerClockIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.75"></circle>
      <path d="M12 7.5v5l3 1.8"></path>
    </svg>
  `;
}

export function renderWritingTargetCard(metric, summary) {
  const value = metric.value ?? "—";
  const leftLabel = metric.leftLabel ?? "";
  const rightLabel = metric.rightLabel ?? "";
  const note = metric.note ?? "";
  const progress = Math.max(0, Math.min(1, Number(metric.progress ?? 0)));
  const footContent = metric.comparison
    ? `
        <span>${escapeHtml(leftLabel)}</span>
        <span aria-hidden="true">→</span>
        <span>${escapeHtml(rightLabel)}</span>
      `
    : `
        <span>${escapeHtml(leftLabel)}</span>
        <span>${escapeHtml(rightLabel)}</span>
      `;

  return `
    <article class="writing-target-card">
      <div class="writing-target-card-head">
        <span class="writing-target-card-label">
          ${metric.icon ? `<i class="writing-target-card-icon" aria-hidden="true">${escapeHtml(metric.icon)}</i>` : ""}
          <span>${escapeHtml(metric.label)}</span>
        </span>
        <strong>${escapeHtml(value)}</strong>
      </div>
      <div class="writing-target-bar ${escapeHtml(metric.barClass ?? "")}" aria-hidden="true">
        <span style="width:${Math.round(progress * 100)}%;${escapeHtml(metric.barStyle ?? "")}"></span>
      </div>
      <div class="writing-target-foot ${metric.comparison ? "is-comparison" : ""}">
        ${footContent}
      </div>
      ${note ? `<p class="writing-target-note">${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}
