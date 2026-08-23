import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  ContentSignalSchema,
  DiscoveryRunSchema,
  rankOpportunities,
  buildOpportunity,
  type ContentSignal,
  type DiscoveryRun,
  type Opportunity
} from "../domain/discovery.js";
import type { DiscoverySource } from "./discoveryPorts.js";
import { ensureDir, slug, writeJson } from "./files.js";

export type DiscoveryWorkflowResult = {
  run: DiscoveryRun;
  signals: ContentSignal[];
  opportunities: Opportunity[];
  warnings: string[];
};

export async function runDiscoverySearch(input: {
  source: DiscoverySource;
  query: string;
  limit: number;
  outputRoot: string;
  top?: number;
  runId?: string;
}): Promise<DiscoveryWorkflowResult> {
  const result = await input.source.search({ query: input.query, limit: input.limit });
  return persistDiscoveryRun({
    source: result.source,
    query: input.query,
    limit: input.limit,
    outputRoot: input.outputRoot,
    ...(input.runId ? { runId: input.runId } : {}),
    signals: result.signals,
    warnings: result.warnings,
    raw: result.raw,
    ...(input.top ? { top: input.top } : {})
  });
}

export async function importDiscoverySignals(input: {
  filePath: string;
  outputRoot: string;
  top?: number;
  runId?: string;
}): Promise<DiscoveryWorkflowResult> {
  const raw = JSON.parse(await readFile(path.resolve(input.filePath), "utf8")) as unknown;
  const values = Array.isArray(raw) ? raw : readSignalsProperty(raw);
  const signals = values.map((value) => ContentSignalSchema.parse(value));
  return persistDiscoveryRun({
    source: "manual-import",
    outputRoot: input.outputRoot,
    ...(input.runId ? { runId: input.runId } : {}),
    signals,
    warnings: [],
    raw: values,
    ...(input.top ? { top: input.top } : {})
  });
}

async function persistDiscoveryRun(input: {
  source: string;
  query?: string;
  limit?: number;
  outputRoot: string;
  runId?: string;
  signals: ContentSignal[];
  warnings: string[];
  raw: unknown[];
  top?: number;
}): Promise<DiscoveryWorkflowResult> {
  const collectedAt = new Date().toISOString();
  const runId = slug(input.runId ?? `${input.source}-${input.query ?? "import"}-${collectedAt}`);
  const artifactDir = path.resolve(input.outputRoot, "discovery", runId);
  await ensureDir(artifactDir);

  const opportunities = rankOpportunities(input.signals.map((signal) => buildOpportunity(signal, new Date(collectedAt))), input.top ?? 20);
  const run = DiscoveryRunSchema.parse({
    id: runId,
    source: input.source,
    ...(input.query ? { query: input.query } : {}),
    ...(input.limit ? { limit: input.limit } : {}),
    collectedAt,
    artifactDir,
    errors: []
  });

  await writeJson(path.join(artifactDir, "run.json"), run);
  await writeJson(path.join(artifactDir, "signals.json"), { signals: input.signals, raw: input.raw, warnings: input.warnings });
  await writeJson(path.join(artifactDir, "opportunities.json"), { opportunities });

  return { run, signals: input.signals, opportunities, warnings: input.warnings };
}

function readSignalsProperty(raw: unknown): unknown[] {
  if (typeof raw === "object" && raw !== null && "signals" in raw) {
    const signals = (raw as { signals: unknown }).signals;
    if (Array.isArray(signals)) return signals;
  }
  throw new Error("Discovery import must be an array of ContentSignal objects or an object with a signals array.");
}
