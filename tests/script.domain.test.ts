import { describe, expect, test } from "vitest";
import { ScriptPlanSchema } from "../src/domain/script.js";

const validPlan = {
  title: "99% des débutants ignorent cette fonction IA",
  language: "fr",
  durationSeconds: 40,
  hook: { text: "99% des débutants ratent ça sur les outils IA.", durationSeconds: 3 },
  sections: [
    { startSeconds: 0, endSeconds: 3, purpose: "hook", voiceover: "99% des débutants ratent ça." },
    { startSeconds: 3, endSeconds: 20, purpose: "explanation", voiceover: "Voici la fonction..." },
    { startSeconds: 20, endSeconds: 40, purpose: "payoff", voiceover: "Résultat final..." }
  ],
  visualPlan: [
    { section: "hook", visualType: "text-on-screen", description: "Gros texte 99%" }
  ],
  captionGuidance: { style: "dynamic", keywordsToEmphasize: ["99%", "IA"] }
};

describe("ScriptPlanSchema", () => {
  test("accepts a well-formed plan", () => {
    const plan = ScriptPlanSchema.parse(validPlan);
    expect(plan.sections).toHaveLength(3);
    expect(plan.captionGuidance.style).toBe("dynamic");
  });

  test("rejects overlapping sections", () => {
    const overlapping = structuredClone(validPlan);
    overlapping.sections[1]!.startSeconds = 2;
    expect(() => ScriptPlanSchema.parse(overlapping)).toThrow();
  });

  test("rejects sections escaping the total duration", () => {
    const escaping = structuredClone(validPlan);
    escaping.sections[2]!.endSeconds = 45;
    expect(() => ScriptPlanSchema.parse(escaping)).toThrow();
  });

  test("rejects unordered sections", () => {
    const unordered = structuredClone(validPlan);
    unordered.sections[1]!.startSeconds = 25;
    unordered.sections[1]!.endSeconds = 35;
    expect(() => ScriptPlanSchema.parse(unordered)).toThrow();
  });

  test("rejects invalid enums and empty content", () => {
    expect(() => ScriptPlanSchema.parse({ ...validPlan, title: "" })).toThrow();
    expect(() => ScriptPlanSchema.parse({ ...validPlan, sections: [] })).toThrow();
    expect(() => ScriptPlanSchema.parse({ ...validPlan, durationSeconds: 0 })).toThrow();
    const badPurpose = structuredClone(validPlan);
    badPurpose.sections[0]!.purpose = "marketing";
    expect(() => ScriptPlanSchema.parse(badPurpose)).toThrow();
    expect(() => ScriptPlanSchema.parse({
      ...validPlan,
      captionGuidance: { style: "rainbow", keywordsToEmphasize: [] }
    })).toThrow();
  });

  test("allows minimal optional fields", () => {
    const { language: _language, ...withoutLanguage } = validPlan;
    const plan = ScriptPlanSchema.parse(withoutLanguage);
    expect(plan.language).toBeUndefined();
  });
});
