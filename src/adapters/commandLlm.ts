import type { LanguageModelProvider } from "../application/languageModelPort.js";
import { AppError } from "../domain/errors.js";
import { runProcess } from "./process.js";

/**
 * LanguageModelProvider backed by any local CLI that reads a prompt on stdin
 * and writes a response on stdout (for example `ollama run llama3.1`).
 *
 * Configure with SF_LLM_COMMAND, e.g. SF_LLM_COMMAND="ollama run llama3.1".
 * No SDK, no API key, provider-agnostic.
 */
export class CommandLanguageModelProvider implements LanguageModelProvider {
  readonly name: string;
  private readonly command: string;
  private readonly args: string[];

  constructor(commandLine = process.env.SF_LLM_COMMAND, private readonly timeoutMs = 300_000) {
    if (!commandLine) {
      throw new AppError(
        "No language model provider configured",
        "MISSING_DEPENDENCY",
        "Set SF_LLM_COMMAND to a local LLM CLI that reads the prompt on stdin, for example SF_LLM_COMMAND=\"ollama run llama3.1\". Or use `sf analyze --prompt` and let the orchestrating agent answer the prompt itself."
      );
    }
    const [command, ...args] = commandLine.trim().split(/\s+/);
    if (!command) {
      throw new AppError("SF_LLM_COMMAND is empty", "MISSING_DEPENDENCY");
    }
    this.command = command;
    this.args = args;
    this.name = commandLine;
  }

  async generate(prompt: string): Promise<string> {
    try {
      const result = await runProcess(this.command, this.args, this.timeoutMs, prompt);
      return result.stdout;
    } catch (error) {
      if (error instanceof AppError && error.code === "MISSING_DEPENDENCY") throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(`Language model provider failed: ${message}`, "LLM_UNAVAILABLE");
    }
  }
}
