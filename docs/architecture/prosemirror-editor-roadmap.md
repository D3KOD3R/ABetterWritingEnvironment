# ProseMirror Manuscript Editor Roadmap

## Decision Status

Status: accepted implementation direction.

Baseline:

- Commit: `af27fc0` (`Snapshot before ProseMirror editor work`)
- Tag: `pre-prosemirror-2026-06-14`
- Baseline verification: `66` tests passed

ProseMirror will replace the textarea-overlay implementation as the primary manuscript editing engine. This is a controlled editor-host migration, not a transfer of project ownership to an editor library.

## Why This Fits The Product

The manuscript is already modeled as structured, addressable content:

- projects contain chapters and scenes
- scenes contain stable narration and dialogue blocks
- blocks carry stable block and paragraph IDs
- author formatting is represented as canonical marks
- issues, tasks, notes, events, narration, and voice records use manuscript anchors
- render-only projections are separated from durable records

The textarea host cannot render inline typography without duplicating text into overlays. That makes bold and italic visually fragile and forces the application to reimplement layout, selection, and decoration behavior.

ProseMirror provides a schema-governed editable document, transactions, position mapping, marks, selections, history, clipboard handling, and decorations. Those capabilities match the manuscript surface, while the existing application services remain responsible for durable identity, anchors, persistence, AI review, and cross-feature workflows.

## Non-Negotiable Ownership Boundary

### ProseMirror Owns

ProseMirror owns runtime behavior for the currently mounted manuscript scene:

- the live `EditorState` and `EditorView`
- the runtime document tree for the open scene
- browser DOM rendering for editable manuscript content
- caret, selection, keyboard navigation, clipboard, drag, and IME behavior
- transaction steps and position mapping within the active editor session
- stored marks used while typing
- undo and redo history for the mounted editing session
- runtime `DecorationSet` instances
- plugin state that can be rebuilt from canonical project state
- node views whose purpose is presentation or editor interaction

### ProseMirror Does Not Own

ProseMirror must not own:

- project, chapter, scene, block, paragraph, character, issue, event, task, note, narration, or voice identity
- allocation policy for durable IDs
- the `.abe-project.json` persistence shape
- project save, load, autosave, migration, backup, or recovery policy
- canonical `ManuscriptAnchor` records
- anchor evidence, validation, recovery, dirty status, or orphan handling
- accepted `ManuscriptMark` identity and lifecycle
- analysis suggestions or their accept/reject lifecycle
- revision history or audit records
- audio, narration, voice, or worldbuilding domain state
- service provider selection
- canonical export or import semantics

No ProseMirror `Node`, `Mark`, `Step`, `Selection`, plugin state, DOM node, or `DecorationSet` may be written directly into project persistence.

## Application Ownership

| Concern | Canonical owner | ProseMirror role |
| --- | --- | --- |
| Project hierarchy | `packages/manuscript-schema` | render one selected scene |
| Scene blocks | `packages/manuscript-schema` and project state | runtime node representation |
| Stable IDs | manuscript domain commands | carry IDs in node/mark attributes |
| Author formatting | canonical `ManuscriptMark` records | render and edit equivalent runtime marks |
| Issues, tasks, notes, and events | feature/domain records with anchors | render derived decorations |
| Anchor drift | `features/manuscript-anchors/*` | provide precise transaction mapping input |
| Runtime selection | editor host | expose host-neutral selection snapshots |
| Saved selection defaults | project state/persistence | convert selection to scene/block offsets |
| Undo/redo | ProseMirror history while mounted | never substitute for durable revisions |
| Revisions | revision feature and persistence | emit accepted edit transactions as evidence |
| Spellcheck/search/narration visuals | projection sources | render runtime decorations |
| Save/load/autosave | `ProjectPersistenceService` | provide current canonical mutation results |
| AI suggestions | analysis contracts and review commands | display review-only decorations |

## Feature Impact And Parity Matrix

The migration is not complete when typing and marks work. Each existing feature must cross the
new host boundary without importing ProseMirror types into its domain model.

| Feature area | Required editor capability | Durable owner | Earliest phase | Cutover evidence |
| --- | --- | --- | --- | --- |
| `1.1` diagnostics console | Anchored decorations, selection navigation, fix commands | Issue and projection services | PM-5 | Findings stay aligned after typing, paste, split, merge, undo, and redo |
| `1.2`, `1.6` scene insertion and binder | Flush accepted edits before scene create, switch, move, or delete | Binder and editor-model services | PM-3 | No edit loss or cross-scene transaction leakage |
| `1.3` spellcheck | Incremental decorations, active-word suppression, context-menu commands | Spellcheck and dictionary services | PM-5 | Add-to-dictionary and replacement work without rebuilding the view |
| `1.4` find and replace | Host-neutral range selection and canonical replacement commands | Search service | PM-6 | Replace-all edits inactive scenes without mounting hidden editor views |
| `1.5` tasks, inspiration, and research | Selection-to-anchor conversion, widgets, anchored navigation | Draft-record services | PM-5 | Records survive edits and their bubbles do not become document nodes |
| `1.7` focus and navigation | Focus, caret, bookmark, viewport, gutter, and scroll APIs | Editor host and shell | PM-2 | Pane switching and line navigation preserve the expected caret and viewport |
| `1.8` writing targets and sessions | Accepted canonical text deltas and edit-origin metadata | Metrics and session services | PM-3 | Counts and idle-session behavior do not read DOM or ProseMirror state directly |
| `1.9` revision banking | Accepted canonical operations grouped into user actions | Revision service | PM-3 | Undo history and durable revisions remain separate and deterministic |
| `1.10` inline formatting | Mark commands, toolbar state, paste normalization | Mark service | PM-4 | Bold, italic, underline, strikeout, and highlight round-trip without overlays |
| `1.11` anchor drift | Transaction-derived text and structure changes | Anchor service | PM-3 | Block-local ranges map through structural and text edits |
| `2.x` local AI | Canonical snapshots, anchored review suggestions, accept/reject commands | AI and review services | PM-5 | AI cannot mutate the document outside the canonical command path |
| `3.x` events | Anchored projections and range navigation | Event services | PM-5 | Event pins and tags remain stable through edits |
| `4.x` narration | Selection capture, follow decorations, recording edit gates | Narration service | PM-5 | Recording, takes, and follow state survive editor transactions safely |
| `4.5` mobile dictation | Host-neutral accepted-transcript command | Dictation and application services | PM-3 | Mobile code has no ProseMirror dependency |
| `5.x` voices | Stable block identity and speaker assignment | Voice and speaker services | PM-1 | Dialogue split, merge, paste, and conversion have explicit identity rules |
| `6.x`, `7.x` world and dream workspaces | Editor lifecycle isolation and canonical navigation targets | Workspace services | PM-2 | Workspace switching cannot retain or merge stale editor plugin state |
| `8.x` persistence and metrics | Canonical serialization, activation flush, autosave hooks | Project, cache, and metrics services | PM-3 | Persistence packages contain no ProseMirror state or DOM serialization |

Any feature without cutover evidence remains on the legacy host, even if the default editor has
moved to ProseMirror for simpler workflows.

## Canonical And Runtime Document Contract

The application schema remains library-neutral. The ProseMirror schema is an adapter-level runtime schema that maps deterministically to canonical scene data.

Initial runtime nodes:

```text
doc
  (narration_block | dialogue_block)*
```

Initial block attributes:

```text
blockId
paragraphId
speakerId?
```

The active `sceneId` belongs to the host context and transaction DTO. Repeating it on every block
would create a second value that could drift during scene switches.

Initial runtime marks:

```text
bold
italic
underline
strikethrough
highlight
```

The first migration must not add headings, lists, tables, embedded media, or arbitrary HTML. New document structures require a separate manuscript-schema decision and persistence migration.

### Mapping Rules

1. Canonical scene blocks create the initial ProseMirror document.
2. Stable IDs are copied into node attributes.
3. Canonical author marks become ProseMirror marks.
4. Anchored records become decorations, not document nodes or marks.
5. A ProseMirror transaction is translated into library-neutral manuscript edit operations.
6. Domain commands update canonical blocks, marks, anchors, and revision state.
7. Project state is updated synchronously before autosave or analysis effects run.
8. Project persistence serializes only canonical application data.

Block-local offsets remain the durable anchor coordinate system. ProseMirror document positions are runtime coordinates and must be translated through the adapter.

### Scene And Block Structure Policy

One scene maps to one mounted `EditorView`. Chapters and projects must not be represented as a
single large ProseMirror document.

An empty canonical scene may be presented as one provisional empty narration block. The
application allocates its durable block ID when the first accepted content or explicit block
command is committed. Provisional IDs must never be persisted, exposed to feature records, or
used as anchor targets.

Structural editing rules must be implemented and tested before editable cutover:

- Enter in a narration block keeps the existing ID on the left block and allocates a new
  application ID for the right narration block.
- Enter in a dialogue block keeps the existing ID on the left block and creates a right dialogue
  block with the same speaker assignment. Changing back to narration is an explicit command.
- Backspace or Delete may merge blocks of the same semantic type. The leading block keeps its
  ID and the anchor service maps ranges from the removed block.
- A narration block and dialogue block must not merge through a generic ProseMirror join. The
  application must run an explicit conversion command so speaker metadata is not silently lost.
- Block type and speaker assignment are never inferred from typography or DOM structure.
- Pasted clipboard IDs, speaker IDs, and application metadata are ignored. The application
  allocates new identities for inserted blocks.
- Plain-text multi-paragraph paste creates blocks using the current block's semantic type.
  Rich paste is reduced to the supported schema and mark set.
- Scene switch, scene creation, binder move, and scene deletion must flush or reject pending
  editor transactions before changing the selected scene.

These rules are domain policy. ProseMirror commands may implement them, but they do not define
them.

### Paste And DOM Parsing Policy

DOM parsing is an input adapter, not a persistence format. Paste and drop handlers must whitelist
schema nodes, marks, and approved attributes; strip scripts, event handlers, arbitrary styles,
foreign IDs, and unsupported links; and normalize whitespace without changing supported Unicode,
smart quotes, or paragraph boundaries.

Export and project persistence continue to serialize the canonical manuscript model rather than
the ProseMirror DOM.

## Single-Source-Of-Truth Barrier

The open `EditorState.doc` is authoritative only during dispatch of the active editor transaction. The application must synchronously accept and reduce that transaction into canonical scene state.

The integration must not allow two independently editable copies of a scene:

- shell code must not mutate `textarea.value` or a hidden editor copy
- feature commands must not update project text without dispatching through the active editor host
- autosave must not read ProseMirror JSON directly
- analysis, narration, metrics, and revision services must read accepted canonical snapshots,
  not the live ProseMirror document
- shell rerenders must not recreate the editor view for ordinary typing

If transaction translation fails, the application must report the failure and avoid persisting a partially translated document.

## Transaction Boundary

The adapter should expose a host-neutral transaction result:

```ts
interface ManuscriptHostTransaction {
  sceneId: string;
  transactionId: string;
  canonicalRevision: number;
  previousText: string;
  nextText: string;
  blockOperations: ManuscriptBlockOperation[];
  markOperations: ManuscriptMarkOperation[];
  selection: ManuscriptSelectionSnapshot;
  origin:
    | "typing"
    | "paste"
    | "toolbar"
    | "context-menu"
    | "ai-acceptance"
    | "dictation"
    | "command"
    | "undo"
    | "redo";
  compositionId?: string;
  historyGroupId: string;
  timestamp: string;
}
```

ProseMirror steps and mappings may be used inside the adapter, but feature and persistence services receive only repository-owned DTOs.

The existing text-diff transaction service remains useful for:

- imported content
- edits performed outside the active ProseMirror host
- migration validation
- fallback comparison tests

It should not remain the primary typing transaction source after ProseMirror cutover.

Writing metrics, session tracking, and revision banking consume accepted canonical operations,
not every internal ProseMirror transaction. `historyGroupId` groups low-level transactions into
one author action. ProseMirror history remains runtime undo/redo state; it is not the durable
revision ledger.

## Editor Host Capability Contract

The existing render-oriented host interface must expand before editable integration. Feature
services may depend on these host-neutral capabilities:

- mount, update from a canonical snapshot, flush, and destroy
- focus and report focus state
- read a canonical selection and select a canonical range
- capture and restore a canonical caret bookmark
- scroll to an anchor or block and report the visible canonical range
- dispatch text, structural, and mark commands
- report IME composition and pending-transaction state
- expose toolbar command state without returning ProseMirror objects
- register accepted-transaction and viewport callbacks

The interface must not expose `EditorState`, `EditorView`, `Transaction`, `Step`, DOM nodes, or
ProseMirror positions.

Editor-local shortcuts such as mark toggles and block commands may be implemented with a
ProseMirror keymap. Application-wide shortcuts, binder commands, workspace navigation, and
save/export commands remain shell-owned. Context menus capture a canonical selection snapshot
before browser focus moves away from the editor.

Cumulative and wrapped line numbers are presentation data calculated by the active host. They
must not become persisted anchor coordinates. Durable navigation resolves a scene, block, and
block-local offset first; the host may then report or scroll to the corresponding visual line.

## Anchor Boundary

ProseMirror position mapping improves live accuracy but does not replace durable anchors.

Runtime flow:

1. ProseMirror maps active document positions through transaction steps.
2. The transaction adapter emits block-local edit operations.
3. `features/manuscript-anchors/*` updates durable anchor offsets and statuses.
4. Canonical anchor changes are committed to project state.
5. Projection selectors rebuild editor decorations from the updated records.

Load-time hash validation and bounded-context recovery remain application responsibilities because editor mappings do not survive closed sessions, imports, external file edits, or failed migrations.

## Mark Boundary

Author formatting is document semantics, but its durable identity remains application-owned.

Rules:

- toolbar commands use the manuscript command service
- domain commands allocate durable mark IDs
- ProseMirror marks may carry a canonical `markId` attribute where identity is required
- cross-block marks are split into block-local canonical marks
- ProseMirror stored marks may control typing behavior, but accepted changes must synchronize canonical marks
- highlight, bold, italic, underline, and strikethrough must use one mutation path
- legacy `inlineFormatRanges` becomes read-only migration input and is not written after cutover

Mark reconciliation after an accepted transaction must follow deterministic identity rules:

- unchanged coverage preserves its existing ID
- a split mark keeps the existing ID on the leading fragment and allocates IDs for later
  fragments
- deleted coverage removes the corresponding durable records
- new formatting uses the application ID allocator
- overlapping mark kinds retain independent identities
- merges occur only through an application rule with a deterministic surviving ID

ProseMirror mark equality, DOM elements, and generated class names must not become durable mark
identity.

A mark round-trip test must prove:

```text
canonical scene -> ProseMirror document -> canonical scene
```

preserves text, block IDs, paragraph IDs, mark kind, mark coverage, and durable mark identity.

## Projection Boundary

The existing `ManuscriptProjection` contract remains the application-facing visual API.

The ProseMirror projection plugin maps projections to decorations:

- author marks map to document marks, not overlay glyph copies
- diagnostics map to inline decorations
- task and note previews map to inline decorations
- spellcheck maps to inline decorations
- search maps to inline decorations
- narration follow maps to inline decorations or node decorations
- future suggestions map to review-only decorations

Projection DTOs remain disposable. `DecorationSet` instances are adapter-owned runtime state and are never persisted.

## Implementation Phases

During PM-1 through PM-3, new manuscript behavior must enter through host-neutral commands,
canonical records, or projections. Do not add new textarea-only overlay behavior that would have
to be migrated immediately. World, dream, audio, and other workspace work may continue when it
does not bypass the editor-host or canonical command boundaries.

### Phase PM-0: Baseline And Decision - Complete

Deliverables:

- snapshot commit and annotated pre-ProseMirror tag
- passing baseline test suite
- accepted ownership decision

Barrier:

- no ProseMirror implementation starts without a recoverable baseline

### Phase PM-1: Runtime Schema And Mapping Contract

Deliverables:

- direct ProseMirror dependencies under the editor application
- `prosemirror-schema.js`
- canonical scene-to-ProseMirror document converter
- ProseMirror document-to-canonical scene converter
- block-position and block-offset mapping helpers
- scene and block structure policy commands
- clipboard sanitization and normalization
- fixture tests for narration, dialogue, empty blocks, Unicode, punctuation, and existing marks

Barrier:

- deterministic round-trip preserves text, structure, stable IDs, and marks
- split, merge, paste, and block-conversion fixtures prove deterministic ID and speaker behavior
- no ProseMirror object appears in a persisted project snapshot
- no Tiptap or other wrapper is introduced during the first adapter
- numeric input, mount, scene-switch, and large-scene performance budgets are recorded before
  PM-3 begins

### Phase PM-2: Read-Only Host Pilot

Deliverables:

- `PROSEMIRROR` editor-host kind
- one persistent `EditorView` mounted for the selected scene
- read-only rendering from canonical blocks and marks
- typography and width preference mapping
- expanded host-neutral focus, selection, viewport, command, flush, and lifecycle capabilities
- feature flag selecting textarea or ProseMirror host

Barrier:

- switching hosts does not mutate project data
- line wrapping, block order, typography, and scroll behavior match accepted editor behavior
- scene switching destroys the previous view and releases plugin resources
- project and workspace activation cannot carry plugin state into the next scene

### Phase PM-3: Editing Transaction Bridge

Deliverables:

- `dispatchTransaction` adapter
- library-neutral transaction DTO
- canonical block mutation planning
- selection snapshot translation
- autosave dirty-domain integration
- scene-switch and binder-operation flush handling
- transaction provenance and history grouping
- writing target, session tracker, and revision-service integration
- accepted-transcript and application-command entry points
- persistent view updates that do not require full shell rerenders

Required cases:

- insert and delete within a block
- split a block with Enter
- merge blocks with Backspace/Delete
- multi-block selection replacement
- paste plain and rich text
- Unicode and smart punctuation
- IME composition
- undo and redo

Barrier:

- every accepted transaction updates canonical scene state exactly once
- undo/redo updates canonical state and anchors, but does not create false revision records
- autosave reload reproduces the same document
- normal typing does not recreate `EditorView`
- metrics and revisions consume canonical operations without importing ProseMirror
- active narration recording either blocks destructive structural commands or applies a tested
  re-anchor policy

### Phase PM-4: Canonical Author Marks

Deliverables:

- bold, italic, underline, strikethrough, and highlight ProseMirror marks
- canonical mark identity synchronization
- stored-mark toolbar state
- removal of visible text-format overlays
- remaining compatibility formatting migrated to direct canonical mark commands
- toolbar and context-menu focus retention

Barrier:

- italic plus highlight renders one set of glyphs with no overlap
- mark application, removal, splitting, typing continuation, undo, redo, save, and reload pass
- `inlineFormatRanges` is no longer written

### Phase PM-5: Projection Plugins

Deliverables:

- projection-to-decoration plugin
- diagnostics, task, note, spellcheck, search, and narration channels
- deterministic overlap and priority styling
- incremental decoration mapping through transactions
- block-local narration and voice anchor mapping

Barrier:

- runtime projections never enter project JSON
- stale or unresolved anchors do not render
- projection refresh does not replace editor state, selection, or history
- large projection sets remain responsive

### Phase PM-6: Workflow Parity

Deliverables:

- find and replace
- anchored-record navigation and previews
- context menus and note/task creation
- saved selection restoration
- line-aware navigation and gutter behavior
- scene title editing outside the editor view
- narration selection and follow mode
- revision capture integration
- spellcheck context actions
- cross-scene replace without hidden ProseMirror views
- scene insertion and binder operations
- writing targets and session timing
- narration recording and take navigation
- voice assignment and render controls
- local AI review and acceptance
- event pin and tag navigation
- workspace pane switching and project activation

Barrier:

- all existing manuscript workflows pass host-neutral contract tests
- keyboard-only and screen-reader smoke tests pass
- clipboard and IME checks pass on supported desktop browser engines
- no feature reaches into ProseMirror DOM directly
- every row in the feature impact and parity matrix has named automated or manual evidence

### Phase PM-7: Default Cutover

Deliverables:

- ProseMirror becomes the default manuscript host
- textarea host retained behind an explicit temporary fallback flag
- performance and memory comparison against the baseline
- migration and rollback documentation

Barrier:

- project save/load round-trip passes on existing fixtures
- no known author-data-loss defect
- no unresolved severity-one editor regression
- long-scene typing, selection, and decoration performance meet the agreed budget

### Phase PM-8: Compatibility Removal

Deliverables:

- remove textarea overlay rendering and synchronization
- remove compatibility formatting writes
- retain only migration readers needed for older project files
- simplify shell code that measured and repainted textarea layers

Barrier:

- fallback has completed an agreed stability period
- old project files still migrate successfully
- removal reduces code without moving domain ownership into ProseMirror plugins

## Hard Stop Barriers

Implementation must stop and correct course if any of these occur:

1. Project persistence starts storing ProseMirror JSON as the only manuscript truth.
2. Stable block or mark IDs are generated solely inside editor plugins.
3. Features mutate ProseMirror DOM directly.
4. Autosave reads from DOM or serializes plugin state.
5. Decorations become the source of durable tasks, notes, issues, or suggestions.
6. Anchor recovery is removed because runtime position mapping exists.
7. The editor view is recreated on every keystroke or global render.
8. Tiptap or another wrapper is added before direct ProseMirror contracts are understood and tested.
9. The textarea fallback is removed before persistence, IME, clipboard, selection, and workflow parity gates pass.
10. Provisional empty-block IDs escape into persisted or anchored records.
11. Paste can introduce unsupported DOM, arbitrary attributes, or foreign application record IDs.
12. Scene or binder operations can discard pending accepted edits.
13. Revision banking records ProseMirror internals instead of canonical operations.
14. Recording, narration, or voice anchors become ambiguous after structural edits.

## Proposed File Map

```text
apps/editor/public/
  features/
    manuscript-editor/
      editor-host-interface.js
      manuscript-command-controller.js
      manuscript-input-controller.js
      manuscript-selection-controller.js
      projection-selector.js
  adapters/
    editor-host/
      textarea-editor-host.js
      prosemirror/
        prosemirror-editor-host.js
        prosemirror-schema.js
        prosemirror-document-mapper.js
        prosemirror-transaction-adapter.js
        prosemirror-projection-plugin.js
        prosemirror-selection-adapter.js
        prosemirror-theme.js
```

The adapter folder may import ProseMirror packages. Domain packages and persistence adapters must not.

## Test Strategy

Required automated coverage:

- canonical/ProseMirror round-trip fixtures
- block split, merge, reorder, and replacement behavior
- mark identity and overlap behavior
- anchor updates from translated transactions
- undo/redo canonical synchronization
- project save/load/autosave round trips
- migration from `inlineFormatRanges`
- projection persistence exclusion
- selection and navigation adapter contracts
- editor view lifecycle and resource cleanup
- scene and binder mutation flushing
- transaction origin and history grouping
- writing metric and revision integration
- clipboard sanitization and foreign-ID rejection

Required browser-level coverage:

- italic plus highlight visual regression
- font, size, line-height, and width changes
- wrapped selections and caret placement
- copy/paste across blocks
- IME composition
- spellcheck and diagnostic overlap
- long-scene typing and scrolling performance
- active narration recording during permitted edits
- workspace switch and project activation lifecycle
- accessibility smoke checks

## Performance Budget

The migration should record baseline and ProseMirror measurements for:

- initial scene mount
- input latency
- scene switch latency
- decoration refresh
- memory after repeated scene switches
- long-scene scrolling
- rich-paste sanitization
- canonical transaction reduction
- autosave scheduling after accepted edits

The implementation must avoid full project serialization, full shell rendering, full document reconstruction, or complete decoration rebuilding on every keystroke.

Performance gates must use numeric thresholds agreed and recorded during PM-1. "Feels faster" is
not an acceptance criterion. Measurements must separate editor transaction time, canonical model
update time, projection refresh time, and persistence scheduling time.

## Commercial And Dependency Policy

Use the direct MIT-licensed ProseMirror packages required by the adapter. Retain third-party notices in distribution artifacts.

The initial dependency set should be limited to packages directly used by the adapter:
`prosemirror-model`, `prosemirror-state`, `prosemirror-view`, `prosemirror-transform`,
`prosemirror-history`, `prosemirror-commands`, and `prosemirror-keymap`. Add
`prosemirror-inputrules` only when a documented manuscript input rule requires it. Pin versions
through the repository lockfile and record notices from the installed versions.

Do not make core manuscript editing depend on:

- a hosted editor service
- a paid collaboration service
- a commercial-only wrapper
- network availability

Collaboration, hosted sync, and premium services may be added later through optional adapters without changing the local manuscript ownership model.

Real-time collaboration, collaborative step persistence, and Yjs integration are explicitly
outside this migration. They require a separate canonical conflict and identity protocol.

## Definition Of Done

The ProseMirror migration is complete when:

- the primary manuscript surface no longer uses textarea text overlays
- author formatting edits the actual rendered manuscript text
- canonical project data remains editor-library independent
- stable identities and anchors survive edit, save, reload, and migration
- all projection channels render without becoming durable editor state
- existing manuscript workflows meet parity gates
- the editor remains fully usable offline
- the textarea compatibility host and obsolete overlay code can be removed safely

## References

- ProseMirror Guide: `https://prosemirror.net/docs/guide/`
- ProseMirror Reference Manual: `https://prosemirror.net/docs/ref/`
- ProseMirror Examples: `https://prosemirror.net/examples/`
- ProseMirror core repository and license: `https://github.com/ProseMirror/prosemirror`
