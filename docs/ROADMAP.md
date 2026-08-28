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
2. Human-review the completed dressing-only Revideo POC over the validated MoneyPrinterTurbo actors video; technical QA passed without replacing its voice, captions, music, or edit.
3. Run a 30-second MoneyPrinterTurbo POC whose script word budget targets the requested duration and whose asset cuts follow dialogue-section timestamps instead of fixed four-second blocks.
4. Run one topic-only MoneyPrinterTurbo POC to validate automatic script and asset selection; the completed actors POC used a supplied script and supplied assets.
5. Word-level caption timing via whisper.cpp on generated audio.
6. Asset resolver (local library first, then external sources with provenance).
7. Improve ASR setup ergonomics and model guidance.

## Later

- Discovery/trends.
- Better scoring with LLM or hybrid ranking.
- Evaluate [HeliosGen](https://github.com/segfault42/heliosgen) as an experimental `ImageProvider`/`VideoProvider` or provider-orchestration reference when AI generation enters scope. Its control plane is self-hostable, but current model execution primarily uses paid Kie.ai credits; verify output quality, cost, provider coupling, API automation, maintenance, and provenance before integration.
- MoneyPrinterTurbo 1.3.5 is the validated baseline for `narrated-montage` videos and produced the closest result to the current publication bar in the actors Top 5 POC. Reuse it for voice-led explainers, facts, stories, advice, travel, motivation, simple listicles, and faceless stock-footage videos while other providers are tested. Treat structured editorial dressing as an optional downstream capability. Bundled music with unclear YouTube-derived rights may be enabled explicitly, provided generation emits a prominent terminal warning and records the provenance status for human review without blocking generation or deciding publishability.
- Platform-specific publish preparation.
- Measurement and learning loop.
- Cloudflare control-plane/storage/orchestration if local workflows outgrow manual sessions.

## Not Yet

No TikTok/YouTube/Instagram APIs, auto-publishing, scheduler, daemon, dashboard, Redis, queues, microservices, SaaS/auth/billing, Blender, ComfyUI, advanced face tracking, or AI video generation.
