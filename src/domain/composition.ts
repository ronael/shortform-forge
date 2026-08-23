import { z } from "zod";
import { CaptionStyleSchema } from "./script.js";

// V0 supports only color backgrounds and local files. The kind enum is the
// extension point for future "url" | "generated" | "capture" assets.
export const AssetReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("color"), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
  z.object({
    kind: z.literal("local-file"),
    path: z.string().min(1),
    mediaType: z.enum(["image", "video"]),
    provenance: z.string().min(1)
  })
]);

export const CaptionCuePlanSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1)
});

export const LayerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("asset"),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    asset: AssetReferenceSchema
  }),
  z.object({
    kind: z.literal("text"),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    text: z.string().min(1),
    position: z.enum(["top", "center", "bottom"])
  }),
  z.object({
    kind: z.literal("captions"),
    startSeconds: z.number().nonnegative(),
    endSeconds: z.number().positive(),
    style: CaptionStyleSchema,
    keywordsToEmphasize: z.array(z.string().min(1)).default([]),
    cues: z.array(CaptionCuePlanSchema).min(1)
  })
]);

export const CompositionPlanSchema = z.object({
  width: z.literal(1080),
  height: z.literal(1920),
  fps: z.literal(30),
  durationSeconds: z.number().positive(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  layers: z.array(LayerSchema).min(1)
}).superRefine((plan, ctx) => {
  plan.layers.forEach((layer, index) => {
    if (layer.endSeconds <= layer.startSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layer ${index} ends before it starts` });
    }
    if (layer.endSeconds > plan.durationSeconds) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layer ${index} escapes durationSeconds` });
    }
    if (layer.kind === "captions") {
      layer.cues.forEach((cue, cueIndex) => {
        if (cue.endSeconds <= cue.startSeconds) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `layer ${index} cue ${cueIndex} ends before it starts` });
        }
      });
    }
  });
});

export const VideoArtifactSchema = z.object({
  path: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  sizeBytes: z.number().int().positive(),
  qaPath: z.string().min(1).optional(),
  sourceScriptPath: z.string().min(1).optional(),
  producedAt: z.string().datetime(),
  provenance: z.object({
    renderer: z.string().min(1),
    note: z.string().min(1)
  })
});

export type AssetReference = z.infer<typeof AssetReferenceSchema>;
export type CaptionCuePlan = z.infer<typeof CaptionCuePlanSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type CompositionPlan = z.infer<typeof CompositionPlanSchema>;
export type VideoArtifact = z.infer<typeof VideoArtifactSchema>;
