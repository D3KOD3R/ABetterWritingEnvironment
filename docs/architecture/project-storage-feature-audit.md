# Project Storage Feature Audit — 2026-09-02

## Purpose

This is a dated baseline audit of current `main` storage ownership before the persistence-portability refactor. It complements `project-storage-contract.md`; the contract is authoritative, while this file records what the current implementation does and what must migrate.

The audit asks three questions for every durable authoring area:

1. Does the feature enter the canonical project record/save pipeline?
2. If it creates files, are those files bounded to the explicitly selected project package and represented portably?
3. Is project-owned state separated from user/application/session/runtime state?

Status meanings:

- **Bounded** — current structured state is part of the project record/package and its ownership classification is broadly correct.
- **Partial** — project data persists, but path portability, asset lifecycle, dirty-domain ownership, or settings separation is incomplete.
- **Wrong boundary** — current implementation stores project data outside the project authority, or stores user/runtime/machine state inside portable project content.

## Feature ownership matrix

| Area | Intended owner | Current persistence path | Status | Main follow-up |
| --- | --- | --- | --- | --- |
| Manuscript scene text/content | Project | `sceneDrafts` / scene store -> package scene sidecars | Bounded | Apply one shared project-relative containment validator to scene paths and add relocation/round-trip coverage. |
| Binder/structure drafts | Project | `structureDrafts` in canonical project record | Bounded | Round-trip coverage; keep UI collapse state separate. |
| Manuscript marks/decorations that change authored content | Project | workspace/project scene state via manuscript mutation | Bounded | Keep transient hover/selection/projection state outside project data. |
| World Spine spines/timelines | Project | `workspace.world.spines` in canonical project record | Bounded | Add full World Spine round-trip test. |
| World Spine nodes/events | Project | `workspace.world.nodes` / event records | Bounded | Round-trip IDs/order/anchors/location placement. |
| World Spine locations / location placements / sublocations | Project | structured world/node placement + scene metadata | Bounded | Round-trip location placement and scene linkage. |
| World Spine implication links | Project | `workspace.world.edges`, `kind: implicates` | Bounded | Round-trip create/edit/delete and endpoint IDs. |
| World Spine entity links / catalogue assignments | Project | `workspace.world.entityLinks` / entity records | Bounded | Round-trip stable links and manuscript anchors. |
| Worldbuilding templates/entities/catalogue items | Project | `workspace.world` + `world` mutation domain | Bounded | Keep provider/UI state outside durable world DTO. |
| Worldbuilding catalogue images | Project asset | `assets/images/worldbuilding/...`; record can contain `projectRelativePath` plus runtime/absolute `mediaPath` | Partial | Make relative reference authoritative, remove required absolute path, add Save As/relocation and managed-delete tests. |
| World Spine location-row images | Project asset | Same catalogue image path machinery | Partial | Same relative-reference/asset-lifecycle work. |
| Scene World Spine metadata | Project | scene drafts/project event data via manuscript mutation | Bounded | Include representative metadata in project round-trip test. |
| World Spine history (undo/redo) | Session/runtime plus canonical mutations | Runtime history snapshots include world/project data and viewport/layout state | Partial | Split canonical undo payload from viewport/layout state; do not persist layout because history was applied. |
| World Spine panel widths/layout profiles | User/app | Serialized inside `projectSettings`, also local browser prefs | Wrong boundary | Move to user settings store; optionally key by project identity without placing it in project package. |
| World Spine right-pane mode | User/app | `projectSettings` / `app-settings` | Wrong boundary | Move to user settings. |
| World Spine location filter | User/app/view state | `projectSettings` / `app-settings` | Wrong boundary | Move to user/session preference; it changes presentation, not world content. |
| World Spine timeline/manuscript scroll and transient selection | Session/runtime | Mostly runtime; some selection/scroll defaults are serialized generically | Partial | Ensure viewport state never enters portable project content unless explicitly promoted. |
| Manuscript tasks | Project | `manuscriptTasks` + `manuscript-tasks` domain | Bounded | Keep browser copy as disposable cache only; round-trip test. |
| Inspiration / research / passage notes | Project | `passageNotes` + `passage-notes` domain | Bounded | Round-trip anchors/body/title; browser cache remains disposable. |
| Metadata folders and metadata-folder notes | Project | `metadataSubgroups` + `metadata-folders`; desktop materializes package metadata files | Bounded | Keep shared path containment and test nested folder/note round-trip. |
| Custom metadata definitions/taxonomy | Project | Stored in `projectSettings`, mutated using `app-settings` | Wrong boundary | Move to explicit project metadata/taxonomy field/domain; migrate existing project files. |
| Custom metadata icons | Project asset when durable | Currently small inline data URLs | Partial | Inline compatibility is acceptable; if file-backed, route through project asset resolver and relative references. |
| Draft proofing state/history | Project | `draftProofing` + `draft-proofing` domain | Bounded | Round-trip coverage; keep proofing window/layout state user/session-only. |
| Revision sessions/history | Project | `revisions` in project record; future sidecar layout documented | Bounded/Partial | Current structured state travels; future revision files must use shared project resolver and relocation tests. |
| Writing target/goals/history | Project | `projectSettings.writingTargetState` + `writing-goals`, with browser cache | Bounded | Keep canonical goal/history state in project. |
| Writing target dashboard view/month/date selection | User/app or session | Serialized alongside writing target state | Wrong boundary | Split view mode/current viewed date/month from project goal data. |
| Project spellcheck dictionary/exceptions | Project | `projectSettings.spellcheck` | Bounded/Partial | Keep as project lexicon, but give mutations an explicit project-owned domain instead of generic whole-project persistence. |
| Global/editor spellcheck/grammar panel layout | User/app | Editor prefs / `app-settings` and browser prefs | Wrong if kept in project | Move portable-project copies out while retaining user prefs. |
| Narration recording metadata | Project | `workspace.voice.recordings` is captured by whole-workspace project snapshot | Partial | Keep durable recording metadata, but move to explicit durable DTO rather than relying on whole-workspace cloning. |
| Narration audio files | Project asset | Normal path producer creates cwd-relative `project-media/<project>/...` | Wrong boundary | First red-baseline harness target; migrate to package-relative `assets/audio/...`. |
| Narration transcript/alignment metadata needed by recording | Project | Currently travels through workspace recording/alignment structures | Partial | Explicitly classify durable transcript/alignment result vs transient jobs/session/provider state. |
| Live narration session / ASR provider/session state | Session/runtime | Whole workspace can be cloned into project record | Wrong boundary | Exclude live provider/session/job state from portable project serializer. |
| Voice provider descriptors/render jobs | Runtime/job state unless durable output | Whole workspace can be cloned into project record | Wrong/Partial | Persist only deliberate author-owned bindings/output metadata; exclude provider/runtime job machinery. |
| Voice speaker bindings/profiles | Project or user depending semantics | Currently under workspace voice and therefore cloned | Needs classification | Project-specific character/voice assignment travels; machine/provider profile configuration should not automatically travel. |
| Analysis provider / last job | Runtime | `workspace.analysis` is cloned with workspace | Wrong boundary | Exclude provider/job runtime state from portable project data. |
| Accepted analysis-derived issues/events/world changes | Project | Once applied, canonical project/world structures | Bounded | Persist accepted result, not provider execution state. |
| Pending analysis suggestion queue | Product decision: project review queue or session | Whole workspace cloning can make it durable implicitly | Needs classification | Decide deliberately; do not gain durability merely because it lives under `workspace`. |
| Local AI model/execution preferences | User/app/machine | `localAiPrefs`, workspace/settings, project settings | Wrong boundary if serialized in project | Keep user/model configuration outside portable project data. |
| Desktop `modelRoot` / `assetRoot` / default `projectRoot` | User/app/machine | `workspace.settings` can be cloned into project record; desktop also has `.desktop-state.json` | Wrong boundary | Remove from portable serializer and move desktop settings file to OS/app user-data location. |
| Active project filesystem path | Host/runtime | `projectSettings.projectFilePath` currently serialized | Wrong boundary | Load/save action establishes active root; do not serialize old absolute location as project content. |
| Import/source path | Provenance only | `projectSourcePath`, source archive/import report | Partial | Keep optional provenance clearly external/non-required; never make project reopening depend on it. |
| Active pane | User/app | `projectSettings.activePane` | Wrong boundary under current target model | Move to user preference; can be keyed per project outside project package if desired. |
| Binder/console widths, panel visibility, collapsed chapters | User/app | Mixed into `projectSettings` and browser local storage | Wrong boundary | Move to user settings; collapsed/navigation UI state is not manuscript content. |
| Cursor/selection offsets and scroll positions | Session/runtime | `workspace.selectionDefaults` is written into durable workspace snapshot | Wrong boundary | Remove from portable project content; store as local/session recovery if needed. |
| Inline unfinished passage-note draft | Recovery/session or project recovery cache | Bundled inside selection defaults | Needs classification | Preserve unsaved author recovery if desired, but use explicit recovery semantics rather than ordinary portable project state. |
| Keyboard shortcuts | User/app | Editor prefs + `app-settings`; can be included in project settings | Wrong boundary if portable | User settings only. |
| Delete-confirmation preferences | User/app | Browser preference only | Bounded to correct non-project class | Eventually move with user settings authority, not project. |
| Spotify/client/playback UI state | User/app/session | Separate UI/runtime path | Non-project | Ensure whole-workspace serializer does not accidentally promote it if workspace shape expands. |
| Developer logs | Development | cwd fallback unless env override | Wrong boundary today | External log config/harness work already planned. |

## Key positive finding: World Spine canonical content is already project-owned

The canonical world model contains templates, entities, timeline spines, nodes, edges, entity links and sequences. Timeline nodes carry location placement and manuscript anchors. Manual implication links mutate structured `world.edges` records. App workflows then assign the changed world back to `state.workspace.world` and call the canonical project mutation boundary, usually with the `world` domain.

Because current project-record construction clones `state.workspace`, `workspace.world` is included in the saved project record, and the desktop package manifest retains that world data. Therefore the current architecture already treats the actual World Spine graph—spines, nodes, implications, locations, entities, catalogue records and links—as project content.

The persistence work should preserve that positive property while stopping unrelated workspace settings/runtime objects from travelling with it.

## Largest architectural issue found: whole-workspace serialization

Current project-record construction performs a clone of the full live workspace and uses that as durable project state. This is convenient but too permissive for a strict ownership model.

Today the workspace can contain, alongside canonical manuscript/world content:

- machine/application settings such as model, asset and project roots;
- analysis provider and job state;
- pending suggestion queues;
- narration provider/session/alignment-job state;
- voice provider/profile/render-job state;
- selection defaults and scroll offsets.

A future feature added anywhere under `workspace` can therefore become durable accidentally without a persistence design decision.

### Required direction

Converge toward an explicit portable-project serialization DTO/allowlist. Saving a project should deliberately select project-owned fields rather than serialize the whole runtime workspace by default.

Conceptually:

```text
Live workspace/runtime
  manuscript/project canonical data  -> portable project
  world canonical data               -> portable project
  accepted durable author records    -> portable project
  project-specific asset refs        -> portable project (relative refs)

  machine settings                   X user/app store
  UI layout/filter state             X user/app store
  cursor/scroll/transient selection  X session/recovery state
  provider/session/job machinery     X runtime/job store
```

This serializer boundary will make future feature reviews much safer: adding a field to runtime state will no longer automatically make it portable project data.

## Test matrix to grow after the first red baseline

The first Codex task remains the narrow narration red baseline. After that, grow the harness/lower-level tests to cover:

1. **World Spine graph round-trip** — create synthetic spines, nodes, locations, sublocations, implication edge, entity/catalogue item, entity link and scene-linked metadata; save/reload; assert IDs/relationships survive.
2. **Manuscript feature round-trip** — scene edit plus task, inspiration note, research note, metadata definition, metadata folder/note, draft-proofing record, revision record, writing goal and project dictionary entry.
3. **Project-vs-user-settings isolation** — change binder/console widths, World Spine widths/layout/filter/right-pane mode, active pane, keyboard shortcut and panel visibility; portable project content must not change.
4. **Machine-path absence** — portable project content must not require or serialize current `modelRoot`, `assetRoot`, default `projectRoot`, runtime `projectFilePath`, worktree path or cwd.
5. **Runtime-state absence** — provider descriptors, live analysis/audio/voice jobs, cursor/scroll/hover/transient recorder state do not become portable project data unless explicitly classified.
6. **Catalogue image relocation** — Root A -> Root B uses project-relative image reference and remains functional without A.
7. **Narration audio relocation** — same for `assets/audio/...` after the initial routing fix.
8. **Save As self-containment** — Project B contains all referenced project-owned assets and works after Project A is unavailable.
9. **Package containment** — malicious/legacy scene/metadata/asset paths cannot traverse outside project root.
10. **No-destination behavior** — a project-owned asset operation without a durable selected project root fails explicitly and creates no cwd file.
11. **Custom metadata ownership migration** — taxonomy survives round-trip while user side-panel visibility/layout does not travel with it.
12. **Writing-goal split** — canonical goals/history travel; dashboard month/view selection does not.

## Migration priorities after narration baseline

1. Introduce/reuse one project-relative path resolver and hard desktop containment checks.
2. Fix narration audio to project-relative `assets/audio/...`.
3. Make project-relative asset references authoritative for worldbuilding images and remove functional dependence on stored absolute `mediaPath`.
4. Introduce an explicit portable project serializer/allowlist instead of cloning the whole workspace.
5. Split project-owned taxonomy/settings (custom metadata, writing goals, project dictionary) from user/app UI settings.
6. Move World Spine/manuscript panel/layout/filter/navigation preferences out of project content.
7. Remove machine paths and active project filesystem location from portable project content.
8. Classify analysis/narration/voice runtime/job state and persist only deliberately durable author-owned records.
9. Add Save As asset-copy, relocation, managed-delete/orphan cleanup and package transaction hardening.

The storage contract remains authoritative; this audit should be updated or retired as each migration item is completed.