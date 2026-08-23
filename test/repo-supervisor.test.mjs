// Intent: cover deterministic supervisor routing and report contracts without touching the user's worktree.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { combineChangedFiles, normalizeRepoPath, summarizeChangedFiles } from "../tools/repo-supervisor/git-state.mjs";
import { createRunId, validateReport, writeReportArtifacts } from "../tools/repo-supervisor/report-writer.mjs";
import { buildSelection } from "../tools/repo-supervisor/test-selection.mjs";

const testIds = ["application-syntax-smoke", "desktop-application", "dictionary-word-service", "local-ai-service", "manuscript-projection-selector", "narration-media-service", "project-persistence-service", "voice-service", "world-schema", "test-harness-registration", "repo-supervisor"];

export async function runRepoSupervisorTest() {
  assert.equal(normalizeRepoPath("apps\\editor\\public\\feature.js"), "apps/editor/public/feature.js");
  assert.deepEqual(combineChangedFiles([{ path: "test/a.mjs", changeType: "modified" }], [{ path: "test\\a.mjs", changeType: "untracked" }]), [{ path: "test/a.mjs", changeType: "untracked" }]);
  assert.deepEqual(summarizeChangedFiles({ committed: [{}], staged: [{}], unstaged: [{}, {}], untracked: [{}, {}, {}], changedFiles: [{}, {}, {}, {}] }), { committedRelativeToBase: 1, staged: 1, unstaged: 2, untracked: 3, uniqueChangedFiles: 4 });
  const fast = buildSelection({ changedFiles: [{ path: "apps/editor/public/features/manuscript-editor/example.js", changeType: "modified" }], testIds, level: "fast" });
  assert.equal(fast.verificationLevel, "fast");
  assert.ok(fast.selectedTestIds.includes("manuscript-projection-selector"));
  assert.deepEqual(fast.syntaxFiles, ["apps/editor/public/features/manuscript-editor/example.js"]);
  const windowsPath = buildSelection({ changedFiles: [{ path: "services\\voice\\src\\voice-storage.ts", changeType: "modified" }], testIds, level: "fast" });
  assert.deepEqual(windowsPath.directGroups, ["voice"]);
  const affected = buildSelection({ changedFiles: [{ path: "apps/editor/public/features/manuscript-editor/example.js", changeType: "modified" }], testIds, level: "affected" });
  assert.deepEqual(affected.affectedGroups, ["editor"]);
  const projectSource = buildSelection({ changedFiles: [{ path: "apps/editor/public/state/project-library-state.js", changeType: "modified" }], testIds, level: "fast" });
  assert.deepEqual(projectSource.directGroups, ["editor", "project"]);
  const deleted = buildSelection({ changedFiles: [{ path: "services/audio/example.js", changeType: "deleted" }], testIds, level: "fast" });
  assert.deepEqual(deleted.syntaxFiles, []);
  const unknown = buildSelection({ changedFiles: [{ path: "unexpected/input.bin", changeType: "modified" }], testIds, level: "fast" });
  assert.equal(unknown.fullSuiteRequired, true);
  const docs = buildSelection({ changedFiles: [{ path: "docs/architecture/example.md", changeType: "modified" }], testIds, level: "fast" });
  assert.equal(docs.selectedTestIds.length, 0);
  assert.match(docs.noTestsReason, /documentation-only/);
  const projectData = buildSelection({ changedFiles: [{ path: "Novel.scriv/Files/Data/example.content", changeType: "untracked" }], testIds, level: "fast" });
  assert.equal(projectData.selectedTestIds.length, 0);
  assert.match(projectData.noTestsReason, /static-data/);
  const projectJsonDirectory = buildSelection({ changedFiles: [{ path: "test-story.abe-project.json/project.json", changeType: "untracked" }], testIds, level: "fast" });
  assert.match(projectJsonDirectory.noTestsReason, /static-data/);
  assert.throws(() => buildSelection({ changedFiles: [], testIds, explicitGroup: "missing" }), /Unknown test group/);
  assert.throws(() => validateReport({ schemaVersion: 1, status: "unknown" }), /Invalid report status/);

  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "abe-supervisor-"));
  try {
    const report = { schemaVersion: 1, runId: createRunId(new Date("2026-08-23T20:13:00Z")), status: "passed", verificationLevel: "fast", worktreeRoot: fixtureRoot, headSha: "abc", startedAt: "2026-08-23T20:13:00Z", completedAt: "2026-08-23T20:13:01Z", tests: { selected: 1, passed: 1, failed: 0 }, syntax: { checked: 1, passed: 1, failed: 0 }, failures: [], artifacts: {} };
    await writeReportArtifacts({ repoRoot: fixtureRoot, report, selection: { schemaVersion: 1 }, fullLog: "test passed\n" });
    assert.equal(JSON.parse(await readFile(path.join(fixtureRoot, ".tools", "reports", "latest.json"), "utf8")).runId, report.runId);
    assert.match(await readFile(path.join(fixtureRoot, report.artifacts.fullLog), "utf8"), /test passed/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
