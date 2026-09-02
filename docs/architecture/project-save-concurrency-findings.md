# Project Save Concurrency Findings — 2026-09-02

## Source

Observed and fixed on `feature/world-spine/unplaced-events-dock` at commit `c1f9186` (`fix: preserve overlapping World Spine autosaves`).

## Durable invariant

An explicit durability request that arrives while a project-file write is already in flight must not be dropped, reduced to an ordinary later idle timer, or overwritten by the older in-flight snapshot.

If additional canonical project mutations occur while save N is running:

1. the new mutations remain dirty;
2. an explicit flush request is remembered;
3. save N may finish with the older snapshot;
4. immediately after save N succeeds, save N+1 writes the accumulated current canonical state;
5. only the revision actually persisted may clear dirty state.

This applies to all project-owned semantic state and project-scoped preferences, not only World Spine row assignments.

## Failure demonstrated by World Spine

Sequential row-placement actions could occur faster than project-file I/O:

```text
A -> Earth -> explicit flush starts save 1
B -> Earth -> explicit flush arrives while save 1 is busy
C -> Mars  -> explicit flush arrives while save 1 is busy
```

Before the fix, later explicit flush requests could be skipped because the file adapter was busy and the required follow-up durability write was not guaranteed immediately. A refresh/reopen could therefore expose an older project-file snapshot even though current runtime/cache state contained all three assignments.

The fix adds an `immediateFlushPending` latch to the autosave controller. A valid explicit `flush()` request made while dirty and temporarily busy/suppressed records the pending durability request. When the in-flight save succeeds and newer dirty state remains, the controller immediately performs the accumulated follow-up flush rather than waiting for the ordinary idle queue.

## Existing regression evidence

`test/project-file-storage-adapters.test.mjs` now simulates an in-flight first save, performs Earth/Earth/Mars mutations and explicit flush requests while it is busy, then verifies that a second write contains the accumulated state.

`test/project-service-storage.test.mjs` performs three successive metadata-only location saves and reloads the project, verifying all assignments survive in:

- `projectIndex` scene metadata;
- the chunked scene store;
- reconstructed World Spine timeline nodes.

## Persistence-portability harness implication

After the initial path-ownership red baseline, add a general concurrency scenario using a synthetic project:

1. begin durable save A and hold the adapter write open;
2. mutate at least two additional independent project-owned records while A is in flight;
3. request explicit persistence for those mutations;
4. release A;
5. require an immediate follow-up durable write;
6. close/reload from the external project package;
7. verify every mutation survives;
8. verify the follow-up write targets the same selected project package and creates no cwd/repo artifact.

Include representative mutations from more than one persistence domain once practical (for example manuscript/World Spine plus project-scoped preference or metadata) so the rule cannot regress into a World-Spine-specific special case.

## Design rule for future features

A feature that requests immediate durability must be able to rely on the persistence boundary even when another write is active. Feature code must not implement its own retry timer, direct file write, or alternate storage fallback to work around save contention.

The autosave/persistence coordinator owns serialization/coalescing of concurrent durability requests.
