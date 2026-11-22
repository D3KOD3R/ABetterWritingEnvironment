// Managed speech artifacts are machine state. Model presence never implies runtime readiness.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import catalog from "./speech-catalog.json" with { type: "json" };

export const speechCatalog = catalog.models;
type Model = typeof speechCatalog[number];
type Progress = { modelId: string; state: string; downloadedBytes: number; verifiedBytes: number; totalBytes: number; message?: string };

async function hashFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export function createSpeechModelStore({ modelRoot, fetchImpl = fetch, models = speechCatalog }: {
  modelRoot: string; fetchImpl?: typeof fetch; models?: Model[];
}) {
  if (!isAbsolute(modelRoot)) throw new Error("Speech models require an absolute machine model root.");
  const root = resolve(modelRoot, "speech");
  const jobs = new Map<string, { controller: AbortController; progress: Progress; done: Promise<void> }>();
  const leases = new Map<string, number>();
  const mutations = new Set<string>();
  function modelFor(id: string) {
    const model = models.find((entry) => entry.id === id);
    if (!model || !/^[a-z0-9_-]+$/.test(id)) throw new Error("Unknown curated speech model.");
    return model;
  }
  function directory(model: Model) { return join(root, `${model.id}-${model.revision}`); }
  async function safeRoot() {
    await mkdir(root, { recursive: true });
    // A configured model root is authority; children may not redirect installs/removal through links.
    if ((await lstat(root)).isSymbolicLink()) throw new Error("Speech library cannot be a symbolic link.");
    return realpath(root);
  }
  async function inspect(id: string, verify = false) {
    const model = modelFor(id);
    try {
      if ((await lstat(root)).isSymbolicLink()) throw new Error("Speech library cannot be a symbolic link.");
      const target = directory(model);
      if ((await lstat(target)).isSymbolicLink()) throw new Error("Managed model is a symbolic link.");
      const manifest = JSON.parse(await readFile(join(target, "abe-model.json"), "utf8"));
      if (manifest.managedBy !== "abe-speech-v1" || manifest.id !== id || manifest.source?.revision !== model.revision) {
        throw new Error("Managed installation metadata does not match the pinned catalogue.");
      }
      for (const artifact of model.artifacts) {
        const path = join(target, artifact.filename);
        const stats = await lstat(path);
        if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== artifact.bytes) throw new Error(`Missing or invalid ${artifact.filename}`);
        if (verify && await hashFile(path) !== artifact.sha256) throw new Error(`Checksum failed: ${artifact.filename}`);
      }
      return { installed: true, path: target, message: "Verified managed installation metadata and companion files." };
    } catch (error) {
      return { installed: false, path: "", message: (error as Error).message };
    }
  }
  async function install(id: string) {
    const model = modelFor(id);
    if (jobs.has(id) || mutations.has(id)) throw new Error("A model operation is already active.");
    if (leases.get(id)) throw new Error("Model is in use.");
    mutations.add(id);
    try {
      await safeRoot();
      try { await lstat(directory(model)); throw new Error("Installation already exists; remove an unused managed version first."); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const controller = new AbortController();
      const progress: Progress = { modelId: id, state: "downloading", downloadedBytes: 0, verifiedBytes: 0, totalBytes: model.artifacts.reduce((n, a) => n + a.bytes, 0) };
      const stage = join(root, `.install-${randomUUID()}`);
      await mkdir(stage);
      const job = { controller, progress, done: Promise.resolve() };
      jobs.set(id, job);
      job.done = (async () => {
        try {
          for (const artifact of model.artifacts) {
            if (new URL(artifact.url).protocol !== "https:" || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(artifact.filename) || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error("Invalid pinned artifact metadata.");
            const response = await fetchImpl(artifact.url, { signal: controller.signal });
            if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${artifact.filename}`);
            const handle = await open(join(stage, artifact.filename), "wx");
            const hash = createHash("sha256");
            let bytes = 0;
            try {
              for await (const chunk of response.body as any) {
                controller.signal.throwIfAborted();
                bytes += chunk.byteLength;
                if (bytes > artifact.bytes) throw new Error(`Download exceeds pinned size: ${artifact.filename}`);
                hash.update(chunk);
                // writeFile on an open handle completes all bytes; do not assume one write is complete.
                await handle.writeFile(chunk);
                progress.downloadedBytes += chunk.byteLength;
              }
              progress.state = "verifying";
              if (bytes !== artifact.bytes || hash.digest("hex") !== artifact.sha256) throw new Error(`Checksum/size verification failed: ${artifact.filename}`);
              await handle.sync();
              progress.verifiedBytes += bytes;
              progress.state = "downloading";
            } finally { await handle.close(); }
          }
          controller.signal.throwIfAborted();
          const manifest = await open(join(stage, "abe-model.json"), "wx");
          try {
            await manifest.writeFile(JSON.stringify({ id, displayName: model.displayName, category: "speech", managedBy: "abe-speech-v1", runtime: model.runtime, format: model.runtime === "moonshine-voice" ? "ort" : "bin", source: { type: "huggingface", revision: model.revision, url: model.sourceUrl }, artifacts: model.artifacts, installedAt: new Date().toISOString() }, null, 2));
            await manifest.sync();
          } finally { await manifest.close(); }
          controller.signal.throwIfAborted();
          // Publication is last: interrupted/corrupt downloads never appear as installed models.
          await rename(stage, directory(model));
          progress.state = "installed";
        } catch (error) {
          progress.state = controller.signal.aborted ? "cancelled" : "failed";
          progress.message = (error as Error).message;
        } finally {
          // stage is generated beneath this store, never supplied by a caller or manifest.
          if (relative(root, stage).startsWith(".install-")) await rm(stage, { recursive: true, force: true });
          mutations.delete(id);
        }
      })();
      return { ...progress };
    } catch (error) { mutations.delete(id); throw error; }
  }
  return {
    inspect, install,
    async snapshot() { return Promise.all(models.map(async (model) => ({ ...model, ...await inspect(model.id), progress: jobs.get(model.id)?.progress ?? null, inUse: Boolean(leases.get(model.id)) }))); },
    async wait(id: string) { await jobs.get(id)?.done; return jobs.get(id)?.progress; },
    async cancel(id: string) { const job = jobs.get(id); if (job && mutations.has(id)) job.controller.abort(); await job?.done; },
    async retry(id: string) { await jobs.get(id)?.done; jobs.delete(id); return install(id); },
    async acquire(id: string) {
      if (mutations.has(id)) throw new Error("Model operation is active.");
      leases.set(id, (leases.get(id) ?? 0) + 1);
      const installation = await inspect(id, true);
      if (!installation.installed) { leases.set(id, (leases.get(id) ?? 1) - 1); throw new Error(installation.message); }
      let released = false;
      return { model: modelFor(id), path: installation.path, release() { if (!released) { released = true; leases.set(id, (leases.get(id) ?? 1) - 1); } } };
    },
    async remove(id: string) {
      const model = modelFor(id);
      if (mutations.has(id) || leases.get(id)) throw new Error("Model is installing or in use.");
      mutations.add(id);
      try {
        const canonicalRoot = await safeRoot();
        const target = directory(model);
        if ((await lstat(target)).isSymbolicLink()) throw new Error("Refusing linked model removal.");
        const resolved = await realpath(target);
        const child = relative(canonicalRoot, resolved);
        if (!child || child.startsWith("..") || isAbsolute(child)) throw new Error("Model removal escaped library.");
        const manifest = JSON.parse(await readFile(join(target, "abe-model.json"), "utf8"));
        if (manifest.managedBy !== "abe-speech-v1" || manifest.id !== id || manifest.source?.revision !== model.revision) throw new Error("Refusing to remove an unmanaged model.");
        await rm(resolved, { recursive: true });
        jobs.delete(id);
      } finally { mutations.delete(id); }
    },
  };
}
