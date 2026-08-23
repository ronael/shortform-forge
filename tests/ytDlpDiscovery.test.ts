import { describe, expect, test } from "vitest";
import { normalizeYtDlpEntries, parseYtDlpSearchJson } from "../src/adapters/ytDlpDiscovery.js";

describe("yt-dlp discovery adapter", () => {
  test("parses dump-single-json entries and normalizes available metadata", () => {
    const raw = parseYtDlpSearchJson({
      entries: [
        {
          id: "abc123",
          title: "Useful AI Tool",
          webpage_url: "https://www.youtube.com/watch?v=abc123",
          channel: "Creator",
          channel_id: "UC123",
          timestamp: 1787400000,
          view_count: 12000,
          like_count: 900,
          comment_count: 40,
          duration: 61,
          language: "en"
        }
      ]
    });

    const result = normalizeYtDlpEntries(raw, {
      query: "ai tools",
      collectedAt: "2026-08-23T12:00:00.000Z",
      collectedBy: "yt-dlp"
    });

    expect(result.warnings).toEqual([]);
    expect(result.signals[0]).toMatchObject({
      id: "abc123",
      platform: "youtube",
      title: "Useful AI Tool",
      creator: "Creator",
      views: 12000,
      likes: 900,
      comments: 40,
      durationSeconds: 61
    });
    expect(result.signals[0]?.provenance.note).toContain("Discovery signal only");
  });

  test("keeps item warnings explicit when required metadata is missing", () => {
    const result = normalizeYtDlpEntries([{ id: "missing-title" }], {
      query: "x",
      collectedAt: "2026-08-23T12:00:00.000Z",
      collectedBy: "yt-dlp"
    });

    expect(result.signals).toHaveLength(0);
    expect(result.warnings[0]).toContain("missing required");
  });

  test("accepts null timestamps without inventing publication dates", () => {
    const result = normalizeYtDlpEntries([{
      id: "abc123",
      title: "No date",
      webpage_url: "https://www.youtube.com/watch?v=abc123",
      timestamp: null,
      release_timestamp: null,
      view_count: 100
    }], {
      query: "x",
      collectedAt: "2026-08-23T12:00:00.000Z",
      collectedBy: "yt-dlp"
    });

    expect(result.signals[0]?.publishedAt).toBeUndefined();
    expect(result.signals[0]?.views).toBe(100);
  });
});
