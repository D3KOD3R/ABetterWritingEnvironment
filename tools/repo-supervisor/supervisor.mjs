#!/usr/bin/env node
// Intent: coordinate deterministic Git-aware verification, local artifacts, and compact machine output.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { discoverTestDefinitions } from "../../test/test-registry.mjs";
import { collectGitState } from "./git-state.mjs";
import { createHandoff } from "./handoff.mjs";
import { createRunId, writeReportArtifacts } from "./report-writer.mjs";
import { checkSyntaxFiles } from "./syntax-check.mjs";
import { buildSelection } from "./test-selection.mjs";
import { executeSelectedTests } from "./test-execution.mjs";
import { classifyChangedPath } from "./routing-config.mjs";

const EXIT = { passed: 0, failed: 1, blocked: 2, usage: 3 };
const HELP = `Usage: npm run repo -- <status|plan|test|handoff> [options]

Use \`npm --silent run repo -- ... --json\` when a caller needs stdout to contain JSON only.

Commands:
  status [--base <ref>] [--json]
  plan [--base <ref>] [--level <fast|affected|full>] [--json]
  test [--changed] [--name <test-id> | --group <group>] [--level <fast|affected|full>] [--base <ref>] [--json] [--quiet]
  handoff [--base <ref>] [--json]
`;

function parseArgs(args) {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return { help: true };
  if (!["status", "plan", "test", "handoff"].includes(command)) throw new UsageError(`Unknown command: ${command}`);
  const options = { command, baseRef: "main", level: "fast", json: false, quiet: false, changed: false };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--json") options.json = true;
    else if (token === "--quiet") options.quiet = true;
    else if (token === "--changed") options.changed = true;
    else if (["--base", "--level", "--name", "--group"].includes(token)) {
      const value = rest[++index]; if (!value || value.startsWith("--")) throw new UsageError(`${token} requires a value.`);
      options[{ "--base": "baseRef", "--level": "level", "--name": "name", "--group": "group" }[token]] = value;
    } else throw new UsageError(`Unknown option: ${token}`);
  }
  if (!["fast", "affected", "full"].includes(options.level)) throw new UsageError(`Invalid verification level: ${options.level}`);
  if (options.name && options.group) throw new UsageError("--name and --group cannot be combined.");
  if (options.command !== "test" && (options.name || options.group || options.changed || options.quiet)) throw new UsageError("Selection flags are valid only for test.");
  return options;
}
class UsageError extends Error {}
function emit(value, options, human) { process.stdout.write(options.json ? `${JSON.stringify(value)}\n` : `${human ?? JSON.stringify(value, null, 2)}\n`); }
function logLine(lines, text) { lines.push(text); }

function compactReasons(reasons) {
  return [...new Set(reasons.map((reason) => reason.reason).filter(Boolean))];
}

function compactGitState(gitState) {
  return {
    schemaVersion: 1,
    status: gitState.conflicts ? "blocked" : "ready",
    branch: gitState.branch,
    headSha: gitState.headSha,
    baseRef: gitState.baseRef,
    mergeBaseSha: gitState.mergeBaseSha,
    baseAvailable: gitState.baseAvailable,
    ahead: gitState.ahead,
    behind: gitState.behind,
    conflicts: gitState.conflicts,
    clean: gitState.clean,
    changeSummary: gitState.changeSummary,
  };
}

function compactSelection(selection) {
  return {
    verificationLevel: selection.verificationLevel,
    directGroups: selection.directGroups,
    dependentGroups: selection.dependentGroups,
    affectedGroups: selection.affectedGroups,
    tests: { selected: selection.selectedTestIds.length },
    syntax: { planned: selection.syntaxFiles.length },
    fullSuiteRequired: selection.fullSuiteRequired,
    escalationReasons: compactReasons(selection.reasons),
    noTestsReason: selection.noTestsReason,
  };
}

function compactReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    status: report.status,
    runId: report.runId,
    verificationLevel: report.verificationLevel,
    branch: report.branch,
    headSha: report.headSha,
    baseRef: report.baseRef,
    changeSummary: report.changeSummary,
    affectedGroups: report.affectedGroups,
    tests: report.tests,
    syntax: report.syntax,
    fullSuiteRequired: report.fullSuiteRequired,
    escalationReasons: compactReasons(report.escalationReasons),
    noTestsReason: report.noTestsReason,
    failedTestIds: report.failures.map((failure) => failure.testId),
    artifacts: report.artifacts,
  };
}

async function runVerification(options, gitState) {
  const startedAt = new Date().toISOString(); const logs = []; const definitions = await discoverTestDefinitions(); const testIds = definitions.map((definition) => definition.id);
  const selection = buildSelection({ changedFiles: gitState.changedFiles, testIds, level: options.level, explicitName: options.name, explicitGroup: options.group });
  const syntax = selection.verificationLevel === "full" ? { checked: 0, passed: 0, failed: 0, results: [] } : checkSyntaxFiles(selection.syntaxFiles, { repoRoot: gitState.worktreeRoot });
  syntax.results.forEach((result) => logLine(logs, `syntax ${result.passed ? "ok" : "failed"} ${result.path}${result.message ? `\n${result.message}` : ""}`));
  let execution = { results: [], passed: 0, failed: 0, durationMs: 0 };
  if (syntax.failed === 0 && selection.selectedTestIds.length > 0) execution = await executeSelectedTests(definitions.filter((definition) => selection.selectedTestIds.includes(definition.id)));
  execution.results.forEach((result) => logLine(logs, `test ${result.status} ${result.id} (${result.durationMs}ms)${result.message ? `\n${result.stack ?? result.message}` : ""}`));
  const failures = [
    ...syntax.results.filter((result) => !result.passed).map((result) => ({ testId: result.path, kind: "syntax", message: result.message || "Syntax check failed." })),
    ...execution.results.filter((result) => result.status === "failed").map((result) => ({ testId: result.id, kind: "test", message: result.message })),
  ];
  // Intent: record the post-run worktree identity so test-generated local artifacts do not falsely stale the handoff.
  const completedGitState = collectGitState({ cwd: gitState.worktreeRoot, baseRef: gitState.baseRef });
  const routedChangedFiles = completedGitState.changedFiles.filter((file) => !["static", "documentation"].includes(classifyChangedPath(file.path).classification));
  const report = { schemaVersion: 1, runId: createRunId(), status: failures.length > 0 ? "failed" : "passed", verificationLevel: selection.verificationLevel, worktreeRoot: completedGitState.worktreeRoot, branch: completedGitState.branch, headSha: completedGitState.headSha, baseRef: completedGitState.baseRef, mergeBaseSha: completedGitState.mergeBaseSha, startedAt, completedAt: new Date().toISOString(), changedFiles: routedChangedFiles, changedFilesFingerprint: completedGitState.changedFilesFingerprint, changeSummary: completedGitState.changeSummary, changedFileSummary: { total: completedGitState.changedFiles.length, routed: routedChangedFiles.length }, affectedGroups: selection.affectedGroups, selectionReasons: selection.reasons, syntax: { checked: syntax.checked, passed: syntax.passed, failed: syntax.failed }, tests: { selected: selection.selectedTestIds.length, passed: execution.passed, failed: execution.failed, durationMs: execution.durationMs }, failures, fullSuiteRequired: selection.fullSuiteRequired, escalationReasons: selection.reasons.filter((reason) => reason.reason), noTestsReason: selection.noTestsReason, metrics: { changedFileCount: gitState.changedFiles.length, directGroupCount: selection.directGroups.length, dependentGroupCount: selection.dependentGroups.length, testsPlanned: selection.selectedTestIds.length, testsExecuted: execution.results.length, syntaxFilesChecked: syntax.checked, verificationEscalated: selection.fullSuiteRequired, initialLevel: options.level, finalLevel: selection.verificationLevel }, artifacts: {} };
  await writeReportArtifacts({ repoRoot: gitState.worktreeRoot, report, selection: { schemaVersion: 1, changedPaths: gitState.changedFiles.filter((file) => !["static", "documentation"].includes(classifyChangedPath(file.path).classification)), changedFileSummary: { total: gitState.changedFiles.length }, ...selection }, fullLog: `${logs.join("\n")}\n` });
  return report;
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); if (options.help) { process.stdout.write(HELP); return; } }
  catch (error) { process.stderr.write(`${error.message}\n${HELP}`); process.exitCode = EXIT.usage; return; }
  let gitState;
  try { gitState = collectGitState({ cwd: process.cwd(), baseRef: options.baseRef }); }
  catch (error) { emit({ schemaVersion: 1, status: "blocked", message: error.message }, options); process.exitCode = EXIT.blocked; return; }
  if (options.command === "status") { const summary = gitState.changeSummary; emit(compactGitState(gitState), options, `Git state: ${gitState.branch}; committed ${summary.committedRelativeToBase}, staged ${summary.staged}, unstaged ${summary.unstaged}, untracked ${summary.untracked}; ${summary.uniqueChangedFiles} unique changed file(s).`); return; }
  if (options.command === "handoff") { const handoff = await createHandoff({ repoRoot: gitState.worktreeRoot, gitState }); emit(handoff, options, handoff.summary); process.exitCode = handoff.taskStatus === "blocked" ? EXIT.blocked : EXIT.passed; return; }
  if (options.command === "plan") {
    try { const definitions = await discoverTestDefinitions(); const selection = buildSelection({ changedFiles: gitState.changedFiles, testIds: definitions.map((definition) => definition.id), level: options.level }); const plan = { schemaVersion: 1, status: "ready", git: compactGitState(gitState), ...compactSelection(selection) }; emit(plan, options, `Plan: ${selection.verificationLevel}; ${selection.selectedTestIds.length} test(s); ${selection.syntaxFiles.length} syntax file(s).`); }
    catch (error) { emit({ schemaVersion: 1, status: "blocked", message: error.message }, options); process.exitCode = EXIT.blocked; }
    return;
  }
  try { const report = await runVerification(options, gitState); emit(compactReport(report), options, `${report.verificationLevel.toUpperCase()} verification: ${report.tests.passed}/${report.tests.selected} tests passed. Report: ${report.artifacts.report}`); process.exitCode = EXIT[report.status]; }
  catch (error) { emit({ schemaVersion: 1, status: "blocked", message: error.message }, options); process.exitCode = EXIT.blocked; }
}
await main();
