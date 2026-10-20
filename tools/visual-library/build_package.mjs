// Intent: materialize a reviewed, external test library through existing ABE services.
// This offline operator does not implement a UI/import feature or a second serializer.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, cp, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, token, i, all) => {
  if (token.startsWith("--")) pairs.push([token.slice(2), all[i + 1]]);
  return pairs;
}, []));
for (const name of ["inspection", "source", "baseline", "comparison", "parent"]) {
  if (!args[name] || !path.isAbsolute(args[name])) throw new Error(`--${name} must be absolute`);
}
const parent = await realpath(args.parent);
const worktree = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = await realpath(args.source);
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
}
assert.ok(!inside(worktree, parent) && !inside(sourceRoot, parent), "Package must be external to code and production");
const folderName = "Serva Vitae Visual Development";
const packageRoot = path.join(parent, folderName);
const evidenceRoot = path.join(parent, "validation");
await mkdir(evidenceRoot, { recursive: true });
// Configure log destinations before importing the desktop handler.
process.env.ABE_LOG_PATH = path.join(evidenceRoot, "desktop.log");
process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR = path.join(evidenceRoot, "runtime");
const [
  { createDesktopResponseForRequest },
  { createProjectService },
  { buildPortableExternalProjectSnapshot },
  { assertProjectSnapshotsSemanticallyEquivalent },
  { buildVisualAssetLibraryModel },
] = await Promise.all([
  import("../../apps/desktop/src/http-app.ts"),
  import("../../apps/editor/public/adapters/storage/project-service.js"),
  import("../../apps/editor/public/adapters/storage/project-persistence-service.js"),
  import("../../apps/editor/public/adapters/storage/project-snapshot-verification.js"),
  import("../../apps/editor/public/features/visual-studio/visual-asset-library-model.js"),
]);
const loadJson = async (file) => JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
const saveJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function request(route, body, expectedSuccess = true) {
  const response = await createDesktopResponseForRequest({ method: "POST", pathname: `/api/${route}`, body: JSON.stringify(body) });
  const result = JSON.parse(response.body);
  if (expectedSuccess) assert.equal(response.statusCode, 200, `${route}: ${result.message}`);
  return { ...result, statusCode: response.statusCode };
}
const plan = await loadJson(path.join(args.inspection, "import-plan.json"));
const baseline = await loadJson(args.baseline);
const sourceProject = baseline.projects.find((p) => p.id === baseline.activeProjectId) ?? baseline.projects[0];
const projectId = `project-${randomUUID()}`;
const now = new Date().toISOString();
const service = createProjectService({
  projectRepository: { loadAllScenes: () => ({}) },
  preferencesRepository: {},
});
// Fork only manuscript/world reference data into a new logical test project.
// User preferences, unrelated tasks/revisions, provider settings and old asset paths
// are not inherited into this dedicated library.
const workspace = structuredClone(sourceProject.workspace);
delete workspace.settings;
delete workspace.analysis;
delete workspace.voice;
delete workspace.narration;
workspace.project.id = projectId;
workspace.project.title = "Serva Vitae Visual Development Test Project";
workspace.project.binder.refId = projectId;
workspace.project.binder.id = `binder-${projectId}`;
workspace.project.binder.title = workspace.project.title;
if (workspace.project.navigationTargets) {
  delete workspace.project.navigationTargets[sourceProject.id];
  workspace.project.navigationTargets[projectId] = { refId: projectId, kind: "project", title: workspace.project.title };
}
const excludedLegacyImages = [];
for (const entity of workspace.world.entities) {
  if (entity.image || entity.catalogueImage) excludedLegacyImages.push(entity.id);
  delete entity.image;
  delete entity.catalogueImage;
}
let { projectRecord } = service.createProject({
  projectRecord: {
    id: projectId, title: workspace.project.title, source: "visual-development-test-fork",
    createdAt: now, updatedAt: now, workspace,
    sceneDrafts: structuredClone(sourceProject.sceneDrafts ?? {}),
    structureDrafts: structuredClone(sourceProject.structureDrafts ?? {}),
    templateDrafts: structuredClone(sourceProject.templateDrafts ?? {}),
    projectSettings: { activeSceneId: "scene-0001", assetRegistry: [] },
  },
  librarySnapshot: { schemaVersion: 2, activeProjectId: null, projects: [], sceneStore: {} },
});
const sourceScenes = baseline.sceneStore?.[sourceProject.id] ?? {};
function snapshot(record) {
  return buildPortableExternalProjectSnapshot(service.exportProjectLibrarySnapshot({
    librarySnapshot: { schemaVersion: 2, activeProjectId: projectId, projects: [record], sceneStore: { [projectId]: sourceScenes } },
  }));
}
const initial = snapshot(projectRecord);
const stage = await request("project-package/create", { parentPath: parent, folderName, snapshot: initial });
const stagedLoad = await request("project-package/load", { rootPath: stage.stagingRootPath });
assertProjectSnapshotsSemanticallyEquivalent(initial, stagedLoad.snapshot);
await request("project-package/commit", { operationToken: stage.operationToken });
const progress = { projectId, packageRoot, stage: "package-created", importedAssetIds: [] };
await saveJson(path.join(evidenceRoot, "build-progress.json"), progress);
// Persist bounded batches. Resume/review can locate any completed batch even if
// a later image fails. Existing destinations are never silently overwritten.
for (let offset = 0; offset < plan.assets.length; offset += 12) {
  for (const asset of plan.assets.slice(offset, offset + 12)) {
    const input = plan.files.find((f) => f.assetId === asset.id);
    if (input.copy) {
      const bytes = await readFile(input.sourcePath);
      assert.equal(sha(bytes), asset.metadata.sha256);
      await request("project-media/save", { activeProjectRoot: packageRoot, projectRelativePath: asset.fileRef, contentBase64: bytes.toString("base64") });
      assert.equal(sha(await readFile(path.join(packageRoot, asset.fileRef))), asset.metadata.sha256);
    }
    projectRecord = service.registerAsset({ projectRecord, asset });
    progress.importedAssetIds.push(asset.id);
  }
  const candidate = snapshot(projectRecord);
  const saving = await request("project-package/save-stage", { rootPath: packageRoot, snapshot: candidate });
  const loadedStage = await request("project-package/save-load", { operationToken: saving.operationToken });
  assertProjectSnapshotsSemanticallyEquivalent(candidate, loadedStage.snapshot);
  await request("project-package/save-commit", { operationToken: saving.operationToken });
  progress.stage = "registered-batch";
  await saveJson(path.join(evidenceRoot, "build-progress.json"), progress);
}
const catalogueRoot = path.join(packageRoot, "assets", "reference", "visual-studio");
await cp(path.join(args.inspection, "catalogue"), catalogueRoot, { recursive: true, errorOnExist: true });
await mkdir(path.join(packageRoot, "cache", "visual-previews"), { recursive: true });
for (const input of plan.files) {
  const a = plan.assets.find((asset) => asset.id === input.assetId);
  await cp(input.thumbnailSourcePath, path.join(packageRoot, a.metadata.thumbnailRelativePath));
}
// Machine bindings deliberately live outside the portable project package.
await saveJson(path.join(parent, "machine-bindings.json"), {
  schemaVersion: 1, projectId, roots: {
    "production-art": sourceRoot,
    "baseline-project": path.dirname(args.baseline),
    "comparison-project": path.dirname(args.comparison),
    "inspection-evidence": await realpath(args.inspection),
  },
});
await saveJson(path.join(catalogueRoot, "project-source.json"), {
  baseline: { rootAliasId: "baseline-project", relativePath: path.basename(args.baseline), sha256: sha(await readFile(args.baseline)), projectId: sourceProject.id, updatedAt: sourceProject.updatedAt },
  comparison: { rootAliasId: "comparison-project", relativePath: path.basename(args.comparison), sha256: sha(await readFile(args.comparison)) },
  testProjectId: projectId, excludedLegacyImages,
  selectionReason: "Baseline retains John and Ignotius IDs and all 29 manuscript scenes; comparison import changes ID namespace and omits those entities. No source declared latest canon.",
  policy: "Copied local manuscript/world reference snapshot; production sources untouched. Explicit author approval remains required for art canon.",
});
const reopened = (await request("project-package/load", { rootPath: packageRoot })).snapshot;
assertProjectSnapshotsSemanticallyEquivalent(snapshot(projectRecord), reopened);
assert.deepEqual(reopened.projects[0].projectSettings.assetRegistry.map((a) => a.id), plan.assets.map((a) => a.id));
assert.deepEqual(reopened.projects[0].projectSettings.assetRegistry.map((a) => a.metadata), plan.assets.map((a) => a.metadata));
// Source snapshots may include unplaced drafts beyond the workbook/binder.
// Preserve them, but never invent a visual brief for an unreviewed scene.
const sceneIndexPath = path.join(catalogueRoot, "scene-asset-links.json");
const sceneIndex = await loadJson(sceneIndexPath);
const knownScenes = new Set(sceneIndex.links.map((link) => link.sceneId));
const unmappedScenes = Object.entries(reopened.sceneStore[projectId])
  .filter(([id]) => !knownScenes.has(id))
  .map(([id, scene]) => ({ sceneId: id, title: scene.sceneTitle, assetIds: [], basis: "Unplaced source draft; no workbook mapping or artwork brief established" }));
sceneIndex.links.push(...unmappedScenes);
await saveJson(sceneIndexPath, sceneIndex);
const queuePath = path.join(catalogueRoot, "development-backlog.json");
const queue = await loadJson(queuePath);
queue.unmappedSourceScenes = unmappedScenes;
queue.completed.push("Native folder package creation and semantic reopen", "Bounded image import and registry metadata persistence", "Supplementary catalogues and cached previews stored");
await saveJson(queuePath, queue);
const model = buildVisualAssetLibraryModel({ projectRecord: reopened.projects[0] });
await saveJson(path.join(evidenceRoot, "creation-result.json"), {
  projectId, packageRoot, registryCount: plan.assets.length, ownedCount: plan.files.filter((f) => f.copy).length,
  sceneCount: Object.keys(reopened.sceneStore[projectId]).length,
  entityCount: reopened.projects[0].workspace.world.entities.length,
  modelKeys: Object.keys(model), modelItemCount: model.assets?.length ?? model.items?.length ?? null,
  serializer: "buildPortableExternalProjectSnapshot -> staged desktop package writer",
  createReopenSemanticEquality: true, registryMetadataEquality: true,
});
progress.stage = "complete";
await saveJson(path.join(evidenceRoot, "build-progress.json"), progress);
console.log(JSON.stringify({ packageRoot, projectId, assets: plan.assets.length, scenes: Object.keys(reopened.sceneStore[projectId]).length }));
