import { describe, expect, it } from "vitest";
import { publicationPlan } from "../server/publication-plan.js";
import type { DashboardState, VideoRecord } from "../shared/contracts.js";

const state = (): DashboardState => ({ version: 1, videos: {}, accounts: {}, publications: [] });

describe("publicationPlan", () => {
  it("returns the bilingual launch calendar and blocks the wombat entries", () => {
    const items = publicationPlan([], state());
    expect(items).toHaveLength(10);
    expect(items.filter((item) => item.locale === "fr-FR")).toHaveLength(5);
    expect(items.filter((item) => item.status === "blocked")).toHaveLength(2);
  });

  it("links a plan entry to its indexed master and restores saved progress", () => {
    const dashboardState = state();
    dashboardState.publicationPlan = {
      "launch-2026-09-07-fr": {
        status: "published",
        urls: { tiktok: "https://www.tiktok.com/example", youtube: "", instagram: "" },
        updatedAt: "2026-09-07T20:00:00.000Z",
      },
    };
    const video = {
      id: "video-1", locale: "fr-FR", relativePath: "output/series/questions-insolites-fr-v1/result/oignon-larmes.mp4",
    } as VideoRecord;
    const item = publicationPlan([video], dashboardState)[0]!;
    expect(item).toMatchObject({ videoId: "video-1", status: "published" });
    expect(item.urls.tiktok).toContain("tiktok.com");
  });
});
