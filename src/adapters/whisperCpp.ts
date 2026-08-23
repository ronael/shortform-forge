import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { TranscriptSchema, type Transcript } from "../domain/contracts.js";
import { AppError } from "../domain/errors.js";
import { hashFile } from "../application/hash.js";
import type { TranscriptionProvider, TranscriptionRequest } from "../application/ports.js";
import { slug, writeJson } from "../application/files.js";
import { runProcess } from "./process.js";

const WhisperSegmentSchema = z.object({
  timestamps: z.object({
    from: z.string().optional(),
    to: z.string().optional()
  }).optional(),
  offsets: z.object({
    from: z.number(),
    to: z.number()
  }).optional(),
  text: z.string()
});

const WhisperJsonSchema = z.object({
  params: z.object({
    model: z.string().optional(),
    language: z.string().optional()
  }).optional(),
  result: z.object({
    language: z.string().optional()
  }).optional(),
  transcription: z.array(WhisperSegmentSchema)
});

export type WhisperCppConfig = {
  binaryPath?: string;
  modelPath?: string;
  language?: string;
  noGpu?: boolean;
};

export class WhisperCppTranscriptionProvider implements TranscriptionProvider {
  private readonly binaryPath: string;
  private readonly modelPath: string | undefined;
  private readonly language: string;
  private readonly noGpu: boolean;

  constructor(config: WhisperCppConfig = {}) {
    this.binaryPath = config.binaryPath ?? process.env.SF_WHISPER_CLI ?? "whisper-cli";
    this.modelPath = config.modelPath ?? process.env.SF_WHISPER_MODEL;
    this.language = config.language ?? process.env.SF_WHISPER_LANGUAGE ?? "auto";
    this.noGpu = config.noGpu ?? process.env.SF_WHISPER_NO_GPU === "1";
  }

  async transcribe(input: TranscriptionRequest): Promise<Transcript> {
    if (!this.modelPath) {
      throw new AppError(
        "No whisper.cpp model configured",
        "ASR_MODEL_MISSING",
        "Set SF_WHISPER_MODEL=/path/to/ggml-model.bin. Install whisper.cpp with `brew install whisper-cpp`; get models from https://huggingface.co/ggerganov/whisper.cpp/tree/main."
      );
    }
    await assertReadable(this.modelPath, "ASR_MODEL_MISSING", `Model not found: ${this.modelPath}`);
    const sourceHash = await hashFile(input.source.importedPath);
    const cacheRoot = path.join(input.cacheDir, "transcripts", sourceHash);
    await mkdir(cacheRoot, { recursive: true });
    const providerKey = slug(`whisper-cpp-${path.basename(this.modelPath)}-${this.language}`);
    const cachePath = path.join(cacheRoot, `${providerKey}.json`);
    const cached = await readCachedTranscript(cachePath, input.source.id);
    if (cached) return cached;

    const audioPath = path.join(cacheRoot, "audio.wav");
    const outputBase = path.join(cacheRoot, "whisper");
    await runProcess("ffmpeg", [
      "-y",
      "-i",
      input.source.importedPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      audioPath
    ]);

    const whisperArgs = [
      "-m",
      this.modelPath,
      "-f",
      audioPath,
      "-l",
      this.language,
      "-oj",
      "-of",
      outputBase,
      "-np"
    ];
    if (this.noGpu) whisperArgs.push("-ng");
    await runProcess(this.binaryPath, whisperArgs, 600_000);

    const parsed = WhisperJsonSchema.parse(JSON.parse(await readFile(`${outputBase}.json`, "utf8")));
    const transcript = TranscriptSchema.parse({
      sourceId: input.source.id,
      language: parsed.result?.language ?? parsed.params?.language ?? this.language,
      provider: "whisper.cpp",
      providerVersion: `${this.binaryPath}:${path.basename(this.modelPath)}`,
      sourceHash,
      segments: parsed.transcription
        .map((segment) => ({
          startSeconds: segment.offsets ? segment.offsets.from / 1000 : parseTimestamp(segment.timestamps?.from),
          endSeconds: segment.offsets ? segment.offsets.to / 1000 : parseTimestamp(segment.timestamps?.to),
          text: segment.text.trim()
        }))
        .filter((segment) => segment.text.length > 0 && segment.endSeconds > segment.startSeconds)
    });
    await rm(audioPath, { force: true });
    await rm(`${outputBase}.json`, { force: true });
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeJson(cachePath, transcript);
    return transcript;
  }
}

export function parseWhisperCppJson(raw: unknown, sourceId: string): Transcript {
  const parsed = WhisperJsonSchema.parse(raw);
  return TranscriptSchema.parse({
    sourceId,
    language: parsed.result?.language ?? parsed.params?.language ?? "auto",
    provider: "whisper.cpp",
    segments: parsed.transcription.map((segment) => ({
      startSeconds: segment.offsets ? segment.offsets.from / 1000 : parseTimestamp(segment.timestamps?.from),
      endSeconds: segment.offsets ? segment.offsets.to / 1000 : parseTimestamp(segment.timestamps?.to),
      text: segment.text.trim()
    }))
  });
}

async function readCachedTranscript(cachePath: string, sourceId: string): Promise<Transcript | undefined> {
  const raw = await readFile(cachePath, "utf8").catch(() => undefined);
  if (!raw) return undefined;
  const cached = TranscriptSchema.parse(JSON.parse(raw));
  return TranscriptSchema.parse({ ...cached, sourceId, provider: `${cached.provider} cache` });
}

async function assertReadable(filePath: string, code: string, message: string): Promise<void> {
  const fileStat = await stat(filePath).catch(() => undefined);
  if (!fileStat?.isFile()) throw new AppError(message, code);
}

function parseTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const match = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/.exec(value.trim());
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000;
}
