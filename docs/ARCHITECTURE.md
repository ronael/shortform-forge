# Architecture

Shortform Forge uses a small hexagonal shape without ceremony:

- `src/domain`: contracts, captions, deterministic scoring.
- `src/application`: workflow orchestration, ports, file helpers, analyzer composition.
- `src/adapters`: FFmpeg/ffprobe, whisper.cpp ASR, process execution, doctor checks.
- `src/cli.ts`: composition root and human/Codex command surface.

The application layer depends on ports:

- `MediaToolkit`: probe, render, QA.
- `TranscriptionProvider`: produce normalized `Transcript`.
- `PassageAnalyzer`: rank transcript passages.

Adapters can change from FFmpeg or whisper.cpp later without rewriting the workflow. Current reframing is a center-crop 9:16 render; the architecture allows replacing the renderer when face/saliency tracking becomes justified.

The baseline scorer is deterministic and heuristic. It is not a virality model. It is behind `PassageAnalyzer` so French heuristics, LLM scoring, hybrid ranking, or learned ranking can be added later.

No database is used yet. Transcript caching is filesystem/content-hash based because that solves the current repeated-ASR problem without SQLite.
