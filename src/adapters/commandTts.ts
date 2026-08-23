import type { TextToSpeechProvider } from "../application/ports.js";
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
