import type { ProductionBrief } from "../../domain/opportunity.js";

const RESPONSE_CONTRACT = `Respond with JSON only, no markdown fences, matching exactly this shape:
{
  "title": "working title for the video",
  "language": "fr",
  "durationSeconds": 40,
  "hook": { "text": "first spoken sentence", "durationSeconds": 3 },
  "sections": [
    { "startSeconds": 0, "endSeconds": 3, "purpose": "hook", "voiceover": "...", "visualGuidance": "optional" },
    { "startSeconds": 3, "endSeconds": 20, "purpose": "explanation", "voiceover": "..." }
  ],
  "visualPlan": [
    { "section": "hook", "visualType": "screen|b-roll|talking-head|text-on-screen|animation|other", "description": "..." }
  ],
  "captionGuidance": { "style": "dynamic|minimal|keyword-highlight", "keywordsToEmphasize": ["..."] }
}
Hard rules: sections must be ordered, non-overlapping, and endSeconds must never exceed durationSeconds. purpose must be one of hook|context|explanation|proof|payoff|cta|other.`;

export function buildScriptGenerationPrompt(brief: ProductionBrief): string {
  const { min, max } = brief.recommendedFormat.durationSeconds;
  return [
    "You are writing a short-form vertical video script plan from a production brief.",
    "Write the voiceover for an ORIGINAL video. Never reuse or paraphrase the source content's footage or script.",
    "",
    "## Production brief",
    `hook type: ${brief.hook.type} (strength: ${brief.hook.strength})`,
    `format: ${brief.recommendedFormat.type}`,
    `duration: between ${min} and ${max} seconds — stay inside this range`,
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
    `Write a complete script plan of ${min}-${max} seconds: a hook line, timed sections with voiceover text, a visual plan, and caption guidance.`,
    "Every section needs spoken voiceover text that fits its time budget (roughly 2.5 words per second).",
    "",
    RESPONSE_CONTRACT
  ].join("\n");
}
