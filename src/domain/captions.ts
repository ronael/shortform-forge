import type { CandidateSegment, Transcript } from "./contracts.js";

export function buildAssCaptions(transcript: Transcript, candidate: CandidateSegment): string {
  const events = transcript.segments
    .filter((segment) => segment.endSeconds > candidate.startSeconds && segment.startSeconds < candidate.endSeconds)
    .map((segment, index) => {
      const start = Math.max(0, segment.startSeconds - candidate.startSeconds);
      const end = Math.max(start + 0.25, Math.min(candidate.endSeconds, segment.endSeconds) - candidate.startSeconds);
      const text = wrapCaption(segment.text).replace(/\n/g, "\\N");
      return `Dialogue: ${index},${formatAssTime(start)},${formatAssTime(end)},Caption,,0,0,0,,${escapeAss(text)}`;
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

function wrapCaption(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > 28 && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.slice(0, 3).join("\n");
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
