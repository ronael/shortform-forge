# AGENTS.md

## Project Doctrine

Shortform Forge is not a TikTok generator. It is a local-first workflow engine for short-form content production, with TikTok likely as the first proving ground but without coupling the core to any platform.

It is also not an agent. It is a capability toolkit: business capabilities (`discover`, `analyze`, `clip`) are invoked by an external orchestrator (Codex, Claude Code, Kimi, MCP, a human). Never build autonomous loops, schedulers, agent memory, or self-triggering workflows into the tool itself.

Conceptual workflow: `DISCOVER -> DECIDE/SCORE -> PRODUCE -> QA -> HUMAN REVIEW -> PUBLISH -> MEASURE/LEARN`.

Current scope: manually triggered discovery and production of authorized short-form media, structured QA, plus a local operator dashboard for review, device download, and explicitly triggered TikTok draft upload. Do not build autonomous 24/7 automation, fragile scraping, scheduled/direct publishing, public dashboard hosting, cloud infrastructure, billing, multi-user auth, or speculative platform abstractions yet.

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
- Production provider decisions: `docs/PRODUCTION_PROVIDERS.md`
- Mac/Windows execution policy: `docs/WORKSTATIONS.md`
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
