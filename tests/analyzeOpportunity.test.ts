import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { analyzeOpportunity, analyzeOpportunityFile } from "../src/application/analyzeOpportunity.js";
import { buildOpportunityBriefPrompt } from "../src/application/prompts/opportunityBrief.js";
import type { LanguageModelProvider } from "../src/application/languageModelPort.js";
import { AppError } from "../src/domain/errors.js";
import { buildOpportunity } from "../src/domain/discovery.js";
import { ContentSignalSchema } from "../src/domain/discovery.js";

const briefJson = {
  whyInteresting: ["large audience", "strong curiosity hook"],
  hook: { type: "curiosity", strength: "high" },
  adaptationIdeas: ["99% des débutants ignorent cette fonction IA"],
  recommendedFormat: { type: "faceless", durationSeconds: { min: 30, max: 45 } },
  productionDifficulty: "low",
  potential: "high",
  risks: ["high competition"]
};

function mockProvider(response: string): LanguageModelProvider {
  return { name: "mock", generate: async () => response };
}

function failingProvider(): LanguageModelProvider {
  return {
    name: "mock-down",
    generate: async () => {
      throw new AppError("provider unavailable", "LLM_UNAVAILABLE");
    }
  };
}

function opportunity(withMetrics = true) {
  const signal = ContentSignalSchema.parse({
    id: "abc",
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=abc",
    title: "99% of Beginners Don't Know the Basics of AI",
    creator: "Jeff Su",
    publishedAt: "2026-08-20T00:00:00.000Z",
    collectedAt: "2026-08-23T00:00:00.000Z",
    ...(withMetrics ? { views: 3_400_000, likes: 50_000, comments: 2_000 } : {}),
    provenance: { source: "youtube-search", collectedBy: "yt-dlp", note: "Discovery signal only." }
  });
  return buildOpportunity(signal, new Date("2026-08-23T00:00:00.000Z"));
}

describe("buildOpportunityBriefPrompt", () => {
  test("includes signal facts, score signals and the response contract", () => {
    const prompt = buildOpportunityBriefPrompt(opportunity());
    expect(prompt).toContain("99% of Beginners Don't Know the Basics of AI");
    expect(prompt).toContain("youtube");
    expect(prompt).toContain("whyInteresting");
    expect(prompt).toContain("recommendedFormat");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("3,400,000");
  });

  test("marks missing metrics explicitly instead of zero-filling", () => {
    const prompt = buildOpportunityBriefPrompt(opportunity(false));
    expect(prompt).toContain("not available");
    expect(prompt).not.toContain("views: 0");
  });
});

describe("analyzeOpportunity", () => {
  test("turns an opportunity into a validated production brief", async () => {
    const analysis = await analyzeOpportunity(opportunity(), mockProvider(JSON.stringify(briefJson)));
    expect(analysis.brief.hook.type).toBe("curiosity");
    expect(analysis.brief.whyInteresting).toContain("large audience");
    expect(analysis.provider).toBe("mock");
    expect(analysis.opportunity.signal.id).toBe("abc");
  });

  test("extracts JSON from a chatty provider response", async () => {
    const chatty = `Here is the analysis:\n${JSON.stringify(briefJson)}\nHope this helps!`;
    const analysis = await analyzeOpportunity(opportunity(), mockProvider(chatty));
    expect(analysis.brief.potential).toBe("high");
  });

  test("fails explicitly when the provider is unavailable", async () => {
    await expect(analyzeOpportunity(opportunity(), failingProvider())).rejects.toMatchObject({ code: "LLM_UNAVAILABLE" });
  });

  test("fails explicitly on invalid provider output", async () => {
    await expect(analyzeOpportunity(opportunity(), mockProvider("no json here")))
      .rejects.toMatchObject({ code: "LLM_INVALID_RESPONSE" });
    await expect(analyzeOpportunity(opportunity(), mockProvider(JSON.stringify({ whyInteresting: [] }))))
      .rejects.toMatchObject({ code: "LLM_INVALID_RESPONSE" });
  });
});

describe("analyzeOpportunityFile", () => {
  test("reads an opportunities artifact, analyzes one entry and persists the brief", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-analyze-"));
    const filePath = path.join(dir, "opportunities.json");
    await writeFile(filePath, JSON.stringify({ opportunities: [opportunity(false), opportunity()] }), "utf8");

    const result = await analyzeOpportunityFile({ filePath, index: 1, provider: mockProvider(JSON.stringify(briefJson)) });

    expect(result.analysis.opportunity.signal.views).toBe(3_400_000);
    const persisted = JSON.parse(await readFile(result.briefPath, "utf8")) as { brief: { potential: string } };
    expect(persisted.brief.potential).toBe("high");
    expect(path.dirname(result.briefPath)).toBe(dir);
  });

  test("defaults to the top opportunity and rejects out-of-range index", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-analyze-"));
    const filePath = path.join(dir, "opportunities.json");
    await writeFile(filePath, JSON.stringify({ opportunities: [opportunity()] }), "utf8");

    const top = await analyzeOpportunityFile({ filePath, provider: mockProvider(JSON.stringify(briefJson)) });
    expect(top.analysis.opportunity.signal.id).toBe("abc");
    await expect(analyzeOpportunityFile({ filePath, index: 5, provider: mockProvider(JSON.stringify(briefJson)) }))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
