import { describe, expect, test } from "vitest";
import { buildOpportunity, ContentSignalSchema, deriveMetrics, rankOpportunities } from "../src/domain/discovery.js";

const now = new Date("2026-08-23T12:00:00.000Z");

describe("discovery domain", () => {
  test("derives metrics without inventing missing optional values", () => {
    const signal = ContentSignalSchema.parse({
      id: "a",
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=a",
      title: "Signal",
      collectedAt: now.toISOString(),
      publishedAt: "2026-08-22T12:00:00.000Z",
      views: 2400,
      provenance: { source: "fixture", collectedBy: "test", note: "signal only" }
    });

    const metrics = deriveMetrics(signal, now);

    expect(metrics.ageHours).toBe(24);
    expect(metrics.viewsPerHour).toBe(100);
    expect(metrics.engagementRate).toBeUndefined();
    expect(metrics.viewFollowerRatio).toBeUndefined();
  });

  test("handles zero views and missing dates without division errors", () => {
    const signal = ContentSignalSchema.parse({
      id: "zero",
      platform: "manual",
      url: "https://example.com/zero",
      title: "Zero",
      collectedAt: now.toISOString(),
      views: 0,
      likes: 5,
      comments: 1,
      provenance: { source: "fixture", collectedBy: "test", note: "signal only" }
    });

    const opportunity = buildOpportunity(signal, now);

    expect(opportunity.metrics.engagementRate).toBeUndefined();
    expect(opportunity.score.score).toBeGreaterThanOrEqual(0);
    expect(opportunity.warnings).toContain("missing publishedAt");
  });

  test("scores and ranks recent high-velocity signals above older slower signals", () => {
    const fresh = ContentSignalSchema.parse({
      id: "fresh",
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=fresh",
      title: "Fresh",
      collectedAt: now.toISOString(),
      publishedAt: "2026-08-23T06:00:00.000Z",
      views: 100000,
      likes: 8000,
      comments: 500,
      provenance: { source: "fixture", collectedBy: "test", note: "signal only" }
    });
    const old = ContentSignalSchema.parse({
      id: "old",
      platform: "youtube",
      url: "https://www.youtube.com/watch?v=old",
      title: "Old",
      collectedAt: now.toISOString(),
      publishedAt: "2025-08-23T12:00:00.000Z",
      views: 100000,
      likes: 800,
      comments: 10,
      provenance: { source: "fixture", collectedBy: "test", note: "signal only" }
    });

    const ranked = rankOpportunities([buildOpportunity(old, now), buildOpportunity(fresh, now)], 2);

    expect(ranked[0]?.signal.id).toBe("fresh");
    expect(ranked[0]?.score.usedSignals).toContain("velocity");
    expect(ranked[0]?.score.usedSignals).toContain("recency");
  });
});
