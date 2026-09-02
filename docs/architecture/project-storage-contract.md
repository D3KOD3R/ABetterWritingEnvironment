# Project Storage Contract

## Purpose

This contract defines where durable author data may live, how project-owned filesystem paths are represented, and how new features must participate in save/load/autosave without making the repository, process working directory, or a developer machine path part of project storage policy.

The contract is intentionally broader than the persistence-portability harness. The harness proves these rules; production features must keep obeying them after the initial persistence refactor is complete.

## Core invariants

1. **The source repository/worktree is never project storage.** Launch location, `process.cwd()`, branch, and worktree identity must not determine where author data is written.
2. **Every durable project write has an explicit active project destination.** If no durable project destination exists yet, the application must Save As/choose a project location or decline the durable write. It must never silently fall back to cwd.
3. **A project package is relocatable as a unit.** Copying or moving a complete project folder from location A to location B must not require editing stored project data to make project-owned assets work again.
4. **Persisted project-owned file references are project-relative logical paths.** Runtime absolute paths may be derived transiently for I/O, but must not be the canonical serialized reference to a project-owned asset.
5. **Project bounds are enforced at the filesystem adapter/desktop boundary, not trusted to feature callers.** Relative paths containing traversal, absolute host paths masquerading as project-relative paths, drive/UNC escapes, or otherwise resolving outside the selected project root must be rejected before read/write/delete.
6. **Feature/UI code does not invent storage roots or call raw filesystem/project-media routes directly.** Structured project mutations go through `ProjectPersistenceService`; project-owned files go through the project storage/asset boundary owned by adapters/desktop integration.
7. **Save success means durable, verifiable state.** A feature must not report a successful project save merely because in-memory state changed or an intermediate file write succeeded.

## Ownership classes

### Project-owned structured state

Examples include:

- manuscript/scene content and structure;
- World Spine/worldbuilding entities, catalogue items, timeline/event data and templates;
- manuscript tasks and passage notes;
- custom metadata definitions and metadata-folder/note content;
- project-specific writing targets and project lexicons/dictionaries where applicable;
- revisions/history that must travel with the project;
- narration/recording metadata that is required to understand project assets;
- project-specific import metadata that is required after restart.

This data belongs to the selected project package and must participate in the canonical project save/load/migration pipeline.

### Project-owned files/assets

Examples include:

- narration recordings and durable audio takes;
- worldbuilding/catalogue images;
- custom metadata icons when represented as external files rather than small legacy inline payloads;
- imported reference images/audio that the project promises to retain;
- transcripts or durable generated text sidecars;
- future project-specific renders or attachments.

These files must be allocated beneath the active project root by a project storage/asset service. Feature modules should request a logical category/name and receive a project-relative reference; they should not compose an absolute Windows/macOS/Linux path themselves.

### User/application settings

Examples include:

- panel widths and layout profiles;
- panel visibility/collapse preferences;
- keyboard shortcuts and application preferences;
- model/library locations;
- default project-library location;
- last-opened project pointer;
- user-specific UI preferences, even when optionally keyed by project identity.

These do not belong in the portable project package merely because the user changed them while a project was open.

### Session/runtime state

Examples include cursor/selection, scroll/hover state, in-flight recorder state, transient UI popovers, temporary caches, and recoverable runtime projections. These are not durable project content unless a product requirement explicitly promotes them into a defined project or user setting.

### Development/test state

Developer logs, supervisor reports, test artifacts, caches and worktree-local tooling state follow the repository development-storage policy, not the project package.

## Package authority and compatibility

The desktop runtime already uses a folder-backed package containing `project.json` plus project-owned sidecars/directories such as manuscript scenes, metadata, assets, transcripts and caches. That package root is the desktop durable project authority.

Legacy/browser single-file `.abe-project.json` behaviour remains a compatibility transport until deliberately migrated. New feature code must not assume that a single JSON file is the only persistence representation, nor may it directly depend on desktop filesystem paths. The persistence service/adapters own the representation difference.

An illustrative package shape is:

```text
<Project Root>/
  project.json
  manuscript/
    scenes/
  metadata/
  assets/
    audio/
    images/
  transcripts/
  revisions/        # when revision sidecars are implemented
  cache/            # regenerable project-local cache only
```

The exact layout may evolve through schema/package migrations. The ownership and containment rules do not.

## Persisted path/reference rules

For project-owned assets, prefer a normalized reference such as:

```text
assets/audio/take-123.webm
assets/images/worldbuilding/project-1/location/europa.png
metadata/project/.../note.json
```

Persist `/`-separated project-relative paths for cross-platform portability. Convert to host separators only inside the filesystem adapter.

Do not make a durable project record depend on values such as:

```text
C:\Users\Name\Project\assets\audio\take.webm
/Users/name/Project/assets/audio/take.webm
project-media/project-1/take.webm   # if this is interpreted relative to cwd
```

A runtime may temporarily carry a resolved absolute path or local media URL, but that value must be derived from the currently opened project root plus the canonical project-relative reference and must not be the only persisted locator.

External source/provenance paths are allowed only when they are explicitly marked as external references or import provenance and are not required for the copied project package to function. If a feature promises to retain an imported file as project content, copy it into the project package and reference the copied project-relative asset.

## Canonical structured-state mutation rule

A new feature that changes durable structured project state must:

1. update canonical runtime/domain state through the owning feature/service;
2. call the canonical project mutation boundary (`ProjectPersistenceService.commitCanonicalProjectMutation` through the existing app/service wrapper) with an explicit persistence domain and useful dirty reason/source;
3. ensure the project-record builder actually includes the new durable field;
4. add/adjust normalization and migration when the saved schema changes;
5. add a focused round-trip test proving save -> reload preserves the new state.

Do not create an ad hoc localStorage key, desktop JSON file, sidecar, or direct filesystem write merely because the feature needs persistence.

If a new optimized dirty domain is introduced, add a matching domain comparator/test. Falling back to whole-project comparison is acceptable during a small migration, but silently classifying project data as user/app settings is not.

## Project-owned asset write protocol

When a feature creates or replaces a project-owned file:

1. require a durable active project destination;
2. ask the project storage/asset boundary for a safe project-relative destination;
3. resolve and validate that path beneath the active project root at the adapter/desktop boundary;
4. write the new bytes first, preferably via a temporary/atomic replacement strategy appropriate to the host;
5. verify the file write where practical;
6. update canonical project state with the project-relative reference;
7. commit/autosave the project record;
8. only after the new reference is durably saved, remove a superseded old asset or queue it for bounded orphan cleanup.

This ordering avoids a durable record pointing at a file that was deleted or never successfully written. If the record save fails after a new asset was written, the new file is an orphan candidate and may be safely cleaned later; the project record must not claim the failed reference was saved.

### Delete protocol

For a project-owned asset deletion, prefer:

1. remove/replace the reference in canonical project state;
2. durably save the updated project state;
3. delete the now-unreferenced managed asset, or let project-owned garbage collection remove it.

Do not delete the only durable copy first and then hope the project-state save succeeds.

## Package save integrity

Project-package writers must treat stored relative paths as untrusted input. Every scene, metadata, revision, transcript and asset sidecar path must pass the same containment resolver before I/O.

The package writer should converge toward transaction-safe behaviour:

- write temporary/new content before publishing references to it;
- use atomic file replacement/rename where supported;
- make the manifest or equivalent package index the final commit point when practical;
- never report success until the written project can be re-read/verified;
- leave recoverable/orphaned files rather than corrupting the last durable project state if a multi-file save fails part-way through;
- clean only files/directories owned by the project package contract, never arbitrary user files placed beside a project.

The portability harness does not need to implement a full transaction system in its first slice, but later save-integrity tests should drive these improvements.

## Relocation portability

A complete project portability test must eventually prove:

1. save project at Root A;
2. create representative sidecars/assets;
3. close the project;
4. copy or move the whole package to Root B;
5. reopen from Root B;
6. verify structured state and project-owned assets resolve beneath Root B;
7. verify no required reference still depends on Root A.

This catches stale absolute `mediaPath`/file-path persistence that a simple containment test cannot catch.

## Project-bound path validation

The desktop/storage boundary must expose one reusable project-relative resolver/validator rather than implementing slightly different checks for scenes, metadata, images, audio and future features.

At minimum it must:

- normalize separators;
- reject empty segments and `..` traversal;
- reject absolute/drive/UNC input when a project-relative path is required;
- resolve against the selected project root;
- verify the resolved target remains below that root using platform-safe path comparison;
- use equivalent checks for save, load, serve and delete operations.

If symlinks/junctions are later supported inside project packages, final filesystem containment must account for real paths as well as lexical paths.

## Current feature mapping and known migration debt

### Manuscript/tasks/passage notes

These already enter the canonical mutation boundary with project-specific dirty domains. Keep that model for future structured feature records.

### Metadata folders/notes

`metadataSubgroups` are project-owned and currently flow through the `metadata-folders` mutation domain; the desktop package writer materializes them as inspectable metadata files. Their sidecar paths must remain project-bounded and package-relative.

### Custom metadata definitions

Custom metadata definitions are project-owned taxonomy: they determine which metadata kinds exist in the project and metadata folders depend on their IDs. They currently live inside `projectSettings`, while `persistCustomMetadataDefinitionsState` uses the `app-settings` dirty domain. That mixes project schema with user UI settings and must be separated in a later migration.

Custom metadata icons are currently small inline data URLs. This is legacy-compatible project data, but if icons become file-backed they must use the same project-asset rules and portable relative references as other images.

### Worldbuilding/catalogue items

Catalogue/entity/event records are project-owned world data and already use the `world` project mutation domain. Catalogue images already compute a project-relative path and can resolve beneath the active project destination, which is a useful model for other asset-bearing features.

However, current image records can retain both `projectRelativePath` and an absolute/runtime `mediaPath`, and rendering prefers `mediaPath`. The portable representation should ultimately make the project-relative reference authoritative and derive the runtime media URL/path from the currently opened project root. Catalogue item/image deletion also needs managed-asset cleanup semantics rather than leaving unbounded orphan files.

### Narration recordings

Narration is the clearest current violation: recording DTOs/path builders use cwd-relative `project-media/<project>/<take>` paths. Narration must migrate to project-owned audio references such as `assets/audio/...`, resolved from the active project root. Shared recording DTOs should not require an absolute host path to reopen a project.

### Revisions

Revision state currently lives inside the project record and already documents a future `revisions/sessions/...` folder layout. When revision sidecars are implemented, they must go through the same project-relative resolver, migration, save-integrity and relocation tests rather than creating a revision-specific filesystem policy.

### User/layout settings

`projectSettings` currently contains a mixture of true project data and user/application layout/preferences. Panel widths, layout profiles, visibility and similar values must move to a user/app settings authority (optionally keyed by project identity for per-project UX) without travelling as author project content.

## New feature persistence checklist

Before implementing any author-facing feature that creates durable state or files, answer these questions in the feature implementation plan:

1. **Who owns it?** Project, user/app, session, cache, developer/test?
2. **Must it travel when the project folder is copied?** If yes, it is project-owned or an explicitly packaged dependency.
3. **Is it structured state or a file/binary asset?** Structured state uses the canonical project mutation path; assets use the project storage/asset boundary.
4. **Where is the canonical serialized reference?** Project-owned file references must be relative to the package, not cwd or an absolute machine path.
5. **What persistence domain marks it dirty?** Add a domain/comparator only when needed and keep project data out of `app-settings`.
6. **What happens on Save As?** Subsequent project-owned writes must follow the newly selected package root.
7. **What happens if the package is moved?** The feature must resolve from the newly opened root without rewriting the project.
8. **What happens on replace/delete?** Define safe reference update and managed-file cleanup ordering.
9. **What migration is required?** Durable schema/path changes need backward-compatible normalization/migration and focused tests.
10. **What test proves it?** At minimum round-trip persistence; add containment/relocation tests for file-backed features.

A feature is not persistence-complete merely because its UI state survives in memory or because a file happened to be written successfully.

## Guardrails to add as the refactor matures

After the red baseline identifies the first leak, add targeted automated guardrails rather than relying on convention alone. Candidates include:

- a shared project-relative path resolver test covering traversal/absolute-path rejection;
- a static/runtime guard preventing feature modules from directly calling `/api/project-media/*` or filesystem APIs outside approved storage adapters;
- a test that project-owned asset creation with no active durable project destination fails without writing to cwd;
- relocation tests for representative audio and image assets;
- a test that changing user panel/layout settings does not mutate portable project content;
- a bounded orphan-cleanup test for replace/delete flows;
- a package-save test proving stored sidecar paths cannot escape project bounds.

Keep these focused; the portability harness should become the high-level contract while lower-level tests protect the individual boundaries.
