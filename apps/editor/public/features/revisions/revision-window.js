// Intent: render the standalone revisions window as a developer-style compare surface without owning revision state.
import { escapeHtml, formatDisplayNumber } from "../../shared/ui-utils.js";

// Intent: keep user-facing revision timestamps compact and stable across the side panel and window mockup.
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

function formatDiffValue(value, fallback = "No value") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function getDiffSummary(session) {
  return {
    added: Math.max(0, Math.round(Number(session?.diff?.summary?.added) || 0)),
    removed: Math.max(0, Math.round(Number(session?.diff?.summary?.removed) || 0)),
    changed: Math.max(0, Math.round(Number(session?.diff?.summary?.changed) || 0)),
  };
}

// Intent: derive short, file-like labels from structured project digest paths for the compare rail.
function getDiffFileLabel(operation) {
  const path = String(operation?.path ?? "").trim();
  if (!path) {
    return "project/digest";
  }

  const parts = path.split(".");
  if (parts.length >= 3 && parts[1]?.endsWith("ById")) {
    const collection = parts[1].replace(/ById$/, "");
    const entityId = parts[2] ?? "unknown";
    return `${parts[0]}/${collection}/${entityId}`;
  }

  return parts.slice(0, 3).join("/") || path;
}

function getDiffFileField(operation) {
  const path = String(operation?.path ?? "").trim();
  const parts = path.split(".");
  if (parts.length >= 4 && parts[1]?.endsWith("ById")) {
    return parts.slice(3).join(".");
  }
  return parts.slice(3).join(".") || parts.at(-1) || "value";
}

function collectChangedFiles(session) {
  const fileMap = new Map();
  const operations = Array.isArray(session?.diff?.operations) ? session.diff.operations : [];
  for (const operation of operations) {
    const label = getDiffFileLabel(operation);
    const existing = fileMap.get(label) ?? {
      label,
      added: 0,
      removed: 0,
      changed: 0,
    };
    if (operation?.op === "add") {
      existing.added += 1;
    } else if (operation?.op === "remove") {
      existing.removed += 1;
    } else {
      existing.changed += 1;
    }
    fileMap.set(label, existing);
  }

  return [...fileMap.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function getChangedEntities(session) {
  return Array.isArray(session?.changedEntities) ? session.changedEntities : [];
}

function getVisibleOperations(session, showFullDiff) {
  const operations = Array.isArray(session?.diff?.operations) ? session.diff.operations : [];
  return showFullDiff ? operations : operations.slice(0, 24);
}

// Intent: render a compact session navigator inside the standalone window.
function renderSessionNavigator(model) {
  if (!model.groupedSessions.length) {
    return `
      <div class="revision-window-empty">
        <strong>No revision sessions</strong>
        <span>Banked writing sessions will appear here.</span>
      </div>
    `;
  }

  return model.groupedSessions.map((group) => `
    <section class="revision-window-session-group">
      <h3>${escapeHtml(group.dateLabel)}</h3>
      <div class="revision-window-session-list">
        ${group.sessions.map((session) => renderSessionButton(session, model.selectedSessionId)).join("")}
      </div>
    </section>
  `).join("");
}

function renderSessionButton(session, selectedSessionId) {
  const isSelected = session.metadata.id === selectedSessionId;
  const summary = getDiffSummary(session);
  return `
    <button
      class="revision-window-session ${isSelected ? "is-selected" : ""}"
      type="button"
      data-action="select-revision-session"
      data-revision-session-id="${escapeHtml(session.metadata.id)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span>${escapeHtml(formatTimestamp(session.metadata.finalisedAt || session.metadata.stagedAt || session.metadata.startedAt))}</span>
      <strong>${escapeHtml(session.metadata.title || "Writing Session")}</strong>
      <em>${escapeHtml(formatStatus(session.metadata.status))} | ${escapeHtml(formatDisplayNumber(summary.changed + summary.added + summary.removed))} ops</em>
    </button>
  `;
}

// Intent: expose revision filters in the window while reusing the existing panel state/actions.
function renderRevisionWindowToolbar(model) {
  return `
    <div class="revision-window-toolbar" aria-label="Revision filters">
      <label>
        <span>Search</span>
        <input type="search" value="${escapeHtml(model.query)}" data-revision-search placeholder="Scene, entity, note, origin" />
      </label>
      <label>
        <span>Category</span>
        <select data-revision-category-filter>
          ${["all", ...model.categoryOptions].map((value) => renderOption(value, model.categoryFilter)).join("")}
        </select>
      </label>
      <label>
        <span>Origin</span>
        <select data-revision-origin-filter>
          ${["all", ...model.originOptions].map((value) => renderOption(value, model.originFilter)).join("")}
        </select>
      </label>
    </div>
  `;
}

function renderSummaryStats(session) {
  const summary = getDiffSummary(session);
  const changedEntities = getChangedEntities(session).length;
  const eventCount = Array.isArray(session?.events) ? session.events.length : 0;
  return `
    <div class="revision-window-stat-grid" aria-label="Revision summary">
      <div><span>Changed</span><strong>${escapeHtml(formatDisplayNumber(summary.changed))}</strong></div>
      <div><span>Added</span><strong class="is-added">${escapeHtml(formatDisplayNumber(summary.added))}</strong></div>
      <div><span>Removed</span><strong class="is-removed">${escapeHtml(formatDisplayNumber(summary.removed))}</strong></div>
      <div><span>Entities</span><strong>${escapeHtml(formatDisplayNumber(changedEntities))}</strong></div>
      <div><span>Events</span><strong>${escapeHtml(formatDisplayNumber(eventCount))}</strong></div>
    </div>
  `;
}

function renderChangedFiles(session) {
  const files = collectChangedFiles(session);
  if (!files.length) {
    return `
      <div class="revision-window-empty is-compact">
        <strong>No changed files</strong>
        <span>This session has no structured diff operations.</span>
      </div>
    `;
  }

  return `
    <div class="revision-window-file-list" aria-label="Changed files">
      ${files.map((file) => `
        <button class="revision-window-file" type="button">
          <span>${escapeHtml(file.label)}</span>
          <strong>
            ${file.added ? `<em class="is-added">+${escapeHtml(formatDisplayNumber(file.added))}</em>` : ""}
            ${file.removed ? `<em class="is-removed">-${escapeHtml(formatDisplayNumber(file.removed))}</em>` : ""}
            ${file.changed ? `<em>${escapeHtml(formatDisplayNumber(file.changed))}</em>` : ""}
          </strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderChangedEntities(session) {
  const entities = getChangedEntities(session);
  if (!entities.length) {
    return "";
  }

  return `
    <div class="revision-window-entity-strip" aria-label="Changed scenes and entities">
      ${entities.slice(0, 10).map((entity) => `
        <button
          class="revision-window-entity"
          type="button"
          data-action="revision-open-entity"
          data-revision-entity-type="${escapeHtml(entity.entityType ?? "")}"
          data-revision-entity-id="${escapeHtml(entity.entityId ?? "")}"
        >
          <span>${escapeHtml(entity.entityType ?? "entity")}</span>
          <strong>${escapeHtml(entity.title ?? entity.entityId ?? "Changed entity")}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

// Intent: render the side-by-side compare table as a readable mockup over existing JSON digest operations.
function renderCompareRows(session, showFullDiff) {
  const operations = Array.isArray(session?.diff?.operations) ? session.diff.operations : [];
  const visibleOperations = getVisibleOperations(session, showFullDiff);
  if (!operations.length) {
    return `
      <div class="revision-window-empty">
        <strong>No diff generated</strong>
        <span>Bank a revision with project changes to inspect before and after values.</span>
      </div>
    `;
  }

  return `
    <div class="revision-window-compare-table" role="table" aria-label="Before and after revision compare">
      <div class="revision-window-compare-head" role="row">
        <span role="columnheader">Path</span>
        <span role="columnheader">Before</span>
        <span role="columnheader">After</span>
      </div>
      ${visibleOperations.map((operation, index) => renderCompareRow(operation, index)).join("")}
    </div>
    ${!showFullDiff && operations.length > visibleOperations.length ? `
      <p class="revision-window-hidden-count">${escapeHtml(formatDisplayNumber(operations.length - visibleOperations.length))} more operation${operations.length - visibleOperations.length === 1 ? "" : "s"} hidden.</p>
    ` : ""}
  `;
}

function renderCompareRow(operation, index) {
  const rowTone = operation.op === "add"
    ? "is-added"
    : operation.op === "remove"
      ? "is-removed"
      : "is-changed";
  const leftValue = operation.op === "add"
    ? ""
    : formatDiffValue(operation.before, "No previous value");
  const rightValue = operation.op === "remove"
    ? ""
    : formatDiffValue(operation.after, "No new value");

  return `
    <div class="revision-window-compare-row ${rowTone}" role="row">
      <div class="revision-window-path-cell" role="cell">
        <span>${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
        <strong>${escapeHtml(getDiffFileField(operation))}</strong>
        <em>${escapeHtml(getDiffFileLabel(operation))}</em>
      </div>
      <pre class="revision-window-diff-cell is-before" role="cell">${escapeHtml(leftValue)}</pre>
      <pre class="revision-window-diff-cell is-after" role="cell">${escapeHtml(rightValue)}</pre>
    </div>
  `;
}

function renderSelectedSession(model) {
  const session = model.selectedSession;
  if (!session) {
    return `
      <section class="revision-window-main">
        <div class="revision-window-empty">
          <strong>No writing session selected</strong>
          <span>Choose a session to inspect its revision summary and before/after compare.</span>
        </div>
      </section>
    `;
  }

  const originLabel = (session.metadata.origins ?? []).join(", ") || session.metadata.origin || "manual_editor";
  return `
    <section class="revision-window-main">
      <div class="revision-window-main-header">
        <div>
          <p class="revision-window-kicker">Revision Compare</p>
          <h3>${escapeHtml(session.metadata.title || "Writing Session")}</h3>
          <span>${escapeHtml(formatTimestamp(session.metadata.finalisedAt || session.metadata.stagedAt || session.metadata.startedAt))} | ${escapeHtml(originLabel)} | ${escapeHtml(formatStatus(session.metadata.status))}</span>
        </div>
        <div class="revision-window-actions">
          <button class="tag-button panel-action-button" type="button" data-action="revision-open-first-scene" data-revision-session-id="${escapeHtml(session.metadata.id)}">Open First Scene</button>
          <button class="tag-button panel-action-button" type="button" data-action="revision-toggle-diff-detail">${escapeHtml(model.showFullDiff ? "Compact Diff" : "Full Diff")}</button>
          <button class="tag-button panel-action-button" type="button" data-action="revision-export-summary" data-revision-session-id="${escapeHtml(session.metadata.id)}">Export Summary</button>
        </div>
      </div>
      ${renderSummaryStats(session)}
      ${renderChangedEntities(session)}
      <div class="revision-window-diff-shell">
        <aside class="revision-window-file-rail">
          <div class="revision-window-rail-heading">
            <span>Changed files</span>
            <strong>${escapeHtml(formatDisplayNumber(collectChangedFiles(session).length))}</strong>
          </div>
          ${renderChangedFiles(session)}
        </aside>
        <section class="revision-window-compare">
          <div class="revision-window-compare-title">
            <div>
              <span>Before</span>
              <strong>${escapeHtml(session.metadata.baselineProjectHash || session.diff?.baselineHash || "baseline")}</strong>
            </div>
            <div>
              <span>After</span>
              <strong>${escapeHtml(session.metadata.finalProjectHash || session.diff?.finalHash || "current")}</strong>
            </div>
          </div>
          ${renderCompareRows(session, model.showFullDiff)}
        </section>
      </div>
    </section>
  `;
}

// Intent: compose the complete revisions window from the prepared revision history model.
export function renderRevisionWindowHTML(model) {
  const safeModel = model ?? {
    groupedSessions: [],
    categoryOptions: [],
    originOptions: [],
    selectedSession: null,
    selectedSessionId: "",
    query: "",
    categoryFilter: "all",
    originFilter: "all",
    showFullDiff: false,
  };

  return `
    <section class="revision-window" role="dialog" aria-label="Revisions panel">
      <header class="revision-window-header">
        <div class="revision-window-title">
          <p class="revision-window-kicker">Revision History</p>
          <h2>Revisions Panel</h2>
          <span>${escapeHtml(safeModel.statusMessage || "Banked sessions, changed entities, and structured project diffs.")}</span>
        </div>
        <button
          class="revision-window-close"
          type="button"
          data-action="close-revision-window"
          aria-label="Close revisions panel"
          title="Close"
        >&times;</button>
      </header>
      ${renderRevisionWindowToolbar(safeModel)}
      <div class="revision-window-body">
        <aside class="revision-window-sidebar">
          <div class="revision-window-sidebar-heading">
            <span>Sessions</span>
            <strong>${escapeHtml(formatDisplayNumber(safeModel.filteredSessions?.length ?? 0))}</strong>
          </div>
          ${renderSessionNavigator(safeModel)}
          <button class="tag-button panel-action-button is-primary revision-window-bank" type="button" data-action="bank-revision">Bank Revision</button>
        </aside>
        ${renderSelectedSession(safeModel)}
      </div>
    </section>
  `;
}
