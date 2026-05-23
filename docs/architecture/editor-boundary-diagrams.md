# Editor Boundary Diagrams

## Purpose

These lightweight Mermaid diagrams record ownership and data-flow decisions needed during the editor-shell extraction. They describe the migration target and current compatibility boundaries; they are not a function-by-function UML inventory of `apps/editor/public/app.js`.

## Component Boundary

This view keeps feature UI, storage transport, canonical data, and provider services distinct while `app.js` is reduced to composition and compatibility wiring.

```mermaid
flowchart LR
  Author[Author] --> Desktop[apps/desktop<br/>desktop host and filesystem lifecycle]
  Desktop --> Editor[apps/editor<br/>bootstrap and shell]

  subgraph EditorSlices[Editor feature slices]
    Manuscript[manuscript-editor<br/>commands and projections]
    Spellcheck[spellcheck<br/>runtime projection source]
    Records[anchored-records<br/>tasks and passage notes]
    Revisions[revisions]
    Narration[narration and voice UI]
    World[world UI]
  end

  Editor --> Manuscript
  Editor --> Spellcheck
  Editor --> Records
  Editor --> Revisions
  Editor --> Narration
  Editor --> World

  Manuscript --> HostAdapter[editor-host adapter<br/>textarea now / CodeMirror experiment later]
  Spellcheck --> Manuscript
  Records --> Manuscript

  Editor --> Persistence[ProjectPersistenceService]
  Records --> Persistence
  Manuscript --> Persistence
  Revisions --> Persistence
  Persistence --> Snapshot[(.abe-project.json<br/>current durable truth)]
  Persistence -. future transport .-> Folder[(desktop project folder<br/>or local database)]

  Manuscript --> ManuscriptSchema[packages/manuscript-schema]
  Records --> ManuscriptSchema
  World --> WorldSchema[packages/world-schema]
  Narration --> Audio[services/audio]
  Narration --> Voice[services/voice]
  Manuscript --> Analysis[services/analysis]
  Analysis --> ManuscriptSchema
```

## Durable Edit And Persistence Sequence

The active JSON project file is the durable transport today. Cache may assist reopening, but cannot merge stale author data into a loaded project.

```mermaid
sequenceDiagram
  actor Author
  participant View as Manuscript View
  participant Controller as Manuscript Controller
  participant Store as Project State/Selectors
  participant Persistence as ProjectPersistenceService
  participant Cache as Browser Cache
  participant File as .abe-project.json

  Author->>View: edit scene or accept durable command
  View->>Controller: text/mark/task/note mutation
  Controller->>Store: update active canonical project record
  Controller->>Persistence: commitCanonicalProjectMutation(domain)
  Persistence->>Cache: replace active project snapshot
  Persistence->>Persistence: mark autosave domain dirty
  Persistence->>File: autosave/manual save configured snapshot

  Author->>Persistence: load project file
  Persistence->>File: read snapshot
  Persistence->>Cache: clear/replace stale active cache
  Persistence->>Store: activate only loaded project data
  Store-->>View: rehydrate scene, marks, notes and tasks
```

## Durable Project Relationships

This is a conceptual ER/domain view for referential rules enforced in project JSON and schema code. It does not imply an existing relational database.

```mermaid
erDiagram
  PROJECT ||--o{ CHAPTER : contains
  CHAPTER ||--o{ SCENE : contains
  SCENE ||--o{ MANUSCRIPT_BLOCK : contains
  MANUSCRIPT_BLOCK ||--o{ MANUSCRIPT_ANCHOR : resolves
  PROJECT ||--o{ MANUSCRIPT_MARK : stores
  MANUSCRIPT_MARK }o--|| MANUSCRIPT_ANCHOR : styles
  PROJECT ||--o{ ISSUE_RECORD : stores
  ISSUE_RECORD }o--|| MANUSCRIPT_ANCHOR : diagnoses
  PROJECT ||--o{ EVENT_TAG : stores
  EVENT_TAG }o--|| MANUSCRIPT_ANCHOR : identifies
  PROJECT ||--o{ TASK : stores
  TASK }o--|| MANUSCRIPT_ANCHOR : targets
  PROJECT ||--o{ PASSAGE_NOTE : stores
  PASSAGE_NOTE }o--|| MANUSCRIPT_ANCHOR : annotates
  PROJECT ||--o{ NARRATION_SESSION : stores
  NARRATION_SESSION ||--o{ AUDIO_TAKE : records
  AUDIO_TAKE }o--|| MANUSCRIPT_ANCHOR : performs
  PROJECT ||--o{ VOICE_RENDER_JOB : queues
  VOICE_RENDER_JOB }o--|| MANUSCRIPT_ANCHOR : renders
  PROJECT ||--o{ TIMELINE_NODE : models
  PROJECT ||--o{ WORLD_ENTITY : models
  WORLD_ENTITY }o--o{ TIMELINE_NODE : appears_in
  TIMELINE_NODE }o--o{ MANUSCRIPT_ANCHOR : evidenced_by
```

Compatibility note: `inlineFormatRanges` currently persists author formatting within scene chunks until `MANUSCRIPT_MARK` is implemented as an anchor-backed canonical schema record.

## Projection And Suggestion Lifecycle

Only author-approved records and marks become durable project data. Editor channels used for review, diagnostics, spelling, selection, or narration remain reconstructable projections.

```mermaid
stateDiagram-v2
  [*] --> CanonicalText: scene loaded
  CanonicalText --> AuthorCommand: author formats or creates record
  AuthorCommand --> DurableRecord: persist approved mark/task/note/event
  DurableRecord --> Projection: derive visual channel

  CanonicalText --> AnalysisRequest: request local analysis
  AnalysisRequest --> Suggestion: evidence-backed proposal
  Suggestion --> Projection: display review channel
  Suggestion --> Rejected: author rejects
  Suggestion --> Accepted: author accepts
  Accepted --> DurableRecord: canonical mutation through persistence service

  CanonicalText --> RuntimeVisual: spellcheck/search/hover/live narration
  RuntimeVisual --> Projection: render while active
  Projection --> RuntimeVisual: rebuild after edit or scene switch
  RuntimeVisual --> [*]: discard on teardown
  Rejected --> [*]
```

## Maintenance Rule

Update these diagrams when ownership, the project persistence transport, canonical anchor relationships, or the suggestion acceptance lifecycle changes. Do not expand them to mirror temporary function layout inside `app.js`.
