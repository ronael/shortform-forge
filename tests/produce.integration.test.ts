import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FfmpegCompositionRenderer, qaComposition } from "../src/adapters/ffmpegComposition.js";
import { probeMedia } from "../src/adapters/ffmpeg.js";
import { runProcess } from "../src/adapters/process.js";
import { produceFromScriptFile, resolveSectionAssets } from "../src/application/produceVideo.js";
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
  test("requires explicit provenance for a music bed", async () => {
    await expect(produceFromScriptFile({
      filePath: "script.json",
      renderer: new FfmpegCompositionRenderer(),
      outputRoot: "/tmp",
      audioBedPath: "music.mp3"
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("loads focal placement and scrim settings from an asset manifest", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-assets-"));
    await writeFile(path.join(dir, "portrait.jpg"), "fixture", "utf8");
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify({
      assets: [{
        purpose: "hook",
        file: "portrait.jpg",
        provenance: "authorized test fixture",
        fit: "cover",
        focalPoint: { x: 0.2, y: 0.35 },
        textBackdrop: "scrim"
      }]
    }), "utf8");

    const assets = await resolveSectionAssets(dir);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      purpose: "hook",
      placement: { fit: "cover", focalPoint: { x: 0.2, y: 0.35 } },
      textBackdrop: "scrim"
    });
  });

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
    expect((await stat(path.join(result.artifactDir, "contact-sheet.jpg"))).size).toBeGreaterThan(1_000);
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

  test("mixes a licensed music bed without shortening the editorial duration", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-produce-music-"));
    const scriptPath = path.join(dir, "script.json");
    await writeFile(scriptPath, JSON.stringify({ ...script, musicGuidance: { mode: "on", mood: "test" } }), "utf8");
    const musicPath = path.join(dir, "music.wav");
    await runProcess("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=1", musicPath]);
    const result = await produceFromScriptFile({
      filePath: scriptPath,
      renderer: new FfmpegCompositionRenderer(),
      outputRoot: dir,
      runId: "music",
      audioBedPath: musicPath,
      audioBedProvenance: "generated integration fixture"
    });
    const probe = await probeMedia(result.artifact.path);
    expect(probe.durationSeconds).toBeCloseTo(4, 0);
    expect(probe.audioChannels).toBe(2);
    expect(probe.audioSampleRate).toBe(48_000);
    const qa = JSON.parse(await readFile(path.join(result.artifactDir, "qa.json"), "utf8")) as { checks: Array<{ name: string }> };
    expect(qa.checks.some((check) => check.name === "music_bed")).toBe(true);
  }, 60_000);
});
