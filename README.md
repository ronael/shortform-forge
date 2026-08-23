# Shortform Forge

Local-first V0 for producing traceable short-form video candidates from authorized source footage.

The current vertical is clipping: authorized source video -> local ASR or transcript import -> heuristic passage analysis -> vertical render with captions -> automatic QA -> candidate MP4 plus structured artifacts.

## Architecture

- `src/domain`: Zod contracts, caption generation and heuristic scoring.
- `src/application`: workflow orchestration, ports and artifact persistence.
- `src/adapters`: FFmpeg/ffprobe, whisper.cpp ASR, doctor checks and process execution boundaries.
- `src/cli.ts`: human/Codex-friendly CLI.

External media, ASR, QA and scoring work stay behind ports so adapters can be replaced later without rewriting the workflow.

## Prerequisites

- Node.js 22+
- pnpm
- FFmpeg with ffprobe on `PATH`
- whisper.cpp `whisper-cli` on `PATH`
- a local ggml Whisper model, configured with `SF_WHISPER_MODEL=/path/to/ggml-model.bin`

No API key is required for the V0. ASR uses local whisper.cpp. Manual transcript import remains supported as an override/cache path.

Check setup:

```bash
pnpm sf doctor
```

On macOS, whisper.cpp can be installed with Homebrew:

```bash
brew install whisper-cpp
export SF_WHISPER_MODEL=/path/to/ggml-base.en.bin
```

Models are available from the whisper.cpp model collection, for example on Hugging Face under `ggerganov/whisper.cpp`.

If the macOS Metal backend crashes in a sandboxed environment, force CPU mode:

```bash
export SF_WHISPER_NO_GPU=1
```

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
pnpm sf clip path/to/video.mp4 --provenance path/to/provenance.json --job demo
```

Use a manual transcript override:

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

ASR cache is stored under `.sf-cache/transcripts/<source-hash>/` and is safe to delete.

## Quality

```bash
pnpm run build
pnpm run type-check
pnpm test
node dist/cli.js --version
```

The QA step checks file presence, readability, dimensions, duration, audio and caption sidecar presence.

## V0 Limits

- No autonomous downloader, platform publishing or scheduler.
- ASR is local whisper.cpp only; no diarization or paid ASR provider is wired in.
- Scoring is deterministic and heuristic, not a claim about virality.
- Reframing is center-crop 9:16, not face/object tracking.

## ASR Choice

Selected: `whisper.cpp`, MIT licensed, mature, local/offline, CLI-friendly, Apple Silicon optimized and portable. It avoids adding Python to the core workflow.

Rejected for now:

- OpenAI Whisper Python: mature and MIT, but introduces Python/PyTorch setup for a boundary that whisper.cpp handles well.
- faster-whisper: strong option for a future Python ASR adapter, but heavier than needed for V0 CLI integration.

## Next Priorities

1. Improve ASR setup ergonomics and model recommendations.
2. Add language-aware scoring, starting with French and English.
3. Improve reframing with face/saliency detection when needed.
