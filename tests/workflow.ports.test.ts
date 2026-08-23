import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { ClipWorkflowDependencies } from "../src/application/ports.js";
import { runClipWorkflow } from "../src/application/workflow.js";

describe("runClipWorkflow with ports", () => {
  test("uses transcript override without calling ASR", async () => {
    const dir = await makeFixture();
    let asrCalls = 0;
    const deps = fakeDeps(() => {
      asrCalls += 1;
      throw new Error("ASR should not be called");
    });

    const result = await runClipWorkflow({
      sourcePath: path.join(dir, "source.mp4"),
      transcriptPath: path.join(dir, "transcript.json"),
      outputRoot: path.join(dir, "output"),
      jobName: "manual"
    }, deps);

    expect(result.transcript.provider).toBe("fixture");
    expect(asrCalls).toBe(0);
    expect(result.analysis.strategy).toBe("fake");
  });

  test("transcribes through provider when no transcript override is supplied", async () => {
    const dir = await makeFixture();
    let asrCalls = 0;
    const deps = fakeDeps(async () => {
      asrCalls += 1;
      return {
        sourceId: "source",
        language: "en",
        provider: "fake-asr",
        segments: [{ startSeconds: 0, endSeconds: 12, text: "Why this generated clip works as a standalone hook." }]
      };
    });

    const result = await runClipWorkflow({
      sourcePath: path.join(dir, "source.mp4"),
      outputRoot: path.join(dir, "output"),
      jobName: "asr"
    }, deps);

    expect(result.transcript.provider).toBe("fake-asr");
    expect(asrCalls).toBe(1);
  });
});

async function makeFixture(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sf-ports-"));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "source.mp4"), "fake media");
  await writeFile(path.join(dir, "transcript.json"), JSON.stringify({
    sourceId: "input",
    language: "en",
    provider: "fixture",
    segments: [{ startSeconds: 0, endSeconds: 12, text: "The mistake is clipping without a hook." }]
  }), "utf8");
  return dir;
}

function fakeDeps(transcribe: ClipWorkflowDependencies["transcription"]["transcribe"]): ClipWorkflowDependencies {
  return {
    media: {
      async probe() {
        return { durationSeconds: 20, width: 1920, height: 1080, hasAudio: true, sizeBytes: 1000 };
      },
      async renderVerticalClip(input) {
        return path.join(input.outputDir, "candidate.mp4");
      },
      async qaVideo(input) {
        return {
          status: "pass",
          generatedAt: new Date().toISOString(),
          videoPath: input.videoPath,
          checks: [{ name: "fake", status: "pass", detail: "ok" }]
        };
      }
    },
    transcription: { transcribe },
    analyzer: {
      strategy: "fake",
      analyze() {
        return [{
          id: "candidate-1",
          startSeconds: 0,
          endSeconds: 12,
          text: "The mistake is clipping without a hook.",
          score: 80,
          reasons: ["test"]
        }];
      }
    }
  };
}
