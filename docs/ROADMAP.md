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
- Frozen bilingual `curious-question-v1` production profile, with five accepted French masters, five accepted English masters, reproducible recipes, and an inactive OverlayMotion V2 configuration.
- Local operator dashboard with the accepted dark media-library interface: global review queue, project shelves, video inspector, search and filters, publication calendar, account setup guides, device download, and guarded publishing-provider boundaries.
- Two-workstation execution policy: the Mac remains the default orchestration, review, and publishing host; the Windows RTX 4080 machine is an optional GPU worker for complex footage generation, local models, and disk-heavy provider POCs. See `docs/WORKSTATIONS.md`.

## Next

1. Publish and measure the accepted bilingual `curious-question-v1` profile; its frozen production rules are in `docs/CURIOUS_QUESTIONS_PROFILE.md`.
2. Prepare the next five curious questions from `docs/CURIOUS_QUESTIONS_BACKLOG.md`, with script and asset approval before rendering.
3. Return to provider POCs for a different video format, using the RTX 4080 worker first when the experiment is GPU-bound or creates large temporary artifacts. Do not reopen the accepted curious-question chain without a measured reason.
4. Keep Revideo V4 as the technically valid local fallback and regression benchmark; do not continue template iteration unless Remotion exposes a concrete cost, licensing, or operational blocker.
5. Preserve a clean pre-dressing master on the next production, then move the question open, selected callouts, and branded outro behind the existing `DressingProvider` boundary using OverlayMotion 0.8.0. The full 30-second hybrid V2 passed technical QA with dimmed topic imagery beneath the opening and ending instead of white plates; logo, account name, tagline, theme, imagery, and accent are replaceable render properties.
6. Resume the topic-only MoneyPrinterTurbo POC after configuring either Ollama on the RTX 4080 host or another supported LLM, plus one stock provider. Automatic script and asset quality remain untested.
7. Run the retained WanGP 12.647 GPU benchmark on the RTX 4080: Wan 2.2 TI2V 5B FastWan, profile 4, SDPA, 121 frames, 720x1280, with matched text-to-video and image-to-video variants. The real M1 Max / Wan2.1 1.3B test took 25 minutes for 3.06 seconds and failed popcorn coherence, so do not iterate that profile further. Treat generated footage only as a replaceable `VideoProvider` input and record checkpoint licenses, runtime, peak VRAM, disk cost, and visual QA.
8. Compare Creatomate and Shotstack only after a project/stage key is intentionally created; both unauthenticated probes correctly returned HTTP 401 and produced no render.
9. Turn the MoneyPrinterTurbo horizontal-video failure into an explicit provider input constraint: require portrait clips or focal-aware preprocessing before composition.
10. Word-level caption timing via whisper.cpp on generated audio.
11. Asset resolver (local library first, then external sources with provenance).
12. Improve ASR setup ergonomics and model guidance.
13. Configure the approved TikTok developer application when credentials are available, then validate one real draft upload from the dashboard. Keep the connector disabled until then; the review, copy, and download workflow is already operational.

## Later

- Discovery/trends.
- Better scoring with LLM or hybrid ranking.
- Revisit [HeliosGen](https://github.com/segfault42/heliosgen) only with an approved Kie.ai or Replicate budget. Its app/build POC passed, but no generation could run without those credentials and its optional private Codex-backend wrapper is not a stable production contract.
- Revisit OpenMontage only for a deliberately approved full-system experiment. Its tests and renderers passed, but its pre-authored demo does not validate automatic production and human review rejected its color, text-background, and sizing quality.
- Keep HyperFrames as an experimental option for bespoke motion systems. A deliberately authored ranking excerpt passed phone-scale layout, runtime, and contrast checks, but requires more composition work than OverlayMotion's reusable templates.
- Keep Piper only as an offline draft or emergency fallback; its tested French voice was rejected as too robotic compared with Vivienne.
- MoneyPrinterTurbo 1.3.5 is the validated baseline for `narrated-montage` videos and produced the closest result to the current publication bar in the actors Top 5 POC. Reuse it for voice-led explainers, facts, stories, advice, travel, motivation, simple listicles, and faceless stock-footage videos while other providers are tested. Treat structured editorial dressing as an optional downstream capability. Bundled music with unclear YouTube-derived rights may be enabled explicitly, provided generation emits a prominent terminal warning and records the provenance status for human review without blocking generation or deciding publishability.
- Platform-specific publish preparation.
- Measurement and learning loop.
- Cloudflare control-plane/storage/orchestration if local workflows outgrow manual sessions.
- Evaluate a lightweight, explicit job handoff to the Windows worker only if manual manifest-based transfers become repetitive. Do not introduce a queue or remote execution service before that pain is measured.

## Not Yet

No autonomous or scheduled publishing, public dashboard hosting, YouTube or
Instagram publishing APIs, Redis, queues, microservices, SaaS auth/billing,
Blender, ComfyUI, advanced face tracking, or in-core AI video generation. The
local operator dashboard and its manually triggered TikTok draft adapter are
the only current platform integration. WanGP remains an external provider
experiment.
