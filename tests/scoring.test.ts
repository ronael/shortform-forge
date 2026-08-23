import { describe, expect, test } from "vitest";
import { TranscriptSchema } from "../src/domain/contracts.js";
import { analyzeTranscript } from "../src/domain/scoring.js";

describe("analyzeTranscript", () => {
  test("selects a bounded, scored candidate with useful reasons", () => {
    const transcript = TranscriptSchema.parse({
      sourceId: "source-1",
      language: "en",
      provider: "test",
      segments: [
        { startSeconds: 0, endSeconds: 7, text: "This is a small setup before the point." },
        { startSeconds: 7, endSeconds: 16, text: "The mistake most creators make is hiding the hook until the end." },
        { startSeconds: 16, endSeconds: 26, text: "Here is why that fails: viewers need a reason to stay immediately." },
        { startSeconds: 26, endSeconds: 36, text: "But a simple payoff can turn the same source into a stronger clip." }
      ]
    });

    const candidates = analyzeTranscript(transcript);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]?.score).toBeGreaterThan(50);
    expect(candidates[0]?.text).toContain("mistake");
    expect(candidates[0]?.reasons.length).toBeGreaterThan(0);
  });
});
