# Local AI Router

The Local AI Router provides model-agnostic AI task routing for the novel editing application.

## Purpose

The application should not hardcode a specific model or provider into the editor UI. Instead, editor and analysis features submit typed AI tasks to the desktop host. The desktop host forwards those tasks to the Local AI Router.

## Ownership

- `apps/editor/public` can call desktop HTTP routes, but must not call model runtimes directly.
- `apps/desktop` owns local HTTP routing and request translation.
- `services/local-ai` owns tier selection, prompt construction, provider availability checks, model-library scanning, and provider invocation.
- Provider-specific code stays inside `services/local-ai/providers`.
- Canonical manuscript anchors and analysis records remain owned by `packages/manuscript-schema`, `services/analysis`, and shared contracts.

## Current Provider Target

The first local provider target is `llama.cpp` running as a localhost sidecar service.

Initial development model:

- `Qwen/Qwen3-0.6B-GGUF`
- Tier: Tiny
- Purpose: lightweight metadata generation and pipeline testing

This model is not considered a production-quality editing model.

The provider uses the `llama.cpp` OpenAI-compatible `POST /v1/chat/completions` endpoint. The sidecar is expected at `http://127.0.0.1:8080` unless overridden by desktop-host configuration.

## Local Model Library

The desktop host exposes a ComfyUI-style model-root surface for local artifacts. The default root comes from desktop-local settings and should not be stored in project manuscript data.

Initial folder architecture:

- `llm`
- `embeddings`
- `speech`
- `voice`

Each registered model folder should contain an `abe-model.json` manifest. The manifest describes the local artifact without executing any downloaded code:

- stable model ID and display name
- source metadata such as a Hugging Face repo ID and revision
- runtime, format, tier, and supported AI task types
- optional context window and checksum

Loose `.gguf`, `.onnx`, `.bin`, and `.safetensors` artifacts are visible in the Local AI settings panel as unregistered files. They should not be routed to authoring tasks until they have an explicit manifest and a provider adapter can safely handle their format.

## Capability Tiers

### Tiny

Used for:

- chapter titles
- scene labels
- tags
- short summaries
- issue headings
- timeline node names
- template-name suggestions

### Standard

Used for:

- paragraph review
- scene review
- dialogue review
- repetition detection
- paragraph rewrite suggestions

### Large

Used for:

- continuity checks
- character logic
- timeline consistency
- structure review
- worldbuilding consistency

Large-model tasks must receive structured context from the manuscript database. The application should not blindly send an entire manuscript to the model.

Continuity checks normally route to Large. For development pipeline testing only, `devAllowTinyContinuityCheck` can route a continuity check to Tiny.

## Desktop Routes

The initial desktop host routes are:

- `GET /api/local-ai/status`
- `GET /api/local-ai/models`
- `POST /api/local-ai/model-settings`
- `POST /api/local-ai/models/ensure-folders`
- `POST /api/local-ai/generate-title`
- `POST /api/local-ai/generate-tags`
- `POST /api/local-ai/continuity-check`

Title and tag generation default to Tiny. Continuity defaults to Large unless the development Tiny override is explicitly set in the request body.

The browser-facing response is an `AiResult`:

- `ok: true` returns generated text, task type, selected tier, provider name, model name, and output format.
- `ok: false` returns `provider_unavailable`, `tier_not_configured`, or `provider_error` with a readable message.

The model-library routes return a browser-renderable scan result with folder readiness, registered model descriptors, unregistered artifacts, validation messages, and model catalog links. They do not launch model processes.

## Security

The local AI sidecar must bind only to `127.0.0.1`.

The browser UI must never call llama.cpp directly. Browser requests go to the desktop host first.

## Failure Behaviour

If no local model is running, existing deterministic analysis must continue to function. Local AI routes should return a clear unavailable response rather than crashing the app.

Standard and Large tiers are allowed to return `tier_not_configured` until local model adapters are configured for those tiers.
