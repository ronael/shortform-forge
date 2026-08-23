import { describe, expect, test } from "vitest";
import { buildAssCaptions, checkCaptionCompleteness, extractAssDialogueText } from "../src/domain/captions.js";
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

  test("does not drop the final word from the known standalone hook regression", () => {
    const transcript = TranscriptSchema.parse({
      sourceId: "s",
      provider: "test",
      segments: [
        {
          startSeconds: 8,
          endSeconds: 17,
          text: "The mistake most creators make is clipping moments without a clear standalone hook."
        }
      ]
    });
    const candidate = CandidateSegmentSchema.parse({
      id: "c",
      startSeconds: 8,
      endSeconds: 17,
      text: transcript.segments[0]?.text,
      score: 80,
      reasons: ["regression"]
    });

    const ass = buildAssCaptions(transcript, candidate);
    const renderedText = dialogueText(ass);

    expect(renderedText).toContain("without a clear standalone hook");
    expect(words(renderedText)).toEqual(words(transcript.segments[0]?.text ?? ""));
  });

  test("splits a long transcript segment into multiple readable cues without losing words", () => {
    const longText = "A strong clip has surprise, simple context, useful payoff, captions that stay readable, and enough structure that a viewer understands the idea without needing the previous minute.";
    const transcript = TranscriptSchema.parse({
      sourceId: "s",
      provider: "test",
      segments: [{ startSeconds: 0, endSeconds: 18, text: longText }]
    });
    const candidate = CandidateSegmentSchema.parse({
      id: "c",
      startSeconds: 0,
      endSeconds: 18,
      text: longText,
      score: 80,
      reasons: ["long segment"]
    });

    const ass = buildAssCaptions(transcript, candidate);
    const events = ass.split("\n").filter((line) => line.startsWith("Dialogue:"));

    expect(events.length).toBeGreaterThan(1);
    expect(words(dialogueText(ass))).toEqual(words(longText));
    expect(events.every((event) => event.split("\\N").length <= 3)).toBe(true);
    expect(events[0]).toContain("Dialogue: 0,0:00:00.00");
  });

  test("caption completeness QA fails when ASS drops a transcript word", () => {
    const transcript = TranscriptSchema.parse({
      sourceId: "s",
      provider: "test",
      segments: [
        {
          startSeconds: 8,
          endSeconds: 17,
          text: "The mistake most creators make is clipping moments without a clear standalone hook."
        }
      ]
    });
    const candidate = CandidateSegmentSchema.parse({
      id: "c",
      startSeconds: 8,
      endSeconds: 17,
      text: transcript.segments[0]?.text,
      score: 80,
      reasons: ["regression"]
    });
    const truncatedAss = `Dialogue: 0,0:00:00.00,0:00:09.00,Caption,,0,0,0,,The mistake most creators make is clipping moments without a clear standalone`;

    const completeness = checkCaptionCompleteness(truncatedAss, transcript, candidate);

    expect(completeness.status).toBe("fail");
    expect(completeness.missingWords).toContain("hook");
  });
});

function dialogueText(ass: string): string {
  return extractAssDialogueText(ass);
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}
