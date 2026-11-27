# VTT Phase 03 addendum — Developer engineering and reliability verification workbench

**Status:** Author-requested implementation-plan addendum; not an implemented feature or a test result.
**Date:** 27 November 2026
**Branch:** `feature/narration-vtt`
**Parent:** [Phase 03 — Application-owned automatic speech detection](narration-vtt-phase-03.md), initially published at `75a960559cd00203876ba474acd471d78dec3c37`.
**Scope:** Phase 03 verification workstream (F), with instrumentation contracts established during A–E. The workbench is an additional deliverable, not a replacement for the existing automated supervisor or controlled RUN process.

## 1. Author intent and acceptance

Provide a dedicated developer production and testing window for inspecting actual ABE VTT recordings, opening their stored audio folder directly, and playing recordings with a synchronized sound waterfall. Its primary purpose is to prove the engineering concepts implemented in Phase 03, especially independent VAD, pre-roll preservation, five-second recording segmentation, automatic restart, bounded idle storage and five-minute complete microphone shutdown.

The window must be usable against the actual local production VTT pipeline and in isolated engineering tests. It is not the author-facing STT panel, a second recording implementation, or a visual-only demonstration. Production and fixture evidence must be clearly distinguished. Engineering verification must come from measured events and actual audio bytes, not hardcoded success indicators.

The workbench must not silently enable recording, bypass permission/consent or readiness, modify manuscript content, change settings, delete recordings or interfere with existing capture merely by opening it. No new normal-author UI clutter. Preserve all parent Phase 03 constraints, including protected audio and model-independent lifecycle. Future Follow integration remains outside scope.

## 2. Existing implementation to reuse

Inspect the latest VTT branch and scoped agent instructions. At planning time:
- `apps/editor/public/features/narration/dictation-controller.js` handles `dictation-recordings-folder` using the active saved package and project ID and plays project-owned audio through the existing media service.
- `dictation-panel.js` already exposes Open recordings folder and saved-session playback.
- `apps/desktop/src/dictation-host.ts` handles the recordings-folder action and delegates to authorized storage; `http-app.ts` supplies the folder-open implementation. Reuse the validated host route, not an arbitrary file:// link or unrestricted path API.
- `app.js` already opens a separate Developer Logs window. Follow the established developer-window entry, same-origin/session scope, lifecycle and popup behavior; reuse existing Dictation logger, source gates and regression RUN provenance.
- `docs/implementation/active/regression-workspace-logging.md` and `agents/RepositoryWorkspaceAgent.md` define the existing RUN controller, source identity, evidence isolation and supervisor boundaries. Use a caller-owned VTT CASE; do not alter controller semantics to encode VAD-specific tests or establish a competing logger.
- Parent Phase 03 is a plan, not proven implementation. Telemetry and test controls depend on real lifecycle services being delivered. Clearly display unsupported/unavailable measurements until implemented.

## 3. Proposed developer window

Suggested name: **VTT Engineering & Reliability Workbench**. Provide a dedicated developer-menu/Developer Logs entry; a shortcut from advanced speech settings is optional. Reuse the current desktop design conventions; keep the normal manuscript free of engineering telemetry. Use a resizable window or existing detached-window mechanism. Closing it stops its observation/playback subscriptions, not the production microphone owned by another workflow.

Suggested layout:

```text
+--------------------------------------------------------------------------+
| VTT Engineering & Reliability | Production observation / Isolated test   |
| Active project / RUN / source identity       [Open recordings folder]    |
+-------------------+------------------------------------------------------+
| Recording library | Playback: [Play/Pause] [Seek] [Volume] [Reveal file]* |
| Segment ID        | Waveform (PCM amplitude)             cursor           |
| Start / duration  | Waterfall (frequency vs time, dBFS color)             |
| Bytes / status    | VAD probability + threshold(s)                       |
| Retention / hash  | Lifecycle bands: pre-roll | speech | silence | idle  |
|                   | Markers: onset / VAD confirm / close / next segment  |
+-------------------+------------------------------------------------------+
| Live state / timers / buffer / queues     | Test checklist & evidence     |
| Mic ownership / resources / CPU / disk   | Expected vs actual / verdict  |
| Recent lifecycle transitions              | Export approved local report  |
+--------------------------------------------------------------------------+
```

*Reveal individual file is optional if supported safely by the existing host mechanism. Folder access and playback are mandatory. Layout is a recommendation, not a mandated pixel specification.

Separate modes:
- **Production observation**: attach read-only to the real running application and active authorized project. Display actual state, existing saved assets and opt-in live bounded telemetry. Starting/stopping capture continues through the production UI; no parallel microphone stream.
- **Isolated test**: explicitly select/create a disposable test project via existing sandbox/RUN contracts, select deterministic fixtures or consent to physical microphone testing, execute targeted cases through the same production capture/lifecycle interfaces. Never run a destructive case against an author project. Fault injection and accelerated clocks are isolated-test-only, labeled, and cannot mutate production settings or capture state.

## 4. Recordings and folder access

Provide a prominent Open recordings folder control that directly opens the actual active package's authorized stored audio location in the OS file manager. Show the selected project and read-only location (developer-only); if no saved project or folder access is unsupported, display an actionable error and safe copy-location fallback only if the host can validate it. Do not create a folder merely to browse, silently switch projects or expose arbitrary filesystem access. Use the existing project-relative asset references and validated package ownership.

List recordings with stable session/segment IDs, start/end time, sample count, duration, actual bytes, encoding, retention state, save/verification status, model/runtime provenance where available and source epoch. Distinguish pending, saved, incomplete, missing and invalid assets. Refresh after actual publication/acknowledgement. Display measured file-count and byte deltas during a test; label which directory and baseline are measured. Avoid recursively scanning unrelated directories, expensive polling or modifying assets. Include an explicit refresh and optional bounded event-driven updates.

Select a recording to play the exact persisted bytes using the existing authorized media service. Provide play/pause, seek, elapsed/total duration, volume and synchronized playhead. Verify selected asset identity/hash when supported; do not regenerate or substitute audio to make playback look successful. Keep protected assets read-only; no deletion, editing, trimming, overwrite, bulk export or unapproved retention changes. Do not feed playback audio into the capture pipeline; warn that speakers may be picked up by an armed microphone and recommend headphones or explicit stop before playback.

## 5. Waterfall and synchronized engineering plots

Implement a scrolling time-frequency waterfall (spectrogram) of actual decoded playback samples. During playback the waterfall updates or scrolls with the real playhead; pause freezes it, seek recomputes/repositions it, replay is repeatable. Historical recorded waveform and spectrogram may be rendered from decoded samples in a bounded worker/cache for accurate seeking. A live spectrogram is optional opt-in if affordable, not required by the author.

Show shared time-axis tracks:
- PCM waveform / envelope (amplitude) and frequency-time waterfall (frequency in Hz, relative spectral power in dBFS with visible color legend).
- Actual production VAD probability/decision and configured activation/deactivation thresholds when recorded; RMS/peak level and noise-floor estimate separately, if available.
- Lifecycle state bands and event markers: capture armed, pre-roll start, speech onset estimate, VAD confirmation, segment start/close, last speech, configured silence threshold, ASR finalization, audio publication, idle/listening, microphone disarm.
- Segment boundaries and saved audio ranges with source sample indices; use global capture clock for session timeline and segment-local time for playback. Label pre-roll included in the file and omitted idle gaps. Do not draw fabricated waveform samples for audio never retained; indicate gaps as unrecorded, and distinguish estimated onset from labeled fixture ground truth.
- Speech-to-first-visible-text and canonical-final markers can use timestamped event metadata without transcript bodies. Do not infer exact word timestamps from utterance timing.

Recommended implementation baseline: short-time Fourier transform with Hann window, e.g. 512-sample FFT / 256-sample hop at 16 kHz; show frequency range up to actual Nyquist (8 kHz for 16 kHz PCM). Values are proposals to validate for resolution, scaling and cost; dBFS is relative digital level, not calibrated acoustic SPL. Document FFT/window/hop/normalization, channel/resampling provenance, dynamic range and units. Use correct frequency-bin and time mapping. Provide zoom/pan or range selection to inspect first-word onset; crosshair/readout and linked playhead across plots. Distinguish missing captured VAD traces from newly recomputed analysis; never label retrospective analysis as original production decisions. Recomputed VAD must be explicitly requested, version/config tagged and must not alter production state.

Spectral analysis must never block audio capture, ASR or editor. Use bounded frame/cache sizes, throttled rendering, disposal of audio/object URLs and subscriptions, and no default permanent spectrum cache. No unbounded in-memory trace arrays. Closing the window must release its own resources; opening it must not add a power assertion. Full-session telemetry may use compact bounded event summaries and optional local RUN evidence, not raw idle PCM recording.

## 6. Real telemetry and provenance

Expose read-only snapshots/events from ABE-owned Phase 03 lifecycle, not a duplicated simulation. Proposed typed fields (adapt to repository contracts):
- Clock/capture: capture epoch, segment ID, monotonic timestamps, source/sample rates, global and local sample offsets, armed state, actual physical track state, resource release acknowledgements and reason.
- VAD: classifier identifier/version, configured threshold/hysteresis, speech score/decision, last detected speech, RMS/peak/noise floor when measured. Record whether detection is real, injected or retrospective.
- Timers: configured segment inactivity, actual elapsed since last valid speech, five-minute shutdown threshold/countdown, reset events, actual close and release latency; show a pending finalization independently from physical mic state.
- Buffer: configured capacity in samples/bytes, occupancy/high-water, oldest/newest sample index, copied pre-roll range, dropped/overrun counts, next-segment queue occupancy/high-water and bounded capacity.
- Pipeline: accepted/processed frame counts, discontinuities, current model/adapter, first visible/final insertion timing, pending finalization and save/ack states, error reason.
- Resources: observed audio tracks/context/worklet/VAD activity, any speech-owned wake lock/power assertion actually observable, CPU/RAM and disk byte/file-count deltas with scope, units and measurement source. Label unavailable OS measurements rather than infer release or normal sleep from a UI icon.
- Trace source: actual live production, deterministic fixture/clock, physical microphone test, retrospective file replay; project/RUN ID, source commit, relevant settings, model/runtime/VAD version.

Reuse existing Dictation logging and host/run identity. Subscribe to bounded events/state in developer mode only; no high-frequency raw PCM or transcript bodies in ordinary logs. Use sampled/decimated visualization data, backpressure/drop counters for display-only telemetry and a visible gap marker when evidence is incomplete. Critical lifecycle transitions and exact boundary evidence must not be silently lost by display throttling. Opening/closing the observer cannot affect decisions, audio ordering or resource ownership. No raw idle PCM saved as evidence; local test fixture audio or explicitly retained real speech assets may be inspected using their existing permission/retention boundaries. No automatic uploads or publishing of private audio/manuscript/absolute paths/source-changes.json.

## 7. Verification workflow and evidence

The workbench should display test ID, preconditions, expected result, observed result, measurement units, timestamp and evidence links; statuses Not run, Running, Pass, Fail, Blocked, Inconclusive. Do not mark pass merely because a button was clicked or a chart was drawn. Test assertions must compare actual observed events/sample ranges/file counts against expectations; manual listening is a separate human observation. Label controlled fake-clock runs and real elapsed-time runs distinctly.

Provide a bounded local evidence summary (suggest JSON plus human-readable report, optional CSV of measured VAD/sample traces and screenshots) through existing RUN evidence paths. Record source identity, RUN/CASE, environment and configuration, fixture identity/hash, saved audio identity/hash, marker/event ranges, assertion results, timing, resource/storage measurements and limitations. Do not copy actual author recordings or raw idle audio into export by default. Existing supervisor remains authoritative for automated test verdicts; RUN lifecycle completed does not mean CASE passed. No automatic commit/upload of evidence. Explicit test-runner integration through the existing caller-owned VTT driver, not a replacement supervisor or arbitrary command execution UI.

| ID | Proof scenario | Evidence / pass condition |
| --- | --- | --- |
| WB-T01 | Folder and playback | Open authorized actual project recordings folder; select saved FLAC; measured duration/sample count agree with verified asset; playback, pause, seek and waterfall/playhead stay aligned. Missing/invalid asset visible. |
| WB-T02 | First word / pre-roll | Fixture with known speech onset: show original onset vs VAD confirmation, pre-roll range and decoded saved first-word samples. Compare source/reference ranges; no clipped onset or duplicated samples. Listen separately. |
| WB-T03 | Five-second endpoint | Demonstrate 4.9 s pause continues same segment; 5 s closes once; change configurable threshold and show measured boundary. Use fake clock and at least one real-time run; document scheduling tolerance. |
| WB-T04 | 20-second break | Speak, pause 20 s, speak: show exactly two nonempty segments, idle gap unrecorded, pre-roll on second, no additional mic start and correct transcript order. Compare actual disk counts/bytes and sample ranges. |
| WB-T05 | Five-minute physical release | Show actual armed/track/context state at 299 and 300 s and release reason/latency; verify resources and available power assertions released even with pending save. Real 300 s run separate from accelerated clock; no auto-rearm. OS sleep outcome only if measured independently. |
| WB-T06 | Idle/noise resource stability | No speech after arming, quiet/background/fan/keyboard/cough fixtures; verify zero empty or idle recording files, bounded ring/queues, actual idle CPU/RAM and disk deltas; record detection errors, not guaranteed noise immunity. |
| WB-T07 | Speech during finalization | Slow/fault-injected finalization in isolated test; next speech safely buffered, exact sample continuity, no duplicate manuscript text/assets, bounded queue, recovery shown. |
| WB-T08 | Long speech and cap | Show actual rollover/bounded stop at current 240 s limit; prove continuity if rollover delivered, otherwise mark incomplete/blocked. |
| WB-T09 | Failures and ownership | Unplug/revoke/stop/close/rearm/scene change/competing workflow, save/encoder errors; verify resource release, pending protection, no wrong-scene insertion. Observer cannot open another microphone. |
| WB-T10 | Visual correctness | Known tone and impulse fixture validate frequency bin, dBFS normalization, sample/time alignment and seek; compare original VAD trace with separately labeled retrospective analysis. No data means no fabricated graph. |
| WB-T11 | Observer overhead | Compare workbench closed/open/playing with same deterministic capture; report CPU/RAM, latency and drop counters. No unbounded growth or changed capture output; agree realistic performance tolerances from baseline before declaring pass. |
| WB-T12 | Isolation and privacy | Production observation is non-mutating; test actions confined to disposable sandbox; no raw idle PCM, sensitive logs, arbitrary filesystem access, or automatic upload. Close window releases only observer resources. |

These tests supplement rather than replace ASD-T01–T15. Physical microphone and OS power behavior may remain unverified if equipment/platform access is unavailable; state that explicitly. No fabricated example metrics in production views.

## 8. Implementation sequencing within Phase 03

F1 (start alongside A/B): inventory current developer entry, folder route, media playback, logger, RUN evidence; define telemetry and clock contracts and privacy/resource budgets before implementing core VAD. Add deterministic fixture contracts and capture lifecycle observation interfaces as needed.
F2 (after B/C): implement read-only lifecycle subscriptions, recording list, validated folder action and actual playback. Prove observer does not own microphone or mutate production state.
F3 (after C): implement synchronized waveform/waterfall, VAD and marker tracks, global/segment time mapping, bounded analysis and seek behavior; verify with known signals.
F4 (after D/E): integrate isolated CASE driver, assertions, test results and local evidence linkage; run both parent and addendum cases through the actual architecture, including real recognition and separate physical mic verification where possible.
F5: report implementation and evidence, performance comparison, gaps and exact commit/source identity. Run applicable supervisor and controlled browser acceptance per repository policy; provide screenshots of workbench with actual measurements and selected recorded audio, not mock data. No claim of proof for any unrun case.

## 9. Definition of done

The developer window opens the real recordings folder, plays real stored audio with synchronized waterfall and waveform, and exposes enough actual VAD/lifecycle/buffer/storage/power telemetry to inspect and reproduce the engineering claims of Phase 03. Tests distinguish observed versus inferred values, production versus fixture runs, and automated versus physical-device evidence. The parent Phase 03 gates remain binding; the workbench provides evidence, not a substitute for safe architecture or tests.

Design discretion: the exact developer entry, visual layout, spectral parameters, performance budgets and optional export/reveal features are recommended implementation choices, not additional author-approved scope. The user explicitly requested the developer window, stored-folder link, playback waterfall and VAD reliability proof. No production code is changed by publishing this addendum.
