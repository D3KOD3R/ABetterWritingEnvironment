// Intent: keep saved narration take line titles consistent across Audio tab cards and review strips.

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

// Intent: prefer measured manuscript display lines while preserving older block-line recording records.
export function resolveNarrationRecordingLineRange(recording) {
  const startLineNumber =
    normalizePositiveInteger(recording?.displayStartLineNumber) ??
    normalizePositiveInteger(recording?.displayLineNumber) ??
    normalizePositiveInteger(recording?.lineNumber);
  if (!startLineNumber) {
    return null;
  }

  const endLineNumber = Math.max(
    startLineNumber,
    normalizePositiveInteger(recording?.displayEndLineNumber) ?? startLineNumber,
  );
  return {
    startLineNumber,
    endLineNumber,
  };
}

export function formatNarrationRecordingLineLabel(recording, fallbackLabel = "Line untracked") {
  const range = resolveNarrationRecordingLineRange(recording);
  if (!range) {
    return fallbackLabel;
  }

  return range.startLineNumber === range.endLineNumber
    ? `Line ${range.startLineNumber}`
    : `Lines ${range.startLineNumber}-${range.endLineNumber}`;
}
