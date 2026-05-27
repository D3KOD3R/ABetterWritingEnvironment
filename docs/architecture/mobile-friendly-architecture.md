# MobileFriendlyArchitecture

## Status

This document defines the planned architecture for a mobile-friendly authoring surface. It is a roadmap document, not a claim that a mobile host, mobile synchronization layer, or production dictation pipeline already exists.

The mobile surface is a companion to the full authoring environment. Its primary use case is a writer who is away from a desktop and speaks new prose into a phone, optionally using nearby manuscript context before recording, then reviews the transcription and safely adds it to the manuscript.

## Product Goal

The mobile version should make this contextual workflow fast and dependable, while also allowing capture to start immediately:

1. Open a project and navigate to a chapter or scene.
2. Read enough of the existing manuscript to recover context.
3. Place an insertion target at a canonical manuscript location.
4. Press a prominent record control and dictate new prose.
5. Review, correct, discard, or re-record the transcript.
6. Accept the draft text into the manuscript with a traceable revision entry.
7. Continue on the phone or reopen the same work in the full application.

The user may also record immediately and choose or change the target afterward, including saving an unplaced capture for later review. The target is not a generic phone word processor. It is a narrow, story-aware writing companion that carries forward scene identity, manuscript anchors, issue navigation, local-first storage, and audio traceability.

## Dictation Is Not Narration

Mobile speech-to-writing must be represented separately from existing recording workflows.

| Workflow | Writer Action | Result | Manuscript Mutation |
| --- | --- | --- | --- |
| Mobile dictated writing | Speaks new story text to continue or amend a scene | Transcript candidate and anchored insertion proposal | Only after the writer accepts the proposal |
| Narration follow mode | Reads existing manuscript text aloud | Alignment cursor and optionally a passage-linked take | None |
| Character voice narration | Performs or renders an existing passage in a voice | Passage-linked audio asset/render job | None |

A mobile dictation capture must never be interpreted as a narration take merely because both workflows use a microphone. A narration recording must never append recognition output into manuscript text.

## Architecture Principles

- Use the same canonical `Project`, `Scene`, `ManuscriptBlock`, and `ManuscriptAnchor` identity model as the full application.
- Make the dictation path local-first: audio capture and unsent transcript drafts must survive loss of connectivity or app suspension.
- Keep microphone, speech recognition, device storage, lifecycle, and sharing APIs behind mobile platform adapters.
- Treat transcript output as a reviewable proposed manuscript edit until the writer accepts it.
- Route accepted text and autosave through the project persistence boundary, with revision and conflict evidence.
- Use available viewport size, input mode, safe areas, and orientation to choose layout, rather than assuming every phone has the same shape.
- Offer the full product where it remains usable on a small screen, and intentionally reduce dense production views that require a larger workspace.
- Preserve Local AI Only semantics: no provider that may transmit manuscript text or audio is selected silently.

## Target Runtime Shape

The mobile host should compose existing domain and service contracts rather than fork the application model.

```text
apps/mobile/ (future mobile host or installable mobile entry point)
  mobile shell and adaptive navigation
  manuscript reading and lightweight editing surfaces
  dictation capture and transcript review surface
  device capability adapters
        |
        v
ProjectPersistenceService contract / mobile project repository adapter
services/audio dictation capture and transcription orchestration
services/analysis optional anchored diagnostics
services/voice optional lightweight preview/capture orchestration
        |
        v
packages/manuscript-schema
packages/world-schema
packages/shared-types
packages/job-contracts
```

The first layout experiment may be delivered as a responsive mobile entry surface inside `apps/editor`, because that is the existing presentation layer. Once device capabilities or installation behavior demand a distinct host, `apps/mobile` should own composition and native bridges. In either case, feature code must not bypass shared services or create a second manuscript schema.

## Ownership Boundaries

| Owner | Mobile Responsibility | Boundary |
| --- | --- | --- |
| `apps/mobile` or a mobile editor entry surface | Compact layout, navigation, record controls, transcript review, permission prompts | Does not own canonical manuscript mutation rules or STT implementation |
| `apps/editor` shared presentation/controller modules | Reusable presentation-agnostic editor contracts and projections where applicable | Desktop DOM/layout behavior must not be imported as the mobile architecture |
| `services/audio` | Dictation-session orchestration, captured audio references, transcription jobs, interruptions/recovery | Does not append text directly into manuscript state |
| `services/analysis` | Optional post-dictation diagnostics and event suggestions anchored to accepted text | Does not accept dictation changes automatically |
| `services/voice` | Optional playback or voice-production actions available on mobile | Does not own dictated writing |
| `packages/manuscript-schema` | Stable target anchors and accepted manuscript edits | Remains the canonical text identity boundary |
| `packages/shared-types` | Dictation request/result, synchronization, and platform capability DTOs | Remains provider-neutral |
| `packages/job-contracts` | Transcription/upload/download job state where work is long-running | Exposes failure, retry, pause, and cancellation explicitly |
| Persistence adapters | Local device storage, project import/export, transfer or sync integration | UI never writes ad hoc project blobs or audio files directly |

Before a second host is implemented, the current `ProjectPersistenceService` boundary should be made reusable through a host-neutral contract. Mobile persistence must use equivalent explicit calls such as `saveProjectSnapshot`, `restoreLastOpenedProject`, `saveDictationDraft`, and `commitAcceptedManuscriptEdit`, not direct platform storage calls from UI components.

## Primary Mobile Workflow

The phone UI must allow either an immediate voice capture or a contextual capture started from a scene. The steps below describe the contextual route because it provides the strongest insertion anchor; they are not mandatory prerequisites for pressing Record.

### 1. Open And Read

The user opens a locally available project snapshot or an explicitly transferred project. The manuscript surface restores the selected chapter/scene and renders a reading-first viewport with stable location context, such as chapter, scene, and recent paragraph information.

### 2. Choose The Writing Target

The user chooses where speech-generated prose will be inserted:

- continue at the end of the current scene
- insert after the currently selected paragraph or span
- create a new draft scene after the active scene
- save an unplaced capture to an inbox for later positioning

The selected target is saved as an anchor-backed insertion intent, including the project revision or snapshot version against which it was created.

### 3. Capture Speech

The mobile shell requests microphone permission through a capability adapter and starts a `DictationSession`. Audio is persisted incrementally to app-owned storage so an interrupted phone call, screen lock, app suspension, or crash does not discard a long capture.

The record screen prioritizes:

- visible recording status and duration
- pause, resume, stop, and discard controls
- the selected target scene and nearby manuscript text
- offline/local-processing status

### 4. Transcribe

The audio service creates a transcription job using an available provider selected under the user's locality policy:

- on-device or bundled local speech recognition when supported
- deferred local transcription on the author's desktop after transfer
- an explicitly enabled hosted provider only when the user permits it

The output is a transcript candidate and confidence/evidence metadata, not canonical manuscript text.

### 5. Review And Accept

The writer reviews the proposed passage in a focused text sheet while the insertion location and surrounding prose remain visible. The writer can edit the text, replay the source audio, re-record, change the target, or discard the proposal.

Accepting creates a manuscript edit command tied to the insertion anchor and stores a revision event that identifies the dictation session and any retained audio source. The new text becomes canonical only through this acceptance path.

### 6. Persist And Reconcile

The device autosaves in-progress captures and accepted edits through a mobile persistence adapter. When another project copy has changed since capture began, the application must show an anchored conflict/review workflow rather than silently inserting speech text into an uncertain location.

## Proposed Contracts

The names below are architecture targets; their final TypeScript definitions belong in the shared contract and schema packages when implementation begins.

```ts
type DictationSessionStatus =
  | "armed"
  | "recording"
  | "paused"
  | "transcribing"
  | "review"
  | "accepted"
  | "discarded"
  | "failed";

interface MobileDictationSession {
  id: string;
  projectId: string;
  target: DictationInsertionTarget;
  baseProjectRevision: string;
  status: DictationSessionStatus;
  captureAssetRefs: string[];
  transcriptCandidateIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface DictationInsertionTarget {
  sceneId: string;
  anchor?: ManuscriptAnchor;
  placement: "before" | "after" | "append-scene" | "new-scene-after" | "inbox";
}

interface DictationTranscriptCandidate {
  id: string;
  sessionId: string;
  text: string;
  providerId: string;
  locality: "on-device" | "desktop-local" | "hosted-opt-in";
  confidence?: number;
  audioEvidenceRefs: string[];
  reviewState: "pending" | "edited" | "accepted" | "discarded";
}

interface AcceptDictatedPassageCommand {
  sessionId: string;
  candidateId: string;
  projectId: string;
  target: DictationInsertionTarget;
  acceptedText: string;
  baseProjectRevision: string;
}
```

If confidence data is unavailable from a platform recognizer, the contract should record that fact rather than inventing confidence. Audio retention must be configurable because speech recordings can be sensitive and consume storage quickly.

## Adaptive Layout System

Layout selection should be based on available viewport width, height, orientation, safe-area insets, and whether the on-screen keyboard is visible. Device brand or operating system should not determine the content model.

| Layout Class | Example Available Width | Primary Presentation |
| --- | ---: | --- |
| `compact` | below `600px` | One focused surface at a time, bottom navigation, fixed record action, drawers/sheets for supporting context |
| `medium` | `600px` to `1023px` | Manuscript and contextual capture/review side by side where height permits, collapsible navigation rail |
| `expanded` | `1024px` or wider | Full multi-pane presentation close to desktop/tablet behavior |

### Compact Phone Layout

- Default landing surface is the current manuscript scene in a distraction-reduced reading mode.
- A thumb-accessible record control stays visible while reading, without covering the current passage.
- Bottom destinations should be limited to `Manuscript`, `Capture`, `Tasks`, and `More`.
- Binder navigation opens as a scene/chapter sheet rather than consuming permanent width.
- Transcript review opens as a near-full-height sheet with the target passage pinned above it.
- Issues, inspiration, research, events, targets, settings, world, narration, and voice tools are reachable from task/detail or `More` flows, not kept as simultaneous side rails.

### Medium And Tablet Layout

- Manuscript context may remain visible beside a capture or transcript-review panel.
- Chapter/scene navigation may use a collapsible rail.
- Tasks and issue details can occupy a secondary panel.
- Recording controls remain reachable without requiring a desktop-scale toolbar.

### Interaction Rules

- Do not depend on hover interactions; every preview or action needs a tap/focus route.
- Use touch targets at least `44px` square and preserve device safe areas around fixed controls.
- Support portrait and landscape rotation without losing capture state or transcript edits.
- Respect font scaling, high contrast, screen readers, and reduced-motion preferences.
- Keep recording controls visible above the soft keyboard and during transcript correction.
- Avoid dense multi-lane world-spine visualization in compact mode; use list/detail summaries until a wider viewport is available.

## Feature Parity And Mobile Limits

The mobile surface should expose the same project, not a reduced data model. Presentation and expensive workloads can be reduced deliberately.

| Product Capability | Mobile Direction | Expected Limitation On A Phone |
| --- | --- | --- |
| Manuscript reading and scene navigation | Core mobile capability | One primary scene/context surface on compact screens |
| Typed manuscript edits | Supported | Lightweight editing rather than full multi-panel workspace |
| Dictated writing into the manuscript | Primary mobile capability | Transcript must be reviewed or intentionally queued before insertion |
| Issue console, tasks, inspiration, and research | Supported as actionable lists and anchored navigation | Fewer simultaneous panels and reduced batch review |
| Writing targets and session status | Supported as compact summary/actions | Detailed dashboards can be secondary sheets or desktop-first |
| Local writing analysis | Supported when device resources/provider policy allow | Heavy models may be deferred to a desktop-local job |
| Event pinning | View and lightweight create/review path | Rich inspection and bulk structuring can remain desktop-first initially |
| Narration follow and passage-linked audio capture | Supported where microphone/STT capabilities exist | Long production monitoring is dependent on device performance and storage |
| Character voice production | Inspect, record source material, or queue jobs | Large rendering/conversion jobs should normally run on the desktop or another configured local runtime |
| World templates/entities | Read and edit essential detail forms | Dense schema editing is secondary to manuscript/capture workflows |
| World Spine View | Timeline summary and selected node detail | Full cross-spine canvas interaction is tablet/desktop-first |
| Revision review | View dictation-origin edits and resolve mobile conflicts | Full comparative review window is desktop-first initially |
| Project import/export/sync | Explicit local-first transfer and recovery | No silent cloud dependency or unsafe last-write-wins behavior |

## Native Device Capability Adapters

The mobile UI should request capabilities through adapters so an installable web experience, native wrapper, or later native host can implement the same workflow.

| Capability | Required Behavior |
| --- | --- |
| Microphone and audio session | Request permission, capture incrementally, report interruptions, expose input failure, and store app-owned media references |
| Speech-to-text provider | Report locality and availability, return transcript candidates, and never commit manuscript edits |
| Device persistence | Store project snapshots, dictation drafts, audio assets, and recovery metadata through the persistence service |
| App lifecycle | Checkpoint recording/transcript state on suspend, restore interrupted sessions, and make failures visible |
| Connectivity/transfer | Queue intentional transfer or synchronization actions; do not block offline capture |
| File/share bridge | Import or export a project/capture bundle using explicit author actions |
| Safe-area/viewport observer | Publish keyboard, orientation, insets, and usable viewport changes to layout state |
| Audio output | Replay captured speech while reviewing transcript without coupling playback to voice rendering |
| Keep-awake/lock-screen behavior | Offer a recording-session policy appropriate to the platform and surface interruption status |

Platform speech recognition may use a cloud service behind an operating-system API. If locality cannot be guaranteed, the UI must identify it as non-local and must not use it while Local AI Only is enabled unless the author deliberately changes that policy.

## Local-First Persistence And Reconciliation

Mobile authoring increases the risk that a phone and desktop both change the same scene. The architecture must preserve author trust:

- A project activated on a phone is a local project snapshot or an explicitly linked project source, not an invisible remote document.
- In-progress audio and transcript candidates are durable drafts even when no network is available.
- Accepted speech edits use a base project revision and an anchor-backed target.
- When the base revision is current, the mobile host commits the manuscript edit through the persistence service and records its dictation provenance.
- When the base revision is stale or the target cannot resolve, the edit is held as a reviewable insertion proposal with surrounding context and source audio, not automatically merged.
- Transfer or optional synchronization should carry structured commands/proposals and media pointers, allowing the desktop application to review unresolved inserts.
- Cache or offline repository recovery must not merge older manuscript bodies, targets, revision history, or project records over a newer loaded snapshot.

Core mobile writing must work without a paid or hosted service. Later optional hosted synchronization can implement the same command/reconciliation contract without becoming the source of manuscript identity.

## Suggested Future Module Map

```text
apps/
  mobile/
    shell/
      mobile-shell
      adaptive-layout
      navigation
    features/
      manuscript-reader/
      dictated-writing/
      transcript-review/
      tasks-and-issues/
      project-transfer/
    adapters/
      microphone/
      speech-to-text/
      persistence/
      lifecycle/
      sharing/
      viewport/
services/
  audio/
    dictation-session
    transcription-orchestration
    capture-recovery
packages/
  shared-types/
    mobile-dictation-contracts
    platform-capability-contracts
  job-contracts/
    transcription-job-contracts
```

Module names are illustrative. Implementation should follow the repository's naming conventions and avoid adding new platform code to `apps/editor/public/app.js`.

## Delivery Roadmap

### Mobile Phase 0: Contracts And Separation

Goal:
- make dictated writing a first-class planned workflow without confusing it with narration or voice rendering

Deliverables:
- shared DTO proposal for dictation sessions, transcript candidates, insertion targets, and acceptance commands
- documented provider-locality and audio-retention policies
- persistence and revision strategy for accepted mobile edits

Exit criteria:
- the architecture can represent new spoken prose, an existing-text narration take, and a character-voice recording without sharing destructive mutation behavior

### Mobile Phase 1: Responsive Read And Navigate Surface

Goal:
- make manuscript context comfortable to read and navigate on compact phones

Deliverables:
- compact, medium, and expanded layout rules
- touch-first manuscript scene navigation and insertion-target selection
- safe-area, keyboard, orientation, and accessibility handling

Exit criteria:
- a phone user can open a scene, read it, choose an insertion target, and navigate tasks/issues without desktop-only interaction patterns

### Mobile Phase 2: Offline Dictation Capture And Transcript Review

Goal:
- deliver the primary mobile voice-first authoring workflow

Deliverables:
- microphone and lifecycle adapters
- durable in-progress dictation sessions
- transcription job path with visible locality state
- transcript review/edit/re-record/discard/accept surface
- accepted insertion routed through manuscript commands and project persistence

Exit criteria:
- an interrupted or offline recording can be recovered
- no transcript silently changes canonical manuscript text
- an accepted transcript remains anchored and traceable in the reopened project

### Mobile Phase 3: Project Transfer And Conflict Review

Goal:
- let a mobile writing session return safely to the full desktop environment

Deliverables:
- explicit project or dictation-bundle import/export path
- base-revision and anchor conflict detection
- desktop review flow for unresolved mobile insert proposals

Exit criteria:
- concurrent phone/desktop edits cannot silently overwrite manuscript text
- unresolved dictation remains recoverable with text, target context, and retained audio policy

### Mobile Phase 4: Adapted Feature Parity

Goal:
- make the mobile companion useful beyond raw dictation while respecting screen and device constraints

Deliverables:
- compact issue/task/event workflows
- writing-target summary
- optional local analysis invocation
- narration recording/follow capability where device performance permits
- lightweight world/entity and voice-job inspection

Exit criteria:
- core mobile interactions use the same anchors and service contracts as the main application
- intentionally deferred desktop-first interactions are identified in the UI and docs

### Mobile Phase 5: Native Host Evaluation

Goal:
- decide whether the validated mobile workflow should be packaged as an installable web application, a native wrapper, or a platform-specific host

Deliverables:
- measurement of offline storage, recording reliability, background/resume behavior, STT locality, and project transfer behavior
- chosen host adapter implementation with no domain-schema fork

Exit criteria:
- host choice is made from workflow evidence and does not require changing canonical manuscript, audio, or persistence contracts

## Verification Strategy

Implementation of this roadmap should include:

- responsive interaction tests for compact/medium/expanded viewports, orientation, and keyboard-visible layouts
- permission, interruption, suspend/resume, offline, and low-storage capture tests
- dictation-session tests proving that transcripts remain proposals until accepted
- anchor-resolution and conflict tests for changed scenes and stale project revisions
- persistence round-trip tests for accepted text, unaccepted transcript drafts, retained/discarded audio assets, and explicit transfer bundles
- Local AI Only tests proving non-local STT providers are not selected implicitly
- accessibility checks for touch targets, recording status announcements, keyboard navigation where available, font scaling, and screen readers

## Non-Goals For The First Mobile Release

- Reproducing the full multi-pane desktop workspace on a narrow phone screen.
- Running heavy voice conversion, chapter rendering, or large local analysis models on every phone.
- Treating raw audio transcription as automatically trustworthy manuscript content.
- Introducing mandatory cloud storage, cloud speech recognition, or hosted synchronization.
- Replacing desktop production tools for world-spine visualization or detailed revision comparison.
