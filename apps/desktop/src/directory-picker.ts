// Intent: expose native desktop directory selection without moving filesystem authority into browser UI code.
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";

export interface DesktopDirectoryPickerResult {
  supported: boolean;
  cancelled: boolean;
  path: string;
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
