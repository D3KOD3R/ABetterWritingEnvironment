# Scrivener Import Package Lifecycle

Status: Complete / rechecked
Date: 2026-09-04
Branch: `fix/persistence-scrivener-import-package-lifecycle`
Related: `docs/implementation/active/desktop-project-package-lifecycle.md`, `docs/implementation/active/persistence-cross-feature-regression-checklist.md`, Feature `8.6`

## Regression

Desktop Scrivener source selection/conversion was repaired, but the legacy import flow still activated the converted snapshot before a folder-backed ABE project package existed. The subsequent legacy Save As path could download a single `.abe-project.json`, leaving the File menu with `No package selected`. Once autosave/dirty state was associated with that cache-only imported project, New/Open transitions correctly refused to abandon it because it had no durable package authority.

The transition guard is therefore not the defect. The defect is activation ordering: a desktop import must not become the active project until the normal package lifecycle has staged, verified and published its destination.

### Follow-on save-verification regression found during manual recheck

A second persistence defect was exposed after the import/package strategy became reachable. An older Scrivener-derived folder package can contain body-bearing scene sidecars created before the scene-level `scrivenerMetadata` provenance field was written into those chunks. The live canonical project record can still carry that durable imported metadata.

On Save, the folder-package writer correctly composes the canonical project-record scene with the previously loaded scene chunk field-by-field, so the newly staged sidecar is enriched with `scrivenerMetadata`. Semantic verification previously did something different: it let the body-bearing `sceneStore` entry replace the whole canonical scene record while building the expected comparison snapshot. That made the expected snapshot omit `scrivenerMetadata`, while the correctly enriched staged package contained it, producing a false verification failure such as:

```text
$.projects[0].scenes.scene-0023.scrivenerMetadata
```

The safety check must not be disabled and `scrivenerMetadata` must not be discarded merely to pass verification. The verifier now composes split-storage scene semantics field-by-field, matching package-writer behavior. A changed Scrivener provenance value still fails semantic verification.

### GUI activation regression found during manual recheck

The desktop package readback contained complete scene chunks, including `scrivenerMetadata`, but activation then passed the package through the browser project repository. That repository deliberately collapses non-active scene bodies into project-index metadata; its metadata allowlist did not include Scrivener provenance. The active body-bearing runtime draft therefore lost `scrivenerMetadata`, and the immediate GUI Save treated that draft as authoritative while the filesystem writer still composed against the enriched existing sidecar. Expected and staged snapshots diverged at paths such as `$.projects[0].scenes.scene-0001.scrivenerMetadata`.

Scrivener provenance is durable non-body scene metadata. It now participates in the project-index/browser-hydration metadata projection, so activation and the immediate Save preserve the complete scene provenance without consulting the original `.scriv` source.

### Portable source-location boundary

`buildScrivenerProjectSnapshotFromFiles()` records the selected absolute package location as `importReport.sourcePath` while conversion and the import form are in progress. That path is useful transient UI state but is machine-specific and must not enter the finished ABE package. The portable snapshot serializer therefore removes only `project.importReport.sourcePath`; it does not globally strip `sourcePath`, because relative binder/content provenance on imported tasks, notes, entities and archive records remains semantic project data.

## Required flow

```text
File -> Import Scrivener Project...
  -> existing native directory chooser selects read-only .scriv source
  -> Scrivener importer converts source to a transient canonical candidate
  -> current ABE project remains authoritative
  -> existing New Project package form opens
       project name (prefilled, editable)
       project folder name (prefilled, editable)
       Scrivener source (read-only)
       Location + Browse (existing reusable component)
  -> Import Project
  -> existing createDesktopProjectPackage boundary
       preserve/drain current project
       build portable candidate
       stage package
       create normal package scaffold/chunks
       reload + semantic verification
       commit/publish destination
       activate published package
  -> Project location shows published root
```

No second Scrivener-specific destination picker, package writer, scaffold, persistence service, or Save As implementation is allowed.

## Ownership

The pending import candidate is runtime-only state. It may contain the converted source snapshot and provenance while the import form is open, but it must not be written to browser project cache or become active package authority merely because conversion succeeded.

The original `.scriv` package is read-only import provenance. It is never an ABE save destination and never becomes the active project root.

The published imported project uses the exact same folder package structure as New Project and Save As, including `project.json`, chunked manuscript scene files, metadata files, asset directories, transcripts, revisions and cache directories.

Each conversion allocates a fresh ABE project identity using the same `project-<UUID>` allocator as native New Project creation. Scrivener titles, filenames, source paths and source UUIDs remain labels or provenance; none of them determines the ABE project ID or the project-scoped scene-store/cache owner.

## Cancellation and failure

- Cancelling source selection changes nothing.
- Cancelling the destination form clears the pending candidate and leaves the previous project active.
- Failure to preserve the previous active project leaves the import form open/retryable and does not activate the candidate.
- Staging/verification/publication failure leaves the previous project authoritative and does not publish a partial final destination.
- A project created by the older broken cache-only import route should be recovered with Save As before switching; do not weaken the dirty/no-durable-destination transition guard.
- A semantic verification failure must remain blocking until the actual comparison mismatch is repaired; never clear dirty state merely to unlock New/Open/Import.

## Chunking and lazy loading

Scrivener conversion necessarily reads the selected source package once so it can translate binder order, manuscript bodies, metadata, comments/footnotes and reference documents. After publication there must be no special Scrivener runtime storage behavior: the imported project uses the normal ABE chunked package and runtime scene hydration paths.

Desktop package open currently still reads all scene sidecars before the browser repository collapses runtime hydration to the active scene. That is chunked physical storage plus lazy runtime hydration, not true disk-level lazy scene loading. A disk lazy-loader rewrite is separate persistence work and is intentionally excluded from this repair.

## Automated coverage

`test/scrivener-import-package-lifecycle.test.mjs` guards the import-candidate/package-publication seam: the pending candidate drives the existing New Project form, source provenance survives project renaming, the native blank-project builder is bypassed only while a pending import exists, and the desktop import preparation code does not activate a project or invoke legacy Save As.

`test/project-snapshot-scrivener-metadata-regression.test.mjs` reproduces the older split-storage shape where the canonical scene record contains `scrivenerMetadata` but the already-loaded body sidecar does not. It verifies that semantic comparison composes those representations, accepts the correctly enriched staged package, and still rejects a changed Scrivener provenance UUID.

`test/scrivener-import-metadata-runtime-hydration.test.mjs` reproduces the GUI-only package activation path through the browser repository and proves the active draft, metadata-only scene projection and immediate exported Save all retain `scrivenerMetadata`.

`test/scrivener-import-portability.test.mjs` proves the transient import candidate may retain an obvious fake absolute source path while the portable snapshot, physical `project.json`, loaded package and subsequent Save/reload omit it. Scrivener source name, UUID, binder path and relative content-file provenance remain intact.

`test/scrivener-import-service.test.mjs` imports the same source snapshot twice and proves the ABE project IDs and scene-store owners differ while Scrivener binder, scene, comment and archive provenance stays equal. `test/scrivener-import-package-lifecycle.test.mjs` publishes both same-title imports as independent physical packages, semantically verifies both, saves an edit to the first and reloads the untouched second independently.

Existing Scrivener parser/RTF/comment/metadata tests remain responsible for conversion fidelity. Existing project-package lifecycle tests remain responsible for staging, scaffold creation, semantic verification, publication and authority adoption.

## Manual recheck

1. Start from a clean, durably saved package A.
2. File -> Import Scrivener Project...
3. Select a known `.scriv` source.
4. Confirm A is still the active project while conversion completes.
5. Confirm the package form appears with imported project name/folder, read-only source, and normal Location/Browse controls.
6. Choose a new destination and click Import Project.
7. Confirm Project location shows the published folder root and the destination contains the normal package scaffold/scene chunks.
8. Confirm there was no `.abe-project.json` download fallback on the supported desktop flow.
9. Verify binder/chapter/scene order, manuscript text, metadata, comments/footnotes, world catalogue data and editor preferences.
10. Save, refresh, close/reopen and verify again. For an older Scrivener-derived package, specifically confirm Save no longer fails on `scene-0023.scrivenerMetadata` (or another scene-level Scrivener metadata path).
11. Save As package B, reopen B, and verify imported data.
12. File -> New Project and create another project; confirm no no-durable-destination block remains from the import.
13. Open unrelated package C and verify imported state does not leak.
14. Confirm the original `.scriv` source is untouched.

Only after this manual sequence passes should Feature `8.6` move from `Fix in progress` to `Rechecked` and the canonical `features.md` implementation notes be rewritten from the legacy Port/Save-As flow to the package-import flow.
