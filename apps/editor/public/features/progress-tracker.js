// Intent: render writing-target and session-tracker UI fragments without owning editor persistence.
import { renderSessionTrackerPenSvg } from "../session-tracker-icons.js";
import { escapeHtml, formatDisplayNumber } from "../shared/ui-utils.js";

// Intent: render only the visible metrics selected by writing-goal state.
export function renderWritingTargetStrip(summary) {
  const visibleMetrics = summary?.visibleMetrics ?? [];
  const renderedCards = visibleMetrics.map((metric) => (
    metric?.key === "sessionTracker"
      ? renderSessionTrackerPanel(summary)
      : renderWritingTargetCard(metric, summary)
  ));
  return `
    <div class="desktop-target-strip" aria-label="Writing target metrics" data-writing-target-strip>
      <div class="desktop-target-strip__metrics">
        ${renderedCards.join("")}
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
      sessionIsActive: false,
      sessionPaceActive: false,
      sessionIdleLabel: "Idle",
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
    sessionIsActive: summary.sessionIsActive === true,
    sessionPaceActive: summary.sessionPaceActive === true,
    sessionIdleLabel: summary.sessionIdleLabel ?? "Idle",
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

// Intent: choose the pen visual from live session pace without affecting session state.
export function getSessionTrackerVisualState(summary, tracker) {
  const isLiveSession = summary?.sessionIsActive === true;
  const isPaceActive = summary?.sessionPaceActive === true || tracker?.sessionPaceActive === true;
  const currentWordsPerMinute = Number(summary?.sessionWordsPerMinute ?? tracker?.wpmValue ?? 0);

  if (!isLiveSession || !isPaceActive || Math.round(currentWordsPerMinute) <= 0) {
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
  const isLiveSession = summary?.sessionIsActive === true;
  const isPaceActive = summary?.sessionPaceActive === true || tracker.sessionPaceActive === true;
  const visualState = getSessionTrackerVisualState(summary, tracker);
  const paceStatus = isPaceActive
    ? summary?.sessionWordsPerMinuteOverTarget
      ? "You’re outperforming"
      : summary?.sessionWordsPerMinuteStatusText === "On track"
        ? "You’re on pace"
        : summary?.sessionWordsPerMinuteStatusText === "Ahead of pace"
          ? "You’re outperforming"
          : "Need more pace"
    : "Idle";
  const progressWidth = Math.max(0, Math.min(100, Math.round((Number(summary?.currentSessionWords ?? 0) / Math.max(1, Number(summary?.sessionTargetWordsPerSession ?? 0))) * 100)));
  const paceColor = isPaceActive
    ? summary?.sessionWordsPerMinuteBarColor ?? "rgb(113, 215, 177)"
    : "rgba(31, 36, 48, 0.26)";

  return `
    <article class="session-tracker-panel" data-session-tracker-panel>
      <div class="session-tracker-panel__body">
        <div class="session-tracker-panel__progress-column">
          <div class="session-tracker-panel__titles">
            <span class="session-tracker-panel__eyebrow">Session tracker</span>
          </div>
          <div class="writing-target-bar session-tracker-panel__bar ${visualState.key === "flaming" ? "is-over-target" : ""}" style="--writing-target-bar-color: ${paceColor};" aria-hidden="true" data-session-tracker-bar>
            <span style="width: ${progressWidth}%" data-session-tracker-progress-fill></span>
          </div>
          <div class="session-tracker-panel__count-row">
            <span class="session-tracker-panel__count-current">
              <strong data-session-tracker-words-written>${escapeHtml(tracker.wordsWrittenLabel ?? "0")}</strong>
              <span class="session-tracker-panel__count-label" data-session-tracker-words-label>Words written</span>
            </span>
            <span class="session-tracker-panel__count-target" data-session-tracker-words-target>${escapeHtml(tracker.wordsTargetLabel ?? "0")}</span>
          </div>
          <div class="session-tracker-panel__bar-meta">
            <div class="session-tracker-panel__bar-meta-item session-tracker-panel__bar-meta-item--start">
              <span class="session-tracker-panel__footer-icon" aria-hidden="true">◷</span>
              <span>Start:</span>
              <strong data-session-tracker-start-time>${escapeHtml(tracker.sessionStartTimeLabel ?? "—")}</strong>
            </div>
            <div class="session-tracker-panel__bar-meta-item session-tracker-panel__bar-meta-item--lapsed">
              <span class="session-tracker-panel__footer-icon" aria-hidden="true">⏱</span>
              <span data-session-tracker-lapsed-label>${escapeHtml(isLiveSession ? "Lapsed:" : "Idle:")}</span>
              <strong data-session-tracker-lapsed-value>${escapeHtml(
                isLiveSession
                  ? tracker.sessionMinutesLapsedLabel ?? "0"
                  : tracker.sessionIdleLabel ?? "Idle",
              )}</strong>
            </div>
          </div>
        </div>

        <div class="session-tracker-panel__gauge-column">
          <div class="session-tracker-panel__gauge-row">
            <div class="session-tracker-panel__gauge ${visualState.key === "flaming" ? "is-over-target" : ""}" aria-hidden="true" data-session-tracker-gauge>
              ${renderSessionTrackerPaceRing(paceRatio, paceColor)}
              <span class="session-tracker-panel__gauge-inner">
                <span class="session-tracker-panel__gauge-icon" data-session-tracker-gauge-icon>${renderSessionTrackerPenSvg(visualState.key)}</span>
              </span>
            </div>
            <div class="session-tracker-panel__gauge-copy">
              <div class="session-tracker-panel__clock">
                <span class="session-tracker-panel__clock-icon" aria-hidden="true">${renderSessionTrackerClockIcon()}</span>
                <span class="session-tracker-panel__clock-time" data-session-tracker-clock>${escapeHtml(tracker.clockLabel ?? "—")}</span>
              </div>
              <div class="session-tracker-panel__wpm-row">
                <span class="session-tracker-panel__footer-icon" aria-hidden="true">⌁</span>
                <span>WPM:</span>
                <strong data-session-tracker-wpm>${escapeHtml(tracker.wpmLabel ?? "0/min")}</strong>
              </div>
              <span class="session-tracker-panel__pace-note" data-session-tracker-pace-note>${escapeHtml(paceStatus)}</span>
            </div>
          </div>
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

// Intent: render generic writing-target cards from normalized metric records.
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
    <article class="writing-target-card" data-writing-target-card="${escapeHtml(metric.key ?? "")}">
      <div class="writing-target-card-head">
        <span class="writing-target-card-label" data-writing-target-card-label>
          ${metric.icon ? `<i class="writing-target-card-icon" aria-hidden="true">${escapeHtml(metric.icon)}</i>` : ""}
          <span>${escapeHtml(metric.label)}</span>
        </span>
        <strong data-writing-target-card-value>${escapeHtml(value)}</strong>
      </div>
      <div class="writing-target-bar ${escapeHtml(metric.barClass ?? "")}" aria-hidden="true" data-writing-target-card-bar>
        <span style="width:${Math.round(progress * 100)}%;${escapeHtml(metric.barStyle ?? "")}" data-writing-target-card-progress></span>
      </div>
      <div class="writing-target-foot ${metric.comparison ? "is-comparison" : ""}" data-writing-target-card-foot>
        ${footContent}
      </div>
      ${note ? `<p class="writing-target-note" data-writing-target-card-note>${escapeHtml(note)}</p>` : ""}
    </article>
  `;
}
