import { z } from "zod";

export const VoiceoverSectionSchema = z.object({
  purpose: z.string().min(1),
  text: z.string().min(1),
  audioPath: z.string().min(1),
  durationSeconds: z.number().positive()
});

/**
 * A voiceover is the temporal backbone of a produced video: one synthesized
 * audio file per script section, with REAL measured durations. Caption timing
 * and section boundaries are derived from these, never assumed from the TTS.
 */
export const VoiceoverSchema = z.object({
  sections: z.array(VoiceoverSectionSchema).min(1),
  totalDurationSeconds: z.number().positive(),
  language: z.string().min(2).optional(),
  provider: z.string().min(1),
  generatedAt: z.string().datetime()
});

export type VoiceoverSection = z.infer<typeof VoiceoverSectionSchema>;
export type Voiceover = z.infer<typeof VoiceoverSchema>;
