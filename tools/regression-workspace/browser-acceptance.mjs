// Real browser acceptance supplements supervisor tests; RUN completion is not a CASE verdict.
// Keep Playwright, browser profiles, disposable projects and evidence outside source worktrees.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareRun, startRun } from "./regression-run-controller.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (!option("--workspace") || !option("--playwright-root")) {
  throw new Error("Required: --workspace <external-root> --playwright-root <external-npm-prefix> [--allow-dirty] [--history-actions 1000] [--autosave-cycles 50]");
}
const historyActions = Number(option("--history-actions", "100"));
const cycles = Number(option("--autosave-cycles", "3"));
for (const count of [historyActions, cycles]) assert.ok(Number.isInteger(count) && count >= 0 && count <= 1000);
const playwrightRoot = path.resolve(option("--playwright-root"));
const { chromium } = createRequire(path.join(playwrightRoot, "package.json"))("playwright");
const workspaceRoot = path.resolve(option("--workspace"));
const settingsPath = path.join(root, "apps/desktop/.desktop-state.json");
const originalSettings = await readFile(settingsPath).catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});
let run, prepared, browser, context, page, evidence, savedStorage, fixedPort;
const campaign = { status: "running", runs: [], checkpoints: [], history: {}, cycles: [], limits: [
  "Headless installed Chrome; does not accept native Windows folder-picker UI.",
  "Read-only browser probe appended to app.js exposes cloned canonical/autosave state.",
  "Import picker response is substituted; parser, disk reads and package publication are real.",
  "JS heap samples are not renderer memory or a leak verdict.",
  "No anchor-specific cross-feature or full 50/100-cycle stress acceptance unless explicitly executed.",
] };
// Observe the closed-over state without introducing a production debug API or mutating it.
const probe = '\nObject.defineProperty(window,"__ABE_TEST_READ_STATE__",{value:()=>structuredClone({id:state.activeProjectId,path:state.projectFilePath,scenes:state.scenes,busy:state.projectFileBusy,dirty:state.projectFileAutosaveDirty,target:state.projectFileAutosaveTarget})});\n';
const editor = () => page.locator("textarea.editor-document-input");
const observe = () => page.evaluate(() => window.__ABE_TEST_READ_STATE__());
async function record() {
  if (evidence) await writeFile(path.join(evidence, "browser-acceptance.json"), JSON.stringify(campaign, null, 2));
}
async function start(restart = false) {
  prepared = await prepareRun({ workspaceRoot, worktree: root, caseId: "reliability-browser-acceptance", allowDirty: args.includes("--allow-dirty"),
    expectedRegressionInvariant: "Visible/canonical/durable manuscript and project destination converge through native undo/redo, Recent, cold restart and explicit blocked-import discard." });
  evidence = path.join(prepared.manifest.evidenceRoot, "manual-test-results");
  campaign.runs.push({ manifestPath: prepared.manifestPath, restart });
  if (!restart) {
    await writeFile(path.join(evidence, "desktop-state-before.json"), originalSettings ?? "null");
    // The controller does not isolate desktop state. Clear only this worktree's pointer,
    // retain its exact bytes for finally, and never launch a real last-opened project.
    await writeFile(settingsPath, JSON.stringify({ executionMode: "local-only", projectRoot: prepared.manifest.allocatedProjectLocations.locationA, lastProjectFilePath: "", lastProjectFilePathExplicit: false }));
  }
  run = await startRun(prepared.manifestPath, { port: fixedPort ?? 0, mode: "playwright-acceptance" });
  fixedPort = Number(new URL(run.baseUrl).port);
  browser = await chromium.launch({ channel: "chrome", headless: true });
  campaign.browser = browser.version();
  context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, storageState: savedStorage });
  await context.route("**/app.js", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + probe });
  });
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(run.launchUrl);
  await page.waitForFunction(() => typeof window.__ABE_TEST_READ_STATE__ === "function");
  await editor().waitFor();
  await page.waitForTimeout(750); // Let bootstrap hydration settle before menu interaction.
  await record();
}
async function stop() {
  if (context) { savedStorage = await context.storageState(); await context.close(); context = null; }
  if (browser) { await browser.close(); browser = null; }
  if (run) {
    await run.stop();
    const manifest = JSON.parse(await readFile(prepared.manifestPath, "utf8"));
    campaign.runs.at(-1).completed = manifest.runStatus;
    campaign.runs.at(-1).sourceIdentityUnchanged = manifest.sourceIdentityUnchanged;
    run = null;
    assert.equal(manifest.runStatus, "completed", "RUN did not complete normally");
    assert.equal(manifest.sourceIdentityUnchanged, true, "Source changed during RUN");
  }
}
async function menu() {
  if (!await page.getByRole("button", { name: "Open Project...", exact: true }).isVisible()) {
    await page.getByRole("button", { name: "File", exact: true }).click();
  }
}
async function create(name) {
  await menu();
  await page.getByRole("button", { name: "New Project...", exact: true }).click();
  await page.locator('[data-project-package-field="projectName"]').fill(name);
  await page.locator('[data-project-package-field="folderName"]').fill(name);
  await page.getByRole("button", { name: "Create Project", exact: true }).click();
  const discard = page.getByRole("button", { name: "Discard Changes and Create Project", exact: true });
  // Only the disposable bootstrap seed may need this destinationless confirmation.
  await Promise.race([discard.waitFor(), page.waitForFunction(n => window.__ABE_TEST_READ_STATE__().path.endsWith(n), name)]).catch(() => {});
  if (await discard.isVisible()) await discard.click();
  await page.waitForFunction(n => window.__ABE_TEST_READ_STATE__().path.endsWith(n), name);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  return (await observe()).path;
}
async function disk(packageRoot) {
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "project.json"), "utf8"));
  const project = manifest.projects.find(p => p.id === manifest.activeProjectId);
  const sceneId = project.projectStorage.sceneOrder[0];
  const scene = JSON.parse(await readFile(path.join(packageRoot, project.projectStorage.sceneFiles[sceneId]), "utf8"));
  return { id: project.id, text: scene.editorText };
}
async function checkpoint(label) {
  // Recent remains busy through activation. A clean completed save may clear its
  // transient autosave target; only pending mutations require that target to exist.
  await page.waitForFunction(() => window.__ABE_TEST_READ_STATE__().busy !== true);
  const visible = await editor().inputValue();
  const state = await observe();
  assert.equal(state.scenes[0].editorText, visible, `${label}: visible/canonical divergence`);
  if (state.dirty || state.target) {
    assert.equal(state.target?.projectId, state.id);
    assert.equal(state.target?.filePath, state.path);
  }
  await page.waitForFunction(() => {
    const state = window.__ABE_TEST_READ_STATE__();
    return state.dirty === false && state.busy !== true;
  }, undefined, { timeout: 20000 });
  const completed = await observe();
  assert.equal(completed.id, state.id);
  assert.equal(completed.path, state.path);
  const durable = await disk(state.path);
  assert.equal(durable.id, state.id);
  assert.equal(durable.text, visible, `${label}: durable divergence`);
  campaign.checkpoints.push({ label, text: visible, sha256: createHash("sha256").update(visible).digest("hex"), id: state.id, path: state.path });
  await record();
  console.log(`PASS ${label}`);
  return visible;
}
async function recent(name) {
  await menu();
  await page.getByRole("button", { name: "Open Project...", exact: true }).hover();
  await page.locator('[data-action="load-project"]').filter({ hasText: name }).click();
  await page.waitForFunction(n => window.__ABE_TEST_READ_STATE__().path.endsWith(n), name);
}
try {
  await start();
  const a = await create("ACCEPTANCE A");
  await editor().pressSequentially("ALPHA-000");
  await checkpoint("initial-autosave");
  await editor().press("Control+End");
  await page.keyboard.insertText(" EDIT-001");
  const edited = await checkpoint("edit-autosave");
  await editor().press("Control+z");
  const undone = await checkpoint("undo-autosave");
  assert.notEqual(undone, edited);
  // A restart clears native undo history. Prove post-undo persistence, then create a
  // fresh transaction for the redo test rather than assuming history survives restart.
  await stop(); await start(true);
  assert.equal(await checkpoint("cold-restart-after-undo"), undone);
  await editor().press("Control+End"); await page.keyboard.insertText(" REDO-001");
  const redoExpected = await checkpoint("redo-setup");
  await editor().press("Control+z"); await checkpoint("redo-setup-undo");
  await editor().press("Control+y"); assert.equal(await checkpoint("redo-autosave"), redoExpected);
  const b = await create("ACCEPTANCE B");
  await editor().pressSequentially("BRAVO-000"); await checkpoint("B-autosave");
  await recent("ACCEPTANCE A"); assert.equal(await checkpoint("Recent-B-A"), redoExpected);
  await recent("ACCEPTANCE B"); assert.equal(await checkpoint("Recent-A-B"), "BRAVO-000");
  await stop(); await start(true);
  assert.equal(await checkpoint("cold-restart-B"), "BRAVO-000");
  await recent("ACCEPTANCE A"); assert.equal(await checkpoint("cold-Recent-A-redo"), redoExpected);
  const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
  const base = await editor().inputValue();
  const history = campaign.history = { authored: 0, undone: 0, redone: 0, samples: [] };
  await editor().press("Control+End");
  for (let i = 0; i < historyActions; i++) {
    await page.keyboard.insertText(` [${i}]`); history.authored++;
    if ([100,250,500,750,1000].includes(i+1)) history.samples.push({ actions: i+1, metrics: (await cdp.send("Performance.getMetrics")).metrics });
  }
  const final = await checkpoint("history-authored");
  for (const [key, countKey] of [["Control+z", "undone"], ["Control+y", "redone"]]) {
    for (let i = 0; i < historyActions; i++) {
      const before = await editor().inputValue(); await editor().press(key);
      const after = await editor().inputValue();
      if (after === before) break;
      history[countKey]++;
      assert.equal((await observe()).scenes[0].editorText, after);
    }
    await checkpoint(`history-${countKey}`);
    // Depth is an observation, not a product guarantee; only exact traversal claims require equality.
    if (history[countKey] === historyActions) assert.equal(await editor().inputValue(), countKey === "undone" ? base : final);
    await record();
  }
  for (let i = 0; i < cycles; i++) {
    await editor().press("Control+End"); await page.keyboard.insertText(` CYCLE-${i}`);
    const expected = await checkpoint(`cycle-${i}-edit`);
    await editor().press("Control+z"); assert.notEqual(await checkpoint(`cycle-${i}-undo`), expected, "Undo must change text in each cycle");
    await editor().press("Control+y"); assert.equal(await checkpoint(`cycle-${i}-redo`), expected);
    campaign.cycles.push({ cycle: i, status: "passed" }); await record();
  }
  const beforeSwitch = await checkpoint("before-project-lifetime-boundary");
  await recent("ACCEPTANCE B"); await checkpoint("lifetime-B");
  await recent("ACCEPTANCE A"); assert.equal(await checkpoint("lifetime-A"), beforeSwitch);
  assert.equal((await disk(b)).text, "BRAVO-000", "A edits changed B's manuscript");
  await page.reload(); await editor().waitFor(); await page.waitForTimeout(750);
  assert.equal(await checkpoint("browser-refresh"), beforeSwitch);
  const scriv = path.join(prepared.manifest.allocatedProjectLocations.locationC, "Fixture.scriv");
  await mkdir(path.join(scriv, "Files/Data/test-scene"), { recursive: true });
  await writeFile(path.join(scriv, "Fixture.scrivx"), '<ScrivenerProject><Binder><BinderItem UUID="draft"><Title>Draft</Title><Type>DraftFolder</Type><Children><BinderItem UUID="chapter"><Title>Test Chapter</Title><Type>Folder</Type><Children><BinderItem UUID="test-scene"><Title>Imported Scene</Title><Type>Text</Type></BinderItem></Children></BinderItem></Children></BinderItem></Binder></ScrivenerProject>');
  await writeFile(path.join(scriv, "Files/Data/test-scene/content.txt"), "IMPORTED-CONTROLLED-MARKER");
  await page.route("**/api/platform/pick-directory", route => route.fulfill({ status: 200, json: { supported: true, cancelled: false, path: scriv } }));
  await page.route("**/api/project-package/save-stage", route => route.fulfill({ status: 500, json: { error: "Controlled test: outgoing save blocked" } }));
  await editor().press("Control+End"); await page.keyboard.insertText(" UNSAVED-DISCARD");
  const openImport = async () => {
    await menu(); await page.getByRole("button", { name: "Import Scrivener Project...", exact: true }).click();
    await page.getByRole("button", { name: "Import Project", exact: true }).click();
    await page.getByRole("button", { name: "Import Project and Discard Current Project", exact: true }).waitFor();
  };
  await openImport(); await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok((await editor().inputValue()).endsWith("UNSAVED-DISCARD"));
  assert.equal((await observe()).path, a);
  await openImport(); await page.getByRole("button", { name: "Import Project and Discard Current Project", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await checkpoint("imported-package"), "IMPORTED-CONTROLLED-MARKER");
  assert.equal((await disk(a)).text, beforeSwitch);
  campaign.importDiscard = { cancelPreservedUnsaved: true, explicitDiscardPublished: true, originalDurableUnchanged: true };
  await page.screenshot({ path: path.join(evidence, "final-import.png") });
  campaign.status = "passed";
} catch (error) {
  campaign.status = "failed"; campaign.error = error.stack ?? String(error);
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png") }).catch(() => {});
  process.exitCode = 1;
} finally {
  try { await stop(); } catch (error) {
    campaign.status = "failed";
    campaign.error = [campaign.error, error.stack ?? String(error)].filter(Boolean).join("\n");
    process.exitCode = 1;
  } finally {
    // Restore only the exact machine-state file owned by this test; never touch project data.
    if (originalSettings !== null) await writeFile(settingsPath, originalSettings);
    else await unlink(settingsPath).catch(error => { if (error.code !== "ENOENT") throw error; });
    await record();
  }
  console.log(JSON.stringify({ status: campaign.status, evidence, error: campaign.error }));
}
