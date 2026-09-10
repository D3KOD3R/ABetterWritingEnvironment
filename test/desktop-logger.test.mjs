// Intent: protect synchronous diagnostic visibility and quantify removal of redundant filesystem work.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDesktopLogWriter } from "../apps/desktop/src/logger.ts";

export async function runDesktopLoggerTest() {
  let directoryCalls = 0;
  const lines = [];
  let failure;
  const writer = createDesktopLogWriter("example/desktop.log", {
    mkdirSync() { directoryCalls += 1; },
    appendFileSync(_file, line) { if (failure) { const error = failure; failure = null; throw error; } lines.push(JSON.parse(line)); },
  });
  for (let i = 0; i < 1000; i += 1) writer({ level: "info", scope: "test", message: String(i) });
  // The previous implementation performed 1000 mkdir calls plus these same 1000 appends.
  assert.equal(directoryCalls, 1);
  assert.deepEqual(lines.map((line) => Number(line.message)), Array.from({ length: 1000 }, (_, i) => i));
  failure = Object.assign(new Error("directory removed"), { code: "ENOENT" });
  writer({ level: "warn", scope: "test", message: "recreated", context: { error: new Error("diagnostic") } });
  assert.equal(lines.at(-1).message, "recreated");
  assert.equal(lines.at(-1).context.error.message, "diagnostic");
  assert.equal(directoryCalls, 2);
  failure = Object.assign(new Error("disk unavailable"), { code: "EIO" });
  assert.doesNotThrow(() => writer({ level: "error", scope: "test", message: "unavailable" }));
  writer({ level: "info", scope: "test", message: "recovered" });
  assert.equal(lines.at(-1).message, "recovered");
  assert.equal(directoryCalls, 3);

  const root = await mkdtemp(path.join(tmpdir(), "abe-desktop-log-"));
  try {
    const file = path.join(root, "runtime-logs", "desktop.log");
    const script = `import { createDesktopLogWriter } from ${JSON.stringify(new URL("../apps/desktop/src/logger.ts", import.meta.url).href)};
      createDesktopLogWriter(process.argv[1])({level:'error',scope:'exit-test',message:'last diagnostic'});
      process.exit(17);`;
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script, file], { encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 17, result.stderr);
    assert.equal(JSON.parse(await readFile(file, "utf8")).message, "last diagnostic");
  } finally {
    assert.equal(await realpath(root), path.resolve(root));
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
}
