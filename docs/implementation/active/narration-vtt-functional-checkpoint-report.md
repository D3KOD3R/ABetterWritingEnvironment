# Local Dictation functional checkpoint — 22 November 2026

The authorized recording/transcript preview works with actual local Moonshine inference. This is a functional checkpoint, not completion of automatic manuscript dictation or the full D01–D26 roadmap. No inference cloud fallback, automatic manuscript insertion, or audio deletion has been introduced.

## 1. Git starting and ending commits

- Branch/worktree: `feature/narration-vtt` / `narration-vtt`.
- Requested baseline: `597775c80f0d2351bd5091bfc34328a462db80e0`.
- Clean starting documentation commit: `f930575efaa97930a5732a3b70818dd44a0ff07f`.
- Ending implementation commit: `acc4461a66d27df87b9445345af20d9e4f16a3a3` — Add local Dictation recording and transcript checkpoint.
- This report and corrected feature-index line references are a subsequent documentation-only commit. Its identifier is provided in the completion response; the implementation above is unchanged.
- Nothing pushed or merged. The supplied `persistence-portability-harness` worktree remains untouched and clean.

The completed Phase 0 report supplied by the author was reconciled with the revised authorization. The active requirements document now preserves historical tickets while explicitly authorizing the independent recording checkpoint and preserving Phase 3A / 4 / 3B manuscript gates.

## 2. Implemented files and components

| Responsibility | Main files |
|---|---|
| Curated, pinned installation; progress/cancel/retry; verified model leases/removal | `services/local-ai/speech-catalog.json`, `speech-model-store.ts`, `model-library.ts` |
| Local recognizer process; bounded ordered PCM; finality; verified FLAC | `services/audio/src/dictation-engine.ts`, `dictation-journal.ts`, `services/audio/sidecars/moonshine_dictation.py` |
| Sample-addressed event/session contracts | `packages/shared-types/src/speech-events.ts`, `index.ts` |
| Authenticated same-host operations and machine settings | `apps/desktop/server.mjs`, `src/dictation-host.ts`, `src/http-app.ts`, `src/settings.ts` |
| Microphone/worklet/host transport | `apps/editor/public/adapters/dictation-capture.js`, `dictation-pcm-worklet.js`, `dictation-client.js` |
| STT panel, status, preview, inputs, model controls and playback | `apps/editor/public/features/narration/dictation-controller.js`, `dictation-panel.js`, `features/scene-editor.js`, `features/local-ai/local-ai-panel.js`, `styles.css`; thin wiring in `app.js` |
| Portable session normalization and verified package registration | `apps/editor/public/shared/speech-records.js`, `adapters/storage/project-persistence-service.js`, `project-portable-snapshot.js`, `project-migrations.js`, `state/project-record-state.js` |
| Deterministic verification | `test/local-ai-speech-store.test.mjs`, `narration-dictation-capture.test.mjs`, `narration-dictation-controller.test.mjs`, `narration-dictation-journal.test.mjs`, `project-dictation-records.test.mjs` |
| Reusable controlled real-inference acceptance | `tools/regression-workspace/dictation-acceptance.mjs` |
| Feature/decision record | `features.md` Feature 4.6 and `narration-vtt-requirements-and-decision-tickets.md` |

Completed transcripts/recordings are semantic project data. Model paths, runtime installation and input preferences are machine state; active jobs/PCM are session state; RUN assets and fixtures are developer evidence. Portable project schema is now 3 with speech subschema 1. Older writers reject the newer schema. Save As copies the existing owned audio tree. No separate speech localStorage store is used.

## 3. Working catalogue entries

- **Moonshine Tiny Streaming English:** live role, official `moonshine-voice`, CPU, MIT, 51,441,771 bytes across seven artifacts; pinned revision `015f7269048251aff164cb60df02bfea76884c8f`. Installed and exercised.
- **Whisper Tiny English q8:** independent refinement role, whisper.cpp, MIT, 43,550,795 bytes; pinned revision `5359861c739e955e79d9a303bcbc70fb988958b1`. Catalogue/installer support exists; this model was not installed or inferred in this task. Refinement execution is explicitly deferred.

The UI distinguishes installed files from CPU runtime/FLAC readiness. Installation is an explicit action. It validates every artifact's length/hash before publication and rehashes live artifacts before acquiring the runtime lease. GPU execution is not enabled. Managed speech artifacts use the existing model-root `speech` folder and `abe-model.json` conventions.

Pinned SHA-256 values:

| Model / artifact | SHA-256 |
|---|---|
| whisper_tiny_en_q8_0 / `ggml-tiny.en-q8_0.bin` | `5bc2b3860aa151a4c6e7bb095e1fcce7cf12c7b020ca08dcec0c6d018bb7dd94` |
| moonshine_tiny_streaming_en / `frontend.ort` | `271a563251f11e6311949530f8025ed4d345c5d69d4ac1efa74093779927d636` |
| moonshine_tiny_streaming_en / `encoder.ort` | `a8414e1a5dedf9f2093d7680601dd8a9b0433e7020260eafe0e370ead91134ca` |
| moonshine_tiny_streaming_en / `adapter.ort` | `22ecc949e146c49667fda28d102d4e30749a107dc88a396292aa8f277ef1347c` |
| moonshine_tiny_streaming_en / `cross_kv.ort` | `143a36667b8d05fd9d04e8c337b7ee121f37ef299aea6b3d82bdb3d3401950b4` |
| moonshine_tiny_streaming_en / `decoder_kv.ort` | `8852553f312adb6c9aa4d17418015049b30f412209ee569d336548c0044627de` |
| moonshine_tiny_streaming_en / `streaming_config.json` | `74fe5ddebd63b17caf59e8a3b18c17547ff7bce1642050edbb1c3962674f8950` |
| moonshine_tiny_streaming_en / `tokenizer.bin` | `6884b35fd6377d4c4d32336a0bc152f36b64d1e45b6503683cdc238250a8472d` |

## 4. Models and runtimes actually installed/tested

Moonshine was installed by the implemented installer into the ignored `.tools/vtt-models/speech/moonshine_tiny_streaming_en-015f7269048251aff164cb60df02bfea76884c8f` test library. This is not the author's normal production model library; install it explicitly through STT model management when opening the normal app.

The Windows x64 `moonshine-voice==0.1.6` wheel was first isolated for validation and then installed in the current user's Python environment. Wheel SHA-256: `29a54f9249d41735db62b1f97272905cf114554f293c166f0f4f81655a4a2cfc`. Runtime reports native version `30000`, CPU backend. `google-crc32c==1.9.0` was added as its required dependency. Existing NumPy/sounddevice installations were retained. Machine ffmpeg 8.0.1 was already available; FLAC encode plus decoded-PCM equality is checked before capture and on finalization. No runtime executable or model binary was committed.

## 5. Physical microphones detected/tested

| Device | Channels tested | Browser capture | Maximum measured RMS |
|---|---|---|---|
| USB Audio CODEC (08bb:2902) | 1 and 2 | 48 kHz, two channels | 0.0082407 / 0.0162013 |
| Logitech PRO X Wireless Gaming Headset (046d:0aba) | 1 | 48 kHz, mono | 0 (silent) |

Physical tests used real browser media devices without fake-device/file flags. Enumeration, explicit selection, input-level capture and Stop/release passed. Live human speech accuracy through these devices was **not** verified. Physical unplug was not performed; disconnect handling has a deterministic track-ended test. No low-resource laptop or integrated microphone was available in this run.

## 6. Evidence of real local recognition and performance

The pinned upstream Moonshine `test-assets/beckett.wav` fixture (repository commit `d8d8fa29d05ca67441a7719e70099f9f48917a93`) contains 159,414 mono PCM16 samples at 16 kHz (9.963375 seconds). SHA-256: `e5a26b3d29e5b0bc8dbd72c11d16a3808a4ec0ac45b21f12a27d2a2fe5c5ae61`.

Actual model execution produced provisional revisions and six final utterances. Browser acceptance sends that speech fixture through Chrome's microphone capture, the actual AudioWorklet, host transport and actual Moonshine process; recognition was not mocked. Chrome loops its fixture, so an extra repeated utterance in an eleven-second browser capture is new captured input, not a repeated event ID.

Hardware: Intel Core i9-10900KF at 3.70 GHz, 10 cores / 20 threads; RAM 68,584,669,184 bytes; Windows 11 Pro 10.0.26200; Node 24.12.0. CPU-only benchmark: 1.2835 seconds elapsed for 9.963375 seconds of audio, real-time factor 0.12882; 1.84375 process CPU seconds; peak process RSS 187,670,528 bytes. First event arrived at 0.4162 seconds in batch-fed execution including initialization. That is not an interactive p95 latency measurement or low-resource performance claim.

Offline verification denied Python socket connect/create_connection before runtime construction, then performed actual inference from installed artifacts. No downloads occurred. This is narrower than disconnecting the operating system or blocking native-library network traffic; OS-wide offline acceptance remains unverified. Local raw evidence is `.tools/vtt-offline-benchmark.json` and `.tools/vtt-hardware.json`.

## 7. Captured audio format and locations

One capture stream supplies recognition and retained PCM. The worklet records source/normalized sample clocks, selected channel and `capture-worklet-box-v1` resampling provenance. Final output is mono 16 kHz PCM16 encoded as FLAC. The host verifies decoded sample equality, file hash and byte readback before atomic publication under `assets/audio/dictation-<session-id>.flac`.

Latest accepted session: `c7521312-f93b-425e-947c-a47ba3355eb5`, 176,332 normalized samples (11.02075 seconds), 159,678 FLAC bytes; source 44.1 kHz / 486,016 samples. Recording SHA-256: `3466c1e525e70bcf9d774f3366de60d930a1919c644e9d07e8134344a497331e`. Relative file: `assets/audio/dictation-c7521312-f93b-425e-947c-a47ba3355eb5.flac`.

Under the external verification root, the original and copied packages are in `sandboxes/vtt-functional-recording/20261122T112256Z-vtt-functional-recording-07a34b12/project-locations/location-a/Dictation Acceptance` and `Dictation Copy`. Machine-specific absolute evidence paths are supplied in the completion response, not stored as project metadata.

**Checkpoint constraint:** capture is bounded to four minutes and retained in memory until Stop. Independently published rotating audio chunks and crash recovery are not implemented. Audio may be lost on process termination before finalization. With Save Recording enabled, retention is manual-deletion; otherwise the protected recording awaits durable manuscript text. Neither automatic cleanup nor a recording-delete UI is enabled here. No zero-loss or completed D04/D24 guarantee is claimed.

## 8. Saved/reopened recording and playback evidence

Latest browser CASE passed all of: same-host authorization checks; real recognition; injected package save failure without false success; explicit retry; verified FLAC/session publication; playback time advancing; reload retaining transcript/playback; Save As with byte-identical recording; cold host/browser restart reopening the copied project and playing it; narrow STT controls with RHS collapsed and keyboard focus.

Evidence root suffix: `regression-evidence/ABetterNovelAuthoringEnvironment/narration-vtt/`.

- Functional RUN: `vtt-functional-recording/20261122T112256Z-vtt-functional-recording-07a34b12`.
- Cold reopen RUN: `vtt-cold-reopen/20261122T112320Z-vtt-cold-reopen-e5a67b7a`.
- Physical microphone RUN: `vtt-physical-microphones/20261122T110738Z-vtt-physical-microphones-b2ef6c31`.

Functional `manual-test-results/vtt-acceptance.json` contains acceptance assertions and both RUN references. Both latest manifests report completed lifecycle and unchanged source identity. They ran the uncommitted implementation at starting HEAD; those source contents were subsequently committed as `acc4461`. Controller lifecycle completion is distinct from the explicit passing CASE assertions. All test hosts were stopped and original desktop settings restored.

Actual screenshots are `manual-test-results/stt-panel.png`, `stt-reopened.png`, and `stt-narrow-rhs-collapsed.png` in the functional RUN. Visual inspection was performed. It exposed transcript overflow, which was corrected with pane scrolling. Existing top-shell crowding at narrow widths remains outside this feature's styling scope.

## 9. Timestamp granularity/source

The official low-level Moonshine listener supplies line IDs, start times, durations and completion events. The adapter labels these **engine / utterance** and converts seconds to sample positions. Source capture positions, capture epoch, frame sequence and model/runtime identity accompany the session. Accepted finals are immutable; duplicate, stale-epoch and cross-project events are rejected. Final metadata is portable; partial hypotheses remain runtime-only.

No word-level timestamps, forced alignment or estimated word precision are claimed. Speech Kit's custom Moonshine implementation was reviewed as a reference, not transplanted as a dependency. The implemented provider uses official Moonshine APIs and explicit model paths rather than its convenience download path.

## 10. Automated and real-device verification

Repository supervisor escalated to FULL: **143/143 tests passed**, zero failures, test execution 40.781 seconds. Report: `.tools/reports/20261122T112327-6408/report.json`. Command: `npm run repo -- test --changed --level affected --base f930575efaa97930a5732a3b70818dd44a0ff07f`.

New deterministic coverage includes install/hash/size/network failure, cancel/retry, in-use/unmanaged removal, missing runtime, actual worklet sample continuity at 16/44.1/48 kHz and channel selection, permission/disconnect/release, frame order and stale epochs, immutable finals, encoder retry without re-finalizing a closed recognizer, delayed-start navigation barriers, portable schema roundtrip and unsafe path rejection. Tests do not download models or require a GPU; provider doubles do not count as real-inference acceptance.

The reusable browser driver requires explicit `--workspace`, `--playwright-root`, `--model-root`, and `--audio-fixture`, plus `--allow-dirty` only for dirty source and optional `--storage-failure`. It uses the existing RUN controller and real browser UI, with a read-only state probe. It does not download or install dependencies. It temporarily controls this worktree's desktop settings; do not run it alongside an interactive desktop session changing those settings.

Earlier failed attempts remain in local evidence: a Windows EPERM during New Project directory publication; a panel-readiness timing failure in the browser driver; and a playback-element replacement defect fixed before acceptance. These failures were not reported as passes. Package-folder relocation beyond Save As, exhaustive process-crash injection, multi-tab microphone arbitration, long-session recording and native network denial remain unverified.

## 11. Narration Follow and ordinary Manuscript regression

Existing Follow tracking/alignment/provider implementations are unchanged. FULL passed desktop/live speech tracker, follow alignment/display/settings/transcript-window/viewport, recording/runtime/finalization/review, media and related narration tests. Ordinary manuscript host, commands, input, selection, marks/history, projection and anchor tests also passed. No speech-only undo stack or manuscript edit path was added. A fresh human read-through using Follow's real sherpa/Whisper runtimes was not performed; this is automated regression evidence, not real-device Follow acceptance.

## 12. Remaining blockers to automatic manuscript insertion

Phase 3A still requires unified chronological transactions/history for typing, paste, dictation and author marks; revision/source validation; exact undo/redo including accelerated held-key grouping; and destination-generation/revision-bound durable manuscript receipts. Phase 4 still requires independent audio-chunk publication, crash-boundary verification, source correspondence and cleanup authorized only by durable text. Phase 3B then integrates two-anchor gesture arbitration and delayed recognition protection against those foundations.

Current Stop saves/readbacks a semantic preview record. That is not a manuscript durability receipt and never authorizes audio deletion. Explicit Copy is the only transfer mechanism. Do not approve or mark full automatic dictation complete on this checkpoint's evidence.

## 13. Deferred Grill Me decisions / phase status

| Decisions | Current state / remaining phase |
|---|---|
| D01 | Separate live/refinement assignments implemented; refinement execution remains Phase 5. |
| D02–D03 | Manual default, optional five-minute inactivity/background refinement, whole/individual acceptance and proposal editing preserved; Phases 5–6. |
| D04 | Protected retained audio works; delete-after-durable-text and manual deletion workflow remain Phase 4. |
| D05–D06, D12 | Two anchors, click arbitration, follow viewport and unified history remain Phases 3A/3B (and later review integration). |
| D07–D08 | Natural speech only, explicit capture/Stop; intelligent standby and silence-stop remain Phase 3B. No command parser. |
| D09 | Context/world vocabulary remains deferred. |
| D10–D11 | Stop barriers and provisional/final preview implemented; full late-result/manuscript integration remains Phase 3B. |
| D13–D15 | Passage/scene/chapter/project refinement, author-edit protection and linked reviews remain Phases 5–6. |
| D16–D19 | Conservative CPU model, curated checksummed installs and machine role settings implemented; full imports/update policy/project overrides and low-resource validation remain open. |
| D20–D21 | Separate STT/Follow panels and central STT controls implemented; manuscript gestures remain gated. |
| D22 | Input/channel/test controls implemented; shared machine-default plus independent workflow profiles remain incomplete. |
| D23 | Model leases and single live engine ownership implemented; full CPU/GPU scheduling and standby lifecycle remain deferred. |
| D24 | Verified completed recording/metadata and Save As/reopen implemented; independently rotating chunks, crash recovery and per-final durable receipts remain Phase 4 / 3A. |
| D25 | Visible runtime/record/save/retry status implemented; complete notification/lifecycle policy remains open. |
| D26 | This independent checkpoint verified; later major-phase approvals remain required. |

TTS, Translation and Narration Alignment were not implemented. Follow's future adoption of common speech infrastructure remains a separate development process.

## 14. Recommended next milestone and author entry point

Next: separately authorize Phase 3A unified manuscript transactions/history and verified durability receipts, followed by Phase 4 chunk/retention guarantees, then Phase 3B safe automatic final-utterance insertion. Use the Phase 0 gates and requested Extra High reasoning for that separate safety implementation. Do not extend this preview by directly writing speech into the current editor text or creating a speech-only undo stack.

To use this checkpoint: run `npm run desktop` in the `narration-vtt` worktree; open/create a saved folder project; select Narration → STT → Manage speech models; explicitly install Moonshine Tiny and select its live role; choose/test the input; enable Save Recording; Record and Stop. The panel shows finalized transcript/timing, save verification and saved-session playback. Reopen the package to inspect the same sessions. This machine now has the Python runtime and ffmpeg; normal model-library installation is still an explicit author action.
