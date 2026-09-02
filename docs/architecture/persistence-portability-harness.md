# Persistence Portability Harness

## Purpose

This branch exists to establish a deterministic persistence-portability harness before changing project storage architecture. The harness must prove that project save/load/autosave/media workflows can operate against an explicitly selected project root outside the repository without making `process.cwd()` or the Git worktree an implicit storage root.

The first implementation slice is the **red baseline harness**. Do not begin with a broad persistence refactor and do not move the real Serva Vitae project as part of the first harness commit.

## Required architecture reading

Before implementation:

1. confirm the worktree is on `feature/persistence-portability-harness` and is clean;
2. read `AGENTS.md`;
3. read this document;
4. read `docs/architecture/project-storage-contract.md` — authoritative ownership/path rules;
5. read `docs/architecture/project-storage-feature-audit.md` — current feature-by-feature baseline;
6. read `agents/PersistenceAgent.md`;
7. read `agents/DesktopAgent.md` only if desktop production code is modified;
8. read `agents/AudioVoiceAgent.md` only if narration/audio production code is modified;
9. do not broadly read large Serva Vitae snapshots, `SaveTestFile`, logs or project data unless a focused failure requires them.

## Current product decision: project-scoped preferences

There is no authentication/profile/access layer yet. For the current product stage, preferences that meaningfully belong to a particular project may remain inside that selected project package and travel with it.

This does **not** mean all runtime/settings state belongs in the project.

Use these classes:

```text
semantic project data
  manuscript, World Spine, catalogue/model classes, tasks, notes,
  research, custom metadata definitions, writing goals, project dictionary

project-scoped preferences
  project layout widths/profiles, World Spine filter/right-pane choice,
  active pane, collapsed project sections, similar project presentation state

application/machine state
  model roots, default project root, provider/client configuration,
  active absolute project location, worktree/cwd values

session/runtime state
  transient cursor/hover/drag state, live provider/jobs/recording sessions
```

The project package may physically contain semantic project data and project-scoped preferences together for compatibility, but they should use distinct logical fields/domains. Custom metadata definitions/model classes are **semantic project schema**, not preferences.

The first red baseline does not need to restructure preferences; it must simply avoid treating project-scoped preferences as portability failures.

## What the current architecture already proves

Do not duplicate existing coverage:

- `apps/desktop/src/http-app.ts` already writes folder-backed project packages to an explicit path and scaffolds manuscript, metadata, `assets/audio`, `assets/images`, transcripts and cache directories beneath the package root.
- `test/desktop-application.test.mjs` already proves package save/load in an OS temp directory and proves `/api/project-media/*` works when the caller supplies a correct **absolute** temp path.
- project persistence/storage adapter tests already cover substantial snapshot, destination, permission and autosave behaviour.
- `test/runtime-portability-guardrails.test.mjs` is a static architectural guard; it does not establish filesystem ownership.

The missing contract is end-to-end **path ownership**: a normal feature path producer must not hand the desktop host a cwd-relative destination when an external project is active.

## Pre-investigation findings: use these as starting evidence

### Existing durable project destination

After a successful desktop project save/load, the resolved folder-backed package destination is available in runtime as `state.projectFilePath`. Do not assume a new global storage-root concept is required merely to prove/fix the first media leak.

### Exact narration leak chain

Current normal narration finalization follows this shape:

```text
narration take/runtime path producer
  -> project-media/<project>/<take>.<ext>   (relative)
  -> narration finalization service
  -> narration media service
  -> /api/project-media/save
  -> desktop writeBinaryFile
  -> path.resolve(relativePath)
  -> process.cwd()/project-media/...
```

The harness should exercise the real path-producing chain rather than hand-building a correct absolute media path.

### Worldbuilding image positive control

Worldbuilding image planning already receives `state.projectFilePath`, creates a path under `assets/images/worldbuilding/...`, and resolves it against the project/package root. Use that as a positive implementation pattern, but do not refactor Worldbuilding during the first red-baseline slice.

### Feature audit findings

The actual World Spine graph — spines, nodes, locations/sublocations, implication edges, entities, catalogue/model structures and links — already flows through canonical project state and should remain project-owned.

Manuscript tasks, passage notes/inspiration/research, metadata folders/notes, draft proofing, revisions and writing-goal semantic state also already participate in project persistence.

Known later migration debt includes:

- narration audio cwd leakage;
- absolute/runtime `mediaPath` dependence for catalogue images;
- custom metadata taxonomy incorrectly using an `app-settings` dirty classification;
- whole-workspace serialization allowing machine/runtime fields to become durable accidentally;
- active absolute `projectFilePath` being serialized;
- insufficient shared path-containment enforcement;
- Save As asset-copy/self-containment gaps.

## Process isolation requirement

The repository test runner executes tests sequentially in one Node process, while desktop log/runtime destinations are captured at module import time. Run the portability filesystem scenario in an **isolated child Node process**, not by changing cwd/env in the shared parent test process.

Do not call `process.chdir()` in the parent test runner.

Suggested files:

```text
test/project-persistence-portability.test.mjs
test/helpers/persistence-portability-scenario.mjs
```

The helper must not itself match `*.test.mjs`.

## Three-root test topology

Create three distinct OS-temp locations per scenario:

1. `externalProjectRoot` — selected durable project/package destination;
2. `runtimeCwd` — disposable sentinel cwd, deliberately different from project root and worktree;
3. `externalLogRoot` — disposable log directory.

Launch the child with:

```text
cwd = runtimeCwd
ABE_LOG_PATH = externalLogRoot/...
ABE_DEVELOPER_RUNTIME_LOG_DIR = externalLogRoot/...
```

Set those environment variables before importing desktop modules.

If current narration behaviour is as inspected, media should incorrectly appear beneath `runtimeCwd/project-media/...`. That proves the same defect class that pollutes the repo when the app is launched from the repo.

## First harness slice

Implement one focused test: `test/project-persistence-portability.test.mjs`.

Use a tiny synthetic project. Do not use real Serva Vitae as the writable target.

The scenario should:

1. save a small project package beneath `externalProjectRoot` through the existing desktop/project-file boundary;
2. make a small deterministic semantic project mutation and save again (or exercise the nearest existing autosave-equivalent without redesigning production code);
3. reload and verify the mutation survives;
4. generate a fake narration recording path through the normal narration path-producing code;
5. send deterministic fake bytes through the real narration media service and desktop media route;
6. resolve/classify every produced durable artifact path against `externalProjectRoot`, `runtimeCwd` and the Git worktree;
7. clean all temp roots in `finally`.

No microphone, MediaRecorder hardware, ASR model, real audio file or full browser UI is required.

### Suggested child-process composition

Prefer the smallest real production boundaries:

- `createDesktopResponseForRequest` from `apps/desktop/src/http-app.ts`;
- `createNarrationMediaService`;
- `createNarrationRecordingFinalizationService`;
- the narration take/runtime path producer;
- a tiny adapter converting desktop HTTP responses to the media service's expected fetch result;
- a deterministic Blob/fake recording.

The child should return compact JSON evidence to the parent:

```text
project package root
produced logical media path
resolved physical media path
round-trip result
ownership classification
```

Let the parent test own the desired assertion and compact failure message.

## Required evidence categories

### A. Persistence correctness

- external package can save/reload;
- project identity survives;
- representative semantic mutation survives;
- scene/package structure remains readable.

### B. Project-owned storage correctness

- manifest/project metadata stays beneath `externalProjectRoot`;
- scene/metadata sidecars stay beneath `externalProjectRoot`;
- narration/media produced through the normal path producer must ultimately resolve beneath `externalProjectRoot`;
- no project-owned output may use `runtimeCwd` merely because it is cwd.

Use platform-safe resolved-path containment, not string-prefix comparisons.

### C. Project-scoped preference compatibility

Project-scoped preference fields are allowed to live inside the external project package for now. Their presence in `externalProjectRoot` is not a failure.

The first slice does not need to test them. Later tests should verify that they round-trip separately from semantic manuscript/World Spine state.

### D. Machine/runtime hygiene

The project package must not require machine/application/runtime values such as:

```text
worktree path
cwd
modelRoot / assetRoot / default projectRoot
absolute active projectFilePath
live analysis/narration/voice provider job state
```

The first narration red baseline may simply record these as later audit targets unless the scenario naturally encounters them.

### E. Worktree hygiene

Snapshot a bounded set of known generated/runtime locations before/after the isolated scenario. Do not rely only on `git status`, because ignored runtime files can be invisible.

At minimum watch for unexpected deltas involving:

- `project-media/`;
- developer runtime logs;
- `test-results/`;
- generated `.abe-project` / `.abe-project.json` outputs;
- new scene/project JSON outside intentional fixtures;
- `SaveTestFile/` outputs;
- `apps/desktop/.desktop-state.json` if unexpectedly mutated.

Supervisor output under `.tools/` is not project-artifact leakage.

## Red-baseline rule

The first Codex slice is allowed to finish with **the new portability test red for one specifically demonstrated desired invariant**, while pre-existing relevant tests remain green.

Expected current failure: normal narration produces a relative `project-media/...` path, the desktop bridge resolves it beneath `runtimeCwd`, and project-owned media containment fails.

If the test unexpectedly passes, do not manufacture a failure. Report the exact observed paths and identify the next untested normal path producer.

Do not make the test green by:

- broadening `.gitignore`;
- accepting cwd storage;
- bypassing the normal narration path producer;
- deleting evidence before classification;
- performing the production storage refactor in the baseline task unless a tiny non-behavioural test seam is strictly required.

A red-baseline commit is not merge-ready. Stop after capturing it and report the smallest production boundary to change next.

## Post-baseline refactor/test sequence

Do not implement all of this in the first task. Use the red baseline to drive small slices:

1. introduce/reuse one project-relative asset/path resolver and hard desktop containment checks;
2. route narration audio to package-relative `assets/audio/...`;
3. make project-relative image references authoritative for Worldbuilding/World Spine assets;
4. add World Spine semantic round-trip coverage including nodes, locations, implication links and catalogue/model data;
5. add manuscript semantic round-trip coverage including tasks, inspiration/research, custom metadata schema, metadata notes, revisions, writing goals and project dictionary;
6. introduce an explicit portable-project serializer/allowlist instead of cloning all runtime workspace fields;
7. introduce explicit semantic-project and project-preference namespaces/domains while keeping project-scoped preferences inside the package for now;
8. exclude machine paths, active absolute project location and provider/runtime jobs from portable project state;
9. add Save As asset-copy/self-containment and Root A -> Root B relocation tests;
10. harden replace/delete/orphan cleanup and transaction semantics;
11. later move desktop machine/application settings out of the source worktree to OS/application-data storage;
12. only after the harness is green, migrate/create the real external Serva Vitae project and remove obsolete live-project artifacts from the repo.

## First-task handoff requirements

After implementing the red baseline, report:

- files changed;
- exact scenario composition;
- package save/reload result;
- produced narration logical path;
- resolved physical path;
- expected vs actual ownership;
- whether worktree runtime output changed;
- relevant pre-existing test result;
- new test result;
- smallest recommended production boundary for the next slice;
- final `git status --short`.

Then stop before the production refactor.
