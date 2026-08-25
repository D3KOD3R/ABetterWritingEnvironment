# Agent Refactor and Codex Context Audit

Last reviewed: 2026-08-25

## Purpose

This is the durable research/handoff record for reducing Codex context and usage in `D3KOD3R/ABetterWritingEnvironment`.

It exists so the agent-file refactor can be resumed from repository facts rather than reconstructed from chat history, and so the expected context savings are measured before and after implementation instead of assumed.

This document is research and measurement guidance, not a new universal instruction file. Codex should not preload it during ordinary feature work. It should be read when planning, implementing, or reviewing the agent/context refactor or when analysing context-consumption regressions.

---

## Historical / pre-refactor decision

The high-ROI context optimization was to replace the large root `AGENTS.md` with a small global router and scoped task/domain instructions.

The intended principle is:

> Load universal rules plus only the agent instructions relevant to the current task. Do not read unrelated agent files pre-emptively.

The refactor was required to preserve the special trigger workflows:

- `fix issues` → `voiceissues/VoiceIssuesAgent.md`
- `finalise work` → `finalisework/FinaliseWorkAgent.md`
- `retrace steps on task ...` → context-retrace workflow
- `Feature working` → feature documentation/update workflow
- `bench` → preserve underlying service/function behaviour while disabling the live entry point according to the existing rule

The refactor was documentation/instruction restructuring. It did not redesign application architecture while moving instructions.

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

## Why the pre-refactor root file was expensive

The pre-refactor root `AGENTS.md` combined material with very different scopes:

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

## Historical / pre-refactor proposed agent layout

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

## Historical / pre-refactor measurement plan

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
| 2026-08-25 | Final post-refactor matched benchmark / PASS | Read-only World Spine location-row deletion trace | `8ecdbce5b2e489fbe5893ca368067a8753197fc6` | GPT-5.6 Terra / Medium | 4,969 | 1,361 (`WorldbuildingAgent.md` only) | 0 | Not available | No | Completed in 1m 55s. Effective static instruction footprint: 6,330 bytes; approximately 82.2% reduction from the original root. Bounded-read quality retained. |

Do not populate an “Observed Codex usage” value from an estimate. If the client does not expose a comparable number, record `Not available` and rely on static read footprint plus behaviour metrics.

---

## Historical / pre-refactor research findings

1. The deterministic repository supervisor had already removed a major source of agent reasoning: changed-file discovery, test selection, test execution, and verification freshness can be decided locally.
2. The large root instruction file made instruction scoping the next obvious standing-context target.
3. `features.md`, `app.js`, the editor roadmap, the supervisor roadmap, and project-library data are large enough that **read discipline after the split is as important as the split itself**.
4. Existing special agent files prove the repository already uses a trigger/scoped-agent pattern, but root currently carries too much universal and domain-specific detail.
5. `FinaliseWorkAgent.md` and `agentContextRetrace.md` should be slimmed because they predate parts of the current supervisor workflow and can force redundant Git/diff/test investigation.
6. Do not ask a local LLM to become pass/fail or Git-state authority. Deterministic Node/Git remains authoritative; local AI is an advisory future layer for summarisation/triage.
7. The next platform step after instruction scoping is task-scoped finalisation so normal commit/push work no longer requires a fresh Codex reasoning cycle.

---

## Historical / pre-refactor implementation constraints

When the agent refactor was sent to Codex:

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

## Current refactor status and next step

The scoped-agent refactor is validated. External review corrections are applied and the final matched post-refactor benchmark passed. The representative read-only World Spine task loaded only `WorldbuildingAgent.md` beyond root and retained bounded-read quality.

Next context-efficiency investigation: measure task-generated context from bounded shell/search/tool output and source excerpts separately from standing instruction footprint. Do not implement that optimization as part of this refactor record.

Before sending an implementation prompt to Codex, use this file as the durable research record rather than reconstructing the design from prior chat.

Related sources:

- `docs/PROJECT-STATUS.md`
- `AGENTS.md`
- `agentContextRetrace.md`
- `finalisework/FinaliseWorkAgent.md`
- `voiceissues/VoiceIssuesAgent.md`
- `docs/architecture/test-harness-repo-supervisor-roadmap.md`
- `docs/architecture/editor-application-roadmap.md`

---

## Refactor implementation record

Implemented on 2026-08-25 at `cbb5530e4dff16a22802e32cf8bd59182da72210` (before the refactor working-tree changes). This was Markdown/instruction restructuring only; it did not change application, test, supervisor, or Codex configuration behaviour.

OpenAI's documented default 32 KiB project-instruction budget is an aggregate limit for automatically discovered instructions while walking from project root toward the working directory; it is not a per-file limit. The scoped files under `agents/` are intentionally explicit/on-demand files, not files named `AGENTS.md`, so they do not each join that automatic discovery budget.

### Final instruction structure

```text
AGENTS.md                         # universal router and special-trigger entry points
agents/
    FeatureWorkAgent.md            # feature workflow, Feature working, bench
    EditorAgent.md                 # editor shell, slices, host and projection boundaries
    PersistenceAgent.md            # project persistence semantics
    DomainSchemaAgent.md           # schemas, anchors, DTOs and contracts
    WorldbuildingAgent.md          # World Spine, templates, entities and suggestions
    AnalysisAgent.md               # diagnostics, analysis, extraction and suggestions
    AudioVoiceAgent.md             # narration, audio, voice and providers
    LocalAiAgent.md                # product Local AI only
    DesktopAgent.md                # desktop/Tauri integration and distribution
    TestSupervisorAgent.md         # supervisor routing and verification policy
    DocumentationAgent.md          # documentation ownership
agentContextRetrace.md             # compact recovery workflow
finalisework/FinaliseWorkAgent.md  # compact closeout workflow
voiceissues/VoiceIssuesAgent.md    # compact voice-issue workflow
```

Each normal domain task loads root plus the narrowest responsible agent. The root explicitly prohibits pre-emptive agent fan-out and routes by the responsibility being modified, not a dependency merely traversed. An author-facing feature implementation or behaviour change also loads `FeatureWorkAgent.md`; read-only navigation, inspection, or debugging does not. `FeatureWorkAgent.md` owns `Feature working` and `bench`; feature work does not automatically load `DocumentationAgent.md`.

### Initial post-refactor static measurements

These are exact filesystem bytes and lines, not token or credit measurements.

| File | Bytes | Lines |
| --- | ---: | ---: |
| `AGENTS.md` | 4,585 | 42 |
| `agents/AnalysisAgent.md` | 1,057 | 10 |
| `agents/AudioVoiceAgent.md` | 1,318 | 12 |
| `agents/DesktopAgent.md` | 764 | 9 |
| `agents/DocumentationAgent.md` | 1,146 | 11 |
| `agents/DomainSchemaAgent.md` | 1,182 | 11 |
| `agents/EditorAgent.md` | 1,694 | 13 |
| `agents/FeatureWorkAgent.md` | 2,068 | 17 |
| `agents/LocalAiAgent.md` | 838 | 10 |
| `agents/PersistenceAgent.md` | 1,353 | 14 |
| `agents/TestSupervisorAgent.md` | 1,327 | 13 |
| `agents/WorldbuildingAgent.md` | 1,361 | 13 |
| `agentContextRetrace.md` | 2,200 | 27 |
| `finalisework/FinaliseWorkAgent.md` | 2,268 | 19 |
| `voiceissues/VoiceIssuesAgent.md` | 1,899 | 18 |

Root size changed from 35,487 bytes to 4,585 bytes: a reduction of 30,902 bytes (87.08%). Expected single-domain static footprints are 5,946 bytes for World Spine (root + `WorldbuildingAgent.md`), 5,938 bytes for persistence (root + `PersistenceAgent.md`), and 5,903 bytes for narration (root + `AudioVoiceAgent.md`).

### Decisions and ambiguities

- The root is 4,585 bytes, within the preferred 4–6 KiB range and safely below the 8 KiB maximum.
- The existing `fix issues`, `finalise work`, `retrace steps on task ...`, `Feature working`, and `bench` trigger names and user-facing guarantees are retained. Their workflows now begin from supervisor/Git facts and conditional relevant reads instead of forced broad investigation.
- No proposed scoped agent was redundant. Existing broad architecture/product explanations remain in their owning documents and are referenced only when relevant.
- The matched post-refactor benchmark is intentionally not recorded here: it must run in a fresh Codex thread with the matched prompt/model/reasoning configuration. No Codex usage metric is claimed from these static measurements.

### External review corrections

External review of the initial scoped-agent commit found and corrected a feature-work routing gap, missing analysis and desktop responsibilities, dropped styling and searchable-combobox safeguards, and moving EditorAgent checkpoint duplication. The correction makes author-facing implementation changes load `FeatureWorkAgent.md` alongside the narrow domain agent, keeps read-only navigation scoped to its domain agent, adds explicit `AnalysisAgent.md` and `DesktopAgent.md`, restores the editor safeguards, and keeps current roadmap status solely in architecture documentation.

---

## Post-refactor benchmark v1

This historical benchmark ran at `45dc7be767d0559edfd9c822bd6be8e02ef22e0c` with GPT-5.6 Terra / Medium and completed in 2m 08s.

Instruction files intentionally opened:

- `AGENTS.md`: 4,585 bytes
- `agents/WorldbuildingAgent.md`: 1,361 bytes
- `agents/TestSupervisorAgent.md`: 1,327 bytes

Specialised agents intentionally opened were `WorldbuildingAgent.md` and `TestSupervisorAgent.md`. `features.md` and `app.js` were not broadly read; no architecture roadmap or context compaction/retrace was read. The observed exact Codex token/credit metric was not available.

Point-in-time observations at completion: Codex context indicator was 99,493 used / 258K, and the seven-day allowance snapshot was 66% remaining. These are not measured task token consumption or task allowance usage; no matched before-task allowance value is available.

Finding: the scoped-agent architecture preserved good bounded-read behaviour and substantially reduced static instruction footprint, but the benchmark exposed unnecessary `TestSupervisorAgent.md` fan-out when merely identifying existing relevant tests. Root routing was subsequently tightened; another fresh matched benchmark is required before acceptance.

---

## Final post-refactor matched benchmark / PASS

This final matched benchmark ran in a fresh GPT-5.6 Terra / Medium thread at `8ecdbce5b2e489fbe5893ca368067a8753197fc6` and completed in 1m 55s.

- Root `AGENTS.md`: 4,969 bytes.
- The only specialised instruction file opened was `agents/WorldbuildingAgent.md` at 1,361 bytes.
- Effective read-only World Spine static instruction footprint: 6,330 bytes, approximately 82.2% below the 35,487-byte pre-refactor root.
- `features.md`, `app.js`, and architecture roadmaps were not broadly read; source reads were bounded; no context compaction or retrace occurred.
- Exact Codex token/credit measurement was not available.

The point-in-time context indicator (113,694 used / 258K) and seven-day allowance snapshot (65% remaining) are not measured task consumption: no matched pre-task snapshot was captured. The scoped-agent/standing-context problem is substantially improved; task-generated context from searches, command output, source excerpts, and tool responses remains a separate future measurement opportunity. This validates the scoped-agent refactor without claiming token or credit savings beyond the documented static footprint.
