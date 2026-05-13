// Intent: keep the writing-goals window markup in a feature module so the shell only orchestrates state and events.
import { renderWritingTargetCard } from "../progress-tracker.js";
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";

// Intent: render the complete writing-goals dialog from prepared view models only.
export function renderWritingTargetWindowHTML({
  summary,
  dashboard,
  selectedEntry,
  dashboardCards,
  renderWritingTargetArchiveEntry,
  cadenceOptions = [],
  maxSessionTargetsPerDay,
  minSessionTimeoutMinutes,
  maxSessionTimeoutMinutes,
}) {
  const safeSummary = summary ?? {};
  const safeDashboard = dashboard ?? {};
  const safeSelectedEntry = selectedEntry ?? {};
  const safeDashboardCards = Array.isArray(dashboardCards) ? dashboardCards : [];
  const safeCadenceOptions = Array.isArray(cadenceOptions) ? cadenceOptions : [];
  const visibleMetrics = Array.isArray(safeSummary.record?.visibleMetrics)
    ? safeSummary.record.visibleMetrics
    : [];
  const calendarHeaderDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const safeRenderArchiveEntry = typeof renderWritingTargetArchiveEntry === "function"
    ? renderWritingTargetArchiveEntry
    : () => "";

  // Intent: keep calendar-cell markup local because it is purely presentation for the dashboard model.
  const renderCalendarDayCell = (day) => `
    <button
      class="writing-target-calendar-day ${day.status.key} ${day.isCurrentMonth ? "" : "is-outside-month"} ${day.isSelected ? "is-selected" : ""} ${day.isToday ? "is-today" : ""}"
      type="button"
      data-action="select-writing-target-day"
      data-date-key="${escapeHtml(day.dateKey)}"
      aria-pressed="${day.isSelected ? "true" : "false"}"
      aria-label="${escapeHtml(new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(day.date))}"
    >
      <span class="writing-target-calendar-day-head">
        <strong>${escapeHtml(String(day.dayNumber))}</strong>
        <span>${escapeHtml(day.status.label)}</span>
      </span>
      <span class="writing-target-calendar-day-count">${escapeHtml(day.entry ? `${formatDisplayNumber(day.wordGain)} words` : "No writing")}</span>
      <span class="writing-target-calendar-day-progress" aria-hidden="true">
        <span style="width:${Math.round(day.progressRatio * 100)}%;"></span>
      </span>
      <span class="writing-target-calendar-day-indicators" aria-hidden="true">
        <span class="is-task" title="Tasks completed">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✓</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(day.taskCount || 0))}</span>
        </span>
        <span class="is-inspiration" title="Inspirations logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✦</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.inspirationCount) || 0))))}</span>
        </span>
        <span class="is-issue" title="Issues logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">!</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.issueCount) || 0))))}</span>
        </span>
      </span>
    </button>
  `;

  // Intent: render the compact week view with the same data contract as the monthly calendar.
  const renderWeekDayCell = (day) => `
    <button
      class="writing-target-week-day ${day.status.key} ${day.isSelected ? "is-selected" : ""}"
      type="button"
      data-action="select-writing-target-day"
      data-date-key="${escapeHtml(day.dateKey)}"
      aria-pressed="${day.isSelected ? "true" : "false"}"
    >
      <span class="writing-target-week-day-name">${escapeHtml(new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day.date))}</span>
      <strong>${escapeHtml(String(day.dayNumber))}</strong>
      <span>${escapeHtml(day.entry ? `${formatDisplayNumber(day.wordGain)} words` : "No writing")}</span>
      <span class="writing-target-calendar-day-progress" aria-hidden="true">
        <span style="width:${Math.round(day.progressRatio * 100)}%;"></span>
      </span>
      <span class="writing-target-calendar-day-indicators" aria-hidden="true">
        <span class="is-task" title="Tasks completed">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✓</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(day.taskCount || 0))}</span>
        </span>
        <span class="is-inspiration" title="Inspirations logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">✦</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.inspirationCount) || 0))))}</span>
        </span>
        <span class="is-issue" title="Issues logged">
          <span class="writing-target-calendar-day-indicator-icon" aria-hidden="true">!</span>
          <span class="writing-target-calendar-day-indicator-count">${escapeHtml(formatDisplayNumber(Math.max(0, Math.round(Number(day.entry?.issueCount) || 0))))}</span>
        </span>
      </span>
    </button>
  `;

  return `
    <section class="writing-target-window" role="dialog" aria-label="Writing goals">
      <header class="writing-target-window-header">
        <div class="writing-target-window-copy">
          <p class="writing-target-kicker">Writing Goals</p>
          <h2>Writing Goals</h2>
          <p class="writing-target-window-subtitle">Plan your pace. Track your progress. Finish strong.</p>
        </div>
        <div class="writing-target-dashboard-stats">
          ${safeDashboardCards.map((card) => renderWritingTargetCard(card, safeSummary)).join("")}
        </div>
        <button
          class="writing-target-close"
          type="button"
          data-action="close-writing-target-window"
          aria-label="Close writing goals"
          title="Close"
        >
          ×
        </button>
      </header>
      <div class="writing-target-dashboard-body">
        <section class="writing-target-dashboard-settings" aria-label="Goal settings">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Goal settings</p>
              <h3>Goal settings</h3>
            </div>
          </div>
          <div class="writing-target-summary-grid">
            <label class="writing-target-field">
              <span>Word target</span>
              <input
                type="number"
                min="1000"
                step="1000"
                value="${escapeHtml(String(safeSummary.targetWords ?? ""))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="targetWords"
                aria-label="Manuscript target words"
              />
              <input
                class="writing-target-range"
                type="range"
                min="1000"
                max="500000"
                step="1000"
                value="${escapeHtml(String(safeSummary.targetWords ?? ""))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="targetWords"
                aria-label="Adjust manuscript target words"
              />
            </label>
            <label class="writing-target-field">
              <span>Release date</span>
              <input
                type="text"
                value="${escapeHtml(String(safeSummary.record?.releaseDate ?? ""))}"
                placeholder="YYYY-MM-DD or DD/MM/YYYY"
                inputmode="numeric"
                data-edit-field="writing-target-field"
                data-writing-target-field="releaseDate"
                aria-label="Release date"
              />
              ${safeSummary.releaseComparisonLabel ? `<small class="writing-target-hint">${escapeHtml(safeSummary.releaseComparisonLabel)}</small>` : ""}
            </label>
            <div class="writing-target-row">
              <label class="writing-target-field">
                <span>Target cadence</span>
                <select
                  data-edit-field="writing-target-field"
                  data-writing-target-field="targetCadence"
                  aria-label="Target cadence"
                >
                  ${safeCadenceOptions.map((option) => `
                    <option value="${escapeHtml(option.value)}" ${safeSummary.record?.targetCadence === option.value ? "selected" : ""}>
                      ${escapeHtml(option.label)}
                    </option>
                  `).join("")}
                </select>
              </label>
              <label class="writing-target-field">
                <span>${escapeHtml(safeSummary.goalTargetLabel ?? "Session target")}</span>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value="${escapeHtml(String(safeSummary.sessionTargetWords ?? ""))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="sessionTargetWords"
                  aria-label="${escapeHtml(safeSummary.goalTargetLabel ?? "Session target")} words"
                />
              </label>
            </div>
            <div class="writing-target-help-card">
              <span>About daily target</span>
              <p>${escapeHtml(safeSummary.goalSyncHint || "Adjust the daily goal to shape the pace of the release forecast.")}</p>
            </div>
            <div class="writing-target-row">
              <label class="writing-target-field">
                <span>Lookback days</span>
                <input
                  type="number"
                  min="2"
                  step="1"
                  max="180"
                  value="${escapeHtml(String(safeSummary.lookbackDays ?? ""))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="lookbackDays"
                  aria-label="Lookback days"
                />
              </label>
              <label class="writing-target-field">
                <span>Sessions per day</span>
                <input
                  type="number"
                  min="1"
                  max="${escapeHtml(String(maxSessionTargetsPerDay ?? 1))}"
                  step="1"
                  value="${escapeHtml(String(safeSummary.sessionsPerDay ?? ""))}"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="sessionsPerDay"
                  aria-label="Sessions per day"
                />
              </label>
            </div>
            <label class="writing-target-field">
              <span>Session time</span>
              <input
                type="number"
                min="${escapeHtml(String(minSessionTimeoutMinutes ?? 1))}"
                max="${escapeHtml(String(maxSessionTimeoutMinutes ?? 60))}"
                step="1"
                value="${escapeHtml(String(safeSummary.sessionTimeoutMinutes ?? ""))}"
                data-edit-field="writing-target-field"
                data-writing-target-field="sessionTimeoutMinutes"
                aria-label="Session time minutes"
              />
            </label>
            <div class="writing-target-presets">
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="wordTarget"
                  ${visibleMetrics.includes("wordTarget") ? "checked" : ""}
                />
                <span>Word Target</span>
              </label>
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="sessionTarget"
                  ${visibleMetrics.includes("sessionTarget") ? "checked" : ""}
                />
                <span>${escapeHtml(safeSummary.goalTargetLabel ?? "Session target")}</span>
              </label>
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="forecast"
                  ${visibleMetrics.includes("forecast") ? "checked" : ""}
                />
                <span>Days to release</span>
              </label>
              <label class="writing-target-checkbox">
                <input
                  type="checkbox"
                  data-edit-field="writing-target-field"
                  data-writing-target-field="visibleMetric"
                  data-metric-key="sessionTracker"
                  ${visibleMetrics.includes("sessionTracker") ? "checked" : ""}
                />
                <span>Session tracker</span>
              </label>
            </div>
          </div>
        </section>
        <section class="writing-target-dashboard-calendar" aria-label="Calendar view">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Calendar view</p>
              <h3>${escapeHtml(safeDashboard.monthLabel ?? "")}</h3>
            </div>
            <div class="writing-target-calendar-toolbar">
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-prev-month" aria-label="Previous month">‹</button>
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-today">Today</button>
              <button class="tag-button panel-action-button" type="button" data-action="writing-target-calendar-next-month" aria-label="Next month">›</button>
            </div>
          </div>
          <div class="writing-target-view-toggle" role="tablist" aria-label="Calendar view mode">
            ${[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "list", label: "List" },
            ].map((mode) => `
              <button
                class="writing-target-view-toggle-button ${safeDashboard.viewMode === mode.value ? "is-active" : ""}"
                type="button"
                data-action="writing-target-set-view-mode"
                data-view-mode="${escapeHtml(mode.value)}"
                aria-pressed="${safeDashboard.viewMode === mode.value ? "true" : "false"}"
              >
                ${escapeHtml(mode.label)}
              </button>
            `).join("")}
          </div>
          ${safeDashboard.viewMode === "week" ? `
            <div class="writing-target-week-grid">
              ${Array.isArray(safeDashboard.weekDays) ? safeDashboard.weekDays.map((day) => renderWeekDayCell(day)).join("") : ""}
            </div>
          ` : safeDashboard.viewMode === "list" ? `
            <div class="writing-target-calendar-list">
              ${Array.isArray(safeDashboard.listEntries) && safeDashboard.listEntries.length
                ? safeDashboard.listEntries.map((entry) => safeRenderArchiveEntry(entry)).join("")
                : `<p class="writing-target-archive-empty">Your daily manuscript history will appear here after writing sessions are captured.</p>`}
            </div>
          ` : `
            <div class="writing-target-calendar-grid">
              ${calendarHeaderDays.map((day) => `<span class="writing-target-calendar-weekday">${escapeHtml(day)}</span>`).join("")}
              ${Array.isArray(safeDashboard.days) ? safeDashboard.days.map((day) => renderCalendarDayCell(day)).join("") : ""}
            </div>
          `}
          <div class="writing-target-calendar-legend" aria-label="Calendar legend">
            <span class="is-on-target">On target</span>
            <span class="is-good">Good</span>
            <span class="is-below-target">Below target</span>
            <span class="is-low">Low</span>
            <span class="is-no-writing">No writing</span>
          </div>
        </section>
        <aside class="writing-target-dashboard-detail" aria-label="Selected day details">
          <div class="writing-target-section-header">
            <div>
              <p class="writing-target-kicker">Selected day</p>
              <h3>${escapeHtml(safeSelectedEntry.dateLabel ?? "")}</h3>
            </div>
            <span class="writing-target-day-status is-${escapeHtml(String(safeSelectedEntry.statusLabel ?? "").toLowerCase().replace(/\s+/g, "-"))}">${escapeHtml(safeSelectedEntry.statusLabel ?? "")}</span>
          </div>
          <div class="writing-target-day-hero">
            <div class="writing-target-day-hero-value">
              ${escapeHtml(formatDisplayNumber(safeSelectedEntry.wordCountValue ?? 0))}
              <span>words</span>
            </div>
            <div class="writing-target-day-hero-meta">
              <span class="writing-target-day-hero-delta">${escapeHtml(safeSelectedEntry.progressLabel ?? "")} vs daily target</span>
              <span class="writing-target-day-hero-target">${escapeHtml(safeSelectedEntry.dailyTargetLabel ?? "")}</span>
            </div>
          </div>
          <div class="writing-target-day-overview">
            <div>
              <span>Words</span>
              <strong>${escapeHtml(safeSelectedEntry.wordCountLabel ?? "")}</strong>
            </div>
            <div>
              <span>Daily target</span>
              <strong>${escapeHtml(safeSelectedEntry.dailyTargetLabel ?? "")}</strong>
            </div>
            <div>
              <span>Progress</span>
              <strong>${escapeHtml(safeSelectedEntry.progressLabel ?? "")}</strong>
            </div>
          </div>
          <div class="writing-target-bar" aria-hidden="true">
            <span style="width:${escapeHtml(`${Math.round(Number(safeSelectedEntry.progressRatio ?? 0) * 100)}%`)}"></span>
          </div>
          <div class="writing-target-day-sections">
            <div>
              <span>Chapter</span>
              <strong>${escapeHtml(safeSelectedEntry.chapterTitle ?? "")}</strong>
            </div>
            <div>
              <span>Scene</span>
              <strong>${escapeHtml(safeSelectedEntry.sceneTitle ?? "")}</strong>
            </div>
            ${safeSelectedEntry.passageExcerpt ? `
              <div class="writing-target-day-excerpt">
                <span>Passage</span>
                <p>${escapeHtml(safeSelectedEntry.passageExcerpt)}</p>
              </div>
            ` : ""}
          </div>
          <div class="writing-target-day-points">
            <div class="writing-target-day-point">
              <span>Tasks</span>
              <strong>${escapeHtml(safeSelectedEntry.tasksCountLabel ?? "")}</strong>
            </div>
            <div class="writing-target-day-point">
              <span>Inspiration</span>
              <strong>${escapeHtml(safeSelectedEntry.inspirationCountLabel ?? "")}</strong>
            </div>
            <div class="writing-target-day-point">
              <span>Issues</span>
              <strong>${escapeHtml(safeSelectedEntry.issueCountLabel ?? "")}</strong>
            </div>
          </div>
          <div class="writing-target-day-session-summary">
            <div>
              <span>Session pace</span>
              <strong>${escapeHtml(safeSummary.sessionWordsPerHourLabel ?? "")}</strong>
            </div>
            <div>
              <span>Session status</span>
              <strong>${escapeHtml(safeSummary.sessionMilestoneStatusText ?? "")}</strong>
            </div>
            <div>
              <span>Session elapsed</span>
              <strong>${escapeHtml(safeSummary.sessionElapsedLabel ?? "")}</strong>
            </div>
          </div>
          <label class="writing-target-note-field">
            <span>Notes</span>
            <textarea
              rows="5"
              data-edit-field="writing-target-field"
              data-writing-target-field="dailyNote"
              data-date-key="${escapeHtml(safeDashboard.selectedDateKey ?? "")}"
              placeholder="Add a note for this day"
            >${escapeHtml(safeSelectedEntry.noteText || "")}</textarea>
          </label>
        </aside>
      </div>
      <footer class="writing-target-footer">
        <button class="tag-button panel-action-button" type="button" data-action="reset-writing-target-goals">Reset to defaults</button>
        <div class="writing-target-footer-actions">
          <button class="tag-button panel-action-button" type="button" data-action="cancel-writing-target-goals">Cancel</button>
          <button class="tag-button panel-action-button is-primary" type="button" data-action="save-writing-target-goals">Save goals</button>
        </div>
      </footer>
    </section>
  `;
}
