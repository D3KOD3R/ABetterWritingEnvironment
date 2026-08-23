// Intent: discover focused test modules and expose stable filename-derived test IDs.
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE_SUFFIX = ".test.mjs";

export function compareTestIds(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function toTestId(fileName) {
  return fileName.endsWith(TEST_FILE_SUFFIX)
    ? fileName.slice(0, -TEST_FILE_SUFFIX.length)
    : null;
}

export async function discoverTestDefinitions({ root = testRoot } = {}) {
  const entries = await readdir(root, { withFileTypes: true });
  const fileNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(TEST_FILE_SUFFIX))
    .map((entry) => entry.name)
    .sort(compareTestIds);
  const seenIds = new Set();

  const definitions = fileNames.map((fileName) => {
    const id = toTestId(fileName);
    if (!id || seenIds.has(id)) {
      throw new Error(`Duplicate or invalid test ID for ${fileName}.`);
    }
    seenIds.add(id);
    return { id, fileName, filePath: path.join(root, fileName) };
  });
  return definitions.sort((left, right) => compareTestIds(left.id, right.id));
}

export async function loadTestRunner(definition) {
  const module = await import(pathToFileURL(definition.filePath).href);
  const runnerNames = Object.entries(module)
    .filter(([name, value]) => /^run[A-Za-z0-9]+Test$/.test(name) && typeof value === "function")
    .map(([name]) => name);

  if (runnerNames.length !== 1) {
    throw new Error(`${definition.fileName} must export exactly one run…Test function; found ${runnerNames.length}.`);
  }
  return module[runnerNames[0]];
}
