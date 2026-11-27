# ABE — VTT Phase 03: Application-owned automatic speech detection and recording lifecycle

**Status:** Author-requested standalone implementation plan, published for review and subsequent Codex execution. No production implementation, test pass, or additional implementation authorization is asserted by this document.
**Date:** 27 November 2026
**Target branch:** `feature/narration-vtt`
**Predecessor:** [Phase 02 native manuscript dictation](narration-vtt-phase-02.md) and [implementation report](narration-vtt-phase-02-report.md).
**Decision source:** Grill Me Round 3 Decision 5 and subsequent author amendments on VAD, buffering, storage and microphone inactivity.

## Phase 03 verification addendum

[Developer engineering and reliability verification workbench](narration-vtt-phase-03-verification-workbench.md) is an additional Phase 03 deliverable requested by the author. Establish its telemetry contracts during milestones A–E and deliver its playback waterfall, recordings-folder access and evidence workflow during milestone F. Its WB-T01–T12 proof cases supplement ASD-T01–T15; neither replaces the repository supervisor or controlled RUN evidence. All existing Phase 03 scope, retention and authorization gates remain intact.

## 1. Objective and scope

Make local dictation naturally voice-activated after the listening service is armed. ABE itself must own the physical microphone lifecycle, continuous bounded circular audio buffer, independent voice activity detection (VAD), recording segments, timers, resource release and retention decisions. Moonshine, Whisper and future transcription models are interchangeable consumers of the resulting audio; their internal VAD, buffering or endpointing must not govern the application's recording lifecycle.

Author scenario: the writer dictates in bed, pauses for 20 seconds or walks away briefly, then continues speaking. After five seconds of silence the first recording closes, but the microphone remains listening with a short in-memory rolling buffer. When speech resumes a new recording begins automatically, including the buffered onset of the first word. The idle interval must not accumulate recording data on disk. After five minutes of continuous speech inactivity ABE turns the microphone completely off so that it does not unnecessarily consume resources or interfere with normal system sleep.

This is a separate infrastructure phase, not another UI redesign. Preserve Phase 02 native manuscript dictation, guided setup, shared speech settings and ordinary Manuscript Metadata Console. Future Narration Follow should be able to consume the reusable infrastructure without requiring its integration now.

## 2. Requirements hierarchy and decision traceability

Mandatory author requirements:
- ASD-01: Application-owned, local, model-independent VAD and recording lifecycle, not delegated to ASR provider internals.
- ASD-02: Bounded circular PCM buffer in RAM; protect speech onset, especially the first spoken word; overwrite unused idle audio rather than persist it.
- ASD-03: Automatic start on detected speech and automatic new recording after a silence-delimited segment; no button presses between segments while armed.
- ASD-04: Default segment inactivity threshold **5 seconds**, user-adjustable and persisted in application User Settings; RHS Console B uses the same authoritative setting.
- ASD-05: Secondary **5-minute (300-second) inactivity timeout**, measured since last valid speech, completely releases the microphone and listening resources, permitting normal OS sleep. This is a timer, NOT a five-minute audio buffer.
- ASD-06: Avoid unnecessary disk writes, idle recordings, empty files and unbounded memory/storage growth. Retain existing protected-audio/persistence safeguards.
- ASD-07: Progressive manuscript insertion must not wait for the five-second recording endpoint. Preserve existing Phase 02 insertion/persistence contracts and the approved single ordinary cursor.
- ASD-08: Separate reusable capture/segmentation from model adapters; leave Narration Follow implementation untouched in this phase.

Recommended engineering defaults (validate, not author-fixed): 500 ms pre-roll, model-independent speech probability plus RMS/peak and adaptive noise-floor metrics, hysteresis/debounce, configurable silence range 1–60 seconds in one-second increments, blue Listening indicator, bounded next-segment queue, minimal trailing padding. Evaluate rather than assume a particular VAD library or numeric speech score (55% was illustrative only).

Open product choices: automatic entry-time microphone activation versus explicit arming has not been selected. Preserve Phase 02 explicit Record activation by default; do not silently open a microphone on entry, setup completion, restart or system wake. Once armed, auto-start/restart segments as required. After full shutdown, speech alone cannot restart a physically released microphone; require explicit rearm. The five-minute default is approved; making it user-adjustable or disableable was suggested but not explicitly approved. Keep it enabled at 300 s for this phase unless a later author decision changes that; design the configuration so an approved setting could be added later. No automatic system sleep command.

Round 3 Decisions 1–4 are approved separate editor-behaviour requirements: dynamic caret repositioning with safe segment transition, dotted underline for provisional words, manual editing priority during dictation, protected provisional selected-text replacement. Phase 02 report explicitly says active repositioning and manual editing were deferred. Do not falsely claim they are implemented; expose a typed destination/epoch boundary for future integration and preserve current Phase 02 stop-before-edit safety until these editor changes have their own verified implementation. If a dependency is essential, report it rather than silently expanding scope.

## 3. Current baseline and required investigation

Read AGENTS.md, agents/AudioVoiceAgent.md, agents/FeatureWorkAgent.md, agents/RepositoryWorkspaceAgent.md and applicable scoped editor, desktop, persistence and schema instructions when modifying those responsibilities. Verify branch head and clean worktree before implementation. Earlier baseline c2e869c is superseded by Phase 02 and external-file preview changes; Phase 02 report cites a581c4f and 6fe5e6f. Inspect the current branch rather than reverting or assuming an older file layout.

Observed from branch source and report:
- `apps/editor/public/adapters/dictation-capture.js` and `dictation-pcm-worklet.js` capture/resample mono 16 kHz PCM16; the existing worklet emits 4000-sample (250 ms) frames and carries source/output sample offsets. ABE can reuse this path but VAD needs smaller analysis windows without sacrificing existing frame integrity.
- `apps/editor/public/features/narration/dictation-controller.js` currently binds microphone capture to one backend session, has an approximately 239.5 s stop barrier and bounded frame queue. Decouple physical capture from per-segment transport and finalization.
- `services/audio/src/dictation-engine.ts` enforces a 240 s sample cap, a single current engine session, strict sequence/sample/source-offset continuity and bounded processing, retains PCM until stop and verifies FLAC by decoded sample equality. Do not just remove the cap or send nonzero segment-local initial offsets.
- `apps/desktop/src/dictation-host.ts`, `http-app.ts`, settings, model lease and acknowledgement contracts need inspection for one-session ownership, retries, release and durable publication. Do not bypass them.
- `dictation-manuscript.js` provides native final-only canonical text insertion, provisional projections and deduplication. Retain those contracts and bind each segment to a valid original destination.
- `project-persistence-service.js` verifies recording/session metadata, not a durable manuscript revision receipt. Phase 02 deliberately disables automatic audio deletion. Preserve that gate.
- External-file transcription is a transient preview, not live dictation; it must not arm a physical microphone or create live recording assets. Input Test must remain explicit, transient and non-recording.

## 4. Logical architecture

Prefer existing repository boundaries; names below are responsibilities, not mandatory new files. Keep reusable speech domain/lifecycle contracts in services/audio and browser microphone/worklet mechanics in the existing editor capture adapters; desktop host remains authority for runtime, settings, leases, asset publication and permission/ownership barriers.

```text
Microphone / existing capture worklet
        |
        v  continuous clocked PCM
ABE capture coordinator (one physical input, one owner)
        |------------------> bounded RAM pre-roll ring
        |------------------> independent local VAD classifier + level/noise telemetry
        v
ABE recording lifecycle state machine <--- persisted settings + monotonic clock
        |
        +--> segment router (capture epoch, segment ID, sample boundaries)
                 |--> bounded ASR adapter queue --> selected local STT model
                 |                                --> provisional/final events --> editor
                 |--> protected segment audio --> existing verified FLAC + project persistence
                 +--> lifecycle status / diagnostics / resource release
```

The independent VAD classifier may be an approved, lightweight third-party local library; it reports speech likelihood, not application start/stop commands. Do not rely on Moonshine/Whisper endpointing to implement the ABE timers. Prefer dependency reuse only if it provides a separable classifier behind an ABE interface; justify any new dependency with license, provenance, offline support, resource measurements and explicit consent for downloads. No cloud fallback or hidden network processing.

Suggested interfaces: capture source emits clocked PCM and failure events; classifier emits score/decision and sample range; ring supports append/snapshot/clear with fixed capacity; lifecycle consumes deterministic clock/classification events and produces typed start/finalize/disarm actions; router maintains segment and capture-epoch identity; ASR adapters accept segment-local sequential frames and return provenance-tagged events. Keep provider event endpointing separate from recording segmentation and from refinement.

## 5. State machine and exact timer semantics

Use an injectable monotonic clock and sample clock. Avoid wall-clock jumps; reconcile suspended/hidden-window timers on wake, do not leave capture active just because a renderer timer was throttled. Maintain one authoritative last-valid-speech time and arm time (if no speech has yet occurred).

| State | Input / guard | Transition and side effects |
| --- | --- | --- |
| OFF / READY | Explicit arm, valid setup, scene/caret, saved project, no conflicting workflow | Open one physical microphone, create new capture epoch and bounded ring; start inactivity measurement; LISTENING. |
| LISTENING | Valid speech detected before secondary timeout | Snapshot pre-roll at exact boundary; assign unique segment ID, destination and local offsets; start segment; RECORDING. |
| RECORDING | Speech present | Route contiguous frames; update last-valid-speech; emit progressive text. |
| RECORDING | Speech absent | Keep segment open until configured continuous silence duration; resume speech resets silence calculation. |
| RECORDING | Silence >= configured duration (default 5 s) | Close segment input boundary once; drain/finalize ASR and protected audio; keep physical capture/ring/VAD active; LISTENING with explicit finalization status. |
| LISTENING / RECORDING | No valid speech for 300 s since last speech (or arm if none) | Disarm; stop accepting new segments; release microphone/worklet/VAD/ring and speech-owned wake prevention; finish already accepted durable finalization safely. |
| Any armed state | Explicit stop, invalid destination, permission revoke, device loss, conflicting workflow, close or fatal failure | Stop new input, release microphone promptly, finalize/preserve accepted material or report recoverable incomplete state; no automatic rearm. |

Finalization is an orthogonal bounded job state: do not stop physical capture merely because a segment closes. Do not let a segment finalization job reset the secondary inactivity clock. Speech detected during prior finalization starts a logical next segment with preserved audio; if existing single-session backend cannot accept it yet, buffer it in a bounded ordered queue and start its transport when the predecessor is safely released. Never silently drop speech, redirect it to another scene, open unlimited model processes or allow idle listening to hang on unresolved save. Define a conservative visible overflow/failure policy with preservation/recovery of accepted audio. Explicit disarm wins races with VAD activation.

## 6. Audio boundaries, memory and storage

At 16 kHz mono PCM16, 500 ms is 8000 samples / 16,000 bytes payload. The ring is a fixed-capacity buffer, not a recording file or growing list. Actual capacity must cover classifier window, confirmation delay and scheduling jitter; validate onset against quiet and fast speech. If 500 ms is insufficient, justify a larger bounded duration. Include exactly the appropriate preceding samples once, not the entire historical idle interval. Clear ring on disarm, failure, device change and ownership change.

VAD should analyse short frames (e.g. 10–30 ms or classifier-native window) without waiting for an entire transport batch. Use speech-score hysteresis and suitable confirmation windows to avoid chatter; adapt to the noise floor conservatively, and ensure low-volume speech is not rejected solely by an amplitude threshold. Keyboard noise, fan noise and silence must not extend inactivity on their own. VAD cannot guarantee speaker identity or reject all TV/background speech; document this limitation. Do not add speaker identification here.

Maintain a continuous source sample clock within each capture epoch; rebase segment-local sample offsets and sequence to the backend contract. Account for resampling, pre-roll, gaps and any deliberately discarded silence; retain provenance sufficient for later narration alignment. No duplicated/missing sample ranges at segment boundaries or overlap between consecutive recordings. No invented word timestamps.

The five-second endpoint is independent of ASR partial/final delivery. Model can finalize utterances earlier. Consider trimming unnecessary trailing silence only if exact offsets and verified audio semantics survive and author speech is preserved. No destructive trimming of future audiobook narration. Keep idle audio in RAM only; no periodic empty FLAC or temporary-file churn. Actual speech-bearing segments remain protected per existing policy; this phase does not authorize automatic deletion. Disk use must be proportional to protected speech segments and justified padding, not wall-clock listening duration. Report real storage and memory measurements. Do not claim zero disk writes for actual recording/finalization.

Existing 240 s backend limit: keep strict cap and design safe controlled segment rollover before the cap, preserving contiguous speech, order and manuscript destination. Implement rollover only after proving backend session release, queue/acknowledgement and persistence safety. If safe rollover cannot be completed within this phase, retain the explicit visible bounded stop and report it as a blocker to full automatic long-session acceptance; do not remove the limit or silently drop audio. Long-session testing must include uninterrupted speech through the boundary.

## 7. Settings and UX

Add the adjustable five-second silence threshold to existing installation-local speech User Settings (not project schema or browser-only local storage). Mirror it in RHS Console B through the same authoritative state. Validate ranges and invalid/migrated values at host boundary, default existing installations to 5 s, preserve current preferences. Suggested range 1–60 s, integer seconds, restore default. Do not permit ambiguous mid-segment changes: use existing capture-sensitive settings lock while armed, or a clearly documented next-activation application if approved. Preserve setup/readiness, consent and existing model configuration. Five-minute shutdown remains enabled; do not add opt-out without approval.

Use existing recording control under chapter word count in both supported viewports. Green Ready means hardware off and eligible to arm; blue Listening (proposed) means hardware active but no speech segment; red Recording means active segment (including its short silence tail); finalization/recovery distinguishable without implying microphone is on. Labels/icons must work without color alone. Show actionable status after automatic shutdown and allow explicit rearm. Keep raw VAD scores and utterance events out of normal manuscript. Do not introduce new settings in the central editor. Do not auto-start on wizard close or permission grant.

At secondary timeout release MediaStream tracks, disconnect and terminate worklet/audio graph, close or release AudioContext, stop VAD/idle inference and timers, clear buffer, release speech-owned power assertions/wake locks if any, and relinquish microphone ownership. Durable pending work may finish without keeping the microphone active; readiness must not show green if recovery still blocks recording. Check desktop lifecycle (background/minimized, suspend/resume, window close) and avoid changing OS power policy. No system sleep command, no global wake-lock override.

## 8. Persistence, concurrency and recovery invariants

- Preserve local-only audio and model roles, project-owned relative asset paths, verified FLAC/session publication, existing acknowledgement/lease and save-retry boundaries.
- Never publish empty/silence-only sessions. Retry by stable session/segment identity; no duplicate manuscript insertion, no duplicate asset publication. Bind all events to capture epoch, segment, project, scene and valid editor destination; ignore stale events after disarm or transition.
- Preserve provisional editor projections and final-only canonical insertion, undo/history and autosave. Do not bypass ordinary editor transaction paths. Segment end does not imply downstream refinement.
- Keep protected audio when text durability is unverified or save/finalization fails. Do not enable automatic audio cleanup or claim crash-resumable capture solely from buffering; the existing Phase 02 durability gate remains. A new disk journal or deletion mechanism requires separately approved durable storage design if necessary.
- Bound ring, frame queues, pending segment count, duration and memory. Backpressure or encoder/save failure must be observable; stop safely if unable to preserve accepted material. No endless retry preventing shutdown, no stranded microphone on error.
- Mutual exclusion across live STT, microphone Test Input, external-file preview, and Narration Follow. Preserve original destination on project/scene/navigation changes; existing safe stop behavior remains unless separately verified and authorized.
- Add privacy-safe transition logs: arm/disarm reason, speech/segment transitions, threshold config, buffer/queue high-water marks, sample counts and durations, shutdown acknowledgement/resource status. No raw audio, transcript bodies, device IDs or private paths in routine diagnostics.

## 9. Implementation plan (independently verifiable milestones)

A. Baseline and contracts: inspect current VTT head, existing settings/host/audio contracts, capture ownership, power assertions, test supervisor and Phase 02 evidence. Record dependency map, current limits and proposed state/clock/offset contracts. Establish baseline tests. Choose a VAD classifier with justification and no hidden installation.

B. ABE capture foundation: extract/reuse one persistent microphone source, bounded ring and independent classifier adapter. Add pure clock-driven lifecycle state machine with fake clock and deterministic PCM. Verify 5 s and 300 s thresholds, reset semantics, explicit arm/disarm and first-word buffer. No manuscript or backend side effects in state-machine unit tests.

C. Segmentation and host integration: introduce segment router, exact local/global sample mapping and bounded ordered transport/finalization. Reuse verified FLAC, session identity, model leases and acknowledgements. Handle speech during finalization, retry and overflow. Verify no idle assets and no empty sessions. Investigate safe cap rollover with continuous audio; preserve cap if blocked.

D. Settings and UI: persist default/configurable silence timeout in existing desktop settings, mirror RHS/User Settings, map status to existing recording control in both viewports, preserve explicit initial arm. Implement secondary microphone release and desktop lifecycle handling. Keep external preview and input test isolated.

E. Integration: connect segment output to existing Phase 02 manuscript transaction path; preserve progressive partial/final output, ordinary cursor and safe current editing constraints. Verify no duplicate words or wrong-scene insertion on auto restart. Provide extension boundary for approved Round 3 editor decisions; do not implement their full editor changes here.

F. Verification and closeout: run focused tests plus repository supervisor FULL where appropriate and controlled browser RUNs per repository policy. Use disposable projects/isolated machine config and deterministic audio, then physical microphone acceptance when available and explicitly consented. Record exact branch/commit, commands, reports, measured latency/resource/storage, screenshots, limitations and any unresolved cap/queue/host constraints. Update relevant feature index and decision traceability only when implementation evidence exists. Keep commits cohesive, normal fast-forward only on VTT branch; no main merge or unrelated changes.

## 10. Acceptance tests and exit gates

Use fake clocks for precise timer boundaries and deterministic fixtures with annotated onset/sample indices. No test result is asserted by this plan.

| ID | Test / acceptance |
| --- | --- |
| ASD-T01 | With default 5 s, 4.9 s silence plus resumed speech keeps segment; 5 s closes once, without closing mic; configurable alternative behaves at exact boundary. |
| ASD-T02 | Speak, pause 20 s, speak again: exactly two nonempty segment records, second includes first spoken word, no idle file accumulation, no extra clicks, correct manuscript order. |
| ASD-T03 | At 299 s since speech/arm microphone remains listening; at 300 s all physical input tracks and speech-owned listening resources are released, even if a durable save is pending. No auto-rearm until explicit action. |
| ASD-T04 | User never speaks after arm: no recording files; shutdown at 300 s. Background noise does not extend timer. Speech before shutdown resets both timers. |
| ASD-T05 | Test quiet, rapid and clipped onset fixtures, keyboard/fan/door/cough/background noise; document false positive/negative rates and onset latency, tune VAD and pre-roll from evidence. |
| ASD-T06 | Verify sample continuity, segment-local zero origin, global provenance, no duplicated/missing samples and no clipped initial word across repeated starts and finalization overlap. |
| ASD-T07 | Force slow ASR, slow finalization, encoder failure and save retry. Preserve accepted material, bound queues, report recoverable errors and avoid duplicate text/assets. |
| ASD-T08 | Long idle simulation and measured armed idle intervals: ring capacity constant, no growing pending queue, no idle recording files, no heavy continuous ASR; repeat after rearming. Measure CPU/RAM and disk footprint. |
| ASD-T09 | Continuous speech approaching/exceeding 240 s: verified rollover without text/audio loss or explicit bounded stop with limitation reported. Full long-session acceptance cannot be claimed if rollover blocked. |
| ASD-T10 | Stop/rearm repeatedly, permission revoke, unplug, device change, sleep/resume, close, scene/project/workflow switch and concurrent start: no leaked microphone, stale events or wrong destination. Normal OS power management resumes; check actual locks if applicable. |
| ASD-T11 | Same lifecycle with deterministic alternative ASR adapter, regardless of provider internal endpointing. Real pinned local model recognition exercised separately. |
| ASD-T12 | User Settings and RHS display same persisted timeout after restart; valid defaults/migration; reject invalid settings; existing model selections retained. |
| ASD-T13 | Both permitted viewports preserve existing manuscript interface and direct insertion; setup/Test Input/import/Follow never unintentionally arm VAD. Explicit arming, status and stop remain understandable. |
| ASD-T14 | Final-only canonical text, provisional display, undo/autosave, reopen and verified protected audio unchanged. No automatic deletion introduced; previous session metadata does not count as manuscript receipt. |
| ASD-T15 | Measure speech onset to first visible text and canonical final, segment endpoint delay, speech resumption during previous finalization, idle CPU and release latency. Report measured values rather than invented pass thresholds. |

Do not declare completion just because the VAD model runs or the UI renders. Mandatory gates: first-word preservation evidence; automatic restart; 5-second adjustable segmentation; actual microphone release after 300 seconds; bounded idle memory and no idle recordings; local provider-independent lifecycle; preservation of manuscript and protected audio. Report partial completion honestly if backend serialization, platform sleep behavior, real microphone verification or cap rollover remains unresolved.

## 11. Explicit exclusions

No full Narration Follow migration, speaker identification, voice commands, new speech engine, refinement execution, automatic audio deletion, new project schema unless justified and separately reviewed, full Round 3 editor behaviour implementation, mandatory GPU dependency, automatic microphone activation on viewport entry, system sleep command or unrelated branch changes. Do not treat pending recommendations as author approvals.

## 12. Deliverable

A cohesive standalone Phase 03 implementation with reusable ABE-owned speech detection and capture lifecycle, supported by regression evidence and a separate implementation report. This plan publication alone changes no application code. The author can commission execution separately; preserve Phase 02 history and all earlier decision records.
