// Intent: enforce developer logger source-gate defaults so high-volume logs stay off unless explicitly enabled.
import assert from "node:assert/strict";

import {
  createDeveloperLogClient,
  createDeveloperLogger,
} from "../apps/editor/public/shared/developer-logger.js";

export function runDeveloperLoggerTest() {
  const storage = createMemoryStorageAdapter();
  const logger = createDeveloperLogger({
    windowRef: {},
    storageAdapter: storage,
    mirrorConsole: false,
  });

  const autosaveSource = logger.createSource("AutosaveCoordinator");
  const persistenceSource = logger.createSource("ProjectPersistenceService");

  assert.equal(autosaveSource.isEnabled(), false);
  assert.equal(persistenceSource.isEnabled(), false);
  assert.equal(logger.getEntries().length, 0);

  const dropped = autosaveSource.info("autosave", "autosave.scheduled", "autosave scheduled", { projectId: "project-1" });
  assert.equal(dropped, null);
  assert.equal(logger.getEntries().length, 0);

  logger.setSourceEnabled("AutosaveCoordinator", true);
  assert.equal(autosaveSource.isEnabled(), true);
  assert.equal(persistenceSource.isEnabled(), false);

  autosaveSource.info("autosave", "autosave.started", "autosave started", { projectId: "project-1" });
  assert.equal(logger.getEntries().length, 1);
  assert.equal(logger.getEntries()[0].source, "AutosaveCoordinator");

  const droppedPersistence = persistenceSource.warn("persistence", "project.save.skipped", "save skipped", { projectId: "project-1" });
  assert.equal(droppedPersistence, null);
  assert.equal(logger.getEntries().length, 1);

  logger.setAllSourcesEnabled(true);
  persistenceSource.warn("persistence", "project.save.started", "save started", { projectId: "project-1" });
  assert.equal(logger.getEntries().length, 2);

  logger.setGlobalEnabled(false);
  const globallyDropped = autosaveSource.error("autosave", "autosave.failed", "autosave failed", { projectId: "project-1" });
  assert.equal(globallyDropped, null);
  assert.equal(logger.getEntries().length, 2);

  logger.setSourceEnabled("AutosaveCoordinator", true);
  assert.equal(logger.getSettings().globalEnabled, true);

  logger.setGlobalEnabled(true);
  autosaveSource.error("autosave", "autosave.failed", "autosave failed", { projectId: "project-1" });
  assert.equal(logger.getEntries().length, 3);

  // Cross-window fallback: when BroadcastChannel is unavailable, settings updates should sync via storage events.
  const sharedStorage = createMemoryStorageAdapter();
  const loggerWindow = createFakeWindowRef();
  const clientWindow = createFakeWindowRef();
  const crossWindowLogger = createDeveloperLogger({
    windowRef: loggerWindow,
    storageAdapter: sharedStorage,
  });
  const crossWindowClient = createDeveloperLogClient({
    windowRef: clientWindow,
    storageAdapter: sharedStorage,
  });
  const crossAutosaveSource = crossWindowLogger.createSource("AutosaveCoordinator");
  assert.equal(crossAutosaveSource.isEnabled(), false);
  assert.equal(crossAutosaveSource.info("autosave", "autosave.started", "autosave", {}), null);

  crossWindowClient.setSourceEnabled("AutosaveCoordinator", true);
  loggerWindow.dispatchStorage("abe-developer-log-settings-v1");
  assert.equal(crossAutosaveSource.isEnabled(), true);
  assert.equal(crossWindowLogger.getSettings().globalEnabled, true);
  assert.notEqual(crossAutosaveSource.info("autosave", "autosave.started", "autosave", {}), null);
}

function createMemoryStorageAdapter() {
  const values = new Map();
  return {
    readJson(key) {
      const raw = values.get(String(key));
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    },
    writeJson(key, value) {
      values.set(String(key), JSON.stringify(value));
    },
    remove(key) {
      values.delete(String(key));
    },
  };
}

function createFakeWindowRef() {
  const handlers = new Map();
  return {
    addEventListener(type, handler) {
      if (typeof handler !== "function") {
        return;
      }
      handlers.set(type, handler);
    },
    dispatchStorage(key) {
      const handler = handlers.get("storage");
      if (typeof handler === "function") {
        handler({ key });
      }
    },
  };
}
