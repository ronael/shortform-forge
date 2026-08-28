# Roadmap

## Now

- Solid local clipping workflow.
- Provenance and structured artifacts.
- Local ASR via whisper.cpp.
- Deterministic baseline scoring.
- Automatic QA and human-review handoff.
- Discovery V0 through normalized signals and deterministic opportunity scoring.
- Opportunity analysis: scored opportunities turned into validated production briefs via a provider-agnostic language model port.
- Script generation: production briefs turned into validated, timed script plans (voiceover sections, visual plan, caption guidance).
- Produce V0: script plans rendered into 1080x1920 videos (color/image/video section backgrounds, title card, ASS captions, QA) via an FFmpeg adapter behind a `CompositionRenderer` port.
- Voiceover: script sections synthesized locally through provider-agnostic single or batch TTS ports, with measured speech controlling caption timing while preserving the editorial duration.
- Produce V1: editorial-duration composition, real voice track, independent dressing/caption profiles, focal framing, optional licensed music bed, and captions synced to measured audio.

## Next

1. Human validation loop on produced videos (watch, list blocking defects, fix).
2. Word-level caption timing via whisper.cpp on generated audio.
3. Asset resolver (local library first, then external sources with provenance).
4. Improve ASR setup ergonomics and model guidance.

## Later

- Discovery/trends.
- Better scoring with LLM or hybrid ranking.
- Evaluate [HeliosGen](https://github.com/segfault42/heliosgen) as an experimental `ImageProvider`/`VideoProvider` or provider-orchestration reference when AI generation enters scope. Its control plane is self-hostable, but current model execution primarily uses paid Kie.ai credits; verify output quality, cost, provider coupling, API automation, maintenance, and provenance before integration.
- Evaluate [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) as an MIT-licensed full-pipeline benchmark and isolated POC for `EditingProvider`, `AssetProvider`, TTS, captions, and music. Compare one identical production brief through its CLI/API against Shortform Forge before wrapping any capability; do not adopt its autonomous/publishing surface. Bundled music with unclear YouTube-derived rights may be enabled explicitly, provided generation emits a prominent terminal warning and records the provenance status for human review without blocking generation or deciding publishability.
- Platform-specific publish preparation.
- Measurement and learning loop.
- Cloudflare control-plane/storage/orchestration if local workflows outgrow manual sessions.

## Not Yet

No TikTok/YouTube/Instagram APIs, auto-publishing, scheduler, daemon, dashboard, Redis, queues, microservices, SaaS/auth/billing, Blender, ComfyUI, advanced face tracking, or AI video generation.
