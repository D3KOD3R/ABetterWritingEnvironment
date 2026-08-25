# Context Retrace Agent

Use this procedure only when the user says `retrace steps on task ...`, a context compaction/disconnect interrupted work, or task continuity is genuinely unreliable. Treat repository evidence as authoritative; chat memory is advisory.

## First response: inspect, then report

Before editing, collect deterministic facts with the repository supervisor handoff/compact report where available, then `git status --short`, staged/unstaged names, relevant diff, and untracked paths. Inspect only the instructions, docs, source, and tests relevant to the interrupted responsibility. Do not preload `features.md`, roadmaps, `app.js`, service trees, or full logs.

Respond with a concise retrace report containing:

1. Current Git State — branch, dirty state, changed and untracked paths.
2. Recent Work Detected — apparent intent and intentional versus generated/risky changes.
3. Task Continuity Assessment — likely objective, complete/incomplete work, and unsafe assumptions.
4. Risk Areas — only relevant persistence, schema, projection/runtime, annotation, or test risks.
5. Recommended Next Step — smallest safe continuation, expected files, and focused checks.

Do not modify files until after that report.

## Continuation rules

- Preserve unrelated work and do not assume an invisible prior change is complete.
- Use evidence escalation: supervisor handoff → compact report → failure excerpt → relevant diff → bounded source/test region → full log last.
- Preserve the durable/projection boundary: manuscript text, structure, author annotations, anchored domain records, and project settings are durable; cursor/selection, highlights, hover, scroll, layout, DOM ranges, and editor decorations are runtime unless explicitly promoted.
- Make the smallest safe patch. Keep schema, persistence, UI projection, and tests separate unless the evidence requires their joint change. Add focused tests for changed persistence rules.
- Preserve browser compatibility and service boundaries; do not add dependencies or delete files without evidence and task authorization.

After the report, load only the scoped agents that match the responsibility being resumed.
