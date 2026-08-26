# Task-Scoped Git Workflow and Shared Assistant Handoff

Status: Proposed architecture; shared Git policy ready; deterministic task manager pending  
Date: 2026-08-26

## Purpose

Align Git structure with the repository's product/documentation/agent architecture while reducing repeated Codex repository archaeology, making parallel feature work safe, and giving both Codex and ChatGPT one shared contract for branch/worktree/spec placement.

The target is not a complicated GitFlow hierarchy. It is a task-scoped workflow in which `main` remains integrated production truth and product hierarchy is expressed through branch naming and task identity.

## Problem

Recent parallel feature runs exposed a recurring startup cost before implementation could begin. A coding agent had to discover or reason about:

- which checkout was the production repository;
- whether `main` was clean, dirty, ahead, or behind;
- whether the approved design commit existed locally;
- whether fetching or fast-forwarding was safe around unrelated user changes;
- which branch/worktree actually belonged to the task;
- whether that branch was based on the intended commit;
- whether another similarly named branch was authoritative.

These are mostly deterministic Git facts. Paying model reasoning/context for them is wasteful, and the cost multiplies when several Codex tasks run in parallel.

The repository already reduces this cost after implementation starts: `tools/repo-supervisor/git-state.mjs` collects branch, HEAD, merge base, ahead/behind, clean/dirty/conflict and changed-file state; supervisor handoff/reporting provides bounded verification evidence. The missing layer is **task-scoped Git topology and lifecycle before Codex begins work**.

## Goals

1. Keep `main` meaningful as integrated production state.
2. Give every substantial task one canonical branch and one dedicated worktree.
3. Let product hierarchy be visible in Git without creating long-lived domain integration branches.
4. Let ChatGPT place approved implementation specs directly onto the task branch that Codex will implement.
5. Give Codex a compact task handoff so it does not rediscover branch/base/worktree state.
6. Reuse the deterministic repository supervisor rather than duplicate Git/test authority.
7. Support safe parallel work without agents manipulating unrelated dirty checkouts.
8. Make branch retirement and integration explicit and auditable.

## Non-goals

- Do not rewrite or clean published `main` history merely to improve agent context.
- Do not create permanent `world-spine`, `manuscript`, `narration`, or similar parent branches.
- Do not use branches as checkpoints or versions of the same task.
- Do not make a language model the authority for Git state, merge safety, or verification freshness.
- Do not force pull/rebase/clean unrelated user work to prepare a task.

## Branch model

All ordinary task branches originate from the intended integrated base, normally current `origin/main` at task start.

Product architecture appears in the branch namespace:

```text
main

feature/world-spine/unplaced-events-dock
feature/world-spine/location-row-delete
feature/world-spine/timeline-filtering

feature/manuscript/proofread-history
feature/manuscript/revision-panel
feature/manuscript/search

feature/narration/take-management
feature/narration/narration-follow
feature/narration/voice-conversion

fix/world-spine/location-row-overflow
fix/narration/take-playback

refactor/editor/state-slices
refactor/persistence/project-cache

harness/git/task-scoped-workflow
harness/codex/context-routing
```

For a large product pillar, one additional subsystem component is acceptable when it improves identity, for example `feature/manuscript/proofread/safe-reversal` or `feature/world-spine/locations/unplaced-events`. Avoid arbitrary depth.

### Work type prefixes

| Prefix | Purpose |
| --- | --- |
| `feature/` | Author-facing feature or behaviour addition |
| `fix/` | Defect/regression correction |
| `refactor/` | Structural change without intended product behaviour change |
| `harness/` | Developer/Codex/repository tooling |
| `docs/` | Documentation-only work intended to land independently |
| `review/` | Bounded review/audit work when a branch is genuinely required |
| `epic/` | Temporary integration branch for explicitly approved tightly coupled work only |

`tmp/`, `-copy`, `-final`, `-impl`, `-codex`, `-work`, and similar names must not become normal task lifecycle mechanisms. Commits represent iterations.

## Why not permanent domain parent branches

A tree such as `main -> world-spine -> locations -> feature` looks aligned with documentation but creates multiple integration truths. A long-lived World Spine branch can fall behind `main`, while Manuscript and Narration diverge from different states. Shared editor, persistence, schema, and service changes then create avoidable merge and dependency complexity.

Instead, use the same product vocabulary in branch names while keeping one normal integration truth:

```text
main
  -> feature/world-spine/...
  -> feature/manuscript/...
  -> feature/narration/...
```

Temporary epic branches are the exception and require an explicit dependency/integration reason.

## Task identity

Task identity should flow through design, Git, worktree, agent routing, tests, documentation, and finalisation.

Example:

```text
Product area: World Spine
Task: Unplaced Events Dock
Branch: feature/world-spine/unplaced-events-dock
Worktree: world-spine-unplaced-events-dock
Design: docs/architecture/world-spine-unplaced-events-dock.md
Agents: GitWorkflowAgent + WorldbuildingAgent + FeatureWorkAgent
Feature record: 6.3ae
Verification: World Spine focused/affected routes
```

A future local manifest can live under ignored `.tools/` state, for example:

```json
{
  "schemaVersion": 1,
  "taskId": "world-spine-unplaced-events-dock",
  "workType": "feature",
  "productArea": "world-spine",
  "branch": "feature/world-spine/unplaced-events-dock",
  "worktreeName": "world-spine-unplaced-events-dock",
  "baseRef": "origin/main",
  "baseSha": "<resolved-sha>",
  "designPath": "docs/architecture/world-spine-unplaced-events-dock.md",
  "approvedDesignSha": "<design-commit-sha>",
  "agentRoutes": [
    "agents/GitWorkflowAgent.md",
    "agents/WorldbuildingAgent.md",
    "agents/FeatureWorkAgent.md"
  ],
  "status": "ready"
}
```

`.tools/` is already ignored, so task manifests can remain local workflow state rather than durable product documentation.

## Design/spec workflow

The approved implementation design should become part of the same task identity rather than being used to make `main` a staging area.

Preferred sequence:

```text
ChatGPT/user approves task intent
-> establish canonical task branch/worktree
-> ChatGPT commits authoritative design spec to task branch
-> record approved design commit in task identity
-> Codex starts in that task worktree
-> Codex reads the spec locally and implements
```

This removes prompts such as:

```text
pull/sync latest main
verify commit X exists
if not, update origin/main
```

from ordinary Codex implementation work.

If a design already landed on `main`, the workflow may reference that SHA as an approved source, but feature setup should still use a dedicated task branch/worktree and should not require touching a dirty local `main` checkout.

Task-specific docs normally enter `main` when the task is integrated. Documentation intended to be independently authoritative before implementation can use a separate `docs/...` branch or explicit main update.

## Deterministic task-workflow manager

Add a small deterministic layer separate from the verification-focused supervisor, reusing its Git-state utilities rather than duplicating them.

Proposed location:

```text
tools/task-workflow/
  workflow.mjs
  task-state.mjs
  worktree-manager.mjs
```

Proposed package entry point:

```text
npm run work -- ...
```

The exact CLI should be implemented and tested before `GitWorkflowAgent.md` claims it exists. A likely shape is:

```text
npm run work -- start <task-id> --type feature --area world-spine --design <path>
npm run work -- status <task-id>
npm run work -- handoff <task-id>
```

### `start` responsibilities

A deterministic start operation should:

1. resolve the repository without asking a model to search for it;
2. `fetch` remote refs without modifying the user's local `main` checkout;
3. resolve the intended base ref/SHA, normally `origin/main`;
4. validate the task ID and canonical branch name;
5. detect an existing branch/worktree for that task;
6. create the branch only if no canonical branch exists;
7. create/reuse the dedicated worktree under the existing sibling worktree convention;
8. block on conflicting identity, unsafe reuse, or unresolved task state rather than creating aliases;
9. persist the local task manifest under `.tools/`;
10. collect compact Git state using existing deterministic utilities;
11. emit `READY` or `BLOCKED` output suitable for Codex/ChatGPT.

A `READY` handoff should be small:

```text
READY
task: world-spine-unplaced-events-dock
branch: feature/world-spine/unplaced-events-dock
worktree: .../ABetterNovelAuthoringEnvironment-worktrees/world-spine-unplaced-events-dock
base: origin/main@<sha>
design: docs/architecture/world-spine-unplaced-events-dock.md
approvedDesign: <sha>
agents: GitWorkflowAgent, WorldbuildingAgent, FeatureWorkAgent
```

Codex should not then rerun `git branch`, `git worktree list`, `git log`, `git merge-base`, or inspect unrelated branches merely to confirm facts the handoff has already validated.

## Supervisor relationship

Keep responsibilities separate:

```text
Task workflow manager
  = task identity + branch/worktree lifecycle + compact task handoff

Repository supervisor
  = changed-file authority + test selection + verification + freshness

Language model
  = architecture understanding + implementation + genuine failure diagnosis
```

The task manager should import/reuse deterministic Git-state functionality from the supervisor where practical. It should not add a second competing representation of branch/head/change state.

## Parallel work

Two independent tasks should look like:

```text
feature/world-spine/unplaced-events-dock
  -> worktree world-spine-unplaced-events-dock
  -> Codex session A

feature/manuscript/proofread-history
  -> worktree manuscript-proofread-history
  -> Codex session B
```

Neither session should need to inspect or manipulate the other's checkout. If both tasks heavily modify the same architectural hotspot, the workflow may still permit them, but the user should be warned that integration conflict cost can outweigh parallelism.

Cross-task dependencies must be explicit. Prefer integrating dependency A to `main` before starting B. If B must depend on unmerged A, record the dependency and intentionally base it on A or an approved temporary `epic/...` branch.

## Finalise, integrate, retire

Existing `finalise work` semantics should close and push the current task branch after verification. They should not implicitly merge to `main`.

A later deterministic lifecycle phase can add explicit operations such as:

```text
work verify/finalise
work integrate
work retire
```

Integration must verify task identity, current supervisor evidence, intended diff, and base/divergence state. Retirement must confirm integration or explicit abandonment before removing a worktree/branch.

Merge strategy (merge commit, squash, or another repository policy) should be decided explicitly during implementation of the integration command; do not rewrite shared `main` history as an optimization.

## Shared assistant contract

`agents/GitWorkflowAgent.md` is deliberately shared by Codex and ChatGPT.

- Codex uses it when task topology/destination changes and otherwise consumes deterministic task handoff.
- ChatGPT uses it before connected Git writes that create/select branches, place implementation specs, or integrate/retire work.
- Both assistants should prefer the same task identity and branch naming rather than inventing parallel conventions.

This lets task identity persist across the entire harness instead of being reconstructed from chat history.

## Implementation phases

### Phase 1 — policy and routing

- add `agents/GitWorkflowAgent.md`;
- route Git lifecycle/spec-placement work to it from root `AGENTS.md`;
- ensure `FinaliseWorkAgent.md` does not imply merge-to-main authority.

### Phase 2 — deterministic start/status/handoff

- implement task manifest;
- implement canonical branch/worktree resolution;
- reuse supervisor Git-state collection;
- emit compact `READY`/`BLOCKED` handoff;
- add focused tests for dirty-main isolation, existing task reuse, conflicting branch identity, stale base, and parallel worktree separation.

### Phase 3 — deterministic finalise/integrate/retire

- bind finalise to task identity and fresh supervisor evidence;
- add explicit integration operation;
- add safe retirement after integration/abandonment;
- benchmark Codex startup/context against the current manual Git-discovery workflow.

## Acceptance criteria

The refactor is successful when:

- normal feature/fix/refactor implementation does not occur directly on `main`;
- each active task has one canonical branch/worktree identity;
- product hierarchy is visible in branch names without permanent domain parent branches;
- ChatGPT can commit an approved task design directly to the canonical task branch;
- Codex can begin from a compact `READY` handoff without repository/Git archaeology;
- dirty unrelated `main` checkouts do not need to be pulled, reset, or fast-forwarded to prepare task work;
- parallel Codex tasks do not share worktrees;
- the repository supervisor remains the single deterministic verification authority;
- task branches are integrated and retired deliberately rather than accumulating ambiguous aliases;
- matched benchmarks show fewer Git discovery commands/context reads before first substantive implementation.
