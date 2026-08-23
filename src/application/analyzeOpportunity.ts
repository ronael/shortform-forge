import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { OpportunitySchema, type Opportunity } from "../domain/discovery.js";
import { OpportunityAnalysisSchema, ProductionBriefSchema, type OpportunityAnalysis } from "../domain/opportunity.js";
import { AppError } from "../domain/errors.js";
import type { LanguageModelProvider } from "./languageModelPort.js";
import { buildOpportunityBriefPrompt } from "./prompts/opportunityBrief.js";
import { parseLlmJson } from "./llmJson.js";
import { writeJson } from "./files.js";

const OpportunitiesFileSchema = z.object({ opportunities: z.array(OpportunitySchema).min(1) });

export async function analyzeOpportunity(opportunity: Opportunity, provider: LanguageModelProvider): Promise<OpportunityAnalysis> {
  const prompt = buildOpportunityBriefPrompt(opportunity);
  const response = await provider.generate(prompt);
  const brief = parseLlmJson(response, ProductionBriefSchema, "ProductionBrief");
  return OpportunityAnalysisSchema.parse({
    opportunity,
    brief,
    provider: provider.name,
    analyzedAt: new Date().toISOString()
  });
}

export async function analyzeOpportunityFile(input: {
  filePath: string;
  provider: LanguageModelProvider;
  index?: number;
}): Promise<{ analysis: OpportunityAnalysis; briefPath: string }> {
  const resolved = path.resolve(input.filePath);
  const opportunity = await loadOpportunity(resolved, input.index ?? 0);
  const analysis = await analyzeOpportunity(opportunity, input.provider);
  const briefPath = path.join(path.dirname(resolved), `brief-${opportunity.signal.id}.json`);
  await writeJson(briefPath, analysis);
  return { analysis, briefPath };
}

export async function loadOpportunity(filePath: string, index: number): Promise<Opportunity> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const asCollection = OpportunitiesFileSchema.safeParse(raw);
  if (asCollection.success) {
    const opportunity = asCollection.data.opportunities[index];
    if (!opportunity) {
      throw new AppError(
        `No opportunity at index ${index} (${asCollection.data.opportunities.length} available)`,
        "INVALID_INPUT",
        "Use --index between 0 and the number of opportunities minus one."
      );
    }
    return opportunity;
  }
  const asSingle = OpportunitySchema.safeParse(raw);
  if (asSingle.success) return asSingle.data;
  throw new AppError(
    `File is neither a single Opportunity nor an opportunities.json artifact: ${filePath}`,
    "INVALID_INPUT",
    "Provide an Opportunity object or an { opportunities: [...] } file produced by `sf discover`."
  );
}
