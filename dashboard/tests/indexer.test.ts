import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VideoIndexer } from "../server/indexer.js";
import type { DashboardState } from "../shared/contracts.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const emptyState = (): DashboardState => ({ version: 1, videos: {}, accounts: {}, publications: [] });

describe("VideoIndexer", () => {
  it("indexes allowed results, excludes sources, and deduplicates media", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sf-dashboard-index-")); roots.push(root);
    const series = resolve(root, "output/series/questions-insolites-fr-v1/result");
    const benchmark = resolve(root, "output/benchmarks/example/result");
    const source = resolve(root, "output/benchmarks/example/source");
    await Promise.all([mkdir(series, { recursive: true }), mkdir(benchmark, { recursive: true }), mkdir(source, { recursive: true })]);
    await Promise.all([
      writeFile(resolve(series, "episode.mp4"), "same-video"),
      writeFile(resolve(benchmark, "video.mp4"), "same-video"),
      writeFile(resolve(source, "ignored.mp4"), "ignored"),
      writeFile(resolve(root, "output/series/questions-insolites-fr-v1/qa-report.json"), JSON.stringify({ episodes: [{ id: "episode", technicalStatus: "pass" }] })),
    ]);
    const records = await new VideoIndexer(root).scan(emptyState());
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: "production", locale: "fr-FR", qaStatus: "pass" });
    expect(records[0]?.hashtags).toEqual(expect.arrayContaining(["curiosite", "faitsinsolites", "bizarrementcurieux"]));
    expect(records[0]?.hashtags).toHaveLength(8);
  });

  it("requires promotion, review, and a known locale for a POC", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sf-dashboard-poc-")); roots.push(root);
    const result = resolve(root, "output/benchmarks/example/result");
    await mkdir(result, { recursive: true });
    await writeFile(resolve(result, "video.mp4"), "poc-video");
    await writeFile(resolve(root, "output/benchmarks/example/qa-report.json"), JSON.stringify({ status: "technical-pass-human-review-pending" }));
    const indexer = new VideoIndexer(root);
    const first = (await indexer.scan(emptyState()))[0]!;
    expect(first.blockReasons).toContain("Ce POC doit être promu comme candidat.");
    const state = emptyState();
    state.videos[first.checksum] = { promoted: true, humanStatus: "approved", caption: "Ready", hashtags: [], updatedAt: new Date().toISOString() };
    const reviewed = (await indexer.scan(state))[0]!;
    expect(reviewed.canPublish).toBe(false);
    expect(reviewed.blockReasons).toContain("La langue de la vidéo doit être confirmée.");
  });

  it("keeps a custom hashtag selection instead of replacing it with suggestions", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "sf-dashboard-tags-")); roots.push(root);
    const result = resolve(root, "output/series/questions-insolites-fr-v1/result");
    await mkdir(result, { recursive: true });
    await writeFile(resolve(result, "piment.mp4"), "pepper-video");
    const state = emptyState();
    const first = (await new VideoIndexer(root).scan(state))[0]!;
    state.videos[first.checksum] = { promoted: true, humanStatus: "approved", caption: "Piment", hashtags: ["monchoix", "piment"], updatedAt: new Date().toISOString() };
    const reviewed = (await new VideoIndexer(root).scan(state))[0]!;
    expect(reviewed.hashtags).toEqual(["monchoix", "piment"]);
  });
});
