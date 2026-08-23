// Intent: keep grammar-check panel layout preferences deterministic without tying them to DOM rendering.
export const GRAMMAR_CHECK_PANEL_MIN_WIDTH = 320;
export const GRAMMAR_CHECK_PANEL_MIN_HEIGHT = 260;
export const GRAMMAR_CHECK_PANEL_EDGE_MARGIN = 12;

// Intent: normalize saved grammar-check panel bounds so user settings cannot reopen the panel off-screen.
export function normalizeGrammarCheckPanelBounds(candidate, options = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : null;
  if (!source) {
    return null;
  }

  const left = Number(source.left ?? source.x);
  const top = Number(source.top ?? source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if (![left, top, width, height].every(Number.isFinite)) {
    return null;
  }

  return clampGrammarCheckPanelBounds({
    left,
    top,
    width,
    height,
  }, options.viewport);
}

// Intent: clamp both size and origin together so resizing never strands the window outside the viewport.
export function clampGrammarCheckPanelBounds(bounds = {}, viewport = {}) {
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const maxWidth = viewportWidth > 0
    ? Math.max(GRAMMAR_CHECK_PANEL_MIN_WIDTH, viewportWidth - (GRAMMAR_CHECK_PANEL_EDGE_MARGIN * 2))
    : Number.POSITIVE_INFINITY;
  const maxHeight = viewportHeight > 0
    ? Math.max(GRAMMAR_CHECK_PANEL_MIN_HEIGHT, viewportHeight - (GRAMMAR_CHECK_PANEL_EDGE_MARGIN * 2))
    : Number.POSITIVE_INFINITY;
  const width = clampPanelNumber(bounds.width, GRAMMAR_CHECK_PANEL_MIN_WIDTH, maxWidth);
  const height = clampPanelNumber(bounds.height, GRAMMAR_CHECK_PANEL_MIN_HEIGHT, maxHeight);
  const position = clampGrammarCheckPanelPosition(bounds.left, bounds.top, width, height, viewport);

  return {
    left: position.left,
    top: position.top,
    width,
    height,
  };
}

export function clampGrammarCheckPanelPosition(left, top, width, height, viewport = {}) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const minLeft = GRAMMAR_CHECK_PANEL_EDGE_MARGIN;
  const minTop = GRAMMAR_CHECK_PANEL_EDGE_MARGIN;
  const maxLeft = viewportWidth > 0
    ? Math.max(minLeft, viewportWidth - safeWidth - GRAMMAR_CHECK_PANEL_EDGE_MARGIN)
    : Number.POSITIVE_INFINITY;
  const maxTop = viewportHeight > 0
    ? Math.max(minTop, viewportHeight - safeHeight - GRAMMAR_CHECK_PANEL_EDGE_MARGIN)
    : Number.POSITIVE_INFINITY;

  return {
    left: Math.round(Math.min(Math.max(minLeft, Number(left) || 0), maxLeft)),
    top: Math.round(Math.min(Math.max(minTop, Number(top) || 0), maxTop)),
  };
}

// Intent: update the transient panel position while preserving the saved size when one exists.
export function setGrammarCheckPanelPositionState(panelState = {}, left, top, options = {}) {
  const currentBounds = normalizeGrammarCheckPanelBounds(panelState?.bounds, { viewport: options.viewport });
  const width = Number(options.width ?? currentBounds?.width);
  const height = Number(options.height ?? currentBounds?.height);
  const position = clampGrammarCheckPanelPosition(left, top, width, height, options.viewport);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const bounds = clampGrammarCheckPanelBounds({
      left: position.left,
      top: position.top,
      width,
      height,
    }, options.viewport);
    return {
      ...panelState,
      position: {
        left: bounds.left,
        top: bounds.top,
      },
      bounds,
    };
  }

  return {
    ...panelState,
    position,
  };
}

// Intent: update the transient panel bounds after user resize gestures without mutating selection state.
export function setGrammarCheckPanelBoundsState(panelState = {}, bounds = {}, options = {}) {
  const normalizedBounds = normalizeGrammarCheckPanelBounds(bounds, { viewport: options.viewport });
  if (!normalizedBounds) {
    return panelState;
  }

  return {
    ...panelState,
    position: {
      left: normalizedBounds.left,
      top: normalizedBounds.top,
    },
    bounds: normalizedBounds,
  };
}

function clampPanelNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.round(Math.min(Math.max(numericValue, min), max));
}
