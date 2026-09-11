// Intent: coordinate one regression RUN lifecycle and its state transitions without owning project persistence or supervisor reports.
import { spawnSync, fork } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename, realpath, lstat, readdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectGitState } from "../repo-supervisor/git-state.mjs";
import { createDeveloperLogger } from "../../apps/editor/public/shared/developer-logger.js";
import { configureRegressionLogSources, regressionLogStorageOptions, regressionLogHeaders } from "../../apps/editor/public/shared/regression-log-session.js";

const toolWorktree = fileURLToPath(new URL("../../", import.meta.url));
export const DEFAULT_SOURCES = ["AutosaveCoordinator", "ProjectPersistenceService", "ProjectLoadGate", "ProjectSaveGate", "DesktopFileSystemAdapter", "SceneStorageService"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const contained = (root, candidate) => { const rel = path.relative(root, candidate); return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel)); };

function git(worktree, args) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", worktree, ...args], { encoding: "utf8", shell: false, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout;
}

// Resolve existing ancestors before checking containment so a directory junction cannot disguise a source destination.
async function resolvedLocation(candidate) {
  let ancestor = path.resolve(candidate);
  while (true) {
    try { return path.resolve(await realpath(ancestor), path.relative(ancestor, path.resolve(candidate))); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

async function assertExternal(worktree, candidate) {
  if (!path.isAbsolute(candidate)) throw new Error("External workspace/log root must be absolute.");
  const resolved = await resolvedLocation(candidate);
  const roots = git(worktree, ["worktree", "list", "--porcelain", "-z"]).split("\0").filter((line) => line.startsWith("worktree ")).map((line) => line.slice(9));
  for (const root of roots) {
    const existing = await resolvedLocation(root);
    if (contained(existing, resolved) || contained(resolved, existing)) throw new Error("Run destinations must be outside and not contain any linked Git worktree.");
  }
  return resolved;
}

// Preserve the dirty source delta, not just HEAD: HEAD alone does not identify an uncommitted smoke build.
export async function captureSource(worktree) {
  const actualRoot = git(worktree, ["rev-parse", "--show-toplevel"]).trim();
  if (path.resolve(actualRoot) !== path.resolve(worktree)) throw new Error("Select the exact worktree root.");
  const state = collectGitState({ cwd: worktree, baseRef: "HEAD" });
  if (state.conflicts) throw new Error("Resolve Git conflicts before preparing a run.");
  const trackedPatch = git(worktree, ["diff", "--binary", "HEAD", "--"]);
  const untrackedFiles = [];
  let totalBytes = Buffer.byteLength(trackedPatch);
  if (totalBytes > 8 * 1024 * 1024) throw new Error("Source delta exceeds 8 MiB.");
  for (const relativePath of git(worktree, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort()) {
    const fullPath = path.resolve(worktree, relativePath);
    if (!contained(worktree, fullPath) || !contained(await realpath(worktree), await realpath(fullPath))) throw new Error("Source delta escapes the worktree.");
    const details = await lstat(fullPath);
    if (!details.isFile() || details.isSymbolicLink()) throw new Error("Source delta requires regular untracked files.");
    totalBytes += details.size;
    if (totalBytes > 8 * 1024 * 1024) throw new Error("Source delta exceeds 8 MiB; reduce unrelated untracked data before preparing a run.");
    untrackedFiles.push({ path: relativePath, contentsBase64: (await readFile(fullPath)).toString("base64") });
  }
  const sourceChanges = json({ trackedPatch, untrackedFiles });
  const sourceChangesSha256 = hash(sourceChanges);
  const sourceIdentityHash = hash(json({ worktree: path.resolve(worktree), branch: state.branch, headSha: state.headSha, sourceChangesSha256 }));
  return { state, sourceChanges, sourceChangesSha256, sourceIdentityHash };
}

async function atomicJson(filePath, value) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, json(value), { flag: "wx" });
  await rename(temporary, filePath);
}

export async function prepareRun({ workspaceRoot, caseId, expectedRegressionInvariant = null, worktree = toolWorktree, enabledSources = DEFAULT_SOURCES, allowDirty = false, externalLogRoot } = {}) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(caseId ?? "")) throw new Error("A path-safe case identifier is required.");
  if (expectedRegressionInvariant !== null && typeof expectedRegressionInvariant !== "string") throw new Error("Expected regression invariant must be a string or null.");
  if (!workspaceRoot) throw new Error("An explicit external workspace root is required.");
  if (!Array.isArray(enabledSources) || enabledSources.length > 100 || enabledSources.some((source) => !/^[A-Za-z][A-Za-z0-9._-]{0,99}$/.test(source))) throw new Error("Invalid developer log sources.");
  worktree = await realpath(worktree);
  const source = await captureSource(worktree);
  if (!allowDirty && !source.state.clean) throw new Error("Worktree is dirty; use --allow-dirty to retain its source delta explicitly.");
  workspaceRoot = await assertExternal(worktree, workspaceRoot);
  // Reuse the existing machine-local setting; explicit CLI input overrides it for this run only.
  let configuredLogRoot;
  try {
    configuredLogRoot = JSON.parse(await readFile(path.join(worktree, ".tools/config/local-development.json"), "utf8")).developmentLogging?.externalLogRoot;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const logRoot = await assertExternal(worktree, externalLogRoot ?? configuredLogRoot ?? path.join(workspaceRoot, "regression-evidence"));
  const commonDir = git(worktree, ["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  const repositoryPath = path.dirname(commonDir);
  // Follow the existing externalLogRoot contract: repository/worktree/test/run identity.
  const evidenceParent = await assertExternal(worktree, path.join(logRoot, path.basename(repositoryPath), path.basename(worktree), caseId));
  const createdAt = new Date().toISOString();
  const runId = `${createdAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}-${caseId.slice(0,32)}-${randomBytes(4).toString("hex")}`;
  const sandboxParent = await assertExternal(worktree, path.join(workspaceRoot, "sandboxes", caseId));
  const sandboxRoot = path.join(sandboxParent, runId);
  const evidenceRoot = path.join(evidenceParent, runId);
  // Only allocate fresh run directories. No cleaning, replacement or reuse of existing evidence.
  await mkdir(evidenceParent, { recursive: true });
  await mkdir(sandboxParent, { recursive: true });
  await mkdir(evidenceRoot);
  await mkdir(sandboxRoot);
  // Locations reserve space for future project creation; they are not initialized PROJECT FOLDERS.
  const allocatedProjectLocations = Object.fromEntries(["A", "B", "C"].map((name) => [`location${name}`, path.join(sandboxRoot, "project-locations", `location-${name.toLowerCase()}`)]));
  for (const location of Object.values(allocatedProjectLocations)) await mkdir(location, { recursive: true });
  const runtimeLogDirectory = path.join(evidenceRoot, "runtime-logs");
  await mkdir(runtimeLogDirectory);
  await mkdir(path.join(evidenceRoot, "manual-test-results"));
  // Contains actual source contents: keep local; never automatically commit, upload or share as ordinary evidence.
  await writeFile(path.join(evidenceRoot, "source-changes.json"), source.sourceChanges, { flag: "wx" });
  const packageInfo = JSON.parse(await readFile(path.join(worktree, "package.json"), "utf8"));
  const manifest = {
    schemaVersion: 2, caseId, runId, purpose: "Controlled ABE regression logging environment; preparation does not execute the regression.", runStatus: "prepared", createdAt,
    sourceRepositoryPath: repositoryPath, sourceWorktreePath: worktree,
    gitBranch: source.state.branch, gitHeadSha: source.state.headSha, gitWorkingTreeClean: source.state.clean,
    gitChangedFilesFingerprint: source.state.changedFilesFingerprint,
    sourceIdentityHash: source.sourceIdentityHash, sourceChangesSha256: source.sourceChangesSha256,
    sandboxRoot, allocatedProjectLocations, evidenceRoot,
    logging: { externalLogRoot: logRoot, desktopLogPath: path.join(runtimeLogDirectory, "desktop.log"), runtimeLogDirectory, enabledSources: [...new Set(enabledSources)].sort() },
    runtime: { applicationName: packageInfo.name, applicationVersion: packageInfo.version ?? null, nodeVersion: process.version, platform: process.platform },
    workspaceInvariant: "Source provenance, allocated project locations, initialized project folders and logs must remain attributable to this run.",
    // CASE meaning belongs to external input/checklists; the controller only preserves supplied data.
    expectedRegressionInvariant,
    knownEnvironmentLimitations: [
      "Desktop state remains module-relative at apps/desktop/.desktop-state.json; it is not isolated by this controller.",
      "Host cwd is the source worktree, matching npm run desktop. Speech scratch files under .tmp/realtime-speech and sidecar resources retain normal application locations; only controller-owned logs/evidence and allocated project locations are isolated.",
      "Browser project content/cache is not isolated by namespaced developer-log settings. Record and control the browser starting environment separately.",
      "Supervisor authority remains worktree-local under .tools/reports; this controller does not move or replace those reports.",
      "Source identity excludes ignored runtime files and external inputs. Log/source identity is recorded, not protected by filesystem permissions.",
      "Empty location-a/b/c directories are allocated project locations, not initialized PROJECT FOLDERS. Normal New Project requires a new, unoccupied destination beneath an allocated location.",
      "source-changes.json may contain actual uncommitted source contents. It must not be automatically committed, uploaded or shared as ordinary regression evidence; review its contents and obtain explicit authorization before sharing.",
    ],
  };
  const manifestPath = path.join(evidenceRoot, "run-manifest.json");
  await writeFile(manifestPath, json(manifest), { flag: "wx" });
  return { manifestPath, manifest };
}

export async function startRun(manifestPath, { port = 0, mode = "manual" } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid host port.");
  manifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 2) throw new Error("Unsupported run manifest schemaVersion; prepare a fresh version 2 run.");
  if (manifest.runStatus !== "prepared") throw new Error("Only a prepared, unexecuted run can start.");
  if (path.resolve(manifest.evidenceRoot, "run-manifest.json") !== manifestPath) throw new Error("Manifest evidence location mismatch.");
  await assertExternal(manifest.sourceWorktreePath, manifest.evidenceRoot);
  await assertExternal(manifest.sourceWorktreePath, manifest.sandboxRoot);
  if (path.resolve(manifest.logging.runtimeLogDirectory) !== path.join(manifest.evidenceRoot, "runtime-logs") || path.resolve(manifest.logging.desktopLogPath) !== path.join(manifest.evidenceRoot, "runtime-logs", "desktop.log")) throw new Error("Log destinations must belong to this run.");
  // A prepared run is single-use; reject directory redirection or pre-existing log content.
  for (const directory of [manifest.evidenceRoot, manifest.sandboxRoot, manifest.logging.runtimeLogDirectory]) {
    if (path.resolve(await realpath(directory)) !== path.resolve(directory)) throw new Error("Prepared run directory was redirected.");
  }
  if ((await readdir(manifest.logging.runtimeLogDirectory)).length) throw new Error("Prepared run already contains logs; prepare a fresh run.");
  const source = await captureSource(manifest.sourceWorktreePath);
  if (source.sourceIdentityHash !== manifest.sourceIdentityHash || hash(await readFile(path.join(manifest.evidenceRoot, "source-changes.json"))) !== manifest.sourceChangesSha256) throw new Error("Source changed since preparation; prepare a fresh run.");
  // Exclusive start receipt prevents two controllers from launching the same prepared run.
  const startedAt = new Date().toISOString();
  await writeFile(path.join(manifest.evidenceRoot, "run-start.json"), json({ startedAt, mode, sourceIdentityHash: source.sourceIdentityHash }), { flag: "wx" });
  const outputHandle = await open(path.join(manifest.logging.runtimeLogDirectory, "host-output.log"), "wx");
  const output = outputHandle.createWriteStream();
  manifest.runStatus = "running";
  manifest.startedAt = startedAt;
  manifest.executionMode = mode;
  manifest.runtime.launchCwd = manifest.sourceWorktreePath;
  manifest.runtime.requestedPort = port;
  await atomicJson(manifestPath, manifest);
  const child = fork(path.join(manifest.sourceWorktreePath, "apps/desktop/server.mjs"), [], {
    // Preserve repo-local runtime/model discovery and relative-path semantics of npm run desktop.
    // Existing environment overrides isolate logs without repurposing cwd as an output destination.
    cwd: manifest.sourceWorktreePath, execArgv: ["--experimental-strip-types"], windowsHide: true,
    env: { ...process.env, PORT: String(port), ABE_LOG_PATH: manifest.logging.desktopLogPath, ABE_DEVELOPER_RUNTIME_LOG_DIR: manifest.logging.runtimeLogDirectory, ABE_REGRESSION_RUN_MANIFEST: manifestPath },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child.stdout.pipe(output, { end: false });
  child.stderr.pipe(output, { end: false });
  let outcome = "completed";
  output.on("error", () => { outcome = "failed"; child.kill(); });
  const finished = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", async (code, signal) => {
      try {
        if (!output.destroyed) await new Promise((done) => output.end(done));
        try {
          const endSource = await captureSource(manifest.sourceWorktreePath);
          manifest.sourceIdentityUnchanged = endSource.sourceIdentityHash === manifest.sourceIdentityHash;
        } catch (error) {
          manifest.sourceIdentityUnchanged = false;
          manifest.sourceValidationError = error.message;
        }
        manifest.runStatus = code === 0 && manifest.sourceIdentityUnchanged && outcome === "completed" ? "completed" : "failed";
        manifest.completedAt = new Date().toISOString();
        manifest.exitCode = code;
        manifest.exitSignal = signal;
        await atomicJson(manifestPath, manifest);
        resolve(manifest);
      } catch (error) { reject(error); }
    });
  });
  // Attach immediately so early launch errors cannot become unhandled rejections while awaiting readiness.
  finished.catch(() => {});
  const stop = async (status = "completed") => {
    outcome = status;
    if (child.connected) child.send({ type: "abe-regression-stop" });
    const timer = setTimeout(() => child.kill(), 5000);
    try { return await finished; } finally { clearTimeout(timer); }
  };
  try {
    const actualPort = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ABE host readiness timed out.")), 15000);
      const cleanup = () => clearTimeout(timeout);
      child.once("error", (error) => { cleanup(); reject(error); });
      child.once("exit", () => { cleanup(); reject(new Error("ABE host exited before readiness.")); });
      child.on("message", (message) => { if (message?.type === "abe-host-ready") { cleanup(); resolve(message.port); } });
    });
    const baseUrl = `http://127.0.0.1:${actualPort}`;
    const request = async (route, body = {}) => {
      const response = await fetch(new URL(route, baseUrl), { method: "POST", headers: { "Content-Type": "application/json", ...regressionLogHeaders(manifest) }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`${route}: ${response.status} ${await response.text()}`);
      return response.status === 204 ? null : response.json();
    };
    const session = await request("/api/log/session");
    if (session.regressionRun?.runId !== manifest.runId) throw new Error("ABE responded with the wrong run identity.");
    // Presentation only: keep the transport origin separate and derive labels from existing RUN facts.
    // Neither the host nor browser session binding reads these query parameters as authority.
    const launchUrl = new URL("/", baseUrl);
    launchUrl.searchParams.set("abe-case", manifest.caseId);
    launchUrl.searchParams.set("abe-run", manifest.runId.slice(-8));
    manifest.hostUrl = baseUrl;
    manifest.launchUrl = launchUrl.href;
    manifest.runtime.boundPort = actualPort;
    manifest.processId = child.pid;
    manifest.runtimeLogFilePath = session.filePath;
    await atomicJson(manifestPath, manifest);
    return { manifest, baseUrl, launchUrl: launchUrl.href, request, stop, finished };
  } catch (error) { await stop("failed"); throw error; }
}

// Harmless exercise: serve the real editor and send existing structured developer events through the real host.
// It never opens the GUI, invokes persistence, reads an author project or edits desktop settings.
export async function smokeRun(options) {
  const prepared = await prepareRun(options);
  const running = await startRun(prepared.manifestPath, { mode: "logging-smoke" });
  try {
    const html = await (await fetch(running.launchUrl, { signal: AbortSignal.timeout(5000) })).text();
    if (!html.includes('id="abe-regression-log-session"') || !html.includes(running.manifest.runId)) throw new Error("Editor lacks run logging configuration.");
    const logsHtml = await (await fetch(`${running.baseUrl}/developer-logs.html`, { signal: AbortSignal.timeout(5000) })).text();
    if (!logsHtml.includes(running.manifest.runId)) throw new Error("Developer Logs window lacks run logging configuration.");
    const calls = [];
    const logger = createDeveloperLogger({
      ...regressionLogStorageOptions({ runId: running.manifest.runId }),
      windowRef: {}, persistEntriesToStorage: false,
      onEntry: (entry) => calls.push(running.request("/api/log", {
        level: entry.level, scope: entry.source, message: entry.message,
        context: { ...entry.context, category: entry.category, event: entry.event, timestamp: entry.timestamp, callsite: entry.callsite },
      })),
    });
    configureRegressionLogSources(logger, { enabledSources: running.manifest.logging.enabledSources });
    const settings = logger.getSettings();
    await running.request("/api/log/session", { runId: running.manifest.runId, browserSettings: { globalEnabled: settings.globalEnabled, enabledSources: Object.keys(settings.sources).filter((name) => settings.sources[name]) } });
    const source = running.manifest.logging.enabledSources[0];
    if (!source) throw new Error("Logging smoke requires at least one enabled source.");
    for (let checkpoint = 1; checkpoint <= 3; checkpoint += 1) {
      logger.info(source, "lifecycle", "regression.logging.smoke", "Controlled log-only smoke checkpoint.", { checkpoint });
      await calls.at(-1);
    }
    const tail = await running.request("/api/log/read", { limit: 20 });
    const events = tail.text.split(/\r?\n/).filter(Boolean).map(JSON.parse);
    if (events.length !== 3 || events.some((event, index) => event.context?.checkpoint !== index + 1)) throw new Error("Structured smoke events are missing or out of order.");
    const desktopEvents = (await readFile(running.manifest.logging.desktopLogPath, "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
    if (desktopEvents.length !== 3 || desktopEvents.some((event, index) => event.context?.checkpoint !== index + 1)) throw new Error("Desktop diagnostic file does not match the smoke checkpoints.");
    await running.request("/api/log/prune", { keepLatestSessions: 1 });
    if ((await running.request("/api/log/read", { limit: 20 })).text !== tail.text) throw new Error("Pruning changed the current run's session.");
    const metadata = JSON.parse(await readFile(path.join(running.manifest.logging.runtimeLogDirectory, "log-session.json"), "utf8"));
    if (metadata.runId !== running.manifest.runId || metadata.sourceIdentityHash !== running.manifest.sourceIdentityHash) throw new Error("Log file provenance mismatch.");
    for (const location of Object.values(running.manifest.allocatedProjectLocations)) if ((await readdir(location)).length) throw new Error("Smoke unexpectedly populated an allocated project location.");
    await writeFile(path.join(running.manifest.evidenceRoot, "manual-test-results", "logging-smoke.json"), json({ status: "passed", regressionExecuted: false, events: events.length, runId: metadata.runId, sessionFile: tail.filePath, projectLocationsEmpty: true }), { flag: "wx" });
    const result = await running.stop();
    if (result.runStatus !== "completed") throw new Error("Smoke source changed or host did not close successfully.");
    return { manifestPath: prepared.manifestPath, runId: result.runId, status: result.runStatus };
  } catch (error) { await running.stop("failed"); throw error; }
}

async function main(args) {
  const command = args.shift();
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (flag === "--allow-dirty") { flags.allowDirty = true; continue; }
    const names = { "--workspace": "workspaceRoot", "--case": "caseId", "--expected-invariant": "expectedRegressionInvariant", "--worktree": "worktree", "--sources": "sources", "--external-log-root": "externalLogRoot", "--manifest": "manifest", "--port": "port" };
    if (!names[flag] || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Unknown or incomplete option: ${flag}`);
    flags[names[flag]] = args[++i];
  }
  if (flags.sources !== undefined) flags.enabledSources = flags.sources.split(",").filter(Boolean);
  if (command === "prepare") console.log(json(await prepareRun(flags)));
  else if (command === "smoke") console.log(json(await smokeRun({ ...flags, caseId: flags.caseId ?? "infra-logging-smoke" })));
  else if (command === "start") {
    if (!flags.manifest) throw new Error("--manifest is required.");
    const run = await startRun(flags.manifest, { port: Number(flags.port ?? 0) });
    console.log(json({ runId: run.manifest.runId, url: run.launchUrl, manifestPath: path.resolve(flags.manifest) }));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void run.stop(); });
    const result = await run.finished;
    if (result.runStatus !== "completed") process.exitCode = 1;
  } else throw new Error("Usage: node --experimental-strip-types tools/regression-workspace/regression-run-controller.mjs <prepare|start|smoke> --workspace <absolute-path> --case <case-id> [--expected-invariant <text>] [--allow-dirty] [--sources SourceA,SourceB]; start uses --manifest <path> [--port <0-65535>] (default: 0, OS-assigned).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
