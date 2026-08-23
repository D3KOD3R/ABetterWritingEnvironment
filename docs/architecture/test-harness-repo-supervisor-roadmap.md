# Test Harness & Local Repo Supervisor Roadmap
## Codex implementation specification for ABetterWritingEnvironment

**Document status:** Approved architecture/developer-tooling roadmap for Codex implementation.
**Repository:** `D3KOD3R/ABetterWritingEnvironment`
**Verified baseline branch:** `main`
**Verified baseline commit at time of authoring:** `b4774feae856e7c1b19edbc6a3e6a490ed961853` — `Implement authoring, narration, and world spine workflows`
**Recommended canonical repository path:** `docs/architecture/test-harness-repo-supervisor-roadmap.md`

> Before implementation, Codex must verify the current local repository state and current `main`. The baseline commit above records what this roadmap was reviewed against; it is not permission to reset, discard, or overwrite newer work.

---

# 0. Codex Start Here

This file is intentionally detailed so Codex does not need to rediscover the objective or invent policy while implementing it.

### Interpretation priority and scope control

This roadmap is a **one-time implementation specification**, not a document that routine future Codex tasks should be required to reread in full. Its size is acceptable for the build/refactor task, but making it mandatory day-to-day context would undermine the token-efficiency objective.

After the deterministic supervisor is working:

- routine Codex instructions should live as a very small command/policy summary in `AGENTS.md` and `finalisework/FinaliseWorkAgent.md`;
- ordinary feature work should call the stable supervisor CLI rather than reread this roadmap;
- this roadmap remains architecture/history/reference for changing the supervisor itself;
- do not add a standing instruction that every Codex task must read this entire file.

When requirements in this document vary in importance, use this priority:

1. preserve correctness and existing test coverage;
2. preserve user work and Git safety;
3. preserve `npm test` compatibility;
4. make deterministic test selection/reporting reliable;
5. reduce Codex context/output;
6. add optional convenience or sophistication only when it provides clear value.

**Prefer the minimum architecture that satisfies the acceptance criteria.** Do not build generic infrastructure merely because the roadmap describes a future possibility.

## 0.1 First actions

Before editing:

1. Read root `AGENTS.md`.
2. Read `finalisework/FinaliseWorkAgent.md`.
3. Read this roadmap.
4. Inspect:
   - `package.json`;
   - `test/run-tests.mjs`;
   - `test/test-harness-registration.test.mjs`;
   - `test/application-syntax-smoke.test.mjs`;
   - `.gitignore`;
   - `Run Tests.bat`.
5. Inspect enough representative test files to confirm the current export convention before designing dynamic discovery.
6. Inspect the actual current repo tree before creating files. Reuse existing conventions where appropriate.
7. Run the existing `npm test` once before refactoring and record the baseline pass/fail result locally. Do not paste the full successful output into the final response.
8. Do not modify application/product behaviour as part of this task unless a narrow testability boundary genuinely requires it.

## 0.2 Primary objective

Reduce Codex token consumption and repetitive developer-agent work by moving deterministic Git inspection, test selection, test execution, logging, and compact reporting into local Node.js tooling.

The desired long-term flow is:

```text
ChatGPT
  ↓
planning / architecture / scoped implementation request
  ↓
Codex
  ↓
source-code changes
  ↓
Local Node Repo Supervisor
  ├─ collect Git facts
  ├─ determine changed files
  ├─ route affected test groups
  ├─ run changed-file syntax checks
  ├─ run targeted tests
  ├─ preserve detailed output locally
  └─ produce a compact authoritative report
        ↓
Optional Local Ollama Agent
  ├─ read failure evidence only when useful
  ├─ read the relevant diff
  ├─ read a bounded set of relevant files
  └─ produce separate advisory analysis
        ↓
Compact handoff to Codex
```

## 0.3 First implementation boundary

**This first implementation is deterministic only.**

Build:

- improved test harness;
- test discovery/registry;
- stable test IDs;
- a small, maintainable set of test groups sufficient for current routing;
- changed-file routing;
- FAST / AFFECTED / FULL verification, implemented with the simplest rules that are trustworthy;
- Node repo-supervisor CLI;
- compact JSON reporting;
- detailed local logs;
- Git-state reporting;
- compact Codex handoff.

**Do not integrate Ollama yet.**
**Do not automate merge-to-main yet.**
**Do not add autonomous code editing to the supervisor.**

---

# 1. Repository Facts This Roadmap Was Reviewed Against

Codex should verify these facts still hold before relying on them.

## 1.1 Runtime and scripts

At the reviewed baseline:

```json
{
  "type": "module",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "desktop": "node --experimental-strip-types apps/desktop/server.mjs",
    "test": "node --experimental-strip-types test/run-tests.mjs"
  }
}
```

Use Node >=24 and ESM. Do not add Python or another runtime merely for the supervisor.

## 1.2 Current test harness behaviour

`test/run-tests.mjs` currently:

- manually imports a large number of `*.test.mjs` files;
- keeps a central array of `{ name, run }` test descriptors;
- executes test cases **sequentially**;
- awaits each runner;
- prints `ok - ...` for every successful test;
- prints a stack for failures;
- accumulates failures rather than stopping after the first;
- exits non-zero when one or more tests fail.

Preserve the important behavioural semantics during the migration.

**Do not introduce parallel test execution in this task.**

Parallelism is a separate performance optimization and could expose shared-state assumptions unrelated to this roadmap.

## 1.3 Current registration guard

`test/test-harness-registration.test.mjs` currently verifies that every `test/*.test.mjs` file is:

- manually imported by `run-tests.mjs`; and
- present in the executed test-case array.

Replace this monolithic-registration assumption, but preserve the important guarantee:

> a new test file must not silently become orphaned.

## 1.4 Current broad syntax guard

`test/application-syntax-smoke.test.mjs` currently recursively checks JavaScript/TypeScript source under:

```text
apps/
services/
packages/
```

using Node parse checks.

Keep this broad smoke test available for FULL verification.

For FAST verification, do **not** invoke a repository-wide syntax walk merely to validate a small change. The supervisor should syntax-check only changed relevant `.js`, `.mjs`, and `.ts` files.

## 1.5 Existing ignored developer-output locations

At the reviewed baseline, `.gitignore` includes:

```text
.tools/
.tmp/
*.log
```

Use `.tools/` for supervisor reports, logs, caches, and local-AI material.

Do not commit generated supervisor output.

## 1.6 Existing Windows workflow

The repository contains `Run Tests.bat`, which executes `npm test` and propagates its exit code.

Preserve this one-click workflow by keeping `npm test` as the canonical full-suite contract.

Do not create many new `.bat` launchers unless the user later asks for them.

## 1.7 Existing product local-AI architecture

The application already contains:

```text
services/local-ai/
```

including product-side router/provider/model-library concepts.

The developer repo supervisor is a **different concern**.

For this roadmap:

```text
services/local-ai/
    = product runtime AI

tools/repo-supervisor/
    = developer tooling
```

Do not couple the future Ollama repo-review agent into product runtime local-AI services merely because local-AI abstractions already exist.

A deliberate future consolidation may be discussed later, but it is not part of this task.

## 1.8 Large files and AI context

The reviewed repo contains very large files, including a very large `apps/editor/public/app.js`, a very large project-library JavaScript file, and large project data.

The future local AI and Codex handoff mechanisms must not automatically feed giant files wholesale into an LLM merely because they changed or appear in a stack trace.

Prefer:

- diff hunks;
- referenced functions/regions;
- bounded source excerpts;
- directly relevant modules;
- explicit escalation when broader context is actually required.

The deterministic supervisor itself may inspect file metadata and paths without loading full file contents.

## 1.9 Main-branch safety

At the reviewed baseline, GitHub `main` is not protected by required status checks.

Therefore this roadmap intentionally defers autonomous merge-to-main.

A future phase should consider GitHub branch protection / required CI checks as a second safety layer in addition to local deterministic gates.


## 1.10 Git worktrees are part of the current development workflow

The repository already contains a dedicated Manuscript Shell worktree launcher and `scripts/launch-worktree.bat`.

Therefore the supervisor must work correctly from both:

- the primary checkout; and
- linked Git worktrees.

Use Git to discover repository/worktree facts.

Prefer:

```text
git rev-parse --show-toplevel
git rev-parse --git-dir
git rev-parse --is-inside-work-tree
```

Do **not** assume:

```text
<repo>/.git/
```

is a physical directory. In linked worktrees `.git` may be a file that points at worktree metadata.

Reports should be written under the current worktree's repository root `.tools/` location unless a later explicit design introduces a shared report store.

The report should include enough identity to avoid confusing runs from multiple worktrees, for example:

```text
worktreeRoot
branch
headSha
runId
```

Do not inspect or modify sibling worktrees merely because they exist.

## 1.11 No package dependency installation is expected

The current supervisor/test-harness work should be achievable with Node built-ins and existing repository code.

Prefer not to add production or development dependencies.

Do not run `npm install` or generate/change a lockfile merely to implement:

- CLI parsing;
- glob-like route matching;
- process execution;
- JSON reporting;
- Git state collection.

If a dependency would materially simplify or harden the implementation, Codex should first explain:

- package;
- purpose;
- why Node built-ins are insufficient;
- runtime/development-only scope;
- maintenance cost.

Do not introduce a dependency silently.

## 1.12 Documentation, assets, and non-executable changes require explicit policy

Not every changed file should force tests, but every changed file must be classified.

Routing should distinguish at least:

```text
executable/source
test/tooling
configuration/contract
documentation
static asset
generated/ignored
unknown
```

A **known documentation-only** change may legitimately require no unit tests if the routing policy explicitly says so.

A **known static-asset-only** change may require no unit tests or a small relevant smoke group depending on the asset.

This is different from an **unknown** path.

The supervisor may report a successful no-test-required result only when:

- every changed path matched an explicit non-test-required rule; and
- no syntax/static check applies.

Example authoritative reason:

```json
{
  "status": "passed",
  "verificationLevel": "fast",
  "tests": {
    "selected": 0,
    "passed": 0,
    "failed": 0
  },
  "noTestsReason": "All changed files are documentation-only and matched explicit documentation routing rules."
}
```

Unknown paths must still broaden or block conservatively.

## 1.13 Large project data and binary/static assets are not default AI context

Files such as project JSON, images, audio, binary media, document files, and large generated/static assets may appear in Git state.

The supervisor should classify them without reading their full contents unless required for a deterministic check.

The future Ollama context builder must not blindly include:

- binary files;
- audio;
- images;
- `.docx`;
- large project JSON;
- large generated data.

It should instead report path, type, size, and relevance, and request explicit higher-level handling if content analysis is actually needed.

---

# 2. Core Principles

## 2.1 Deterministic facts remain deterministic

Git, Node, test runners, and supervisor rules are authoritative for:

- command success/failure;
- test pass/fail;
- process exit codes;
- changed files;
- staged/unstaged/untracked files;
- branch state;
- merge conflicts;
- ahead/behind state;
- syntax-check results;
- selected routes;
- verification level;
- whether a deterministic escalation rule fired.

An LLM must never override these facts.

## 2.2 Local AI is advisory

The future Ollama agent may:

- summarise failed-test logs;
- correlate failures with diffs;
- suggest likely cause;
- suggest likely files/functions;
- summarise a diff;
- identify possible architecture-risk areas;
- suggest concise commit messages;
- prepare a compact human/Codex handoff.

AI output must be clearly marked advisory.

## 2.3 Minimise cloud-agent context

Codex should not need to read:

- every passing-test line;
- full successful logs;
- unrelated subsystem tests;
- repeated `git status` output;
- giant unchanged files;
- large raw stack/log collections when a compact local report already exists.

## 2.4 Preserve full verification

Efficiency must not weaken merge confidence.

`npm test` remains the canonical full-suite entry point unless a later approved architecture change deliberately changes that contract.

## 2.5 Fail conservative

If routing cannot confidently determine the affected area:

- do not silently run nothing;
- do not pretend targeted verification is sufficient;
- broaden the affected groups or escalate to FULL;
- report the escalation reason.

## 2.6 No hidden destructive behaviour

The initial supervisor is read-only with respect to Git history and tracked source.

It may create ignored `.tools/` output.

It must not:

- reset;
- checkout over user work;
- clean untracked files;
- amend commits;
- commit;
- push;
- merge;
- rebase;
- force-update refs.

Those capabilities belong to later explicitly approved phases.

---

# 3. Target Architecture

Prefer a small number of auditable modules.

Conceptually:

```text
test/
  run-tests.mjs
  test-registry.mjs
  test-groups.mjs
  test-runner-core.mjs
  test-harness-registration.test.mjs
  *.test.mjs

tools/
  repo-supervisor/
    supervisor.mjs
    git-state.mjs
    changed-files.mjs
    routing-config.mjs
    test-selection.mjs
    test-execution.mjs
    syntax-check.mjs
    report-writer.mjs
    handoff.mjs
```

Exact filenames are not mandatory.

Do not create layers merely to match this diagram. Prefer a smaller implementation if it remains clear and testable.

The architectural boundary is:

```text
repository facts
  ↓
deterministic routing
  ↓
deterministic checks
  ↓
authoritative report
  ↓
optional AI enrichment later
```

---

# 4. Test Discovery and Stable IDs

## 4.1 Avoid rewriting every existing test

The current suite appears to use one exported `run...Test` function per focused test module.

Codex must inspect representative files and verify this assumption.

If it holds broadly, prefer adapting the harness around the existing export convention rather than editing 100+ test files just to attach metadata.

## 4.2 Preferred stable ID

Prefer the test filename, without `.test.mjs`, as the stable ID.

Examples:

```text
test/manuscript-projection-selector.test.mjs
→ manuscript-projection-selector

test/project-persistence-service.test.mjs
→ project-persistence-service
```

Reasons:

- stable;
- already unique by filesystem;
- understandable to humans;
- no duplicate metadata;
- useful in CLI/report paths;
- avoids mass test rewrites.

If filename collisions or exceptions exist, handle them explicitly and document them.

## 4.3 Discovery rules

The preferred low-maintenance approach is filesystem discovery, but **dynamic discovery is not an absolute requirement** if repository evidence shows that a small explicit registry is safer or materially simpler. The important properties are stable IDs, no orphan tests, targeted loading/execution, and low maintenance.

If filesystem discovery is used, it should:

1. enumerate `test/*.test.mjs` files according to the current suite scope;
2. normalize paths consistently;
3. derive a stable ID;
4. dynamically import only the modules needed for the requested run where practical;
5. locate the expected exported runner;
6. validate exactly what constitutes a runnable module;
7. reject ambiguous/missing runner exports with a configuration/infrastructure error.

On Windows, use correct path and URL utilities such as `pathToFileURL`; do not concatenate `file://` URLs manually.

Do not load every test module merely to execute one targeted test unless validation genuinely requires it. The targeted path should itself remain targeted.

## 4.4 Preserve legacy descriptions only if useful

The current harness contains long human-readable descriptions.

Stable IDs are more important than preserving those strings.

If retaining descriptions is useful:

- migrate them into one optional descriptor map; or
- support an optional exported display name only where needed.

Do not require a mass edit solely to preserve prose labels.

## 4.5 Registration guard replacement

Redesign `test-harness-registration.test.mjs` so it verifies:

- every in-scope `*.test.mjs` file is discoverable;
- each file resolves to one valid stable ID;
- IDs are unique;
- each runnable module exposes a valid runner;
- group configuration references valid IDs/groups;
- routing configuration references valid groups;
- no selected test can be silently dropped;
- discovery order is deterministic.

The registration test itself must not create recursion or attempt to re-run the entire suite while validating discovery.

---

# 5. Preserve Sequential Execution Semantics

The current suite executes tests sequentially in one Node process.

The new core runner should preserve that default in the first implementation.

For a selected test list:

```text
for selected test in deterministic order:
    await test
    record result
continue after failure
```

Do not:

- parallelize;
- shard;
- introduce worker threads;
- reorder unpredictably;
- stop after first failure by default.

Preserve **sequential semantics**, but do not spend significant effort reproducing the exact legacy central-array ordering unless the baseline shows order dependence. A deterministic filename/registry order is acceptable if the full suite remains green. If changing order reveals hidden coupling, treat that as evidence and either preserve legacy order for now or report the coupling.

A future performance phase may benchmark safe parallelism independently.

---

# 6. Test Groups

## 6.1 Purpose

Groups are architectural routing units, not just filename categories.

Likely group concepts based on the current repo include manuscript/editor, narration/voice/audio, persistence/project-state, desktop, local-ai, language tools (spellcheck/dictionary/draft proofing), worldbuilding/world-spine, and shared schemas/contracts.

These are **concepts, not a requirement to create 15 separate groups**. Start coarse enough to be maintainable and safe. Split a group only when doing so creates a meaningful reduction in routine test work without making routing fragile.

Codex should derive the smallest useful final group set from the actual current tests and source tree.

## 6.2 Group definitions

A group should resolve to stable test IDs using a maintainable mechanism such as:

- test-ID prefixes where reliable;
- explicit include arrays for exceptions;
- composition/dependency references.

Avoid duplicating every test ID across multiple giant lists if patterns can express the relationship safely.

## 6.3 AFFECTED expansion

AFFECTED mode needs a way to broaden beyond direct tests, but do **not** build a generic dependency-graph engine unless current repository evidence justifies one.

Prefer the simplest trustworthy option, for example:

- a route can select multiple groups directly;
- a group can declare a small explicit `alsoRun` list; or
- known cross-cutting paths can escalate directly to FULL.

Example concept only:

```text
manuscript-schema/**
  → manuscript + persistence + analysis
  → optionally FULL if this is safer during the first routing version
```

The first implementation should be conservative rather than trying to model every transitive code dependency. Telemetry from real runs can justify finer dependency modelling later.

## 6.4 Validate group/routing configuration

Configuration validation must detect what the chosen design actually supports, including at minimum:

- unknown groups;
- invalid test IDs;
- invalid expansion references;
- empty groups that should not be empty.

Only add cycle detection if the chosen configuration structure can actually form cycles.

---

# 7. Changed-File Collection

This part must cover local work, not only committed branch differences.

## 7.1 Changed-file universe

For normal development routing, create the union of:

1. committed branch changes relative to the chosen base/merge-base;
2. staged changes;
3. unstaged tracked changes;
4. untracked non-ignored files.

Use Git plumbing/porcelain commands deterministically.

Conceptually:

```text
committed relative changes
UNION
git diff --cached --name-only
UNION
git diff --name-only
UNION
git ls-files --others --exclude-standard
```

Deduplicate and sort deterministically.

## 7.2 Base semantics

Support an explicit base ref:

```bash
npm run repo -- test --changed --base main
```

For branch comparison, resolve an appropriate merge-base rather than assuming local `main` and HEAD have a simple relationship.

Do not automatically perform destructive reconciliation.

Network refresh should be explicit if implemented, for example:

```text
--refresh-remote
```

A normal local test command should not unexpectedly fetch/pull/push.

## 7.3 Working on `main`

If HEAD is already on `main`, changed-file routing must still work from staged/unstaged/untracked local changes.

Do not return an empty selection merely because `main...HEAD` has no committed diff.

## 7.4 Rename/delete handling

Where feasible, preserve enough Git status information to distinguish:

- added;
- modified;
- deleted;
- renamed.

Deleted/renamed source files can still require tests.

## 7.5 Normalize paths

Convert internal routing paths to repository-relative forward-slash form:

```text
apps/editor/public/...
```

even on Windows.


## 7.6 Respect Git worktree boundaries

Changed-file discovery must operate on the current worktree only.

Do not:

- scan sibling worktree directories manually;
- assume the parent folder layout;
- compare filesystem timestamps across worktrees;
- derive repository state from `.git` filesystem structure.

Use Git commands from the current worktree root.

## 7.7 Do not route ignored generated output

Files excluded by Git through normal ignore rules, including supervisor output under `.tools/`, must not be treated as changed application inputs.

Use Git's own ignored/untracked semantics instead of recursively scanning the filesystem for "new" files.

## 7.8 Submodule/symlink handling

If the repository later contains symlinks or submodules, do not follow them recursively as ordinary source directories without an explicit routing policy.

For the first implementation:

- treat Git-reported paths as path records;
- do not recursively traverse symlink targets for routing;
- if an unsupported special path type affects verification, report `blocked` or conservatively escalate rather than guessing.

---

# 8. Routing Configuration

Prefer:

```text
source path
  ↓
group(s)
  ↓
direct tests
  ↓
dependent groups
  ↓
verification level/escalation
```

Example shape:

```js
{
  pattern: "services/voice/**",
  groups: ["voice"]
}
```

Cross-cutting example:

```js
{
  pattern: "packages/shared-types/**",
  groups: ["schemas-contracts"],
  fullSuite: true,
  reason: "Shared cross-service contracts changed"
}
```

Use actual repo paths.

## 8.1 Conservative baseline rules

At minimum, think explicitly about routing for:

- `apps/editor/public/features/**`;
- `apps/editor/public/adapters/**`;
- `apps/editor/public/shared/**`;
- `apps/editor/public/shell/**`;
- `apps/editor/public/spellcheck/**`;
- `apps/editor/public/spellcheck.js`;
- `apps/editor/public/editor-model.js`;
- `apps/editor/public/app.js`;
- `apps/desktop/**`;
- `services/analysis/**`;
- `services/audio/**`;
- `services/local-ai/**`;
- `services/voice/**`;
- `packages/**`;
- `test/**`;
- `tools/repo-supervisor/**`;
- `package.json`.

## 8.2 Monolithic/cross-cutting files

`apps/editor/public/app.js` is currently very large and cross-cutting.

For the first implementation, route changes to highly cross-cutting files conservatively.

It is acceptable for `app.js` changes to trigger broad AFFECTED verification or FULL while the dependency model is immature.

Do not optimize away safety based on guesses.

Later telemetry can justify finer routing.

## 8.3 Test-infrastructure changes

Changes to:

```text
test/run-tests.mjs
test/test-registry*
test/test-groups*
test/test-runner*
test/test-harness-registration.test.mjs
tools/repo-supervisor/**
routing configuration
package.json test/supervisor scripts
```

must trigger broad supervisor self-verification and usually FULL.

The tool must test itself.

## 8.4 Unknown route

Unknown relevant source path:

```text
UNKNOWN
→ conservative escalation
→ report reason
```

Never:

```text
UNKNOWN
→ zero tests
→ pass
```

---

# 9. Verification Levels

## 9.1 FAST

Purpose: normal Codex edit/iterate cycle.

Run:

1. changed-file syntax checks for relevant `.js`, `.mjs`, `.ts`;
2. directly routed tests.

Avoid:

- repository-wide syntax scan;
- unrelated groups;
- full successful logs in Codex output.

## 9.2 AFFECTED

Purpose: completed feature/subsystem verification.

Run:

1. changed-file syntax checks;
2. direct groups;
3. configured dependent groups.

## 9.3 FULL

Purpose: canonical high-confidence verification.

Run:

- canonical complete test suite;
- broad syntax smoke as part of the suite where currently registered;
- all registration/supervisor contract tests.

Triggers include:

- explicit `--level full`;
- full-suite routing rule;
- shared/cross-cutting contracts;
- test infrastructure changes;
- uncertain routing that cannot be safely broadened another way;
- merge/finalisation policy where required.

## 9.4 Commands

Target UX:

```bash
npm test
npm run repo -- status
npm run repo -- test --name manuscript-projection-selector
npm run repo -- test --group narration
npm run repo -- test --level fast
npm run repo -- test --level affected
npm run repo -- test --level full
npm run repo -- test --changed
npm run repo -- test --changed --base main
npm run repo -- handoff
```

Do not create dozens of npm scripts.

A likely package addition is one stable entry point such as:

```json
"repo": "node --experimental-strip-types tools/repo-supervisor/supervisor.mjs"
```

If the supervisor is pure `.mjs` and needs no TypeScript stripping itself, use the simplest valid Node command.

---

# 10. Syntax Checking

## 10.1 FAST/AFFECTED

For changed relevant files:

```text
.js / .mjs
→ node --check

.ts
→ node --experimental-strip-types --check
```

Use the runtime's actual supported invocation and verify it on Node >=24.

## 10.2 FULL

Retain `application-syntax-smoke.test.mjs` or equivalent broad coverage.

Do not remove broad syntax coverage merely because targeted checks now exist.

## 10.3 Deleted files

Do not attempt syntax checking on deleted files.

Their deletion may still route tests.

---

# 11. Local Repo Supervisor

## 11.1 Definition

The supervisor is a deterministic Node CLI, not an AI agent.

It coordinates:

- Git commands;
- routing;
- syntax checks;
- test commands;
- local logs;
- report generation.

## 11.2 Command execution safety

Use `spawn`/`spawnSync` or equivalent with argument arrays.

Prefer:

```text
shell: false
```

Do not construct shell command strings from untrusted file paths or user arguments.

Validate CLI enums/refs/IDs before use where practical.

## 11.3 CWD

The supervisor must resolve and operate from repository root reliably even when invoked from a subdirectory where practical, or clearly require repo-root invocation and validate it.

Do not depend accidentally on the current shell being a particular directory.

## 11.4 Interrupts

Handle interruption cleanly enough that:

- child processes are not knowingly left running;
- partial report files are not presented as valid complete reports;
- the next run can proceed.

Do not over-engineer process management beyond the needs of this repository.

---

# 12. Git State Contract

`npm run repo -- status --json` should be able to report facts such as:

```json
{
  "schemaVersion": 1,
  "branch": "feature/example",
  "headSha": "abc123",
  "baseRef": "main",
  "mergeBaseSha": "def456",
  "ahead": 3,
  "behind": 0,
  "clean": false,
  "conflicts": false,
  "staged": [],
  "unstaged": [
    "apps/editor/public/example.js"
  ],
  "untracked": [
    "test/example.test.mjs"
  ]
}
```

If ahead/behind cannot be meaningfully resolved for the chosen base, report that fact rather than inventing a number.

If ahead/behind is calculated from a local remote-tracking ref such as `origin/main`, do not imply that it is freshly synchronized with GitHub unless the command explicitly fetched. A normal read-only test/status command should not perform network operations unexpectedly. Report remote-tracking freshness as unknown/local-cache where relevant.

---

# 13. Test Execution Contract


## 13.0 Add a no-execution planning mode

Add a cheap selection-only command so Codex, the user, or future tooling can ask:

```text
What would you test for these changes?
```

without actually running tests.

Suggested UX:

```bash
npm run repo -- plan
npm run repo -- plan --base main
npm run repo -- plan --json
```

or an equivalent `test --dry-run` design.

The plan result should include:

```text
changed files
classification
direct groups
broadened/AFFECTED groups
selected test IDs
syntax files
verification level
full-suite escalation
selection reasons
```

This is useful for:

- auditing routing;
- debugging incorrect group selection;
- measuring expected test scope;
- allowing Codex to understand verification without first consuming test output.

Do not make planning invoke test modules or run syntax checks.

For each selected test capture at least:

```text
id
status
durationMs
failure summary if failed
```

The runner must preserve deterministic order.

Do not print every pass to agent-facing compact output.

Human interactive full-suite output may remain readable, but add a quiet/machine mode suitable for the supervisor.

---

# 14. Report Storage

Do not rely only on one overwritable log.

Prefer per-run storage:

```text
.tools/
  reports/
    <run-id>/
      report.json
      full.log
      selection.json
    latest.json
```

Optionally later:

```text
    latest-ai.json
```


## 14.0 Report freshness and identity

Every authoritative report must identify the repository state it describes.

Include:

```text
runId
worktreeRoot
branch
headSha
baseRef / mergeBase where applicable
startedAt
completedAt
```

A consumer must be able to tell when a report is stale.

`npm run repo -- handoff` should not silently present an old report as if it reflects the current working tree.

At minimum, compare the report's recorded Git identity/state with current state and either:

- generate a fresh report; or
- clearly mark the handoff stale/blocked.

Do not let `latest.json` become an accidental source of stale truth.

## 14.1 Run ID

Use a Windows-safe run ID.

Avoid characters such as `:` in folder names.

A timestamp plus short random/monotonic component is acceptable.

## 14.2 `latest.json`

`latest.json` may be:

- a compact copy of the newest authoritative report; or
- a small pointer record to the newest run.

Choose the simpler robust approach.

## 14.3 Atomic report writes

Write structured report files atomically where practical:

```text
write temporary file
→ rename/replace completed file
```

Do not leave a half-written JSON file that another agent could mistake for a valid completed result.


## 14.4 Report retention

Do not let report retention become a distraction from the core supervisor.

For the first implementation it is sufficient to document that reports are disposable local artifacts and optionally provide a very small bounded cleanup policy if trivial to implement. Automatic retention is **not a release blocker** for the deterministic foundation.

Any cleanup that is implemented must affect only `.tools/reports/` owned by the supervisor and must never use broad filesystem deletion commands.

## 14.5 Log sensitivity

Developer logs may contain:

- local filesystem paths;
- manuscript/project names;
- test fixtures;
- environment details;
- error payloads.

Treat `.tools/reports/` as local developer data.

Do not:

- commit reports;
- upload them automatically;
- include environment variables wholesale;
- print secrets/tokens if a child process exposes them;
- send full logs to a future Ollama/cloud model by default.

If command environment details are recorded, use an allowlist rather than dumping `process.env`.

Phase 1 does not need secret scanning, but it should avoid obviously collecting unnecessary secrets.

---


# 15. Authoritative Report Schema

Use a versioned schema from the start.

The implementation should have one canonical report-normalization/validation path so the JSON written to disk, printed in machine mode, and consumed by `handoff` cannot silently drift into different shapes.

Do not introduce a heavyweight schema library solely for this. A small internal validator/assertion layer is sufficient.

Add focused tests proving:

- required top-level fields are present;
- invalid status values are rejected;
- failure records have required identifiers/messages;
- a report written by the runner can be read by the handoff code;
- a future unknown `schemaVersion` is not silently interpreted as the current one.


Suggested shape:

```json
{
  "schemaVersion": 1,
  "runId": "20260823T201300-8f31",
  "status": "failed",
  "verificationLevel": "fast",
  "baseRef": "main",
  "headSha": "abc123",
  "changedFiles": [
    {
      "path": "apps/editor/public/features/manuscript/example.js",
      "changeType": "modified"
    }
  ],
  "affectedGroups": [
    "manuscript"
  ],
  "selectionReasons": [
    {
      "group": "manuscript",
      "rule": "apps/editor/public/features/manuscript/**",
      "reason": "Source path matched manuscript routing rule"
    }
  ],
  "syntax": {
    "checked": 2,
    "passed": 2,
    "failed": 0
  },
  "tests": {
    "selected": 8,
    "passed": 7,
    "failed": 1,
    "durationMs": 4821
  },
  "failures": [
    {
      "testId": "manuscript-projection-selector",
      "kind": "test",
      "message": "Expected diagnostic projection count 3, received 2"
    }
  ],
  "fullSuiteRequired": false,
  "escalationReasons": [],
  "artifacts": {
    "fullLog": ".tools/reports/20260823T201300-8f31/full.log",
    "selection": ".tools/reports/20260823T201300-8f31/selection.json"
  }
}
```

## 15.1 Status vocabulary

Keep status machine-readable and small.

Recommended top-level states:

```text
passed
failed
blocked
```

Where:

- `passed` = requested deterministic verification completed and passed;
- `failed` = verification completed and one or more checks/tests failed;
- `blocked` = infrastructure/config/Git state prevented a trustworthy verification run.

Do not report `passed` when routing was unknown and nothing meaningful ran.

---

# 16. Exit Codes

Define a stable CLI exit contract.

Recommended:

```text
0 = requested operation completed successfully / verification passed
1 = verification completed but checks/tests failed
2 = blocked by configuration, Git, routing, infrastructure, or internal supervisor error
3 = invalid CLI usage
```

If Codex chooses a different small contract, document it and test it.

Do not return zero for a blocked or failed verification.


## 16.1 Process timeout policy

The current tests may not have explicit per-test timeouts. Do not introduce aggressive arbitrary timeouts that create false failures.

However, the supervisor must not be designed such that a child process can hang forever with no control surface.

For Phase 1, timeout plumbing is optional unless the implementation already needs long-lived child-process control. Do not expand the task substantially just to add timeouts. If a timeout mechanism is implemented:

- make it configurable/optional;
- default to preserving current test behaviour unless a known hang risk exists;
- record timeout as a `blocked`/infrastructure-style failure distinct from an assertion failure;
- terminate the owned child process cleanly where possible.

Do not classify a timeout as a normal test assertion failure.

---

# 17. Full Log Rules

`full.log` may contain:

- commands run;
- stdout/stderr;
- stack traces;
- per-test details;
- timing;
- infrastructure diagnostics.

Do not automatically send it to Codex.

A passing run's compact report should usually be enough.

A failing run can point to the full log.

---

# 18. Selection Report

Keep routing explainable.

Example:

```json
{
  "schemaVersion": 1,
  "changedPaths": [
    "apps/editor/public/features/manuscript-editor/projection-selector.js"
  ],
  "directGroups": [
    "manuscript"
  ],
  "dependentGroups": [],
  "selectedTests": [
    "manuscript-projection-selector",
    "manuscript-selection-controller"
  ],
  "fullSuiteRequired": false,
  "reasons": [
    {
      "path": "apps/editor/public/features/manuscript-editor/projection-selector.js",
      "matchedRule": "apps/editor/public/features/manuscript-editor/**",
      "groups": ["manuscript"]
    }
  ]
}
```

This is for auditing routing, not for verbose normal chat output.

---

# 19. Future Ollama Boundary — Design Now, Integrate Later

The deterministic implementation must work when:

- Ollama is not installed;
- Ollama is stopped;
- no local model is available.

Future Ollama analysis should consume existing artifacts rather than becoming embedded in test execution.

Desired future flow:

```text
authoritative report
+ failed-test log excerpt/full log locally
+ Git diff
+ bounded relevant source context
  ↓
Ollama
  ↓
separate advisory report
```

---

# 20. Future `latest-ai.json`

Keep AI analysis separate.

Suggested shape:

```json
{
  "schemaVersion": 1,
  "sourceRunId": "20260823T201300-8f31",
  "model": "local-model-name",
  "risk": "medium",
  "summary": "One manuscript projection regression appears related to filtering order.",
  "likelyCause": "Accepted IssueRecord filtering may occur before projection normalization.",
  "suggestedFiles": [
    "apps/editor/public/features/manuscript-editor/projection-selector.js"
  ],
  "confidence": 0.82
}
```

The AI file must never change authoritative:

```text
status
test result
syntax result
Git facts
```

---

# 21. Future Local-AI Context Budget

Do not automatically send entire giant files or the whole repo to Ollama.

Prefer this priority:

1. authoritative failure record;
2. relevant failure stack;
3. Git diff hunks;
4. changed files implicated by the failure;
5. directly imported/dependent source when needed;
6. bounded surrounding source excerpts;
7. broader file only if the local model genuinely requires it.

For very large files, use:

- diff hunks;
- line/function windows;
- symbol-targeted extraction.

Record what context was supplied so diagnosis can be audited later.

---

# 22. Codex Handoff Contract

`npm run repo -- handoff` should produce a compact result intended to be directly consumed by Codex.

## Codex evidence ladder

The handoff should make it obvious how much context Codex should read next.

Default evidence order:

```text
1. handoff summary
2. authoritative report
3. concise failure record / relevant stack excerpt
4. relevant diff
5. implicated source/test file regions
6. full.log only if the earlier evidence is insufficient
```

Do not tell Codex to open `full.log` automatically for every failure.

This evidence ladder is part of the token-saving design: deeper context should be pulled only when the smaller evidence layer cannot establish the cause.


For deterministic-only phase:

```json
{
  "schemaVersion": 1,
  "runId": "20260823T201300-8f31",
  "taskStatus": "blocked",
  "verificationLevel": "fast",
  "summary": "One affected manuscript test failed.",
  "failedTests": [
    "manuscript-projection-selector"
  ],
  "requestedAction": "Investigate the failing manuscript projection test only.",
  "authoritativeReport": ".tools/reports/20260823T201300-8f31/report.json",
  "fullLog": ".tools/reports/20260823T201300-8f31/full.log"
}
```

Later it can include explicitly labelled AI advice.

Do not make the handoff reproduce the full log.

---

# 23. Efficiency Metrics

Record enough metrics to evaluate whether the system is actually reducing agent context.

Where practical, also record the **planned versus executed** scope:

```text
testsPlanned
testsExecuted
verificationEscalated
initialLevel
finalLevel
```

This helps identify whether routing is too conservative and constantly escalates to FULL, which would indicate the supervisor is technically correct but not delivering the intended efficiency benefit.



Do not optimize only for number of tests skipped.

Also preserve a small audit trail of **why** a narrower test set was considered sufficient. Token efficiency is only valuable if confidence remains explainable.


Suggested:

```text
changedFileCount
directGroupCount
dependentGroupCount
testsSelected
testsPassed
testsFailed
syntaxFilesChecked
rawLogBytes or characters
compactReportBytes or characters
fullSuiteRequired
fullSuiteAvoided
verificationLevel
durationMs
```

Future:

```text
localAiUsed
localAiInputBytes
localAiOutputBytes
```

These are efficiency proxies.

Do not claim exact cloud-token savings from them unless actual Codex usage data is available.

---

# 24. Supervisor Self-Tests

Add focused tests for the new tooling.


Supervisor tests must not depend on the user's real branch history or mutate the user's real working tree.

Prefer temporary fixture repositories created under an ignored/temp location for Git integration cases when mocks are insufficient.

If creating temporary Git fixture repos:

- initialize them locally;
- set test-local author identity if commits are needed;
- do not add remotes;
- delete only the fixture directory created by the test;
- keep tests deterministic across Windows paths.


At minimum test:

- stable ID discovery;
- duplicate/invalid runner detection;
- group expansion;
- group dependency expansion;
- unknown group rejection;
- changed-file union logic;
- path normalization;
- untracked-file inclusion;
- routing match;
- unknown-route escalation;
- full-suite escalation;
- deleted-file behaviour;
- syntax-selection behaviour;
- compact report schema;
- atomic report completion behaviour where practical;
- exit-code mapping;
- handoff generation.

Mock/stub Git/process execution where appropriate rather than mutating the real repository in unit tests.

Keep a small integration test for actual local Git behaviour only if it can be made isolated and reliable.

---

# 25. CLI Parsing and Validation

Do not add a large CLI framework unless needed.

A small parser is sufficient.

Validate:

- command;
- verification level;
- test ID;
- group;
- base ref input;
- incompatible flag combinations.

Unknown flags should fail clearly instead of being silently ignored.

---

# 26. Error Handling

## 26.1 Unknown routing

Result:

```text
blocked or escalated
```

not:

```text
pass with zero tests
```

## 26.2 Invalid test registry

Fail before running a misleading subset.

## 26.3 Child command cannot start

Return `blocked`, retain diagnostic output, exit non-zero.

## 26.4 Test failure

Return `failed`, preserve log, continue remaining selected tests unless current compatibility rules require otherwise.

## 26.5 Git unavailable/not repository

Return `blocked`.

## 26.6 Base ref missing

Report it clearly and use only an explicitly documented fallback if safe. Do not guess silently.

## 26.7 Report write failure

Do not claim success if the requested machine-readable report could not be written.

---

# 27. Output Modes

Support at least two use cases.

## Human mode

Readable terminal summary.

Example:

```text
FAST verification
Changed: 4 files
Groups: manuscript
Syntax: 3/3 passed
Tests: 8/8 passed
Report: .tools/reports/.../report.json
```

## Machine/quiet mode

Machine output must be easy for another process or agent to consume without parsing decorative terminal prose.

If `--json` is supported:

- stdout should contain valid JSON only;
- routine status/progress text should not be mixed into stdout;
- infrastructure diagnostics may go to stderr;
- JSON shape should remain stable under the declared `schemaVersion`;
- exit code remains authoritative even when JSON is emitted.

If output is written to a report file instead, stdout may contain only the report path or one small machine-readable envelope.

Avoid hundreds of `ok - ...` lines when invoked by the supervisor/Codex.

Exact flags are Codex's design choice, for example:

```text
--json
--quiet
```

Keep them stable once introduced.

Also provide concise `--help` output for the stable supervisor interface. Codex should not need to inspect source merely to rediscover supported commands and flags.

---

# 28. No Test Parallelism Yet

This deserves explicit repetition.

Do not attempt to save runtime by parallelizing tests in this task.

First achieve:

- correct discovery;
- correct routing;
- correct compact reporting;
- stable deterministic execution.

Parallelization can later be benchmarked after identifying tests with shared state/files/global mutations.

---

# 29. No Test Framework Migration Yet

Do not migrate the project to Jest, Vitest, Mocha, Node's native test runner, or another framework as part of this task unless the current custom architecture makes the roadmap impossible.

The goal is efficiency, not framework churn.

Prefer adapting the current focused exported-runner pattern.

If Codex believes framework migration is essential, stop and report:

- why;
- expected benefit;
- migration cost;
- number of files affected;
- risk.

Do not perform it silently.

---

# 30. Large-File Guardrails

The supervisor and future Ollama adapter should distinguish:

```text
file changed
```

from:

```text
entire file must be placed in model context
```

They are not the same.

Introduce a future-ready context policy such as:

- configurable maximum full-file size;
- diff-first handling;
- symbol/window extraction for oversized files;
- explicit note when context was truncated.

Do not implement complex source-symbol parsing in Phase 1 unless needed for the deterministic supervisor.

---

# 31. Documentation Updates

Once commands actually exist:

## Root `AGENTS.md`

Update token-efficiency guidance so Codex prefers supervisor commands instead of manually repeating Git/test exploration.

Do not duplicate the entire roadmap into `AGENTS.md`.

Keep root instructions concise and point to the canonical architecture document where necessary.

Do **not** instruct Codex to read the full roadmap during routine feature work. The routine rule should be operational, for example: use `npm run repo -- test --changed`/the implemented equivalent, consume the compact report, and open the roadmap only when modifying supervisor architecture or when routing behaviour itself is in question.

## `finalisework/FinaliseWorkAgent.md`

Change verification from the current unconditional tendency toward `npm test` for JS behaviour to the new staged policy:

```text
collect Git state
→ AFFECTED verification
→ FULL when routing/merge policy requires it
```

During migration, preserve safety.

Do not weaken finalisation if the supervisor is incomplete.

## `README.md`

Do not update unless the supervisor becomes a user/developer-visible setup workflow that genuinely belongs in the public entry point.

## Feature docs

This is developer tooling, not an author-facing product feature.

Do not invent a numbered author feature solely for this roadmap unless existing project rules clearly require developer infrastructure to be indexed there.

If AGENTS rules create ambiguity, preserve the product feature tracker and document the tooling in architecture docs instead.

---

# 32. Canonical Roadmap Placement

The user has explicitly approved creation of this recurring architecture roadmap.

Place the final reviewed version at:

```text
docs/architecture/test-harness-repo-supervisor-roadmap.md
```

unless the current repo already contains a more appropriate canonical testing architecture file.

If a conflicting existing document exists:

- do not create duplicate sources of truth;
- merge/update the appropriate existing document instead;
- report the decision.

This file may remain detailed as the implementation/architecture record. Do not create a second equally detailed operational manual. Day-to-day usage belongs in concise agent instructions and CLI `--help`.

---

# 33. Implementation Sequence

Codex should implement in this order.

## Scope discipline during implementation

This is a broad refactor, but the desired result is small tooling. Keep each step independently verifiable and avoid opportunistic cleanup of unrelated tests/application code.

If an optional requirement (retention, timeout support, sophisticated dependency expansion, extra human UI) begins to dominate the task, defer it and complete the core deterministic path first.

The core path that must work is:

```text
existing tests
→ stable targeted selection
→ changed-file routing
→ FAST/AFFECTED/FULL
→ compact authoritative report
→ handoff
```

## Step 1 — Baseline

- existing `npm test`;
- record result;
- inspect test export conventions.

## Step 2 — Extract reusable runner/discovery

- preserve full suite;
- preserve sequential order;
- stable IDs;
- no routing yet required to prove extraction.

Run full suite.

## Step 3 — Add named/group selection

Prove:

```text
one named test
one group
full suite
```

## Step 4 — Add supervisor Git-state collection

Read-only.

Test with staged/unstaged/untracked fixtures/mocks.

## Step 5 — Add changed-file routing

Implement path normalization, group mapping, the minimum AFFECTED expansion rules justified by the repo, and conservative unknown handling.

## Step 6 — Add FAST/AFFECTED/FULL

Keep full suite canonical.

## Step 7 — Add compact report/log artifacts

Versioned schema and stable exit codes.

## Step 8 — Add handoff

Deterministic only.

## Step 9 — Update AGENTS/finalise-work instructions

Only after the commands they reference actually work.

## Step 10 — Final verification

Run acceptance matrix below.

Do not integrate Ollama in any of these steps.

---

# 34. Acceptance Matrix

Codex must demonstrate each case.

Include one **plan/dry-run** example that proves routing can be inspected without importing/running the selected tests, and one machine-output example proving `--json` (or its equivalent) emits parseable JSON without human decoration mixed into stdout.



In addition to the matrix below, validate one run from a linked Git worktree if the local development environment has the existing worktree available. If it is not available, cover worktree root discovery with a fixture/integration test and report that limitation rather than creating or modifying a user worktree.


| Case | Expected result |
|---|---|
| Existing `npm test` | Complete canonical suite executes |
| Named test | Only requested focused test executes |
| Group test | Selected group executes |
| FAST changed source | Changed-file syntax + direct tests |
| AFFECTED changed source | Direct + dependent groups |
| FULL | Complete suite |
| Untracked new source/test | Included in changed-file universe |
| Staged-only change | Included |
| Unstaged-only change | Included |
| Committed branch change | Included relative to merge-base |
| Deleted source file | Routes tests without syntax-checking missing file |
| Unknown relevant path | Conservative escalation, never false pass |
| Shared/cross-cutting path | FULL escalation where configured |
| Test harness change | Broad/full self-verification |
| Passing compact report | Small authoritative JSON |
| Failing report | Non-zero + concise failure + full local log |
| Invalid registry | Blocked/non-zero |
| Invalid CLI | Non-zero, clear usage error |
| Git unavailable/invalid repo | Blocked/non-zero |
| Windows path | Normalized and routes correctly |
| `Run Tests.bat` | Continues to work through `npm test` |
| Plan/dry-run | Shows intended routing without executing tests |
| Machine JSON | stdout is parseable JSON only, with stable schema/version |
| `--help` | Concisely documents stable commands without source inspection |
| Generated `.tools` output | Remains ignored/untracked |
| Documentation-only explicit route | Zero tests allowed with explicit `noTestsReason` |
| Unknown path | Never treated as documentation-only by default |
| Linked worktree | Repo root/Git state resolved correctly without assuming `.git` directory |
| Stale latest report | Detected/refreshed or clearly marked stale |
| Report retention (if implemented) | Cleanup affects only supervisor-owned report directory |
| Timeout (if implemented) | Distinguished from assertion failure and exits non-zero |

---

# 35. Required Demonstration Outputs

At completion, Codex should provide concise evidence for:

1. baseline full suite;
2. final full suite;
3. one named test;
4. one group;
5. FAST routing example;
6. AFFECTED routing example;
7. FULL escalation example;
8. staged/unstaged/untracked changed-file handling;
9. compact passing report;
10. compact failing report;
11. full-log artifact path;
12. status JSON;
13. handoff JSON;
14. final `git status --short`.

Do not paste giant logs.

If any acceptance item could not be completed, say exactly which and why.

---

# 36. Future Phase — Ollama Agent

Only after this deterministic foundation is merged and reviewed should a new task implement Ollama.

The next phase should decide:

- selected Ollama model;
- Ollama endpoint/config;
- timeout/retry behaviour;
- input context budget;
- log filtering;
- diff extraction;
- source excerpt selection;
- advisory JSON schema validation;
- fallback when Ollama is unavailable;
- local-agent benchmark cases.

The deterministic supervisor must remain fully functional without Ollama.

---

# 37. Future Phase — Git Finalisation

After local-AI diagnosis is trusted, add advisory finalisation:

```text
status
diff summary
test report
commit-message suggestion
ready/blocked assessment
```

AI remains advisory.

---

# 38. Future Phase — Guarded Git Writes

Only with explicit user approval, later add:

```text
commit
push current branch
```

behind deterministic gates.

Do not infer this approval from approval of the test supervisor.

---

# 39. Future Phase — Merge to Main

Merge-to-main is the final automation phase.

Before considering it:

- supervisor has been used successfully across normal work;
- test routing has been measured;
- local-AI analysis has been benchmarked;
- deterministic finalisation has proven reliable;
- remote-main refresh/divergence handling is designed;
- branch protection/required checks are considered.

A future merge gate should require, at minimum:

```text
expected working-tree state
latest known remote-main state
understood merge-base
no unresolved conflicts
required verification passed
no forced update
no AI override of a deterministic failure
```

An AI may recommend `READY`, but deterministic rules authorize the operation.

---

# 40. Non-Goals for This First Task

Do not:

- integrate Ollama;
- use product `services/local-ai` as the repo-supervisor agent;
- migrate test frameworks;
- parallelize tests;
- rewrite all existing tests for metadata;
- add CI unless needed to validate the local architecture;
- add merge-to-main automation;
- add autonomous Git writes;
- modify product behaviour;
- create dozens of npm scripts;
- create numerous `.bat` launchers;
- add a database;
- add a queue/job system;
- build a generic multi-agent framework;
- send whole giant source/data files to a model by default;
- install new npm dependencies without a demonstrated need;
- inspect or alter sibling Git worktrees;
- dump environment variables or secrets into reports;
- treat documentation-only rules and unknown-path rules as the same thing;
- build a generic dependency-graph engine without evidence it is needed;
- make this full roadmap mandatory context for routine future Codex tasks.

---

# 41. Codex Decision Rules

Codex may make normal implementation choices without asking if they preserve this specification.

Codex should stop and report rather than silently diverge if it discovers:

1. current tests cannot be dynamically discovered without a mass rewrite;
2. tests depend materially on the exact existing central-array order;
3. targeted tests are unsafe due to hidden global/setup dependencies;
4. a test framework migration appears necessary;
5. application architecture must be changed substantially;
6. `npm test` compatibility cannot be preserved;
7. Git routing cannot safely include local uncommitted work;
8. the requested report contract conflicts with an existing source of truth.

For minor naming/layout choices, choose the simplest repo-native solution and continue.

---

# 42. Codex Final Response Contract

At the end of implementation, do not narrate the entire work session.

Return:

```text
Architecture
- ...

Commands
- ...

Files
- added:
- changed:

Verification
- full:
- named:
- group:
- fast:
- affected:
- escalation:
- reporting:

Deferred
- Ollama integration
- Git write automation
- merge-to-main automation

Decisions/Risks
- only material unresolved items
```

Include paths and key commands.

Do not include full successful test logs.

---

# 43. Model Recommendation

For the first deterministic architecture/refactor:

```text
Model: GPT-5.6 Terra
Reasoning: High
Response style: terse
```

Once the architecture exists:

```text
Luna:
  routine implementation and small test additions

Terra Low/Medium:
  supervisor refinements and moderate debugging

Terra High / Sol:
  only for genuinely cross-cutting architecture or difficult failures
```

---

# 44. Definition of Success

This work succeeds when a normal Codex change can move from:

```text
Codex
  → inspect broad repo state
  → decide manually which tests matter
  → run broad tests
  → ingest lots of successful output
  → interpret logs
```

toward:

```text
Codex edits
  ↓
npm run repo -- test --changed
  ↓
local deterministic supervisor
  ↓
small authoritative report
  ↓
Codex acts only if needed
```

and, in the next phase:

```text
failure
  ↓
local Ollama analysis
  ↓
small advisory diagnosis
  ↓
Codex receives a bounded actionable handoff
```

The supervisor should reduce repetitive agent context while **increasing**, not reducing, the auditability of what was tested and why.
