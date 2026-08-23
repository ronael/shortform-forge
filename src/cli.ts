#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import { createSampleAsset } from "./adapters/ffmpeg.js";
import { asAppError } from "./domain/errors.js";
import { initOutputRoot, runClipWorkflow } from "./application/workflow.js";

const program = new Command();

program
  .name("sf")
  .description("Shortform Forge local clipping CLI")
  .version("0.1.0");

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
  .description("Run import, transcript parsing, analysis, render and QA")
  .argument("<source>", "authorized local source video path")
  .requiredOption("-t, --transcript <path>", "transcript JSON path")
  .option("-p, --provenance <path>", "provenance JSON path")
  .option("-o, --output <dir>", "output root directory", "output")
  .option("-j, --job <name>", "stable job name")
  .action(async (source: string, options: { transcript: string; provenance?: string; output: string; job?: string }) => {
    await run(async () => {
      await initOutputRoot(options.output);
      const workflowOptions = {
        sourcePath: source,
        transcriptPath: options.transcript,
        ...(options.provenance ? { provenancePath: options.provenance } : {}),
        outputRoot: options.output,
        ...(options.job ? { jobName: options.job } : {})
      };
      const result = await runClipWorkflow({
        ...workflowOptions
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

program.parseAsync(process.argv).catch((error: unknown) => {
  const appError = asAppError(error);
  printJson({ status: "fail", code: appError.code, message: appError.message, hint: appError.hint });
  process.exitCode = 1;
});

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
