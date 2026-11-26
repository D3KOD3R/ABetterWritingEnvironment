// Only hash-verified distribution archives reach this extractor. No installer hooks,
// wheel entry points or .pth files are executed; all paths stay inside a fresh stage.
import { inflateRawSync } from "node:zlib";
import { mkdir, open } from "node:fs/promises";
import { dirname, join } from "node:path";

export function verifiedZipEntries(bytes: Buffer) {
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || bytes.readUInt32LE(end) !== 0x06054b50) throw new Error("Invalid ZIP directory.");
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new Error("Split ZIP is unsupported.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16), expanded = 0;
  const entries: { name: string; content: Buffer }[] = [], names = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP entry.");
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10);
    const compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32);
    const mode = bytes.readUInt32LE(offset + 38) >>> 16, local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extra + comment;
    if (flags & 1 || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000) throw new Error("Unsupported ZIP entry type.");
    const parts = name.replace(/\/$/, "").split("/");
    if (parts.some(p => !p || p === "." || p === ".." || /[\\:\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(p))) throw new Error("Unsafe archive path.");
    const key = name.toLowerCase();
    if (names.has(key)) throw new Error("Duplicate archive path.");
    names.add(key);
    if (name.endsWith("/")) continue;
    if (name.endsWith(".pth") || parts.some(p => p.endsWith(".data"))) throw new Error("Wheel requires an unsupported installation hook.");
    expanded += size;
    if (expanded > 300_000_000 || size > 150_000_000) throw new Error("Expanded runtime exceeds bounds.");
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("Invalid ZIP payload.");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressed > bytes.length) throw new Error("Truncated ZIP payload.");
    const raw = bytes.subarray(start, start + compressed);
    const content = method === 0 ? raw : inflateRawSync(raw, { maxOutputLength: Math.max(1, size) });
    if (content.length !== size) throw new Error("ZIP size mismatch.");
    entries.push({ name, content });
  }
  return entries;
}

export async function extractVerifiedZip(bytes: Buffer, root: string, signal: AbortSignal) {
  for (const entry of verifiedZipEntries(bytes)) {
    signal.throwIfAborted();
    const target = join(root, ...entry.name.split("/"));
    await mkdir(dirname(target), { recursive: true });
    const file = await open(target, "wx");
    try { await file.writeFile(entry.content); await file.sync(); } finally { await file.close(); }
  }
}
