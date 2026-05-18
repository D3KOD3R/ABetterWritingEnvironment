// Intent: orchestrate revision sessions, event banking, staging, and finalisation behind a UI-independent service.
import {
  createEmptyRevisionProjectState,
  normalizeRevisionProjectState,
} from "../../adapters/storage/revision-storage-service.js";
import { createRevisionDiffService } from "./revision-diff-service.js";
import { createRevisionEventService } from "./revision-event-service.js";

function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createId(prefix = "revision-session") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string" && value.trim()))];
}

function getSessionTitle(nowIso) {
  const date = nowIso ? new Date(nowIso) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "Writing Session";
  }
  return `Writing Session ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function buildWritingSessionBoundaryKey(context = {}) {
  const explicit = normalizeText(context.writingSessionBoundaryKey, "");
  if (explicit) {
    return explicit;
  }

  const startedAt = normalizeText(context.writingSessionStartedAt ?? context.sessionStartedAt, "");
  const concludedAt = normalizeText(context.writingSessionConcludedAt ?? context.concludedAt, "");
  const reason = normalizeText(context.concludedReason ?? context.reason, "");
  return [startedAt, concludedAt, reason].filter(Boolean).join("|");
}

function hasDiffChanges(diff) {
  return Boolean(
    Array.isArray(diff?.operations) && diff.operations.length > 0 ||
    Array.isArray(diff?.sceneChanges) && diff.sceneChanges.length > 0 ||
    Array.isArray(diff?.changedEntities) && diff.changedEntities.length > 0
  );
}

function hasMeaningfulRevision(session) {
  return Boolean(
    Array.isArray(session?.events) && session.events.length > 0 ||
    hasDiffChanges(session?.diff)
  );
}

export function createRevisionService({
  getProjectRecord = () => null,
  getProjectSnapshot = () => getProjectRecord(),
  getRevisionState = () => null,
  setRevisionState = () => {},
  logger = null,
  now = () => new Date().toISOString(),
  idFactory = createId,
  eventService = createRevisionEventService({ now, idFactory }),
  diffService = createRevisionDiffService({ now }),
} = {}) {
  const logInfo = (event, message, context = {}) => {
    if (logger && typeof logger.info === "function") {
      logger.info("revisions", event, message, context);
    }
  };
  const logWarn = (event, message, context = {}) => {
    if (logger && typeof logger.warn === "function") {
      logger.warn("revisions", event, message, context);
    }
  };

  function readState(projectRecord = getProjectRecord()) {
    return normalizeRevisionProjectState(getRevisionState() ?? projectRecord?.revisions);
  }

  function writeState(revisionState, context = {}) {
    const normalized = normalizeRevisionProjectState(revisionState);
    setRevisionState(normalized, context);
    return normalized;
  }

  function loadRevisionHistory(projectRecord = getProjectRecord()) {
    const revisionState = normalizeRevisionProjectState(projectRecord?.revisions);
    writeState(revisionState, {
      persist: false,
      source: "RevisionService.loadRevisionHistory",
      dirtyReason: "revision-history-load",
    });
    logInfo("revision.history.loaded", "Revision history loaded.", {
      projectId: projectRecord?.id ?? "",
      sessionCount: revisionState.sessions.length,
      activeSessionId: revisionState.activeSessionId,
    });
    return revisionState;
  }

  function getCurrentSession() {
    const revisionState = readState();
    return revisionState.sessions.find((session) => session.metadata.id === revisionState.activeSessionId) ?? null;
  }

  function createSessionRecord(options = {}) {
    const projectRecord = getProjectSnapshot();
    const projectId = normalizeText(projectRecord?.id ?? getProjectRecord()?.id, "");
    const timestamp = normalizeText(options.startedAt, now());
    const baselineDigest = diffService.buildProjectDigest(projectRecord ?? {});
    const sessionId = normalizeText(options.sessionId, idFactory("revision-session"));

    return {
      metadata: {
        id: sessionId,
        sessionId,
        status: "open",
        projectId,
        title: normalizeText(options.title, getSessionTitle(timestamp)),
        description: normalizeText(options.description, ""),
        startedAt: timestamp,
        stagedAt: "",
        finalisedAt: "",
        archivedAt: "",
        origin: normalizeText(options.origin, "manual_editor"),
        sourceService: normalizeText(options.sourceService, "RevisionService"),
        changeCategories: [],
        origins: [],
        baselineProjectHash: diffService.hashValue(baselineDigest),
        finalProjectHash: "",
        writingSessionBoundaryKey: "",
      },
      baselineDigest,
      events: [],
      diff: null,
      changedEntities: [],
      summaryMarkdown: "",
      checkpoints: [],
    };
  }

  function startSession(options = {}) {
    const revisionState = readState();
    const currentSession = revisionState.sessions.find((session) => session.metadata.id === revisionState.activeSessionId);
    if (currentSession && currentSession.metadata.status === "open") {
      return currentSession;
    }

    const session = createSessionRecord(options);
    const nextState = {
      ...revisionState,
      activeSessionId: session.metadata.id,
      sessions: [...revisionState.sessions, session],
    };
    writeState(nextState, {
      persist: options.persist === true,
      source: "RevisionService.startSession",
      dirtyReason: "revision-session-started",
      skipProjectFileAutosave: options.skipProjectFileAutosave !== false,
      markWorkingState: false,
    });
    logInfo("revision.session.started", "Revision session started.", {
      projectId: session.metadata.projectId,
      sessionId: session.metadata.id,
      baselineProjectHash: session.metadata.baselineProjectHash,
    });
    return session;
  }

  function recordEvent(input = {}, options = {}) {
    const session = startSession({
      origin: input.origin ?? "manual_editor",
      sourceService: input.sourceService ?? "RevisionService.recordEvent",
      persist: false,
    });
    const revisionState = readState();
    const sessionIndex = revisionState.sessions.findIndex((candidate) => candidate.metadata.id === session.metadata.id);
    if (sessionIndex < 0) {
      return null;
    }

    const currentSession = revisionState.sessions[sessionIndex];
    const nextEvents = eventService.aggregateEvents(currentSession.events, {
      ...input,
      sessionId: currentSession.metadata.id,
    });
    const categories = uniqueStrings([
      ...currentSession.metadata.changeCategories,
      ...nextEvents.map((event) => event.changeCategory),
    ]);
    const origins = uniqueStrings([
      ...currentSession.metadata.origins,
      ...nextEvents.map((event) => event.origin),
    ]);
    const nextSession = {
      ...currentSession,
      metadata: {
        ...currentSession.metadata,
        changeCategories: categories,
        origins,
      },
      events: nextEvents,
    };
    const nextSessions = [...revisionState.sessions];
    nextSessions[sessionIndex] = nextSession;
    writeState({
      ...revisionState,
      sessions: nextSessions,
    }, {
      persist: options.persist === true,
      source: "RevisionService.recordEvent",
      dirtyReason: "revision-event-recorded",
      skipProjectFileAutosave: options.skipProjectFileAutosave !== false,
      markWorkingState: false,
    });
    logInfo("revision.event.recorded", "Revision event recorded.", {
      projectId: currentSession.metadata.projectId,
      sessionId: currentSession.metadata.id,
      eventType: input.eventType ?? input.type ?? "manuscript_edit",
      entityType: input.entityType ?? "",
      entityId: input.entityId ?? "",
      eventCount: nextEvents.length,
    });
    return nextEvents[nextEvents.length - 1] ?? null;
  }

  function stageSession(sessionId = "", options = {}) {
    const revisionState = readState();
    const targetSessionId = normalizeText(sessionId, revisionState.activeSessionId);
    const sessionIndex = revisionState.sessions.findIndex((session) => session.metadata.id === targetSessionId);
    if (sessionIndex < 0) {
      logWarn("revision.session.stage-missing", "Revision session could not be staged because it was not found.", {
        sessionId: targetSessionId,
      });
      return null;
    }

    const session = revisionState.sessions[sessionIndex];
    if (session.metadata.status === "finalised" || session.metadata.status === "archived") {
      return session;
    }

    const currentDigest = diffService.buildProjectDigest(getProjectSnapshot() ?? {});
    const diff = diffService.createJsonDiff(session.baselineDigest ?? {}, currentDigest, session.events);
    const changedEntities = diffService.listChangedEntities(diff);
    const summaryMarkdown = diffService.summariseDiff(diff, session.events);
    const stagedAt = normalizeText(options.stagedAt, now());
    const nextSession = {
      ...session,
      metadata: {
        ...session.metadata,
        status: "staged",
        stagedAt,
        finalProjectHash: diff.finalHash,
        changeCategories: uniqueStrings([
          ...session.metadata.changeCategories,
          ...session.events.map((event) => event.changeCategory),
        ]),
        origins: uniqueStrings([
          ...session.metadata.origins,
          ...session.events.map((event) => event.origin),
        ]),
      },
      diff,
      changedEntities,
      summaryMarkdown,
    };
    const nextSessions = [...revisionState.sessions];
    nextSessions[sessionIndex] = nextSession;
    writeState({
      ...revisionState,
      sessions: nextSessions,
    }, {
      persist: options.persist === true,
      source: "RevisionService.stageSession",
      dirtyReason: "revision-session-staged",
      skipProjectFileAutosave: options.skipProjectFileAutosave !== false,
      markWorkingState: false,
    });
    logInfo("revision.session.staged", "Revision session staged.", {
      projectId: nextSession.metadata.projectId,
      sessionId: nextSession.metadata.id,
      operationCount: nextSession.diff.operations.length,
      changedEntityCount: changedEntities.length,
    });
    return nextSession;
  }

  function finaliseSession(sessionId = "", options = {}) {
    const staged = stageSession(sessionId, {
      ...options,
      persist: false,
    });
    if (!staged) {
      return null;
    }

    const revisionState = readState();
    const sessionIndex = revisionState.sessions.findIndex((session) => session.metadata.id === staged.metadata.id);
    if (sessionIndex < 0) {
      return null;
    }

    const finalisedAt = normalizeText(options.finalisedAt, now());
    const nextSession = {
      ...revisionState.sessions[sessionIndex],
      metadata: {
        ...revisionState.sessions[sessionIndex].metadata,
        status: "finalised",
        finalisedAt,
        writingSessionBoundaryKey: normalizeText(options.writingSessionBoundaryKey, revisionState.sessions[sessionIndex].metadata.writingSessionBoundaryKey),
      },
    };
    const nextSessions = [...revisionState.sessions];
    nextSessions[sessionIndex] = nextSession;
    writeState({
      ...revisionState,
      activeSessionId: revisionState.activeSessionId === nextSession.metadata.id ? "" : revisionState.activeSessionId,
      sessions: nextSessions,
    }, {
      persist: options.persist !== false,
      source: "RevisionService.finaliseSession",
      dirtyReason: "revision-session-finalised",
      skipProjectFileAutosave: options.skipProjectFileAutosave !== false,
      markWorkingState: options.markWorkingState === true,
    });
    logInfo("revision.session.finalised", "Revision session finalised.", {
      projectId: nextSession.metadata.projectId,
      sessionId: nextSession.metadata.id,
      finalProjectHash: nextSession.metadata.finalProjectHash,
    });
    return nextSession;
  }

  function bankCurrentRevision(context = {}) {
    const boundaryKey = buildWritingSessionBoundaryKey(context);
    const revisionState = readState();
    if (
      boundaryKey &&
      revisionState.sessions.some((session) =>
        session.metadata.status === "finalised" &&
        session.metadata.writingSessionBoundaryKey === boundaryKey,
      )
    ) {
      return {
        banked: false,
        reason: "already-banked",
        session: null,
      };
    }

    const currentSession = getCurrentSession();
    if (!currentSession) {
      return {
        banked: false,
        reason: "no-open-session",
        session: null,
      };
    }

    const staged = stageSession(currentSession.metadata.id, {
      persist: false,
    });
    if (!hasMeaningfulRevision(staged)) {
      return {
        banked: false,
        reason: "no-meaningful-changes",
        session: staged,
      };
    }

    const finalised = finaliseSession(staged.metadata.id, {
      persist: true,
      source: "RevisionService.bankCurrentRevision",
      dirtyReason: normalizeText(context.reason, "revision-banked"),
      writingSessionBoundaryKey: boundaryKey,
      skipProjectFileAutosave: context.skipProjectFileAutosave !== false,
      markWorkingState: context.markWorkingState === true,
    });

    return {
      banked: Boolean(finalised),
      reason: finalised ? "banked" : "finalise-failed",
      session: finalised,
    };
  }

  function archiveSession(sessionId) {
    const revisionState = readState();
    const targetSessionId = normalizeText(sessionId, "");
    const sessionIndex = revisionState.sessions.findIndex((session) => session.metadata.id === targetSessionId);
    if (sessionIndex < 0) {
      return null;
    }

    const nextSessions = [...revisionState.sessions];
    nextSessions[sessionIndex] = {
      ...nextSessions[sessionIndex],
      metadata: {
        ...nextSessions[sessionIndex].metadata,
        status: "archived",
        archivedAt: now(),
      },
    };
    return writeState({
      ...revisionState,
      activeSessionId: revisionState.activeSessionId === targetSessionId ? "" : revisionState.activeSessionId,
      sessions: nextSessions,
    }, {
      persist: true,
      source: "RevisionService.archiveSession",
      dirtyReason: "revision-session-archived",
      skipProjectFileAutosave: true,
      markWorkingState: false,
    });
  }

  function closeSession() {
    const revisionState = readState();
    return writeState({
      ...revisionState,
      activeSessionId: "",
    }, {
      persist: false,
      source: "RevisionService.closeSession",
      dirtyReason: "revision-session-closed",
      skipProjectFileAutosave: true,
      markWorkingState: false,
    });
  }

  function getSessionById(sessionId) {
    const revisionState = readState();
    return revisionState.sessions.find((session) => session.metadata.id === sessionId) ?? null;
  }

  return {
    archiveSession,
    bankCurrentRevision,
    closeSession,
    finaliseSession,
    getCurrentSession,
    getSessionById,
    loadRevisionHistory,
    recordEvent,
    readState,
    stageSession,
    startSession,
  };
}
