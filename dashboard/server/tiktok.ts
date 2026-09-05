import { createHash, randomBytes, randomUUID } from "node:crypto";
import { open, stat } from "node:fs/promises";
import type { Account, PublicationAttempt, PublishingProvider, VideoRecord } from "../shared/contracts.js";
import type { SecretStore, TokenSecret } from "./keychain.js";
import type { StateStore } from "./state-store.js";

const ACCOUNT_CONFIG = [
  { id: "bizarrement-curieux-fr" as const, label: "Bizarrement Curieux", locale: "fr-FR" as const },
  { id: "oddly-curious-en" as const, label: "Oddly Curious", locale: "en-US" as const },
];

interface PendingAuthorization { accountId: string; verifier: string; expiresAt: number }

export class TikTokPublishingProvider implements PublishingProvider {
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly clientKey = process.env.SF_TIKTOK_CLIENT_KEY;
  private readonly clientSecret = process.env.SF_TIKTOK_CLIENT_SECRET;
  private readonly redirectUri: string;

  constructor(private readonly secrets: SecretStore, private readonly state: StateStore, port: number) {
    this.redirectUri = process.env.SF_TIKTOK_REDIRECT_URI ?? `http://127.0.0.1:${port}/oauth/tiktok/callback/`;
  }

  async getAccounts(): Promise<Account[]> {
    const state = await this.state.read();
    return Promise.all(ACCOUNT_CONFIG.map(async (account) => {
      const token = await this.secrets.get(account.id);
      const savedAccount = state.accounts[account.id];
      const configured = Boolean(this.clientKey && this.clientSecret);
      return {
        ...account,
        configured,
        connected: Boolean(token),
        ...(savedAccount?.username ? { username: savedAccount.username } : {}),
        ...(!configured ? { message: "Ajoutez les identifiants TikTok Developer pour activer la connexion." } : {}),
      };
    }));
  }

  async createAuthorizationUrl(accountId: string): Promise<string> {
    this.assertConfigured();
    if (!ACCOUNT_CONFIG.some((account) => account.id === accountId)) throw new Error("Compte TikTok inconnu.");
    const state = randomBytes(24).toString("hex");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("hex");
    this.pending.set(state, { accountId, verifier, expiresAt: Date.now() + 10 * 60_000 });
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", this.clientKey!);
    url.searchParams.set("scope", "user.info.basic,video.upload");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async completeAuthorization(input: { code: string; state: string }): Promise<string> {
    this.assertConfigured();
    const pending = this.pending.get(input.state);
    this.pending.delete(input.state);
    if (!pending || pending.expiresAt < Date.now()) throw new Error("Connexion TikTok expirée ou invalide.");
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({
        client_key: this.clientKey!,
        client_secret: this.clientSecret!,
        code: input.code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
        code_verifier: pending.verifier,
      }),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
      throw new Error(apiError(body, "TikTok a refusé la connexion."));
    }
    const now = Date.now();
    const token: TokenSecret = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresAt: new Date(now + Number(body.expires_in ?? 86_400) * 1000).toISOString(),
      refreshExpiresAt: new Date(now + Number(body.refresh_expires_in ?? 31_536_000) * 1000).toISOString(),
      openId: String(body.open_id ?? ""),
      scope: String(body.scope ?? ""),
    };
    await this.secrets.set(pending.accountId, token);
    await this.state.update((state) => {
      state.accounts[pending.accountId] = { openId: token.openId, connectedAt: new Date().toISOString() };
    });
    return pending.accountId;
  }

  async uploadDraft(input: { accountId: string; video: VideoRecord; absolutePath: string }): Promise<PublicationAttempt> {
    const account = ACCOUNT_CONFIG.find((item) => item.id === input.accountId);
    if (!account) throw new Error("Compte TikTok inconnu.");
    if (input.video.locale !== account.locale) throw new Error("La langue de la vidéo ne correspond pas au compte TikTok.");
    if (!input.video.canPublish) throw new Error(input.video.blockReasons.join(" "));
    const recentPending = input.video.publications.filter((item) => item.accountId === input.accountId && item.status === "sent-to-inbox");
    if (recentPending.length > 0) throw new Error("Cette vidéo a déjà été envoyée à ce compte.");

    const attempt: PublicationAttempt = {
      id: randomUUID(),
      videoChecksum: input.video.checksum,
      accountId: input.accountId,
      provider: "tiktok",
      status: "uploading",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.persistAttempt(attempt);
    try {
      const token = await this.validToken(input.accountId);
      const size = (await stat(input.absolutePath)).size;
      const chunk = chunkPlan(size);
      const init = await tiktokJson("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", token.accessToken, {
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk.size, total_chunk_count: chunk.count },
      });
      const data = isRecord(init.data) ? init.data : {};
      if (typeof data.upload_url !== "string" || typeof data.publish_id !== "string") throw new Error(apiError(init, "TikTok n'a pas créé le brouillon."));
      await uploadChunks(data.upload_url, input.absolutePath, size, chunk.size, chunk.count);
      attempt.status = "sent-to-inbox";
      attempt.publishId = data.publish_id;
      attempt.updatedAt = new Date().toISOString();
      await this.persistAttempt(attempt);
      return attempt;
    } catch (error) {
      attempt.status = "failed";
      attempt.error = error instanceof Error ? error.message : String(error);
      attempt.updatedAt = new Date().toISOString();
      await this.persistAttempt(attempt);
      return attempt;
    }
  }

  async getStatus(accountId: string, publishId: string): Promise<string> {
    const token = await this.validToken(accountId);
    const result = await tiktokJson("https://open.tiktokapis.com/v2/post/publish/status/fetch/", token.accessToken, { publish_id: publishId });
    return isRecord(result.data) ? String(result.data.status ?? "UNKNOWN") : "UNKNOWN";
  }

  private async validToken(accountId: string): Promise<TokenSecret> {
    this.assertConfigured();
    const existing = await this.secrets.get(accountId);
    if (!existing) throw new Error("Ce compte TikTok n'est pas connecté.");
    if (new Date(existing.refreshExpiresAt).getTime() <= Date.now()) throw new Error("La connexion TikTok a expiré. Reconnectez le compte.");
    if (new Date(existing.accessExpiresAt).getTime() > Date.now() + 60_000) return existing;
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({ client_key: this.clientKey!, client_secret: this.clientSecret!, grant_type: "refresh_token", refresh_token: existing.refreshToken }),
    });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") throw new Error(apiError(body, "Impossible de renouveler la connexion TikTok."));
    const refreshed: TokenSecret = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpiresAt: new Date(Date.now() + Number(body.expires_in ?? 86_400) * 1000).toISOString(),
      refreshExpiresAt: new Date(Date.now() + Number(body.refresh_expires_in ?? 31_536_000) * 1000).toISOString(),
      openId: String(body.open_id ?? existing.openId),
      scope: String(body.scope ?? existing.scope),
    };
    await this.secrets.set(accountId, refreshed);
    return refreshed;
  }

  private async persistAttempt(attempt: PublicationAttempt): Promise<void> {
    await this.state.update((state) => {
      const index = state.publications.findIndex((item) => item.id === attempt.id);
      if (index === -1) state.publications.push({ ...attempt });
      else state.publications[index] = { ...attempt };
    });
  }

  private assertConfigured(): void {
    if (!this.clientKey || !this.clientSecret) throw new Error("TikTok Developer n'est pas configuré.");
  }
}

function chunkPlan(total: number): { size: number; count: number } {
  const fiveMb = 5 * 1024 * 1024;
  const sixtyFourMb = 64 * 1024 * 1024;
  if (total < fiveMb) return { size: total, count: 1 };
  const size = Math.min(sixtyFourMb, total);
  return { size, count: Math.max(1, Math.floor(total / size)) };
}

async function uploadChunks(url: string, path: string, total: number, chunkSize: number, count: number): Promise<void> {
  const handle = await open(path, "r");
  try {
    let start = 0;
    for (let index = 0; index < count; index += 1) {
      const length = index === count - 1 ? total - start : chunkSize;
      const buffer = Buffer.allocUnsafe(length);
      await handle.read(buffer, 0, length, start);
      const end = start + length - 1;
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(length), "Content-Range": `bytes ${start}-${end}/${total}` },
        body: buffer,
      });
      if (!response.ok) throw new Error(`Échec du transfert TikTok (${response.status}).`);
      start = end + 1;
    }
  } finally { await handle.close(); }
}

async function tiktokJson(url: string, token: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok || (isRecord(result.error) && result.error.code !== "ok")) throw new Error(apiError(result, `Erreur TikTok (${response.status}).`));
  return result;
}

function apiError(body: Record<string, unknown>, fallback: string): string {
  if (typeof body.error_description === "string") return body.error_description;
  if (isRecord(body.error) && typeof body.error.message === "string" && body.error.message) return body.error.message;
  if (isRecord(body.error) && typeof body.error.code === "string") return `${fallback} ${body.error.code}`;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

export const testing = { chunkPlan };
