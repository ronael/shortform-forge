import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { ScriptPlanSchema, type ScriptPlan } from "../domain/script.js";
import { VoiceoverSchema } from "../domain/voice.js";
import type { CompositionPlan, VideoArtifact } from "../domain/composition.js";
import { AppError } from "../domain/errors.js";
import type { CompositionRenderer } from "./ports.js";
import { buildCompositionPlan, type SectionAsset } from "./composeVideo.js";
import { composeAiNewsVideo } from "./templates/aiNews.js";
import { retimeScript } from "./generateVoiceover.js";
import { ensureDir, readJson, slug, writeJson } from "./files.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm"]);

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
}): Promise<{ plan: CompositionPlan; artifact: VideoArtifact; artifactDir: string }> {
  const resolved = path.resolve(input.filePath);
  let script = await loadScriptPlan(resolved);
  const assets = input.assetsDir ? await resolveSectionAssets(path.resolve(input.assetsDir)) : [];

  let audioPath: string | undefined;
  if (input.voiceoverPath) {
    const voiceoverFile = path.resolve(input.voiceoverPath);
    const voiceover = await readJson(voiceoverFile, VoiceoverSchema);
    script = retimeScript(script, voiceover);
    audioPath = path.join(path.dirname(voiceoverFile), "voiceover.wav");
  }

  const plan = input.template === "ai-news"
    ? composeAiNewsVideo(script, { assets })
    : buildCompositionPlan(script, {
        assets,
        ...(input.background ? { background: input.background } : {})
      });

  const artifactDir = path.resolve(input.outputRoot, "produce", slug(input.runId ?? script.title));
  await ensureDir(artifactDir);
  await writeJson(path.join(artifactDir, "composition.json"), plan);

  const artifact = await input.renderer.render(plan, artifactDir, audioPath ? { audioPath } : {});
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
  const assets: SectionAsset[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    const purpose = path.basename(entry.name, extension);
    if (IMAGE_EXTENSIONS.has(extension)) {
      assets.push({ purpose, reference: { kind: "local-file", path: path.join(assetsDir, entry.name), mediaType: "image", provenance: `local file provided by operator: ${entry.name}` } });
    } else if (VIDEO_EXTENSIONS.has(extension)) {
      assets.push({ purpose, reference: { kind: "local-file", path: path.join(assetsDir, entry.name), mediaType: "video", provenance: `local file provided by operator: ${entry.name}` } });
    }
  }
  return assets;
}
