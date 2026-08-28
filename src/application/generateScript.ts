import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ProductionBriefSchema, type ProductionBrief } from "../domain/opportunity.js";
import { GeneratedScriptSchema, ScriptPlanSchema, type GeneratedScript } from "../domain/script.js";
import { AppError } from "../domain/errors.js";
import type { LanguageModelProvider } from "./languageModelPort.js";
import { parseLlmJson } from "./llmJson.js";
import { buildScriptGenerationPrompt } from "./prompts/scriptGeneration.js";
import { slug, writeJson } from "./files.js";

// Loose shape: an opportunity analysis artifact carries a brief and the originating signal id.
const AnalysisFileSchema = z.object({
  brief: ProductionBriefSchema,
  opportunity: z.object({ signal: z.object({ id: z.string().min(1) }).passthrough() }).passthrough()
}).passthrough();

export async function generateScript(
  brief: ProductionBrief,
  provider: LanguageModelProvider,
  sourceSignalId?: string,
  targetDurationSeconds?: number
): Promise<GeneratedScript> {
  const prompt = buildScriptGenerationPrompt(brief, targetDurationSeconds);
  const response = await provider.generate(prompt);
  const plan = parseLlmJson(response, ScriptPlanSchema, "ScriptPlan");
  return GeneratedScriptSchema.parse({
    plan,
    sourceBrief: brief,
    ...(sourceSignalId ? { sourceSignalId } : {}),
    provider: provider.name,
    generatedAt: new Date().toISOString()
  });
}

export async function generateScriptFromFile(input: {
  filePath: string;
  provider: LanguageModelProvider;
  targetDurationSeconds?: number;
}): Promise<{ script: GeneratedScript; scriptPath: string }> {
  const resolved = path.resolve(input.filePath);
  const { brief, signalId } = await loadBrief(resolved);
  const script = await generateScript(brief, input.provider, signalId, input.targetDurationSeconds);
  const scriptPath = path.join(path.dirname(resolved), `script-${signalId ?? slug(script.plan.title)}.json`);
  await writeJson(scriptPath, script);
  return { script, scriptPath };
}

export async function loadBrief(filePath: string): Promise<{ brief: ProductionBrief; signalId?: string }> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const asAnalysis = AnalysisFileSchema.safeParse(raw);
  if (asAnalysis.success) {
    return { brief: asAnalysis.data.brief, signalId: asAnalysis.data.opportunity.signal.id };
  }
  const asBrief = ProductionBriefSchema.safeParse(raw);
  if (asBrief.success) return { brief: asBrief.data };
  throw new AppError(
    `File is neither a ProductionBrief nor an opportunity analysis artifact: ${filePath}`,
    "INVALID_INPUT",
    "Provide a brief-<signal-id>.json file produced by `sf analyze`, or a standalone ProductionBrief JSON object."
  );
}
