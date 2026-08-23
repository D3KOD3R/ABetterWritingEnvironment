# Narration Follow Mode

Narration follow mode is the live reading reference view for audiobook-style recording and long-form read-through. Its job is to keep the narrator centered on the current manuscript line while speech recognition tracks progress through the text.

The key boundary is that the editor renders the viewport, but the audio service owns the follow-session state and alignment lifecycle. That keeps the cursor logic deterministic and prevents the UI from becoming the source of truth for speech tracking.

## Research Notes

Whisper is a good fit for final transcript cleanup and post-take alignment, but it should not be treated as the primary live cursor engine. OpenAI describes Whisper as a general-purpose speech recognition model, and the paper describes a 30-second chunking architecture. That is strong for offline transcription, but it is not inherently a low-latency streaming decoder for word-by-word manuscript following.

The research also shows the limits that matter for a narration workflow:

- Whisper can hallucinate text that was not spoken.
- Accuracy varies by language, accent, and dialect.
- The model is strongest when the application evaluates it in the target domain rather than assuming a transcript is always correct.

The `whisper.cpp` streaming example is still useful as a fallback/recovery reference because it transcribes short windows, supports a sliding-window VAD mode, and keeps context across chunks. For a narrator reading known manuscript text, however, the live path should prefer a true streaming ASR provider such as `sherpa-onnx` plus a manuscript-constrained aligner. The sister `VoiceToTextCommands` repo already follows this division: `sherpa-onnx` for live preview and `whisper.cpp` for the stop-time cleanup pass.

Sources:

- [OpenAI Whisper README](https://github.com/openai/whisper)
- [OpenAI Whisper model card](https://github.com/openai/whisper/blob/main/model-card.md)
- [whisper.cpp streaming README](https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/README.md)
- [whisper.cpp stream example](https://github.com/ggml-org/whisper.cpp/blob/master/examples/stream/stream.cpp)
- [Whisper paper](https://arxiv.org/abs/2212.04356)
- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)

## Design Rationale

The follow-track service is shaped around these rules:

1. Capture audio in short windows instead of waiting for a full recording.
2. Use local streaming ASR for the live cursor, with VAD/endpoint detection to avoid feeding silence into the recognizer.
3. Keep a small overlap window so repeated words and sentence boundaries do not drift.
4. Track a last confirmed manuscript anchor so the viewport can recover after pauses, repeats, or brief recognition failures.
5. Emit alignment results back to canonical manuscript anchors and line numbers, never to DOM positions or pixels.
6. Use Whisper or a forced-alignment pass after recording stops to produce cleaner transcript/timing metadata.
7. Keep the voice-render pipeline separate so voice selection can evolve independently of STT.

That design keeps the narrator view stable. The line being read stays centered, while the service quietly updates the follow cursor in the background.

## Service Shape

- Capture adapter: the editor uses Web Audio only to turn the microphone stream into timestamped 16 kHz PCM frames.
- Desktop speech bridge: the Tauri desktop host owns local engine discovery, sidecar lifecycle, HTTP routes, temp audio files, and stop-time cleanup.
- Streaming STT adapter: a repo-local `sherpa-onnx` Python sidecar emits partial/final transcript events for live follow tracking.
- Whisper/final-alignment adapter: repo-local `whisper.cpp` transcribes the completed temp WAV after recording stops.
- Alignment adapter: resolves transcript snapshots back to canonical manuscript anchors and visual line labels.
- Follow-session state: stores the current anchor, line number, line text, confidence, provider metadata, and status.
- Viewport renderer: paints confirmed read coverage where useful and optionally scrolls the manuscript using the observed reading rate and runtime lead target.

## Boundary Rules

- The audio service owns follow-session state, chunking, and alignment.
- The editor owns rendering only.
- The voice service owns voice profiles, bindings, and render jobs.
- The UI must not treat screen coordinates as durable narration state.
- Persisted follow state must always resolve back to canonical manuscript anchors.

## Current Foundation

The current build uses a local-first realtime path. The `.tools/sherpa-onnx` and `.tools/whisper` runtime assets are copied into the repository from the sister `VoiceToTextCommands` repo for local development, and `.tools/` plus `.tmp/` are ignored so binaries, models, and generated audio scratch files do not enter source control.

The browser normally hosts the UI, microphone permission, and Web Audio frame capture. During the current manual testing phase, Browser Web Speech may also own the live transcript when it is available because the installed local Sherpa 20M model is not accurate enough for read-along narration. That browser-managed live provider is wrapped with a cleanup-only desktop tracker so local PCM capture and post-stop Whisper cleanup still run. If Browser Web Speech is unavailable in the desktop webview, the desktop Sherpa tracker remains the live fallback. `apps/editor/public/features/narration/narration-live-audio-frame-service.js` still owns 16 kHz PCM16 frame capture for the desktop bridge.

Live follow is deliberately not treated as a full transcription banking surface. Browser Web Speech and desktop Sherpa snapshots are trimmed to bounded recent-word windows before alignment, so the follow matcher receives only the transcript tail needed to keep the narrator's reading area centered. Web Audio PCM is buffered into roughly 1.2-second chunks before it is sent to the desktop bridge; the desktop tracker keeps one active chunk and at most one latest pending chunk, replacing stale live-follow decode work instead of letting old cursor updates lag behind the reader. Stale chunks skipped for live decode are still sent as archive-only audio, so the complete audio still lands in the temp PCM/WAV path for stop-time Whisper cleanup.

The desktop bridge in `apps/desktop/src/realtime-speech-bridge.ts` discovers the repo-local Sherpa model bundle first, falls back to configured model roots only when needed, starts the Python sidecar hidden on localhost, forwards PCM frames to `/sessions/{id}/audio`, and stores a matching PCM/WAV scratch recording under `.tmp/realtime-speech/`. When the user stops recording, the bridge stops the Sherpa stream and invokes repo-local `whisper.cpp` as cleanup against the captured PCM. The full WAV remains the durable recording; longer cleanup runs are split into overlapping 30-second temporary WAV windows with a 5-second overlap, then stitched by removing duplicate overlap words. The cleanup pass chooses the strongest installed `.tools/whisper` model by ordered preference and can be pinned with `ABE_WHISPER_CPP_MODEL` for model comparison. Whisper is not treated as the realtime cursor engine.

The sidecar in `services/audio/sidecars/sherpa_onnx_streaming_sidecar.py` exposes:

- `GET /health`
- `POST /sessions/start`
- `POST /sessions/{id}/audio`
- `POST /sessions/{id}/stop`

The realtime provider boundary remains explicit. `services/audio` exposes local `sherpa-onnx` and windowed `whisper.cpp` descriptors, realtime session snapshots, and transcript snapshot normalization. Browser Web Speech descriptor helpers exist for provider modeling and are now used as the preferred live fallback when the desktop webview exposes `SpeechRecognition`; this is a pragmatic quality fallback while the local streaming model is replaced or constrained more tightly against the manuscript.

Viewport pacing is driven by manuscript progress. Every three seconds the tracker samples how many manuscript words the live cursor has advanced, converts that to words per minute, divides by the active scene's estimated words per visual line, and feeds the resulting lines-per-minute into the scroll planner. Those word and visual-line metrics are cached per textarea text and wrap width so long scenes are not rescanned for every interim transcript. The editor runs short scroll pulses between uneven ASR callbacks so the viewport eases toward the active span instead of jumping only when a transcript event arrives. Downward movement is gated until the live matched line reaches the current viewport center line, so an early line near the top of the visible page remains readable. Each scroll correction is capped to a few visual lines, so a single far-away ASR match cannot skip half a page even when the tracker target is outside the current viewport.

The aligner is constrained by the manuscript viewport before it searches wider text. The editor estimates the wrapped scene offsets currently visible in the manuscript scroll area and passes that range to the alignment service. The service caches scene block token ranges, tries visible blocks first, then a one-block neighboring band, then full-scene recovery. In long blocks it searches bounded candidate starts around transcript and anchor evidence instead of evaluating every token. A found candidate must also pass stable-anchor acceptance before it can move the live cursor: low-confidence matches, weak short next-block transitions, and backward same-block repeats remain recovery evidence, and rejected viewport-biased candidates do not stop the current-anchor search. Each result logs the viewport range, winning search pass, rejected candidate where relevant, candidate/evaluation counts, cache-hit status, and alignment duration through `NarrationFollowTracker`, which makes repeated-text failures easier to diagnose after a test read.

The live overlay now separates read progress from active tracking state. A faint runtime-only read trail can mark cumulative confirmed coverage, while the current and predicted lead phrase render as a stronger non-yellow focus cue that remains scroll/tracker state rather than durable manuscript highlight data. Follow-scroll avoids default upward movement from transient backward matches, reducing hopscotch behavior when ASR briefly attaches to repeated earlier wording.

Browser-managed live recognition can arrive behind the narrator. To keep read-along tracking usable, the editor applies a display-only lead span before pacing the viewport. The confirmed ASR match remains the runtime follow anchor, the faint coverage trail stops at the recognized end offset, and only the scroll target is allowed to lead ahead by a capped word lookahead. This lead does not change saved take spans or Whisper cleanup transcripts.

Narration arming treats click location as meaningful. A drag selection records the exact selected span; a plain caret click resolves to the clicked wrapped manuscript line inside the canonical block instead of arming the whole paragraph. Display line labels are derived from measured textarea geometry so the Verse chip tracks the visible gutter line. During active recording, Sherpa transcript snapshots update the Audio metadata panel in place rather than rerendering the whole right console, which keeps Stop stable under the pointer while the follow overlay and tracker monitor continue to update. Stop moves the panel into a disabled finalizing state on the first click, saves the canonical long take before waiting for Whisper cleanup, then patches the saved transcript when background cleanup finishes. The right-side Audio panel keeps record/stop, play-latest, and delete-latest in a compact scene-title header cluster, leaves saved-take actions inline with their take text, and reserves the lower tracker monitor for live Sherpa text and post-stop Whisper cleanup text.

Developer-log sources:

- `NarrationFollowTracker`: local Sherpa availability/start/stop/snapshot events, local audio-chunk flush/queue/drop decisions, provider selection decisions, alignment decisions, scroll toggle changes, visible search-range decisions.
- `NarrationReadingRate`: word-index samples, observed words per minute, words per visual line, derived lines per minute.
- `NarrationViewportTracker`: viewport target, applied scroll delta, disabled-scroll decisions, backward-match blocks, settled/no-op decisions.

Local runtime checks on 2026-07-18:

- Python 3.11 imported both `numpy` and `sherpa_onnx`.
- The Sherpa sidecar returned healthy and created/stopped a recognizer session against `.tools/sherpa-onnx/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17`.
- `whisper-cli.exe` loaded `.tools/whisper/ggml-base.en.bin` and produced a transcript artifact from a temp WAV.

Local cleanup model update on 2026-07-19:

- `.tools/whisper/ggml-small.en.bin` is installed as the current development cleanup model after manual narration testing showed `ggml-base.en.bin` was too weak for the first `(John) The Mess` read-through.
- `detectWhisperCppRuntime` now prefers larger and `small.en` models before `base.en`, while still keeping base/tiny fallback compatibility for machines that only have smaller assets.

Live tracker fallback update on 2026-07-19:

- Manual testing showed `.tools/sherpa-onnx/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17` produced unusable live transcripts for the first `(John) The Mess` read-through.
- The editor now prefers Browser Web Speech for the live transcript when available, wrapped with a cleanup-only desktop tracker so the local PCM/WAV/Whisper cleanup path is preserved.
- The panel monitor uses `Live tracker` rather than `Sherpa live` because the live provider may be browser-managed or local Sherpa depending on runtime availability.

Live display-lag update on 2026-07-19:

- Manual testing showed Browser Web Speech was much more accurate but visibly behind the spoken passage.
- `narration-follow-display-service.js` now derives a runtime-only lead selection with a 6.5 second capped word lookahead for overlay and scroll rendering.
- The lead is intentionally not persisted; it is a viewport/display compensation layer over the confirmed transcript match.

Next implementation step: exercise the full desktop recording loop with live microphone audio, tune chunk size and endpoint settings from developer logs, then add pause/recover state transitions and stronger forced-alignment metadata for saved takes.

Responsive live-follow update on 2026-07-20:

- Transcript snapshots now carry bounded follow windows instead of growing with the full recording.
- PCM capture now flushes around 1.2-second chunks and flushes the last partial chunk on stop.
- The desktop tracker drains the final live chunk before stop-time Whisper cleanup, but live cursor updates cannot queue indefinitely behind stale chunks.
- Long-block alignment now uses cached scene token ranges, bounded candidate-start search, and timing/search-count logs.
- Viewport planning now reuses cached text metrics, ASR result bursts coalesce to the next animation frame, and duplicate follow-layer paints are skipped.

Immediate Stop and chunked cleanup update on 2026-07-21:

- Stop is first-click responsive: the session enters a disabled finalizing state while the media file is saved, and Whisper cleanup continues in the background.
- Whisper cleanup now uses chunked inference with stride for longer takes: the desktop bridge keeps the full WAV as the durable recording, creates overlapping temporary chunk WAVs, transcribes each chunk, and stitches duplicate overlap words.
- Follow-scroll now caps each viewport correction to four visual lines, keeping the active reading area moving toward center without half-page jumps from one far-away match.
