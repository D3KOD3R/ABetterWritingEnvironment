// Intent: exercise the real package/media boundary against a populated external
// library, including Save As with the original unavailable. No UI is simulated.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? "");
assert.ok(process.argv[2] && path.isAbsolute(process.argv[2]), "Supply an absolute package root");
const parent = path.dirname(root);
const workspace = fileURLToPath(new URL("../../", import.meta.url));
assert.ok(!root.toLowerCase().startsWith(workspace.toLowerCase()));
assert.equal(await realpath(root), root);
const validation = path.join(parent, "validation");
await mkdir(validation, { recursive: true });
process.env.ABE_LOG_PATH = path.join(validation, "validation-desktop.log");
process.env.ABE_DEVELOPER_RUNTIME_LOG_DIR = path.join(validation, "runtime");
const [
  { createDesktopResponseForRequest },
  { assertProjectSnapshotsSemanticallyEquivalent },
  { buildPortableExternalProjectSnapshot },
  { createProjectService },
] = await Promise.all([
  import("../../apps/desktop/src/http-app.ts"),
  import("../../apps/editor/public/adapters/storage/project-snapshot-verification.js"),
  import("../../apps/editor/public/adapters/storage/project-persistence-service.js"),
  import("../../apps/editor/public/adapters/storage/project-service.js"),
]);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
async function call(route, body, success = true) {
  const res = await createDesktopResponseForRequest({ method: "POST", pathname: `/api/${route}`, body: JSON.stringify(body) });
  const data = JSON.parse(res.body);
  if (success) assert.equal(res.statusCode, 200, `${route}: ${data.message}`);
  return { ...data, statusCode: res.statusCode };
}
const checks = {};
const original = (await call("project-package/load", { rootPath: root })).snapshot;
const project = original.projects[0];
const assets = project.projectSettings.assetRegistry;
const ids = new Set(assets.map((a) => a.id));
assert.equal(ids.size, assets.length);
const entityIds = new Set(project.workspace.world.entities.map((e) => e.id));
const sceneIds = new Set(Object.keys(original.sceneStore[project.id]));
for (const a of assets) {
  assert.ok(a.metadata.entityIds.every((id) => entityIds.has(id)), a.id);
  assert.ok(a.metadata.sceneIds.every((id) => sceneIds.has(id)), a.id);
  assert.ok(a.metadata.relatedAssetIds.every((id) => ids.has(id) && id !== a.id), a.id);
  assert.ok(a.metadata.sources.length);
  assert.equal(a.metadata.canonStatus, "not-approved");
  if (a.fileRef) {
    assert.equal(a.metadata.locator.kind, "project-owned");
    assert.equal(a.fileRef, a.metadata.locator.relativePath);
    assert.ok(!path.isAbsolute(a.fileRef) && !a.fileRef.split("/").includes(".."));
    assert.equal(sha(await readFile(path.join(root, a.fileRef))), a.metadata.sha256);
  } else assert.notEqual(a.metadata.locator.kind, "project-owned");
  assert.ok((await stat(path.join(root, a.metadata.thumbnailRelativePath))).size > 0);
}
checks.registryStableIdsLinksHashesAndPreviews = true;
const owned = assets.filter((a) => a.fileRef);
assert.equal(new Set(owned.map((a) => a.fileRef)).size, owned.length);
assert.equal(new Set(owned.map((a) => a.metadata.sha256)).size, owned.length);
checks.noDuplicateOwnedBinaryHashes = true;
const service = createProjectService({ projectRepository: {}, preferencesRepository: {} });
assert.equal(service.registerAsset({ projectRecord: project, asset: assets[0] }).projectSettings.assetRegistry.length, assets.length);
checks.duplicateRegistrationIsIdempotent = true;

// Save As must copy arbitrary supplementary metadata as well as registered images.
const cloneName = `Library Save As ${Date.now()}`;
const staged = await call("project-package/save-as", {
  sourceRoot: root, destinationParentPath: validation, folderName: cloneName,
  snapshot: buildPortableExternalProjectSnapshot(original),
});
const stagedSnapshot = (await call("project-package/load", { rootPath: staged.stagingRootPath })).snapshot;
assertProjectSnapshotsSemanticallyEquivalent(original, stagedSnapshot);
const published = await call("project-package/commit", { operationToken: staged.operationToken });
const clone = published.rootPath;
const relocated = path.join(validation, `${cloneName} relocated`);
const offline = path.join(parent, `${path.basename(root)}.validation-offline`);
// These exact paths are created/owned by this operation, outside all source trees.
assert.equal(path.dirname(offline), parent);
assert.equal(path.dirname(clone), validation);
assert.equal(path.dirname(relocated), validation);
await rename(root, offline);
try {
  await assert.rejects(stat(root));
  const savedAs = (await call("project-package/load", { rootPath: clone })).snapshot;
  assertProjectSnapshotsSemanticallyEquivalent(original, savedAs);
  for (const a of owned) {
    const loaded = await call("project-media/load", { activeProjectRoot: clone, projectRelativePath: a.fileRef });
    assert.equal(sha(Buffer.from(loaded.contentBase64, "base64")), a.metadata.sha256);
  }
  const supplementary = await readdir(path.join(offline, "assets", "reference", "visual-studio"));
  for (const name of supplementary) {
    assert.equal(sha(await readFile(path.join(offline, "assets", "reference", "visual-studio", name))), sha(await readFile(path.join(clone, "assets", "reference", "visual-studio", name))));
  }
  checks.saveAsWithoutOriginal = true;
  checks.saveAsPreservesSupplementaryCatalogues = true;
  await rename(clone, relocated);
  await assert.rejects(stat(clone));
  const moved = (await call("project-package/load", { rootPath: relocated })).snapshot;
  assertProjectSnapshotsSemanticallyEquivalent(original, moved);
  for (const a of owned) assert.equal(sha(await readFile(path.join(relocated, a.fileRef))), a.metadata.sha256);
  checks.relocationWithoutReferenceRewrite = true;

  // Missing bytes must fail honestly without altering or losing the registry entry.
  const probe = owned[0];
  const missingFile = path.join(relocated, probe.fileRef);
  await rename(missingFile, `${missingFile}.unavailable`);
  try {
    const missing = await call("project-media/load", { activeProjectRoot: relocated, projectRelativePath: probe.fileRef }, false);
    assert.ok(missing.statusCode >= 400);
    assert.ok((await call("project-package/load", { rootPath: relocated })).snapshot.projects[0].projectSettings.assetRegistry.some((a) => a.id === probe.id));
  } finally {
    await rename(`${missingFile}.unavailable`, missingFile);
  }
  checks.missingImageFailurePreservesRegistry = true;
  for (const unsafe of ["../escape.png", "C:/outside/image.png", "//server/share/image.png"]) {
    const rejected = await call("project-media/load", { activeProjectRoot: relocated, projectRelativePath: unsafe }, false);
    assert.ok(rejected.statusCode >= 400, unsafe);
  }
  checks.projectRelativeTraversalRejected = true;
} finally {
  await rename(offline, root);
}

// External aliases are not supported by the current application resolver. Validate
// their catalogue bindings explicitly, and report that limit rather than claiming UI support.
const bindings = await readJson(path.join(parent, "machine-bindings.json"));
for (const asset of assets.filter((a) => !a.fileRef)) {
  const locator = asset.metadata.locator;
  assert.ok(bindings.roots[locator.rootAliasId]);
  const external = await realpath(path.join(bindings.roots[locator.rootAliasId], locator.relativePath));
  const bindingRoot = await realpath(bindings.roots[locator.rootAliasId]);
  const relative = path.relative(bindingRoot, external);
  assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.equal(sha(await readFile(external)), asset.metadata.sources[0].sourceSha256);
}
checks.externalSourceBindingsAvailableAndSourceHashesMatch = true;
const unbound = assets.filter((a) => !a.fileRef).map((a) => ({ assetId: a.id, status: "unbound-external-root", alias: a.metadata.locator.rootAliasId }));
assert.ok(unbound.length === assets.filter((a) => !a.fileRef).length);
checks.portableExternalLocatorsHaveNoMachinePath = assets.filter((a) => !a.fileRef).every((a) => !path.isAbsolute(a.metadata.locator.relativePath));
assert.ok(checks.portableExternalLocatorsHaveNoMachinePath);
const beforeInventory = await readJson(path.join(parent, "inspection", "discovery.json"));
for (const source of beforeInventory.files) {
  assert.equal(sha(await readFile(path.join(bindings.roots["production-art"], source.sourceRelativePath))), source.sha256, source.sourceRelativePath);
}
checks.allProductionFileHashesUnchanged = true;
const final = (await call("project-package/load", { rootPath: root })).snapshot;
assertProjectSnapshotsSemanticallyEquivalent(original, final);
checks.originalRestoredAndReopened = true;
const result = {
  status: "passed", scope: "Real desktop package/media handlers, invoked in process; no browser UI launch",
  projectId: project.id, checkedAt: new Date().toISOString(),
  counts: { registryAssets: assets.length, ownedImages: owned.length, externalReferences: assets.length - owned.length, storedScenes: sceneIds.size, worldEntities: entityIds.size },
  checks, limitations: [
    "External alias resolution and Relink UI are not implemented; availability checked against the local binding file only.",
    "No browser gallery, thumbnail-grid memory benchmark, interactive Open dialog or race-condition test was performed.",
    "Supplementary catalogues copy with folder-package Save As but are not application-owned normalized DTOs.",
  ],
  unboundOnOtherMachine: unbound,
  relocatedValidationPackage: path.basename(relocated),
};
await writeFile(path.join(validation, "package-validation.json"), JSON.stringify(result, null, 2));
await writeFile(path.join(root, "assets", "reference", "visual-studio", "validation-results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, checks: Object.keys(checks).length, ...result.counts }));
