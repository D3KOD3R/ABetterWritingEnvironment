// Intent: catch source parse failures before feature-specific regression tests run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["apps", "services", "packages"];

export function runApplicationSyntaxSmokeTest() {
  const sourceFiles = sourceRoots.flatMap((rootName) =>
    collectSourceFiles(path.join(repoRoot, rootName)),
  );
  const failures = [];

  // Intent: use Node's parser as a broad guard for browser modules, desktop host code, and service packages.
  for (const filePath of sourceFiles) {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--check", filePath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    if (result.status !== 0) {
      failures.push(formatSyntaxFailure(filePath, result));
    }
  }

  assert.equal(
    failures.length,
    0,
    `Application source syntax check failed:\n${failures.join("\n\n")}`,
  );
}

function collectSourceFiles(rootPath, output = []) {
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath, output);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(js|mjs|ts)$/.test(entry.name)) {
      continue;
    }
    output.push(entryPath);
  }

  return output.sort((left, right) => left.localeCompare(right));
}

function formatSyntaxFailure(filePath, result) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  const details = [result.stderr, result.stdout]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n")
    .trim();

  return `${relativePath}\n${details}`;
}
