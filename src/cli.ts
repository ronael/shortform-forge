#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSampleAsset, FfmpegMediaToolkit } from "./adapters/ffmpeg.js";
import { runDoctor } from "./adapters/doctor.js";
import { WhisperCppTranscriptionProvider } from "./adapters/whisperCpp.js";
import { YtDlpDiscoverySource } from "./adapters/ytDlpDiscovery.js";
import { heuristicAnalyzer } from "./application/analyzer.js";
import { importDiscoverySignals, runDiscoverySearch, type DiscoveryWorkflowResult } from "./application/discoveryWorkflow.js";
import { asAppError } from "./domain/errors.js";
import { initOutputRoot, runClipWorkflow } from "./application/workflow.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("sf")
    .description("Shortform Forge local clipping CLI")
    .version("0.1.0");

  program
    .command("doctor")
    .description("Check local dependencies for clipping and ASR")
    .action(async () => {
      await run(async () => {
        const report = await runDoctor();
        printJson(report);
        if (report.status !== "pass") process.exitCode = 1;
      });
    });

  program
    .command("discover")
    .description("Discover and score content signals")
    .addCommand(new Command("youtube")
      .description("Search YouTube via yt-dlp without downloading videos")
      .argument("<query>", "search query")
      .option("-l, --limit <number>", "number of results to request", parsePositiveInt, 30)
      .option("-o, --output <dir>", "output root directory", "output")
      .option("--top <number>", "number of opportunities to keep", parsePositiveInt, 20)
      .option("--run-id <id>", "stable run id")
      .option("--json", "print machine-readable result")
      .action(async (query: string, options: { limit: number; output: string; top: number; runId?: string; json?: boolean }) => {
        await run(async () => {
          const result = await runDiscoverySearch({
            source: new YtDlpDiscoverySource(),
            query,
            limit: options.limit,
            outputRoot: options.output,
            top: options.top,
            ...(options.runId ? { runId: options.runId } : {})
          });
          printDiscoveryResult(result, Boolean(options.json));
        });
      }))
    .addCommand(new Command("import")
      .description("Import normalized ContentSignal objects from JSON and score them")
      .argument("<file>", "JSON file containing an array or { signals: [...] }")
      .option("-o, --output <dir>", "output root directory", "output")
      .option("--top <number>", "number of opportunities to keep", parsePositiveInt, 20)
      .option("--run-id <id>", "stable run id")
      .option("--json", "print machine-readable result")
      .action(async (file: string, options: { output: string; top: number; runId?: string; json?: boolean }) => {
        await run(async () => {
          const result = await importDiscoverySignals({
            filePath: file,
            outputRoot: options.output,
            top: options.top,
            ...(options.runId ? { runId: options.runId } : {})
          });
          printDiscoveryResult(result, Boolean(options.json));
        });
      }));

  program
    .command("make-sample")
    .description("Generate a legal local sample video, transcript and provenance files")
    .option("-o, --output <dir>", "sample output directory", "samples")
    .action(async (options: { output: string }) => {
      await run(async () => {
        const result = await createSampleAsset(path.resolve(options.output));
        printJson(result);
      });
    });

  program
    .command("clip")
    .description("Run import, transcript/ASR, analysis, render and QA")
    .argument("<source>", "authorized local source video path")
    .option("-t, --transcript <path>", "transcript JSON path override/cache")
    .option("-p, --provenance <path>", "provenance JSON path")
    .option("-o, --output <dir>", "output root directory", "output")
    .option("-c, --cache <dir>", "cache root directory", ".sf-cache")
    .option("-j, --job <name>", "stable job name")
    .action(async (source: string, options: { transcript?: string; provenance?: string; output: string; cache: string; job?: string }) => {
      await run(async () => {
        await initOutputRoot(options.output);
        const workflowOptions = {
          sourcePath: source,
          ...(options.transcript ? { transcriptPath: options.transcript } : {}),
          ...(options.provenance ? { provenancePath: options.provenance } : {}),
          outputRoot: options.output,
          cacheDir: options.cache,
          ...(options.job ? { jobName: options.job } : {})
        };
        const result = await runClipWorkflow(workflowOptions, {
          media: new FfmpegMediaToolkit(),
          transcription: new WhisperCppTranscriptionProvider(),
          analyzer: heuristicAnalyzer
        });
        printJson({
          status: "pass",
          jobDir: result.jobDir,
          selectedCandidateId: result.analysis.selectedCandidateId,
          candidatePath: result.candidatePath,
          qaPath: result.qaPath
        });
      });
    });

  return program;
}

if (isDirectInvocation()) {
  createProgram().parseAsync(process.argv).catch((error: unknown) => {
    const appError = asAppError(error);
    printJson({ status: "fail", code: appError.code, message: appError.message, hint: appError.hint });
    process.exitCode = 1;
  });
}

function isDirectInvocation(): boolean {
  if (!process.argv[1]) return false;
  const modulePath = fileURLToPath(import.meta.url);
  const invokedPath = realpathSync(process.argv[1]);
  return modulePath === invokedPath;
}

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const appError = asAppError(error);
    printJson({ status: "fail", code: appError.code, message: appError.message, hint: appError.hint });
    process.exitCode = 1;
  }
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected a positive integer, got ${value}`);
  return parsed;
}

function printDiscoveryResult(result: DiscoveryWorkflowResult, asJson: boolean): void {
  if (asJson) {
    printJson({
      status: "pass",
      run: result.run,
      signals: result.signals.length,
      opportunities: result.opportunities
    });
    return;
  }
  console.log("Discovery complete");
  console.log("");
  console.log(`source: ${result.run.source}`);
  if (result.run.query) console.log(`query: ${result.run.query}`);
  console.log(`signals: ${result.signals.length}`);
  console.log(`opportunities: ${result.opportunities.length}`);
  console.log(`warnings: ${result.warnings.length}`);
  console.log("");
  console.log("Top opportunities:");
  for (const [index, opportunity] of result.opportunities.slice(0, 10).entries()) {
    const creator = opportunity.signal.creator ? ` — ${opportunity.signal.creator}` : "";
    console.log(`${index + 1}. [${opportunity.score.score}] ${opportunity.signal.title}${creator}`);
    console.log(`   ${opportunity.signal.url}`);
    console.log(`   ${opportunity.score.reasons.slice(0, 3).join("; ")}`);
  }
  console.log("");
  console.log(`artifacts: ${result.run.artifactDir}`);
}
