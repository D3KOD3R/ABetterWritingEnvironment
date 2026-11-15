// A typed recovery signal keeps discard UI independent of error-message wording.
export const PROJECT_REPLACEMENT_SAVE_BLOCKED = "project-replacement-save-blocked";

export function projectReplacementSaveBlocked(message) {
  const error = new Error(message);
  error.code = PROJECT_REPLACEMENT_SAVE_BLOCKED;
  return error;
}
