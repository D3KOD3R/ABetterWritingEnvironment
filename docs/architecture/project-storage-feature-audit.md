# Project Storage Feature Audit — 2026-09-02

## Purpose

This is the current baseline audit for the persistence-portability refactor. `project-storage-contract.md` is authoritative; this document records what current code does, including findings learned from the latest `feature/world-spine/unplaced-events-dock` work at `c1f9186`.

Project-specific preferences may remain in the project package for now. The audit distinguishes:

- semantic project data;
- project-scoped preferences;
- project-owned assets;
- application/machine state;
- session/runtime/recovery state.

## Feature matrix

| Area | Intended owner | Current status | Follow-up |
| --- | --- | --- | --- |
| Manuscript scene text/content | Semantic project | Bounded/partial | Chunked package works; apply one shared containment validator to all stored scene paths. |
| Binder/structure drafts | Semantic project | Bounded | Round-trip with manuscript; presentation collapse is preference state. |
| Manuscript marks/decorations that alter authored text | Semantic project | Bounded | Keep hover/selection projections runtime-only. |
| World Spine spines/timelines | Semantic project | Bounded | Add external-package round-trip. |
| World Spine nodes/events | Semantic project | Bounded | Round-trip IDs/order/anchors. |
| Locations/sublocations/row placement | Semantic project | Bounded | Latest sequential-save fix proves metadata accumulation; add package round-trip. |
| Implication edges | Semantic project | Bounded | Round-trip create/edit/delete and endpoints. |
| Entity/catalogue links | Semantic project | Bounded | Round-trip stable references. |
| Catalogue entities/templates/custom model structures | Semantic project | Bounded | Keep authored schemas separate from UI preferences. |
| Scene World Spine metadata | Semantic project | Bounded | Metadata-only saves preserve manuscript bodies in current tests. |
| Worldbuilding/World Spine images | Project asset | **Wrong/partial** | Relative reference concept exists, but no-root fallback uses relative `project-media/...`; default `workspace.settings.projectRoot` may substitute for active package; `.json` suffix inference can create/reroute to a sibling shadow package; absolute/runtime `mediaPath` can remain stored. |
| World Spine undo/redo history | Runtime + semantic mutations | Partial | Ensure history application cannot accidentally persist viewport/session state as semantic content. |
| World Spine widths/layout profiles | Project preference | Acceptable for now | Keep logically namespaced from semantic world state. |
| World Spine right-pane/filter/unplaced-dock collapse | Project preference | Acceptable for now | Round-trip as preference; do not treat as machine config. |
| Cursor/selection/scroll/drag state | Session/runtime | Partial/wrong when serialized | Remove from portable serializer unless deliberately promoted to recovery preference. |
| Manuscript tasks | Semantic project | Bounded | External save/reload test. |
| Inspiration/research/passage notes | Semantic project | Bounded | External save/reload anchors/body/title. |
| Metadata folders/notes | Semantic project | Bounded | Desktop already materializes package metadata; keep strict path containment. |
| Custom metadata definitions/model classes | Semantic project schema | **Wrong classification** | Currently stored under settings and mutated as `app-settings`; give explicit semantic taxonomy/domain without moving it out of project package. |
| Custom metadata icons | Project asset or inline semantic payload | Partial | Inline data URL is portable; future file-backed icons use project asset resolver. |
| Draft proofing | Semantic project | Bounded | Round-trip; keep proofing-window UI separate. |
| Revisions/history | Semantic project | Bounded/partial | Current structured state travels; future file sidecars use shared resolver. |
| Writing goals/history | Semantic project | Bounded | Browser store is recovery/cache; project record is canonical after explicit load. |
| Writing-goal viewed month/date/mode | Project preference | Acceptable for now | Keep distinct from goal/history semantic state. |
| Project dictionary/exceptions | Semantic project | Bounded/partial | Prefer explicit semantic persistence domain. |
| Narration recording metadata | Semantic project | Partial | Travels through broad workspace serialization; move to explicit durable DTO. |
| Narration audio | Project asset | **Wrong boundary** | Normal producer creates relative `project-media/<project>/...`, which desktop resolves against cwd. First red-baseline target. |
| Narration transcript/alignment results | Semantic project when durable | Partial | Split durable result from live provider/alignment job state. |
| Live recorder/ASR/provider state | Runtime | Wrong when workspace cloning persists it | Exclude via explicit serializer. |
| Voice character bindings | Semantic project when project-specific | Needs explicit classification | Persist project binding; keep machine/provider profiles/config outside. |
| Voice render/provider jobs | Runtime/job | Wrong/partial | Do not persist implicitly. |
| Analysis accepted results | Semantic project | Bounded after application | Persist accepted canonical changes, not execution machinery. |
| Analysis provider/last job | Runtime | Wrong when cloned | Exclude. |
| Pending analysis review queue | Product decision | Needs classification | Make durability deliberate rather than workspace-accidental. |
| Local AI model/runtime preferences | Application/machine | Wrong if project-serialized | Exclude model/runtime configuration. |
| `modelRoot` / `assetRoot` / default project root | Application/machine | Wrong when workspace-cloned | Never use as portable data or active asset root. |
| Active absolute project/package path | Host/runtime | Wrong when serialized | Open/save action establishes it; package does not need its old physical location. |
| Source/import path | External provenance | Partial | May remain optional provenance, never required for copied project operation. |
| Active pane/panel presentation choices | Project preference | Acceptable for current stage | Keep namespaced from semantic data. |
| Delete-confirmation/global app prefs | Application preference | Non-project | Keep out of semantic project state. |
| Developer logs/test artifacts | Development | Wrong cwd fallback today | External roots/harness policy already defined. |

## Save/path findings learned in final review

### Overlapping saves — positive fix evidence

World Spine commit `c1f9186` fixed a real concurrency failure: explicit flush requests made while a project-file write is in flight are retained and trigger an immediate follow-up save of accumulated state.

Tests prove sequential Earth/Earth/Mars scene placements survive in:

- project index metadata;
- chunked scene storage;
- reconstructed World Spine timeline.

This is now a general persistence invariant.

### Project-transition drain — still needs proof/fix

The autosave `flush()` busy path records a pending explicit flush but returns immediately. `preserveActiveProjectBeforeLoad()` awaits that call and can therefore continue a project transition while the old project's required follow-up save is still pending.

Later regression must hold an old-project save open, request/load a new project, and prove:

- old required revisions are either fully drained or transition fails explicitly;
- stale Project A completion cannot clear Project B dirty state;
- Project B never inherits Project A destination/timer state.

### Save As pre-retarget

Current typed desktop Save As can set the typed destination active before the subsequent write/verification succeeds. Failure must leave the previous package authority active.

### Worldbuilding path-authority mismatch

Worldbuilding currently demonstrates why project-relative references and physical root resolution must be separated:

1. with a good root it can create `assets/images/worldbuilding/...`;
2. with no root it returns relative `project-media/...`;
3. it may use an application/default project root fallback;
4. it strips `.json` to infer a package directory;
5. desktop package save may return a directory whose actual name still ends `.json` when the requested target did not exist.

Therefore feature code cannot infer package type/root from a pathname suffix. The host/persistence context must tell it what the active package root actually is.

### Durable-path test is too permissive

`hasProjectFilePath()` currently uses slash presence as its durability heuristic. `some/folder` can look durable despite remaining cwd-relative. Host roots need real absolute-path validation.

### Scene sidecar containment

Stored `projectStorage.sceneFiles` paths are reused and `path.resolve(projectRoot, storedPath)` is used for read/write. A stored traversal path must be rejected by the same project-relative validator used for other package sidecars.

### Explicit project load fallback

Desktop explicit source loading can still substitute bundled Serva Vitae for many invalid/missing user paths. Explicit open must fail visibly instead of activating unrelated project data.

## Broad serializer finding

The largest architectural risk remains whole-workspace serialization. It makes persistence opt-out instead of opt-in.

Target:

```text
portable serializer allowlist
  semantic project state
  project-scoped preferences
  project-relative asset references

explicitly excluded
  machine/default roots
  old absolute package path
  provider/runtime jobs
  transient selection/drag/scroll state
```

## Post-baseline test matrix

After the first narration red baseline, add focused tests for:

1. narration package ownership;
2. no-destination asset operation creates no cwd file;
3. Worldbuilding image ownership with no default-root fallback;
4. legacy `.abe-project.json` asset creation requires explicit package migration rather than shadow folder;
5. true absolute package-root validation;
6. scene/metadata/asset traversal rejection;
7. Save As failure keeps old authority;
8. Save As copies required assets and works after old package removal;
9. Root A -> Root B relocation;
10. overlapping save accumulation across multiple domains;
11. project-transition save drain and stale completion isolation;
12. World Spine graph round-trip (nodes, locations, implications, catalogue links);
13. manuscript feature round-trip (tasks, notes/research, custom metadata/model class, metadata note, revision, goal, dictionary);
14. project preference round-trip separated from semantic state;
15. machine/runtime fields absent from portable DTO;
16. explicit invalid Open Project fails without bundled-project substitution.

The first Codex task must remain narrow and stop after the narration red baseline.
