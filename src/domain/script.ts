import { z } from "zod";
import { ProductionBriefSchema } from "./opportunity.js";

export const SectionPurposeSchema = z.enum(["hook", "context", "explanation", "proof", "payoff", "cta", "other"]);
export const VisualTypeSchema = z.enum(["screen", "b-roll", "talking-head", "text-on-screen", "animation", "other"]);
export const CaptionStyleSchema = z.enum(["dynamic", "minimal", "keyword-highlight"]);
export const DressingProfileSchema = z.enum(["minimal", "editorial-ranking", "comedy-ranking"]);

export const ScriptSectionSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  purpose: SectionPurposeSchema,
  assetKey: z.string().min(1).optional(),
  voiceover: z.string().min(1),
  visualGuidance: z.string().min(1).optional(),
  onScreenText: z.object({
    text: z.string().min(1),
    rank: z.number().int().positive().optional(),
    eyebrow: z.string().min(1).optional(),
    metric: z.string().min(1).optional(),
    supportingText: z.string().min(1).optional(),
    position: z.enum(["top", "center", "bottom"]).default("top"),
    backdrop: z.enum(["none", "scrim"]).default("scrim")
  }).optional()
});

export const ScriptPlanSchema = z.object({
  title: z.string().min(1),
  language: z.string().min(2).optional(),
  durationSeconds: z.number().int().positive(),
  durationRecommendation: z.object({
    minSeconds: z.number().int().positive(),
    targetSeconds: z.number().int().positive(),
    maxSeconds: z.number().int().positive(),
    rationale: z.string().min(1)
  }).optional(),
  hook: z.object({
    text: z.string().min(1),
    durationSeconds: z.number().positive()
  }),
  sections: z.array(ScriptSectionSchema).min(1),
  visualPlan: z.array(z.object({
    section: z.string().min(1),
    visualType: VisualTypeSchema,
    description: z.string().min(1)
  })).default([]),
  captionGuidance: z.object({
    style: CaptionStyleSchema,
    backdrop: z.enum(["none", "scrim"]).default("none"),
    keywordsToEmphasize: z.array(z.string().min(1)).default([])
  }).default({ style: "dynamic", backdrop: "none", keywordsToEmphasize: [] }),
  dressingGuidance: z.object({
    profile: DressingProfileSchema,
    eyebrow: z.string().min(1).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
  }).default({ profile: "minimal" }),
  musicGuidance: z.object({
    mode: z.enum(["auto", "on", "off"]).default("auto"),
    mood: z.string().min(1).optional()
  }).default({ mode: "auto" })
}).superRefine((plan, ctx) => {
  if (plan.durationRecommendation) {
    const recommendation = plan.durationRecommendation;
    if (recommendation.minSeconds > recommendation.targetSeconds || recommendation.targetSeconds > recommendation.maxSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duration recommendation must satisfy min <= target <= max" });
    }
    if (plan.durationSeconds < recommendation.minSeconds || plan.durationSeconds > recommendation.maxSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "durationSeconds must stay inside the recommended range" });
    }
  }
  let previousEnd = 0;
  plan.sections.forEach((section, index) => {
    if (section.endSeconds <= section.startSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `section ${index} ends before it starts` });
    }
    if (section.startSeconds < previousEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `section ${index} overlaps or is out of order` });
    }
    if (section.endSeconds > plan.durationSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `section ${index} escapes durationSeconds` });
    }
    previousEnd = section.endSeconds;
  });
});

export const GeneratedScriptSchema = z.object({
  plan: ScriptPlanSchema,
  sourceBrief: ProductionBriefSchema,
  sourceSignalId: z.string().min(1).optional(),
  provider: z.string().min(1),
  generatedAt: z.string().datetime()
});

export type CaptionStyle = z.infer<typeof CaptionStyleSchema>;
export type DressingProfile = z.infer<typeof DressingProfileSchema>;
export type ScriptSection = z.infer<typeof ScriptSectionSchema>;
export type ScriptPlan = z.infer<typeof ScriptPlanSchema>;
export type GeneratedScript = z.infer<typeof GeneratedScriptSchema>;
