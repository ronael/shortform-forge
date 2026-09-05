# Architecture

Shortform Forge uses a small hexagonal shape without ceremony:

- `src/domain`: contracts, captions, deterministic scoring.
- `src/application`: workflow orchestration, ports, file helpers, analyzer composition.
- `src/adapters`: FFmpeg/ffprobe, whisper.cpp ASR, yt-dlp discovery, process execution, doctor checks.
- `src/cli.ts`: composition root and human/Codex command surface.

The application layer depends on ports:

- `MediaToolkit`: probe, render, QA.
- `TranscriptionProvider`: produce normalized `Transcript`.
- `PassageAnalyzer`: rank transcript passages.
- `DiscoverySource`: collect normalized discovery signals.
- `LanguageModelProvider`: generate text from a prompt (analysis capabilities).

Adapters can change from FFmpeg or whisper.cpp later without rewriting the workflow. Current reframing is a center-crop 9:16 render; the architecture allows replacing the renderer when face/saliency tracking becomes justified.

The baseline scorer is deterministic and heuristic. It is not a virality model. It is behind `PassageAnalyzer` so French heuristics, LLM scoring, hybrid ranking, or learned ranking can be added later.

No database is used yet. Transcript caching is filesystem/content-hash based because that solves the current repeated-ASR problem without SQLite.

Discovery artifacts live under `output/discovery/<run-id>/` and keep run metadata, normalized signals, raw adapter data, warnings, derived metrics, and scored opportunities.

Opportunity Score V0 is deterministic and transparent: it computes available factors (`velocity`, `engagement`, `recency`, `outperformance`, `scale`) and averages only the factors present. Missing platform metrics are warnings or omissions, not implicit zeros.

Opportunity analysis (`src/application/analyzeOpportunity.ts`) turns one scored opportunity into a validated `ProductionBrief` (`src/domain/opportunity.ts`). Deterministic code builds the prompt from existing signal facts, metrics and score (`src/application/prompts/opportunityBrief.ts`); the language model only judges (hook, adaptation ideas, format, risks) and its response is validated against the `ProductionBrief` Zod contract. The default adapter is `CommandLanguageModelProvider`, which delegates to any local LLM CLI configured via `SF_LLM_COMMAND`; the domain never depends on a specific LLM SDK.

Script generation (`src/application/generateScript.ts`) turns a `ProductionBrief` into a validated `ScriptPlan` (`src/domain/script.ts`): title, hook, timed sections with voiceover, an editorial duration recommendation, visual plan, separate caption/dressing guidance, and music intent. Deterministic code owns the prompt, temporal invariants and validation; the language model chooses and explains the editorial target. Both LLM capabilities share the same `LanguageModelProvider` port and response extraction helper.

Production (`src/application/produceVideo.ts` + `src/application/composeVideo.ts`) turns a `ScriptPlan` into a `CompositionPlan` (`src/domain/composition.ts`: fixed 1080x1920@30 canvas, asset/text/captions layers with temporal invariants), then renders it through the `CompositionRenderer` port. The FFmpeg adapter handles focal-point-aware framing, light scrims, independent structured dressing profiles, kinetic captions, and an optional licensed `audioBed` mixed with ducking into stereo 48 kHz. It writes contact-sheet, duration, narration-coverage, audio-format and music-provenance QA. With `SF_WHISPER_MODEL`, the optional word timing provider aligns tokens back to canonical script text; low coverage falls back to proportional timing. The domain never sees FFmpeg, filtergraphs, or codecs.

Production may also delegate a complete baseline render to an external pipeline. MoneyPrinterTurbo 1.3.5 is the validated default for the `narrated-montage` profile: voice, phrase-timed captions, ordered assets, music, transitions, and final composition. Structured dressing remains optional and may be applied afterward by a separate provider when the brief needs ranks, metrics, title cards, branding, or calls to action. Provider decisions and their evidence live in `docs/PRODUCTION_PROVIDERS.md`; no external pipeline owns the `ProductionBrief` or QA contract.

Voiceover (`src/application/generateVoiceover.ts`) synthesizes and measures one audio file per section through `TextToSpeechProvider`. Measured speech controls caption timing, but no longer replaces the editorial video duration. New artifacts allocate the remaining budget as short visual holds and real audio padding; legacy artifacts remain contiguous and hold only the final scene. Providers may expose `synthesizeBatch`, used by the command batch adapter to load expensive local models once and clean its temporary request. Templates remain plain composition strategies, not a template engine.

Shortform Forge is a capability toolkit, not an agent: it exposes CLI commands and application functions that an external orchestrator (Codex, Claude Code, Kimi, MCP, a human) calls. It never schedules, loops, or decides on its own.

The optional operator dashboard is a local adapter over generated artifacts. It
indexes immutable files from `output/`, stores human decisions separately by
checksum, and exposes manually triggered publishing providers. It must not
become part of the render pipeline, mutate masters, schedule work, or make the
final publication decision. TikTok credentials live in the operating-system
secret store rather than artifacts or repository configuration.
