import { describe, expect, test } from "vitest";
import { parseAndAlignWhisperWords } from "../src/adapters/whisperCppWordTiming.js";
import { buildVoiceoverCaptionCues } from "../src/application/captionTiming.js";
import { ScriptPlanSchema } from "../src/domain/script.js";
import { VoiceoverSchema } from "../src/domain/voice.js";

const whisperJson = {
  transcription: [{
    tokens: [
      { text: " Bonjour", offsets: { from: 0, to: 400 } },
      { text: " le", offsets: { from: 400, to: 600 } },
      { text: " monde", offsets: { from: 600, to: 1000 } }
    ]
  }]
};

describe("word-level caption timing", () => {
  test("aligns whisper.cpp full JSON tokens back to canonical words", () => {
    const aligned = parseAndAlignWhisperWords(whisperJson, "Bonjour le monde");
    expect(aligned.coverage).toBe(1);
    expect(aligned.words).toEqual([
      { text: "Bonjour", startSeconds: 0, endSeconds: 0.4 },
      { text: "le", startSeconds: 0.4, endSeconds: 0.6 },
      { text: "monde", startSeconds: 0.6, endSeconds: 1 }
    ]);
  });

  test("uses aligned cues above 95 percent coverage and falls back below it", async () => {
    const script = ScriptPlanSchema.parse({
      title: "Test",
      durationSeconds: 2,
      hook: { text: "Bonjour", durationSeconds: 2 },
      sections: [{ startSeconds: 0, endSeconds: 2, purpose: "hook", voiceover: "Bonjour le monde" }],
      captionGuidance: { style: "dynamic", backdrop: "none", keywordsToEmphasize: [] }
    });
    const voiceover = VoiceoverSchema.parse({
      sections: [{ purpose: "hook", text: "Bonjour le monde", audioPath: "/tmp/test.wav", durationSeconds: 2 }],
      totalDurationSeconds: 2,
      language: "fr",
      provider: "test",
      generatedAt: new Date().toISOString()
    });
    const aligned = await buildVoiceoverCaptionCues({
      script,
      voiceover,
      style: "dynamic",
      provider: { name: "test", align: async () => parseAndAlignWhisperWords(whisperJson, "Bonjour le monde") }
    });
    expect(aligned.timingSource).toBe("word-aligned");
    expect(aligned.cues[0]).toMatchObject({ startSeconds: 0, endSeconds: 1, text: "Bonjour le monde" });

    const fallback = await buildVoiceoverCaptionCues({
      script,
      voiceover,
      style: "dynamic",
      provider: { name: "poor", align: async () => ({ words: [{ text: "Bonjour", startSeconds: 0, endSeconds: 0.4 }], coverage: 0.5 }) }
    });
    expect(fallback.timingSource).toBe("proportional-fallback");
  });
});
