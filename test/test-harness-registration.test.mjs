// Intent: prevent orphan focused tests by validating deterministic discovery and runner exports.
import assert from "node:assert/strict";
import { compareTestIds, discoverTestDefinitions, loadTestRunner, toTestId } from "./test-registry.mjs";

export async function runTestHarnessRegistrationTest() {
  const definitions = await discoverTestDefinitions();
  const ids = definitions.map((definition) => definition.id);
  assert.ok(definitions.length > 0, "Test discovery must find focused test modules.");
  assert.deepEqual(ids, [...ids].sort(compareTestIds), "Test discovery order must be deterministic.");
  assert.equal(new Set(ids).size, ids.length, "Focused test IDs must be unique.");
  assert.equal(toTestId("manuscript-projection-selector.test.mjs"), "manuscript-projection-selector");
  assert.equal(toTestId("not-a-test.mjs"), null);
  for (const definition of definitions) {
    const runner = await loadTestRunner(definition);
    assert.equal(typeof runner, "function", `${definition.id} must expose a runnable test function.`);
  }
}
