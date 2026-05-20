// Intent: render writer-facing revision history UI without owning revision service state.
import { escapeHtml } from "../../shared/ui-utils.js";

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "finalised") {
    return "Banked";
  }
  if (value === "staged") {
    return "Staged";
  }
  if (value === "open") {
    return "Open";
  }
  if (value === "archived") {
    return "Archived";
  }
  if (value === "corrupt") {
    return "Damaged";
  }
  return "Unknown";
}

function renderOption(value, selectedValue) {
  const selected = value === selectedValue ? " selected" : "";
  const label = value === "all" ? "All" : value.replace(/_/g, " ");
  return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
}

function renderChipList(values, fallbackLabel = "") {
  const entries = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
  if (!entries.length) {
    return fallbackLabel ? `<span class="revision-chip revision-chip--muted">${escapeHtml(fallbackLabel)}</span>` : "";
  }

  return entries.map((value) => `<span class="revision-chip">${escapeHtml(value.replace(/_/g, " "))}</span>`).join("");
}

function renderSessionList(model) {
  if (!model.groupedSessions.length) {
    return `
      <div class="revision-empty-state">
        <strong>No writing sessions match this view.</strong>
        <span>Bank a revision after a meaningful writing pass to see it here.</span>
      </div>
    `;
  }

  return model.groupedSessions.map((group) => `
    <section class="revision-session-group">
      <h3>${escapeHtml(group.dateLabel)}</h3>
      <div class="revision-session-list">
        ${group.sessions.map((session) => renderSessionButton(session, model.selectedSessionId)).join("")}
      </div>
    </section>
  `).join("");
}

function renderSessionButton(session, selectedSessionId) {
  const isSelected = session.metadata.id === selectedSessionId;
  const changedEntityCount = Array.isArray(session.changedEntities) ? session.changedEntities.length : 0;
  const eventCount = Array.isArray(session.events) ? session.events.length : 0;
  const originLabel = (session.metadata.origins ?? []).join(", ") || session.metadata.origin || "manual_editor";
  return `
    <button
      class="revision-session-card ${isSelected ? "is-selected" : ""}"
      type="button"
      data-action="select-revision-session"
      data-revision-session-id="${escapeHtml(session.metadata.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span class="revision-session-card__meta">${escapeHtml(formatTimestamp(session.metadata.finalisedAt || session.metadata.stagedAt || session.metadata.startedAt))} · ${escapeHtml(formatStatus(session.metadata.status))}</span>
      <strong>${escapeHtml(session.metadata.title || "Writing Session")}</strong>
      <span>${escapeHtml(`${eventCount} event${eventCount === 1 ? "" : "s"} · ${changedEntityCount} changed entit${changedEntityCount === 1 ? "y" : "ies"}`)}</span>
      <span class="revision-session-card__meta">${escapeHtml(originLabel)}</span>
    </button>
  `;
}

function renderSelectedSession(session, model) {
  if (!session) {
    return `
      <section class="revision-detail">
        <div class="revision-empty-state">
          <strong>No Writing Session selected.</strong>
          <span>Choose a session to inspect the revision summary, event ledger, and changed areas.</span>
        </div>
      </section>
    `;
  }

  const originLabel = (session.metadata.origins ?? []).join(", ") || session.metadata.origin || "manual_editor";
  const categoryTags = renderChipList(session.metadata.changeCategories, "manual");
  const originTags = renderChipList(session.metadata.origins, originLabel);

  return `
    <section class="revision-detail">
      <div class="revision-detail__header">
        <p class="panel-kicker">Writing Session</p>
        <h2>${escapeHtml(session.metadata.title || "Writing Session")}</h2>
        <span class="revision-status-pill is-${escapeHtml(session.metadata.status)}">${escapeHtml(formatStatus(session.metadata.status))}</span>
      </div>
      <dl class="revision-metadata-grid">
        <div><dt>Started</dt><dd>${escapeHtml(formatTimestamp(session.metadata.startedAt))}</dd></div>
        <div><dt>Staged</dt><dd>${escapeHtml(formatTimestamp(session.metadata.stagedAt))}</dd></div>
        <div><dt>Banked</dt><dd>${escapeHtml(formatTimestamp(session.metadata.finalisedAt))}</dd></div>
        <div><dt>Change Origin</dt><dd>${escapeHtml(originLabel)}</dd></div>
      </dl>
      <div class="revision-chip-row" aria-label="Revision change categories and sources">
        ${categoryTags}
        ${originTags}
      </div>
      ${renderSummary(session)}
      ${renderChangedEntities(session)}
      ${renderEventLedger(session)}
      ${renderDiffPreview(session, model.showFullDiff)}
      <div class="revision-detail-actions" aria-label="Revision actions">
        <button class="tag-button panel-action-button" type="button" data-action="revision-open-first-scene" data-revision-session-id="${escapeHtml(session.metadata.id)}">Open First Scene</button>
        <button class="tag-button panel-action-button" type="button" data-action="revision-toggle-diff-detail">${escapeHtml(model.showFullDiff ? "Compact Diff" : "Compare Details")}</button>
        <button class="tag-button panel-action-button" type="button" data-action="revision-export-summary" data-revision-session-id="${escapeHtml(session.metadata.id)}">Export Summary</button>
      </div>
    </section>
  `;
}

function renderSummary(session) {
  const summary = String(session.summaryMarkdown ?? "").trim();
  return `
    <section class="revision-detail-section">
      <h3>Revision Summary</h3>
      <pre class="revision-summary">${escapeHtml(summary || "No summary has been generated for this session yet.")}</pre>
    </section>
  `;
}

function renderChangedEntities(session) {
  const entities = Array.isArray(session.changedEntities) ? session.changedEntities : [];
  return `
    <section class="revision-detail-section">
      <h3>Changed Scenes and Entities</h3>
      ${entities.length ? `
        <div class="revision-entity-list">
          ${entities.slice(0, 30).map((entity) => `
            <button
              class="revision-entity-card"
              type="button"
              data-action="revision-open-entity"
              data-revision-entity-type="${escapeHtml(entity.entityType ?? "")}"
              data-revision-entity-id="${escapeHtml(entity.entityId ?? "")}"
            >
              <span>${escapeHtml(entity.entityType ?? "entity")}</span>
              <strong>${escapeHtml(entity.title ?? entity.entityId ?? "Changed entity")}</strong>
              <em>${escapeHtml(entity.status ?? "changed")}${Number.isFinite(Number(entity.wordCountDelta)) ? ` · ${Number(entity.wordCountDelta) >= 0 ? "+" : ""}${Number(entity.wordCountDelta)} words` : ""}</em>
            </button>
          `).join("")}
        </div>
      ` : `<p class="revision-muted">No changed entities listed.</p>`}
    </section>
  `;
}

function renderEventLedger(session) {
  const events = Array.isArray(session.events) ? session.events : [];
  return `
    <section class="revision-detail-section">
      <h3>Event Ledger</h3>
      ${events.length ? `
        <ol class="revision-event-list">
          ${events.map((event) => `
            <li>
              <span>${escapeHtml(formatTimestamp(event.timestamp))} · ${escapeHtml(event.origin ?? "manual_editor")} · ${escapeHtml(event.changeCategory ?? "manual")}</span>
              <strong>${escapeHtml(event.description ?? event.eventType ?? "Revision event")}</strong>
              <em>${escapeHtml(event.entityType ?? "")}${event.entityId ? `:${escapeHtml(event.entityId)}` : ""}${Number(event.occurrenceCount) > 1 ? ` · ${escapeHtml(String(event.occurrenceCount))} updates` : ""}</em>
            </li>
          `).join("")}
        </ol>
      ` : `<p class="revision-muted">No event ledger entries recorded.</p>`}
    </section>
  `;
}

function renderDiffPreview(session, showFullDiff = false) {
  const operations = Array.isArray(session.diff?.operations) ? session.diff.operations : [];
  const visibleOperations = showFullDiff ? operations : operations.slice(0, 16);
  return `
    <section class="revision-detail-section">
      <h3>${escapeHtml(showFullDiff ? "Compare Details" : "Diff Preview")}</h3>
      ${operations.length ? `
        <pre class="revision-diff-preview">${escapeHtml(JSON.stringify(visibleOperations, null, 2))}</pre>
        ${!showFullDiff && operations.length > visibleOperations.length ? `<p class="revision-muted">${escapeHtml(`${operations.length - visibleOperations.length} more operation${operations.length - visibleOperations.length === 1 ? "" : "s"} hidden.`)}</p>` : ""}
      ` : `<p class="revision-muted">No structured diff generated yet.</p>`}
    </section>
  `;
}

export function renderRevisionPanelHTML(model) {
  return `
    <div class="revision-panel">
      <div class="panel-heading">
        <p class="panel-kicker">Revision History</p>
        <h2>Writing Sessions</h2>
      </div>
      <div class="revision-panel-actions">
        <button class="tag-button panel-action-button is-primary" type="button" data-action="bank-revision">Bank Revision</button>
        <span>${escapeHtml(model.statusMessage || "Autosave keeps files safe; banking records creative history.")}</span>
      </div>
      <div class="revision-filter-row">
        <label>
          <span>Search sessions</span>
          <input type="search" value="${escapeHtml(model.query)}" data-revision-search placeholder="Scene rewrite, research, AI..." />
        </label>
        <label>
          <span>Change category</span>
          <select data-revision-category-filter>
            ${["all", ...model.categoryOptions].map((value) => renderOption(value, model.categoryFilter)).join("")}
          </select>
        </label>
        <label>
          <span>Change origin</span>
          <select data-revision-origin-filter>
            ${["all", ...model.originOptions].map((value) => renderOption(value, model.originFilter)).join("")}
          </select>
        </label>
      </div>
      <div class="revision-panel-layout">
        <aside class="revision-session-column">
          ${renderSessionList(model)}
        </aside>
        ${renderSelectedSession(model.selectedSession, model)}
      </div>
    </div>
  `;
}
