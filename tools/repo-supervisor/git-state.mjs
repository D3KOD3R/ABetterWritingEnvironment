// Intent: collect current-worktree Git facts without modifying repository history or user files.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { classifyChangedPath } from "./routing-config.mjs";

export function runGit(args, { cwd } = {}) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error([`git ${args.join(" ")} failed.`, result.error?.message, result.stderr].filter(Boolean).join("\n"));
  }
  return result.stdout.trim();
}

export function normalizeRepoPath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function lines(value) { return value ? value.split(/\r?\n/).filter(Boolean) : []; }
function parseNameStatus(value) {
  return lines(value).flatMap((line) => {
    const [status, firstPath, secondPath] = line.split("\t");
    if (status?.startsWith("R") || status?.startsWith("C")) return [{ path: normalizeRepoPath(firstPath), changeType: "deleted" }, { path: normalizeRepoPath(secondPath), changeType: "renamed" }];
    return firstPath ? [{ path: normalizeRepoPath(firstPath), changeType: status?.startsWith("D") ? "deleted" : status?.startsWith("A") ? "added" : "modified" }] : [];
  });
}

export function combineChangedFiles(...collections) {
  const byPath = new Map();
  for (const record of collections.flat()) {
    if (record?.path) byPath.set(normalizeRepoPath(record.path), { ...record, path: normalizeRepoPath(record.path) });
  }
  return [...byPath.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function shouldHashFileContents(file) {
  return file.changeType !== "deleted" && !["documentation", "static"].includes(classifyChangedPath(file.path).classification);
}

function hashWorktreeFile(file, cwd) {
  if (!shouldHashFileContents(file)) return "metadata-only";
  try {
    return hashContent(readFileSync(path.join(cwd, file.path)));
  } catch {
    return "missing";
  }
}

function hashIndexFile(file, cwd) {
  if (!shouldHashFileContents(file)) return "metadata-only";
  const result = spawnSync("git", ["show", `:${file.path}`], { cwd, encoding: null, shell: false });
  return result.error || result.status !== 0 ? "missing" : hashContent(result.stdout);
}

function fingerprintRecords(records, source, cwd) {
  return records.map((file) => {
    const contentHash = source === "staged" ? hashIndexFile(file, cwd) : source === "committed" ? "head-owned" : hashWorktreeFile(file, cwd);
    return `${source}:${file.changeType}:${file.path}:${contentHash}`;
  });
}

export function fingerprintChangedFiles(files, { cwd = process.cwd() } = {}) {
  return createHash("sha256").update(fingerprintRecords(files, "worktree", cwd).join("\n")).digest("hex");
}

export function fingerprintGitState({ committed = [], staged = [], unstaged = [], untracked = [] }, { cwd = process.cwd() } = {}) {
  const records = [
    ...fingerprintRecords(committed, "committed", cwd),
    ...fingerprintRecords(staged, "staged", cwd),
    ...fingerprintRecords(unstaged, "unstaged", cwd),
    ...fingerprintRecords(untracked, "untracked", cwd),
  ];
  return createHash("sha256").update(records.join("\n")).digest("hex");
}

export function summarizeChangedFiles({ committed = [], staged = [], unstaged = [], untracked = [], changedFiles = [] }) {
  return {
    committedRelativeToBase: committed.length,
    staged: staged.length,
    unstaged: unstaged.length,
    untracked: untracked.length,
    uniqueChangedFiles: changedFiles.length,
  };
}

export function collectGitState({ cwd, baseRef = "main" } = {}) {
  const worktreeRoot = runGit(["rev-parse", "--show-toplevel"], { cwd });
  const branch = runGit(["branch", "--show-current"], { cwd: worktreeRoot }) || "DETACHED";
  const headSha = runGit(["rev-parse", "HEAD"], { cwd: worktreeRoot });
  const staged = parseNameStatus(runGit(["diff", "--cached", "--name-status"], { cwd: worktreeRoot }));
  const unstaged = parseNameStatus(runGit(["diff", "--name-status"], { cwd: worktreeRoot }));
  const untracked = lines(runGit(["ls-files", "--others", "--exclude-standard"], { cwd: worktreeRoot })).map((path) => ({ path: normalizeRepoPath(path), changeType: "untracked" }));
  const conflicts = lines(runGit(["diff", "--name-only", "--diff-filter=U"], { cwd: worktreeRoot }));
  let mergeBaseSha = null;
  let committed = [];
  let baseAvailable = false;
  try {
    mergeBaseSha = runGit(["merge-base", "HEAD", baseRef], { cwd: worktreeRoot });
    baseAvailable = true;
    committed = parseNameStatus(runGit(["diff", "--name-status", `${mergeBaseSha}..HEAD`], { cwd: worktreeRoot }));
  } catch {
    // Intent: local edits remain routable even when an optional comparison base is absent.
  }
  let ahead = null;
  let behind = null;
  if (baseAvailable) {
    const counts = runGit(["rev-list", "--left-right", "--count", `${baseRef}...HEAD`], { cwd: worktreeRoot }).split(/\s+/);
    behind = Number(counts[0]); ahead = Number(counts[1]);
  }
  const changedFiles = combineChangedFiles(committed, staged, unstaged, untracked);
  const changeSummary = summarizeChangedFiles({ committed, staged, unstaged, untracked, changedFiles });
  return { schemaVersion: 1, worktreeRoot, branch, headSha, baseRef, mergeBaseSha, baseAvailable, ahead, behind, clean: changedFiles.length === 0, conflicts: conflicts.length > 0, staged, unstaged, untracked, committed, changedFiles, changeSummary, changedFilesFingerprint: fingerprintGitState({ committed, staged, unstaged, untracked }, { cwd: worktreeRoot }) };
}
