# Visual Asset Library — local-first storage, external references, and staged UI delivery

Status: DESIGN AND CODEX TICKETS (not implemented)
Owner branch: `feature/visual-asset-library-foundation`
Baseline: `feature/persistence-portability-harness` at `2b60fe74ce8c5f08cdf40bac305b3b2981db187f`
Date: 2026-10-20

## Strict branch execution contract

All implementation changes must occur **only** on `feature/visual-asset-library-foundation`, or feature-only child branches explicitly derived from it if needed for parallel Codex workers. Never commit, merge, reset, rebase, force-push, delete, or modify `main`, `feature/persistence-portability-harness`, or other existing branches. Do not automatically open a merge PR without the author's approval. Before coding, verify `git status --short --branch`, HEAD/ref, worktree identity and any pending user work. If the local checkout is not the feature branch, use a **separate isolated worktree** rather than switching or resetting an occupied checkout. Native git and repository supervisor determine status and verification.

Read `AGENTS.md`, the existing `docs/implementation/active/visual-asset-library-foundation.md`, `docs/architecture/project-storage-contract.md`, and the targeted scoped agents for modified responsibilities. The source branch is READ-ONLY. Code in this feature branch was scaffolded but not locally executed or integration-tested.

## Existing World Spine / World catalogue image interfaces — reuse where safe, improve where necessary

- `apps/editor/public/features/world-spine/worldbuilding-studio.js`:
  - `normalizeWorldbuildingCatalogueImage` and `WorldCatalogueImage` legacy image model: optional `dataUrl`, `url`, `mediaPath`, `projectRelativePath`.
  - `buildWorldSpineLocationImageIndex(world)` maps existing catalogue images to location rows.
  - `createWorldbuildingCatalogueImageSource(image)` resolves an inline, legacy media-path, or external source for rendering.
  - `applyWorldbuildingCatalogueItemImageToWorld` and `applyWorldSpineLocationImageToWorld` store image association with the World entity.
  - `buildWorldbuildingCatalogueImageMediaPath` allocates `assets/images/worldbuilding/...` but may fall back to `project-media/...` via CWD/default root; this is **migration debt, not authority**.
- `apps/editor/public/features/world-spine/world-spine-panel.js` calls the above for location image index and thumbnail rendering.
- `apps/editor/public/app.js` currently handles World catalogue attachments and calls `/api/project-media/save`.
- `apps/desktop/src/http-app.ts` exposes `/api/project-media/save`, `/load`, `/delete`, `/file/...`. The existing GET `/file` decodes arbitrary path and resolves it; the POST routes preserve a legacy absolute-path fallback. **Do not expose these legacy absolute-path behaviours via the new Visual Studio UI.** A new capability-bound, root-confined resolver and host mediation are needed.
- `ProjectPersistenceService` owns canonical structured project mutation, snapshots, Save, Save As and project transitions. `projectService.registerAsset` already stores registry metadata; `projectIndex.assets` is a lossy projection. Do not create parallel unsaved/shadow registries.

## Conventional new-project package layout

Use the **active explicitly opened or created package directory**, containing `project.json`, as the only project-owned file authority. The application may offer a suggested default location via its machine setting, but the author chooses/accepts an explicit package destination. Example package:

```text
My Novel/                          # ACTIVE PACKAGE ROOT, chosen and verified
  project.json                     # canonical metadata, image IDs/links/versions/provenance
  manuscript/
    scenes/
  metadata/                        # use only existing persistence-owned metadata conventions
  assets/
    images/
      originals/                   # immutable imported/generated originals, stable file IDs
      variants/                    # intentionally authored/generated variants
      worldbuilding/               # preserve existing images and compatibility paths
      thumbnails/                  # optional recreatable derivatives, never canonical truth
    audio/
  transcripts/
  revisions/
  cache/
    visual-previews/               # disposable, may be omitted on Save As
```

Do not create the root inside Git checkout/repo/worktree or fallback `project-media/...`. Do not duplicate bytes to create multiple entity/scene associations. Stored owned file locators are normalized **project-relative** paths, e.g. `assets/images/originals/ab/asset-0189.webp`, never a runtime absolute path.

Author-facing new project: package dialog (existing lifecycle) -> user selects verified parent and project name -> create/stage/write/verify/commit via existing persistence host -> optional empty Visual Studio library initialized canonically -> import images only after final active package exists. If legacy `*.abe-project.json` / recovery-cache only, explain that importing project-owned images requires a deliberate Save As to folder-backed package; do not guess a sibling folder.

Formal asset schema proposal (schema placement follows existing architecture and migrations, not a new ad-hoc JSON file):

```ts
interface VisualAsset {
  id: string;                     // project-stable, not a machine filepath
  title: string;
  category: "character"|"costume"|"environment"|"scene"|"technology"|"vehicle"|"creature"|"other";
  status: "concept"|"review"|"approved"|"archived";
  entityIds: string[];            // existing WorldEntity.id; never name-only authority
  sceneIds: string[];             // existing manuscript scene IDs
  timelineNodeIds?: string[];
  versions: VisualAssetVersion[];
  approvedVersionId?: string;     // author chooses deliberately
  provenance?: { source?: string; prompt?: string; model?: string; createdAt?: string };
}
interface VisualAssetVersion {
  id: string;
  locator: {kind:"project-owned"; relativePath:string} |
           {kind:"external-folder"; rootAliasId:string; relativePath:string} |
           {kind:"external-url"; httpsUrl:string} |
           {kind:"legacy"; legacyEntityId:string};
  mimeType?: "image/png"|"image/jpeg"|"image/webp";
  width?: number;
  height?: number;
  sha256?: string;
}
```

Names and schema are proposed for a reviewed implementation, not a demand to force schema migrations without reading the actual serializer. Keep runtime upload/job state separate from durable semantic project data. A physical image may be linked many times through its stable ID.

## External-folder references: deliberate opt-in, NOT silent project ownership

User-choice modes:

1. **Import/copy into project** (default): project owns the copied bytes and guarantees Save As/relocation.
2. **Link external folder** (opt-in): image stays where it already exists. Store a human-readable folder alias + relative file paths in project semantic metadata; store alias -> user-authorized absolute folder mapping in **local application/machine settings**, scoped by project ID. The author may select/remember many folders. This avoids accidentally transmitting Windows usernames or network-share paths in a portable manuscript package.
3. **Link individual external file** (opt-in): equivalent alias to the selected file's authorized parent with safe relative leaf name.
4. **Link HTTPS reference** (opt-in): explicit external source, visibly network-dependent, never treated as project-owned or silently fetched/uploaded.

Author explicitly selects external folders through a trusted desktop picker. Do not discover or index broad filesystem roots, silently recurse outside the selected folder, or allow renderer/request parameters to open arbitrary absolute paths. The host gives the UI opaque root handles/aliases; enforce path normalization, realpath containment and symlink policy on read and thumbnail operations. Reads only by default; never rename, delete, or write externally linked files. A broken link stays visibly broken and can be **Relink**-ed by alias without modifying image identity.

If the author wants external images portable, offer **Collect into Project** as an explicit copy operation, and warn that ordinary Save As/relocation does not copy externally linked media. If the user insists on persisting full machine-specific source paths, prefer a local machine-scoped binding file, not embedding absolute paths in portable project metadata. A later explicit exportable-external-locator format requires a privacy/portability review before enabling.

Never treat external file alias as an active-project package root or a project-owned file path. Never bypass the host/capability boundary by sending raw absolute paths in GET URLs.

## Shared image resolver contract

Design one `ProjectVisualAssetResolver` / image-storage adapter *below* the UI, optionally shared by World Spine and Visual Studio. Resolve by `projectId + activePackageGeneration + assetId + versionId` or trusted scoped capability token. Resolve owned files relative to verified package, and external files relative to user-authorized root alias. Return either safe same-origin preview URL/blob response or explicit `missing`, `unbound-external-root`, `permission-denied`, `corrupt` state; never fabricate paths. Reuse the World Spine presentation/index helpers where safe; migrate the unsafe path construction into a guarded host resolver without breaking legacy imported project display.

Host safeguards: project identity + destination generation, root containment on read/write/delete/serve, no traversal/drive/UNC escapes for owned relative paths, symlink containment, canonical MIME sniffing, dimensions/size limits, HTTP origin protections, CSP/no script content, no SVG for imported assets in initial slice. Thumbnail decode must not load full 4K originals into hundreds of visible cards. Use lazy-loading and cancellation. File references in persisted records are descriptive, not authority to open a file.

## UI slices and tickets

A. **Shared local media resolver** (P0 infrastructure, highest risk): inspect/fix the unsafe legacy endpoint boundary without breaking current World Spine and catalogue images. Reuse actual project media interfaces. Tests for path traversal, unauthorized reads, stale project and legacy compatibility.
B. **Grid Gallery (default) and navigation**: mount existing scaffold as a read-only Visual Studio pane and make browsing/search/category/entity jumps function. Do NOT implement upload on a broken storage path.
C. **Project-owned asset import and standard layout**: file picker through persistent project package and safe host service, durable metadata, thumbnail pipeline, Save As/relocation.
D. **External folders/files, aliases and relink**: optional user-controlled pointers, per-machine binding, no content copying unless Collect into Project.
E. **Detail Inspector**: editable metadata, linked entities/scenes, availability, provenance, optional approval once durable model established.
F. **Costume Comparison + Visual Canon**: side-by-side variants with explicit approval, no automatic rewriting from AI.
G. **Manuscript Scene Board**: references resolved by canonical entity/scene IDs, no manuscript text changes on browse.
H. **Visual Timeline**: chronology, narrative-state variations, references from World Spine, history/approval.
I. **Validation + 4K use-case testing**: per-feature and end-to-end tests.

## Approval to generate sample images up to 4K

**The author explicitly authorizes Codex to create or generate example images at resolutions up to 4K for test and design validation** (e.g. UHD 3840×2160 or square 4096×4096 where generator permits). This is permission, not a mandatory target or permission to incur unbounded API charges. Prefer controlled generated/locally drawn fixture images when testing file handling; use optional AI-created images where an image tool/provider is available and commercial costs are understood. Use non-sensitive invented characters, costumes, props and settings; do not include unpublished manuscript text in third-party prompts without explicit approval.

Test 1080p, 4K, thumbnails, varied aspect ratios, orientation, transparent PNG, JPEG/WebP, and corrupted/oversized input. Validate memory/UI responsiveness and image round-trip. Fixture binary images go to **temporary local test directories / ignored local project packages**, never commit multi-megabyte images or generated test packages to Git. Commit small fixture generators and metadata-only tests, not large raster binaries.

## Cross-cutting test and release gates

- Test the existing World Spine image flow BEFORE and AFTER new shared resolver work.
- The current 3-file scaffold hasn't been proven by local tests: run focused `test/visual-asset-library.test.mjs` plus repository supervisor AFFECTED/full when required. Fix before declaring the baseline green.
- Read-only UI must never dirty/save. Canonical mutation must be deliberate, idempotent and survive Save, autosave, restart, Save As, relocation and missing external folders.
- Test simultaneous image import/replacement and save, project switch race (A -> B), duplicate filename, multiple link targets, orphan cleanup, malicious absolute path, symlink escape, cloud/disconnected drive, large 4K preview, 500+ thumbnails, preview cancellation and XSS.
- Maintain accurate issue lifecycle with screenshots/recordings from actual running UI where possible; do not mark issue completed from mocked render output alone.
- AI image generation, billing and hosted synchronization remain OUT OF SCOPE for these first local-first tickets.

## Intended first real author trial

Open the copied/backup Serva Vitae project in the new feature worktree; view legacy character/location images, filter them, inspect a sample imported 4K costume image, link it to Shai's existing World entity ID and a scene, save/reload, then Save As to a fresh folder and reopen without the source package. Optionally link an external art folder, unplug it and relink it, proving owned and external semantics do not mix. Avoid placing user art in the Git repo.


## GitHub issue / Codex handoff index

All changes target `feature/visual-asset-library-foundation`; do not modify other branches. Issue creation is not equivalent to starting a Codex run.

| Issue | Work item | Dependency | Review focus |
| --- | --- | --- | --- |
| [#3](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/3) | Secure World Spine + Visual Studio resolver | None | Existing images load; unsafe reads rejected |
| [#2](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/2) | Grid Gallery and workspace shell | #3 before file-preview activation | Search/filter/selection; no dirty project |
| [#4](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/4) | Project image package and durable import | #3 | 4K import, Save As, move/reopen |
| [#5](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/5) | External folder/file links and Relink | #3, #4 | External originals untouched, broken root recovery |
| [#6](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/6) | Asset Inspector | #2, #3, #4 | Metadata, World/scene associations |
| [#7](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/7) | Costume Comparison and Visual Canon | #6 | Four-up comparisons, deliberate approval |
| [#8](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/8) | Manuscript Scene Board | #6 | Scene assets, passage navigation, no text edits |
| [#9](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/9) | Visual Timeline | #7 | In-world chronology and uncertainty |
| [#10](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/10) | 4K and cross-feature QA | Starts alongside #2 | App screenshots, portability and performance |

### First Codex assignment

Start #3 (secure shared media path/resolver audit) and #2 (read-only gallery wiring). UI scaffolding and safe resolver work may be separated by worktree only when a coordinator preserves uncommitted work and uses the dedicated feature branch. Do NOT enable mutable uploads before #3 and package authority are complete. Run tests in the actual checkout and report findings.


## CURRENT AUTHOR PRIORITY OVERRIDE — 20 October 2026

**Author priority P0 is ARTWORK GENERATION, not UI testing, integration or package refactoring.** See [issue #11](https://github.com/D3KOD3R/ABetterWritingEnvironment/issues/11). This section supersedes any earlier "first Codex assignment" ordering in this document, and no tickets #2–#10 should block initial art generation.

1. Inspect the existing reference art/PDFs under `C:\\Users\\ASUS\\Desktop\\Repos\\ProjectServaVitaeProduction` and the Design Bible workbook `Project_Serva_Vitae_World_Art_Design_Bible.xlsx`. Build a compact persistent catalogue of what exists; then move promptly into actual new image creation.
2. Establish separate local folders under `assets/images/generated/{characters,ships,weapons,costumes,environments,scenes,technology}` outside the Git checkout and outside the original reference folder. These **full-resolution image files themselves** are the deliverable.
3. Generate and store concept images with available built-in imagegen capabilities (up to 4K as supported), append filename/prompt/model/reference provenance and a basic version/identity index. Images remain useful regardless of whether a future app interface succeeds. Do not overwrite originals, commit raster assets to Git, or incur separate API charges without authorisation.
4. If creating a valid ABE `project.json` package would delay output, preserve the **conventional image folder structure and metadata manifests now** and integrate later. Do not fabricate incompatible project files or bypass persistence to claim a formal working package exists.
5. Work through a bounded generation batch, preserve progress and generation queue, and report actual created images. Do not spend this phase debugging panel interfaces, doing regression suites, or implementing Save As/externals; defer those to subsequent tickets.

The author is unavailable for feature testing right now. Codex should use reasonable artistic defaults grounded in the supplied references, flag uncertain canon, and **generate real images** rather than only preparing prompts or plans.
