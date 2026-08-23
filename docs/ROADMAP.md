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

## Next

1. Voiceover audio for produced videos (external or local TTS, still capability-driven).
2. Improve ASR setup ergonomics and model guidance.
3. Add language-aware scoring, starting with French and English.

## Later

- Discovery/trends.
- Better scoring with LLM or hybrid ranking.
- Platform-specific publish preparation.
- Measurement and learning loop.
- Cloudflare control-plane/storage/orchestration if local workflows outgrow manual sessions.

## Not Yet

No TikTok/YouTube/Instagram APIs, auto-publishing, scheduler, daemon, dashboard, Redis, queues, microservices, SaaS/auth/billing, Blender, ComfyUI, advanced face tracking, or AI video generation.
