import { stat } from "node:fs/promises";
import { runProcess } from "./process.js";

export type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  hint?: string;
};

export type DoctorReport = {
  status: "pass" | "fail";
  checks: DoctorCheck[];
};

export async function runDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  checks.push(await commandCheck("Node", process.execPath, ["--version"], "Install Node.js 22+."));
  checks.push(await commandCheck("FFmpeg", "ffmpeg", ["-version"], "Install FFmpeg, for example `brew install ffmpeg`."));
  checks.push(await commandCheck("ffprobe", "ffprobe", ["-version"], "Install FFmpeg, which includes ffprobe."));
  checks.push(await commandCheck("ASR", process.env.SF_WHISPER_CLI ?? "whisper-cli", ["-h"], "Install whisper.cpp, for example `brew install whisper-cpp`."));
  checks.push(await commandCheck("yt-dlp", process.env.SF_YTDLP_BIN ?? "yt-dlp", ["--version"], "Install yt-dlp, for example `brew install yt-dlp` or `python3 -m pip install --user yt-dlp`."));

  const modelPath = process.env.SF_WHISPER_MODEL;
  if (!modelPath) {
    checks.push({
      name: "model",
      status: "warn",
      detail: "SF_WHISPER_MODEL is not set",
      hint: "Set SF_WHISPER_MODEL=/path/to/ggml-model.bin. Models are available from https://huggingface.co/ggerganov/whisper.cpp/tree/main."
    });
  } else {
    const modelStat = await stat(modelPath).catch(() => undefined);
    checks.push(modelStat?.isFile()
      ? { name: "model", status: "pass", detail: modelPath }
      : { name: "model", status: "fail", detail: `Model not found: ${modelPath}`, hint: "Set SF_WHISPER_MODEL to an existing ggml Whisper model file." });
  }

  return {
    status: checks.some((check) => check.status === "fail") ? "fail" : "pass",
    checks
  };
}

async function commandCheck(name: string, command: string, args: string[], hint: string): Promise<DoctorCheck> {
  try {
    const result = await runProcess(command, args, 10_000);
    const detail = (result.stdout || result.stderr).split("\n").find((line) => line.trim().length > 0)?.trim() ?? "available";
    return { name, status: "pass", detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, status: "fail", detail: message, hint };
  }
}
