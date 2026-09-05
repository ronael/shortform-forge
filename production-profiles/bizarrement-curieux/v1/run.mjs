#!/usr/bin/env node

import {execFileSync, spawnSync} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const profileRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(profileRoot, "../../..");
const profile = readJson(resolve(profileRoot, "profile.json"));
const commands = new Set(["doctor", "voice", "prepare-assets", "base-edit", "timeline", "render", "normalize", "qa", "all", "verify-reference", "package-release", "clean"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  if (argv[0] === "--help" || argv[0] === "-h") return {command: "help", options: {}};
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (["json", "keep-working", "help"].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return {command, options};
}

function usage() {
  process.stdout.write(`Bizarrement Curieux V1\n\n`);
  process.stdout.write(`Usage: pnpm curious:v1 <command> [options]\n\n`);
  process.stdout.write(`Commands: ${[...commands].join(", ")}\n\n`);
  process.stdout.write("Options: --locale --episode --output-root --asset-root --audio-root --mpt-root --reference-root --browser-executable --json --keep-working\n");
}

function context(options, episodeRequired = true) {
  const locale = options.locale ?? "fr-FR";
  const ui = profile.locales[locale];
  if (!ui) throw new Error(`Unsupported locale: ${locale}`);
  const localeRoot = resolve(profileRoot, "locales", locale);
  const episodes = readJson(resolve(localeRoot, "episodes.json"));
  const editorial = readJson(resolve(localeRoot, "editorial.json"));
  const shotPlan = readJson(resolve(localeRoot, "shot-plan.json"));
  const episodeId = options.episode;
  if (episodeRequired && !episodeId) throw new Error("--episode is required");
  const episode = episodeId ? episodes.find(({id}) => id === episodeId) : null;
  const edit = episodeId ? editorial.find(({id}) => id === episodeId) : null;
  const shots = episodeId ? shotPlan.episodes[episodeId] : null;
  if (episodeId && !episode) throw new Error(`Unknown ${locale} episode: ${episodeId}`);
  if (episodeId && !edit) throw new Error(`Missing editorial data: ${episodeId}`);
  if (episodeId && (!Array.isArray(shots) || shots.length === 0)) throw new Error(`Missing shot plan: ${episodeId}`);
  const outputRoot = resolve(options["output-root"] ?? resolve(repoRoot, "output/production/bizarrement-curieux-v1"));
  const episodeRoot = episodeId ? resolve(outputRoot, locale, episodeId) : resolve(outputRoot, locale);
  return {locale, ui, localeRoot, episodes, editorial, shotPlan, episodeId, episode, edit, shots, outputRoot, episodeRoot, working: resolve(episodeRoot, "working"), result: resolve(episodeRoot, "result")};
}

function run(file, args, options = {}) {
  execFileSync(file, args, {stdio: "inherit", ...options});
}

function capture(file, args, options = {}) {
  return execFileSync(file, args, {encoding: "utf8", ...options}).trim();
}

function commandStatus(file, args = ["--version"]) {
  const result = spawnSync(file, args, {encoding: "utf8"});
  return {available: result.status === 0, detail: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n")[0] ?? ""};
}

function mptVersion(root) {
  if (!root || !existsSync(resolve(root, ".git"))) return null;
  const result = spawnSync("git", ["describe", "--tags", "--exact-match"], {cwd: root, encoding: "utf8"});
  return result.status === 0 ? result.stdout.trim().replace(/^v/, "") : null;
}

function browserExecutable(options) {
  const candidates = [
    options["browser-executable"],
    process.env.REMOTION_BROWSER_EXECUTABLE,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && resolve(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    process.env.PROGRAMFILES && resolve(process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}

function doctor(options) {
  const ctx = context(options, false);
  const edge = process.env.EDGE_TTS_BIN ?? "edge-tts";
  const mptRoot = options["mpt-root"] ?? process.env.MPT_ROOT;
  const foundMpt = mptVersion(mptRoot);
  const checks = {
    node: {available: Number(process.versions.node.split(".")[0]) >= 22, detail: process.version},
    pnpm: commandStatus("pnpm"),
    ffmpeg: commandStatus("ffmpeg", ["-version"]),
    ffprobe: commandStatus("ffprobe", ["-version"]),
    edgeTts: commandStatus(edge),
    moneyPrinterTurbo: {available: foundMpt === profile.providers.baseEdit.version, detail: mptRoot ? `expected ${profile.providers.baseEdit.version}, found ${foundMpt ?? "unversioned checkout"}` : "MPT_ROOT or --mpt-root not set"},
    remotionBrowser: {available: Boolean(browserExecutable(options)), detail: browserExecutable(options) ?? "local Chrome/Chromium not found"},
    remotionLock: {available: existsSync(resolve(profileRoot, "renderer/pnpm-lock.yaml")), detail: profile.providers.dressing.version},
    localeInputs: {available: ctx.episodes.length > 0 && ctx.editorial.length === ctx.episodes.length, detail: `${ctx.episodes.length} ${ctx.locale} episodes`},
  };
  const result = {profile: profile.id, locale: ctx.locale, checks};
  if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else for (const [name, check] of Object.entries(checks)) process.stdout.write(`${check.available ? "PASS" : "MISS"} ${name}: ${check.detail}\n`);
  return Object.values(checks).every(({available}) => available);
}

function requireFile(path, label = path) {
  if (!existsSync(path)) throw new Error(`Missing ${label}: ${path}`);
}

function generateVoice(ctx) {
  const edge = process.env.EDGE_TTS_BIN ?? "edge-tts";
  if (!commandStatus(edge).available) throw new Error(`edge-tts is unavailable (${edge})`);
  const root = resolve(ctx.working, "voices");
  mkdirSync(root, {recursive: true});
  const media = resolve(root, `${ctx.episodeId}.mp3`);
  const srt = resolve(root, `${ctx.episodeId}.srt`);
  run(edge, ["--voice", profile.providers.voice.voices[ctx.locale], "--rate", profile.providers.voice.rate, "--text", ctx.episode.script, "--write-media", media, "--write-subtitles", srt]);
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", media, "-af", "apad", "-t", String(profile.video.durationSeconds), "-ar", String(profile.audio.sampleRateHz), resolve(root, `${ctx.episodeId}-padded.mp3`)]);
}

function shotValues(raw, defaults) {
  if (Array.isArray(raw)) {
    const [sourceFile, startSeconds, orientation] = raw;
    return {...defaults, sourceFile, startSeconds, orientation};
  }
  return {...defaults, ...raw, focalPoint: {...defaults.focalPoint, ...raw.focalPoint}};
}

function cropFilter(shot) {
  const x = Number(shot.focalPoint?.x ?? 0.5);
  const y = Number(shot.focalPoint?.y ?? 0.5);
  if (shot.orientation === "vertical") return `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:max(0\\,min(iw-1080\\,iw*${x}-540)):max(0\\,min(ih-1920\\,ih*${y}-960)),fps=30,format=yuv420p`;
  return `crop=ih*9/16:ih:max(0\\,min(iw-out_w\\,iw*${x}-out_w/2)):0,scale=1080:1920,fps=30,format=yuv420p`;
}

function prepareAssets(ctx, options) {
  if (!options["asset-root"]) throw new Error("--asset-root is required");
  const root = resolve(ctx.working, "prepared");
  mkdirSync(root, {recursive: true});
  ctx.shots.forEach((raw, index) => {
    const shot = shotValues(raw, ctx.shotPlan.defaults);
    const source = resolve(options["asset-root"], shot.sourceFile);
    requireFile(source, `authorized asset ${shot.sourceFile}`);
    run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-stream_loop", "-1", "-ss", String(shot.startSeconds), "-i", source, "-t", String(shot.durationSeconds), "-an", "-vf", cropFilter(shot), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", resolve(root, `${String(index + 1).padStart(2, "0")}.mp4`)]);
  });
}

function baseEdit(ctx, options) {
  const root = resolve(options["mpt-root"] ?? process.env.MPT_ROOT ?? "/missing");
  if (mptVersion(root) !== profile.providers.baseEdit.version) throw new Error(`MoneyPrinterTurbo ${profile.providers.baseEdit.version} checkout required`);
  const pythonCandidates = process.platform === "win32"
    ? [resolve(root, ".venv/Scripts/python.exe"), resolve(root, ".venv/python.exe")]
    : [resolve(root, ".venv/bin/python")];
  const python = pythonCandidates.find((candidate) => existsSync(candidate));
  if (!python) throw new Error(`Missing MoneyPrinterTurbo Python environment: ${pythonCandidates.join(", ")}`);
  const materials = ctx.shots.map((_, index) => resolve(ctx.working, "prepared", `${String(index + 1).padStart(2, "0")}.mp4`));
  materials.forEach((path) => requireFile(path));
  const voice = resolve(ctx.working, "voices", `${ctx.episodeId}-padded.mp3`);
  requireFile(voice);
  const taskId = randomUUID();
  run(python, ["cli.py", "--video-script", ctx.episode.script, "--video-language", ctx.locale, "--video-source", "local", "--video-materials", materials.join(","), "--custom-audio-file", voice, "--video-aspect", "9:16", "--video-concat-mode", "sequential", "--video-transition-mode", "none", "--video-clip-duration", "4", "--bgm-type", "none", "--no-subtitle-enabled", "--task-id", taskId, "--stop-at", "video"], {cwd: root});
  const destination = resolve(ctx.working, "base", `${ctx.episodeId}.mp4`);
  mkdirSync(dirname(destination), {recursive: true});
  copyFileSync(resolve(root, "storage/tasks", taskId, "final-1.mp4"), destination);
}

const stopWords = {
  "fr-FR": new Set(["à", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et", "il", "ils", "la", "le", "les", "leur", "mais", "ne", "ou", "par", "pas", "pour", "que", "qui", "se", "son", "sur", "un", "une"]),
  "en-US": new Set(["a", "an", "and", "are", "as", "at", "be", "by", "do", "for", "from", "in", "is", "it", "not", "of", "on", "or", "the", "their", "them", "they", "this", "to", "when", "while", "with", "you", "your"]),
};

function parseTime(value) {
  const [hours, minutes, rest] = value.split(":");
  const [seconds, milliseconds] = rest.split(",");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(milliseconds) / 1000;
}

function parseSrt(text) {
  return text.trim().split(/\n\s*\n/).map((block) => {
    const lines = block.trim().split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes(" --> "));
    if (timingIndex < 0) throw new Error(`Invalid SRT block: ${block}`);
    const [start, end] = lines[timingIndex].split(" --> ");
    return {start: parseTime(start), end: parseTime(end), text: lines.slice(timingIndex + 1).join(" ")};
  });
}

function normalizeWord(word, locale) {
  return word.toLocaleLowerCase(locale).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, "");
}

function accentFor(words, terms, locale) {
  const explicit = words.find((word) => terms.includes(normalizeWord(word, locale)));
  if (explicit) return explicit;
  if (locale === "fr-FR") return words.at(-1);
  return [...words]
    .filter((word) => !stopWords[locale].has(normalizeWord(word, locale)))
    .sort((a, b) => normalizeWord(b, locale).length - normalizeWord(a, locale).length)[0]
    ?? words.at(-1);
}

function splitCaption(phrase, terms, locale, idStart) {
  const words = phrase.text.split(/\s+/).filter(Boolean);
  const count = Math.max(1, Math.ceil(words.length / 5));
  const base = Math.floor(words.length / count);
  const remainder = words.length % count;
  const duration = phrase.end - phrase.start;
  let offset = 0;
  return Array.from({length: count}, (_, index) => {
    const size = base + (index < remainder ? 1 : 0);
    const group = words.slice(offset, offset + size);
    const start = phrase.start + duration * offset / words.length;
    offset += size;
    return {id: `caption-${String(idStart + index).padStart(2, "0")}`, start, end: phrase.start + duration * offset / words.length, text: group.join(" "), accent: accentFor(group, terms, locale)};
  });
}

function buildTimeline(ctx) {
  const srtPath = resolve(ctx.working, "voices", `${ctx.episodeId}.srt`);
  requireFile(srtPath);
  const phrases = parseSrt(readFileSync(srtPath, "utf8"));
  const terms = ctx.edit.accentTerms.map((word) => normalizeWord(word, ctx.locale));
  const captions = [];
  for (const phrase of phrases) captions.push(...splitCaption(phrase, terms, ctx.locale, captions.length + 1));
  const voiceEnd = phrases.at(-1)?.end ?? 0;
  if (voiceEnd > profile.video.durationSeconds - 0.15) throw new Error(`Voice ends at ${voiceEnd.toFixed(3)}s; revise the script instead of changing playback speed`);
  const data = [{...ctx.episode, ...ctx.edit, ui: ctx.ui, locale: ctx.locale, captions, voiceEnd, jingleStart: Math.max(0, voiceEnd - 0.2)}];
  writeJson(resolve(ctx.working, "timeline/render-data.json"), data);
  return data[0];
}

function render(ctx, options) {
  const root = resolve(ctx.working, "renderer");
  rmSync(root, {recursive: true, force: true});
  cpSync(resolve(profileRoot, "renderer"), root, {recursive: true});
  copyFileSync(resolve(ctx.working, "timeline/render-data.json"), resolve(root, "render-data.json"));
  const publicRoot = resolve(root, "public");
  const episodeRoot = resolve(publicRoot, ctx.episodeId);
  mkdirSync(episodeRoot, {recursive: true});
  copyFileSync(resolve(ctx.working, "base", `${ctx.episodeId}.mp4`), resolve(episodeRoot, "base.mp4"));
  copyFileSync(resolve(ctx.working, "voices", `${ctx.episodeId}.mp3`), resolve(episodeRoot, "voice.mp3"));
  if (!options["audio-root"]) throw new Error("--audio-root is required");
  for (const name of ["music-bed.wav", "jingle.wav"]) {
    requireFile(resolve(options["audio-root"], name), `reference audio ${name}`);
    copyFileSync(resolve(options["audio-root"], name), resolve(publicRoot, name));
  }
  run("pnpm", ["install", "--frozen-lockfile"], {cwd: root});
  const output = resolve(ctx.working, "renders", `${ctx.episodeId}-raw.mp4`);
  mkdirSync(dirname(output), {recursive: true});
  try {
    const renderArgs = ["exec", "remotion", "render", "index.tsx", ctx.episodeId, output, "--codec", profile.video.codec, "--crf", "18", "--concurrency", "2"];
    const browser = browserExecutable(options);
    if (browser) renderArgs.push("--browser-executable", browser);
    run("pnpm", renderArgs, {cwd: root});
  } finally {
    if (!options["keep-working"]) rmSync(resolve(root, "node_modules"), {recursive: true, force: true});
  }
}

function loudnorm(path) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-i", path, "-af", `loudnorm=I=${profile.audio.integratedLoudnessLufs}:TP=${profile.audio.maximumTruePeakDbtp}:LRA=11:print_format=json`, "-f", "null", "-"], {encoding: "utf8"});
  const match = result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error(`No loudness analysis for ${path}`);
  return JSON.parse(match[0]);
}

function normalizeAudio(ctx) {
  const input = resolve(ctx.working, "renders", `${ctx.episodeId}-raw.mp4`);
  requireFile(input);
  const measured = loudnorm(input);
  const filter = [`loudnorm=I=${profile.audio.integratedLoudnessLufs}:TP=${profile.audio.maximumTruePeakDbtp}:LRA=11`, `measured_I=${measured.input_i}`, `measured_TP=${measured.input_tp}`, `measured_LRA=${measured.input_lra}`, `measured_thresh=${measured.input_thresh}`, `offset=${measured.target_offset}`, "linear=true", "print_format=summary"].join(":");
  mkdirSync(ctx.result, {recursive: true});
  run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-map", "0:v:0", "-c:v", "copy", "-map", "0:a:0", "-af", filter, "-c:a", "aac", "-b:a", "192k", "-ar", String(profile.audio.sampleRateHz), "-t", String(profile.video.durationSeconds), resolve(ctx.result, `${ctx.episodeId}.mp4`)]);
  copyFileSync(resolve(ctx.working, "voices", `${ctx.episodeId}.mp3`), resolve(ctx.result, `${ctx.episodeId}-voice.mp3`));
  copyFileSync(resolve(ctx.working, "voices", `${ctx.episodeId}.srt`), resolve(ctx.result, `${ctx.episodeId}.srt`));
}

function qa(ctx) {
  const video = resolve(ctx.result, `${ctx.episodeId}.mp4`);
  requireFile(video);
  const probe = JSON.parse(capture("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", video]));
  const videoStream = probe.streams.find(({codec_type}) => codec_type === "video");
  const audioStream = probe.streams.find(({codec_type}) => codec_type === "audio");
  const [numerator, denominator] = String(videoStream?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const fps = denominator ? numerator / denominator : 0;
  const measured = loudnorm(video);
  const timeline = readJson(resolve(ctx.working, "timeline/render-data.json"))[0];
  const captionValid = timeline.captions.every(({text, start, end}) => {
    const words = text.trim().split(/\s+/).length;
    return words >= 1 && words <= 6 && start >= 0 && end > start && end <= profile.video.durationSeconds;
  });
  const checks = {
    dimensions: videoStream?.width === profile.video.width && videoStream?.height === profile.video.height,
    fps: Math.abs(fps - profile.video.fps) < 0.01,
    frames: Number(videoStream?.nb_read_frames ?? videoStream?.nb_frames) === profile.video.durationFrames,
    duration: Math.abs(Number(probe.format.duration) - profile.video.durationSeconds) <= 0.05,
    sampleRate: Number(audioStream?.sample_rate) === profile.audio.sampleRateHz,
    loudness: Number(measured.input_i) >= profile.audio.acceptedLoudnessRangeLufs[0] && Number(measured.input_i) <= profile.audio.acceptedLoudnessRangeLufs[1],
    truePeak: Number(measured.input_tp) <= profile.audio.maximumTruePeakDbtp,
    captions: captionValid,
    editorialLayout: ctx.edit.title.length === 2 && ctx.edit.callouts.every(({title}) => title.length <= 28),
  };
  const report = {profile: profile.id, locale: ctx.locale, episode: ctx.episodeId, checkedAt: new Date().toISOString(), checks, measurements: {width: videoStream?.width, height: videoStream?.height, fps, frames: Number(videoStream?.nb_read_frames ?? videoStream?.nb_frames), durationSeconds: Number(probe.format.duration), sampleRateHz: Number(audioStream?.sample_rate), integratedLoudnessLufs: Number(measured.input_i), truePeakDbtp: Number(measured.input_tp), captionCount: timeline.captions.length}, humanReviewRequired: ["Confirm every shot shows the narrated subject after the final 9:16 crop.", "Confirm no wrong species, logo, watermark, or embedded subtitle is visible.", "Confirm caption contrast, editorial alignment, rhythm, voice, and rights provenance."]};
  writeJson(resolve(ctx.result, "qa-report.json"), report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return Object.values(checks).every(Boolean);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function referenceRoot(locale) {
  return resolve(repoRoot, locale === "fr-FR" ? "output/series/questions-insolites-fr-v1" : "output/series/curious-questions-en-v1");
}

function verifyReference(options) {
  const ctx = context(options, false);
  const root = resolve(options["reference-root"] ?? referenceRoot(ctx.locale));
  const entries = readJson(resolve(profileRoot, "reference/checksums.json")).files.filter(({locale}) => locale === ctx.locale);
  const results = entries.map((entry) => {
    const path = resolve(root, entry.path);
    if (!existsSync(path)) return {...entry, status: "missing"};
    const actualSha256 = sha256(path);
    return {...entry, actualSha256, status: actualSha256 === entry.sha256 ? "pass" : "mismatch"};
  });
  if (options.json) process.stdout.write(`${JSON.stringify({profile: profile.id, locale: ctx.locale, root, results}, null, 2)}\n`);
  else for (const item of results) process.stdout.write(`${item.status.toUpperCase()} ${item.path}\n`);
  return results.every(({status}) => status === "pass");
}

function packageRelease() {
  const releaseRoot = resolve(repoRoot, "output/releases");
  const seriesRoot = resolve(repoRoot, "output/series");
  mkdirSync(releaseRoot, {recursive: true});
  for (const name of ["questions-insolites-fr-v1", "curious-questions-en-v1"]) requireFile(resolve(seriesRoot, name, "qa-report.json"), `${name} reference series`);
  const archive = resolve(releaseRoot, `${profile.id}-reference-media.tar.gz`);
  run("tar", ["--exclude=.DS_Store", "--exclude=working", "-czf", archive, "-C", seriesRoot, "questions-insolites-fr-v1", "curious-questions-en-v1"]);
  const result = {archive, bytes: statSync(archive).size, sha256: sha256(archive), uploaded: false};
  writeJson(resolve(releaseRoot, `${profile.id}-reference-media.json`), result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function clean(ctx) {
  rmSync(ctx.working, {recursive: true, force: true});
  process.stdout.write(`Removed ${ctx.working}\n`);
}

function runAll(ctx, options) {
  if (!doctor(options)) throw new Error("Production dependencies are incomplete");
  generateVoice(ctx);
  prepareAssets(ctx, options);
  baseEdit(ctx, options);
  buildTimeline(ctx);
  render(ctx, options);
  normalizeAudio(ctx);
  if (!qa(ctx)) throw new Error("QA failed");
}

const {command, options} = parseArgs(process.argv.slice(2));
if (command === "help" || options.help) {
  usage();
} else if (!commands.has(command)) {
  usage();
  throw new Error(`Unknown command: ${command}`);
} else {
  let success = true;
  if (command === "doctor") success = doctor(options);
  else if (command === "verify-reference") success = verifyReference(options);
  else if (command === "package-release") packageRelease();
  else {
    const ctx = context(options);
    if (command === "voice") generateVoice(ctx);
    else if (command === "prepare-assets") prepareAssets(ctx, options);
    else if (command === "base-edit") baseEdit(ctx, options);
    else if (command === "timeline") buildTimeline(ctx);
    else if (command === "render") render(ctx, options);
    else if (command === "normalize") normalizeAudio(ctx);
    else if (command === "qa") success = qa(ctx);
    else if (command === "all") runAll(ctx, options);
    else if (command === "clean") clean(ctx);
  }
  if (!success) process.exitCode = 1;
}
