// Intent: persist desktop-local settings such as project roots and last-used project file paths.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import type { DesktopSettingsSnapshot } from "../../../packages/shared-types/src/index.ts";

// Intent: keep the desktop host's persistent runtime state outside the browser cache.
const DESKTOP_SETTINGS_STATE_PATH = fileURLToPath(new URL("../.desktop-state.json", import.meta.url));

function createDefaultDesktopSettingsSnapshot(): DesktopSettingsSnapshot {
  return {
    executionMode: "local-only",
    modelRoot: "C:\\Models\\AuthorSuite",
    assetRoot: "C:\\AuthorAssets",
    projectRoot: "",
    spotifyClientId: normalizeDesktopPublicId(process.env.ABE_SPOTIFY_CLIENT_ID),
    lastProjectFilePath: "",
    lastProjectFilePathExplicit: false,
  };
}

function normalizeDesktopSettingsSnapshot(candidate: unknown): DesktopSettingsSnapshot {
  const defaults = createDefaultDesktopSettingsSnapshot();
  const normalized = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Partial<DesktopSettingsSnapshot>
    : {};
  const normalizedProjectFilePath = typeof normalized.lastProjectFilePath === "string"
    ? normalized.lastProjectFilePath.trim()
    : "";
  const hasAbsoluteProjectFilePath = Boolean(normalizedProjectFilePath) && /[\\/]/.test(normalizedProjectFilePath);

  return {
    executionMode: normalized.executionMode === "hybrid" ? "hybrid" : defaults.executionMode,
    modelRoot: typeof normalized.modelRoot === "string" && normalized.modelRoot.trim()
      ? normalized.modelRoot.trim()
      : defaults.modelRoot,
    assetRoot: typeof normalized.assetRoot === "string" && normalized.assetRoot.trim()
      ? normalized.assetRoot.trim()
      : defaults.assetRoot,
    projectRoot: typeof normalized.projectRoot === "string" && normalized.projectRoot.trim()
      ? normalized.projectRoot.trim()
      : defaults.projectRoot,
    spotifyClientId: normalizeDesktopPublicId(normalized.spotifyClientId) || defaults.spotifyClientId,
    lastProjectFilePath: hasAbsoluteProjectFilePath ? normalizedProjectFilePath : defaults.lastProjectFilePath,
    lastProjectFilePathExplicit: normalized.lastProjectFilePathExplicit === true && hasAbsoluteProjectFilePath,
  };
}

function normalizeDesktopPublicId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readDesktopSettingsState(): DesktopSettingsSnapshot {
  try {
    const raw = readFileSync(DESKTOP_SETTINGS_STATE_PATH, "utf8");
    return normalizeDesktopSettingsSnapshot(JSON.parse(raw));
  } catch {
    return createDefaultDesktopSettingsSnapshot();
  }
}

function writeDesktopSettingsState(snapshot: DesktopSettingsSnapshot): void {
  const resolvedPath = resolvePath(DESKTOP_SETTINGS_STATE_PATH);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, JSON.stringify(snapshot, null, 2), "utf8");
}

// Intent: expose the current desktop settings snapshot to both the workspace seed and API routes.
export function createDesktopSettingsSnapshot(): DesktopSettingsSnapshot {
  return readDesktopSettingsState();
}

// Intent: update only the desktop settings fields the browser is allowed to persist.
export function updateDesktopSettingsSnapshot(patch: Partial<DesktopSettingsSnapshot>): DesktopSettingsSnapshot {
  const nextSnapshot = normalizeDesktopSettingsSnapshot({
    ...readDesktopSettingsState(),
    ...patch,
  });
  writeDesktopSettingsState(nextSnapshot);
  return nextSnapshot;
}
