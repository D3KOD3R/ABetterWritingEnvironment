// Intent: bind existing desktop log-session files to a controller-prepared run; never own project persistence.
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const manifestPath = process.env.ABE_REGRESSION_RUN_MANIFEST;
const manifest = manifestPath ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const hostWorktree = fileURLToPath(new URL("../../../", import.meta.url));
const runtimeStartedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
if (manifest && (
  manifest.schemaVersion !== 2 ||
  !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(manifest.runId ?? "") ||
  !Array.isArray(manifest.logging?.enabledSources) ||
  manifest.logging.enabledSources.length > 100 ||
  manifest.logging.enabledSources.some((source: unknown) => typeof source !== "string" || !/^[A-Za-z][A-Za-z0-9._-]{0,99}$/.test(source)) ||
  path.resolve(manifest.sourceWorktreePath) !== path.resolve(hostWorktree) ||
  path.resolve(manifest.logging.desktopLogPath) !== path.resolve(process.env.ABE_LOG_PATH ?? "") ||
  path.resolve(manifest.logging.runtimeLogDirectory) !== path.resolve(process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR ?? "")
)) throw new Error("Regression manifest does not match this host and its log destinations.");

let sessionMetadata: Record<string, any> | null = null;

export function getRegressionLogConfiguration() {
  return manifest ? { caseId: manifest.caseId, runId: manifest.runId, enabledSources: manifest.logging.enabledSources } : null;
}

export function regressionLogConfigurationHtml() {
  const configuration = getRegressionLogConfiguration();
  if (!configuration) return "";
  // Manifest strings must not be able to terminate the inert JSON script element.
  return `<script type="application/json" id="abe-regression-log-session">${JSON.stringify(configuration).replace(/</g, "\\u003c")}</script>`;
}

export function recordRegressionLogSession(session: { filePath: string; startedAt: string; sessionNumber: number }, body: any = {}) {
  if (!manifest) return;
  if (body.runId && body.runId !== manifest.runId) throw new Error("Log settings belong to another regression run.");
  if (!sessionMetadata) {
    sessionMetadata = {
      schemaVersion: 1,
      caseId: manifest.caseId,
      runId: manifest.runId,
      runManifestPath: path.resolve(manifestPath!),
      sourceIdentityHash: manifest.sourceIdentityHash,
      sourceChangesSha256: manifest.sourceChangesSha256,
      gitHeadSha: manifest.gitHeadSha,
      processId: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      runtimeStartedAt,
      runtimeWorktreePath: path.resolve(hostWorktree),
      desktopLogPath: manifest.logging.desktopLogPath,
      runtimeLogFilePath: session.filePath,
      logSessionStartedAt: session.startedAt,
      logSessionNumber: session.sessionNumber,
      requestedEnabledSources: manifest.logging.enabledSources,
      observedBrowserSettings: [],
      omittedSettingsChanges: 0,
    };
  }
  if (body.browserSettings) {
    const settings = body.browserSettings;
    if (typeof settings.globalEnabled !== "boolean" || !Array.isArray(settings.enabledSources) ||
        settings.enabledSources.length > 100 || settings.enabledSources.some((s: unknown) => typeof s !== "string" || s.length > 100)) {
      throw new Error("Invalid developer log source settings.");
    }
    const history = sessionMetadata.observedBrowserSettings;
    // Bounded metadata history; ordinary log events retain their existing envelope.
    if (history.length === 100) { history.shift(); sessionMetadata.omittedSettingsChanges += 1; }
    history.push({ capturedAt: new Date().toISOString(), globalEnabled: settings.globalEnabled, enabledSources: [...new Set(settings.enabledSources)].sort() });
  }
  const target = path.join(manifest.logging.runtimeLogDirectory, "log-session.json");
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(sessionMetadata, null, 2)}\n`);
  renameSync(temporary, target);
}
