// Intent: keep revision-session persistence behind one adapter-compatible boundary.
// Browser MVP note:
// - Revision sessions are stored inside the project record for now.
// - The record shape mirrors the future desktop revisions folder layout, but no
//   browser-side pseudo-file paths are created here.
// - Desktop storage can later move these records into
//   revisions/sessions/<session-id>/revision.json, events.json,
//   project.diff.json, and summary.md behind the same service contract.

export const REVISION_PROJECT_SCHEMA_VERSION = 1;
export const REVISION_SESSION_STATUSES = new Set(["open", "staged", "finalised", "archived", "corrupt"]);

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

function normalizeStatus(value) {
  const candidate = normalizeText(value, "open").toLowerCase();
  return REVISION_SESSION_STATUSES.has(candidate) ? candidate : "corrupt";
}

function normalizeRevisionMetadata(candidate = {}) {
  const metadata = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  const sessionId = normalizeText(metadata.id ?? metadata.sessionId, "");
  const status = normalizeStatus(metadata.status);

  return {
    ...cloneValue(metadata),
    id: sessionId,
    sessionId,
    status: sessionId ? status : "corrupt",
    startedAt: normalizeText(metadata.startedAt, ""),
    stagedAt: normalizeText(metadata.stagedAt, ""),
    finalisedAt: normalizeText(metadata.finalisedAt, ""),
    archivedAt: normalizeText(metadata.archivedAt, ""),
    projectId: normalizeText(metadata.projectId, ""),
    baselineProjectHash: normalizeText(metadata.baselineProjectHash, ""),
    finalProjectHash: normalizeText(metadata.finalProjectHash, ""),
    title: normalizeText(metadata.title, "Writing Session"),
    description: normalizeText(metadata.description, ""),
    origin: normalizeText(metadata.origin, "manual_editor"),
    changeCategories: Array.isArray(metadata.changeCategories)
      ? metadata.changeCategories.filter((item) => typeof item === "string" && item.trim())
      : [],
    origins: Array.isArray(metadata.origins)
      ? metadata.origins.filter((item) => typeof item === "string" && item.trim())
      : [],
    writingSessionBoundaryKey: normalizeText(metadata.writingSessionBoundaryKey, ""),
  };
}

function normalizeRevisionEvent(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const id = normalizeText(candidate.id, "");
  const eventType = normalizeText(candidate.eventType ?? candidate.type, "");
  if (!id || !eventType) {
    return null;
  }

  return {
    ...cloneValue(candidate),
    id,
    eventType,
    timestamp: normalizeText(candidate.timestamp, ""),
    updatedAt: normalizeText(candidate.updatedAt, candidate.timestamp ?? ""),
    sessionId: normalizeText(candidate.sessionId, ""),
    origin: normalizeText(candidate.origin, "manual_editor"),
    sourceService: normalizeText(candidate.sourceService, candidate.origin ?? "manual_editor"),
    entityType: normalizeText(candidate.entityType, ""),
    entityId: normalizeText(candidate.entityId, ""),
    description: normalizeText(candidate.description, eventType),
    changeCategory: normalizeText(candidate.changeCategory, "manual"),
    mode: normalizeText(candidate.mode, "manual"),
    occurrenceCount: Math.max(1, Math.round(Number(candidate.occurrenceCount) || 1)),
    beforeSummary: candidate.beforeSummary && typeof candidate.beforeSummary === "object"
      ? cloneValue(candidate.beforeSummary)
      : null,
    afterSummary: candidate.afterSummary && typeof candidate.afterSummary === "object"
      ? cloneValue(candidate.afterSummary)
      : null,
  };
}

function normalizeRevisionSession(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createCorruptRevisionSession("Revision session was not an object.");
  }

  const metadata = normalizeRevisionMetadata(candidate.metadata ?? candidate.revision ?? candidate);
  if (!metadata.id) {
    return createCorruptRevisionSession("Revision session metadata was missing an ID.");
  }

  const events = Array.isArray(candidate.events)
    ? candidate.events.map(normalizeRevisionEvent).filter(Boolean)
    : [];
  const diff = candidate.diff && typeof candidate.diff === "object" && !Array.isArray(candidate.diff)
    ? cloneValue(candidate.diff)
    : null;
  const changedEntities = Array.isArray(candidate.changedEntities)
    ? candidate.changedEntities.filter((item) => item && typeof item === "object").map(cloneValue)
    : [];
  const checkpoints = Array.isArray(candidate.checkpoints)
    ? candidate.checkpoints.filter((item) => item && typeof item === "object").map(cloneValue)
    : [];
  const baselineDigest = candidate.baselineDigest && typeof candidate.baselineDigest === "object" && !Array.isArray(candidate.baselineDigest)
    ? cloneValue(candidate.baselineDigest)
    : null;

  return {
    metadata,
    baselineDigest,
    events,
    diff,
    changedEntities,
    summaryMarkdown: typeof candidate.summaryMarkdown === "string" ? candidate.summaryMarkdown : "",
    checkpoints,
  };
}

function createCorruptRevisionSession(reason) {
  const sessionId = `corrupt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    metadata: {
      id: sessionId,
      sessionId,
      status: "corrupt",
      startedAt: "",
      stagedAt: "",
      finalisedAt: "",
      archivedAt: "",
      projectId: "",
      baselineProjectHash: "",
      finalProjectHash: "",
      title: "Damaged Writing Session",
      description: reason,
      origin: "revision_storage",
      changeCategories: [],
      origins: ["revision_storage"],
      writingSessionBoundaryKey: "",
    },
    baselineDigest: null,
    events: [],
    diff: null,
    changedEntities: [],
    summaryMarkdown: reason,
    checkpoints: [],
  };
}

export function createEmptyRevisionProjectState() {
  return {
    schemaVersion: REVISION_PROJECT_SCHEMA_VERSION,
    activeSessionId: "",
    sessions: [],
  };
}

export function hasPersistableRevisionProjectState(candidate) {
  const revisionState = normalizeRevisionProjectState(candidate);
  return Boolean(
    revisionState.activeSessionId ||
    revisionState.sessions.length > 0,
  );
}

export function getPersistableRevisionProjectState(candidate) {
  const revisionState = normalizeRevisionProjectState(candidate);
  return hasPersistableRevisionProjectState(revisionState) ? revisionState : undefined;
}

export function normalizeRevisionProjectState(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return createEmptyRevisionProjectState();
  }

  const sessions = Array.isArray(candidate.sessions)
    ? candidate.sessions.map(normalizeRevisionSession)
    : [];
  const activeSessionId = normalizeText(candidate.activeSessionId, "");
  const activeSession = sessions.find((session) => session.metadata.id === activeSessionId);

  return {
    schemaVersion: REVISION_PROJECT_SCHEMA_VERSION,
    activeSessionId: activeSession && activeSession.metadata.status === "open" ? activeSessionId : "",
    sessions,
  };
}

export function createRevisionStorageService({
  logger = null,
} = {}) {
  const logInfo = (event, message, context = {}) => {
    if (logger && typeof logger.info === "function") {
      logger.info("persistence", event, message, context);
    }
  };

  const logWarn = (event, message, context = {}) => {
    if (logger && typeof logger.warn === "function") {
      logger.warn("persistence", event, message, context);
    }
  };

  function readRevisionState(projectRecord) {
    try {
      const revisionState = normalizeRevisionProjectState(projectRecord?.revisions);
      const corruptCount = revisionState.sessions.filter((session) => session.metadata.status === "corrupt").length;
      if (corruptCount) {
        logWarn("revision.history.corrupt-detected", "Corrupt revision sessions were detected while loading history.", {
          projectId: projectRecord?.id ?? "",
          corruptCount,
        });
      } else {
        logInfo("revision.history.loaded", "Loaded revision history from project record.", {
          projectId: projectRecord?.id ?? "",
          sessionCount: revisionState.sessions.length,
        });
      }
      return revisionState;
    } catch (error) {
      logWarn("revision.history.read-failed", "Revision history could not be read; returning empty state.", {
        projectId: projectRecord?.id ?? "",
        error,
      });
      return createEmptyRevisionProjectState();
    }
  }

  function writeRevisionState(projectRecord, revisionState) {
    const normalized = normalizeRevisionProjectState(revisionState);
    if (projectRecord && typeof projectRecord === "object") {
      projectRecord.revisions = cloneValue(normalized);
    }
    logInfo("revision.history.written", "Wrote revision state into the project record.", {
      projectId: projectRecord?.id ?? "",
      sessionCount: normalized.sessions.length,
      activeSessionId: normalized.activeSessionId,
    });
    return normalized;
  }

  return {
    readRevisionState,
    writeRevisionState,
  };
}
