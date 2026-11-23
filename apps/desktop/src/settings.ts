// Intent: persist desktop-local settings such as project roots and last-used project file paths.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

import type { DesktopSettingsSnapshot } from "../../../packages/shared-types/src/index.ts";

// Intent: keep the desktop host's persistent runtime state outside the browser cache.
const DESKTOP_SETTINGS_STATE_PATH = fileURLToPath(new URL("../.desktop-state.json", import.meta.url));

let speechSettingsLocked = (_patch: Partial<DesktopSettingsSnapshot>) => false;
// All machine-settings writers share this guard, including the older Local AI routes.
export function setSpeechSettingsLock(check: (patch: Partial<DesktopSettingsSnapshot>) => boolean) { const previous = speechSettingsLocked; speechSettingsLocked = check; return previous; }

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
    speech: {
      setupComplete: normalized.speech?.setupComplete === true,
      setupStage: [1, 2, 3].includes(Number(normalized.speech?.setupStage)) ? Number(normalized.speech?.setupStage) : 1,
      liveModelId: typeof normalized.speech?.liveModelId === "string" ? normalized.speech.liveModelId : "",
      refinementModelId: typeof normalized.speech?.refinementModelId === "string" ? normalized.speech.refinementModelId : "",
      deviceId: typeof normalized.speech?.deviceId === "string" ? normalized.speech.deviceId : "",
      channel: Number.isInteger(normalized.speech?.channel) && Number(normalized.speech?.channel) >= 0 ? normalized.speech!.channel : 0,
    },
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
  if (speechSettingsLocked(patch) && (patch.speech || patch.modelRoot)) throw new Error("Stop and finalize capture before changing speech or model-library settings.");
  const nextSnapshot = normalizeDesktopSettingsSnapshot({
    ...readDesktopSettingsState(),
    ...patch,
  });
  writeDesktopSettingsState(nextSnapshot);
  return nextSnapshot;
}
