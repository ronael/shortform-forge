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
- Voiceover: script sections synthesized locally through a provider-agnostic TTS port (`SF_TTS_COMMAND`), with REAL measured durations as the temporal backbone of the composition.
- Produce V1: voiceover-driven re-timing, ai-news composition template, real voice track, captions synced to measured audio.

## Next

1. Human validation loop on produced videos (watch, list blocking defects, fix).
2. Word-level caption timing via whisper.cpp on generated audio.
3. Asset resolver (local library first, then external sources with provenance).
4. Improve ASR setup ergonomics and model guidance.

## Later

- Discovery/trends.
- Better scoring with LLM or hybrid ranking.
- Platform-specific publish preparation.
- Measurement and learning loop.
- Cloudflare control-plane/storage/orchestration if local workflows outgrow manual sessions.

## Not Yet

No TikTok/YouTube/Instagram APIs, auto-publishing, scheduler, daemon, dashboard, Redis, queues, microservices, SaaS/auth/billing, Blender, ComfyUI, advanced face tracking, or AI video generation.
