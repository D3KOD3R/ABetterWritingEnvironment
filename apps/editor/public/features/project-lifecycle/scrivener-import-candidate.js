// Intent: convert a desktop-selected Scrivener source into a runtime candidate; package creation remains owned by the normal project lifecycle.
import { PROJECT_SCHEMA_VERSION } from "../../adapters/storage/project-migrations.js";
import {
  buildScrivenerProjectSnapshotFromFiles,
  pickScrivenerProjectPackageFromDirectory,
} from "../../adapters/storage/scrivener-import-service.js";
import { stageProjectImportCandidate } from "../../state/project-import-candidate-store.js";

export async function prepareScrivenerImportCandidate({
  windowRef = globalThis.window,
  sourcePath = "",
} = {}) {
  const scrivenerPackage = await pickScrivenerProjectPackageFromDirectory({ windowRef });
  if (!scrivenerPackage?.files?.length) return null;

  const resolvedSourcePath = String(sourcePath ?? "").trim() || scrivenerPackage.sourcePath || "";
  const snapshot = await buildScrivenerProjectSnapshotFromFiles(scrivenerPackage.files, {
    sourceLabel: scrivenerPackage.sourceLabel ?? "Scrivener project",
    sourcePath: resolvedSourcePath,
    schemaVersion: PROJECT_SCHEMA_VERSION,
  });
  const importedProject = snapshot.projects?.[0] ?? null;
  const sceneCount = Number(importedProject?.importReport?.manuscriptSceneCount ?? 0);
  const metadataCount = Number(importedProject?.importReport?.customMetadataFieldCount ?? 0);

  return stageProjectImportCandidate({
    kind: "scrivener",
    snapshot,
    projectTitle: importedProject?.title ?? "Imported Scrivener Project",
    sourceLabel: scrivenerPackage.sourceLabel ?? "Scrivener project",
    sourcePath: resolvedSourcePath,
    sceneCount,
    metadataCount,
  });
}
