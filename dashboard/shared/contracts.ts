import { z } from "zod";

export const LocaleSchema = z.enum(["fr-FR", "en-US", "unknown"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const VideoKindSchema = z.enum(["production", "poc"]);
export type VideoKind = z.infer<typeof VideoKindSchema>;

export const QaStatusSchema = z.enum(["pass", "fail", "unknown", "human-review-required"]);
export const HumanStatusSchema = z.enum(["unreviewed", "approved", "rejected"]);

export const PublicationAttemptSchema = z.object({
  id: z.string(),
  videoChecksum: z.string(),
  accountId: z.string(),
  provider: z.literal("tiktok"),
  status: z.enum(["uploading", "sent-to-inbox", "failed"]),
  publishId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  error: z.string().optional(),
});
export type PublicationAttempt = z.infer<typeof PublicationAttemptSchema>;

export const VideoRecordSchema = z.object({
  id: z.string(),
  checksum: z.string(),
  fileName: z.string(),
  relativePath: z.string(),
  kind: VideoKindSchema,
  locale: LocaleSchema,
  title: z.string(),
  question: z.string().optional(),
  durationSeconds: z.number().nullable(),
  sizeBytes: z.number(),
  modifiedAt: z.string(),
  qaStatus: QaStatusSchema,
  qaDetail: z.string().optional(),
  humanStatus: HumanStatusSchema,
  promoted: z.boolean(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  sources: z.array(z.string()),
  canPublish: z.boolean(),
  blockReasons: z.array(z.string()),
  thumbnailUrl: z.string(),
  mediaUrl: z.string(),
  downloadUrl: z.string(),
  publications: z.array(PublicationAttemptSchema),
});
export type VideoRecord = z.infer<typeof VideoRecordSchema>;

export const AccountSchema = z.object({
  id: z.enum(["bizarrement-curieux-fr", "oddly-curious-en"]),
  label: z.string(),
  locale: z.enum(["fr-FR", "en-US"]),
  configured: z.boolean(),
  connected: z.boolean(),
  username: z.string().optional(),
  message: z.string().optional(),
});
export type Account = z.infer<typeof AccountSchema>;

export const PublicationPlanStatusSchema = z.enum(["scheduled", "published", "postponed", "blocked"]);
export type PublicationPlanStatus = z.infer<typeof PublicationPlanStatusSchema>;

export const PublicationLinksSchema = z.object({
  tiktok: z.string().max(500).default(""),
  youtube: z.string().max(500).default(""),
  instagram: z.string().max(500).default(""),
});
export type PublicationLinks = z.infer<typeof PublicationLinksSchema>;

export const PublicationPlanItemSchema = z.object({
  id: z.string(),
  project: z.string(),
  locale: z.enum(["fr-FR", "en-US"]),
  scheduledAt: z.string(),
  title: z.string(),
  videoSlug: z.string(),
  videoId: z.string().optional(),
  status: PublicationPlanStatusSchema,
  urls: PublicationLinksSchema,
  note: z.string().optional(),
});
export type PublicationPlanItem = z.infer<typeof PublicationPlanItemSchema>;

export const DashboardStateSchema = z.object({
  version: z.literal(1),
  videos: z.record(z.string(), z.object({
    humanStatus: HumanStatusSchema.default("unreviewed"),
    promoted: z.boolean().default(false),
    caption: z.string().default(""),
    hashtags: z.array(z.string()).default([]),
    updatedAt: z.string(),
  })).default({}),
  accounts: z.record(z.string(), z.object({
    username: z.string().optional(),
    openId: z.string().optional(),
    connectedAt: z.string().optional(),
  })).default({}),
  publications: z.array(PublicationAttemptSchema).default([]),
  publicationPlan: z.record(z.string(), z.object({
    status: PublicationPlanStatusSchema,
    urls: PublicationLinksSchema,
    updatedAt: z.string(),
  })).optional(),
});
export type DashboardState = z.infer<typeof DashboardStateSchema>;

export interface PublishingProvider {
  getAccounts(): Promise<Account[]>;
  createAuthorizationUrl(accountId: string): Promise<string>;
  completeAuthorization(input: { code: string; state: string }): Promise<string>;
  uploadDraft(input: { accountId: string; video: VideoRecord; absolutePath: string }): Promise<PublicationAttempt>;
  getStatus(accountId: string, publishId: string): Promise<string>;
}
