# Workstations

Shortform Forge can be operated from both the Mac and the Windows RTX 4080
machine. They have different responsibilities, but they use the same repository,
production profiles, manifests, QA rules, and artifact layout.

## Host responsibilities

### Mac: control and review host

Use the Mac by default for:

- product and editorial decisions;
- scripts, manifests, factual sources, and asset selection;
- normal MoneyPrinterTurbo and Remotion productions;
- technical QA and human review;
- the local operator dashboard;
- account connection, download, and manually triggered publication workflows.

The Mac remains the source of truth for accepted profiles and review decisions.

### Windows RTX 4080: GPU production worker

Use Windows when a task materially benefits from NVIDIA acceleration or a larger
temporary workspace:

- WanGP text-to-video and image-to-video benchmarks;
- local Ollama or other supported LLM inference for provider POCs;
- heavier image or video generation models that fit the available VRAM;
- upscaling, interpolation, denoising, or batch transcoding benchmarks;
- experiments that download large checkpoints or create large intermediate
  frames.

The RTX 4080 is an optional execution provider, not a separate architecture and
not a reason to move orchestration, QA, or publishing into the production core.

## Starting a Codex conversation on Windows

Before changing or generating anything:

1. Read `AGENTS.md`, `docs/ROADMAP.md`, this file, and the relevant provider or
   production-profile documentation.
2. Inspect `git status` and the latest commits. Never discard work that came
   from another machine.
3. Confirm the host, GPU model, available VRAM, free disk space, Node, pnpm,
   FFmpeg, Python, CUDA, and the provider-specific environment.
4. Run `pnpm install --frozen-lockfile`, `pnpm run build`, and `pnpm sf doctor`
   before using the core workflow.
5. State whether the task is a reproducible production or an isolated POC.

Use this prompt when opening a fresh Windows conversation:

```md
You are working on `shortform-forge` from the Windows RTX 4080 production
worker. Before doing anything, read `AGENTS.md`, `docs/ROADMAP.md`,
`docs/WORKSTATIONS.md`, and the documentation for the selected provider or
production profile. Inspect `git status`, recent commits, GPU/VRAM, free disk
space, and tool versions. Keep production contracts and manifests identical to
the Mac workflow. Use Windows only for the GPU-bound or disk-heavy execution
requested in this task. Do not change an accepted profile, publish, commit, or
push without explicit approval. Keep large checkpoints, caches, frames, and
working renders outside Git. Return the retained result with its manifest, QA
report, runtime, peak VRAM when available, disk usage, and SHA-256 checksum.
Clean only disposable files created by this run after the retained artifacts
have been identified.
```

## Artifact handoff

Every result returned from Windows must include:

- the exact input manifest and provider/profile version;
- the final retained media or a stable local/shared path to it;
- technical and visual QA reports;
- runtime, resolution, frame rate, duration, and relevant GPU measurements;
- checkpoint/model name and license notes for generated media;
- SHA-256 checksums for retained inputs and outputs;
- a short list of unresolved visual or licensing risks.

Do not move generated masters into Git. Source-controlled recipes reference
artifacts by stable identifiers and checksums, while large media remains in the
approved artifact storage or `output/` workspace.

## Temporary-space policy

- Put disposable checkouts, extracted frames, model downloads, and provider
  caches on the machine with enough free space.
- Keep each experiment under a distinct run directory so cleanup cannot affect
  another production.
- Never treat `output/**/result/`, approved source assets, manifests, QA reports,
  or checksummed masters as temporary.
- Before cleanup, write a small inventory containing retained paths, sizes, and
  checksums.
- Remove only the working directory, temporary checkout, and run-specific cache
  created by the completed experiment.
- Shared model checkpoints may be retained when reuse is likely; record their
  size and location instead of downloading duplicates.

## Current Windows queue

1. Run the retained WanGP 12.647 RTX 4080 benchmark defined in
   `docs/PRODUCTION_PROVIDERS.md` and its benchmark manifest.
2. Configure Ollama or another supported LLM for the topic-only
   MoneyPrinterTurbo POC, then test automatic script and stock-asset selection.
3. Use the GPU worker for a new complex-video provider only after its license,
   model size, expected VRAM, disk cost, and success criteria are recorded.

The curious-question V1 profile remains frozen. A GPU experiment may supply a
replaceable source clip, but it must not silently change the accepted captions,
dressing, voice, timing, or QA rules.
