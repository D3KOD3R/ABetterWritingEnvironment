// Intent: run only changed-source parser checks for FAST and AFFECTED verification.
import { spawnSync } from "node:child_process";
import path from "node:path";

export function checkSyntaxFiles(files, { repoRoot } = {}) {
  const results = [];
  for (const file of files) {
    const args = file.endsWith(".ts") ? ["--experimental-strip-types", "--check", file] : ["--check", file];
    const result = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8", shell: false });
    results.push({ path: file, passed: result.status === 0, message: [result.stderr, result.stdout, result.error?.message].filter(Boolean).join("\n").trim() });
  }
  return { results, checked: results.length, passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length };
}
