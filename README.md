# Shortform Forge

Local-first V0 for producing traceable short-form video candidates from authorized source footage.

The current verticals are:

- discovery: external content signals -> normalization -> derived metrics -> opportunity shortlist.
- clipping: authorized source video -> local ASR or transcript import -> heuristic passage analysis -> vertical render with captions -> automatic QA -> candidate MP4 plus structured artifacts.

## Architecture

- `src/domain`: Zod contracts, caption generation, clipping scoring, discovery metrics, opportunity scoring and production brief contracts.
- `src/application`: workflow orchestration, ports, prompts and artifact persistence.
- `src/adapters`: FFmpeg/ffprobe, whisper.cpp ASR, yt-dlp discovery, generic LLM CLI provider, doctor checks and process execution boundaries.
- `src/cli.ts`: human/Codex-friendly CLI.

External media, ASR, QA and scoring work stay behind ports so adapters can be replaced later without rewriting the workflow.

## Prerequisites

- Node.js 22+
- pnpm
- FFmpeg with ffprobe on `PATH`
- whisper.cpp `whisper-cli` on `PATH`
- a local ggml Whisper model, configured with `SF_WHISPER_MODEL=/path/to/ggml-model.bin`
- yt-dlp on `PATH` for YouTube discovery

No API key is required for the V0. ASR uses local whisper.cpp. Manual transcript import remains supported as an override/cache path.

Check setup:

```bash
pnpm sf doctor
```

If `SF_WHISPER_MODEL` is not set, `doctor` reports a warning: discovery and transcript-override clipping still work, but local ASR clipping needs a model.

Discovery through YouTube uses `yt-dlp` without downloading videos:

```bash
brew install yt-dlp
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

Discover YouTube signals:

```bash
pnpm sf discover youtube "ai tools" --limit 30
```

Import normalized signals gathered elsewhere:

```bash
pnpm sf discover import signals.json
```

Discovery outputs are written to `output/discovery/<run-id>/`:

- `run.json`
- `signals.json`
- `opportunities.json`

A discovery signal is not an authorized production source. Discovery artifacts are for topic, format, velocity and opportunity analysis; clipping still requires user-owned, authorized, open-licensed, or generated source media.

Analyze a discovered opportunity into a production brief:

```bash
pnpm sf analyze output/discovery/<run-id>/opportunities.json --index 0
```

Analysis uses any local LLM CLI configured with `SF_LLM_COMMAND` (a command that reads the prompt on stdin, for example `SF_LLM_COMMAND="ollama run llama3.1"`). Without a provider, print the prompt and let the orchestrating agent answer it itself:

```bash
pnpm sf analyze output/discovery/<run-id>/opportunities.json --prompt
```

The validated brief is written to `brief-<signal-id>.json` next to the opportunities artifact.

Generate a script plan from a brief:

```bash
pnpm sf script output/discovery/<run-id>/brief-<signal-id>.json
```

Same provider rules as `analyze` (`SF_LLM_COMMAND`, or `--prompt` to let the orchestrating agent write the plan). The validated plan is written to `script-<signal-id>.json` next to the brief.

Produce a vertical video from a script plan:

```bash
pnpm sf produce output/discovery/<run-id>/script-<signal-id>.json --assets ./assets
```

Assets are optional local files named after section purposes (`hook.png`, `explanation.mp4`, ...); sections without a matching file get a color background. Outputs land in `output/produce/<id>/`: `composition.json`, `video.mp4`, `qa.json`, `artifact.json`. Videos are rendered locally with FFmpeg.

Add a local voiceover (real audio, captions synced to measured speech):

```bash
export SF_TTS_COMMAND="python .tts-models/say.py {output}"   # any local TTS CLI: text on stdin, audio at {output}
pnpm sf voiceover output/discovery/<run-id>/script-<signal-id>.json -o output/voiceover/<signal-id>
pnpm sf produce output/discovery/<run-id>/script-<signal-id>.json \
  --voiceover output/voiceover/<signal-id>/voiceover.json \
  --assets ./assets --template ai-news
```

The voiceover is synthesized per section and its durations are MEASURED (never assumed from the script); sections, captions and video length follow the real audio.

Local Kokoro setup used for development (Apache-2.0 model, French voices, CPU):

```bash
python3 -m venv .venv-tts
.venv-tts/bin/pip install kokoro-onnx soundfile
mkdir -p .tts-models && cd .tts-models
curl -sLO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -sLO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

with `.tts-models/say.py` reading text on stdin and writing `$1` (`kokoro_onnx.Kokoro(...).create(text, voice="ff_siwis", lang="fr-fr")` + `soundfile.write`). Both `.venv-tts/` and `.tts-models/` are gitignored.

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
It also checks caption completeness by comparing the selected transcript words with the generated ASS dialogue text before rendering.

The automated `make-sample` workflow uses FFmpeg test video, sine audio, and a transcript fixture. It is deterministic and validates rendering/QA, but it does not validate ASR quality.

For a real local ASR smoke test with a legal short voice sample:

```bash
curl -L --fail https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav -o /tmp/sf-jfk.wav
ffmpeg -y -f lavfi -i testsrc2=size=1280x720:rate=30:duration=12 -i /tmp/sf-jfk.wav -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest /tmp/sf-jfk.mp4
printf '%s\n' '{"rights":"open_license","note":"Local ASR smoke asset built from whisper.cpp sample jfk.wav and FFmpeg testsrc2.","sourceUrl":"https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav"}' > /tmp/sf-jfk-provenance.json
SF_WHISPER_MODEL=/path/to/ggml-tiny.en.bin SF_WHISPER_NO_GPU=1 pnpm sf clip /tmp/sf-jfk.mp4 --provenance /tmp/sf-jfk-provenance.json --output /tmp/sf-output --cache /tmp/sf-cache --job asr-smoke
```

## V0 Limits

- No autonomous downloader, platform publishing or scheduler.
- YouTube discovery uses `yt-dlp` metadata/search only; it does not download videos.
- ASR is local whisper.cpp only; no diarization or paid ASR provider is wired in.
- Scoring is deterministic and heuristic, not a claim about virality.
- Reframing is center-crop 9:16, not face/object tracking.

## Discovery Choice

Selected: `yt-dlp`, Unlicense, mature, actively maintained, CLI-friendly, macOS-ready, no API key, supports YouTube search metadata through `ytsearchN:` and JSON output without downloading media.

Rejected for now:

- `youtube-search-python`: original project is archived; maintained forks are smaller and add Python for a use case `yt-dlp` already covers.
- Custom YouTube HTTP client: unnecessary and more fragile than a maintained extractor.

## ASR Choice

Selected: `whisper.cpp`, MIT licensed, mature, local/offline, CLI-friendly, Apple Silicon optimized and portable. It avoids adding Python to the core workflow.

Rejected for now:

- OpenAI Whisper Python: mature and MIT, but introduces Python/PyTorch setup for a boundary that whisper.cpp handles well.
- faster-whisper: strong option for a future Python ASR adapter, but heavier than needed for V0 CLI integration.

## Next Priorities

1. Improve ASR setup ergonomics and model recommendations.
2. Add language-aware scoring, starting with French and English.
3. Improve reframing with face/saliency detection when needed.
