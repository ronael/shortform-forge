import { z } from "zod";
import { OpportunitySchema } from "./discovery.js";

export const HookTypeSchema = z.enum(["curiosity", "contrarian", "how-to", "story", "list", "news", "other"]);
export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export const FormatTypeSchema = z.enum(["faceless", "talking-head", "b-roll", "screen-recording", "remix", "other"]);

export const ProductionBriefSchema = z.object({
  whyInteresting: z.array(z.string().min(1)).min(1),
  hook: z.object({
    type: HookTypeSchema,
    strength: ConfidenceLevelSchema
  }),
  adaptationIdeas: z.array(z.string().min(1)).min(1),
  recommendedFormat: z.object({
    type: FormatTypeSchema,
    durationSeconds: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive()
    })
  }),
  productionDifficulty: ConfidenceLevelSchema,
  potential: ConfidenceLevelSchema,
  risks: z.array(z.string().min(1)).default([])
});

export const OpportunityAnalysisSchema = z.object({
  opportunity: OpportunitySchema,
  brief: ProductionBriefSchema,
  provider: z.string().min(1),
  analyzedAt: z.string().datetime()
});

export type ProductionBrief = z.infer<typeof ProductionBriefSchema>;
export type OpportunityAnalysis = z.infer<typeof OpportunityAnalysisSchema>;
