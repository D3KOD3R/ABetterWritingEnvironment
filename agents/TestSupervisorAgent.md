# Test Supervisor Agent

Use only when changing repository-supervisor routing, test groups, verification policy, or supervisor architecture.

Ordinary supervisor usage, tool selection and evidence handling belong to `agents/RepositoryWorkspaceAgent.md`; using the existing supervisor does not require this agent.

## Required behaviour

- Deterministic Node/Git is authoritative for Git state, changed-file classification, selected checks, pass/fail, and verification freshness. Local AI may summarize or triage but must not become authority.
- Change routing configuration and test-group registration only for genuine supervisor work. Read the relevant section of `docs/architecture/test-harness-repo-supervisor-roadmap.md` only when supervisor architecture or routing policy changes.
- Documentation-only changes—including root Markdown, `agents/**/*.md`, `finalisework/**/*.md`, and `voiceissues/**/*.md`—must remain documentation-only. Do not modify supervisor routing merely to support scoped-agent documentation.

## Local developer state and external logs

- Preserve authoritative supervisor reports, Codex handoff material and detailed `full.log` output under the ignored worktree-local `.tools/reports/` hierarchy. Do not introduce a parallel `.tools/context/` store for the same task/test state.
- External controlled-RUN logging is integrated through RegressionRunController and existing ABE logging. The controller consumes `developmentLogging.externalLogRoot` from the existing local configuration contract and passes log destinations through existing environment overrides; runtime/browser log-session integration supplies attribution. This does not relocate supervisor reports or `full.log`. Delegate ordinary configuration/usage to `agents/RepositoryWorkspaceAgent.md`.

The two backlog coverage improvements in the agent-refactor audit are not part of unrelated work.
