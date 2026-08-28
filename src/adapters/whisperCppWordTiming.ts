import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { WordTimingProvider, WordTimingResult } from "../application/ports.js";
import { AppError } from "../domain/errors.js";
import { runProcess } from "./process.js";

const WhisperTokenSchema = z.object({
  text: z.string(),
  offsets: z.object({ from: z.number(), to: z.number() }).optional()
});

const WhisperFullJsonSchema = z.object({
  transcription: z.array(z.object({ tokens: z.array(WhisperTokenSchema).optional() }))
});

export class WhisperCppWordTimingProvider implements WordTimingProvider {
  readonly name = "whisper.cpp-word-timing";
  private readonly binaryPath: string;
  private readonly modelPath: string;

  constructor(config: { binaryPath?: string; modelPath?: string } = {}) {
    this.binaryPath = config.binaryPath ?? process.env.SF_WHISPER_CLI ?? "whisper-cli";
    const modelPath = config.modelPath ?? process.env.SF_WHISPER_MODEL;
    if (!modelPath) {
      throw new AppError("No whisper.cpp model configured for word timing", "ASR_MODEL_MISSING");
    }
    this.modelPath = modelPath;
  }

  async align(audioPath: string, canonicalText: string, language = "auto"): Promise<WordTimingResult> {
    const model = await stat(this.modelPath).catch(() => undefined);
    if (!model?.isFile()) throw new AppError(`Model not found: ${this.modelPath}`, "ASR_MODEL_MISSING");
    const workDir = await mkdtemp(path.join(os.tmpdir(), "sf-word-timing-"));
    const outputBase = path.join(workDir, "words");
    try {
      await runProcess(this.binaryPath, [
        "-m", this.modelPath,
        "-f", audioPath,
        "-l", language,
        "-ojf",
        "-sow",
        "-of", outputBase,
        "-np"
      ], 600_000);
      const raw = JSON.parse(await readFile(`${outputBase}.json`, "utf8")) as unknown;
      return parseAndAlignWhisperWords(raw, canonicalText);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

export function parseAndAlignWhisperWords(raw: unknown, canonicalText: string): WordTimingResult {
  const parsed = WhisperFullJsonSchema.parse(raw);
  const canonical = wordsIn(canonicalText);
  const recognized = parsed.transcription
    .flatMap((segment) => segment.tokens ?? [])
    .filter((token) => token.offsets && token.offsets.to > token.offsets.from)
    .flatMap((token) => wordsIn(token.text).map((text) => ({
      text,
      startSeconds: token.offsets!.from / 1000,
      endSeconds: token.offsets!.to / 1000
    })));
  if (canonical.length === 0 || recognized.length === 0) return { words: [], coverage: 0 };

  const matches = longestCommonSubsequence(
    canonical.map(normalizeWord),
    recognized.map((word) => normalizeWord(word.text))
  );
  const byCanonical = new Map(matches.map(([canonicalIndex, recognizedIndex]) => [canonicalIndex, recognized[recognizedIndex]!]));
  const result = canonical.map((text, index) => {
    const exact = byCanonical.get(index);
    if (exact) return { text, startSeconds: exact.startSeconds, endSeconds: exact.endSeconds };
    const previousIndex = findMatchedIndex(byCanonical, index, -1, canonical.length);
    const nextIndex = findMatchedIndex(byCanonical, index, 1, canonical.length);
    const previousEnd = previousIndex === undefined ? 0 : byCanonical.get(previousIndex)!.endSeconds;
    const nextStart = nextIndex === undefined ? recognized.at(-1)!.endSeconds : byCanonical.get(nextIndex)!.startSeconds;
    const runStart = (previousIndex ?? -1) + 1;
    const runEnd = nextIndex ?? canonical.length;
    const slot = Math.max(0.04, (nextStart - previousEnd) / Math.max(1, runEnd - runStart));
    const startSeconds = previousEnd + slot * (index - runStart);
    return { text, startSeconds, endSeconds: Math.min(nextStart, startSeconds + slot) };
  });
  return { words: result, coverage: matches.length / canonical.length };
}

function wordsIn(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function normalizeWord(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace("’", "'").toLowerCase();
}

function findMatchedIndex(matches: Map<number, unknown>, from: number, direction: -1 | 1, length: number): number | undefined {
  for (let index = from + direction; index >= 0 && index < length; index += direction) {
    if (matches.has(index)) return index;
  }
  return undefined;
}

function longestCommonSubsequence(left: string[], right: string[]): Array<[number, number]> {
  const table = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i]![j] = left[i] === right[j] ? 1 + table[i + 1]![j + 1]! : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const matches: Array<[number, number]> = [];
  for (let i = 0, j = 0; i < left.length && j < right.length;) {
    if (left[i] === right[j]) {
      matches.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return matches;
}
