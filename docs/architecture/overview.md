# Architecture Overview

This repository is a local-first authoring environment organized around canonical domain models instead of UI state or provider-specific code.

## Runtime Direction

The current app runtime is browser-first for workflow prototyping, but the architecture direction is desktop-first/local-first.

See [Browser Prototype, Desktop Future](./browser-prototype-desktop-future.md) for portability guardrails and API boundaries.

## Source of Truth

- `packages/manuscript-schema` owns manuscript identity, chapter and scene hierarchy, block structure, binder derivation, and durable manuscript anchors.
- `packages/world-schema` owns world templates, instantiated entities, timeline spines, nodes, edges, and explicit entity links.
- `packages/shared-types` owns cross-package workspace DTOs and service contracts.
- `packages/job-contracts` owns long-running job status and result contracts.
- `services/analysis` translates local or hosted model output into anchored `IssueRecord` and `EventTag` objects without owning manuscript identity.
- `services/audio` and `services/voice` operate on manuscript anchors, speaker assignments, and job contracts rather than embedding runtime details in UI code.
- `apps/desktop` is the current composition root and local host.
- `apps/editor` is the author-facing UI layer.

## Current Foundation

The initial implementation focuses on the most reusable deterministic primitives:

1. Structured manuscript creation with stable IDs.
2. Canonical span anchors that resolve back to project content.
3. Character and speaker assignment structures that stay in the manuscript package.
4. Issue and event records that cannot exist without anchors.
5. World templates that instantiate typed entities.
6. Timeline spines and edges with explicit entity introduction links.
7. Shared workspace DTOs and job contracts for analysis, narration, and voice pipelines.
8. Reviewable Dream Scaping proposals that map loose ideas back to manuscript and world-spine evidence.
9. A desktop-hosted local application that composes editor UI, analysis, narration, and voice workbenches.

This foundation keeps the product aligned with a writer's IDE and worldbuilding workstation instead of collapsing into a flat editor.

## Current Host

`apps/desktop` now hosts the runnable application and composes:

- local settings
- shared workspace DTO generation
- analysis service output
- narration session state
- voice render planning

`apps/editor` remains the UI surface that renders:

- binder navigation
- line-indexed manuscript passages
- issue and event consoles
- world spine lanes with cross-node relationships
- dream-scaping story-fit proposals
- narration follow status
- character voice routing and render jobs

The center scene-editor surface now lives in `apps/editor/public/features/scene-editor.js`, which keeps the manuscript shell reusable while the surrounding app continues to orchestrate the rest of the workspace.

Project file save/load/autosave behavior is now consolidated under `ProjectPersistenceService` so editor UI workflows do not directly call browser file APIs or desktop file endpoints.

That separation is the key correction from the earlier bootstrap. The editor renders author workflows, while the desktop host owns composition and runtime lifecycle.

## Parallel Worktree Topology

The repository uses `main` as the canonical manuscript shell integration line.

- The root checkout is the manuscript shell that everything else plugs into.
- `Run GUI.bat` and `Run Manuscript Shell.bat` both launch the root `main` shell on port `4310`.
- `Run Manuscript Shell Worktree.bat` launches the isolated `feature/manuscript-shell` worktree on port `4311` for shell-specific refactors that should not disturb the integration line.
- `Run Voice Service.bat` launches the isolated `feature/voice-service` worktree on port `4312`.
- `Run World Service.bat` launches the isolated `feature/world-service` worktree on port `4313`.

This lets shell-oriented work stay anchored to `main` while still allowing parallel development and side-by-side testing of voice and world subsystems in separate worktrees.

## Editor Refactor Roadmap

The editor shell refactor plan is documented in [Editor Application Refactor Roadmap](./editor-application-roadmap.md). Use that document as the migration order for splitting `apps/editor/public/app.js` into maintainable feature, service, and state modules.
