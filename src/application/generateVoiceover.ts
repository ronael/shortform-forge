import path from "node:path";
import { VoiceoverSchema, type Voiceover } from "../domain/voice.js";
import type { ScriptPlan } from "../domain/script.js";
import type { TextToSpeechProvider } from "./ports.js";
import { ensureDir, writeJson } from "./files.js";
import { loadScriptPlan } from "./produceVideo.js";

export type AudioTools = {
  probeDurationSeconds(filePath: string): Promise<number>;
  concatAudioFiles(inputPaths: string[], outputPath: string): Promise<void>;
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
  const sections = [];
  for (const [index, section] of input.script.sections.entries()) {
    const audioPath = path.join(input.outputDir, `section-${index}.wav`);
    await input.provider.synthesize(section.voiceover, audioPath);
    const durationSeconds = await input.audio.probeDurationSeconds(audioPath);
    sectionPaths.push(audioPath);
    sections.push({
      purpose: section.purpose,
      text: section.voiceover,
      audioPath,
      durationSeconds
    });
  }

  const audioPath = path.join(input.outputDir, "voiceover.wav");
  await input.audio.concatAudioFiles(sectionPaths, audioPath);

  const voiceover = VoiceoverSchema.parse({
    sections,
    totalDurationSeconds: sections.reduce((sum, section) => sum + section.durationSeconds, 0),
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
 * Re-times script sections sequentially from 0 using the REAL audio durations.
 * Total duration becomes the measured voiceover length.
 */
export function retimeScript(script: ScriptPlan, voiceover: Voiceover): ScriptPlan {
  let cursor = 0;
  const sections = script.sections.map((section, index) => {
    const duration = voiceover.sections[index]?.durationSeconds ?? section.endSeconds - section.startSeconds;
    const retimed = { ...section, startSeconds: cursor, endSeconds: cursor + duration };
    cursor += duration;
    return retimed;
  });
  return {
    ...script,
    durationSeconds: Math.ceil(cursor * 100) / 100,
    sections
  };
}
