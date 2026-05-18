# Finalise Work Agent - Canonical Closeout Workflow

This agent is the source of truth whenever the user says `finalise work` in this repo.

## Purpose

`finalise work` closes the current development session in a repeatable way. The agent must inspect the actual repository state, reconcile code changes with project documentation, verify the work where tooling exists, and leave a clear handoff.

The agent must not guess from chat history alone, overstate completion, or mark unfinished work as complete.

## Primary Files

- `features.md` is the active numbered feature tracker for the Word-document feature set.
- `docs/product/feature-map.md` is the grouped product overview.
- `docs/architecture/*` contains subsystem source-of-truth notes.
- `voiceissues/voice-issues.md` is the active issue checklist used by the voice issue workflow.
- `voiceissues/VoiceIssuesAgent.md` defines the `fix issues` checklist rules and should be consulted when issue state is being changed.
- `AGENTS.md` is the root development rulebook.
- `README.md` is the short public entry point.

Do not create new closeout documents as part of this workflow. If a new recurring document would improve the workflow, explain the proposed file, purpose, and maintenance cost to the user first, then wait for direction.

## Operating Rules

1. Start from repository evidence.
   - Run `git status --short`.
   - Inspect changed file names with `git diff --name-only` and staged changes if any.
   - Review diffs enough to explain the functional purpose of each intended change.
   - Separate source/docs/test changes from runtime artifacts such as `SaveTestFile/`, `cache/`, `logs/`, generated project files, and local desktop state.

2. Reconcile the issue list.
   - Open `voiceissues/voice-issues.md`.
   - Note unresolved `[ ]`, active `[working on]`, and waitlist `[~]` entries.
   - Do not work waitlist items unless the user explicitly asked for waitlist work.
   - If the session completed a listed issue, mark it `[x]` with a short note and preserve the issue number prefix.
   - If a known unresolved problem was discovered and has no checklist entry, add a concise `[ ]` issue instead of hiding it in the final response only.

3. Update feature documentation.
   - Update `features.md` when code changed feature behavior, persistence, workflow scope, or implementation maturity.
   - Preserve the numbered feature structure from the Word document.
   - Use one of these status labels when touching a feature status: `Planned`, `In Progress`, `Implemented`, `Partially Implemented`, `Needs Review`, or `Deprecated`.
   - Mark a feature `Implemented` only when the code exists, the workflow can reasonably be exercised, there are no obvious blocking issues, and save/load/autosave/project-state behavior is accounted for.
   - Use `Partially Implemented` or `Needs Review` when evidence is incomplete.
   - Keep `docs/product/feature-map.md` in sync when the grouped product overview would otherwise become stale.
   - Maintain the `Feature Implementation Index` at the end of `features.md` for any implemented or meaningfully changed workflow.
   - Index entries must point to concrete code locations and should include file path, approximate line span, main functions or blocks, and the flow-on functions/services triggered by the workflow.
   - List functions in execution order where practical, so the index can be used for debugging, extraction planning, and the later desktop port.
   - Include persistence, autosave, dirty-state, logging, and render/update side effects when they are part of the workflow.
   - Prefer stable function or block names over fragile one-line references when the code is still monolithic. Use line spans as navigation hints, not as the only source of truth.

4. Update architecture documentation only when architecture changed.
   - Prefer existing files in `docs/architecture/` over creating root-level `ARCHITECTURE.md`.
   - Check service boundaries, save/load/autosave ownership, project JSON structure, browser-versus-file state, logging ownership, manuscript anchors, and desktop migration assumptions.
   - Specifically verify that persistence behavior still routes through `ProjectPersistenceService`.
   - Note architectural drift if new work expands `apps/editor/public/app.js` with feature-specific logic that should move into a feature slice, adapter, state module, or shared helper.

5. Keep project docs grounded in the current repo structure.
   - Update `README.md` only for user-visible setup, workflow, or project-direction changes.
   - Use the existing documentation structure: `features.md`, `docs/product/feature-map.md`, `docs/architecture/*`, `voiceissues/voice-issues.md`, and `AGENTS.md`.
   - Do not create `CHANGELOG.md`, `TODO.md`, `KNOWN_ISSUES.md`, `ARCHITECTURE.md`, `docs/project-state.md`, or `docs/dev-notes.md` during finalise work unless the user explicitly approves that new file.
   - If a missing document seems valuable, raise it as a discussion point in the handoff summary instead of creating it.

6. Run verification based on available tooling.
   - Inspect `package.json` scripts before choosing commands.
   - At minimum, run `npm test` when JavaScript behavior changed and the script exists.
   - Run `node --check` for changed `.js` and `.mjs` files where practical.
   - Run `node --experimental-strip-types --check` for changed `.ts` files where practical.
   - Run additional scripts such as `npm run build`, `npm run lint`, or `npm run typecheck` only when they exist.
   - Record any known nonfatal output, such as the current spellcheck missing-word-list `404`, without treating it as a failure if the command exits successfully.

7. Prepare the repository for handoff.
   - Re-run `git status --short` after documentation and verification.
   - Stage only intentional source, test, and documentation changes.
   - Do not stage generated runtime artifacts unless the user explicitly says they belong in the repo.
   - Use a concise commit message that describes the session outcome.
   - `finalise work` authorizes committing and pushing the intentional closeout changes to the current branch's upstream after checks pass.
   - Do not push if checks fail, the branch has no upstream, the diff contains unresolved unrelated user changes, or the user added `no push`.

8. Produce a handoff summary.
   - List the functional changes that were finalized.
   - List documentation updated.
   - List verification commands and outcomes.
   - List unresolved issues, risks, or deferred items.
   - If pushed, include the branch and commit hash.

## Closeout Checklist

Use this order for every `finalise work` run:

1. Read `AGENTS.md`.
2. Read this file.
3. Inspect `git status --short`.
4. Inspect changed diffs and classify intentional versus generated changes.
5. Read `voiceissues/voice-issues.md` and update issue states only when supported by evidence.
6. Update `features.md`, including the `Feature Implementation Index`, and related product/architecture docs where relevant.
7. Run available checks from `package.json` and changed-file syntax checks.
8. Review final `git status --short`.
9. Commit and push intentional changes when allowed by the operating rules.
10. Report the final state clearly.

## Promises

- The agent closes the session from repository facts, not memory.
- The agent preserves the product identity as a local-first authoring IDE.
- The agent keeps persistence, logging, and feature behavior behind the intended service boundaries.
- The agent does not bury unresolved work.
- The agent does not stage local runtime artifacts by accident.
