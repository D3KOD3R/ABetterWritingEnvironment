# Project Storage Contract

## Purpose

This contract defines the persistence authority for author data, project-scoped preferences, project-owned files, application/machine configuration, recovery/cache state and runtime state. It governs Save, autosave, Save As, project switching, reopen, relocation, replacement, deletion and future feature persistence.

The persistence-portability harness proves these rules. New feature work must keep obeying them after the first refactor is complete.

## Product-stage decision: project-scoped preferences

The application does not yet have an authentication/profile/access layer. For now, preferences that meaningfully belong to a particular project may be stored inside that selected project package and travel with it.

Keep the logical classes distinct even if compatibility currently stores some of them together:

- **semantic project data** — manuscript, World Spine, catalogue/model classes, custom metadata definitions, tasks, notes/research, revisions, writing goals/history, project dictionary, durable recording metadata;
- **project-scoped preferences** — project layout widths/profiles, World Spine view/filter/right-pane choice, active pane, collapsed project/navigation state and similar project presentation choices;
- **application/machine state** — model/runtime/library locations, provider/client configuration, default project-library location, last-opened pointer and active absolute package path;
- **session/runtime/recovery state** — cursor/hover/drag state, in-flight jobs/recording sessions and explicitly designed recovery caches.

Custom metadata definitions and future author-created model classes are semantic project schema, not preferences.

## Root vocabulary

Do not use one ambiguous `projectRoot` concept for different jobs.

### Active project package root

The **active project package root** is the one durable filesystem package explicitly opened, saved or created for the active project. On desktop it is the root containing `project.json`, manuscript sidecars, metadata and assets.

Only this root may anchor project-owned file writes.

### Default project-library root

The **default project-library root** is an application/machine preference describing where projects may be created or suggested. It is not the active project's package root and must never be used as a fallback asset destination for an already-open project.

### Legacy single-file destination

A legacy/browser `*.abe-project.json` path is a compatibility transport. It is not automatically a folder-package root. Feature code must not strip `.json`, invent a sibling directory and silently start a second package there.

If a file-backed feature needs package assets while the current durable authority is only a legacy single file, the persistence layer must explicitly migrate/Save As to a package destination first, or use an explicitly supported compatibility representation.

### Project-relative reference

Project-owned file references stored in project data are normalized package-relative logical paths such as:

```text
assets/audio/take-123.webm
assets/images/worldbuilding/location/europa.png
metadata/custom/.../record.json
```

The host derives an absolute runtime path from the active package root plus the relative reference.

## Core invariants

1. **The repository/worktree is never project storage.** Branch, worktree, launch directory and `process.cwd()` must not determine project writes.
2. **Project files have one explicit active authority.** Project-owned assets cannot fall back to cwd, a repository path, a default project-library root or an invented sibling package.
3. **A project package is self-contained and relocatable.** Moving/copying the complete package must not require rewriting project-owned references.
4. **Project-owned references are package-relative.** Runtime absolute paths may be derived transiently but are not canonical portable locators.
5. **Containment is enforced at the filesystem/desktop boundary.** Feature callers are not trusted to provide safe paths.
6. **Feature/UI code does not invent storage policy.** Structured project state goes through `ProjectPersistenceService`; file assets go through the project storage/asset boundary.
7. **Save success means durable, verified state.** In-memory state or browser cache alone is not a successful package write.
8. **Save As is transactional with respect to authority.** The new destination becomes active only after the new package has been written and verified.
9. **Save As produces a complete package.** Required semantic data, project preferences and owned assets must be usable without the old package.
10. **Machine/runtime state does not hitchhike.** A copied project must not depend on the old computer's model root, default project root, worktree, cwd, provider job state or old absolute project path.
11. **Durability is explicit.** Adding a field to runtime `workspace` must not automatically make it durable.
12. **Concurrent durability requests are not lost.** A newer canonical mutation cannot be cleared or overwritten by an older in-flight save.
13. **Project transitions are save barriers.** Switching/opening another project must not abandon dirty revisions belonging to the previous project.

## Package authority

Desktop's target form is a folder-backed package:

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
  revisions/        # when file-backed revision sidecars exist
  cache/            # regenerable package-local cache only
```

`project.json` may contain semantic data and a clearly separated `projectPreferences` section. The exact layout may evolve through migrations; ownership and containment rules do not.

## Recovery/cache semantics

Browser/local project cache may preserve work before a package destination exists or after a recoverable file-write failure. That is useful recovery behaviour, but it is **not** project package authority.

Therefore:

- cache-only preservation must be reported as cache/recovery, not external-file success;
- a cache may not provide a filesystem root for project-owned binary assets;
- file-backed asset creation without an active package root must require Save As/migration or fail explicitly;
- explicit file load must replace/ignore stale project caches rather than merging unrelated manuscript bodies, goals, revisions or metadata into the loaded file.

## Explicit portable-project serializer

Converge away from cloning the whole live workspace as the persisted DTO.

The durable serializer should deliberately include:

```text
semantic project model
project-scoped preferences
project-relative asset references
```

and deliberately exclude:

```text
application/machine paths
provider/runtime job machinery
transient selection/hover/drag/session state
worktree/cwd-derived values
active absolute package location
```

This allowlist is a future-feature guardrail: runtime state does not gain durability just because a new field was added under `workspace`.

## Structured mutation rule

A durable feature mutation must:

1. classify itself as semantic project data or project-scoped preference;
2. update canonical domain/runtime state through the owning service;
3. enter the canonical project mutation boundary with a named domain, reason and source;
4. be deliberately included by the persisted project serializer;
5. have normalization/migration when schema changes;
6. have save -> reload round-trip coverage.

Do not add feature-specific localStorage keys, direct filesystem writes or ad hoc sidecar roots as substitutes for canonical persistence.

## Project-owned asset protocol

When creating/replacing an asset:

1. require a confirmed active package root;
2. allocate a normalized project-relative destination through the project asset boundary;
3. resolve and verify containment beneath the active package root at the host boundary;
4. write the new bytes, preferably with temporary/atomic replacement where appropriate;
5. verify the write where practical;
6. update canonical project state with the project-relative reference;
7. durably save that reference;
8. only after the reference is durable, remove or queue cleanup of a superseded asset.

If project-state persistence fails after new bytes were written, treat the new file as an orphan candidate; do not destroy the previous valid referenced asset.

### Delete ordering

Prefer:

1. remove the reference from canonical project state;
2. durably save the new state;
3. delete/garbage-collect the now-unreferenced managed file.

## Save and autosave concurrency

The World Spine branch demonstrated a real failure where explicit flush requests arrived during an in-flight save. The persistence coordinator must own serialization/coalescing.

For save N:

1. capture the project identity, active destination identity/generation and save revision;
2. allow save N to write its captured snapshot;
3. retain later mutations as dirty;
4. retain any explicit durability request made while save N is busy;
5. after save N succeeds, immediately persist the accumulated newer canonical state when required;
6. clear dirty state only for the exact project/destination generation and revision actually made durable.

A revision number alone is not sufficient if project switches/reset can reuse revision values.

### Project-transition drain

A project open/switch/replace operation that promises to preserve the active project must wait until the old project's required durability work has either:

- completed successfully through the required revision; or
- failed explicitly and the transition policy has reported/handled that failure.

Calling `flush()` while a save is busy and receiving an immediate return is not a sufficient preservation barrier if a follow-up write is still pending.

Stale completions from Project A must never clear dirty state, change destination, or schedule writes for Project B.

## Save As semantics

Save As creates a complete new package and changes active authority only **after** the new package has been written and verified.

A correct Save As sequence is conceptually:

```text
old active root stays authoritative
  -> build snapshot
  -> create/write Project B package
  -> materialize referenced owned assets into B
  -> verify B
  -> atomically adopt B as active authority
```

If Save As fails, the previous active project destination remains authoritative. A browser/cache fallback may preserve data, but it must not pretend the failed new filesystem target became active.

Save As tests must prove Project B still works after Project A is unavailable.

## Relocation portability

Independently of Save As:

1. save a complete package at Root A;
2. close it;
3. move/copy the complete package to Root B;
4. reopen B;
5. semantic data and project preferences survive;
6. all owned files resolve beneath B;
7. no required reference depends on A.

## Project-bound path validation

Expose one reusable project-relative validator/resolver for scenes, metadata, revisions, transcripts and assets.

At minimum it must:

- normalize separators;
- reject `..` traversal and empty/invalid segments;
- reject absolute/drive/UNC input when a relative path is required;
- require a genuinely absolute desktop package root (a slash-containing relative string is not enough);
- resolve against that root;
- verify the result remains beneath the root with platform-safe comparison;
- apply equivalent checks to write, read, serve and delete.

Do not infer whether a host path is a file or package root solely from a `.json` suffix. The storage context must carry that semantic explicitly.

## Current known migration debt

### World Spine / Worldbuilding

World Spine spines, nodes, locations/sublocations, implication edges, entities, links, catalogue/model structures and scene-linked metadata are semantic project data and already broadly enter canonical persistence.

World Spine layout/filter/right-pane state may remain project-scoped preference data for now.

Worldbuilding image planning contains useful project-relative path concepts but is **not yet authoritative storage**:

- records can retain runtime/absolute `mediaPath` alongside `projectRelativePath`;
- when no package root resolves, the planner can fall back to cwd-relative `project-media/...`;
- it may use a default `workspace.settings.projectRoot` fallback that is not necessarily the active package;
- it infers package roots from `.json` path spelling, which can disagree with the desktop package writer's actual returned directory.

The project-relative reference should become authoritative and all physical resolution should use an explicit active package context.

### Manuscript / metadata

Tasks, passage notes, inspiration, research, metadata folders/notes, draft proofing, revisions, writing goals/history and project dictionary are semantic project data.

Custom metadata definitions/model classes are semantic project schema. Do not leave them conceptually classified as generic `app-settings`.

### Narration

Durable recording metadata belongs to the project. Recording bytes are project-owned assets. Current cwd-relative `project-media/<project>/...` narration paths must move to package-relative `assets/audio/...`.

### Machine/host state

`modelRoot`, `assetRoot`, default project root, provider configuration, worktree paths and active absolute `projectFilePath` stay outside portable project data. Desktop app settings should eventually move from the source tree to OS/application-data storage.

### Desktop package writer

Current scene-file mappings can reuse stored relative scene paths and resolve them against the project root without the same strict containment guard used by safer metadata paths. Stored sidecar paths must be treated as untrusted.

Current new-path/folder semantics also depend on whether a `.json` target already exists, so package naming/type needs to become deterministic.

### Explicit project source load

User-directed invalid/missing project load currently can fall back to bundled Serva Vitae data. Explicit Open Project must load the selected project or fail visibly; demo/bootstrap fallback belongs to a separate startup/demo path.

## New feature checklist

Before implementing durable author-facing state, answer:

1. Who owns it: semantic project, project preference, app/machine, session/recovery, cache, developer/test?
2. Must it travel with a copied project?
3. Structured state or file asset?
4. What is its canonical project-relative reference if file-backed?
5. Which persistence domain owns it?
6. What does Save do?
7. What does autosave do under overlapping writes?
8. What happens during project switch while a write is active?
9. What does Save As do, including asset copying?
10. Can the package relocate without rewriting references?
11. What is the safe replace/delete order?
12. What migration is required?
13. Which nearby runtime/machine fields are explicitly excluded?
14. What round-trip/containment/concurrency tests prove it?

A feature is not persistence-complete merely because its UI survives in memory or a filesystem call succeeded.
