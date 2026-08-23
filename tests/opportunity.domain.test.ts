import { describe, expect, test } from "vitest";
import { ProductionBriefSchema } from "../src/domain/opportunity.js";

const validBrief = {
  whyInteresting: ["large audience", "strong curiosity hook"],
  hook: { type: "curiosity", strength: "high" },
  adaptationIdeas: ["99% des débutants ignorent cette fonction IA"],
  recommendedFormat: { type: "faceless", durationSeconds: { min: 30, max: 45 } },
  productionDifficulty: "low",
  potential: "high",
  risks: ["high competition"]
};

describe("ProductionBriefSchema", () => {
  test("accepts a well-formed brief", () => {
    const brief = ProductionBriefSchema.parse(validBrief);
    expect(brief.hook.type).toBe("curiosity");
    expect(brief.recommendedFormat.durationSeconds.max).toBe(45);
  });

  test("rejects a brief with empty whyInteresting", () => {
    expect(() => ProductionBriefSchema.parse({ ...validBrief, whyInteresting: [] })).toThrow();
  });

  test("rejects unknown enum values instead of inventing data", () => {
    expect(() => ProductionBriefSchema.parse({ ...validBrief, potential: "viral-guaranteed" })).toThrow();
    expect(() => ProductionBriefSchema.parse({
      ...validBrief,
      hook: { type: "clickbait", strength: "high" }
    })).toThrow();
  });

  test("rejects missing fields and invalid durations", () => {
    const { risks: _risks, ...noRisks } = validBrief;
    expect(ProductionBriefSchema.parse(noRisks).risks).toEqual([]);
    expect(() => ProductionBriefSchema.parse({ ...validBrief, productionDifficulty: undefined })).toThrow();
    expect(() => ProductionBriefSchema.parse({
      ...validBrief,
      recommendedFormat: { type: "faceless", durationSeconds: { min: 0, max: -5 } }
    })).toThrow();
  });
});
