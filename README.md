# Shortform Forge

Local-first V0 for producing traceable short-form video candidates from authorized source footage.

The current vertical is clipping: authorized source video -> transcript import -> heuristic passage analysis -> vertical render with captions -> automatic QA -> candidate MP4 plus structured artifacts.

## Architecture

- `src/domain`: Zod contracts, caption generation and heuristic scoring.
- `src/application`: workflow orchestration and artifact persistence.
- `src/adapters`: FFmpeg/ffprobe and process execution boundaries.
- `src/cli.ts`: human/Codex-friendly CLI.

External media work stays behind adapters so FFmpeg or transcription providers can be replaced later without rewriting the domain.

## Prerequisites

- Node.js 22+
- pnpm
- FFmpeg with ffprobe on `PATH`

No API key is required for the V0. Transcription currently means importing a structured transcript supplied with the authorized source. The included sample command generates legal test media and a human-authored fixture transcript.

## Install

```bash
pnpm install
pnpm run build
```

## Commands

Generate a legal local sample:

```bash
pnpm sf make-sample -o samples
```

Run the full clipping workflow:

```bash
pnpm sf clip samples/authorized-sample.mp4 \
  --transcript samples/authorized-sample.transcript.json \
  --provenance samples/authorized-sample.provenance.json \
  --job demo
```

Outputs are written to `output/<job>/`:

- `source.json`
- `transcript.json`
- `analysis.json`
- `captions.ass`
- `candidate.mp4`
- `qa.json`

## Quality

```bash
pnpm run type-check
pnpm test
```

The QA step checks file presence, readability, dimensions, duration, audio and caption sidecar presence.

## V0 Limits

- No autonomous downloader, platform publishing or scheduler.
- No paid ASR provider is wired in yet.
- Scoring is deterministic and heuristic, not a claim about virality.
- Reframing is center-crop 9:16, not face/object tracking.

## Next Priorities

1. Add a real ASR adapter behind the transcript port.
2. Improve reframing with face/saliency detection when needed.
3. Persist job history in SQLite once repeated local sessions need querying.
