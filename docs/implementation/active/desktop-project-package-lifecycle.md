# Desktop Project Package Lifecycle

Status: Active implementation contract
Date: 2026-09-03
Branch: `feature/persistence-portability-harness`
Starting commit: `c881e12d81cb2e51ea19859c326627a0a20599e7`

## Execution contract

### Goal

Replace the normal desktop single-JSON/path-typing workflow with a transactional folder-package lifecycle for New Project, Open Project, Save, and Save As. A package must be written, reloaded, and semantically verified before it becomes the active storage authority.

### Initial bounded reads

Read only:

- `AGENTS.md`;
- `agents/PersistenceAgent.md`;
- `agents/DesktopAgent.md`;
- `agents/EditorAgent.md`;
- `agents/FeatureWorkAgent.md`;
- `docs/architecture/project-storage-contract.md`;
- the relevant numbered project-management section and implementation-index entry in `features.md`;
- the named symbols and focused tests in this contract.

Do not broadly read `apps/editor/public/app.js`, archived implementation specs, real Serva Vitae data, `SaveTestFile`, logs, or old narration takes.

### Required outcome

```text
New Project
  -> choose name + parent folder
  -> construct candidate without activation
  -> create/scaffold package
  -> write project
  -> reload and semantically verify package
  -> only then activate it

Open Project
  -> select existing package folder
  -> validate/read it
  -> preserve/drain current project
  -> only then activate loaded project

Save
  -> write established active authority

Save As
  -> A remains authoritative
  -> choose destination B
  -> copy supported owned files A -> B
  -> write current structured state into B
  -> read and verify B
  -> only then adopt B
```

The normal desktop author workflow must not require manual filesystem-path editing. Keep legacy JSON/browser-handle support operational as compatibility behavior.

### Explicit non-goals

Do not implement:

- a full portable serializer allowlist;
- Worldbuilding-image record migration;
- OS app-data migration for `.desktop-state.json`;
- public API architecture or a broad localhost/CORS redesign;
- Local AI/provider changes;
- real Serva Vitae migration;
- broad project-ID/schema redesign;
- destination-generation concurrency beyond the bounded drain;
- native Tauri/Electron integration;
- new dependencies.

Do not modify main, the original dirty worktree, or the manual `PortabilitySmokeTest` evidence package. Use OS-temp directories for filesystem tests.

## Ownership and durable-state classification

- Project title, canonical ID, manuscript, World Spine state, tasks, notes, metadata, and project-scoped preferences are semantic/project-owned structured state.
- `assets/`, `transcripts/`, and `revisions/` are explicitly managed project-owned file trees.
- The active absolute package root and dialog state are runtime/machine state. They must not enter an external portable package snapshot.
- `ProjectPersistenceService` owns lifecycle ordering and authority adoption.
- The desktop host owns absolute-path validation, containment, scaffolding, copying, and filesystem mutations.
- `project-package.js` owns only same-origin desktop transport wrappers.
- `project-package-dialog.js` owns pure runtime dialog state/render helpers.
- `app.js` performs minimal event/state orchestration only.

## Editor workflow

### File menu

Render:

```text
Project location: <read-only package root>

New Project...
Open Project...
Save
Save As...
Port Scrivener...
```

Remove normal UI use of `data-edit-field="project-file-path"` and dead path-input autofocus/edit handling. Keep recent projects unless focused coverage proves a conflict.

### Package dialog

Add `apps/editor/public/features/project-lifecycle/project-package-dialog.js` with pure helpers for:

- New, Open, and Save As modes;
- project name, independently editable folder name, and selected location;
- folder navigation to parent/children;
- direct absolute-path entry as an advanced navigation fallback;
- open eligibility only when the host identifies a directory as a package;
- cancel, Escape, busy state, and host errors.

Folder names initially derive from project titles but do not become project identity or silently rename the semantic title.

## Lifecycle ordering

### New Project

1. Open the dialog without mutating active project state.
2. On confirmation, preserve/drain the current project.
3. Build a blank candidate through `createBlankWorkspaceSnapshot(...)` and `createProjectLibraryRecordFromWorkspace(...)` without activating it.
4. Build an external candidate snapshot without changing current authority.
5. Ask the host to create the exact new package root, scaffold it, and write the snapshot.
6. Reload that package without activation.
7. Semantically verify expected versus loaded package.
8. Hydrate/activate the candidate, adopt the host-returned root, prime autosave, and persist the last-opened pointer.

Cancellation or any pre-adoption failure leaves the old project, destination, autosave target, and narration/media authority unchanged. A successful new desktop project begins with a valid package and never normally enters `Waiting for path`.

### Open Project

1. Select a host-validated package folder.
2. Read it without activation.
3. Drain the current project's required durability work.
4. Hydrate the loaded snapshot.
5. Adopt the exact returned root and prime autosave.

Invalid packages fail visibly and leave the current project untouched. Folder-backed loads preserve the stored canonical project ID; folder basenames do not remap identity. Filename-derived compatibility behavior may remain for legacy single-file loads.

### Save

Write the established active package authority. If a compatibility/cache-only project has no durable destination, initiate Save As rather than asking the author to type a path.

### Save As

1. Capture source authority A.
2. Preserve/drain current durability work.
3. Build current structured state and sanitize it for external persistence.
4. Ask the host to create destination B, copy managed owned files, scaffold, and write current structured state.
5. Load B without activation.
6. Semantically verify B.
7. Only after verification, adopt B, update runtime/cache location, and prime autosave.

Failure before adoption keeps `state.projectFilePath`, narration authority, autosave target, and subsequent normal Save on A. Save As preserves the project ID.

## Portable external snapshot boundary

Do not globally strip runtime path knowledge from browser recovery/cache state. Only external package snapshots must omit:

- `project.projectFilePath`;
- `project.projectSettings.projectFilePath`.

Project B's `project.json` must contain no absolute Project A package path.

## Semantic package verification

Add `apps/editor/public/adapters/storage/project-snapshot-verification.js` with focused exports such as:

```js
buildProjectSemanticVerificationSnapshot(...)
assertProjectSnapshotsSemanticallyEquivalent(...)
```

Compare schema version, active project ID, project ID/title, semantic project fields, project preferences, tasks, passage notes, metadata, World/project semantic state, scene order, and scene/block content reconstructed through `sceneStore`.

Normalize only storage-shape/runtime differences:

- `projectStorage`;
- empty manifest `sceneDrafts`;
- manifest `workspace.project.lines` bodies stripped because scene sidecars own them;
- active absolute `projectFilePath`.

Do not normalize genuine semantic mismatches. Missing sidecars/scenes, changed manuscript bodies, wrong active/project IDs, and missing representative tasks/notes/settings must fail. Legacy browser-handle JSON may retain strict direct equality.

## Autosave transition barrier

Preserve the existing `immediateFlushPending` accumulated-save behavior. Track the active durability-cycle promise and expose `drain()` (or equivalent) so a transition does not complete until the current write and any required immediate follow-up write settle.

Avoid a public `flush()` awaiting itself while busy; use an internal loop/cycle if necessary. `preserveActiveProjectBeforeLoad()` must use this barrier. Destination-generation architecture is out of scope unless a focused lifecycle regression proves it necessary.

## Desktop path and package rules

### Absolute desktop roots

Recognize:

```text
C:\Projects\Novel
C:/Projects/Novel
\\server\share\Novel
/home/user/Novel
```

Reject:

```text
project/folder
../project
Novel.abe-project.json
```

Keep browser file-handle identity separate. Do not introduce browser-side `path.resolve()` or cwd semantics.

### Explicit-root writer

Extract `writeProjectPackageAtRoot(projectRoot, snapshot)` from the existing writer. Keep `writeProjectPackage()` and `resolveWritableProjectRoot()` as legacy compatibility wrappers; new lifecycle operations must use validated explicit directory semantics and never inherit `.json`/sibling inference.

Reuse the existing scaffold for manuscript, metadata, `assets/audio`, `assets/images`, transcripts, and cache.

### Same-origin host routes

Add editor transport wrappers and internal desktop endpoints:

#### `POST /api/project-package/browse`

Input: optional absolute directory `path`. With no path, prefer a valid absolute `settings.projectRoot`, then the user home directory—never cwd. Return the exact location, parent, package status, and child directories only.

#### `POST /api/project-package/create`

Input: `parentPath`, `folderName`, `snapshot`.

- Parent must be an existing absolute directory.
- Sanitize invalid filename characters while preserving useful case/spaces; reject separators.
- Destination must not exist.
- Create the root atomically with non-recursive root creation.
- If a later write fails, recursive cleanup is permitted only for the exact root created by this operation.
- Return the exact host-generated root.

#### `POST /api/project-package/load`

Input: `rootPath`. Require an absolute readable directory containing `project.json`; return the exact root and snapshot without bundled/demo fallback.

#### `POST /api/project-package/save-as`

Input: `sourceRoot`, `destinationParentPath`, `folderName`, `snapshot`.

Destination must not exist and must be neither equal to nor nested inside source. A valid folder-backed source copies only this ownership allowlist when present:

```text
assets/
transcripts/
revisions/
```

Copy regular files/directories recursively, preserve relative locations, reject symlinks, and maintain destination containment. Do not copy `project.json`, `manuscript/`, `metadata/`, or `cache/`; regenerate structured state from the canonical snapshot. Cache-only/legacy sources may Save As without source assets.

Do not add wildcard CORS headers to browse, create, or Save As responses.

## Expected production changes

- `apps/editor/public/app.js` — minimal dialog actions, candidate construction, and lifecycle calls.
- `apps/editor/public/shell/editor-chrome.js` — read-only location and New/Open/Save/Save As/Port actions.
- `apps/editor/public/adapters/storage/project-persistence-service.js` — transactional lifecycle and external snapshot boundary.
- `apps/editor/public/adapters/storage/autosave.js` — bounded active-cycle tracking and `drain()`.
- `apps/editor/public/shared/project-file-path.js` — genuine absolute desktop-root recognition.
- `apps/editor/public/adapters/storage/project-file-display.js` — package-oriented wording if needed.
- `apps/desktop/src/http-app.ts` — explicit writer plus internal package routes.
- `apps/editor/public/styles.css` — dialog styling.
- `apps/editor/public/adapters/storage/project-package.js` — desktop transport wrappers.
- `apps/editor/public/adapters/storage/project-snapshot-verification.js` — semantic projection/assertion.
- `apps/editor/public/features/project-lifecycle/project-package-dialog.js` — pure dialog helpers.

Do not change narration production services, Worldbuilding storage implementation, repository-supervisor code, domain schemas, agent files, or main.

## Focused verification

Add registered `test/project-package-lifecycle.test.mjs` using a parent/self-spawn child, OS-temp roots, external temp logs, sentinel cwd, dynamic desktop import after environment setup, and bounded artifact snapshots.

The physical child must prove:

```text
create A
-> scaffold and persist semantic manuscript/note/task state
-> reload
-> save deterministic narration bytes through project-media
-> Save As B
-> verify B
-> make A unavailable
-> reopen B
-> verify semantics and narration bytes
-> verify B contains no A absolute path
-> verify no cwd/worktree artifact
```

Add focused failures for missing sidecars/scenes, changed manuscript text, wrong active/project ID, and missing representative semantic state. Add lifecycle-service ordering tests for create cancellation/write/verification failures, Save As write/verification failures, success adoption only after verification, and post-failure normal Save still targeting A.

Extend autosave coverage so `drain()` waits through accumulated save 2. Extend path coverage for Windows drive, UNC, POSIX, relative, traversal, and filename-only inputs. Update editor-chrome coverage for the new menu and absence of editable project path. Assert sensitive browse/create/Save As responses do not advertise wildcard CORS.

Run the supervisor affected route first, then explicitly run:

- `project-package-lifecycle`;
- `project-persistence-portability`;
- `project-persistence-service`;
- `project-file-storage-adapters`;
- `project-service-storage`;
- `project-record-state`;
- `runtime-portability-guardrails`;
- `editor-chrome`;
- `world-spine-panel`;
- `worldbuilding-studio`;
- `narration-take-service`;
- `narration-recording-finalization-service`;
- `narration-media-service`.

Run broader/full verification when routing requires it. The only accepted clean-baseline failures are:

```text
desktop-application: 4 !== 5
project-source:       4 !== 5
```

Any additional failure or changed signature is a regression. Run `git diff --check` before commit.

## Completion gates

- New Project chooses name/location before mutation, creates and verifies a package before activation, and never manufactures a normal `.abe-project.json` destination.
- File-menu project location is read-only.
- Open validates a folder package and leaves current state untouched on failure.
- Save writes established authority or invokes Save As when none exists.
- Save As keeps A authoritative until B passes semantic verification; failure leaves all later storage/media on A.
- Save As copies only managed owned trees; B remains usable after A is unavailable.
- Project ID survives Save As and folder-backed reopen.
- External `project.json` contains no old absolute root.
- Corrupt or missing scene content fails semantic verification.
- Autosave drain waits through an accumulated follow-up save.
- Narration remains `assets/audio/...` and its bytes load from B after A is unavailable.
- No cwd, repository, or default-library fallback is introduced.
- World Spine and overlapping-autosave regressions remain green.
- No generated project/media artifacts appear in the worktree.
- The feature branch is committed, pushed without force, and ends Git-clean.

Leave this directive active until manual physical verification is complete. Do not begin Worldbuilding-image migration in this slice.
