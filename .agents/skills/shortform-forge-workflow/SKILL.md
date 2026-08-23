---
name: shortform-forge-workflow
description: Run Shortform Forge local discovery and clipping workflows. Use when Codex needs to discover content signals, inspect opportunities, verify source provenance, run `sf` commands, produce a vertical short-form candidate, run QA, and report output artifacts for human review.
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

4. For discovery, collect signals without treating them as authorized media:

```bash
pnpm sf discover youtube "<query>" --limit 30
pnpm sf discover import signals.json
```

Inspect `output/discovery/<run-id>/opportunities.json`, then analyze the top entries into production briefs:

```bash
pnpm sf analyze output/discovery/<run-id>/opportunities.json --index 0          # needs SF_LLM_COMMAND
pnpm sf analyze output/discovery/<run-id>/opportunities.json --index 0 --prompt # print the prompt, answer it yourself
```

The resulting `brief-<signal-id>.json` (hook, adaptation ideas, format, difficulty, potential, risks) supports the Codex/human decision on what to produce. From an approved brief, generate a timed script plan:

```bash
pnpm sf script output/discovery/<run-id>/brief-<signal-id>.json          # needs SF_LLM_COMMAND
pnpm sf script output/discovery/<run-id>/brief-<signal-id>.json --prompt # print the prompt, answer it yourself
```

The resulting `script-<signal-id>.json` (title, hook, timed voiceover sections, visual plan, caption guidance) is the input for production. Render it into a vertical video with local assets named after section purposes:

```bash
pnpm sf produce output/discovery/<run-id>/script-<signal-id>.json --assets ./assets
```

Check `output/produce/<id>/qa.json` and review `video.mp4` before considering anything publishable.

5. If no real clipping input is provided, generate legal sample media:

```bash
pnpm sf make-sample -o samples
```

6. Prefer the high-level clipping workflow:

```bash
pnpm sf clip <video.mp4> --provenance <provenance.json> --job <job-name>
```

Use a manual transcript when ASR should be overridden or cached explicitly:

```bash
pnpm sf clip <video.mp4> --transcript <transcript.json> --provenance <provenance.json> --job <job-name>
```

7. Inspect `output/<job>/source.json`, `transcript.json`, `analysis.json`, `qa.json`, and `candidate.mp4`.
8. Report the selected candidate, QA status, important failures, and paths to artifacts. Do not imply the video is published; human review is required.

## Guardrails

- Keep the workflow local-first and manually triggered.
- Do not add trend crawlers, publishing APIs, dashboard, scheduler, cloud infrastructure, or speculative platform abstractions.
- Preserve structured artifacts and provenance.
- Never treat a discovery signal as reusable media without explicit rights.
- Run `pnpm run build`, `pnpm run type-check`, and `pnpm test` after code changes.
