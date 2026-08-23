// Intent: own render-only World Spine location filtering without mutating timeline or world records.

const DEFAULT_LOCATION_LABEL = "Unplaced location";

export function createDefaultWorldSpineLocationFilterState(candidate = {}) {
  return normalizeWorldSpineLocationFilterState(candidate);
}

export function normalizeWorldSpineLocationFilterState(candidate = {}) {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate
    : {};
  return {
    selectedLocationKeys: normalizeWorldSpineLocationFilterKeyList(
      source.selectedLocationKeys ?? source.locationKeys ?? source.selectedLocations,
    ),
  };
}

export function buildWorldSpineLocationFilterModel(timeline = {}, filterState = {}) {
  const normalizedState = normalizeWorldSpineLocationFilterState(filterState);
  const options = collectWorldSpineLocationFilterOptions(timeline);
  const optionKeys = new Set(options.map((option) => option.locationKey));
  const selectedLocationKeys = normalizedState.selectedLocationKeys
    .filter((locationKey) => optionKeys.has(locationKey));
  const isActive = selectedLocationKeys.length > 0 && selectedLocationKeys.length < options.length;
  const activeLocationKeys = isActive ? selectedLocationKeys : [];
  const activeLocationKeySet = new Set(activeLocationKeys);
  const focusedOption = activeLocationKeys.length === 1
    ? options.find((option) => option.locationKey === activeLocationKeys[0]) ?? null
    : null;

  return {
    active: isActive,
    selectedLocationKeys: activeLocationKeys,
    selectedLocationKeySet: activeLocationKeySet,
    singleLocationKey: focusedOption?.locationKey ?? "",
    singleLocationLabel: focusedOption?.label ?? "",
    summaryLabel: createWorldSpineLocationFilterSummaryLabel({
      active: isActive,
      selectedLocationKeys: activeLocationKeys,
      focusedOption,
    }),
    options: options.map((option) => ({
      ...option,
      checked: !isActive || activeLocationKeySet.has(option.locationKey),
      filteredOut: isActive && !activeLocationKeySet.has(option.locationKey),
    })),
  };
}

export function updateWorldSpineLocationFilterSelection({
  timeline = {},
  filterState = {},
  locationKey = "",
  checked = true,
} = {}) {
  const filterModel = buildWorldSpineLocationFilterModel(timeline, filterState);
  const optionKeys = filterModel.options.map((option) => option.locationKey);
  const normalizedLocationKey = normalizeWorldSpineLocationFilterKey(locationKey);
  if (!normalizedLocationKey || !optionKeys.includes(normalizedLocationKey)) {
    return normalizeWorldSpineLocationFilterState(filterState);
  }

  const selected = new Set(filterModel.active ? filterModel.selectedLocationKeys : optionKeys);
  if (checked) {
    selected.add(normalizedLocationKey);
  } else {
    selected.delete(normalizedLocationKey);
  }

  const nextSelectedLocationKeys = optionKeys.filter((optionKey) => selected.has(optionKey));
  if (!nextSelectedLocationKeys.length || nextSelectedLocationKeys.length === optionKeys.length) {
    return createDefaultWorldSpineLocationFilterState();
  }

  return {
    selectedLocationKeys: nextSelectedLocationKeys,
  };
}

export function clearWorldSpineLocationFilterSelection() {
  return createDefaultWorldSpineLocationFilterState();
}

export function isWorldSpineLocationVisibleForFilter(filterModel = {}, locationKey = "") {
  if (filterModel?.active !== true) {
    return true;
  }

  return filterModel.selectedLocationKeySet instanceof Set
    ? filterModel.selectedLocationKeySet.has(normalizeWorldSpineLocationFilterKey(locationKey))
    : false;
}

export function resolveWorldSpineLocationFilterClass(filterModel = {}, locationKey = "") {
  if (filterModel?.active !== true) {
    return "";
  }

  return isWorldSpineLocationVisibleForFilter(filterModel, locationKey)
    ? "is-filter-target"
    : "is-filtered-out";
}

export function resolveWorldSpineConnectionFilterClass(connection = {}, {
  filterModel = {},
  nodesById = new Map(),
} = {}) {
  if (filterModel?.active !== true) {
    return "";
  }

  const fromNode = nodesById.get(normalizeString(connection.fromNodeId || connection.renderFromNodeId));
  const toNode = nodesById.get(normalizeString(connection.toNodeId || connection.renderToNodeId));
  const fromVisible = isWorldSpineLocationVisibleForFilter(filterModel, readNodeLocationKey(fromNode));
  const toVisible = isWorldSpineLocationVisibleForFilter(filterModel, readNodeLocationKey(toNode));
  if (fromVisible && toVisible) {
    return "is-filter-target";
  }
  if (connection?.kind === "implication" && (fromVisible || toVisible)) {
    return "is-filter-bridge";
  }
  return "is-filtered-out";
}

export function normalizeWorldSpineLocationFilterKey(value = "") {
  return slugify(normalizeLocationLabel(value)) || "unplaced-location";
}

function collectWorldSpineLocationFilterOptions(timeline = {}) {
  const rows = Array.isArray(timeline?.locationRows) ? timeline.locationRows.filter(Boolean) : [];
  const primaryNodes = Array.isArray(timeline?.primaryNodes) ? timeline.primaryNodes.filter(Boolean) : [];
  const nodeCountsByLocationKey = countPrimaryNodesByLocationKey(primaryNodes);
  const optionsByKey = new Map();

  rows.forEach((row, index) => {
    const locationKey = normalizeWorldSpineLocationFilterKey(row.locationKey || row.locationLabel || row.label);
    const label = normalizeString(row.label) || formatLocationFilterLabel(row.locationLabel);
    if (!optionsByKey.has(locationKey)) {
      optionsByKey.set(locationKey, {
        locationKey,
        label,
        locationLabel: normalizeLocationLabel(row.locationLabel || label),
        nodeCount: nodeCountsByLocationKey.get(locationKey) ?? 0,
        rowIndex: Number.isFinite(Number(row.locationRowIndex)) ? Number(row.locationRowIndex) : index,
        spineLabels: [],
      });
    }

    const option = optionsByKey.get(locationKey);
    const spineLabel = normalizeString(row.spineLabel);
    if (spineLabel && !option.spineLabels.includes(spineLabel)) {
      option.spineLabels.push(spineLabel);
    }
  });

  primaryNodes.forEach((node, index) => {
    const locationKey = readNodeLocationKey(node);
    if (optionsByKey.has(locationKey)) {
      return;
    }

    optionsByKey.set(locationKey, {
      locationKey,
      label: formatLocationFilterLabel(node.locationLabel || node.location),
      locationLabel: normalizeLocationLabel(node.locationLabel || node.location),
      nodeCount: nodeCountsByLocationKey.get(locationKey) ?? 0,
      rowIndex: rows.length + index,
      spineLabels: normalizeString(node.spineLabel) ? [normalizeString(node.spineLabel)] : [],
    });
  });

  return [...optionsByKey.values()]
    .sort((left, right) => left.rowIndex - right.rowIndex || left.label.localeCompare(right.label));
}

function countPrimaryNodesByLocationKey(primaryNodes = []) {
  const counts = new Map();
  primaryNodes.forEach((node) => {
    const locationKey = readNodeLocationKey(node);
    counts.set(locationKey, (counts.get(locationKey) ?? 0) + 1);
  });
  return counts;
}

function readNodeLocationKey(node = {}) {
  return normalizeWorldSpineLocationFilterKey(node?.locationKey || node?.locationLabel || node?.location);
}

function createWorldSpineLocationFilterSummaryLabel({
  active = false,
  selectedLocationKeys = [],
  focusedOption = null,
} = {}) {
  if (!active) {
    return "All locations";
  }

  if (focusedOption?.label) {
    return focusedOption.label;
  }

  return `${selectedLocationKeys.length} locations`;
}

function normalizeWorldSpineLocationFilterKeyList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]+/)
      : [];
  const result = [];
  const seen = new Set();
  source.forEach((item) => {
    const locationKey = normalizeWorldSpineLocationFilterKey(item);
    if (!locationKey || seen.has(locationKey)) {
      return;
    }

    seen.add(locationKey);
    result.push(locationKey);
  });
  return result;
}

function formatLocationFilterLabel(value = "") {
  const label = normalizeLocationLabel(value);
  return normalizeWorldSpineLocationFilterKey(label) === "unplaced-location"
    ? "Insert Location Name"
    : label;
}

function normalizeLocationLabel(value = "") {
  return normalizeString(value) || DEFAULT_LOCATION_LABEL;
}

function normalizeString(value = "") {
  return String(value ?? "").trim();
}

function slugify(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
