# Narration Follow Mode

Narration follow mode is the live reading reference view for audiobook-style recording and long-form read-through. Its job is to keep the narrator centered on the current manuscript line while speech recognition tracks progress through the text.

The key boundary is that the editor renders the viewport, but the audio service owns the follow-session state and alignment lifecycle. That keeps the cursor logic deterministic and prevents the UI from becoming the source of truth for speech tracking.

## Research Notes

Whisper is a good fit for this feature because it is not just a transcript engine. OpenAI describes Whisper as a general-purpose speech recognition model that supports multilingual ASR, speech translation, and language identification, and the model card notes that it was trained for speech recognition and translation rather than a single narrow task.

The research also shows the limits that matter for a narration workflow:

- Whisper can hallucinate text that was not spoken.
- Accuracy varies by language, accent, and dialect.
- The model is strongest when the application evaluates it in the target domain rather than assuming a transcript is always correct.

The `whisper.cpp` streaming example reinforces the shape of the follow-track service. Its microphone example transcribes in short windows, supports a sliding-window VAD mode, and keeps context across chunks. The CLI also exposes timestamp-related options and word-output options, which means the implementation should think in terms of chunked segments plus timing metadata rather than raw frame-level updates.

Sources:

- [OpenAI Whisper README](https://github.com/openai/whisper)
- [OpenAI Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md)
- [whisper.cpp streaming README](https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/README.md)
- [whisper.cpp stream example](https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/stream.cpp)
- [Whisper paper](https://arxiv.org/abs/2212.04356)

## Design Rationale

The follow-track service is shaped around these rules:

1. Capture audio in short windows instead of waiting for a full recording.
2. Use VAD or silence detection to decide when Whisper should transcribe a chunk.
3. Keep a small overlap window so repeated words and sentence boundaries do not drift.
4. Track a last confirmed manuscript anchor so the viewport can recover after pauses, repeats, or brief recognition failures.
5. Emit alignment results back to canonical manuscript anchors and line numbers, never to DOM positions or pixels.
6. Keep the voice-render pipeline separate so voice selection can evolve independently of STT.

That design keeps the narrator view stable. The line being read stays centered, while the service quietly updates the follow cursor in the background.

## Service Shape

- Capture adapter: microphone or recorded audio feeds the STT pipeline in windows.
- Whisper adapter: transcribes a chunk and returns text plus timing metadata.
- Alignment adapter: resolves the transcript back to the canonical manuscript anchor and line.
- Follow-session state: stores the current anchor, line number, line text, confidence, and status.
- Viewport renderer: centers the active line in the middle of the page and keeps nearby context visible.

## Boundary Rules

- The audio service owns follow-session state, chunking, and alignment.
- The editor owns rendering only.
- The voice service owns voice profiles, bindings, and render jobs.
- The UI must not treat screen coordinates as durable narration state.
- Persisted follow state must always resolve back to canonical manuscript anchors.

## Current Foundation

The current build uses a local alignment monitor stub. That stub is intentionally anchor-aware and job-driven so a Whisper adapter can be dropped in later without rewriting the manuscript model or the narration viewport.
