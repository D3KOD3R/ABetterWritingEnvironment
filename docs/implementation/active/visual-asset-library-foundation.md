# Visual Asset Library — Phase 1 (Codex implementation handoff)

Status: SCAFFOLDED, NOT WIRED · 2026-10-20
Source: `feature/persistence-portability-harness` at `2b60fe74ce8c5f08cdf40bac305b3b2981db187f`
Destination: `feature/visual-asset-library-foundation` exclusively.

## User workflow

An author opens **Visual Studio > Asset Library**, browses art linked to existing world entities and scenes, attaches/imports images to an explicitly saved project package, marks an approved canonical image, and can Save, Save As, relocate and reopen without losing the artwork. The first commit below only provides **read-only model and HTML renderer**, not a mounted tab, import or actual file persistence.

## Existing systems — inspect before changing

- `packages/world-schema/src/index.ts`: World entities have stable IDs and optional legacy `image`; imported world entities may also expose `templateName`. Do not manufacture parallel character/world entities.
- `apps/editor/public/features/world-spine/worldbuilding-studio.js`: existing world catalogue image handling, including inline data, `mediaPath` and `projectRelativePath`. Existing behaviour must continue working.
- `apps/editor/public/adapters/storage/project-service.js`: `registerAsset()` writes `projectSettings.assetRegistry`. That registry already supports `metadata`; integration must preserve original records.
- `apps/editor/public/adapters/storage/project-index.js`: `projectIndex.assets` is a lightweight projection and currently discards metadata. Do not treat this index as the complete asset record.
- `apps/editor/public/adapters/storage/project-persistence-service.js`: the existing canonical mutation, save/autosave, Save As and project-switch service. No feature-owned storage bypass.
- `apps/editor/public/shell/editor-chrome.js`: current Manuscript / World / Narration + Voice tab rendering; trace delegated tab actions before mounting another pane.
- `apps/editor/public/features/world-spine/world-spine-panel.js` and `worldbuilding-studio.js`: use existing UI/event and world entity linking patterns rather than copying a large shell.
- `docs/architecture/project-storage-contract.md`: binding persistence authority.
- `agents/FeatureWorkAgent.md`, `EditorAgent.md`, `WorldbuildingAgent.md`, `DomainSchemaAgent.md`, `PersistenceAgent.md`, `RepositoryWorkspaceAgent.md`: read the narrowest required set before the corresponding implementation.
- `features.md`: update the bounded relevant product feature section, and implementation index, when wiring author-facing behaviour (the read-only scaffold is not a completed feature).

## Included in initial scaffold

1. `apps/editor/public/features/visual-studio/visual-asset-library-model.js` — pure, non-mutating presentation adapter for already-registered assets and legacy World entity images. Entity links use stable IDs.
2. `apps/editor/public/features/visual-studio/visual-asset-library-panel.js` — safe HTML renderer for filtered thumbnail cards and placeholders. It is intentionally not connected to editor state or handlers yet.
3. `test/visual-asset-library.test.mjs` — focused model/render checks.

No existing tracked files are modified by this scaffold. No writes to any pre-existing branch.

## Next Codex steps (bounded vertical slices)

### Slice B — mount the read-only panel

- Verify the actual local checkout and branch: `git status --short --branch`; HEAD MUST be the new feature branch before modifications. Preserve unrelated/uncommitted work.
- Add a Visual Studio tab or a tightly scoped World subview consistent with current app state and delegated events. Do not put feature business logic into monolithic `app.js`.
- Use `buildVisualAssetLibraryModel({ projectRecord, ... })` and `renderVisualAssetLibraryPanelHTML(model)` from the scaffold. Feed canonical `projectRecord` rather than `projectIndex.assets` to retain metadata.
- Wire search/filter/selection and entity/scene navigation by stable IDs. Initial browsing must not mark the project dirty.
- Derive secure previews via the existing *verified* project media resolver; never construct a path from runtime cwd or a stale project. Legacy display remains read-only unless explicitly promoted.
- Preserve existing World catalogue portraits. Empty and missing-image states must be useful and truthful.

### Slice C — durable owned images

- Make semantic project data for link records, provenance, version/status and approved reference. Use a canonical schema/DTO + deterministic migration. Keep machine paths and cloud provider credentials out of the project.
- Import PNG/JPEG/WebP only initially. Validate MIME, bytes, size and path on the host side, not merely in browser HTML.
- Require an **explicit active package root** before writing binary files. If the project is legacy single-file/cache-only, prompt Save As package; no silent fallback.
- Write image bytes through project asset boundary; verify; commit project-relative reference through `ProjectPersistenceService`; report failure honestly. Retain old bytes until replacement is durably recorded.
- Support attach/unlink for one or more world entity IDs, scenes and optional timeline nodes without duplication of physical bytes. Missing links must be reported, not rebound by name.
- Save As must materialize every owned image into the destination before adopting it; relocation must work without rewriting references. All writes/async completions must be bound to project identity, destination generation and revision.
- Test import/reopen, Save As, relocation, failure/recovery, malicious paths, cross-project late callbacks, shared asset unlink and legacy compatibility.

### Slice D — versions and canonical selection

- Explicit author approval of a single canonical image per entity/state (e.g. John human vs hybrid), while retaining versions. Generated output never becomes canon automatically.
- Preserve prompt/provider provenance if explicitly captured but do not call an image-generation provider in Phase 1. No subscriptions, cloud APIs or payment logic.
- Keep binary originals local/project-owned, thumbnails derived and disposable, and index data lightweight.

## Required invariants

- Existing save functionality remains authoritative; **never touch the source branch**.
- Never store project-owned images in the repository, worktree, CWD, default library root or invented sibling of a `.abe-project.json` snapshot.
- New metadata is deliberately part of the portable serializer; don't rely on raw workspace cloning.
- Never emit user-controlled `javascript:`, HTML, SVG payloads or unverified paths as image URL attributes.
- Browsing is read-only. Write actions use the canonical mutation boundary.
- Preserve original user images, source names and World data; version or unlink only on explicit author actions.
- Follow relevant repo supervisor commands and test selection. Report test execution accurately; the remote scaffold is **not verified by a local harness**.

## Definition of done for the initial working panel

Can load Serva Vitae; displays existing portraits and asset records with their true associations; filter/search works; selecting a card resolves to the right entity/scene; browsing does not mutate project; import/approve/persistence are either fully correct with tests or clearly disabled. The panel can be closed, reopened and changed across projects without stale assets.