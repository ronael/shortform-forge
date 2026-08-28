import type { ProductionBrief } from "../../domain/opportunity.js";

const RESPONSE_CONTRACT = `Respond with JSON only, no markdown fences, matching exactly this shape:
{
  "title": "working title for the video",
  "language": "fr",
  "durationSeconds": 40,
  "durationRecommendation": { "minSeconds": 35, "targetSeconds": 40, "maxSeconds": 45, "rationale": "why this duration fits this exact format" },
  "hook": { "text": "first spoken sentence", "durationSeconds": 3 },
  "sections": [
    { "startSeconds": 0, "endSeconds": 3, "purpose": "hook", "assetKey": "optional stable asset key", "voiceover": "...", "visualGuidance": "optional", "onScreenText": { "text": "headline only", "rank": 5, "eyebrow": "optional label", "metric": "optional number", "supportingText": "optional detail", "position": "top|center|bottom", "backdrop": "none|scrim" } },
    { "startSeconds": 3, "endSeconds": 20, "purpose": "explanation", "voiceover": "..." }
  ],
  "visualPlan": [
    { "section": "hook", "visualType": "screen|b-roll|talking-head|text-on-screen|animation|other", "description": "..." }
  ],
  "captionGuidance": { "style": "dynamic|minimal|keyword-highlight", "backdrop": "none|scrim", "keywordsToEmphasize": ["..."] },
  "dressingGuidance": { "profile": "minimal|editorial-ranking|comedy-ranking", "eyebrow": "optional recurring label", "accentColor": "#ffd700" },
  "musicGuidance": { "mode": "auto|on|off", "mood": "optional production mood" }
}
Hard rules: sections must be ordered, non-overlapping, and endSeconds must never exceed durationSeconds. purpose must be one of hook|context|explanation|proof|payoff|cta|other. A ranking section must contain exactly one rank.`;

export function buildScriptGenerationPrompt(brief: ProductionBrief, targetDurationSeconds?: number): string {
  const { min, max } = brief.recommendedFormat.durationSeconds;
  const targetInstruction = targetDurationSeconds
    ? `operator target: ${targetDurationSeconds} seconds — use this exact editorial target`
    : `choose and explain an editorial target between ${min} and ${max} seconds`;
  return [
    "You are writing a short-form vertical video script plan from a production brief.",
    "Write the voiceover for an ORIGINAL video. Never reuse or paraphrase the source content's footage or script.",
    "",
    "## Production brief",
    `hook type: ${brief.hook.type} (strength: ${brief.hook.strength})`,
    `format: ${brief.recommendedFormat.type}`,
    `duration: between ${min} and ${max} seconds — stay inside this range`,
    targetInstruction,
    `production difficulty: ${brief.productionDifficulty}`,
    `potential: ${brief.potential}`,
    "",
    "Why this works:",
    ...brief.whyInteresting.map((reason) => `- ${reason}`),
    "",
    "Adaptation ideas to choose from or combine:",
    ...brief.adaptationIdeas.map((idea) => `- ${idea}`),
    ...(brief.risks.length > 0 ? ["", "Risks to keep in mind:", ...brief.risks.map((risk) => `- ${risk}`)] : []),
    "",
    "## Task",
    `Write a complete script plan of ${targetDurationSeconds ? `${targetDurationSeconds}` : `${min}-${max}`} seconds: a hook line, timed sections with voiceover text, a visual plan, and separate caption, dressing, and music guidance.`,
    "Narration should cover 85-95% of the chosen duration (roughly 2.5 words per second); reserve the rest for short visual holds and transitions.",
    "",
    RESPONSE_CONTRACT
  ].join("\n");
}
