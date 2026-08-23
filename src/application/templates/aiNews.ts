import { CompositionPlanSchema, type CompositionPlan, type Layer } from "../../domain/composition.js";
import { cuesFromSections } from "../../domain/captions.js";
import type { ScriptPlan } from "../../domain/script.js";
import type { SectionAsset } from "../composeVideo.js";

/**
 * "AI News" composition strategy: NOT a template engine, just one opinionated
 * ScriptPlan -> CompositionPlan mapping.
 *
 * - dark color-coded background per section purpose when no asset is provided
 * - big title card during the hook
 * - CTA text card during a closing cta/payoff section
 * - captions synced to the (already re-timed) sections
 */
const PURPOSE_BACKGROUNDS: Record<string, string> = {
  hook: "#0b1026",
  context: "#101020",
  explanation: "#101828",
  proof: "#0f1a2e",
  payoff: "#1a1030",
  cta: "#241040",
  other: "#101020"
};

export function composeAiNewsVideo(script: ScriptPlan, options: { assets: SectionAsset[] }): CompositionPlan {
  const assetsByPurpose = new Map(options.assets.map((asset) => [asset.purpose, asset.reference]));

  const layers: Layer[] = script.sections.map((section) => ({
    kind: "asset",
    startSeconds: section.startSeconds,
    endSeconds: section.endSeconds,
    asset: assetsByPurpose.get(section.purpose)
      ?? { kind: "color", hex: PURPOSE_BACKGROUNDS[section.purpose] ?? PURPOSE_BACKGROUNDS.other! }
  }));

  layers.push({
    kind: "text",
    startSeconds: 0,
    endSeconds: script.hook.durationSeconds,
    text: script.title,
    position: "top"
  });

  const closing = script.sections.findLast((section) => section.purpose === "cta" || section.purpose === "payoff");
  if (closing) {
    layers.push({
      kind: "text",
      startSeconds: closing.startSeconds,
      endSeconds: closing.endSeconds,
      text: script.title,
      position: "top"
    });
  }

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
    background: PURPOSE_BACKGROUNDS.hook!,
    layers
  });
}
