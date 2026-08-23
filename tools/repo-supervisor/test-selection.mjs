// Intent: turn repository path facts into conservative, explainable test selections.
import { expandGroups, resolveGroupTestIds, TEST_GROUPS } from "../../test/test-groups.mjs";
import { normalizeRepoPath } from "./git-state.mjs";
import { classifyChangedPath } from "./routing-config.mjs";

export function validateGroups(testIds) {
  for (const groupName of Object.keys(TEST_GROUPS)) {
    if (resolveGroupTestIds(groupName, testIds).length === 0) throw new Error(`Test group ${groupName} resolved to no tests.`);
  }
}

export function buildSelection({ changedFiles = [], testIds, level = "fast", explicitName, explicitGroup } = {}) {
  changedFiles = changedFiles.map((file) => ({ ...file, path: normalizeRepoPath(file.path) }));
  validateGroups(testIds);
  if (explicitName) {
    if (!testIds.includes(explicitName)) throw new Error(`Unknown test ID: ${explicitName}`);
    return { verificationLevel: level, directGroups: [], dependentGroups: [], selectedTestIds: [explicitName], syntaxFiles: [], fullSuiteRequired: false, reasons: [{ testId: explicitName, reason: "Explicit named test." }] };
  }
  if (explicitGroup) {
    const groups = expandGroups([explicitGroup], { includeDependents: level === "affected" });
    return fromGroups({ groups, directGroups: [explicitGroup], changedFiles, testIds, level, reasons: [{ group: explicitGroup, reason: "Explicit group." }] });
  }
  const directGroups = new Set(); const reasons = []; let fullSuiteRequired = level === "full";
  let noTestsReason = null;
  for (const file of changedFiles) {
    const classification = classifyChangedPath(file.path);
    if (classification.fullSuite) { fullSuiteRequired = true; reasons.push({ path: file.path, reason: classification.reason, matchedRule: classification.pattern?.source }); }
    if (classification.groups) { classification.groups.forEach((group) => directGroups.add(group)); reasons.push({ path: file.path, groups: classification.groups, matchedRule: classification.pattern.source }); }
    if (classification.testFromMatch) {
      const id = classification.match[1];
      if (testIds.includes(id)) { reasons.push({ path: file.path, testId: id, reason: "Changed focused test." }); }
      else { fullSuiteRequired = true; reasons.push({ path: file.path, reason: "Unknown focused test file requires full verification." }); }
    }
    if (classification.noTestsReason) noTestsReason = classification.noTestsReason;
  }
  if (changedFiles.length === 0 && !fullSuiteRequired) noTestsReason = "No changed files were found.";
  if (fullSuiteRequired) {
    return { verificationLevel: "full", directGroups: [...directGroups], dependentGroups: [], affectedGroups: Object.keys(TEST_GROUPS), selectedTestIds: [...testIds].sort(), syntaxFiles: changedFiles.filter((file) => file.changeType !== "deleted" && /\.(?:js|mjs|ts)$/.test(file.path)).map((file) => file.path), fullSuiteRequired: true, reasons, noTestsReason: null };
  }
  const groups = expandGroups([...directGroups], { includeDependents: level === "affected" });
  const selection = fromGroups({ groups, directGroups: [...directGroups], changedFiles, testIds, level: fullSuiteRequired ? "full" : level, reasons, fullSuiteRequired });
  const changedTestIds = changedFiles.map((file) => file.path.match(/^test\/(.+)\.test\.mjs$/)?.[1]).filter((id) => testIds.includes(id));
  selection.selectedTestIds = [...new Set([...selection.selectedTestIds, ...changedTestIds])].sort();
  selection.noTestsReason = selection.selectedTestIds.length === 0 ? noTestsReason ?? "No explicit route selected tests." : null;
  return selection;
}

function fromGroups({ groups, directGroups, changedFiles, testIds, level, reasons, fullSuiteRequired = false }) {
  const selectedTestIds = groups.flatMap((group) => resolveGroupTestIds(group, testIds));
  const dependentGroups = groups.filter((group) => !directGroups.includes(group));
  return { verificationLevel: level, directGroups, dependentGroups, affectedGroups: groups, selectedTestIds: [...new Set(selectedTestIds)].sort(), syntaxFiles: changedFiles.filter((file) => file.changeType !== "deleted" && /\.(?:js|mjs|ts)$/.test(file.path)).map((file) => file.path), fullSuiteRequired, reasons };
}
