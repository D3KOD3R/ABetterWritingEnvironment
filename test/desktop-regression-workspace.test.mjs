// Intent: prove source guards and exercise two real host sessions without invoking project persistence.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
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
    const options = { workspaceRoot, worktree: fixture, caseId: "infra-test" };
    await assert.rejects(prepareRun({ ...options, workspaceRoot: path.join(fixture, "runs") }), /outside/);
    await assert.rejects(prepareRun({ ...options, caseId: "../escape" }), /identifier/);
    const prepared = await prepareRun(options);
    assert.equal(prepared.manifest.gitWorkingTreeClean, true);
    assert.equal(prepared.manifest.runStatus, "prepared");
    const savedManifest = JSON.parse(await readFile(prepared.manifestPath, "utf8"));
    assert.equal(savedManifest.schemaVersion, 2);
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
    const first = await smokeRun({ workspaceRoot, worktree, caseId: "infra-logging-smoke", allowDirty: true });
    const firstManifest = JSON.parse(await readFile(first.manifestPath, "utf8"));
    const firstLog = await readFile(firstManifest.runtimeLogFilePath);
    const firstMetadata = await readFile(path.join(firstManifest.logging.runtimeLogDirectory, "log-session.json"));
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
