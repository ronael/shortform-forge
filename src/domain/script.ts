import { z } from "zod";
import { ProductionBriefSchema } from "./opportunity.js";

export const SectionPurposeSchema = z.enum(["hook", "context", "explanation", "proof", "payoff", "cta", "other"]);
export const VisualTypeSchema = z.enum(["screen", "b-roll", "talking-head", "text-on-screen", "animation", "other"]);
export const CaptionStyleSchema = z.enum(["dynamic", "minimal", "keyword-highlight"]);

export const ScriptSectionSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  purpose: SectionPurposeSchema,
  voiceover: z.string().min(1),
  visualGuidance: z.string().min(1).optional()
});

export const ScriptPlanSchema = z.object({
  title: z.string().min(1),
  language: z.string().min(2).optional(),
  durationSeconds: z.number().int().positive(),
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
    keywordsToEmphasize: z.array(z.string().min(1)).default([])
  }).default({ style: "dynamic", keywordsToEmphasize: [] })
}).superRefine((plan, ctx) => {
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
export type ScriptSection = z.infer<typeof ScriptSectionSchema>;
export type ScriptPlan = z.infer<typeof ScriptPlanSchema>;
export type GeneratedScript = z.infer<typeof GeneratedScriptSchema>;
