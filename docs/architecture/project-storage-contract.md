# Project Storage Contract

## Purpose

This contract defines where author data, project-scoped preferences, project-owned files, machine/application configuration, and runtime state may live. It governs Save, autosave, Save As, reopen, relocation, replacement, deletion, and future feature persistence.

The persistence-portability harness proves these rules. Feature work must continue to obey them after the first persistence refactor is complete.

## Architectural decision for the current product stage

The application does not yet have an authentication/profile/access layer. For now, **preferences that meaningfully belong to a particular project may be stored inside that selected project package**. This is intentional and is not considered a portability violation.

Do not confuse project-scoped preferences with authored project schema/content:

- custom metadata definitions, World Spine model classes, catalogue schemas, project dictionaries, tasks, notes, research, world data and similar author-created structures are **project-owned semantic data**;
- panel widths, World Spine layout/filter/right-pane choices, active pane, collapsed navigation state and similar choices may be **project-scoped preferences**;
- machine paths, model/runtime locations, provider secrets/configuration and the active absolute project path are **application/machine state** and do not belong in the project package;
- cursor/hover/in-flight operations and other transient interaction state remain **session/runtime state** unless deliberately promoted to recovery/project preference state.

The physical package may initially keep project content and project preferences in the same manifest for compatibility, but code and dirty domains should distinguish them so future profile/auth support can move preferences without migrating authored content.

## Core invariants

1. **The source repository/worktree is never project storage.** Branch, worktree, launch directory and `process.cwd()` must not determine where author data or project-scoped preferences are written.
2. **Every durable project write has an explicit active project destination.** If no durable destination exists, require Save As/location selection or fail explicitly. Never silently fall back to cwd.
3. **A project package is self-contained and relocatable.** Moving/copying the whole package must not require rewriting project-owned references.
4. **Persisted project-owned file references are normalized project-relative logical paths.** Runtime absolute paths may be derived transiently for I/O but are not canonical portable project data.
5. **Project bounds are enforced at the filesystem/desktop adapter boundary.** Feature callers are not trusted to provide safe paths.
6. **Feature/UI code does not invent storage roots or raw filesystem/media-route policy.** Structured project state flows through `ProjectPersistenceService`; project-owned files flow through the project storage/asset boundary.
7. **Save success means durable, verifiable state.** In-memory mutation or an intermediate file write is not sufficient.
8. **Save As produces another complete project package.** It carries all required project-owned content/assets and current project-scoped preferences.
9. **Machine/application state does not hitchhike inside project data.** A copied project must not depend on the old computer's model root, default project root, worktree, cwd, provider runtime state or absolute active-project path.
10. **Durability is explicit.** Adding a field to runtime `workspace` must not automatically make it project content or a project preference.

## Ownership classes

### 1. Project-owned semantic state

This is the author's actual project model and must travel with the project.

Examples:

- manuscript/scene content and structure;
- World Spine/worldbuilding entities, catalogue items, timelines, nodes, locations, implication edges, links, templates and model classes;
- manuscript tasks, passage notes, inspiration and research;
- custom metadata definitions/taxonomy and metadata-folder/note records;
- project writing goals/history;
- project spellcheck dictionary/exceptions;
- revision/history records that must travel with the project;
- narration/recording metadata required to understand durable project audio;
- accepted analysis results that have become canonical manuscript/world/project data;
- project-specific import metadata required after restart.

This data belongs to the selected project package and participates in canonical save/load/migration.

### 2. Project-owned files/assets

Examples:

- narration recordings and durable audio takes;
- catalogue/World Spine images;
- custom metadata icons when file-backed;
- imported images/audio/reference attachments promised to travel with the project;
- durable transcripts and generated project sidecars;
- future project-specific renders/attachments.

These are allocated beneath the active project root by the project storage/asset boundary. Feature modules request a logical category/name or project-relative destination; they do not compose machine absolute paths.

### 3. Project-scoped preferences

For the current application stage these may live in the project package and travel with it.

Examples:

- binder/console widths and project layout profiles;
- World Spine event-rail/manuscript-pane widths and layout profile;
- World Spine right-pane mode and location-filter preference;
- active authoring pane;
- collapsed project/navigation sections;
- project-specific panel visibility or presentation choices;
- writing-goal dashboard view/date/month selection if we want reopening the project to restore that view.

These are **not authored semantic content**. Prefer a distinct namespace such as `projectPreferences` or a distinct dirty domain even if compatibility currently stores them under `projectSettings`.

A future authenticated/profile system may move some or all of these preferences into user-profile storage. That future move must not require changing the project's authored semantic schema.

### 4. Application/machine settings

These remain outside portable project content.

Examples:

- model/library/runtime executable locations;
- default project-library/project-root location;
- last-opened project pointer;
- provider/client configuration and credentials;
- desktop host configuration;
- global application defaults that are not intentionally project-specific.

The desktop implementation may use an application-data settings store. It must not use the source worktree as the long-term settings location.

### 5. Session/runtime/recovery state

Cursor/selection, hover state, popovers, active drag state, in-flight recorder/ASR jobs, transient provider/job state, temporary projections and caches are runtime state by default.

If a product requirement deliberately wants reopen/recovery behaviour, promote only the required subset into an explicit project-recovery or project-preference model. Do not gain durability merely because a field happens to exist under `workspace`.

### 6. Development/test state

Developer logs, supervisor reports, worktree caches and automated test artifacts follow development-storage policy, not project storage policy.

## Package authority and compatibility

Desktop already uses a folder-backed package with `project.json` plus sidecars/directories such as manuscript scenes, metadata, assets, transcripts and caches. That selected package root is the desktop durable project authority.

Legacy/browser `.abe-project.json` remains a compatibility transport until deliberately migrated. New feature code must not assume one monolithic file or depend directly on desktop filesystem paths. Adapters/persistence own the representation difference.

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
  revisions/              # when revision sidecars are implemented
  cache/                  # only regenerable project-local cache
```

`project.json` may contain both semantic project data and a clearly separated `projectPreferences` section until/unless preferences receive their own sidecar. The layout may evolve through migrations; ownership and containment rules do not.

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

## Explicit portable-project serializer

Converge away from serializing the entire live workspace by default.

The durable serializer should deliberately include:

```text
semantic project model
project-scoped preferences
project-relative asset references
```

and deliberately exclude:

```text
machine/application paths
provider/runtime job machinery
transient selection/hover/drag/session state
worktree/cwd-derived values
```

This allowlist boundary is important for future features: adding a runtime field must not automatically make it durable.

## Canonical structured-state mutation rule

A feature that changes durable project state must:

1. classify the mutation as **semantic project data** or **project-scoped preference**;
2. update canonical runtime/domain state through the owning service;
3. enter `ProjectPersistenceService.commitCanonicalProjectMutation` through the existing wrapper with an explicit persistence domain, dirty reason and source;
4. ensure the project-record builder deliberately includes the durable field;
5. add normalization/migration for schema changes;
6. add a save -> reload round-trip test.

Do not add an ad hoc localStorage key, desktop JSON file, direct filesystem write or feature-specific sidecar merely because a feature needs persistence.

Project semantic data must not be disguised as `app-settings`. Project-scoped preferences should use an explicit preference domain/namespace rather than sharing a catch-all with machine/application settings.

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

Save writes semantic project data, project-scoped preferences and project-owned asset references to the already selected package root. It must not silently retarget assets or create a second storage root.

### Autosave

Autosave uses the exact same active project authority and project-relative path rules as manual Save. Autosave is not allowed a special cwd/local fallback for project-owned data or project preferences.

### Save As

Save As creates a **complete new package root** and makes it the active durable destination only after the new package is valid.

For project-owned files already referenced by the project, Save As must copy/materialize those files into corresponding relative locations in the new package. Semantic data and project-scoped preferences travel into Project B. Machine/application settings and host absolute paths do not.

A correct Save As test proves:

1. Project A contains representative semantic state, project preferences and audio/image/metadata sidecars;
2. Save As creates Project B;
3. Project B contains the corresponding project-owned files beneath B;
4. close Project B;
5. make Project A unavailable;
6. reopen Project B;
7. semantic state, project preferences and required assets still work and resolve beneath B;
8. no required machine/path reference still points to A.

## Relocation portability

Independent of Save As, moving/copying one complete package must work without rewriting project-owned references:

1. save at Root A;
2. create representative semantic state, preferences and assets;
3. close;
4. move/copy the complete package to Root B;
5. reopen from B;
6. semantic data and project-scoped preferences survive;
7. all project-owned references resolve under B;
8. no required reference still depends on A.

Containment at creation time alone does not prove relocation portability.

## Package save integrity and path validation

Project-package writers must treat stored relative paths as untrusted input. Every scene, metadata, revision, transcript and asset path passes one reusable containment resolver before I/O.

At minimum that resolver must:

- normalize separators;
- reject empty segments and `..` traversal;
- reject absolute/drive/UNC input when a relative path is required;
- require a truly durable/absolute host project root on desktop;
- resolve against that root;
- verify the target remains beneath the root with platform-safe path comparison;
- apply equivalent checks to save, load, serve and delete.

Converge toward transaction-safe behaviour: write temporary/new content before publishing references, use atomic replacement where supported, make the manifest/package index the final commit point when practical, verify written state before reporting success, and prefer recoverable orphan files over corruption of the last durable project state.

## Current feature mapping and migration debt

### World Spine / worldbuilding

Spines, nodes, implication edges, locations/sublocations, entities, entity links, catalogue items, templates/model classes and scene-linked World Spine metadata are semantic project data and already broadly flow through `workspace.world` / canonical project mutations. Preserve that ownership.

World Spine layout widths, layout profiles, right-pane mode and location filter may remain project-scoped preferences for now. They should be separated logically from semantic `world` data and should not be treated as machine/application settings.

Catalogue images already compute a `projectRelativePath`, but current records may also retain an absolute/runtime `mediaPath`. Make the relative reference authoritative and derive runtime access from the newly opened root.

### Manuscript tasks, notes, research and metadata

Tasks, passage notes, inspiration, research, metadata folders/notes and draft-proofing records are semantic project data.

Custom metadata definitions are especially important: they define project-specific taxonomy/model classes and therefore belong to the semantic project schema, not to a preference bucket. Future file-backed metadata icons use the project asset contract.

### Writing goals and spellcheck

Canonical writing goals/history and project dictionary/exceptions are semantic project data. Dashboard view/month/date selection may remain project-scoped preference state for now.

### Narration / voice

Narration recording metadata needed to understand durable takes is project semantic data. Recording bytes are project-owned assets and must move to package-relative `assets/audio/...` storage.

Live recorder/ASR/provider jobs are runtime state. Project-specific character-to-voice bindings may be semantic project data; machine/provider profile configuration requires explicit classification and must not be persisted accidentally by whole-workspace cloning.

### Analysis / local AI

Accepted analysis changes become semantic project data when applied to manuscript/world/project structures. Provider descriptors, model/runtime configuration and job execution state are application/runtime state unless a specific review queue is deliberately designed as project data.

### Project-scoped preferences

For now it is valid for project package persistence to retain project-specific layout/navigation preferences. The refactor should improve namespacing/domains rather than move them out solely to create a not-yet-existing user-profile system.

### Machine/host state

`modelRoot`, `assetRoot`, default `projectRoot`, provider/client configuration, worktree paths and the active absolute `projectFilePath` remain outside portable project content. Desktop settings should eventually move from the source tree to an OS/application-data location, but this is independent of project preference ownership.

## New feature persistence checklist

Before implementing any author-facing durable feature, answer:

1. **Who owns it?** Semantic project, project preference, app/machine, session/recovery, cache, or developer/test?
2. **Must it travel with a copied project?** Semantic state/assets and current project preferences normally do; external dependencies must be explicit.
3. **Structured state or file asset?** Structured project state uses canonical project mutation; assets use project storage/asset APIs.
4. **Canonical file reference?** Project-owned references are package-relative, never cwd/machine absolute.
5. **Dirty domain?** Use a semantic feature domain or project-preference domain; do not hide project taxonomy/content in `app-settings`.
6. **Save behaviour?** Does normal Save durably preserve it?
7. **Autosave behaviour?** Same destination and ownership rules as Save?
8. **Save As behaviour?** Is the complete required state/asset set copied into the new package?
9. **Relocation behaviour?** Can the complete package move without rewriting stored refs?
10. **Replace/delete behaviour?** What is the safe reference/file cleanup ordering?
11. **Migration?** What backward-compatible normalization/path migration is required?
12. **Runtime exclusion?** Which nearby provider/job/UI fields must explicitly *not* become durable?
13. **Tests?** At minimum round-trip; file-backed features add containment, Save As and/or relocation coverage.

A feature is not persistence-complete merely because its UI survives in memory or one filesystem call succeeded.

## Automated guardrails to add as the refactor matures

After the red baseline, add focused guards such as:

- shared project-relative resolver tests for traversal/absolute escape;
- a guard preventing feature modules from directly calling `/api/project-media/*` or filesystem APIs outside approved storage adapters;
- a no-destination test proving asset creation fails without cwd writes;
- Save As self-containment tests with representative audio/image assets;
- Root A -> Root B relocation tests;
- a project-preferences round-trip test proving project-specific layout/preferences survive within the package without mutating semantic World Spine/manuscript data;
- a machine/runtime exclusion test proving model roots, worktree/cwd paths and provider jobs do not enter the portable package;
- bounded orphan cleanup tests for replace/delete;
- package-save tests proving stored sidecar paths cannot escape project bounds;
- a test that relative `some/folder` values cannot masquerade as durable desktop project roots.

Keep lower-level tests focused; the portability harness remains the end-to-end ownership contract.
