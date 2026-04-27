# World Spine Model

## Core Objects

- `TimelineSpine`: a horizontal lane for a locality, faction, character thread, planet, or custom story dimension.
- `TimelineNode`: a concrete event on a spine.
- `TimelineEdge`: an explicit relationship between nodes such as causality, overlap, or reference.

## Modeling Rules

- Nodes belong to exactly one spine.
- Cross-spine relationships are represented by `TimelineEdge`, not by duplicating free-form text.
- Node-to-entity association is explicit through stable entity IDs.
- Node-to-manuscript traceability happens through linked manuscript anchors.

## Why This Matters

The world spine view must support chronology, overlap, and causality reasoning. A note-taking model cannot safely power these features, so the timeline remains structured from the start.
