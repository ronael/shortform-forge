import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createSampleAsset, probeMedia } from "../src/adapters/ffmpeg.js";
import { FfmpegMediaToolkit } from "../src/adapters/ffmpeg.js";
import { heuristicAnalyzer } from "../src/application/analyzer.js";
import { runClipWorkflow } from "../src/application/workflow.js";
import { WhisperCppTranscriptionProvider } from "../src/adapters/whisperCpp.js";

describe("clip workflow", () => {
  test("renders a vertical candidate and QA report from generated authorized sample", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-e2e-"));
    const sample = await createSampleAsset(path.join(dir, "sample"));
    const result = await runClipWorkflow({
      sourcePath: sample.videoPath,
      transcriptPath: sample.transcriptPath,
      provenancePath: sample.provenancePath,
      outputRoot: path.join(dir, "output"),
      jobName: "integration"
    }, {
      media: new FfmpegMediaToolkit(),
      transcription: new WhisperCppTranscriptionProvider(),
      analyzer: heuristicAnalyzer
    });

    const probe = await probeMedia(result.candidatePath);
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.hasAudio).toBe(true);
    expect(result.analysis.candidates.length).toBeGreaterThan(0);
  });
});
