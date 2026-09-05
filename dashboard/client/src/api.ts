import type { Account, PublicationLinks, PublicationPlanItem, PublicationPlanStatus, VideoRecord } from "../../shared/contracts";

let csrf = "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Erreur ${response.status}`);
  return body;
}

export async function session(): Promise<boolean> {
  try {
    const result = await request<{ authenticated: boolean; csrf: string }>("/api/session");
    csrf = result.csrf;
    return result.authenticated;
  } catch {
    return false;
  }
}

export async function pair(code: string): Promise<void> {
  const result = await request<{ csrf: string }>("/api/pair", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  csrf = result.csrf;
}

export const loadVideos = () => request<{ videos: VideoRecord[] }>("/api/videos").then((value) => value.videos);
export const refreshVideos = () => request<{ videos: VideoRecord[] }>("/api/refresh", { method: "POST" }).then((value) => value.videos);
export const loadAccounts = () => request<{ accounts: Account[] }>("/api/accounts").then((value) => value.accounts);
export const loadPublicationPlan = () => request<{ items: PublicationPlanItem[] }>("/api/publication-plan").then((value) => value.items);
export const savePublicationPlanItem = (id: string, status: PublicationPlanStatus, urls: PublicationLinks) => request<{ item: PublicationPlanItem }>(`/api/publication-plan/${id}`, { method: "POST", body: JSON.stringify({ status, urls }) }).then((value) => value.item);
export const promote = (id: string) => request<{ video: VideoRecord }>(`/api/videos/${id}/promote`, { method: "POST", body: "{}" }).then((value) => value.video);
export const review = (id: string, approved: boolean) => request<{ video: VideoRecord }>(`/api/videos/${id}/review`, { method: "POST", body: JSON.stringify({ approved }) }).then((value) => value.video);
export const saveMetadata = (id: string, caption: string, hashtags: string[]) => request<{ video: VideoRecord }>(`/api/videos/${id}/metadata`, { method: "POST", body: JSON.stringify({ caption, hashtags }) }).then((value) => value.video);
export const connectAccount = (id: string) => request<{ url: string }>(`/api/accounts/${id}/connect`, { method: "POST", body: "{}" });
export const publish = (videoId: string, accountId: string) => request<{ attempt: unknown }>("/api/publications", { method: "POST", body: JSON.stringify({ videoId, accountId }) });
