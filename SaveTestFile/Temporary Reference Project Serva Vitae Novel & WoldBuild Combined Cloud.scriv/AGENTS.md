# AgentMD

## Purpose

This project is a Scrivener package, not a normal prose repo. Treat structural edits carefully.

## Project Layout

- Binder and document metadata live in `Project Serva Vitae Novel & WoldBuild Combined Cloud.scrivx`.
- Document bodies live in `Files/Data/<UUID>/content.rtf`.
- Anchored inspector comments live beside the document in `Files/Data/<UUID>/content.comments`.
- Scrivener file hashes live in `Files/Data/docs.checksum`.

## Scrivener Comment Rules

- A visible anchored comment needs both sides:
  - an RTF field in `content.rtf` using `scrivcmt://<GUID>`
  - a matching `<Comment ID="<GUID>">` entry in `content.comments`
- If either side is missing, the comment will not show correctly in Scrivener.
- Do not create nested `scrivcmt://...` fields.
- Do not leave comment records without `ID` attributes.
- After editing comments, verify:
  - every `scrivcmt://...` target exists in `content.comments`
  - there are no unused comment IDs left behind

## Editing Rules

- Preserve RTF structure. Replace only the smallest text span needed.
- Preserve existing comments. Append new comment nodes instead of overwriting the file.
- If a document has no `content.comments`, create one with valid XML:
  - XML declaration
  - `<Comments Version="1.0"> ... </Comments>`
- Prefer GUIDs for comment IDs.
- Preserve UTF-8 without BOM when writing XML or RTF files.
- If Scrivener was open during package edits, close and reopen the project before judging results.

## Checksum Rules

- Any changed `Files/Data/...` file should have its SHA1 refreshed in `Files/Data/docs.checksum`.
- New `content.comments` files also need new checksum entries.

## Safe Workflow

1. Use `rg` to find target prose inside `Files/Data/*/content.rtf`.
2. Map UUIDs back to binder titles through the `.scrivx` file before editing.
3. Patch `content.rtf` and `content.comments` together.
4. Refresh `docs.checksum`.
5. Run a resolver check comparing `scrivcmt://...` links against comment IDs.

## Domain Notes

- Not every `gate` token means the sentient transit network.
- Distinguish lore / transit usage from unrelated biomedical or metaphorical uses such as:
  - `cerebral gate`
  - `hundreds of gates`
- When adding lore comments, keep terminology aligned with:
  - `01 - Master Lore Timeline`
  - `00 - Read Me`
  - `02 - Story Sequence`
  - `03 - Continuity Flags`

## Known Prior Failure Mode

- Earlier comment repairs were broken because some added comments were written into `content.comments` without matching `ID` values or without matching `scrivcmt://...` anchors in `content.rtf`.
- Future agents should assume comment visibility issues are structural first, not UI-only.
