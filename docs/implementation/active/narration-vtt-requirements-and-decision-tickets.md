# ABE — Voice-to-Text and Speech Architecture

**Status:** Phase 02 native manuscript dictation is authorized. Historical decisions and Phase-0 instructions below are preserved.
**Repository:** `D3KOD3R/ABetterWritingEnvironment`  
**Revision:** 1.3 — 23 November 2026

## Current execution contract — Phase 02 (27 November 2026)

Follow [the Phase 02 execution contract and author brief](narration-vtt-phase-02.md) for current work. The author explicitly supersedes the preview-only insertion gate and separate/double-click dictation cursor. Use the existing manuscript editor and history, a single ordinary caret, RHS configuration, guided setup and shared capture in Manuscript and STT. Only finalized utterances enter canonical text; provisional words remain projections. Protected audio, the bounded recording limit and consent requirements remain. No automatic audio cleanup, full refinement or unapproved Grill Me Decisions 14–18 are authorized. The earlier contract below remains historical scope and decision traceability; its insertion prohibition and wizard Start Dictating action no longer govern Phase 02.

## Earlier execution contract — approved Round 2 STT UX (23 November 2026)

**Authorization:** The author has explicitly requested Codex to **begin implementation** of Grill Me Round 2 Decisions **1–13**, documented in section 15 under `VTT-UX-01` through `VTT-UX-03`. This **supersedes the earlier publication-only prohibition for this bounded UX tranche**. Original D01–D26 requirements and the existing automatic-manuscript-insertion, shared-history, durable-audio-chunk and refinement gates remain intact. Decisions 14–18 have **not** been made and must not be treated as approved product requirements.

**Goal:** Turn the approved UX decisions into a usable, honest, local-first Narration STT setup and control experience on `feature/narration-vtt`, without expanding the checkpoint into automatic manuscript editing or production refinement.

**Initial bounded reads:** `AGENTS.md`, applicable `agents/FeatureWorkAgent.md`, `agents/AudioVoiceAgent.md`, `agents/RepositoryWorkspaceAgent.md` and scoped UI/settings/persistence instructions as needed; section 15 of this document; `docs/implementation/active/narration-vtt-functional-checkpoint-report.md`; the relevant `features.md` Feature 4.6 section and index only. Inspect `dictation-controller.js`, `dictation-panel.js`, `dictation-capture.js`, desktop `dictation-host.ts`/`settings.ts`, the local-AI model store, shared settings UI and targeted tests. Verify current Git ancestry and remote HEAD before editing.

**Approved deliverables (traceability):**
- **D1 / UX-03:** Inline **three-stage** first-use setup; STT RHS remains available with shared controls.
- **D2 / UX-01:** Explicit microphone selection/setup requests permission when necessary; devices/labels refresh automatically after permission and device changes.
- **D3 / UX-02:** Separate **Model Ready** from **Ready to Record**; show missing prerequisites with actionable recovery. At this checkpoint Ready to Record means local recording/transcript preview only.
- **D4 / UX-02:** First successfully installed compatible Live STT model is selected when no live model is assigned. Never override an existing valid selection or silently fall back in a way the UI conceals.
- **D5 / UX-02:** Distinct Live Dictation and optional Refinement model sections; only Live STT needed for onboarding. Never suggest that deferred Whisper refinement runs already.
- **D6 / UX-02:** Expose model-library root, sizes and Open Model Folder; support root picker and **safe guided model-library relocation**, respecting shared Local AI ownership, checksum verification, staged copy, resource leases, rollback and non-destructive recovery. This is high-risk: do **not** auto-migrate the author's real library; stage/dry-run first, and if a genuinely unresolved destructive/conflict policy arises, stop that subfeature and report its proposed choices rather than guessing.
- **D7 / UX-03:** Existing authors stay in normal STT; contextual repair for lost mic/model/runtime; wizard reopens only on request or unfinished first use.
- **D8 / UX-01:** Explicit **Test Input / Stop Test** with live meter, clipping indicator and supported channel selection; no transcription or audio save; release capture on stop/navigation.
- **D9 / UX-01:** Contextual STT RHS and **User Settings** share one authoritative mic/model/settings state; compact central Record/Stop, mic activity and readiness remain accessible with RHS collapsed.
- **D10 / UX-01:** Lock device/channel/live-model selection in both surfaces **during recording**, including host-side checks; no hot swap or queued replacement.
- **D11 / UX-03:** Final setup stage offers both **Finish Setup** (no mic) and **Start Dictating** (explicit, readiness-gated recording).
- **D12 / UX-03:** Remember setup completion and incomplete progress per installation; actual readiness stays dynamic, never inferred from a completion flag; do not store machine state in portable projects.
- **D13 / UX-03:** Guided, **explicitly consented** acquisition of a compatible live model and necessary supported local runtime/encoder dependencies. Show source, size/license when known and progress; verify integrity and compatibility, support cancel/retry, use controlled ABE-managed isolation where feasible, and **never silently mutate system-wide Python**. If trusted distributable/runtime packaging is not presently feasible, implement honest readiness and a bounded safe installer plan; do not introduce an unsafe executable downloader or claim one-click setup works.

**Implementation sequence:** (1) shared readiness/settings contracts and truthful role categories; (2) permission/device discovery, explicit testing, mirrored RHS/User Settings and active-capture locking; (3) resumable inline onboarding and recoverable setup; (4) controlled, consent-based runtime installation and model storage-location/migration work, using non-destructive mocks/temporary roots until verified. Work may be committed incrementally on this VTT branch. Prefer safe, self-contained milestones; complete what is genuinely testable rather than pretending to finish every high-risk item.

**Non-goals:** No automatic manuscript insertion, two-anchor dictation gestures, history/undo overhaul, audio-retention/deletion change, full refinement execution/review, new TTS/Translation, spoken commands or general Manuscript UI changes. Do not implement or invent UX Decisions 14–18. Do not change `main`, `feature/persistence-portability-harness`, unrelated worktrees, actual user projects or existing installed models. No automatic permission, model download, mic activation or recording at entry. No untrusted execution, cloud inference, force push or merge.

**Verification:** Begin from the published 143/143 baseline. Add focused tests for permission grant/denial/devicechange, duplicate selection/races, Test Input stop/release and no recorded output, active capture settings lock, missing runtime/model/scene/project, wizard first-run/resume/reopen/recovery, role category distinction, User Settings/RHS synchronisation, install consent/cancel/retry and isolated storage copy/rollback. Run the repository supervisor for affected scope and a FULL run as appropriate; use actual user-device microphone tests only when available and with author consent. Verify existing Narration Follow and Manuscript regressions. Report commands, counts, artefacts and limitations accurately; do not equate mocks with human microphone acceptance.

**Completion:** Update the matching bounded `features.md` index/section and section 15 ticket status with evidence; preserve historical audits. Commit verified implementation to `feature/narration-vtt` and publish via normal fast-forward push for review. Report exact SHA, changes, tests and incomplete risks, then **stop**. Any unsafe model-library cutover, third-party runtime execution approach without verified provenance, architectural conflict with existing shared services or expansion into another approval-gated phase requires a proposal before proceeding.

## Historical execution contract — publish and record acceptance findings (completed 23 November 2026)

The prior publication-only assignment was completed at `a73697f568ae15f3d481889df1c565497fd03a87`; its UX observations are preserved in section 15. The current UX implementation authorisation above now governs the next task.

## Active execution contract — functional Dictation checkpoint

The user's revised functional-dictation authorization supersedes the earlier planning-only and infrastructure-only scope for this checkpoint. Continue through model installation, dedicated microphone capture, real local recognition, transcript/timing preview, project-owned retained audio, playback and reopen. This authorizes cohesive local commits, but not remote push or merge. Downloads remain explicit user actions; inference must be local with no browser/cloud fallback.

- **Manuscript gate:** preview and explicit copy are permitted. Automatic insertion, D05 gestures and D12 history changes await the separately approved shared-history and durability implementation and Phase 3A, Phase 4 and Phase 3B integration gates. Provisional output never enters canonical text, exports or history.
- **Isolation:** preserve Narration Follow's sherpa-onnx tracking, Whisper cleanup, recording and playback. Add only subpanel selection where needed. Keep domain/provider logic in the existing Node/TypeScript/audio service boundaries.
- **Models:** prioritize official Moonshine Tiny Streaming English after runtime verification; whisper.cpp is the refinement candidate. Expose independent live/refinement assignments, no active narration-alignment assignment. Model presence and runtime readiness are separate facts. Pin revisions and verify authentic checksums; stage installs, support cancellation/retry and protect in-use managed files.
- **Retention:** ordinary default remains delete-after-durable-text-save (D04), never delete-after-in-memory-transcript. Save Recording explicitly captures retain-until-manual-deletion for the session. Do not implement automatic cleanup before a reliable durability acknowledgement. FLAC mono 16 kHz normalized PCM16 remains the baseline; any temporary format requires an explicit proposal and honest encoding labels.
- **Ownership:** installed models/runtime paths and microphone overrides are machine state; active capture/jobs are session state; completed session transcripts, timing metadata and recording references are semantic project data; recording bytes are project-owned assets. Route project mutation through ProjectPersistenceService, serialize relative references, and verify both bytes and durable registration. Save As/relocation must include the assets. No invented recording directory or package fallback.
- **Timing:** retain source sample positions, capture epoch and frame sequence, resampling correspondence, stable utterance identity/revision/finality and model/runtime identity. Store only timing actually supplied or measured, with its source/granularity. Reject duplicate/stale results and never revise accepted finals.
- **Acceptance:** deterministic offline tests plus actual local model inference are required. Mock results are not functional acceptance. Record real microphone, playback, reopen, offline, hardware and performance evidence only when exercised. Use controlled browser/persistence RUNs for project-durability claims.
- **Stop conditions:** architectural decisions are required for breaking Follow, destructive migration, bypassing shared history, cloud inference, arbitrary external model code or significant deviation from D01–D26. Functional prototype completion does not authorize automatic manuscript editing.

The completed **ABE VTT Implementation Plan — Phase 0 review**, supplied by the author on 22 November 2026, has been read. Its Phase 3A requires shared commands/history, revision integration, project/destination-generation receipts and source validation; Phase 4 requires verified FLAC publication, correspondence, safe retention and portability; Phase 3B integrates capture/gestures with those guarantees. This authorization advances only the independent recording/transcript checkpoint. None of those full manuscript integration gates is declared passed. The report's secure host boundary and schema-version protection apply before exposing new operations and durable speech data.

### Decision scope overlay (historical tickets below remain unchanged)

| Decisions | Current checkpoint / remaining gate |
|---|---|
| D01, D16–D19, D23 | Curated live/refinement installation, readiness and safe selection authorized; advanced imports, full update policy, project overrides and refinement scheduling remain deferred. |
| D02, D04, D10, D11, D22, D24, D25 | Capture, final/provisional preview, safe stop, retained recordings and persistent session status authorized; automatic text insertion/deletion and full production chunk policy remain gated. |
| D05, D06, D12 | Two-anchor gestures, viewport follow and shared chronological history deferred to manuscript-safety implementation. No speech-only undo. |
| D07, D08 | Natural speech and truthful listening status in checkpoint; intelligent standby remains eventual default, continuous/silence-stop as subsequent capability if needed. |
| D20, D21 | Add STT within Narration with contextual controls; preserve ordinary Manuscript and Follow. |
| D03, D13–D15 | Refinement proposals, scopes, manual-edit protection and linked review remain later Phases 5–6. |
| D09 | Worldbuilding/context vocabulary processing remains deferred. |
| D26 | This checkpoint is authorized; major manuscript-history/persistence and subsequent workflow gates remain explicit. |

Manual refinement remains the default; optional inactivity/background refinement retains the five-minute threshold. Refinement review chunks (default 1,000 words), natural utterances and independently published audio files (proposed three-minute target/four-minute maximum) remain separate boundaries. TTS, Translation and Narration Alignment are outside this checkpoint.

## Historical execution contract — Phase 0 (planning only)

The following contract records the original planning authorization; the active checkpoint above governs current work.


**Goal:** audit the exact VTT source baseline and design the implementation of the 26 approved architectural decisions below. The initial task is a repository-specific plan, **not implementation**.

**Source identity:** `feature/narration-vtt`, originally branched from verified reliability commit `597775c80f0d2351bd5091bfc34328a462db80e0`. Verify live Git HEAD before any future development; do not assume the branch remains at its original commit.

**Initial bounded reads:** `AGENTS.md`; applicable active implementation contracts; `agents/RepositoryWorkspaceAgent.md` for workspace operations; `agents/AudioVoiceAgent.md` for voice responsibilities; `agents/DocumentationAgent.md` when changing documentation ownership. Follow the scoped agent router rather than eagerly loading all agents. Inspect source paths listed in section 9 selectively.

**Required Phase-0 outcome:** a file-level implementation plan, reused services and constraints, dependencies, data/state contracts, hardware and privacy risks, traceability from every `VTT-Dxx` ticket to planned changes, acceptance tests and approval gates.

**Explicit non-goals:** no production implementation; no model downloads or new dependencies; no changing `main`, the reliability branch, or unrelated worktrees; no broad code refactor, experimental performance claims or task auto-closure.

**Verification route:** Phase 0 uses read-only source inspection. In an authorised implementation phase use ABE's repository supervisor and domain-specific tests, controlled regression RUNs where necessary and real hardware benchmarks for model performance. Record exact HEAD, commands, results and outstanding limitations.

**Approval state:** all 26 decisions below are accepted *requirements*, not completed features. All implementation tickets remain open until implemented and verified. Each major phase requires explicit user authorisation, and Codex must stop at the end-of-phase review gate.

**Tracking:** section 14 is the branch-local ticket register. IDs `VTT-D01`–`VTT-D26` are stable references, not GitHub Issue numbers. Proposed phase assignments are planning aids; Phase 0 may recommend revised sequencing with justification.

## 1. Purpose and governing principles

Extend A Better Novel Authoring Environment (ABE) with local-first, responsive manuscript dictation, optional higher-accuracy audio retranscription, integrated model management and review tools. Support a workflow in which an author dictates on a lightweight laptop and optionally refines the same project on a more capable desktop.

- Text first: finalised live transcription is ordinary, accepted manuscript content and is automatically persisted. It does not await a second model or author acceptance.
- Optional refinement: no automatic refinement by default; no automatic replacement of manuscript text, even when background processing is enabled.
- The author is authoritative: manual edits exempt affected text from refinement; accepted refinement remains undoable.
- Local execution, minimal default audio storage, no silent cloud inference or microphone activation.
- Models, runtimes and hardware settings belong to the installation; portable project data is independent of any particular computer.
- Preserve existing Manuscript and Narration Follow functionality. Dictation is initially limited to the Narration STT subpanel.
- Implement only after approval of the repository-specific plan and each major phase.

In this document, **required** means an agreed decision or its necessary safety consequence. **Proposed default** identifies a design detail suggested during discussion that Codex should validate rather than represent as measured performance or a fixed implementation choice. Later decisions supersede earlier contradictory proposals.

## 2. Agreed decision register

| ID | Decision | Result |
|---|---|---|
| 01 | Model selection | Separate selected models for live STT, audio refinement and narration alignment, sharing installed model files. |
| 02 | Dictation/refinement | Hybrid: insert live speech directly; optional manual, inactivity-triggered or background retranscription. Manual is the default; proposals always require acceptance. Portable retained audio. |
| 03 | Review granularity | Whole-chunk and individual change acceptance/rejection, with direct editing. |
| 04 | Audio retention | Default delete after finalised text is durably saved; optional retention until refinement acceptance or manual deletion. Configurable storage allowance and warnings. Minimal speech-quality capture. |
| 05 | Cursor interaction (revised) | In STT, one click moves the active mode's cursor; double-click switches editing/dictation mode at the clicked position. Separate logical editing and dictation anchors. Contextual onboarding tips. |
| 06 | Viewport behaviour | Follow the active dictation cursor while dictating. Normal editing behaviour when microphone is off. |
| 07 | Listening mode | Configurable continuous listening, silence-timeout shutdown or intelligent standby; standby default. |
| 08 | Spoken commands | Natural speech only; no spoken application commands or punctuation command parser. |
| 09 | Project context | Defer vocabulary biasing and contextual text post-processing; later leverage existing worldbuilding data rather than requiring separate vocabulary maintenance. |
| 10 | Navigation | Stop/pause capture when leaving the current scene/workflow; no automatic microphone restart on return. |
| 11 | Provisional text | Visually distinct provisional streaming output; ordinary manuscript formatting when finalised. |
| 12 | Undo/redo | Shared chronological undo history; natural speech segment transactions and existing accelerated time-based undo design. |
| 13 | Refinement scope | Project, chapter, scene and selected passage; individual jobs can be prioritised, paused, cancelled and retried. |
| 14 | Manual edits | Exempt affected manually edited sections from refinement; no automatic merging or restoration of deleted prose. |
| 15 | Review surfaces | Dedicated refinement review workspace/subpanel plus inline manuscript review, with shared proposal state. |
| 16 | New computers | Detect a new installation; default to minimum compatible lightweight live model and conservative execution. Do not silently substitute a refinement model. |
| 17 | Model acquisition | Curated model catalogue plus advanced external model import, subject to integrity and compatibility checks. |
| 18 | Model updates | Configurable; automatic update notification and manual installation/activation by default; version coexistence and rollback. |
| 19 | Settings hierarchy | Inherited user defaults, explicit project overrides and machine-specific hardware/runtime settings. |
| 20 | Workspace structure (revised) | Existing Narration workspace contains subpanels such as Narration Follow, STT, TTS, Refinement and Translation; selection changes RHS controls. Shared infrastructure with staged capabilities. |
| 21 | Dictation scope | Initially Narration STT only; ordinary Manuscript double-click word selection remains unchanged. Wider dictation deferred. |
| 22 | Microphone selection | Shared machine default with workflow-specific overrides and independent capture quality profiles. |
| 23 | Lifecycle/resource management (revised) | Queue-aware unloading; device compatibility required before scheduling; easy refinement disable/pause; visible backlog processing; preserve audio for capable computers where retention permits. |
| 24 | Crash resilience (revised) | Incremental manuscript persistence and independently saved recording chunks; no bespoke audio crash-recovery workflow in initial scope. |
| 25 | Notifications | Persistent processing status and configurable notifications; default quiet processing, completion and actionable warnings/errors. |
| 26 | Delivery governance | Approval-gated major phases, testing and completion reports; audit and plan before any implementation. |

## 3. Initial scope and interface

### 3.1 Narration workspace

Extend, do not replace, the current Narration workspace. Use independent subpanel components with contextual RHS tools and shared services. A dedicated refinement review surface should sit within the Narration experience, not introduce an unnecessary unrelated top-level workspace. The standard Manuscript workspace may display inline refinement review without enabling live dictation there.

| Subpanel | Purpose | Main RHS controls |
|---|---|---|
| Narration Follow | Read existing text aloud while tracking/alignment follows the manuscript; preserve production takes | alignment model, microphone/input channel, existing tracking, capture/playback controls |
| STT | Compose manuscript through natural speech | model selection, microphone/test/input status, capture controls, listening state, retention, refinement toggle/status |
| Refinement | Queue management, comparison, individual and bulk review | processing model, scope, status, queue controls, review actions, retained audio replay |
| TTS | Synthetic narration / audio generation | model, voice, playback/output controls when implemented; preserve existing voice functionality |
| Translation | Future local translation workflow | model, languages, scope and review controls when implemented |

TTS and translation must have extensible model catalogue categories and UI boundaries. Do not implement additional inference engines or new full production workflows in this programme unless separately approved. Unavailable controls must be labelled as such; no nonfunctional controls masquerading as working features.

### 3.2 STT interaction contract

- Microphone off / editing mode: single left-click positions the editing caret; double left-click switches to dictation and begins at the clicked position, subject to permissions, a ready model and usable input.
- Microphone on / dictation mode: single left-click repositions the dictation anchor; double left-click stops/finalises dictation and switches to editing at the clicked position.
- Track two logical anchors. Follow the dictation anchor in the viewport during dictation; normal caret/scroll behaviour otherwise. Maintain an unambiguous recording indicator (including listening, speech active, standby, stopped, disconnected and failed states).
- Do not allow click/double-click races. Associate incoming results with their original segment/anchor; drain or safely finalise outstanding speech before relocating or exiting. No delayed result may insert into a different scene or resurrect deleted/undone text.
- Preserve standard word-selection behaviour everywhere outside STT; provide a discoverable alternative word-selection gesture within STT and keyboard-accessible explicit record/stop controls. Codex should propose precise gesture arbitration and keyboard interaction for review.
- Navigation away stops microphone capture and finalises outstanding speech; no automatic resume on return. Background refinement is independent. Only one workflow may own microphone capture at a time.
- Respect OS permissions, device disconnects and project closures; never silently switch microphones or start capture on project opening.
- Natural speech only. Do not transform spoken command phrases into actions or punctuation via a command parser.

### 3.3 Provisional text and undo

Provisional hypotheses appear immediately but visually distinct using theme-aware rendering (not persisted manuscript styling). A model may update only its own provisional range. Stable utterances are committed and autosaved without explicit acceptance. Protect manual edits to the relevant ranges from subsequent streaming revisions.

Reuse ABE's existing revision and undo architecture. Single undo should follow the latest committed transaction, with dictated utterances as natural units. Accelerated held Ctrl+Z uses the previously proposed time-based six-second grouping behaviour (verify actual implementation and reconcile with existing undo design). Preserve normal chronological ordering with manual changes, exact redo without inference and undo for refinement acceptance. Do not create undo entries on every interim hypothesis. Preserve retained audio independently of text undo; suppress obsolete results. Do not introduce a parallel incompatible history system.

### 3.4 Onboarding and information

Contextual instruction tips appear for the first five relevant uses per feature, independently counted only when actually displayed. Explain editing/dictation gestures in the STT panel. Acknowledgement or 'Don't show again' permanently dismisses the individual tip; ordinary closure dismisses the present appearance. Provide reset and optional global disable at the user level. Information tooltips explaining settings remain available independently of onboarding. Support hover, focus and touch; respect theme, display scaling and narrow layouts. Labels should wrap naturally, and controls should stack rather than squeeze labels into single-character columns.

## 4. Shared local model management

Build upon ABE's existing Local AI settings/inventory and desktop model root where practical; avoid a second incompatible registry. Separate model identity, runtime, installed version, workflow assignment and hardware execution device. Installed artifacts can be shared by multiple compatible workflows, while selections and runtime sessions are independent. No weight files in manuscript packages.

### 4.1 Catalogue and imports

Curated catalogue categories: STT, TTS and translation. STT candidates include Moonshine streaming, Whisper/whisper.cpp and other compatible families (Nemotron, Cohere, etc.). Initial priority is lightweight streaming English dictation and higher-accuracy Whisper retranscription while preserving existing narration alignment. Specific additional engines require compatibility and licensing validation. Example model sizes shown during design are not authoritative; use current pinned manifest sizes.

Model metadata should include stable ID, family, version/revision, runtime ID, tasks, languages, streaming/alignment/timestamp capabilities, tested hardware/backend support, artifacts with roles and exact source URLs, expected bytes, SHA-256 where available, license/model card and provenance. Show download size, installed disk usage, status, current selections, source and update information. Keep runtime package management (including optional CUDA) distinct from weight installation.

Support install, use, remove, cancel, retry, refresh, update, rollback, local import and advanced compatible external source imports. Do not automatically execute external scripts or untrusted model code. External manifests must satisfy supported formats and trust/validation policy. No claim that arbitrary Hugging Face repositories are runnable. Stage downloads, verify sizes/hashes, test the installed package and atomically publish it; handle interruption and insufficient disk space safely. Track actual transfer bytes, including retry transfers where practical, versus nominal size and installed disk size. Expose cumulative model download usage without requiring telemetry.

Physical removal must delete only app-managed model artifacts that are no longer referenced by other installations/workflows. Confirm impact, block or safely deactivate active/in-use models; enforce canonical paths and traversal/symlink safeguards. Never delete manuscripts, recordings, unrelated caches or user-owned source files merely because an imported reference is removed. Codex must propose ownership semantics for copying vs referencing imported files.

### 4.2 Updates

Default check/notify automatically, install/activate manually; configurable fully manual or automatic policy. Respect offline operation, report connectivity requirements and download size, never replace an active session's model. Coexisting versions and rollback are supported; remove unused versions explicitly. Record exact model/version/runtime provenance in transcript/refinement metadata. Catalogue changes can be independent of application releases when existing runtimes support them. Pin artifact revisions; never silently resolve to an unknown latest version.

### 4.3 Runtime and hardware

Introduce provider capability contracts rather than assuming all models support all tasks. Validate real backend compatibility, memory, instruction set, available disk, runtime presence, and lightweight init/inference probe. Select minimal compatible local live model on a new installation (e.g. Moonshine Tiny Streaming for supported English); offer a size-disclosed download if absent. No automatic heavyweight model downloads. Persist local installation identity/preferences rather than depending on fragile hardware fingerprints.

Use CPU by default for new device live STT. GPU acceleration is optional and runtime-specific; NVIDIA CUDA sidecar should be offered only when supported. Do not assume Moonshine requires CUDA or that all STT engines use the same accelerator. Preserve installed models and existing provider integrations. If selected refinement cannot run safely, do not enqueue it for current-device execution; do not silently fall back to expensive CPU processing. Manual user-approved compatible override may be proposed by Codex.

## 5. Dictation audio, retention and persistence

### 5.1 Audio capture

Shared default input with per-workflow overrides, device and channel selection where supported, level/clipping feedback and a test that does not alter manuscript. Separate professional narration capture settings from minimal STT capture. Gain controls should not falsely claim control of hardware gain if the runtime exposes only software gain.

Proposed persisted dictation baseline: mono, 16 kHz, 16-bit PCM encoded as FLAC. FLAC is lossless relative to those normalised PCM samples, not relative to the original higher-rate recording. Decode/resample for each provider as needed. Validate actual model compatibility/accuracy; avoid persistent duplicate WAV files. No requirement to archive original studio-quality audio in STT. Live-only mode may use bounded transient buffers rather than writing unnecessary long-lived files.

### 5.2 Listening

Configurable listening: continuous, automatic shutdown after configurable silence, intelligent standby (default). Use VAD or compatible provider endpointing to avoid unnecessary inference and extended silent stored data; short pre-roll avoids losing speech onset. Standby keeps the microphone active and ready, visibly indicated. Document privacy, resource use and timing; no assumption that silence equals the user leaving. Automatic idle refinement must not start just because the author is thinking while an active mic session remains open.

### 5.3 Retention

Three explicit policies with clear settings explanations:

1. **Delete after transcription (default):** delete corresponding temporary audio only after stable text is durably committed; after deletion audio retranscription is unavailable. No extra approval for live content.
2. **Retain until refinement accepted:** carry original audio and portable metadata with project; delete only after relevant accepted results are durably saved and no unresolved or protected segment still references the file. Rejection, cancellation or manual edit exclusion is not equivalent to acceptance; propose an explicit discard/cleanup path for never-accepted recordings, without surprise loss.
3. **Retain until manually deleted:** user manages recordings and may reprocess as needed.

Optional retention allowance per project, warnings near limit (80% proposed, configurable), actual disk usage and physical free space checks. Never silently discard pending or protected retained audio to fit an allowance. At limit, offer storage management, increased allowance or explicit switch to text-only dictation. If retention changes, existing recordings retain their policy unless explicitly migrated with informed confirmation. Automatic audio refinement must be disabled/unavailable for audio already discarded; explain prerequisites rather than silently changing retention. A user may choose retention even on a computer incapable of refinement.

### 5.4 Three independent chunk layers

| Layer | Proposed boundary | Durability |
|---|---|---|
| Streaming output | Natural model-finalised utterance; bounded to avoid indefinite provisional text | Commit/save each finalised segment promptly, independent of audio chunk completion |
| Retained audio | Target/max around 3–4 minutes, preferring a speech boundary without truncation; validate hard bound and overlap | Independently finalised/verified file; stable segment-to-audio offsets |
| Refinement review | Configurable up to 1,000 words by default, prefer paragraph/sentence/scene boundaries | May span audio files; internally subdivide to fit model windows with overlap deduplication |

Persist audio references, segment IDs, original live transcript baseline, anchor/document/scene IDs, revision fingerprints, timestamps, policy and actual sizes. Keep durable correspondence when silence is removed or windows overlap. Selected-passage refinement must be restricted to reliably mapped source ranges (otherwise present a clear unavailable or bounded alternative). Never cross unrelated scenes.

### 5.5 Crash resilience and portability

Use existing manuscript persistence and its actual durability contract. Write completed audio chunks independently and publish valid metadata; never delete dependent audio before confirmed manuscript persistence. Prior committed text and completed files survive an interruption. Incomplete audio may be discarded if not safely recoverable; do not build a bespoke audio recovery UI or imply zero loss of unfinalised speech. A simple interruption notice is sufficient. Detect orphaned staging files and reconcile safely; retry failed deletion separately from manuscript commits. Completed proposals persist, interrupted jobs return to eligible pending state without duplicate results. Codex must specify idempotency/atomicity and failure boundaries.

Project data (including retained audio, anchors, refinement materials, results and review records) travels with the project. Support opening a project synchronised through the author's personal cloud, subject to actual storage availability and existing persistence/sync guarantees; do not assume an existing multiwriter cloud service. Handle missing/partially synced files, stale anchors and duplicate processing. Use revision checks and safe coordination/conflict handling, or explicitly enforce a single-writer workflow initially if robust multiwriter semantics do not exist. No silent upload to an AI provider. Cloud provider backups/version history may retain deleted data beyond ABE's control.

## 6. Refinement engine and review

### 6.1 Scheduling

Manual only by default. Optional automatic processing after configurable inactivity (5 minutes proposed) when capture is inactive, or background processing of completed eligible chunks during writing. Always expose manual start with scope selection. Local enable/disable is independent of auto-trigger settings; turning off stops scheduling and safely pauses/cancels current inference at the next safe point, releases resources, and leaves live dictation and stored data intact.

Distinguish portable **refinable material** (eligible original audio/text mapping) from the **current device's executable job queue**. An incompatible device retains project material, existing portable job/proposal records and eligibility metadata but must not create/schedule local execution work. On capable device, explicit start or enabled automatic mode can schedule eligible material. Paused, incompatible, absent model, battery restricted or manually disabled states need visible reasons. Re-check capabilities before dispatch, not merely at installation.

Support whole project, chapter, scene and selected-passage processing; prioritise, pause, cancel, retry. Use stable job identity, source revision and model version; retries must not duplicate proposals. Preserve completed results and checkpoint completed windows where feasible. No processing for edited/deleted sections; revalidate at dispatch, result publication and acceptance.

### 6.2 Manual-edit protection

If text has been manually edited since original live transcription, assume the affected section no longer needs refinement. Exclude the smallest reliably mapped segment; if boundaries are ambiguous, exclude a larger safe range rather than overwrite author changes. Unedited surroundings remain eligible. Invalidate active results or withdraw proposals affected by manual edits. Deleted material must not reappear. Do not implement three-way merge in initial scope. Do not use undo as an implicit request to regenerate recognition or refine again.

### 6.3 Review

Whisper or another selected compatible model retranscribes retained audio. The refinement model is not a creative rewriting tool; no LLM-based contextual correction in initial scope. Compare proposal to unchanged baseline/current text, highlight insertions/deletions/changes and enable source replay where retained. Support accept/reject whole chunk, accept/reject individual changes, direct proposal editing. Bulk acceptance must revalidate every target and report conflicts/exclusions. No automatic acceptance, including for non-conflicting punctuation changes. All accepted changes commit via existing manuscript persistence and undo history. Track partial resolution and retain referenced audio until applicable policy permits removal.

Provide a central review surface within Narration and inline manuscript review, backed by one source of truth. Status changes synchronise between surfaces. Proposals are not manuscript content until applied. Review, accepted text and audio deletion are separate durable operations.

## 7. Hardware lifecycle, actions and notifications

Keep active live models loaded through intelligent standby. Do not unload a refinement model between eligible queued chunks; queue-aware idle timing begins only after no eligible active/runnable work remains. Waiting for author review or a paused/disabled queue does not require loaded weights. Proposed configurable timeout: five minutes for live and refinement after actual inactivity. Preload relevant lightweight model on entering its subpanel if enabled and resources allow; don't load all models at startup. Reuse loaded model across chunks. Release inactive models under memory pressure first; safely stop/defer expensive work if required. Prioritise responsive live dictation and application interaction above refinement. Default one concurrent refinement job; configurable within hardware limits. Support battery restrictions and backend-dependent resource limits as proposals to validate, not false guarantees of GPU utilisation control.

Persistent status indicator accessible across application and in STT/Refinement RHS. Show actual states (idle, processing, paused, disabled, unavailable, failed, complete), completed/total chunks, optional actual provider progress, pending review and device/model. If a percentage cannot be measured, use indeterminate progress or completed units; do not invent precision. Offer quick pause/resume and disable; disabling must never affect live capture, retained files or completed proposals. Progress remains visible after navigating away, subject to project lifetime. Default quiet processing, one completion notification, storage warnings and actionable errors; optional sounds and other notifications. Reuse appropriate ABE notification primitives.

## 8. Settings hierarchy and illustrative defaults

| Scope | Data/settings |
|---|---|
| Installation/device | Model root, installed runtimes and weights, selected workflow models, actual audio devices/channels, hardware execution, concurrency, local enable/automatic refinement mode, lifecycle/power limits |
| User | Default listening, default retention/chunking, shortcuts, onboarding tip count/dismissal, appearance, update and notification preferences |
| Project | Explicit retention and storage overrides, language, eligible source recordings, anchors, original transcript/metadata, queue records, proposals and review history |

Project inherits user defaults unless overridden; hardware safety and availability cannot be overridden by project data. Resolve inherited effective retention for each recording; do not allow different computer defaults to accidentally cause retroactive deletion. Codex should explain which preferences can actually be synchronised by current ABE architecture; user-scoped is not a promise of account/cloud sync.

Proposed initial defaults: manual refinement, 1,000-word maximum review chunk, 5-minute idle trigger if opted in, 5-minute post-inactivity unload, intelligent standby, 16 kHz/16-bit/mono speech audio encoded FLAC when persisted, delete audio after successful text save, warning at 80% of chosen allowance, one concurrent refinement job, notify about updates without auto-install, smallest compatible live model on new device. All relevant controls include explanations and safe validation; default no retained audio implies no future audio refinement unless retention was enabled before capture.

## 9. Repository audit starting points (verify current branch)

Prior inspection identified these areas; paths and behaviours may have changed. Treat them as leads, not permission to assume or rewrite the implementation.

- `AGENTS.md`, `agents/AudioVoiceAgent.md`, `agents/EditorAgent.md` and applicable nested instructions/active specs. Follow repository-directed ownership and supervisor/testing practices.
- `apps/editor/public/shell/editor-chrome.js`, editor `app.js` and `public/features`/`public/state`/`public/adapters` boundaries: settings and Narration workspace/shell, RHS lifecycle and shared editor commands.
- `apps/editor/public/features/local-ai/local-ai-panel.js` and desktop local-AI model settings/inventory routes: integrate catalogue/management with existing infrastructure.
- `apps/desktop/src/settings.ts`, `apps/desktop/src/http-app.ts`, `apps/desktop/src/realtime-speech-bridge.ts`, `apps/desktop/server.mjs`: local settings/root and loopback services; review current provider/selection contract and avoid weakening local API security.
- `apps/editor/public/features/narration/narration-realtime-speech-client.js`, live/desktop speech-tracker and speech-recognition services: preserve narration tracking and inspect provider lifecycle/session/audio contracts.
- `services/audio/src/index.ts` and `services/voice` ownership: reuse audio capture, ASR/alignment, typed job and voice-provider boundaries where appropriate.
- `docs/architecture/browser-prototype-desktop-future.md` and `docs/architecture/mobile-friendly-architecture.md`: distinguish implemented packaging/persistence from roadmap proposals.
- Existing manuscript persistence, stable scene/document anchors, proofreading, undo/redo, notification and theme/accessibility implementations; identify precise files and tests during audit.

Reference only: [Speech Kit Obsidian plugin](https://github.com/brittain9/speech-kit-obsidian-plugin), including `native/catalog.json`, `native/src/model_store.rs`, `native/src/installer.rs`, `native/src/adapters/moonshine.rs`, `src/models/manage-models-modal.ts` and hardware documentation. Study architecture and model-management UX; do not copy code/assets wholesale. Verify third-party licenses and attribution requirements. Speech Kit's own Moonshine ONNX adapter and official Moonshine runtime are distinct; native vocabulary biasing is deferred regardless. [Moonshine](https://github.com/moonshine-ai/moonshine), [whisper.cpp](https://github.com/ggml-org/whisper.cpp), [Whisper](https://github.com/openai/whisper), [FLAC specification RFC 9639](https://www.rfc-editor.org/rfc/rfc9639.html) are useful upstream references. Validate actual pinned versions and requirements before recommending integrations.

## 10. Approval-gated development roadmap

The following is a proposed sequence, not authorisation to execute. Codex may propose a different safe dependency order with justification.

| Phase | Deliverable | Gate / minimum completion evidence |
|---|---|---|
| 0 — audit and planning | Current architecture audit; dependency/risk analysis; file-level plan; data contracts; test plan | Read-only. Author approves plan before code changes. |
| 1 — model infrastructure | Shared registry, catalogue, download/import/update/removal and capability probing | Verified install/select/remove/retry; existing inventory compatibility; path safety tests |
| 2 — Narration shell | Subpanel navigation and contextual RHS components | Existing Narration Follow and Manuscript editing regressions tested; unavailable future features clearly labelled |
| 3 — live dictation | Streaming provider, mode/cursor, VAD, provisional/committed text, tooltips, undo/autosave | Real local dictation smoke test and deterministic editor/persistence integration tests, including low-resource device |
| 4 — storage and portability | FLAC chunks, metadata, retention/allowances and project reopen | Save-before-delete tests, interrupted writes, second-device project access, missing files and limits |
| 5 — refinement engine | Scoped, hardware-aware dispatch and lifecycle, cancellation/retry, status controls | Compatible and incompatible device tests, no automatic jobs by default, pause/disable, idempotent resume and no live dictation regressions |
| 6 — review interfaces | Dedicated review and inline presentation with whole/individual acceptance and manual edit exclusion | Both views synchronise; edited/deleted text protected, durable acceptance, undo/redo, partial review retention |
| 7 — integration/optimisation | Performance, cross-machine, resilience, accessibility and regression suite | Reproducible validation report and known limitations; user approval for release scope |

Each phase requires explicit user approval before implementation, and finishes with tests, completion report and a stop at the next gate. Smaller implementation steps within an approved phase may proceed without separate approval if within scope. No dependency installation, branch/commit changes or implementation during phase 0. Any later deviation from agreed requirements or approved scope requires explanation and approval.

## 11. Acceptance and verification checklist

Codex should map each requirement to tests, name actual existing test commands and identify any hardware-dependent tests it cannot run. Do not claim visual inspection or performance verification without executing it.

- Model manager: pinned artifacts, size/hash mismatch, interrupted/cancelled downloads, retry-byte accounting, disk-full, invalid imports, path traversal/symlink safety, shared files/in-use removal, update isolation, rollback and offline use.
- Workspace: existing Narration Follow and production capture remain intact; actual ordinary Manuscript double-click still selects a word. STT double-click switches modes at the intended location, single-click moves active anchor, navigation stops recording, no cross-scene delayed insertions, keyboard accessibility and theme/narrow-screen rendering.
- Live text: provisional updates don't corrupt formatting or undo stack; finalisation commits once; manual edits protected; exact redo and accelerated undo preserve chronological transactions; no resurrection of undone text. Standby preserves speech onset, proper device state and permissions.
- Audio/persistence: default retention removes only safely committed audio, retain modes work across reopen, partial acceptance protects referenced audio, policy changes don't retroactively delete, warning/limit and disk errors don't silently lose data, crash mid-file/commit/deletion handled without corrupting earlier saves.
- Refinement: disabled by default, explicit start and opted-in idle/background triggers, no local scheduling on unsupported hardware, compatible-device portability, queue pause/cancel/retry and no duplicate proposals, no idle unload while runnable backlog exists, disable releases resources and retains output, live priority, invalidation after author edits and no restoration of deleted passages.
- Review: whole/individual accept/reject/edit, stale proposal rejection, inline/central shared state, exact undo, audio replay where available, no automatic application, retention evaluated only after durable acceptance.
- Performance: measure time to first partial/final text, real-time factor, CPU/RAM/VRAM, model load time, dropped frames, UI responsiveness, retained storage and accuracy using reproducible samples and named devices. Establish baseline and target thresholds during audit; include silence, long speech, names and background noise. Do not promise unsupported latency or model capacity.
- Privacy and accessibility: no unexpected mic activation, no hosted fallback, no arbitrary executable imports, no unexpected recording retention/transfer; tooltip focus/touch and keyboard routes; clear errors/status and responsive layout.

## 12. Deferred development (explicitly outside initial implementation)

Worldbuilding-aware text post-processing/retrieval, native Moonshine/Whisper vocabulary biasing, contextual correction using character/location datasets, new full TTS/translation inference workflows beyond preserved existing functionality, dictation in ordinary Manuscript or arbitrary text fields, spoken commands, automatic three-way merging, and dedicated incomplete-audio crash-recovery UI. No fine-tuning or new contextual database required now. Keep interfaces extensible but do not prebuild unused complexity.

## 13. Codex phase-0 instruction

Read this specification, `AGENTS.md`, applicable agent instructions and active architecture docs. Audit the current repository and produce a **planning-only** response. Identify what exists, what needs extension, what is missing and what conflicts with this specification. Cite precise repository paths and symbols or line ranges, distinguish implemented behaviour from roadmap, and identify any stale assumptions. Verify candidate runtime/model compatibility and licensing as necessary. Produce the proposed dependency order, file-level changes, state transitions/data contracts (including audio ownership and durable save/delete ordering), migrations, UI integration, tests and acceptance gates. Highlight risks and unresolved technical choices, recommend alternatives where a simpler architecture meets the requirements and identify decisions requiring author review.

Do not modify files, install dependencies or models, create branches/commits, change settings, or begin implementation. Read-only inspection and non-mutating analysis only. If a tool/test would modify the repository or environment, propose it for a later approved phase instead. Stop after delivering the plan and request approval. Following approval, implement only the explicitly approved phase, run the agreed tests, report actual results and limitations, and stop before the next phase. Preserve existing ABE functionality and do not silently deviate from the requirements.

## 14. Decision implementation tickets

These tickets are branch-local requirement records, not GitHub Issues. All 26 decisions are approved; **none is an approval to implement or a claim that the work has been completed**. Acceptance evidence is prospective and must be refined against actual repository capabilities during Phase 0. Phase assignments are tentative. Do not create 26 parallel implementation workstreams or bypass approval gates.

### VTT-D01 — Separate speech-model roles

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure; Phase 3: live dictation; Phase 5: refinement engine

**Requirement:** Keep independently selectable live STT, final audio refinement and narration-alignment models while deduplicating installed artifacts.

**Acceptance evidence:** Selecting one role must not alter the other roles; incompatible model-task pairs are rejected; shared installed assets are not duplicated.

**Traceability:** Decision 01 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D02 — Hybrid dictation and optional refinement

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation; Phase 4: audio retention/portability; Phase 5: refinement engine

**Requirement:** Commit final live STT as accepted manuscript text. Default refinement OFF; support explicit/manual, configurable inactivity and opted-in background processing, preserving portable eligible audio.

**Acceptance evidence:** Dictation works without refinement; no default background jobs; opt-in and manual triggers enqueue only eligible work; no refinement proposal automatically replaces manuscript text.

**Traceability:** Decision 02 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D03 — Whole-chunk and individual review

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 6: refinement review

**Requirement:** Allow accept/reject for a full proposed chunk or individual corrections, plus direct proposal editing and optional source replay.

**Acceptance evidence:** Partial accept/reject persists; whole-chunk actions are predictable and undoable; edits to proposals cannot silently modify the accepted manuscript.

**Traceability:** Decision 03 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D04 — Audio retention and deletion

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 4: audio retention/portability; Phase 5: refinement engine; Phase 6: refinement review

**Requirement:** Default temporary audio removal only after durable live-text commit. Optional retain-until-refinement-acceptance or retain-until-manual-delete; quotas/warnings.

**Acceptance evidence:** Failed save never triggers deletion; recording retention is explicit and portable; limit warnings occur without silent loss; text-only future refinement is distinguished from audio retranscription.

**Traceability:** Decision 04 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D05 — Dual STT cursor and gestures

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell; Phase 3: live dictation

**Requirement:** Maintain edit and dictation anchors only within Narration STT. Single-click moves active cursor; double-click toggles record/edit mode at target location.

**Acceptance evidence:** Mode toggle does not accidentally insert or lose text; original utterance anchor survives delayed ASR; keyboard access and word-selection alternative exist.

**Traceability:** Decision 05 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D06 — Dictation viewport following

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation

**Requirement:** Follow the dictation anchor during live dictation; restore normal editing viewport behaviour when microphone is off.

**Acceptance evidence:** Dictation caret remains visible as text grows; ordinary editing does not unexpectedly scroll; switching mode preserves both anchors.

**Traceability:** Decision 06 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D07 — Intelligent microphone standby

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation

**Requirement:** Offer standby, continuous and silence-stop listening. Default standby may keep lightweight recognizer ready, with preroll buffering.

**Acceptance evidence:** Speech onset is not truncated at standby exit; mic ownership and recording/standby indicators remain correct; stopped mode releases capture.

**Traceability:** Decision 07 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D08 — Natural speech without commands

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation

**Requirement:** Never intercept spoken prose as application controls or force special spoken punctuation commands.

**Acceptance evidence:** Command-like utterances remain manuscript text; microphone and editing controls use explicit UI/keyboard actions, not voice triggers.

**Traceability:** Decision 08 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D09 — Deferred worldbuilding context

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 0: audit/planning

**Requirement:** Record worldbuilding terminology prompts and context-aware refinement as a future extension, not a prerequisite or hidden feature in MVP.

**Acceptance evidence:** Plan identifies extension seam but does not introduce unused contextual processing/training or native vocabulary-bias dependencies.

**Traceability:** Decision 09 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D10 — Safe scene/workflow navigation

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation; Phase 4: audio retention/portability

**Requirement:** Stop or finalise mic capture on scene changes or leaving STT; pending refinement remains independent; never auto-restart microphone.

**Acceptance evidence:** No delayed text writes to a new scene; correctly bound segment finishes or is safely abandoned; mic does not activate on return.

**Traceability:** Decision 10 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D11 — Provisional streaming text

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation

**Requirement:** Render revisable ASR hypotheses distinctly from accepted manuscript text and ensure only final utterances enter persistent undo history.

**Acceptance evidence:** Partials can update only their own range; no orphan styling or duplicate commits; manual edits invalidate stale hypotheses.

**Traceability:** Decision 11 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D12 — Chronological undo/redo integration

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation; Phase 7: integration/optimisation

**Requirement:** Integrate dictated segments and accepted proposals into existing chronological undo/redo; preserve accelerated held Ctrl+Z time-grouping semantics.

**Acceptance evidence:** Undo removes last committed dictated segment, redo restores exact content without rerunning model; late ASR cannot resurrect undone edits.

**Traceability:** Decision 12 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D13 — Scoped persistent refinement queue

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 5: refinement engine

**Requirement:** Support passage, scene, chapter, project; priority, pause/cancel/retry and durable per-job state across reopen or device transfer.

**Acceptance evidence:** Queued operations resume idempotently; cancelled jobs do not reappear as completed; job source references remain valid and project-scoped.

**Traceability:** Decision 13 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D14 — Manual edit protection

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 5: refinement engine; Phase 6: refinement review

**Requirement:** Exempt the smallest safely anchored manually edited section from refinement; edited/deleted passages defeat stale pending results without auto-merge.

**Acceptance evidence:** Refinement cannot overwrite user-edited text or restore deleted content; unaffected surrounding text remains eligible.

**Traceability:** Decision 14 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D15 — Linked dedicated and inline review

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell; Phase 6: refinement review

**Requirement:** Provide refinement subpanel and inline manuscript comparison backed by same durable proposal state.

**Acceptance evidence:** Accept/reject action in one view synchronises to other; reopened project retains pending decisions and undo behaviour.

**Traceability:** Decision 15 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D16 — Safe first-run and hardware fallback

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure; Phase 5: refinement engine

**Requirement:** Detect machine-local availability, default to smallest suitable live STT on new installs and avoid silent large-model CPU fallbacks.

**Acceptance evidence:** No automatic high-resource model load on lightweight laptop; missing model prompts for consent to install; project settings don't force incompatible compute.

**Traceability:** Decision 16 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D17 — Curated model catalogue and imports

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure

**Requirement:** Provide curated compatible local catalog plus advanced import with integrity, licence, artifact ownership and runtime checks.

**Acceptance evidence:** Corrupt or unsupported assets are rejected; users can inspect actual storage and safely remove owned, unused files; imports cannot execute arbitrary code.

**Traceability:** Decision 17 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D18 — Model update and rollback

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure

**Requirement:** Check updates configurably; default notify but install/activate manually; keep previous versions for rollback and protect active sessions.

**Acceptance evidence:** No silent upgrade or model hot-swap; can pin, rollback, cancel update and remove an unused version without harming shared files.

**Traceability:** Decision 18 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D19 — Machine/user/project settings hierarchy

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure; Phase 2: Narration shell; Phase 4: audio retention/portability

**Requirement:** Keep machine-specific model paths/devices/hardware separate from user defaults and project overrides; projects retain portable media/review state.

**Acceptance evidence:** Project moves without absolute runtime paths; machine defaults do not silently override explicit project settings; retention changes aren't retroactive destructive operations.

**Traceability:** Decision 19 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D20 — Narration subpanels and contextual RHS

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell

**Requirement:** Keep Narration Follow, STT, Refinement and architecture boundaries for TTS/Translation; RHS controls change by selected subpanel.

**Acceptance evidence:** Existing narration follow, alignment, capture and playback still work; future-only controls are honestly marked unavailable.

**Traceability:** Decision 20 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D21 — STT-only initial scope

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell; Phase 3: live dictation

**Requirement:** Confine live dictation gestures and microphone mode to Narration STT, not the standard Manuscript workspace.

**Acceptance evidence:** Ordinary Manuscript double-click still selects a word; no unsolicited mic affordances or altered editor gestures elsewhere.

**Traceability:** Decision 21 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D22 — Workflow-specific microphone selection

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell; Phase 3: live dictation

**Requirement:** Provide machine mic default and independent workflow overrides, channel selection, input test and distinct STT vs narration recording quality.

**Acceptance evidence:** Selection/disconnect/permission handling is visible; input profile changes don't silently compromise narration-quality audio.

**Traceability:** Decision 22 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D23 — Queue-aware and hardware-aware lifecycle

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 1: model infrastructure; Phase 5: refinement engine

**Requirement:** Probe hardware/model feasibility before scheduling local refinement; pause/disable instantly available; keep model during runnable backlog; unload when truly idle.

**Acceptance evidence:** Unsupported devices do not start a local processing queue; disabling preserves completed output and retained eligible source; active jobs never unloaded mid-operation; paused/waiting queues need not hold resources.

**Traceability:** Decision 23 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D24 — Incremental durability, not bespoke recovery

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 3: live dictation; Phase 4: audio retention/portability; Phase 5: refinement engine

**Requirement:** Save final live speech as manuscript transactions independently of proposed 3–4-minute audio chunks; completed audio remains bounded and separately committed.

**Acceptance evidence:** Unexpected shutdown preserves previously saved speech and completed audio; only final in-flight segment may be lost; restart never duplicates completed text or jobs; no complex bespoke audio-recovery UI.

**Traceability:** Decision 24 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D25 — Persistent progress and configurable notices

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 2: Narration shell; Phase 5: refinement engine

**Requirement:** Display always-accessible queue state and pause/disable control; completion, error and storage notifications configurable and quiet by default.

**Acceptance evidence:** Progress remains visible while author changes panels; processing is distinguishable from paused, unsupported or awaiting review; warnings and toggles work.

**Traceability:** Decision 25 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.

### VTT-D26 — Approval-gated delivery and testing

**Decision:** Approved in 26-question Grill Me session · **Implementation:** Not started / requires phase approval  
**Proposed delivery:** Phase 0: audit/planning; Phase 7: integration/optimisation

**Requirement:** Require Phase-0 plan approval and per-phase implementation authorisation, objective tests and completion reports before progressing.

**Acceptance evidence:** No implementation prior to approval; each approved phase reports code changes, executed tests, provenance, limitations and acceptance evidence and stops at next gate.

**Traceability:** Decision 26 in section 2; see detailed interaction, lifecycle, retention and test contracts in sections 3–11.


## 15. Pending user-acceptance / UX review tickets — 23 November 2026

These findings are appended to the existing decision register without revising or superseding VTT-D01–VTT-D26. Round 2 Decisions 1–13 are now authorized by the execution contract above; the implementation status appended below qualifies completion. Historical observations and decision-time authorization wording are retained for traceability. Findings distinguish the author's field observations, source inspection and machine verification. The implementation is a development snapshot, not a finished interface.

### VTT-UX-01 — Microphone configuration and permission lifecycle

**Grill Me Round 2 · Decision 10 — APPROVED (23 November 2026): Option A, lock active capture configuration.** During an active STT recording, the selected microphone/device, input channel and active live-recognition model are **read-only** in both the contextual RHS and User Settings (and any onboarding/model-management view). Do not hot-swap capture inputs or recognition engines, and do not queue a requested selection change for the next recording. Keep Record/Stop or applicable Stop/Finalize actions accessible; restore editing only after capture has stopped and the session has safely finalized or the appropriate failure/retry state has been resolved. Display a brief reason for disabled controls, e.g. “Stop recording to change microphone or model.” Non-disruptive preferences may remain editable if they do not alter active capture, persistence or runtime ownership. The lock applies to programmatic/settings endpoints too, not just disabled UI widgets; preserve coherent capture leases and avoid write-through from another settings surface. This is approved UX/safety behaviour **only**; implementation and exact finite-state locking rules require later phase authorisation.

**Grill Me Round 2 · Decision 9 — APPROVED (23 November 2026): Option B, with mirrored controls in User Settings.** The **contextual Narration STT right-hand console (RHS)** is the primary in-workflow home for microphone/device and channel selection, Test Input/Stop Test and meter, live-model selection/management, and relevant configuration. The **User Settings panel** must also expose those appropriate device, model and speech preferences, including the broader model-library storage management approved in Decision 6. Both surfaces are views over the **same underlying settings and device state** and must stay synchronised; avoid duplicate, divergent preferences or a competing mic/model subsystem. Maintain a compact always-accessible **Record/Stop, active microphone indicator, and model/session readiness** strip in the central STT workspace even when the RHS is collapsed. Recording transport remains in the STT workflow, not global User Settings. Device/model paths and runtime capabilities are installation-specific, while user defaults and project overrides follow existing D19/D22 ownership rules; adding a User Settings surface does not imply cloud/device synchronisation. The onboarding flow also uses these same controls/state rather than independently implementing them. This approves UX placement and shared-state behaviour **only**; no implementation is authorised yet.

**Grill Me Round 2 · Decision 8 — APPROVED (23 November 2026): Option B, explicit Test Input with live meter.** Microphone selection and permission discovery must not automatically begin a lasting microphone test. Provide a deliberate **Test Input** action in the Narration STT contextual RHS which starts a visible live input-level meter (and clipping indication) for the selected device/channel; where supported, the author can select and verify individual input channels, applying a safe stream restart if required. A separate **Stop Test** action releases the capture stream and restores an accurate microphone-off status. Testing must neither transcribe speech nor persist any audio or manuscript text. Leaving the STT workflow, changing to a conflicting capture workflow, or encountering a device/permission failure must stop and release testing safely. The three-stage first-use setup may provide access to this same explicit test. Preserve one owner of the mic at a time, state/permission transparency, and accessibility. This approves UX behaviour only; streaming implementation changes and technical channel-switch semantics require subsequent implementation authorisation.

**Grill Me Round 2 · Decision 2 — APPROVED (23 November 2026): Option B, permission on explicit microphone selection/setup.** Opening the microphone selector or its adjacent setup affordance in the Narration STT RHS should initiate the browser/OS permission request **only when needed and permitted by an explicit user gesture**. Once permission is granted or an existing grant is detected, automatically re-enumerate inputs and update all microphone selectors (including the setup flow); no manual Refresh Inputs step. When devices connect/disconnect or permission changes, reconcile the available list and selected device where the platform exposes reliable events. **Test Input remains a separate, explicitly activated microphone-level test**, not a hidden permission-discovery prerequisite. No dictation recording starts from a selector, setup screen or permission grant. Handle denial, revocation, missing devices and unsupported browser behaviour visibly. This approves the UX interaction behaviour only; precise capture-stream lifecycle, fallback and permissions API tactics still require technical design and implementation authorisation.

**Reported observations:** Microphone setup is not sufficiently integrated into the Narration STT right-hand console. Permission appears to be requested through Test Input; after permission is granted the author must manually select Refresh Inputs before the microphone options populate.

**Source diagnosis:** `createDictationController.handle("dictation-stt")` in `apps/editor/public/features/narration/dictation-controller.js` calls `devices()` on entry, which calls `navigator.mediaDevices.enumerateDevices()` without first requesting access. Both Test Input (`start(true)`) and Record (`start(false)`) eventually call `startDictationCapture()` in `apps/editor/public/adapters/dictation-capture.js`; its `getUserMedia()` call is the permission-triggering boundary. Selecting the dropdown only changes the saved device preference. After capture permission succeeds, `beginStart()` stores deviceInfo and renders, but does not call `devices()` again. There is no permission-change/devicechange subscription. This leaves the pre-permission list/labels in view.devices until explicit Refresh Inputs or STT re-entry. Browser restrictions govern what that initial list exposes; the source gap explains the author's observed stale dropdown without claiming cross-browser reproduction.

`renderDictationPanel()` owns microphone/channel controls, Test Input and the level meter in the central panel. `renderDictationSidebar()` currently supplies only status and directions to the central panel. Track-ended disconnect detection already exists in the capture adapter, but automatic device-list reconciliation does not.

**Proposed behaviour for review:**

- Provide microphone selection/setup directly in the contextual STT RHS console while preserving access with that console collapsed.
- An explicit microphone setup/selection action should request permission when necessary, then automatically re-enumerate devices and refresh every affected dropdown.
- Test Input should test the selected microphone, not be an obscure prerequisite for discovery.
- Explain denied permission, unavailable devices, disconnection and browser-specific restrictions with actionable recovery. Never begin recording without an explicit author action.

**Decisions still needed:** Whether permission setup opens and immediately releases a temporary stream or uses a browser-supported permission flow; denied/device-lost recovery; system-default versus explicit-device semantics and workflow overrides (D22); exact safe mid-test channel switching. Active recording configuration locking (Decision 10), RHS plus mirrored User Settings and persistent central transport/status placement (Decision 9), permission-trigger/refresh semantics (Decision 2) and explicit non-persistent Test Input with Stop Test (Decision 8) are approved above.

**Candidate acceptance after approval:** Fresh permission, existing permission, denied/revoked permission, no devices and disconnect cases; automatic list refresh with no manual workaround; chosen device used for Test Input; no unintended recording; keyboard access with RHS expanded/collapsed. Related decisions: D10, D20–D22, D25.

### VTT-UX-02 — Model installation, selection and readiness

**Grill Me Round 2 · Decision 6 — APPROVED (23 November 2026): Option C, full model-storage management.** In advanced model management, expose the current machine-local model-library root, each managed model's storage location and disk usage, plus **Open Model Folder** and an explicit **Choose Storage Location** action. Support a **guided relocation of installed managed models to another drive**, rather than requiring users to manually move assets. Relocation must account for the existing shared Local AI model-root ownership (not just speech models), require no active model leases/downloads/inference, preflight free space and destination safety, preserve pinned identities and verified checksums, and use safe staged copy/verification followed by settings cutover with rollback/recovery on failure. Do not delete original model files until the new library is verified and the cutover is confirmed; do not relocate unmanaged external imports or project-owned audio implicitly. A root change must not silently invalidate current assignments. The feature is approved in scope, but the migration mechanism, conflict policy, exact ownership boundaries, tests and implementation phase require a Codex design proposal and later separate authorisation. No current-file migration is requested by this decision.

**Grill Me Round 2 · Decision 5 — APPROVED (23 November 2026): Option C, separate model categories.** Present **Live Dictation Models** and **Refinement Models** as clearly distinct groups, describing live STT as the minimum required for dictation and refinement as an entirely optional higher-accuracy follow-up workflow. The first-use guided setup shows only compatible live-dictation models and does not imply that Whisper or any refinement model is required. Keep refinement models discoverable in advanced model management for users who wish to prepare in advance, with accurate status that refinement execution is not yet available in the current functional checkpoint. Independent roles/selections and shared managed model storage remain governed by existing decisions D01 and D17–D19. No model installation, inference or implementation change is authorised by this decision.

**Grill Me Round 2 · Decision 4 — APPROVED (23 November 2026): Option C, smart automatic Live STT model selection.** When no live model is assigned, successfully installing the first compatible live STT model should automatically assign it to the Live STT role and show that assignment clearly. Installing additional models must **not** replace an existing valid live-model choice. Do not download models automatically, silently choose an unrelated refinement model, or rely on an invisible implicit Moonshine fallback in the user-visible selection state. When a selected model becomes missing or incompatible, surface that issue with a deliberate corrective choice rather than unexpectedly switching providers. Refinement model assignment is independent and optional. This records an approved UX decision only; no installer or host change is yet authorised.

**Grill Me Round 2 · Decision 3 — APPROVED (23 November 2026): Option C, two-level readiness.** Distinguish **Model Ready** (the selected compatible local live model's files have been verified and its associated inference runtime is available/loadable) from **Ready to Record** (Model Ready plus a usable authorised microphone/channel, an applicable saved project package and selected scene, and no conflicting capture or pending unsaved session). Where any prerequisite is missing, display its specific reason and an actionable remedy rather than a misleading general Ready indicator. The live recording button's enabled state must reflect the applicable end-to-end preflight, while still handling permission revocation, disconnects and races gracefully at start time. At the current checkpoint, Ready to Record means local transcription/recording preview—not completed automatic manuscript insertion. This approves UX semantics, **not** an implementation change, a guarantee against asynchronous device failure, or a particular method or frequency for expensive model-load probing.

**Reported observations:** The author installed Moonshine Tiny but not Whisper Tiny. It is unclear whether Moonshine alone is sufficient to begin local transcription.

**Storage and machine audit:** `createSpeechModelStore()` in `services/local-ai/speech-model-store.ts` publishes under `<configured modelRoot>/speech/<model-id>-<pinned-revision>/`, using `abe-model.json`. Moonshine's installed directory is `moonshine_tiny_streaming_en-015f7269048251aff164cb60df02bfea76884c8f`. Required files are `frontend.ort`, `encoder.ort`, `adapter.ort`, `cross_kv.ort`, `decoder_kv.ort`, `streaming_config.json` and `tokenizer.bin` (51,441,771 artifact bytes), plus the managed manifest. The actual absolute machine path is reported in the completion response, deliberately not committed here.

On 23 November 2026, read-only inspection verified all installed artifact sizes and SHA-256 values, the stored live assignment `moonshine_tiny_streaming_en`, and an empty refinement assignment. Whisper was absent. The official Transcriber successfully loaded this actual installed Moonshine directory and reported native version 30000. The runtime probe returned moonshine-voice 0.1.6, CPU ready, and recordingReady true after FLAC encode/decode verification. This audit opened no microphone, changed no settings, and did not rerun author-device speech accuracy tests.

**Selection/runtime mapping:** `dictationHost.handle("settings")` in `apps/desktop/src/dictation-host.ts` validates compatible installed roles. Its start route resolves the stored liveModelId, falling back to Moonshine Tiny when empty; validates the saved package, probes the Python runtime/FLAC encoder, acquires a checksum-verified model lease and starts `createDictationEngine()`. The engine launches the fixed `moonshine_dictation.py` adapter, whose Transcriber explicitly uses `ModelArch.TINY_STREAMING` and the installed directory. Whisper is refinement-only and is **not required for basic live STT**; refinement execution is deferred. No new Narration Alignment assignment exists.

**Current readiness gaps:** `renderDictationPanel()` enables Record when not busy, the Moonshine runtime and FLAC encoder report ready, and any installed catalogue model has the live role. This button check is not a complete preflight for the selected model, project, scene, microphone permission or usable channel. The controller separately requires Narration/STT, a saved folder package and no active Follow/session or unsaved pending session. The host then performs package identity, hash and actual model-load checks. Permission/capture can still fail after those checks. An enabled button therefore does not prove end-to-end readiness.

There is no code requirement to install both models, but the panel presents live and refinement catalogue entries together without a guided minimum setup. It displays installed/not-installed, role assignment, install progress/errors, runtime and FLAC status, mostly inside Manage speech models. An empty assignment can still use the implicit Moonshine fallback while its button says Use for live STT. That mismatch and the absence of one consolidated readiness explanation warrant review. The author's current machine has no verified model/runtime blocker; the current browser project's saved-package/scene state and microphone permission remain separate prerequisites, not assumed verified by this audit.

**Proposed states for review:** Not Installed, Installed, Selected, Loading, Ready, Incompatible and Error. Separate files, assignment and successful runtime readiness; make refinement visibly optional and explain each blocking prerequisite.

**Decisions still needed:** How and when to probe/load without excessive latency; detailed safe migration design and phase sequencing for the approved storage-root picker and guided relocation. Separate model categories, smart first-model assignment, user-visible absence of hidden fallback, two-level readiness and full model-storage management scope are settled above. Candidate acceptance should exercise missing/corrupt model, incompatible runtime, absent ffmpeg, selected versus installed mismatch and a Moonshine-only successful start. Related decisions: D01, D16–D19, D23, D25.

### VTT-UX-03 — Guided first-use STT setup

**Grill Me Round 2 · Decision 13 — APPROVED (23 November 2026): Option B, guided runtime/model installation with explicit approval.** The inline STT first-use flow should detect any missing compatible **live speech model, local inference runtime, and required audio encoder**, and offer to install **supported, verified components** through a guided user interface without requiring the author to execute Python/pip/FFmpeg commands manually. Identify the recommended lightweight local model and missing dependencies, disclose downloads (source, size/license where available), destination and progress, and obtain explicit author approval **before** any download, installation or change. Use ABE-managed, versioned/isolateable components rather than silently modifying system-wide Python installations or allowing arbitrary executable/model-code imports. Verify artifact integrity, compatibility, prerequisites and functional readiness; support safe cancel/retry/error recovery. Preserve existing installations and separate live dictation from optional refinement; no Whisper/refinement download is required to use Moonshine live. This is **current-phase UX direction**, not a requirement to bundle all inference components in the ABE installer (Option C remains a possible later packaging evolution). Exact trusted distribution sources, license terms, deployment/rollback/security design and runtime installation mechanism require Codex technical audit and separate implementation authorisation. No model or runtime installation is triggered by recording this decision.

**Grill Me Round 2 · Decision 12 — APPROVED (23 November 2026): Option C, installation-local onboarding progress plus independent live readiness.** Persist whether first-use Narration STT onboarding has been completed **for this installation/device**, and save enough incomplete first-run progress to reopen at the relevant unfinished stage. This state must not travel with a portable manuscript project or imply cloud synchronisation. Independently re-evaluate actual selected-model/runtime, microphone permission/device/channel, project/scene and capture ownership prerequisites whenever relevant; a saved `setupComplete` value never substitutes for a fresh Model Ready or Ready to Record determination. Returning authors with previously completed setup should stay in the normal STT workspace even if availability changes, with contextual repair actions and an optional Reopen Setup command (Decision 7). Interrupted first-time users should resume or revisit incomplete steps without forcing completed valid ones to repeat; no microphone activation, model download or recording occurs automatically on resume. Reconcile against existing ABE machine-settings ownership, avoiding a second divergent settings store. Exact persisted schema, invalidation/event wiring and resume UX remain technical implementation design tasks. This is an approved UX contract only; no implementation authorisation.

**Grill Me Round 2 · Decision 11 — APPROVED (23 November 2026): Option C, separate Finish Setup and Start Dictating actions.** At the final stage of the inline STT onboarding flow, show an accurate readiness summary and **two explicit options**: **Finish Setup** closes onboarding and returns to the normal STT workspace **without activating the microphone or starting capture**; **Start Dictating** requests a deliberate recording action and, after verifying the current model, microphone, project, selected scene and capture ownership prerequisites (Decisions 2–3), starts the permitted live dictation/recording workflow. Do not begin capture merely from completing preceding steps, granting permission or reopening setup. If Start Dictating is blocked, explain the exact prerequisite and offer its corrective action; do not falsely mark recording started. In the present preview checkpoint, this action can only begin the local transcription/recording preview, **not automatic manuscript insertion**, which remains gated. Exact persistence of onboarding completion and return-visit behaviour remains for Decision 12. This records UX approval only, not implementation authorisation.

**Grill Me Round 2 · Decision 7 — APPROVED (23 November 2026): Option C, adaptive setup and recovery.** New authors who have never completed a valid STT setup should be guided through the three-stage inline onboarding flow from Decision 1. **Returning authors stay in the normal STT interface even if a previously working dependency becomes unavailable**; rather than reopening the wizard unsolicited, show the specific unavailable prerequisite and a contextual recovery action (for example **Reconnect Microphone**, **Locate Model**, or **Repair Setup**). The full guided setup remains available on deliberate user request, including from the RHS. Re-evaluate real device/model/runtime/project readiness as conditions change; a prior completion flag must not falsely report Ready. Avoid prompting for microphone access, downloading models or starting capture automatically during recovery. Exact persisted onboarding state, recovery UI placement and event/probe mechanisms remain technical design questions requiring later approval. **This records approved UX behaviour only, not implementation authorization.**

**Grill Me Round 2 · Decision 1 — APPROVED (23 November 2026): Option C, hybrid guided setup.** On first entry to Narration → STT when configuration is incomplete, display a compact **three-stage guided setup within the central STT panel** (microphone authorisation/test → live-model choice/readiness → ready to dictate). Keep microphone and model controls accessible in the contextual **right-hand sidebar (RHS)**, both during and after onboarding. When setup is valid, the guided flow disappears rather than interrupting subsequent visits; the author can deliberately reopen it from the RHS. Do not download models, activate the mic or start recording without explicit author action. This approves the **UX interaction direction**, not implementation, a full readiness definition or microphone-permission mechanics. The technical details remain open for the following Grill Me questions.

**Original proposal (retained for traceability):** Offer a lightweight first-use setup when opening Narration → STT without a valid configuration:

1. Welcome / Configure STT.
2. Select and authorize a microphone.
3. Verify input using a live meter.
4. Detect local hardware capabilities.
5. Identify suitable locally available speech models.
6. Select or explicitly download one compatible lightweight live STT model if necessary.
7. Verify model and runtime readiness.
8. Complete setup and begin dictating only through an explicit author action.

Recognize valid existing installations; do not require unrelated refinement models or repeatedly interrupt configured authors. Keep a Reopen setup action in the STT RHS console. No first-use wizard or persisted setup-completion mechanism currently exists: STT entry enumerates inputs, fetches model/runtime state and renders the panel. Current capability reporting covers the fixed CPU runtime and FLAC readiness, not hardware-based model recommendations.

**Decisions still needed:** Exact skip/back behaviour within first-time onboarding; technical persistence schema, readiness revalidation/event wiring and resume UX; hardware model recommendation policy and detailed installer security/compatibility design; microphone permission implementation details and RHS control availability. Explicitly approved guided installation (Decision 13), installation-local completion and resumable progress (Decision 12), two completion actions (Decision 11) and non-intrusive returning-user recovery (Decision 7) are approved above. Preserve D01–D26 and local-only inference.

**Candidate acceptance after approval:** A fresh author can reach a working Moonshine-only session; valid existing configuration bypasses interruptions; failures have recoverable steps; setup can be reopened; no implicit model download or recording. Related decisions: D01, D16–D23, D25–D26.

### Publication audit, phase status and verification

The existing implementation and checkpoint report were first published by normal fast-forward push to `feature/narration-vtt`, ending at `56c6e9b33c5d0643d8f1112e3a28e33e9605a92e` (implementation commit `acc4461a66d27df87b9445345af20d9e4f16a3a3`). This acceptance appendix is a subsequent documentation-only commit. No proposed UX logic was implemented.

Fresh repository-supervisor verification of the published source passed **143/143 FULL tests**; local report `.tools/reports/20261122T161208-aaa8/report.json` (RUN identifier is UTC; author-facing audit date is 23 November in Australia/Perth). No browser acceptance run or microphone capture was repeated while the author was testing. Earlier real inference, physical-input capture and controlled save/playback/reopen/Save As evidence, plus its limitations, remain in `narration-vtt-functional-checkpoint-report.md` sections 5–11.

Phase 1 model infrastructure and Phase 2 STT shell are implemented only to checkpoint scope. Live capture/transcript preview and completed recording persistence provide a bounded vertical slice across later phases; they do not complete Phase 3A, Phase 4 or Phase 3B. Delivered portions cover D01 live/refinement separation, D10 stop barriers, D11 provisional/final separation, D16–D19 curated model management, D20–D22 STT shell/input controls, and partial D23–D25 lifecycle/storage/status. Full per-decision status remains in the checkpoint report section 13. The present UX findings qualify usability acceptance of those portions, not the historical decisions themselves.

Automatic manuscript insertion, shared chronological history, two-anchor gestures, independently rotating audio chunks, durable-text-authorized deletion, full standby/hardware scheduling, refinement/review and broader workflow microphone profiles remain unfinished. Four-minute capture retains PCM in memory until Stop; there is no crash-recovery/zero-loss guarantee. Human speech accuracy on the author's microphone, an OS-wide offline test, exhaustive crash boundaries, multi-tab ownership and a fresh real-runtime Narration Follow read-through remain unverified. Existing automated Follow/Manuscript regressions pass. Earlier failure evidence is preserved in the checkpoint report; a rendering pass is not evidence that first-use UX is complete.

**Recommended order after Grill Me approval:** Agree on the minimum readiness contract and live/refinement distinction (UX-02); repair permission/discovery and decide contextual control placement (UX-01); add the approved first-use flow on top of those shared readiness/capture services (UX-03); perform fresh real-device author acceptance. Separately approve Phase 3A history/receipt foundations, Phase 4 durable chunk/retention guarantees and then Phase 3B automatic insertion. This ordering is a recommendation, not new implementation authorization.

### Round 2 implementation checkpoint — 23 November 2026

Implemented on the dedicated `feature/narration-vtt` worktree from authorization commit `4f0c4d437c2dfd2d779963d9908789a01f13daa5`. No Decisions 14–18 or other VTT phases were implemented. This status qualifies the approved scope; it does not mark high-risk deferred mechanisms complete.

| Round 2 decision | Delivered behaviour / status |
|---|---|
| 1 | Three-stage inline setup: input authorization/test, compatible live model, final readiness/actions. RHS remains available. |
| 2 | Explicit Set up microphone opens a temporary permission stream and releases it; labels/devices refresh after grant and supported permission/device events. Denial/unavailable input is visible. No entry-time capture. |
| 3 | Shared `dictationReadiness` separates selected/loadable Model Ready from Ready to Record, including encoder, authorized available input/channel, saved package, scene and capture/pending-save conflicts. Model probes cached briefly; start revalidates. |
| 4 | Successful first compatible live install selects only an empty assignment; asynchronous completions re-read settings and never replace an existing choice, including an unavailable author choice. Hidden Moonshine fallback removed. |
| 5 | Live Dictation is required; refinement is a separate optional advanced group labelled execution unavailable. Onboarding shows live models only. |
| 6 | **Partial:** library/model locations, sizes, Open Model Folder and native destination picker with read-only relocation preflight. Reject nested/nonempty/linked destinations, linked source entries and insufficient free space. No copy, root cutover or deletion is exposed. See unresolved safety design below. |
| 7 | Completed installations retain normal STT on return; missing prerequisites produce contextual repair. Reopen Setup is explicit. |
| 8 | Explicit Test Input / Stop Test, mirrored level/clipping meter, channel selection and capture release. Tests produce no recognition or saved audio. Stop the test before changing channels; hot switching is not implemented. |
| 9 | RHS is primary settings surface; existing User Settings composes the same speech settings projection. Central transport/readiness and expandable controls remain accessible. All use one desktop speech settings record. |
| 10 | UI and host lock device/channel/model configuration from startup through recording/finalization and pending metadata save; successful verified registration acknowledges release. User Settings can be inspected during recording without stopping capture. No queued replacement. |
| 11 | Finish Setup closes without capture. Start Dictating is an explicit readiness-gated action for the existing transcript/recording preview. |
| 12 | `speech.setupComplete` and `speech.setupStage` persist in existing installation-local desktop settings; readiness is independently derived. No project/schema migration or competing browser store. |
| 13 | **Partial:** explicit model consent shows source, size/license and destination; existing staged/checksummed install/cancel/retry remains in use. Runtime/encoder probes and a visible dependency-plan explanation exist. No automatic executable/runtime installer is exposed; trusted full dependency packaging remains unresolved. |

Implementation boundaries: `dictation-inputs.js` owns browser permission/device discovery, `dictation-readiness.js` the shared readiness projection, the existing Dictation controller/panel shared UI and setup orchestration, and desktop settings/host machine authority and finalization locks. `speech-model-selection.ts` owns first-install assignment, and `speech-storage-plan.ts` the non-destructive storage audit. Existing Follow pipelines, manuscript commands, canonical session serialization and the regression controller remain unchanged. The caller-owned Dictation browser CASE was expanded; no supervisor routing or harness-controller policy was changed.

**Safety design still required for Decision 6:** A library root belongs to all Local AI families, not just speech. Introduce a shared lease/download/inference barrier across those owners before cutover; enumerate manifest-owned files and explicitly resolve unmanaged imports rather than assuming ownership. Proposed conflict policy is refuse nonempty destinations (the preflight already does so). The next implementation needs staged copy, pinned-file verification, atomic machine-settings cutover, recoverable journal/rollback, and explicit confirmation before any original cleanup. The present UI only audits sizes/free space and reports this boundary; it does not claim checksum-verified copies or rollback coverage. No actual author model library was migrated. Direct legacy Local AI root changes cannot silently invalidate a selected speech assignment.

**Safety design still required for Decision 13:** Approve a complete platform/version manifest for the Python distribution, Moonshine native wheel, transitive binary dependencies and the selected encoder build, with trusted sources, pinned hashes, redistributable licenses and compatibility checks. Proposed mechanism is an ABE-managed versioned runtime directory, binary-only hash-locked offline installation after explicit download consent, staged functional probing, cancel/retry cleanup and rollback to the previous validated version. No arbitrary executable URL, source build or system-wide Python mutation should be accepted. Existing validated local installations remain usable; a clean machine without dependencies cannot yet complete one-click runtime setup. The current plan UI makes that limitation explicit and executes nothing.

**Verification evidence:** Expanded controlled browser CASE passed explicit permission refresh with a fake microphone, input testing with no session output, stage-2 resume after reload without capture, Finish Setup without capture, editable User Settings/RHS synchronization, explicit Start Dictating, mirrored active-recording locks, host rejection of a settings mutation, actual local Moonshine recognition, injected save-failure retry, FLAC playback, reload, Save As and cold host/browser reopen. Latest completed browser evidence at this checkpoint: functional RUN `20261123T131310Z-vtt-functional-recording-7f9ae872`, cold RUN `20261123T131340Z-vtt-cold-reopen-9ebe2b0c`, under the existing external verification workspace. Screenshots include `stt-panel.png`, `stt-user-settings-locked.png` and `stt-narrow-rhs-collapsed.png`; inspected visually. The final source also preserves settings fields across asynchronous validation, catches refresh errors and releases input tests on closing User Settings without stopping actual recording. Both RUN manifests report unchanged source identity during execution; lifecycle completion is separate from the passing CASE assertions.

Focused deterministic tests cover permission grant/denial/devicechange and duplicate permission requests, readiness failure combinations, separate model groups, machine settings lock, first-model completion races/no override, and read-only storage conflict/containment preservation. Existing installer tests retain checksum, failed download, cancellation and retry coverage. The full suite was rerun sequentially after an earlier concurrent browser run conflicted with a test that checks the desktop-settings file for changes; this was a verification scheduling conflict, not a passed durability test. Browser actions now wait for boot event wiring to avoid early-click races.

Physical microphones were not opened in this tranche; no fresh human speech accuracy, cross-browser permission-dialog acceptance, low-resource performance or OS-wide offline claim is made. Multi-tab Test Input arbitration and recovery after an abruptly closed active-capture tab remain outside this checkpoint's verified ownership coverage. Existing four-minute recording/preview and later manuscript safety gates remain in effect. Decisions 6 and 13 require the designs above before their remaining mechanisms can be represented as complete.

**Final verification / publication record:** implementation commit `d493a3c271a883f2af426630d4819c7083c7fe08`; subsequent documentation-only closeout records these findings. `npm run repo -- test --changed --level affected --base 4f0c4d437c2dfd2d779963d9908789a01f13daa5` escalated to FULL and passed **147/147**, zero failures, report `.tools/reports/20261123T131245-3b10/report.json`. The final controlled browser run above was executed sequentially after that suite and passed all stated acceptance checkpoints. Browser test hosts were stopped and prior desktop settings restored. Actual model files and author projects were not migrated or modified; no runtime dependencies were installed. Model auto-selection races and failed/denied scenarios have deterministic coverage; fresh network download and physical-device permission dialogs were not re-exercised. The native picker/Open Folder integration and full clean-machine runtime provisioning still need interactive platform acceptance; the latter remains explicitly unavailable. Final remote SHA is supplied in the completion response after normal fast-forward publication.


### Decisions 6 and 13 continuation — 26 November 2026

The author's request to continue Decisions 6 and 13 was implemented from published checkpoint `7339886e6f13f81bd11e4bc55a1a997203800053`, in the dedicated VTT worktree. This section updates the historical partial statuses immediately above. No Decisions 14–18, project schema changes, manuscript insertion or Follow pipeline changes are included.

**Decision 13 — implemented for Windows x64.** Explicit runtime consent in the RHS, central settings, User Settings and onboarding discloses sources, exact download sizes, licences and the private installation directory. The fixed catalogue contains CPython 3.14.10 embeddable, Moonshine Voice 0.1.6, SoundFile 0.13.1 with libsndfile, and all 16 pinned binary wheels/transitive dependencies: 45,330,890 download bytes in 17 archives. Python's SHA-256 was checked against its [official release page](https://www.python.org/downloads/release/python-31410/); wheel sizes/hashes and package licences were checked against exact-version PyPI JSON metadata. The full source URLs and hashes are durable in `services/local-ai/speech-runtime-catalog.json`. The [Python embedded distribution contract](https://docs.python.org/3.14/using/windows.html#the-embeddable-package) supports this private application runtime; [SoundFile's binary distribution](https://python-soundfile.readthedocs.io/en/latest/) supplies the FLAC library. All upstream licence files, including libsndfile's LGPL text, remain installed.

Downloads are consented, streamed, size-bounded and SHA-256 verified before extraction/execution. Archive extraction rejects traversal, links, duplicate names, unsupported hooks and oversized output. No pip, source build, PATH registration or system/user Python mutation occurs. Isolated `._pth` configuration excludes user packages/environment; adapter processes disable bytecode writes. The install probes Moonshine native loading and exact PCM→FLAC→PCM equality before atomic activation. Existing generations survive failed upgrades/cancellation and remain on disk. Subsequent execution rehashes the active generation; corruption is actionable rather than silently selecting system Python. The existing external runtime remains usable when no managed runtime is selected. An explicit developer `ABE_DICTATION_PYTHON` override retains its previous meaning.

Runtime state lives beside installation-local desktop state in ignored `.speech-runtime`, separate from models and projects. Concurrent installs are excluded with an exclusive filesystem lock. Recording/finalization and setup operations block conflicting changes in both host and UI. Retry requires reviewing and approving the plan again. **Limits:** only Windows x64 is provisioned; no clean Windows VM, physical microphone or OS-wide offline claim. A crash can leave an installation lock/staging generation; these are retained for manual inspection, never automatically broken or deleted. Automatic stale-lock recovery, old-version garbage collection and a user-selectable rollback screen are not implemented. Failed/cancelled installation preserves the prior activation; a successful explicitly approved retry creates a fresh generation.

**Decision 6 — staged-copy portion implemented; activation remains incomplete.** The native picker/preflight now leads to a separate **Approve staged copy (keep current library)** action. It refuses nonempty/nested/linked roots and inadequate free space, checks size again after consent, copies into a unique owned stage, fsyncs files, and compares SHA-256 inventories of both source and destination after copying. Empty directories are preserved. A verified receipt records the result. Source changes/failures/cancellation retain originals and the active root; partial copies remain labelled for inspection and retry into a new empty destination. No root settings write or source deletion capability exists in this service. Runtime and relocation stages are machine/recovery state, never portable project data.

This is a verified copy of file bytes, **not approval to activate arbitrary/unmanaged models**. Source model ownership across Local AI families and external providers is still not coordinated by a common cross-process lease. In particular, the HTTP llama.cpp provider does not own the external server lifetime/model lease. The remaining design is to establish shared inference/download leases across owners, resolve unmanaged manifests explicitly, then implement guarded atomic root activation, persistent restart recovery and rollback. Original cleanup remains a separately confirmed future action. The UI deliberately offers no switch-root action. No real author model library was copied, moved or deleted; testing used disposable fixtures and the existing isolated model copy.

**Verification:** focused fixtures cover consent denial, unsupported platforms, corrupt archives before execution, competing installers, cancellation/retry, successful version replacement retaining old bytes, failed-upgrade rollback, active-install tampering, ZIP traversal/duplicate rejection, copy consent/conflicts/cancellation/source growth and junction rejection. Final supervisor command above escalated to FULL and passed **149/149**, zero failures, report `.tools/reports/20261126T095250-3ddb/report.json`. This includes the final product code and the additional successful-upgrade/source-growth fixtures; subsequent edits only record these results. Existing Follow, Manuscript, persistence and regression harness checks remain included.

The real network-install smoke downloaded every pinned artifact, performed Moonshine recognition on the 159,414-sample speech fixture with system `PATH` disabled, and round-tripped a 137,863-byte FLAC. Evidence: worktree-local `.tools/vtt-managed-runtime-smoke.json`. An isolated 51,444,641-byte library copy (eight files including its model manifest) verified source/copy SHA-256 equality and passed the existing pinned model-store acquisition again; `.tools/vtt-library-copy-smoke.json`. Neither test altered the author's configured model library.

The expanded controlled browser CASE installed the private runtime through explicit UI consent, then passed microphone-fixture setup, stage resume, settings synchronization/locks, actual inference, injected save-failure recovery, playback, reload, Save As and cold host/browser reopen. Functional RUN `20261126T094805Z-vtt-functional-recording-b4795195`; cold RUN `20261126T094926Z-vtt-cold-reopen-1384df2e`. Both report `sourceIdentityUnchanged: true` for checkpoint HEAD plus the captured implementation delta. Browser evidence includes `runtime-consent.png` (visually inspected), `vtt-acceptance.json` and existing playback/locked-settings screenshots. Hosts stopped and exact prior desktop settings were restored. The native folder picker itself and human microphone accuracy were not re-tested.

Reproduction uses the existing supervisor and caller-owned RUN driver (no controller policy changes):

```text
npm run repo -- test --changed --level affected --base 7339886e6f13f81bd11e4bc55a1a997203800053
node --experimental-strip-types tools/regression-workspace/dictation-acceptance.mjs --workspace <external-verification-workspace> --playwright-root <external-tooling> --model-root <isolated-model-copy> --audio-fixture <speech-wav> --runtime-root <new-isolated-runtime-directory> --install-runtime --allow-dirty --storage-failure
```

Run the suite and browser CASE sequentially because both own temporary desktop-settings setup. `--install-runtime` opts into real downloads to the explicitly supplied isolated runtime root; omit it to use an existing supported installation. Worktree source deltas and machine-specific evidence remain local.


### Explicit external-audio authorization — 26 November 2026

The author additionally requested access to the recordings folder and transcription of another recorded audio file. This authorizes the bounded external-file preview workflow independently of unapproved Grill Me decisions. The active project recording folder opens through package identity/containment checks. Explicit file selection decodes browser-supported audio locally, downmixes/resamples to mono 16 kHz, and sends bounded frames to the selected Live STT model without microphone permission. Up to 4 minutes/50 MB; cancel drains the recognizer and releases its model. Imported bytes and transcript remain session-only previews; Copy is required to retain text. No automatic source-file copy, recording asset, project session or manuscript insertion is created, so Save/Save As and portable schemas are unchanged. Progress and failure states are visible.
