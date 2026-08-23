// Intent: normalize the floating Dream Scaping catalogue inspector bounds before rendering or persistence.
export const WORLDBUILDING_CATALOGUE_MIN_WIDTH = 320;
export const WORLDBUILDING_CATALOGUE_MIN_HEIGHT = 260;
export const WORLDBUILDING_CATALOGUE_EDGE_MARGIN = 8;

// Intent: keep saved catalogue layout preferences from reopening the inspector off-screen.
export function normalizeWorldbuildingCatalogueBounds(candidate, options = {}) {
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

  return clampWorldbuildingCatalogueBounds({
    left,
    top,
    width,
    height,
  }, options.viewport);
}

// Intent: clamp size and origin together so resize and drag gestures preserve a usable inspector.
export function clampWorldbuildingCatalogueBounds(bounds = {}, viewport = {}) {
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const viewportBottom = viewportHeight > 0
    ? viewportHeight - WORLDBUILDING_CATALOGUE_EDGE_MARGIN
    : Number.POSITIVE_INFINITY;
  const requestedBottom = Number(viewport?.bottomBoundary);
  const bottomBoundary = Number.isFinite(requestedBottom)
    ? Math.min(viewportBottom, requestedBottom)
    : viewportBottom;
  const maxWidth = viewportWidth > 0
    ? Math.max(WORLDBUILDING_CATALOGUE_MIN_WIDTH, viewportWidth - (WORLDBUILDING_CATALOGUE_EDGE_MARGIN * 2))
    : Number.POSITIVE_INFINITY;
  const maxHeight = Number.isFinite(bottomBoundary)
    ? Math.max(WORLDBUILDING_CATALOGUE_MIN_HEIGHT, bottomBoundary - WORLDBUILDING_CATALOGUE_EDGE_MARGIN)
    : Number.POSITIVE_INFINITY;
  const width = clampCatalogueNumber(bounds.width, WORLDBUILDING_CATALOGUE_MIN_WIDTH, maxWidth);
  const height = clampCatalogueNumber(bounds.height, WORLDBUILDING_CATALOGUE_MIN_HEIGHT, maxHeight);
  const position = clampWorldbuildingCataloguePosition(bounds.left, bounds.top, width, height, viewport);

  return {
    left: position.left,
    top: position.top,
    width,
    height,
  };
}

export function clampWorldbuildingCataloguePosition(left, top, width, height, viewport = {}) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const viewportWidth = Math.max(0, Number(viewport?.width) || 0);
  const viewportHeight = Math.max(0, Number(viewport?.height) || 0);
  const viewportBottom = viewportHeight > 0
    ? viewportHeight - WORLDBUILDING_CATALOGUE_EDGE_MARGIN
    : Number.POSITIVE_INFINITY;
  const requestedBottom = Number(viewport?.bottomBoundary);
  const bottomBoundary = Number.isFinite(requestedBottom)
    ? Math.min(viewportBottom, requestedBottom)
    : viewportBottom;
  const minLeft = WORLDBUILDING_CATALOGUE_EDGE_MARGIN;
  const minTop = WORLDBUILDING_CATALOGUE_EDGE_MARGIN;
  const maxLeft = viewportWidth > 0
    ? Math.max(minLeft, viewportWidth - safeWidth - WORLDBUILDING_CATALOGUE_EDGE_MARGIN)
    : Number.POSITIVE_INFINITY;
  const maxTop = Number.isFinite(bottomBoundary)
    ? Math.max(minTop, bottomBoundary - safeHeight)
    : Number.POSITIVE_INFINITY;

  return {
    left: Math.round(Math.min(Math.max(minLeft, Number(left) || 0), maxLeft)),
    top: Math.round(Math.min(Math.max(minTop, Number(top) || 0), maxTop)),
  };
}

function clampCatalogueNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.round(Math.min(Math.max(numericValue, min), max));
}
