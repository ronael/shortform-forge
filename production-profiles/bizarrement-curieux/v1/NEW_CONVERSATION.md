# Resume Bizarrement Curieux In A New Conversation

Give the new agent this instruction:

```md
Resume the `bizarrement-curieux-v1` production profile. Before doing anything,
read `AGENTS.md`, `docs/CURIOUS_QUESTIONS_PROFILE.md`, and
`production-profiles/bizarrement-curieux/v1/README.md`. Also read
`docs/WORKSTATIONS.md` when the conversation runs on Windows or will hand work
to the RTX 4080 machine. Identify the current host before choosing providers.
Run
`pnpm curious:v1 doctor --locale fr-FR`. Do not modify V1 design tokens,
providers, voices, Remotion components, caption geometry, or audio targets.
Create a new episode manifest and a subject-specific shot plan, synthesize the
voice at natural speed, rebuild timings from its SRT, then run the staged
production and QA commands. Do not use OverlayMotion unless I explicitly select
`bizarrement-curieux-v2-overlay`. Never publish, commit, or push without my
review.
```

On Windows, use the machine as a production worker rather than a second source
of truth. Keep the same episode manifest and output layout, pass
`--browser-executable` if Chrome is installed outside the detected locations,
and return the final media with its manifest, QA report, and SHA-256 checksum.
Large working directories and provider caches stay outside Git and are cleaned
only after human review confirms which result must be retained.

For an existing reference episode, first run:

```bash
pnpm curious:v1 verify-reference --locale fr-FR
```

If it reports missing release media, use the retained local files under
`output/series/` or hydrate them from the approved release once its URL has been
recorded. A missing reference archive must not be solved by silently changing
the profile.
