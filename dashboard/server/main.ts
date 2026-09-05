import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { existsSync } from "node:fs";
import { access, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { basename, dirname, extname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { VideoIndexer } from "./indexer.js";
import { MacOsKeychainStore } from "./keychain.js";
import { StateStore } from "./state-store.js";
import { TikTokPublishingProvider } from "./tiktok.js";
import { publicationPlan } from "./publication-plan.js";
import { isLoopback, parseByteRange, sameHostOrigin } from "./http-security.js";

const execFileAsync = promisify(execFile);
const repoRoot = findRepoRoot(import.meta.dirname);
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const port = Number(process.env.SF_DASHBOARD_PORT ?? 4173);
const stateRoot = resolve(repoRoot, ".sf-dashboard");
const clientRoot = resolve(repoRoot, "dashboard/dist/client");
const pairingCode = z.string().regex(/^\d{6}$/, "SF_DASHBOARD_PAIRING_CODE doit contenir exactement six chiffres.")
  .parse(process.env.SF_DASHBOARD_PAIRING_CODE ?? String(randomInt(100000, 1_000_000)));
const sessions = new Map<string, { csrf: string; createdAt: number }>();
const store = new StateStore(resolve(stateRoot, "state.json"));
const indexer = new VideoIndexer(repoRoot);
const tiktok = new TikTokPublishingProvider(new MacOsKeychainStore(), store, port);
let videos = await indexer.scan(await store.read());

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    json(response, error instanceof HttpError ? error.status : 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  const publicPort = Number(process.env.SF_DASHBOARD_PUBLIC_PORT ?? port);
  const urls = localUrls(publicPort);
  process.stdout.write(`\nShortform Forge Operator\n`);
  process.stdout.write(`Pairing code: ${pairingCode}\n`);
  process.stdout.write(`Mac: http://127.0.0.1:${publicPort}\n`);
  for (const url of urls) process.stdout.write(`iPhone: ${url}\n`);
  if (!process.env.SF_TIKTOK_CLIENT_KEY) process.stdout.write("TikTok: disabled until Developer credentials are configured.\n");
  process.stdout.write("\n");
});

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  const method = request.method ?? "GET";

  if (method === "POST" && url.pathname === "/api/pair") {
    assertOrigin(request);
    const body = z.object({ code: z.string() }).parse(await readJson(request));
    if (body.code !== pairingCode) return json(response, 401, { error: "Code d'appairage incorrect." });
    const id = randomBytes(32).toString("hex");
    const csrf = randomBytes(24).toString("hex");
    sessions.set(id, { csrf, createdAt: Date.now() });
    response.setHeader("Set-Cookie", `sf_dashboard_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    return json(response, 200, { authenticated: true, csrf });
  }

  if (url.pathname === "/oauth/tiktok/callback/") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return html(response, 400, messagePage("Connexion refusée", "TikTok n'a pas renvoyé les informations attendues."));
    try {
      await tiktok.completeAuthorization({ code, state });
      return html(response, 200, messagePage("Compte connecté", "Vous pouvez fermer cette fenêtre et revenir au dashboard."));
    } catch (error) {
      return html(response, 400, messagePage("Connexion impossible", error instanceof Error ? error.message : String(error)));
    }
  }

  const session = authenticate(request);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/thumb/")) {
    if (!session) return json(response, 401, { error: "Appairage requis." });
  }

  if (method === "GET" && url.pathname === "/api/session") return json(response, 200, { authenticated: true, csrf: session!.csrf });
  if (method === "GET" && url.pathname === "/api/videos") return json(response, 200, { videos });
  if (method === "POST" && url.pathname === "/api/refresh") {
    assertMutation(request, session!);
    videos = await indexer.scan(await store.read());
    return json(response, 200, { videos });
  }
  if (method === "GET" && url.pathname === "/api/accounts") return json(response, 200, { accounts: await tiktok.getAccounts() });
  if (method === "GET" && url.pathname === "/api/publication-plan") return json(response, 200, { items: publicationPlan(videos, await store.read()) });

  const planAction = url.pathname.match(/^\/api\/publication-plan\/([^/]+)$/);
  if (method === "POST" && planAction) {
    assertMutation(request, session!);
    const id = planAction[1]!;
    const currentPlan = publicationPlan(videos, await store.read());
    if (!currentPlan.some((item) => item.id === id)) return json(response, 404, { error: "Publication planifiée introuvable." });
    const input = z.object({
      status: z.enum(["scheduled", "published", "postponed", "blocked"]),
      urls: z.object({ tiktok: z.string().max(500), youtube: z.string().max(500), instagram: z.string().max(500) }),
    }).parse(await readJson(request));
    const nextState = await store.update((state) => {
      state.publicationPlan ??= {};
      state.publicationPlan[id] = { ...input, updatedAt: new Date().toISOString() };
    });
    return json(response, 200, { item: publicationPlan(videos, nextState).find((item) => item.id === id) });
  }

  const videoAction = url.pathname.match(/^\/api\/videos\/([^/]+)\/(metadata|promote|review)$/);
  if (method === "POST" && videoAction) {
    assertMutation(request, session!);
    const id = videoAction[1]!;
    const action = videoAction[2]!;
    const video = indexer.get(id);
    if (!video) return json(response, 404, { error: "Vidéo introuvable." });
    if (action === "promote" && video.kind !== "poc") return json(response, 400, { error: "Seuls les POC nécessitent une promotion." });
    const body = await readJson(request);
    await store.update((state) => {
      const current = state.videos[video.checksum] ?? { humanStatus: "unreviewed" as const, promoted: false, caption: video.caption, hashtags: video.hashtags, updatedAt: new Date().toISOString() };
      if (action === "promote") current.promoted = true;
      if (action === "review") current.humanStatus = z.object({ approved: z.boolean() }).parse(body).approved ? "approved" : "rejected";
      if (action === "metadata") {
        const metadata = z.object({ caption: z.string().max(2200), hashtags: z.array(z.string().min(1).max(80)).max(20) }).parse(body);
        current.caption = metadata.caption;
        current.hashtags = metadata.hashtags.map((tag) => tag.replace(/^#/, ""));
      }
      current.updatedAt = new Date().toISOString();
      state.videos[video.checksum] = current;
    });
    videos = await indexer.scan(await store.read());
    return json(response, 200, { video: indexer.get(id) });
  }

  const connect = url.pathname.match(/^\/api\/accounts\/([^/]+)\/connect$/);
  if (method === "POST" && connect) {
    assertMutation(request, session!);
    if (!isLoopback(request.socket.remoteAddress)) return json(response, 403, { error: "La connexion d'un compte TikTok doit être lancée depuis le Mac." });
    return json(response, 200, { url: await tiktok.createAuthorizationUrl(connect[1]!) });
  }

  if (method === "POST" && url.pathname === "/api/publications") {
    assertMutation(request, session!);
    const body = z.object({ videoId: z.string(), accountId: z.string() }).parse(await readJson(request));
    const video = indexer.get(body.videoId);
    const path = indexer.pathFor(body.videoId);
    if (!video || !path) return json(response, 404, { error: "Vidéo introuvable." });
    const state = await store.read();
    const pendingToday = state.publications.filter((item) => item.accountId === body.accountId && item.status === "sent-to-inbox" && Date.now() - new Date(item.createdAt).getTime() < 86_400_000);
    if (pendingToday.length >= 5) return json(response, 429, { error: "Cinq brouillons sont déjà en attente pour ce compte sur les dernières 24 heures." });
    const attempt = await tiktok.uploadDraft({ accountId: body.accountId, video, absolutePath: path });
    videos = await indexer.scan(await store.read());
    return json(response, attempt.status === "failed" ? 502 : 200, { attempt });
  }

  const media = url.pathname.match(/^\/media\/([^/]+)$/);
  if (method === "GET" && media) return streamVideo(request, response, media[1]!, url.searchParams.has("download"));
  const thumbnail = url.pathname.match(/^\/thumb\/([^/]+)$/);
  if (method === "GET" && thumbnail) return streamThumbnail(response, thumbnail[1]!);

  if (method === "GET" && !url.pathname.startsWith("/api/")) return serveClient(response, url.pathname);
  json(response, 404, { error: "Route introuvable." });
}

function authenticate(request: IncomingMessage): { csrf: string; createdAt: number } | undefined {
  const cookies = Object.fromEntries((request.headers.cookie ?? "").split(";").map((part) => part.trim().split("=") as [string, string]));
  const session = sessions.get(cookies.sf_dashboard_session ?? "");
  if (session && Date.now() - session.createdAt > 43_200_000) return undefined;
  return session;
}

function assertMutation(request: IncomingMessage, session: { csrf: string }): void {
  assertOrigin(request);
  if (request.headers["x-csrf-token"] !== session.csrf) throw new HttpError(403, "Jeton de sécurité invalide.");
}

function assertOrigin(request: IncomingMessage): void {
  if (!sameHostOrigin(request.headers.origin, request.headers.host)) throw new HttpError(403, "Origine non autorisée.");
}

async function streamVideo(request: IncomingMessage, response: ServerResponse, id: string, download: boolean): Promise<void> {
  const path = indexer.pathFor(id);
  if (!path) return json(response, 404, { error: "Vidéo introuvable." });
  const file = await stat(path);
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Content-Type", "video/mp4");
  if (download) response.setHeader("Content-Disposition", `attachment; filename="${basename(path).replaceAll('"', '')}"`);
  let range: { start: number; end: number } | undefined;
  try { range = parseByteRange(request.headers.range, file.size); } catch {
      response.writeHead(416, { "Content-Range": `bytes */${file.size}` });
      response.end();
      return;
  }
  if (range) {
    response.writeHead(206, { "Content-Length": range.end - range.start + 1, "Content-Range": `bytes ${range.start}-${range.end}/${file.size}` });
    return void createReadStream(path, { start: range.start, end: range.end }).pipe(response);
  }
  response.writeHead(200, { "Content-Length": file.size });
  createReadStream(path).pipe(response);
}

async function streamThumbnail(response: ServerResponse, id: string): Promise<void> {
  const videoPath = indexer.pathFor(id);
  if (!videoPath) return json(response, 404, { error: "Vidéo introuvable." });
  const cache = resolve(stateRoot, "cache");
  const output = resolve(cache, `${id}.jpg`);
  await mkdir(cache, { recursive: true });
  try { await access(output); } catch {
    await execFileAsync("ffmpeg", ["-v", "error", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "3", "-y", output]);
    await pruneCache(cache, 200);
  }
  const file = await stat(output);
  response.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": file.size, "Cache-Control": "private, max-age=86400" });
  createReadStream(output).pipe(response);
}

async function pruneCache(cache: string, maximum: number): Promise<void> {
  const entries = await Promise.all((await readdir(cache)).filter((name) => extname(name) === ".jpg").map(async (name) => ({ path: resolve(cache, name), stat: await stat(resolve(cache, name)) })));
  entries.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  await Promise.all(entries.slice(maximum).map((entry) => unlink(entry.path)));
}

async function serveClient(response: ServerResponse, pathname: string): Promise<void> {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safe = requested.includes("..") ? "index.html" : requested;
  let path = resolve(clientRoot, safe);
  try { await access(path); } catch { path = resolve(clientRoot, "index.html"); }
  try {
    const file = await stat(path);
    response.writeHead(200, { "Content-Type": mime(path), "Content-Length": file.size });
    createReadStream(path).pipe(response);
  } catch {
    html(response, 503, messagePage("Interface non construite", "Lancez pnpm dashboard:build puis pnpm dashboard:start."));
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new HttpError(413, "Requête trop volumineuse.");
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  response.end(body);
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
  response.end(body);
}

function messagePage(title: string, detail: string): string {
  return `<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><body style="font:16px system-ui;background:#101412;color:#f6f7f3;padding:48px"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p><a href="/" style="color:#f4c453">Retour au dashboard</a></body></html>`;
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
function mime(path: string): string { return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" } as Record<string, string>)[extname(path)] ?? "application/octet-stream"; }
function localUrls(value: number): string[] { return Object.values(networkInterfaces()).flat().filter((item): item is NonNullable<typeof item> => Boolean(item && item.family === "IPv4" && !item.internal)).map((item) => `http://${item.address}:${value}`); }
function findRepoRoot(start: string): string {
  let current = start;
  while (true) {
    if (existsSync(resolve(current, "package.json")) && existsSync(resolve(current, "AGENTS.md"))) return current;
    const parent = dirname(current);
    if (parent === current) throw new Error("Racine Shortform Forge introuvable.");
    current = parent;
  }
}

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }

process.on("SIGINT", () => server.close(() => process.exit(0)));
