import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { CandidateSegment, QaReport, Transcript } from "../domain/contracts.js";
import { buildAssCaptions, checkCaptionCompleteness } from "../domain/captions.js";
import { runProcess } from "./process.js";
import type { MediaProbe, MediaToolkit, QaRequest, RenderRequest } from "../application/ports.js";

const ProbeStreamSchema = z.object({
  codec_type: z.string(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional()
});

const ProbeSchema = z.object({
  streams: z.array(ProbeStreamSchema),
  format: z.object({
    duration: z.string().optional(),
    size: z.string().optional()
  })
});

export async function probeMedia(videoPath: string): Promise<MediaProbe> {
  const result = await runProcess("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    videoPath
  ]);
  const parsed = ProbeSchema.parse(JSON.parse(result.stdout));
  const video = parsed.streams.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams.find((stream) => stream.codec_type === "audio");
  if (!video?.width || !video.height) throw new Error(`No readable video stream found in ${videoPath}`);
  return {
    durationSeconds: Number(parsed.format.duration ?? 0),
    width: video.width,
    height: video.height,
    hasAudio: Boolean(audio),
    ...(video.codec_name ? { videoCodec: video.codec_name } : {}),
    ...(audio?.codec_name ? { audioCodec: audio.codec_name } : {}),
    sizeBytes: Number(parsed.format.size ?? 0)
  };
}

export async function probeDurationSeconds(filePath: string): Promise<number> {
  const result = await runProcess("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    filePath
  ]);
  const parsed = z.object({ format: z.object({ duration: z.string().optional() }) }).parse(JSON.parse(result.stdout));
  const duration = Number(parsed.format.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`No readable duration in ${filePath}`);
  return duration;
}

/** Concatenates audio files into one WAV (same durations order). */
export async function concatAudioFiles(inputPaths: string[], outputPath: string): Promise<void> {
  if (inputPaths.length === 0) throw new Error("concatAudioFiles requires at least one input");
  const inputs = inputPaths.flatMap((inputPath) => ["-i", inputPath]);
  const labels = inputPaths.map((_, index) => `[${index}:a]`).join("");
  await runProcess("ffmpeg", [
    "-y",
    ...inputs,
    "-filter_complex",
    `${labels}concat=n=${inputPaths.length}:v=0:a=1[out]`,
    "-map",
    "[out]",
    outputPath
  ]);
}

export class FfmpegMediaToolkit implements MediaToolkit {
  probe(videoPath: string): Promise<MediaProbe> {
    return probeMedia(videoPath);
  }

  renderVerticalClip(input: RenderRequest): Promise<string> {
    return renderVerticalClip(input);
  }

  qaVideo(input: QaRequest): Promise<QaReport> {
    return qaVideo(input);
  }
}

export async function renderVerticalClip(input: {
  sourcePath: string;
  transcript: Transcript;
  candidate: CandidateSegment;
  outputDir: string;
}): Promise<string> {
  await mkdir(input.outputDir, { recursive: true });
  const captionsPath = path.join(input.outputDir, "captions.ass");
  const outputPath = path.join(input.outputDir, "candidate.mp4");
  await writeFile(captionsPath, buildAssCaptions(input.transcript, input.candidate), "utf8");

  const duration = input.candidate.endSeconds - input.candidate.startSeconds;
  const subtitles = escapeFilterPath(captionsPath);
  await runProcess("ffmpeg", [
    "-y",
    "-ss",
    input.candidate.startSeconds.toFixed(3),
    "-t",
    duration.toFixed(3),
    "-i",
    input.sourcePath,
    "-vf",
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles='${subtitles}'`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outputPath
  ]);
  return outputPath;
}

export async function qaVideo(input: {
  videoPath: string;
  expectedDurationSeconds: number;
  expectedWidth: number;
  expectedHeight: number;
  captionsPath: string;
  transcript: Transcript;
  candidate: CandidateSegment;
}): Promise<QaReport> {
  const checks: QaReport["checks"] = [];
  const fileStat = await stat(input.videoPath).catch(() => undefined);
  checks.push(fileStat && fileStat.size > 10_000
    ? { name: "file_present", status: "pass", detail: `${fileStat.size} bytes` }
    : { name: "file_present", status: "fail", detail: "output file is missing or too small" });

  const probe = fileStat ? await probeMedia(input.videoPath) : undefined;
  checks.push(probe
    ? { name: "container_readable", status: "pass", detail: `${probe.videoCodec ?? "unknown"} / ${probe.audioCodec ?? "no audio"}` }
    : { name: "container_readable", status: "fail", detail: "ffprobe could not read output" });
  checks.push(probe?.width === input.expectedWidth && probe.height === input.expectedHeight
    ? { name: "dimensions", status: "pass", detail: `${probe.width}x${probe.height}` }
    : { name: "dimensions", status: "fail", detail: `expected ${input.expectedWidth}x${input.expectedHeight}` });
  checks.push(probe && Math.abs(probe.durationSeconds - input.expectedDurationSeconds) < 1.0
    ? { name: "duration", status: "pass", detail: `${probe.durationSeconds.toFixed(2)}s` }
    : { name: "duration", status: "fail", detail: `expected about ${input.expectedDurationSeconds.toFixed(2)}s` });
  checks.push(probe?.hasAudio
    ? { name: "audio", status: "pass", detail: probe.audioCodec ?? "audio stream present" }
    : { name: "audio", status: "fail", detail: "audio stream missing" });
  const captionStat = await stat(input.captionsPath).catch(() => undefined);
  checks.push(captionStat && captionStat.size > 100
    ? { name: "captions", status: "pass", detail: `${captionStat.size} bytes ASS sidecar rendered into video` }
    : { name: "captions", status: "fail", detail: "caption sidecar missing or empty" });
  const captions = captionStat ? await readFile(input.captionsPath, "utf8").catch(() => undefined) : undefined;
  const completeness = captions ? checkCaptionCompleteness(captions, input.transcript, input.candidate) : undefined;
  checks.push(completeness?.status === "pass"
    ? {
        name: "caption_completeness",
        status: "pass",
        detail: `${completeness.renderedWordCount}/${completeness.expectedWordCount} expected words represented`
      }
    : {
        name: "caption_completeness",
        status: "fail",
        detail: completeness
          ? `missing words: ${[...new Set(completeness.missingWords)].slice(0, 12).join(", ")}`
          : "caption sidecar could not be read"
      });

  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    generatedAt: new Date().toISOString(),
    videoPath: input.videoPath,
    checks
  };
}

export async function createSampleAsset(outputDir: string): Promise<{ videoPath: string; transcriptPath: string; provenancePath: string }> {
  await mkdir(outputDir, { recursive: true });
  const videoPath = path.join(outputDir, "authorized-sample.mp4");
  const transcriptPath = path.join(outputDir, "authorized-sample.transcript.json");
  const provenancePath = path.join(outputDir, "authorized-sample.provenance.json");
  await runProcess("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=1280x720:rate=30:duration=48",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=48",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    videoPath
  ]);
  await writeFile(transcriptPath, JSON.stringify({
    sourceId: "sample",
    language: "en",
    provider: "human-authored-fixture",
    segments: [
      { startSeconds: 0, endSeconds: 8, text: "Welcome to a legal generated test asset for short form production." },
      { startSeconds: 8, endSeconds: 17, text: "The mistake most creators make is clipping moments without a clear standalone hook." },
      { startSeconds: 17, endSeconds: 27, text: "Here is why this matters: a viewer decides in seconds whether the idea is worth attention." },
      { startSeconds: 27, endSeconds: 38, text: "A strong clip has surprise, simple context, useful payoff, and captions that stay readable." },
      { startSeconds: 38, endSeconds: 48, text: "This sample proves the pipeline can produce a vertical candidate with traceable provenance." }
    ]
  }, null, 2), "utf8");
  await writeFile(provenancePath, JSON.stringify({
    rights: "generated_test_asset",
    note: "Generated locally with FFmpeg lavfi testsrc2 and sine filters for end-to-end testing. No third-party footage."
  }, null, 2), "utf8");
  return { videoPath, transcriptPath, provenancePath };
}

function escapeFilterPath(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}
