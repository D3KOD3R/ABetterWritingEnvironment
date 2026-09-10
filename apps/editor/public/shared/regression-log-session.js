// Intent: configure the existing developer logger for one host-selected run without changing normal browser preferences.
export function readRegressionLogSession(documentRef = globalThis.document) {
  const text = documentRef?.getElementById?.("abe-regression-log-session")?.textContent;
  if (!text) return null;
  const session = JSON.parse(text);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(session.runId ?? "") || !Array.isArray(session.enabledSources) ||
      session.enabledSources.length > 100 || session.enabledSources.some((source) => typeof source !== "string" || !/^[A-Za-z][A-Za-z0-9._-]{0,99}$/.test(source))) {
    throw new Error("Invalid regression log session configuration.");
  }
  return session;
}

// Both the main logger and Developer Logs fallback client use the same existing storage/channel contracts.
export function regressionLogStorageOptions(session) {
  if (!session) return {};
  return {
    storageKey: `abe-developer-logs-v1:${session.runId}`,
    settingsStorageKey: `abe-developer-log-settings-v1:${session.runId}`,
    channelName: `abe-developer-logs-channel-v1:${session.runId}`,
  };
}

// A stopped regression host must never send logs or pruning commands to another host on the default port.
export function regressionLogBaseUrls(session, origin, normalBaseUrls) {
  return session ? [origin] : normalBaseUrls;
}

// Transport identity prevents an old tab from writing to a later run that reuses its host port.
// This header is validated at the host boundary and is not copied onto ordinary log events.
export function regressionLogHeaders(session) {
  return session ? { "X-ABE-Regression-Run": session.runId } : {};
}

export function regressionLogBridgeMatches(session, bridge) {
  return (session?.runId ?? null) === (bridge?.regressionRunId ?? null);
}

export function configureRegressionLogSources(logger, session) {
  if (!session) return;
  // Keep changes made in the Developer Logs UI across refreshes within this run only.
  if (logger.getSettings().registeredSources.length) return;
  for (const source of session.enabledSources) logger.setSourceEnabled(source, true);
}

// Settings are session metadata. Send only changes to enabled gates, not every source registration/event.
export function observeRegressionLogSettings(logger, session, send) {
  if (!session) return () => {};
  let previous = "";
  const capture = () => {
    const settings = logger.getSettings();
    const browserSettings = {
      globalEnabled: settings.globalEnabled,
      enabledSources: Object.keys(settings.sources).filter((source) => settings.sources[source]).sort(),
    };
    const signature = JSON.stringify(browserSettings);
    if (signature === previous) return;
    previous = signature;
    Promise.resolve().then(() => send({ runId: session.runId, browserSettings })).catch(() => {
      // No recursive logging when the logging transport itself is unavailable.
    });
  };
  const unsubscribe = logger.subscribeSettings(capture);
  capture();
  return unsubscribe;
}
