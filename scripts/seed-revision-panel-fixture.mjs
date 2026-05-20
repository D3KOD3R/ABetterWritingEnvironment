// Intent: generate an inspectable revision-history package from the source project file.
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRevisionPanelFixture,
  getDefaultRevisionFixtureSourcePath,
  seedRevisionFixtureSourceFile,
} from "../test/revision-panel-fixture.mjs";

function parseArgs(argv) {
  const args = {
    source: getDefaultRevisionFixtureSourcePath(),
    outputRoot: path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "SaveTestFile",
      "RevisionsTest",
      "generated",
    ),
    inPlace: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--source") {
      args.source = path.resolve(argv[++index] ?? args.source);
      continue;
    }
    if (value === "--output-root") {
      args.outputRoot = path.resolve(argv[++index] ?? args.outputRoot);
      continue;
    }
    if (value === "--in-place") {
      args.inPlace = true;
    }
  }

  return args;
}

function main() {
  const { source, outputRoot, inPlace } = parseArgs(process.argv.slice(2));
  const sourceSummary = inPlace
    ? seedRevisionFixtureSourceFile({ sourcePath: source })
    : null;
  const fixture = createRevisionPanelFixture({
    sourcePath: source,
    outputRoot,
    revisionFixtureMode: "reuse-existing",
  });

  process.stdout.write(`${JSON.stringify({
    sourcePath: fixture.sourcePath,
    projectId: sourceSummary?.projectId ?? fixture.projectRecord.id,
    sessionCount: sourceSummary?.sessionCount ?? fixture.revisionState.sessions.length,
    revisionsIndexPath: fixture.packagePaths?.revisionsIndexPath ?? "",
    projectOutputPath: fixture.packagePaths?.projectOutputPath ?? "",
    inPlace,
  }, null, 2)}\n`);
}

main();
