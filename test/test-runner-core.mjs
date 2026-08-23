// Intent: preserve sequential focused-test execution while supporting compact programmatic results.
import { loadTestRunner } from "./test-registry.mjs";

export async function runTestDefinitions(definitions, { onResult } = {}) {
  const results = [];
  const startedAt = Date.now();
  for (const definition of definitions) {
    const testStartedAt = Date.now();
    try {
      const run = await loadTestRunner(definition);
      await run();
      const result = { id: definition.id, status: "passed", durationMs: Date.now() - testStartedAt };
      results.push(result);
      onResult?.(result);
    } catch (error) {
      const result = { id: definition.id, status: "failed", durationMs: Date.now() - testStartedAt, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined };
      results.push(result);
      onResult?.(result);
    }
  }
  return { results, durationMs: Date.now() - startedAt, passed: results.filter((result) => result.status === "passed").length, failed: results.filter((result) => result.status === "failed").length };
}
