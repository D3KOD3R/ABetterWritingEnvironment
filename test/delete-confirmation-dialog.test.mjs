// Intent: verify anchored-record delete confirmation rendering stays outside the app shell.
import assert from "node:assert/strict";

import {
  createDeleteConfirmationPreferences,
  renderDeleteConfirmationDialogHTML,
} from "../apps/editor/public/features/anchored-records/delete-confirmation-dialog.js";

export function runDeleteConfirmationDialogTest() {
  assert.deepEqual(createDeleteConfirmationPreferences({ comments: true }), {
    passageNotes: false,
    tasks: true,
  });

  const markup = renderDeleteConfirmationDialogHTML({
    title: "Delete task",
    message: "Delete this task?",
    preferenceKey: "tasks",
  }, {
    tasks: true,
  });

  assert.match(markup, /delete-confirmation-modal/);
  assert.match(markup, /Delete this task\?/);
  assert.match(markup, /data-confirmation-key="tasks"/);
  assert.match(markup, /checked/);
  assert.match(markup, /Do not ask me again/);
}
