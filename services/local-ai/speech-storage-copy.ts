// Relocation stages are session/recovery data owned by this operation. This service
// deliberately has no settings writer or source deletion authority: a verified copy
// is not permission to switch a library shared with external Local AI processes.
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rename, writeFile } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { planSpeechStorage } from "./speech-storage-plan.ts";

async function inventory(root: string, signal: AbortSignal, prefix = ""): Promise<{ path: string; bytes: number; sha256: string }[]> {
  const entries = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    signal.throwIfAborted();
    const path = prefix ? `${prefix}/${name}` : name, info = await lstat(join(root, path));
    if (info.isSymbolicLink()) throw new Error("Linked models cannot be copied by this workflow.");
    if (info.isDirectory()) { entries.push({ path, bytes: 0, sha256: "directory" }); entries.push(...await inventory(root, signal, path)); }
    else if (info.isFile()) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(join(root, path))) { signal.throwIfAborted(); hash.update(chunk); }
      entries.push({ path, bytes: info.size, sha256: hash.digest("hex") });
    } else throw new Error("Unsupported library entry.");
  }
  return entries;
}
export function createSpeechStorageCopy() {
  let plan: Awaited<ReturnType<typeof planSpeechStorage>> & { id: string } | null = null;
  let controller: AbortController | undefined, done = Promise.resolve(), busy = false;
  let progress: any = null;
  return {
    isBusy: () => busy,
    snapshot: () => progress ? { ...progress, busy } : null,
    async plan(source: string, destination: string) {
      if (busy) throw new Error("Wait for the active library copy.");
      plan = { ...await planSpeechStorage(source, destination), id: randomUUID() };
      progress = { ...plan, state: "planned", copiedBytes: 0, stage: "" };
      return { ...progress };
    },
    async start(id: string, consent: boolean) {
      if (!plan || plan.id !== id || consent !== true) throw new Error("Review this relocation preview and explicitly approve a staged copy.");
      if (busy) throw new Error("Library copy is already active.");
      busy = true;
      const approved = plan; controller = new AbortController(); const signal = controller.signal;
      progress = { ...approved, state: "checking", copiedBytes: 0, stage: "", message: "Checking source and destination again…" };
      done = (async () => {
        let stage = "";
        try {
          const current = await planSpeechStorage(approved.source, approved.destination);
          if (current.bytes !== approved.bytes || current.files !== approved.files) throw new Error("Library size changed. Review a fresh preview before copying.");
          const before = await inventory(approved.source, signal);
          stage = join(approved.destination, `.abe-relocation-${approved.id}`);
          await mkdir(stage); progress.stage = stage;
          const payload = join(stage, "library"); await mkdir(payload);
          await writeFile(join(stage, "recovery.json"), JSON.stringify({ owner: "abe-library-copy-v1", ...approved, state: "copying" }, null, 2), { flag: "wx" });
          progress.state = "copying"; progress.message = "Copying into a private stage. The current library stays active.";
          for (const entry of before) {
            signal.throwIfAborted();
            const target = join(payload, entry.path), source = join(approved.source, entry.path);
            if (entry.sha256 === "directory") { await mkdir(target, { recursive: true }); continue; }
            const resolved = await realpath(source), child = relative(approved.source, resolved);
            if (!child || child.startsWith("..") || isAbsolute(child) || resolved !== source) throw new Error("Source path changed during copying.");
            const parts = entry.path.split("/"); parts.pop();
            await mkdir(join(payload, ...parts), { recursive: true });
            const output = await open(target, "wx");
            let size = 0;
            try {
              for await (const chunk of createReadStream(source)) {
                signal.throwIfAborted(); size += chunk.length;
                if (size > entry.bytes) throw new Error("Source changed while copying.");
                await output.writeFile(chunk); progress.copiedBytes += chunk.length;
              }
              await output.sync();
            } finally { await output.close(); }
          }
          progress.state = "verifying"; progress.message = "Rechecking every source and copied file by SHA-256…";
          const copied = await inventory(payload, signal), after = await inventory(approved.source, signal);
          if (JSON.stringify(before) !== JSON.stringify(copied) || JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Library changed or copy verification failed. The original library remains active.");
          signal.throwIfAborted();
          const receipt = await open(join(stage, "verified.json.tmp"), "wx");
          try { await receipt.writeFile(JSON.stringify({ owner: "abe-library-copy-v1", ...approved, files: copied, state: "verified" }, null, 2)); await receipt.sync(); } finally { await receipt.close(); }
          await rename(join(stage, "verified.json.tmp"), join(stage, "verified.json"));
          progress.state = "verified";
          progress.message = "Copy verified. Originals and the active storage location are unchanged. Activation is unavailable until shared Local AI cross-process leases and recovery are supported; this staged copy is not an active library.";
        } catch (error) { progress.state = signal.aborted ? "cancelled" : "failed"; progress.message = `${(error as Error).message} Originals and settings are unchanged. Any partial stage is retained for inspection; retry with a new empty destination.`; }
        finally { busy = false; }
      })();
      return { ...progress, busy };
    },
    async wait() { await done; return { ...progress }; },
    async cancel() { controller?.abort(); await done; return { ...progress }; },
  };
}
