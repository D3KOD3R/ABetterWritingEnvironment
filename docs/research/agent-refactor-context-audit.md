# Agent Refactor and Codex Context Audit

Last reviewed: 2026-08-25

## Purpose

This is the durable research/handoff record for reducing Codex context and usage in `D3KOD3R/ABetterWritingEnvironment`.

It exists so the agent-file refactor can be resumed from repository facts rather than reconstructed from chat history, and so the expected context savings are measured before and after implementation instead of assumed.

This document is research and measurement guidance, not a new universal instruction file. Codex should not preload it during ordinary feature work. It should be read when planning, implementing, or reviewing the agent/context refactor or when analysing context-consumption regressions.

---

## Current decision

The next high-ROI context optimization is to replace the large root `AGENTS.md` with a small global router and scoped task/domain instructions.

The intended principle is:

> Load universal rules plus only the agent instructions relevant to the current task. Do not read unrelated agent files pre-emptively.

The refactor must preserve the special trigger workflows:

- `fix issues` → `voiceissues/VoiceIssuesAgent.md`
- `finalise work` → `finalisework/FinaliseWorkAgent.md`
- `retrace steps on task ...` → context-retrace workflow
- `Feature working` → feature documentation/update workflow
- `bench` → preserve underlying service/function behaviour while disabling the live entry point according to the existing rule

The refactor is documentation/instruction restructuring. It must not redesign application architecture while moving instructions.

---

## Pre-refactor static context baseline

Repository metadata on 2026-08-25 gives these exact file sizes on `main`:

| File | Bytes | Why it matters |
| --- | ---: | --- |
| `AGENTS.md` | 35,487 | Root standing instruction burden. This is the primary refactor target. |
| `agentContextRetrace.md` | 9,178 | Special recovery workflow; currently contains duplicated architecture/repository inspection guidance. |
| `finalisework/FinaliseWorkAgent.md` | 7,960 | Closeout workflow; currently repeats broad Git/docs/test inspection responsibilities. |
| `voiceissues/VoiceIssuesAgent.md` | 4,493 | Special voice-issue workflow; should remain scoped and trigger-loaded. |
| `features.md` | 757,058 | Detailed feature source of truth. Extremely expensive if read broadly; should be searched/read by relevant section, not preloaded. |
| `docs/architecture/editor-application-roadmap.md` | 64,935 | Detailed architecture source; should be loaded only for relevant editor architecture/refactor work. |
| `docs/architecture/test-harness-repo-supervisor-roadmap.md` | 59,672 | Supervisor design source; should be loaded only when changing supervisor architecture/routing policy. |
| `apps/editor/public/app.js` | 931,911 | Large source file; should be searched/read by bounded region or diff rather than read wholesale. |
| `apps/editor/public/serva-vitae-project-library.js` | 964,378 | Large generated/project-library-like source; avoid broad reads unless directly relevant. |

### Important limitation

Byte count is a stable repository metric, **not the same thing as model input tokens or Codex credits**. Tokenization depends on content and model/runtime behaviour. Therefore the audit keeps two classes of measurement separate:

1. **Static context footprint** — exact bytes/characters/lines of instruction and source material intentionally loaded.
2. **Observed Codex usage** — any usage/token/credit/context metrics exposed by the Codex client or account during a matched benchmark task.

Do not fabricate an exact token saving by dividing bytes by a constant and calling it measured usage. Approximate token estimates may be used as secondary diagnostics only and must be labelled estimates.

---

## Why the current root file is expensive

The current root `AGENTS.md` combines material with very different scopes:

- universal repository safety/work rules;
- token-efficiency rules;
- special command routing;
- feature-documentation workflow;
- all major product pillars;
- editor ownership and architecture;
- persistence rules;
- current editor-refactor checkpoint;
- service ownership for analysis/audio/voice/world/local AI;
- domain/schema guidance;
- detailed feature-specific architecture and implementation direction.

A small task can therefore begin with instructions for several unrelated subsystems. This is standing context: it can be paid before the agent has learned whether those instructions matter to the task.

The root also points at other large sources of truth. If the agent responds to uncertainty by broadly opening `features.md`, the editor roadmap, the supervisor roadmap, or `app.js`, the context cost expands quickly.

---

## Proposed agent layout

Target structure (exact names may be refined during implementation while preserving responsibility boundaries):

```text
AGENTS.md                         # small universal router

agents/
    FeatureWorkAgent.md
    EditorAgent.md
    PersistenceAgent.md
    DomainSchemaAgent.md
    WorldbuildingAgent.md
    AudioVoiceAgent.md
    LocalAiAgent.md
    TestSupervisorAgent.md
    DocumentationAgent.md

finalisework/
    FinaliseWorkAgent.md

voiceissues/
    VoiceIssuesAgent.md

agentContextRetrace.md            # keep trigger compatibility; slim heavily
```

### Root `AGENTS.md` should retain only universal rules

Keep root concise and limited to rules that genuinely apply to almost every task:

- preserve unrelated user work;
- make the smallest coherent change;
- keep routine narration terse;
- prefer targeted/diff/bounded reads;
- use the deterministic repo supervisor before broad manual test/log exploration;
- do not add dependencies without justification;
- preserve local-first/service-boundary architectural principles at a high level;
- route the task to only the relevant scoped agent file(s);
- preserve special command triggers;
- **do not read unrelated agent files pre-emptively.**

Detailed implementation checkpoints and subsystem rules belong in scoped agent or architecture files, not root.

### Scoped responsibilities

- `FeatureWorkAgent.md` — feature workflow, `features.md`, Feature Implementation Index, `Feature working`, `bench`, author-facing documentation discipline.
- `EditorAgent.md` — `apps/editor` ownership, thin `app.js`, feature/state/adapter/shared/host placement and editor-boundary rules.
- `PersistenceAgent.md` — `ProjectPersistenceService`, save/load/autosave/import/export, project-file source of truth, browser-cache compatibility rules.
- `DomainSchemaAgent.md` — schema/packages/shared contracts, IDs, anchors, domain DTOs, cross-package contracts.
- `WorldbuildingAgent.md` — World Spine/worldbuilding/templates/entities/timeline mutation and suggestion-review rules.
- `AudioVoiceAgent.md` — audio, narration, recording, ASR/alignment, TTS/RVC/provider boundaries.
- `LocalAiAgent.md` — **product local AI only** (`services/local-ai`, editor local-AI features); explicitly distinguish this from developer repo-supervisor/Ollama tooling.
- `TestSupervisorAgent.md` — focused-test registration/group/routing policy; FAST/AFFECTED/FULL; compact evidence; full roadmap only for supervisor architecture changes.
- `DocumentationAgent.md` — documentation ownership and source-of-truth discipline; keep small.

### Separation rule

```text
AGENT FILE       = what Codex must do / must not do
ARCHITECTURE DOC = how the subsystem is designed
PRODUCT DOC      = what the feature should accomplish
```

Do not copy long architecture explanations into agent files. Point to the relevant architecture source and load the relevant section only when needed.

---

## Measurement plan

The refactor should be evaluated with **matched tasks**, not impressions.

### Phase A — capture pre-refactor benchmark

Before changing `AGENTS.md`, run a small set of representative Codex tasks against the current instruction layout. Prefer read-only/navigation tasks so the same prompts can be repeated after the refactor without changing product state.

Recommended benchmark set:

1. **World Spine navigation task**
   - Prompt: locate the render → handler → canonical state → persistence → tests path for deleting a World Spine location row.
   - Constraint: inspect only; do not modify files.

2. **Persistence navigation task**
   - Prompt: locate the save path for one existing project preference from UI mutation through `ProjectPersistenceService` into durable project state.
   - Constraint: inspect only.

3. **Narration navigation task**
   - Prompt: locate the execution path for deleting an existing saved narration take, from UI action through media deletion and persistence.
   - Constraint: inspect only.

4. **Supervisor navigation task**
   - Prompt: explain which routing rule and test group a specified focused source path selects.
   - Constraint: inspect only.

Use the **same Codex model, reasoning setting, repository state, and prompt wording** for pre/post comparison wherever practical.

### Phase B — record per-run observations

For each benchmark, record the following when observable:

| Metric | Description |
| --- | --- |
| Model/reasoning | Keep matched across pre/post runs. |
| Start commit | Exact `HEAD` so repository drift is visible. |
| Task category | world / persistence / narration / supervisor / other. |
| Root instruction bytes | Exact size of root `AGENTS.md`. |
| Scoped agent bytes intentionally loaded | Sum of relevant scoped agent files after refactor. Pre-refactor normally 0 beyond existing trigger workflows. |
| Docs/source files opened | Record paths. |
| Approx bytes intentionally read | Use file/range sizes where available; this is a deterministic proxy, not model tokens. |
| Large-file broad reads | Count reads of `features.md`, `app.js`, large roadmap/project files that were not constrained to a useful section/diff. |
| Test/report output exposed to Codex | Compact report vs full output/log. |
| Context compaction event | Yes/no, if visible. |
| Retrace/re-read event | Yes/no; note what was reread. |
| Codex usage/token/credit metric | Record exact value only if the client/account exposes it. Preserve the unit exactly as shown. |
| Wall time | Optional; useful for workflow efficiency but not a token metric. |
| Result quality | Did it identify the correct files/flow without missing required rules? |

### Phase C — post-refactor matched benchmark

Repeat the same prompts against the refactored agent layout.

Compare:

- root instruction size;
- root + relevant scoped-agent size;
- number and size of instruction/docs/source reads;
- unnecessary agent-file reads;
- unnecessary `features.md`/roadmap/`app.js` reads;
- supervisor compact-report usage;
- observed Codex usage metric when available;
- compaction/retrace frequency;
- correctness/quality.

### Success criteria

The refactor is successful when:

- root `AGENTS.md` becomes a small router rather than an architecture encyclopedia;
- a normal task loads root + one or a small number of relevant scoped agents;
- unrelated agent files are not read pre-emptively;
- broad `features.md`, `app.js`, and architecture-roadmap reads decrease;
- supervisor handoff/compact output is consumed before full logs or broad test exploration;
- special trigger behaviours still work;
- matched task correctness is unchanged or better;
- observed Codex usage is lower on matched tasks when a comparable usage metric is available.

A reduction in static bytes alone is not sufficient if Codex compensates by opening several unrelated agent/docs files.

---

## Context-loss / token-leak watchlist

After the split, watch for these failure modes:

### 1. Agent-file fan-out

Bad pattern:

```text
read root
read EditorAgent
read PersistenceAgent
read WorldbuildingAgent
read DomainSchemaAgent
read DocumentationAgent
... just in case
```

This recreates the original monolith through multiple reads.

Required rule: do not read unrelated agent files pre-emptively. Start with the narrowest task scope and expand only when the work crosses a real boundary.

### 2. `features.md` broad reads

`features.md` is very large. Use exact feature headings, search results, implementation-index entries, or bounded sections. Do not read the entire file to update one feature.

### 3. `app.js` broad reads

`apps/editor/public/app.js` is very large. Prefer:

1. diff/handoff;
2. symbol/text search;
3. bounded surrounding region;
4. relevant extracted feature module;
5. broad read only as a last resort.

### 4. Architecture roadmap preload

Detailed roadmaps are reference material, not standing instructions. Load only the relevant section when architecture work requires it.

### 5. Repeated Git/test discovery

Use the repository supervisor rather than repeatedly asking Codex to reconstruct changed files, relevant tests, and verification freshness.

Preferred evidence ladder:

```text
supervisor handoff
→ compact report
→ failure excerpt (if needed)
→ relevant diff
→ relevant source/test region
→ full log / broad source only as last resort
```

### 6. Finalise-work re-investigation

Current finalise guidance still asks Codex to perform several repository-inspection steps that deterministic tooling can increasingly supply. After the agent split, the next platform step is task-scoped deterministic finalise/commit/push so a completed task does not cause Codex to reconstruct the repository again.

### 7. Context retrace over-reading

The existing retrace document tells the agent to inspect broad Git diff, untracked files, docs/schema/services/editor code/tests. The supervisor now provides a safer compact starting point. Slim retrace so it expands only from evidence relevant to the interrupted task.

### 8. Duplicate rules

If the same rule appears in root plus several scoped agents, it consumes context and creates drift risk. Universal rule → root only. Domain rule → owning scoped agent only. Detailed rationale → architecture doc only.

---

## Benchmark log

Add rows rather than rewriting prior measurements. Preserve raw units as observed.

| Date | Phase | Task | HEAD | Model/reasoning | Root bytes | Scoped-agent bytes | Large broad reads | Observed Codex usage | Compaction/retrace | Result notes |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 2026-08-25 | Baseline-static | Repository instruction inventory | `bc5d72f1042f9f040ef6397c0f7054f5c89bd868` before tracker commits | n/a | 35,487 | 0 | n/a | Not measured | n/a | Static repository baseline captured before agent refactor. |

Do not populate an “Observed Codex usage” value from an estimate. If the client does not expose a comparable number, record `Not available` and rely on static read footprint plus behaviour metrics.

---

## Current research findings

1. The deterministic repository supervisor has already removed a major source of agent reasoning: changed-file discovery, test selection, test execution, and verification freshness can be decided locally.
2. The current root instruction file is still large enough that instruction scoping is the next obvious standing-context target.
3. `features.md`, `app.js`, the editor roadmap, the supervisor roadmap, and project-library data are large enough that **read discipline after the split is as important as the split itself**.
4. Existing special agent files prove the repository already uses a trigger/scoped-agent pattern, but root currently carries too much universal and domain-specific detail.
5. `FinaliseWorkAgent.md` and `agentContextRetrace.md` should be slimmed because they predate parts of the current supervisor workflow and can force redundant Git/diff/test investigation.
6. Do not ask a local LLM to become pass/fail or Git-state authority. Deterministic Node/Git remains authoritative; local AI is an advisory future layer for summarisation/triage.
7. The next platform step after instruction scoping is task-scoped finalisation so normal commit/push work no longer requires a fresh Codex reasoning cycle.

---

## Implementation constraints for the upcoming refactor

When the agent refactor is sent to Codex:

- read this document and the current root/special agent files first;
- inspect architecture docs only as needed to place existing rules correctly;
- **move/refactor instructions; do not change application behaviour**;
- preserve special command semantics exactly unless a documented contradiction is found;
- do not duplicate long architecture prose into scoped agents;
- keep root aggressively small;
- add a clear routing matrix based on task intent/path;
- require no pre-emptive loading of unrelated agents;
- preserve supervisor-first testing/evidence behaviour;
- make agent-only Markdown changes documentation-only for supervisor routing;
- do not modify the two minor supervisor-backlog items as part of this refactor;
- record the post-refactor exact file sizes in this audit;
- run matched benchmark tasks after the refactor before claiming token/context improvement.

---

## Known supervisor backlog — not part of the agent refactor

Two minor regression-coverage improvements were identified during supervisor review but are deliberately not blockers:

- stale-state regression test currently proves same-path **untracked** content change; later add an explicit tracked-already-modified same-path edit case;
- compact CLI JSON behaviour could later receive direct automated shape assertions.

Do not broaden the agent refactor into another supervisor implementation phase for these items.

---

## Handoff to the next planning/implementation session

Current sequence:

```text
1. Capture pre-refactor matched Codex benchmark runs if an observable usage comparison is desired.
2. Implement scoped agent refactor.
3. Record exact post-refactor instruction sizes.
4. Repeat matched benchmark tasks.
5. Review context leaks/fan-out and tidy routing if needed.
6. Implement task-scoped deterministic finalise/commit/push.
7. Return focus to product work while maintaining the tracker.
```

Before sending an implementation prompt to Codex, use this file as the durable research record rather than reconstructing the design from prior chat.

Related sources:

- `docs/PROJECT-STATUS.md`
- `AGENTS.md`
- `agentContextRetrace.md`
- `finalisework/FinaliseWorkAgent.md`
- `voiceissues/VoiceIssuesAgent.md`
- `docs/architecture/test-harness-repo-supervisor-roadmap.md`
- `docs/architecture/editor-application-roadmap.md`
