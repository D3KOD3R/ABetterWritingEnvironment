// Intent: prove source guards and exercise two real host sessions without invoking project persistence.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fork, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { prepareRun, startRun, smokeRun } from "../tools/regression-workspace/regression-run-controller.mjs";
import { readRegressionLogSession, regressionLogHeaders } from "../apps/editor/public/shared/regression-log-session.js";

export async function runDesktopRegressionWorkspaceTest() {
  const root = await mkdtemp(path.join(tmpdir(), "abe-regression-controller-"));
  try {
    const fixture = path.join(root, "source");
    const workspaceRoot = path.join(root, "workspace");
    await mkdir(fixture);
    const git = (...args) => {
      const result = spawnSync("git", ["-C", fixture, ...args], { encoding: "utf8", windowsHide: true });
      assert.equal(result.status, 0, result.stderr);
    };
    git("init", "-b", "test");
    await writeFile(path.join(fixture, "package.json"), '{"name":"fixture"}');
    git("add", "package.json");
    git("-c", "user.name=Regression test", "-c", "user.email=test@example.invalid", "commit", "-m", "isolated test fixture");
    // Even an identifier containing a familiar checklist token must carry no inferred CASE meaning.
    const options = { workspaceRoot, worktree: fixture, caseId: "opaque-8.2e-identifier" };
    await assert.rejects(prepareRun({ ...options, workspaceRoot: path.join(fixture, "runs") }), /outside/);
    await assert.rejects(prepareRun({ ...options, caseId: "../escape" }), /identifier/);
    await assert.rejects(prepareRun({ ...options, expectedRegressionInvariant: 42 }), /string or null/);
    const prepared = await prepareRun(options);
    assert.equal(prepared.manifest.gitWorkingTreeClean, true);
    assert.equal(prepared.manifest.runStatus, "prepared");
    const savedManifest = JSON.parse(await readFile(prepared.manifestPath, "utf8"));
    assert.equal(savedManifest.schemaVersion, 2);
    assert.equal(savedManifest.expectedRegressionInvariant, null);
    assert.equal(Object.hasOwn(savedManifest, "projectFolderPaths"), false);
    assert.deepEqual(Object.keys(savedManifest.allocatedProjectLocations), ["locationA", "locationB", "locationC"]);
    for (const [name, location] of Object.entries(savedManifest.allocatedProjectLocations)) {
      assert.equal(location, path.join(savedManifest.sandboxRoot, "project-locations", `location-${name.at(-1).toLowerCase()}`));
      assert.deepEqual(await readdir(location), []);
    }
    assert.deepEqual(await readdir(savedManifest.sandboxRoot), ["project-locations"]);
    // Missing, historical and unknown formats must be rejected before acquiring a start receipt or launching.
    for (const schemaVersion of [undefined, 1, 999]) {
      await writeFile(prepared.manifestPath, JSON.stringify({ ...savedManifest, schemaVersion }));
      await assert.rejects(startRun(prepared.manifestPath), /Unsupported run manifest schemaVersion/);
    }
    assert.equal((await readdir(savedManifest.evidenceRoot)).includes("run-start.json"), false);
    await writeFile(prepared.manifestPath, JSON.stringify(savedManifest));

    // Exercise real CLI argument forwarding using a fresh CASE supplied entirely as data.
    const cliPath = fileURLToPath(new URL("../tools/regression-workspace/regression-run-controller.mjs", import.meta.url));
    const invariant = "Caller-defined checkpoint output must remain attributable to its run.";
    const cliCaseId = `external-case-${randomUUID()}`;
    const cli = (...args) => spawnSync(process.execPath, ["--experimental-strip-types", cliPath, ...args], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30000 });
    const cliPreparation = cli("prepare", "--workspace", workspaceRoot, "--worktree", fixture, "--case", cliCaseId, "--expected-invariant", invariant);
    assert.equal(cliPreparation.status, 0, cliPreparation.stderr);
    const cliPrepared = JSON.parse(cliPreparation.stdout);
    assert.equal(cliPrepared.manifest.caseId, cliCaseId);
    assert.equal(cliPrepared.manifest.expectedRegressionInvariant, invariant);
    // This fixture deliberately has no desktop host: verify CLI defaults and failed-launch finalization
    // without needing a GUI interrupt or adding a test-only lifecycle control to production code.
    const cliLaunch = cli("start", "--manifest", cliPrepared.manifestPath);
    assert.equal(cliLaunch.status, 1, cliLaunch.stderr);
    const cliFailed = JSON.parse(await readFile(cliPrepared.manifestPath, "utf8"));
    assert.equal(cliFailed.runStatus, "failed");
    assert.equal(cliFailed.runtime.requestedPort, 0);
    assert.equal(cliFailed.runtime.launchCwd, fixture);
    assert.equal(cliFailed.expectedRegressionInvariant, invariant);
    assert.match(await readFile(path.join(cliFailed.logging.runtimeLogDirectory, "host-output.log"), "utf8"), /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/);
    await writeFile(path.join(fixture, "uncommitted.txt"), "one");
    await assert.rejects(startRun(prepared.manifestPath), /Source changed/);
    await assert.rejects(prepareRun(options), /dirty/);
    const dirty = await prepareRun({ ...options, allowDirty: true });
    assert.equal(dirty.manifest.gitWorkingTreeClean, false);
    const changes = JSON.parse(await readFile(path.join(dirty.manifest.evidenceRoot, "source-changes.json"), "utf8"));
    assert.equal(Buffer.from(changes.untrackedFiles[0].contentsBase64, "base64").toString(), "one");
    await writeFile(path.join(fixture, "uncommitted.txt"), "two");
    await assert.rejects(startRun(dirty.manifestPath), /Source changed/);

    const worktree = fileURLToPath(new URL("../", import.meta.url));
    const first = await smokeRun({ workspaceRoot, worktree, caseId: cliCaseId, expectedRegressionInvariant: invariant, allowDirty: true });
    const firstManifest = JSON.parse(await readFile(first.manifestPath, "utf8"));
    assert.equal(firstManifest.caseId, cliCaseId);
    assert.equal(firstManifest.expectedRegressionInvariant, invariant);
    assert.equal(firstManifest.runtime.requestedPort, 0);
    assert.equal(firstManifest.runtime.boundPort, Number(new URL(firstManifest.hostUrl).port));
    assert.ok(firstManifest.runtime.boundPort > 0);
    const firstUrl = new URL(firstManifest.launchUrl);
    assert.equal(firstUrl.origin, firstManifest.hostUrl);
    assert.equal(firstUrl.pathname, "/");
    assert.equal(firstUrl.searchParams.get("abe-case"), cliCaseId);
    assert.equal(firstUrl.searchParams.get("abe-run"), first.runId.slice(-8));
    assert.match(firstUrl.searchParams.get("abe-run"), /^[0-9a-f]{8}$/);
    assert.equal(firstManifest.runtime.launchCwd, path.resolve(worktree));
    const firstLog = await readFile(firstManifest.runtimeLogFilePath);
    const firstMetadata = await readFile(path.join(firstManifest.logging.runtimeLogDirectory, "log-session.json"));
    assert.equal(JSON.parse(firstMetadata).runtimeCwd, path.resolve(worktree));
    // Repeating the same CASE must still be visibly distinguishable without comparing ports.
    const second = await smokeRun({ workspaceRoot, worktree, caseId: cliCaseId, allowDirty: true });
    assert.notEqual(first.runId, second.runId);
    const secondManifest = JSON.parse(await readFile(second.manifestPath, "utf8"));
    const secondUrl = new URL(secondManifest.launchUrl);
    assert.equal(secondUrl.searchParams.get("abe-case"), cliCaseId);
    assert.equal(secondUrl.searchParams.get("abe-run"), second.runId.slice(-8));
    assert.notEqual(firstUrl.search, secondUrl.search);
    assert.equal(secondManifest.runtime.requestedPort, 0);
    assert.equal(secondManifest.runtime.boundPort, Number(secondUrl.port));
    assert.notEqual(firstManifest.runtimeLogFilePath, secondManifest.runtimeLogFilePath);
    assert.deepEqual(await readFile(firstManifest.runtimeLogFilePath), firstLog, "second run must not change first run's events");
    assert.deepEqual(await readFile(path.join(firstManifest.logging.runtimeLogDirectory, "log-session.json")), firstMetadata);
    assert.equal(firstManifest.sourceIdentityHash, secondManifest.sourceIdentityHash);
    await assert.rejects(startRun(first.manifestPath), /unexecuted/);

    // Even if the next host reuses a port, an old tab cannot append, read, clear, or prune its session.
    const reused = await prepareRun({ workspaceRoot, worktree, caseId: "infra-port-reuse", allowDirty: true });
    const running = await startRun(reused.manifestPath, { port: Number(new URL(firstManifest.hostUrl).port) });
    try {
      assert.equal(running.launchUrl, running.manifest.launchUrl);
      assert.equal(new URL(running.launchUrl).origin, running.baseUrl);
      for (const route of ["/api/log", "/api/log/session", "/api/log/read", "/api/log/clear", "/api/log/prune"]) {
        // A correct visible label cannot rescue a stale authoritative header on a reused port.
        const response = await fetch(new URL(`${route}${new URL(running.launchUrl).search}`, running.baseUrl), { method: "POST", headers: { "Content-Type": "application/json", "X-ABE-Regression-Run": first.runId }, body: "{}", signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 409, route);
      }
      assert.equal((await running.request("/api/log/read")).text, "");
      const forgedUrl = new URL(running.launchUrl);
      forgedUrl.searchParams.set("abe-case", "fabricated-case");
      forgedUrl.searchParams.set("abe-run", first.runId);
      // Labels may be correct, deleted or fabricated: only injected metadata supplies browser identity.
      for (const href of [running.launchUrl, running.baseUrl, forgedUrl.href]) {
        const page = await fetch(href, { signal: AbortSignal.timeout(5000) });
        assert.equal(page.status, 200);
        assert.equal(page.url, new URL(href).href, "host must not redirect away from the labelled URL");
        const html = await page.text();
        const injected = html.match(/<script type="application\/json" id="abe-regression-log-session">([^<]+)<\/script>/)?.[1];
        assert.ok(injected);
        const session = readRegressionLogSession({ location: new URL(href), getElementById: () => ({ textContent: injected }) });
        assert.equal(session.caseId, running.manifest.caseId);
        assert.equal(session.runId, running.manifest.runId);
        const response = await fetch(new URL(`/api/log${new URL(href).search}`, running.baseUrl), {
          method: "POST", headers: { "Content-Type": "application/json", ...regressionLogHeaders(session) },
          body: JSON.stringify({ message: "URL presentation authority check" }), signal: AbortSignal.timeout(5000),
        });
        assert.equal(response.status, 204);
      }
      // Even the correct full RUN in query text grants no authority without the existing header.
      const claimedUrl = new URL("/api/log", running.baseUrl);
      claimedUrl.searchParams.set("abe-run", running.manifest.runId);
      for (const headers of [{}, { "X-ABE-Regression-Run": running.manifest.runId.slice(-8) }]) {
        assert.equal((await fetch(claimedUrl, { method: "POST", headers, body: "{}", signal: AbortSignal.timeout(5000) })).status, 409);
      }
      const sessionState = await running.request("/api/log/session");
      assert.equal(sessionState.regressionRun.runId, running.manifest.runId);
      assert.equal(sessionState.filePath, running.manifest.runtimeLogFilePath);
      assert.equal((await running.request("/api/log/read")).text.trim().split(/\r?\n/).length, 3);
      const metadata = JSON.parse(await readFile(path.join(running.manifest.logging.runtimeLogDirectory, "log-session.json"), "utf8"));
      assert.equal(metadata.runId, running.manifest.runId);
      assert.equal(metadata.sourceIdentityHash, running.manifest.sourceIdentityHash);
      assert.deepEqual(await readFile(firstManifest.runtimeLogFilePath), firstLog, "URL edits must not redirect events to an earlier RUN");
      // This read-only production capability resolves .tools/whisper from process.cwd().
      // A sandbox cwd would silently report a different runtime root even though HTML/log smoke passed.
      const capability = await (await fetch(new URL("/api/whisper-cpp/capability", running.baseUrl), { signal: AbortSignal.timeout(5000) })).json();
      assert.equal(capability.root, path.join(path.resolve(worktree), ".tools", "whisper"));
      await assert.rejects(running.request("/api/log/session", { runId: first.runId }), /another regression run/);
      await assert.rejects(running.request("/api/log/session", { browserSettings: { globalEnabled: "yes", enabledSources: [] } }), /Invalid/);
    } finally { await running.stop(); }
    // Exercise actual CLI output and its existing graceful-stop handler portably on Windows too.
    // Emit SIGINT inside the child only after it reports readiness; no browser is opened.
    const cliRun = await prepareRun({ workspaceRoot, worktree, caseId: "url-cli-smoke", allowDirty: true });
    const cliResult = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import { pathToFileURL } from "node:url";
      const [controllerPath, manifestPath] = process.argv.slice(1);
      process.argv = [process.execPath, controllerPath, "start", "--manifest", manifestPath];
      const write = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, ...args) => {
        const result = write(chunk, ...args);
        if (String(chunk).includes('"url":')) setImmediate(() => process.emit("SIGINT"));
        return result;
      };
      await import(pathToFileURL(controllerPath).href);
    `, cliPath, cliRun.manifestPath], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30000 });
    assert.equal(cliResult.status, 0, cliResult.stderr);
    const reported = JSON.parse(cliResult.stdout);
    const cliManifest = JSON.parse(await readFile(cliRun.manifestPath, "utf8"));
    assert.equal(reported.url, cliManifest.launchUrl);
    assert.equal(new URL(reported.url).searchParams.get("abe-case"), "url-cli-smoke");
    assert.equal(new URL(reported.url).searchParams.get("abe-run"), reported.runId.slice(-8));
    assert.equal(cliManifest.runtime.requestedPort, 0);
    assert.equal(cliManifest.runtime.boundPort, Number(new URL(reported.url).port));
    assert.equal(cliManifest.runStatus, "completed");
    await verifyOrdinaryLaunch(root, worktree);
  } finally {
    // Cleanup is confined to the unique test-owned temp tree; never use a source/workspace root supplied by a caller.
    assert.equal(await realpath(root), path.resolve(root));
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
}

// Launch the unchanged host directly, with test-owned log destinations and no controller manifest.
// Arbitrary URL labels must neither enable regression mode nor change ordinary logging authorization.
async function verifyOrdinaryLaunch(root, worktree) {
  const env = { ...process.env, PORT: "0", ABE_LOG_PATH: path.join(root, "ordinary.log"), ABE_DEVELOPER_RUNTIME_LOG_DIR: path.join(root, "ordinary-runtime") };
  delete env.ABE_REGRESSION_RUN_MANIFEST;
  const child = fork(path.join(worktree, "apps/desktop/server.mjs"), [], { cwd: worktree, execArgv: ["--experimental-strip-types"], env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.resume();
  const closed = new Promise((resolve) => child.once("close", resolve));
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Ordinary host readiness timed out.")), 15000);
      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
      child.once("exit", () => { clearTimeout(timeout); reject(new Error("Ordinary host exited before readiness.")); });
      child.on("message", (message) => { if (message?.type === "abe-host-ready") { clearTimeout(timeout); resolve(message.port); } });
    });
    assert.ok(port > 0);
    const baseUrl = `http://127.0.0.1:${port}`;
    for (const suffix of ["/", "/?abe-case=fabricated&abe-run=fabricated"]) {
      const response = await fetch(`${baseUrl}${suffix}`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.url, `${baseUrl}${suffix}`);
      assert.equal(response.status, 200);
      assert.equal((await response.text()).includes('id="abe-regression-log-session"'), false);
    }
    assert.match(output, new RegExp(`Desktop host running at http://127\\.0\\.0\\.1:${port}(?:\\r?\\n|$)`));
    const session = await fetch(`${baseUrl}/api/log/session?abe-run=fabricated`, { method: "POST", body: "{}", signal: AbortSignal.timeout(5000) });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).regressionRun, null);
  } finally {
    if (child.connected) child.send({ type: "abe-regression-stop" });
    const timeout = setTimeout(() => child.kill(), 5000);
    try { await closed; } finally { clearTimeout(timeout); }
  }
}
