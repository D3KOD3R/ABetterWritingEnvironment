// Intent: keep project-package dialog UX wiring small, themed, componentized, and behind one desktop capability boundary.
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
  const [
    indexHtml,
    dialogCss,
    dialogController,
    dialogRenderer,
    formComponents,
    desktopAdapter,
    desktopServer,
    directoryPicker,
  ] = await Promise.all([
    readRepoFile("apps/editor/public/index.html"),
    readRepoFile("apps/editor/public/project-package-dialog.css"),
    readRepoFile("apps/editor/public/features/project-lifecycle/project-package-dialog-controller.js"),
    readRepoFile("apps/editor/public/features/project-lifecycle/project-package-dialog.js"),
    readRepoFile("apps/editor/public/shared/form-field-components.js"),
    readRepoFile("apps/editor/public/adapters/platform/desktop-directory-picker.js"),
    readRepoFile("apps/desktop/server.mjs"),
    readRepoFile("apps/desktop/src/directory-picker.ts"),
  ]);

  assert.match(indexHtml, /project-package-dialog\.css/);
  assert.match(indexHtml, /project-package-dialog-controller\.js/);

  assert.match(dialogCss, /\.project-package-dialog\s*\{[\s\S]*background:\s*var\(--project-package-dialog-background\)/);
  assert.match(dialogCss, /:root\[data-theme="dark"\][\s\S]*--project-package-dialog-background:/);
  assert.doesNotMatch(dialogCss, /var\(--panel-bg\)|var\(--line-soft\)/);

  assert.match(dialogRenderer, /renderFormTextFieldHTML/);
  assert.match(dialogRenderer, /renderDirectoryLocationFieldHTML/);
  assert.doesNotMatch(dialogRenderer, /project-package-dialog__path-row/);
  assert.match(formComponents, /export function renderFormTextFieldHTML/);
  assert.match(formComponents, /export function renderDirectoryLocationFieldHTML/);
  assert.match(formComponents, /data-action="\$\{escapeHtml\(browseAction\)\}"/);

  assert.match(dialogController, /PROJECT_PACKAGE_LOCATION_REFRESH_DELAY_MS\s*=\s*260/);
  assert.match(dialogController, /resolveProjectPackageLocationLookup/);
  assert.match(dialogController, /lastIndexOf\("\\\\"\)[\s\S]*lastIndexOf\("\/"\)/);
  assert.match(dialogController, /isPartialSegment:[\s\S]*Boolean\(browsePath\)/);
  assert.match(dialogController, /browsePath:\s*lookup\.browsePath[\s\S]*prefix:\s*lookup\.prefix/);
  assert.match(dialogController, /startsWith\(normalizedPrefix\)/);
  assert.match(dialogController, /No matching child folders\./);
  assert.match(dialogController, /suppressNextLocationInputRefresh/);
  assert.match(dialogController, /input\.dispatchEvent\(new Event\("input"[\s\S]*browser\.innerHTML\s*=\s*matchingMarkup/);
  assert.match(dialogController, /querySelector\("\.project-package-dialog__error"\)\?\.remove\(\)/);
  assert.match(dialogController, /addEventListener\("input"[\s\S]*scheduleLocationRefresh/);
  assert.match(dialogController, /addEventListener\("focusin"[\s\S]*scheduleLocationRefresh/);
  assert.match(dialogController, /KeyboardEvent\("keydown"[\s\S]*key:\s*"Enter"/);
  assert.match(dialogController, /browse-project-package-path[\s\S]*openNativeProjectPackageDirectoryPicker/);
  assert.match(dialogController, /MutationObserver[\s\S]*restorePartialLocationCompletion/);
  assert.match(dialogController, /MutationObserver[\s\S]*input\.value\s*=\s*value[\s\S]*setSelectionRange/);
  assert.doesNotMatch(dialogController, /input\.value\s*!==\s*pendingFocusRestore\.value/);

  // Scrivener must reuse the existing desktop chooser rather than introducing another file-selection UI.
  assert.match(dialogController, /hasNativeDesktopDirectoryPicker\(\)[\s\S]*installDesktopDirectoryPickerBridge\(\)/);
  assert.match(dialogController, /import-scrivener-project[\s\S]*openNativeScrivenerDirectoryPicker/);
  assert.match(dialogController, /chooseDesktopDirectory\(\)/);
  assert.match(dialogController, /queueDesktopDirectoryForNextPicker/);
  assert.match(dialogController, /abe-native-directory-picker/);
  assert.match(desktopAdapter, /pendingDirectoryHandles/);
  assert.match(desktopAdapter, /createDesktopDirectoryHandle/);
  assert.match(desktopAdapter, /browserDirectoryPicker\(options\)/);

  assert.match(dialogRenderer, /Folders update automatically as you edit the location\./);
  assert.doesNotMatch(dialogRenderer, /Press Enter or Browse to validate/);

  assert.match(desktopServer, /\/api\/platform\/pick-directory/);
  assert.match(desktopServer, /\/api\/platform\/directory\/list/);
  assert.match(desktopServer, /\/api\/platform\/directory\/read-file/);
  assert.match(desktopServer, /abe-native-directory-picker/);
  assert.match(desktopServer, /pickDesktopDirectory/);
  assert.doesNotMatch(desktopServer, /Access-Control-Allow-Origin/);

  assert.match(directoryPicker, /process\.platform !== "win32"/);
  assert.match(directoryPicker, /powershell\.exe/);
  assert.match(directoryPicker, /ABE_DIRECTORY_PICKER_INITIAL_PATH/);
  assert.match(directoryPicker, /isAbsolute\(normalizedPath\)/);
  assert.match(directoryPicker, /realpath/);
  assert.match(directoryPicker, /Selected-directory access cannot escape the chosen root\./);
}
