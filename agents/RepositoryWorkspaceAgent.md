# Repository Workspace Agent

Use for repository/worktree operations, tool/test selection, controlled RUNs and workspace/RUN provenance. Ordinary read-only product/domain work does not require this agent.

## Repository and verification authority

- Use native Git/shared repository utilities for worktree, branch, HEAD and source-change facts. Verify the task-designated source before acting; a launcher or earlier RUN is not current source authority.
- Establish checkout cleanliness from native Git status or staged/unstaged/untracked facts. Supervisor `clean` also includes committed changes relative to `--base`; choose that base for verification scope, not apparent cleanliness.
- Repo supervisor owns automated selection, verdicts and freshness. Prefer `npm run repo -- test --changed` (default FAST); use `--level affected` for AFFECTED companion coverage. Preserve domain-required checks and FULL escalation. Use `npm test` for required FULL/canonical verification or an unavailable/blocked supervisor.
- Escalate evidence: supervisor handoff → compact report → failure excerpt → relevant diff → bounded source/test → full log last. Do not present a prior report as fresh verification of different source.
- Reports, handoff state and `full.log` remain worktree-local under `.tools/reports/`. Keep machine settings in ignored `.tools/config/local-development.json`, following `tools/repo-supervisor/local-development.example.json`; never commit local absolute paths.

## Controlled RUN authority

- Use `tools/regression-workspace/regression-run-controller.mjs` for attributable RUN allocation/launch and existing ABE logging for events. Read the bounded operating contract in `docs/implementation/active/regression-workspace-logging.md`; do not reproduce controller mechanics manually.
- The caller's checklist/feature definition owns CASE meaning, observations, log-source choices and acceptance. `caseId` is opaque; supply any expected invariant explicitly. Controller `completed` is lifecycle status, not CASE acceptance.
- `run-manifest.json` owns recorded RUN provenance/environment facts; `runtime-logs/log-session.json` supplies runtime/log linkage. Consult them when interpreting earlier RUN evidence; current HEAD may differ from executed source.
- Read a supplied external workspace's applicable `WORKSPACE.md` as an instance constraint document. Preserve its restrictions and selected-RUN references; its paths/status are not tracked repository-wide policy, and `prepared` is not permission to launch.
- Use the controller's external sandbox/log/evidence isolation. Desktop/browser state and external inputs need separate starting-condition evidence. Source checks are before/after, not immutable execution; interrupted status can be incomplete and same-RUN restart is unsupported.
- Keep `source-changes.json` local by default: it can contain uncommitted source and must not be automatically committed, uploaded or shared as ordinary evidence.

## Delegation

Persistence/domain architecture and CASE semantics remain with their owners. Controller internals belong to its tooling contract; supervisor internals to `agents/TestSupervisorAgent.md`. Retrace and finalisation remain separately routed through `agentContextRetrace.md` and `finalisework/FinaliseWorkAgent.md`; tool use does not invoke either workflow.
