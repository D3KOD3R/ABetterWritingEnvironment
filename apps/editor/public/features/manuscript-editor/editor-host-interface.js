// Intent: define the render-only manuscript editor-host input independently of any browser editor implementation.
import {
  MANUSCRIPT_PROJECTION_CHANNELS,
  selectProjectionChannel,
} from "./projection-selector.js";

export const MANUSCRIPT_EDITOR_HOST_KIND = Object.freeze({
  TEXTAREA_OVERLAY: "textarea-overlay",
});

// Intent: sanitize projections before a visual editor adapter receives them.
export function createManuscriptEditorHostSnapshot({
  sceneId = "",
  text = "",
  projections = [],
} = {}) {
  const normalizedSceneId = typeof sceneId === "string" ? sceneId : "";
  const normalizedText = String(text ?? "");
  const normalizedProjections = (Array.isArray(projections) ? projections : [])
    .filter((projection) => isProjectionRenderable(projection, normalizedSceneId, normalizedText.length))
    .map((projection) => ({ ...projection }));

  return {
    sceneId: normalizedSceneId,
    text: normalizedText,
    projections: normalizedProjections,
  };
}

export function selectManuscriptEditorHostChannel(snapshot, channel) {
  if (!Object.values(MANUSCRIPT_PROJECTION_CHANNELS).includes(channel)) {
    return [];
  }

  return selectProjectionChannel(snapshot?.projections, channel);
}

function isProjectionRenderable(projection, sceneId, textLength) {
  return Boolean(
    projection &&
    typeof projection.id === "string" &&
    typeof projection.channel === "string" &&
    (projection.sceneId === "" || projection.sceneId === sceneId) &&
    Number.isInteger(projection.startOffset) &&
    Number.isInteger(projection.endOffset) &&
    projection.startOffset >= 0 &&
    projection.endOffset > projection.startOffset &&
    projection.endOffset <= textLength
  );
}
