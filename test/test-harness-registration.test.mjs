// Intent: ensure every focused test file is registered in the custom Node harness.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));

export function runTestHarnessRegistrationTest() {
  const runTestsSource = readFileSync(path.join(testRoot, "run-tests.mjs"), "utf8");
  const discoveredTestFiles = readdirSync(testRoot)
    .filter((fileName) => fileName.endsWith(".test.mjs"))
    .sort();
  const registeredTests = Array.from(
    runTestsSource.matchAll(/import \{ (run[A-Za-z0-9]+Test) \} from "\.\/([^"]+\.test\.mjs)";/g),
  ).map((match) => ({
    runnerName: match[1],
    fileName: match[2],
  }));
  const registeredTestFiles = registeredTests
    .map((testRecord) => testRecord.fileName)
    .sort();

  // Intent: new tests should be imported by npm test instead of becoming orphan files.
  assert.deepEqual(
    registeredTestFiles,
    discoveredTestFiles,
    "test/run-tests.mjs must import every test/*.test.mjs file.",
  );

  // Intent: imported test functions must also be listed in the executed test-case array.
  const missingTestCaseRunners = registeredTests
    .map((testRecord) => testRecord.runnerName)
    .filter((runnerName) => !new RegExp(`run:\\s*${runnerName}\\b`).test(runTestsSource));
  assert.deepEqual(
    missingTestCaseRunners,
    [],
    "test/run-tests.mjs must execute every imported test runner.",
  );
}
