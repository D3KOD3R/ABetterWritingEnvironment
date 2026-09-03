// Intent: keep project-package dialog UX wiring small, themed, and behind the desktop capability boundary.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_ROOT, "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

export async function runProjectPackageDialogUxTest() {
  const [indexHtml, dialogCss, dialogController, dialogRenderer, desktopServer, directoryPicker] = await Promise.all([
    readRepoFile("apps/editor/public/index.html"),
    readRepoFile("apps/editor/public/project-package-dialog.css"),
    readRepoFile("apps/editor/public/features/project-lifecycle/project-package-dialog-controller.js"),
    readRepoFile("apps/editor/public/features/project-lifecycle/project-package-dialog.js"),
    readRepoFile("apps/desktop/server.mjs"),
    readRepoFile("apps/desktop/src/directory-picker.ts"),
  ]);

  assert.match(indexHtml, /project-package-dialog\.css/);
  assert.match(indexHtml, /project-package-dialog-controller\.js/);

  assert.match(dialogCss, /\.project-package-dialog\s*\{[\s\S]*background:\s*var\(--project-package-dialog-background\)/);
  assert.match(dialogCss, /:root\[data-theme="dark"\][\s\S]*--project-package-dialog-background:/);
  assert.doesNotMatch(dialogCss, /var\(--panel-bg\)|var\(--line-soft\)/);

  assert.match(dialogController, /PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS\s*=\s*260/);
  assert.match(dialogController, /addEventListener\("input"[\s\S]*scheduleLocationRefresh/);
  assert.match(dialogController, /addEventListener\("focusin"[\s\S]*scheduleLocationRefresh/);
  assert.match(dialogController, /KeyboardEvent\("keydown"[\s\S]*key:\s*"Enter"/);
  assert.match(dialogController, /browse-project-package-path[\s\S]*openNativeProjectPackageDirectoryPicker/);
  assert.match(dialogController, /MutationObserver[\s\S]*setSelectionRange/);

  assert.match(dialogRenderer, /Folders update automatically as you edit the location\./);
  assert.doesNotMatch(dialogRenderer, /Press Enter or Browse to validate/);

  assert.match(desktopServer, /\/api\/platform\/pick-directory/);
  assert.match(desktopServer, /pickDesktopDirectory/);
  assert.doesNotMatch(desktopServer, /Access-Control-Allow-Origin/);

  assert.match(directoryPicker, /process\.platform !== "win32"/);
  assert.match(directoryPicker, /powershell\.exe/);
  assert.match(directoryPicker, /ABE_DIRECTORY_PICKER_INITIAL_PATH/);
  assert.match(directoryPicker, /isAbsolute\(normalizedPath\)/);
}
