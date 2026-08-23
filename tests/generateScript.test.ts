import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { generateScript, generateScriptFromFile } from "../src/application/generateScript.js";
import { buildScriptGenerationPrompt } from "../src/application/prompts/scriptGeneration.js";
import type { LanguageModelProvider } from "../src/application/languageModelPort.js";
import { AppError } from "../src/domain/errors.js";
import { ProductionBriefSchema } from "../src/domain/opportunity.js";

const planJson = {
  title: "99% des débutants ignorent cette fonction IA",
  language: "fr",
  durationSeconds: 40,
  hook: { text: "99% des débutants ratent ça.", durationSeconds: 3 },
  sections: [
    { startSeconds: 0, endSeconds: 3, purpose: "hook", voiceover: "99% des débutants ratent ça." },
    { startSeconds: 3, endSeconds: 20, purpose: "explanation", voiceover: "Voici la fonction..." },
    { startSeconds: 20, endSeconds: 40, purpose: "payoff", voiceover: "Résultat..." }
  ],
  visualPlan: [{ section: "hook", visualType: "text-on-screen", description: "Gros texte" }],
  captionGuidance: { style: "dynamic", keywordsToEmphasize: ["99%"] }
};

const brief = ProductionBriefSchema.parse({
  whyInteresting: ["large audience"],
  hook: { type: "curiosity", strength: "high" },
  adaptationIdeas: ["99% des débutants ignorent cette fonction IA"],
  recommendedFormat: { type: "faceless", durationSeconds: { min: 30, max: 45 } },
  productionDifficulty: "low",
  potential: "high",
  risks: ["high competition"]
});

function mockProvider(response: string): LanguageModelProvider {
  return { name: "mock", generate: async () => response };
}

describe("buildScriptGenerationPrompt", () => {
  test("includes brief facts and the response contract", () => {
    const prompt = buildScriptGenerationPrompt(brief);
    expect(prompt).toContain("99% des débutants ignorent cette fonction IA");
    expect(prompt).toContain("curiosity");
    expect(prompt).toContain("30");
    expect(prompt).toContain("sections");
    expect(prompt).toContain("JSON");
  });
});

describe("generateScript", () => {
  test("turns a production brief into a validated script plan", async () => {
    const result = await generateScript(brief, mockProvider(JSON.stringify(planJson)));
    expect(result.plan.title).toContain("99%");
    expect(result.plan.sections).toHaveLength(3);
    expect(result.provider).toBe("mock");
    expect(result.sourceBrief.potential).toBe("high");
  });

  test("extracts JSON from a markdown-fenced response", async () => {
    const fenced = `Voici le plan:\n\`\`\`json\n${JSON.stringify(planJson)}\n\`\`\``;
    const result = await generateScript(brief, mockProvider(fenced));
    expect(result.plan.durationSeconds).toBe(40);
  });

  test("rejects plans violating temporal invariants", async () => {
    const invalid = structuredClone(planJson);
    invalid.sections[1]!.startSeconds = 1;
    await expect(generateScript(brief, mockProvider(JSON.stringify(invalid))))
      .rejects.toMatchObject({ code: "LLM_INVALID_RESPONSE" });
  });

  test("fails explicitly on provider and malformed responses", async () => {
    const down: LanguageModelProvider = {
      name: "down",
      generate: async () => {
        throw new AppError("provider unavailable", "LLM_UNAVAILABLE");
      }
    };
    await expect(generateScript(brief, down)).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
    await expect(generateScript(brief, mockProvider("no json")))
      .rejects.toMatchObject({ code: "LLM_INVALID_RESPONSE" });
  });
});

describe("generateScriptFromFile", () => {
  test("accepts a raw ProductionBrief and persists the plan", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-script-"));
    const filePath = path.join(dir, "brief.json");
    await writeFile(filePath, JSON.stringify(brief), "utf8");

    const result = await generateScriptFromFile({ filePath, provider: mockProvider(JSON.stringify(planJson)) });

    const persisted = JSON.parse(await readFile(result.scriptPath, "utf8")) as { plan: { title: string } };
    expect(persisted.plan.title).toContain("99%");
    expect(path.dirname(result.scriptPath)).toBe(dir);
    expect(path.basename(result.scriptPath)).toMatch(/^script-.*\.json$/);
  });

  test("accepts an opportunity analysis artifact and reuses its signal id", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-script-"));
    const filePath = path.join(dir, "brief-abc.json");
    await writeFile(filePath, JSON.stringify({
      opportunity: {
        signal: { id: "abc" },
        metrics: {},
        score: { score: 10, signals: {}, usedSignals: [], reasons: [] },
        warnings: []
      },
      brief,
      provider: "mock",
      analyzedAt: "2026-08-23T00:00:00.000Z"
    }), "utf8");

    const result = await generateScriptFromFile({ filePath, provider: mockProvider(JSON.stringify(planJson)) });
    expect(path.basename(result.scriptPath)).toBe("script-abc.json");
    expect(result.script.sourceSignalId).toBe("abc");
  });

  test("rejects a file that is neither a brief nor an analysis", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-script-"));
    const filePath = path.join(dir, "nope.json");
    await writeFile(filePath, JSON.stringify({ hello: "world" }), "utf8");
    await expect(generateScriptFromFile({ filePath, provider: mockProvider(JSON.stringify(planJson)) }))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
