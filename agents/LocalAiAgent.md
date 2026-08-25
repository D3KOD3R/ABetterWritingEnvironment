# Local AI Agent

Use only for product Local AI work: `services/local-ai`, author-facing local-AI settings/features, or local manuscript/world analysis integration.

## Required boundaries

- Local AI is an author product capability, privacy-first and usable offline where core workflows require it. Keep model providers abstracted from manuscript/world schemas and editor presentation.
- Keep analysis, issue generation, event pinning, continuity checks, entity extraction, and world-template/link suggestions under `services/analysis` or their explicit service contracts; return actionable, anchor-backed results.
- Suggestions affecting canonical world or manuscript data remain advisory, evidence-backed, traceable, and user-accepted before mutation.
- Do not assume cloud execution for core writing analysis. Provider availability, errors, retries, and disabled states belong behind service/provider interfaces.
- This agent does **not** govern developer repo-supervisor, Ollama, or local tooling experiments. Load `TestSupervisorAgent.md` for supervisor work instead.
