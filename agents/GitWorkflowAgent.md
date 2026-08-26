# Shared Git Workflow Agent

Use whenever **Codex or ChatGPT** is about to create, select, sync, or retire a task branch/worktree; place an approved implementation/design spec onto a task branch; choose the destination of a Git write; or integrate task work. Do not load it for read-only repository inspection or ordinary edits inside an already-assigned task worktree when no Git topology or destination decision is being made.

## Core policy

- `main` is integrated production truth, not the normal implementation workspace. Do not start ordinary feature, fix, or refactor work directly on `main`.
- One task identity maps to **one canonical branch and one dedicated worktree**. Parallel tasks must not share a worktree.
- Branch names encode work type, product area, and task, for example `feature/world-spine/unplaced-events-dock`, `feature/manuscript/proofread-history`, `feature/narration/voice-conversion`, `fix/world-spine/location-row-delete`, or `harness/git/task-scoped-workflow`.
- Product hierarchy belongs in branch **names**, not in permanent parent branches. Do not create long-lived `world-spine`, `manuscript`, or `narration` integration branches. A temporary `epic/...` integration branch is allowed only when explicitly approved for tightly coupled work.
- Commits are task iterations. Do not create `-copy`, `-final`, `-impl`, `-codex`, `-work`, or similar checkpoint branches for the same task.
- Fetch remote refs instead of pulling a dirty local `main` merely to prepare feature work. A task worktree should be created/resolved from the intended base ref or SHA without modifying unrelated local checkouts.
- Once a task handoff identifies branch, worktree, and base, treat it as authoritative. Do not inspect unrelated branches/worktrees unless the handoff is blocked or a genuine implementation dependency is discovered.
- Inside the assigned worktree, use the repository supervisor as authority for changed-file state, verification routing, pass/fail, and freshness. Do not make Codex reconstruct deterministic Git/test facts that the supervisor already supplies.

## Task identity

A task handoff should carry the smallest stable identity needed to resume work without repository archaeology:

```text
taskId
workType
productArea
branch
worktree
baseRef
baseSha
designPath
approvedDesignSha
agentRoutes
status
```

The task ID should remain stable from design through implementation, verification, integration, and retirement. If an existing branch or worktree conflicts with the recorded task identity, stop as `BLOCKED`; do not create an alias branch to work around the conflict.

## Design/spec placement

- When ChatGPT prepares an implementation design for a specific task, establish the task identity first and commit the authoritative design to that task's canonical branch rather than using `main` as a staging area.
- Record the approved design commit in the task handoff. Codex should begin from the assigned task worktree and read that design there; do not ask Codex to pull/sync `main` just to discover or verify the spec.
- If an approved design already exists on `main`, it may be referenced by SHA without updating a dirty local `main` checkout. The task branch should still become the implementation workspace.
- Task-specific design/docs normally reach `main` when the task is integrated. A documentation-only change intended to land independently may use a `docs/...` branch instead.

## Lifecycle

Use this conceptual lifecycle:

```text
plan/approve
-> start task
-> commit authoritative spec
-> implement in canonical worktree
-> supervisor verification
-> user acceptance / finalise
-> integrate to main
-> retire task worktree and branch
```

`finalise work` may commit and push the current task branch under `FinaliseWorkAgent.md`; it does **not** by itself authorize merging into `main` or deleting the task branch/worktree. Integration and retirement remain explicit operations until deterministic lifecycle tooling implements and validates them.

## Safety

- Never force-update, rebase, reset, clean, or rewrite shared `main` history as part of routine task setup.
- Never delete or retire a branch/worktree without confirming the task is integrated or explicitly abandoned and the user authorized retirement.
- Preserve unrelated dirty checkouts. If safe isolation cannot be established, report `BLOCKED` rather than manipulating unrelated work.
- Cross-task dependencies must be explicit. Prefer landing dependency A to `main` before starting B. Base B on another feature/epic branch only when that dependency relationship is intentionally approved.

## Deterministic tooling contract

The repository currently has deterministic Git-state and verification support through `tools/repo-supervisor/`, but task-scoped branch/worktree creation is still pending. Do not invent a command that does not yet exist.

The intended task-workflow manager will eventually resolve/fetch the base, create or reuse the canonical branch/worktree, persist local task identity under ignored `.tools/` state, and emit a compact `READY` or `BLOCKED` handoff. The language model should consume that handoff instead of rediscovering Git topology.
