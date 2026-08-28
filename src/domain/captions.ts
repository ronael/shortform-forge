import type { CandidateSegment, Transcript } from "./contracts.js";
import type { CaptionCuePlan } from "./composition.js";
import type { CaptionStyle, ScriptSection } from "./script.js";

const MAX_CHARS_PER_LINE = 28;
const MAX_LINES_PER_CUE = 3;
const HIGHLIGHT_COLOR = "&H0000E0FF";
const BASE_COLOR = "&H00FFFFFF";
const MAX_WORDS_PER_CUE: Record<CaptionStyle, number> = {
  minimal: 8,
  dynamic: 5,
  "keyword-highlight": 3
};

export type CaptionCue = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  lines: string[];
};

export type TimedWord = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

const CAPTION_STYLES: Record<CaptionStyle, string> = {
  dynamic: "Style: Caption,Arial,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,250,1",
  minimal: "Style: Caption,Arial,56,&H00FFFFFF,&H00FFFFFF,&H00000000,&H66000000,0,0,0,0,100,100,0,0,1,3,1,2,90,90,220,1",
  "keyword-highlight": "Style: Caption,Arial,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,250,1"
};

/** Builds compact, proportionally timed caption cues from voiceover sections. */
export function cuesFromSections(
  sections: Pick<ScriptSection, "startSeconds" | "endSeconds" | "voiceover">[],
  style: CaptionStyle = "dynamic"
): CaptionCuePlan[] {
  return sections.flatMap((section) => {
    const chunks = splitIntoCueTexts(section.voiceover, MAX_WORDS_PER_CUE[style]);
    const duration = section.endSeconds - section.startSeconds;
    const weights = chunks.map((chunk) => Math.max(1, chunk.split(/\s+/).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsedWeight = 0;
    return chunks.map((chunk, index) => {
      const cueStart = section.startSeconds + duration * (elapsedWeight / totalWeight);
      elapsedWeight += weights[index] ?? 0;
      const cueEnd = index === chunks.length - 1
        ? section.endSeconds
        : section.startSeconds + duration * (elapsedWeight / totalWeight);
      return {
        startSeconds: cueStart,
        endSeconds: Math.max(cueStart + 0.25, cueEnd),
        text: chunk
      };
    });
  });
}

export function cuesFromTimedWords(words: TimedWord[], style: CaptionStyle): CaptionCuePlan[] {
  const groupSize = MAX_WORDS_PER_CUE[style];
  const cues: CaptionCuePlan[] = [];
  for (let index = 0; index < words.length; index += groupSize) {
    const group = words.slice(index, index + groupSize);
    const first = group[0];
    const last = group.at(-1);
    if (!first || !last) continue;
    cues.push({
      startSeconds: first.startSeconds,
      endSeconds: Math.max(first.startSeconds + 0.12, last.endSeconds),
      text: group.map((word) => word.text).join(" ")
    });
  }
  return cues;
}

/** Renders caption cues as an ASS subtitle document with the given style. */
export function buildAssFromCues(cues: CaptionCuePlan[], style: CaptionStyle, keywordsToEmphasize: string[] = []): string {
  const events = cues.map((cue, index) => {
    const escaped = wrapCaption(cue.text).map((line) => escapeAss(line));
    const lines = style === "keyword-highlight"
      ? escaped.map((line) => highlightKeywords(line, keywordsToEmphasize))
      : escaped;
    return `Dialogue: ${index},${formatAssTime(cue.startSeconds)},${formatAssTime(cue.endSeconds)},Caption,,0,0,0,,${captionAnimation(style)}${lines.join("\\N")}`;
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${CAPTION_STYLES[style]}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export function captionStyleDefinition(style: CaptionStyle): string {
  return CAPTION_STYLES[style];
}

export function wrapCaptionLines(text: string): string[] {
  return wrapCaption(text);
}

export function highlightAssKeywords(line: string, keywords: string[]): string {
  return highlightKeywords(line, keywords);
}

function highlightKeywords(line: string, keywords: string[]): string {
  let result = line;
  for (const keyword of keywords) {
    if (!keyword) continue;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(${escaped})`, "gi"), `{\\1c${HIGHLIGHT_COLOR}\\b1}$1{\\1c${BASE_COLOR}\\b0}`);
  }
  return result;
}

export function buildAssCaptions(transcript: Transcript, candidate: CandidateSegment): string {
  const events = buildCaptionCues(transcript, candidate)
    .map((cue, index) => {
      const text = cue.lines.join("\\N");
      return `Dialogue: ${index},${formatAssTime(cue.startSeconds)},${formatAssTime(cue.endSeconds)},Caption,,0,0,0,,${escapeAss(text)}`;
    });

  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H99000000,-1,0,0,0,100,100,0,0,1,5,2,2,90,90,250,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

export function buildCaptionCues(transcript: Transcript, candidate: CandidateSegment): CaptionCue[] {
  return transcript.segments
    .filter((segment) => segment.endSeconds > candidate.startSeconds && segment.startSeconds < candidate.endSeconds)
    .flatMap((segment) => {
      const start = Math.max(0, segment.startSeconds - candidate.startSeconds);
      const end = Math.max(start + 0.25, Math.min(candidate.endSeconds, segment.endSeconds) - candidate.startSeconds);
      const chunks = splitIntoCueTexts(segment.text);
      const duration = end - start;
      return chunks.map((chunk, index) => {
        const cueStart = start + (duration * index) / chunks.length;
        const cueEnd = index === chunks.length - 1 ? end : start + (duration * (index + 1)) / chunks.length;
        return {
          startSeconds: cueStart,
          endSeconds: Math.max(cueStart + 0.25, cueEnd),
          text: chunk,
          lines: wrapCaption(chunk)
        };
      });
    });
}

export function checkCaptionCompleteness(ass: string, transcript: Transcript, candidate: CandidateSegment): {
  status: "pass" | "fail";
  missingWords: string[];
  expectedWordCount: number;
  renderedWordCount: number;
} {
  const expectedWords = captionWords(selectedTranscriptText(transcript, candidate));
  const renderedWords = captionWords(extractAssDialogueText(ass));
  const renderedCounts = countWords(renderedWords);
  const missingWords: string[] = [];
  for (const word of expectedWords) {
    const count = renderedCounts.get(word) ?? 0;
    if (count > 0) {
      renderedCounts.set(word, count - 1);
    } else {
      missingWords.push(word);
    }
  }
  return {
    status: missingWords.length === 0 ? "pass" : "fail",
    missingWords,
    expectedWordCount: expectedWords.length,
    renderedWordCount: renderedWords.length
  };
}

export function extractAssDialogueText(ass: string): string {
  return ass
    .split("\n")
    .filter((line) => line.startsWith("Dialogue:"))
    .map((line) => line.split(",").slice(9).join(","))
    .join(" ")
    .replace(/\\N/g, " ");
}

function selectedTranscriptText(transcript: Transcript, candidate: CandidateSegment): string {
  return transcript.segments
    .filter((segment) => segment.endSeconds > candidate.startSeconds && segment.startSeconds < candidate.endSeconds)
    .map((segment) => segment.text)
    .join(" ");
}

function splitIntoCueTexts(text: string, maxWords = 8): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  for (const word of words) {
    const nextWords = [...currentWords, word];
    if (currentWords.length > 0 && (currentWords.length >= maxWords || wrapCaption(nextWords.join(" ")).length > MAX_LINES_PER_CUE)) {
      chunks.push(currentWords.join(" "));
      currentWords = [word];
    } else {
      currentWords = nextWords;
    }
  }
  if (currentWords.length > 0) chunks.push(currentWords.join(" "));
  return chunks.length > 0 ? chunks : [text];
}

export function captionAnimation(style: CaptionStyle): string {
  if (style === "minimal") return "{\\fad(80,80)}";
  if (style === "dynamic") return "{\\fad(45,60)\\fscx94\\fscy94\\t(0,120,\\fscx100\\fscy100)}";
  return "{\\fad(35,55)\\fscx90\\fscy90\\t(0,105,\\fscx104\\fscy104)\\t(105,180,\\fscx100\\fscy100)}";
}

function wrapCaption(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > MAX_CHARS_PER_LINE && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function escapeAss(text: string): string {
  return text.replace(/[{}]/g, "");
}

function formatAssTime(totalSeconds: number): string {
  const centiseconds = Math.round(totalSeconds * 100);
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const seconds = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function captionWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}
