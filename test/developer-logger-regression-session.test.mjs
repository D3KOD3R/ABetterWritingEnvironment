// Intent: run-specific gates must share the existing UI client without leaking settings or transports across runs.
import assert from "node:assert/strict";
import { createDeveloperLogger, createDeveloperLogClient } from "../apps/editor/public/shared/developer-logger.js";
import { readRegressionLogSession, regressionLogStorageOptions, regressionLogBaseUrls, regressionLogHeaders, regressionLogBridgeMatches, configureRegressionLogSources, observeRegressionLogSettings } from "../apps/editor/public/shared/regression-log-session.js";

export async function runDeveloperLoggerRegressionSessionTest() {
  assert.equal(readRegressionLogSession({}), null);
  assert.deepEqual(regressionLogStorageOptions(null), {});
  const originalOrigins = ["http://localhost:4310"];
  assert.equal(regressionLogBaseUrls(null, "http://localhost:9999", originalOrigins), originalOrigins);
  assert.deepEqual(regressionLogBaseUrls({ runId: "one" }, "http://localhost:9999", originalOrigins), ["http://localhost:9999"]);
  assert.deepEqual(regressionLogHeaders(null), {});
  assert.deepEqual(regressionLogHeaders({ runId: "one" }), { "X-ABE-Regression-Run": "one" });
  assert.equal(regressionLogBridgeMatches(null, {}), true);
  assert.equal(regressionLogBridgeMatches({ runId: "two" }, { regressionRunId: "one" }), false);
  assert.throws(() => readRegressionLogSession({ getElementById: () => ({ textContent: '{"runId":"../bad","enabledSources":[]}' }) }), /Invalid/);
  const values = new Map();
  const storageAdapter = { readJson: (key) => values.has(key) ? JSON.parse(values.get(key)) : null, writeJson: (key, value) => values.set(key, JSON.stringify(value)), remove: (key) => values.delete(key) };
  const ordinary = createDeveloperLogger({ windowRef: {}, storageAdapter });
  ordinary.setSourceEnabled("UnrelatedSource", true);
  const session = { runId: "one", enabledSources: ["AutosaveCoordinator"] };
  const options = { ...regressionLogStorageOptions(session), windowRef: {}, storageAdapter };
  const logger = createDeveloperLogger(options);
  configureRegressionLogSources(logger, session);
  assert.equal(logger.getSettings().sources.AutosaveCoordinator, true);
  assert.equal(logger.getSettings().sources.UnrelatedSource, undefined);
  const observed = [];
  const unsubscribe = observeRegressionLogSettings(logger, session, (settings) => observed.push(settings));
  logger.createSource("DisabledSource");
  await Promise.resolve();
  assert.equal(observed.length, 1, "disabled source registration must not duplicate metadata");
  logger.setSourceEnabled("AutosaveCoordinator", false);
  await Promise.resolve();
  assert.deepEqual(observed.at(-1).browserSettings.enabledSources, []);
  unsubscribe();
  const refreshed = createDeveloperLogger(options);
  configureRegressionLogSources(refreshed, session);
  assert.equal(refreshed.getSettings().sources.AutosaveCoordinator, false, "refresh must preserve the run's UI choices");
  const client = createDeveloperLogClient(options);
  assert.equal(client.getSettings().sources.AutosaveCoordinator, false);
  client.setSourceEnabled("AutosaveCoordinator", true);
  assert.equal(createDeveloperLogger(options).getSettings().sources.AutosaveCoordinator, true);
  const other = createDeveloperLogger({ ...options, ...regressionLogStorageOptions({ runId: "two" }) });
  assert.deepEqual(other.getSettings().registeredSources, []);
  assert.equal(ordinary.getSettings().sources.UnrelatedSource, true);
}
