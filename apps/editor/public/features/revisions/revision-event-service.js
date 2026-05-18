// Intent: create and aggregate writer-facing revision ledger events without recording every keystroke.

const AGGREGATED_EVENT_TYPES = new Set(["manuscript_edit"]);

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function createId(prefix = "revision-event") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return null;
  }

  return cloneValue(summary);
}

function findAggregateEventIndex(events, event) {
  if (!AGGREGATED_EVENT_TYPES.has(event.eventType)) {
    return -1;
  }

  return events.findIndex((candidate) =>
    candidate?.eventType === event.eventType &&
    candidate?.sessionId === event.sessionId &&
    candidate?.origin === event.origin &&
    candidate?.sourceService === event.sourceService &&
    candidate?.entityType === event.entityType &&
    candidate?.entityId === event.entityId &&
    candidate?.changeCategory === event.changeCategory,
  );
}

export function createRevisionEventService({
  now = () => new Date().toISOString(),
  idFactory = createId,
} = {}) {
  function createEvent(input = {}) {
    const timestamp = normalizeText(input.timestamp, now());
    const eventType = normalizeText(input.eventType ?? input.type, "manuscript_edit");
    const origin = normalizeText(input.origin, "manual_editor");
    const sourceService = normalizeText(input.sourceService, origin);
    const entityType = normalizeText(input.entityType, "");
    const entityId = normalizeText(input.entityId, "");

    return {
      id: normalizeText(input.id, idFactory("revision-event")),
      timestamp,
      updatedAt: timestamp,
      sessionId: normalizeText(input.sessionId, ""),
      eventType,
      origin,
      sourceService,
      entityType,
      entityId,
      description: normalizeText(input.description, eventType.replace(/_/g, " ")),
      changeCategory: normalizeText(input.changeCategory, "manual"),
      mode: normalizeText(input.mode, input.changeCategory ?? "manual"),
      beforeSummary: normalizeSummary(input.beforeSummary),
      afterSummary: normalizeSummary(input.afterSummary),
      occurrenceCount: Math.max(1, Math.round(Number(input.occurrenceCount) || 1)),
      metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? cloneValue(input.metadata)
        : {},
    };
  }

  function aggregateEvents(events = [], nextEvent) {
    const normalizedEvents = Array.isArray(events) ? events.map(cloneValue) : [];
    const event = createEvent(nextEvent);
    const aggregateIndex = findAggregateEventIndex(normalizedEvents, event);
    if (aggregateIndex < 0) {
      return [...normalizedEvents, event];
    }

    const existing = normalizedEvents[aggregateIndex];
    normalizedEvents[aggregateIndex] = {
      ...existing,
      updatedAt: event.updatedAt,
      description: event.description || existing.description,
      afterSummary: event.afterSummary ?? existing.afterSummary,
      occurrenceCount: Math.max(1, Math.round(Number(existing.occurrenceCount) || 1)) + 1,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(event.metadata ?? {}),
      },
    };
    return normalizedEvents;
  }

  function listEventsForSession(revisionState, sessionId) {
    const sessions = Array.isArray(revisionState?.sessions) ? revisionState.sessions : [];
    const session = sessions.find((candidate) => candidate?.metadata?.id === sessionId);
    return Array.isArray(session?.events) ? session.events.map(cloneValue) : [];
  }

  return {
    aggregateEvents,
    createEvent,
    listEventsForSession,
  };
}
