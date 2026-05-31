# Manuscript Marks And Decoration Projection Layer

## Decision Status

Status: active staged architecture. Compatibility range persistence, the projection selector, the textarea-host boundary, and the accepted-issue `diagnostic` projection source are implemented. A shared anchored manuscript-suggestion DTO is staged, but no `suggestion` projection channel exists yet.

This document defines how manuscript styling, anchored author records, AI suggestions, and runtime editor visuals must integrate without making the editor rendering engine the owner of project data.

## Decision Summary

The application must maintain four separate concepts:

1. Canonical manuscript content and author-applied marks.
2. Durable anchored domain records that can be projected visually.
3. Reviewable AI suggestions that may propose records or marks.
4. Ephemeral editor projections used only while a surface is open.

The editor canvas may render all four as visual decoration ranges, but they must not share one persistence model or lifecycle.

For the current plain-text, IDE-like manuscript surface, a future CodeMirror 6 adapter is the best fit for replacing textarea overlays. It supports transaction-mapped ranges, composable decoration extensions, and a text-first editor without requiring the project to adopt an editor-owned rich document format.

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

The eventual canonical manuscript schema should add a durable mark collection owned by manuscript content rather than by the editor adapter:

```ts
type ManuscriptMarkKind = "bold" | "italic" | "underline" | "highlight";

interface ManuscriptMark {
  id: string;
  kind: ManuscriptMarkKind;
  anchor: ManuscriptAnchor;
  source: "author" | "accepted-suggestion";
  createdAt: string;
  updatedAt: string;
  metadata?: {
    colorToken?: string;
    purpose?: "emphasis" | "reference" | "revision";
  };
}
```

The mark uses `ManuscriptAnchor`, not a DOM range or editor-library position. For the browser prototype, `sceneDrafts[sceneId].inlineFormatRanges` remains a compatibility representation until the manuscript schema and scene-block persistence model are promoted together.

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

Recommended next editor-host experiment.

Reasons:

- the present manuscript surface is fundamentally text-first and IDE-like
- state, transactions, ranges, and decoration channels align with the proposed projection contract
- extensions can compose spellcheck, diagnostics, author marks, search, and narration visuals without embedding them in text
- the editor remains a projection/runtime host; canonical project records stay application-owned

Constraint:

- CodeMirror addresses a flat text document. The adapter must translate between scene-local offsets and canonical `ManuscriptAnchor` identities rather than replacing the manuscript schema with editor offsets.

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
| Formatting is visible but disappears after reload | round-trip tests for scene compatibility data now; canonical mark migration next |
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

### Slice 2: Canonical Marks

- Add `ManuscriptMark` to `packages/manuscript-schema`.
- Add mark mutation tests and project JSON migration.
- Move author formatting writes from scene compatibility ranges to canonical marks.

### Slice 3: Durable Record Alignment

- Promote tasks and passage notes to canonical anchor-bearing records.
- Render their visual states only through projections.
- Add orphan/recovery persistence tests.

### Slice 4: CodeMirror Experiment

- Extend the established editor-host interface with a CodeMirror-backed implementation for one scene.
- Map application projections into CodeMirror decoration extensions.
- Route edits back through manuscript commands and persistence services.
- Keep the textarea host as fallback until save/load, IME, navigation, spellcheck, and autosave behavior are validated.

### Slice 5: AI Consumption

- Define analysis context and suggestion contracts for marks/records.
- Project AI proposals visibly without mutation.
- Add accept/reject/audit tests.

## Architecture Review

This design improves on simply adopting an editor library because it makes domain ownership explicit before swapping renderers. It improves on the present overlay because it prevents every new feature from inventing its own offset lifecycle and persistence policy.

The remaining deliberate limitation is staged migration: the current browser implementation still uses `inlineFormatRanges` until canonical mark schema work is implemented. That compromise is acceptable only because the compatibility correction prevents data loss and the field is not being generalized into the durable annotation model.

## Reference Material

- CodeMirror System Guide: `https://codemirror.net/docs/guide/`
- ProseMirror Reference Manual: `https://prosemirror.net/docs/ref/`
- Lexical Editor State: `https://facebook-lexical.mintlify.app/concepts/editor-state`
