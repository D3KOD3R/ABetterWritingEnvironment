# Test Supervisor Agent

Use only when changing repository-supervisor routing, test groups, verification policy, or supervisor architecture.

## Required behaviour

- Deterministic Node/Git is authoritative for Git state, changed-file classification, selected checks, pass/fail, and verification freshness. Local AI may summarize or triage but must not become authority.
- Start from the supervisor handoff or compact JSON report. Follow: handoff → compact report → failure excerpt → relevant diff → relevant source/test region → full logs last.
- For JavaScript changes, prefer `npm run repo -- test --changed`; run `npm test` when routing escalates to FULL, canonical verification is required, or the supervisor is unavailable/blocked.
- Change routing configuration and test-group registration only for genuine supervisor work. Read the relevant section of `docs/architecture/test-harness-repo-supervisor-roadmap.md` only when supervisor architecture or routing policy changes.
- Documentation-only changes—including root Markdown, `agents/**/*.md`, `finalisework/**/*.md`, and `voiceissues/**/*.md`—must remain documentation-only. Do not modify supervisor routing merely to support scoped-agent documentation.

## Local developer state and external logs

- Keep compact authoritative supervisor state and Codex handoff material under the ignored worktree-local `.tools/reports/` hierarchy. Do not introduce a parallel `.tools/context/` store for the same task/test state.
- Keep machine-specific developer settings under ignored `.tools/config/local-development.json`. Use `tools/repo-supervisor/local-development.example.json` as the tracked configuration contract; never commit a developer's absolute machine path.
- When external logging is implemented, detailed application/test logs should live outside the repository/worktree under the configured `externalLogRoot`, organised by repository, worktree, test, and run identity. Repo-local compact reports should point to those external artifacts instead of duplicating full logs.
- The future browser logging settings and repo-supervisor/Codex configuration must resolve the same `externalLogRoot` setting rather than creating separate human and agent logging destinations.

The two backlog coverage improvements in the agent-refactor audit are not part of unrelated work.
