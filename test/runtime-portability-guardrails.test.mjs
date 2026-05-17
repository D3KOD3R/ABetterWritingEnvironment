// Intent: enforce that browser-only runtime APIs stay inside adapter modules.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const allowedLocalStorageFiles = new Set([
  normalizePath("apps/editor/public/adapters/storage/browser-storage-adapter.js"),
  normalizePath("apps/editor/public/adapters/storage/editor-storage.js"),
]);

const allowedFilePickerFiles = new Set([
  normalizePath("apps/editor/public/adapters/storage/project-file.js"),
]);

export function runRuntimePortabilityGuardrailsTest() {
  const editorRoot = path.join(repoRoot, "apps", "editor", "public");
  const jsFiles = collectFiles(editorRoot, (filePath) => filePath.endsWith(".js") || filePath.endsWith(".mjs"));
  const violations = [];

  for (const filePath of jsFiles) {
    const source = stripJsComments(readFileSync(filePath, "utf8"));
    const relativePath = normalizePath(path.relative(repoRoot, filePath));

    if (/\blocalStorage\b/.test(source) && !allowedLocalStorageFiles.has(relativePath)) {
      violations.push(`${relativePath} uses localStorage outside approved browser adapters.`);
    }

    if (/\bshowOpenFilePicker\b/.test(source) && !allowedFilePickerFiles.has(relativePath)) {
      violations.push(`${relativePath} uses showOpenFilePicker outside project-file adapter.`);
    }

    if (/\bshowSaveFilePicker\b/.test(source) && !allowedFilePickerFiles.has(relativePath)) {
      violations.push(`${relativePath} uses showSaveFilePicker outside project-file adapter.`);
    }
  }

  // Intent: app.js should orchestrate via ProjectPersistenceService, not direct file pickers/autosave adapters.
  const appScriptPath = path.join(repoRoot, "apps", "editor", "public", "app.js");
  const appSource = stripJsComments(readFileSync(appScriptPath, "utf8"));
  if (!/createProjectPersistenceService/.test(appSource)) {
    violations.push("apps/editor/public/app.js must create ProjectPersistenceService.");
  }

  const disallowedAppPatterns = [
    /\bcreateProjectFileAutosaveController\b/,
    /\bpickProjectFileHandleForOpen\b/,
    /\bpickProjectFileHandleForSave\b/,
    /\breadProjectLibraryFromBrowserFile\b/,
    /\breadProjectLibraryFromBrowserHandle\b/,
    /\breadProjectLibraryFromDesktopPath\b/,
    /\bwriteProjectLibraryToBrowserHandle\b/,
    /\bwriteProjectLibraryToDesktopPath\b/,
    /\bresolveProjectFileDisplayState\b/,
  ];
  for (const pattern of disallowedAppPatterns) {
    if (pattern.test(appSource)) {
      violations.push(`apps/editor/public/app.js should not directly reference ${pattern}.`);
    }
  }

  assert.equal(
    violations.length,
    0,
    `Runtime portability guardrails failed:\n${violations.map((line) => `- ${line}`).join("\n")}`,
  );
}

function collectFiles(rootPath, predicate, output = []) {
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      collectFiles(entryPath, predicate, output);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!predicate(entryPath)) {
      continue;
    }
    output.push(entryPath);
  }

  return output;
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function stripJsComments(source) {
  return String(source ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^\\])\/\/.*$/gm, "$1");
}
