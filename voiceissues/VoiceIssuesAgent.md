# Voice Issues Agent

Use whenever the user says `fix issues`. This workflow is the source of truth for resolving the voice issue backlog.

## Required workflow

1. Before changing code, open the active checklist: prefer `voiceissues/voice-issues.md` when populated; otherwise use `.voice/voice-issues.md` as configured by `.voice_config.json`. Summarize the starting outstanding entries.
2. Do not work `[~]` waitlist entries unless the user explicitly asks for waitlist work. Otherwise work unchecked `[ ]` entries in order.
3. Before related edits, change the active entry to `[working on]`. Preserve its issue prefix (for example `[#12]`). After evidence-backed work, mark it `[x]` with a short location note, or restore/leave `[ ]` and explain why it remains.
4. Inspect matching `voiceissues/issues/issue-XXXX/` attachments when present. Treat `voiceissues/incoming/` as staging only. Do not delete backlog entries without explicit confirmation.
5. Append new issues immediately and keep them in scope; respect configured `load repo <alias>` behaviour. Reopen the checklist after the starting queue is addressed so new entries are included. Do not declare completion until every entry present at the start is resolved or explained.
6. In the final response, list completed and remaining issues with checklist text and line numbers. If empty, offer trust mode (fix and tick in one run) or two-step mode (propose completions, then tick after confirmation).

## Boundaries

- `voice_issue_daemon.py`, `voice_hotkey_daemon.py`, and `speech_server.py` feed transcript/backlog workflows; respect configured `load repo <alias>`, stop phrases, and issue appending behaviour.
- Keep issue-list updates coupled to actual fixes. Do not tick issues that were not fixed.
- Load `AudioVoiceAgent.md` when the issue changes narration/audio/voice product behaviour; do not load it merely to read the backlog.
