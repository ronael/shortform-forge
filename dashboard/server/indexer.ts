import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DashboardState, Locale, VideoKind, VideoRecord } from "../shared/contracts.js";

const execFileAsync = promisify(execFile);

interface EpisodeInfo { question?: string; script?: string; sources?: string[] }
interface Candidate { absolutePath: string; relativePath: string; kind: VideoKind; priority: number }

export class VideoIndexer {
  private records = new Map<string, VideoRecord>();
  private paths = new Map<string, string>();

  constructor(private readonly repoRoot: string) {}

  async scan(state: DashboardState): Promise<VideoRecord[]> {
    const candidates = await this.candidates();
    const episodes = await this.episodeCatalog();
    const byChecksum = new Map<string, { candidate: Candidate; checksum: string }>();
    for (const candidate of candidates) {
      const checksum = await sha256(candidate.absolutePath);
      const previous = byChecksum.get(checksum);
      if (!previous || candidate.priority > previous.candidate.priority) byChecksum.set(checksum, { candidate, checksum });
    }

    const records: VideoRecord[] = [];
    this.paths.clear();
    for (const { candidate, checksum } of byChecksum.values()) {
      const file = await stat(candidate.absolutePath);
      const slug = basename(candidate.absolutePath, extname(candidate.absolutePath));
      const episode = episodes.get(slug);
      const locale = inferLocale(candidate.relativePath);
      const saved = state.videos[checksum];
      const qa = await findQa(candidate.absolutePath, slug, this.repoRoot);
      const promoted = candidate.kind === "production" || (saved?.promoted ?? false);
      const humanStatus = saved?.humanStatus ?? "unreviewed";
      const blockReasons: string[] = [];
      if (qa.status !== "pass") blockReasons.push("La QA technique n'est pas validée.");
      if (!promoted) blockReasons.push("Ce POC doit être promu comme candidat.");
      if (humanStatus !== "approved") blockReasons.push("La validation humaine est requise.");
      if (locale === "unknown") blockReasons.push("La langue de la vidéo doit être confirmée.");
      const id = checksum.slice(0, 20);
      const title = episode?.question ?? fallbackTitle(candidate.relativePath, slug);
      records.push({
        id,
        checksum,
        fileName: basename(candidate.absolutePath),
        relativePath: candidate.relativePath,
        kind: candidate.kind,
        locale,
        title,
        ...(episode?.question ? { question: episode.question } : {}),
        durationSeconds: await duration(candidate.absolutePath),
        sizeBytes: file.size,
        modifiedAt: file.mtime.toISOString(),
        qaStatus: qa.status,
        ...(qa.detail ? { qaDetail: qa.detail } : {}),
        humanStatus,
        promoted,
        caption: saved?.caption || title,
        hashtags: suggestedHashtags(locale, title, saved?.hashtags),
        sources: episode?.sources ?? [],
        canPublish: blockReasons.length === 0,
        blockReasons,
        thumbnailUrl: `/thumb/${id}`,
        mediaUrl: `/media/${id}`,
        downloadUrl: `/media/${id}?download=1`,
        publications: state.publications.filter((attempt) => attempt.videoChecksum === checksum),
      });
      this.paths.set(id, candidate.absolutePath);
    }
    records.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    this.records = new Map(records.map((record) => [record.id, record]));
    return records;
  }

  get(id: string): VideoRecord | undefined { return this.records.get(id); }
  pathFor(id: string): string | undefined { return this.paths.get(id); }

  private async candidates(): Promise<Candidate[]> {
    const result: Candidate[] = [];
    const roots = [
      { path: resolve(this.repoRoot, "output/series"), kind: "production" as const, priority: 3 },
      { path: resolve(this.repoRoot, "output/production"), kind: "production" as const, priority: 2 },
      { path: resolve(this.repoRoot, "output/benchmarks"), kind: "poc" as const, priority: 1 },
    ];
    for (const root of roots) {
      for (const file of await walk(root.path)) {
        if (extname(file).toLowerCase() !== ".mp4") continue;
        const normalized = file.split(sep).join("/");
        const allowed = root.kind === "production" ? normalized.includes("/result/") : /\/(result|final)\//.test(normalized);
        if (!allowed || normalized.includes("/source/") || normalized.includes("/working/")) continue;
        result.push({ absolutePath: file, relativePath: relative(this.repoRoot, file), kind: root.kind, priority: root.priority });
      }
    }
    return result;
  }

  private async episodeCatalog(): Promise<Map<string, EpisodeInfo>> {
    const catalog = new Map<string, EpisodeInfo>();
    const roots = [
      resolve(this.repoRoot, "production-profiles/bizarrement-curieux/v1/locales/fr-FR/episodes.json"),
      resolve(this.repoRoot, "production-profiles/bizarrement-curieux/v1/locales/en-US/episodes.json"),
    ];
    for (const path of roots) {
      try {
        const items = JSON.parse(await readFile(path, "utf8")) as Array<EpisodeInfo & { id: string }>;
        for (const item of items) catalog.set(item.id, item);
      } catch { /* A missing optional profile must not break the library. */ }
    }
    return catalog;
  }
}

async function walk(root: string): Promise<string[]> {
  try { await access(root); } catch { return []; }
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function sha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, reject) => {
    createReadStream(path).on("data", (chunk) => hash.update(chunk)).on("end", resolvePromise).on("error", reject);
  });
  return hash.digest("hex");
}

async function duration(path: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path]);
    const value = Number(stdout.trim());
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  } catch { return null; }
}

async function findQa(videoPath: string, slug: string, repoRoot: string): Promise<{ status: VideoRecord["qaStatus"]; detail?: string }> {
  let current = dirname(videoPath);
  while (current.startsWith(resolve(repoRoot, "output"))) {
    for (const name of ["qa-report.json", "qa.json", "scorecard.json"]) {
      try {
        const data = JSON.parse(await readFile(resolve(current, name), "utf8")) as Record<string, unknown>;
        const episode = Array.isArray(data.episodes) ? data.episodes.find((item) => isRecord(item) && item.id === slug) : undefined;
        if (isRecord(episode) && episode.technicalStatus === "pass") return { status: "pass", detail: name };
        const master = Array.isArray(data.masters) ? data.masters.find((item) => isRecord(item) && item.id === slug) : undefined;
        if (isRecord(master) && isRecord(data.commonTechnicalChecks)) return { status: "pass", detail: name };
        if (data.status === "pass" || String(data.status).startsWith("technical-pass")) return { status: "pass", detail: name };
        if (isRecord(data.technicalQa) && Object.keys(data.technicalQa).length > 0) return { status: "pass", detail: name };
        if (isRecord(data.checks) && Object.values(data.checks).every((value) => value === true)) return { status: "pass", detail: name };
        if (data.status === "fail") return { status: "fail", detail: name };
      } catch { /* Continue toward the artifact root. */ }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { status: "unknown" };
}

function inferLocale(path: string): Locale {
  const value = path.toLowerCase();
  if (value.includes("en-us") || value.includes("curious-questions-en") || value.includes("english")) return "en-US";
  if (value.includes("fr-fr") || value.includes("questions-insolites-fr") || value.includes("bizarrement-curieux")) return "fr-FR";
  return "unknown";
}

function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function fallbackTitle(path: string, slug: string): string {
  if (slug !== "video") return titleFromSlug(slug);
  const parts = path.split(/[\\/]/);
  const benchmark = parts.indexOf("benchmarks");
  const useful = parts.slice(benchmark + 1, -1).filter((part) => !["result", "final", "produce", "source", "working"].includes(part));
  return titleFromSlug(useful.join("-"));
}

function suggestedHashtags(locale: Locale, title: string, saved?: string[]): string[] {
  const legacyDefaults = locale === "en-US"
    ? ["curiosity", "didyouknow", "science"]
    : ["curiosité", "lesaviezvous", "science"];
  const hasCustomSelection = saved !== undefined
    && (saved.length > legacyDefaults.length || saved.some((tag) => !legacyDefaults.includes(tag)));
  if (hasCustomSelection) return saved;

  const base = locale === "en-US"
    ? ["curiosity", "didyouknow", "weirdfacts", "funfacts", "science", "explained", "learnontiktok", "oddlycurious"]
    : ["curiosite", "lesaviezvous", "faitsinsolites", "culturegenerale", "science", "explication", "apprendre", "bizarrementcurieux"];
  const normalizedTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const topics = locale === "en-US"
    ? [
        { pattern: /animal|octopus|duck|cat|wombat|bird|fish|insect/, tags: ["animals", "nature"] },
        { pattern: /pepper|onion|popcorn|food|fruit|vegetable/, tags: ["foodscience", "foodfacts"] },
        { pattern: /space|planet|moon|sun|star|universe/, tags: ["space", "astronomy"] },
        { pattern: /brain|body|human|sleep|eye|blood/, tags: ["humanbody", "biology"] },
        { pattern: /computer|internet|phone|video game|technology/, tags: ["technology", "techfacts"] },
        { pattern: /country|city|ocean|island|border|map/, tags: ["geography", "worldfacts"] },
      ]
    : [
        { pattern: /animal|pieuvre|canard|chat|wombat|oiseau|poisson|insecte/, tags: ["animaux", "nature"] },
        { pattern: /piment|oignon|pop.?corn|aliment|fruit|legume/, tags: ["sciencealimentaire", "alimentation"] },
        { pattern: /espace|planete|lune|soleil|etoile|univers/, tags: ["espace", "astronomie"] },
        { pattern: /cerveau|corps|humain|sommeil|oeil|sang/, tags: ["corpshumain", "biologie"] },
        { pattern: /ordinateur|internet|telephone|jeu video|technologie/, tags: ["technologie", "culturetech"] },
        { pattern: /pays|ville|ocean|ile|frontiere|carte/, tags: ["geographie", "monde"] },
      ];
  const contextual = topics.find(({ pattern }) => pattern.test(normalizedTitle))?.tags ?? [];
  return [...new Set([...base, ...contextual])].slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
