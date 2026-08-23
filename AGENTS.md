# AGENTS.md

## Project Doctrine

Shortform Forge is not a TikTok generator. It is a local-first workflow engine for short-form content production, with TikTok likely as the first proving ground but without coupling the core to any platform.

Conceptual workflow: `DISCOVER -> DECIDE/SCORE -> PRODUCE -> QA -> HUMAN REVIEW -> PUBLISH -> MEASURE/LEARN`.

Current V0 scope: manually triggered discovery of content signals plus clipping of authorized source media into a vertical candidate with captions, structured artifacts, and QA. Do not build autonomous 24/7 automation, fragile scraping, publishing APIs, dashboards, cloud infrastructure, billing, auth, or speculative platform abstractions yet.

Principle: LLM for judgment; deterministic code/tools for execution. Prefer mature OSS/GitHub tools before paid services. Do not reimplement generic media, ASR, codec, subtitle, or probing primitives when a maintained package/CLI exists. MCPIMP may be used when it helps discover or reuse a relevant capability, skill, or MCP.

Use TypeScript first. Use Python only at boundaries where the ecosystem clearly warrants it. Keep SOLID, dependency inversion, separation of concerns, high cohesion/low coupling, DDD and TDD pragmatic rather than ceremonial. Local-first until a real cloud need exists.

Rights and provenance are mandatory. The workflow is for user-owned, explicitly authorized, or open/generated test content. Human review remains required before publication.

Discovery signals are not authorized production sources. They may inform topics, formats, velocity, creators, and angles; clipping still requires explicit rights/provenance.

Before adding a significant dependency, check license, maintenance, adoption, activity, security posture, API/CLI fit, and alternatives. If a low-risk decision is reversible, proceed without asking. If a structural decision is genuinely ambiguous, compare options briefly before committing.

## Map

- Product context: `docs/PRODUCT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Engineering practices: `docs/ENGINEERING.md`
- Roadmap boundaries: `docs/ROADMAP.md`
- Workflow skill: `.agents/skills/shortform-forge-workflow/SKILL.md`

## Required Validation

Before delivery after significant code changes, run:

```bash
pnpm run build
pnpm run type-check
pnpm test
node dist/cli.js --version
pnpm sf doctor
```

Run a real clipping smoke test when workflow behavior changes. If ASR dependencies are unavailable, report the exact `sf doctor` failure and still verify `--transcript` fallback.
