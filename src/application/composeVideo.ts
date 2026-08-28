import { CompositionPlanSchema, type AssetPlacement, type AssetReference, type CaptionCuePlan, type CompositionPlan, type Layer, type TextBackdrop } from "../domain/composition.js";
import { cuesFromSections } from "../domain/captions.js";
import type { ScriptPlan } from "../domain/script.js";

const DEFAULT_BACKGROUND = "#101020";

export type SectionAsset = {
  purpose: string;
  reference: AssetReference;
  placement?: AssetPlacement;
  textBackdrop?: TextBackdrop;
};

/**
 * Pure ScriptPlan -> CompositionPlan mapping. No FFmpeg, no filesystem:
 * assets are already resolved references keyed by section purpose.
 */
export function buildCompositionPlan(script: ScriptPlan, options: {
  assets: SectionAsset[];
  background?: string;
  captionCues?: CaptionCuePlan[];
  captionTimingSource?: "word-aligned" | "proportional-fallback";
  narrationDurationSeconds?: number;
}): CompositionPlan {
  const background = options.background ?? DEFAULT_BACKGROUND;
  const assetsByPurpose = new Map(options.assets.map((asset) => [asset.purpose, asset]));

  const layers: Layer[] = script.sections.map((section) => {
    const sectionAsset = assetsByPurpose.get(section.assetKey ?? section.purpose);
    return {
      kind: "asset",
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      asset: sectionAsset?.reference ?? { kind: "color", hex: background },
      ...(sectionAsset?.placement ? { placement: sectionAsset.placement } : {}),
      textBackdrop: sectionAsset?.textBackdrop ?? "none"
    };
  });

  layers.push(...script.sections
    .filter((section) => section.onScreenText)
    .map((section): Layer => ({
      kind: "text",
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      text: section.onScreenText!.text,
      profile: script.dressingGuidance.profile,
      ...(section.onScreenText!.rank ? { rank: section.onScreenText!.rank } : {}),
      ...(section.onScreenText!.eyebrow ? { eyebrow: section.onScreenText!.eyebrow } : {}),
      ...(section.onScreenText!.metric ? { metric: section.onScreenText!.metric } : {}),
      ...(section.onScreenText!.supportingText ? { supportingText: section.onScreenText!.supportingText } : {}),
      ...(script.dressingGuidance.accentColor ? { accentColor: script.dressingGuidance.accentColor } : {}),
      position: section.onScreenText!.position,
      backdrop: section.onScreenText!.backdrop
    })));

  layers.push({
    kind: "text",
    startSeconds: 0,
    endSeconds: script.sections[0]?.endSeconds ?? script.hook.durationSeconds,
    text: script.title,
    profile: script.dressingGuidance.profile,
    ...(script.dressingGuidance.eyebrow ? { eyebrow: script.dressingGuidance.eyebrow } : {}),
    ...(script.dressingGuidance.accentColor ? { accentColor: script.dressingGuidance.accentColor } : {}),
    position: "top",
    backdrop: "none"
  });

  layers.push({
    kind: "captions",
    startSeconds: 0,
    endSeconds: script.durationSeconds,
    style: script.captionGuidance.style,
    backdrop: script.captionGuidance.backdrop,
    timingSource: options.captionTimingSource ?? "proportional-fallback",
    keywordsToEmphasize: script.captionGuidance.keywordsToEmphasize,
    cues: options.captionCues ?? cuesFromSections(script.sections, script.captionGuidance.style)
  });

  return CompositionPlanSchema.parse({
    width: 1080,
    height: 1920,
    fps: 30,
    durationSeconds: script.durationSeconds,
    ...(options.narrationDurationSeconds ? { narrationDurationSeconds: options.narrationDurationSeconds } : {}),
    background,
    layers
  });
}
