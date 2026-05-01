# Scrivener Import Plan

## Purpose

The project includes a Scrivener package at `Project Serva Vitae Novel & WoldBuild Combined Cloud.scriv`. That package should become the source import for the working manuscript, worldbuilding notes, timeline notes, comment-derived tasks, and research assets used by this application.

This import must preserve authorship context. The goal is not to flatten the Scrivener project into anonymous text, but to convert its binder structure into addressable manuscript, world, task, research, and template records.

## Current Status

The initial import command lives in `scripts/build-project-data.mjs`. It reads the Scrivener package, walks nested binder folders and text nodes in order, converts manuscript/world/timeline content into JSON, and emits a report with source provenance for imported tasks, entities, timeline nodes, and template sheets. The browser now seeds its saved-project library from that import, while the desktop workspace snapshot remains a separate demo workspace for now. Binder paths are preserved so nested content such as station sheets, template sheets, and marketing notes can be traced back to their exact Scrivener location. The desktop host also exposes a project integrator route for local `.scriv` packages, so a user can convert a project into a normal saved-project record without mutating the original Scrivener bundle.

## Current Source Inventory

The Scrivener package contains:

- `Manuscript`: 35 binder items, 30 text items, about 71,000 words, and 52 comments.
- `WorldBuilding`: 80 binder items, 63 text items, about 8,500 words, 6 comments, 7 document notes, and 1 image asset.
- `Timeline`: 6 binder items, 5 text items, about 2,800 words, and 7 comments.
- `Research`: 4 binder items, 2 text items, about 900 words.
- `Trash`: 7 binder items and 2 PDF assets.

The Scrivener file format stores the main outline in the `.scrivx` XML file and stores document bodies under `Files/Data/<UUID>/content.rtf`. Comments are stored as `content.comments` files and are also referenced inside the RTF with `scrivcmt://<comment-id>` hyperlinks. Document notes are stored as `notes.rtf`. Media assets are stored as `content.png`, `content.pdf`, and similar files in the same UUID folder.

## Import Boundaries

The initial import should use these boundaries:

- `Manuscript` becomes the primary manuscript binder.
- Each top-level manuscript folder becomes a chapter.
- Each text item inside a manuscript chapter becomes a scene.
- Paragraphs inside each scene RTF become editable manuscript blocks.
- Whitespace, line breaks, and paragraph indentation in the manuscript RTF should be preserved as faithfully as the RTF conversion allows.
- Scrivener comments attached to manuscript RTF become tasks, not issues.
- `Timeline` becomes timeline/world-spine material.
- `WorldBuilding / Characters`, `Ships`, `Weapons`, `Planets`, `Fauna`, `Flora`, and nested `Station` sheets become world entities or entity candidates.
- `WorldBuilding / Notes`, `Research`, and research-like comments become research notes.
- `WorldBuilding / Front Matter` should be imported as publication/front-matter material, not as story scenes.
- `Template Sheets`, including `Station`, become reusable world templates with their original binder path and source text retained for later UI work.
- `Trash` should not be imported by default. Assets there should be listed in an import report so the user can opt in.

## Missing Features

### 1. Scrivener Importer

The desktop host needs a Scrivener importer that can:

- read `.scrivx` binder XML;
- walk nested `BinderItem` structures in order;
- resolve each binder UUID to `Files/Data/<UUID>`;
- convert RTF to plain editable text;
- preserve paragraph boundaries;
- preserve source provenance such as Scrivener UUID, binder path, source file path, and modification time.

The importer should not depend on Scrivener internals beyond the documented package files and RTF/text artifacts that users already own.

The importer should produce an import report with counts for imported scenes, skipped items, comments, notes, assets, and unresolved anchors.

### 2. RTF Anchor Mapping

RTF conversion must preserve enough positional information to map Scrivener comments back to manuscript text. Scrivener comments appear as `scrivcmt://<comment-id>` links inside `content.rtf`; those links point to bodies in `content.comments`.

The importer should resolve each comment in this order:

1. Find the `scrivcmt://<comment-id>` field in the RTF.
2. Use the field result text as the selected manuscript text where possible.
3. Convert the RTF around that field into plain-text offsets.
4. If exact offsets cannot be recovered, attach the task as an approximate location-first task near the paragraph containing the link.

### 3. Host-Seeded Tasks

Tasks are currently browser-local editor overlays. Scrivener comments need host-seeded tasks that arrive in the workspace snapshot.

Required task fields:

```js
{
  id,
  source: "scrivener-comment",
  scrivenerDocumentId,
  scrivenerCommentId,
  chapterId,
  sceneId,
  selectedText,
  startOffset,
  endOffset,
  lineIndex,
  paragraphIndex,
  nearbyBefore,
  nearbyAfter,
  anchorMode: "location",
  anchorStatus: "active" | "recovered" | "approximate" | "orphaned",
  title,
  body,
  status
}
```

Imported Scrivener comments should appear in the existing task UI, not in the issue list. The issue list remains for analysis diagnostics and manually accepted issue records.

### 4. Host-Seeded Inspiration And Research Notes

Inspiration and research notes are also currently browser-local overlays. Scrivener research and worldbuilding notes need host-seeded passage notes or research cards.

Required note fields:

```js
{
  id,
  noteType: "inspiration" | "research",
  source: "scrivener-note" | "scrivener-research" | "scrivener-asset",
  scrivenerDocumentId,
  chapterId,
  sceneId,
  selectedText,
  startOffset,
  endOffset,
  title,
  body,
  assetIds,
  attachmentConfidence
}
```

Research notes with no reliable manuscript match should still be imported, but should be marked as unattached until the user links them to a passage.

### 5. Research Media Attachments

The UI needs media-aware research cards. A research note should be able to display:

- a thumbnail for images;
- a compact PDF card for PDFs;
- source title and Scrivener binder path;
- linked manuscript passage preview;
- attachment confidence;
- actions for `Open asset`, `Attach to current selection`, `Detach`, and `Archive`.

Visually, research cards should remain quiet and editorial, but richer than text-only notes. The best fit is a compact card with a left thumbnail or document icon, a right-side title/body excerpt, and a small linked-passage strip. Selecting the card should blue-highlight the attached passage, matching the existing research/inspiration highlight family.

### 6. Research Attachment Heuristics

Research notes should attach to manuscript passages cautiously. The importer should prefer explicit evidence and avoid pretending weak guesses are certain.

Recommended attachment order:

1. Use Scrivener bookmarks or comment hyperlinks when present.
2. Match research-note keywords against manuscript scene titles and selected text.
3. Use strong named-entity matches such as ship names, character names, locations, and technical terms.
4. Prefer the closest manuscript scene already connected by comments or timeline notes.
5. If confidence is low, import the research as unattached and surface it in a review queue.

Examples from this project:

- `WorldBuilding / Notes / Space walks` likely attaches to scenes involving spacewalks, suit pressure, EVA, vacuum training, or high-risk exterior movement.
- `WorldBuilding / Notes / Suits and their interactions with space. Fluid chemistry.` likely attaches to suit-related scenes and world entities for protective suits.
- `WorldBuilding / Notes / Jump gate technology` likely attaches to gate/courier/transit-gate passages and the timeline gate lore notes.
- `Research / Writing Notes` should become a task or research note connected to the Grey Class ship thread.
- `Research / Marketing / Songs - Trailer` is marketing material, so it should remain project research and should not be force-attached to a manuscript passage.
- `WorldBuilding / Front Matter / Ebook / Cover` should import as a project media asset, not a passage note.

### 7. Worldbuilding Import

The world model needs an import path from Scrivener worldbuilding folders:

- Characters -> character entities.
- Ships -> ship entities.
- Weapons -> weapon entities.
- Planets -> planet entities.
- Fauna and Flora -> biology/ecology entities.
- Timeline -> timeline spine and timeline nodes.
- Template Sheets -> reusable world templates.

The importer should retain the original Scrivener binder path and UUID on each imported entity for traceability.

### 8. Reimport Safety

The app needs a safe reimport model before this should become routine work.

Requirements:

- imported records keep stable source IDs derived from Scrivener UUIDs;
- local edits are not overwritten without review;
- deleted source items become archived/import-missing records rather than disappearing;
- imported manuscript text can be compared against local edits;
- the import report lists conflicts and lets the user accept source, keep local, or merge.

## Recommended Implementation Order

1. Add a Scrivener import report command that reads the package and prints/imports counts without changing the workspace.
2. Add RTF-to-text conversion with paragraph and comment-anchor mapping tests.
3. Add host-seeded task and passage-note fields to the workspace snapshot.
4. Import the `Manuscript` folder into the desktop workspace in place of the current sample manuscript.
5. Import Scrivener comments as tasks.
6. Import `WorldBuilding / Characters`, `Ships`, `Weapons`, `Planets`, `Fauna`, and `Flora` into the world model.
7. Import timeline documents into world spines.
8. Add media-aware research cards and asset-serving routes.
9. Import research notes and assets with attachment-confidence review.
10. Add reimport conflict handling.
