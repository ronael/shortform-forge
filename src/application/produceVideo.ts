import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { ScriptPlanSchema, type ScriptPlan } from "../domain/script.js";
import { VoiceoverSchema, type Voiceover } from "../domain/voice.js";
import type { CaptionCuePlan, CompositionPlan, VideoArtifact } from "../domain/composition.js";
import { AppError } from "../domain/errors.js";
import type { CompositionRenderer } from "./ports.js";
import { buildCompositionPlan, type SectionAsset } from "./composeVideo.js";
import { composeAiNewsVideo } from "./templates/aiNews.js";
import { retimeScript } from "./generateVoiceover.js";
import { buildVoiceoverCaptionCues } from "./captionTiming.js";
import type { WordTimingProvider } from "./ports.js";
import { ensureDir, readJson, slug, writeJson } from "./files.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm"]);
const AssetManifestSchema = z.object({
  assets: z.array(z.object({
    purpose: z.string().min(1),
    file: z.string().min(1),
    provenance: z.string().min(1),
    fit: z.enum(["cover", "contain"]).default("cover"),
    focalPoint: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1)
    }).default({ x: 0.5, y: 0.5 }),
    textBackdrop: z.enum(["none", "scrim"]).default("none")
  })).min(1)
});

// A script file is either a GeneratedScript artifact ({ plan, ... }) or a raw ScriptPlan.
const ScriptFileSchema = z.union([
  z.object({ plan: ScriptPlanSchema }).passthrough().transform((value) => value.plan),
  ScriptPlanSchema
]);

export async function produceFromScriptFile(input: {
  filePath: string;
  renderer: CompositionRenderer;
  outputRoot: string;
  assetsDir?: string;
  background?: string;
  runId?: string;
  template?: "generic" | "ai-news";
  voiceoverPath?: string;
  wordTimingProvider?: WordTimingProvider;
  audioBedPath?: string;
  audioBedProvenance?: string;
  audioBedGainDb?: number;
}): Promise<{ plan: CompositionPlan; artifact: VideoArtifact; artifactDir: string }> {
  if (input.audioBedPath && !input.audioBedProvenance) {
    throw new AppError("Music provenance is required", "INVALID_INPUT", "Provide the track title, creator, license, and source URL.");
  }
  const resolved = path.resolve(input.filePath);
  let script = await loadScriptPlan(resolved);
  const assets = input.assetsDir ? await resolveSectionAssets(path.resolve(input.assetsDir)) : [];

  let audioPath: string | undefined;
  let voiceover: Voiceover | undefined;
  let captionCues: CaptionCuePlan[] | undefined;
  let captionTimingSource: "word-aligned" | "proportional-fallback" = "proportional-fallback";
  if (input.voiceoverPath) {
    const voiceoverFile = path.resolve(input.voiceoverPath);
    voiceover = await readJson(voiceoverFile, VoiceoverSchema);
    script = retimeScript(script, voiceover);
    audioPath = path.join(path.dirname(voiceoverFile), "voiceover.wav");
    const captionTiming = await buildVoiceoverCaptionCues({
      script,
      voiceover,
      style: script.captionGuidance.style,
      ...(input.wordTimingProvider ? { provider: input.wordTimingProvider } : {})
    });
    captionCues = captionTiming.cues;
    captionTimingSource = captionTiming.timingSource;
  }

  const plan = input.template === "ai-news"
    ? composeAiNewsVideo(script, {
        assets,
        ...(captionCues ? { captionCues } : {}),
        captionTimingSource,
        ...(voiceover ? { narrationDurationSeconds: voiceover.totalDurationSeconds } : {})
      })
    : buildCompositionPlan(script, {
        assets,
        ...(captionCues ? { captionCues } : {}),
        captionTimingSource,
        ...(voiceover ? { narrationDurationSeconds: voiceover.totalDurationSeconds } : {}),
        ...(input.background ? { background: input.background } : {})
      });

  const artifactDir = path.resolve(input.outputRoot, "produce", slug(input.runId ?? script.title));
  await ensureDir(artifactDir);
  await writeJson(path.join(artifactDir, "composition.json"), plan);

  const audioBed = input.audioBedPath && script.musicGuidance.mode !== "off"
    ? {
        path: path.resolve(input.audioBedPath),
        provenance: input.audioBedProvenance!,
        ...(input.audioBedGainDb !== undefined ? { gainDb: input.audioBedGainDb } : {}),
        ducking: Boolean(audioPath)
      }
    : undefined;
  const artifact = await input.renderer.render(plan, artifactDir, {
    ...(audioPath ? { audioPath } : {}),
    ...(audioBed ? { audioBed } : {})
  });
  const withSource = { ...artifact, sourceScriptPath: resolved };
  await writeJson(path.join(artifactDir, "artifact.json"), withSource);
  return { plan, artifact: withSource, artifactDir };
}

export async function loadScriptPlan(filePath: string): Promise<ScriptPlan> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const parsed = ScriptFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      `File is neither a ScriptPlan nor a generated script artifact: ${filePath}`,
      "INVALID_INPUT",
      "Provide a script-<signal-id>.json file produced by `sf script`, or a standalone ScriptPlan JSON object."
    );
  }
  return parsed.data;
}

/**
 * Convention: files in the assets directory are named after script section
 * purposes, e.g. hook.png, explanation.mp4. Only local files, never fetched.
 */
export async function resolveSectionAssets(assetsDir: string): Promise<SectionAsset[]> {
  const entries = await readdir(assetsDir, { withFileTypes: true }).catch(() => {
    throw new AppError(`Assets directory not found: ${assetsDir}`, "INVALID_INPUT", "Create the directory or drop the --assets option.");
  });
  const assetsByPurpose = new Map<string, SectionAsset>();
  const manifestPath = path.join(assetsDir, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8").catch(() => undefined);
  if (manifestRaw) {
    const manifest = AssetManifestSchema.parse(JSON.parse(manifestRaw));
    for (const item of manifest.assets) {
      const assetPath = path.resolve(assetsDir, item.file);
      if (!assetPath.startsWith(`${assetsDir}${path.sep}`)) {
        throw new AppError(`Asset escapes its directory: ${item.file}`, "INVALID_INPUT", "Keep manifest files inside the assets directory.");
      }
      const extension = path.extname(assetPath).toLowerCase();
      const mediaType = IMAGE_EXTENSIONS.has(extension) ? "image" : VIDEO_EXTENSIONS.has(extension) ? "video" : undefined;
      if (!mediaType) {
        throw new AppError(`Unsupported manifest asset: ${item.file}`, "INVALID_INPUT", "Use png, jpg, jpeg, webp, mp4, mov, mkv, or webm.");
      }
      assetsByPurpose.set(item.purpose, {
        purpose: item.purpose,
        reference: { kind: "local-file", path: assetPath, mediaType, provenance: item.provenance },
        placement: { fit: item.fit, focalPoint: item.focalPoint },
        textBackdrop: item.textBackdrop
      });
    }
    return [...assetsByPurpose.values()];
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    const purpose = path.basename(entry.name, extension);
    if (assetsByPurpose.has(purpose)) continue;
    if (IMAGE_EXTENSIONS.has(extension)) {
      assetsByPurpose.set(purpose, { purpose, reference: { kind: "local-file", path: path.join(assetsDir, entry.name), mediaType: "image", provenance: `local file provided by operator: ${entry.name}` } });
    } else if (VIDEO_EXTENSIONS.has(extension)) {
      assetsByPurpose.set(purpose, { purpose, reference: { kind: "local-file", path: path.join(assetsDir, entry.name), mediaType: "video", provenance: `local file provided by operator: ${entry.name}` } });
    }
  }
  return [...assetsByPurpose.values()];
}
