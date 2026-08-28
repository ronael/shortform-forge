import type { TextToSpeechProvider } from "../application/ports.js";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AppError } from "../domain/errors.js";
import { runProcess } from "./process.js";

/**
 * TextToSpeechProvider backed by any local CLI that reads the text on stdin
 * and writes an audio file. The placeholder {output} in SF_TTS_COMMAND is
 * replaced with the target file path.
 *
 * Example: SF_TTS_COMMAND="python .tts-models/say.py {output}"
 * No SDK, no API key, engine-agnostic (Kokoro, Piper, ...).
 */
export class CommandTextToSpeechProvider implements TextToSpeechProvider {
  readonly name: string;
  private readonly command: string;
  private readonly args: string[];

  constructor(commandLine = process.env.SF_TTS_COMMAND, private readonly timeoutMs = 300_000) {
    if (!commandLine) {
      throw new AppError(
        "No text-to-speech provider configured",
        "MISSING_DEPENDENCY",
        "Set SF_TTS_COMMAND to a local TTS CLI that reads text on stdin and writes an audio file at {output}, for example SF_TTS_COMMAND=\"python .tts-models/say.py {output}\"."
      );
    }
    const [command, ...args] = commandLine.trim().split(/\s+/);
    if (!command) {
      throw new AppError("SF_TTS_COMMAND is empty", "MISSING_DEPENDENCY");
    }
    if (!args.some((arg) => arg.includes("{output}"))) {
      throw new AppError(
        "SF_TTS_COMMAND must contain the {output} placeholder",
        "INVALID_INPUT",
        "Example: SF_TTS_COMMAND=\"python .tts-models/say.py {output}\""
      );
    }
    this.command = command;
    this.args = args;
    this.name = commandLine;
  }

  async synthesize(text: string, outputPath: string): Promise<void> {
    const args = this.args.map((arg) => arg.replaceAll("{output}", outputPath));
    try {
      await runProcess(this.command, args, this.timeoutMs, text);
    } catch (error) {
      if (error instanceof AppError && error.code === "MISSING_DEPENDENCY") throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(`Text-to-speech provider failed: ${message}`, "TTS_FAILED");
    }
  }
}

/** Batch CLI adapter for TTS engines that should load their model once. */
export class CommandBatchTextToSpeechProvider implements TextToSpeechProvider {
  readonly name: string;
  private readonly command: string;
  private readonly args: string[];

  constructor(commandLine = process.env.SF_TTS_BATCH_COMMAND, private readonly timeoutMs = 1_800_000) {
    if (!commandLine) throw new AppError("No batch text-to-speech provider configured", "MISSING_DEPENDENCY");
    const [command, ...args] = commandLine.trim().split(/\s+/);
    if (!command || !args.some((arg) => arg.includes("{request}"))) {
      throw new AppError("SF_TTS_BATCH_COMMAND must contain the {request} placeholder", "INVALID_INPUT");
    }
    this.command = command;
    this.args = args;
    this.name = commandLine;
  }

  synthesize(text: string, outputPath: string): Promise<void> {
    return this.synthesizeBatch([{ text, outputPath }]);
  }

  async synthesizeBatch(items: Array<{ text: string; outputPath: string }>): Promise<void> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "sf-tts-batch-"));
    const requestPath = path.join(tempDir, "request.json");
    try {
      await writeFile(requestPath, `${JSON.stringify(items)}\n`, "utf8");
      const args = this.args.map((arg) => arg.replaceAll("{request}", requestPath));
      await runProcess(this.command, args, this.timeoutMs);
    } catch (error) {
      if (error instanceof AppError && error.code === "MISSING_DEPENDENCY") throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(`Batch text-to-speech provider failed: ${message}`, "TTS_FAILED");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
