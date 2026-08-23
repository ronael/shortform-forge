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

Script generation (`src/application/generateScript.ts`) turns a `ProductionBrief` into a validated `ScriptPlan` (`src/domain/script.ts`): title, hook, timed sections with voiceover, visual plan, caption guidance. Deterministic code owns the prompt, the temporal invariants (ordered, non-overlapping sections bounded by `durationSeconds`) and validation; the language model only writes. Both LLM capabilities share the same `LanguageModelProvider` port and the same response extraction helper (`src/application/llmJson.ts`).

Production (`src/application/produceVideo.ts` + `src/application/composeVideo.ts`) turns a `ScriptPlan` into a `CompositionPlan` (`src/domain/composition.ts`: fixed 1080x1920@30 canvas, asset/text/captions layers with temporal invariants), then renders it through the `CompositionRenderer` port. The V0 adapter is `FfmpegCompositionRenderer`: per-section color/image/video backgrounds concatenated, title and captions rendered via ASS subtitles (reusing the caption style helpers), silent AAC track, QA via ffprobe. The domain never sees FFmpeg, filtergraphs, or codecs. V0 assets are local files or color backgrounds only; `AssetReference.kind` is the extension point for future url/generated/capture assets. A Remotion adapter remains possible later behind the same port if layouts outgrow FFmpeg.

Shortform Forge is a capability toolkit, not an agent: it exposes CLI commands and application functions that an external orchestrator (Codex, Claude Code, Kimi, MCP, a human) calls. It never schedules, loops, or decides on its own.
