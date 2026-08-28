import path from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import type { CompositionPlan, Layer, VideoArtifact } from "../domain/composition.js";
import { captionAnimation, captionStyleDefinition, highlightAssKeywords, wrapCaptionLines } from "../domain/captions.js";
import type { QaReport } from "../domain/contracts.js";
import { ensureDir } from "../application/files.js";
import type { CompositionRenderer } from "../application/ports.js";
import { probeMedia } from "./ffmpeg.js";
import { runProcess } from "./process.js";

export class FfmpegCompositionRenderer implements CompositionRenderer {
  readonly renderer = "ffmpeg-composition";

  async render(plan: CompositionPlan, outputDir: string, options?: {
    audioPath?: string;
    audioBed?: { path: string; provenance: string; gainDb?: number; ducking?: boolean };
  }): Promise<VideoArtifact> {
    await ensureDir(outputDir);
    const captionsPath = path.join(outputDir, "captions.ass");
    const outputPath = path.join(outputDir, "video.mp4");
    const contactSheetPath = path.join(outputDir, "contact-sheet.jpg");
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
        filters.push(`[${index}:v]${assetFramingFilter(layer, plan)},fps=${plan.fps},setsar=1[${label}]`);
      } else {
        inputs.push("-stream_loop", "-1", "-t", duration.toFixed(3), "-i", layer.asset.path);
        filters.push(`[${index}:v]${assetFramingFilter(layer, plan)},fps=${plan.fps},setsar=1[${label}]`);
      }
    });

    const concatInputs = assetLayers.map((_, index) => `[b${index}]`).join("");
    filters.push(`${concatInputs}concat=n=${assetLayers.length}:v=1:a=0[cat]`);
    const scrim = buildScrimFilter(plan);
    if (scrim) {
      filters.push(`[cat]${scrim}[readable]`);
      filters.push(`[readable]subtitles='${escapeFilterPath(captionsPath)}'[out]`);
    } else {
      filters.push(`[cat]subtitles='${escapeFilterPath(captionsPath)}'[out]`);
    }

    const voiceInputIndex = assetLayers.length;
    const audioInputs = options?.audioPath
      ? ["-i", options.audioPath]
      : ["-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${plan.durationSeconds.toFixed(3)}`];
    filters.push(`[${voiceInputIndex}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad,atrim=duration=${plan.durationSeconds.toFixed(3)}[voice]`);
    if (options?.audioBed) {
      const musicInputIndex = voiceInputIndex + 1;
      const gainDb = options.audioBed.gainDb ?? -25;
      const fadeOutStart = Math.max(0, plan.durationSeconds - 0.6);
      audioInputs.push("-stream_loop", "-1", "-i", options.audioBed.path);
      filters.push(`[${musicInputIndex}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=duration=${plan.durationSeconds.toFixed(3)},asetpts=PTS-STARTPTS,volume=${gainDb}dB,afade=t=in:st=0:d=0.35,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.6[music]`);
      if (options.audioBed.ducking !== false && options.audioPath) {
        filters.push("[voice]asplit=2[voice_mix][voice_side]");
        filters.push("[music][voice_side]sidechaincompress=threshold=0.025:ratio=8:attack=20:release=300[ducked]");
        filters.push("[voice_mix][ducked]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.92[aout]");
      } else {
        filters.push("[voice][music]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.92[aout]");
      }
    } else {
      filters.push("[voice]anull[aout]");
    }

    await runProcess("ffmpeg", [
      "-y",
      ...inputs,
      ...audioInputs,
      "-filter_complex", filters.join(";"),
      "-map", "[out]",
      "-map", "[aout]",
      "-t", plan.durationSeconds.toFixed(3),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-ac", "2",
      "-movflags", "+faststart",
      outputPath
    ], 600_000);

    await createContactSheet(outputPath, contactSheetPath, plan);
    const qa = await qaComposition({
      videoPath: outputPath,
      plan,
      captionsPath,
      contactSheetPath,
      ...(options?.audioBed ? { audioBedProvenance: options.audioBed.provenance } : {})
    });
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
        note: options?.audioBed
          ? `Rendered locally from a validated CompositionPlan with audio bed: ${options.audioBed.provenance}`
          : "Rendered locally from a validated CompositionPlan. Caption and dressing text come from the script plan."
      }
    };
  }
}

export function buildCompositionAss(plan: CompositionPlan): string {
  const textLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "text" }> => layer.kind === "text");
  const captionLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "captions" }> => layer.kind === "captions");

  const events: string[] = [];
  for (const layer of textLayers) {
    events.push(...buildDressingEvents(layer));
  }
  const captionStyles = new Set<string>();
  for (const layer of captionLayers) {
    captionStyles.add(captionStyleDefinition(layer.style));
    for (const cue of layer.cues) {
      const escaped = wrapCaptionLines(cue.text).map((line) => escapeAssText(line));
      const lines = layer.style === "keyword-highlight"
        ? escaped.map((line) => highlightAssKeywords(line, layer.keywordsToEmphasize))
        : escaped;
      events.push(`Dialogue: 0,${formatAssTime(cue.startSeconds)},${formatAssTime(cue.endSeconds)},Caption,,0,0,0,,${captionAnimation(layer.style)}${lines.join("\\N")}`);
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
Style: EditorialTitle,Arial,82,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,2,7,65,65,100,1
Style: Eyebrow,Arial,28,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,2,1,7,65,65,100,1
Style: Rank,Arial,150,&H0000D7FF,&H0000D7FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,4,2,9,60,60,100,1
Style: Headline,Arial,68,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,4,2,7,65,65,100,1
Style: Metric,Arial,38,&H00000000,&H00000000,&H0000D7FF,&H00000000,-1,0,0,0,100,100,0,0,1,9,0,7,65,65,100,1
Style: Supporting,Arial,25,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,0,0,0,0,100,100,0,0,1,2,1,7,65,65,100,1
Style: ComedyCard,Arial,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,7,65,65,100,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export async function qaComposition(input: {
  videoPath: string;
  plan: CompositionPlan;
  captionsPath: string;
  contactSheetPath?: string;
  audioBedProvenance?: string;
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
  checks.push(probe?.audioChannels === 2 && probe.audioSampleRate === 48_000
    ? { name: "audio_format", status: "pass", detail: "stereo / 48000 Hz" }
    : { name: "audio_format", status: "fail", detail: "expected stereo / 48000 Hz" });
  if (input.plan.narrationDurationSeconds) {
    const coverage = input.plan.narrationDurationSeconds / input.plan.durationSeconds;
    checks.push(coverage >= 0.85
      ? { name: "narration_coverage", status: "pass", detail: `${Math.round(coverage * 100)}% of editorial duration` }
      : { name: "narration_coverage", status: "fail", detail: `SCRIPT_TOO_SHORT: narration covers ${Math.round(coverage * 100)}% of editorial duration` });
  }
  if (input.audioBedProvenance) {
    checks.push({ name: "music_bed", status: "pass", detail: input.audioBedProvenance });
  }
  const captions = await readFile(input.captionsPath, "utf8").catch(() => undefined);
  checks.push(captions && captions.includes("Dialogue:")
    ? { name: "captions", status: "pass", detail: `${captions.split("Dialogue:").length - 1} subtitle events` }
    : { name: "captions", status: "fail", detail: "caption sidecar missing or empty" });
  const timingSources = [...new Set(input.plan.layers
    .filter((layer): layer is Extract<Layer, { kind: "captions" }> => layer.kind === "captions")
    .map((layer) => layer.timingSource))];
  checks.push({
    name: "caption_timing",
    status: "pass",
    detail: timingSources.includes("word-aligned")
      ? "whisper.cpp word-aligned captions"
      : "proportional fallback (set SF_WHISPER_MODEL for word alignment)"
  });
  if (input.contactSheetPath) {
    const contactSheet = await stat(input.contactSheetPath).catch(() => undefined);
    checks.push(contactSheet && contactSheet.size > 1_000
      ? { name: "framing_contact_sheet", status: "pass", detail: `${contactSheet.size} bytes` }
      : { name: "framing_contact_sheet", status: "fail", detail: "contact sheet missing or empty" });
  }

  return {
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    generatedAt: new Date().toISOString(),
    videoPath: input.videoPath,
    checks
  };
}

function assetFramingFilter(layer: Extract<Layer, { kind: "asset" }>, plan: CompositionPlan): string {
  const fit = layer.placement?.fit ?? "cover";
  if (fit === "contain") {
    return `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=decrease,pad=${plan.width}:${plan.height}:(ow-iw)/2:(oh-ih)/2:${plan.background}`;
  }
  const focalPoint = layer.placement?.focalPoint ?? { x: 0.5, y: 0.5 };
  return [
    `scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase`,
    `crop=${plan.width}:${plan.height}:(in_w-out_w)*${focalPoint.x.toFixed(4)}:(in_h-out_h)*${focalPoint.y.toFixed(4)}`
  ].join(",");
}

function buildScrimFilter(plan: CompositionPlan): string {
  const filters: string[] = [];
  const captionLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "captions" }> => layer.kind === "captions");
  const textLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "text" }> => layer.kind === "text");
  const assetLayers = plan.layers.filter((layer): layer is Extract<Layer, { kind: "asset" }> => layer.kind === "asset");
  const hasCaptionScrim = captionLayers.some((candidate) => candidate.backdrop === "scrim");
  if (!hasCaptionScrim) {
    for (const layer of assetLayers.filter((candidate) => candidate.textBackdrop === "scrim")) {
      const enable = betweenExpression(layer.startSeconds, layer.endSeconds);
      filters.push(`drawbox=x=0:y=ih*0.72:w=iw:h=ih*0.28:color=black@0.06:t=fill:enable='${enable}'`);
      filters.push(`drawbox=x=0:y=ih*0.84:w=iw:h=ih*0.16:color=black@0.10:t=fill:enable='${enable}'`);
    }
  }
  for (const layer of captionLayers.filter((candidate) => candidate.backdrop === "scrim")) {
    const enable = betweenExpression(layer.startSeconds, layer.endSeconds);
    filters.push(`drawbox=x=0:y=ih*0.72:w=iw:h=ih*0.28:color=black@0.06:t=fill:enable='${enable}'`);
    filters.push(`drawbox=x=0:y=ih*0.84:w=iw:h=ih*0.16:color=black@0.10:t=fill:enable='${enable}'`);
  }
  for (const layer of textLayers.filter((candidate) => candidate.backdrop === "scrim")) {
    const enable = betweenExpression(layer.startSeconds, layer.endSeconds);
    const position = layer.position === "bottom" ? "bottom" : "top";
    if (position === "top") {
      filters.push(`drawbox=x=0:y=0:w=iw:h=ih*0.24:color=black@0.05:t=fill:enable='${enable}'`);
      filters.push(`drawbox=x=0:y=0:w=iw:h=ih*0.13:color=black@0.07:t=fill:enable='${enable}'`);
    } else {
      filters.push(`drawbox=x=0:y=ih*0.72:w=iw:h=ih*0.28:color=black@0.10:t=fill:enable='${enable}'`);
    }
    if (layer.profile === "comedy-ranking" && layer.rank && layer.rank !== 1) {
      filters.push(`drawbox=x=45:y=360:w=990:h=150:color=black@0.62:t=fill:enable='${enable}'`);
    }
  }
  return filters.join(",");
}

function betweenExpression(startSeconds: number, endSeconds: number): string {
  return `between(t\\,${startSeconds.toFixed(3)}\\,${endSeconds.toFixed(3)})`;
}

async function createContactSheet(videoPath: string, outputPath: string, plan: CompositionPlan): Promise<void> {
  const scenes = plan.layers.filter((layer): layer is Extract<Layer, { kind: "asset" }> => layer.kind === "asset");
  const frameNumbers = scenes.map((scene) => Math.max(0, Math.round(((scene.startSeconds + scene.endSeconds) / 2) * plan.fps)));
  const select = frameNumbers.map((frame) => `eq(n\\,${frame})`).join("+");
  const columns = Math.min(3, Math.max(1, frameNumbers.length));
  const rows = Math.ceil(frameNumbers.length / columns);
  await runProcess("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-vf", `select=${select},scale=360:640,tile=${columns}x${rows}:padding=4:margin=4:color=black`,
    "-frames:v", "1",
    outputPath
  ], 120_000);
}

function buildDressingEvents(layer: Extract<Layer, { kind: "text" }>): string[] {
  const start = formatAssTime(layer.startSeconds);
  const end = formatAssTime(layer.endSeconds);
  const fade = "{\\fad(80,100)\\fscx96\\fscy96\\t(0,140,\\fscx100\\fscy100)}";
  const accent = assColor(layer.accentColor ?? (layer.profile === "comedy-ranking" ? "#28e0b8" : "#ffd700"));
  const event = (style: string, text: string, tags = "") =>
    `Dialogue: 1,${start},${end},${style},,0,0,0,,${tags}${fade}${escapeAssText(text)}`;

  if (layer.profile === "editorial-ranking") {
    if (layer.rank) {
      return [
        event("Eyebrow", layer.eyebrow ?? "CLASSEMENT", "{\\pos(65,1160)}"),
        event("Rank", String(layer.rank), `{\\pos(990,180)\\1c${accent}}`),
        event("Headline", wrapTitleLines(layer.text, 22).join("\\N"), "{\\pos(65,1220)}"),
        ...(layer.metric ? [event("Metric", ` ${layer.metric} `, `{\\pos(65,1390)\\3c${accent}}`)] : []),
        ...(layer.supportingText ? [event("Supporting", layer.supportingText, "{\\pos(65,1475)}")] : [])
      ];
    }
    return [
      ...(layer.eyebrow ? [event("Eyebrow", layer.eyebrow, "{\\pos(65,115)}")] : []),
      event("EditorialTitle", wrapTitleLines(layer.text, 20).join("\\N"), "{\\pos(65,190)}")
    ];
  }

  if (layer.profile === "comedy-ranking") {
    if (layer.rank) {
      const headline = layer.rank === 1
        ? wrapTitleLines(layer.text, 18).join("\\N")
        : `{\\1c${accent}}${layer.rank}   {\\1c&H00FFFFFF&}${escapeAssText(layer.text)}`;
      return [
        event("Eyebrow", layer.eyebrow ?? (layer.rank === 1 ? "NUMERO 1" : "LE CLASSEMENT AVANCE"), `{\\pos(65,110)\\1c${accent}}`),
        layer.rank === 1
          ? event("EditorialTitle", headline, "{\\pos(65,180)}")
          : `Dialogue: 1,${start},${end},ComedyCard,,0,0,0,,{\\pos(75,400)\\fad(80,100)}${headline}`,
        ...(layer.supportingText ? [event("Supporting", layer.supportingText, "{\\pos(65,620)}")] : [])
      ];
    }
    return [
      ...(layer.eyebrow ? [event("Eyebrow", layer.eyebrow, `{\\pos(65,110)\\1c${accent}}`)] : []),
      event("EditorialTitle", wrapTitleLines(layer.text, 19).join("\\N"), "{\\pos(65,180)}")
    ];
  }

  const alignment = layer.position === "top" ? 8 : layer.position === "center" ? 5 : 2;
  return [event("Title", wrapTitleLines(layer.text).join("\\N"), `{\\an${alignment}}`)];
}

const MAX_TITLE_CHARS_PER_LINE = 16;

function wrapTitleLines(text: string, maxChars = MAX_TITLE_CHARS_PER_LINE): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function assColor(hex: string): string {
  const normalized = hex.replace("#", "");
  const [red, green, blue] = [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];
  return `&H00${blue}${green}${red}&`.toUpperCase();
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
