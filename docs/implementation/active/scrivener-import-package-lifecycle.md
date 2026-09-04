# Scrivener Import Package Lifecycle

Status: Fix in progress / manual recheck required
Date: 2026-09-04
Branch: `fix/persistence-scrivener-import-package-lifecycle`
Related: `docs/implementation/active/desktop-project-package-lifecycle.md`, `docs/implementation/active/persistence-cross-feature-regression-checklist.md`, Feature `8.6`

## Regression

Desktop Scrivener source selection/conversion was repaired, but the legacy import flow still activated the converted snapshot before a folder-backed ABE project package existed. The subsequent legacy Save As path could download a single `.abe-project.json`, leaving the File menu with `No package selected`. Once autosave/dirty state was associated with that cache-only imported project, New/Open transitions correctly refused to abandon it because it had no durable package authority.

The transition guard is therefore not the defect. The defect is activation ordering: a desktop import must not become the active project until the normal package lifecycle has staged, verified and published its destination.

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

## Cancellation and failure

- Cancelling source selection changes nothing.
- Cancelling the destination form clears the pending candidate and leaves the previous project active.
- Failure to preserve the previous active project leaves the import form open/retryable and does not activate the candidate.
- Staging/verification/publication failure leaves the previous project authoritative and does not publish a partial final destination.
- A project created by the older broken cache-only import route should be recovered with Save As before switching; do not weaken the dirty/no-durable-destination transition guard.

## Chunking and lazy loading

Scrivener conversion necessarily reads the selected source package once so it can translate binder order, manuscript bodies, metadata, comments/footnotes and reference documents. After publication there must be no special Scrivener runtime storage behavior: the imported project uses the normal ABE chunked package and runtime scene hydration paths.

Desktop package open currently still reads all scene sidecars before the browser repository collapses runtime hydration to the active scene. That is chunked physical storage plus lazy runtime hydration, not true disk-level lazy scene loading. A disk lazy-loader rewrite is separate persistence work and is intentionally excluded from this repair.

## Automated coverage

`test/scrivener-import-package-lifecycle.test.mjs` guards the import-candidate/package-publication seam: the pending candidate drives the existing New Project form, source provenance survives project renaming, the native blank-project builder is bypassed only while a pending import exists, and the desktop import preparation code does not activate a project or invoke legacy Save As.

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
10. Save, refresh, close/reopen and verify again.
11. Save As package B, reopen B, and verify imported data.
12. File -> New Project and create another project; confirm no no-durable-destination block remains from the import.
13. Open unrelated package C and verify imported state does not leak.
14. Confirm the original `.scriv` source is untouched.

Only after this manual sequence passes should Feature `8.6` move from `Fix in progress` to `Rechecked` and the canonical `features.md` implementation notes be rewritten from the legacy Port/Save-As flow to the package-import flow.
