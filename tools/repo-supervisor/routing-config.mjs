// Intent: conservatively map repository paths to stable test groups or explicit escalations.
export const ROUTING_RULES = [
  { pattern: /^(?:docs\/|[^/]+\.md$|README\.md|features\.md|AGENTS\.md|finalisework\/)/, classification: "documentation", noTestsReason: "All changed files matched explicit documentation-only routing rules." },
  { pattern: /^(?:tools\/repo-supervisor\/|test\/(?:run-tests|test-registry|test-groups|test-runner-core|test-harness-registration|repo-supervisor)\.|package\.json$)/, classification: "tooling", fullSuite: true, reason: "Test harness or supervisor changed." },
  { pattern: /^test\/(.+)\.test\.mjs$/, classification: "test", testFromMatch: true },
  { pattern: /^(?:project-media\/.*|SaveTestFile\/.*|logs\/.*|test-results\/.*|.*\.scriv\/.*|.*\.abe-project(?:\.json)?\/.*|.*\.(?:png|jpe?g|gif|svg|mp3|wav|webm|docx|pdf|rtf|abe-project\.json))$/, classification: "static", noTestsReason: "All changed files matched explicit static-data routing rules." },
  { pattern: /^apps\/editor\/public\/app\.js$/, classification: "source", fullSuite: true, reason: "Cross-cutting editor shell changed." },
  { pattern: /^apps\/editor\/public\/(?:state\/project-|adapters\/storage\/(?:project-|editor-storage|scrivener-import-service)|shared\/project-|serva-vitae-project-library)/, classification: "source", groups: ["editor", "project"] },
  { pattern: /^apps\/editor\//, classification: "source", groups: ["editor"] },
  { pattern: /^apps\/desktop\//, classification: "source", groups: ["desktop"] },
  { pattern: /^services\/analysis\//, classification: "source", groups: ["localAi"] },
  { pattern: /^services\/audio\//, classification: "source", groups: ["narration"] },
  { pattern: /^services\/voice\//, classification: "source", groups: ["voice"] },
  { pattern: /^services\/local-ai\//, classification: "source", groups: ["localAi"] },
  { pattern: /^packages\//, classification: "source", fullSuite: true, reason: "Shared package contract changed." },
  { pattern: /^(?:scripts\/|\.github\/|Run Tests\.bat$)/, classification: "configuration", fullSuite: true, reason: "Repository workflow configuration changed." },
];

export function classifyChangedPath(path) {
  for (const rule of ROUTING_RULES) {
    const match = path.match(rule.pattern);
    if (match) return { ...rule, match };
  }
  return { classification: "unknown", fullSuite: true, reason: "Unknown changed path requires conservative full verification." };
}
