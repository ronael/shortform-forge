import { describe, expect, test } from "vitest";
import { TranscriptSchema } from "../src/domain/contracts.js";

describe("contracts", () => {
  test("rejects invalid transcript timing", () => {
    expect(() => TranscriptSchema.parse({
      sourceId: "source",
      provider: "test",
      segments: [{ startSeconds: 3, endSeconds: 2, text: "bad" }]
    })).toThrow();
  });

  test("defaults transcript language", () => {
    const transcript = TranscriptSchema.parse({
      sourceId: "source",
      provider: "test",
      segments: [{ startSeconds: 0, endSeconds: 2, text: "ok" }]
    });
    expect(transcript.language).toBe("en");
  });
});
