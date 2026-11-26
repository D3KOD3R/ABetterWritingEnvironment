# VTT Phase 02 implementation and verification — 27 November 2026

Native manuscript dictation is implemented on `feature/narration-vtt` as a bounded local recording workflow. Configure speech in the RHS, finish the wizard, click the ordinary manuscript caret and explicitly Record. Finalized speech enters the existing editor; provisional words appear there without becoming canonical text. The same control works in ordinary Manuscript while preserving its Metadata Console.

## Changes and commits

- `19033f01a1c81bd9f19939273d71bec1d2837cbb`: project recordings-folder access and external-file transcription preview, completing the preceding request.
- `a581c4f069db12d7c4a34eca98afb6b7d057fba3`: native dictation, RHS consolidation, guided setup and shared manuscript recording.
- `6fe5e6fd57b50e74099a25bdcb325ab228f6114b`: selected STT tab and ready-status contrast in dark mode.

`features/narration/dictation-manuscript.js` owns an ephemeral editor transaction. It remembers the real textarea and collapsed caret before the microphone button takes focus, binds the original project/package/scene, and advances that insertion offset after each final utterance. Repeated final IDs cannot insert twice. Conflicting text or a changed destination stops insertion with transcript recovery; there is no fallback to the scene end. Provisional hypotheses use a separate DOM projection and never enter history, autosave or exports. Final insertion uses the editor's native `insertText` command and ordinary input controller, including formatting, anchors, revisions and autosave.

`dictation-controller.js` shares capture, readiness and configuration between both viewports and User Settings. It retains the editor during capture, serializes save retries, keeps finalization/recovery controls, and prevents Follow's passage-selection rerenders from taking over STT. Pointer and keyboard viewport navigation drain capture first. Manual manuscript editing and undo are locked during capture; stop before editing or changing the insertion destination.

`dictation-panel.js`, `scene-editor.js`, `styles.css` and `editor-chrome.js` reuse the actual manuscript and theme controls. Speech configuration is in the RHS; runtime/storage are collapsible. The three-stage overlay locks manuscript editing and guides attention to microphone, Live STT and optional refinement. A meaningful microphone signal, operational live model and explicit refinement deferral enable X/Finish without recording. Incomplete stage progress persists in machine settings. Record/Stop sits beneath the chapter word count. Raw timed engine output is absent; plain transcript recovery, playback and external-file previews remain available.

No project schema or persistence adapter changes were needed in Phase 02. Final text follows ordinary project persistence; completed speech records and FLAC remain project-owned. Setup is machine-owned; cursor bindings and provisional projections are session-only. Save As copies owned audio; cold reopen reads final manuscript text and recordings. Model/runtime installations remain consented and verified. The earlier safe model-library copy remains a staged copy, without automatic shared-library cutover.

Utterance IDs, revisions, session identity and sample timing remain in the audio service. They can support future spoken-passage alignment, narrator tracking, audio/text association, synchronized playback and deviation detection. This model supplies utterance timing, not exact word timestamps. No new Follow alignment or refinement execution is implemented.

## Verification

- Repository supervisor: **FULL 151/151 passed**, `.tools/reports/20261126T214146-db2b/report.json`, base `19033f0`, covering the entire Phase 02 change including the contrast fix. `git diff --check` passed.
- Clean-checkout browser acceptance at **`a581c4f`**: `20261126T213912Z-vtt-native-manuscript-b27908bb` and `20261126T214015Z-vtt-cold-reopen-e4e5860f`. Both controller manifests completed with `sourceIdentityUnchanged: true`; acceptance passed with no browser errors. The subsequent production change is limited to the two CSS contrast rules above.
- Actual pinned Moonshine CPU inference processed the Beckett WAV through Chrome's fake microphone device, then through the external-file decoder. This is real recognition with deterministic audio, **not physical microphone verification**.
- Browser checks covered incomplete setup reload, editor setup lock, explicit Finish without capture, shared configuration and capture locks, ordinary typing focus, beginning/middle/end insertion, preserved surrounding text and a bold author mark, native undo/redo, navigation finalization, injected package-save failure and retry, FLAC playback, reload, Save As, cold host/browser reopen, Metadata Console, narrow/collapsed console, light/dark rendering and external-file transcription without another saved recording.
- Deterministic tests cover provisional isolation, final deduplication, conflicting edits, disconnected-device readiness, persistent refinement deferral, failed encoder finalization followed by failed package save, and repeated retry clicks without repeated insertion.
- Clean browser timing: **4,164 ms** from Record click to first visible words; **5,172 ms** to the first canonical final insertion. These include microphone/model startup and fixture timing. They are one observed run, not mouth-to-text latency or a low-resource performance guarantee.

RUN evidence lives under the external verification workspace's `regression-evidence/ABetterNovelAuthoringEnvironment/narration-vtt/`. See each named RUN's `run-manifest.json`; the functional RUN's `manual-test-results/vtt-acceptance.json` contains checkpoints and timing. Existing Dictation diagnostics recorded 183 matching lifecycle/readiness lines in that RUN. Raw manuscript text is not added to those diagnostic events.

Screenshot evidence in the functional RUN: `native-before.png`, `native-wizard-ready.png`, `native-during-recording.png`, `manuscript-recording-home.png`, `manuscript-recording-end.png`, `stt-panel.png`, `stt-dark.png`, `stt-reopened.png` and `stt-narrow-rhs-collapsed.png`. The preceding preview UI is retained in RUN `20261126T145155Z-vtt-functional-recording-63c325c2`. Source-delta artifacts remain local and are not published as evidence bundles.

## Limits and remaining work

- Recording still stops at roughly four minutes. Continuous rollover and near-limit/large-manuscript endurance testing are not completed here.
- Successful manuscript/package reopen is verified, but no durable speech-to-manuscript revision receipt is introduced. **Audio is never automatically deleted**, including when Save Recording is unchecked.
- Encoder/save failures are retryable while the session remains open. This does not provide crash-resumable capture: active PCM/provisional state can be lost if the browser or host is killed before finalization. Saved sessions are not automatically replayed into the manuscript on reopen.
- Simultaneous manual typing, moving an active dictation stream and uninterrupted recording across viewport changes are deferred. Navigation visibly finalizes first.
- Native undo insertion is verified in Chrome on Windows. Other browser engines and packaged desktop hosts require their own acceptance; unsupported native insertion fails into recovery instead of using a history-bypassing value assignment.
- This phase did not independently verify physical microphone speech accuracy, diverse input hardware, long-form performance, screen-reader behavior or shared model-library activation. Refinement execution, automatic cleanup and unapproved Grill Me Decisions 14–18 remain deferred.

Use the updated test instance or launch this branch, open a disposable folder project, enter Narration + Voice → STT Dictation, authorize/test the microphone, verify the model and finish setup. Click a manuscript position before Record. For existing setup, microphone permission can still be required for the new browser origin. Open recordings folder and external audio transcription are in the RHS recovery section.
