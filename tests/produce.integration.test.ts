import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FfmpegCompositionRenderer, qaComposition } from "../src/adapters/ffmpegComposition.js";
import { probeMedia } from "../src/adapters/ffmpeg.js";
import { runProcess } from "../src/adapters/process.js";
import { produceFromScriptFile } from "../src/application/produceVideo.js";
import { buildCompositionPlan } from "../src/application/composeVideo.js";
import { ScriptPlanSchema } from "../src/domain/script.js";

const script = ScriptPlanSchema.parse({
  title: "Integration test video",
  durationSeconds: 4,
  hook: { text: "Integration hook", durationSeconds: 2 },
  sections: [
    { startSeconds: 0, endSeconds: 2, purpose: "hook", voiceover: "Ceci est un test d'intégration." },
    { startSeconds: 2, endSeconds: 4, purpose: "payoff", voiceover: "La vidéo doit être valide." }
  ],
  visualPlan: [],
  captionGuidance: { style: "dynamic", keywordsToEmphasize: [] }
});

describe("produce integration", () => {
  test("renders a real 1080x1920 mp4 from a script plan and passes QA", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-produce-"));
    const assetsDir = path.join(dir, "assets");
    await runProcess("mkdir", ["-p", assetsDir]);
    const imagePath = path.join(assetsDir, "hook.png");
    await runProcess("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=1", "-frames:v", "1", imagePath]);

    const scriptPath = path.join(dir, "script.json");
    await writeFile(scriptPath, JSON.stringify({ plan: script, provider: "test", generatedAt: new Date().toISOString() }), "utf8");

    const result = await produceFromScriptFile({
      filePath: scriptPath,
      renderer: new FfmpegCompositionRenderer(),
      outputRoot: dir,
      assetsDir,
      runId: "integration"
    });

    const probe = await probeMedia(result.artifact.path);
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(Math.abs(probe.durationSeconds - 4)).toBeLessThan(1);
    expect(probe.hasAudio).toBe(true);

    const composition = JSON.parse(await readFile(path.join(result.artifactDir, "composition.json"), "utf8")) as { layers: unknown[] };
    expect(composition.layers.length).toBeGreaterThanOrEqual(3);

    const qa = JSON.parse(await readFile(path.join(result.artifactDir, "qa.json"), "utf8")) as { status: string };
    expect(qa.status).toBe("pass");
    const artifact = JSON.parse(await readFile(path.join(result.artifactDir, "artifact.json"), "utf8")) as { sourceScriptPath: string };
    expect(artifact.sourceScriptPath).toBe(scriptPath);
  }, 60_000);

  test("qaComposition fails explicitly on a missing video", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-produce-qa-"));
    const captionsPath = path.join(dir, "captions.ass");
    await writeFile(captionsPath, "[Events]\n", "utf8");
    const plan = buildCompositionPlan(script, { assets: [] });
    const qa = await qaComposition({ videoPath: path.join(dir, "missing.mp4"), plan, captionsPath });
    expect(qa.status).toBe("fail");
    expect(qa.checks.find((check) => check.name === "file_present")?.status).toBe("fail");
    const outputStat = await stat(captionsPath);
    expect(outputStat.size).toBeGreaterThan(0);
  });
});
