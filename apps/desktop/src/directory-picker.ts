// Intent: expose native desktop directory selection and read-only selected-root traversal at the host boundary.
import { spawn } from "node:child_process";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve as resolvePath,
  sep as pathSeparator,
} from "node:path";

export interface DesktopDirectoryPickerResult {
  supported: boolean;
  cancelled: boolean;
  path: string;
}

export interface DesktopDirectoryEntry {
  name: string;
  kind: "file" | "directory";
  relativePath: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface DesktopDirectoryListing {
  rootPath: string;
  relativePath: string;
  entries: DesktopDirectoryEntry[];
}

export interface DesktopDirectoryFile {
  rootPath: string;
  relativePath: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  contentBase64: string;
}

const WINDOWS_DIRECTORY_PICKER_SCRIPT = String.raw`
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose project folder'
$dialog.ShowNewFolderButton = $true
$initialPath = [Environment]::GetEnvironmentVariable('ABE_DIRECTORY_PICKER_INITIAL_PATH')
if ($initialPath -and (Test-Path -LiteralPath $initialPath -PathType Container)) {
  $dialog.SelectedPath = $initialPath
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
  exit 0
}
exit 2
`;

function runWindowsDirectoryPicker(initialPath: string) {
  return new Promise<{ cancelled: boolean; path: string }>((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-Command",
      WINDOWS_DIRECTORY_PICKER_SCRIPT,
    ], {
      env: {
        ...process.env,
        ABE_DIRECTORY_PICKER_INITIAL_PATH: initialPath,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 2) {
        resolve({ cancelled: true, path: "" });
        return;
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Native folder picker exited with code ${code ?? "unknown"}.`));
        return;
      }
      resolve({ cancelled: false, path: stdout.trim() });
    });
  });
}

async function validateSelectedDirectory(selectedPath: string) {
  const normalizedPath = String(selectedPath ?? "").trim();
  if (!normalizedPath || !isAbsolute(normalizedPath)) {
    throw new Error("The native folder picker did not return an absolute directory path.");
  }
  const selectedStats = await stat(normalizedPath);
  if (!selectedStats.isDirectory()) {
    throw new Error("The native folder picker selection is not a directory.");
  }
  return normalizedPath;
}

function normalizeSelectedRootRelativePath(value = "") {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!normalized) return "";

  const segments = normalized.split("/").filter(Boolean);
  if (
    /^[A-Za-z]:/.test(normalized)
    || normalized.startsWith("//")
    || segments.some((segment) => segment === "." || segment === ".." || segment.includes(":"))
  ) {
    throw new Error("Selected-directory paths must stay relative to the chosen root.");
  }
  return segments.join("/");
}

function assertContainedPath(rootPath: string, candidatePath: string) {
  const relativePath = relative(rootPath, candidatePath);
  if (
    relativePath === ".."
    || relativePath.startsWith(`..${pathSeparator}`)
    || isAbsolute(relativePath)
  ) {
    throw new Error("Selected-directory access cannot escape the chosen root.");
  }
}

async function resolveSelectedDirectoryEntry({
  rootPath,
  relativePath = "",
  expectedKind = "any",
}: {
  rootPath: string;
  relativePath?: string;
  expectedKind?: "any" | "file" | "directory";
}) {
  const selectedRoot = await validateSelectedDirectory(rootPath);
  const canonicalRoot = await realpath(selectedRoot);
  const normalizedRelativePath = normalizeSelectedRootRelativePath(relativePath);
  const candidatePath = normalizedRelativePath
    ? resolvePath(canonicalRoot, ...normalizedRelativePath.split("/"))
    : canonicalRoot;
  const canonicalCandidate = await realpath(candidatePath);

  // Intent: realpath containment blocks both lexical traversal and symlink/junction escape from the selected import root.
  assertContainedPath(canonicalRoot, canonicalCandidate);

  const candidateStats = await stat(canonicalCandidate);
  if (expectedKind === "file" && !candidateStats.isFile()) {
    throw new Error("The selected directory entry is not a file.");
  }
  if (expectedKind === "directory" && !candidateStats.isDirectory()) {
    throw new Error("The selected directory entry is not a directory.");
  }

  return {
    rootPath: canonicalRoot,
    relativePath: normalizedRelativePath,
    path: canonicalCandidate,
    stats: candidateStats,
  };
}

function contentTypeForDirectoryFile(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case ".scrivx":
    case ".xml":
      return "application/xml";
    case ".rtf":
      return "application/rtf";
    case ".html":
    case ".htm":
      return "text/html";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".json":
      return "application/json";
    case ".txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export async function listDesktopDirectoryEntries({
  rootPath = "",
  relativePath = "",
} = {}): Promise<DesktopDirectoryListing> {
  const resolved = await resolveSelectedDirectoryEntry({
    rootPath,
    relativePath,
    expectedKind: "directory",
  });
  const directoryEntries = await readdir(resolved.path, { withFileTypes: true });
  const entries = await Promise.all(directoryEntries
    // Intent: do not follow symlink/junction-like entries while exposing a user-selected import tree.
    .filter((entry) => entry.isDirectory() || entry.isFile())
    .map(async (entry) => {
      const entryRelativePath = resolved.relativePath
        ? `${resolved.relativePath}/${entry.name}`
        : entry.name;
      const entryPath = join(resolved.path, entry.name);
      const entryStats = await stat(entryPath);
      return {
        name: entry.name,
        kind: entry.isDirectory() ? "directory" as const : "file" as const,
        relativePath: entryRelativePath.replace(/\\/g, "/"),
        size: entry.isFile() ? entryStats.size : 0,
        type: entry.isFile() ? contentTypeForDirectoryFile(entryPath) : "",
        lastModified: entryStats.mtimeMs,
      };
    }));

  entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  return {
    rootPath: resolved.rootPath,
    relativePath: resolved.relativePath,
    entries,
  };
}

export async function readDesktopDirectoryFile({
  rootPath = "",
  relativePath = "",
} = {}): Promise<DesktopDirectoryFile> {
  const resolved = await resolveSelectedDirectoryEntry({
    rootPath,
    relativePath,
    expectedKind: "file",
  });
  const content = await readFile(resolved.path);
  return {
    rootPath: resolved.rootPath,
    relativePath: resolved.relativePath,
    name: basename(resolved.path),
    size: resolved.stats.size,
    type: contentTypeForDirectoryFile(resolved.path),
    lastModified: resolved.stats.mtimeMs,
    contentBase64: content.toString("base64"),
  };
}

export async function pickDesktopDirectory({ initialPath = "" } = {}): Promise<DesktopDirectoryPickerResult> {
  if (process.platform !== "win32") {
    return {
      supported: false,
      cancelled: false,
      path: "",
    };
  }

  const result = await runWindowsDirectoryPicker(String(initialPath ?? "").trim());
  if (result.cancelled) {
    return {
      supported: true,
      cancelled: true,
      path: "",
    };
  }

  return {
    supported: true,
    cancelled: false,
    path: await validateSelectedDirectory(result.path),
  };
}
