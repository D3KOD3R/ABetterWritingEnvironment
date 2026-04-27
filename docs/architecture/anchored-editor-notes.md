# Anchored Editor Notes

## Purpose

The editor can attach author-created tasks, inspiration notes, and research notes to manuscript locations. These records are local browser-side authoring overlays today; they preserve scene, chapter, text excerpt, offsets, and location evidence so later canonical persistence can promote them into repository-owned manuscript anchors.

Tasks and passage notes have different anchoring intent. Tasks are location-first markers: they should take the user back to roughly the same part of the manuscript where work was identified, even if the originally selected text has been edited or deleted. Inspiration and research notes are passage-first records: they should stay attached to the specific verse or text range that the note explains or supports whenever that range can still be recovered.

## Storage Keys

- Tasks are saved in `localStorage` under `abe-manuscript-tasks-v1`.
- Inspiration and research notes are saved in `localStorage` under `abe-passage-notes-v1`.
- Scene draft text is saved separately under `abe-scene-drafts-v1`.

## Task Flow

1. The user selects manuscript text and right-clicks the editor.
2. `getEditorContextFromEvent` resolves the selected text and start/end offsets from the active scene textarea.
3. `openTaskComposerFromContextMenu` opens the task composer.
4. `saveTaskFromComposer` calls `createManuscriptTask` with the scene, selected text, offsets, task body, and next scene task number.
5. The task is appended to `state.manuscriptTasks` and persisted to `abe-manuscript-tasks-v1`.
6. Navigation and hover previews call `resolveManuscriptTaskRange` so a task can recover its anchor if nearby text shifts.

Tasks should behave like floating issue markers around the place where the user first opened the task. The selected text is evidence for recovery and highlighting, not the only durable identity of the task. Future task records should store enough location evidence to return the user to the same working area:

```js
{
  sceneId,
  startOffset,
  endOffset,
  selectedText,
  lineIndex,
  paragraphIndex,
  nearbyBefore,
  nearbyAfter,
  anchorMode: "location",
  anchorStatus: "active" | "recovered" | "approximate" | "orphaned"
}
```

Task navigation should resolve in this order:

1. Try the same scene and adjusted offsets.
2. If the original selected text is gone, use the nearest surviving line or paragraph around the stored `lineIndex` or `paragraphIndex`.
3. If line or paragraph indexes shifted, search for nearby before/after context.
4. If exact recovery fails, open the scene and place the user near the original proportional position in the manuscript.
5. Mark a task as `orphaned` only when the containing scene or chapter no longer exists, or no meaningful manuscript location can be recovered.

## Inspiration And Research Flow

1. The user right-clicks the scene editor and chooses Add inspiration or Add research.
2. `openPassageNoteComposerFromContextMenu` creates `state.inlinePassageDraft`; this draft is UI state only and is not written to storage.
3. If the user had selected manuscript text before right-clicking, that selected text is copied into the bubble's manuscript verse field and marked as a seeded selection.
4. The editor renders a translucent blue inline note bubble across the manuscript text width.
5. The user types the inspiration or research note in the blue note area.
6. The user then types or reviews the actual manuscript verse in the normal manuscript field rendered inside the bubble.
7. The top of the bubble prompts the user to save the note against that typed verse.
8. `commitInlinePassageNote` refuses to save until both the note body and a non-empty verse exist.
9. On save, `insertInlinePassageVerse` inserts the verse into the scene textarea at the original right-click offset for blank-space drafts, or anchors to the existing selected range for seeded-selection drafts.
10. If the user edits a seeded-selection verse before saving, `insertInlinePassageVerse` replaces the original selected range with the edited verse and updates `abe-scene-drafts-v1`.
11. `createPassageNote` receives the final verse excerpt plus its offsets, then the note is persisted to `abe-passage-notes-v1`.
12. The right panel lists the note under Inspiration or Research, and selecting it uses `resolveManuscriptTaskRange` to recover and highlight the stored manuscript range.
13. Inspiration note highlights use the same blue family as the inline inspiration bubble. Issue and task previews remain orange so issue-console diagnostics are visually distinct from author inspiration notes.

The older direct-editor path remains supported: if the user types the related prose directly in the scene textarea before saving, `trackInlinePassageDraftTyping` records that changed text range as `typedStartOffset` and `typedEndOffset`.

## Persistence Rule

The blue inline bubble never defines a durable anchor by itself. Only text that becomes part of the normal scene editor content can become the saved anchor. This keeps inspiration and research linked to actual manuscript prose rather than to a temporary UI position.

## Deleted Passage Policy

Tasks, inspiration notes, and research notes should not be silently deleted when the user removes the manuscript passage they were attached to. These records are authoring context and should remain reviewable until the user explicitly completes, archives, reattaches, or deletes them.

When manuscript text changes, passage-first records should be resolved in this order:

1. Try the stored `startOffset` and `endOffset`.
2. If the stored offsets no longer match the saved `selectedText`, search nearby for the same selected text.
3. If nearby recovery fails, use before/after context once that context is stored on the record.
4. If the anchor cannot be recovered with confidence, keep the record and mark it as orphaned.

Passage-first records should support an anchor lifecycle field:

```js
anchorStatus: "active" | "recovered" | "partial" | "orphaned"
```

The statuses mean:

- `active`: the saved offsets still resolve cleanly to the manuscript passage.
- `recovered`: the passage moved or shifted, but the system found a confident replacement range.
- `partial`: only part of the original passage or nearby context was found, so the UI should ask the user to confirm the attachment.
- `orphaned`: the source passage appears to have been deleted and the record has no highlightable manuscript range.

Task and note behavior should differ slightly:

- Tasks should not auto-complete when their source text is deleted. Deleted selected text should usually move a task to `approximate`, not `orphaned`, because the task is intended to remain near the manuscript location where the work was first identified. The task panel should show a state such as `Original selection deleted; showing nearby manuscript location` and offer actions such as `Attach to selection`, `Mark complete`, `Archive`, or `Delete`.
- Inspiration and research notes should be preserved even more strongly because deleting a verse does not mean the idea or reference is no longer useful. Their panels should show `Source passage deleted` and offer `Attach to selection`, `Restore passage`, `Archive`, or `Delete`.

Navigation behavior should follow `anchorStatus`:

- `active` and `recovered` records navigate to the scene and highlight the resolved range.
- `partial` records navigate to the scene and show a confirm-attachment state in the side panel.
- `approximate` task records navigate to the scene and scroll to the nearest recovered line, paragraph, or proportional scene position without pretending the original selected text still exists.
- `orphaned` records navigate to the scene, select the side-panel item, and show the deleted-source state without trying to highlight text.

The editor should avoid modal warnings while the user types. Anchor loss should appear as quiet side-panel state, badges, and item-level actions.
