import path from "node:path";
import { VoiceoverSchema, type Voiceover } from "../domain/voice.js";
import type { ScriptPlan } from "../domain/script.js";
import type { TextToSpeechProvider } from "./ports.js";
import { ensureDir, writeJson } from "./files.js";
import { loadScriptPlan } from "./produceVideo.js";

export type AudioTools = {
  probeDurationSeconds(filePath: string): Promise<number>;
  concatAudioFiles(inputPaths: string[], outputPath: string, segmentDurationsSeconds?: number[]): Promise<void>;
};

/**
 * Synthesizes one audio file per script section, then MEASURES the real
 * durations. The voiceover becomes the temporal backbone: timings are never
 * assumed from the script or the TTS engine.
 */
export async function generateVoiceover(input: {
  script: ScriptPlan;
  provider: TextToSpeechProvider;
  outputDir: string;
  audio: AudioTools;
}): Promise<{ voiceover: Voiceover; audioPath: string }> {
  await ensureDir(input.outputDir);
  const sectionPaths: string[] = [];
  const measuredSections = [];
  const batchItems = input.script.sections.map((section, index) => ({
    text: section.voiceover,
    outputPath: path.join(input.outputDir, `section-${index}.wav`)
  }));
  if (input.provider.synthesizeBatch) {
    await input.provider.synthesizeBatch(batchItems);
  }
  for (const [index, section] of input.script.sections.entries()) {
    const audioPath = batchItems[index]!.outputPath;
    if (!input.provider.synthesizeBatch) await input.provider.synthesize(section.voiceover, audioPath);
    const durationSeconds = await input.audio.probeDurationSeconds(audioPath);
    sectionPaths.push(audioPath);
    measuredSections.push({
      purpose: section.purpose,
      text: section.voiceover,
      audioPath,
      durationSeconds
    });
  }

  const timeline = allocateVoiceTimeline(input.script, measuredSections.map((section) => section.durationSeconds));
  const sections = measuredSections.map((section, index) => ({
    ...section,
    timelineStartSeconds: timeline[index]!.startSeconds,
    timelineEndSeconds: timeline[index]!.endSeconds
  }));

  const audioPath = path.join(input.outputDir, "voiceover.wav");
  await input.audio.concatAudioFiles(
    sectionPaths,
    audioPath,
    timeline.map((section) => section.endSeconds - section.startSeconds)
  );

  const voiceover = VoiceoverSchema.parse({
    sections,
    totalDurationSeconds: sections.reduce((sum, section) => sum + section.durationSeconds, 0),
    timelineDurationSeconds: timeline.at(-1)!.endSeconds,
    ...(input.script.language ? { language: input.script.language } : {}),
    provider: input.provider.name,
    generatedAt: new Date().toISOString()
  });
  await writeJson(path.join(input.outputDir, "voiceover.json"), voiceover);
  return { voiceover, audioPath };
}

export async function generateVoiceoverFromFile(input: {
  filePath: string;
  provider: TextToSpeechProvider;
  outputDir: string;
  audio: AudioTools;
}): Promise<{ voiceover: Voiceover; audioPath: string; script: ScriptPlan }> {
  const script = await loadScriptPlan(path.resolve(input.filePath));
  const result = await generateVoiceover({ script, provider: input.provider, outputDir: input.outputDir, audio: input.audio });
  return { ...result, script };
}

/**
 * Re-times sections from measured speech while preserving the editorial target.
 * New voiceover artifacts carry visual holds between sections. Legacy artifacts
 * stay contiguous and put any remaining hold on the final scene.
 */
export function retimeScript(script: ScriptPlan, voiceover: Voiceover): ScriptPlan {
  const hasTimeline = voiceover.sections.every((section) =>
    section.timelineStartSeconds !== undefined && section.timelineEndSeconds !== undefined
  );
  const editorialDuration = Math.max(script.durationSeconds, voiceover.timelineDurationSeconds ?? voiceover.totalDurationSeconds);
  let cursor = 0;
  const sections = script.sections.map((section, index) => {
    const voiceSection = voiceover.sections[index];
    const startSeconds = hasTimeline ? voiceSection?.timelineStartSeconds ?? cursor : cursor;
    const speechDuration = voiceSection?.durationSeconds ?? section.endSeconds - section.startSeconds;
    const endSeconds = hasTimeline ? voiceSection?.timelineEndSeconds ?? startSeconds + speechDuration : startSeconds + speechDuration;
    cursor = endSeconds;
    return { ...section, startSeconds, endSeconds };
  });
  if (!hasTimeline && sections.length > 0 && cursor < editorialDuration) {
    const last = sections.at(-1)!;
    sections[sections.length - 1] = { ...last, endSeconds: editorialDuration };
  }
  return {
    ...script,
    durationSeconds: Math.ceil(Math.max(editorialDuration, cursor) * 100) / 100,
    sections
  };
}

export function allocateVoiceTimeline(script: ScriptPlan, speechDurations: number[]): Array<{ startSeconds: number; endSeconds: number }> {
  const speechTotal = speechDurations.reduce((sum, duration) => sum + duration, 0);
  const targetDuration = Math.max(script.durationSeconds, speechTotal);
  const slack = Math.max(0, targetDuration - speechTotal);
  const plannedDurations = script.sections.map((section) => section.endSeconds - section.startSeconds);
  const plannedTotal = plannedDurations.reduce((sum, duration) => sum + duration, 0) || script.sections.length;
  let cursor = 0;
  return script.sections.map((_, index) => {
    const speechDuration = speechDurations[index] ?? plannedDurations[index] ?? 0;
    const weight = (plannedDurations[index] ?? 1) / plannedTotal;
    const allocatedDuration = speechDuration + slack * weight;
    const result = { startSeconds: cursor, endSeconds: cursor + allocatedDuration };
    cursor = result.endSeconds;
    return result;
  });
}
