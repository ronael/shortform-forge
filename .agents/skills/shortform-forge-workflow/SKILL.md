---
name: shortform-forge-workflow
description: Run Shortform Forge local clipping workflows. Use when Codex needs to inspect authorized source media, verify provenance, run `sf` commands, produce a vertical short-form candidate, run QA, and report output artifacts for human review.
---

# Shortform Forge Workflow

Use this skill to execute the existing Shortform Forge workflow, not to invent new product surfaces.

## Procedure

1. Inspect repository state: `git status --short`, `pnpm run build`, and current README/docs if needed.
2. Inspect the input. Confirm it is user-owned, authorized, open-licensed, or generated test media. If provenance is unclear, stop and ask for rights/provenance before producing a candidate.
3. Run dependency checks:

```bash
pnpm sf doctor
```

4. If no real input is provided, generate legal sample media:

```bash
pnpm sf make-sample -o samples
```

5. Prefer the high-level workflow:

```bash
pnpm sf clip <video.mp4> --provenance <provenance.json> --job <job-name>
```

Use a manual transcript when ASR should be overridden or cached explicitly:

```bash
pnpm sf clip <video.mp4> --transcript <transcript.json> --provenance <provenance.json> --job <job-name>
```

6. Inspect `output/<job>/source.json`, `transcript.json`, `analysis.json`, `qa.json`, and `candidate.mp4`.
7. Report the selected candidate, QA status, important failures, and paths to artifacts. Do not imply the video is published; human review is required.

## Guardrails

- Keep the workflow local-first and manually triggered.
- Do not add trend crawlers, publishing APIs, dashboard, scheduler, cloud infrastructure, or speculative platform abstractions.
- Preserve structured artifacts and provenance.
- Run `pnpm run build`, `pnpm run type-check`, and `pnpm test` after code changes.
