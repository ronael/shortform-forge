import type { Opportunity } from "../../domain/discovery.js";

const RESPONSE_CONTRACT = `Respond with JSON only, no markdown fences, matching exactly this shape:
{
  "whyInteresting": ["reason", ...],
  "hook": { "type": "curiosity|contrarian|how-to|story|list|news|other", "strength": "low|medium|high" },
  "adaptationIdeas": ["original short-form adaptation idea", ...],
  "recommendedFormat": { "type": "faceless|talking-head|b-roll|screen-recording|remix|other", "durationSeconds": { "min": 30, "max": 45 } },
  "productionDifficulty": "low|medium|high",
  "potential": "low|medium|high",
  "risks": ["risk", ...]
}`;

export function buildOpportunityBriefPrompt(opportunity: Opportunity): string {
  const { signal, metrics, score } = opportunity;
  const facts: string[] = [
    `title: ${signal.title}`,
    `platform: ${signal.platform}`,
    `url: ${signal.url}`,
    `creator: ${signal.creator ?? "not available"}`,
    `publishedAt: ${signal.publishedAt ?? "not available"}`,
    `views: ${signal.views !== undefined ? signal.views.toLocaleString("en-US") : "not available"}`,
    `likes: ${signal.likes !== undefined ? signal.likes.toLocaleString("en-US") : "not available"}`,
    `comments: ${signal.comments !== undefined ? signal.comments.toLocaleString("en-US") : "not available"}`,
    `creatorFollowers: ${signal.creatorFollowers !== undefined ? signal.creatorFollowers.toLocaleString("en-US") : "not available"}`,
    `durationSeconds: ${signal.durationSeconds ?? "not available"}`,
    `language: ${signal.language ?? "not available"}`
  ];
  if (signal.description) facts.push(`description: ${signal.description.slice(0, 500)}`);

  const derived = [
    `viewsPerDay: ${metrics.viewsPerDay !== undefined ? Math.round(metrics.viewsPerDay).toLocaleString("en-US") : "not available"}`,
    `engagementRate: ${metrics.engagementRate !== undefined ? `${(metrics.engagementRate * 100).toFixed(2)}%` : "not available"}`,
    `ageDays: ${metrics.ageDays !== undefined ? metrics.ageDays.toFixed(1) : "not available"}`
  ];

  return [
    "You are analyzing a discovered short-form content signal to decide whether it is worth producing an original adaptation.",
    "This signal is NOT an authorized production source. Judge the topic, hook and format; do not propose reusing the original footage.",
    "Only use the facts below. Missing data is marked \"not available\"; do not invent numbers.",
    "",
    "## Signal facts",
    ...facts,
    "",
    "## Derived metrics",
    ...derived,
    "",
    "## Deterministic opportunity score",
    `score: ${score.score}/100 (factors used: ${score.usedSignals.join(", ") || "none"})`,
    ...score.reasons.map((reason) => `- ${reason}`),
    "",
    "## Task",
    "Explain why this content works, classify its hook, propose original adaptation ideas for a short-form video, and recommend a production format.",
    "",
    RESPONSE_CONTRACT
  ].join("\n");
}

