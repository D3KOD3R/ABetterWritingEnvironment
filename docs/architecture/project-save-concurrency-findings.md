# Project Save Concurrency Findings — 2026-09-02

## Source

Observed and fixed in part on `feature/world-spine/unplaced-events-dock` at commit `c1f9186` (`fix: preserve overlapping World Spine autosaves`).

## Proven invariant: overlapping mutations must accumulate

An explicit durability request arriving while a project-file write is already in flight must not be dropped, reduced to an ordinary later idle timer, or overwritten by the older in-flight snapshot.

If additional canonical mutations occur while save N is running:

1. the new mutations remain dirty;
2. an explicit flush request is remembered;
3. save N may finish with the older captured snapshot;
4. immediately after save N succeeds, save N+1 writes the accumulated current canonical state;
5. only state actually made durable may be cleared.

This applies to semantic project state and project-scoped preferences, not only World Spine.

## Failure demonstrated by World Spine

```text
A -> Earth -> explicit flush starts save 1
B -> Earth -> explicit flush arrives while save 1 is busy
C -> Mars  -> explicit flush arrives while save 1 is busy
```

Before the fix, later explicit flush requests could be skipped because the file adapter was busy. A refresh/reopen could expose an older project-file snapshot even though runtime/cache state contained all three assignments.

The World Spine fix added an `immediateFlushPending` latch. A valid explicit `flush()` request made while dirty and temporarily busy/suppressed records the pending request. When the in-flight save succeeds and newer dirty state remains, the controller immediately performs a follow-up flush instead of waiting for an idle timer.

## Existing regression evidence

`test/project-file-storage-adapters.test.mjs` on the World Spine branch simulates an in-flight save, performs Earth/Earth/Mars mutations and explicit flush requests while busy, then verifies the second write contains accumulated state.

`test/project-service-storage.test.mjs` performs successive metadata-only location saves and reloads the project, verifying all assignments survive in:

- `projectIndex` scene metadata;
- chunked scene storage;
- reconstructed World Spine timeline nodes.

## Newly identified requirement: a flush request and a drain barrier are different

The World Spine latch solves one class of overlapping save loss, but project transitions need stronger semantics.

Current `flush()` can return immediately when the save adapter is busy after recording `immediateFlushPending`. A caller that does:

```text
await flush()
then replace/open another project
```

has not necessarily waited for the pending follow-up write.

`preserveActiveProjectBeforeLoad()` currently follows this broad shape, so a later persistence slice must prove/implement a project-transition barrier.

### Required transition invariant

Before replacing Project A runtime state with Project B, any Project A mutation the product promises to preserve must either:

- be durably flushed through the required revision; or
- fail explicitly and invoke a deliberate transition/fallback policy.

A load/switch flow must not clear the old dirty state merely because a follow-up write was latched.

## Stale completion isolation

Every async save completion must be bound to more than a numeric revision.

Capture at least:

```text
project identity
active package/destination identity or generation
save revision
```

A stale Project A completion must never:

- clear Project B dirty state;
- adopt or restore Project A's destination after B is active;
- trigger a follow-up save against B using A's pending intent;
- reset B status/timers because revision values happened to collide after a project switch.

Revision counters may reset/reuse values, so numeric equality alone is not a sufficient cross-project generation check.

## Required later tests

### Same-project accumulation

1. begin save A and hold the physical write open;
2. mutate two additional independent project records/domains;
3. request explicit durability;
4. release the first write;
5. require an immediate follow-up save;
6. close/reload from the same external package;
7. verify every mutation survives;
8. verify both writes target the same selected package and create no cwd/repo artifact.

### Project-transition drain

1. open Project A with an external package;
2. make A dirty and begin/hold an in-flight save;
3. make another A mutation requiring a follow-up flush;
4. request Open/Switch to Project B;
5. require the transition to wait until the promised A durability point is reached, or fail explicitly;
6. verify A reopens with all promised mutations.

### Stale completion isolation

1. begin save for Project A;
2. transition to Project B under the allowed transition policy;
3. make B dirty;
4. release A's old write/completion;
5. verify B remains dirty until B itself is persisted;
6. verify B's active destination remains B;
7. verify no A callback schedules/writes project data into B.

## Design rule for future features

Feature code requests durability; it does not implement retry timers, direct file writes or alternate roots to work around contention.

The persistence coordinator owns:

- write serialization;
- coalescing;
- immediate follow-up durability;
- project/destination generation identity;
- drain/barrier semantics for project transitions;
- stale completion rejection.

The first portability red-baseline task does not need to implement these concurrency changes. They are post-baseline requirements informed by a real production bug.
