# Feature Work Agent

Use when implementing an author-facing feature addition or behaviour change, or when handling `Feature working` or `bench`. Do not load it for read-only inspection, navigation, or debugging that does not change author-facing behaviour.

## Required behaviour

- Treat the numbered feature set in `features.md` as the feature record. Find and read only the relevant numbered section and matching `Feature Implementation Index` entry; never preload the file.
- For an author-facing implementation/change, add a concise process header in the relevant bounded `features.md` section that states the author workflow and owning service level. Decide whether it belongs in an existing service or requires a new service boundary.
- In the same work, update the matching numbered feature section with author-facing behaviour, persistence/rendering implications, and implementation location. If no exact section fits, use the closest product pillar and state the classification.
- When the user says `Feature working`, treat it as acceptance. Before proceeding, update the feature section and its Implementation Index entry. The index must use product language, name the main modules/functions and navigable line references, summarize user interaction through persistence/rendering, and record tests or manual verification.
- Do not add feature-specific logic to `apps/editor/public/app.js` when a feature slice, state module, adapter, shared helper, service, or package owns it. Load `EditorAgent.md` only if the editor boundary itself changes.

## Bench workflow

When the user says `bench` a feature or UI element, preserve the function/service logic unless deletion is explicit. Disable or omit only its live entry point or render path and put a concise `BENCHED:` intent comment immediately above it, explaining why it is parked and what remains available. Do not comment out the core function body.

Feature documentation is not a reason to load `DocumentationAgent.md`; load it only when documentation ownership or source-of-truth structure changes.
