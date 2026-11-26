// Read-only preflight: shared Local AI leases/conflict policy must precede a library cutover.
import { lstat, readdir, realpath, statfs } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
export async function planSpeechStorage(source: string, destination: string) {
  if (!isAbsolute(source) || !isAbsolute(destination)) throw new Error("Choose absolute library folders.");
  if ((await lstat(source)).isSymbolicLink() || (await lstat(destination)).isSymbolicLink()) throw new Error("Choose real folders, not linked source or destination folders.");
  const from = await realpath(source), to = await realpath(destination);
  const nested = (a: string, b: string) => { const r = relative(a, b); return !r || (!r.startsWith("..") && !isAbsolute(r)); };
  if (nested(from, to) || nested(to, from)) throw new Error("Source and destination must be separate, non-nested folders.");
  if ((await readdir(to)).length) throw new Error("Choose an empty destination. Existing files will never be overwritten.");
  let bytes = 0, files = 0;
  async function inspect(root: string) {
    for (const name of await readdir(root)) {
      const path = join(root, name), entry = await lstat(path);
      if (entry.isSymbolicLink()) throw new Error("Linked/external models require a separate relocation decision.");
      if (entry.isDirectory()) await inspect(path);
      else if (entry.isFile()) { bytes += entry.size; files++; }
      else throw new Error("Unsupported library entry.");
    }
  }
  await inspect(from);
  const disk = await statfs(to), freeBytes = disk.bavail * disk.bsize;
  if (freeBytes < bytes) throw new Error("Insufficient free space for a verified copy.");
  return { source: from, destination: to, bytes, files, freeBytes, canCutover: false,
    message: `Preview: ${files} files / ${bytes.toLocaleString()} bytes from ${from} to ${to}; ${freeBytes.toLocaleString()} bytes free. Approve a staged copy to copy and checksum all files. Originals and the active library stay unchanged. Switching storage is not yet supported: shared Local AI cross-process leases and cutover recovery remain required.` };
}
