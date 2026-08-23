import { z } from "zod";

export const SourceSchema = z.object({
  id: z.string().min(1),
  originalPath: z.string().min(1),
  importedPath: z.string().min(1),
  provenance: z.object({
    rights: z.enum(["user_owned", "authorized", "open_license", "generated_test_asset"]),
    note: z.string().min(1),
    sourceUrl: z.string().url().optional()
  }),
  importedAt: z.string().datetime(),
  media: z.object({
    durationSeconds: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    hasAudio: z.boolean(),
    videoCodec: z.string().optional(),
    audioCodec: z.string().optional()
  })
});

export const TranscriptSegmentSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1)
}).refine((segment) => segment.endSeconds > segment.startSeconds, {
  message: "endSeconds must be greater than startSeconds"
});

export const TranscriptSchema = z.object({
  sourceId: z.string().min(1),
  language: z.string().min(2).default("en"),
  provider: z.string().min(1),
  segments: z.array(TranscriptSegmentSchema).min(1)
});

export const CandidateSegmentSchema = z.object({
  id: z.string().min(1),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string().min(1)).min(1)
}).refine((candidate) => candidate.endSeconds > candidate.startSeconds, {
  message: "candidate endSeconds must be greater than startSeconds"
});

export const AnalysisSchema = z.object({
  sourceId: z.string().min(1),
  generatedAt: z.string().datetime(),
  strategy: z.string().min(1),
  candidates: z.array(CandidateSegmentSchema).min(1),
  selectedCandidateId: z.string().min(1)
});

export const QaCheckSchema = z.object({
  name: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  detail: z.string().min(1)
});

export const QaReportSchema = z.object({
  status: z.enum(["pass", "fail"]),
  generatedAt: z.string().datetime(),
  videoPath: z.string().min(1),
  checks: z.array(QaCheckSchema).min(1)
});

export type Source = z.infer<typeof SourceSchema>;
export type Transcript = z.infer<typeof TranscriptSchema>;
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;
export type CandidateSegment = z.infer<typeof CandidateSegmentSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type QaReport = z.infer<typeof QaReportSchema>;
