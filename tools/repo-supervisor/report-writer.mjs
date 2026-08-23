// Intent: persist one versioned authoritative report and detailed local log per supervisor run.
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const REPORT_SCHEMA_VERSION = 1;

export function createRunId(now = new Date()) {
  return `${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "T")}-${randomBytes(2).toString("hex")}`;
}

export function validateReport(report) {
  if (report?.schemaVersion !== REPORT_SCHEMA_VERSION) throw new Error("Unsupported report schema version.");
  if (!["passed", "failed", "blocked"].includes(report.status)) throw new Error("Invalid report status.");
  for (const field of ["runId", "verificationLevel", "worktreeRoot", "headSha", "startedAt", "completedAt", "tests", "syntax", "artifacts"]) if (!(field in report)) throw new Error(`Missing report field: ${field}`);
  for (const failure of report.failures ?? []) if (!failure.testId || !failure.message) throw new Error("Failure records require testId and message.");
  return report;
}

async function writeAtomic(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, "utf8");
  await rename(temporaryPath, filePath);
}

export async function writeReportArtifacts({ repoRoot, report, selection, fullLog }) {
  validateReport(report);
  const reportsRoot = path.join(repoRoot, ".tools", "reports");
  const runDirectory = path.join(reportsRoot, report.runId);
  await mkdir(runDirectory, { recursive: true });
  const relative = (name) => path.relative(repoRoot, path.join(runDirectory, name)).replace(/\\/g, "/");
  report.artifacts = { report: relative("report.json"), fullLog: relative("full.log"), selection: relative("selection.json") };
  await writeAtomic(path.join(runDirectory, "selection.json"), `${JSON.stringify(selection)}\n`);
  await writeAtomic(path.join(runDirectory, "full.log"), fullLog);
  await writeAtomic(path.join(runDirectory, "report.json"), `${JSON.stringify(report)}\n`);
  await writeAtomic(path.join(reportsRoot, "latest.json"), `${JSON.stringify(report)}\n`);
  return report;
}
