# Persistence Portability Harness

## Purpose

This branch exists to establish a deterministic persistence-portability harness before changing project storage architecture. The harness must prove that project save/load/autosave/media workflows can operate against an explicitly selected project root outside the repository without making the process working directory or Git worktree an implicit storage root.

The first implementation slice is the **red baseline harness**. Do not begin with a broad persistence refactor and do not move the real Serva Vitae project as part of the first harness commit.

## Codex start sequence

1. Confirm this worktree is on `feature/persistence-portability-harness` and has no local working-tree changes with `npm --silent run repo -- status --base main --json` and `git status --short`.
2. Read `AGENTS.md` and this document. Read `agents/PersistenceAgent.md` because the harness establishes persistence behaviour. Read `agents/DesktopAgent.md` only if `apps/desktop` production code is modified, and `agents/AudioVoiceAgent.md` only if narration/audio production code is modified.
3. Do not read `agents/TestSupervisorAgent.md` unless supervisor routing, test groups, registration, or verification policy must change. A new root-level `test/*.test.mjs` file is auto-discovered by `test/test-registry.mjs`.
4. Do not broadly read the large repo-root Serva Vitae snapshots, `SaveTestFile`, logs, or project data. They are legacy baseline material, not default harness context.
5. Use the supervisor handoff/compact report as the normal verification authority.

## What the current architecture already proves

Do not duplicate coverage that already exists:

- `apps/desktop/src/http-app.ts` already writes folder-backed project packages to an explicit path and scaffolds manuscript, metadata, `assets/audio`, `assets/images`, transcripts, and cache directories under the package root.
- `test/desktop-application.test.mjs` already proves package save/load in an OS temp directory and proves `/api/project-media/*` can read/write/delete media when the caller supplies a correct **absolute** temp path.
- `test/project-service-storage.test.mjs`, `test/project-persistence-service.test.mjs`, and `test/project-file-storage-adapters.test.mjs` already cover substantial lower-level snapshot, cache, destination, permission, and autosave semantics.
- `test/runtime-portability-guardrails.test.mjs` is a static architectural guard for browser APIs; it does not establish filesystem ownership.

The missing contract is end-to-end **path ownership**: a normal project-owned path producer must not hand the desktop host a cwd-relative destination when an external project is active.

## Pre-investigation findings: do not rediscover these unless code has changed

The following call-chain work has already been traced from current `main` and should be treated as starting evidence for the harness.

### Existing durable project root is already available after desktop save

The desktop package writer returns the resolved folder-backed `projectRoot` from `/api/project-file/save`. `writeProjectLibraryToDesktopPath(...)` passes that returned path back to `ProjectPersistenceService`. `saveProjectSnapshotToFilePath(...)` then calls `setActiveProjectFileDestination(savedPath, ...)`, which assigns the returned package root to `state.projectFilePath` and persists it as the durable destination.

Therefore, for the first media-routing fix, do **not** assume a completely new project-root concept is required. The current runtime already has a durable active package destination after desktop save/load. A later architectural cleanup may rename or wrap this as an explicit storage context, but the baseline harness should first prove how the existing destination is or is not being consumed.

### Exact narration leak chain

Current normal narration finalization is wired as follows:

`createNarrationRecordingRuntime / buildNarrationRecordingFinalizationContext`
→ `buildVoiceRecordingMediaPath(...)`
→ relative `project-media/<project>/<take>.<ext>`
→ `createNarrationRecordingFinalizationService(...).finalizeRuntime(...)`
→ `narrationMediaService.saveMediaBlob(...)`
→ `/api/project-media/save`
→ desktop `writeBinaryFile(filePath, content)`
→ `resolvePath(filePath)`
→ relative path resolves beneath `process.cwd()`.

`app.js` wires the real production chain by passing `narrationMediaService.saveMediaBlob` into `createNarrationRecordingFinalizationService`, while only passing a project ID (`getProjectId`) to the finalization side. No active package root is currently supplied to the narration path producer.

This means the harness does **not** need a microphone, MediaRecorder device, browser UI, ASR, or the full editor shell to prove the defect. The narrowest production-real scenario is enough:

1. obtain a narration runtime/finalization path from the real narration path-producing code;
2. instantiate the real narration media service;
3. bridge its fetch call to the real desktop `createDesktopResponseForRequest(...)` route;
4. finalize a deterministic fake Blob/chunk;
5. observe the resolved file under the child process `runtimeCwd`.

Do not manually inject `project-media/...` if the real take/runtime builder can produce it; the test should prove the actual producer contract.

### Worldbuilding images are a positive control and an implementation pattern

Narration is not the only feature using `/api/project-media/save`, but Worldbuilding image storage already follows the desired ownership model much more closely.

`app.js` calls `buildWorldbuildingCatalogueImageMediaPath(...)` with `state.projectFilePath` (and the workspace project root fallback). That planner creates a project-relative path under `assets/images/worldbuilding/...` and resolves it against the active project/package root when one is available. Existing `worldbuilding-studio` tests assert rooted image-media paths.

Use this as:

- a **positive control** showing that project-root-aware media planning already exists in the codebase;
- a likely model for a future shared project-owned asset resolver;
- evidence that the first narration fix should probably reuse/centralize an existing concept rather than invent an unrelated second storage policy.

Do **not** refactor Worldbuilding during the red-baseline slice merely for stylistic consistency.

### Minimal synthetic package snapshot is supported

The desktop package writer is intentionally tolerant: it normalizes a snapshot into `{ schemaVersion, activeProjectId, projects, sceneStore }`, scaffolds the package directories, derives scene chunks from `sceneDrafts`/workspace lines when present, writes `project.json`, and returns the package root. A large real manuscript fixture is not required for the harness.

Use a one-project, one-scene synthetic snapshot with a small deterministic mutation. Keep the payload small enough that failure output never needs to dump full snapshots.

### Desktop settings are a separate follow-up debt

`apps/desktop/src/settings.ts` currently stores application/user settings at `apps/desktop/.desktop-state.json`, relative to the source module location, not the selected project. That is worktree runtime state and should eventually move to an application/user-data location. However, it is separate from the first narration/project-media ownership defect.

The first harness scenario should avoid calling settings mutation routes unless needed. It should still include `.desktop-state.json` in the bounded worktree-delta guard so an unexpected mutation is visible.

## Known baseline risks to expose, not patch first

Treat these as hypotheses for the harness to prove with focused evidence:

- `apps/editor/public/features/narration/narration-take-service.js` currently builds recording paths like `project-media/<project>/<take>.<ext>` with no active-project root.
- `/api/project-media/*` accepts supplied filesystem paths. The desktop host resolves a relative path against `process.cwd()`, so a normal relative narration path can become `<runtime cwd>/project-media/...`.
- desktop logging also captures cwd/environment-derived destinations at module import time unless `ABE_LOG_PATH` and `ABE_DEVELOPER_RUNTIME_LOG_DIR` are set first.
- `apps/desktop/src/settings.ts` stores user/application settings in ignored `apps/desktop/.desktop-state.json`. This is a separate worktree-runtime ownership debt; record it as follow-up evidence, but do not conflate it with the first project-owned media containment failure.
- `apps/desktop/src/workspace.ts` still bootstraps from a repo-root Serva Vitae snapshot, and `apps/desktop/src/project-source.ts` can fall back to bundled Serva Vitae data after many explicit-load failures. These are later migration/correctness slices, not reasons to broaden the first test.

## Process isolation requirement

The repository test runner executes tests sequentially in one Node process and dynamically imports test modules. Desktop logger/runtime destinations are captured at module import time. Therefore the portability filesystem scenario should run in an **isolated child Node process** (or an equivalently isolated process boundary), not by changing cwd/env in the shared parent test process.

Do not call `process.chdir()` in the parent test runner.

If a helper process is used, keep the discoverable test at:

`test/project-persistence-portability.test.mjs`

and place any non-test scenario helper somewhere that will not be auto-discovered as another `*.test.mjs`, for example:

`test/helpers/persistence-portability-scenario.mjs`

Launch the child with the Node flags needed by this repository (`--experimental-strip-types` is used by the repository test/desktop scripts; preserve compatible `process.execArgv` where appropriate) so TypeScript desktop modules remain importable.

## Three-root test topology

Create three different OS-temp locations for each scenario:

1. **externalProjectRoot** — the selected durable project/package destination;
2. **runtimeCwd** — a disposable sentinel working directory that is deliberately different from the project root and from the Git worktree;
3. **externalLogRoot** — a disposable logging directory.

The child process must start with `cwd = runtimeCwd`, with `ABE_LOG_PATH` and `ABE_DEVELOPER_RUNTIME_LOG_DIR` set beneath `externalLogRoot` **before importing desktop modules**.

This topology is important: it reproduces cwd coupling without deliberately littering the real worktree. If project media appears under `runtimeCwd`, the harness has proven the same class of defect that would create `project-media/` in the repository when the application is launched from the repository.

## First harness slice

Build one focused test: `test/project-persistence-portability.test.mjs`.

Use a synthetic/minimal project snapshot. Do not use the real Serva Vitae project as the writable target and do not copy a multi-megabyte repo fixture into the scenario.

The first slice should combine the following into one deterministic scenario:

1. Save a small project package beneath `externalProjectRoot` using the existing desktop/project-file boundary.
2. Make a representative scene/manuscript or small metadata mutation and perform another durable write (or the closest existing autosave-equivalent API that can be exercised without redesigning production code).
3. Reload the package and verify the mutation survives.
4. Produce a fake narration recording path through the **normal narration path-producing code** (`createNarrationRecordingRuntime`, `buildVoiceRecordingMediaPath`, recording finalization context, or the narrowest equivalent production path). Do not hand-build a correct absolute media path in the test; the existing desktop test already covers that case.
5. Send a few deterministic fake media bytes through the real narration media service and existing desktop media bridge using that normal produced path. Do not use a microphone, MediaRecorder device, ASR model, or real audio asset.
6. Resolve every produced durable artifact path and classify it against `externalProjectRoot`, `runtimeCwd`, and the Git worktree.
7. Clean all three temp roots in `finally`, including after an expected failure.

### Suggested narrow child-process composition

Prefer a child scenario composed from the smallest real production boundaries rather than booting the full UI:

- import `createDesktopResponseForRequest` from `apps/desktop/src/http-app.ts` **after** log env vars are set by the parent process;
- import `createNarrationMediaService`;
- import `createNarrationRecordingFinalizationService`;
- import the narration take/runtime path producer (`createNarrationRecordingRuntime` or the narrowest equivalent);
- create a tiny `fetchJson` adapter that converts the desktop response `{ statusCode, body }` into the `{ ok, value, error }` shape expected by `createNarrationMediaService`;
- create deterministic narration selection/runtime state and a Blob containing a few bytes;
- let `finalizeRuntime(...)` call the real media service and desktop route;
- return compact JSON evidence to the parent test: produced logical media path, resolved physical media path, project package root, round-trip status, and ownership classification.

The child scenario should normally exit successfully after reporting evidence. Let the parent `project-persistence-portability.test.mjs` own the desired containment assertion so the failure message is controlled, compact, and easy for the supervisor/Codex to report.

## Required invariants

Keep these as separate assertions/evidence categories.

### A. Persistence correctness

- the package can be saved and reloaded from the explicit external destination;
- project identity survives;
- the representative mutation survives reload;
- scene/package structure remains readable.

### B. Project-owned storage correctness

- manifest/project metadata resolves beneath `externalProjectRoot`;
- scene chunks resolve beneath `externalProjectRoot`;
- metadata written by the scenario resolves beneath `externalProjectRoot`;
- narration/media produced through the normal path producer resolves beneath `externalProjectRoot`;
- no durable project-owned output resolves beneath `runtimeCwd` merely because it is the process cwd.

Use resolved path containment (`path.resolve` + `path.relative` or an equivalent platform-safe helper), not string-prefix tests and not filenames alone.

### C. Worktree runtime hygiene

As a supplemental guard, snapshot the relevant generated-artifact footprint in the real worktree before and after the isolated scenario and require no new/changed project-runtime artifacts attributable to the scenario.

Do **not** use `git status` as the only detector: ignored files such as `.desktop-state.json`, `.tools`, and logs can be invisible to ordinary status. Conversely, the branch will legitimately contain intentional source/test changes while Codex is implementing the harness.

Use a bounded delta of known runtime/project output locations/patterns rather than recursively hashing multi-megabyte manuscript snapshots. At minimum account for deltas involving:

- `project-media/`;
- developer runtime logs;
- `test-results/`;
- generated `.abe-project` / `.abe-project.json` files or directories;
- new generated scene/project JSON outside tracked intentional fixtures;
- `SaveTestFile/` outputs not present before the scenario;
- `apps/desktop/.desktop-state.json` if the scenario unexpectedly mutates it.

Exclude intentional supervisor output under `.tools/` from project-artifact failure classification, but do not use that exclusion to hide project data.

## Red-baseline rule

The first Codex slice is allowed to finish with **the new portability test red for a specifically demonstrated desired invariant**, while pre-existing relevant tests remain green. That is the purpose of the baseline.

Expected current failure, if the code behaves as inspection suggests: narration creates a relative `project-media/...` path, the desktop bridge resolves it beneath `runtimeCwd`, and project-owned media containment fails.

If the test unexpectedly passes, do not manufacture a failure. Report exactly what paths were observed and identify the next untested project-owned path producer.

Do not make the new test green by:

- broadening `.gitignore`;
- changing the assertion to accept cwd storage;
- bypassing the normal narration path producer with a hand-built absolute path;
- deleting evidence before it is inspected;
- applying the production storage refactor in the same baseline commit unless a tiny non-behavioural test seam is strictly necessary.

A red-baseline commit is **not merge-ready**. Stop after capturing it and report the smallest production boundary to change next.

## Failure evidence

Keep output compact and deterministic. Report, for each failure:

- operation (`package-save`, `package-reload`, `narration-media-save`, etc.);
- selected `externalProjectRoot`;
- `runtimeCwd`;
- offending resolved path;
- path relative to the expected root when useful;
- expected ownership classification;
- actual ownership classification;
- whether persistence round-trip matched.

Do not dump full project snapshots or large logs.

## Likely refactor sequence after the baseline

Do not implement this sequence in the first red-baseline task. Once the baseline exists, use it to drive small production slices:

1. first evaluate whether the already-maintained `state.projectFilePath` durable package destination is sufficient to serve as the active project root for project-owned asset resolution;
2. extract or reuse one project-owned asset/root resolver rather than creating a narration-only path policy; use the existing Worldbuilding image planner as a concrete reference implementation;
3. route narration/media asset paths through that project-owned root and enforce containment at the desktop filesystem boundary where appropriate;
4. if the current destination semantics prove too overloaded, then introduce an explicit active-project storage context/root and migrate existing package/media callers to it;
5. harden package-relative stored paths so legacy/malformed stored scene/asset paths cannot escape the selected project root;
6. remove explicit project-load fallback that silently substitutes bundled project data after a user-selected source fails;
7. separate user/application settings from project-owned durable state, including panel/layout preferences, with migration compatibility as needed;
8. move desktop user settings/runtime state out of the source worktree to an application/user-data location;
9. replace the live repo Serva Vitae bootstrap dependency with an external last-opened/new-project flow or a deliberately tiny read-only demo fixture;
10. only after the harness and affected tests are green, migrate/create the real external Serva Vitae project and remove obsolete live-project/runtime artifacts from the repository in a separate cleanup.

## Storage ownership target

- **repository/worktree**: source, tests, intentional small deterministic fixtures, tracked documentation/tooling;
- **project root**: manuscript, world/project data, project metadata, project media/recordings, project-specific assets;
- **user/app settings store**: panel layout, widths, application preferences, last-opened project and other user-level preferences;
- **session/runtime state**: ephemeral selection, cursor, scroll, in-flight recorder/runtime caches;
- **developer logs**: external to the repository/worktree;
- **automated test artifacts**: OS temp or explicitly configured external artifact root, never the repository by default;
- **`.tools/reports/`**: ignored, compact supervisor/Codex reports and handoff state only.

## Guardrails

- Never commit a developer-specific absolute path.
- Do not add a broad ignore rule for project packages or `project-media` merely to make Git look clean.
- Do not use `git clean`, reset unrelated work, mutate another worktree, or rely on the user's dirty World Spine worktree.
- Do not remove tracked legacy Serva Vitae/bootstrap material until a later slice proves startup/tests no longer depend on it or replaces it with a deliberate minimal fixture.
- Prefer synthetic fixtures and deterministic temp roots over copies of the real manuscript.
- Preserve existing tests; do not rewrite existing expectations simply to accommodate the desired architecture unless the production migration intentionally changes their contract.

## Verification for the baseline task

Before implementation, record:

```text
npm --silent run repo -- status --base main --json
```

Run the new focused harness:

```text
npm --silent run repo -- test --name project-persistence-portability --base main --json
```

Because the new test may intentionally be red during the baseline slice, also run relevant **pre-existing** tests independently to prove the harness work did not regress them, at minimum the most directly reused boundaries such as:

```text
npm --silent run repo -- test --name desktop-application --base main --json
npm --silent run repo -- test --name project-file-storage-adapters --base main --json
npm --silent run repo -- test --name project-service-storage --base main --json
npm --silent run repo -- test --name narration-take-service --base main --json
npm --silent run repo -- test --name narration-media-service --base main --json
npm --silent run repo -- test --name narration-recording-finalization-service --base main --json
npm --silent run repo -- test --name worldbuilding-studio --base main --json
npm --silent run repo -- test --name runtime-portability-guardrails --base main --json
```

After production persistence/storage changes begin, use:

```text
npm --silent run repo -- test --changed --base main --json
```

Run the full suite when the supervisor escalates or before final integration.

## Baseline handoff requirements

Stop after the first harness slice and provide:

1. files added/changed;
2. whether package save/reload passed;
3. whether mutation round-trip passed;
4. exact project-owned paths observed;
5. whether any output appeared under `runtimeCwd` or the worktree;
6. the focused portability test result and failure message;
7. results of the pre-existing boundary tests listed above;
8. the smallest production boundary recommended for the next green-making refactor;
9. `git status --short` and supervisor handoff/report location.

Do not proceed into the production refactor until that baseline evidence is reported.