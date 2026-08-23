// Intent: execute selected tests through the shared sequential core without decorative success output.
import { runTestDefinitions } from "../../test/test-runner-core.mjs";

export async function executeSelectedTests(definitions) {
  return runTestDefinitions(definitions);
}
