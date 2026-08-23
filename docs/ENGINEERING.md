# Engineering

Use TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

Keep changes narrow and testable. Prefer ports where they protect a real variation already present: media tooling, transcription, rendering/QA, and scoring. Avoid speculative repositories, services, aggregates, or platform layers.

External process adapters must use explicit timeouts, clear errors, and no silent failures. Missing dependencies should surface through `sf doctor` and structured CLI errors.

Do not commit secrets, generated media, `output/`, `samples/`, `dist/`, or `.sf-cache/`.

Before adding a major dependency, record the choice briefly in docs or README when it affects setup or architecture. Check license, maintenance, adoption, API/CLI fit, security posture, and simpler alternatives.

Validation for significant changes:

```bash
pnpm run build
pnpm run type-check
pnpm test
node dist/cli.js --version
pnpm sf doctor
```

For workflow changes, also run a real `make-sample` + `clip` smoke test. If local ASR is unavailable, run the transcript override path and report the blocker.
