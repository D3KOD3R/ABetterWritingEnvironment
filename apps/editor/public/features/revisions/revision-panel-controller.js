// Intent: convert revision history into filtered UI state without owning rendering or persistence.
import { normalizeRevisionProjectState } from "../../adapters/storage/revision-storage-service.js";

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function formatDateKey(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sessionMatchesSearch(session, query) {
  if (!query) {
    return true;
  }

  const searchable = [
    session.metadata.title,
    session.metadata.description,
    session.summaryMarkdown,
    ...session.events.map((event) => event.description),
    ...session.changedEntities.map((entity) => entity.title ?? entity.entityId),
  ].join(" ").toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function sessionMatchesFilter(values, filterValue) {
  const filter = normalizeText(filterValue, "all");
  if (filter === "all") {
    return true;
  }
  return values.includes(filter);
}

function collectOptions(sessions, selector) {
  return [...new Set(sessions.flatMap(selector).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function createRevisionPanelController() {
  function buildPanelModel(revisionStateCandidate, panelState = {}) {
    const revisionState = normalizeRevisionProjectState(revisionStateCandidate);
    const sessions = [...revisionState.sessions].sort((left, right) =>
      String(right.metadata.startedAt || right.metadata.finalisedAt).localeCompare(String(left.metadata.startedAt || left.metadata.finalisedAt)),
    );
    const query = normalizeText(panelState.query, "");
    const categoryFilter = normalizeText(panelState.categoryFilter, "all");
    const originFilter = normalizeText(panelState.originFilter, "all");
    const filteredSessions = sessions.filter((session) =>
      sessionMatchesSearch(session, query) &&
      sessionMatchesFilter(session.metadata.changeCategories, categoryFilter) &&
      sessionMatchesFilter(session.metadata.origins, originFilter),
    );
    const selectedSessionId = normalizeText(panelState.selectedSessionId, "");
    const selectedSession =
      filteredSessions.find((session) => session.metadata.id === selectedSessionId) ??
      filteredSessions[0] ??
      null;
    const groupedSessions = [];
    const groupsByDate = new Map();
    for (const session of filteredSessions) {
      const key = formatDateKey(session.metadata.finalisedAt || session.metadata.stagedAt || session.metadata.startedAt);
      if (!groupsByDate.has(key)) {
        groupsByDate.set(key, {
          dateLabel: key,
          sessions: [],
        });
        groupedSessions.push(groupsByDate.get(key));
      }
      groupsByDate.get(key).sessions.push(session);
    }

    return {
      activeSessionId: revisionState.activeSessionId,
      query,
      categoryFilter,
      originFilter,
      selectedSession,
      selectedSessionId: selectedSession?.metadata.id ?? "",
      sessions,
      filteredSessions,
      groupedSessions,
      categoryOptions: collectOptions(sessions, (session) => session.metadata.changeCategories),
      originOptions: collectOptions(sessions, (session) => session.metadata.origins),
      statusMessage: normalizeText(panelState.statusMessage, ""),
    };
  }

  return {
    buildPanelModel,
  };
}
