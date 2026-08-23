// Intent: provide a bounded Codex handoff that points to authoritative local evidence.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateReport } from "./report-writer.mjs";

export async function createHandoff({ repoRoot, gitState }) {
  const latestPath = path.join(repoRoot, ".tools", "reports", "latest.json");
  let report;
  try { report = validateReport(JSON.parse(await readFile(latestPath, "utf8"))); }
  catch (error) { return { schemaVersion: 1, taskStatus: "blocked", summary: "No valid supervisor report is available.", requestedAction: "Run npm run repo -- test --changed.", message: error.message }; }
  if (report.headSha !== gitState.headSha || report.changedFilesFingerprint !== gitState.changedFilesFingerprint) return { schemaVersion: 1, taskStatus: "blocked", summary: "The latest supervisor report is stale for the current Git state.", requestedAction: "Run npm run repo -- test --changed before relying on a handoff.", authoritativeReport: report.artifacts.report };
  return { schemaVersion: 1, runId: report.runId, taskStatus: report.status === "passed" ? "ready" : "blocked", verificationLevel: report.verificationLevel, summary: report.status === "passed" ? "Deterministic verification passed." : `${report.failures.length} deterministic verification failure(s).`, failedTests: report.failures.map((failure) => failure.testId), requestedAction: report.status === "passed" ? "Continue with the recorded verification evidence." : "Investigate only the failed tests and their concise failure records.", authoritativeReport: report.artifacts.report, fullLog: report.artifacts.fullLog };
}
