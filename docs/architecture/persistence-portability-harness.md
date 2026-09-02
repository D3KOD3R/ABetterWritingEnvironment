# Persistence Portability Harness

## Purpose

This branch establishes a deterministic persistence-portability harness before broad project-storage refactoring. The harness must prove that project save/load/autosave/media workflows operate against an explicitly selected project package outside the repository and never treat `process.cwd()`, the worktree, a default library root or an invented sibling directory as project storage.

The first implementation slice remains a **red baseline harness**. Do not begin by fixing production storage. Do not move or clean the real Serva Vitae project yet.

## Required reading

Before implementation:

1. fetch the latest remote branch and confirm the worktree is a clean checkout of `feature/persistence-portability-harness`;
2. read `AGENTS.md`;
3. read this directive in full;
4. read `docs/architecture/project-storage-contract.md` — authoritative ownership/root/save rules;
5. read `docs/architecture/project-storage-feature-audit.md` — feature-by-feature baseline;
6. read `docs/architecture/project-save-concurrency-findings.md` — evidence from the World Spine save bug;
7. read `agents/PersistenceAgent.md`;
8. read `agents/DesktopAgent.md` only if desktop production code is modified;
9. read `agents/AudioVoiceAgent.md` only if narration/audio production code is modified;
10. do not broadly read Serva Vitae snapshots, `SaveTestFile`, logs or generated project artifacts unless a focused failure requires them.

Do not touch, clean, reset or migrate the original dirty World Spine worktree. It remains legacy/project evidence until the portability work is green and the real project has been migrated safely.

The first baseline is intentionally based on the persistence branch rather than by merging `feature/world-spine/unplaced-events-dock`. Commit `c1f9186` on that branch is design/regression evidence for later concurrency work. Do not merge or cherry-pick it into the first narration baseline merely to obtain that fix.

## Current ownership decision

There is no authentication/profile layer yet. Project-scoped preferences may remain inside the selected project package for now.

Use these classes:

```text
semantic project data
  manuscript, World Spine, catalogue/model classes, tasks, notes/research,
  custom metadata definitions, revisions, writing goals/history, dictionary

project-scoped preferences
  project layout widths/profiles, World Spine view/filter/right-pane choice,
  active pane, collapsed project/navigation state

application/machine state
  model/runtime/library paths, default project-library root,
  provider/client configuration, last-opened pointer, active absolute package path

session/runtime/recovery state
  cursor/hover/drag state, in-flight provider/jobs/recording sessions,
  deliberate recovery caches
```

Custom metadata definitions and future user-created model classes are **semantic project schema**, not preferences.

The first baseline does not need to restructure preferences.

## Root vocabulary — do not blur these

### Active project package root

The one explicit durable package currently opened/saved for the active project. This is the only valid anchor for project-owned file assets.

### Default project-library root

An application preference suggesting where projects may be created. It is **not** an active-project asset root and must never substitute for one.

### Legacy single-file path

A `*.abe-project.json` compatibility file. Feature code may not silently strip `.json` and invent a sibling package for assets. Package migration/Save As is a persistence-layer decision.

### Project-relative reference

A portable reference such as `assets/audio/take.webm` or `assets/images/worldbuilding/europa.png`. Runtime absolute paths are derived from the active package context only.

## Existing coverage — do not duplicate it

Current tests already prove substantial lower-level behaviour:

- the desktop package writer can save/load a folder-backed package at an explicit OS-temp path;
- desktop media routes work when supplied a correct absolute temp path;
- project service/repository tests cover chunked scene storage, metadata-only scene merging, stale browser-cache replacement and substantial save/load behaviour;
- runtime portability guardrails statically restrict browser storage/file APIs to approved adapters.

The missing first contract is end-to-end **normal path ownership**: a real feature path producer must not hand the desktop host a cwd-relative project destination.

## Pre-investigation findings — do not rediscover unless code differs

### 1. Existing durable package destination

After successful desktop package save/load, runtime receives the host-returned package destination in `state.projectFilePath`.

Do not assume a completely new global project-root abstraction is required just to reproduce the first leak. The later refactor may formalize this into an explicit storage context because the current `projectFilePath` name is overloaded between file/package semantics.

### 2. Exact narration leak chain

Current narration finalization follows:

```text
normal narration path producer
  -> project-media/<project>/<take>.<ext>      # relative
  -> narration finalization
  -> narration media service
  -> /api/project-media/save
  -> desktop writeBinaryFile(filePath)
  -> path.resolve(relativePath)
  -> process.cwd()/project-media/...
```

The first harness must exercise this real chain rather than manually injecting a correct absolute media path.

### 3. Worldbuilding image storage is only a partial pattern

Do **not** describe Worldbuilding images as a fully correct positive control.

Useful existing idea:

- image records have a project-relative path concept under `assets/images/worldbuilding/...`.

Current defects:

- if no package root resolves, the planner falls back to relative `project-media/<project>/...`, creating the same cwd-coupling class as narration;
- the caller can supply `workspace.settings.projectRoot`, which is a default/application root rather than guaranteed active package authority;
- a legacy/path string ending `.json` can be transformed by stripping the suffix to invent a sibling asset directory;
- the desktop package writer itself can return directory paths whose spelling ends `.json`, so extension-based inference can route assets to a sibling path rather than the actual returned package root;
- records may retain an absolute/runtime `mediaPath` as well as `projectRelativePath`.

Later work should reuse the project-relative idea but centralize physical resolution through an explicit active package context.

### 4. Desktop path validation is still weak

`hasProjectFilePath` currently treats any string containing `/` or `\\` as durable-looking. A relative value such as `some/folder` can therefore masquerade as a durable desktop path.

Later path tests must require genuinely absolute host roots.

### 5. Package sidecar containment is inconsistent

Metadata paths have safer project-relative validation, but stored scene-file mappings can be reused and resolved against the package root without the same strict traversal guard. Treat stored sidecar paths as untrusted input.

### 6. Save As authority transition is not yet transactional

In one current desktop-path Save As path, the new typed destination can be set as active before the new package write is known to have succeeded.

Later test:

```text
Project A active
attempt Save As -> B
force B write/verification failure
require A still active
require no subsequent asset/autosave routing to B
```

### 7. Explicit Open Project fallback is unsafe

Desktop `loadProjectLibrarySeedFromPath` can substitute bundled Serva Vitae after many missing/invalid explicit project paths. Explicit user-directed open should load the selected project or fail visibly. Demo/bootstrap fallback is a separate concern.

### 8. Whole-workspace persistence is too permissive

The current project snapshot can clone broad runtime workspace state. Future serializer work should explicitly allowlist semantic project state, project-scoped preferences and portable asset references while excluding machine paths/provider jobs/transient session state.

### 9. Browser cache is recovery, not package authority

Current cache replacement behaviour is useful and several tests already ensure explicit file loads do not borrow stale scene bodies. Preserve that.

Before a durable package exists, structured work may be recoverable in browser cache, but cache-only preservation does not create a valid filesystem asset root and must not be reported as successful package persistence.

### 10. Real overlapping-save bug and fix evidence

`feature/world-spine/unplaced-events-dock` commit `c1f9186` demonstrated that explicit persistence requests can arrive while a project-file save is already running.

The fixed behaviour on that branch retains the explicit flush request and performs an immediate accumulated follow-up write. Tests prove Earth/Earth/Mars sequential World Spine placements survive reload.

This is a general persistence invariant, not World-Spine-specific behaviour.

The portability branch does not need to merge that feature branch during the first narration baseline. Treat the commit and `project-save-concurrency-findings.md` as design evidence.

### 11. Project-transition drain is a separate concurrency requirement

Current `flush()` returns immediately when the adapter is busy, merely latching a follow-up request. Meanwhile `preserveActiveProjectBeforeLoad()` awaits `flush()` and can therefore continue into project replacement before the pending follow-up write is actually complete.

This requires a later focused test. The persistence coordinator ultimately needs a `drain`/`flush-through-revision` style barrier for project transitions, not only a boolean pending latch.

Also test stale completion isolation:

```text
save Project A starts
switch/open Project B
edit B
A save completes
B dirty state/destination must remain untouched
```

Do not claim this is fixed by revision-number comparison alone; target identity/destination generation must participate.

## Process isolation and test registration

Repository test discovery only registers top-level `test/*.test.mjs` modules. The supervisor has a specific route for those files, while an otherwise new helper path under `test/helpers/` is conservatively classified as unknown and can escalate verification to the full suite.

Therefore the **first baseline should add only one repository test file**:

```text
test/project-persistence-portability.test.mjs
```

Do not add `test/helpers/persistence-portability-scenario.mjs` for this first slice and do not modify supervisor routing merely to accommodate a helper.

The one test module should export exactly one `run…Test` function for normal registry execution. It may also act as its own child-process scenario when launched directly with a dedicated CLI flag such as:

```text
--portability-scenario-child
```

Recommended shape:

```text
normal registry import
  -> export/run parent test only

child process executes same absolute .test.mjs file with child flag
  -> run child scenario
  -> emit one compact JSON evidence object
  -> exit 0 when the production workflow completed, even if ownership is wrong
```

The parent owns the desired portability assertion. An ownership defect should therefore be a precise parent assertion failure, not an opaque child-process crash.

Repository tests run sequentially in a shared Node process, while desktop logger/runtime destinations are captured at module import time. The filesystem portability scenario itself must therefore run in an **isolated child Node process**.

Do not call `process.chdir()` in the shared parent test runner. Spawn the child with its `cwd` option set to the sentinel runtime directory.

Launch the child with repository-compatible Node flags, including `--experimental-strip-types`, because the real desktop boundary imports TypeScript modules.

The child must dynamically import desktop/narration production modules only after its environment is established. Module URL resolution may come from `import.meta.url`; do not derive source paths from child cwd.

## Three-root topology

Create three physically distinct OS-temp roots per scenario:

```text
externalProjectRoot   # selected durable package destination
runtimeCwd            # sentinel cwd; project-owned data must not appear here
externalLogRoot       # all diagnostics/runtime logs
```

Start the child with:

```text
cwd = runtimeCwd
ABE_LOG_PATH = externalLogRoot/desktop.log
ABE_DEVELOPER_RUNTIME_LOG_DIR = externalLogRoot/runtime
```

Those values must exist in the child environment **before importing `apps/desktop/src/http-app.ts` or its logger**.

Do not use a `.abe-project.json`-spelled directory for the first baseline; use an unambiguous temp package folder so the first failure isolates narration cwd ownership rather than Save As naming ambiguity.

Do not call bootstrap endpoints (`/api/workspace`, `/api/project-library`) or mutate `/api/settings` in the child. Importing the host is acceptable; the first scenario should stay on explicit project-file/media request paths only.

## First harness slice — red baseline only

Implement one focused test: `test/project-persistence-portability.test.mjs`.

Use a tiny synthetic project: one project, one scene and deterministic authored data. Do not use real Serva Vitae or mutable `SaveTestFile` fixtures.

Use a representative semantic mutation that does not depend on the full editor UI—for example a small project-owned note/scene metadata change—and prove it survives a real package save/reload.

The child scenario should:

1. save the synthetic package beneath `externalProjectRoot` through `createDesktopResponseForRequest` and `/api/project-file/save`;
2. parse the **host-returned package root** and use that returned value as evidence of the active package destination—do not infer the root from filename spelling;
3. reload through `/api/project-file/load` and verify project identity/package readability;
4. make one deterministic semantic mutation, save again and reload to verify the mutation survives;
5. create a narration runtime/take through the real narration take/path producer without passing a custom `mediaPath`;
6. finalize deterministic fake chunks through `createNarrationRecordingFinalizationService` wired to `createNarrationMediaService`;
7. have that media service cross the real `/api/project-media/save` desktop request boundary through a tiny fetch-shape adapter;
8. capture the produced narration logical path and the desktop host's returned physical file path;
9. classify the physical media path against the host-returned project root, `runtimeCwd` and the Git worktree;
10. emit compact JSON evidence to the parent;
11. clean all OS-temp roots in the parent `finally`, even when the expected assertion is red.

No microphone, MediaRecorder device, ASR model, real audio asset or full editor UI is needed.

### Production boundaries to use

Use the smallest real production boundaries:

- `createDesktopResponseForRequest` from `apps/desktop/src/http-app.ts`;
- `createNarrationRecordingRuntime` or equivalent normal narration take producer;
- `createNarrationRecordingFinalizationService`;
- `createNarrationMediaService`;
- deterministic `Blob`/fake chunk bytes.

The tiny fetch adapter may translate `DesktopHttpResponse` into the `{ ok, value, error }` shape expected by the narration media service, but it must not alter or pre-resolve the `filePath` provided by narration.

The parent should distinguish three failure classes:

1. **scenario/setup failure** — child exits non-zero, emits malformed evidence or package round-trip fails;
2. **unexpected repo mutation** — bounded worktree artifact footprint changes;
3. **expected portability red** — production scenario succeeds, but narration physical path is under `runtimeCwd` rather than the selected package root.

Only class 3 is the intended first-slice red result.

## First-slice evidence

### Persistence correctness

Require before the ownership assertion:

- package save succeeds;
- host-returned package root is a directory beneath `externalProjectRoot`;
- reload succeeds;
- project identity survives;
- representative semantic mutation survives;
- scene/package structure remains readable.

### Storage ownership

Require/observe:

- manifest and sidecars resolve beneath the host-returned package root;
- normal narration media should ultimately belong beneath that same package root;
- current expected red evidence is that narration instead resolves beneath `runtimeCwd/project-media/...`.

Use `path.resolve` + `path.relative` or an equivalent platform-safe containment helper, not string-prefix tests.

### Worktree hygiene

Snapshot a bounded generated-artifact footprint before/after the isolated scenario. Ordinary `git status` is insufficient because ignored files can be invisible.

Watch for unexpected deltas involving:

- `project-media/`;
- runtime logs;
- `test-results/`;
- generated `.abe-project` / `.abe-project.json` outputs;
- generated scene/project JSON outside intentional fixtures;
- `SaveTestFile/` outputs;
- `apps/desktop/.desktop-state.json`.

Do not mutate or normalize existing tracked `SaveTestFile` fixtures as part of this harness.

Supervisor report files under the repository's approved ignored report location are development artifacts, not project leakage.

## Verification for the first slice

Do not use a new unclassified repository helper path that forces full verification.

Run the new test explicitly through the supervisor:

```text
npm run repo -- test --name project-persistence-portability --base main
```

Its final ownership assertion is currently expected to fail red.

Also run relevant **pre-existing** tests explicitly and require them to stay green:

```text
narration-take-service
narration-recording-finalization-service
narration-media-service
desktop-application
runtime-portability-guardrails
```

Use `npm run repo -- test --name <test-id> --base main` for those named checks. If a pre-existing test fails, distinguish an actual regression from an already-reproducible clean-branch baseline failure before proceeding.

Do not run or repair mutable primary-worktree fixtures. Verification occurs in the clean persistence worktree.

## Red-baseline rule

The first Codex slice is expected/allowed to finish with the new portability assertion red if it demonstrates a genuine desired invariant while relevant pre-existing tests remain green.

Expected failure:

```text
normal narration path -> relative project-media/...
desktop host resolves relative path under runtimeCwd
project-owned media containment assertion fails
```

If it unexpectedly passes, do not manufacture a failure. Report exact paths and stop for review.

Do not make the baseline green by:

- broadening `.gitignore`;
- accepting cwd storage;
- supplying a hand-built correct absolute media path;
- pre-resolving the narration path in the test adapter;
- using the default project-library root as a substitute;
- fixing production routing in the same baseline task;
- changing Save As/Worldbuilding/concurrency behaviour in this task;
- merging/cherry-picking the World Spine branch;
- cleaning the original World Spine worktree or moving real Serva Vitae data.

A red-baseline commit is intentionally **not merge-ready**. Its purpose is to pin the existing bug with deterministic evidence. Stop after capturing it and report the smallest production boundary to change next.

## Post-baseline sequence

Drive this in small reviewed slices rather than one broad refactor:

1. define/reuse one explicit active-package storage context and one project-relative resolver;
2. make root semantics explicit: active package root vs default library root vs legacy single-file path;
3. enforce true absolute package roots and host-side containment for write/read/serve/delete;
4. route narration audio to package-relative `assets/audio/...`;
5. remove Worldbuilding's relative `project-media/...`, default-root and `.json` shadow-package fallbacks; make `projectRelativePath` authoritative;
6. make legacy single-file -> folder-package transition an explicit persistence Save As/migration action;
7. make Save As adopt the new destination only after write + verification succeeds;
8. add Save As asset-copy/self-containment and Root A -> Root B relocation tests;
9. reconcile the persistence work with the latest applicable World Spine/source branch before changing shared autosave concurrency code;
10. add project save concurrency tests using the `c1f9186` invariant, then add project-transition drain/stale-completion tests;
11. add World Spine semantic round-trip coverage: spines, nodes, locations/sublocations, implication edges, entity/catalogue links and scene placement metadata;
12. add manuscript semantic round-trip coverage: task, inspiration/research note, custom metadata definition/model class, metadata folder/note, revision, writing goal/history and dictionary entry;
13. introduce an explicit portable-project serializer/allowlist instead of whole-workspace cloning;
14. keep project-scoped preferences in the package for now but separate their namespace/domain from semantic data;
15. exclude machine paths, active absolute project location and provider/runtime jobs;
16. remove explicit Open Project fallback to bundled Serva Vitae;
17. harden asset replacement/delete/orphan cleanup and package transaction semantics;
18. later move desktop application settings/log defaults out of the source worktree;
19. only after all relevant harness gates are green, migrate the real Serva Vitae package to `ABE_Projects`, close/reopen/verify it, and then clean obsolete repo project artifacts.

## Later acceptance gate before real-project cleanup

A representative external test project should prove:

- manuscript edits survive;
- World Spine nodes/implications/locations survive;
- catalogue/model data survives;
- tasks, notes/research and custom metadata survive;
- revisions/goals/dictionary survive;
- project-scoped preferences survive;
- narration audio and Worldbuilding images stay inside the package;
- overlapping saves do not lose later mutations;
- project switch cannot lose/clear the old/new project's dirty state incorrectly;
- Save As is self-contained and only adopts a verified destination;
- Root A -> Root B relocation works;
- stored scene/asset paths cannot escape the package;
- an explicit invalid Open Project fails instead of loading bundled Serva Vitae;
- no required machine/absolute-old-root reference remains;
- worktree stays unchanged.

Only then migrate and verify the real Serva Vitae project before removing repo-local project artifacts.

## First-task handoff

After the red baseline, report only what is needed for the next review:

- pushed commit SHA;
- file(s) changed;
- parent/child scenario composition;
- package save/reload result and host-returned package root;
- narration logical path;
- desktop-returned physical path;
- expected vs actual ownership;
- bounded worktree delta result;
- named pre-existing test results;
- new test result;
- smallest recommended production boundary for the next slice;
- final `git status --short`.

Then stop. Do not implement the production refactor in the first task.
