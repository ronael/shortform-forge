import { spawn } from "node:child_process";
import { AppError } from "../domain/errors.js";

export type ProcessResult = {
  stdout: string;
  stderr: string;
};

export async function runProcess(command: string, args: string[], timeoutMs = 120_000, stdin?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new AppError(`${command} timed out after ${timeoutMs}ms`, "PROCESS_TIMEOUT"));
    }, timeoutMs);

    child.stdout!.setEncoding("utf8");
    child.stderr!.setEncoding("utf8");
    if (stdin !== undefined && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.stdout!.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr!.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new AppError(`${command} is not installed or not on PATH`, "MISSING_DEPENDENCY", `Install ${command} and retry.`));
        return;
      }
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const exit = code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`;
      reject(new AppError(`${command} exited with ${exit}: ${stderr.trim()}`, "PROCESS_FAILED"));
    });
  });
}
