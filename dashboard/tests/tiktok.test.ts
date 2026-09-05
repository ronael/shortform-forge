import { describe, expect, it } from "vitest";
import { testing } from "../server/tiktok.js";

describe("TikTok chunk planning", () => {
  it("uploads files below 5 MB as one chunk", () => {
    expect(testing.chunkPlan(4 * 1024 * 1024)).toEqual({ size: 4 * 1024 * 1024, count: 1 });
  });

  it("keeps standard chunks at or below 64 MB", () => {
    expect(testing.chunkPlan(129 * 1024 * 1024)).toEqual({ size: 64 * 1024 * 1024, count: 2 });
  });
});
