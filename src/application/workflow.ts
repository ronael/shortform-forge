import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeTranscript } from "../domain/scoring.js";
import {
  AnalysisSchema,
  SourceSchema,
  TranscriptSchema,
  type Analysis,
  type Source,
  type Transcript
} from "../domain/contracts.js";
import { AppError } from "../domain/errors.js";
import { probeMedia, qaVideo, renderVerticalClip } from "../adapters/ffmpeg.js";
import { ensureDir, readJson, slug, writeJson } from "./files.js";

const ProvenanceSchema = SourceSchema.shape.provenance;

export type ClipOptions = {
  sourcePath: string;
  transcriptPath: string;
  provenancePath?: string;
  outputRoot: string;
  jobName?: string;
};

export type ClipResult = {
  jobDir: string;
  source: Source;
  transcript: Transcript;
  analysis: Analysis;
  candidatePath: string;
  qaPath: string;
};

export async function runClipWorkflow(options: ClipOptions): Promise<ClipResult> {
  const sourcePath = path.resolve(options.sourcePath);
  const outputRoot = path.resolve(options.outputRoot);
  const jobId = slug(options.jobName ?? `${path.basename(sourcePath, path.extname(sourcePath))}-${new Date().toISOString()}`);
  const jobDir = path.join(outputRoot, jobId);
  const mediaDir = path.join(jobDir, "media");
  await mkdir(mediaDir, { recursive: true });

  const importedPath = path.join(mediaDir, path.basename(sourcePath));
  await copyFile(sourcePath, importedPath);
  const media = await probeMedia(importedPath);
  const provenance = options.provenancePath
    ? ProvenanceSchema.parse(JSON.parse(await readFile(path.resolve(options.provenancePath), "utf8")))
    : {
        rights: "authorized" as const,
        note: "User supplied this source and transcript for local clipping."
      };
  const source: Source = SourceSchema.parse({
    id: jobId,
    originalPath: sourcePath,
    importedPath,
    provenance,
    importedAt: new Date().toISOString(),
    media
  });
  await writeJson(path.join(jobDir, "source.json"), source);

  const transcriptInput = await readJson(path.resolve(options.transcriptPath), TranscriptSchema);
  const transcript: Transcript = TranscriptSchema.parse({ ...transcriptInput, sourceId: source.id });
  await writeJson(path.join(jobDir, "transcript.json"), transcript);

  const candidates = analyzeTranscript(transcript);
  const selected = candidates[0];
  if (!selected) throw new AppError("No candidate segment could be selected", "NO_CANDIDATE");
  const analysis: Analysis = AnalysisSchema.parse({
    sourceId: source.id,
    generatedAt: new Date().toISOString(),
    strategy: "heuristic-v0",
    candidates,
    selectedCandidateId: selected.id
  });
  await writeJson(path.join(jobDir, "analysis.json"), analysis);

  const candidatePath = await renderVerticalClip({
    sourcePath: importedPath,
    transcript,
    candidate: selected,
    outputDir: jobDir
  });
  const qa = await qaVideo({
    videoPath: candidatePath,
    expectedDurationSeconds: selected.endSeconds - selected.startSeconds,
    expectedWidth: 1080,
    expectedHeight: 1920,
    captionsPath: path.join(jobDir, "captions.ass")
  });
  const qaPath = path.join(jobDir, "qa.json");
  await writeJson(qaPath, qa);
  if (qa.status !== "pass") throw new AppError(`QA failed for ${candidatePath}`, "QA_FAILED", `Inspect ${qaPath}`);

  return { jobDir, source, transcript, analysis, candidatePath, qaPath };
}

export async function readAnalysis(jobDir: string): Promise<Analysis> {
  return readJson(path.join(jobDir, "analysis.json"), AnalysisSchema);
}

export async function initOutputRoot(outputRoot: string): Promise<void> {
  await ensureDir(path.resolve(outputRoot));
}
