# Execution contract — Phase 02 (26 November 2026)

The author explicitly authorizes the native manuscript dictation workflow below. This supersedes the older preview-only insertion gate and two-cursor gesture requirement for this phase. Preserve final-only canonical commits, existing editor history/autosave, and protected audio. Provisional hypotheses are editor projections; no audio deletion is authorized by this milestone. Current work builds on `c2e869c` and the verified external-audio/folder feature `19033f0`. Machine setup stays outside projects. Use the dedicated VTT branch, existing supervisor and controlled browser RUNs; publish cohesive verified commits. External-file previews remain separate from live manuscript dictation.

# A Better Writing Environment — VTT Phase 02

## Native Manuscript Dictation, Guided Setup and UX Consolidation

### 1. Development context and objective

Reference commit:
`c2e869cdcd58f4dfa803072e2d0de5c9aa0047e7`

Review the current development branch, existing VTT architecture, previous Grill Me decisions, regression evidence and accompanying user interface reference images before commencing implementation.

The previous development phase established a functioning local speech capture and transcription prototype, including microphone configuration, model management, utterance events, audio recording, FLAC persistence and developer diagnostics.

The next phase must transition these components from a technical demonstration into a native, intuitive authoring experience.

The fundamental design principle is:

**Dictation is an input method for the manuscript, not a separate editor or transcript management workflow.**

Narration + Voice is the environment in which speech functionality is configured and managed. Once configured, the author must be able to use speech as naturally as keyboard input within the ordinary Manuscript viewport.

The immediate development priority is STT Dictation. Do not undertake a broader redevelopment of Narration Follow.

The existing STT infrastructure, particularly speech events and timing information, must remain available for potential future integration with Narration Follow.

### 2. Requirements hierarchy

The numbered functional requirements in sections 3–12 represent the author's requested workflow and latest confirmed decisions.

Previously established architectural requirements remain applicable unless explicitly superseded.

The author's latest decision explicitly supersedes the previous two-cursor architecture. A separate dictation cursor and double-click activation are no longer required.

The supplementary recommendations in sections 13–16 are engineering implementation guidance. Their inclusion does not establish that every optional enhancement has been individually approved. Evaluate them against the current architecture, preserve existing safeguards and identify any material scope expansion or unresolved design decision before treating it as mandatory functionality.

### 3. Consolidate speech configuration into the RHS Narration Console

Move all speech-related configuration currently displayed in the central STT Dictation panel into the right-hand Narration Console, otherwise referred to as Console B.

Consolidate overlapping controls rather than reproducing the same settings in multiple sections.

The central manuscript editing area must not contain a duplicated speech configuration panel.

Organise the Narration Console around the following functional groups:

- Microphone configuration.
- Microphone permission.
- Audio input device selection.
- Input channel selection.
- Input testing and level monitoring.
- Live STT model management.
- Refinement model and preferences.
- Recording retention.
- Speech runtime configuration.
- Model library and storage location.
- Setup recovery and troubleshooting.

Retain existing working configuration functionality, including model installation, cancellation, runtime installation, storage management and device testing.

Where application-wide speech settings already exist, ensure they consume the same configuration state rather than establish separate settings.

Preserve the existing distinction between installation-wide configuration and project-specific recording data.

### 4. Align the interface with ABE's existing design language

The current STT Dictation prototype uses generic controls that do not align with the established ABE interface.

Use the existing Manuscript, World and Narration + Voice navigation buttons as the visual reference.

The Narration Follow and STT Dictation subpanel controls must clearly indicate which workflow is currently selected.

When STT Dictation is active, the corresponding control must have a recognisable selected state consistent with the existing application navigation.

Inspect and reuse existing CSS variables, component styling, spacing, typography, themes, border treatments and interaction states.

Do not introduce a separate visual design system.

Codex has discretion over the precise wizard colouring and visual treatment, provided the outcome remains consistent with ABE.

Green must represent recording readiness, and red must represent active recording.

### 5. Restore the actual manuscript in the central STT Dictation viewport

Remove the standalone Local Dictation Transcript Preview as the principal content of the central STT Dictation panel.

Replace it with the actual selected manuscript scene.

Reuse the existing manuscript editor rather than developing an independent editor for STT.

Preserve the existing manuscript experience, including:

- Chapter and scene headings.
- Manuscript formatting and typography.
- Editor formatting controls.
- Text selection.
- Scrolling and line numbering.
- Grammar checking and proofreading.
- Chapter and scene word counts.
- Editing history and autosave.

The central manuscript area should remain visually and functionally consistent with the ordinary Manuscript viewport.

The principal differences are the Narration Follow and STT Dictation navigation controls and the RHS Narration Console.

### 6. Implement a single unified manuscript cursor

This requirement supersedes the previous separate editing and dictation cursor architecture.

Do not require double-clicking.

The ordinary manuscript editing cursor is also the starting position for speech-to-text insertion.

The intended workflow is:

1. The user completes the STT setup wizard.
2. All applicable recording readiness conditions are satisfied.
3. The user clicks once at any valid text position within the manuscript.
4. The user activates the microphone recording control.
5. The user begins speaking.
6. Recognised speech appears directly at the selected manuscript position.
7. The insertion position advances naturally as words are added.
8. The user stops recording using the recording control.

A single click must be sufficient to establish the insertion position.

Starting recording must preserve the cursor position established before the user clicked the microphone button.

Do not silently append text to the end of the scene if the user selected a different position.

Do not silently select another scene or paragraph.

For this phase, prioritise recording into the position selected before recording began. Advanced behaviours involving simultaneous dictation and manual editing at different locations, or relocating an active dictation stream, may be considered separately.

### 7. Implement immediate speech-to-manuscript insertion

The live speech-to-text model must progressively insert recognised words directly into the manuscript while the author speaks.

The author must not need to stop recording before seeing the transcription.

Do not route the recognised text exclusively into a separate preview, console or transcript document.

Only the recognised textual content belongs in the manuscript. This includes words and punctuation produced by the live model where supported.

Do not insert:

- Utterance identifiers.
- Timestamps.
- Engine names.
- Audio sample positions.
- Recognition confidence values.
- Technical status messages.
- Speech-event metadata.

The user experience should resemble typing with a keyboard, except that words are supplied by the configured speech recognition model.

Insert text at the beginning, middle or end of existing manuscript content according to the ordinary cursor position.

Preserve existing text before and after the insertion point.

Where the live model produces provisional and final transcription results, reconcile them without repeated insertion, duplication or corruption of unrelated manuscript text.

Use the existing editor document model, history and persistence infrastructure.

Immediate transcription must not depend on a refinement model being executed.

Refinement is a separate downstream process and must not delay the appearance of live recognised words.

### 8. Remove author-facing utterance engine output

Remove the visible technical utterance stream currently displayed below the prototype transcription controls.

The normal author-facing interface must not show raw timed snippets, engine labels or internal transcription events.

Do not remove the underlying utterance processing functionality.

Preserve relevant speech-event information, timing capabilities, session information and sample positions for future development.

Document the potential application of these components to Narration Follow, particularly:

- Alignment of spoken audio against manuscript passages.
- Narrator position tracking.
- Audio-to-text associations.
- Recording and playback synchronisation.
- Detection of deviations from the manuscript.

Do not implement these future Narration Follow capabilities as part of the current task.

Where the current live model provides utterance-level timing but not word-level timing, preserve that capability distinction.

Do not fabricate exact word timestamps from utterance-level timing.

### 9. Implement the guided first-use STT setup wizard

Create a visually coherent instructional overlay in front of the actual manuscript editing area when the user enters STT Dictation and setup is required.

Use the supplied annotated wizard mock-up as the conceptual reference.

The manuscript should remain visible behind the overlay, but manuscript editing must be locked while the mandatory setup workflow remains active.

The wizard is not a second settings panel. All configuration must take place in the RHS Narration Console.

The central wizard should contain three connected visual stages:

1. Microphone.
2. Live STT model.
3. Refinement.

Each stage should indicate its progress and readiness.

For example:

- Microphone completed: green.
- Current model selection stage: active indicator.
- Remaining refinement stage: pending.

Display a current status indicator in the bottom-left region of the wizard.

Examples include:

- Awaiting microphone setup.
- Awaiting microphone test.
- Awaiting model selection.
- Downloading speech model.
- Initialising model.
- Awaiting refinement preference.
- Ready to record.

The status must reflect the actual setup and runtime conditions.

When the minimum requirements have been satisfied, the overall status indicator becomes green and communicates that the application is ready to record.

At that point, an X close button appears in the top-right corner of the wizard.

Closing the wizard restores access to the central manuscript editor.

Completing or closing the wizard must not itself begin microphone recording.

The user must explicitly initiate recording using the manuscript microphone control.

### 10. Guide the user's attention to the RHS Narration Console

During each setup stage, the corresponding actionable control within the Narration Console must have a blinking or pulsing attention indicator.

For example:

- During microphone setup, highlight the microphone setup or input testing control.
- During model setup, highlight the model selection, installation or runtime setup control.
- During refinement setup, highlight the relevant refinement preference control.

The user should be able to understand the next action simply by looking at the wizard and following the corresponding RHS indicator.

The visual guidance must update as the user completes each requirement.

Remove the attention indicator when its action has been completed.

The central wizard and RHS console must represent the same underlying setup state.

Do not reproduce the microphone or model configuration controls within the wizard.

### 11. Introduce the native manuscript recording button

Add a compact microphone recording control at the top-right of the central manuscript panel.

Position it **directly beneath the existing chapter word count**, not alongside it or in the right-hand console.

This recording control must be available in both:

- Narration + Voice → STT Dictation.
- The ordinary Manuscript viewport after speech setup is complete.

When recording is available, the microphone button is green.

When recording is active, the button is red.

Activating the green control begins capture using the configured live STT model and microphone.

Activating the red control stops recording and initiates any required finalisation.

The recording control must not cause the user's existing manuscript insertion point to be lost.

The author must not need to navigate back to Narration + Voice each time they wish to dictate.

### 12. Share speech functionality between viewports

After completing setup, the user must be able to return to the ordinary Manuscript viewport and continue using speech-to-text functionality.

The existing RHS Metadata Console must remain present in the Manuscript viewport.

Do not replace the Metadata Console with speech settings when the author is using the ordinary Manuscript viewport.

When the user returns to Narration + Voice and selects STT Dictation, the RHS speech configuration controls become available again.

Both viewports must share the same speech configuration and existing speech capture infrastructure.

The interface must reflect the actual recording state regardless of which supported authoring viewport is currently selected.

A previously configured author must not be required to repeat the entire setup wizard every time they return to the Manuscript viewport.

### 13. Supplementary interface and authoring recommendations

The following recommendations supplement the author-confirmed functionality. Preserve existing architectural constraints and assess the optional enhancements against the current codebase and approved scope.

#### A. Speech settings

- Preserve shared installation settings between the RHS console and existing application settings. [A01]
- Organise advanced runtime and storage settings into collapsible sections. [A02]
- Preserve configuration locks during capture and finalisation. [A03]
- Prevent background refreshes from resetting console scroll, expanded sections or focused controls. [A04]
- Preserve explicit user consent for model and runtime downloads, including sizes, sources, licences, verification, cancellation and retry. [A05]
- Clearly distinguish installed, selected, loading and operational models. [A06]

#### B. Styling and navigation

- Provide consistent hover, focus, selected and disabled states. [B01]
- Reuse existing ABE components and theme variables. [B02]
- Verify representative desktop sizes and supported themes. [B03]
- Review the existing Whisper-specific navigation subtitle so it reflects both STT Dictation and Narration Follow. [B04]

#### C. Manuscript editing

- Reuse the canonical manuscript editor and document state. [C01]
- Use the single ordinary manuscript cursor, as explicitly confirmed by the author. [Revised C02]
- Maintain a stable recording insertion anchor. [C03]
- Integrate dictation with existing undo/redo. [C04]
- Integrate with autosave and manuscript persistence. [C05]
- Reconcile provisional and final recognition results without duplication. [C06]
- Protect unrelated manual edits and manuscript content. [C07]
- Handle whitespace, punctuation and casing appropriately without introducing unrequested editorial rewriting. [C08]
- Test beginning, middle and end insertion positions. [C09]
- Verify existing editor functionality after voice insertion. [C10]
- Prevent speech events and readiness refreshes from recreating the active editor or stealing focus. [C11]
- Consider subtle visual differentiation of provisional speech if needed. [C12]
- Define safe behaviour when text is highlighted at recording initiation. Do not silently overwrite a selected passage. [C13]
- Preserve rich-text formatting and adjacent annotations. [C14]
- Preserve the existing semantic and time-based undo grouping architecture, including extended Ctrl+Z behaviour where implemented. Do not create an undo entry for every provisional hypothesis. [C15]
- Consider controlled scrolling that follows dictation without fighting manual scrolling. [C16]
- Prevent delayed events from reinserting deliberately undone or deleted text. [C17]
- Maintain compatibility boundaries for future refinement of dictated passages. [C18]
- Insert recognised speech progressively using the live model, as explicitly confirmed by the author. [C19]

#### D. Utterance infrastructure

- Retain appropriate opt-in developer diagnostics. [D01]
- Remove technical recording details from normal author-facing content. [D02]
- Preserve the accuracy and provenance of timing information. [D03]
- Document potential shared speech infrastructure for later Narration Follow development. [D04]
- Preserve stable session and speech-event identities. [D05]
- Retain existing saved recording playback functionality, preferably within an appropriate RHS console section. [D06]
- Maintain privacy-safe diagnostics and local-only speech processing. [D07]

#### E. Wizard and readiness

- Consider allowing users to defer or disable refinement without preventing basic STT recording. [E01]
- Avoid preventing ordinary keyboard-based manuscript writing simply because STT setup is incomplete. [E02]
- Verify actual readiness rather than completed button clicks. [E03]
- Distinguish completed onboarding from current recording readiness. [E04]
- Provide targeted recovery for unavailable components. [E05]
- Preserve the existing Reopen Setup functionality. [E06]
- Test microphone setup failures. [E07]
- Test model and runtime failures. [E08]
- Do not misrepresent refinement execution as available if the current implementation does not support it. [E09]
- Verify meaningful microphone input on the selected channel rather than simply successful stream creation. [E10]
- Separate installation readiness from project-specific recording requirements. [E11]
- Preserve incomplete onboarding progress when leaving and returning to setup. [E12]
- Enforce the manuscript editing lock through relevant editing and shortcut pathways, not merely through an overlay intercepting mouse clicks. [E13]
- Recognise existing valid installations and avoid unnecessary reinstallation. [E14]

#### F. Contextual guidance

- Highlight only the currently relevant setup action. [F01]
- Respect reduced-motion accessibility preferences. [F02]
- Reveal relevant collapsed settings when guidance requires them. [F03]
- Ensure the RHS console is accessible during guided setup, including when previously collapsed. [F04]
- Guide users appropriately through asynchronous downloads, loading and retry states. [F05]

#### G. Recording control

- Consider explicit setup-required, starting, finalising and recoverable-error states in addition to ready and recording. [G01]
- Provide readable status labels or tooltips in addition to colour. [G02]
- Consider directing unconfigured users to the wizard through the microphone control. [G03]
- Prevent duplicate capture sessions caused by repeated clicks. [G04]
- Maintain accurate recording readiness in the ordinary Manuscript viewport. [G05]
- Consider a compact elapsed recording timer if it does not clutter the manuscript. [G06]
- Require explicit recording initiation. [G07]
- Explain recording blockers and provide actionable recovery. [G08]
- Treat a configurable recording keyboard shortcut as an optional enhancement, not a prerequisite for this release. [G09]

#### H. Viewport integration

- Maintain a single shared dictation controller or equivalent shared capture lifecycle. [H01]
- Protect the original project, scene and insertion destination during navigation. [H02]
- Test viewport and scene navigation during capture and finalisation. [H03]
- Distinguish safe editor actions from context-changing actions that require capture to stop. [H04]
- Consider uninterrupted recording across compatible authoring viewports where the project, scene and insertion anchor remain valid. If this cannot safely be achieved, visibly finalise capture rather than silently redirect it. [H05]
- Preserve mutual exclusion between microphone testing, STT recording and Narration Follow recording. [H06]

### 14. Recording persistence, retention and recovery

The current implementation saves speech-session metadata separately from manuscript text.

The existing `saveDictationSession()` implementation explicitly states that this publication is not a revision-bound manuscript persistence receipt and does not authorise automatic audio deletion.

Do not confuse successfully saving a FLAC file or a speech-session record with successfully saving the corresponding manuscript content.

Preserve the earlier agreed minimal-retention philosophy. Audio may only become eligible for automatic cleanup when the corresponding text is verified as durably committed and the applicable retention preference permits deletion.

The following implementation safeguards should be evaluated and preserved where applicable:

- Verify durable manuscript text before deleting protected audio. [I01]
- Preserve recoverable audio and finalised transcription after failed insertion or saving. [I02]
- Investigate the existing approximately four-minute checkpoint restriction. Do not remove it without a safe implementation plan. [I03]
- Test interrupted finalisation, application reopening and recovery. [I04]
- Establish a reliable association between speech-session records and the manuscript transactions or persisted revisions they produced. [I05]
- Ensure retries cannot insert the same dictated passage twice. [I06]
- Preserve failed-save, retry-finalisation and transcript recovery controls when removing the technical preview. [I07]
- Make slow inference and backpressure failures visible; preserve successfully captured material. [I08]
- If automatic checkpoint stops remain, consider notifying users before recording reaches the limit. [I09]
- Preserve recording retention preferences and existing retained recordings. [I10]
- Verify capture shutdown, final audio drainage and microphone resource release. [I11]

If reliable manuscript persistence verification cannot be established in this phase, continue protecting the audio. Do not enable destructive cleanup prematurely.

### 15. Source-code findings requiring investigation

The following findings were established through targeted inspection of the specified baseline commit.

#### `features/narration/dictation-controller.js`

- Recording currently requires the Narration STT subpanel to be active.
- Capture is automatically stopped at approximately 239.5 seconds.
- The recognition queue stops capture when its bounded capacity is exceeded.
- Readiness polling is principally associated with the Narration STT viewport and application settings.
- Context synchronisation stops recording when leaving the current narration workflow.
- Input testing can be marked complete when capture starts, without necessarily demonstrating a meaningful input signal.
- Speech event updates currently target the technical transcript preview.

#### `features/narration/dictation-panel.js`

- Central and RHS settings are duplicated.
- The central panel is currently a standalone transcription preview.
- Raw final and provisional recognition output is visible.
- Existing playback, retry and copy controls must be considered when removing the preview.
- Refinement execution is explicitly unavailable in this checkpoint.
- Model and runtime installation already include consent and progress controls.

#### `shared/dictation-readiness.js`

- Readiness combines microphone, model, runtime, FLAC, saved-project, scene and capture lifecycle requirements.
- The current recording requirement includes a saved desktop folder package.
- Preserve valid recording blockers and make their remedies understandable.
- Do not confuse a successfully configured installation with the eligibility of a particular project or scene.

#### `app.js`

- The global application action handler stops capture before most shell actions.
- The existing manuscript renderer replaces the central editor slot HTML.
- Narration and ordinary Manuscript viewports route different content into the RHS console.
- Existing project transition and Narration Follow entry points coordinate with the dictation controller.

Review these pathways before extending recording to the ordinary manuscript editor. Routine editor interactions must not accidentally terminate capture, reset insertion state or redirect speech.

#### `adapters/storage/project-persistence-service.js`

- Existing speech-session publication verifies saved session metadata through package readback.
- It does not yet establish a verified association with the persisted manuscript text.
- Manuscript insertion, recovery and audio cleanup must account for that distinction.

#### Additional relevant source files

- `adapters/dictation-client.js`
- `adapters/dictation-capture.js`
- `adapters/dictation-inputs.js`
- `adapters/dictation-pcm-worklet.js`

Inspect the associated backend implementation, editor history infrastructure and relevant tests before making implementation decisions.

The above findings relate to the specified baseline. Verify whether any have changed in subsequent commits.

### 16. Recommended implementation sequencing

#### Milestone 1 — Existing architecture and interface consolidation

- Inspect the latest branch and existing development instructions.
- Identify reusable manuscript, settings and theme components.
- Consolidate RHS speech settings.
- Update navigation styling and selected states.
- Preserve existing model, runtime and microphone functionality.

#### Milestone 2 — Native manuscript and guided setup

- Restore the manuscript within STT Dictation.
- Implement the central wizard overlay.
- Integrate RHS contextual guidance.
- Establish setup completion and readiness handling.
- Add the recording control directly beneath the chapter word count.

#### Milestone 3 — Real-time manuscript integration

- Implement the confirmed single-cursor behaviour.
- Connect the live speech event stream to manuscript editing transactions.
- Reconcile provisional and final results.
- Integrate both authoring viewports with the same recording lifecycle.
- Preserve existing manuscript content, formatting and history.

#### Milestone 4 — Persistence and recovery

- Verify dictated text is durably saved.
- Protect pending recordings and transcription.
- Preserve recovery pathways.
- Test duplicate prevention and interrupted finalisation.
- Enable audio cleanup only where existing retention requirements and verified text persistence permit it.

#### Milestone 5 — Verification and acceptance

- Complete automated and manual regression testing.
- Measure live transcription latency.
- Verify realistic manuscript usage.
- Document remaining limitations and provide interface evidence.

Use logical, reviewable commits rather than combining unrelated architectural changes into one unreviewable modification.

### 17. Testing and acceptance criteria

The user-confirmed functionality is complete only when all relevant conditions below are satisfied.

#### Interface

- Speech configuration has been removed from the central STT panel and consolidated into the RHS Narration Console.
- Navigation controls match ABE's established styling.
- STT Dictation has a clear selected state.
- The actual manuscript is displayed in the central panel.
- Raw utterance engine output is absent from the normal author interface.

#### Onboarding

- The wizard overlays the manuscript.
- Editing is locked while the mandatory wizard is active.
- The wizard displays microphone, model and refinement stages.
- Configuration takes place through the RHS console.
- Relevant RHS controls receive contextual attention indicators.
- Current setup status is clearly displayed.
- Readiness becomes green when applicable minimum requirements are met.
- The X button becomes available when setup is ready.
- Closing the wizard restores manuscript access.
- Previously configured users can return without unnecessarily repeating setup.

#### Recording

- The microphone control is directly beneath the chapter word count.
- Green indicates ready to record.
- Red indicates active recording.
- Recording requires explicit user initiation.
- The ordinary manuscript cursor establishes the insertion point.
- Double-click activation is not required.
- Recognised words appear progressively during speech.
- Text is not incorrectly appended to the end of the manuscript.
- Existing surrounding text remains intact.
- Technical speech metadata does not appear in the manuscript.
- Stopping recording finalises the applicable speech events.

#### Shared viewport functionality

- Dictation is available within both STT Dictation and Manuscript.
- The ordinary Manuscript viewport retains the Metadata Console.
- Returning to Narration + Voice restores access to speech configuration.
- Recording state is consistent between supported authoring viewports.
- Existing Narration Follow functionality is not regressed.

#### Manuscript integrity and reliability

- Dictated text participates in existing editing history and persistence.
- Provisional and final results do not cause duplicate text.
- Manual text and formatting are protected.
- Failed saving does not silently destroy recoverable speech.
- Audio cleanup cannot occur before applicable durable text verification.
- Session recovery does not duplicate manuscript insertion.

Use the existing VTT regression infrastructure and supplement it where necessary.

Recommended additional quality assurance:

- Inspect the current branch before implementing changes. [J01]
- Implement in logical phases. [J02]
- Produce reviewable commits. [J03]
- Perform automated regression testing. [J04]
- Provide before-and-after screenshots. [J05]
- Report changed files, decisions, limitations and untested behaviour. [J06]
- Measure speech-to-text insertion latency. [J07]
- Test repeated and near-checkpoint-length recording sessions. [J08]
- Use disposable copies of realistic large manuscripts for potentially destructive testing. [J09]
- Preserve existing model, runtime, project and audio compatibility where feasible. [J10]
- Distinguish deterministic audio fixture testing from real microphone testing. [J11]
- Establish completion gates for manuscript integrity, undo/redo, persistence and recovery. [J12]

Do not claim real hardware verification unless actual microphone testing has been performed.

Do not claim that the feature is complete merely because the updated interface renders correctly.

### 18. Explicitly deferred development

Do not unnecessarily expand this task to include:

- A separate dictation cursor.
- Double-click dictation activation.
- A complete Narration Follow rewrite.
- Exact word-level narration alignment where unsupported by the model.
- A replacement speech recognition engine.
- Voice editing commands.
- Automatic character-name vocabulary learning.
- Automatic dialogue formatting.
- Full automated refinement execution.
- Automatic model switching.
- Unlimited continuous recording without an established safe rollover architecture.
- Broad GPU performance optimisation before baseline latency measurement.

Preserve earlier architectural decisions concerning separate live, refinement and narration model roles, shared model files, hybrid refinement, change acceptance and audio retention.

Preserve future compatibility with storage quota management and manuscript snapshots without commissioning those separate features in this task.

### 19. Required implementation report

At completion, provide:

- Implementation summary.
- Changed files and relevant commits.
- Explanation of architectural decisions.
- Description of how the single manuscript cursor is preserved through recording initiation.
- Evidence of real-time speech insertion into existing manuscript content.
- Evidence of save, reopen and recovery behaviour.
- Automated and manual test results.
- Before-and-after interface screenshots.
- Known limitations.
- Hardware-dependent behaviour not independently verified.
- Recommendations deferred or requiring further author approval.

Clearly identify any deviation from the author's requirements.

The author must ultimately be able to open ABE, configure speech once, click anywhere within the manuscript, activate the microphone and speak words directly into the manuscript.

**The target experience is click, record, speak and write.**