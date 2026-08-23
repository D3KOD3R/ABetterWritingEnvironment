// Intent: cover deterministic supervisor routing and report contracts without touching the user's worktree.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collectGitState, combineChangedFiles, normalizeRepoPath, runGit, summarizeChangedFiles } from "../tools/repo-supervisor/git-state.mjs";
import { createHandoff } from "../tools/repo-supervisor/handoff.mjs";
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
  const editorNarration = buildSelection({ changedFiles: [{ path: "apps/editor/public/features/narration/narration-media-service.js", changeType: "modified" }], testIds, level: "fast" });
  assert.deepEqual(editorNarration.directGroups, ["narration"]);
  assert.ok(editorNarration.selectedTestIds.includes("narration-media-service"));
  const editorVoice = buildSelection({ changedFiles: [{ path: "apps/editor/public/features/voice/voice-recording-service.js", changeType: "modified" }], testIds, level: "fast" });
  assert.deepEqual(editorVoice.directGroups, ["voice"]);
  assert.ok(editorVoice.selectedTestIds.includes("voice-service"));
  assert.deepEqual(buildSelection({ changedFiles: [{ path: "apps/editor/public/features/world-spine/world-spine-panel.js", changeType: "modified" }], testIds, level: "fast" }).directGroups, ["world"]);
  assert.deepEqual(buildSelection({ changedFiles: [{ path: "apps/editor/public/features/local-ai/local-ai-panel.js", changeType: "modified" }], testIds, level: "fast" }).directGroups, ["localAi"]);
  assert.deepEqual(buildSelection({ changedFiles: [{ path: "apps/editor/public/features/spellcheck/grammar-check-panel.js", changeType: "modified" }], testIds, level: "fast" }).directGroups, ["language"]);
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
  const agentDocumentation = buildSelection({ changedFiles: [{ path: "agents/example.md", changeType: "modified" }], testIds, level: "fast" });
  assert.equal(agentDocumentation.fullSuiteRequired, false);
  assert.equal(agentDocumentation.selectedTestIds.length, 0);
  assert.equal(buildSelection({ changedFiles: [{ path: "finalisework/example.mjs", changeType: "modified" }], testIds, level: "fast" }).fullSuiteRequired, true);
  const projectData = buildSelection({ changedFiles: [{ path: "Novel.scriv/Files/Data/example.content", changeType: "untracked" }], testIds, level: "fast" });
  assert.equal(projectData.selectedTestIds.length, 0);
  assert.match(projectData.noTestsReason, /static-data/);
  const projectJsonDirectory = buildSelection({ changedFiles: [{ path: "test-story.abe-project.json/project.json", changeType: "untracked" }], testIds, level: "fast" });
  assert.match(projectJsonDirectory.noTestsReason, /static-data/);
  assert.throws(() => buildSelection({ changedFiles: [], testIds, explicitGroup: "missing" }), /Unknown test group/);
  assert.throws(() => validateReport({ schemaVersion: 1, status: "unknown" }), /Invalid report status/);

  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "abe-supervisor-"));
  try {
    // Intent: exercise real Git state boundaries while keeping the user's repository untouched.
    runGit(["init"], { cwd: fixtureRoot });
    runGit(["config", "user.email", "supervisor-fixture@example.test"], { cwd: fixtureRoot });
    runGit(["config", "user.name", "Supervisor Fixture"], { cwd: fixtureRoot });
    await writeFile(path.join(fixtureRoot, ".gitignore"), ".tools/\n", "utf8");
    await writeFile(path.join(fixtureRoot, "staged.js"), "export const staged = 1;\n", "utf8");
    await writeFile(path.join(fixtureRoot, "unstaged.js"), "export const unstaged = 1;\n", "utf8");
    await writeFile(path.join(fixtureRoot, "deleted.js"), "export const deleted = 1;\n", "utf8");
    runGit(["add", "."], { cwd: fixtureRoot });
    runGit(["commit", "-m", "fixture baseline"], { cwd: fixtureRoot });
    await writeFile(path.join(fixtureRoot, "staged.js"), "export const staged = 2;\n", "utf8");
    runGit(["add", "staged.js"], { cwd: fixtureRoot });
    await writeFile(path.join(fixtureRoot, "unstaged.js"), "export const unstaged = 2;\n", "utf8");
    await writeFile(path.join(fixtureRoot, "untracked.js"), "export const untracked = 1;\n", "utf8");
    await unlink(path.join(fixtureRoot, "deleted.js"));
    const mixedState = collectGitState({ cwd: fixtureRoot, baseRef: "main" });
    assert.ok(mixedState.staged.some((file) => file.path === "staged.js"));
    assert.ok(mixedState.unstaged.some((file) => file.path === "unstaged.js"));
    assert.ok(mixedState.unstaged.some((file) => file.path === "deleted.js" && file.changeType === "deleted"));
    assert.ok(mixedState.untracked.some((file) => file.path === "untracked.js"));

    // Intent: content edits to an already-changed path must invalidate an otherwise-valid handoff.
    await writeFile(path.join(fixtureRoot, "same-path.js"), "export const value = 'first';\n", "utf8");
    const verifiedState = collectGitState({ cwd: fixtureRoot, baseRef: "main" });
    const report = { schemaVersion: 1, runId: createRunId(new Date("2026-08-23T20:13:00Z")), status: "passed", verificationLevel: "fast", worktreeRoot: fixtureRoot, headSha: "abc", startedAt: "2026-08-23T20:13:00Z", completedAt: "2026-08-23T20:13:01Z", tests: { selected: 1, passed: 1, failed: 0 }, syntax: { checked: 1, passed: 1, failed: 0 }, failures: [], artifacts: {} };
    report.headSha = verifiedState.headSha;
    report.changedFilesFingerprint = verifiedState.changedFilesFingerprint;
    await writeReportArtifacts({ repoRoot: fixtureRoot, report, selection: { schemaVersion: 1 }, fullLog: "test passed\n" });
    assert.equal(JSON.parse(await readFile(path.join(fixtureRoot, ".tools", "reports", "latest.json"), "utf8")).runId, report.runId);
    assert.match(await readFile(path.join(fixtureRoot, report.artifacts.fullLog), "utf8"), /test passed/);
    assert.equal((await createHandoff({ repoRoot: fixtureRoot, gitState: collectGitState({ cwd: fixtureRoot, baseRef: "main" }) })).taskStatus, "ready");
    await writeFile(path.join(fixtureRoot, "same-path.js"), "export const value = 'second';\n", "utf8");
    const changedAgainState = collectGitState({ cwd: fixtureRoot, baseRef: "main" });
    assert.equal(changedAgainState.headSha, verifiedState.headSha);
    assert.notEqual(changedAgainState.changedFilesFingerprint, verifiedState.changedFilesFingerprint);
    assert.equal((await createHandoff({ repoRoot: fixtureRoot, gitState: changedAgainState })).taskStatus, "blocked");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
