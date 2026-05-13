# Voice Service Agent

## Sandpit Scope

This sandpit focuses on Feature 05, Character Voice Narration. The voice feature service is the narration and audiobook performance layer for the product: it maps manuscript speaker assignments to voice profiles, queues preview and chapter render jobs, persists narration state, and keeps every render traceable back to canonical manuscript anchors.

## Service Description

The voice service owns the provider boundary for narration output. In this sandpit, that means:

- resolving and normalizing voice profiles
- mapping speakers to voice profiles
- creating and tracking narration jobs
- managing queue state transitions
- persisting voice narration snapshot data
- tracking recording-session word counts
- keeping audiobook release metrics separate from manuscript writing goals
- simulating placeholder rendering until a real provider is wired in

The service is intentionally job-driven and anchor-aware. It should never depend on transient UI state, raw pixels, or editor-specific behavior to know what to render.

## Current Implementation Shape

Use the existing module boundaries as the source of truth for this sandpit:

- `services/voice/src/voice-profile.ts` for voice profile creation and normalization
- `services/voice/src/narration-job.ts` for narration job state and transitions
- `services/voice/src/voice-queue.ts` for queue ownership and job lookup
- `services/voice/src/voice-storage.ts` for persisted voice narration snapshots
- `services/voice/src/placeholder-renderer.ts` for stubbed render completion
- `services/voice/src/index.ts` for the in-memory voice service contract

The current tests in `test/voice-service.test.mjs` and `test/voice-narration-foundation.test.mjs` define the expected placeholder behavior and should be updated alongside any contract changes.

## Working Rules

- Keep voice behavior behind service and provider boundaries.
- Preserve canonical manuscript anchors for every job, binding, and render output.
- Keep audiobook release dates and recorded-word metrics owned by the voice service, not the manuscript writing-goal service.
- Treat placeholder rendering as a deliberate stub, not as hidden production logic.
- Prefer typed data and explicit transitions over ad hoc state updates.
- Update tests when queue rules, profile normalization, or storage shape changes.
- Do not couple the voice service to editor UI, audio capture, or narration-follow alignment logic.
- Do not invent real provider behavior unless the implementation and tests are being updated together.

## Boundary Reminders

- The voice service owns voice profiles, speaker bindings, and render jobs.
- The audio service owns capture, narration follow state, and alignment.
- The editor owns presentation only.
- The manuscript schema owns stable project, chapter, scene, block, and span anchors.
- Provider-specific code must stay abstracted so local, hosted, or experimental engines can be swapped later without rewriting the core voice model.

## Practical Default

If you are editing this sandpit, keep changes narrow, testable, and traceable to the voice service description above. The safest changes are ones that preserve the current contract while improving profile handling, queue state, storage shape, or job traceability.
