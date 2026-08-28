import { CompositionPlanSchema, type CaptionCuePlan, type CompositionPlan, type Layer } from "../../domain/composition.js";
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

export function composeAiNewsVideo(script: ScriptPlan, options: {
  assets: SectionAsset[];
  captionCues?: CaptionCuePlan[];
  captionTimingSource?: "word-aligned" | "proportional-fallback";
  narrationDurationSeconds?: number;
}): CompositionPlan {
  const assetsByPurpose = new Map(options.assets.map((asset) => [asset.purpose, asset]));

  const layers: Layer[] = script.sections.map((section) => {
    const sectionAsset = assetsByPurpose.get(section.assetKey ?? section.purpose);
    return {
      kind: "asset",
      startSeconds: section.startSeconds,
      endSeconds: section.endSeconds,
      asset: sectionAsset?.reference
        ?? { kind: "color", hex: PURPOSE_BACKGROUNDS[section.purpose] ?? PURPOSE_BACKGROUNDS.other! },
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
    backdrop: "scrim"
  });

  const closing = script.sections.findLast((section) => section.purpose === "cta" || section.purpose === "payoff");
  if (closing && !closing.onScreenText) {
    layers.push({
      kind: "text",
      startSeconds: closing.startSeconds,
      endSeconds: closing.endSeconds,
      text: script.title,
      profile: script.dressingGuidance.profile,
      ...(script.dressingGuidance.eyebrow ? { eyebrow: script.dressingGuidance.eyebrow } : {}),
      ...(script.dressingGuidance.accentColor ? { accentColor: script.dressingGuidance.accentColor } : {}),
      position: "top",
      backdrop: "scrim"
    });
  }

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
    background: PURPOSE_BACKGROUNDS.hook!,
    layers
  });
}
