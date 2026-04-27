import type { DesktopSettingsSnapshot } from "../../../packages/shared-types/src/index.ts";

export function createDesktopSettingsSnapshot(): DesktopSettingsSnapshot {
  return {
    executionMode: "local-only",
    modelRoot: "C:\\Models\\AuthorSuite",
    assetRoot: "C:\\AuthorAssets",
    projectRoot: "C:\\Projects\\TheQuietIndex",
  };
}
