// Runtime generations and activation receipts are app/machine state, never project data.
// Failed/cancelled work can only remove its own fresh stage. Published generations remain
// available for recovery; neither pip nor any system/user Python environment is modified.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm, statfs, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { extractVerifiedZip } from "./verified-zip.ts";
import defaultCatalog from "./speech-runtime-catalog.json" with { type: "json" };

export const speechRuntimeCatalog = defaultCatalog;
const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
async function hash(path: string) {
  const value = createHash("sha256");
  for await (const chunk of createReadStream(path)) value.update(chunk);
  return value.digest("hex");
}
async function inventory(root: string, prefix = ""): Promise<{ path: string; sha256: string; bytes: number }[]> {
  const result = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = prefix ? `${prefix}/${name}` : name, info = await lstat(join(root, path));
    if (info.isSymbolicLink()) throw new Error("Runtime contains a linked entry.");
    if (info.isDirectory()) result.push(...await inventory(root, path));
    else if (info.isFile()) result.push({ path, bytes: info.size, sha256: await hash(join(root, path)) });
    else throw new Error("Unsupported runtime entry.");
  }
  return result;
}
export function createSpeechRuntimeStore({ root, probe, fetchImpl = fetch, platform = process.platform, arch = process.arch, catalog = defaultCatalog }: {
  root: string; probe: (python: string) => Promise<{ ready: boolean; recordingReady?: boolean; message?: string; recordingMessage?: string }>;
  fetchImpl?: typeof fetch; platform?: string; arch?: string; catalog?: typeof defaultCatalog;
}) {
  if (!isAbsolute(root)) throw new Error("Runtime requires an absolute machine root.");
  root = resolve(root);
  const catalogHash = digest(JSON.stringify(catalog));
  let busy = false, controller: AbortController | undefined, done = Promise.resolve();
  let progress = { state: "idle", downloadedBytes: 0, verifiedBytes: 0, totalBytes: catalog.artifacts.reduce((n, a) => n + a.bytes, 0), message: "" };
  const supported = platform === catalog.platform && arch === catalog.arch;
  async function safeRoot() {
    await mkdir(root, { recursive: true });
    if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== root) throw new Error("Choose a real, unlinked runtime location.");
  }
  async function selected() {
    let active;
    try { active = JSON.parse(await readFile(join(root, "active.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw new Error("Runtime activation receipt is damaged. Review and retry installation."); }
    if (active.catalogHash !== catalogHash || !/^runtime-[a-f0-9-]{36}$/.test(active.generation)) throw new Error("Unsupported runtime activation receipt. Review and retry installation.");
    await safeRoot();
    const directory = join(root, active.generation);
    if ((await lstat(directory)).isSymbolicLink()) throw new Error("Runtime generation is linked.");
    const receipt = await readFile(join(directory, "receipt.json"));
    if (digest(receipt) !== active.receiptHash) throw new Error("Runtime receipt checksum failed. Retry installation.");
    const expected = JSON.parse(receipt.toString()).files;
    // Rehash before execution; a corrupted install never silently falls back to another Python.
    const actual = await inventory(join(directory, "payload"));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Runtime integrity check failed. Review and retry installation.");
    return join(directory, "payload", "python.exe");
  }
  return {
    isBusy: () => busy,
    plan: () => ({ id: catalog.id, supported, root, artifacts: catalog.artifacts, totalBytes: progress.totalBytes,
      message: `Private Windows x64 speech runtime (${progress.totalBytes.toLocaleString()} download bytes). Python from python.org; pinned binary wheels from PyPI. Includes Moonshine and SoundFile/libsndfile FLAC. Licenses are retained in the installation; libsndfile is LGPL-2.1-or-later. Downloads are hash-verified before extraction or execution. No system Python, pip, PATH or existing model files are changed. Older runtime copies are retained.` }),
    snapshot: () => ({ ...progress, busy, supported, root }),
    selected,
    async install(consent: boolean) {
      if (consent !== true) throw new Error("Review the runtime sources and explicitly approve installation.");
      if (!supported) throw new Error("Managed speech runtime currently supports Windows x64 only.");
      if (busy) throw new Error("Runtime installation is already active.");
      busy = true;
      let lock;
      try {
        await safeRoot();
        const disk = await statfs(root);
        if (disk.bavail * disk.bsize < 512_000_000) throw new Error("Allow at least 512 MB free for an isolated runtime generation.");
        // Cross-host exclusion: never break a lock automatically after a crash.
        lock = await open(join(root, "install.lock"), "wx");
        await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      } catch (error) { busy = false; await lock?.close(); throw new Error(`Runtime install is unavailable; another host or interrupted installation may hold install.lock: ${(error as Error).message}`); }
      controller = new AbortController();
      const signal = controller.signal, stage = join(root, `.stage-${randomUUID()}`), generation = `runtime-${randomUUID()}`;
      progress = { ...progress, state: "downloading", downloadedBytes: 0, verifiedBytes: 0, message: "" };
      done = (async () => {
        try {
          await mkdir(stage);
          await mkdir(join(stage, "downloads"));
          for (const artifact of catalog.artifacts) {
            signal.throwIfAborted();
            if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(artifact.filename) || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error("Invalid runtime artifact metadata.");
            const url = new URL(artifact.url);
            if (url.protocol !== "https:" || !["www.python.org", "files.pythonhosted.org"].includes(url.hostname)) throw new Error("Unapproved runtime source.");
            const response = await fetchImpl(url.href, { signal, redirect: "error" });
            if (!response.ok || !response.body) throw new Error(`Runtime download failed: ${artifact.filename} (${response.status})`);
            const file = await open(join(stage, "downloads", artifact.filename), "wx");
            const sha = createHash("sha256"); let size = 0;
            try {
              for await (const chunk of response.body as any) {
                signal.throwIfAborted(); size += chunk.length;
                if (size > artifact.bytes) throw new Error("Runtime download exceeds pinned size.");
                sha.update(chunk); await file.writeFile(chunk); progress.downloadedBytes += chunk.length;
              }
              if (size !== artifact.bytes || sha.digest("hex") !== artifact.sha256) throw new Error(`Runtime checksum failed: ${artifact.filename}`);
              await file.sync(); progress.verifiedBytes += size;
            } finally { await file.close(); }
          }
          // All archives are verified before the first executable is unpacked.
          progress.state = "extracting";
          const payload = join(stage, "payload"); await mkdir(payload);
          for (const artifact of catalog.artifacts) {
            await extractVerifiedZip(await readFile(join(stage, "downloads", artifact.filename)), artifact.kind === "python" ? payload : join(payload, "Lib", "site-packages"), signal);
          }
          await writeFile(join(payload, "python314._pth"), "python314.zip\n.\nLib/site-packages\n");
          signal.throwIfAborted(); progress.state = "checking";
          const result = await probe(join(payload, "python.exe"));
          if (!result.ready || !result.recordingReady) throw new Error(result.message || result.recordingMessage || "Private runtime compatibility check failed.");
          const receipt = JSON.stringify({ catalogHash, files: await inventory(payload) });
          const receiptFile = await open(join(stage, "receipt.json"), "wx");
          try { await receiptFile.writeFile(receipt); await receiptFile.sync(); } finally { await receiptFile.close(); }
          signal.throwIfAborted();
          await rename(stage, join(root, generation));
          const next = join(root, `.active-${randomUUID()}.json`);
          const active = await open(next, "wx");
          try { await active.writeFile(JSON.stringify({ generation, catalogHash, receiptHash: digest(receipt) })); await active.sync(); } finally { await active.close(); }
          // Atomic pointer publication leaves the previous selected runtime intact on failure.
          try { signal.throwIfAborted(); await rename(next, join(root, "active.json")); }
          finally { await unlink(next).catch(() => {}); }
          progress.state = "installed"; progress.message = "Verified private speech runtime and FLAC encoder are ready.";
        } catch (error) { progress.state = signal.aborted ? "cancelled" : "failed"; progress.message = (error as Error).message; }
        finally {
          // Only the fresh, contained staging directory is eligible for automatic cleanup.
          const child = relative(root, stage);
          if (/^\.stage-[a-f0-9-]{36}$/.test(child) && await realpath(root) === root) {
            const info = await lstat(stage).catch(() => null);
            if (info && !info.isSymbolicLink()) await rm(stage, { recursive: true, force: true });
          }
          await lock.close(); await unlink(join(root, "install.lock")); busy = false;
        }
      })();
      // Keep asynchronous failures visible without an unhandled rejection on host shutdown.
      done = done.catch(error => { busy = false; progress.state = "failed"; progress.message = (error as Error).message; });
      return { ...progress };
    },
    async wait() { await done; return { ...progress }; },
    async cancel() { controller?.abort(); await done; return { ...progress }; },
  };
}
