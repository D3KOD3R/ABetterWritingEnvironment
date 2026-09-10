// Intent: prove source guards and exercise two real host sessions without invoking project persistence.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { prepareRun, startRun, smokeRun } from "../tools/regression-workspace/regression-run-controller.mjs";

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
    assert.equal(firstManifest.runtime.launchCwd, path.resolve(worktree));
    const firstLog = await readFile(firstManifest.runtimeLogFilePath);
    const firstMetadata = await readFile(path.join(firstManifest.logging.runtimeLogDirectory, "log-session.json"));
    assert.equal(JSON.parse(firstMetadata).runtimeCwd, path.resolve(worktree));
    const second = await smokeRun({ workspaceRoot, worktree, caseId: "infra-logging-smoke", allowDirty: true });
    assert.notEqual(first.runId, second.runId);
    const secondManifest = JSON.parse(await readFile(second.manifestPath, "utf8"));
    assert.notEqual(firstManifest.runtimeLogFilePath, secondManifest.runtimeLogFilePath);
    assert.deepEqual(await readFile(firstManifest.runtimeLogFilePath), firstLog, "second run must not change first run's events");
    assert.deepEqual(await readFile(path.join(firstManifest.logging.runtimeLogDirectory, "log-session.json")), firstMetadata);
    assert.equal(firstManifest.sourceIdentityHash, secondManifest.sourceIdentityHash);
    await assert.rejects(startRun(first.manifestPath), /unexecuted/);

    // Even if the next host reuses a port, an old tab cannot append, read, clear, or prune its session.
    const reused = await prepareRun({ workspaceRoot, worktree, caseId: "infra-port-reuse", allowDirty: true });
    const running = await startRun(reused.manifestPath, { port: Number(new URL(firstManifest.hostUrl).port) });
    try {
      for (const route of ["/api/log", "/api/log/session", "/api/log/read", "/api/log/clear", "/api/log/prune"]) {
        const response = await fetch(new URL(route, running.baseUrl), { method: "POST", headers: { "Content-Type": "application/json", "X-ABE-Regression-Run": first.runId }, body: "{}", signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 409, route);
      }
      assert.equal((await running.request("/api/log/read")).text, "");
      // This read-only production capability resolves .tools/whisper from process.cwd().
      // A sandbox cwd would silently report a different runtime root even though HTML/log smoke passed.
      const capability = await (await fetch(new URL("/api/whisper-cpp/capability", running.baseUrl), { signal: AbortSignal.timeout(5000) })).json();
      assert.equal(capability.root, path.join(path.resolve(worktree), ".tools", "whisper"));
      await assert.rejects(running.request("/api/log/session", { runId: first.runId }), /another regression run/);
      await assert.rejects(running.request("/api/log/session", { browserSettings: { globalEnabled: "yes", enabledSources: [] } }), /Invalid/);
    } finally { await running.stop(); }
  } finally {
    // Cleanup is confined to the unique test-owned temp tree; never use a source/workspace root supplied by a caller.
    assert.equal(await realpath(root), path.resolve(root));
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
}
