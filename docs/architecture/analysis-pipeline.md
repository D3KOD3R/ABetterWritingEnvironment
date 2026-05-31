# Analysis Pipeline

The analysis pipeline consumes canonical manuscript structures and produces reviewable anchored records.

## Expected Flow

1. Read structured manuscript content from `packages/manuscript-schema`.
2. Run deterministic checks and optional local AI analysis behind provider interfaces in `services/analysis`.
3. Convert findings into shared suggestion DTOs with canonical anchors.
4. Separate directly actionable manuscript findings from reviewable worldbuilding suggestions.
5. For Dream Scaping, compare the submitted idea against manuscript and world-spine evidence, then return reviewable story-fit proposals instead of mutating canonical story data.
6. Materialize accepted findings into typed `IssueRecord` or `EventTag` objects.

## Constraints

- Analysis services do not invent new manuscript identity.
- Findings must remain traceable to durable project structures.
- Model-specific output is translated into repository-owned record shapes.
- The current bootstrap uses a local deterministic analysis provider to prove the boundary before any model-specific adapter is added.
- World template, entity, and cross-spine suggestions remain pending review records until a user accepts them.
- Dream Scaping suggestions must remain advisory, evidence-linked, and user-reviewed before they create scene drafts, timeline nodes, or entity links.

## Editor Projection Handoff

Current manuscript diagnostic input is `IssueRecord`: accepted issue findings are stored on the canonical project with a `ManuscriptAnchor`, and the editor may derive a `diagnostic` visual projection from that durable record.

The current `suggestions` output is not a manuscript decoration feed. It contains world-template/entity/link proposals and Dream Scaping proposals whose evidence anchors support review panels and later acceptance workflows. `packages/shared-types` defines `AnchoredManuscriptSuggestion` for future manuscript-range proposals with review state, source identity, evidence anchor, proposed action, and accepted/rejected lifecycle fields; the editor still must not add a manuscript `suggestion` projection channel until that DTO has a dedicated queue and explicit accept/reject commands.

## Selected Lightweight Local AI

The first model adapter target is `Qwen/Qwen3-0.6B-GGUF` running through `llama.cpp`.

Rationale:

- It is small enough to be a default local-first assistant candidate rather than a heavyweight optional model.
- The official model card lists 0.6B parameters, GGUF packaging, Apache-2.0 licensing, and a 32,768 token context window.
- `llama.cpp` is the runtime target because it is lightweight, local, GGUF-native, and does not require Python or CUDA for baseline deployment.

Initial use cases:

- draft task title/body suggestions
- inspiration-note summarization
- local issue explanation drafts
- scene-level reflection prompts

The adapter must remain optional and provider-bounded through the [Local AI Router](./local-ai-router.md). Canonical manuscript anchors, tasks, inspiration notes, research notes, issue records, and event tags are still repository-owned structures; model output can propose text for those records but must not replace their identity or location data.
