import path from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type { CompositionPlan, Layer, VideoArtifact } from "../domain/composition.js";
import { captionStyleDefinition, highlightAssKeywords, wrapCaptionLines } from "../domain/captions.js";
import type { QaReport } from "../domain/contracts.js";
import { ensureDir } from "../application/files.js";
import type { CompositionRenderer } from "../application/ports.js";
import { probeMedia } from "./ffmpeg.js";
import { runProcess } from "./process.js";

export class FfmpegCompositionRenderer implements CompositionRenderer {
  readonly renderer = "ffmpeg-composition";

  async render(plan: CompositionPlan, outputDir: string): Promise<VideoArtifact> {
    await ensureDir(outputDir);
    const captionsPath = path.join(outputDir, "captions.ass");
    const outputPath = path.join(outputDir, "video.mp4");
    await writeFile(captionsPath, buildCompositionAss(plan), "utf8");

    const assetLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "asset" }> => layer.kind === "asset");

    const inputs: string[] = [];
    const filters: string[] = [];
    assetLayers.forEach((layer, index) => {
      const duration = layer.endSeconds - layer.startSeconds;
      const label = `b${index}`;
      if (layer.asset.kind === "color") {
        inputs.push("-f", "lavfi", "-i", `color=c=${layer.asset.hex}:s=${plan.width}x${plan.height}:r=${plan.fps}:d=${duration.toFixed(3)}`);
        filters.push(`[${index}:v]fps=${plan.fps},setsar=1[${label}]`);
      } else if (layer.asset.mediaType === "image") {
        inputs.push("-loop", "1", "-framerate", String(plan.fps), "-t", duration.toFixed(3), "-i", layer.asset.path);
        filters.push(`[${index}:v]scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase,crop=${plan.width}:${plan.height},fps=${plan.fps},setsar=1[${label}]`);
      } else {
        inputs.push("-stream_loop", "-1", "-t", duration.toFixed(3), "-i", layer.asset.path);
        filters.push(`[${index}:v]scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase,crop=${plan.width}:${plan.height},fps=${plan.fps},setsar=1[${label}]`);
      }
    });

    const concatInputs = assetLayers.map((_, index) => `[b${index}]`).join("");
    filters.push(`${concatInputs}concat=n=${assetLayers.length}:v=1:a=0[cat]`);
    filters.push(`[cat]subtitles='${escapeFilterPath(captionsPath)}'[out]`);

    await runProcess("ffmpeg", [
      "-y",
      ...inputs,
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
      "-filter_complex", filters.join(";"),
      "-map", "[out]",
      "-map", `${assetLayers.length}:a`,
      "-t", plan.durationSeconds.toFixed(3),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-shortest",
      outputPath
    ], 600_000);

    const qa = await qaComposition({ videoPath: outputPath, plan, captionsPath });
    const qaPath = path.join(outputDir, "qa.json");
    await writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`, "utf8");

    const outputStat = await stat(outputPath);
    return {
      path: outputPath,
      width: plan.width,
      height: plan.height,
      fps: plan.fps,
      durationSeconds: plan.durationSeconds,
      sizeBytes: outputStat.size,
      qaPath,
      producedAt: new Date().toISOString(),
      provenance: {
        renderer: this.renderer,
        note: "Rendered locally from a validated CompositionPlan. Caption and title text come from the script plan."
      }
    };
  }
}

export function buildCompositionAss(plan: CompositionPlan): string {
  const textLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "text" }> => layer.kind === "text");
  const captionLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "captions" }> => layer.kind === "captions");

  const events: string[] = [];
  for (const layer of textLayers) {
    const alignment = layer.position === "top" ? 8 : layer.position === "center" ? 5 : 2;
    const lines = wrapTitleLines(layer.text).map((line) => escapeAssText(line));
    events.push(`Dialogue: 1,${formatAssTime(layer.startSeconds)},${formatAssTime(layer.endSeconds)},Title,,0,0,${alignment},,${lines.join("\\N")}`);
  }
  const captionStyles = new Set<string>();
  for (const layer of captionLayers) {
    captionStyles.add(captionStyleDefinition(layer.style));
    for (const cue of layer.cues) {
      const escaped = wrapCaptionLines(cue.text).map((line) => escapeAssText(line));
      const lines = layer.style === "keyword-highlight"
        ? escaped.map((line) => highlightAssKeywords(line, layer.keywordsToEmphasize))
        : escaped;
      events.push(`Dialogue: 0,${formatAssTime(cue.startSeconds)},${formatAssTime(cue.endSeconds)},Caption,,0,0,0,,${lines.join("\\N")}`);
    }
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${plan.width}
PlayResY: ${plan.height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${[...captionStyles].join("\n")}
Style: Title,Arial,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,2,8,90,90,140,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export async function qaComposition(input: {
  videoPath: string;
  plan: CompositionPlan;
  captionsPath: string;
}): Promise<QaReport> {
  const checks: QaReport["checks"] = [];
  const fileStat = await stat(input.videoPath).catch(() => undefined);
  checks.push(fileStat && fileStat.size > 10_000
    ? { name: "file_present", status: "pass", detail: `${fileStat.size} bytes` }
    : { name: "file_present", status: "fail", detail: "output file is missing or too small" });

  const probe = fileStat ? await probeMedia(input.videoPath).catch(() => undefined) : undefined;
  checks.push(probe
    ? { name: "container_readable", status: "pass", detail: `${probe.videoCodec ?? "unknown"} / ${probe.audioCodec ?? "no audio"}` }
    : { name: "container_readable", status: "fail", detail: "ffprobe could not read output" });
  checks.push(probe?.width === input.plan.width && probe.height === input.plan.height
    ? { name: "dimensions", status: "pass", detail: `${probe.width}x${probe.height}` }
    : { name: "dimensions", status: "fail", detail: `expected ${input.plan.width}x${input.plan.height}` });
  checks.push(probe && Math.abs(probe.durationSeconds - input.plan.durationSeconds) < 1.0
    ? { name: "duration", status: "pass", detail: `${probe.durationSeconds.toFixed(2)}s` }
    : { name: "duration", status: "fail", detail: `expected about ${input.plan.durationSeconds.toFixed(2)}s` });
  checks.push(probe?.hasAudio
    ? { name: "audio", status: "pass", detail: probe.audioCodec ?? "audio stream present" }
    : { name: "audio", status: "fail", detail: "audio stream missing" });
  const captions = await readFile(input.captionsPath, "utf8").catch(() => undefined);
  checks.push(captions && captions.includes("Dialogue:")
    ? { name: "captions", status: "pass", detail: `${captions.split("Dialogue:").length - 1} subtitle events` }
    : { name: "captions", status: "fail", detail: "caption sidecar missing or empty" });

  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    generatedAt: new Date().toISOString(),
    videoPath: input.videoPath,
    checks
  };
}

const MAX_TITLE_CHARS_PER_LINE = 16;

function wrapTitleLines(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > MAX_TITLE_CHARS_PER_LINE && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function escapeFilterPath(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function escapeAssText(text: string): string {
  return text.replace(/[{}]/g, "").replace(/\n/g, "\\N");
}

function formatAssTime(totalSeconds: number): string {
  const centiseconds = Math.round(totalSeconds * 100);
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
