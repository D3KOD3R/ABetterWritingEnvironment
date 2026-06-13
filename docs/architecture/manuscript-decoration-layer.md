# Manuscript Marks And Decoration Projection Layer

## Decision Status

Status: active staged architecture. Compatibility range persistence, canonical mark schema/projection, compatibility mark save-sync, the projection selector, the textarea-host boundary, and the accepted-issue `diagnostic` projection source are implemented. A shared anchored manuscript-suggestion DTO is staged, but no `suggestion` projection channel exists yet.

This document defines how manuscript styling, anchored author records, AI suggestions, and runtime editor visuals must integrate without making the editor rendering engine the owner of project data.

## Decision Summary

The application must maintain four separate concepts:

1. Canonical manuscript content and author-applied marks.
2. Durable anchored domain records that can be projected visually.
3. Reviewable AI suggestions that may propose records or marks.
4. Ephemeral editor projections used only while a surface is open.

The editor canvas may render all four as visual decoration ranges, but they must not share one persistence model or lifecycle.

For the current plain-text, IDE-like manuscript surface, the next implementation step is not an editor-library swap. The application must first own anchor drift handling: live edit transactions update durable anchors, hashes validate saved anchors on load, and bounded context recovers stale offsets. A future editor adapter can improve rendering mechanics, but it must not become the source of truth for anchors or decorations.

ProseMirror remains a valid later option only if product requirements intentionally change the canonical manuscript into a rich document tree whose marks and block structure are owned by a schema. That is a more invasive domain decision and should not be made to solve highlighting alone.

## Why This Boundary Matters

The product is not merely displaying colored text. The same manuscript passage may simultaneously carry:

- author emphasis intended for export, such as bold or italic
- an inspiration note created by the author
- an unresolved task linked to a passage
- a local-AI clarity suggestion awaiting review
- a spellcheck underline
- a temporary search result or hover preview
- a narration follow position

Those visuals overlap in the editor, but their meanings differ:

| Concern | Durable? | Canonical owner | May AI read it? | May AI mutate it directly? |
| --- | --- | --- | --- | --- |
| Manuscript text | Yes | `packages/manuscript-schema` / project persistence | Yes | No |
| Author formatting marks | Yes | manuscript schema / scene content record | Yes | No |
| Author note or task | Yes | anchored record schema / project persistence | Yes | No |
| Accepted issue or event record | Yes | anchored record schema | Yes | No |
| AI suggestion queue item | Persistable workflow state | analysis service contracts | Yes | It creates proposals only |
| Spellcheck underline | No | editor projection feature | Not as project truth | No |
| Search/selection/hover highlight | No | editor runtime state | No | No |
| Narration live tracking glow | No, unless saved as a session result | audio feature projection | Only through saved alignment state | No |

If those are stored as a single set of editor ranges, save files cannot state what must survive, AI cannot safely reason about accepted versus temporary data, and desktop migration becomes tied to a browser UI implementation.

## Current Repository Evidence

The current repository already contains useful parts of this design:

- `packages/manuscript-schema` owns canonical anchors, `IssueRecord`, and `EventTag`.
- `services/analysis` emits anchor-backed analysis results instead of editing DOM state.
- `ProjectPersistenceService` owns save/load/autosave workflow boundaries.
- `apps/editor/public/features/manuscript-editor/manuscript-command-controller.js` models inline formatting as ranges rather than inserting HTML into manuscript text.
- `apps/editor/public/features/manuscript-editor/editor-host-interface.js` now normalizes scene text and render-only projections before an editor implementation receives them.
- `apps/editor/public/adapters/editor-host/textarea-editor-host.js` now contains the existing textarea-overlay markup and paints author-mark, accepted diagnostic, active anchored-record preview, spellcheck, search, and narration-follow projections without persisting them.

The interrupted implementation also revealed a gap:

- `inlineFormatRanges` is created in scene runtime state and rendered by the scene editor.
- Before the compatibility correction accompanying this decision, `normalizeSceneDraft()` removed that field while persisting scene chunks, so user formatting did not reliably survive a refresh or project file round trip.
- The existing field describes author formatting, but its name looks like an editor projection. It should be migrated to a canonical mark type rather than expanded into a generic decoration store.

## Terminology

### Manuscript Mark

A durable author-approved styling instruction attached to a canonical manuscript span. Examples:

- emphasis: bold or italic
- underline, when explicitly part of author content
- highlight, only when the author intends a durable manuscript mark

A mark changes how manuscript content is presented or exported. It is not an issue, comment, AI suggestion, or hover state.

### Anchored Record

A durable domain object linked to a manuscript anchor. Examples:

- task
- inspiration note
- research note
- issue record
- event tag
- accepted continuity warning

It has identity, provenance, lifecycle, and anchor recovery rules. Its editor highlight is derived output.

### Suggestion

A proposed change or record returned by local or hosted analysis. A suggestion may carry evidence anchors and a proposed mark/record, but it cannot modify canonical project data until the author accepts it.

Current scope note: the implemented workspace `suggestionQueue` contains world-template/entity/link and Dream Scaping proposals. Those records may carry evidence anchors for review, but they are not manuscript-range suggestion records and must not be sent to a manuscript `suggestion` projection channel. `packages/shared-types` now defines `AnchoredManuscriptSuggestion` for future manuscript-range proposals; the editor still must not paint those proposals until a dedicated source, review queue, and accept/reject commands are implemented.

### Projection

A render-time descriptor that tells the active editor surface how to display a concern. Projections may be derived from marks, records, suggestions, or runtime UI state. They are disposable and can be rebuilt from their source.

## Target Domain Model

The canonical manuscript schema has a durable mark collection owned by manuscript content rather than by the editor adapter:

```ts
type ManuscriptMarkKind = "bold" | "italic" | "underline" | "strikethrough" | "highlight";
type ManuscriptAnchorStatus =
  | "resolved"
  | "shifted"
  | "contentChanged"
  | "approximate"
  | "stale"
  | "orphaned"
  | "deleted";

interface ManuscriptMark {
  id: string;
  kind: ManuscriptMarkKind;
  anchor: ManuscriptAnchor;
  source: "author" | "accepted-suggestion";
  anchorStatus: ManuscriptAnchorStatus;
  anchorDirtyReason: string;
  evidenceMode: "full" | "hash-context";
  evidenceExcerpt: string;
  originalHash: string;
  originalLength: number;
  selectedTextPreview: string;
  prefixContext: string;
  suffixContext: string;
  createdAt: string;
  updatedAt: string;
  anchorLastTouchedAt?: string;
  anchorLastTouchedByEditId?: string;
  metadata?: {
    colorToken?: string;
    purpose?: "emphasis" | "reference" | "revision";
  };
}
```

The mark uses `ManuscriptAnchor`, not a DOM range or editor-library position. For the browser prototype, `sceneDrafts[sceneId].inlineFormatRanges` remains a compatibility representation for inline formatting that has not yet moved to direct mark writes. Scene edit persistence now synchronizes those ranges into `workspace.project.marks` as `mark-inline-*` compatibility marks, and older project JSON normalizes missing `marks` to an empty canonical collection. The direct mutation planner is staged in the browser mark service: it can turn a scene selection into canonical `ManuscriptMark` additions, removals, or split fragments while preserving mark sequence state. User highlights and selected Bold marks now use that planner directly, render through author-mark projections, and user highlights appear in the Decorations side panel. The remaining migration is to move italic, underline, and strikethrough commands to the same direct mark path and keep legacy ranges only as a read fallback.

Durable author records should converge on a consistent anchor envelope:

```ts
interface AnchoredRecordReference {
  anchor: ManuscriptAnchor;
  evidenceExcerpt: string;
  anchorStatus: "active" | "recovered" | "partial" | "approximate" | "orphaned";
  source: "author" | "import" | "rule" | "local-ai" | "hosted-ai";
}
```

Tasks, notes, issues, and events retain their own domain fields and lifecycle. They do not become `ManuscriptMark` objects merely because the editor paints a range for them.

## Anchor Drift Contract

Anchor tracking is a three-layer pipeline:

1. Live edit tracking is the primary mechanism.
2. Load-time hash validation confirms whether saved offsets still point at the expected content.
3. Bounded context recovery attempts safe reattachment when offsets no longer validate.

The live layer must stay cheap. It should derive the edit transaction once, update only active-scene anchors whose offsets are affected, and avoid fuzzy searching or whole-scene validation while the user is typing. Pure offset shifts should preserve existing evidence metadata; overlap, replacement, and deletion are the only live paths that should refresh bounded evidence for the affected anchor.

Live edit tracking receives the edit transaction while the user is changing text:

```ts
interface ManuscriptEditTransaction {
  editId: string;
  sceneId: string;
  startOffset: number;
  endOffset: number;
  insertedText: string;
  deletedText: string;
}
```

`insertedText` and `deletedText` are runtime transaction fields. They exist so the anchor mutation service can shift or dirty anchors during the current edit; they are not anchor metadata and must not be saved in the project JSON. Durable inserted/deleted prose belongs only in revision/diff artifacts when a revision workflow explicitly records it.

Anchor metadata should avoid large duplicated manuscript excerpts:

```ts
interface AnchorEvidence {
  evidenceMode: "full" | "hash-context";
  originalHash: string;
  originalLength: number;
  selectedTextPreview: string;
  prefixContext: string;
  suffixContext: string;
}
```

Recommended limits:

- `selectedTextPreview`: 120-240 characters.
- `prefixContext`: 40-80 characters before the anchor.
- `suffixContext`: 40-80 characters after the anchor.
- `originalHash`: hash of the full anchored range.
- `originalLength`: original selected range length.

Use `evidenceMode: "full"` only for short selections where storing the complete selected text is safe. Use `evidenceMode: "hash-context"` for paragraph-sized highlights, revision ranges, comments, scene-level decorations, and any anchor that could bloat the project JSON.

Status values should distinguish renderable anchors from uncertain ones:

```ts
type AnchorStatus =
  | "resolved"
  | "shifted"
  | "contentChanged"
  | "approximate"
  | "stale"
  | "orphaned"
  | "deleted";
```

Projection rendering should accept only anchors whose current status is explicitly renderable for that channel. For example, a hover preview may show an `approximate` task with a warning treatment, while a revision-pass completion marker may require `resolved` or `shifted`.

### Live Versus Lazy Work

| Stage | Allowed work | Avoid |
| --- | --- | --- |
| Live typing | derive one transaction, shift affected active-scene offsets, mark overlaps dirty/contentChanged/deleted | fuzzy recovery, whole-scene scans, broad hash/context rewrites |
| Idle/load/navigation | validate hashes, attempt bounded context recovery, repair stale offsets, mark stale/orphaned | blocking editor input |
| Explicit repair/review | update uncertain records after user or service confirmation | silently reattaching low-confidence anchors |

## Projection Contract

The editor should consume a normalized render-only shape:

```ts
interface ManuscriptProjection {
  id: string;
  sceneId: string;
  startOffset: number;
  endOffset: number;
  channel:
    | "author-mark"
    | "task"
    | "note"
    | "diagnostic"
    | "suggestion"
    | "spellcheck"
    | "search"
    | "selection-preview"
    | "narration-follow";
  styleToken: string;
  priority: number;
  sourceRef?: {
    recordType: string;
    recordId: string;
  };
  persistence: "derived-durable" | "runtime-only";
}
```

Projection rules:

- The adapter accepts projections; it never persists them.
- Projection IDs refer back to marks or records where they are durable.
- Runtime-only projections are discarded on editor teardown, scene switch, or refresh.
- Overlap resolution is deterministic by channel and priority, not by whichever feature most recently wrote CSS.
- Offset mapping after edits is handled by the editor transaction adapter for rendering continuity, while durable updates are committed through domain commands and `ProjectPersistenceService`.

## Service Ownership

### `packages/manuscript-schema`

Should eventually own:

- `ManuscriptMark`
- canonical mark mutation and anchor resolution
- shared anchored-record reference/lifecycle primitives where appropriate
- validation that no durable record exists without a resolvable or explicitly orphaned anchor

### `services/analysis`

Should own:

- reading accepted manuscript marks and anchored records as optional context
- emitting evidence-backed suggestions
- proposing, but not applying, new marks or anchored records
- provider-neutral analysis contracts for local AI and optional hosted adapters

### `apps/editor/public/features/manuscript-editor`

Should own:

- author commands such as toggle bold or accept suggestion
- selecting projections needed for an open scene
- translating editor transactions into domain commands
- rendering adapter integration

It should not own canonical mark storage or file writes.

### `apps/editor/public/adapters/storage`

Should own:

- browser/desktop-compatible persistence transport
- save/load migration of compatibility data
- project snapshot round-trip tests

It should not decide what a highlight means.

### `apps/desktop`

Should later own:

- project-folder or database transport
- file watching, locking, backups, and recovery
- optional local-AI process lifecycle

It should consume the same persisted domain records and must not need to know how CodeMirror, ProseMirror, or another editor paints them.

## JSON Persistence Shape

During the browser prototype, all durable user data must remain in the active project JSON snapshot handled by `ProjectPersistenceService`. The existing chunk-aware snapshot can carry scene content in `sceneStore`, even when transported in one `.abe-project.json` file.

Recommended staged storage shape:

```json
{
  "schemaVersion": 3,
  "projects": [
    {
      "id": "project-1",
      "manuscriptTasks": [],
      "passageNotes": [],
      "manuscriptMarks": []
    }
  ],
  "sceneStore": {
    "project-1": {
      "scene-1": {
        "editorText": "The opening line.",
        "inlineFormatRanges": []
      }
    }
  }
}
```

Migration direction:

1. Preserve existing `inlineFormatRanges` on scene chunks now so current author-applied formatting is not lost.
2. Introduce canonical `manuscriptMarks` with anchor-backed records in a dedicated schema slice.
3. Migrate compatible scene ranges into marks when block/paragraph anchor mapping is available.
4. Continue reading legacy ranges during migration, but write canonical marks after the migration version is adopted.
5. Never store spellcheck, selection, hover, layout, or editor-library decoration objects in project JSON.

For the desktop port, the storage container may later become `project.json` plus scene files or a local database. The ownership model does not change: marks and records are durable; projections are rebuilt.

## Editor Engine Evaluation

### Continue The Textarea Overlay

Use only as the short-term compatibility implementation.

Benefits:

- no new dependency during the ongoing shell/persistence extraction
- existing command-controller tests remain useful

Limitations:

- each overlay must duplicate text layout exactly
- overlapping channels become fragile
- selection, composition input, accessibility, large documents, and edit remapping require custom handling
- adding AI diagnostics multiplies synchronization risk

Conclusion: retain only while establishing schema and adapter contracts.

### CodeMirror 6 Adapter

Optional later editor-host experiment.

Reasons:

- the present manuscript surface is fundamentally text-first and IDE-like
- state, transactions, ranges, and decoration channels align with the proposed projection contract
- extensions can compose spellcheck, diagnostics, author marks, search, and narration visuals without embedding them in text
- the editor remains a projection/runtime host; canonical project records stay application-owned

Constraint:

- CodeMirror addresses a flat text document. The adapter must translate between scene-local offsets and canonical `ManuscriptAnchor` identities rather than replacing the manuscript schema with editor offsets.
- Do not introduce it merely to test revision-pass or decoration workflows. Those workflows should first run against the app-owned anchor pipeline and current textarea host.

### ProseMirror Adapter

Do not adopt merely for decorations.

It becomes appropriate if the product chooses a canonical rich structural manuscript with schema-governed paragraphs and marks, where editing/export is centered on rich document operations. It would then naturally own runtime editing transactions, while the application still owns project identity, domain records, AI review policy, and persistence boundaries.

Cost now:

- it would force a broader content-model decision before the present plain-text/chunk/anchor migration is complete
- it risks conflating rich-content marks with diagnostics and workflow records

### Lexical Adapter

Not recommended for the current slice.

Lexical offers serializable immutable editor state and rich-text plugin surfaces, but adopting its editor-state JSON as project truth would create a second canonical document model beside the existing manuscript schema. It could be reconsidered only behind the same adapter contract after the domain model is established.

## Local AI Integration

The local AI service may leverage the layer through an explicit read/propose workflow:

1. A context assembler reads canonical manuscript blocks, accepted manuscript marks, anchored records, and relevant world/entity references.
2. It excludes transient projections such as current selection, hover, raw editor decoration sets, or spellcheck UI unless the author explicitly invokes a command that supplies selected context.
3. The provider returns `Suggestion` records with evidence anchors and a proposed action.
4. The editor displays suggestions via projection descriptors.
5. An author acceptance command converts the suggestion into a canonical mark, issue, task, event, or revision mutation.
6. `ProjectPersistenceService` persists the accepted mutation and autosave state.

Examples:

- AI may identify repeated emphasis and suggest removing an author mark.
- AI may suggest highlighting an unresolved clue as an event or research note.
- AI may show a temporary clarity warning decoration.
- AI may not silently insert formatting, attach research, or rewrite canonical anchors.

## Integration Flow

### Author Formatting

`toolbar command -> manuscript feature controller -> mark command -> canonical scene/mark mutation -> ProjectPersistenceService -> project JSON -> projection selector -> editor adapter decoration`

### Author Note Or Task

`selected passage -> anchored-record command -> canonical record persistence -> projection selector -> editor highlight and side-panel navigation`

### AI Suggestion

`analysis request -> provider adapter -> anchored suggestion queue -> temporary/persisted suggestion projection -> author accepts -> canonical mutation -> persistence`

### Desktop Port

`desktop transport adapter -> ProjectPersistenceService-compatible project repository -> same marks/records -> editor adapter projections`

## Failure Modes And Controls

| Failure mode | Control |
| --- | --- |
| Formatting is visible but disappears after reload | round-trip tests for scene compatibility data and canonical mark save-sync now; direct canonical command writes next |
| Spellcheck or hover range is saved as project truth | projection contract forbids runtime channels in JSON |
| AI silently changes author data | suggestion acceptance command required before canonical mutation |
| Editor-engine swap breaks anchors | engine adapter works from anchors/projections and never owns IDs |
| Text edits drift durable anchored records | canonical anchor resolution and recovery lifecycle, with user review for uncertain reattachment |
| Multiple highlights obscure manuscript readability | centralized projection priority/style policy |
| Desktop migration rewrites feature logic | persistence service and adapter boundaries remain stable while storage transport changes |

## Implementation Sequence

### Slice 0: Compatibility Correction

- Preserve the existing `inlineFormatRanges` field through current scene storage normalization.
- Add browser refresh and desktop snapshot assertions for that field.
- Describe it as a compatibility format, not the permanent decorations schema.

### Slice 1: Projection API - Implemented

- Add a manuscript projection selector/controller in `features/manuscript-editor`.
- Convert spellcheck and current formatting overlay reads to projection channels.
- Keep textarea rendering until parity tests pass.

Implemented evidence:

- `apps/editor/public/features/manuscript-editor/projection-selector.js`
- `apps/editor/public/features/manuscript-editor/editor-host-interface.js`
- `apps/editor/public/adapters/editor-host/textarea-editor-host.js`
- `test/manuscript-projection-selector.test.mjs`
- `test/manuscript-editor-host.test.mjs`

### Slice 1A: Anchored Diagnostic Projection - Implemented

- Derive `diagnostic` projections from durable `IssueRecord` anchors already accepted into the active project.
- Retain issue-console records as the navigation and lifecycle owner; the projection selector emits only disposable render descriptors.
- Do not feed worldbuilding or Dream Scaping proposal records into manuscript projections.
- Add tests for valid/invalid issue anchors, projection priority, host rendering behavior, and persistence exclusion.

Implemented evidence:

- `apps/editor/public/features/manuscript-editor/projection-selector.js`
- `apps/editor/public/adapters/editor-host/textarea-editor-host.js`
- `apps/editor/public/features/scene-editor.js`
- `apps/editor/public/app.js`
- `test/manuscript-projection-selector.test.mjs`
- `test/manuscript-editor-host.test.mjs`
- `test/project-refresh-persistence.test.mjs`

### Slice 1B: Anchored Manuscript Suggestion DTO - Staged

- Define `AnchoredManuscriptSuggestion` in `packages/shared-types` with review state, source identity, evidence anchor, proposed action, and accepted/rejected lifecycle fields.
- Keep world-template/entity/link and Dream Scaping proposal queues separate from manuscript-range suggestion projections.
- Do not add a `suggestion` projection channel until the editor has a dedicated manuscript-suggestion source and explicit accept/reject commands.

### Slice 2: Canonical Marks - User Highlight Path Implemented

- Add `ManuscriptMark` to `packages/manuscript-schema`. Implemented with anchor status and bounded evidence fields so marks can use the Phase 7 drift/validation lifecycle rather than an editor decoration store.
- Add mark mutation tests. Implemented in `test/manuscript-schema.test.mjs`.
- Add browser-side compatibility conversion from `inlineFormatRanges` to schema-shaped marks. Implemented in `features/manuscript-editor/manuscript-mark-service.js`.
- Prefer explicit `manuscriptMarks` in projection selection, derive marks from legacy ranges when explicit marks are absent, suppress duplicate derived projections when compatibility marks already exist, and fall back to range projections only when a range cannot be mapped to a stable block anchor.
- Add project JSON migration for saved projects that predate canonical marks. Implemented by defaulting missing `workspace.project.marks` to `[]`.
- Synchronize current scene compatibility ranges into `workspace.project.marks` before scene persistence. Implemented by replacing only `mark-inline-*` compatibility marks for the edited scene while preserving future canonical marks.
- Add a direct mark mutation planner for selected manuscript ranges. Implemented in `toggleManuscriptMarksForSceneSelection`, including sequence allocation, cross-block mark creation, full toggle-off removal, partial split fragments, and bounded evidence refresh.
- Move author highlight and Bold writes from scene compatibility ranges to canonical marks by wiring the toolbar commands to the planner. Implemented for user highlights and selected Bold marks.
- Render user highlights from author-mark projections after textarea layout refresh. Implemented in the textarea host boundary.
- Add a Decorations side-panel list for canonical user highlights with jump and delete actions. Implemented in `features/manuscript-decorations/user-highlight-panel.js`.
- Move the remaining italic, underline, and strikethrough author formatting writes from scene compatibility ranges to canonical marks. Remaining.

### Slice 3: Durable Record Alignment

- Promote tasks and passage notes to canonical anchor-bearing records.
- Render their visual states only through projections.
- Add orphan/recovery persistence tests.

### Slice 4: Anchor Drift Pipeline - Implemented For Current Owners

- Add `features/manuscript-anchors/*` services for anchor DTO normalization, edit transaction derivation, live mutation, load-time validation, bounded context recovery, active-scene anchor indexing, and decoration projection planning.
- Update `ManuscriptInputController` integration so scene text edits produce an edit transaction before projections are refreshed.
- Route task/note project activation and navigation repair through the shared anchor record service so load/lazy validation can add bounded evidence, recover legacy selected-text anchors, or suppress stale anchors without each feature owning its own recovery policy.
- Seed newly created task/note records with bounded hash/context evidence while keeping render projections disposable.
- Update issue/task/note/event/narration owners to expose anchor records to the anchor index rather than each feature inventing its own highlight store.
- Route future revision-pass marker records through `updateCanonicalAnchorRecordsForTextEdit` and the existing `revisionMarkers` index input when a durable revision-marker collection is introduced.
- Persist updated anchor status and bounded evidence metadata through `ProjectPersistenceService`; never persist projection objects.
- Add tests for insert-before, delete-before, edit-inside, range replacement, deleted anchors, multi-anchor overlap, hash mismatch, context recovery, and stale/orphaned handling.

Implemented evidence:

- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-edit-transaction-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-mutation-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-validation-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-index-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-decoration-projection-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-record-service.js`
- `apps/editor/public/features/manuscript-anchors/manuscript-anchor-idle-validation-scheduler.js`
- `packages/manuscript-schema/src/index.ts`
- `apps/editor/public/features/manuscript-editor/manuscript-mark-service.js`
- `apps/editor/public/features/manuscript-editor/projection-selector.js`
- `apps/editor/public/features/manuscript-editor/anchored-record-navigation-controller.js`
- `apps/editor/public/features/anchored-records/anchored-record-service.js`
- `apps/editor/public/features/anchored-records/anchored-record-controller.js`
- `apps/editor/public/app.js`
- `test/manuscript-anchor-services.test.mjs`
- `test/anchored-record-navigation-controller.test.mjs`
- `test/anchored-record-service.test.mjs`
- `test/anchored-record-controller.test.mjs`

### Slice 5: CodeMirror Experiment - Deferred

- Extend the established editor-host interface with a CodeMirror-backed implementation for one scene.
- Map application projections into CodeMirror decoration extensions.
- Route edits back through manuscript commands and persistence services.
- Keep the textarea host as fallback until save/load, IME, navigation, spellcheck, and autosave behavior are validated.

### Slice 6: AI Consumption

- Define analysis context and suggestion contracts for marks/records.
- Project AI proposals visibly without mutation.
- Add accept/reject/audit tests.

## Architecture Review

This design improves on simply adopting an editor library because it makes domain ownership explicit before swapping renderers. It improves on the present overlay because it prevents every new feature from inventing its own offset lifecycle and persistence policy.

The remaining deliberate limitation is staged migration: the current browser implementation still writes `inlineFormatRanges` until the editor command path and project JSON migration write canonical marks. The projection path now consumes explicit `ManuscriptMark` records when present and otherwise derives schema-shaped marks from legacy ranges, so new durable decoration creation should target `ManuscriptMark` or another domain record rather than a generic editor-owned decoration collection.

## Reference Material

- CodeMirror System Guide: `https://codemirror.net/docs/guide/`
- ProseMirror Reference Manual: `https://prosemirror.net/docs/ref/`
- Lexical Editor State: `https://facebook-lexical.mintlify.app/concepts/editor-state`
