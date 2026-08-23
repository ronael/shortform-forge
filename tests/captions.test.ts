import { describe, expect, test } from "vitest";
import { buildAssCaptions } from "../src/domain/captions.js";
import { CandidateSegmentSchema, TranscriptSchema } from "../src/domain/contracts.js";

describe("buildAssCaptions", () => {
  test("creates ASS events relative to candidate start", () => {
    const transcript = TranscriptSchema.parse({
      sourceId: "s",
      provider: "test",
      segments: [
        { startSeconds: 10, endSeconds: 14, text: "A readable caption appears here." },
        { startSeconds: 14, endSeconds: 18, text: "The next line stays inside safe zones." }
      ]
    });
    const candidate = CandidateSegmentSchema.parse({
      id: "c",
      startSeconds: 10,
      endSeconds: 18,
      text: "A readable caption appears here. The next line stays inside safe zones.",
      score: 80,
      reasons: ["test"]
    });

    const ass = buildAssCaptions(transcript, candidate);

    expect(ass).toContain("Style: Caption");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:04.00");
    expect(ass).toContain("safe zones");
  });
});
