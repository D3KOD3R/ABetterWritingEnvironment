# Persistence Package Lazy Hydration Refactor

## Status

Parked design/refactor branch for later Codex/Astra review and implementation.

Branch: `refactor/persistence-package-lazy-hydration`

Base branch at creation: `feature/persistence-portability-harness`

Base SHA at creation: `0e5ad0ed8bbf53493d0295f466c913c4e6387363`

Do not implement this refactor until the current persistence acceptance work is complete. Before resuming, rebase this branch onto the then-current `feature/persistence-portability-harness` and rerun the persistence regression suite.

## Why this exists

ABE intentionally moved from a monolithic project JSON model toward a folder-package model with a lightweight project manifest/index and separate scene/body sidecars. The architecture is meant to support large projects without requiring every manuscript body, media file, metadata sidecar, narration artefact, or revision record to be parsed and held in memory at project-open time.

The desired authority model is:

- package on disk = durable source of truth;
- `project.json` / project index = lightweight global structure and non-body metadata;
- scene sidecars = durable manuscript body authority;
- runtime/browser scene cache = disposable performance cache;
- media and other large project-owned artefacts = independently addressable package files;
- `ProjectPersistenceService` remains the canonical save/load/transition boundary.

The product should be able to show binder structure, scene order, titles, synopses, chapter/scene counts, word totals, World Spine placement metadata, project settings, and other global projections without eagerly deserializing every scene body.

## Current architecture finding

The browser/editor repository already performs lazy runtime hydration correctly in an important sense. `hydrateProjectRecord()` retains only the active scene body in `record.sceneDrafts`, while `projectIndex` and the metadata-only scene store provide complete non-body scene information to global projections.

However, the desktop package loader currently performs an eager scene read before that browser-side lazy hydration occurs.

Current package-open flow is effectively:

1. `/api/project-package/load` calls `readProjectPackage(rootPath, { strictPackage: true })`.
2. `readProjectPackage()` resolves the package manifest.
3. `readProjectPackageFromManifest()` calls `readSceneStoreFromManifest()`.
4. `readSceneStoreFromManifest()` iterates every scene in manifest order, reads every scene sidecar with `readFile(..., "utf8")`, parses it, and builds a complete `sceneStore`.
5. The complete snapshot is then returned to the editor.
6. The editor repository keeps only the active scene body hydrated.

Therefore the present architecture is best described as:

**chunked package storage + lazy browser/runtime hydration after an eager desktop/API package read**

It is not yet true disk/API-level lazy scene loading.

This is not a data-integrity failure. It is a scalability/performance architecture gap that should be addressed inside the persistence work before ABE relies on the package design for very large projects.

## Engineering target

Cold package open should approximately become:

1. validate/open package root;
2. read and normalize `project.json` and required lightweight sidecar indexes;
3. validate package structure/path safety without deserializing every manuscript body;
4. return project/index metadata plus only the active scene body (or no scene body until requested, if the runtime contract is cleaner);
5. when the author selects an unloaded scene, request that scene by project ID + scene ID;
6. read/parse that scene sidecar only;
7. hydrate it into runtime state;
8. optionally retain recently used scene bodies in a bounded in-memory/browser cache;
9. never treat that cache as durable authority.

A scene click should therefore be capable of causing a targeted disk read for that scene when it is not already hydrated.

## Important design constraints

### 1. Preserve package authority

The package remains the durable source of truth. Browser storage must remain disposable recovery/performance state and must not become the backing database for lazy loading.

### 2. Preserve the persistence boundary

Do not create feature-owned file reads/writes. Scene-on-demand reads and any changed-scene writes must remain behind the persistence/storage service layers.

### 3. Keep global projections body-light

Binder, project metrics, World Spine placement, writing totals, scene titles/synopses, and similar global views should use manifest/index metadata rather than forcing scene-body hydration.

If a feature genuinely requires body text across many scenes, it should use an explicit query/index/background-analysis path instead of silently hydrating the whole manuscript into normal UI state.

### 4. Preserve transactional package semantics

The existing New/Open/Save As and staged-save safety guarantees must not be weakened. Atomic generation publication, semantic verification, failure rollback, symlink/junction protections, and durable authority switching remain requirements.

### 5. Separate integrity validation from eager hydration

Strict package opening currently gains some integrity checking by reading/parsing every sidecar. A lazy refactor must replace that intentionally rather than accidentally losing validation.

Codex/Astra should determine the best contract after inspecting the live implementation. Options may include:

- validating manifest-declared paths, containment, file type, and existence without reading full bodies;
- storing/checking sidecar size/hash metadata in the manifest;
- targeted parse validation when a scene is first hydrated;
- an explicit background/full-package integrity scan that does not block normal project opening.

Do not choose one of these blindly; inspect the current generation/verification contract first.

### 6. Avoid unbounded runtime retention

Lazy loading loses much of its value if every opened scene remains in RAM forever. Review current runtime retention behavior. If needed, introduce a bounded recent-scene cache or another clear eviction policy, while ensuring dirty scenes cannot be evicted before their changes are durably represented.

### 7. No data-loss trade-off for speed

A performance improvement is unacceptable if it can cause:

- manuscript bodies to disappear during metadata-only saves;
- stale cached bodies to override package data;
- unsaved dirty scene eviction;
- scene ordering/index mismatch;
- incorrect manuscript totals;
- World Spine/global metadata loss;
- Save As copies that omit unloaded project-owned content.

## Initial Codex/Astra audit job

When this branch is resumed, the first task should be architecture review and evidence gathering before implementation.

Inspect at minimum:

- `apps/desktop/src/http-app.ts`
  - `readSceneStoreFromManifest`
  - `readProjectPackageFromManifest`
  - `readProjectPackage`
  - package load/save/stage/commit routes
- `apps/editor/public/adapters/storage/project-repository.js`
  - `hydrateProjectRecord`
  - `loadProjectLibrarySnapshot`
  - `loadScene`
  - scene cache/storage-key behavior
- `apps/editor/public/adapters/storage/project-persistence-service.js`
  - package activation
  - snapshot hydration
  - changed-scene save assembly
  - autosave and dirty-state interaction
- `apps/editor/public/adapters/storage/project-index.js`
- `apps/editor/public/adapters/storage/project-service.js`
- scene selection/hydration call paths in the app/editor model
- existing package portability, physical-package, project-service-storage, persistence-service, project-record-state, metrics, World Spine, and writing-goal tests.

Answer these questions with source evidence:

1. Exactly how many scene sidecars are read from disk during a cold package open?
2. Exactly how many scene bodies are transmitted in the package-open HTTP response?
3. Which scene bodies remain resident in editor runtime state after activation?
4. When the author clicks a non-hydrated scene today, where does its body come from?
5. Does the browser cache currently contain all scene bodies because desktop open eagerly supplied them, even though `sceneDrafts` exposes only the active body?
6. Which global features still depend on body-bearing `sceneStore` records and must be migrated to index metadata before true lazy reads are safe?
7. Which save paths require unopened scene bodies to construct a complete portable/staged package snapshot?
8. Can existing package sidecars be copied/retained during Save/Save As without first loading every scene into memory?
9. What integrity checks currently depend on eager parsing, and what is the safe replacement?
10. Is a bounded runtime scene cache required, and what dirty-scene eviction rule should apply?

Do not begin broad implementation until the above call graph and invariants are documented.

## Likely implementation shape to evaluate

This is a design direction, not a prescribed patch.

A likely clean boundary is:

- package-open endpoint returns manifest/index/project metadata and active-scene identity;
- a focused scene-read endpoint/service loads a requested sidecar by validated project/scene identity;
- activation requests the active scene;
- scene selection requests a body only when absent from the runtime cache;
- runtime/index state merges the body into the existing metadata-only scene record;
- changed scenes persist through the normal canonical persistence boundary;
- untouched sidecars remain untouched/copied by the host package layer rather than being unnecessarily round-tripped through browser JSON;
- Save As copies managed package files and rewrites only data that must change, while retaining existing transactional verification.

Codex/Astra may select a different design if live repo evidence shows a safer or simpler boundary.

## Regression/acceptance evidence required

Add instrumentation or focused tests that can prove lazy behavior directly. Do not infer it merely from browser UI state.

Minimum evidence should cover all three layers:

### Disk I/O

For a package with many scenes:

- cold open does not read every scene body;
- active scene body is read when required;
- selecting a previously unopened scene causes a targeted read for that scene;
- untouched scenes remain unread until required by a deliberate operation.

### Desktop/API transfer

- package-open response does not contain every manuscript body;
- scene-body requests are targeted;
- malformed/missing requested sidecars fail explicitly without silently substituting stale cache data.

### Runtime/browser hydration

- binder/index shows the complete project while only required bodies are hydrated;
- moving to a distant scene loads correct text;
- returning to a cached scene is fast and correct;
- cache replacement cannot merge stale bodies from another project;
- restart again starts from package authority, not browser authority.

## Real-project acceptance scenario

Use a disposable migrated copy of Serva Vitae or an equivalent realistic project, never the checked source fixture.

Acceptance should prove:

- all expected scenes/chapters are visible from the index;
- total word/chapter/scene metrics remain correct before bodies are hydrated;
- only the active scene is required at initial render;
- jumping to distant scenes loads the correct sidecar on demand;
- distinctive edits in multiple scenes autosave and survive restart;
- metadata-only changes do not erase unopened manuscript bodies;
- World Spine placement and other indexed non-body metadata survive reload;
- Save As preserves all managed project-owned sidecars, including those never opened during the session;
- package reopen remains fast as scene count grows;
- no repo/source fixture is mutated.

## Suggested scale tests

Do not rely only on the current ~30-scene fixture. Add generated disposable packages large enough to expose accidental O(N body-size) open behavior, for example:

- 30 scenes;
- 300 scenes;
- 1,000 scenes with synthetic bodies.

Record at least:

- scene files read during cold open;
- bytes read/transferred during open;
- open-to-first-render time;
- body count resident after activation;
- incremental cost of selecting one unloaded scene.

Tests should prefer deterministic read counters over fragile wall-clock thresholds. Performance timing can remain supplemental evidence.

## Non-goals for this parked branch

Until explicitly resumed, do not:

- merge this branch back into the persistence baseline;
- change current user-visible package behavior;
- remove legacy JSON migration/import support;
- perform the Serva Vitae migration acceptance campaign;
- redesign unrelated editor features;
- weaken package validation to obtain faster open times;
- move persistence responsibility out of `ProjectPersistenceService`/host storage boundaries.

## Branch workflow when resumed

1. Fetch origin.
2. Confirm `feature/persistence-portability-harness` is the current accepted persistence baseline.
3. Rebase `refactor/persistence-package-lazy-hydration` onto that current baseline if it has moved.
4. Ensure a clean worktree.
5. Run the existing persistence/package regression suite before modifications.
6. Perform the architecture audit above.
7. Record the chosen design and affected contracts.
8. Implement in bounded slices with focused tests.
9. Run package/persistence regression escalation.
10. Perform real-project manual acceptance.
11. Only then integrate the completed refactor back into `feature/persistence-portability-harness` and smoke-test that branch again.

## Current conclusion

The package split itself is the correct direction and the browser repository already demonstrates the intended lazy-hydration model. The remaining issue is that the host package-open path currently reconstructs the complete scene store by reading every scene sidecar before the editor applies its lazy runtime projection.

The purpose of this branch is to review and, when resumed, close that gap without sacrificing the persistence safety work already established.