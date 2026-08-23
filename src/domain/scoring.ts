import type { CandidateSegment, Transcript, TranscriptSegment } from "./contracts.js";

const hookWords = ["why", "how", "secret", "mistake", "surprise", "because", "but", "actually", "never"];
const emotionWords = ["love", "hate", "fear", "amazing", "hard", "easy", "risk", "win", "fail", "shock"];

export function analyzeTranscript(transcript: Transcript): CandidateSegment[] {
  const windows = buildWindows(transcript.segments);
  return windows
    .map(scoreWindow)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((candidate, index) => ({ ...candidate, id: `candidate-${index + 1}` }));
}

function buildWindows(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const windows: TranscriptSegment[][] = [];
  for (let start = 0; start < segments.length; start += 1) {
    for (let end = start; end < Math.min(segments.length, start + 5); end += 1) {
      const window = segments.slice(start, end + 1);
      const first = window[0];
      const last = window.at(-1);
      if (!first || !last) continue;
      const duration = last.endSeconds - first.startSeconds;
      if (duration >= 8 && duration <= 75) windows.push(window);
    }
  }
  return windows.length > 0 ? windows : [segments];
}

function scoreWindow(window: TranscriptSegment[]): Omit<CandidateSegment, "id"> {
  const first = window[0];
  const last = window.at(-1);
  if (!first || !last) throw new Error("Cannot score empty transcript window");

  const text = window.map((segment) => segment.text.trim()).join(" ");
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  const duration = last.endSeconds - first.startSeconds;
  const hookHits = countMatches(words, hookWords);
  const emotionHits = countMatches(words, emotionWords);
  const punctuationBoost = /[?!]/.test(text) ? 8 : 0;
  const lengthScore = Math.max(0, 25 - Math.abs(duration - 32));
  const densityScore = Math.min(25, uniqueRatio * 30);
  const hookScore = Math.min(22, hookHits * 8 + (words.length > 8 ? 4 : 0));
  const emotionScore = Math.min(14, emotionHits * 6);
  const contextScore = /^(and|so|then|that|this|it)\b/i.test(text) ? -8 : 8;
  const score = clamp(Math.round(lengthScore + densityScore + hookScore + emotionScore + contextScore + punctuationBoost), 0, 100);

  const reasons = [
    `duration ${duration.toFixed(1)}s`,
    hookHits > 0 ? "contains hook language" : "self-contained phrasing",
    emotionHits > 0 ? "has emotional signal" : "clear informational passage"
  ];

  return {
    startSeconds: first.startSeconds,
    endSeconds: last.endSeconds,
    text,
    score,
    reasons
  };
}

function countMatches(words: string[], targets: string[]): number {
  const targetSet = new Set(targets);
  return words.filter((word) => targetSet.has(word.replace(/[^a-z]/g, ""))).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
