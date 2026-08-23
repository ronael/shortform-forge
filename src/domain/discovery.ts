import { z } from "zod";

export const DiscoveryPlatformSchema = z.enum(["youtube", "manual", "unknown"]);

export const ContentSignalSchema = z.object({
  id: z.string().min(1),
  platform: DiscoveryPlatformSchema,
  url: z.string().url(),
  title: z.string().min(1),
  creator: z.string().min(1).optional(),
  creatorId: z.string().min(1).optional(),
  publishedAt: z.string().datetime().optional(),
  collectedAt: z.string().datetime(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  creatorFollowers: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().positive().optional(),
  language: z.string().min(2).optional(),
  description: z.string().optional(),
  provenance: z.object({
    source: z.string().min(1),
    query: z.string().min(1).optional(),
    collectedBy: z.string().min(1),
    note: z.string().min(1)
  })
});

export const DerivedMetricsSchema = z.object({
  ageHours: z.number().nonnegative().optional(),
  ageDays: z.number().nonnegative().optional(),
  viewsPerHour: z.number().nonnegative().optional(),
  viewsPerDay: z.number().nonnegative().optional(),
  engagementRate: z.number().nonnegative().optional(),
  viewFollowerRatio: z.number().nonnegative().optional()
});

export const OpportunityScoreSchema = z.object({
  score: z.number().min(0).max(100),
  signals: z.record(z.string(), z.number().min(0).max(100)),
  usedSignals: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1))
});

export const OpportunitySchema = z.object({
  signal: ContentSignalSchema,
  metrics: DerivedMetricsSchema,
  score: OpportunityScoreSchema,
  warnings: z.array(z.string()).default([])
});

export const DiscoveryRunSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  query: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
  collectedAt: z.string().datetime(),
  artifactDir: z.string().min(1),
  errors: z.array(z.string()).default([])
});

export type ContentSignal = z.infer<typeof ContentSignalSchema>;
export type DerivedMetrics = z.infer<typeof DerivedMetricsSchema>;
export type OpportunityScore = z.infer<typeof OpportunityScoreSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type DiscoveryRun = z.infer<typeof DiscoveryRunSchema>;

export function deriveMetrics(signal: ContentSignal, now = new Date()): DerivedMetrics {
  const publishedAt = signal.publishedAt ? new Date(signal.publishedAt) : undefined;
  const ageHours = publishedAt && Number.isFinite(publishedAt.getTime())
    ? Math.max(0, (now.getTime() - publishedAt.getTime()) / 3_600_000)
    : undefined;
  const ageDays = ageHours === undefined ? undefined : ageHours / 24;
  const viewsPerHour = signal.views !== undefined && ageHours !== undefined && ageHours > 0
    ? signal.views / ageHours
    : undefined;
  const viewsPerDay = signal.views !== undefined && ageDays !== undefined && ageDays > 0
    ? signal.views / ageDays
    : undefined;
  const engagementCount = (signal.likes ?? 0) + (signal.comments ?? 0);
  const hasEngagement = signal.likes !== undefined || signal.comments !== undefined;
  const engagementRate = signal.views !== undefined && signal.views > 0 && hasEngagement
    ? engagementCount / signal.views
    : undefined;
  const viewFollowerRatio = signal.views !== undefined && signal.creatorFollowers !== undefined && signal.creatorFollowers > 0
    ? signal.views / signal.creatorFollowers
    : undefined;

  return DerivedMetricsSchema.parse({
    ...(ageHours !== undefined ? { ageHours } : {}),
    ...(ageDays !== undefined ? { ageDays } : {}),
    ...(viewsPerHour !== undefined ? { viewsPerHour } : {}),
    ...(viewsPerDay !== undefined ? { viewsPerDay } : {}),
    ...(engagementRate !== undefined ? { engagementRate } : {}),
    ...(viewFollowerRatio !== undefined ? { viewFollowerRatio } : {})
  });
}

export function scoreOpportunity(signal: ContentSignal, metrics: DerivedMetrics): OpportunityScore {
  const factors: Record<string, number> = {};
  const reasons: string[] = [];

  if (metrics.viewsPerDay !== undefined) {
    factors.velocity = clamp(Math.round(Math.log10(metrics.viewsPerDay + 1) * 20), 0, 100);
    reasons.push(`${Math.round(metrics.viewsPerDay).toLocaleString("en-US")} views/day`);
  }
  if (metrics.engagementRate !== undefined) {
    factors.engagement = clamp(Math.round(metrics.engagementRate * 1000), 0, 100);
    reasons.push(`${(metrics.engagementRate * 100).toFixed(2)}% engagement rate`);
  }
  if (metrics.ageDays !== undefined) {
    factors.recency = recencyScore(metrics.ageDays);
    reasons.push(`${metrics.ageDays.toFixed(1)} days old`);
  }
  if (metrics.viewFollowerRatio !== undefined) {
    factors.outperformance = clamp(Math.round(Math.log10(metrics.viewFollowerRatio + 1) * 55), 0, 100);
    reasons.push(`${metrics.viewFollowerRatio.toFixed(2)} views/follower`);
  }
  if (signal.views !== undefined) {
    factors.scale = clamp(Math.round(Math.log10(signal.views + 1) * 14), 0, 100);
    reasons.push(`${signal.views.toLocaleString("en-US")} views`);
  }

  const usedSignals = Object.keys(factors);
  const score = usedSignals.length === 0
    ? 0
    : Math.round(usedSignals.reduce((sum, key) => sum + (factors[key] ?? 0), 0) / usedSignals.length);

  return OpportunityScoreSchema.parse({
    score,
    signals: factors,
    usedSignals,
    reasons: reasons.length > 0 ? reasons : ["insufficient objective metrics"]
  });
}

export function buildOpportunity(signal: ContentSignal, now = new Date()): Opportunity {
  const metrics = deriveMetrics(signal, now);
  const warnings = signal.views === undefined ? ["missing views"] : [];
  if (!signal.publishedAt) warnings.push("missing publishedAt");
  return OpportunitySchema.parse({
    signal,
    metrics,
    score: scoreOpportunity(signal, metrics),
    warnings
  });
}

export function rankOpportunities(opportunities: Opportunity[], limit: number): Opportunity[] {
  return [...opportunities]
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, limit);
}

function recencyScore(ageDays: number): number {
  if (ageDays <= 1) return 100;
  if (ageDays <= 7) return Math.round(100 - ((ageDays - 1) / 6) * 25);
  if (ageDays <= 30) return Math.round(75 - ((ageDays - 7) / 23) * 35);
  if (ageDays <= 180) return Math.round(40 - ((ageDays - 30) / 150) * 25);
  return 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
