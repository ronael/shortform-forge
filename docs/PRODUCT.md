# Product

Shortform Forge exists so a Codex session can process a content opportunity and produce a clean short-form video candidate without rediscovering media operations, transcript handling, caption rendering, QA, and artifact structure every time.

The product is broader than TikTok. TikTok is the likely first experimentation platform, but the core should stay about short-form workflow production.

## V0

The current vertical is authorized clipping:

`source video -> provenance -> transcription -> passage analysis -> scoring -> vertical render -> captions -> QA -> human review`

The system must preserve structured artifacts under `output/<job>/`: source metadata, transcript, analysis, captions, candidate MP4, and QA.

Discovery V0 adds a separate signal workflow:

`source/search -> discover -> normalize -> derive metrics -> score/filter -> opportunities -> Codex/human judgment`

A discovery signal is not a clipping source. External videos can indicate topics, formats, velocity, creators, or angles, but they do not imply download/reuse rights.

Opportunity analysis closes the loop between discovery and production:

`opportunity -> language model analysis -> validated ProductionBrief -> script generation -> validated ScriptPlan -> composition -> rendered VideoArtifact -> QA -> human review`

Deterministic code owns facts, metrics, prompts, temporal invariants and validation; the language model only judges (why it works, hook type, adaptation ideas) and writes (voiceover, visual plan). Rendering stays behind a `CompositionRenderer` port so the engine can change without touching the domain.

## Future Context, Not Current Scope

Possible monetization paths include Creator Rewards, authorized paid clipping, affiliate content, products, and other models. Do not code these until validated by a product need.

Possible future formats include clipping, international trend adaptation, storytelling, manga/gaming, 3D, motion design, data visualization, and AI video. Do not build abstractions for all formats now.

Platforms may expand from TikTok to YouTube Shorts and Instagram Reels. Avoid platform coupling, but do not build a sophisticated multi-platform layer yet.

Cloudflare may later become a light control-plane, storage, or orchestration layer. For now the product is local-first and manually triggered by the user/Codex.
