# Persistence Portability Harness

## Purpose

This branch establishes a deterministic persistence-portability harness before broad project-storage refactoring. The harness must prove that project save/load/autosave/media workflows operate against an explicitly selected project package outside the repository and never treat `process.cwd()`, the worktree, a default library root or an invented sibling directory as project storage.

The first implementation slice remains a **red baseline harness**. Do not begin by fixing production storage. Do not move or clean the real Serva Vitae project yet.

## Required reading

Before implementation:

1. confirm the worktree is a clean checkout of `feature/persistence-portability-harness`;
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

## Process isolation requirement

Repository tests run sequentially in a shared Node process, while desktop logger/runtime destinations are captured at module import time. The filesystem portability scenario must run in an **isolated child Node process**.

Do not call `process.chdir()` in the shared parent test runner.

Suggested files:

```text
test/project-persistence-portability.test.mjs
test/helpers/persistence-portability-scenario.mjs
```

The helper must not match `*.test.mjs`.

Launch the child with compatible repository Node flags, including `--experimental-strip-types` where required.

## Three-root topology

Create three physically distinct OS-temp roots per scenario:

```text
externalProjectRoot   # selected durable package destination
runtimeCwd            # sentinel cwd; project-owned data must not appear here
externalLogRoot       # all diagnostics/runtime logs
```

Start the child with `cwd = runtimeCwd` and set `ABE_LOG_PATH` / `ABE_DEVELOPER_RUNTIME_LOG_DIR` beneath `externalLogRoot` **before importing desktop modules**.

Do not use a `.abe-project.json`-spelled directory for the first baseline; use an unambiguous temp package folder so the first failure isolates narration cwd ownership rather than Save As naming ambiguity.

## First harness slice — red baseline only

Implement one focused test: `test/project-persistence-portability.test.mjs`.

Use a tiny synthetic project: one project, one scene, deterministic data. Do not use real Serva Vitae or mutable `SaveTestFile` fixtures.

The scenario should:

1. save a small package beneath `externalProjectRoot` through the real desktop/project-file boundary;
2. make one deterministic semantic mutation and save/reload it;
3. verify the mutation survives;
4. generate a fake narration take/path through the normal production narration path producer;
5. pass deterministic fake bytes through the real narration media service and desktop media route;
6. classify the produced logical/physical media path against `externalProjectRoot`, `runtimeCwd` and the Git worktree;
7. clean temp roots in `finally`.

No microphone, MediaRecorder device, ASR model, real audio asset or full editor UI is needed.

### Suggested child composition

Use the smallest real production boundaries:

- `createDesktopResponseForRequest` from `apps/desktop/src/http-app.ts`;
- `createNarrationMediaService`;
- `createNarrationRecordingFinalizationService`;
- real narration take/runtime path producer;
- tiny adapter converting desktop HTTP response shape to the media service fetch-result shape;
- deterministic Blob/fake chunks.

The child should exit normally and emit compact evidence. Let the parent own the desired containment assertion.

## First-slice evidence

### Persistence correctness

Require:

- package save succeeds;
- reload succeeds;
- project identity survives;
- representative semantic mutation survives;
- scene/package structure remains readable.

### Storage ownership

Require/observe:

- manifest and sidecars resolve beneath `externalProjectRoot`;
- normal narration media should ultimately belong beneath `externalProjectRoot`;
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

## Red-baseline rule

The first Codex slice is expected/allowed to finish with the new portability assertion red if it demonstrates a genuine desired invariant while relevant pre-existing tests remain green.

Expected failure:

```text
normal narration path -> relative project-media/...
desktop host resolves relative path under runtimeCwd
project-owned media containment assertion fails
```

If it unexpectedly passes, do not manufacture a failure. Report exact paths and move to the next normal path producer only after review.

Do not make the baseline green by:

- broadening `.gitignore`;
- accepting cwd storage;
- supplying a hand-built correct absolute media path;
- using the default project-library root as a substitute;
- fixing production routing in the same baseline task;
- cleaning the original World Spine worktree or moving real Serva Vitae data.

Stop after capturing the baseline and report the smallest production boundary to change next.

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
9. add project save concurrency tests using the `c1f9186` invariant, then add project-transition drain/stale-completion tests;
10. add World Spine semantic round-trip coverage: spines, nodes, locations/sublocations, implication edges, entity/catalogue links and scene placement metadata;
11. add manuscript semantic round-trip coverage: task, inspiration/research note, custom metadata definition/model class, metadata folder/note, revision, writing goal/history and dictionary entry;
12. introduce an explicit portable-project serializer/allowlist instead of whole-workspace cloning;
13. keep project-scoped preferences in the package for now but separate their namespace/domain from semantic data;
14. exclude machine paths, active absolute project location and provider/runtime jobs;
15. remove explicit Open Project fallback to bundled Serva Vitae;
16. harden asset replacement/delete/orphan cleanup and package transaction semantics;
17. later move desktop application settings/log defaults out of the source worktree;
18. only after all relevant harness gates are green, migrate the real Serva Vitae package to `ABE_Projects`, close/reopen/verify it, and then clean obsolete repo project artifacts.

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
- Save As is self-contained;
- Root A -> Root B relocation works;
- no required machine/absolute-old-root reference remains;
- worktree stays unchanged.

Only then migrate and verify the real Serva Vitae project before removing repo-local project artifacts.

## First-task handoff

After the red baseline, report only what is needed for the next review:

- files changed;
- child scenario composition;
- package save/reload result;
- narration logical path;
- resolved physical path;
- expected vs actual ownership;
- worktree delta result;
- relevant pre-existing test result;
- new test result;
- smallest recommended production boundary for the next slice;
- final `git status --short`.

Then stop. Do not implement the production refactor in the first task.
