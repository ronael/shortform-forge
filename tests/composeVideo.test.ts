import { describe, expect, test } from "vitest";
import { buildCompositionPlan } from "../src/application/composeVideo.js";
import { ScriptPlanSchema } from "../src/domain/script.js";
import { cuesFromSections, buildAssFromCues } from "../src/domain/captions.js";

const script = ScriptPlanSchema.parse({
  title: "Test video",
  language: "fr",
  durationSeconds: 9,
  hook: { text: "Accroche", durationSeconds: 3 },
  sections: [
    { startSeconds: 0, endSeconds: 3, purpose: "hook", voiceover: "Accroche du début." },
    { startSeconds: 3, endSeconds: 6, purpose: "explanation", voiceover: "Explication du concept en quelques mots." },
    { startSeconds: 6, endSeconds: 9, purpose: "payoff", voiceover: "Conclusion et appel à l'action." }
  ],
  visualPlan: [{ section: "explanation", visualType: "screen", description: "capture" }],
  captionGuidance: { style: "keyword-highlight", keywordsToEmphasize: ["concept"] }
});

const imageAsset = { kind: "local-file" as const, path: "/tmp/hook.png", mediaType: "image" as const, provenance: "test fixture" };

describe("buildCompositionPlan", () => {
  test("maps script sections to asset or color layers plus a captions layer", () => {
    const plan = buildCompositionPlan(script, { assets: [{ purpose: "hook", reference: imageAsset }] });

    expect(plan.width).toBe(1080);
    expect(plan.height).toBe(1920);
    expect(plan.durationSeconds).toBe(9);

    const assetLayers = plan.layers.filter((layer) => layer.kind === "asset");
    expect(assetLayers).toHaveLength(3);
    expect(assetLayers[0]?.asset).toEqual(imageAsset);
    expect(assetLayers[1]?.asset.kind).toBe("color");
    expect(assetLayers[2]?.asset.kind).toBe("color");

    const captions = plan.layers.find((layer) => layer.kind === "captions");
    expect(captions?.kind).toBe("captions");
    if (captions?.kind === "captions") {
      expect(captions.style).toBe("keyword-highlight");
      expect(captions.cues.length).toBeGreaterThanOrEqual(3);
      expect(captions.cues.every((cue) => cue.startSeconds >= 0 && cue.endSeconds <= 9)).toBe(true);
    }
  });

  test("falls back to background color when no assets are provided", () => {
    const plan = buildCompositionPlan(script, { assets: [] });
    const assetLayers = plan.layers.filter((layer) => layer.kind === "asset");
    expect(assetLayers.every((layer) => layer.asset.kind === "color")).toBe(true);
  });

  test("cuesFromSections splits long voiceover within section bounds", () => {
    const cues = cuesFromSections(script.sections);
    expect(cues.length).toBeGreaterThanOrEqual(3);
    for (const cue of cues) {
      expect(cue.endSeconds).toBeGreaterThan(cue.startSeconds);
      expect(cue.startSeconds).toBeGreaterThanOrEqual(0);
      expect(cue.endSeconds).toBeLessThanOrEqual(9);
    }
    expect(cues.map((cue) => cue.text).join(" ")).toContain("Explication du concept");
  });

  test("buildAssFromCues renders keyword highlights without breaking ASS", () => {
    const cues = cuesFromSections(script.sections);
    const ass = buildAssFromCues(cues, "keyword-highlight", ["concept"]);
    expect(ass).toContain("Dialogue:");
    expect(ass).toContain("{\\1c&H0000E0FF\\b1}concept{\\1c&H00FFFFFF\\b0}");
    const minimal = buildAssFromCues(cues, "minimal");
    expect(minimal).toContain("Arial,56");
    expect(minimal).not.toContain("{\\1c");
  });
});
