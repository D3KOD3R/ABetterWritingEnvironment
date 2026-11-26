import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../sidecars/dictation_codec.py", import.meta.url));

export function privateFlacCodec(python: string) {
  async function run(operation: "encode" | "decode", input: Buffer) {
    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(python, ["-B", script, operation], { windowsHide: true });
      const chunks: Buffer[] = []; let length = 0, errors = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Private FLAC codec timed out.")); }, 30000);
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.stdout.on("data", chunk => {
        length += chunk.length;
        if (length > 8_000_000) { child.kill(); reject(new Error("Oversized codec output.")); } else chunks.push(chunk);
      });
      child.stderr.on("data", chunk => { errors = (errors + chunk).slice(-2000); });
      child.stdin.on("error", () => {});
      child.on("close", code => { clearTimeout(timer); if (code !== 0) reject(new Error(`Private FLAC codec failed: ${errors}`)); else resolve(Buffer.concat(chunks)); });
      child.stdin.end(input);
    });
  }
  return {
    encode: (pcm: Buffer) => run("encode", pcm),
    async verify(flac: Buffer, pcm: Buffer) {
      if (flac.subarray(0, 4).toString() !== "fLaC" || !(await run("decode", flac)).equals(pcm)) throw new Error("FLAC decoded samples do not match capture.");
    },
  };
}
