#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSampleAsset, FfmpegMediaToolkit } from "./adapters/ffmpeg.js";
import { runDoctor } from "./adapters/doctor.js";
import { WhisperCppTranscriptionProvider } from "./adapters/whisperCpp.js";
import { heuristicAnalyzer } from "./application/analyzer.js";
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
