import { cuesFromSections, cuesFromTimedWords, type TimedWord } from "../domain/captions.js";
import type { CaptionCuePlan } from "../domain/composition.js";
import type { CaptionStyle, ScriptPlan } from "../domain/script.js";
import type { Voiceover } from "../domain/voice.js";
import type { WordTimingProvider } from "./ports.js";

const MIN_ALIGNMENT_COVERAGE = 0.95;

export async function buildVoiceoverCaptionCues(input: {
  script: ScriptPlan;
  voiceover: Voiceover;
  style: CaptionStyle;
  provider?: WordTimingProvider;
}): Promise<{ cues: CaptionCuePlan[]; timingSource: "word-aligned" | "proportional-fallback" }> {
  const speechSections = input.script.sections.map((section, index) => {
    const voiceSection = input.voiceover.sections[index];
    const startSeconds = voiceSection?.timelineStartSeconds ?? section.startSeconds;
    const endSeconds = startSeconds + (voiceSection?.durationSeconds ?? section.endSeconds - section.startSeconds);
    return { ...section, startSeconds, endSeconds };
  });
  if (!input.provider) {
    return { cues: cuesFromSections(speechSections, input.style), timingSource: "proportional-fallback" };
  }

  const timedWords: TimedWord[] = [];
  try {
    for (const [index, section] of input.voiceover.sections.entries()) {
      const result = await input.provider.align(section.audioPath, section.text, input.voiceover.language);
      if (result.coverage < MIN_ALIGNMENT_COVERAGE || result.words.length === 0) {
        return { cues: cuesFromSections(speechSections, input.style), timingSource: "proportional-fallback" };
      }
      const offset = section.timelineStartSeconds ?? speechSections[index]?.startSeconds ?? 0;
      timedWords.push(...result.words.map((word) => ({
        ...word,
        startSeconds: word.startSeconds + offset,
        endSeconds: word.endSeconds + offset
      })));
    }
    return { cues: cuesFromTimedWords(timedWords, input.style), timingSource: "word-aligned" };
  } catch {
    return { cues: cuesFromSections(speechSections, input.style), timingSource: "proportional-fallback" };
  }
}
