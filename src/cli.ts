#!/usr/bin/env node
import { Command } from "commander";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSampleAsset, FfmpegMediaToolkit } from "./adapters/ffmpeg.js";
import { runDoctor } from "./adapters/doctor.js";
import { WhisperCppTranscriptionProvider } from "./adapters/whisperCpp.js";
import { WhisperCppWordTimingProvider } from "./adapters/whisperCppWordTiming.js";
import { YtDlpDiscoverySource } from "./adapters/ytDlpDiscovery.js";
import { CommandLanguageModelProvider } from "./adapters/commandLlm.js";
import { FfmpegCompositionRenderer } from "./adapters/ffmpegComposition.js";
import { heuristicAnalyzer } from "./application/analyzer.js";
import { analyzeOpportunityFile, loadOpportunity } from "./application/analyzeOpportunity.js";
import { generateScriptFromFile, loadBrief } from "./application/generateScript.js";
import { produceFromScriptFile } from "./application/produceVideo.js";
import { generateVoiceoverFromFile } from "./application/generateVoiceover.js";
import { CommandBatchTextToSpeechProvider, CommandTextToSpeechProvider } from "./adapters/commandTts.js";
import { concatAudioFiles, probeDurationSeconds } from "./adapters/ffmpeg.js";
import { buildScriptGenerationPrompt } from "./application/prompts/scriptGeneration.js";
import { buildOpportunityBriefPrompt } from "./application/prompts/opportunityBrief.js";
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
    .command("analyze")
    .description("Turn a discovered opportunity into a production brief via a language model")
    .argument("<file>", "Opportunity JSON or opportunities.json artifact from `sf discover`")
    .option("--index <number>", "opportunity index when the file holds several", parseNonNegativeInt, 0)
    .option("--prompt", "print the analysis prompt without calling a provider")
    .option("--json", "print machine-readable result")
    .action(async (file: string, options: { index: number; prompt?: boolean; json?: boolean }) => {
      await run(async () => {
        const resolved = path.resolve(file);
        if (options.prompt) {
          const opportunity = await loadOpportunity(resolved, options.index);
          console.log(buildOpportunityBriefPrompt(opportunity));
          return;
        }
        const result = await analyzeOpportunityFile({
          filePath: resolved,
          index: options.index,
          provider: new CommandLanguageModelProvider()
        });
        if (options.json) {
          printJson({ status: "pass", briefPath: result.briefPath, analysis: result.analysis });
          return;
        }
        const { opportunity, brief } = result.analysis;
        console.log("Opportunity analysis complete");
        console.log("");
        console.log(`opportunity: ${opportunity.signal.title} [score ${opportunity.score.score}]`);
        console.log(`hook: ${brief.hook.type} (${brief.hook.strength}) — potential: ${brief.potential}, difficulty: ${brief.productionDifficulty}`);
        console.log(`format: ${brief.recommendedFormat.type} ${brief.recommendedFormat.durationSeconds.min}-${brief.recommendedFormat.durationSeconds.max}s`);
        console.log("");
        console.log("Why interesting:");
        for (const reason of brief.whyInteresting) console.log(`- ${reason}`);
        console.log("");
        console.log("Adaptation ideas:");
        for (const idea of brief.adaptationIdeas) console.log(`- ${idea}`);
        if (brief.risks.length > 0) {
          console.log("");
          console.log("Risks:");
          for (const risk of brief.risks) console.log(`- ${risk}`);
        }
        console.log("");
        console.log(`brief: ${result.briefPath}`);
      });
    });

  program
    .command("script")
    .description("Turn a production brief into a structured script plan via a language model")
    .argument("<file>", "ProductionBrief JSON or brief-<signal-id>.json artifact from `sf analyze`")
    .option("--target-duration <seconds>", "override the suggested editorial target", parsePositiveInt)
    .option("--prompt", "print the generation prompt without calling a provider")
    .option("--json", "print machine-readable result")
    .action(async (file: string, options: { targetDuration?: number; prompt?: boolean; json?: boolean }) => {
      await run(async () => {
        const resolved = path.resolve(file);
        if (options.prompt) {
          const { brief } = await loadBrief(resolved);
          console.log(buildScriptGenerationPrompt(brief, options.targetDuration));
          return;
        }
        const result = await generateScriptFromFile({
          filePath: resolved,
          provider: new CommandLanguageModelProvider(),
          ...(options.targetDuration ? { targetDurationSeconds: options.targetDuration } : {})
        });
        if (options.json) {
          printJson({ status: "pass", scriptPath: result.scriptPath, script: result.script });
          return;
        }
        const { plan } = result.script;
        console.log("Script generation complete");
        console.log("");
        console.log(`title: ${plan.title}`);
        console.log(`duration: ${plan.durationSeconds}s — ${plan.sections.length} sections`);
        if (plan.durationRecommendation) {
          console.log(`recommended: ${plan.durationRecommendation.minSeconds}-${plan.durationRecommendation.maxSeconds}s, target ${plan.durationRecommendation.targetSeconds}s — ${plan.durationRecommendation.rationale}`);
        }
        console.log(`hook (${plan.hook.durationSeconds}s): ${plan.hook.text}`);
        console.log("");
        console.log("Sections:");
        for (const section of plan.sections) {
          console.log(`- [${section.startSeconds}-${section.endSeconds}s] ${section.purpose}: ${section.voiceover.slice(0, 80)}`);
        }
        console.log("");
        console.log(`script: ${result.scriptPath}`);
      });
    });

  program
    .command("voiceover")
    .description("Synthesize a script plan's voiceover locally and measure real section durations")
    .argument("<file>", "ScriptPlan JSON or script-<signal-id>.json artifact from `sf script`")
    .option("-o, --output <dir>", "voiceover output directory (voiceover.json + wav files)", "output/voiceover")
    .option("--json", "print machine-readable result")
    .action(async (file: string, options: { output: string; json?: boolean }) => {
      await run(async () => {
        const result = await generateVoiceoverFromFile({
          filePath: file,
          provider: process.env.SF_TTS_BATCH_COMMAND
            ? new CommandBatchTextToSpeechProvider()
            : new CommandTextToSpeechProvider(),
          outputDir: path.resolve(options.output),
          audio: { probeDurationSeconds, concatAudioFiles }
        });
        if (options.json) {
          printJson({ status: "pass", audioPath: result.audioPath, voiceover: result.voiceover });
          return;
        }
        console.log("Voiceover complete");
        console.log("");
        console.log(`provider: ${result.voiceover.provider}`);
        console.log(`sections: ${result.voiceover.sections.length}`);
        console.log(`total duration: ${result.voiceover.totalDurationSeconds.toFixed(1)}s`);
        console.log(`audio: ${result.audioPath}`);
      });
    });

  program
    .command("produce")
    .description("Render a script plan into a vertical video artifact")
    .argument("<file>", "ScriptPlan JSON or script-<signal-id>.json artifact from `sf script`")
    .option("--assets <dir>", "directory of local assets named after section purposes (hook.png, explanation.mp4, ...)")
    .option("--voiceover <file>", "voiceover.json produced by `sf voiceover` (real audio replaces the silent track)")
    .option("--music <file>", "licensed local music bed")
    .option("--music-provenance <text>", "rights, attribution, and source for --music")
    .option("--music-gain-db <db>", "music gain below full scale", (value) => Number(value), -25)
    .option("--template <name>", "composition strategy: generic | ai-news", "generic")
    .option("-o, --output <dir>", "output root directory", "output")
    .option("--run-id <id>", "stable run id")
    .option("--json", "print machine-readable result")
    .action(async (file: string, options: { assets?: string; voiceover?: string; music?: string; musicProvenance?: string; musicGainDb: number; template: string; output: string; runId?: string; json?: boolean }) => {
      await run(async () => {
        if (options.template !== "generic" && options.template !== "ai-news") {
          throw new Error(`Unknown template: ${options.template} (expected generic or ai-news)`);
        }
        if (options.music && !options.musicProvenance) {
          throw new Error("--music-provenance is required with --music");
        }
        const result = await produceFromScriptFile({
          filePath: file,
          renderer: new FfmpegCompositionRenderer(),
          outputRoot: options.output,
          template: options.template,
          ...(options.assets ? { assetsDir: options.assets } : {}),
          ...(options.voiceover ? { voiceoverPath: options.voiceover } : {}),
          ...(options.music ? {
            audioBedPath: options.music,
            audioBedProvenance: options.musicProvenance!,
            audioBedGainDb: options.musicGainDb
          } : {}),
          ...(options.voiceover && process.env.SF_WHISPER_MODEL ? { wordTimingProvider: new WhisperCppWordTimingProvider() } : {}),
          ...(options.runId ? { runId: options.runId } : {})
        });
        if (options.json) {
          printJson({ status: "pass", artifactDir: result.artifactDir, artifact: result.artifact });
          return;
        }
        console.log("Production complete");
        console.log("");
        console.log(`renderer: ${result.artifact.provenance.renderer}`);
        console.log(`video: ${result.artifact.path}`);
        console.log(`dimensions: ${result.artifact.width}x${result.artifact.height} @ ${result.artifact.fps}fps`);
        console.log(`duration: ${result.artifact.durationSeconds}s`);
        console.log(`composition: ${result.plan.layers.length} layers`);
        console.log(`artifacts: ${result.artifactDir}`);
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

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Expected a positive integer, got ${value}`);
  return parsed;
}

function parseNonNegativeInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`Expected a non-negative integer, got ${value}`);
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
