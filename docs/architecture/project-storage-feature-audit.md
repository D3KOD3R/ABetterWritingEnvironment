# Project Storage Feature Audit — 2026-09-02

## Purpose

This is a dated baseline audit of current `main` storage ownership before the persistence-portability refactor. It complements `project-storage-contract.md`; the contract is authoritative, while this file records what the current implementation does and what must migrate.

The current product decision is that **project-specific preferences may remain inside the project package for now** because there is no authentication/profile layer yet. The audit therefore distinguishes authored semantic project data from project-scoped preferences, while still excluding machine/application and transient runtime state from the portable project package.

Status meanings:

- **Bounded** — current structured state is part of the selected project package and its ownership is broadly correct.
- **Partial** — the data persists but portability, asset lifecycle, dirty-domain separation, or explicit serializer ownership is incomplete.
- **Wrong boundary** — project data is written outside the selected project authority, or machine/runtime state is implicitly serialized as project data.
- **Project preference** — valid to travel with the project for the current product stage, but should be logically separated from authored semantic content.

## Feature ownership matrix

| Area | Intended owner | Current persistence path | Status | Main follow-up |
| --- | --- | --- | --- | --- |
| Manuscript scene text/content | Semantic project | `sceneDrafts` / scene store -> package scene sidecars | Bounded | Shared project-relative containment validator and round-trip/relocation coverage. |
| Binder/structure drafts | Semantic project | `structureDrafts` in canonical project record | Bounded | Round-trip coverage. |
| Manuscript marks/decorations that alter authored content | Semantic project | workspace/project scene state | Bounded | Keep transient hover/projection state runtime-only. |
| World Spine spines/timelines | Semantic project | `workspace.world.spines` | Bounded | Full synthetic World Spine round-trip. |
| World Spine nodes/events | Semantic project | `workspace.world.nodes` / event records | Bounded | Round-trip IDs/order/anchors/location placement. |
| World Spine locations / sublocations / placement | Semantic project | world/node placement + scene metadata | Bounded | Round-trip location relationships. |
| World Spine implication links | Semantic project | `workspace.world.edges`, `kind: implicates` | Bounded | Round-trip create/edit/delete/endpoints. |
| World Spine entity links / catalogue assignments | Semantic project | `workspace.world.entityLinks` / entities | Bounded | Round-trip stable links/manuscript anchors. |
| Worldbuilding templates/entities/catalogue/model classes | Semantic project | `workspace.world` + `world` mutation domain | Bounded | Explicit serializer allowlist later. |
| Worldbuilding catalogue images | Project asset | `assets/images/worldbuilding/...` + relative/absolute fields | Partial | Make project-relative reference authoritative; Save As/relocation/delete tests. |
| World Spine location-row images | Project asset | same image machinery | Partial | Same relative-reference/asset-lifecycle work. |
| Scene World Spine metadata | Semantic project | scene drafts/project event data | Bounded | Include representative metadata in round-trip. |
| World Spine history canonical undo content | Runtime history over semantic project mutations | runtime history snapshots | Partial | Separate canonical undo payload from viewport/layout snapshots. |
| World Spine panel widths/layout profiles | Project preference | `projectSettings` + browser prefs | Project preference | Keep in package for now, but give explicit project-preference namespace/domain. |
| World Spine right-pane mode | Project preference | `projectSettings` / `app-settings` | Project preference | Reclassify away from machine `app-settings`. |
| World Spine location filter | Project preference/view | `projectSettings` / `app-settings` | Project preference | May travel with project; separate from semantic `world`. |
| World Spine timeline/manuscript scroll, hover, selection | Session/runtime | mostly runtime; some generic selection defaults serialized | Partial/Wrong | Exclude transient viewport state unless explicitly promoted to project recovery/preference. |
| Manuscript tasks | Semantic project | `manuscriptTasks` + `manuscript-tasks` | Bounded | Browser copy remains disposable cache; round-trip. |
| Inspiration / research / passage notes | Semantic project | `passageNotes` + `passage-notes` | Bounded | Round-trip anchors/body/title. |
| Metadata folders and notes | Semantic project | `metadataSubgroups` + `metadata-folders`; package sidecars | Bounded | Shared containment and nested round-trip. |
| Custom metadata definitions/taxonomy/model classes | Semantic project schema | currently inside `projectSettings`, dirty domain `app-settings` | Wrong classification | Move to explicit semantic metadata/taxonomy field/domain; keep inside project package. |
| Custom metadata icons | Project asset when durable | inline data URL today | Partial | File-backed icons must use project asset resolver and relative refs. |
| Draft proofing state/history | Semantic project | `draftProofing` + `draft-proofing` | Bounded | Round-trip coverage. |
| Draft-proof window/layout | Project preference or runtime | UI state | Needs classification | Persist per-project only if intentional. |
| Revision sessions/history | Semantic project | `revisions` in project record | Bounded/Partial | Future revision files need shared resolver/relocation. |
| Writing target goals/history | Semantic project | `projectSettings.writingTargetState` + `writing-goals` | Bounded | Keep canonical state project-owned. |
| Writing target dashboard view/month/date | Project preference | serialized with writing target settings | Project preference | Valid to travel for now; separate from semantic goal state. |
| Project spellcheck dictionary/exceptions | Semantic project | `projectSettings.spellcheck` | Bounded/Partial | Give explicit semantic domain. |
| Grammar/spellcheck panel layout | Project preference or app default | editor prefs / `app-settings` | Needs classification | Per-project layout may travel; global defaults remain app settings. |
| Narration recording metadata | Semantic project | `workspace.voice.recordings` through whole-workspace snapshot | Partial | Make explicit durable DTO instead of accidental workspace cloning. |
| Narration audio files | Project asset | cwd-relative `project-media/<project>/...` | Wrong boundary | First red-baseline target; migrate to package-relative `assets/audio/...`. |
| Narration transcript/alignment result | Semantic project when required by take | workspace recording/alignment structures | Partial | Separate durable result from transient job/session state. |
| Live narration recorder / ASR session/jobs | Session/runtime | can hitchhike via whole-workspace clone | Wrong boundary | Exclude from portable serializer. |
| Voice character/speaker assignment | Semantic project when project-specific | workspace voice | Needs classification | Project-specific bindings travel. |
| Voice provider profile/runtime config | App/machine/runtime | workspace voice | Wrong if serialized | Keep machine/provider config outside portable project. |
| Voice render jobs | Runtime/job unless accepted durable output | workspace voice | Wrong/Partial | Persist only deliberate project output metadata. |
| Analysis provider / last job | Runtime | `workspace.analysis` cloned | Wrong boundary | Exclude provider/job runtime state. |
| Accepted analysis-derived issues/events/world changes | Semantic project | canonical project/world structures | Bounded | Persist accepted result, not execution machinery. |
| Pending analysis suggestion queue | Product decision | workspace | Needs classification | Explicitly decide project review queue vs session before durability. |
| Local AI model/execution configuration | App/machine | `localAiPrefs` / workspace settings | Wrong if serialized | Keep provider/model locations out of project. |
| Desktop `modelRoot` / `assetRoot` / default `projectRoot` | App/machine | workspace settings + `.desktop-state.json` | Wrong if serialized | Exclude from portable serializer; desktop settings eventually move to OS app data. |
| Active project filesystem path | Host/runtime | `projectSettings.projectFilePath` | Wrong boundary | Load/save establishes root; do not serialize old absolute location. |
| Import/source path | External provenance | `projectSourcePath`, source archive/import report | Partial | Keep clearly optional and non-required for project function. |
| Active authoring pane | Project preference | `projectSettings.activePane` | Project preference | Valid to travel with project for now. |
| Binder/console widths, panel visibility, collapsed sections | Project preference | `projectSettings` + browser cache | Project preference | Keep per-project for now; explicit preference namespace/domain. |
| Keyboard shortcuts | Usually app preference; may have future project override | editor prefs | Needs classification | Do not force profile architecture now; keep machine/global defaults separate from any project override. |
| Cursor/selection offsets | Session/runtime/recovery | `workspace.selectionDefaults` durable snapshot | Wrong by default | Exclude or explicitly promote to recovery model. |
| Inline unfinished passage-note draft | Recovery/session | selection defaults | Needs classification | Explicit recovery semantics, not accidental semantic project state. |
| Delete-confirmation preferences | App/project preference | browser preference | Non-project semantic | Current location acceptable prototype-wise; no persistence refactor dependency. |
| Spotify/client/playback state | App/session | separate runtime paths | Non-project | Ensure serializer does not accidentally capture it. |
| Developer logs | Development | cwd fallback unless env override | Wrong boundary today | External logging work already planned. |

## Positive finding: World Spine canonical content is already project-owned

The canonical world model contains templates/model classes, entities, timeline spines, nodes, implication edges, entity links, sequences, manuscript anchors and location placement. App workflows assign mutations back into `state.workspace.world` and pass them through the canonical project mutation boundary.

Because project-record construction currently clones `state.workspace`, the actual World Spine graph is included in the saved project record and therefore travels with the selected package. The refactor should preserve this positive property.

## Important distinction: custom metadata is not a project preference

The custom metadata interface may evolve into author-defined model classes and taxonomy unique to a particular novel/world. Therefore:

```text
custom metadata definitions / field schemas / model classes -> semantic project schema
metadata folders/notes/values                           -> semantic project data
metadata panel width/visibility/layout                  -> project preference
```

Keeping all three inside the same project package is acceptable for now, but they must not share one conceptual persistence class. This separation is what will make a future account/profile layer possible without rewriting project schema.

## Largest architectural risk: whole-workspace serialization

Current project-record construction clones the full live workspace. That makes World Spine persistence easy, but it also means runtime or machine fields can become durable merely because a future feature places them under `workspace`.

The workspace may contain:

- semantic manuscript/world data;
- project-scoped preferences;
- machine settings such as model/asset/project roots;
- analysis provider and job state;
- narration provider/session/alignment jobs;
- voice provider/render jobs;
- selection/scroll/runtime values.

### Required direction

Converge toward an explicit portable-project serializer/allowlist:

```text
Live runtime
  semantic project state        -> project package
  project-scoped preferences    -> project package, separate namespace/domain
  project-relative asset refs   -> project package

  machine/app config            X portable project
  provider/runtime jobs         X portable project
  transient session state       X portable project unless deliberately promoted
```

The key guardrail is not "all preferences must leave the project". It is **durability must be intentional and classified**.

## Test matrix after the first red baseline

1. **World Spine semantic round-trip** — spines, nodes, locations, sublocations, implication edge, entity/catalogue item, entity link, scene-linked metadata.
2. **Manuscript semantic round-trip** — scene edit, task, inspiration, research, custom metadata definition, metadata folder/note, draft proofing, revision, writing goal, project dictionary.
3. **Project-preference round-trip** — change binder/console widths, World Spine widths/layout/filter/right-pane mode, active pane and representative project-specific visibility; reopen and verify they survive inside the project package.
4. **Semantic/preference separation** — preference changes must not mutate World Spine/manuscript semantic payloads or be misclassified as semantic feature mutations.
5. **Machine-path absence** — project package must not depend on/serialize current `modelRoot`, `assetRoot`, default `projectRoot`, runtime absolute `projectFilePath`, worktree or cwd as required project state.
6. **Runtime-state absence** — provider descriptors, live jobs, transient recorder/selection/scroll state stay out unless explicitly promoted.
7. **Catalogue image relocation** — Root A -> Root B resolves relative image reference under B.
8. **Narration audio relocation** — same for `assets/audio/...` after routing fix.
9. **Save As self-containment** — Project B contains semantic data, project preferences and all required assets; it works after A is unavailable.
10. **Package containment** — malicious/legacy scene/metadata/asset paths cannot escape project root.
11. **No-destination behaviour** — project-owned asset operation without selected durable root fails and creates no cwd file.
12. **Custom metadata classification** — taxonomy/model definitions survive as semantic project schema while metadata UI layout remains project preference.

## Migration priorities after narration baseline

1. Introduce/reuse one project-relative path resolver and hard desktop containment checks.
2. Fix narration audio to package-relative `assets/audio/...`.
3. Make relative asset references authoritative for Worldbuilding/World Spine images.
4. Introduce an explicit portable project serializer/allowlist instead of cloning the whole workspace.
5. Introduce explicit semantic-project vs project-preference namespaces/domains.
6. Reclassify custom metadata definitions as semantic project schema rather than `app-settings`.
7. Keep per-project layout/navigation preferences in the package for now, but stop mixing them with machine/application settings.
8. Remove machine paths and active project filesystem location from portable project content.
9. Classify analysis/narration/voice runtime/job state and persist only deliberately durable records.
10. Add Save As asset-copy, relocation, managed-delete/orphan cleanup and package transaction hardening.

The storage contract remains authoritative; this audit should be updated or retired as migration items are completed.
