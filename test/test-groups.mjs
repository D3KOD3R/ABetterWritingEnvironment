// Intent: define coarse, maintainable architectural test groups for deterministic routing.
const prefixes = (...values) => ({ prefixes: values });

export const TEST_GROUPS = {
  editor: prefixes("anchored-", "editor-", "manuscript-", "scene-", "task-", "passage-", "revision-", "user-highlight-", "top-panel-", "keyboard-", "custom-metadata-", "metadata-", "progress-tracker", "delete-confirmation-dialog", "milestone-sound-effects-service", "spotify-music-service", "writing-goals-state-service"),
  project: prefixes("project-", "editor-storage", "scrivener-import-service"),
  narration: prefixes("narration-", "audio-service", "realtime-speech-"),
  voice: prefixes("voice-"),
  world: prefixes("world-", "worldbuilding-", "ManuScriptInfographicLane-"),
  localAi: prefixes("local-ai-", "analysis-service"),
  language: prefixes("dictionary-", "spellcheck", "grammar-", "draft-proofing-"),
  desktop: prefixes("desktop-application", "developer-logger", "runtime-portability-guardrails"),
  schemas: prefixes("audiobook-schema", "manuscript-schema", "world-schema"),
  harness: prefixes("application-syntax-smoke", "test-harness-registration", "repo-supervisor"),
};

export const GROUP_DEPENDENCIES = {
  editor: [],
  project: ["schemas"],
  narration: ["voice", "project"],
  voice: ["narration"],
  world: ["schemas", "project"],
  localAi: ["schemas", "editor"],
  desktop: ["editor", "project"],
  schemas: ["editor", "project", "world", "localAi"],
};

export function resolveGroupTestIds(groupName, testIds) {
  const group = TEST_GROUPS[groupName];
  if (!group) throw new Error(`Unknown test group: ${groupName}`);
  return testIds.filter((id) => group.prefixes.some((prefix) => id.startsWith(prefix)));
}

export function findUngroupedTestIds(testIds) {
  return testIds.filter((testId) => !Object.keys(TEST_GROUPS).some((groupName) => resolveGroupTestIds(groupName, testIds).includes(testId)));
}

export function expandGroups(groupNames, { includeDependents = false } = {}) {
  const result = new Set();
  for (const groupName of groupNames) {
    if (!TEST_GROUPS[groupName]) throw new Error(`Unknown test group: ${groupName}`);
    result.add(groupName);
    // Intent: AFFECTED uses declared one-hop companion groups, not a transitive dependency walk.
    if (includeDependents) (GROUP_DEPENDENCIES[groupName] ?? []).forEach((dependentGroup) => result.add(dependentGroup));
  }
  return [...result].sort();
}
