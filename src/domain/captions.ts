import type { CandidateSegment, Transcript } from "./contracts.js";

const MAX_CHARS_PER_LINE = 28;
const MAX_LINES_PER_CUE = 3;

export type CaptionCue = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  lines: string[];
};

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

function splitIntoCueTexts(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let currentWords: string[] = [];
  for (const word of words) {
    const nextWords = [...currentWords, word];
    if (currentWords.length > 0 && wrapCaption(nextWords.join(" ")).length > MAX_LINES_PER_CUE) {
      chunks.push(currentWords.join(" "));
      currentWords = [word];
    } else {
      currentWords = nextWords;
    }
  }
  if (currentWords.length > 0) chunks.push(currentWords.join(" "));
  return chunks.length > 0 ? chunks : [text];
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
