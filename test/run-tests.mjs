// Intent: retain npm test as the complete sequential test-suite entry point.
import { discoverTestDefinitions } from "./test-registry.mjs";
import { runTestDefinitions } from "./test-runner-core.mjs";

const definitions = await discoverTestDefinitions();
const execution = await runTestDefinitions(definitions, {
  onResult(result) {
    if (result.status === "passed") {
      console.log(`ok - ${result.id}`);
      return;
    }
    console.error(`not ok - ${result.id}`);
    console.error(result.stack ?? result.message);
  },
});

if (execution.failed > 0) {
  console.error(`\n${execution.failed} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${execution.passed} test(s) passed.`);
}
