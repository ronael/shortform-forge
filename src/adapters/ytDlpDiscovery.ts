import { z } from "zod";
import { ContentSignalSchema, type ContentSignal } from "../domain/discovery.js";
import type { DiscoveryQuery, DiscoveryResult, DiscoverySource } from "../application/discoveryPorts.js";
import { runProcess } from "./process.js";

const YtDlpEntrySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  webpage_url: z.string().optional(),
  original_url: z.string().optional(),
  uploader: z.string().optional(),
  channel: z.string().optional(),
  uploader_id: z.string().optional(),
  channel_id: z.string().optional(),
  timestamp: z.number().nullable().optional(),
  release_timestamp: z.number().nullable().optional(),
  upload_date: z.string().optional(),
  view_count: z.number().int().nonnegative().nullable().optional(),
  like_count: z.number().int().nonnegative().nullable().optional(),
  comment_count: z.number().int().nonnegative().nullable().optional(),
  channel_follower_count: z.number().int().nonnegative().nullable().optional(),
  duration: z.number().positive().nullable().optional(),
  language: z.string().nullable().optional(),
  description: z.string().nullable().optional()
}).passthrough();

const YtDlpSingleJsonSchema = z.object({
  entries: z.array(YtDlpEntrySchema).optional()
}).passthrough();

export class YtDlpDiscoverySource implements DiscoverySource {
  readonly source = "youtube";

  constructor(private readonly binaryPath = process.env.SF_YTDLP_BIN ?? "yt-dlp") {}

  async search(input: DiscoveryQuery): Promise<DiscoveryResult> {
    const collectedAt = new Date().toISOString();
    const result = await runProcess(this.binaryPath, [
      "--dump-single-json",
      "--flat-playlist",
      "--no-download",
      `ytsearch${input.limit}:${input.query}`
    ], 120_000);
    const raw = parseYtDlpSearchJson(JSON.parse(result.stdout));
    const normalized = normalizeYtDlpEntries(raw, {
      query: input.query,
      collectedAt,
      collectedBy: this.binaryPath
    });
    return {
      source: this.source,
      query: input.query,
      collectedAt,
      signals: normalized.signals,
      warnings: normalized.warnings,
      raw
    };
  }
}

export function parseYtDlpSearchJson(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const parsed = YtDlpSingleJsonSchema.parse(raw);
  return parsed.entries ?? [];
}

export function normalizeYtDlpEntries(rawEntries: unknown[], context: {
  query: string;
  collectedAt: string;
  collectedBy: string;
}): { signals: ContentSignal[]; warnings: string[] } {
  const signals: ContentSignal[] = [];
  const warnings: string[] = [];

  for (const [index, raw] of rawEntries.entries()) {
    const parsed = YtDlpEntrySchema.safeParse(raw);
    if (!parsed.success) {
      warnings.push(`item ${index}: invalid yt-dlp entry`);
      continue;
    }
    const entry = parsed.data;
    const id = entry.id ?? videoIdFromUrl(entry.webpage_url ?? entry.url);
    const title = entry.title;
    const url = canonicalYoutubeUrl(entry.webpage_url ?? entry.original_url ?? entry.url, id);
    if (!id || !title || !url) {
      warnings.push(`item ${index}: missing required id/title/url`);
      continue;
    }
    const signal = ContentSignalSchema.parse({
      id,
      platform: "youtube",
      url,
      title,
      ...(entry.uploader ?? entry.channel ? { creator: entry.uploader ?? entry.channel } : {}),
      ...(entry.uploader_id ?? entry.channel_id ? { creatorId: entry.uploader_id ?? entry.channel_id } : {}),
      ...dateFields(entry),
      collectedAt: context.collectedAt,
      ...(entry.view_count !== null && entry.view_count !== undefined ? { views: entry.view_count } : {}),
      ...(entry.like_count !== null && entry.like_count !== undefined ? { likes: entry.like_count } : {}),
      ...(entry.comment_count !== null && entry.comment_count !== undefined ? { comments: entry.comment_count } : {}),
      ...(entry.channel_follower_count !== null && entry.channel_follower_count !== undefined ? { creatorFollowers: entry.channel_follower_count } : {}),
      ...(entry.duration !== null && entry.duration !== undefined ? { durationSeconds: entry.duration } : {}),
      ...(entry.language ? { language: entry.language } : {}),
      ...(entry.description ? { description: entry.description } : {}),
      provenance: {
        source: "youtube-search",
        query: context.query,
        collectedBy: context.collectedBy,
        note: "Discovery signal only. This is not an authorized production source."
      }
    });
    signals.push(signal);
  }

  return { signals, warnings };
}

function dateFields(entry: z.infer<typeof YtDlpEntrySchema>): { publishedAt?: string } {
  const timestamp = entry.timestamp ?? entry.release_timestamp ?? undefined;
  if (timestamp !== undefined) return { publishedAt: new Date(timestamp * 1000).toISOString() };
  if (entry.upload_date && /^\d{8}$/.test(entry.upload_date)) {
    const year = entry.upload_date.slice(0, 4);
    const month = entry.upload_date.slice(4, 6);
    const day = entry.upload_date.slice(6, 8);
    return { publishedAt: new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString() };
  }
  return {};
}

function canonicalYoutubeUrl(rawUrl: string | undefined, id: string | undefined): string | undefined {
  if (rawUrl?.startsWith("http")) return rawUrl;
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  return undefined;
}

function videoIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const watch = /[?&]v=([^&]+)/.exec(url);
  if (watch?.[1]) return watch[1];
  const short = /youtu\.be\/([^?]+)/.exec(url);
  return short?.[1];
}
