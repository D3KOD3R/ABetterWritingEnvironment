# Finalise Work Agent

Use whenever the user says `finalise work`. Close the current session from repository evidence, not chat memory. Do not claim unfinished work is complete.

## Procedure

1. Start with deterministic repository-supervisor handoff or compact report, then inspect Git status and the intended task diff. Separate intentional source/test/docs changes from runtime artifacts such as `SaveTestFile/`, caches, logs, generated project files, and local desktop state.
2. Read `voiceissues/voice-issues.md` only if issue state may have changed. Do not work `[~]` waitlist entries without explicit instruction. Mark a completed issue only with evidence; add a concise unchecked entry for a discovered unresolved issue that needs tracking.
3. Update the bounded relevant `features.md` section and Implementation Index when code changed feature behaviour, persistence, workflow scope, or implementation maturity. Use `Planned`, `In Progress`, `Implemented`, `Partially Implemented`, `Needs Review`, or `Deprecated` when changing feature status. Update related product/architecture docs only when their source-of-truth content changed.
4. If the completed task has a matching spec in `docs/implementation/active/`, verify its acceptance criteria, propagate any enduring architectural/product facts into their canonical docs, then move that spec to `docs/implementation/archive/`. Do not archive partially implemented or unresolved specs, and do not touch unrelated active specs.
5. Before verification, make a bounded maintainability pass over substantially modified functions/tests for missing or stale comments on non-obvious intent, invariants, ownership, ordering, isolation, compatibility, or failure prevention. Do not narrate syntax or widen into unrelated cleanup.
6. Verify proportionally through the supervisor: compact report first, then focused checks. Run `npm test` only when the route escalates to FULL, canonical verification is required, or the supervisor is unavailable/blocked. Run changed-file syntax checks where practical.
7. Recheck status. Stage only intentional changes; never stage generated runtime artifacts accidentally. `finalise work` authorizes committing and pushing intentional closeout changes to the current branch upstream after checks pass, unless the user says `no push`. Do not push on failed checks, no upstream, or unresolved unrelated work in the intended diff.

## Documentation discipline

Do not create new closeout/status/changelog/todo/architecture documents unless the user explicitly approves them. Use `features.md`, `docs/product/feature-map.md`, `docs/architecture/`, `docs/implementation/active/`, `docs/implementation/archive/`, `voiceissues/voice-issues.md`, `README.md`, and scoped agents only when their respective content changed.

Archived implementation specs are historical evidence, not current requirements. Do not read `docs/implementation/archive/` during routine finalisation unless the active spec or current evidence explicitly requires historical comparison.

## Handoff

Report finalized behaviour, updated documentation, verification outcomes, unresolved risks/deferred work, and commit/branch/hash only if committed or pushed.
