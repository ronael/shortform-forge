import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { importDiscoverySignals, runDiscoverySearch } from "../src/application/discoveryWorkflow.js";
import type { DiscoverySource } from "../src/application/discoveryPorts.js";
import { ContentSignalSchema } from "../src/domain/discovery.js";

describe("discovery workflow", () => {
  test("persists run, signals and opportunities artifacts", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-discovery-"));
    const source: DiscoverySource = {
      source: "fixture",
      async search() {
        return {
          source: "fixture",
          query: "ai tools",
          collectedAt: "2026-08-23T12:00:00.000Z",
          warnings: ["item 2 incomplete"],
          raw: [{ id: "a" }],
          signals: [signal("a", 50000)]
        };
      }
    };

    const result = await runDiscoverySearch({
      source,
      query: "ai tools",
      limit: 10,
      outputRoot: dir,
      runId: "fixture-run",
      top: 5
    });

    const opportunities = JSON.parse(await readFile(path.join(result.run.artifactDir, "opportunities.json"), "utf8")) as { opportunities: unknown[] };
    const signals = JSON.parse(await readFile(path.join(result.run.artifactDir, "signals.json"), "utf8")) as { signals: unknown[]; raw: unknown[]; warnings: string[] };

    expect(result.opportunities).toHaveLength(1);
    expect(opportunities.opportunities).toHaveLength(1);
    expect(signals.signals).toHaveLength(1);
    expect(signals.raw).toHaveLength(1);
    expect(signals.warnings).toContain("item 2 incomplete");
  });

  test("imports normalized generic signals into the same scoring pipeline", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sf-discovery-import-"));
    const filePath = path.join(dir, "signals.json");
    await writeFile(filePath, JSON.stringify({ signals: [signal("manual", 1000)] }), "utf8");

    const result = await importDiscoverySignals({
      filePath,
      outputRoot: dir,
      runId: "manual-import",
      top: 10
    });

    expect(result.signals[0]?.id).toBe("manual");
    expect(result.opportunities[0]?.signal.id).toBe("manual");
  });
});

function signal(id: string, views: number) {
  return ContentSignalSchema.parse({
    id,
    platform: "manual",
    url: `https://example.com/${id}`,
    title: `Signal ${id}`,
    collectedAt: "2026-08-23T12:00:00.000Z",
    publishedAt: "2026-08-22T12:00:00.000Z",
    views,
    likes: Math.round(views * 0.05),
    comments: 10,
    provenance: { source: "fixture", collectedBy: "test", note: "Discovery signal only." }
  });
}
