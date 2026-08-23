import { CompositionPlanSchema, type AssetReference, type CompositionPlan, type Layer } from "../domain/composition.js";
import { cuesFromSections } from "../domain/captions.js";
import type { ScriptPlan } from "../domain/script.js";

const DEFAULT_BACKGROUND = "#101020";

export type SectionAsset = {
  purpose: string;
  reference: AssetReference;
};

/**
 * Pure ScriptPlan -> CompositionPlan mapping. No FFmpeg, no filesystem:
 * assets are already resolved references keyed by section purpose.
 */
export function buildCompositionPlan(script: ScriptPlan, options: {
  assets: SectionAsset[];
  background?: string;
}): CompositionPlan {
  const background = options.background ?? DEFAULT_BACKGROUND;
  const assetsByPurpose = new Map(options.assets.map((asset) => [asset.purpose, asset.reference]));

  const layers: Layer[] = script.sections.map((section) => ({
    kind: "asset",
    startSeconds: section.startSeconds,
    endSeconds: section.endSeconds,
    asset: assetsByPurpose.get(section.purpose) ?? { kind: "color", hex: background }
  }));

  layers.push({
    kind: "text",
    startSeconds: 0,
    endSeconds: script.hook.durationSeconds,
    text: script.title,
    position: "top"
  });

  layers.push({
    kind: "captions",
    startSeconds: 0,
    endSeconds: script.durationSeconds,
    style: script.captionGuidance.style,
    keywordsToEmphasize: script.captionGuidance.keywordsToEmphasize,
    cues: cuesFromSections(script.sections)
  });

  return CompositionPlanSchema.parse({
    width: 1080,
    height: 1920,
    fps: 30,
    durationSeconds: script.durationSeconds,
    background,
    layers
  });
}
