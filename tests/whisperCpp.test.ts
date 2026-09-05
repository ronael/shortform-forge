import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { SourceSchema } from "../src/domain/contracts.js";
import { parseWhisperCppJson, WhisperCppTranscriptionProvider } from "../src/adapters/whisperCpp.js";

describe("whisper.cpp adapter", () => {
  test("normalizes whisper.cpp JSON output", () => {
    const transcript = parseWhisperCppJson({
      params: { language: "en" },
      result: { language: "en" },
      transcription: [
        { timestamps: { from: "00:00:01.000", to: "00:00:04.500" }, offsets: { from: 1000, to: 4500 }, text: " Hello world " }
      ]
    }, "source-1");

    expect(transcript.provider).toBe("whisper.cpp");
    expect(transcript.segments[0]?.startSeconds).toBe(1);
    expect(transcript.segments[0]?.endSeconds).toBe(4.5);
    expect(transcript.segments[0]?.text).toBe("Hello world");
  });

  test("fails clearly when no model is configured", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-asr-"));
    const sourcePath = path.join(dir, "source.mp4");
    await writeFile(sourcePath, "fake");
    const provider = new WhisperCppTranscriptionProvider({ binaryPath: "missing-whisper-cli", modelPath: "" });

    await expect(provider.transcribe({
      cacheDir: path.join(dir, "cache"),
      source: SourceSchema.parse({
        id: "s",
        originalPath: sourcePath,
        importedPath: sourcePath,
        provenance: { rights: "generated_test_asset", note: "test" },
        importedAt: new Date().toISOString(),
        media: { durationSeconds: 1, width: 1, height: 1, hasAudio: true, sizeBytes: 4 }
      })
    })).rejects.toMatchObject({ name: "AppError", code: "ASR_MODEL_MISSING" });
  });
});
