# ABE — Voice-to-Text and Speech Architecture

**Status:** Grill Me concluded; requirements baseline for repository audit and implementation planning. Not authorisation to implement.  
**Repository:** `D3KOD3R/ABetterWritingEnvironment`  
**Revision:** 1.0 — 21 November 2026

## Execution contract — Phase 0 (planning only)

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

