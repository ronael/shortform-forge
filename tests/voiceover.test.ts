import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { CommandTextToSpeechProvider } from "../src/adapters/commandTts.js";
import { generateVoiceover, retimeScript } from "../src/application/generateVoiceover.js";
import type { TextToSpeechProvider } from "../src/application/ports.js";
import { ScriptPlanSchema } from "../src/domain/script.js";
import { VoiceoverSchema } from "../src/domain/voice.js";

const script = ScriptPlanSchema.parse({
  title: "Test",
  durationSeconds: 6,
  hook: { text: "Hook", durationSeconds: 2 },
  sections: [
    { startSeconds: 0, endSeconds: 2, purpose: "hook", voiceover: "Accroche." },
    { startSeconds: 2, endSeconds: 6, purpose: "payoff", voiceover: "Conclusion plus longue." }
  ],
  visualPlan: [],
  captionGuidance: { style: "dynamic", keywordsToEmphasize: [] }
});

// Simulates a TTS engine whose real durations differ from the script plan.
function fakeTts(): TextToSpeechProvider {
  return {
    name: "fake-tts",
    synthesize: async () => {}
  };
}

const fakeAudio = {
  probeDurationSeconds: async (filePath: string) => (filePath.includes("section-0") ? 2.5 : 5.5),
  concatAudioFiles: async () => {}
};

describe("CommandTextToSpeechProvider", () => {
  test("rejects missing configuration and missing {output} placeholder", () => {
    expect(() => new CommandTextToSpeechProvider(undefined)).toThrowError(/No text-to-speech provider/);
    expect(() => new CommandTextToSpeechProvider("cat")).toThrowError(/\{output\}/);
  });

  test("pipes the text on stdin to the configured command and substitutes {output}", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-tts-"));
    const out = path.join(dir, "out.wav");
    const provider = new CommandTextToSpeechProvider("tee {output}");
    await provider.synthesize("Bonjour le monde", out);
    const captured = await (await import("node:fs/promises")).readFile(out, "utf8");
    expect(captured).toBe("Bonjour le monde");
    expect(provider.name).toBe("tee {output}");
  });

  test("fails explicitly when the command does not exist", async () => {
    const provider = new CommandTextToSpeechProvider("sf-nonexistent-tts {output}");
    await expect(provider.synthesize("x", "/tmp/x.wav")).rejects.toMatchObject({ code: "MISSING_DEPENDENCY" });
  });
});

describe("generateVoiceover + retimeScript", () => {
  test("measures real durations and re-times sections sequentially", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-voice-"));
    const { voiceover, audioPath } = await generateVoiceover({
      script,
      provider: fakeTts(),
      outputDir: dir,
      audio: fakeAudio
    });

    expect(VoiceoverSchema.parse(voiceover).totalDurationSeconds).toBe(8);
    expect(voiceover.sections[0]?.durationSeconds).toBe(2.5);
    expect(voiceover.sections[1]?.durationSeconds).toBe(5.5);
    expect(audioPath).toBe(path.join(dir, "voiceover.wav"));

    const retimed = retimeScript(script, voiceover);
    expect(retimed.sections[0]?.startSeconds).toBe(0);
    expect(retimed.sections[0]?.endSeconds).toBe(2.5);
    expect(retimed.sections[1]?.startSeconds).toBe(2.5);
    expect(retimed.sections[1]?.endSeconds).toBe(8);
    expect(retimed.durationSeconds).toBe(8);
  });

  test("persists voiceover.json artifact", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-voice-"));
    await generateVoiceover({ script, provider: fakeTts(), outputDir: dir, audio: fakeAudio });
    const persisted = VoiceoverSchema.parse(JSON.parse(
      await (await import("node:fs/promises")).readFile(path.join(dir, "voiceover.json"), "utf8")
    ));
    expect(persisted.provider).toBe("fake-tts");
  });
});

describe("produce with voiceover", () => {
  test("re-times the composition from real audio and maps the voice track", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-produce-voice-"));
    const scriptPath = path.join(dir, "script.json");
    await writeFile(scriptPath, JSON.stringify(script), "utf8");
    const voiceoverDir = path.join(dir, "voice");
    await import("node:fs/promises").then((fs) => fs.mkdir(voiceoverDir, { recursive: true }));
    const voiceover = VoiceoverSchema.parse({
      sections: [
        { purpose: "hook", text: "Accroche.", audioPath: "a.wav", durationSeconds: 3 },
        { purpose: "payoff", text: "Conclusion.", audioPath: "b.wav", durationSeconds: 4 }
      ],
      totalDurationSeconds: 7,
      provider: "test",
      generatedAt: new Date().toISOString()
    });
    await writeFile(path.join(voiceoverDir, "voiceover.json"), JSON.stringify(voiceover), "utf8");

    const { produceFromScriptFile } = await import("../src/application/produceVideo.js");
    const rendered: { audio?: string | undefined; plan?: unknown } = {};
    const renderer = {
      renderer: "fake",
      render: async (plan: { durationSeconds: number }, outputDir: string, options?: { audioPath?: string }) => {
        rendered.audio = options?.audioPath;
        rendered.plan = plan;
        return {
          path: path.join(outputDir, "video.mp4"),
          width: 1080, height: 1920, fps: 30,
          durationSeconds: plan.durationSeconds,
          sizeBytes: 1,
          producedAt: new Date().toISOString(),
          provenance: { renderer: "fake", note: "test" }
        };
      }
    };

    const result = await produceFromScriptFile({
      filePath: scriptPath,
      renderer,
      outputRoot: dir,
      voiceoverPath: path.join(voiceoverDir, "voiceover.json")
    });

    expect(result.plan.durationSeconds).toBe(7);
    expect(rendered.audio).toBe(path.join(voiceoverDir, "voiceover.wav"));
    const assetLayers = result.plan.layers.filter((layer) => layer.kind === "asset");
    expect(assetLayers[1]?.startSeconds).toBe(3);
    expect(assetLayers[1]?.endSeconds).toBe(7);
  });
});
