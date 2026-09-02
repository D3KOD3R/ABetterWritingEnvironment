# Project Storage Contract

## Purpose

This contract defines where author data may live, how project-owned paths are represented, and how every current or future feature must participate in Save, autosave, Save As, reopen, relocation, replacement and deletion.

The persistence-portability harness proves these rules. Feature work must continue to obey them after the first persistence refactor is complete.

## Core invariants

1. **The source repository/worktree is never project storage.** Branch, worktree, launch directory and `process.cwd()` must not determine where author data is written.
2. **Every durable project write has an explicit active project destination.** If no durable destination exists, require Save As/location selection or fail the durable write. Never silently fall back to cwd.
3. **A project package is self-contained and relocatable.** Moving/copying the whole package must not require rewriting project-owned references.
4. **Persisted project-owned file references are normalized project-relative logical paths.** Absolute runtime paths may be derived transiently for I/O but are not canonical portable project data.
5. **Project bounds are enforced at the filesystem/desktop adapter boundary.** Feature callers are not trusted to provide safe paths.
6. **Feature/UI code does not invent storage roots or raw filesystem/media-route policy.** Structured state flows through `ProjectPersistenceService`; project-owned files flow through the project storage/asset boundary.
7. **Save success means durable, verifiable state.** In-memory mutation or an intermediate file write is not sufficient.
8. **Save As produces another complete project package.** It must carry forward all project-owned files required by the saved project, not only `project.json` and structured sidecars.

## Ownership classes

### Project-owned structured state

Examples:

- manuscript/scene content and structure;
- World Spine/worldbuilding entities, catalogue items, timelines, event data and templates;
- manuscript tasks and passage notes;
- custom metadata definitions and metadata-folder/note records;
- project writing targets and project lexicons/dictionaries where applicable;
- revision/history records that must travel with the project;
- narration/recording metadata required to understand durable audio;
- project-specific import metadata required after restart.

This data belongs to the selected project package and participates in canonical save/load/migration.

### Project-owned files/assets

Examples:

- narration recordings and durable audio takes;
- catalogue/worldbuilding images;
- custom metadata icons when file-backed;
- imported images/audio/reference attachments promised to travel with the project;
- durable transcripts and generated sidecars;
- future project-specific renders/attachments.

These are allocated beneath the active project root by the project storage/asset boundary. Feature modules request a logical category/name or project-relative destination; they do not compose machine absolute paths.

### User/application settings

Examples:

- panel widths/layout profiles and visibility preferences;
- keyboard shortcuts/application preferences;
- model/library locations;
- default project-library location;
- last-opened project pointer;
- user-specific UI preferences, optionally keyed by project identity.

These do not become portable project content merely because they changed while a project was open.

### Session/runtime state

Cursor/selection, scroll/hover state, popovers, in-flight recorder state, transient projections and recoverable runtime caches remain runtime state unless a product requirement deliberately promotes them.

### Development/test state

Developer logs, supervisor reports, worktree caches and automated test artifacts follow development-storage policy, not project storage policy.

## Package authority and compatibility

Desktop already uses a folder-backed package with `project.json` plus sidecars/directories such as manuscript scenes, metadata, assets, transcripts and caches. That selected package root is the desktop durable project authority.

Legacy/browser `.abe-project.json` remains a compatibility transport until deliberately migrated. New feature code must not assume one monolithic JSON file or depend directly on desktop filesystem paths. Adapters/persistence own the representation difference.

Illustrative package shape:

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
  cache/            # only regenerable project-local cache
```

The layout may evolve through migrations; ownership and containment rules do not.

## Portable reference rules

Canonical project-owned file references should look like:

```text
assets/audio/take-123.webm
assets/images/worldbuilding/project-1/location/europa.png
metadata/project/.../note.json
```

Persist `/`-separated paths for cross-platform portability. Convert separators only inside the host adapter.

Do not make portable project behaviour depend on values such as:

```text
C:\Users\Name\Project\assets\audio\take.webm
/Users/name/Project/assets/audio/take.webm
project-media/project-1/take.webm   # when interpreted relative to cwd
```

A runtime may temporarily carry a resolved absolute path or local media URL, but it must be derivable from the currently opened project root plus the canonical relative reference.

External source/provenance paths are allowed only when explicitly marked as external references/import provenance and not required for the copied package to function. If a feature promises to retain an imported file, copy it into the package.

The **active package location itself is host/runtime state**, not portable project content. Current `projectSettings.projectFilePath` persistence is migration debt: load/save actions should establish the active destination; a package should not need to serialize its own old absolute location to remain valid.

## Canonical structured-state mutation rule

A feature that changes durable project state must:

1. update canonical runtime/domain state through the owning service;
2. enter `ProjectPersistenceService.commitCanonicalProjectMutation` through the existing wrapper with an explicit persistence domain, dirty reason and source;
3. ensure the project-record builder includes the durable field;
4. add normalization/migration for schema changes;
5. add a save -> reload round-trip test.

Do not add an ad hoc localStorage key, desktop JSON file, direct filesystem write or feature-specific sidecar merely because a feature needs persistence.

If a new optimized dirty domain is introduced, add a matching comparator/test. Whole-project comparison can be a temporary migration fallback, but project data must not be disguised as `app-settings`.

## Project-owned asset write protocol

When creating/replacing an asset:

1. require a durable active project destination;
2. allocate a safe project-relative destination through the project storage/asset boundary;
3. resolve and validate that path beneath the active project root at the adapter/desktop boundary;
4. write the new bytes first, preferably through temp/atomic replacement appropriate to the host;
5. verify the file write where practical;
6. update canonical project state with the relative reference;
7. commit/autosave the project state;
8. after the new reference is durably saved, remove or queue cleanup of the superseded asset.

If step 7 fails after a new file was written, that file is an orphan candidate; the durable record must continue to reference the previous valid state.

### Delete protocol

Prefer:

1. remove/replace the reference in canonical project state;
2. durably save the updated state;
3. delete the unreferenced managed file or let bounded project garbage collection remove it.

Do not delete the only durable copy first and then hope project-state persistence succeeds.

## Save / autosave / Save As semantics

### Save

Save writes the current canonical project to the already selected package root. It must not silently retarget assets or create a second storage root.

### Autosave

Autosave uses the exact same active project authority and project-relative path rules as manual Save. Autosave is not allowed a special cwd/local fallback for project-owned data.

### Save As

Save As creates a **complete new package root** and makes it the active durable destination only after the new package is valid.

For project-owned files already referenced by the project, Save As must copy/materialize those files into the corresponding relative locations in the new package. The resulting package must remain valid if the old package is removed or unavailable.

A correct Save As test therefore proves:

1. Project A contains structured state plus representative audio/image/metadata sidecars;
2. Save As creates Project B;
3. Project B contains the corresponding project-owned files beneath B;
4. close Project B;
5. make Project A unavailable;
6. reopen Project B;
7. all required state/assets still work and resolve beneath B.

Do not treat an old absolute `mediaPath` pointing back to A as successful Save As behaviour.

The naming/chooser contract must also become deterministic. Desktop folder-package destinations and legacy/browser single-file `.abe-project.json` destinations should not depend on whether a target path happened to exist as a file before Save As.

## Relocation portability

Independent of Save As, moving/copying one already-complete package must work without rewriting project-owned references:

1. save at Root A;
2. create representative assets/sidecars;
3. close;
4. move/copy the complete package to Root B;
5. reopen from B;
6. all project-owned references resolve under B;
7. no required reference still depends on A.

Containment at creation time alone does not prove relocation portability.

## Package save integrity

Project-package writers must treat stored relative paths as untrusted input. Every scene, metadata, revision, transcript and asset path passes the same containment resolver before I/O.

Converge toward transaction-safe behaviour:

- write temporary/new content before publishing references;
- use atomic file replacement/rename where supported;
- make the manifest/equivalent package index the final commit point when practical;
- do not report success until the written project can be re-read/verified;
- prefer orphaned recoverable files over corrupting the last durable project state on partial failure;
- clean only paths owned by the project package contract, never arbitrary user files placed beside a project.

The initial portability harness need not implement a complete transaction system, but later save-integrity tests should drive it.

## Project-bound path validation

Expose one reusable project-relative resolver/validator rather than independent scene/audio/image/metadata rules.

At minimum it must:

- normalize separators;
- reject empty segments and `..` traversal;
- reject absolute/drive/UNC input when a relative path is required;
- require a truly durable/absolute host project root on desktop (a slash-containing relative string is not sufficient);
- resolve against that root;
- verify the target remains beneath the root with platform-safe path comparison;
- apply equivalent checks to save, load, serve and delete.

If symlinks/junctions are later supported, final containment must account for real paths too.

## Current feature mapping and migration debt

### Manuscript, tasks and passage notes

These already enter the canonical mutation boundary with project-specific domains. Keep that pattern.

### Metadata folders/notes

`metadataSubgroups` are project-owned and use the `metadata-folders` mutation domain; the desktop package writer materializes inspectable metadata files. All such paths remain package-relative/bounded.

### Custom metadata definitions

Custom metadata definitions are project-owned taxonomy because they define metadata kinds used by the project. They currently live inside `projectSettings`, while `persistCustomMetadataDefinitionsState` uses the `app-settings` dirty domain. Split project taxonomy from user UI settings in a later migration.

Custom metadata icons are currently small inline data URLs. That is legacy-compatible, but future file-backed icons use the same project asset contract.

### Worldbuilding/catalogue items

Catalogue/entity/event records are project-owned world data and already use the `world` mutation domain.

Catalogue images already compute `projectRelativePath`, which is a useful model, but current records may also retain an absolute/runtime `mediaPath`, and rendering prefers that path. Make the relative reference authoritative and derive runtime access from the newly opened root.

Current deletion also needs managed asset cleanup semantics so removed/replaced catalogue images do not accumulate indefinitely.

### Narration recordings

Current recording builders use cwd-relative `project-media/<project>/<take>` paths. Migrate recordings to package-owned audio references such as `assets/audio/...`. Shared recording DTOs should carry a portable project-asset reference rather than require an absolute host path.

### Revisions

Revision state currently lives inside the project record and already documents a future `revisions/sessions/...` layout. Future revision sidecars use the same resolver, migration, save-integrity and relocation rules.

### User/layout settings

`projectSettings` currently mixes true project data with user/application state. Panel widths, layout profiles, visibility, similar interaction preferences, and the active host project-file location must leave portable project content. Per-project UX preferences may be keyed by project identity in the user settings store if desired.

## New feature persistence checklist

Before implementing any author-facing durable feature, answer:

1. **Who owns it?** Project, user/app, session, cache, developer/test?
2. **Must it travel with a copied project?** If yes, package it or explicitly mark it as an external dependency.
3. **Structured state or file asset?** Structured state uses canonical project mutation; assets use project storage/asset APIs.
4. **Canonical file reference?** Project-owned references are package-relative, never cwd/machine absolute.
5. **Dirty domain?** Project data gets an appropriate domain; do not hide it in `app-settings`.
6. **Save behaviour?** Does a normal save durably preserve it?
7. **Autosave behaviour?** Same destination and ownership rules as Save?
8. **Save As behaviour?** Is the complete required asset set copied into the new package?
9. **Relocation behaviour?** Can the complete package move without rewriting stored refs?
10. **Replace/delete behaviour?** What is the safe reference/file cleanup ordering?
11. **Migration?** What backward-compatible normalization/path migration is required?
12. **Tests?** At minimum round-trip; file-backed features add containment, Save As and/or relocation coverage.

A feature is not persistence-complete merely because its UI survives in memory or one filesystem call succeeded.

## Automated guardrails to add as the refactor matures

After the red baseline, add focused guards such as:

- shared project-relative resolver tests for traversal/absolute escape;
- a guard preventing feature modules from directly calling `/api/project-media/*` or filesystem APIs outside approved storage adapters;
- a no-destination test proving asset creation fails without cwd writes;
- Save As self-containment tests with representative audio/image assets;
- Root A -> Root B relocation tests;
- a test that user panel/layout changes do not mutate portable project content;
- bounded orphan cleanup tests for replace/delete;
- package-save tests proving stored sidecar paths cannot escape project bounds;
- a test that relative `some/folder` values cannot masquerade as durable desktop project roots.

Keep lower-level tests focused; the portability harness remains the end-to-end ownership contract.
